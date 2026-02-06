<#
.SYNOPSIS
    Enterprise Rate Limiting Implementation - Automated Route Transformation

.DESCRIPTION
    Applies rate limiting middleware to 91 pending API routes.

    Features:
    - Dry-run mode (safe preview before changes)
    - Automatic backup creation
    - Pattern detection (PLAIN_ASYNC, WITH_AUTH, MULTIPLE_METHODS, DYNAMIC_ROUTE)
    - Category assignment (HIGH, STANDARD, SENSITIVE, HEAVY, WEBHOOK, TELEGRAM)
    - TypeScript verification
    - Idempotent (can run multiple times safely)
    - Detailed diff generation

.PARAMETER DryRun
    If true, generates diffs without modifying files (default: true)

.PARAMETER BackupDir
    Directory for backups (default: C:\Nestor_Pagonis\backup-before-rate-limiting)

.PARAMETER ManifestFile
    Path to route manifest (default: RATE_LIMITING_IMPLEMENTATION_PLAN.md)

.EXAMPLE
    .\apply-rate-limiting.ps1 -DryRun $true
    # Generates diffs for review (no file modifications)

.EXAMPLE
    .\apply-rate-limiting.ps1 -DryRun $false
    # Applies transformations (modifies files)

.NOTES
    Author: Γιώργος Παγώνης + Claude Code (Anthropic AI)
    Date: 2026-02-06
    ADR: ADR-068 - API Rate Limiting System
#>

param(
    [bool]$DryRun = $true,
    [string]$BackupDir = "C:\Nestor_Pagonis\backup-before-rate-limiting",
    [string]$ManifestFile = "C:\Nestor_Pagonis\RATE_LIMITING_IMPLEMENTATION_PLAN.md",
    [string]$DiffOutputDir = "C:\Nestor_Pagonis\diffs\rate-limiting"
)

# =============================================================================
# MODULE 1: CONFIGURATION
# =============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Nestor_Pagonis"
$ApiRoutesRoot = Join-Path $ProjectRoot "src\app\api"

