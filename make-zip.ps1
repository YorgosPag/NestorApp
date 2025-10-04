# make-zip.ps1
# Creates zip of F:\Pagonis_Nestor excluding:
#   F:\Pagonis_Nestor\node_modules
#   F:\Pagonis_Nestor\src\subapps\dxf-viewer\node_modules
# and writes Pagonis_Nestor_YYYYMMDD-HHMMSS.zip to F:\

Param(
  [string]$SourceRoot   = "F:\Pagonis_Nestor",
  [string]$TargetRoot   = "F:\",
  [string[]]$ExcludeDirs = @(
    "F:\Pagonis_Nestor\node_modules",
    "F:\Pagonis_Nestor\src\subapps\dxf-viewer\node_modules"
  )
)

$ErrorActionPreference = "Stop"

function Normalize([string]$p) {
  return [System.IO.Path]::GetFullPath($p)
}

# --- Resolve paths safely (even if exclude dirs don't exist) ---
$SourceRoot  = Normalize $SourceRoot
$TargetRoot  = Normalize $TargetRoot
$ExcludeDirs = $ExcludeDirs | ForEach-Object { Normalize $_ }

if (-not (Test-Path $SourceRoot -PathType Container)) {
  throw "Source folder not found: $SourceRoot"
}
if (-not (Test-Path $TargetRoot -PathType Container)) {
  throw "Target folder not found: $TargetRoot"
}

# Zip name: Pagonis_Nestor_YYYYMMDD-HHMMSS.zip
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName   = "Pagonis_Nestor_{0}.zip" -f $timestamp
$zipFinal  = Join-Path $TargetRoot $zipName

# Temporary zip for atomic move
$tmpZip = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString() + ".zip")

# .NET Zip API
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

function Should-ExcludeFile([string]$fileFullPath, [string[]]$exDirs) {
  foreach ($ex in $exDirs) {
    $exNorm = ($ex.TrimEnd('\') + '\')
    if ($fileFullPath.StartsWith($exNorm, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }
  return $false
}

# Include root folder name in zip (e.g. "Pagonis_Nestor/...")
$rootFolderName = Split-Path $SourceRoot -Leaf

# --- Create zip ---
$fs = $null
$zip = $null
try {
  $fs  = [System.IO.File]::Open($tmpZip, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create, $false)

  # Process all files
  $files = Get-ChildItem -LiteralPath $SourceRoot -Recurse -Force -File
  $count = 0
  foreach ($f in $files) {
    $full = $f.FullName
    if (Should-ExcludeFile -fileFullPath $full -exDirs $ExcludeDirs) { continue }

    # Relative path from SourceRoot
    $rel = $full.Substring($SourceRoot.Length).TrimStart('\','/')
    $rel = $rel -replace '\\','/'  # zip-friendly separators
    $entryName = "$rootFolderName/$rel"

    try {
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, $full, $entryName, [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
      $count++
    } catch {
      Write-Warning ("Skipping file: {0} - {1}" -f $rel, $_.Exception.Message)
    }
  }

  if ($count -eq 0) {
    throw "No files were added. Check the exclude paths;"
  }
}
catch {
  if ($zip) { $zip.Dispose() }
  if ($fs)  { $fs.Dispose() }
  if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue }
  throw
}
finally {
  if ($zip) { $zip.Dispose() }
  if ($fs)  { $fs.Dispose() }
}

# --- Move temporary zip to F:\ with final name ---
Move-Item -LiteralPath $tmpZip -Destination $zipFinal -Force

Write-Host ("Done: {0}" -f $zipFinal)
