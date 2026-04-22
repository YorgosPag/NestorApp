# ADR-029: Global Search System v1

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Revision** | 2026-04-22 |
| **Category** | Search / Indexing / Cloud Functions |
| **Canonical SSoT** | `src/config/search-index-config.ts` |
| **Cloud Functions Mirror** | `functions/src/search/search-config.mirror.ts` |
| **Sync Enforcement** | `scripts/check-search-config-sync.js` (`npm run search-config:sync`) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Summary

Global Search is a tenant-isolated, Greek-normalized search over a unified
`search_documents` Firestore collection. Documents are keyed by
`{entityType}_{entityId}` and indexed across 10 entity types: project,
building, property, contact, file, parking, storage, opportunity,
communication, task.

The indexing pipeline is **reactive** — Firestore write triggers own the
index. Main-app API surfaces are search-read-only.

---

## 2. Architecture

```
   ┌───────────────────────┐
   │   Entity writes       │
   │   (create/update/     │
   │    delete/softDelete) │
   └──────────┬────────────┘
              │
              ▼
   ┌───────────────────────┐       ┌───────────────────────────────┐
   │  Firestore collections│       │  search_documents             │
   │  projects/ buildings/ │──────►│  one doc per indexed entity   │
   │  properties/ contacts/│       │  docId = {type}_{entityId}    │
   │  files/ parking_spots/│       │  tenantId, search{…}, links{} │
   │  storage_units/       │       └───────────────────────────────┘
   │  opportunities/       │                   ▲
   │  communications/      │                   │
   │  tasks/               │                   │
   └──────────┬────────────┘                   │
              │                                │
              ▼                                │
   ┌───────────────────────┐                   │
   │  Cloud Function       │                   │
   │  onXxxWrite triggers  │  buildSearchDoc() │
   │  (functions/src/      │───────────────────┘
   │   search/*)           │
   └───────────────────────┘
```

Reads: `GET /api/search?q=…` queries `search_documents` using prefix
array-contains on Greek-normalized text (Greek accent folding in
`normalizeSearchText`). Tenant isolation via `tenantId == companyId`
claim; audience gate via `requiredPermission` claim.

---

## 3. Decision — Single Writer via Firestore Triggers

### Why

Prior to 2026-04-22 the indexer was a **dual writer**: Cloud Function
triggers (project + contact only) plus client-side fire-and-forget
`POST /api/search/reindex` calls across 14 mutation sites. Two problems
were latent:

1. **Config drift**: `src/config/search-index-config.ts` (main app SSoT)
   and `functions/src/search/indexBuilder.ts` (Cloud Function config)
   diverged on entity set, title fallbacks, and collection names. A
   legal-entity contact "ALFA" was indexed with `title: "Unknown"`
   because the Cloud Function titleField lacked the `companyName`
   fallback the main-app config already had.
2. **Permission race**: the client fire-and-forget required
   `search:global:execute`, silently failing for users without the grant.

### Fix

- Cloud Function triggers become the **single writer** of `search_documents`
  per entity type (10 triggers, one per indexed collection).
- Search config is a hand-maintained **mirror pair**:
  - `src/config/search-index-config.ts` — canonical SSoT
  - `functions/src/search/search-config.mirror.ts` — Cloud Function copy
- A pre-merge sync check (`scripts/check-search-config-sync.js`) guards
  against drift.

Client-side fire-and-forget reindex calls are kept as redundant
belt-and-suspenders until triggers are verified live; scheduled for
removal in a follow-up commit.

---

## 4. Mirror Pair — Allowed Differences

The sync check normalizes these known, by-design differences:

| Difference | Main App | Mirror | Why |
|---|---|---|---|
| `satisfies PermissionId` | yes | no | Cloud Functions has no `PermissionId` type |
| `statsFields: [...]` | yes (parking/storage/opportunity/task) | no | Mirror indexes but never renders stats |
| `COLLECTIONS` import path | `@/config/firestore-collections` | `../config/firestore-collections` | Different build; functions has its own mirror |
| Function parameter syntax (ordering, whitespace) | any | must match after normalization | Cosmetic only |

All other fields — entity keys, collection references, titleField bodies,
subtitleFields, searchableFields, statusField, audience, requiredPermission,
routeTemplate — must match byte-for-byte after normalization.

---

## 5. Entity Coverage (as of 2026-04-22)

