# =============================================================================
# START TELEGRAM DEV — Auto ngrok + webhook register
# =============================================================================
#
# Usage: powershell.exe -ExecutionPolicy Bypass -File scripts/start-telegram-dev.ps1
#
# What it does:
#   1. Starts ngrok tunnel to localhost:3000
#   2. Waits for ngrok to be ready
#   3. Gets the public URL automatically
#   4. Registers the Telegram webhook with the new URL
#   5. Shows status and keeps ngrok running
#
# Press Ctrl+C to stop ngrok when done.
# =============================================================================

$ErrorActionPreference = "Stop"

# ── Configuration ──
$NGROK_PATH = "C:\Nestor_Pagonis\ngrok-bin\ngrok.exe"
$LOCAL_PORT = 3000
$WEBHOOK_PATH = "/api/communications/webhooks/telegram"
$NGROK_API = "http://127.0.0.1:4040/api/tunnels"

# ── Read .env.local for tokens ──
$envFile = "C:\Nestor_Pagonis\.env.local"
$BOT_TOKEN = ""
$WEBHOOK_SECRET = ""

foreach ($line in Get-Content $envFile) {
    if ($line -match '^TELEGRAM_BOT_TOKEN="?([^"]+)"?$') {
        $BOT_TOKEN = $matches[1]
    }
    if ($line -match '^TELEGRAM_WEBHOOK_SECRET="?([^"]+)"?$') {
        $WEBHOOK_SECRET = $matches[1]
    }
}

if (-not $BOT_TOKEN) {
    Write-Host "`n[ERROR] TELEGRAM_BOT_TOKEN not found in .env.local" -ForegroundColor Red
    exit 1
}
if (-not $WEBHOOK_SECRET) {
    Write-Host "`n[ERROR] TELEGRAM_WEBHOOK_SECRET not found in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TELEGRAM DEV — Auto Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ── Step 1: Kill any existing ngrok ──
$existingNgrok = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($existingNgrok) {
    Write-Host "[1/4] Stopping existing ngrok..." -ForegroundColor Yellow
    Stop-Process -Name "ngrok" -Force
    Start-Sleep -Seconds 1
} else {
    Write-Host "[1/4] No existing ngrok found" -ForegroundColor Gray
}

# ── Step 2: Start ngrok ──
Write-Host "[2/4] Starting ngrok tunnel to localhost:$LOCAL_PORT..." -ForegroundColor Yellow
$ngrokProcess = Start-Process -FilePath $NGROK_PATH -ArgumentList "http", $LOCAL_PORT -PassThru -WindowStyle Minimized

# Wait for ngrok API to be ready
$maxRetries = 10
$retryCount = 0
$ngrokUrl = ""

while ($retryCount -lt $maxRetries) {
    Start-Sleep -Seconds 1
    $retryCount++
    try {
        $response = Invoke-RestMethod -Uri $NGROK_API -Method Get -ErrorAction Stop
        $tunnel = $response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
        if ($tunnel) {
            $ngrokUrl = $tunnel.public_url
            break
        }
    } catch {
        Write-Host "  Waiting for ngrok... ($retryCount/$maxRetries)" -ForegroundColor Gray
    }
}

if (-not $ngrokUrl) {
    Write-Host "`n[ERROR] Failed to get ngrok URL after $maxRetries attempts" -ForegroundColor Red
    Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

$webhookUrl = "${ngrokUrl}${WEBHOOK_PATH}"
Write-Host "  Ngrok URL: $ngrokUrl" -ForegroundColor Green

# ── Step 3: Register webhook ──
Write-Host "[3/4] Registering Telegram webhook..." -ForegroundColor Yellow

$telegramApi = "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook"
$body = @{
    url              = $webhookUrl
    secret_token     = $WEBHOOK_SECRET
    max_connections  = 40
    allowed_updates  = '["message","callback_query"]'
}

try {
    $result = Invoke-RestMethod -Uri $telegramApi -Method Post -Body $body -ErrorAction Stop
    if ($result.ok) {
        Write-Host "  Webhook registered!" -ForegroundColor Green
    } else {
        Write-Host "  Webhook registration failed: $($result.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "  Webhook registration error: $_" -ForegroundColor Red
}

# ── Step 4: Verify ──
Write-Host "[4/4] Verifying webhook..." -ForegroundColor Yellow

$infoApi = "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
try {
    $info = Invoke-RestMethod -Uri $infoApi -Method Get -ErrorAction Stop
    $registeredUrl = $info.result.url
    $pending = $info.result.pending_update_count
    Write-Host "  URL: $registeredUrl" -ForegroundColor Green
    Write-Host "  Pending updates: $pending" -ForegroundColor Green
} catch {
    Write-Host "  Could not verify: $_" -ForegroundColor Yellow
}

# ── Done ──
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  READY! Telegram bot connected" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`n  Webhook: $webhookUrl" -ForegroundColor White
Write-Host "  Bot: @NestorAppDevBot (dev)" -ForegroundColor White
Write-Host "  Local: http://localhost:$LOCAL_PORT" -ForegroundColor White
Write-Host "`n  Press Ctrl+C to stop ngrok" -ForegroundColor Gray
Write-Host ""

# Keep script alive while ngrok runs
try {
    Wait-Process -Id $ngrokProcess.Id
} catch {
    # Ctrl+C pressed
    Write-Host 'Stopping ngrok...' -ForegroundColor Yellow
    Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host 'Done.' -ForegroundColor Green
}
