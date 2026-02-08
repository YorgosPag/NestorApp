# ADR-080: Universal AI Pipeline — Phase 1 Implementation

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-07 |
| **Category** | AI Architecture / Pipeline Infrastructure |
| **Parent** | [ADR-169](./ADR-169-modular-ai-architecture.md) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

Η εφαρμογή είχε ήδη λειτουργικό email pipeline (ADR-070/071):
- Mailgun webhook → `email_ingestion_queue` → AI intent analysis → `messages` collection

Αυτό κάλυπτε τα βήματα **INTAKE + μερικό UNDERSTAND** από το Universal Pipeline (ADR-169). Δεν υπήρχε:
- Framework για LOOKUP → PROPOSE → APPROVE → EXECUTE → ACKNOWLEDGE
- Module registry για pluggable UC modules
- Audit trail pipeline-level
- State machine enforcement

---

## 2. Decision

Υλοποίηση του **Universal AI Pipeline Core Infrastructure** — Phase 1:

### 7-Step Pipeline
```
INTAKE → UNDERSTAND → LOOKUP → PROPOSE → APPROVE → EXECUTE → ACKNOWLEDGE
```

### State Machine
```
RECEIVED → ACKED → UNDERSTOOD → PROPOSED → APPROVED → EXECUTED → AUDITED
                                    ↓            ↓          ↓
                                 REJECTED    MODIFIED    FAILED → DLQ
```

### Modular Architecture
Κάθε UC module υλοποιεί `IUCModule` interface:
- `lookup()` — Φέρνει δεδομένα από Firestore
- `propose()` — Προτείνει ενέργειες
- `execute()` — Εκτελεί εγκεκριμένες ενέργειες
- `acknowledge()` — Στέλνει επιβεβαίωση στον αποστολέα

### Non-Breaking Integration
Το existing email pipeline παραμένει ανέπαφο. Μετά την επιτυχή επεξεργασία email, ο `EmailChannelAdapter` τροφοδοτεί το μήνυμα στο universal pipeline:

```
EXISTING (unchanged):
Mailgun → enqueue → email_ingestion_queue → processInboundEmail → messages

NEW (added after success):
processQueueItem → EmailChannelAdapter.feedToPipeline() → ai_pipeline_queue
```

---

## 3. Implementation

### New Files

| Αρχείο | Σκοπός |
|--------|--------|
| `src/types/ai-pipeline.ts` | Pipeline types, state machine, IUCModule interface |
| `src/schemas/ai-pipeline.ts` | Zod validation schemas |
| `src/config/ai-pipeline-config.ts` | Config (timeouts, thresholds, retries) |
| `src/services/ai-pipeline/pipeline-orchestrator.ts` | 7-step pipeline engine |
| `src/services/ai-pipeline/module-registry.ts` | UC module registration |
| `src/services/ai-pipeline/intent-router.ts` | Intent → module routing |
| `src/services/ai-pipeline/pipeline-queue-service.ts` | Firestore queue service |
| `src/services/ai-pipeline/audit-service.ts` | Audit trail service |
| `src/services/ai-pipeline/channel-adapters/email-channel-adapter.ts` | Email → pipeline bridge |
| `src/services/ai-pipeline/index.ts` | Barrel exports |

