# Fix Firebase Service Account Key for Vercel
# Minifies JSON to single line

$jsonPath = "C:\Users\user\Downloads\pagonis-87766-firebase-adminsdk-fbsvc-0441cfc09b.json"
$outputPath = "C:\Nestor_Pagonis\firebase-service-account-minified.txt"

Write-Host "Reading service account JSON..." -ForegroundColor Cyan

# Read and parse JSON
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

# Convert back to JSON with compression (single line)
$minified = $json | ConvertTo-Json -Compress -Depth 10

Write-Host ""
Write-Host "MINIFIED JSON (copy this to Vercel):" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow
Write-Host $minified -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Yellow
Write-Host ""

# Save to file
$minified | Out-File -FilePath $outputPath -Encoding UTF8 -NoNewline

Write-Host "Saved to: $outputPath" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Copy the minified JSON above" -ForegroundColor White
Write-Host "2. Go to: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "3. Select project: nestor-app" -ForegroundColor White
Write-Host "4. Settings - Environment Variables" -ForegroundColor White
Write-Host "5. Find: FIREBASE_SERVICE_ACCOUNT_KEY" -ForegroundColor White
Write-Host "6. Click Edit - Replace value with minified JSON" -ForegroundColor White
Write-Host "7. Select Production environment" -ForegroundColor White
Write-Host "8. Save and Redeploy" -ForegroundColor White
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
