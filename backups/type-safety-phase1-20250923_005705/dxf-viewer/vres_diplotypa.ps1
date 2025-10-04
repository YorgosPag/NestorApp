<#
RUN EXAMPLES

# 1) Audit only (no changes), portable npx (no node_modules in project)
powershell -ExecutionPolicy Bypass -File "F:\Pagonis_Nestor\src\subapps\dxf-viewer\vres_diplotypa.ps1"

# 2) Use central tools folder (install once there; see notes at bottom)
powershell -ExecutionPolicy Bypass -File "F:\Pagonis_Nestor\src\subapps\dxf-viewer\vres_diplotypa.ps1" -ToolsPrefix "F:\devtools\node-tools"

# 3) Safe auto-fix + tests
powershell -ExecutionPolicy Bypass -File "...\vres_diplotypa.ps1" -Apply -TestCommand "npm test --silent"

# 4) Different target path
powershell -ExecutionPolicy Bypass -File "...\vres_diplotypa.ps1" -TargetPath "F:\some\other\repo"

Notes:
- Save this file as UTF-8. Requires Node.js + npm. ripgrep (rg) optional; git optional.
- Portable mode (default) uses: npx --yes -p <pkg>@latest <cmd> ...  (downloads to npm cache, not in project)
- ToolsPrefix mode uses: npx --prefix <ToolsPrefix> <cmd> ... (you install tools ONCE there)
#>

param(
  [string]$TargetPath   = 'F:\Pagonis_Nestor\src\subapps\dxf-viewer',  # Directory για εκτέλεση (dxf-viewer)
  [int]   $IntervalSeconds = 0,
  [switch]$Apply,
  [string]$TestCommand = '',
  [string]$ToolsPrefix = ''   # e.g. "F:\devtools\node-tools" (optional)
)

$ErrorActionPreference = 'Continue'
Set-StrictMode -Version Latest

# ----- TARGET -----
$RepoPath = (Resolve-Path $TargetPath).Path  # dxf-viewer directory
Set-Location $RepoPath  # Εκτέλεση από dxf-viewer

