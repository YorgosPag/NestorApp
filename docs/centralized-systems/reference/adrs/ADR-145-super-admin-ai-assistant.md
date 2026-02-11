# ADR-145: Super Admin AI Assistant — Omnichannel Admin Command System

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | AI Architecture / Pipeline Infrastructure |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related** | ADR-080 (Pipeline Implementation), ADR-131 (Multi-Intent Pipeline), ADR-134 (UC Modules + Telegram), ADR-070 (Email & AI Ingestion) |

---

## 1. Context

### Πρόβλημα

Οι ιδιοκτήτες (Γιώργος + Στέφανος) θέλουν να δίνουν εντολές στο AI μέσω **οποιουδήποτε καναλιού** (Telegram, Email) και αυτές να εκτελούνται **αυτόματα** χωρίς operator approval.

Παραδείγματα:
- "Βρες μου τα στοιχεία του Γιάννη"
- "Τι γίνεται με το έργο Πανόραμα;"
- "Στείλε email στον Κώστα ότι μετακινείται το ραντεβού"
- "Πόσα ακίνητα έχουμε πωλημένα;"

**Πριν το ADR-145**: Η pipeline αντιμετωπίζει ΟΛΟΥΣ τους χρήστες ως πελάτες — κανένα admin recognition.

### Στόχος

- Config-driven αναγνώριση admin χρηστών σε κάθε κανάλι
- Admin commands → auto-approve (admin IS the operator)
- Dedicated admin intents + UC modules
- Non-admin flow 100% unchanged (backward compatible)

---

## 2. Decision

**Ίδια Pipeline, Διαφορετικό Mode** — ΔΕΝ φτιάχνουμε ξεχωριστή pipeline. Προσθέτουμε `AdminCommandMeta` στο `PipelineContext`:

### Admin Identity Detection

```
Telegram:  isSuperAdminTelegram(userId)    → check settings/super_admin_registry
Email:     isSuperAdminEmail(address)      → check settings/super_admin_registry
In-App:    isSuperAdminFirebaseUid(uid)    → check settings/super_admin_registry
           ↳ fallback: isSuperAdminEmail() → if UID not in registry
WhatsApp:  isSuperAdminWhatsApp(phone)     → check settings/super_admin_registry
Messenger: isSuperAdminMessenger(psid)     → check settings/super_admin_registry
Instagram: isSuperAdminInstagram(igsid)    → check settings/super_admin_registry
```

### Pipeline Branching

```
Admin message:
  → Telegram handler: skip bot response, send "⏳ Επεξεργάζομαι..."
  → Channel adapter: set adminCommandMeta on intake
  → AI analysis: use ADMIN_COMMAND_SYSTEM prompt (admin-specific intents)
  → Orchestrator: auto-approve (super_admin:DisplayName)
  → UC-010..013: execute command, reply via channel
  → Operator Inbox: ΔΕΝ εμφανίζεται (auto-approved)

Customer message:
  → Unchanged (backward compatible)
```

### Alternatives Considered

| Εναλλακτική | Γιατί Απορρίφθηκε |
|-------------|-------------------|
| Ξεχωριστή admin pipeline | Duplication, violation centralization |
| Admin commands μόνο μέσω UI | Δεν εξυπηρετεί mobile use case (Telegram) |
| Hardcoded admin IDs στον κώδικα | Απαιτεί redeploy, δεν κλιμακώνεται |
| Webhook relay (Telegram → email) | Χάνει context, δεν γνωρίζει admin identity |

---

## 3. Architecture

### 3.1 Super Admin Identity Registry

**Firestore Document**: `settings/super_admin_registry`

