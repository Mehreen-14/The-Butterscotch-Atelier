param(
  [string]$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artDest = Join-Path $projectRoot 'public\art'
$dataFile = Join-Path $projectRoot 'src\app\gallery-data.ts'

$mediaPattern = '\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$'

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
  Copy-Item -LiteralPath $profileSource -Destination (Join-Path $projectRoot 'public\profile.jpg') -Force
  Write-Host "Synced profile.jpg"
}

foreach ($folder in $folders) {
  $sourceDir = Join-Path $SourceRoot $folder
  $destDir = Join-Path $artDest $folder
  New-Item -ItemType Directory -Path $destDir -Force | Out-Null

  $sourceFiles = @(Get-ChildItem -File -LiteralPath $sourceDir -Force |
    Where-Object { $_.Name -notlike '~*' -and $_.Extension -match $mediaPattern })

  foreach ($file in $sourceFiles) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $destDir $file.Name) -Force
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