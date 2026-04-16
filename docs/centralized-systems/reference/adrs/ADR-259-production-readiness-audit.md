# ADR-259: Production Readiness Audit — 6 Critical Findings

**Status**: RESEARCH COMPLETE — Pending Implementation
**Date**: 2026-03-23
**Author**: Claude Agent + Γιώργος Παγώνης
**Type**: Audit / Security / Cost Protection
**Priority**: CRITICAL

---

## Σύνοψη

Καθολική έρευνα στον κώδικα εντόπισε **6 κρίσιμα προβλήματα** που πρέπει να λυθούν πριν (ή αμέσως μετά) το production deployment. Αυτό το ADR τεκμηριώνει τα ευρήματα, τα ακριβή σημεία στον κώδικα, και το προτεινόμενο action plan.

**Κανένας κώδικας δεν γράφτηκε** — μόνο ευρήματα και αρχιτεκτονικές αποφάσεις.

---

## ΕΥΡΗΜΑ 1: SECURITY — Firestore Rules & Tenant Isolation

### 1.1 Τρέχουσα κατάσταση

**Αρχείο**: `firestore.rules` (3,226 γραμμές)
**Αρχιτεκτονική**: Default DENY-ALL (line 20-22) + explicit allow per collection

**Helper functions** (lines 3080-3225):

| Function | Λειτουργία |
|----------|-----------|
| `isAuthenticated()` | `request.auth != null` |
| `getUserCompanyId()` | `request.auth.token.companyId` |
| `belongsToCompany(companyId)` | Tenant isolation — companyId match |
| `belongsToProjectCompany(projectId)` | Cross-ref project→company |
| `belongsToBuildingCompany(buildingId)` | Cross-ref building→company |
| `isSuperAdminOnly()` | Global role = super_admin |
| `isCompanyAdminOfCompany(companyId)` | super_admin OR (company_admin AND same company) |

### 1.2 Προστατευμένες Collections (27 — companyId filtering ✅)

| Collection | Μέθοδος Isolation | Lines |
|-----------|-------------------|-------|
| projects | `belongsToCompany()` | 37-95 |
| contacts | `belongsToCompany()` | 1369-1425 |
| buildings | `belongsToCompany() / belongsToProjectCompany()` | 547-570 |
| units | `belongsToProjectCompany()` | 613-646 |
| floors | `belongsToBuildingCompany()` | 582-601 |
| contact_relationships | `belongsToCompany()` (ADR-252) | 103-141 |
| contact_links | `belongsToCompany()` (ADR-252) | 151-186 |
| appointments | `belongsToCompany()` | 837-853 |
| communications | `belongsToCompany()` | 1474+ |
| files | `belongsToCompany() / belongsToProjectCompany()` | 361-500 |
| cadFiles | `belongsToCompany() / belongsToProjectCompany()` | 316-359 |
| storage_units | `belongsToBuildingCompany()` | 660+ |
| parking_spots | `belongsToBuildingCompany()` | 691+ |
| attendance_events | `belongsToCompany() + belongsToProjectCompany()` | 196-231 |
| attendance_qr_tokens | `belongsToCompany() + belongsToProjectCompany()` | 240-260 |
| employment_records | `belongsToCompany() + belongsToProjectCompany()` | 269-299 |
| project_floorplans | `belongsToCompany()` | 861-898 |
| building_floorplans | `belongsToCompany()` | 904-937 |
| floor_floorplans | `belongsToCompany()` | 944-979 |
| unit_floorplans | `belongsToCompany()` | 985-1021 |
| dxf_viewer_levels | `belongsToCompany()` | 1028-1061 |
| dxf_overlay_levels | `belongsToCompany()` | 1071-1101 |

### 1.3 Απροστάτευτες Collections (🔴 HIGH RISK)

| Collection | Τρέχον Rule | Κίνδυνος | Lines |
|-----------|------------|---------|-------|
| **notifications** | `isAuthenticated()` μόνο | User βλέπει ΟΛΑ τα notifications | 732-752 |
| **tasks** | `isAuthenticated()` μόνο | User βλέπει ΟΛΑ τα tasks | 770-823 |
| **workspaces** | `isAuthenticated()` μόνο | User βλέπει ΟΛΑ τα workspaces | 1341-1368 |
| **users** | `isAuthenticated()` μόνο | User βλέπει ΟΛΑ τα profiles | 1305-1322 |
| **companies** | `isAuthenticated()` μόνο | User βλέπει ΟΛΑ τα company docs | 502-520 |
| **system** | `isAuthenticated() && isCompanyAdmin()` | Admin βλέπει system settings | 1516-1540 |

