$ErrorActionPreference = 'Stop'

$files = @(
    'src\app\vendor\quote\[token]\VendorPortalForm.tsx',
    'src\app\vendor\quote\[token]\VendorPortalClient.tsx',
    'src\app\vendor\quote\[token]\DeclineDialog.tsx',
    'src\app\vendor\quote\[token]\SuccessState.tsx',
    'src\app\vendor\quote\[token]\VendorPortalErrorState.tsx',
    'src\subapps\procurement\components\ExtractedDataReviewPanel.tsx',
    'src\subapps\procurement\components\SetupLockBanner.tsx',
    'src\subapps\procurement\components\signatory\SignatoryProposalCard.tsx',
    'src\subapps\procurement\components\signatory\SignatoryDisambiguationModal.tsx',
    'src\subapps\procurement\components\SourcingEventSummaryCard.tsx',
    'src\subapps\procurement\components\QuoteLineEditorTable.tsx',
    'src\subapps\procurement\components\QuoteDetailsHeader.tsx',
    'src\subapps\procurement\components\QuoteEditMode.tsx',
    'src\subapps\procurement\components\ComparisonPanel.tsx',
    'src\subapps\procurement\components\ComparisonWinnerBanner.tsx',
    'src\subapps\procurement\components\RecommendationCard.tsx',
    'src\subapps\procurement\components\OfflineBanner.tsx',
    'src\subapps\procurement\components\ConflictDialog.tsx',
    'src\subapps\procurement\components\QuoteRevisionDetectedDialog.tsx',
    'src\subapps\procurement\components\extracted-data-review-helpers.tsx',
    'src\subapps\procurement\components\ProcurementSubNav.tsx',
    'src\components\procurement\vendors\VendorDetail.tsx',
    'src\components\procurement\vendors\VendorCard.tsx',
    'src\components\procurement\SupplierComparisonTable.tsx',
    'src\components\procurement\SupplierMetricsCard.tsx',
    'src\components\procurement\PurchaseOrderForm.tsx',
    'src\components\procurement\PurchaseOrderKPIs.tsx',
    'src\components\procurement\agreements\AgreementDetail.tsx',
    'src\components\procurement\materials\MaterialDetail.tsx',
    'src\components\procurement\hub\cards\FrameworkAgreementsCard.tsx',
    'src\components\procurement\hub\cards\MaterialCatalogCard.tsx',
    'src\components\procurement\hub\cards\PurchaseOrdersCard.tsx',
    'src\components\procurement\hub\cards\QuotesCard.tsx',
    'src\components\procurement\hub\cards\RfqCard.tsx',
    'src\components\procurement\hub\cards\VendorMasterCard.tsx',
    'src\components\contacts\tabs\procurement\ContactRfqInvitesSection.tsx',
    'src\components\contacts\tabs\procurement\ProcurementContactTab.tsx',
    'src\components\projects\procurement\ProjectProcurementTabs.tsx',
    'src\components\projects\procurement\overview\kpi\KpiPendingApprovalPos.tsx',
    'src\domain\cards\vendor\VendorGridCard.tsx',
    'src\domain\cards\vendor\VendorListCard.tsx',
    'src\app\procurement\quotes\scan\page.tsx',
    'src\app\procurement\rfqs\[id]\RfqDetailClient.tsx',
    'src\app\procurement\analytics\_components\AnalyticsKpiTiles.tsx'
)

$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
$root = 'C:\Nestor_Pagonis'
$totalFixed = 0

