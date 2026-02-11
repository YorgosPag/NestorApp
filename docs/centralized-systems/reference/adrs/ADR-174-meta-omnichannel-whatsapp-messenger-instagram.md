# ADR-174: Meta Omnichannel Integration — WhatsApp + Messenger + Instagram

**Status**: Phase 1+2 OPERATIONAL, Phase 3 CODE COMPLETE (WhatsApp + Messenger tested & live, Instagram code ready — env vars pending)
**Date**: 2026-02-11
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης
**Extends**: ADR-029 (Omnichannel Conversation Model), ADR-031 (Safe Document ID Generation)

---

## Context

Η εφαρμογή Nestor CRM έχει ήδη λειτουργικό **Telegram** omnichannel integration (webhook → CRM store → AI pipeline → operator inbox). Ο Γιώργος ζήτησε επέκταση σε **WhatsApp**, **Facebook Messenger** και **Instagram DM** μέσω του Meta Platform.

**Έρευνα καναλιών (2026-02-10):**
- **Viber**: Απορρίφθηκε — EUR 100/μήνα από Φεβ 2024, καμία δωρεάν επιλογή
- **WhatsApp Cloud API**: Δωρεάν πρόσβαση API, δωρεάν service messages (24h window)
- **Messenger API**: 100% δωρεάν, απαιτεί App Review
- **Instagram Messaging API**: Δωρεάν, ίδια Meta πλατφόρμα

---

## Decision

Ενσωμάτωση και των 3 Meta καναλιών μέσω ενός **single Meta App** ("Nestor App CRM"), ακολουθώντας το ίδιο pattern με το Telegram: webhook → CRM store → AI pipeline.

### Meta App Credentials (Production)

| Setting | Value |
|---------|-------|
| **App Name** | Nestor App CRM |
| **App ID** | `1611274563228057` |
| **Business Portfolio** | giorgio_pagoni |
| **Email** | georgios.pagonis@gmail.com |

### WhatsApp Credentials

| Setting | Value |
|---------|-------|
| **Phone Number ID** | `974486179086562` |
| **WhatsApp Business Account ID** | `947820860993553` |
| **Test Number** | +1 555 171 8192 |
| **Access Token** | Temporary (24h) — χρειάζεται System User Token για production |

### Vercel Environment Variables (Required)

| Variable | Description | Status |
|----------|-------------|--------|
| `META_APP_ID` | Meta App ID | ✅ Set (2026-02-11) |
| `META_APP_SECRET` | Meta App Secret (from App Dashboard → Settings → Basic) | Pending |
| `WHATSAPP_ACCESS_TOKEN` | Temporary 24h token (needs permanent System User Token) | ✅ Set (2026-02-11) |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID for sending | ✅ Set (2026-02-11) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID | ✅ Set (2026-02-11) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Custom string for webhook verification | ✅ Set (2026-02-11) |
| `MESSENGER_PAGE_ACCESS_TOKEN` | Facebook Page token for Messenger | ✅ Set (2026-02-11) |
| `MESSENGER_WEBHOOK_VERIFY_TOKEN` | Custom string for Messenger webhook verification | ✅ Set (2026-02-11) |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram Business account token | Pending — set when IG account is linked |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Custom string for Instagram webhook verification | Pending — set when configuring webhook |

---

## Architecture

### Existing Omnichannel Model (reused)

```
Webhook (channel-specific)
  ↓
Normalize → CRMStoreMessage
  ↓
CRM Store (channel-agnostic):
  - conversations  → conv_{channel}_{hash}
  - messages       → msg_{channel}_{hash}
  - external_identities → eid_{provider}_{hash}
  ↓
AI Pipeline (via after())
  ↓
Operator Inbox (Unified UI)
```

### Types Already Declared