### 1.4 Client-side Anti-pattern

**Αρχείο**: `src/services/companies.service.ts` (lines 78-83)

```typescript
const projectsQuery = query(collection(db, PROJECTS_COLLECTION));
const projectsSnapshot = await getDocs(projectsQuery);
// ❌ Χωρίς where('companyId', '==', userCompanyId)
// Firestore rules κάνουν per-doc deny, αλλά ο client κάνει download attempt ΟΛΑ
```

### 1.5 Legacy Fallback Pattern

Πολλές collections έχουν:
```
|| (!resource.data.keys().hasAny(['companyId']) && resource.data.createdBy == request.auth.uid)
```
Documents χωρίς `companyId` → fallback σε `createdBy`. Αν λείπει και αυτό → inaccessible.

### 1.6 Server-side Tenant Isolation (✅ Υπάρχει)

**Αρχείο**: `src/lib/auth/tenant-isolation.ts` (431 γραμμές)

- `requireProjectInTenant()` (lines 80-121)
- `requireBuildingInTenant()` (lines 149-188)
- `requireUnitInTenant()` (lines 225-258)
- `requireStorageInTenant()` (lines 263-296)
- `requireParkingInTenant()` (lines 301-334)
- `requireOpportunityInTenant()` (lines 339-372)
- `filterSnapshotsByTenant()` (lines 396-430)

**Κάλυψη**: API routes → ✅ Προστατευμένα. Client-side queries → ❌ Εξαρτώνται μόνο από Firestore rules.

---

## ΕΥΡΗΜΑ 2: AI Pipeline — End-to-End Flow & Silent Failures

### 2.1 Πλήρης αλυσίδα

```
POST /api/communications/webhooks/telegram
  ↓ withTelegramRateLimit (15 req/min)
  ↓ Secret token validation (X-Telegram-Bot-Api-Secret-Token)
  ↓ Duplicate detection (in-memory Set, 500 max)
  ↓
Contact Recognition (handler.ts:308-355)
  ↓ resolveContactFromTelegram(userId, senderName)
  ↓ 5-min cache → external_identities → heuristic name match
  ↓ Αν αποτύχει → unknown contact (ΟΧΙ error)
  ↓
Contact Linker (contact-linker.ts:174-202)
  ↓ contact_links WHERE sourceContactId + status='active' LIMIT 20
  ↓ Extract linkedUnitIds WHERE targetEntityType='unit'
  ↓ Αν δεν βρει → linkedUnitIds = []
  ↓
Feed to Pipeline
  ↓ AWAIT enqueue σε ai_pipeline_queue
  ↓ ContactMeta WITH linkedUnitIds
  ↓
after() → processAIPipelineBatch()
  ↓ PipelineOrchestrator.execute()
  ↓ Admin → executeAgenticPath() | Customer → legacy UC modules
  ↓
Agentic Loop (agentic-loop.ts)
  ↓ System prompt + chat history + tools
  ↓ Max 15 iterations, 55s timeout
  ↓ enforceRoleAccess() → unit filtering
  ↓
Response → TelegramMessage → CRM storage
```

### 2.2 Σημεία Silent Failure

| # | Σημείο | Τι γίνεται | Κίνδυνος | Αρχείο |
|---|--------|-----------|---------|--------|
| 1 | Contact resolution fails | Συνεχίζει ως unknown | Buyer → generic response | handler.ts:318-320 |
| 2 | linkedUnitIds = [] | enforceRoleAccess denies | Buyer βλέπει ΤΙΠΟΤΑ | agentic-tool-executor.ts:205-215 |
| 3 | FAILED_PRECONDITION | Broad fallback (unfiltered) | Πιθανά λάθος αποτελέσματα | agentic-tool-executor.ts:345-377 |
| 4 | Pipeline enqueue fails | Non-fatal, skip | Μήνυμα χάνεται | handler.ts:496-498 |
| 5 | Firebase unavailable | Skip pipeline | AI δεν απαντάει | handler.ts:360-362 |

### 2.3 SPEC-257 Status

| SPEC | Status | Κρίσιμο αρχείο |
|------|--------|----------------|
| 257A: Unit-Level Contact Links | ✅ Implemented | contact-linker.ts |
| 257B: Unit-Level Scoping | ✅ Implemented | agentic-tool-executor.ts |
| 257C: Payment Visibility | ✅ Implemented | ai-role-access-matrix.ts |
| 257D: Complaint Triage | ✅ Spec exists | — |
| 257E: Append-Only Updates | ✅ Spec exists | — |
| 257F: Photo Delivery | ✅ Spec exists | — |
| 257G: Knowledge Base | ✅ Spec exists | — |