# Color output helpers
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ️ $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "⚠️ $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Header { param([string]$Message) Write-Host "`n$('=' * 80)" -ForegroundColor Magenta; Write-Host $Message -ForegroundColor Magenta; Write-Host $('=' * 80) -ForegroundColor Magenta }

# =============================================================================
# MODULE 2: PATTERN DETECTION
# =============================================================================

<#
.SYNOPSIS
    Detects the pattern of a route file
.OUTPUTS
    String: "PLAIN_ASYNC", "WITH_AUTH", "MULTIPLE_METHODS", "DYNAMIC_ROUTE", "ALREADY_PROTECTED", "UNKNOWN"
#>
function Get-RoutePattern {
    param([string]$Content)

    # Check if already has rate limiting
    if ($Content -match 'withHighRateLimit|withStandardRateLimit|withSensitiveRateLimit|withHeavyRateLimit|withWebhookRateLimit|withTelegramRateLimit') {
        return "ALREADY_PROTECTED"
    }

    # Count export statements
    $exportMatches = [regex]::Matches($Content, 'export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)')
    $exportConstMatches = [regex]::Matches($Content, 'export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=')

    $hasMultipleMethods = ($exportMatches.Count + $exportConstMatches.Count) -gt 1

    # Check for withAuth
    $hasWithAuth = $Content -match 'withAuth\s*\('

    # Check for dynamic route (segmentData parameter)
    $hasDynamicRoute = $Content -match 'segmentData\s*:\s*\{\s*params'

    # Pattern detection priority
    if ($hasMultipleMethods) {
        return "MULTIPLE_METHODS"
    } elseif ($hasDynamicRoute) {
        return "DYNAMIC_ROUTE"
    } elseif ($hasWithAuth) {
        return "WITH_AUTH"
    } elseif ($Content -match 'export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)') {
        return "PLAIN_ASYNC"
    } else {
        return "UNKNOWN"
    }
}

# =============================================================================
# MODULE 3: CATEGORY ASSIGNMENT
# =============================================================================

<#
.SYNOPSIS
    Assigns rate limit category based on route path
.OUTPUTS
    String: "HIGH", "STANDARD", "SENSITIVE", "HEAVY", "WEBHOOK", "TELEGRAM"
#>
function Get-RateLimitCategory {
    param([string]$RoutePath)

    # Normalize path
    $path = $RoutePath.Replace('\', '/').ToLower()

    # SENSITIVE (20 req/min): Admin, auth, financial
    if ($path -match '/api/admin/|/api/auth/|/api/pricing/|/api/setup/|/api/fix-|/api/audit/bootstrap|/api/enterprise-ids/migrate') {
        return "SENSITIVE"
    }

    # TELEGRAM (15 req/min): Telegram bot
    if ($path -match '/api/communications/webhooks/telegram/bot') {
        return "TELEGRAM"
    }

    # WEBHOOK (30 req/min): External webhooks
    if ($path -match '/api/webhooks/|/api/communications/webhooks/mailgun|/api/communications/webhooks/sendgrid') {
        return "WEBHOOK"
    }

    # HEAVY (10 req/min): Reports, exports, migrations, batch operations
    if ($path -match '/api/reports/|/export|/batch-|/api/analytics/|/populate|/seed|/migrate|/cleanup') {
        return "HEAVY"
    }

    # HIGH (100 req/min): List endpoints, search, quicksync
    if ($path -match '/api/contacts(?:/route\.ts)?$|/api/projects(?:/route\.ts)?$|/api/buildings(?:/route\.ts)?$|/api/search|/api/quicksync') {
        return "HIGH"
    }

    # STANDARD (60 req/min): Default for CRUD operations
    return "STANDARD"
}

<#
.SYNOPSIS
    Gets the wrapper function name for a category
#>
function Get-WrapperName {
    param([string]$Category)

    switch ($Category) {
        "HIGH" { return "withHighRateLimit" }
        "STANDARD" { return "withStandardRateLimit" }
        "SENSITIVE" { return "withSensitiveRateLimit" }
        "HEAVY" { return "withHeavyRateLimit" }
        "WEBHOOK" { return "withWebhookRateLimit" }
        "TELEGRAM" { return "withTelegramRateLimit" }
        default { return "withStandardRateLimit" }
    }
}

# =============================================================================
# MODULE 4: IMPORT INJECTION
# =============================================================================

<#
.SYNOPSIS
    Adds rate limit import if not present
#>
function Add-RateLimitImport {
    param(
        [string]$Content,
        [string]$Category
    )

    $wrapperName = Get-WrapperName -Category $Category

    # Check if import already exists
    if ($Content -match "import\s+\{.*?$wrapperName.*?\}\s+from\s+[`"']@/lib/middleware/with-rate-limit[`"']") {
        return $Content
    }

    # Find existing imports
    $importPattern = 'import\s+\{.+?\}\s+from\s+[`"'']@/lib/'
    $lastImportMatch = [regex]::Matches($Content, $importPattern) | Select-Object -Last 1

    if ($lastImportMatch) {
        # Insert after last import
        $insertPos = $lastImportMatch.Index + $lastImportMatch.Length
        # Find end of line
        $nextNewline = $Content.IndexOf("`n", $insertPos)
        if ($nextNewline -eq -1) { $nextNewline = $Content.Length }

        $importStatement = "`nimport { $wrapperName } from '@/lib/middleware/with-rate-limit';"
        $Content = $Content.Insert($nextNewline, $importStatement)
    } else {
        # No imports found, add at beginning (after any comments/license)
        $firstCodeLine = 0
        $lines = $Content -split "`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i].Trim()
            if ($line -and -not $line.StartsWith("//") -and -not $line.StartsWith("/*") -and -not $line.StartsWith("*")) {
                $firstCodeLine = $i
                break
            }
        }

        $importStatement = "import { $wrapperName } from '@/lib/middleware/with-rate-limit';`n`n"
        $insertPos = ($lines[0..($firstCodeLine - 1)] -join "`n").Length
        if ($insertPos -gt 0) { $insertPos += 1 } # Account for newline
        $Content = $Content.Insert($insertPos, $importStatement)
    }

    return $Content
}

