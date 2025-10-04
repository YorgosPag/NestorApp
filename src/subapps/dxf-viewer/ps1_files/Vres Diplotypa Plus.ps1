<#
ΠΛΗΡΕΣ SCRIPT ΓΙΑ ΕΛΕΓΧΟ ΔΙΠΛΟΤΥΠΩΝ (Node/JS/TS) ΜΕ jscpd + ΣΥΝΟΨΗ + TREND + ESLint (προαιρετικό)

ΠΩΣ ΝΑ ΤΟ ΤΡΕΞΕΙΣ (παραδείγματα):

1) Μία φορά, default ρυθμίσεις (τρέχει στο τρέχον repo)
   powershell -ExecutionPolicy Bypass -File .\vres_diplotypa_plus.ps1

2) Με αυστηρό threshold και αποτυχία σε CI όταν ξεπεραστεί (FailOnDuplicates)
   powershell -ExecutionPolicy Bypass -File .\vres_diplotypa_plus.ps1 -DupThreshold 2 -FailOnDuplicates

3) Με προτίμηση στα local binaries (πιο γρήγορο αν έχεις devDependencies εγκατεστημένα)
   powershell -ExecutionPolicy Bypass -File .\vres_diplotypa_plus.ps1 -UseLocalBinaries

4) Ορίζοντας άλλο path του repo και φάκελο reports
   powershell -ExecutionPolicy Bypass -File .\vres_diplotypa_plus.ps1 -RepoPath "C:\path\to\repo" -ReportsDir "C:\path\to\repo\reports"

5) Watch mode (τρέχει ανά Χ δευτερόλεπτα)
   powershell -ExecutionPolicy Bypass -File .\vres_diplotypa_plus.ps1 -Watch -IntervalSeconds 120

ΣΗΜΕΙΩΣΕΙΣ:
- Παράγει φάκελο reports \YYYYMMDD-HHMMSS με:
  - report.md (markdown σύνοψη)
  - jscpd\index.html + jscpd-report.json + jscpd-report.xml
- Αν έχεις eslint στο project, θα τρέξει και αυτό (εκτός αν δώσεις -SkipESLint)
- Το script είναι read-only (δεν «διορθώνει» μόνο του). Χρησιμοποιεί threshold/exit code για CI gates.
#>

