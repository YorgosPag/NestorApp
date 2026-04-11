# ADR-295: Multi-Channel Photo Sharing to CRM Contacts

**Status**: ✅ IMPLEMENTED  
**Date**: 2026-04-09  
**Category**: Omnichannel Communications  
**Related**: ADR-174 (Meta Omnichannel), ADR-134 (Telegram Pipeline), ADR-070 (Email Pipeline)

---

## Context

Users needed the ability to share property photos directly to CRM contacts via any available communication channel (Email, Telegram, WhatsApp, Messenger, Instagram), not just via social platform copy-paste.

## Decision

Extend the existing ShareModal with a "Send to Contact" flow that:
1. Searches CRM contacts (reuses `search-for-share` API)
2. Resolves available channels from `external_identities` collection + contact emails
3. Sends photos via the existing `sendChannelMediaReply()` dispatcher

### Architecture

```
ShareModal → "Send to Contact" button
    ↓
ContactChannelPicker (contact search + channel grid)
    ↓
ChannelShareForm (photo picker + message + send)
    ↓
POST /api/communications/share-to-channel
    ↓
sendChannelMediaReply() (existing SSoT dispatcher)
    ├─ Telegram → Bot API sendPhoto (native)
    ├─ Email → Mailgun attachment
    └─ WhatsApp/Messenger/Instagram → text + download link
```

### Manual Channel Linking

Contacts are automatically linked to external identities when they send a message via a webhook. For contacts who haven't messaged yet, manual linking is available:

```
ContactChannelPicker → "Link Channel" button
    ↓
Inline form: select provider + enter external user ID
    ↓
POST /api/contacts/[contactId]/link-channel
    ↓
Creates/updates external_identities document with contactId
```

## Files

### New Files
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/ui/channel-sharing/types.ts` | 96 | SSoT types + CHANNEL_CAPABILITIES |
| `src/components/ui/channel-sharing/ContactChannelPicker.tsx` | ~490 | Contact search + channel grid + manual link form |
| `src/components/ui/channel-sharing/ChannelShareForm.tsx` | 227 | Photo picker + message + send |
| `src/components/ui/channel-sharing/index.ts` | 25 | Barrel exports |
| `src/app/api/contacts/[contactId]/channels/route.ts` | 153 | GET available channels for contact |
| `src/app/api/contacts/[contactId]/link-channel/route.ts` | 238 | POST/DELETE manual channel linking |
| `src/app/api/communications/share-to-channel/route.ts` | 207 | POST send photo via channel |

### Modified Files
| File | Change |
|------|--------|
| `src/components/ui/ShareModal.tsx` | Added "Send to Contact" flow + handlers (2026-04-11: logic relocated to `UserAuthPermissionPanel` under ADR-147 Phase B — channel handlers, `handleChannelShare`, etc. now live in `src/components/ui/sharing/panels/UserAuthPermissionPanel.tsx`) |
| `src/config/domain-constants.ts` | Added CHANNELS, LINK_CHANNEL, SHARE_TO_CHANNEL routes |
| `src/lib/share-utils.ts` | Extracted copyImageToClipboard utility |
| `src/i18n/locales/{el,en}/common.json` | Added channelShare.* keys |

## Channel Capabilities (SSoT)

| Channel | Photo Support | Method | Implementation |
|---------|--------------|--------|----------------|
| Email | ✅ Native | Attachment | Mailgun API |
| Telegram | ✅ Native | sendPhoto | Bot API |
| WhatsApp | ⚠️ Fallback | Text + link | WhatsApp Cloud API |
| Messenger | ⚠️ Fallback | Text + link | Messenger Send API |
| Instagram | ⚠️ Fallback | Text + link | Instagram Messaging API |

## Centralized Systems Used
- `sendChannelMediaReply()` — channel-media-dispatcher.ts
- `external_identities` collection — contact ↔ channel linking
- `generateExternalIdentityId()` — deterministic document IDs
- `enterprise-id.service` — generateShareId()
- `withAuth` / `withStandardRateLimit` / `withSensitiveRateLimit`
- `logAuditEvent` — audit trail
- `PhotoPickerGrid` — reusable photo selection
- `designSystem` — consistent UI styling
- i18n — zero hardcoded strings

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-04-09 | Initial implementation — Phase 2 complete | Claude |
