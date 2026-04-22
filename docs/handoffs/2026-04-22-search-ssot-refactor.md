# HANDOFF — Search Index SSoT Refactor (ADR-029 hardening)

**Date**: 2026-04-22
**Author**: Claude (Opus 4.7) session precedente + Giorgio
**Priority**: HIGH — production bug + SSoT violation (N.12)
**Estimated scope**: 5–8 files, 2 domains (main app + Cloud Functions), redeploy required
**Recommended model**: Opus 4.7 (cross-cutting architecture)
**Recommended flow**: Plan Mode first, then Implementation

---

## 1. Context — How we got here

**Trigger**: CRUD testing phase after DB wipe. Created legal entity contact "ALFA" (ΑΦΜ 040817944, `cont_ba3c483f-a613-4caf-9319-c871364232f0`). Firestore verification showed `search_documents/contact_cont_ba3c...` with `title: "Unknown"` instead of "ALFA". Normalized search text was correct (`"alfa"` + prefixes `["alf","alfa"]`) — only `title` broken.

**Discovery path**:
1. Grep `search_documents` and `indexEntityForSearch` → found dual-writer architecture
2. Main app `src/config/search-index-config.ts` — CORRECT config (has `companyName` fallback)
3. Cloud Function `functions/src/search/indexBuilder.ts` — OUTDATED config (no `companyName` fallback)
4. Both write to same collection → **SSoT violation + race condition**

---

## 2. Root Cause (exact)

**File**: `functions/src/search/indexBuilder.ts:173-187`

