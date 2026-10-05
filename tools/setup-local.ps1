[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [string]$EngineSource,
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$lockPath = Join-Path $projectRoot 'engine.lock.json'
$lock = Get-Content -LiteralPath $lockPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($lock.format -ne 'touhou21-engine-lock-v1' -or $lock.commit -notmatch '^[a-f0-9]{40}$') { throw 'Invalid engine.lock.json.' }
if (-not $EngineSource) { $EngineSource = $lock.source }
$engineRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $EngineSource).Path)
$projectPrefix = $projectRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
$enginePrefix = $engineRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if ($projectRoot.Equals($engineRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $projectRoot.StartsWith($enginePrefix, [StringComparison]::OrdinalIgnoreCase) -or
    $engineRoot.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The game and engine source must be separate directories.'
}

function Assert-NoLinks([string]$Path, [string]$StopAt) {
    $probe = [IO.Path]::GetFullPath($Path)
    $stop = [IO.Path]::GetFullPath($StopAt)
    while ($true) {
        if ((Test-Path -LiteralPath $probe) -and
            ((Get-Item -LiteralPath $probe -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'A dependency copy path may not pass through a link or junction.'
        }
        if ($probe.Equals($stop, [StringComparison]::OrdinalIgnoreCase)) { break }
        $parent = Split-Path -Parent $probe
        if (-not $parent -or $parent -eq $probe) { throw 'Copy path is outside its declared root.' }
        $probe = $parent
    }
}

function Resolve-ListedPath([string]$Root, [string]$Relative) {
    if (-not $Relative -or [IO.Path]::IsPathRooted($Relative) -or $Relative.Contains('\') -or $Relative.Contains(':')) {
        throw 'Unsafe relative path in engine.lock.json.'
    }
    foreach ($part in $Relative.Split('/')) {
        if (-not $part -or $part -eq '.' -or $part -eq '..' -or $part -eq '.git' -or $part -eq 'userdata' -or $part -eq 'node_modules' -or $part -match '^\.env($|\.)' -or $part -match '[.\s]$|[\x00-\x1f]' -or $part -match '^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)') {
            throw 'Unsafe relative path in engine.lock.json.'
        }
    }
    $base = [IO.Path]::GetFullPath($Root)
    $full = [IO.Path]::GetFullPath((Join-Path $base $Relative))
    $prefix = $base.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Copy path escapes its root.' }
    Assert-NoLinks $full $base
    return $full
}

function Assert-OwnedPath([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    if (-not $full.Equals($projectRoot, [StringComparison]::OrdinalIgnoreCase) -and
        -not $full.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The installer may write only inside this game.'
    }
    Assert-NoLinks $full $projectRoot
    return $full
}

function Assert-File([string]$Path, $Entry, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label is missing: $($Entry.path)" }
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Length -ne $Entry.bytes) { throw "$Label size differs from lock: $($Entry.path)" }
    $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $Entry.sha256) { throw "$Label hash differs from lock: $($Entry.path)" }
}

function Assert-InventoryDigest($Entries, [string]$Expected) {
    $names = @($Entries | ForEach-Object { [string]$_.path })
    [Array]::Sort($names, [StringComparer]::Ordinal)
    $byPath = @{}
    foreach ($entry in $Entries) {
        if ($byPath.ContainsKey($entry.path) -or $entry.sha256 -notmatch '^[a-f0-9]{64}$' -or $entry.bytes -lt 0) { throw 'Invalid file inventory.' }
        $byPath[$entry.path] = $entry
    }
    $text = [Text.StringBuilder]::new()
    foreach ($name in $names) {
        $entry = $byPath[$name]
        [void]$text.Append($name).Append([char]0).Append([string]$entry.bytes).Append([char]0).Append($entry.sha256).Append([char]10)
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $actual = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text.ToString())))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    if ($actual -ne $Expected) { throw 'The file inventory digest is invalid.' }
}

function Assert-InstalledTree([string]$Directory, $Entries) {
    $missing = [Collections.Generic.List[object]]::new()
    $expected = @{}
    foreach ($entry in $Entries) {
        $expected[$entry.path] = $true
        $target = Resolve-ListedPath $Directory $entry.path
        if (Test-Path -LiteralPath $target) { Assert-File $target $entry 'Existing dependency' }
        else { $missing.Add($entry) }
    }
    if (Test-Path -LiteralPath $Directory) {
        $base = [IO.Path]::GetFullPath($Directory).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
        foreach ($item in Get-ChildItem -LiteralPath $Directory -Recurse -Force) {
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Installed dependency tree contains a link.' }
            if (-not $item.PSIsContainer) {
                $relative = $item.FullName.Substring($base.Length).Replace('\', '/')
                if (-not $expected.ContainsKey($relative)) { throw 'Installed dependency has files not present in the lock.' }
            }
        }
    }
    return $missing.ToArray()
}

Assert-NoLinks $projectRoot $projectRoot
Assert-NoLinks $engineRoot $engineRoot
Assert-InventoryDigest $lock.thlibFiles $lock.thlibSha256
Assert-InventoryDigest $lock.runtimeFiles $lock.runtimeSha256
$commit = (& git -C $engineRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -ne $lock.commit) { throw 'Engine source commit differs from lock.' }
$sourceChanges = @(& git -C $engineRoot status --porcelain)
if ($LASTEXITCODE -ne 0 -or $sourceChanges.Count -ne 0) { throw 'Source engine has local modifications; no dependency files were changed.' }
if ($lock.PSObject.Properties.Name -contains 'nativeBuild') {
    Assert-InventoryDigest $lock.nativeBuild.sourceFiles $lock.nativeBuild.sourceSha256
    foreach ($entry in $lock.nativeBuild.sourceFiles) { Assert-File (Resolve-ListedPath $engineRoot $entry.path) $entry 'Native build source' }
    foreach ($entry in @($lock.nativeBuild.hostObject, $lock.nativeBuild.dependencyLog)) {
        $evidenceFile = Resolve-ListedPath $engineRoot $entry.source
        if ((Get-FileHash -LiteralPath $evidenceFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {
            throw 'Native compiler evidence differs from the locked build.'
        }
    }
}

$sourceLibrary = Resolve-ListedPath $engineRoot 'packages/thlib'
$libraryTarget = Assert-OwnedPath (Join-Path $projectRoot 'packages/thlib')
$runtimeTarget = Assert-OwnedPath (Join-Path $projectRoot 'runtime')
foreach ($entry in $lock.thlibFiles) { Assert-File (Resolve-ListedPath $sourceLibrary $entry.path) $entry 'Read-only source library' }
foreach ($entry in $lock.runtimeFiles) { Assert-File (Resolve-ListedPath $engineRoot $entry.source) $entry 'Read-only source runtime' }
$missingLibrary = @(Assert-InstalledTree $libraryTarget $lock.thlibFiles)
$missingRuntime = @(Assert-InstalledTree $runtimeTarget $lock.runtimeFiles)

$moduleParent = Assert-OwnedPath (Join-Path $projectRoot 'node_modules/@ts-stg')
$modulePath = Join-Path $moduleParent 'thlib'
$moduleItem = Get-Item -LiteralPath $modulePath -Force -ErrorAction SilentlyContinue
$moduleExists = $null -ne $moduleItem
if ($moduleExists) {
    if ($moduleItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        $resolvedTarget = [IO.Path]::GetFullPath([string](@($moduleItem.Target)[0]))
        if (-not $resolvedTarget.Equals($libraryTarget, [StringComparison]::OrdinalIgnoreCase)) { throw 'Node dependency junction points outside this game library.' }
    } else {
        $missingNode = @(Assert-InstalledTree $modulePath $lock.thlibFiles)
        if ($missingNode.Count -gt 0) { throw 'Existing Node dependency copy is incomplete; preserve or move it before reinstalling.' }
    }
}

if ($VerifyOnly) {
    if ($missingLibrary.Count -gt 0 -or $missingRuntime.Count -gt 0 -or -not $moduleExists) { throw 'Local dependencies are incomplete.' }
    Write-Output "Verified pinned local dependencies at $($lock.commit). No files changed."
    return
}
if ($missingLibrary.Count -eq 0 -and $missingRuntime.Count -eq 0 -and $moduleExists) {
    Write-Output "Pinned local dependencies are already installed at $($lock.commit). No files changed."
    return
}
if (-not $PSCmdlet.ShouldProcess($projectRoot, 'Restore missing, byte-pinned private runtime/thlib files and a local Node junction')) { return }

$staging = Assert-OwnedPath (Join-Path $projectRoot ('build/dependency-staging-' + [Guid]::NewGuid().ToString('N')))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
$pending = [Collections.Generic.List[object]]::new()
foreach ($group in @(@{Entries=$missingLibrary;Source=$sourceLibrary;Target=$libraryTarget;Stage='thlib'}, @{Entries=$missingRuntime;Source=$engineRoot;Target=$runtimeTarget;Stage='runtime'})) {
    foreach ($entry in $group.Entries) {
        $sourceRelative = if ($group.Stage -eq 'runtime') { $entry.source } else { $entry.path }
        $sourceFile = Resolve-ListedPath $group.Source $sourceRelative
        $stageFile = Assert-OwnedPath (Join-Path $staging ($group.Stage + '/' + $entry.path))
        New-Item -ItemType Directory -Path (Split-Path -Parent $stageFile) -Force | Out-Null
        Copy-Item -LiteralPath $sourceFile -Destination $stageFile
        Assert-File $stageFile $entry 'Staged dependency'
        $pending.Add(@{Stage=$stageFile;Target=(Resolve-ListedPath $group.Target $entry.path);Entry=$entry})
    }
}
$commitAfterCopy = (& git -C $engineRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commitAfterCopy -ne $lock.commit) { throw 'Engine source commit changed during copying.' }
foreach ($item in $pending) {
    $targetFile = Assert-OwnedPath $item.Target
    $stageFile = Assert-OwnedPath $item.Stage
    if (Test-Path -LiteralPath $targetFile) { throw 'A target appeared during installation; existing files were preserved.' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetFile) -Force | Out-Null
    Move-Item -LiteralPath $stageFile -Destination $targetFile
    Assert-File $targetFile $item.Entry 'Restored dependency'
}
if (-not $moduleExists) {
    New-Item -ItemType Directory -Path $moduleParent -Force | Out-Null
    New-Item -ItemType Junction -Path $modulePath -Target $libraryTarget | Out-Null
}
Write-Output "Restored $($pending.Count) locked files and local dependency resolution. Source engine was read only."