### 2.4 Κρίσιμη Προϋπόθεση

Αν ΔΕΝ υπάρχουν `contact_links` documents με `targetEntityType='unit'` στο Firestore → ο buyer δεν θα βλέπει ΤΙΠΟΤΑ. Χρειάζεται δημιουργία test data ή πραγματικό link μέσω UI.

---

## ΕΥΡΗΜΑ 3: Agentic Loop — Cost & Token Tracking

### 3.1 Τρέχουσα διαμόρφωση

| Παράμετρος | Τιμή | Αρχείο:Line |
|-----------|-------|-------------|
| Model | `gpt-4o-mini` | ai-analysis-config.ts:28 |
| maxIterations | **15** | agentic-loop.ts:108 |
| totalTimeoutMs (prod) | 55,000ms | agentic-loop.ts:109 |
| totalTimeoutMs (dev) | 120,000ms | agentic-loop.ts:109 |
| perCallTimeoutMs | 30,000ms | agentic-loop.ts:110 |
| maxToolResultChars | 12,000 | agentic-loop.ts:111 |

### 3.2 OpenAI Usage Tracking: ❌ ΔΕΝ ΥΠΑΡΧΕΙ

**Σημεία OpenAI calls:**

| # | Αρχείο | API | Captures usage? |
|---|--------|-----|----------------|
| 1 | `agentic-loop.ts:401-468` | Chat Completions (fetch) | ❌ ΟΧΙ |
| 2 | `OpenAIAnalysisProvider.ts:87-115` | Responses API | ❌ ΟΧΙ |

Ο κώδικας κάνει:
```typescript
const data = await response.json();
const message = data.choices?.[0]?.message;
// data.usage ΑΓΝΟΕΙΤΑΙ — ποτέ δεν αποθηκεύεται
```

### 3.3 Τι υπάρχει ήδη

- ✅ Rate limit Telegram: 15 req/min per user (`rate-limit-config.ts:80`)
- ✅ Audit logging: `ai_pipeline_audit` collection
- ✅ Chat history: `ai_chat_history` (20 msgs, 24h TTL)
- ✅ Query strategy memory: `ai_query_strategies` (ADR-173)

### 3.4 Τι λείπει

- ❌ Token count capture per API call
- ❌ Cost calculation (tokens × price)
- ❌ Per-user daily/monthly tracking
- ❌ Daily message cap per customer
- ❌ Auto-cutoff αν ξεπεραστεί όριο
- ❌ Firestore collection `ai_usage` — ΔΕΝ υπάρχει

### 3.5 Κοστολόγηση (gpt-4o-mini)

| Σενάριο | $/message | $/month (100 msg/day) |
|---------|-----------|----------------------|
| Τυπικό (2-3 iterations) | $0.002 | $6 |
| Μέτριο (5 iterations) | $0.003 | $9 |
| Heavy (8 iterations) | $0.005 | $15 |
| Worst (15 iterations) | $0.009 | $27 |
| **Με daily cap 50 msg** | **max $0.45/day** | **max $13.50** |

---

## ΕΥΡΗΜΑ 4: Firestore Indexes — Silent Failures

### 4.1 Υπάρχοντες indexes (`firestore.indexes.json`)

- `searchDocuments`: tenantId + entityType + audience + updatedAt
- `admin_building_templates`: companyId + status + createdAt
- `buildings`: companyId + sourceTemplateId
- `contact_relationships`: 3 composite indexes
- `workspaces`: status + displayName

### 4.2 FAILED_PRECONDITION Handling

**Αρχείο**: `agentic-tool-executor.ts:345-377`

```
FAILED_PRECONDITION detected
  → Broad fallback: db.collection(X).where('companyId', '==', Y).limit(50)
  → Return { success: true, data: results }
  → recordQueryStrategy() logs fallback
```

**Πρόβλημα**: AI δεν ξέρει ότι τα αποτελέσματα είναι unfiltered. Μπορεί να δώσει λάθος απάντηση βασισμένη σε ελλιπή/αταξινόμητα δεδομένα.

### 4.3 Missing indexes

Θα εμφανιστούν ΜΟΝΟ σε runtime. Κάθε FAILED_PRECONDITION στο Firebase console δίνει auto-create link. Χρειάζεται E2E testing.

---

## ΕΥΡΗΜΑ 5: Error Monitoring — Sentry

### 5.1 Κατάσταση: ❌ ΚΑΝΕΝΑ Sentry Integration

- `@sentry/nextjs` — ΔΕΝ υπάρχει
- `captureException()` — ΔΕΝ υπάρχει
- `Sentry.init()` — ΔΕΝ υπάρχει