```typescript
// BROKEN VERSION (deployed Cloud Function):
[SEARCH_ENTITY_TYPES.CONTACT]: {
  collection: COLLECTIONS.CONTACTS,
  titleField: (doc) => {
    const displayName = doc.displayName as string | undefined;
    const firstName = doc.firstName as string | undefined;
    const lastName = doc.lastName as string | undefined;
    return displayName || `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown';
    // ❌ MISSING: companyName fallback for legal entity contacts (type: "company")
  },
  ...
}
```

**Canonical version** (`src/config/search-index-config.ts:93-108`) includes `companyName` fallback:
```typescript
return displayName || `${firstName || ''} ${lastName || ''}`.trim() || companyName || 'Unknown';
```

**Flow for ALFA**:
1. `ContactsService.createContact()` → `setDoc()` with `companyName: "ALFA"` (client-side) ✅
2. Firestore `onContactWrite` trigger (`functions/src/search/indexTriggers.ts:162-173`) fires → uses outdated config → `title = "Unknown"` ❌
3. Client fires `apiClient.post(API_ROUTES.SEARCH_REINDEX, ...)` fire-and-forget (`src/services/contacts.service.ts:230`) — uses CORRECT config, but requires `search:global:execute` permission. Likely silent fail → "Unknown" persists.

---

## 3. Full Drift Inventory (functions vs main app)

| Drift | `functions/src/search/indexBuilder.ts` | `src/config/search-index-config.ts` |
|-------|---------------------------------------|------------------------------------|
| CONTACT titleField | NO `companyName` fallback | HAS `companyName` fallback |
| Entity types enum | `PROJECT, BUILDING, UNIT, CONTACT, FILE` (5) | `+ PROPERTY (not UNIT), PARKING, STORAGE, OPPORTUNITY, COMMUNICATION, TASK` (11) |
| Property collection | `UNIT` → `COLLECTIONS.UNITS` | `PROPERTY` → `COLLECTIONS.PROPERTIES` |
| Stats fields | Missing | Configured for PARKING, STORAGE, OPPORTUNITY, TASK |
| Communication titleField function | Missing entity entirely | Has `(doc) => subject || type` |

**Deployed triggers** (`indexTriggers.ts`):
- `onProjectWrite` ✅ enabled
- `onContactWrite` ✅ enabled
- `onBuildingWrite` ❌ commented out (line 180)
- `onUnitWrite` ❌ commented out (line 190)
- `onFileWrite` ❌ commented out (line 199)
- No triggers at all for: PROPERTY, PARKING, STORAGE, OPPORTUNITY, COMMUNICATION, TASK

**Dual-writer call sites** (client fire-and-forget `POST /api/search/reindex`):
- `src/services/contacts.service.ts:230` (create), `:378` (update)
- `src/app/api/projects/[projectId]/project-mutations.service.ts:150`
- `src/app/api/projects/list/project-create.handler.ts:235`
- `src/app/api/buildings/route.ts:276`, `building-update.handler.ts:137`
- `src/app/api/properties/create/route.ts:200`
- `src/app/api/parking/route.ts:152`, `[id]/route.ts:159`
- `src/app/api/storages/route.ts:280`, `[id]/route.ts:149`
- `src/services/opportunities-server.service.ts:99`, `:167`, `:202` (direct collection write)
- `src/services/communications.service.ts:170`
- `src/services/ai-pipeline/tools/handlers/contact-handler.ts:262-263`

---

## 4. GOL Checklist (current state)

| # | Question | Current |
|---|----------|---------|
| 1 | Proactive or reactive? | Cloud Function reactive ✅ + API fire-and-forget ⚠️ = **conflicting owners** |
| 2 | Race condition? | **YES** — last-write-wins between trigger + API |
| 3 | Idempotent? | Yes (same docId) |
| 4 | Belt-and-suspenders? | **Broken** — conflicting, not complementary |
| 5 | **Single Source of Truth?** | **❌ NO — two divergent config files** |
| 6 | Fire-and-forget or await? | Client fire-and-forget → silent failure ❌ |
| 7 | Owner lifecycle? | **Unclear** — both systems claim ownership |

**Google-level: ❌ NO** — structural fix required.

---

## 5. Proposed Fix — "Mitigate First, Root Cause Second" (Google SRE)

### PHASE A — MITIGATION (hotfix, ~15 min, NOT done yet)

- [ ] Add `companyName` fallback in `functions/src/search/indexBuilder.ts:175-180`:
  ```typescript
  titleField: (doc) => {
    const displayName = doc.displayName as string | undefined;
    const firstName = doc.firstName as string | undefined;
    const lastName = doc.lastName as string | undefined;
    const companyName = doc.companyName as string | undefined;
    return displayName || `${firstName || ''} ${lastName || ''}`.trim() || companyName || 'Unknown';
  },
  ```
- [ ] Build functions: `cd functions && npm run build`
- [ ] Redeploy single trigger: `firebase deploy --only functions:onContactWrite --project pagonis-87766`
- [ ] Manual reindex existing contacts via `/api/admin/search-backfill` (contact ALFA)
- [ ] Verify in Firestore: `search_documents/contact_cont_ba3c...` → `title: "ALFA"`
- [ ] Commit atomic: `hotfix(search): contact title companyName fallback`
- [ ] ADR-029 changelog entry (incident + mitigation timeline)

### PHASE B — STRUCTURAL SSoT (root cause, sessione dedicata)

**Chosen strategy: CODEGEN (option 6b)** — pragmatic Google pattern (protobuf/Bazel-style).

- [ ] Refactor `src/config/search-index-config.ts`:
  - Extract entity configs to pure-data JSON-serializable form (no TS functions initially)
  - Titlefield functions: extract into named exported helpers (so codegen can reference by key)
- [ ] Create `scripts/generate-search-config.ts`:
  - Reads `src/config/search-index-config.ts` (AST or direct import at build time)
  - Emits `functions/src/search/indexBuilder.config.ts` (generated, checked in)
  - Header comment: "AUTO-GENERATED — DO NOT EDIT. Source: src/config/search-index-config.ts"
- [ ] Update `functions/src/search/indexBuilder.ts` to import config from generated file
- [ ] Pre-commit check: `scripts/check-search-config-sync.ts`:
  - Re-run generator in-memory
  - Diff against checked-in generated file
  - Fail commit if drift
- [ ] Register in `.ssot-registry.json` as module `search-index-config` (Tier 3):
  - `forbiddenPatterns`: ad-hoc config duplication outside canonical file
  - Link to codegen enforcement
- [ ] Enable missing Cloud Function triggers:
  - `onBuildingWrite`, `onPropertyWrite`, `onFileWrite`, `onParkingWrite`, `onStorageWrite`, `onOpportunityWrite`, `onCommunicationWrite`, `onTaskWrite`
  - Note: Opportunity already writes directly in `opportunities-server.service.ts:202` — remove that once trigger is active
- [ ] Remove client fire-and-forget reindex calls (list in §3):
  - Cloud Function becomes unique owner
  - API `/api/search/reindex` kept only for admin backfill/reindex
  - Double-check: no silent regressions in existing search functionality
- [ ] ADR-029 full update:
  - Architecture diagram: Cloud Function as SSoT owner
  - Codegen flow documented
  - Removed deprecated dual-writer
  - Changelog entries for Phase A + Phase B
- [ ] Redeploy all affected Cloud Functions

### PHASE C — PREVENTION (permanent guardrails)

- [ ] Add `.ssot-registry.json` entry to block new config duplicates
- [ ] Pre-commit hook: block hand-edit to generated file (`functions/src/search/indexBuilder.config.ts`)
- [ ] Test: create contact with each type (individual/company/service) + verify title correct
- [ ] Unit tests for `buildSearchDocument()` covering all entity types + fallback chains

---

## 6. Constraints (CLAUDE.md)

- ⚠️ **N.(-1)**: NO git push without explicit order
- ⚠️ **N.0.1**: ADR-driven workflow (4 phases) — Plan → Implementation → ADR Update → Commit
- ⚠️ **N.7.1**: Function <40 lines, file <500 lines
- ⚠️ **N.12**: SSoT registry update mandatory when centralizing a module
- ⚠️ **N.10**: ai-pipeline touched (`contact-handler.ts`) → run `npm run test:ai-pipeline:all`
- ⚠️ **N.11**: NO hardcoded strings in `.ts/.tsx` — `"Unknown"` is a special fallback constant, but should be considered (i18n key or enum)

---

## 7. Files to touch (checklist)

### Main app
- [ ] `src/config/search-index-config.ts` — refactor to codegen-friendly
- [ ] `src/services/contacts.service.ts` — remove lines 230, 378 (client reindex)
- [ ] `src/services/communications.service.ts` — remove line 170
- [ ] `src/services/opportunities-server.service.ts` — remove lines 99, 167, 202
- [ ] `src/app/api/projects/[projectId]/project-mutations.service.ts` — remove line 150
- [ ] `src/app/api/projects/list/project-create.handler.ts` — remove line 235
- [ ] `src/app/api/buildings/route.ts` — remove line 276
- [ ] `src/app/api/buildings/building-update.handler.ts` — remove line 137
- [ ] `src/app/api/properties/create/route.ts` — remove line 200
- [ ] `src/app/api/parking/route.ts` + `[id]/route.ts` — remove reindex calls
- [ ] `src/app/api/storages/route.ts` + `[id]/route.ts` — remove reindex calls
- [ ] `src/services/ai-pipeline/tools/handlers/contact-handler.ts:262-263` — remove reindex

### Cloud Functions
- [ ] `functions/src/search/indexBuilder.ts` — Phase A hotfix + Phase B codegen consumer
- [ ] `functions/src/search/indexTriggers.ts` — enable all commented triggers
- [ ] `functions/src/search/indexBuilder.config.ts` — NEW, auto-generated
- [ ] `functions/src/index.ts` — export new triggers

### Tooling
- [ ] `scripts/generate-search-config.ts` — NEW codegen
- [ ] `scripts/check-search-config-sync.ts` — NEW pre-commit check
- [ ] `.ssot-registry.json` — add module `search-index-config`
- [ ] `.husky/pre-commit` or `scripts/check-ssot.mjs` — wire up sync check

### Docs
- [ ] `docs/centralized-systems/reference/adrs/ADR-029-global-search-system-v1.md` — full rewrite
- [ ] `CLAUDE.md` or `.claude-rules/` — note new SSoT module if needed

### Memory (post-merge)
- [ ] Save feedback memory: "search-index-config is codegen SSoT, functions auto-generated from src/"

---

## 8. Current DB state (for validation)

- 1 contact in Firestore: `cont_ba3c483f-a613-4caf-9319-c871364232f0` (ALFA, company, ΑΦΜ 040817944)
- 1 broken search_document: `contact_cont_ba3c483f-...` with `title: "Unknown"` (should be "ALFA")
- Tenant: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` (Pagonis TEK)
- 2 entity_audit_trail entries (contact created via CDC + tenant company created)
- After Phase A: manual backfill must fix ALFA title

