# ADR-134: UC Modules Expansion + Telegram Channel — Omnichannel AI Pipeline

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | AI Architecture / Pipeline Infrastructure |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Supersedes** | — |
| **Related** | ADR-080 (Pipeline Implementation), ADR-131 (Multi-Intent Pipeline), ADR-169 (Modular AI Architecture), ADR-070 (Email & AI Ingestion) |

---

## 1. Context

### Πρόβλημα

Η AI pipeline (ADR-080, ADR-131) υποστηρίζει μόνο:
- **2 UC modules**: UC-001 (Appointment), UC-003 (Property Search)
- **1 κανάλι**: Email (Mailgun)

Αποτέλεσμα:
- **5 intents χωρίς module** (`complaint`, `general_inquiry`, `status_inquiry`, `defect_report`, `unknown`) — πέφτουν σε manual triage **χωρίς AI reply**
- **Telegram bot δεν τροφοδοτεί τη pipeline** — λειτουργεί ανεξάρτητα
- **UC modules hardcode Mailgun** — αδύνατη η αποστολή reply μέσω Telegram

### Στόχος

Πλήρης omnichannel pipeline:
- Email + Telegram ως input channels
- 7/12 intents με dedicated module (vs 2/12 πριν)
- Channel-aware reply dispatch — κάθε μήνυμα απαντιέται στο ίδιο κανάλι

---

## 2. Decision

Υιοθετούμε **5-φασική υλοποίηση**: νέα intents → νέα modules → channel dispatcher → retrofit existing modules → Telegram adapter.

### Alternatives Considered

| Εναλλακτική | Γιατί απορρίφθηκε |
|-------------|-------------------|
| **Ένα catch-all module** | Δεν παρέχει εξειδικευμένο tone (complaint vs general) |
| **Ξεχωριστή pipeline ανά κανάλι** | Duplication, αντίθετο με centralization |
| **Webhook relay** (Telegram → Email → Pipeline) | Χάνει context (chatId), δεν μπορεί να στείλει Telegram reply |

---

## 3. Architecture

### 3.1 Νέα Intent Types

Προστέθηκαν στο `PipelineIntentType` enum:

| Intent | Περιγραφή |
|--------|-----------|
| `COMPLAINT` | Παράπονο, καταγγελία, δυσαρέσκεια πελάτη |
| `GENERAL_INQUIRY` | Γενικό αίτημα/ερώτηση (catch-all) |

**Αρχεία**: `src/types/ai-pipeline.ts`, `src/schemas/ai-analysis.ts`

### 3.2 Channel Reply Dispatcher

Κεντρικοποιημένη `sendChannelReply()` — ΟΛΑ τα modules δρομολογούν replies μέσω αυτής:

```
sendChannelReply({ channel, recipientEmail?, telegramChatId?, textBody, ... })
  └→ email    → sendReplyViaMailgun()
  └→ telegram → sendTelegramMessage() (dynamic import)
  └→ other    → error: unsupported_channel
```

**Αρχείο**: `src/services/ai-pipeline/shared/channel-reply-dispatcher.ts`

### 3.3 UC-004 Complaint Module

| Πεδίο | Τιμή |
|-------|------|
| **moduleId** | `UC-004` |
| **displayName** | `Αναφορά Παραπόνου/Βλάβης` |
| **handledIntents** | `complaint`, `defect_report` |
| **autoApprovable** | `false` (ΠΑΝΤΑ human review) |

Pipeline steps:
- **LOOKUP**: `findContactByEmail()` + `getSenderHistory()`
- **PROPOSE**: `generateAIReply('complaint')` — empathetic tone, no excuses
- **EXECUTE**: Record σε `AI_PIPELINE_AUDIT` (type: complaint) + `sendChannelReply()`
- **ACKNOWLEDGE**: Verify reply delivery

**Αρχείο**: `src/services/ai-pipeline/modules/uc-004-complaint/complaint-module.ts`

### 3.4 UC-005 General Inquiry Module (Catch-All)

| Πεδίο | Τιμή |
|-------|------|
| **moduleId** | `UC-005` |
| **displayName** | `Γενικό Αίτημα` |
| **handledIntents** | `general_inquiry`, `status_inquiry`, `unknown` |
| **autoApprovable** | `false` (catch-all = ΠΑΝΤΑ human review) |

Σημείωση: Το `unknown` intent τώρα πηγαίνει σε UC-005 αντί να πέφτει σε manual triage χωρίς reply. Κάθε μήνυμα παίρνει τουλάχιστον ένα ευγενικό acknowledgment.

**Αρχείο**: `src/services/ai-pipeline/modules/uc-005-general-inquiry/general-inquiry-module.ts`

### 3.5 Retrofit UC-001 & UC-003

Τα existing modules αντικαθιστούν `sendReplyViaMailgun()` → `sendChannelReply()`:
- Backward compatible: email λειτουργεί ίδια
- Telegram messages πλέον λαμβάνουν reply μέσω Telegram
- Side effects renamed: `email_sent:` → `reply_sent:`, `email_failed:` → `reply_failed:`

**Αρχεία**: `appointment-module.ts`, `property-search-module.ts`

### 3.6 Telegram Channel Adapter

Mirrors `EmailChannelAdapter`:

```
Telegram webhook → processMessage() (existing bot flow)
                 ↘ TelegramChannelAdapter.feedToPipeline() → ai_pipeline_queue
```

- **Non-blocking**: Pipeline failure δεν σπάει τον Telegram bot
- **Skip commands**: `/start`, `/help` κλπ δεν τροφοδοτούν τη pipeline
- **Fire-and-forget**: Async, no await on the main handler
- **IntakeMessage mapping**: chatId → sender.telegramId, text → contentText

