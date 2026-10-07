param(
  [string]$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artDest = Join-Path $projectRoot 'public\art'
$dataFile = Join-Path $projectRoot 'src\app\gallery-data.ts'

$mediaPattern = '\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$'

Add-Type -AssemblyName System.Drawing

function Optimize-ImageFile {
  param([string]$Path)

  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($ext -notin @('.jpg', '.jpeg', '.png')) { return }

  $img = $null
  $bmp = $null
  $g = $null
  try {
    try {
      $img = [System.Drawing.Image]::FromFile($Path, $false)
    } catch {
      Write-Host "  warn: cannot decode $Path"
      return
    }

    $maxDim = 1600
    if ($img.Width -le $maxDim -and $img.Height -le $maxDim) { return }

    $scale = [math]::Min(1.0, $maxDim / [math]::Max($img.Width, $img.Height))
    $newW = [int][math]::Max(1, [math]::Round($img.Width * $scale))
    $newH = [int][math]::Max(1, [math]::Round($img.Height * $scale))

    $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $newW, $newH)))

    $tmp = "$Path.tmp"
    if ($ext -in @('.jpg', '.jpeg')) {
      $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
      $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [long]82)
      $bmp.Save($tmp, $jpegCodec, $params)
    } else {
      $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    }
  } finally {
    if ($g) { $g.Dispose() }
    if ($bmp) { $bmp.Dispose() }
    if ($img) { $img.Dispose() }
  }

  try {
    if (Test-Path -LiteralPath $tmp) {
      $before = [math]::Max(1, (Get-Item -LiteralPath $Path).Length)
      Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
      Move-Item -LiteralPath $tmp -Destination $Path -Force
      $after = [math]::Max(1, (Get-Item -LiteralPath $Path).Length)
      $savedPct = [math]::Round((1 - $after / $before) * 100)
      Write-Host "  optimized $(Split-Path -Leaf $Path) -> ${newW}x${newH} ($savedPct% smaller)"
    } else {
      Write-Host "  warn: no output for $Path"
    }
  } catch {
    Write-Host "  warn: could not replace $Path ($($_.Exception.Message))"
  }
}

$excludedDirs = @(
  (Split-Path -Leaf $projectRoot),
  'node_modules',
  'dist',
  '.git',
  '.vscode'
)

$folders = @(Get-ChildItem -LiteralPath $SourceRoot -Directory -Force |
  Where-Object { $_.Name -notin $excludedDirs -and $_.Name -notlike '.*' -and $_.Name -notlike '~*' } |
  Sort-Object Name |
  ForEach-Object { $_.Name })

Write-Host "Syncing art from $SourceRoot ($($folders.Count) folder(s))"

if (-not (Test-Path -LiteralPath $artDest)) {
  New-Item -ItemType Directory -Path $artDest -Force | Out-Null
}

$profileSource = Join-Path $SourceRoot 'profile.jpg'
if (Test-Path -LiteralPath $profileSource) {
  $profileDest = Join-Path $projectRoot 'public\profile.jpg'
  $profileSrcItem = Get-Item -LiteralPath $profileSource
  $needProfile = -not (Test-Path -LiteralPath $profileDest) -or
    (Get-Item -LiteralPath $profileDest).LastWriteTime -lt $profileSrcItem.LastWriteTime
  if ($needProfile) {
    Copy-Item -LiteralPath $profileSource -Destination $profileDest -Force
    Optimize-ImageFile -Path $profileDest
    Write-Host "Synced profile.jpg"
  }
}

foreach ($folder in $folders) {
  $sourceDir = Join-Path $SourceRoot $folder
  $destDir = Join-Path $artDest $folder
  New-Item -ItemType Directory -Path $destDir -Force | Out-Null

  $sourceFiles = @(Get-ChildItem -File -LiteralPath $sourceDir -Force |
    Where-Object { $_.Name -notlike '~*' -and $_.Extension -match $mediaPattern })

  foreach ($file in $sourceFiles) {
    $destPath = Join-Path $destDir $file.Name
    $skip = $false
    if (Test-Path -LiteralPath $destPath) {
      $destItem = Get-Item -LiteralPath $destPath
      if ($destItem.LastWriteTime -ge $file.LastWriteTime) { $skip = $true }
    }
    if (-not $skip) {
      Copy-Item -LiteralPath $file.FullName -Destination $destPath -Force
      Optimize-ImageFile -Path $destPath
    }
  }

  $destNames = @($sourceFiles | ForEach-Object { $_.Name })
  Get-ChildItem -File -LiteralPath $destDir -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notin $destNames } |
    Remove-Item -Force
}

$destFolders = @(Get-ChildItem -LiteralPath $artDest -Directory -Force -ErrorAction SilentlyContinue |
  ForEach-Object { $_.Name })
foreach ($stale in ($destFolders | Where-Object { $_ -notin $folders })) {
  Remove-Item -LiteralPath (Join-Path $artDest $stale) -Recurse -Force
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("import { GalleryCategory } from './gallery-category.model';")
[void]$sb.AppendLine('')
[void]$sb.AppendLine('export const GALLERY: GalleryCategory[] = [')

foreach ($folder in $folders) {
  $destDir = Join-Path $artDest $folder
  $files = @(Get-ChildItem -File -LiteralPath $destDir -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -match $mediaPattern } |
    Sort-Object Name)
  if ($files.Count -eq 0) { continue }
  $slug = ($folder.ToLower() -replace ' ', '-')
  $escaped = $folder -replace "'", "''"
  [void]$sb.AppendLine('  {')
  [void]$sb.AppendLine("    name: '$escaped',")
  [void]$sb.AppendLine("    slug: '$slug',")
  [void]$sb.AppendLine('    items: [')
  foreach ($file in $files) {
    $folderEnc = [Uri]::EscapeDataString($folder)
    $fileEnc = [Uri]::EscapeDataString($file.Name)
    $rel = "/art/$folderEnc/$fileEnc"
    [void]$sb.AppendLine("      '$rel',")
  }
  [void]$sb.AppendLine('    ]')
  [void]$sb.AppendLine('  },')
}
[void]$sb.AppendLine('];')

Set-Content -LiteralPath $dataFile -Value $sb.ToString() -Encoding UTF8
Write-Host "Synced. Wrote $dataFile"