```typescript
interface SuperAdminIdentity {
  firebaseUid: string | null;
  displayName: string;
  channels: {
    telegram?: { userId: string; chatId: string };
    email?: { addresses: string[] };
    whatsapp?: { phoneNumber: string };
    messenger?: { psid: string };
    instagram?: { igsid: string };
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Resolver**: In-memory cached (5-min TTL), server-only, reads from Firestore.

**Αρχεία**:
- `src/types/super-admin.ts` — Type definitions
- `src/services/ai-pipeline/shared/super-admin-resolver.ts` — Cached resolver
- `scripts/seed-super-admin-registry.ts` — Seed script

### 3.2 Admin Command Meta

Προστέθηκε στο `PipelineContext`:

```typescript
interface AdminCommandMeta {
  adminIdentity: { displayName: string; firebaseUid: string | null };
  isAdminCommand: boolean;
  resolvedVia: 'telegram_user_id' | 'email_address' | 'firebase_uid' | 'viber_phone' | 'whatsapp_phone';
}
```

### 3.3 Admin-Specific AI — Tool Calling (Function Calling)

**Αρχιτεκτονική (2026-02-10):** Αντί για structured output JSON schema, τα admin commands χρησιμοποιούν **OpenAI tool calling** (function calling). Η AI επιλέγει το κατάλληλο tool και εξάγει ΟΛΑ τα params σημασιολογικά — μηδέν regex.

- **7 tools** στο `src/config/admin-tool-definitions.ts`: `search_contacts`, `get_project_status`, `send_email`, `get_business_stats`, `create_contact`, `update_contact_field`, `remove_contact_field`
- **System prompt**: `ADMIN_TOOL_SYSTEM_PROMPT` — οδηγίες για σημασιολογική κατανόηση, declension handling, field names
- **Conversational fallback**: Αν η AI δεν καλέσει tool → text reply → UC-014 χωρίς 2η API κλήση
- **Mapping**: `mapToolCallToAnalysisResult()` μετατρέπει tool call → pipeline-compatible `AIAnalysisResult`
- Ενεργοποιείται **μόνο** όταν `isAdminCommand === true`

### 3.4 Admin Intent Types

| Intent | Module | Περιγραφή |
|--------|--------|-----------|
| `admin_contact_search` | UC-010 | Αναζήτηση στοιχείων επαφής |
| `admin_project_status` | UC-011 | Κατάσταση έργου, λίστα, αναζήτηση (Gantt, status, κλπ.) |
| `admin_send_email` | UC-012 | Αποστολή email σε επαφή |
| `admin_unit_stats` | UC-013 | Στατιστικά ακινήτων (πωλημένα/διαθέσιμα/δεσμευμένα) |
| `admin_create_contact` | UC-015 | Δημιουργία νέας επαφής (+ smart confirmation) |
| `admin_update_contact` | UC-016 | Ενημέρωση στοιχείων επαφής (Secretary Mode) |
| _(no intent match)_ | UC-014 | Fallback — help text με διαθέσιμες εντολές |

### 3.5 Auto-Approve Logic

```typescript
// pipeline-orchestrator.ts — stepApproveMulti()
if (ctx.adminCommandMeta?.isAdminCommand) {
  ctx.approval = {
    decision: 'approved',
    approvedBy: `super_admin:${ctx.adminCommandMeta.adminIdentity.displayName}`,
    decidedAt: new Date().toISOString(),
  };
  // Skip operator review — admin IS the operator
}
```

### 3.6 Admin Fallback Routing

UC-014 δεν εγγράφεται στο module registry (δεν έχει global intent mapping). Ο orchestrator ελέγχει:

```
if (isAdminCommand && intent δεν ξεκινά με 'admin_')
  → invoke UC-014 explicitly (dynamic import)
  → send help text via channel