### 5.2 Τι υπάρχει αντ' αυτού

| Μηχανισμός | Αρχείο | Λειτουργία |
|-----------|--------|------------|
| `createModuleLogger()` | `src/lib/telemetry/Logger.ts` | Console logging per module |
| `ErrorBoundary` | `src/components/ErrorBoundary.tsx` | React error boundary |
| `ErrorTracker` | `src/services/ErrorTracker/` | Client-side reporting |
| `logAuditEvent()` | `tenant-isolation.ts` | Access denial logging |

### 5.3 Πρόβλημα

- ❌ Errors δεν γίνονται aggregate
- ❌ Δεν στέλνονται σε email/Telegram
- ❌ Δεν υπάρχει dashboard
- ❌ AI pipeline errors χάνονται (Vercel logs: 30-day retention)

---

## ΕΥΡΗΜΑ 6: OpenAI Usage Tracking

### 6.1 Τι επιστρέφει ήδη το OpenAI API

```json
{
  "usage": {
    "prompt_tokens": 1500,
    "completion_tokens": 300,
    "total_tokens": 1800
  }
}
```

### 6.2 Τρέχων κώδικας — αγνοεί τελείως

`agentic-loop.ts:401-468` — `callChatCompletions()` διαβάζει μόνο `choices[0].message`. Το `data.usage` δεν αποθηκεύεται πουθενά.

### 6.3 Τι χρειάζεται (Προτεινόμενη αρχιτεκτονική)

1. **Capture usage** από κάθε OpenAI response
2. **Aggregate** per agentic loop execution (πολλά iterations)
3. **Store**: Firestore `ai_usage/{userId}_{YYYY-MM}` → daily counters
4. **Cost calc**: `(prompt_tokens × $0.15/1M) + (completion_tokens × $0.60/1M)`
5. **Daily cap check** πριν pipeline execution
6. **Auto-cutoff**: "Ξεπεράσατε το ημερήσιο όριο μηνυμάτων"

---

## ΚΡΙΣΙΜΑ ΑΡΧΕΙΑ

| Αρχείο | Γραμμές | Ρόλος |
|--------|---------|-------|
| `firestore.rules` | 3,226 | Firestore security rules |
| `firestore.indexes.json` | 100+ | Composite indexes |
| `src/services/ai-pipeline/agentic-loop.ts` | ~700 | Agentic reasoning engine |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | ~2,100 | Tool execution + RBAC |
| `src/config/ai-role-access-matrix.ts` | ~150 | Role permissions matrix |
| `src/services/contact-recognition/contact-linker.ts` | ~275 | Telegram→Contact resolution |
| `src/services/ai-pipeline/pipeline-orchestrator.ts` | ~350 | 7-step pipeline |
| `src/lib/middleware/rate-limit-config.ts` | ~115 | Rate limiting config |
| `src/config/ai-analysis-config.ts` | ~151 | OpenAI model config |
| `src/lib/auth/tenant-isolation.ts` | ~431 | Server-side tenant isolation |
| `src/app/api/communications/webhooks/telegram/handler.ts` | ~734 | Telegram webhook handler |
| `src/config/firestore-collections.ts` | ~175 | Collection names SSoT |

---

## SPEC FILES (Implementation Guides)

| SPEC | Τίτλος | Λύνει Ευρήματα | Εξάρτηση | Priority |
|------|--------|---------------|----------|----------|
| **SPEC-259A** | OpenAI Usage Tracking + Daily Cap + Cost Protection | 3 + 6 | Ανεξάρτητο | CRITICAL |
| **SPEC-259B** | Firestore Security Hardening (6 Collections) | 1 | Ανεξάρτητο | CRITICAL |
| **SPEC-259C** | Silent Failure Recovery + E2E Test Plan | 2 + 4 | Μετά push 4628a57c | HIGH |
| **SPEC-259D** | Error Monitoring Integration | 5 | Ανεξάρτητο | HIGH |

### ΣΕΙΡΑ ΕΚΤΕΛΕΣΗΣ

```
SPEC-259A (Cost Protection) ──┐
                               ├──→ SPEC-259C (E2E Test) ──→ SPEC-259D (Monitoring)
SPEC-259B (Security Rules)  ──┘
```

SPEC-259A και SPEC-259B μπορούν **παράλληλα**. SPEC-259C μετά το push. SPEC-259D ανεξάρτητο.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-23 | Initial audit — 6 findings documented, no code changes |
| 2026-03-23 | 4 SPEC files created (259A, 259B, 259C, 259D) |
