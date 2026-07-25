# ADR-705 — Telegram Webhook Admin route split + Bot-API webhook-management SSoT

| | |
|---|---|
| **Κατάσταση** | ✅ IMPLEMENTED (2026-07-26) — `admin/telegram/webhook/route.ts` 440→49· 3 siblings· SSoT client· byte-for-byte behavior |
| **Ημερομηνία** | 2026-07-26 |
| **Συγγραφείς** | Claude Opus 4.8 + Γιώργος Παγώνης |
| **Σχετικά** | ADR-704 (εκστρατεία oversized admin routes — Φ5, το 10ο & τελευταίο)· ADR-703 (`isRoleBypass()` bypass-role guard)· ADR-029 (Omnichannel Conversation Model — Telegram receiver)· N.7.1 (όριο 300 γρ. για API routes)· N.18 (jscpd)· N.0 (SSoT-first) |
| **Κατηγορία** | Admin — Messaging / Telegram Operationalization |

---

## 1. Context

Η εκστρατεία **ADR-704** έλυσε 9/10 oversized admin routes (όριο N.7.1 = **300 γραμμές** για
`/api/**/route.ts`). Το `admin/telegram/webhook/route.ts` (**440 γρ.**) εξαιρέθηκε ρητά (ADR-704 §2, Q4):
**δεν είναι migration** — είναι διαχείριση **Telegram bot webhook configuration** (άλλο domain), άρα
χρειάζεται δικό του split και δικό του record. Αυτό είναι το record.

Το route εκθέτει 3 verbs, όλα `withTelegramRateLimit(withAuth(..., { permissions: 'admin:system:configure' }))`
+ explicit bypass-role guard (ADR-703) + audit (`logSystemOperation`):

- **GET** → `getWebhookInfo` (τρέχουσα config + health + recommendations)
- **POST** → `setWebhook` (URL + `secret_token`, με verify μετά)
- **DELETE** → `deleteWebhook` (κρατά pending updates by default)

### 1.1 Γιατί δεν μπαίνει στο `createMigrationRoute` (ADR-704)

Το `createMigrationRoute` (ADR-704 §4.1) κατέχει guard+audit+error για **data migrations**
(`logMigrationExecuted`, dry-run/execute envelope, batch scan→flush). Το telegram webhook είναι
**system configuration**, όχι migration: audit μέσω `logSystemOperation`, καθόλου batch/scan,
3 ετερογενή verbs με διαφορετικά shapes. Εξαναγκασμός στο migration envelope = **wrong abstraction**
(ίδια παγίδα ADR-698/699 που απέφυγε το ADR-704). → ατομικό **extract-to-sibling** split, όπως #3/#5/#9.

---

## 2. SSoT audit (πραγματικό grep ΠΡΙΝ τον κώδικα — εντολή Giorgio)

**Ερώτημα:** υπάρχει ήδη Telegram API client (fetch wrapper → `api.telegram.org`) για reuse;

Βρέθηκαν 3 υπάρχοντα Telegram clients — **κανένας δεν κάνει webhook-management**:

| Module | Ευθύνη | Token | Response shape | Reusable για webhook mgmt; |
|---|---|---|---|---|
| `communications/webhooks/telegram/telegram/client.ts` | `sendMessage`/`sendPhoto`/`setMessageReaction` | `TELEGRAM_BOT_TOKEN` | normalized `{success,...}` | ❌ μόνο messaging· δεν εκθέτει getWebhookInfo/setWebhook |
| `communications/webhooks/telegram/admin/client.ts` | admin notifications `sendMessage` | **`ADMIN_TELEGRAM_BOT_TOKEN`** (άλλο bot) | normalized `{success,...}` | ❌ άλλο token + άλλη ευθύνη |
| `services/ai-pipeline/channel-adapters/telegram-channel-adapter.ts` | AI-pipeline channel adapter | — | — | ❌ pipeline messaging |

**Απόφαση:** το webhook-management χρειάζεται το **raw** Telegram envelope (`{ ok, result, description, error_code }`)
για να επιστρέψει `error_code`/`description` κατευθείαν — οι υπάρχοντες clients επιστρέφουν normalized
`{success,...}`, άρα reuse θα άλλαζε συμπεριφορά. → **νέο route-local SSoT** για webhook-management,
όχι reuse (και όχι διπλότυπο messaging client). Mirror του προτύπου split του
`communications/webhooks/whatsapp/` (thin `route.ts` + `handler.ts` + `whatsapp-client.ts`) και της
εκστρατείας ADR-704 (`seed-parking.handlers.ts`).

### 2.1 Ασφάλεια — η πλευρά λήψης είναι ήδη state-of-the-art (καμία τρύπα)

Το admin route **μόνο ρυθμίζει** το webhook + θέτει το `secret_token`. Η **επικύρωση** του
`X-Telegram-Bot-Api-Secret-Token` header στα εισερχόμενα ζει στο
`communications/webhooks/telegram/telegram-security.ts` → `validateSecretToken()`:
**FAIL-CLOSED** (production πάντα επικυρώνει· missing/invalid = reject), με deliberate HTTP-200 στα
rejections για αποφυγή Telegram retry-loops. Αυτό είναι ίσο ή καλύτερο από τη σύσταση του Telegram Bot API
(secret token + fail-closed). → **δεν προστίθεται τίποτα** στην ασφάλεια· το split το διατηρεί ατόφιο.

---

## 3. Απόφαση — το split (4 αρχεία)