```typescript
// src/types/communications.ts — ALL DECLARED + IMPLEMENTED:
COMMUNICATION_CHANNELS.WHATSAPP = 'whatsapp'
COMMUNICATION_CHANNELS.MESSENGER = 'messenger'
COMMUNICATION_CHANNELS.INSTAGRAM = 'instagram'

// src/types/conversations.ts — ALL DECLARED:
IDENTITY_PROVIDER.WHATSAPP = 'whatsapp'
IDENTITY_PROVIDER.MESSENGER = 'messenger'
IDENTITY_PROVIDER.INSTAGRAM = 'instagram'

// src/types/ai-pipeline.ts — ALL DECLARED:
PipelineChannel.WHATSAPP = 'whatsapp'
PipelineChannel.MESSENGER = 'messenger'
PipelineChannel.INSTAGRAM = 'instagram'

// IntakeSender — ALL CHANNEL IDs:
IntakeSender.whatsappPhone, .messengerUserId, .instagramUserId

// src/server/lib/id-generation.ts — ALREADY WORKS:
generateConversationId('whatsapp', phoneNumber) → 'conv_whatsapp_{hash}'
generateMessageDocId('whatsapp', chatId, msgId) → 'msg_whatsapp_{hash}'
generateExternalIdentityId('whatsapp', phoneNumber) → 'eid_whatsapp_{hash}'
```

### New Files Structure

```
src/app/api/communications/webhooks/
├── telegram/              ← Existing (operational)
├── whatsapp/              ← Phase 1 (NEW)
│   ├── route.ts           — GET (verification) + POST (messages)
│   ├── handler.ts         — Webhook security + message processing
│   ├── whatsapp-client.ts — WhatsApp Cloud API client (send messages)
│   ├── crm-adapter.ts     — Normalize WhatsApp → CRMStoreMessage
│   └── types.ts           — WhatsApp webhook payload types
│
src/services/ai-pipeline/channel-adapters/
├── telegram-channel-adapter.ts  ← Existing
├── whatsapp-channel-adapter.ts  ← Phase 1 (operational)
├── messenger-channel-adapter.ts ← Phase 2 (operational)
├── instagram-channel-adapter.ts ← Phase 3 (operational)
│
src/services/ai-pipeline/shared/
├── channel-reply-dispatcher.ts  ← MODIFIED (+dispatchWhatsApp, +dispatchMessenger, +dispatchInstagram)
│
src/app/api/communications/webhooks/
├── messenger/             ← Phase 2 (NEW)
│   ├── route.ts           — GET (verification) + POST (messages)
│   ├── handler.ts         — Webhook processing
│   ├── messenger-client.ts — Messenger Send API client
│   ├── crm-adapter.ts     — Normalize Messenger → CRMStoreMessage
│   └── types.ts           — Messenger webhook types
└── instagram/             ← Phase 3 (NEW)
    ├── route.ts           — GET (verification) + POST (messages)
    ├── handler.ts         — Webhook processing
    ├── instagram-client.ts — Instagram Messaging API client
    ├── crm-adapter.ts     — Normalize Instagram → CRMStoreMessage
    └── types.ts           — Instagram webhook types
```

### Shared CRM Store

Τα 3 νέα κανάλια θα χρησιμοποιούν **shared CRM store logic** — εξάγεται από το Telegram store σε κοινό module:

```
src/services/crm/
└── omnichannel-store.ts   — Generic upsertConversation, storeMessage, upsertIdentity
```

---

## Phase 1: WhatsApp Cloud API (CURRENT)

### 1.1 Webhook Verification (GET)

Meta στέλνει GET request με:
- `hub.mode=subscribe`
- `hub.verify_token={our_secret}`
- `hub.challenge={random_string}`

Πρέπει να απαντήσουμε με `hub.challenge` αν το token ταιριάζει.

### 1.2 Incoming Messages (POST)

