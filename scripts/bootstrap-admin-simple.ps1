# Bootstrap Admin User - Simple Version
# No emojis, plain text only

param(
    [string]$UserEmail = "pagonis.oe@gmail.com",
    [string]$CompanyId = "pagonis-company",
    [string]$GlobalRole = "super_admin",
    [string]$ApiUrl = "http://localhost:3000/api/admin/bootstrap-admin",
    [string]$BootstrapSecret = "dev-bootstrap-secret-2026"
)

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "BOOTSTRAP ADMIN USER - Enterprise Setup" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "   User Email:   $UserEmail" -ForegroundColor White
Write-Host "   Company ID:   $CompanyId" -ForegroundColor White
Write-Host "   Global Role:  $GlobalRole" -ForegroundColor White
Write-Host "   API URL:      $ApiUrl" -ForegroundColor White
Write-Host ""

# Prepare request body
$body = @{
    userIdentifier = $UserEmail
    companyId = $CompanyId
    globalRole = $GlobalRole
    bootstrapSecret = $BootstrapSecret
} | ConvertTo-Json

Write-Host "Sending bootstrap request..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop

    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Admin User Created:" -ForegroundColor Yellow
    Write-Host "   UID:              $($response.user.uid)" -ForegroundColor White
    Write-Host "   Email:            $($response.user.email)" -ForegroundColor White
    Write-Host "   Company ID:       $($response.user.companyId)" -ForegroundColor White
    Write-Host "   Global Role:      $($response.user.globalRole)" -ForegroundColor White
    Write-Host "   Custom Claims:    $($response.user.customClaimsSet)" -ForegroundColor White
    Write-Host "   Firestore Doc:    $($response.user.firestoreDocCreated)" -ForegroundColor White
    Write-Host ""
    Write-Host "Message: $($response.message)" -ForegroundColor Green
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Refresh your browser (Ctrl + Shift + R)" -ForegroundColor White
    Write-Host "2. Sign out and sign in again to get new token with custom claims" -ForegroundColor White
    Write-Host "3. Navigate to http://localhost:3000/crm/communications" -ForegroundColor White
    Write-Host "4. Verify that the 'Authentication required' error is gone" -ForegroundColor White
    Write-Host ""
    Write-Host "TIP: It may take 1-2 minutes for the token to refresh" -ForegroundColor Yellow
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red

    if ($_.ErrorDetails.Message) {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host ""
        Write-Host "API Response:" -ForegroundColor Yellow
        Write-Host "   Message: $($errorResponse.message)" -ForegroundColor White
        Write-Host "   Error:   $($errorResponse.error)" -ForegroundColor White
    }

    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Verify the user exists in Firebase Authentication" -ForegroundColor White
    Write-Host "2. Check that BOOTSTRAP_ADMIN_SECRET is set in .env.local" -ForegroundColor White
    Write-Host "3. Verify localhost:3000 is running (npm run dev)" -ForegroundColor White
    Write-Host "4. Check API health: http://localhost:3000/api/admin/bootstrap-admin" -ForegroundColor White
    Write-Host ""

    exit 1
}

Write-Host "Done!" -ForegroundColor Green
Write-Host ""
