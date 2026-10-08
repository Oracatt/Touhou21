# Paint a recorded DrawList (tools/menu-preview.mjs) with System.Drawing.
# Layout preview only: additive blending is drawn as normal alpha blending.
param([Parameter(Mandatory = $true)][string]$Json, [Parameter(Mandatory = $true)][string]$Png)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$data = Get-Content -LiteralPath $Json -Raw -Encoding UTF8 | ConvertFrom-Json
$bitmap = New-Object System.Drawing.Bitmap 960, 720
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
function ColorOf($value) {
  $c = [uint32][double]$value
  [System.Drawing.Color]::FromArgb([int]($c -band 255), [int](($c -shr 24) -band 255), [int](($c -shr 16) -band 255), [int](($c -shr 8) -band 255))
}
$images = @{}; $texts = @{}
function TextureOf($id) {
  $key = [string]$id
  $info = $data.textures.$key
  if (-not $info) { return $null }
  if ($info.kind -eq 'image') {
    if (-not $images.ContainsKey($info.path)) { $images[$info.path] = [System.Drawing.Image]::FromFile($info.path) }
    return $images[$info.path]
  }
  if (-not $texts.ContainsKey($key)) {
    $w = [Math]::Max(1, [int][Math]::Ceiling($info.width)); $h = [Math]::Max(1, [int][Math]::Ceiling($info.height))
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $tg = [System.Drawing.Graphics]::FromImage($bmp); $tg.SmoothingMode = 'AntiAlias'
    $family = New-Object System.Drawing.FontFamily $info.font
    $pathShape = New-Object System.Drawing.Drawing2D.GraphicsPath
    $format = New-Object System.Drawing.StringFormat
    $pathShape.AddString([string]$info.text, $family, 0, [single]$info.size, (New-Object System.Drawing.PointF ([single]$info.stroke), ([single]($info.size * .08))), $format)
    if ($info.stroke -gt 0) {
      $pen = New-Object System.Drawing.Pen (ColorOf $info.outline), ([single]($info.stroke * 2)); $pen.LineJoin = 'Round'
      $tg.DrawPath($pen, $pathShape); $pen.Dispose()
    }
    $brush = New-Object System.Drawing.SolidBrush (ColorOf $info.fill); $tg.FillPath($brush, $pathShape); $brush.Dispose()
    $tg.Dispose(); $texts[$key] = $bmp
  }
  return $texts[$key]
}
function DrawTexture($id, $sx, $sy, $sw, $sh, $x, $y, $w, $h, $tint) {
  $image = TextureOf $id; if (-not $image) { return }
  if ($null -eq $sx) { $sx = 0; $sy = 0; $sw = $image.Width; $sh = $image.Height }
  $c = ColorOf $tint
  $matrix = New-Object System.Drawing.Imaging.ColorMatrix
  $matrix.Matrix00 = $c.R / 255; $matrix.Matrix11 = $c.G / 255; $matrix.Matrix22 = $c.B / 255; $matrix.Matrix33 = $c.A / 255
  $attributes = New-Object System.Drawing.Imaging.ImageAttributes; $attributes.SetColorMatrix($matrix)
  $dest = New-Object System.Drawing.Rectangle ([int]($x - $w / 2)), ([int]($y - $h / 2)), ([int]$w), ([int]$h)
  $g.DrawImage($image, $dest, [single]$sx, [single]$sy, [single]$sw, [single]$sh, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
  $attributes.Dispose()
}
foreach ($cmd in $data.commands) {
  switch ($cmd[0]) {
    'clear' { $g.Clear((ColorOf $cmd[1])) }
    'rect' { $b = New-Object System.Drawing.SolidBrush (ColorOf $cmd[5]); $g.FillRectangle($b, [single]$cmd[1], [single]$cmd[2], [single]$cmd[3], [single]$cmd[4]); $b.Dispose() }
    'circle' { $r = [single]$cmd[3]; $b = New-Object System.Drawing.SolidBrush (ColorOf $cmd[4]); $g.FillEllipse($b, [single]($cmd[1] - $r), [single]($cmd[2] - $r), 2 * $r, 2 * $r); $b.Dispose() }
    'line' { $p = New-Object System.Drawing.Pen (ColorOf $cmd[6]), ([single][Math]::Max(1, $cmd[5])); $g.DrawLine($p, [single]$cmd[1], [single]$cmd[2], [single]$cmd[3], [single]$cmd[4]); $p.Dispose() }
    'triangle' {
      $b = New-Object System.Drawing.SolidBrush (ColorOf $cmd[7])
      $pts = [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF ([single]$cmd[1]), ([single]$cmd[2])), (New-Object System.Drawing.PointF ([single]$cmd[3]), ([single]$cmd[4])), (New-Object System.Drawing.PointF ([single]$cmd[5]), ([single]$cmd[6])))
      $g.FillPolygon($b, $pts); $b.Dispose()
    }
    'sprite' { DrawTexture $cmd[1] $null $null $null $null $cmd[2] $cmd[3] $cmd[4] $cmd[5] $cmd[7] }
    'spriteRegion' { DrawTexture $cmd[1] $cmd[2] $cmd[3] $cmd[4] $cmd[5] $cmd[6] $cmd[7] $cmd[8] $cmd[9] $cmd[11] }
    'scissor' { $g.SetClip((New-Object System.Drawing.RectangleF ([single]$cmd[1]), ([single]$cmd[2]), ([single]$cmd[3]), ([single]$cmd[4]))) }
    'scissorEnd' { $g.ResetClip() }
    default { }
  }
}
$bitmap.Save($Png, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bitmap.Dispose(); foreach ($i in $images.Values) { $i.Dispose() }; foreach ($t in $texts.Values) { $t.Dispose() }