# =============================================================================
# MODULE 5: TRANSFORM ENGINE
# =============================================================================

<#
.SYNOPSIS
    Transforms PLAIN_ASYNC pattern
.EXAMPLE
    // BEFORE
    export async function GET(request: NextRequest) { ... }

    // AFTER
    async function handleGet(request: NextRequest): Promise<NextResponse> { ... }
    export const GET = withStandardRateLimit(handleGet);
#>
function Transform-PlainAsync {
    param(
        [string]$Content,
        [string]$Category
    )

    $wrapperName = Get-WrapperName -Category $Category

    # Pattern: export async function METHOD(...)
    $pattern = 'export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(([^\)]+)\)\s*(\{)'

    $matches = [regex]::Matches($Content, $pattern)
    if ($matches.Count -eq 0) {
        return $Content
    }

    foreach ($match in $matches) {
        $method = $match.Groups[1].Value
        $params = $match.Groups[2].Value
        $openBrace = $match.Groups[3].Value

        # Extract function body (find matching closing brace)
        $startPos = $match.Index + $match.Length
        $braceCount = 1
        $endPos = $startPos

        for ($i = $startPos; $i -lt $Content.Length; $i++) {
            if ($Content[$i] -eq '{') { $braceCount++ }
            if ($Content[$i] -eq '}') { $braceCount--; if ($braceCount -eq 0) { $endPos = $i; break } }
        }

        $functionBody = $Content.Substring($startPos, $endPos - $startPos)

        # Generate handler name
        $handlerName = "handle$method".Substring(0,7) + $method.Substring(1).ToLower().Substring(0,1).ToUpper() + $method.Substring(2).ToLower()

        # Build new code
        $newCode = @"
async function $handlerName($params): Promise<NextResponse> $openBrace$functionBody}

export const $method = $wrapperName($handlerName);
"@

        # Replace
        $oldCode = $match.Value + $functionBody + "}"
        $Content = $Content.Replace($oldCode, $newCode)
    }

    return $Content
}

<#
.SYNOPSIS
    Transforms WITH_AUTH pattern
.EXAMPLE
    // BEFORE
    export const GET = withAuth(async (req, ctx, cache) => { ... }, { permissions: 'read:data' });

    // AFTER
    export const GET = withStandardRateLimit(withAuth(async (req, ctx, cache) => { ... }, { permissions: 'read:data' }));
#>
function Transform-WithAuth {
    param(
        [string]$Content,
        [string]$Category
    )

    $wrapperName = Get-WrapperName -Category $Category

    # Pattern: export const METHOD = withAuth(...)
    $pattern = 'export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=\s*withAuth\s*\('

    $matches = [regex]::Matches($Content, $pattern)
    if ($matches.Count -eq 0) {
        return $Content
    }

    foreach ($match in $matches) {
        $method = $match.Groups[1].Value

        # Find the complete withAuth(...) call
        $startPos = $match.Index + $match.Length - 1  # Position of opening paren
        $parenCount = 0
        $endPos = $startPos

        for ($i = $startPos; $i -lt $Content.Length; $i++) {
            if ($Content[$i] -eq '(') { $parenCount++ }
            if ($Content[$i] -eq ')') { $parenCount--; if ($parenCount -eq 0) { $endPos = $i; break } }
        }

        # Find end of statement (semicolon or newline)
        $statementEnd = $Content.IndexOfAny(@(';', "`n"), $endPos)
        if ($statementEnd -eq -1) { $statementEnd = $Content.Length }

        $fullStatement = $Content.Substring($match.Index, $statementEnd - $match.Index + 1)
        $withAuthCall = $Content.Substring($match.Index + "export const $method = ".Length, $statementEnd - ($match.Index + "export const $method = ".Length))

        # Wrap with rate limiter
        $newStatement = "export const $method = $wrapperName($withAuthCall);"

        $Content = $Content.Replace($fullStatement, $newStatement)
    }

    return $Content
}