```

---

## 4. UC Modules

### UC-010: Admin Contact Search, List & Missing Fields Analysis

- **Intents**: `admin_contact_search`
- **Three Modes**:
  - **Search mode**: Specific name given → `findContactByName()` fuzzy match
  - **List mode**: No name, asks "ποιες επαφές" → `listContacts()` with type filter
  - **Missing fields mode**: Asks about empty/incomplete fields → `getContactMissingFields()` analysis
- **Missing Fields Detection**: `detectMissingFieldsMode()` αναγνωρίζει keywords (κενά, ελλιπή, λείπει, πεδία, συμπληρωθούν)
- **Type Filter**: `detectTypeFilter()` αναγνωρίζει keywords (φυσικά πρόσωπα → individual, εταιρείες → company)
- **Execute**: Read-only (καμία side effect)
- **Acknowledge**: Format αποτελεσμάτων — standard (name, email, phone) ή missing fields (filled/total, κενά πεδία list)
- **autoApprovable**: `true`

### UC-011: Admin Project Status, List & Search

- **Intents**: `admin_project_status`
- **Three Modes** (2026-02-10):
  - **Single mode**: "Τι γίνεται με το έργο Πανόραμα;" → `projectName: "Πανόραμα"` → single project details
  - **List mode**: "Δείξε μου τα έργα" → `projectName: null, searchCriteria: null` → all projects
  - **Search mode**: "Ποια έργα έχουν gantt;" → `projectName: null, searchCriteria: "gantt"` → filtered projects
- **Enrichment**: Batch queries for units, buildings, construction_phases → unit stats + building count + Gantt detection
- **Search Criteria**: gantt/χρονοδιάγραμμα, status keywords (σε εξέλιξη, ολοκληρωμένο), κτήρια, units
- **Execute**: Read-only
- **Acknowledge**: Format single project detail or multi-project list → send via channel
- **autoApprovable**: `true`

### UC-012: Admin Send Email

- **Intents**: `admin_send_email`
- **Lookup**: `findContactByName()` → get email address
- **Compound Commands**: Supports "Βρες επαφή X και στείλε" → formats contact card as email body
  - `COMPOUND_FIND_SEND_PATTERN`: detects "βρες...επαφή...και στείλε" pattern
  - `CONTACT_CARD_PATTERN`: detects "στοιχεία του/της X" pattern
  - `EXPLICIT_EMAIL_PATTERN`: extracts explicit email from command text
  - `overrideRecipientEmail`: explicit email in command overrides contact's email
- **Execute**: `sendReplyViaMailgun()` (existing centralized sender)
- **Acknowledge**: Confirm delivery: "Email στάλθηκε στον X"
- **autoApprovable**: `true` (admin gave explicit order)

### UC-013: Admin Business Stats (Units + Contacts + Projects)

- **Intents**: `admin_unit_stats`
- **Smart Detection**: `detectStatsType()` αναλύει keywords στο μήνυμα:
  - "πόσα ακίνητα" → query units (sold, available, reserved)
  - "πόσες επαφές" → query contacts (φυσικά πρόσωπα + εταιρείες)
  - "πόσα έργα" → query projects (list names)
  - Mixed → all three
- **Execute**: Read-only
- **Acknowledge**: Format stats per type → send via channel
- **autoApprovable**: `true`

### UC-015: Admin Create Contact (+ Smart Confirmation)

- **Intents**: `admin_create_contact`
- **Trigger**: "Δημιούργησε επαφή Νέστορας Παγώνης, nestoras@gmail.com"
- **Lookup**: Parse name → firstName + lastName, duplicate check by email via `findContactByEmail()`
- **Execute**: `createContactServerSide()` — Admin SDK → Firestore contacts collection
- **Duplicate Detection**: If email already exists → notify admin, no new contact created
- **Smart Confirmation**: Μετά τη δημιουργία, εμφανίζει:
  - Ποια στοιχεία λείπουν (τηλέφωνο, ΑΦΜ, επάγγελμα, κλπ.)
  - Προτεινόμενες εντολές: `"Πρόσθεσε τηλέφωνο 69... στον Νέστορα"`
- **Session Write**: Γράφει `AdminSession` → ώστε follow-up χωρίς όνομα να ξέρει ποια επαφή
- **autoApprovable**: `true`
- **Side Effects**: Firestore write (contact + admin session)

### UC-016: Admin Update Contact (Secretary Mode)

- **Intents**: `admin_update_contact`
- **Trigger**: "Πρόσθεσε τηλέφωνο 6971234567 στον Νέστορα", "Βάλε ΑΦΜ 123456789", "Επάγγελμα: Μηχανικός"
- **Field Detection**: Keyword-to-field mapping (12 πεδία: phone, email, vatNumber, profession, birthDate, fatherName, taxOffice, address, registrationNumber, legalForm, employer, position)
- **Contact Resolution**:
  1. Parse name → `findContactByName()` (1 result → proceed, 2+ → disambiguation)
  2. No name → `getAdminSession()` → χρησιμοποιεί τελευταία δημιουργημένη/ενημερωμένη επαφή
  3. Session expired/missing → ζητάει όνομα
- **Firestore Update**:
  - Array fields (phone, email): `FieldValue.arrayUnion()` — προσθέτει χωρίς overwrite
  - Scalar fields: direct `.update({ [field]: value })`
  - Πάντα: `updatedAt`, `lastModifiedBy`
- **Smart Acknowledgment**: Εμφανίζει υπόλοιπα ελλιπή στοιχεία μετά την ενημέρωση
- **Session Update**: Ανανεώνει session μετά το update
- **autoApprovable**: `true`
- **Side Effects**: Firestore write (contact update + admin session)

### UC-014: Admin Fallback

- **Intents**: _(κανένα — invoked explicitly by orchestrator)_
- **Trigger**: Admin command NOT recognized by other modules
- **Action**: Send help text: "Δεν κατάλαβα. Δοκιμάστε: Βρες [όνομα], Τι γίνεται με [έργο]..."
- **autoApprovable**: `true`

---

## 5. Shared Utilities

### findContactByName() — Contact Lookup Extension

**Αρχείο**: `src/services/ai-pipeline/shared/contact-lookup.ts`

```typescript
export async function findContactByName(
  searchTerm: string,
  companyId: string,
  limit?: number
): Promise<ContactNameSearchResult[]>
```

- Queries all contacts for company
- Client-side fuzzy matching: displayName, firstName, lastName, companyName
- Case-insensitive, accent-insensitive via `normalize('NFD')`
- Returns: contactId, name, email, phone, company, type

### createContactServerSide() — Contact Creation (UC-015)

**Αρχείο**: `src/services/ai-pipeline/shared/contact-lookup.ts`

```typescript
export async function createContactServerSide(
  params: CreateContactParams
): Promise<CreateContactResult>
```

- Duplicate check by email (`findContactByEmail()`)
- Builds Firestore document following enterprise contact schema
- `emails[]` / `phones[]` arrays with typed entries (enterprise pattern)
- All optional fields use `?? null` (Firestore rejects undefined)
- Returns: contactId + displayName

### updateContactField() — Contact Field Update (UC-016)

**Αρχείο**: `src/services/ai-pipeline/shared/contact-lookup.ts`

```typescript
export async function updateContactField(
  contactId: string, field: string, value: string, updatedBy: string
): Promise<void>
```

- Array fields (phone, email): `FieldValue.arrayUnion()` — adds without overwrite
- Scalar fields (vatNumber, profession, etc.): direct `.update()`
- Always: `updatedAt`, `lastModifiedBy` audit trail

### getContactMissingFields() — Missing Fields Checklist

```typescript
export async function getContactMissingFields(
  contactId: string, contactType: 'individual' | 'company'
): Promise<string[]>
```

- Returns Greek labels of empty/missing fields
- Used by UC-015 (smart confirmation) and UC-016 (remaining fields after update)

### Admin Session (Conversational Context)

**Αρχείο**: `src/services/ai-pipeline/shared/admin-session.ts`
**Firestore path**: `settings/admin_sessions/sessions/{adminIdentifier}`

```typescript
interface AdminSession {
  lastAction: { type: 'create_contact' | 'update_contact'; contactId: string; contactName: string; timestamp: string } | null;
  expiresAt: string; // TTL 10 λεπτά
}
```

- `getAdminSession()` — read, return null if expired
- `setAdminSession()` — write/update
- `buildAdminIdentifier()` — builds key from channel + sender info

---

## 6. Intent → Module Coverage (After ADR-145)

| Intent | Module | Status |
|--------|--------|--------|
| `appointment_request` | UC-001 | ✅ Existing (ADR-080) |
| `property_search` | UC-003 | ✅ Existing (ADR-080) |
| `complaint` | UC-004 | ✅ Existing (ADR-134) |
| `defect_report` | UC-004 | ✅ Existing (ADR-134) |
| `general_inquiry` | UC-005 | ✅ Existing (ADR-134) |
| `status_inquiry` | UC-005 | ✅ Existing (ADR-134) |
| `unknown` | UC-005 | ✅ Existing (ADR-134) |
| `document_request` | UC-006 | ✅ Existing |
| `admin_contact_search` | UC-010 | ✅ **NEW** (ADR-145) |
| `admin_project_status` | UC-011 | ✅ **NEW** (ADR-145) |
| `admin_send_email` | UC-012 | ✅ **NEW** (ADR-145) |
| `admin_unit_stats` | UC-013 | ✅ **NEW** (ADR-145) |
| `admin_create_contact` | UC-015 | ✅ **NEW** (ADR-145) |
| `admin_update_contact` | UC-016 | ✅ **NEW** (ADR-145 — Secretary Mode) |
| _(admin fallback)_ | UC-014 | ✅ **NEW** (ADR-145) |

**14 intents με module** + 1 admin fallback.

---

## 7. Files Changed

### New Files (18)

| # | Αρχείο | Σκοπός |
|---|--------|--------|
| 1 | `src/types/super-admin.ts` | Super admin type definitions |
| 2 | `src/services/ai-pipeline/shared/super-admin-resolver.ts` | Cached identity resolver |
| 3 | `scripts/seed-super-admin-registry.ts` | Firestore seed script |
| 4 | `src/services/ai-pipeline/modules/uc-010-admin-contact-search/admin-contact-search-module.ts` | UC-010 |
| 5 | `src/services/ai-pipeline/modules/uc-010-admin-contact-search/index.ts` | Barrel |
| 6 | `src/services/ai-pipeline/modules/uc-011-admin-project-status/admin-project-status-module.ts` | UC-011 |
| 7 | `src/services/ai-pipeline/modules/uc-011-admin-project-status/index.ts` | Barrel |
| 8 | `src/services/ai-pipeline/modules/uc-012-admin-send-email/admin-send-email-module.ts` | UC-012 |
| 9 | `src/services/ai-pipeline/modules/uc-012-admin-send-email/index.ts` | Barrel |
| 10 | `src/services/ai-pipeline/modules/uc-013-admin-unit-stats/admin-unit-stats-module.ts` | UC-013 |
| 11 | `src/services/ai-pipeline/modules/uc-013-admin-unit-stats/index.ts` | Barrel |
| 12 | `src/services/ai-pipeline/modules/uc-014-admin-fallback/admin-fallback-module.ts` | UC-014 |
| 13 | `src/services/ai-pipeline/modules/uc-014-admin-fallback/index.ts` | Barrel |
| 14 | `src/services/ai-pipeline/modules/uc-015-admin-create-contact/admin-create-contact-module.ts` | UC-015 |
| 15 | `src/services/ai-pipeline/modules/uc-015-admin-create-contact/index.ts` | Barrel |
| 16 | `src/services/ai-pipeline/modules/uc-016-admin-update-contact/admin-update-contact-module.ts` | UC-016 (Secretary Mode) |
| 17 | `src/services/ai-pipeline/modules/uc-016-admin-update-contact/index.ts` | Barrel |
| 18 | `src/services/ai-pipeline/shared/admin-session.ts` | Admin session (conversational context) |

### Modified Files (17)

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 1 | `src/config/firestore-collections.ts` | +`SUPER_ADMIN_REGISTRY` doc path |
| 2 | `src/types/ai-pipeline.ts` | +`AdminCommandMeta`, +4 admin intents, +`adminCommandMeta` in PipelineContext |
| 3 | `src/schemas/ai-analysis.ts` | +4 admin intents in Zod enum |
| 4 | `src/config/ai-analysis-config.ts` | +`ADMIN_COMMAND_SYSTEM` prompt |
| 5 | `src/services/ai-analysis/providers/IAIAnalysisProvider.ts` | +`isAdminCommand` in context |
| 6 | `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts` | Admin prompt selection |
| 7 | `src/services/ai-pipeline/channel-adapters/telegram-channel-adapter.ts` | Admin detection + `adminCommandMeta` |
| 8 | `src/services/ai-pipeline/channel-adapters/email-channel-adapter.ts` | Admin detection + `adminCommandMeta` |
| 9 | `src/app/api/communications/webhooks/telegram/handler.ts` | Skip bot for admin + ack message |
| 10 | `src/services/ai-pipeline/pipeline-orchestrator.ts` | Auto-approve + admin fallback routing |
| 11 | `src/services/ai-pipeline/pipeline-queue-service.ts` | +`adminCommandMeta` in enqueue |
| 12 | `src/services/ai-pipeline/shared/contact-lookup.ts` | +`findContactByName()` |
| 13 | `src/services/ai-pipeline/modules/register-modules.ts` | +UC-010..013 registration |
| 14 | `src/i18n/locales/el/admin.json` | +`superAdmin` i18n keys |
| 15 | `src/i18n/locales/en/admin.json` | +`superAdmin` i18n keys |
| 16 | `src/hooks/useContactsState.ts` | Real-time onSnapshot αντί one-time fetch — server-side writes (UC-015/UC-016) εμφανίζονται αυτόματα |
| 17 | `src/services/contacts.service.ts` | `subscribeToContacts()` +`limitCount` parameter |

---

## 8. Security

| Θέμα | Μετριασμός |
|------|------------|
| Telegram user_id spoofing | Webhook secret validation — μόνο Telegram servers μπορούν να στείλουν |
| Email spoofing | Mailgun signing key validation |
| Unknown device/channel | Δεν αναγνωρίζεται → normal customer flow |
| In-app Firebase UID missing from registry | Fallback to email-based detection |
| Admin registry access | Firestore Admin SDK only (server-side) |
| Cache poisoning | 5-min TTL, reads from source of truth |
| Graceful degradation | Admin detection failure → treat as customer (non-fatal try/catch) |

---

## 9. End-to-End Flow (Example)

```
Γιώργος (Telegram): "Βρες μου τα στοιχεία του Γιάννη"
  ↓