foreach ($rel in $files) {
    $path = Join-Path $root $rel
    if (-not (Test-Path $path)) { Write-Host "SKIP: $rel"; continue }

    $c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $orig = $c

    # 1. Remove dark: raw-palette class tokens (space-prefixed)
    $c = $c -replace ' dark:(?:hover:)?(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+(?:/\d+)?', ''

    # 2. hover: backgrounds
    $c = $c -replace 'hover:bg-(?:slate|gray|zinc|neutral)-\d+', 'hover:bg-accent'
    $c = $c -replace 'hover:bg-(?:amber|yellow|orange)-\d+', 'hover:bg-[hsl(var(--bg-warning))]/90'
    $c = $c -replace 'hover:bg-(?:green|emerald|teal)-\d+', 'hover:bg-[hsl(var(--bg-success))]/90'
    $c = $c -replace 'hover:bg-(?:red|rose)-\d+', 'hover:bg-destructive/90'
    $c = $c -replace 'hover:bg-(?:blue|sky|indigo)-\d+', 'hover:bg-primary/90'
    $c = $c -replace 'hover:bg-(?:purple|violet|pink|fuchsia)-\d+', 'hover:bg-accent'

    # 3. hover: text
    $c = $c -replace 'hover:text-(?:red|rose)-\d+', 'hover:text-destructive'
    $c = $c -replace 'hover:text-(?:amber|yellow|orange)-\d+', 'hover:text-[hsl(var(--bg-warning))]'
    $c = $c -replace 'hover:text-(?:green|emerald)-\d+', 'hover:text-green-700'

    # 4. bg- WITH opacity modifier (handle before plain to avoid double-slash)
    $c = $c -replace 'bg-(?:slate|gray|zinc|neutral)-(?:50|100)/(\d+)', 'bg-muted/$1'
    $c = $c -replace 'bg-(?:slate|gray|zinc|neutral)-(?:700|800|900|950)/(\d+)', 'bg-card/$1'
    $c = $c -replace 'bg-(?:amber|yellow)-(?:50|100)/(\d+)', 'bg-[hsl(var(--bg-warning))]/$1'
    $c = $c -replace 'bg-(?:amber|yellow)-(?:[2-9]\d{2})/(\d+)', 'bg-[hsl(var(--bg-warning))]/$1'
    $c = $c -replace 'bg-orange-(?:50|100)/(\d+)', 'bg-[hsl(var(--bg-warning))]/$1'
    $c = $c -replace 'bg-orange-(?:[2-9]\d{2})/(\d+)', 'bg-[hsl(var(--bg-warning))]/$1'
    $c = $c -replace 'bg-(?:green|emerald)-(?:50|100)/(\d+)', 'bg-[hsl(var(--bg-success))]/$1'
    $c = $c -replace 'bg-(?:green|emerald)-(?:[2-9]\d{2})/(\d+)', 'bg-[hsl(var(--bg-success))]/$1'
    $c = $c -replace 'bg-(?:red|rose)-(?:50|100)/(\d+)', 'bg-[hsl(var(--bg-error))]/$1'
    $c = $c -replace 'bg-(?:red|rose)-(?:[2-9]\d{2})/(\d+)', 'bg-destructive/$1'
    $c = $c -replace 'bg-(?:blue|sky|indigo)-(?:50|100)/(\d+)', 'bg-[hsl(var(--bg-info))]/$1'
    $c = $c -replace 'bg-(?:blue|sky|indigo)-(?:[2-9]\d{2})/(\d+)', 'bg-primary/$1'
    $c = $c -replace 'bg-(?:purple|violet|pink)-(?:50|100)/(\d+)', 'bg-accent/$1'
    $c = $c -replace 'bg-(?:purple|violet|pink)-(?:[2-9]\d{2})/(\d+)', 'bg-accent/$1'

    # 5. bg- WITHOUT opacity modifier
    $c = $c -replace 'bg-(?:slate|gray|zinc|neutral)-(?:50|100)', 'bg-muted'
    $c = $c -replace 'bg-(?:slate|gray|zinc|neutral)-(?:700|800|900|950)', 'bg-card'
    $c = $c -replace 'bg-(?:amber|yellow)-(?:50|100)', 'bg-[hsl(var(--bg-warning))]/40'
    $c = $c -replace 'bg-(?:amber|yellow)-(?:[2-9]\d{2})', 'bg-[hsl(var(--bg-warning))]'
    $c = $c -replace 'bg-orange-(?:50|100)', 'bg-[hsl(var(--bg-warning))]/40'
    $c = $c -replace 'bg-orange-(?:[2-9]\d{2})', 'bg-[hsl(var(--bg-warning))]'
    $c = $c -replace 'bg-(?:green|emerald)-(?:50|100)', 'bg-[hsl(var(--bg-success))]/40'
    $c = $c -replace 'bg-(?:green|emerald)-(?:[2-9]\d{2})', 'bg-[hsl(var(--bg-success))]'
    $c = $c -replace 'bg-(?:red|rose)-(?:50|100)', 'bg-[hsl(var(--bg-error))]/40'
    $c = $c -replace 'bg-(?:red|rose)-(?:[2-9]\d{2})', 'bg-destructive'
    $c = $c -replace 'bg-(?:blue|sky)-(?:50|100)', 'bg-[hsl(var(--bg-info))]/40'
    $c = $c -replace 'bg-(?:blue|sky)-(?:[2-9]\d{2})', 'bg-primary'
    $c = $c -replace 'bg-indigo-(?:50|100)', 'bg-[hsl(var(--bg-info))]/40'
    $c = $c -replace 'bg-indigo-(?:[2-9]\d{2})', 'bg-primary'
    $c = $c -replace 'bg-(?:purple|violet|pink)-(?:50|100)', 'bg-accent/30'
    $c = $c -replace 'bg-(?:purple|violet|pink)-(?:[2-9]\d{2})', 'bg-accent'
    $c = $c -replace 'bg-teal-(?:50|100)', 'bg-[hsl(var(--bg-info))]/40'
    $c = $c -replace 'bg-teal-(?:[2-9]\d{2})', 'bg-[hsl(var(--bg-info))]'

    # 6. text- colors
    $c = $c -replace 'text-(?:slate|gray|zinc|neutral)-(?:700|800|900)', 'text-foreground'
    $c = $c -replace 'text-(?:slate|gray|zinc|neutral)-(?:300|400|500|600)', 'text-muted-foreground'
    $c = $c -replace 'text-(?:amber|yellow|orange)-(?:800|900)', 'text-foreground'
    $c = $c -replace 'text-(?:amber|yellow|orange)-(?:300|400|500|600|700)', 'text-[hsl(var(--bg-warning))]'
    $c = $c -replace 'text-green-(?:600|800)', 'text-green-700'
    $c = $c -replace 'text-emerald-(?:600|700|800)', 'text-green-700'
    $c = $c -replace 'text-teal-(?:600|700)', 'text-[hsl(var(--bg-info))]'
    $c = $c -replace 'text-(?:red|rose)-(?:600|700|800|900)', 'text-destructive'
    $c = $c -replace 'text-(?:blue|sky|indigo)-(?:600|700|800)', 'text-primary'
    $c = $c -replace 'text-(?:purple|violet|pink)-(?:600|700|800|900)', 'text-foreground'

    # 7. border- WITH opacity
    $c = $c -replace 'border-(?:slate|gray|zinc|neutral)-(?:\d+)/(\d+)', 'border-border/$1'
    $c = $c -replace 'border-(?:amber|yellow|orange)-(?:200|300)/(\d+)', 'border-[hsl(var(--bg-warning))]/$1'
    $c = $c -replace 'border-(?:amber|yellow|orange)-(?:[4-9]\d{2})/(\d+)', 'border-[hsl(var(--bg-warning))]/$1'
    $c = $c -replace 'border-(?:purple|violet|pink)-(?:\d+)/(\d+)', 'border-border/$1'
    $c = $c -replace 'border-(?:green|emerald)-(?:200|300)/(\d+)', 'border-[hsl(var(--bg-success))]/$1'
    $c = $c -replace 'border-(?:green|emerald)-(?:[4-9]\d{2})/(\d+)', 'border-[hsl(var(--bg-success))]/$1'

    # 8. border- WITHOUT opacity
    $c = $c -replace 'border-(?:slate|gray|zinc|neutral)-(?:100|200|300|400)', 'border-border'
    $c = $c -replace 'border-(?:amber|yellow)-(?:200|300)', 'border-[hsl(var(--bg-warning))]/60'
    $c = $c -replace 'border-(?:amber|yellow)-(?:[4-9]\d{2})', 'border-[hsl(var(--bg-warning))]'
    $c = $c -replace 'border-orange-(?:200|300|400)', 'border-[hsl(var(--bg-warning))]'
    $c = $c -replace 'border-green-(?:300|400|500|600)', 'border-[hsl(var(--bg-success))]'
    $c = $c -replace 'border-yellow-(?:300|400|500)', 'border-[hsl(var(--bg-warning))]'
    $c = $c -replace 'border-emerald-(?:200|300)', 'border-[hsl(var(--bg-success))]/60'
    $c = $c -replace 'border-emerald-(?:[4-9]\d{2})', 'border-[hsl(var(--bg-success))]'
    $c = $c -replace 'border-(?:red|rose)-(?:200|300)', 'border-[hsl(var(--bg-error))]/60'
    $c = $c -replace 'border-(?:red|rose)-(?:[4-9]\d{2})', 'border-destructive'
    $c = $c -replace 'border-(?:blue|sky|indigo)-(?:300|400|500|600)', 'border-ring'
    $c = $c -replace 'border-(?:purple|violet|pink)-\d+', 'border-border'

    if ($c -ne $orig) {
        [System.IO.File]::WriteAllText($path, $c, $utf8NoBOM)
        $totalFixed++
        Write-Host "FIXED: $rel"
    } else {
        Write-Host "NOOP:  $rel"
    }
}

Write-Host ""
Write-Host "Total files modified: $totalFixed"