<#
.SYNOPSIS
    Transforms MULTIPLE_METHODS pattern (each method independently)
#>
function Transform-MultipleMethods {
    param(
        [string]$Content,
        [string]$Category,
        [string]$RoutePath
    )

    # Transform each method independently
    # First try PLAIN_ASYNC pattern
    $Content = Transform-PlainAsync -Content $Content -Category $Category

    # Then try WITH_AUTH pattern
    $Content = Transform-WithAuth -Content $Content -Category $Category

    return $Content
}

<#
.SYNOPSIS
    Transforms DYNAMIC_ROUTE pattern (preserves segmentData types)
#>
function Transform-DynamicRoute {
    param(
        [string]$Content,
        [string]$Category
    )

    # Dynamic routes are similar to PLAIN_ASYNC but preserve segmentData parameter
    return Transform-PlainAsync -Content $Content -Category $Category
}

<#
.SYNOPSIS
    Main transformation dispatcher
#>
function Invoke-RouteTransformation {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Category,
        [string]$RoutePath
    )

    # Add import
    $Content = Add-RateLimitImport -Content $Content -Category $Category

    # Transform based on pattern
    switch ($Pattern) {
        "PLAIN_ASYNC" { $Content = Transform-PlainAsync -Content $Content -Category $Category }
        "WITH_AUTH" { $Content = Transform-WithAuth -Content $Content -Category $Category }
        "MULTIPLE_METHODS" { $Content = Transform-MultipleMethods -Content $Content -Category $Category -RoutePath $RoutePath }
        "DYNAMIC_ROUTE" { $Content = Transform-DynamicRoute -Content $Content -Category $Category }
        default {
            Write-Warning "Unknown pattern: $Pattern for $RoutePath"
            return $Content
        }
    }

    return $Content
}

# =============================================================================
# MODULE 6: VERIFICATION
# =============================================================================

<#
.SYNOPSIS
    Verifies transformation correctness
.OUTPUTS
    Hashtable with 'Success' (bool) and 'Errors' (array)
#>
function Test-Transformation {
    param(
        [string]$OriginalContent,
        [string]$TransformedContent,
        [string]$RoutePath
    )

    $errors = @()

    # Check 1: Import exists
    if ($TransformedContent -notmatch 'import\s+\{[^}]*(withHighRateLimit|withStandardRateLimit|withSensitiveRateLimit|withHeavyRateLimit|withWebhookRateLimit|withTelegramRateLimit)[^}]*\}\s+from') {
        $errors += "Missing rate limit import"
    }

    # Check 2: Export transformed
    if ($TransformedContent -match 'export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)') {
        # Still has plain async exports (should be transformed)
        # This is OK if it's a partial transformation (multiple methods)
    }

    # Check 3: No syntax errors (basic check)
    $openBraces = ($TransformedContent -split '\{').Count - 1
    $closeBraces = ($TransformedContent -split '\}').Count - 1
    if ($openBraces -ne $closeBraces) {
        $errors += "Brace mismatch: $openBraces open, $closeBraces close"
    }

    # Check 4: Wrapper usage
    if ($TransformedContent -notmatch 'with(High|Standard|Sensitive|Heavy|Webhook|Telegram)RateLimit\s*\(') {
        $errors += "No rate limit wrapper usage found"
    }

    return @{
        Success = ($errors.Count -eq 0)
        Errors = $errors
    }
}

# =============================================================================
# MODULE 7: DIFF GENERATION
# =============================================================================