| Entity | Main App Config | Mirror Config | Firestore Trigger | Client Reindex |
|---|---|---|---|---|
| project | ✅ | ✅ | `onProjectWrite` | ⚠️ legacy (to remove) |
| building | ✅ | ✅ | `onBuildingWrite` | ⚠️ legacy (to remove) |
| property | ✅ | ✅ | `onPropertyWrite` | ⚠️ legacy (to remove) |
| contact | ✅ (w/ `companyName` + `serviceName` fallback) | ✅ (w/ `companyName` + `serviceName` fallback) | `onContactWrite` | ⚠️ legacy (to remove) |
| file | ✅ | ✅ | `onFileWrite` | n/a |
| parking | ✅ | ✅ | `onParkingWrite` | ⚠️ legacy (to remove) |
| storage | ✅ | ✅ | `onStorageWrite` | ⚠️ legacy (to remove) |
| opportunity | ✅ | ✅ | `onOpportunityWrite` | ⚠️ legacy (to remove) |
| communication | ✅ | ✅ | `onCommunicationWrite` | ⚠️ legacy (to remove) |
| task | ✅ | ✅ | `onTaskWrite` | n/a |

---

## 6. Soft-Delete Handling (ADR-281 cross-cut)

Triggers treat `isDeleted === true`, presence of `deletedAt`, or
`status === 'deleted'` as a tombstone signal and delete the
corresponding `search_documents` row. Restore flows through the normal
update path — the trigger re-indexes the document when the status
transitions back to a non-deleted value.

---

## 7. Deployment Notes

Whenever the trigger set changes, redeploy the affected functions:

```bash
cd functions && npm run build
firebase deploy --only \
  functions:onProjectWrite,\
  functions:onBuildingWrite,\
  functions:onPropertyWrite,\
  functions:onContactWrite,\
  functions:onFileWrite,\
  functions:onParkingWrite,\
  functions:onStorageWrite,\
  functions:onOpportunityWrite,\
  functions:onCommunicationWrite,\
  functions:onTaskWrite \
  --project pagonis-87766
```

Search indexes are eventually consistent — the trigger fires a few
seconds after the write. Existing docs created before a trigger was
enabled can be back-filled via `POST /api/admin/search-backfill`.

---

## 8. GOL Checklist (post-refactor state)