[1] Webhook → handler.ts → detect admin → skip bot response
[2] Send "⏳ Επεξεργάζομαι την εντολή σας..." ack
[3] feedToPipeline() → admin check → set adminCommandMeta
[4] Enqueue → after() → processAIPipelineBatch()
[5] UNDERSTAND: AI (ADMIN_COMMAND_SYSTEM prompt) → admin_contact_search, entity: "Γιάννης"
[6] LOOKUP: findContactByName("Γιάννης") → 2 results
[7] PROPOSE: autoApprovable=true
[8] APPROVE: Auto (super_admin:Γιώργος)
[9] EXECUTE: No side effects (read-only)
[10] ACKNOWLEDGE: sendChannelReply(telegram, formatted results)
  ↓
Γιώργος βλέπει στο Telegram:
  "Βρέθηκαν 2 αποτελέσματα:
   1. Γιάννης Παπαδόπουλος — giannis@example.com — 6971234567
   2. Γιάννης Κωσταντίνου — gkost@example.com"
```

---

## 10. Verification

- [x] `npx tsc --noEmit` → 0 errors
- [x] Seed super admin registry — Γιώργος Παγώνης, userId: 5618410820
- [x] Telegram: "Πόσες επαφές φυσικών προσώπων έχουμε;" → 10 επαφές (4 φυσικά, 6 εταιρείες) ✅
- [ ] Telegram: Admin στέλνει "Βρες Γιάννη" → λαμβάνει contact results
- [ ] Telegram: Admin στέλνει "Τι γίνεται με Πανόραμα" → project status
- [ ] Telegram: Admin στέλνει "Στείλε email στον X ότι..." → email sends + confirmation
- [ ] Telegram: Admin στέλνει "Πόσα ακίνητα έχουμε;" → unit stats
- [ ] Telegram: "Ποιες είναι οι επαφές φυσικών προσώπων;" → λίστα με πλήρη στοιχεία
- [ ] Telegram: Non-admin στέλνει ίδιο μήνυμα → normal customer flow (unchanged)
- [ ] Email: Admin στέλνει από registered email → same admin flow
- [ ] Operator Inbox: Admin commands ΔΕΝ εμφανίζονται (auto-approved)

---

## 11. Consequences

### Θετικά

- ✅ Admin commands μέσω Telegram/Email — mobile-friendly
- ✅ Auto-approve — zero friction για admins
- ✅ Config-driven identity (Firestore, no redeploy)
- ✅ Non-admin flow 100% unchanged (backward compatible)
- ✅ Extensible: νέα admin commands = νέο UC module + intent
- ✅ Future-ready: Viber/WhatsApp channels = μόνο `isSuperAdminViber()` + resolver extension

### Αρνητικά / Risks

- ⚠️ Fuzzy name matching may return false positives (mitigated: returns multiple results, admin reviews)
- ⚠️ All contacts loaded in memory for name search (mitigated: limit parameter, enterprise companies have <10k contacts)
- ⚠️ Seed script requires manual Telegram userId lookup (one-time setup)

---

## 12. Pending

- [x] ~~Run seed script with real Telegram user IDs~~ — Done (Γιώργος Παγώνης = 5618410820)
- [x] ~~Set firebaseUid in registry~~ — Done (ITjmw0syn7WiYuskqaGtzLPuN852) (2026-02-09)
- [ ] End-to-end production testing (remaining commands)
- [x] ~~UC-015: Admin Create Contact~~ — Done (2026-02-09)
- [x] ~~UC-016: Admin Update Contact (Secretary Mode)~~ — Done (2026-02-09)
- [x] ~~ADR-164: In-App Voice AI Pipeline~~ — Done (2026-02-09)
- [ ] UC-017+: More admin commands (appointment management, notification preferences)
- [ ] Viber/WhatsApp channel support (when adapters are added)

---

## 13. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — Full 3-phase implementation | Γιώργος Παγώνης + Claude Code |
| 2026-02-09 | Phase 1: Identity Registry (types, resolver, seed) | Claude Code |
| 2026-02-09 | Phase 2: Pipeline Branching (admin detection, auto-approve, AI prompt) | Claude Code |
| 2026-02-09 | Phase 3: UC-010..014 admin modules + i18n | Claude Code |
| 2026-02-09 | Seed: Γιώργος Παγώνης = Telegram 5618410820 (@SteFanoThess) | Claude Code |
| 2026-02-09 | Fix: UC-013 broadened → business stats (contacts + projects + units) with detectStatsType() | Claude Code |
| 2026-02-09 | Feat: UC-010 list mode — "ποιες επαφές" → listContacts() with type filter (individual/company) | Claude Code |
| 2026-02-09 | AI prompt: admin_contact_search covers name search + list contacts; admin_unit_stats covers all "πόσα" questions | Claude Code |
| 2026-02-09 | UC-015: Admin Create Contact — δημιουργία επαφών via admin command, duplicate detection by email, createContactServerSide() | Claude Code |
| 2026-02-09 | UC-015 Enhancement: Smart Confirmation — ελλιπή στοιχεία checklist + suggested commands μετά δημιουργία | Claude Code |
| 2026-02-09 | UC-016: Admin Update Contact (Secretary Mode) — keyword-to-field mapping, session context, updateContactField(), getContactMissingFields() | Claude Code |
| 2026-02-09 | Admin Session: Lightweight conversational context (Firestore, 10-min TTL) — enables follow-up commands χωρίς explicit contact name | Claude Code |
| 2026-02-09 | UC-010 Fix: Fallback σε raw message parsing όταν AI επιστρέφει κενό contactName — `extractSearchTermFromMessage()` | Claude Code |
| 2026-02-09 | Real-time Contacts: `useContactsState` → Firestore `onSnapshot` αντί one-time fetch — server-side writes (UC-015/UC-016) εμφανίζονται αυτόματα στο UI | Claude Code |
| 2026-02-09 | Fix: Admin entity extraction — `AI_ADMIN_COMMAND_SCHEMA` with 14 fields (base+admin) replaces 5-field schema for admin commands. `ExtractedEntitiesSchema` gets `.passthrough()`. UC-012 fallback parsing from raw message. | Claude Code |
| 2026-02-09 | ADR-164: In-App Voice AI Pipeline — third channel adapter (IN_APP), `isSuperAdminFirebaseUid()` + email fallback, `voice_commands` Firestore rules | Claude Code |
| 2026-02-09 | Data fix: Set `firebaseUid: "ITjmw0syn7WiYuskqaGtzLPuN852"` in `settings/super_admin_registry` for in-app admin detection | Claude Code |
| 2026-02-09 | Fix: AI prompt intent detection — "πόσα πεδία κενά στην επαφή X" λανθασμένα πήγαινε σε UC-013 (stats) αντί UC-010 (contact search). Διευκρίνιση ότι ερωτήσεις για πεδία ΣΥΓΚΕΚΡΙΜΕΝΗΣ επαφής → `admin_contact_search`, aggregate stats → `admin_unit_stats` | Claude Code |
| 2026-02-09 | Feat: UC-010 missing fields mode — `detectMissingFieldsMode()` + `getContactMissingFields()` integration. Δείχνει filled/total πεδία + λίστα κενών πεδίων ανά επαφή | Claude Code |
| 2026-02-10 | Prompt Upgrade: SEMANTIC UNDERSTANDING — αντικατάσταση keyword-based περιγραφών με σημασιολογικές. Το AI πλέον κατανοεί ΝΟΗΜΑ αντί να ψάχνει λέξεις-κλειδιά. `admin_unit_stats` καλύπτει ΟΠΟΙΑΔΗΠΟΤΕ ερώτηση για ακίνητα (σπίτια, διαμερίσματα, οικόπεδα κτλ.), status, πωλήσεις, ερωτήσεις ναι/όχι. `general_inquiry` ορίστηκε ως LAST RESORT. | Claude Code |
| 2026-02-10 | UC-013 keywords: Προσθήκη 15+ νέων property/status keywords (σπίτι, κατοικία, οικόπεδο, μεζονέτα, ρετιρέ, πουλημένα, διαθέσιμα, αδιάθετα κτλ.) στο `detectStatsType()` | Claude Code |
| 2026-02-10 | Fix 1: Fuzzy Greek name search — `greek-text-utils.ts` (transliteration, stem match, accent strip). `findContactByName()` χρησιμοποιεί `fuzzyGreekMatch()` αντί exact substring. "Γιάννη"→"Γιάννης", "Giorgos"→"Γιώργος" | Claude Code |
| 2026-02-10 | Fix 2: Compound commands — UC-012 ανιχνεύει "στοιχεία του/της X" pattern, κάνει δεύτερο lookup, στέλνει contact card ως email body | Claude Code |
| 2026-02-10 | Fix 3: Smart fallback — νέο intent `admin_general_question` + UC-014 κάνει OpenAI conversational κλήση αντί static help text. `generateAdminConversationalReply()` στο `ai-reply-generator.ts` | Claude Code |
| 2026-02-10 | Bug fix: UC-013 property type breakdown — "ποιες κατηγορίες ακινήτων" δείχνει ανά τύπο (Στούντιο, Διαμέρισμα κτλ.) αντί μόνο status counts. Νέο `unit_categories` StatsType + `UNIT_TYPE_LABELS` mapping | Claude Code |
| 2026-02-10 | Bug fix: UC-016 REMOVE mode — "αφαίρεσε/σβήσε/βγάλε" keywords → `removeContactField()` (arrayRemove for phone/email, null for scalar). Νέο `removeContactField()` στο `contact-lookup.ts` | Claude Code |
| 2026-02-10 | Bug fix: "ταυτότητα/ΑΔΤ" intent misclassification — προσθήκη `idNumber` field mapping στο UC-016, clarification στο AI prompt ότι ταυτότητα+πρόσωπο → `admin_update_contact` (ΟΧΙ unit_stats) | Claude Code |
| 2026-02-10 | Fix: UC-012 compound "find+send" commands — `COMPOUND_FIND_SEND_PATTERN` detects "Βρες επαφή X και στείλε", `EXPLICIT_EMAIL_PATTERN` extracts email from command, `overrideRecipientEmail` overrides contact's email. Fixes bug where raw command was sent as email body instead of contact card | Claude Code |
| 2026-02-10 | Critical fix: Telegram function timeout — `maxDuration=60` στο webhook route.ts (default 10s δεν αρκεί για 2 OpenAI calls). Fix: `admin_general_question` mapping στον orchestrator. Fix: race condition — `feedTelegramToPipeline` γίνεται awaitable αντί fire-and-forget ώστε η `after()` να βρίσκει πάντα το item στο queue | Claude Code |
| 2026-02-10 | **ARCH: OpenAI Function Calling (Tool Use)** — Αντικατάσταση structured output (JSON schema) με tool calling για admin commands. 7 tool definitions (`search_contacts`, `get_project_status`, `send_email`, `get_business_stats`, `create_contact`, `update_contact_field`, `remove_contact_field`) αντικαθιστούν `AI_ADMIN_COMMAND_SCHEMA`. Η AI εξάγει ΟΛΑ τα params σημασιολογικά — μηδέν regex parsing. Conversational replies μέσω text fallback (0 extra API calls). UC modules λαμβάνουν pre-parsed entities. Νέο αρχείο: `src/config/admin-tool-definitions.ts`. Customer pipeline δεν αλλάζει. | Claude Code |
| 2026-02-10 | **UC-011 Expansion: Multi-Project Search + Gantt Detection** — `get_project_status` tool: `projectName` γίνεται nullable + νέο `searchCriteria` param. UC-011 τρία modes: single (ένα έργο), list (όλα), search (με κριτήρια). Batch enrichment: units + buildings + construction_phases → unit stats + building count + `hasGantt`. Κριτήρια: gantt/χρονοδιάγραμμα, status (σε εξέλιξη/ολοκληρωμένο), κτήρια, units. Fixes: "Ποια έργα έχουν gantt;" τώρα δουλεύει. | Claude Code |
| 2026-02-10 | **UC-011 Bottom-Up Discovery (Google approach)** — Πλήρης αναδόμηση `enrichProjectDetails()`. Πρόβλημα: buildings.companyId + units.companyId είναι OPTIONAL → queries by companyId επέστρεφαν κενά. Λύση: Bottom-up discovery χρησιμοποιώντας ΜΟΝΟ required fields: Buildings by `projectId` (required), Units by `buildingId` (required), Phases by `buildingId` (required). Νέο: `GanttBuildingDetail` type — η απάντηση δείχνει Gantt ανά κτίριο μέσα σε κάθε έργο (ιεραρχική εμφάνιση). Diagnostic logging σε κάθε step. | Claude Code |
| 2026-02-10 | **ADR-171: Autonomous AI Agent** — Αντικατάσταση hardcoded UC module routing με agentic tool calling. Ο admin path πλέον χρησιμοποιεί `executeAgenticPath()` αντί individual UC modules. 8 generic tools (firestore_query, get_document, count, write, send_email, send_telegram, get_schema, search_text), agentic loop (max 5 iterations), chat history (24h TTL). UC-010~016 παραμένουν ως legacy για customer path. Βλ. ADR-171 για πλήρη τεκμηρίωση. | Claude Code |
| 2026-02-11 | **Multi-Channel Super Admin Detection** — Επέκταση admin αναγνώρισης σε WhatsApp, Messenger, Instagram. Νέες συναρτήσεις: `isSuperAdminWhatsApp()`, `isSuperAdminMessenger()`, `isSuperAdminInstagram()` στο `super-admin-resolver.ts`. Όλα τα Meta channel adapters (WhatsApp, Messenger, Instagram) ενσωματώνουν admin detection block (ίδιο pattern με Telegram). Types: `SuperAdminMessengerIdentity`, `SuperAdminInstagramIdentity`, `AdminResolvedVia` +messenger_psid +instagram_igsid. Firestore registry ενημερώθηκε: Γιώργος PSID=25577455211956767. | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
