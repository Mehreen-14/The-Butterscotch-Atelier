param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $ProjectRoot 'public'
$tempDir = Join-Path $env:TEMP 'opencode\logo-build'

if (-not (Test-Path -LiteralPath $tempDir)) {
  New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

function New-AtelierLogo {
  param(
    [int]$Size,
    [string]$OutPath
  )

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  $canvas = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)

  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $canvas,
    [System.Drawing.Color]::FromArgb(255, 236, 181, 101),
    [System.Drawing.Color]::FromArgb(255, 152, 82, 24),
    45
  )

  $diameter = [Math]::Floor($Size * 0.94)
  $offset = [Math]::Floor(($Size - $diameter) / 2)
  $circle = New-Object System.Drawing.RectangleF($offset, $offset, $diameter, $diameter)

  $g.FillEllipse($grad, $circle)

  $pen = New-Object System.Drawing.Pen(
    [System.Drawing.Color]::FromArgb(210, 250, 230, 205),
    [Math]::Max(1, [Math]::Floor($Size * 0.035))
  )
  $g.DrawEllipse($pen, $circle)

  $fontSize = [Math]::Floor($Size * 0.55)
  $font = New-Object System.Drawing.Font('Georgia', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

  $letter = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 253, 236, 210))
  $letterY = [single](-1.0 * $Size * 0.02)
  $rectLetter = [System.Drawing.RectangleF]::new([single]0, $letterY, [single]$Size, [single]$Size)
  $g.DrawString('B', $font, $letter, $rectLetter, $sf)

  $pen.Dispose()
  $grad.Dispose()
  $font.Dispose()
  $letter.Dispose()
  $sf.Dispose()
  $g.Dispose()

  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$sizes = @(16, 32, 48, 256)
$pngPaths = @()

foreach ($size in $sizes) {
  $png = Join-Path $tempDir "logo-$size.png"
  New-AtelierLogo -Size $size -OutPath $png
  $pngPaths += $png
}

$icoPath = Join-Path $tempDir 'favicon.ico'
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)

$count = $pngPaths.Count

# ICONDIR
$bw.Write([UInt16]0)   # reserved
$bw.Write([UInt16]1)   # type: icon
$bw.Write([UInt16]$count)

$bodyBase = 6 + (16 * $count)
$offset = $bodyBase

$blobs = @{}
foreach ($png in $pngPaths) {
  $blobs[$png] = [System.IO.File]::ReadAllBytes($png)
}

foreach ($png in $pngPaths) {
  $size = [System.IO.Path]::GetFileNameWithoutExtension($png).Replace('logo-', '') | ForEach-Object { [int]$_ }
  $bytes = $blobs[$png]
  $bw.Write([byte]($(if ($size -ge 256) { 0 } else { $size })))  # width
  $bw.Write([byte]($(if ($size -ge 256) { 0 } else { $size })))  # height
  $bw.Write([byte]0)   # colour count
  $bw.Write([byte]0)   # reserved
  $bw.Write([UInt16]1) # planes
  $bw.Write([UInt16]32) # bit count
  $bw.Write([UInt32]$bytes.Length)
  $bw.Write([UInt32]$offset)
  $offset += $bytes.Length
}

foreach ($png in $pngPaths) {
  $bw.Write($blobs[$png])
}

$bw.Flush()
$bw.Dispose()
$fs.Dispose()

Copy-Item -LiteralPath $icoPath -Destination (Join-Path $publicDir 'favicon.ico') -Force
Copy-Item -LiteralPath (Join-Path $tempDir 'logo-256.png') -Destination (Join-Path $publicDir 'logo.png') -Force

Write-Host "Generated favicon.ico ($count sizes) and logo.png in $publicDir"