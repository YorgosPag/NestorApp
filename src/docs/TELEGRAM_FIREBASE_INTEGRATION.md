# Telegram Bot + Firebase Integration

## Overview

Αυτό το έγγραφο τεκμηριώνει πώς επιτεύχθηκε η ενσωμάτωση του Telegram Bot με το Firebase/Firestore στο Vercel serverless περιβάλλον.

**Ημερομηνία Ολοκλήρωσης:** 2026-01-13
**Status:** OPERATIONAL

---

## Architecture

```
[Telegram User]
      |
      | (sends message)
      v
[Telegram API]
      |
      | (webhook POST)
      v
[Vercel Serverless Function]
/api/communications/webhooks/telegram
      |
      | (Firebase Admin SDK)
      v
[Firestore Database]
- conversations collection
- external_identities collection
```

---

## Key Components

### 1. Telegram Bot Configuration

- **Bot:** `@Nestor_P_Bot`
- **Webhook URL:** `https://nestor-app.vercel.app/api/communications/webhooks/telegram`
- **Webhook Secret:** Stored in `TELEGRAM_WEBHOOK_SECRET` env var

### 2. Firebase Admin SDK (Vercel)

**Critical Issue Solved:** Firebase service account credentials parsing in Vercel serverless.

#### The Problem

Vercel environment variables have issues with JSON containing newlines:
1. `\n` characters in `private_key` field get converted to actual newlines
2. This breaks `JSON.parse()` with "Bad control character" error
3. Even after parsing, PEM format can be corrupted ("Invalid PEM formatted message")

#### The Solution: Base64 Encoding

**Enterprise-safe approach:** Store the entire service account JSON as Base64.

```typescript
// firebase-admin.ts - Priority order:
// 1. FIREBASE_SERVICE_ACCOUNT_KEY_B64 (Base64 encoded) - RECOMMENDED
// 2. FIREBASE_SERVICE_ACCOUNT_KEY (plain JSON) - Fallback
// 3. Default credentials - Development only

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
  const decoded = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64,
    'base64'
  ).toString('utf-8');
  const serviceAccount = JSON.parse(decoded);
  // ... initialize with cert(serviceAccount)
}
```

### 3. Environment Variables (Vercel)

| Variable | Description | Environment |
|----------|-------------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY_B64` | Base64 encoded service account JSON | Production, Preview |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Production, Preview |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token | Production, Preview |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification secret | Production, Preview |

---

## Setup Instructions

### Step 1: Generate Base64 Service Account

1. Download service account JSON from Firebase Console:
   - Project Settings > Service accounts > Generate new private key

2. Convert to Base64 (PowerShell):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("path/to/service-account.json")) | Set-Clipboard
   ```

3. Add to Vercel:
   - Project Settings > Environment Variables
   - Name: `FIREBASE_SERVICE_ACCOUNT_KEY_B64`
   - Value: (paste Base64)
   - Environments: Production, Preview

### Step 2: Configure Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://nestor-app.vercel.app/api/communications/webhooks/telegram"}'
```

Or use the admin endpoint:
```
POST /api/admin/telegram/set-webhook
```

### Step 3: Deploy & Verify

1. Deploy to Vercel (push to main branch)
2. Send test message to bot
3. Check Vercel logs for:
   ```
   🔐 Using Base64 encoded service account...
   ✅ Firebase Admin initialized with Base64 service account
   ```
4. Verify Firestore has `conversations` with count > 0

---

## Troubleshooting

### Error: "Bad control character in string literal"

**Cause:** Raw JSON with newlines in `private_key` field.
**Solution:** Use Base64 encoding (see above).

### Error: "Invalid PEM formatted message"

**Cause:** `private_key` newlines corrupted after JSON parse.
**Solution:** Use Base64 encoding (cleanest) or ensure proper newline handling.

### Error: "Could not load the default credentials"

**Cause:** Firebase Admin fallback to ADC, which doesn't exist in Vercel.
**Solution:** Ensure `FIREBASE_SERVICE_ACCOUNT_KEY_B64` is properly set.

### Error: "Property search error: collectionPath is not valid"

**Cause:** COLLECTIONS constant undefined or empty.
**Solution:** Ensure `COLLECTIONS` import from `@/config/firestore-collections`.

---

## Files Modified

| File | Purpose |
|------|---------|
| `src/lib/firebase-admin.ts` | Firebase Admin SDK initialization with Base64 support |
| `src/app/api/communications/webhooks/telegram/route.ts` | Main webhook handler |
| `src/app/api/communications/webhooks/telegram/search/repo.ts` | Added COLLECTIONS import |
| `src/app/api/communications/webhooks/telegram/stats/repo.ts` | Added COLLECTIONS import |
| `src/app/api/communications/webhooks/telegram/bot-security.ts` | Added COLLECTIONS import |

---

## Verification Checklist

- [x] Telegram webhook receives messages (200 response)
- [x] Firebase Admin initializes with Base64 credentials
- [x] Conversations stored in Firestore (count > 0)
- [x] Bot responds to messages via Telegram API
- [ ] Property search functionality (pending fix)

---

## Contributors

- **Georgios Pagonis** - Project Owner
- **Claude (Anthropic AI)** - Implementation & Documentation

---

## Related Documentation

- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
