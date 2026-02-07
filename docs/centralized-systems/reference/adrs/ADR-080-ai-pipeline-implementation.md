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
- Email confirmation in acknowledge step

---

## 10. Changelog

| Ημερομηνία | Αλλαγή |
|------------|--------|
| 2026-02-07 | Phase 1 — Core Infrastructure implemented (types, schemas, config, 5 services, email adapter, integration bridge) |
| 2026-02-07 | Pipeline Worker + Cron endpoint implemented |
| 2026-02-07 | UC-009 Operator Inbox MVP — backend (queue queries, approval service, resume logic) + frontend (page, client, review card) |
| 2026-02-07 | UC-001 Appointment Module MVP — first UC module, module registration bootstrap, end-to-end pipeline flow |