WhatsApp Cloud API webhook payload:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "OUR_NUMBER",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "SENDER_NAME" },
          "wa_id": "SENDER_PHONE"
        }],
        "messages": [{
          "from": "SENDER_PHONE",
          "id": "wamid.xxx",
          "timestamp": "1234567890",
          "type": "text",
          "text": { "body": "Hello" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### 1.3 Send Messages (Outbound)

```
POST https://graph.facebook.com/v22.0/{phone_number_id}/messages
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "{recipient_phone}",
  "type": "text",
  "text": { "body": "message" }
}
```

### 1.4 Status Webhooks

WhatsApp αποστέλλει status updates (sent, delivered, read):
```json
{
  "statuses": [{
    "id": "wamid.xxx",
    "status": "delivered",
    "timestamp": "1234567890",
    "recipient_id": "PHONE"
  }]
}
```

### 1.5 Supported Message Types

| Type | Inbound | Outbound |
|------|---------|----------|
| text | Phase 1 | Phase 1 |
| image | Phase 2 | Phase 2 |
| document | Phase 2 | Phase 2 |
| audio | Phase 2 | Phase 2 |
| video | Phase 2 | Phase 2 |
| location | Phase 2 | Phase 2 |
| reaction | Phase 2 | Phase 2 |
| template | N/A | Phase 2 |

---

## Phase 2: Facebook Messenger

### 2.1 Webhook Verification

Ίδιο pattern με WhatsApp: GET με `hub.mode`, `hub.verify_token`, `hub.challenge`.

### 2.2 Incoming Messages

```json
{
  "object": "page",
  "entry": [{
    "id": "PAGE_ID",
    "messaging": [{
      "sender": { "id": "USER_PSID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1234567890,
      "message": {
        "mid": "m_xxx",
        "text": "Hello"
      }
    }]
  }]
}
```

### 2.3 Send Messages

```
POST https://graph.facebook.com/v22.0/me/messages
Authorization: Bearer {page_access_token}

{
  "recipient": { "id": "USER_PSID" },
  "message": { "text": "Reply" }
}
```

### 2.4 Requirements

- Facebook Page connected to Meta App
- App Review for `pages_messaging` permission (production)
- Page Access Token (long-lived)

---

## Phase 3: Instagram Messaging

### 3.1 Webhook Format

```json
{
  "object": "instagram",
  "entry": [{
    "id": "IG_USER_ID",
    "messaging": [{
      "sender": { "id": "USER_IGSID" },
      "recipient": { "id": "IG_USER_ID" },
      "timestamp": 1234567890,
      "message": {
        "mid": "m_xxx",
        "text": "Hello"
      }
    }]
  }]
}
```

### 3.2 Send Messages

```
POST https://graph.facebook.com/v22.0/me/messages
Authorization: Bearer {access_token}

{
  "recipient": { "id": "USER_IGSID" },
  "message": { "text": "Reply" }
}
```

### 3.3 Requirements

- Instagram Professional/Business account linked to Facebook Page
- App Review for `instagram_manage_messages` permission
- Same webhook URL can handle both Messenger and Instagram (discriminate by `object` field)

---

## Implementation Checklist

### Phase 1: WhatsApp (COMPLETE)

- [x] Meta Developer App created ("Nestor App CRM")
- [x] WhatsApp Business use case added
- [x] Temporary Access Token generated
- [x] Save env vars to Vercel (5 vars: TOKEN, PHONE_ID, WABA_ID, APP_ID, VERIFY_TOKEN)
- [x] Build `src/app/api/communications/webhooks/whatsapp/` (5 files)
- [x] CRM adapter uses shared collections directly (same pattern as Telegram)
- [x] Configure webhook URL on Meta Developer Portal (verified + messages subscribed)
- [x] Add WhatsApp to `IMPLEMENTED_CHANNELS` in communications.ts
- [x] Test: Send test message → webhook fires → CRM stores → blue checkmarks
- [x] Feed WhatsApp messages to AI pipeline (via `after()`)
- [x] WhatsAppChannelAdapter created (mirrors TelegramChannelAdapter)
- [x] dispatchWhatsApp added to channel-reply-dispatcher for outbound AI replies
- [x] WHATSAPP added to PipelineChannel enum + IntakeSender.whatsappPhone
- [x] Instant "⏳ Επεξεργάζομαι..." acknowledgment on incoming messages
- [x] WhatsApp → agentic AI path for immediate auto-reply (ADR-171)
- [x] Admin vs Customer prompt split (admin: full access, customer: property info only)
- [x] Interactive Reply Buttons: suggestions (max 3) + feedback (👍/👎)
- [x] Handle interactive button_reply webhooks (sug_* → pipeline, fb_* → feedback record)
- [x] sendWhatsAppButtons() for interactive message type
- [ ] Update `conversations/[conversationId]/send/route.ts` for WhatsApp outbound
- [ ] Generate permanent System User Access Token (replace temporary 24h token)
- [ ] Set META_APP_SECRET for webhook signature verification in production

### Phase 2: Messenger (OPERATIONAL ✅)

- [x] Connect Facebook Page ("Nestor App", ID: 984661054730180) to Meta App
- [x] Build `src/app/api/communications/webhooks/messenger/` (5 files: types, client, crm-adapter, handler, route)
- [x] Configure Messenger webhook on Meta Portal (verified + subscribed: messages, messaging_postbacks, message_deliveries)
- [x] Add Messenger to IMPLEMENTED_CHANNELS
- [x] MessengerChannelAdapter created (mirrors WhatsAppChannelAdapter)
- [x] dispatchMessenger added to channel-reply-dispatcher for outbound AI replies
- [x] MESSENGER added to PipelineChannel enum + IntakeSender.messengerUserId
- [x] Messenger → agentic AI path for immediate auto-reply
- [x] Quick Reply buttons: suggestions (max 13) + feedback (👍/👎)
- [x] Handle quick_reply.payload webhooks (sug_* → pipeline, fb_* → feedback)
- [x] sendMessengerQuickReplies() for quick reply message type
- [x] markMessengerSeen() for sender_action: mark_seen
- [x] Instant "⏳ Επεξεργάζομαι..." acknowledgment on incoming messages
- [x] Set MESSENGER_PAGE_ACCESS_TOKEN on Vercel (2026-02-11)
- [x] Set MESSENGER_WEBHOOK_VERIFY_TOKEN on Vercel (2026-02-11)
- [x] **TESTED**: End-to-end Messenger → AI pipeline → response + Quick Replies + feedback (2026-02-11)
- [ ] Submit for App Review (`pages_messaging` permission) — needed for public access

### Phase 3: Instagram (CODE COMPLETE)

- [ ] Link Instagram Business account to Facebook Page
- [x] Build `src/app/api/communications/webhooks/instagram/` (5 files: types, client, crm-adapter, handler, route)
- [ ] Configure Instagram webhook on Meta Portal
- [x] Add Instagram to IMPLEMENTED_CHANNELS + IDENTITY_PROVIDER + PLATFORMS
- [x] InstagramChannelAdapter created (mirrors WhatsAppChannelAdapter)
- [x] dispatchInstagram added to channel-reply-dispatcher for outbound AI replies
- [x] INSTAGRAM added to PipelineChannel enum + IntakeSender.instagramUserId
- [x] Instagram → agentic AI path for immediate auto-reply
- [x] Text-only replies (Instagram does not support quick replies or buttons)
- [x] Instant "⏳ Επεξεργάζομαι..." acknowledgment on incoming messages
- [ ] Set INSTAGRAM_ACCESS_TOKEN on Vercel
- [ ] Set INSTAGRAM_WEBHOOK_VERIFY_TOKEN on Vercel
- [ ] Submit for App Review (`instagram_manage_messages` permission)

### Phase 4: UI Updates (Pending)

- [ ] Add WhatsApp/Messenger/Instagram icons to UnifiedInbox channel filter
- [ ] Add channel-specific styling (green for WhatsApp, blue for Messenger, gradient for Instagram)
- [ ] Update i18n translations for new channels

### Phase 5: Production Hardening (Pending)

- [ ] Meta Business Verification (required for production API access)
- [ ] Permanent System User Access Token (non-expiring)
- [ ] Webhook signature verification (X-Hub-Signature-256)
- [ ] Rate limiting per channel
- [ ] Error monitoring and alerts

---

## Security Considerations

### Webhook Signature Verification

Meta signs all webhook payloads with HMAC-SHA256 using the App Secret:
```
X-Hub-Signature-256: sha256={hash}
```

Verification:
```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean {
  const expected = createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  return `sha256=${expected}` === signature;
}
```

### 24-Hour Messaging Window (WhatsApp)

- **Service messages**: Free, within 24h of last user message
- **Template messages**: Paid, can be sent anytime (requires pre-approved templates)
- **Business-initiated**: Requires payment method configured

### Data Privacy

- Phone numbers are hashed in document IDs (SHA-256)
- No PII stored in Firestore document IDs
- WhatsApp requires display of privacy policy URL

---

## Rollback Plan

Κάθε κανάλι είναι ανεξάρτητο:
- Αφαίρεση webhook URL από Meta Portal → instant disable
- Remove from IMPLEMENTED_CHANNELS → outbound disabled
- Delete webhook route → inbound disabled
- Existing conversations/messages remain in Firestore (no data loss)

---

## References

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Messenger Platform Docs](https://developers.facebook.com/docs/messenger-platform)
- [Instagram Messaging API](https://developers.facebook.com/docs/instagram-messaging)
- [Webhook Verification](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- ADR-029: Omnichannel Conversation Model
- ADR-031: Safe Document ID Generation
- ADR-145: Super Admin AI Assistant (AI pipeline integration)
- ADR-171: Autonomous AI Agent (agentic loop)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-11 | Initial ADR — Meta App created, WhatsApp token generated | Claude + Γιώργος |
| 2026-02-11 | Phase 1 OPERATIONAL — 5 webhook files, env vars, webhook verified + subscribed | Claude + Γιώργος |
| 2026-02-11 | AI Pipeline integration — WhatsAppChannelAdapter, dispatchWhatsApp, after() batch, PipelineChannel.WHATSAPP | Claude + Γιώργος |
| 2026-02-11 | Instant ack, agentic path routing, admin/customer prompt split | Claude + Γιώργος |
| 2026-02-11 | Interactive Reply Buttons — suggestions + feedback (👍/👎) + button_reply handler | Claude + Γιώργος |
| 2026-02-11 | Phase 1 COMPLETE — 17/20 checklist items done | Claude + Γιώργος |
| 2026-02-11 | Phase 2 CODE COMPLETE — 5 Messenger webhook files + adapter + dispatcher + Quick Replies | Claude + Γιώργος |
| 2026-02-11 | Phase 3 CODE COMPLETE — 5 Instagram webhook files + adapter + dispatcher (text-only) | Claude + Γιώργος |
| 2026-02-11 | Type system: INSTAGRAM added to PipelineChannel, COMMUNICATION_CHANNELS, IDENTITY_PROVIDER, PLATFORMS | Claude + Γιώργος |
| 2026-02-11 | IntakeSender extended: +messengerUserId, +instagramUserId | Claude + Γιώργος |
| 2026-02-11 | Pipeline orchestrator: Messenger+Instagram routed to agentic path + buttons/quick replies | Claude + Γιώργος |
| 2026-02-11 | **Phase 2 OPERATIONAL**: FB Page "Nestor App" (984661054730180) connected, webhook verified, subscriptions (messages, messaging_postbacks, message_deliveries), env vars set, end-to-end test passed — AI reply + Quick Replies + feedback working | Claude + Γιώργος |
| 2026-02-11 | **Super Admin Detection (ADR-145)**: Όλα τα Meta channel adapters (WhatsApp, Messenger, Instagram) αναγνωρίζουν super admin. Firestore registry: Γιώργος PSID=25577455211956767. `AdminCommandMeta.resolvedVia` +messenger_psid +instagram_igsid | Claude + Γιώργος |