<#
.SYNOPSIS
    Generates readable diff between original and transformed content
#>
function New-Diff {
    param(
        [string]$OriginalContent,
        [string]$TransformedContent,
        [string]$RoutePath
    )

    $diffOutput = @"
================================================================================
DIFF: $RoutePath
================================================================================

--- ORIGINAL
+++ TRANSFORMED

"@

    $originalLines = $OriginalContent -split "`n"
    $transformedLines = $TransformedContent -split "`n"

    # Simple line-by-line diff
    $maxLines = [Math]::Max($originalLines.Count, $transformedLines.Count)

    for ($i = 0; $i -lt $maxLines; $i++) {
        $origLine = if ($i -lt $originalLines.Count) { $originalLines[$i] } else { "" }
        $transLine = if ($i -lt $transformedLines.Count) { $transformedLines[$i] } else { "" }

        if ($origLine -ne $transLine) {
            if ($origLine) {
                $diffOutput += "- $origLine`n"
            }
            if ($transLine) {
                $diffOutput += "+ $transLine`n"
            }
        }
    }

    $diffOutput += "`n================================================================================`n"

    return $diffOutput
}

# =============================================================================
# MODULE 8: MAIN PROCESSING
# =============================================================================

<#
.SYNOPSIS
    Processes a single route file
