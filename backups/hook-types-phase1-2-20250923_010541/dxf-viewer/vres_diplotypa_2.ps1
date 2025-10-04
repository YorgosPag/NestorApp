<#
HOW TO RUN (copy-paste in PowerShell terminal):

powershell -ExecutionPolicy Bypass -File "F:\Pagonis_Nestor\src\subapps\dxf-viewer\vres_diplotypa.ps1"
# or repeat every 5 minutes:
powershell -ExecutionPolicy Bypass -File "F:\Pagonis_Nestor\src\subapps\dxf-viewer\vres_diplotypa.ps1" -IntervalSeconds 300

Notes:
- Save this file as UTF-8 (VS Code: Save with Encoding -> UTF-8).
- Requires Node.js + npm in PATH.
- Script is READ-ONLY: makes reports, does not modify code.
#>

param(
  [int]$IntervalSeconds = 0  # 0 = run once; e.g. 300 = loop every 5 min
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ----- TARGET FOLDER (fixed) -----
$RepoPath = "F:\Pagonis_Nestor\src\subapps\dxf-viewer"
$RepoPath = (Resolve-Path $RepoPath).Path
Set-Location $RepoPath

# ----- OUTPUTS -----
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportsRoot = Join-Path $RepoPath "reports\$ts"
New-Item -ItemType Directory -Force -Path $ReportsRoot | Out-Null

# Prefer ASCII filename to avoid encoding pitfalls on some systems:
$Report = Join-Path $ReportsRoot "report - vres diplotypa.md"
$Log    = Join-Path $ReportsRoot "run.log"
$JscpdOutDir = Join-Path $ReportsRoot "jscpd"

# ----- HELPERS -----
function Test-Command($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Append([string]$text){ $text | Out-File -FilePath $Global:Report -Append -Encoding UTF8 }
function H1($t){ Append "# $t`n" }
function H2($t){ Append "## $t`n" }
function CodeBlock($t){ Append "```"; Append $t; Append "```"; Append "" }

# ----- PREREQS -----
if (-not (Test-Command "node") -or -not (Test-Command "npm")) {
  throw "Node.js/npm not found in PATH."
}

$tools = @("knip","ts-prune","depcheck","jscpd","unimported")
if (-not (Test-Path "package.json")) { npm init -y | Out-Null }

$missing = @()
foreach($t in $tools){
  try {
    $exists = (npm ls $t --depth=0 --json | ConvertFrom-Json -ErrorAction Stop).dependencies.$t
    if (-not $exists) { $missing += $t }
  } catch { $missing += $t }
}
if ($missing.Count -gt 0){
  npm i -D $($missing -join ' ') --no-audit --no-fund | Out-Null
}

$HasRg = Require-Cmd "rg"

# Optional scoped folder names to scan specifically
$Scopes = @(
  "domains","applications","services","microservices","components",
  "functions","methods","hooks","classes","entities","models","types",
  "interfaces","contracts","constants","utils","configs","events",
  "handlers","context","providers","middleware","guards","validators",
  "transformers","assets","documentation","docs"
)

function Invoke-SingleRun {
  "Run $ts" | Out-File -FilePath $Log -Encoding UTF8

  # Start fresh report
  if (Test-Path $Global:Report) { Clear-Content -Path $Global:Report -ErrorAction SilentlyContinue }
  H1 "Report - code cleanup and duplicates ($ts)"
  Append "- Root: `$RepoPath`"
  Append "- Node: $(node -v)"
  Append "- Tools: knip, ts-prune, unimported, depcheck, jscpd, ripgrep(if available)"
  Append ""

  # ESLint if config exists
  $hasESLint = Get-ChildItem -Name ".eslintrc*" | Select-Object -First 1
  if ($hasESLint) {
    H2 "ESLint"
    $eslintOut = (npx --yes eslint . --max-warnings=0) 2>&1
    CodeBlock $eslintOut
    $eslintOut | Out-File -Append $Log
  } else {
    Append "_ESLint: no config found — skipped._`n"
  }

  # Main tools
  H2 "Knip — unused files/exports/scripts/deps"
  $knip = (npx --yes knip) 2>&1
  CodeBlock $knip

  H2 "ts-prune — unused exports"
  $tsprune = (npx --yes ts-prune) 2>&1
  CodeBlock $tsprune

  H2 "unimported — files not imported anywhere"
  $unimp = (npx --yes unimported) 2>&1
  CodeBlock $unimp

  H2 "depcheck — unused/missing dependencies"
  $dep = (npx --yes depcheck) 2>&1
  CodeBlock $dep

  H2 "jscpd — copy/paste duplicates"
  $jscpd = (npx --yes jscpd --min-tokens 50 --reporters console,html --output $JscpdOutDir .) 2>&1
  CodeBlock $jscpd
  Append ""
  Append "**HTML report:** `.\reports\$ts\jscpd\index.html`"
  Append ""

  # ripgrep checks
  if ($HasRg) {
    H2 "ripgrep — textual/syntactic checks (excluding node_modules, dist, build, coverage, .git)"
    Append ""

    Append "**Consecutive double words (example: the the)**"
    $a = (rg -nI --pcre2 '\b(\w+)\s+\1\b' --glob '!{node_modules,dist,build,coverage,.git}/*' .) 2>&1
    CodeBlock $a

    Append "**Repeated punctuation (double dots, commas, semicolons etc.)**"
    $b = (rg -nI --pcre2 '([,.;:!?])\s*\1+' --glob '!{node_modules,dist,build,coverage,.git}/*' .) 2>&1
    CodeBlock $b

    Append "**TODO / FIX-ME / HACK markers**"
    $c = (rg -nI 'TODO|FIXME|HACK' --glob '!{node_modules,dist,build,coverage,.git}/*' .) 2>&1
    CodeBlock $c

    Append "**Tiny/empty files (< 3 lines)**"
    $small = Get-ChildItem -Recurse -File | Where-Object {
      $_.FullName -notmatch '\\(node_modules|dist|build|coverage|\.git)\\'
    } | ForEach-Object {
      try {
        $lines = (Get-Content -Path $_.FullName -Raw -ErrorAction Stop).Split("`n").Count
      } catch { $lines = 0 }
      [PSCustomObject]@{ File=$_.FullName; Lines=$lines }
    } | Where-Object { $_.Lines -lt 3 }
    if ($small) { CodeBlock ($small | Out-String) } else { Append "_none_`n" }

    Append "**Duplicate files (same hash)**"
    $files = Get-ChildItem -Recurse -File | Where-Object {
      $_.FullName -notmatch '\\(node_modules|dist|build|coverage|\.git)\\'
    }
    $hashes = $files | ForEach-Object {
      try {
        $h = (Get-FileHash -Algorithm MD5 -Path $_.FullName).Hash
        [PSCustomObject]@{ Hash=$h; File=$_.FullName }
      } catch { }
    } | Sort-Object Hash,File
    $dupes = $hashes | Group-Object Hash | Where-Object { $_.Count -gt 1 }
    if ($dupes) {
      $buf = $dupes | ForEach-Object { $_.Group | Select-Object Hash,File } | Format-Table -AutoSize | Out-String
      CodeBlock $buf
    } else { Append "_none_`n" }

    H2 "Scoped passes (by folder names)"
    foreach($s in $Scopes){
      Append "**$s/**"
      $paths = Get-ChildItem -Recurse -Directory -Filter $s -ErrorAction SilentlyContinue
      if ($paths) {
        $res = foreach($p in $paths){
          rg -nI --pcre2 '\b(\w+)\s+\1\b|([,.;:!?])\s*\1+' $p.FullName 2>$null
        }
        if ($res){ CodeBlock ($res -join "`n") } else { Append "_ok_`n" }
      } else { Append "_not found_`n" }
    }
  } else {
    Append "_ripgrep (rg) not found — install if you want these checks._`n"
  }

  H2 "Summary"
  Append "- knip/ts-prune/unimported: dead files and exports"
  Append "- depcheck: unused deps"
  Append "- jscpd: duplication heatmap (HTML)"
  Append "- ripgrep: textual duplicates/punctuation, tiny files, duplicate files"
  Append ""
}

# Execute the analysis
Invoke-SingleRun

# Optional continuous mode
if ($IntervalSeconds -gt 0) {
  while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    Invoke-SingleRun
  }
}

Write-Host "OK. See report: $Report"
Write-Host "HTML: $JscpdOutDir\\index.html"