| # | Question | Answer |
|---|---|---|
| 1 | Proactive or reactive? | Proactive — trigger fires at write time |
| 2 | Race condition? | No — single writer per entity (once client reindex is removed) |
| 3 | Idempotent? | Yes — same `(entityType, entityId)` → same `search_documents` docId |
| 4 | Belt-and-suspenders? | Yes transitionally — client calls kept until trigger verification, then removed |
| 5 | Single Source of Truth? | Yes — SSoT in `src/config/search-index-config.ts`, mirror enforced by `check-search-config-sync.js` |
| 6 | Fire-and-forget or await? | Trigger is native reactive (implicit await); main-app API no longer needs to call reindex |
| 7 | Who owns lifecycle? | Explicit — Cloud Function triggers in `functions/src/search/indexTriggers.ts` |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-22 | Claude (Opus 4.7) | HOTFIX (Phase A): Legal-entity contacts indexed with `title: "Unknown"` because the Cloud Function `indexBuilder.ts` CONTACT titleField lacked the `companyName` fallback present in the main-app SSoT (`src/config/search-index-config.ts`). Reproduced on contact `cont_ba3c…` (ΑΦΜ 040817944, "ALFA"). Fix: add `companyName` + `serviceName` fallbacks to the Cloud Function titleField, and include both fields in `searchableFields`. Pattern now matches main-app config. Full structural SSoT fix (mirror + sync check) tracked as Phase B/C. |
| 2026-04-22 | Claude (Opus 4.7) | PREP (Phase B): `functions/src/config/firestore-collections.ts` gains `PROPERTIES`, `PARKING_SPACES`, `STORAGE`, `OPPORTUNITIES`, `COMMUNICATIONS`, `TASKS` entries so the Cloud Functions mirror can reference the same collection constants as the main-app SSoT. Zero behavior change on its own. |
| 2026-04-22 | Claude (Opus 4.7) | STRUCTURAL (Phase B): Split `functions/src/search/indexBuilder.ts` into (a) `search-config.mirror.ts` holding entity-type constants + `SEARCH_INDEX_CONFIG` map and (b) `indexBuilder.ts` holding builder helpers + wire types. Introduced `makeTrigger(entityType, collection)` factory in `indexTriggers.ts` and enabled 8 new triggers (`onBuildingWrite`, `onPropertyWrite`, `onFileWrite`, `onParkingWrite`, `onStorageWrite`, `onOpportunityWrite`, `onCommunicationWrite`, `onTaskWrite`). Soft-delete tombstones (ADR-281) now remove the corresponding `search_documents` row. `functions/src/index.ts` exports all 10 triggers. `tsc --noEmit` in `functions/` → exit 0. |
| 2026-04-22 | Claude (Opus 4.7) | GUARDRAIL (Phase C): Added `scripts/check-search-config-sync.js` — a hand-maintained SSoT guard that compares the main-app `SEARCH_INDEX_CONFIG` against its Cloud Functions mirror, after normalizing the allowed differences listed in §4. Exposed as `npm run search-config:sync`. Same commit closed the `serviceName` fallback gap in the main-app SSoT (it was only in the Cloud Function Phase A hotfix) and aligned the PROPERTY.audience parameter type in the mirror — both needed for text-for-text sync. |
| 2026-04-22 | Claude (Opus 4.7) | DEPLOY (Phase C.1): 10 Firestore triggers deployed to `pagonis-87766` (8 new: Building/Property/File/Parking/Storage/Opportunity/Communication/Task + 2 updated: Project/Contact). Required `FUNCTIONS_DISCOVERY_TIMEOUT=60` env var due to ~4.6s module load time exceeding the default 10s analyzer timeout. Verified end-to-end via no-op write on contact `cont_ba3c…` → `onContactWrite` fired → `search_documents.contact_cont_ba3c…` updated with `title: "ALFA"` (was `"Unknown"`). Phase A fallback confirmed live. |
| 2026-04-22 | Claude (Opus 4.7) | CLEANUP (Phase D.1 — contacts domain): Removed client-side fire-and-forget reindex calls now that the Cloud Function trigger is the single writer. Deleted 3 `apiClient.post(API_ROUTES.SEARCH_REINDEX, …)` sites (2 in `contacts.service.ts`, 1 in `communications.service.ts`) plus the `indexEntityForSearch(…)` call, along with unused imports. Each removal replaced with a single-line comment referencing the Cloud Function owner, to deter future regressions. `/api/search/reindex` endpoint preserved — still used by admin backfill. |
| 2026-04-22 | Claude (Opus 4.7) | CLEANUP (Phase D.2 — projects domain): Removed 2 `indexEntityForSearch(…)` calls from project mutation handlers (`project-mutations.service.ts` update path, `project-create.handler.ts` create path), plus the associated imports. `onProjectWrite` Cloud Function is now sole writer for `search_documents` rows of project entities. |
| 2026-04-22 | Claude (Opus 4.7) | CLEANUP (Phase D.3 — buildings domain): Removed 2 `indexEntityForSearch(…)` calls from buildings API handlers (`route.ts` create path, `building-update.handler.ts` update path), plus imports. `onBuildingWrite` Cloud Function is now sole writer for building entity search docs. |
| 2026-04-22 | Claude (Opus 4.7) | CLEANUP (Phase D.4 — properties domain): Removed `indexEntityForSearch(…)` call from `properties/create/route.ts` plus imports. `onPropertyWrite` Cloud Function is now sole writer for property entity search docs. |
| 2026-04-22 | Claude (Opus 4.7) | CLEANUP (Phase D.5 — parking domain): Removed 2 `indexEntityForSearch(…)` calls from parking API handlers (`route.ts` create, `[id]/route.ts` update) plus imports. `onParkingWrite` Cloud Function is now sole writer for parking entity search docs. |
| 2026-04-22 | Claude (Opus 4.7) | CLEANUP (Phase D.6 — storages domain): Removed 2 `indexEntityForSearch(…)` calls from storages API handlers (`route.ts` create, `[id]/route.ts` update) plus imports. `onStorageWrite` Cloud Function is now sole writer for storage entity search docs. |
| 2026-04-22 | Claude (Opus 4.7) | CLEANUP (Phase D.7 — ai-pipeline domain): Removed the dynamic-imported `indexContactForSearch(…)` call from `ai-pipeline/tools/handlers/contact-handler.ts`. Contact entities created via the AI pipeline now rely on `onContactWrite` for search indexing, identical to UI-driven creates. |
| 2026-04-22 | Claude (Opus 4.7) | CLEANUP (Phase D.8 — opportunities domain): Removed 2 `indexEntityForSearch(…)` calls plus the direct `SEARCH_DOCUMENTS` delete write from `opportunities-server.service.ts` (create/update/delete paths). `onOpportunityWrite` Cloud Function is now sole writer — its delete branch handles tombstone propagation, eliminating the previous client-owned collection write. |