## 9. Pending fixes from previous session (NOT YET COMMITTED)

These are orthogonal to search refactor but must NOT be lost:

**Fix 1** — Duplicate audit on project soft-delete
- `src/app/api/projects/[projectId]/project-mutations.service.ts`
- Removed duplicate `EntityAuditService.recordChange({action:'deleted'})` (was called after engine softDelete which already audits)
- Root cause: violates SSoT ADR-281 + semantic split `soft_deleted` vs `deleted`

**Fix 2** — Projects trash UI ghost details panel after restore
- `src/hooks/useProjectsTrashState.ts` — new prop `setSelectedProject`, clears on `handleToggleTrash` + `handleTrashActionComplete`
- `src/components/projects/projects-page-content.tsx` — passes `setSelectedProject`
- Pattern replicated from `usePropertiesTrashState`

Both fixes have TSC exit 0. ADR-281 changelog updated with 2 entries (2026-04-22).

**Decision for next session**: commit these 2 fixes BEFORE starting search refactor (separate atomic commit), to keep diff scoped.

---

## 10. Testing plan (next session)

**Phase A validation** (post-hotfix):
1. Create contact type=individual (firstName + lastName only) → title = "First Last" ✅
2. Create contact type=company (companyName only) → title = "companyName" ✅
3. Create contact type=service (serviceName only) → title check (current: "Unknown" — may need service fallback!)
4. Verify ALFA after backfill → title = "ALFA"

