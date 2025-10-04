<#
CLEAN VERSION - HOW TO RUN:
powershell -ExecutionPolicy Bypass -File "src\subapps\dxf-viewer\vres_diplotypa_3.ps1"
#>

param(
  [int]$IntervalSeconds = 0
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Target folder
$RepoPath = "F:\Pagonis_Nestor\src\subapps\dxf-viewer"
$RepoPath = (Resolve-Path $RepoPath).Path
Set-Location $RepoPath

# Output paths
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportsRoot = Join-Path $RepoPath "reports\$ts"
New-Item -ItemType Directory -Force -Path $ReportsRoot | Out-Null

$Report = Join-Path $ReportsRoot "report.md"
$JscpdOutDir = Join-Path $ReportsRoot "jscpd"

# Helper functions
function Test-Command($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function AppendToReport([string]$text) { $text | Out-File -FilePath $Global:Report -Append -Encoding UTF8 }
function WriteHeader($text) { AppendToReport "## $text`n" }
function WriteCodeBlock($text) { 
  AppendToReport "```"
  AppendToReport $text
  AppendToReport "```"
  AppendToReport ""
}

# Check prerequisites
if (-not (Test-Command "node") -or -not (Test-Command "npm")) {
  throw "Node.js/npm not found in PATH."
}

$HasRg = Test-Command "rg"

function Invoke-Analysis {
  # Clear previous report
  if (Test-Path $Global:Report) { 
    Clear-Content -Path $Global:Report -ErrorAction SilentlyContinue 
  }
  
  AppendToReport "# Code Analysis Report ($ts)`n"
  AppendToReport "- Root: ``$RepoPath```n"
  AppendToReport "- Node: $(node -v)`n"
  AppendToReport ""

  # ESLint check
  $hasESLint = Get-ChildItem -Name ".eslintrc*" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($hasESLint) {
    WriteHeader "ESLint"
    try {
      $eslintOut = (npx --yes eslint . --max-warnings=0) 2>&1 | Out-String
      WriteCodeBlock $eslintOut
    } catch {
      WriteCodeBlock "ESLint failed: $($_.Exception.Message)"
    }
  } else {
    AppendToReport "_ESLint: no config found_`n"
  }

  # Main analysis tools
  WriteHeader "Knip - unused files/exports/deps"
  try {
    $knip = (npx --yes knip) 2>&1 | Out-String
    WriteCodeBlock $knip
  } catch {
    WriteCodeBlock "Knip failed: $($_.Exception.Message)"
  }

  WriteHeader "ts-prune - unused exports"
  try {
    $tsprune = (npx --yes ts-prune) 2>&1 | Out-String
    WriteCodeBlock $tsprune
  } catch {
    WriteCodeBlock "ts-prune failed: $($_.Exception.Message)"
  }

  WriteHeader "unimported - files not imported"
  try {
    $unimp = (npx --yes unimported) 2>&1 | Out-String
    WriteCodeBlock $unimp
  } catch {
    WriteCodeBlock "unimported failed: $($_.Exception.Message)"
  }

  WriteHeader "depcheck - unused dependencies"
  try {
    $dep = (npx --yes depcheck) 2>&1 | Out-String
    WriteCodeBlock $dep
  } catch {
    WriteCodeBlock "depcheck failed: $($_.Exception.Message)"
  }

  WriteHeader "jscpd - copy/paste detection"
  try {
    $jscpd = (npx --yes jscpd --min-tokens 50 --reporters console,html --output $JscpdOutDir .) 2>&1 | Out-String
    WriteCodeBlock $jscpd
    AppendToReport "**HTML report**: ``reports\$ts\jscpd\index.html```n"
  } catch {
    WriteCodeBlock "jscpd failed: $($_.Exception.Message)"
  }

  # ripgrep checks if available
  if ($HasRg) {
    WriteHeader "ripgrep - textual analysis"
    
    AppendToReport "**Double words:**`n"
    try {
      $doubleWords = (rg -nI --pcre2 '\b(\w+)\s+\1\b' --glob '!{node_modules,dist,build,coverage,.git}/*' .) 2>&1 | Out-String
      WriteCodeBlock $doubleWords
    } catch {
      AppendToReport "_none found_`n"
    }
    
    AppendToReport "**TODO/FIXME markers:**`n"
    try {
      $todos = (rg -nI 'TODO|FIXME|HACK' --glob '!{node_modules,dist,build,coverage,.git}/*' .) 2>&1 | Out-String
      WriteCodeBlock $todos
    } catch {
      AppendToReport "_none found_`n"
    }
  } else {
    AppendToReport "_ripgrep (rg) not available - install for more checks_`n"
  }

  WriteHeader "Summary"
  AppendToReport "- Analysis complete`n"
  AppendToReport "- Check individual sections above for details`n"
  AppendToReport "- HTML duplication report available if jscpd succeeded`n"
}

# Run the analysis
Invoke-Analysis

# Optional continuous mode
if ($IntervalSeconds -gt 0) {
  while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    Invoke-Analysis
  }
}

Write-Host "Report generated: $Report"
Write-Host "HTML report: $JscpdOutDir\index.html"