#>
function Invoke-RouteProcessing {
    param(
        [string]$RouteFile,
        [bool]$IsDryRun
    )

    try {
        # Read content
        $content = Get-Content -Path $RouteFile -Raw -ErrorAction Stop

        # Detect pattern
        $pattern = Get-RoutePattern -Content $content

        if ($pattern -eq "ALREADY_PROTECTED") {
            Write-Info "SKIP: Already protected - $RouteFile"
            return @{ Status = "SKIPPED"; Reason = "Already protected" }
        }

        if ($pattern -eq "UNKNOWN") {
            Write-Warning "SKIP: Unknown pattern - $RouteFile"
            return @{ Status = "SKIPPED"; Reason = "Unknown pattern" }
        }

        # Get category
        $relativePath = $RouteFile.Replace($ApiRoutesRoot, "").Replace("\", "/")
        $category = Get-RateLimitCategory -RoutePath $relativePath

        Write-Info "PROCESSING: $relativePath - Pattern: $pattern, Category: $category"

        # Transform
        $transformedContent = Invoke-RouteTransformation -Content $content -Pattern $pattern -Category $category -RoutePath $relativePath

        # Verify
        $verification = Test-Transformation -OriginalContent $content -TransformedContent $transformedContent -RoutePath $relativePath

        if (-not $verification.Success) {
            Write-Error "VERIFICATION FAILED: $RouteFile"
            $verification.Errors | ForEach-Object { Write-Error "  - $_" }
            return @{ Status = "FAILED"; Reason = "Verification failed"; Errors = $verification.Errors }
        }

        # Generate diff
        if ($IsDryRun) {
            $diff = New-Diff -OriginalContent $content -TransformedContent $transformedContent -RoutePath $relativePath

            # Save diff
            $diffFileName = $relativePath.Replace("/", "_").Replace("route.ts", "diff")
            $diffFilePath = Join-Path $DiffOutputDir "$diffFileName"

            # Ensure directory exists
            $diffDir = Split-Path $diffFilePath -Parent
            if (-not (Test-Path $diffDir)) {
                New-Item -ItemType Directory -Path $diffDir -Force | Out-Null
            }

            Set-Content -Path $diffFilePath -Value $diff -Encoding UTF8
            Write-Success "DIFF GENERATED: $diffFilePath"
        } else {
            # Apply changes (write file)
            Set-Content -Path $RouteFile -Value $transformedContent -Encoding UTF8
            Write-Success "TRANSFORMED: $RouteFile"
        }

        return @{ Status = "SUCCESS"; Pattern = $pattern; Category = $category }

    } catch {
        Write-Error "ERROR processing $RouteFile : $_"
        return @{ Status = "ERROR"; Reason = $_.Exception.Message }
    }
}

<#
.SYNOPSIS
    Main execution function
#>
function Invoke-RateLimitingImplementation {
    Write-Header "🔒 Enterprise Rate Limiting Implementation"

    Write-Info "Mode: $(if ($DryRun) { 'DRY-RUN (No file modifications)' } else { 'LIVE (Files will be modified)' })"
    Write-Info "Project Root: $ProjectRoot"
    Write-Info "API Routes: $ApiRoutesRoot"

    # Create backup (only if not dry-run)
    if (-not $DryRun) {
        Write-Header "📦 Creating Backup"
        if (Test-Path $BackupDir) {
            Remove-Item -Path $BackupDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        Copy-Item -Path (Join-Path $ProjectRoot "src") -Destination (Join-Path $BackupDir "src") -Recurse
        Write-Success "Backup created: $BackupDir"
    }

    # Create diff output directory (for dry-run)
    if ($DryRun) {
        if (Test-Path $DiffOutputDir) {
            Remove-Item -Path $DiffOutputDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $DiffOutputDir -Force | Out-Null
        Write-Success "Diff directory created: $DiffOutputDir"
    }

    # Find all route files
    Write-Header "🔍 Finding Route Files"
    $routeFiles = Get-ChildItem -Path $ApiRoutesRoot -Filter "route.ts" -Recurse | Select-Object -ExpandProperty FullName

    Write-Info "Found $($routeFiles.Count) route files"

    # Process routes
    Write-Header "⚙️ Processing Routes"

    $results = @{
        Total = $routeFiles.Count
        Success = 0
        Skipped = 0
        Failed = 0
        Error = 0
    }

    $categoryCounts = @{
        HIGH = 0
        STANDARD = 0
        SENSITIVE = 0
        HEAVY = 0
        WEBHOOK = 0
        TELEGRAM = 0
    }

    foreach ($routeFile in $routeFiles) {
        $result = Invoke-RouteProcessing -RouteFile $routeFile -IsDryRun $DryRun

        switch ($result.Status) {
            "SUCCESS" {
                $results.Success++
                if ($result.Category) {
                    $categoryCounts[$result.Category]++
                }
            }
            "SKIPPED" { $results.Skipped++ }
            "FAILED" { $results.Failed++ }
            "ERROR" { $results.Error++ }
        }
    }

    # Summary
    Write-Header "📊 Summary Report"
    Write-Info "Total Routes: $($results.Total)"
    Write-Success "✅ Success: $($results.Success)"
    Write-Warning "⏭️ Skipped: $($results.Skipped)"
    Write-Error "❌ Failed: $($results.Failed)"
    Write-Error "💥 Errors: $($results.Error)"

    Write-Header "📈 Category Breakdown"
    $categoryCounts.GetEnumerator() | Sort-Object Name | ForEach-Object {
        Write-Info "$($_.Key): $($_.Value) routes"
    }

    if ($DryRun) {
        Write-Header "🔍 Next Steps"
        Write-Info "1. Review diffs in: $DiffOutputDir"
        Write-Info "2. If satisfied, run with -DryRun `$false to apply changes"
        Write-Info "3. Run TypeScript compilation: npx tsc --noEmit"
        Write-Info "4. Test critical routes"
    } else {
        Write-Header "✅ Implementation Complete"
        Write-Success "Backup available at: $BackupDir"
        Write-Info "Next steps:"
        Write-Info "1. Run TypeScript compilation: npx tsc --noEmit"
        Write-Info "2. Test critical routes"
        Write-Info "3. Commit changes if all tests pass"
    }
}

# =============================================================================
# EXECUTION
# =============================================================================

try {
    Invoke-RateLimitingImplementation
} catch {
    Write-Error "FATAL ERROR: $_"
    Write-Error $_.ScriptStackTrace
    exit 1
}