### Modified Files

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/config/firestore-collections.ts` | +`AI_PIPELINE_QUEUE`, +`AI_PIPELINE_AUDIT` |
| `src/services/communications/inbound/email-queue-service.ts` | Bridge call after email processing |

### New Firestore Collections

| Collection | Σκοπός | Indexes |
|-----------|--------|---------|
| `ai_pipeline_queue` | Pipeline processing queue | `(status, createdAt)` composite |
| `ai_pipeline_audit` | Audit trail | `(companyId, timestamp)` composite |

---

## 4. Configuration

| Parameter | Default | Configurable |
|-----------|---------|-------------|
| Auto-approve threshold | 90% confidence | ✅ |
| Manual triage threshold | 60% confidence | ✅ |
| Quarantine threshold | 30% confidence | ✅ |
| Max retries | 3 | ✅ |
| Retry delays | 1s, 4s, 16s | ✅ |
| Single AI call timeout | 30s | ✅ |
| Pipeline step timeout | 60s | ✅ |
| Total pipeline timeout | 5 min | ✅ |
| Stale processing threshold | 5 min | ✅ |
| Batch size | 5 | ✅ |
| Max concurrency | 3 | ✅ |

---

## 5. Alternatives Considered

| Εναλλακτική | Γιατί Απορρίφθηκε |
|-------------|-------------------|
| Replace email pipeline | Breaking change, unnecessary — existing pipeline is production-proven |
| Single monolithic handler | Violates modular architecture (ADR-169), doesn't scale |
| Third-party orchestrator (Temporal, Inngest) | Vendor lock-in, added complexity, budget constraints |
| In-memory pipeline (no queue) | No durability, no retry, no audit trail |

---

## 6. Consequences

**Θετικές**:
- Κάθε νέο UC module = 1 class implementing IUCModule → plug and play
- Full audit trail κάθε AI decision
- State machine prevents invalid transitions
- Config-driven — αλλαγή thresholds χωρίς code change
- Non-breaking — existing functionality 100% intact

**Αρνητικές / Κίνδυνοι**:
- Firestore indexes required (mitigated: documented, `firebase deploy`)
- Pipeline adds latency (~2-5s per message) (mitigated: background processing via queue)
- Context object grows per step (mitigated: only essential data stored)

---

## 7. Next Steps

- [x] Deploy Firestore indexes for `ai_pipeline_queue` and `ai_pipeline_audit`
- [x] Build Pipeline Worker (`src/server/ai/workers/ai-pipeline-worker.ts`)
- [x] Build Pipeline Cron endpoint (`src/app/api/cron/ai-pipeline/route.ts`)
- [x] Implement UC-009 (Operator Inbox) for human approval UI
- [x] Deploy Firestore indexes for pipelineState queries (operator inbox)
- [x] Implement first UC module (UC-001 Appointment Request — MVP)
- [ ] Implement UC-002 Invoices module (Phase 2)
- [ ] Add Telegram channel adapter

---

## 8. UC-009 Operator Inbox (Phase 1 MVP)

**Status**: IMPLEMENTED (2026-02-07)

Human review interface for pipeline proposals awaiting approval.

### Backend
| File | Purpose |
|------|---------|
| `src/services/ai-pipeline/pipeline-queue-service.ts` | +3 functions: `getProposedPipelineItems()`, `updateApprovalDecision()`, `getProposedItemStats()` |
| `src/services/ai-pipeline/pipeline-orchestrator.ts` | +`resumeFromApproval()` method — resumes EXECUTE + ACKNOWLEDGE after human approval |
| `src/services/ai-pipeline/operator-inbox-service.ts` | Service: orchestrates approval → resume pipeline → mark completed/failed |
| `src/app/api/admin/operator-inbox/route.ts` | API: GET (list + stats), POST (approve/reject) with `withAuth` |

### Frontend
| File | Purpose |
|------|---------|
| `src/app/admin/operator-inbox/page.tsx` | Server Component with `requireAdminForPage` |
| `src/app/admin/operator-inbox/OperatorInboxClient.tsx` | Client Component: accordion list, dashboard stats, approve/reject |
| `src/components/admin/operator-inbox/ProposalReviewCard.tsx` | Proposal detail card with action buttons |

### Data Flow
```
Pipeline stops at PROPOSED → Item in ai_pipeline_queue (pipelineState: 'proposed')
→ Operator sees in Inbox → Approve/Reject
→ If approved: resumeFromApproval() → EXECUTE → ACKNOWLEDGE → AUDITED
→ If rejected: state → REJECTED, audit recorded
```

---

## 9. UC-001 Appointment Module (MVP)

**Status**: IMPLEMENTED (2026-02-07)

First UC module — proves end-to-end pipeline flow with real data.

### Files
| File | Purpose |
|------|---------|
| `src/types/appointment.ts` | AppointmentDocument type + AppointmentStatus |
| `src/services/ai-pipeline/modules/uc-001-appointment/appointment-module.ts` | IUCModule implementation (lookup, propose, execute, acknowledge) |
| `src/services/ai-pipeline/modules/uc-001-appointment/index.ts` | Barrel export |
| `src/services/ai-pipeline/modules/register-modules.ts` | Bootstrap: registers all UC modules (idempotent) |

### Modified
| File | Change |
|------|--------|
| `src/server/ai/workers/ai-pipeline-worker.ts` | +`registerAllPipelineModules()` before pipeline execution |
| `src/services/ai-pipeline/operator-inbox-service.ts` | +`registerAllPipelineModules()` before resume execution |
| `src/services/ai-pipeline/index.ts` | +exports for AppointmentModule and registerAllPipelineModules |

### Data Flow
```
Email "Θέλω ραντεβού" → AI detects appointment_request intent
→ IntentRouter routes to UC-001
→ LOOKUP: Find contact by email, extract date/time from entities
→ PROPOSE: "Αίτημα ραντεβού από X για Y" (autoApprovable: false)
→ PROPOSED state → Operator Inbox review
→ Operator approves → EXECUTE: Create appointment in Firestore
→ ACKNOWLEDGE: Log (Phase 2: email confirmation)
→ AUDITED
```

### MVP Scope
- Contact lookup by email (server-side Admin SDK)
- Date/time extraction from AI entities
- Appointment record in Firestore `appointments` collection
- Always requires human approval (never auto-approve)

### Phase 2+
- Calendar availability / conflict detection (PRE-001)
- Smart matching scenarios (alternatives)
- Lead creation for unknown senders
- ~~Email confirmation in acknowledge step~~ → **IMPLEMENTED** (2026-02-08)

---

## 10. Production Deployment & Fixes (2026-02-08)

**Status**: OPERATIONAL IN PRODUCTION

Πρώτο end-to-end test στο production (nestor-app.vercel.app) αποκάλυψε 4 κρίσιμα ζητήματα που διορθώθηκαν σε μία session:

### Fix 1: State Machine Retry Bug (`a27b8c1e`)
- **Πρόβλημα**: Τα failed items προσπαθούσαν retry αλλά αποτύγχαναν πάντα
- **Αιτία**: Ο worker δοκίμαζε μετάβαση `FAILED → ACKED` η οποία δεν είναι valid — μόνο `FAILED → RECEIVED` ή `FAILED → DLQ` επιτρέπονται
- **Λύση**: Reset `context.state = PipelineState.RECEIVED` και `context.errors = []` πριν από κάθε retry execution στο `ai-pipeline-worker.ts`
- **Μάθημα**: Τα retried items πρέπει να ξεκινούν clean — η state machine δεν κάνει implicit reset

### Fix 2: API Auth — Session Cookie Fallback (`a61b46b1`)
- **Πρόβλημα**: Operator Inbox API επέστρεφε HTTP 401 στο production
- **Αιτία**: `buildRequestContext()` (auth-context.ts) ψάχνε μόνο Bearer token, αλλά ο browser client στέλνει `credentials: 'include'` (cookies). Στο development υπήρχε bypass
- **Λύση**: Προσθήκη session cookie fallback — αν δεν υπάρχει Bearer token, ελέγχει το `__session` cookie μέσω `auth.verifySessionCookie()`
- **Μάθημα**: API routes πρέπει να υποστηρίζουν ΚΑΙ Bearer token (API clients) ΚΑΙ session cookie (browser clients)

### Fix 3: Firebase IAM Permission
- **Πρόβλημα**: Session cookie sync αποτύγχανε στο Vercel
- **Αιτία**: Missing `serviceusage.serviceUsageConsumer` role στο Firebase service account
- **Λύση**: Προσθήκη ρόλου στο Google Cloud Console → IAM
- **Μάθημα**: Vercel serverless χρειάζεται explicit Service Usage Consumer permission

### Fix 4: Firestore undefined Values (`5c6d6359`)
- **Πρόβλημα**: Και τα 3 test emails αποτύγχαναν με `Cannot use "undefined" as a Firestore value (found in field "projectId")`
- **Αιτία**: `audit-service.ts` έγραφε `projectId: ctx.understanding?.entities.projectId` — αν δεν υπάρχει project στο email, η τιμή γίνεται `undefined`
- **Λύση**: Αντικατάσταση `undefined` → `null` σε όλα τα optional Firestore fields (audit entry + appointment document)
- **Μάθημα**: Firestore δέχεται `null` αλλά ΟΧΙ `undefined`. Κάθε optional field πρέπει `?? null`

### Diagnostic Endpoint
- Προστέθηκε diagnostic section στο `/api/cron/ai-pipeline` response
- Όταν `failed > 0`, δείχνει: id, pipelineState, retryCount, lastError, retryHistory, intakeSubject, intakeSender
- Κρίσιμο εργαλείο για debugging production — χωρίς αλλαγές κώδικα βλέπουμε τι αποτυγχάνει

### Fix 5: OpenAI JSON Schema — `oneOf` Incompatible with Strict Mode
- **Πρόβλημα**: ΟΛΕΣ οι AI ταξινομήσεις επέστρεφαν `unknown` intent με 50% confidence
- **Αιτία**: Η JSON schema χρησιμοποιούσε `oneOf` discriminated union στο root level, το οποίο ο OpenAI ΔΕΝ υποστηρίζει σε `strict: true` mode. Επίσης, `extractedEntities` δεν είχε `required` array και τα optional fields (`eventDate`, `dueDate`) δεν ήταν nullable
- **Αλυσίδα αποτυχίας**: Schema rejection → retry χωρίς schema → unstructured JSON → Zod validation fail → `buildFallbackResult()` → `triage_needed` 0.5 → pipeline mapping `triage_needed` → `UNKNOWN` → UI "unknown 50%"
- **Λύση**: Split σε 2 ξεχωριστά schemas (`AI_MESSAGE_INTENT_SCHEMA` + `AI_DOCUMENT_CLASSIFY_SCHEMA`), select based on `input.kind`, `required` arrays σε κάθε object, nullable types `['string', 'null']` για optional fields, `stripNullValues()` πριν την Zod validation
- **Αρχεία**: `ai-analysis-config.ts` (schema split), `OpenAIAnalysisProvider.ts` (schema selection + null stripping)
- **Μάθημα**: OpenAI strict mode απαιτεί: flat object στο root (ΟΧΙ oneOf), όλα τα properties στο `required`, optional = nullable + in required, `additionalProperties: false` σε κάθε object

### Composite Index
- Προστέθηκε: `ai_pipeline_queue (status ASC, createdAt DESC)` — απαραίτητο για diagnostic queries

### End-to-End Αποτέλεσμα
```
Mailgun webhook ✅
→ email_ingestion_queue ✅ (10 completed)
→ AI analysis (OpenAI gpt-4o-mini) ✅
→ ai_pipeline_queue ✅
→ Pipeline orchestrator ✅
→ Operator Inbox (production) ✅
→ Operator approve/reject ✅
```

---

## 11. Changelog

| Ημερομηνία | Αλλαγή |
|------------|--------|
| 2026-02-07 | Phase 1 — Core Infrastructure implemented (types, schemas, config, 5 services, email adapter, integration bridge) |
| 2026-02-07 | Pipeline Worker + Cron endpoint implemented |
| 2026-02-07 | UC-009 Operator Inbox MVP — backend (queue queries, approval service, resume logic) + frontend (page, client, review card) |
| 2026-02-07 | UC-001 Appointment Module MVP — first UC module, module registration bootstrap, end-to-end pipeline flow |
| 2026-02-08 | Production deployment fixes: state machine retry bug, session cookie auth, IAM permission, Firestore undefined values |
| 2026-02-08 | Diagnostic endpoint added to cron route for production debugging |
| 2026-02-08 | First successful end-to-end test: email → AI → Operator Inbox (production) |
| 2026-02-08 | Fix: ApprovalDecision undefined fields (reason, modifiedActions, approvedBy) → null for Firestore |
| 2026-02-08 | Fix: email-channel-adapter storageUrl undefined → conditional spread |
| 2026-02-08 | Email rendering centralization: SafeHTMLContent + EmailContentWithSignature → shared component |
| 2026-02-08 | Operator Inbox: smart polling (15s auto-refresh) + toast notifications for new items |
| 2026-02-08 | **CRITICAL FIX**: OpenAI JSON schema — `oneOf` incompatible with strict mode → split into 2 schemas (message_intent + document_classify), fix missing `required` arrays, nullable fields. Root cause of all emails returning "unknown" 50% |
| 2026-02-08 | **CRITICAL FIX**: OpenAI Responses API format — `json_schema` wrapper wrong for `/v1/responses` endpoint, spread schema fields directly into `text.format` |
| 2026-02-08 | AI intent classification OPERATIONAL: `property_search` 90% confidence confirmed |
| 2026-02-08 | UC-003 Property Search Module — LOOKUP (parse criteria + query available units) → PROPOSE (matched units + draft reply email) → EXECUTE (log lead inquiry) → ACKNOWLEDGE (Phase 2: email sending) |
| 2026-02-08 | **Shared Utilities Centralization**: `findContactByEmail()` + `ContactMatch` → `shared/contact-lookup.ts`, `sendReplyViaMailgun()` + `MailgunSendResult` → `shared/mailgun-sender.ts`. Eliminates duplication between UC-001 and UC-003 |
| 2026-02-08 | **UC-001 Phase 2: Email Confirmation** — PROPOSE now builds `draftReply` template (Greek). EXECUTE creates appointment + sends confirmation email via centralized Mailgun sender. ACKNOWLEDGE checks delivery status. Email failure is non-fatal (appointment still created) |
| 2026-02-08 | **Navigation restructure**: AI Inbox + Operator Inbox moved from Settings → CRM subItems (enterprise best practice). Operator Inbox link added to navigation |
| 2026-02-08 | **Operator Inbox UX fixes**: `create_appointment` action — Greek labels (not raw English keys), `null` → "Δεν ορίστηκε", `draftReply` with `whitespace-pre-line` wrapping |
| 2026-02-08 | **Availability Check & AI Operator Briefing** (ADR-103): Server-side `checkAvailability()` queries existing appointments for the requested date. PROPOSE includes `operatorBriefing` — internal AI briefing showing calendar conflicts. Operator Inbox shows dedicated Card with visual conflict indicator (blue=OK, red=conflict) |
