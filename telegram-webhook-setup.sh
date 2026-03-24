#!/bin/bash
set -e
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN env var first}"
WEBHOOK_URL="https://nestor-app.vercel.app/api/communications/webhooks/telegram"
SECRET_TOKEN="5BD3E52317ECFEAD9628A44C29D979A261309228D6558C1D0CECD25F16108428"

echo "🏢 ENTERPRISE TELEGRAM WEBHOOK SETUP"
echo "===================================="
echo ""
echo "📡 [1/3] Configuring Telegram webhook with secret token..."
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  -d "secret_token=${SECRET_TOKEN}" \
  -d "max_connections=40" \
  -d "allowed_updates=[\"message\",\"callback_query\"]"
echo ""
echo ""
echo "🔍 [2/3] Verifying webhook configuration..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
echo ""
echo ""
echo "🏥 [3/3] Testing webhook endpoint health..."
curl -s "https://nestor-app.vercel.app/api/communications/webhooks/telegram"
echo ""
echo ""
echo "🎉 SETUP COMPLETE!"