**Phase B validation** (post-codegen):
1. Modify `src/config/search-index-config.ts` → run codegen → verify `functions/.../indexBuilder.config.ts` regenerated
2. Hand-edit generated file → pre-commit hook blocks ✅
3. Create entity of each type → verify search_documents indexed correctly
4. Soft-delete entity → verify search_document removed
5. `npm run test:ai-pipeline:all` → all 62 suites pass
6. `npm run ssot:audit` → no new violations
7. `npx tsc --noEmit` → exit 0

---

## 11. First steps for next session

```
1. Read this handoff fully
2. Read CLAUDE.md N.0.1 ADR-Driven Workflow
3. Enter Plan Mode
4. Phase 1 (Recognition):
   - Re-grep all reindex call sites to verify no new ones since handoff
   - Read ADR-029 current state
   - Read firestore-collections.ts to confirm COLLECTIONS constants
5. Propose detailed plan with Phase A / B / C breakdown
6. Wait for Giorgio approval before code edits
```

**Note**: Giorgio has NOT approved orchestrator (~2.5-3.5x token cost). Start with Plan Mode.

---

## 12. Success criteria

- [ ] ALFA search_document title = "ALFA" in production
- [ ] Zero config drift between main app and Cloud Functions (enforced by codegen + pre-commit)
- [ ] Single SSoT owner for search indexing (Cloud Function via codegen)
- [ ] All entity types have working Firestore triggers
- [ ] No client fire-and-forget reindex calls in mutation paths
- [ ] ADR-029 reflects final architecture
- [ ] `.ssot-registry.json` guards against future drift
- [ ] `npm run test:ssot-suite` passes (101 tests)
- [ ] Google-level checklist: ✅ YES in ADR-029 changelog