param(
  [string]$RepoPath = (Resolve-Path ".").Path,
  [string]$ReportsDir = "reports",
  [int]$DupMinTokens = 45,
  [int]$DupThreshold = 2,
  [string]$IgnoreGlobs = "{**/node_modules/**,**/dist/**,**/build/**,**/.git/**,**/coverage/**,**/__snapshots__/**,**/*.min.*}",
  [switch]$FailOnDuplicates,
  [switch]$UseLocalBinaries,
  [switch]$SkipESLint,
  [switch]$Watch,
  [int]$IntervalSeconds = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-Command([string]$name) {
  try { return [bool](Get-Command $name -ErrorAction Stop) } catch { return $false }
}

function New-DirectoryIfNotExists([string]$path) {
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
}

# Render helpers
$global:ReportFile = $null
function AppendToReport([string]$text) { $text | Out-File -FilePath $global:ReportFile -Encoding UTF8 -Append }
function WriteHeader([string]$title) {
  $line = ('#' * 3) + " " + $title
  Write-Host "`n$line" -ForegroundColor Cyan
  AppendToReport "`n$line`n"
}
function WriteCodeBlock([string]$content) {
  AppendToReport "```\n$($content.TrimEnd())\n```\n"
}

function Resolve-JscpdInvoker {
  $local = Join-Path $RepoPath "node_modules/.bin/jscpd"
  if ($UseLocalBinaries -and (Test-Path $local)) { return, @($local) }
  if (Test-Command "jscpd") { return, @("jscpd") }
  if (Test-Command "npx") { return, @("npx", "--yes", "jscpd") }
  throw "Could not find jscpd or npx. Install Node.js/npx or add jscpd as devDependency."
}

function Resolve-ESLintInvoker {
  $local = Join-Path $RepoPath "node_modules/.bin/eslint"
  if ($UseLocalBinaries -and (Test-Path $local)) { return, @($local) }
  if (Test-Command "eslint") { return, @("eslint") }
  if (Test-Command "npx") { return, @("npx", "--yes", "eslint") }
  return $null
}

function New-RunContext {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $runRoot = Join-Path $ReportsDir $stamp
  $jscpdOutDir = Join-Path $runRoot "jscpd"
  New-DirectoryIfNotExists $ReportsDir
  New-DirectoryIfNotExists $runRoot
  New-DirectoryIfNotExists $jscpdOutDir
  $global:ReportFile = Join-Path $runRoot "report.md"
  "# Duplication Report - $stamp`n`nRepo: $RepoPath`nReports: $runRoot`n" | Out-File -FilePath $global:ReportFile -Encoding UTF8
  return [PSCustomObject]@{ RunRoot = $runRoot; JscpdOut = $jscpdOutDir }
}

function Start-DuplicateAnalysis {
  param([PSCustomObject]$ctx)

  Push-Location $RepoPath
  try {
    WriteHeader "jscpd (duplicate code detection)"
    $invoker = Resolve-JscpdInvoker

    $jscpdJson = Join-Path $ctx.JscpdOut "jscpd-report.json"
    $jscpdXml  = Join-Path $ctx.JscpdOut "jscpd-report.xml"

    $jscpdArgs = @(
      "--min-tokens", $DupMinTokens,
      "--threshold",  $DupThreshold,
      "--reporters",  "console,html,json,xml",
      "--output",     $ctx.JscpdOut,
      "--ignore",     $IgnoreGlobs,
      "."
    )

    # Execute jscpd
    if ($invoker[0] -eq 'npx') {
      $out = (& $invoker[0] $invoker[1] $invoker[2] @jscpdArgs) 2>&1 | Out-String
    } else {
      $out = (& $invoker[0] @jscpdArgs) 2>&1 | Out-String
    }
    WriteCodeBlock $out

    # If jscpd sets non-zero (threshold exceeded or error)
    $jscpdExit = $LASTEXITCODE
    if ($jscpdExit -ne 0 -and $FailOnDuplicates) {
      AppendToReport "**❌ Duplication threshold exceeded (jscpd).**`n"
    }

    # Parse JSON for summary table
    try {
      if (Test-Path $jscpdJson) {
        $json = Get-Content $jscpdJson -Raw | ConvertFrom-Json
        $pct  = if ($json.statistics.percentage) { [Math]::Round($json.statistics.percentage,2) } else { $null }
        if ($null -ne $pct) { AppendToReport "**Total duplication:** $pct%`n" }

        $clones = $json.clones | Select-Object -First 10
        AppendToReport "`n### Top duplicates (first 10)\n| Lines | Files | Fragment |\n|------:|:------|:---------|"
        foreach ($c in $clones) {
          $lines = "$($c.lines)"
          $files = ($c.duplicates | ForEach-Object { $_.file }) -join "<br>"
          $frag  = $c.fragment
          if ($frag) {
            $frag = ($frag -replace '\n',' ') 
            if ($frag.Length -gt 60) { $frag = $frag.Substring(0,60) + ' ...' }
          } else { $frag = '' }
          AppendToReport "| $lines | $files | $frag |"
        }
        AppendToReport "`nHTML: ``$($ctx.JscpdOut)\index.html```n`nJSON: ``$jscpdJson```n`nXML: ``$jscpdXml```n"
      } else {
        AppendToReport "_jscpd JSON not found at ``$jscpdJson``._`n"
      }
    } catch {
      AppendToReport "_(Could not parse jscpd JSON: $($_.Exception.Message))_`n"
    }

    # Trend vs previous run
    try {
      $prev = Get-ChildItem $ReportsDir -Directory |
        Where-Object { $_.Name -match '^[0-9]{8}-[0-9]{6}$' -and $_.FullName -ne $ctx.RunRoot } |
        Sort-Object Name -Descending | Select-Object -First 1
      if ($prev) {
        $prevJson = Join-Path (Join-Path $prev.FullName 'jscpd') 'jscpd-report.json'
        if (Test-Path $prevJson -and (Test-Path $jscpdJson)) {
          $p = Get-Content $prevJson -Raw | ConvertFrom-Json
          $c = Get-Content $jscpdJson -Raw | ConvertFrom-Json
          $pp = [Math]::Round($p.statistics.percentage,2)
          $cp = [Math]::Round($c.statistics.percentage,2)
          $delta = [Math]::Round($cp - $pp,2)
          $trend = if ($delta -gt 0) { "UP +$delta%" } elseif ($delta -lt 0) { "DOWN $delta%" } else { "SAME 0%" }
          AppendToReport "`n**Duplication trend:** from $pp% -> $cp% ($trend)`n"
        }
      }
    } catch {
      AppendToReport "_(Could not compute trend: $($_.Exception.Message))_`n"
    }

    # Exact duplicate files (content hash)
    WriteHeader "Exact duplicate files (SHA256)"
    $files = Get-ChildItem $RepoPath -Recurse -File |
      Where-Object { $_.FullName -notmatch "\\(node_modules|dist|build|coverage|\\.git)\\" }
    $hashGroups = $files | ForEach-Object {
      try { [PSCustomObject]@{ Hash = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash; File = $_.FullName } } catch { $null }
    } | Where-Object { $_ -ne $null } | Group-Object Hash | Where-Object { $_.Count -gt 1 }

    if (-not $hashGroups -or $hashGroups.Count -eq 0) {
      AppendToReport "_No exact duplicate files found._`n"
    } else {
      foreach ($g in $hashGroups) {
        AppendToReport ("- **{0}x** -> {1}" -f $g.Count, ($g.Group | ForEach-Object {$_.File} -join ', '))
      }
      AppendToReport "`n"
    }

    # ESLint (optional)
    if (-not $SkipESLint) {
      WriteHeader "ESLint"
      $eslint = Resolve-ESLintInvoker
      if ($null -eq $eslint) {
        AppendToReport "_ESLint not available (skipping). To enable: add as devDependency or install globally)._`n"
      } else {
        if ($eslint[0] -eq 'npx') {
          $eslintOut = (& $eslint[0] $eslint[1] $eslint[2] '.' '--max-warnings=0') 2>&1 | Out-String
        } else {
          $eslintOut = (& $eslint[0] '.' '--max-warnings=0') 2>&1 | Out-String
        }
        WriteCodeBlock $eslintOut
        AppendToReport "_Consider enabling `import/no-duplicates`, `no-duplicate-imports`, `sonarjs/no-duplicate-string`._`n"
      }
    }

    # Final exit code handling
    if ($FailOnDuplicates -and $jscpdExit -ne 0) {
      Write-Host "Failing due to jscpd threshold exceeded." -ForegroundColor Red
      exit 1
    }

  } finally {
    Pop-Location
  }
}

function Invoke-SingleAnalysis {
  $ctx = New-RunContext
  Start-DuplicateAnalysis -ctx $ctx
  Write-Host "`nReport saved to: $($ctx.RunRoot)" -ForegroundColor Green
}

# Ensure reports dir is absolute and exists
$ReportsFullPath = Join-Path $RepoPath $ReportsDir
New-DirectoryIfNotExists $ReportsFullPath
$ReportsDir = (Resolve-Path -Path $ReportsFullPath).Path

if ($Watch) {
  if ($IntervalSeconds -le 0) { $IntervalSeconds = 60 }
  while ($true) {
    try { Invoke-SingleAnalysis } catch { Write-Warning $_.Exception.Message }
    Start-Sleep -Seconds $IntervalSeconds
  }
} else {
  Invoke-SingleAnalysis
}