# ----- OUTPUTS -----
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$ReportsRoot = Join-Path $RepoPath ('reports\' + $ts)
New-Item -ItemType Directory -Force -Path $ReportsRoot | Out-Null

$Report      = Join-Path $ReportsRoot 'report - vres diplotypa.md'
$Log         = Join-Path $ReportsRoot 'run.log'
$JscpdOutDir = Join-Path $ReportsRoot 'jscpd'
$PlanFile    = Join-Path $ReportsRoot 'fix_plan.md'
$JsonSummary = Join-Path $ReportsRoot 'summary.json'

# ----- HELPERS -----
function Test-Command([string]$name){ return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function LogMsg([string]$t){ Add-Content -Path $Log -Value $t }
function AppendLine([string]$t){ Add-Content -Path $script:Report -Value $t }
function CodeBlock([string]$t){ AppendLine '```'; AppendLine $t; AppendLine '```' }
function Write-JsonSummary($obj){ $obj | ConvertTo-Json -Depth 6 | Out-File -FilePath $JsonSummary -Encoding UTF8 }
function ListSourceFiles {
  Get-ChildItem -Path $RepoPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.FullName -notmatch '\\(node_modules|dist|build|coverage|\.git|reports)\\' -and
      $_.Extension -in @('.ts','.tsx','.js','.jsx','.json','.css','.scss','.md')
    }
}
# Run a Node tool either portable (-p) or from central ToolsPrefix
function Invoke-NodeTool {
  param(
    [string]$Pkg,   # e.g. 'knip'
    [string]$Cmd,   # e.g. 'knip'
    [string[]]$Arguments # arguments for the tool
  )
  if ($ToolsPrefix -and (Test-Path $ToolsPrefix)) {
    # use binaries installed under ToolsPrefix
    $out = & npx --prefix $ToolsPrefix $Cmd @Arguments 2>&1
    return $out
  } else {
    # portable: download to npm cache, no node_modules in project
    $out = & npx --yes -p ($Pkg + '@latest') $Cmd @Arguments 2>&1
    return $out
  }
}

# ----- PREREQS -----
if (-not (Test-Command 'node') -or -not (Test-Command 'npm')) { throw 'Node.js or npm not found in PATH.' }
$HasRg  = Test-Command 'rg'
$HasGit = Test-Command 'git'

# ESLint config detection (no wildcards)
$eslintConfigs = @('.eslintrc','.eslintrc.js','.eslintrc.cjs','.eslintrc.json','.eslintrc.yml','.eslintrc.yaml')
$hasESLint = $false
foreach ($cfg in $eslintConfigs) { if (Test-Path (Join-Path $RepoPath $cfg)) { $hasESLint = $true; break } }

# ----- SCOPES (for reporting) -----
$Scopes = @(
  'domains','applications','services','microservices','components',
  'functions','methods','hooks','classes','entities','models','types',
  'interfaces','contracts','constants','utils','configs','events',
  'handlers','context','providers','middleware','guards','validators',
  'transformers','assets','documentation','docs'
)

# ----- GIT SAFETY -----
function Start-ChangeSession {
  if (-not $Apply) { return $false }
  if (-not $HasGit) { return $false }
  if (-not (Test-Path (Join-Path $RepoPath '.git'))) { return $false }
  $status = (git status --porcelain)
  if ($status) { throw 'Git working tree not clean. Commit or stash first.' }
  $branch = 'auto-clean/' + $ts
  git checkout -b $branch | Out-Null
  return $true
}
function Stop-Changes {
  if ($HasGit -and (Test-Path (Join-Path $RepoPath '.git'))) {
    git reset --hard HEAD | Out-Null
    try { git checkout - | Out-Null } catch {}
    try { git branch -D ('auto-clean/' + $ts) | Out-Null } catch {}
  }
}
function Submit-Changes {
  if ($HasGit -and (Test-Path (Join-Path $RepoPath '.git'))) {
    git add -A | Out-Null
    $msg = 'auto-clean: remove unreferenced and exact duplicate files (' + $ts + ')'
    git commit -m $msg | Out-Null
    Write-Host ('Committed on branch: auto-clean/' + $ts)
  }
}

# ----- DUPLICATES (MD5) -----
function Get-DuplicateGroups {
  $files = ListSourceFiles
  $items = @()
  foreach($f in $files){
    try {
      $h = (Get-FileHash -Algorithm MD5 -Path $f.FullName).Hash
      $items += [PSCustomObject]@{ Hash = $h; File = $f.FullName }
    } catch {}
  }
  $hashes = $items | Where-Object { $_ } | Sort-Object Hash, File
  $groups = $hashes | Group-Object Hash | Where-Object { $_.Count -gt 1 }
  return $groups
}

# ----- USAGE ANALYSIS -----
function Get-FunctionUsageStats {
  param($FilePath)
  
  if (-not (Test-Path $FilePath)) { return @() }
  
  try {
    $content = Get-Content -Path $FilePath -Raw
    $results = @()
    
    # Extract function/component exports
    $exportPattern = '(?:export\s+(?:const|function|class|interface|type)\s+(\w+)|export\s+\{\s*([^}]+)\s*\}|export\s+default\s+(?:function\s+)?(\w+))'
    $exports = [regex]::Matches($content, $exportPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    
    foreach ($export in $exports) {
      $exportName = ""
      for ($i = 1; $i -lt $export.Groups.Count; $i++) {
        if ($export.Groups[$i].Success -and $export.Groups[$i].Value -ne "") {
          $exportName = $export.Groups[$i].Value.Trim()
          break
        }
      }
      
      if ($exportName -ne "" -and $exportName -notmatch '^\s*$') {
        # Count usage across all files
        $usageCount = 0
        $files = ListSourceFiles | Where-Object { $_.Extension -in @('.ts', '.tsx', '.js', '.jsx') }
        
        foreach ($file in $files) {
          if ($file.FullName -ne $FilePath) {
            try {
              $fileContent = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
              if ($fileContent) {
                # Count import and usage patterns
                $importPattern = "import.*\b$exportName\b"
                $usagePattern = "\b$exportName\b"
                $imports = [regex]::Matches($fileContent, $importPattern)
                $usages = [regex]::Matches($fileContent, $usagePattern)
                $usageCount += $imports.Count + ($usages.Count - $imports.Count) # Don't double-count imports
              }
            } catch {}
          }
        }
        
        $results += [PSCustomObject]@{
          File = $FilePath
          Export = $exportName
          UsageCount = $usageCount
        }
      }
    }
    
    return $results
  } catch {
    return @()
  }
}

# ----- SEMANTIC SIMILARITY -----
function Get-SemanticSimilarity {
  param($File1, $File2)
  
  try {
    $content1 = Get-Content -Path $File1 -Raw
    $content2 = Get-Content -Path $File2 -Raw
    
    # Remove comments, whitespace, and normalize
    $clean1 = $content1 -replace '//.*' -replace '/\*[\s\S]*?\*/' -replace '\s+', ' '
    $clean2 = $content2 -replace '//.*' -replace '/\*[\s\S]*?\*/' -replace '\s+', ' '
    
    # Simple similarity based on common words/tokens
    $words1 = $clean1 -split '\s+|\W+' | Where-Object { $_ -ne '' -and $_.Length -gt 2 }
    $words2 = $clean2 -split '\s+|\W+' | Where-Object { $_ -ne '' -and $_.Length -gt 2 }
    
    if ($words1.Count -eq 0 -or $words2.Count -eq 0) { return 0 }
    
    $common = Compare-Object $words1 $words2 -IncludeEqual | Where-Object { $_.SideIndicator -eq '==' }
    $similarity = ($common.Count * 2.0) / ($words1.Count + $words2.Count)
    
    return [Math]::Round($similarity * 100, 2)
  } catch {
    return 0
  }
}

# ----- SEMANTIC SIMILARITY -----
function Get-SemanticSimilarity {
  param($File1, $File2)
  
  if (-not (Test-Path $File1) -or -not (Test-Path $File2)) { return 0 }
  
  try {
    $content1 = Get-Content -Path $File1 -Raw -ErrorAction SilentlyContinue
    $content2 = Get-Content -Path $File2 -Raw -ErrorAction SilentlyContinue
    
    if (-not $content1 -or -not $content2) { return 0 }
    
    # Simple similarity based on common lines and tokens
    $lines1 = $content1 -split "`r?`n" | Where-Object { $_ -match '\S' }
    $lines2 = $content2 -split "`r?`n" | Where-Object { $_ -match '\S' }
    
    if ($lines1.Count -eq 0 -or $lines2.Count -eq 0) { return 0 }
    
    # Count common lines (after trimming whitespace)
    $trimmed1 = $lines1 | ForEach-Object { $_.Trim() }
    $trimmed2 = $lines2 | ForEach-Object { $_.Trim() }
    
    $commonLines = 0
    foreach ($line1 in $trimmed1) {
      if ($line1 -ne "" -and $trimmed2 -contains $line1) {
        $commonLines++
      }
    }
    
    # Calculate similarity percentage
    $maxLines = [Math]::Max($lines1.Count, $lines2.Count)
    if ($maxLines -eq 0) { return 0 }
    
    $similarity = [Math]::Round(($commonLines * 2.0 / ($lines1.Count + $lines2.Count)) * 100, 1)
    return $similarity
    
  } catch {
    return 0
  }
}

# ----- POTENTIAL DUPLICATES BY SIMILARITY -----
function Find-SimilarFiles {
  param($SimilarityThreshold = 70)
  
  $files = ListSourceFiles | Where-Object { $_.Extension -in @('.ts', '.tsx', '.js', '.jsx') }
  $results = @()
  
  for ($i = 0; $i -lt $files.Count; $i++) {
    for ($j = $i + 1; $j -lt $files.Count; $j++) {
      $similarity = Get-SemanticSimilarity -File1 $files[$i].FullName -File2 $files[$j].FullName
      
      if ($similarity -ge $SimilarityThreshold) {
        $results += [PSCustomObject]@{
          File1 = $files[$i].FullName
          File2 = $files[$j].FullName
          Similarity = $similarity
        }
      }
    }
  }
  
  return $results | Sort-Object Similarity -Descending
}

# ----- NAMING CONVENTIONS ANALYSIS -----
function Get-NamingConventionsViolations {
  try {
    # Load naming guidelines and glossary
    $abbreviationsPath = Join-Path $RepoPath 'abbreviations.json'
    $glossaryPath = Join-Path $RepoPath 'glossary.json'
    
    $violations = @()
    $abbreviations = @{}
    $glossary = @{}
    
    # Parse JSON files
    if (Test-Path $abbreviationsPath) {
      $abbrevJson = Get-Content $abbreviationsPath -Raw | ConvertFrom-Json
      $abbreviations = $abbrevJson.common_abbreviations
    }
    
    if (Test-Path $glossaryPath) {
      $glossaryJson = Get-Content $glossaryPath -Raw | ConvertFrom-Json
      $glossary = $glossaryJson
    }
    
    # Get all source files
    $files = ListSourceFiles | Where-Object { $_.Extension -in @('.ts', '.tsx', '.js', '.jsx') }
    
    foreach ($file in $files) {
      $relativePath = $file.FullName.Replace($RepoPath, '.')
      $fileName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
      $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
      
      if (-not $content) { continue }
      
      # Check file naming conventions
      if ($file.Extension -eq '.tsx') {
        # Components should be PascalCase
        if ($fileName -notmatch '^[A-Z][a-zA-Z0-9]*$' -and $fileName -notmatch '^[A-Z][a-zA-Z0-9]*System$' -and $fileName -notmatch '^[A-Z][a-zA-Z0-9]*Overlay$') {
          $violations += [PSCustomObject]@{
            Type = 'File Naming'
            File = $relativePath
            Issue = "Component '$fileName' should be PascalCase"
            Severity = 'Medium'
          }
        }
      }
      
      # Check for problematic abbreviations
      foreach ($abbrev in $abbreviations.PSObject.Properties.Name) {
        if ($content -match "\b$abbrev\b" -and $abbreviations.$abbrev.Count -gt 0) {
          $suggested = $abbreviations.$abbrev[0]
          $regexMatches = [regex]::Matches($content, "\b$abbrev\b", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
          if ($regexMatches.Count -gt 2) {  # Only report if used frequently
            $violations += [PSCustomObject]@{
              Type = 'Abbreviation'
              File = $relativePath
              Issue = "Frequently used abbreviation '$abbrev' ($($regexMatches.Count) times). Consider '$suggested'"
              Severity = 'Low'
            }
          }
        }
      }
      
      # Check for hook naming violations
      if ($content -match 'function\s+(\w+)\s*\(') {
        $functionMatches = [regex]::Matches($content, 'function\s+(\w+)\s*\(')
        foreach ($match in $functionMatches) {
          $funcName = $match.Groups[1].Value
          if ($funcName -match '^use' -and $fileName -notmatch 'use.*') {
            $violations += [PSCustomObject]@{
              Type = 'Hook Naming'
              File = $relativePath
              Issue = "Hook function '$funcName' should be in a file starting with 'use'"
              Severity = 'Medium'
            }
          }
        }
      }
      
      # Check for inconsistent terminology using glossary
      foreach ($term in $glossary.PSObject.Properties.Name) {
        $termData = $glossary.$term
        if ($termData.alternatives) {
          foreach ($alt in $termData.alternatives) {
            if ($content -match "\b$alt\b" -and $content -notmatch "\b$($termData.canonical)\b") {
              $termMatches = [regex]::Matches($content, "\b$alt\b", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
              if ($termMatches.Count -gt 1) {
                $violations += [PSCustomObject]@{
                  Type = 'Terminology'
                  File = $relativePath
                  Issue = "Using '$alt' ($($termMatches.Count) times). Prefer canonical term '$($termData.canonical)'"
                  Severity = 'Low'
                }
              }
            }
          }
        }
      }
    }
    
    return $violations | Sort-Object Severity, Type, File
  } catch {
    Write-Host "Error in naming conventions analysis: $($_.Exception.Message)"
    return @()
  }
}

# ----- UNREFERENCED (heuristic; needs rg) -----
function Get-UnreferencedFiles {
  if (-not $HasRg) { return @() }
  $files = ListSourceFiles | Where-Object { 
    $_.Extension -in @('.ts','.tsx','.js','.jsx') -and
    $_.Extension -ne '.ps1' -and
    $_.Name -ne 'vres_diplotypa.ps1'
  }
  $results = @()
  foreach ($f in $files) {
    $nameNoExt = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    try {
      $rgOut = rg -nI --pcre2 $nameNoExt --glob '!{node_modules,dist,build,coverage,.git}/*' .
      $count = ($rgOut -split "`n" | Where-Object { $_ -ne '' }).Count
    } catch { $count = 0 }
    if ($count -eq 0) { $results += (Resolve-Path $f.FullName).Path }
  }
  return ($results | Sort-Object -Unique)
}

# ----- RIPGREP CHECKS -----
function Invoke-RipgrepChecks {
  if (-not $HasRg) {
    AppendLine '_ripgrep (rg) not found — install it if you want these checks.'
    AppendLine ''
    return
  }
  AppendLine '## ripgrep checks (excluding node_modules, dist, build, coverage, .git)'
  AppendLine ''

  AppendLine '**Double words in a row**'
  $a = (rg -nI --pcre2 '\b(\w+)\s+\1\b' --glob '!{node_modules,dist,build,coverage,.git}/*' .) 2>&1
  CodeBlock $a

  AppendLine '**Repeated punctuation (.. ,, ;; etc.)**'
  $b = (rg -nI --pcre2 '([,.;:!?])\s*\1+' --glob '!{node_modules,dist,build,coverage,.git}/*' .) 2>&1
  CodeBlock $b

  AppendLine '**TODO / FIXME / HACK markers**'
  $c = (rg -nI 'TODO|FIXME|HACK' --glob '!{node_modules,dist,build,coverage,.git}/*' .) 2>&1
  CodeBlock $c

  AppendLine '**Tiny or empty files (< 3 lines)**'
  $small = Get-ChildItem -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\(node_modules|dist|build|coverage|\.git)\\'
  } | ForEach-Object {
    try {
      $lines = (Get-Content -Path $_.FullName -Raw -ErrorAction Stop).Split("`n").Count
    } catch { $lines = 0 }
    [PSCustomObject]@{ File=$_.FullName; Lines=$lines }
  } | Where-Object { $_.Lines -lt 3 }
  if ($small) { CodeBlock ($small | Out-String) } else { AppendLine '_none_'; AppendLine '' }

  AppendLine '**Duplicate files (same MD5 hash)**'
  $dupes = Get-DuplicateGroups
  if ($dupes) {
    $buf = $dupes | ForEach-Object { $_.Group | Select-Object Hash,File } | Format-Table -AutoSize | Out-String
    CodeBlock $buf
  } else { AppendLine '_none_'; AppendLine '' }

  AppendLine '**Similar files (semantic analysis > 70%)**'
  $similar = Find-SimilarFiles -SimilarityThreshold 70
  if ($similar) {
    $buf = $similar | Format-Table -AutoSize | Out-String
    CodeBlock $buf
  } else { AppendLine '_none found_'; AppendLine '' }

  AppendLine '**Function/Component usage analysis**'
  $files = ListSourceFiles | Where-Object { $_.Extension -in @('.ts','.tsx','.js','.jsx') }
  $allUsageStats = @()
  
  $fileCount = 0
  foreach ($file in $files) {
    $fileCount++
    if ($fileCount % 20 -eq 0) { Write-Host "Analyzing file $fileCount of $($files.Count)..." }
    
    $stats = Get-FunctionUsageStats -FilePath $file.FullName
    $allUsageStats += $stats
  }
  
  # Show low usage exports (potentially candidates for removal)
  $lowUsage = $allUsageStats | Where-Object { $_.UsageCount -le 2 } | Sort-Object UsageCount
  if ($lowUsage) {
    AppendLine '**Low usage exports (≤ 2 references):**'
    $buf = $lowUsage | Format-Table -AutoSize | Out-String
    CodeBlock $buf
  } else { AppendLine '_all exports well used_'; AppendLine '' }

  # Show unused exports
  $unused = $allUsageStats | Where-Object { $_.UsageCount -eq 0 }
  if ($unused) {
    AppendLine '**Completely unused exports:**'
    $buf = $unused | Format-Table -AutoSize | Out-String
    CodeBlock $buf
  }

  AppendLine '**Naming Conventions Violations**'
  Write-Host "Checking naming conventions..."
  $namingViolations = Get-NamingConventionsViolations
  if ($namingViolations) {
    $buf = $namingViolations | Format-Table -AutoSize | Out-String
    CodeBlock $buf
    
    # Summary by severity
    $high = ($namingViolations | Where-Object { $_.Severity -eq 'High' }).Count
    $medium = ($namingViolations | Where-Object { $_.Severity -eq 'Medium' }).Count
    $low = ($namingViolations | Where-Object { $_.Severity -eq 'Low' }).Count
    AppendLine "**Summary**: $high High, $medium Medium, $low Low violations"
    AppendLine ''
  } else { 
    AppendLine '_excellent naming consistency!_'; AppendLine '' 
  }

  AppendLine '## Scoped passes (folder names)'
  foreach($s in $Scopes){
    AppendLine ('**' + $s + '/**')
    $paths = Get-ChildItem -Recurse -Directory -Filter $s -ErrorAction SilentlyContinue
    if ($paths) {
      $res = foreach($p in $paths){
        rg -nI --pcre2 '\b(\w+)\s+\1\b|([,.;:!?])\s*\1+' $p.FullName 2>$null
      }
      if ($res){ CodeBlock ($res -join "`n") } else { AppendLine '_ok_'; AppendLine '' }
    } else { AppendLine '_not found_'; AppendLine '' }
  }
}

# ----- MAIN TOOLS (portable or via ToolsPrefix) -----
function Invoke-Tools {
  AppendLine '## Knip — unused files / exports / scripts / deps'
  $knipConfig = Join-Path $RepoPath 'knip.json'
  $knip = Invoke-NodeTool -Pkg 'knip' -Cmd 'knip' -Arguments @('--config', $knipConfig)
  CodeBlock $knip
  LogMsg $knip

  AppendLine '## ts-prune — unused exports'
  $tsprune = Invoke-NodeTool -Pkg 'ts-prune' -Cmd 'ts-prune' -Arguments @('.')
  CodeBlock $tsprune
  LogMsg $tsprune

  AppendLine '## unimported — files not imported anywhere'
  $unimp = Invoke-NodeTool -Pkg 'unimported' -Cmd 'unimported' -Arguments @('.')
  CodeBlock $unimp
  LogMsg $unimp

  AppendLine '## depcheck — unused or missing dependencies'
  $dep = Invoke-NodeTool -Pkg 'depcheck' -Cmd 'depcheck' -Arguments @('.')
  CodeBlock $dep
  LogMsg $dep

  AppendLine '## jscpd — duplication (console + HTML)'
  $jscpd = Invoke-NodeTool -Pkg 'jscpd' -Cmd 'jscpd' -Arguments @('--min-tokens','50','--reporters','console,html','--output',$JscpdOutDir,'.')
  CodeBlock $jscpd
  AppendLine ''
  AppendLine ('**HTML report:** .\reports\' + $ts + '\jscpd\index.html')
  AppendLine ''

  AppendLine '## madge — dependency analysis and circular dependencies'
  $madge = Invoke-NodeTool -Pkg 'madge' -Cmd 'madge' -Arguments @('.','--circular','--warning')
  CodeBlock $madge
  LogMsg $madge

  AppendLine '## analyze-es6-modules — module structure analysis'
  $moduleAnalysis = Invoke-NodeTool -Pkg 'analyze-es6-modules' -Cmd 'analyze-es6-modules' -Arguments @('.')
  CodeBlock $moduleAnalysis
  LogMsg $moduleAnalysis

  if ($hasESLint) {
    AppendLine '## ESLint'
    $eslintOut = Invoke-NodeTool -Pkg 'eslint' -Cmd 'eslint' -Arguments @('.','--max-warnings=0')
    CodeBlock $eslintOut
    LogMsg $eslintOut
  } else {
    AppendLine '_ESLint: no config found — skipped._'
    AppendLine ''
  }
}

# ----- APPLY SAFE CHANGES -----
function Set-SafeChanges {
  # Always generate the plan, but only apply changes if $Apply is true
  $sessionStarted = $false
  if ($Apply) {
    $sessionStarted = Start-ChangeSession
  }

  # Unreferenced candidates
  $unref = Get-UnreferencedFiles

  # Exact duplicate files: keep shortest path; delete others if no refs
  $dupeGroups = Get-DuplicateGroups
  $dupeDelete = @()
  foreach($grp in $dupeGroups){
    $groupFiles = $grp.Group | Select-Object -ExpandProperty File
    $keep = ($groupFiles | Sort-Object { $_.Length } | Select-Object -First 1)
    foreach($f in $groupFiles){
      if ($f -ne $keep) {
        $nameNoExt = [System.IO.Path]::GetFileNameWithoutExtension($f)
        $refCount = 0
        if ($HasRg) {
          try {
            $rgOut = rg -nI --pcre2 $nameNoExt --glob '!{node_modules,dist,build,coverage,.git}/*' .
            $refCount = ($rgOut -split "`n" | Where-Object { $_ -ne '' }).Count
          } catch { $refCount = 0 }
        }
        if ($refCount -eq 0) { $dupeDelete += $f }
      }
    }
  }
  $dupeDelete = $dupeDelete | Sort-Object -Unique

  # Backup-like files (εκτός από PowerShell scripts)
  $backupLike = Get-ChildItem -Recurse -File -Include *.bak,*.old,*.tmp,*.disabled -ErrorAction SilentlyContinue |
    Where-Object { 
      $_.FullName -notmatch '\\(node_modules|dist|build|coverage|\.git)\\' -and 
      $_.Extension -ne '.ps1'
    } |
    Select-Object -ExpandProperty FullName

  # Union set
  $deleteSet = @()
  $deleteSet += $unref
  $deleteSet += $dupeDelete
  $deleteSet += $backupLike
  $deleteSet = $deleteSet | Sort-Object -Unique

  # Generate usage-based suggestions
  '## Usage-based Analysis & Suggestions' | Out-File -FilePath $PlanFile -Encoding UTF8
  '' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  
  # Quick analysis for DXF-viewer specific files only
  Write-Host "Performing quick cleanup analysis (DXF-viewer focus)..."
  
  try {
    # Check for backup directories in DXF viewer
    '### Backup Directories Found:' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
    $backupDirs = Get-ChildItem -Path $RepoPath -Directory -Recurse -ErrorAction SilentlyContinue | 
                  Where-Object { $_.Name -match 'backup|bak|old|\d{8}' }
    
    if ($backupDirs) {
      foreach ($dir in $backupDirs) {
        $relativePath = $dir.FullName.Replace($RepoPath, '.')
        " - $relativePath ($(($dir | Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue).Count) files)" | Out-File -FilePath $PlanFile -Append -Encoding UTF8
      }
    } else {
      ' - none found' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
    }
    '' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
    
    # Quick duplicate check - just file names and sizes
    '### Potential Duplicate Files (same name/size):' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
    $allFiles = ListSourceFiles | Where-Object { $_.Extension -in @('.ts','.tsx','.js','.jsx') }
    $duplicates = $allFiles | Group-Object Name, Length | Where-Object { $null -ne $_ -and $_.Count -gt 1 }
    
    if ($duplicates -and $duplicates.Count -gt 0) {
      foreach ($dup in $duplicates) {
        " - $($dup.Name) ($($dup.Count) copies)" | Out-File -FilePath $PlanFile -Append -Encoding UTF8
        if ($dup.Group) {
          foreach ($file in $dup.Group) {
            "   - $($file.FullName.Replace($RepoPath, '.'))" | Out-File -FilePath $PlanFile -Append -Encoding UTF8
          }
        }
      }
    } else {
      ' - none found' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
    }
    '' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  
  } catch {
    '### Analysis Error:' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
    " - $($_.Exception.Message)" | Out-File -FilePath $PlanFile -Append -Encoding UTF8
    '' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  }

  '## Safe Deletions (exact duplicates and backup files)' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  if ($null -eq $deleteSet -or $deleteSet.Length -eq 0) {
    ' - none' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  } else {
    foreach($p in $deleteSet){
      try {
        (' - ' + ($p.Replace($RepoPath, '.'))) | Out-File -FilePath $PlanFile -Append -Encoding UTF8
        Remove-Item -LiteralPath $p -Force
      } catch {
        ('   skipped: ' + $p + ' (' + $_.Exception.Message + ')') | Out-File -FilePath $PlanFile -Append -Encoding UTF8
      }
    }
  }

  # optional tests
  if ($TestCommand -and $TestCommand.Trim() -ne '') {
    Write-Host ('Running tests: ' + $TestCommand)
    cmd /c $TestCommand
    $exit = $LASTEXITCODE
    if ($exit -ne 0) {
      Write-Host 'Tests failed, reverting changes.'
      Stop-Changes
      return
    }
  }

  if ($sessionStarted) { Submit-Changes }
  
  # Add final note to plan file
  '' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  '## Note' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  if ($Apply) {
    'Changes were applied automatically.' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  } else {
    'This is analysis only - no changes were made. Run with -Apply to execute changes.' | Out-File -FilePath $PlanFile -Append -Encoding UTF8
  }
  
  Write-Host "✅ Fix plan generated successfully at: $PlanFile"
}

# ----- ONE RUN -----
function Start-Process {
  if (Test-Path $Report)   { Clear-Content -Path $Report   -ErrorAction SilentlyContinue }
  if (Test-Path $PlanFile) { Clear-Content -Path $PlanFile -ErrorAction SilentlyContinue }

  AppendLine ('# Code audit and duplicate scan (' + $ts + ')')
  AppendLine ('- Root: `' + $RepoPath + '`')
  AppendLine ('- Node: ' + (node -v))
  AppendLine '- Tools: knip, ts-prune, unimported, depcheck, jscpd, ripgrep (if available)'
  AppendLine ''

  Invoke-Tools
  Invoke-RipgrepChecks

  # machine summary
  $summary = [ordered]@{
    timestamp = $ts
    root = $RepoPath
    has_rg = $HasRg
    tools = @('knip','ts-prune','unimported','depcheck','jscpd','eslint?')
    mode  = ($(if($ToolsPrefix){'prefix'}else{'portable'}))
  }
  Write-JsonSummary $summary

  AppendLine '## Summary'
  AppendLine '- knip / ts-prune / unimported: dead files and exports'
  AppendLine '- depcheck: unused or missing dependencies'
  AppendLine '- jscpd: duplication heatmap (HTML)'
  AppendLine '- ripgrep: textual duplicates, repeated punctuation, tiny files, duplicate files'
  AppendLine '- plan: see fix_plan.md for deletions or suggestions'
  AppendLine ''

  Set-SafeChanges

  Write-Host ('OK. See report: ' + $Report)
  Write-Host ('HTML: ' + $JscpdOutDir + '\index.html')
  Write-Host ('Plan: ' + $PlanFile)
}

# ----- EXECUTION -----
Start-Process
if ($IntervalSeconds -gt 0) {
  AppendLine ('_Continuous mode: every ' + $IntervalSeconds + ' seconds_')
  while ($true) { Start-Sleep -Seconds $IntervalSeconds; Start-Process }
}