| Αρχείο | Ρόλος | Γραμμές |
|---|---|---|
| `route.ts` | thin wiring: 3× `withTelegramRateLimit(withAuth(handler, { permissions: 'admin:system:configure' }))` | **49** (<300 ✅) |
| `telegram-webhook.handlers.ts` | 3 handlers + shared `requireSuperAdmin` (ADR-703 guard) + `auditSystemOperation` + pure builders (`buildWebhookStatus`, `resolveWebhookConfig`) | **316** (<500 ✅) |
| `telegram-webhook-client.ts` | **SSoT** Telegram Bot API webhook-management: `callTelegramApi<T>` + `getWebhookInfo`/`setWebhook`/`deleteWebhook`/`buildSetWebhookParams`/`getDefaultWebhookUrl` | 109 |
| `telegram-webhook-types.ts` | `TelegramApiResponse<T>` (raw envelope), `WebhookInfo`, `SetWebhookRequest` (config/types — no line limit) | 37 |

**Behavior-preserving:** byte-for-byte όλα τα response JSON shapes, τα audit payloads (`telegram_webhook_configure`
/ `telegram_webhook_delete`), τα log messages, οι env fallbacks (`TELEGRAM_WEBHOOK_URL`→`VERCEL_URL`,
`secret_token`→`TELEGRAM_WEBHOOK_SECRET`) και τα Telegram API calls. Καμία αλλαγή συμπεριφοράς.

### 3.1 Ονοματοδοσία `TelegramApiResponse<T>` (όχι `TelegramResponse`)

Υπάρχει ήδη `TelegramResponse` (non-generic, normalized) στο `communications/webhooks/telegram/admin/types.ts`.
Για να αποφευχθεί σύγχυση, το raw generic envelope εδώ ονομάζεται **`TelegramApiResponse<T>`**.

### 3.2 Boy Scout — pre-existing duplication ΔΕΝ αγγίχτηκε (τεκμηριωμένο)

Το string `https://api.telegram.org/bot${token}/${method}` επαναλαμβάνεται σε ~5 αρχεία στο domain
`communications/webhooks/telegram/**` (διαφορετικά tokens/shapes, πιθανώς άλλου agent στο shared tree).
Κεντρικοποίηση = 4+ αρχεία / >1h / cross-domain / risk αλλαγής συμπεριφοράς → **εκτός scope Φ5**
(N.0.2: large duplicate → flag, μην αγγίξεις χωρίς έγκριση). Δεν είναι regression αυτού του split.

---

## 4. Google-level declaration

> ✅ **Google-level: YES** — SSoT για webhook-management (behavior-extracted functions, όχι option-bag),
> raw envelope για ακριβή error propagation, guard+audit εξαγμένα σε shared helpers (DRY χωρίς wrong
> abstraction), pure builders για response-shaping (functions λιτές), byte-for-byte behavior, jscpd-clean,
> thin route 49 γρ. Η ασφάλεια (fail-closed secret validation) παραμένει ατόφια στην πλευρά λήψης.

Checklist N.7.2: **1** Proactive (SSoT client στο σωστό επίπεδο)· **2** No race (γραμμικοί handlers)·
**3** Idempotent (setWebhook/deleteWebhook idempotent από Telegram)· **4** Belt-and-suspenders (audit
non-blocking `.catch`, `callTelegramApi` never-throws)· **5** SSoT (ένα home για Telegram webhook API calls)·
**6** Await (όλα awaited· audit non-blocking by design)· **7** Explicit lifecycle (κάθε verb κατέχει
guard+audit· route μόνο wiring).

---

## 5. Επικύρωση

- `route.ts` = 49 γρ. (<300, CHECK 4 ✅)· siblings <500 ✅.
- `npm run jscpd:diff` στα 5 αρχεία (+test) → **no new clones** (CHECK 3.28 ✅).
- **Jest: 12/12 ✅** — `__tests__/telegram-webhook-client.test.ts` (callTelegramApi URL/body/envelope,
  fail-safe branches: missing token χωρίς fetch + fetch-rejection never-throws, getWebhookInfo/setWebhook/
  deleteWebhook methods, `buildSetWebhookParams` defaults+optional-omission, `getDefaultWebhookUrl` precedence).
- Δεν δηλώθηκε νέο `src/lib` SSoT module → **δεν** απαιτείται εγγραφή στο `.ssot-registry.json`
  (route-local siblings, όπως whatsapp/seed-parking· δεν είναι cross-app centralized module).
- ❌ Δεν τρέχτηκε `tsc` (N.17 — Giorgio/pre-commit hook).

---

## 6. Changelog

| Ημ/νία | Αλλαγή | Συγγραφέας |
|---|---|---|
| 2026-07-26 | **IMPLEMENTED** — split `admin/telegram/webhook` 440→49 (thin route) + `telegram-webhook.handlers.ts` (316) + `telegram-webhook-client.ts` (109, SSoT webhook-management) + `telegram-webhook-types.ts` (37). SSoT audit: κανένας υπάρχων Telegram client δεν κάνει webhook-management (messaging-only, normalized shape, άλλο token) → νέο route-local SSoT. Ασφάλεια: fail-closed secret validation ήδη state-of-the-art στην πλευρά λήψης. byte-for-byte behavior· jscpd-clean· **12/12 jest** (client). **Το 10ο & τελευταίο oversized admin route της εκστρατείας ADR-704** | Claude Opus 4.8 + Γιώργος Παγώνης |
