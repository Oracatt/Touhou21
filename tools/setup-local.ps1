[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param([string]$EngineSource, [switch]$VerifyOnly)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24 or newer is required.' }
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$arguments = @((Join-Path $PSScriptRoot 'setup-engine.mjs'), '--root', $projectRoot)
if ($EngineSource) { $arguments += @('--source', $EngineSource) }
if ($VerifyOnly) { $arguments += '--verify-only' }
elseif (-not $PSCmdlet.ShouldProcess($projectRoot, 'Restore pinned TypeScript/compiler products and native runtime')) { $arguments += '--plan' }
& node @arguments | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Pinned local dependency setup failed.' }