**Αρχείο**: `src/services/ai-pipeline/channel-adapters/telegram-channel-adapter.ts`

### 3.7 Legacy Intent Mapping

Ο orchestrator ενημερώθηκε:
- `'issue'` → `COMPLAINT` (πριν: `DEFECT_REPORT`)
- `'complaint'` → `COMPLAINT` (νέο)
- `'general_inquiry'` → `GENERAL_INQUIRY` (νέο)

**Αρχείο**: `src/services/ai-pipeline/pipeline-orchestrator.ts`

---

## 4. Intent → Module Coverage

### Πριν (ADR-131)

| Intent | Module | Status |
|--------|--------|--------|
| `appointment_request` | UC-001 | ✅ |
| `property_search` | UC-003 | ✅ |
| 10 intents | — | ❌ Manual triage |

### Μετά (ADR-134)

| Intent | Module | Status |
|--------|--------|--------|
| `appointment_request` | UC-001 | ✅ Existing |
| `property_search` | UC-003 | ✅ Existing |
| `complaint` | UC-004 | ✅ NEW |
| `defect_report` | UC-004 | ✅ NEW |
| `general_inquiry` | UC-005 | ✅ NEW |
| `status_inquiry` | UC-005 | ✅ NEW |
| `unknown` | UC-005 | ✅ NEW (catch-all) |
| `document_request` | UC-006 | ✅ Implemented |
| `admin_contact_search` | UC-010 | ✅ NEW (ADR-145) — search + list + missing fields analysis |
| `admin_project_status` | UC-011 | ✅ NEW (ADR-145) |
| `admin_send_email` | UC-012 | ✅ NEW (ADR-145) |
| `admin_unit_stats` | UC-013 | ✅ NEW (ADR-145) |
| `admin_create_contact` | UC-015 | ✅ NEW (ADR-145) |
| `admin_update_contact` | UC-016 | ✅ NEW (ADR-145 — Secretary Mode) |

**14 intents** με dedicated module + 1 admin fallback (UC-014).

**See also**: [ADR-145](./ADR-145-super-admin-ai-assistant.md) — Super Admin AI Assistant.

---

## 5. Files Changed

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 1 | `src/types/ai-pipeline.ts` | +COMPLAINT, +GENERAL_INQUIRY intents |
| 2 | `src/schemas/ai-analysis.ts` | +complaint, +general_inquiry στο Zod enum |
| 3 | `src/config/ai-analysis-config.ts` | MULTI_INTENT_SYSTEM + MESSAGE_INTENT_SYSTEM prompt update |
| 4 | `src/services/ai-pipeline/shared/ai-reply-generator.ts` | +complaint, +general_inquiry system prompts |
| 5 | `src/services/ai-pipeline/pipeline-orchestrator.ts` | Legacy intent mappings |
| 6 | `src/services/ai-pipeline/shared/channel-reply-dispatcher.ts` | **NEW** — κεντρικό reply dispatch |
| 7 | `src/services/ai-pipeline/modules/uc-004-complaint/complaint-module.ts` | **NEW** — UC-004 |
| 8 | `src/services/ai-pipeline/modules/uc-004-complaint/index.ts` | **NEW** — barrel export |
| 9 | `src/services/ai-pipeline/modules/uc-005-general-inquiry/general-inquiry-module.ts` | **NEW** — UC-005 |
| 10 | `src/services/ai-pipeline/modules/uc-005-general-inquiry/index.ts` | **NEW** — barrel export |
| 11 | `src/services/ai-pipeline/modules/register-modules.ts` | +ComplaintModule, +GeneralInquiryModule |
| 12 | `src/services/ai-pipeline/modules/uc-001-appointment/appointment-module.ts` | Mailgun → sendChannelReply() |
| 13 | `src/services/ai-pipeline/modules/uc-003-property-search/property-search-module.ts` | Mailgun → sendChannelReply() |
| 14 | `src/services/ai-pipeline/channel-adapters/telegram-channel-adapter.ts` | **NEW** — Telegram adapter |
| 15 | `src/app/api/communications/webhooks/telegram/handler.ts` | +Pipeline feed (non-blocking) |
| 16 | `src/i18n/locales/el/admin.json` | +4 i18n κλειδιά |
| 17 | `src/i18n/locales/en/admin.json` | +4 i18n κλειδιά |

**Σύνολο**: 6 νέα αρχεία + 11 τροποποιήσεις

---

## 6. Verification

- [x] `npx tsc --noEmit` → 0 errors
- [ ] Email με complaint → UC-004 αναγνωρίζει, δημιουργεί record, στέλνει reply
- [ ] Email με general question → UC-005 αναγνωρίζει, στέλνει polite acknowledgment
- [ ] Email με appointment (existing) → Ίδια ροή (backward compat)
- [ ] Telegram message → Εμφανίζεται στο `ai_pipeline_queue`, pipeline processes, reply via Telegram
- [ ] Operator Inbox → Δείχνει νέα action types (acknowledge_complaint, acknowledge_inquiry)

---

## 7. Consequences

### Θετικά
- **Πλήρης κάλυψη**: Κάθε εισερχόμενο μήνυμα παίρνει AI acknowledgment
- **Omnichannel**: Email + Telegram στην ίδια pipeline
- **Channel-agnostic modules**: UC modules δεν ξέρουν/δεν νοιάζονται για το κανάλι
- **Extensible**: Νέα κανάλια (Messenger, SMS) = μόνο νέος case στο dispatcher

### Αρνητικά / Risks
- **Telegram rate limits**: Αν η pipeline στέλνει πολλά replies, μπορεί να throttle
- **Default company ID**: Telegram adapter χρησιμοποιεί `DEFAULT_COMPANY_ID` env var
- **No media support**: Telegram adapter στέλνει μόνο text replies (media → μελλοντικό)
