# ADR-352: FileRecord Query Ordering & Wipe Completeness

**Status:** ✅ APPROVED & IMPLEMENTED
**Date:** 2026-05-15
**Domain:** Files / Floorplans
**Touched files:** `src/services/file-record.service.ts`, `src/services/floorplan-background/floorplan-floor-wipe.service.ts`

---

## Context

The `files` collection is the SSoT for every uploaded file metadata
(ADR-292). The query helper `FileRecordService.getFilesByEntity()` is the
canonical read path used by `FloorFloorplanService.loadFloorplan()` and other
"give me the file for this entity" consumers.

`FloorplanFloorWipeService.wipeAllForFloor()` is the canonical pre-flight
clean step run by the floorplan upload Wizard to guarantee one floorplan per
floor with no orphans.

### Incident — 2026-05-15

A property page on production (Netcup) requested a DXF scene via
`/api/floorplans/scene?fileId=file_0a506eea-…`, which returned **404 Not
Found** even though the property's floor (`flr_7c3d66c4-…`) had a working
DXF visible in the DXF Viewer subapp itself.

Root cause analysis revealed two independent bugs that combined to surface
the failure:

#### Bug 1 — `getFilesByEntity` returned the wrong record

`getFilesByEntity()` (`file-record.service.ts:325`) had **no `orderBy`** in
its constraints. When the `files` collection contained multiple active
records for the same `(entityType, entityId)` — e.g. an upload that left
behind a partially-cleaned predecessor — Firestore returned them in
document-ID (UUID) order. `FloorFloorplanService.loadFloorplan` then
picked `fileRecords[0]`, which is the lexicographically smallest UUID, not
the most recently created file. Result: stale records won over fresh ones.

For the 2026-05-15 incident the floor had two active records:

| fileId | createdAt | originalFilename | Storage binary |
|--------|-----------|-------------------|----------------|
| `file_0a506eea-…` | 10:44 | `_AfrPolGO.dxf` | ❌ missing |
| `file_433265b9-…` | 11:07 | `_AfrPolGD.dxf` | ✅ present |

UUID order picked `0a506eea` first → property page asked for a file with
no `.scene.json` in Storage → 404.

#### Bug 2 — `wipe-floor` left orphan FileRecords

`FloorplanFloorWipeService.executeWipe()` collected fileIds to delete via
`collectFileIds(backgrounds, dxfLevels)` — i.e. **only files referenced
from a `floorplan_backgrounds` doc or a `dxf_viewer_levels` doc**. If a
FileRecord was created (status `pending` → `ready`) but the subsequent
`floorplan_backgrounds` / `dxf_viewer_levels` link was never written (upload
aborted, race with a parallel wipe, partial wizard exit), the FileRecord
became invisible to the wipe. On the next wipe it was orphaned in
Firestore — the Storage binary was already swept by `sweepFloorCategoryPath`,
but the Firestore row survived, ready to mislead the next read.

`file_0a506eea-…` was such an orphan: its Storage binary had been swept by
a wipe at 10:42, but the FileRecord itself was left behind. When the user
loaded the property page hours later, `getFilesByEntity` happily returned
it.

---

## Decision

### Fix 1 — Sort `getFilesByEntity` by `createdAt` DESC

Add a client-side sort to `getFilesByEntity` so callers always receive
the most recently created record first:

```typescript
validRecords.sort((a, b) => {
  const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bMs - aMs;
});
```

**Why client-side, not `orderBy`:** the query has 6 optional `where` clauses
(`domain`, `category`, `purpose`, `levelFloorId`, `isDeleted`,
`lifecycleState`) plus the 3 mandatory ones (`entityType`, `entityId`,
`status`). Adding `orderBy('createdAt')` would require a new composite
index for **each combination** (2⁶ = 64 indexes). Client-side sort is free,
correct, and the worst-case page size (one entity's files) is in the
single-digit hundreds — well below the threshold where sort cost matters.
**Trade-off accepted, ADR-214 compatible.**

### Fix 2 — Wipe ALL FileRecords for the floor, not just referenced ones

Add `listAllFloorFileRows(db, companyId, floorId)` that queries the `files`
collection directly:

```typescript
db.collection(COLLECTIONS.FILES)
  .where('companyId', '==', companyId)
  .where('entityType', '==', 'floor')
  .where('entityId', '==', floorId)
  .get();
```

Union the result with the referenced rows from `collectFileIds`. Apply the
same union in `preview()` so the UI confirm dialog count matches what
`executeWipe` actually deletes.

**Why a direct query, not "trust the references":** the wipe must be the
**single source of truth** for clean-floor state. Anything dependent on
"was this file referenced?" leaks orphans whenever the upload Wizard or any
future writer fails between the FileRecord create step and the link step.
The query uses the existing `(companyId, entityType, entityId)` composite
index (already present in `firestore.indexes.json`) — no new index needed.

### Fix 3 — Upload rollback (deferred)

A third class of bug exists upstream: how a FileRecord ends up `status:
ready` while its Storage binary is missing. The 2026-05-15 incident
suggests a race between an upload finalize and a parallel wipe, but root
cause is not yet confirmed. Fix 1 + Fix 2 already neutralize the symptom
(stale records get sorted out + orphans get cleaned on next wipe), so
upload rollback is **deferred** pending a focused investigation of the
upload-orchestrator gateway and the wipe-floor race window.

---

## Rationale

1. **Sort-on-read beats orderBy.** Composite-index bloat for an optional
   `orderBy` is operationally costly (deploy + backfill per combination) and
   has no benefit for the data sizes we deal with (files-per-entity is
   bounded by floor count × file-categories × generations, well under 1k).
2. **Wipe-as-SSoT beats reference-tracking.** Garbage collection that
   relies on parent references leaks the moment a parent write fails. Direct
   collection-scan with tenant + entity filters is cheap, idempotent, and
   provably complete.
3. **Symptom-fix before root-cause-fix is acceptable here.** The orphan
   path is one of many possible upload-pipeline failure modes; fixing it
   structurally without first understanding the failure mode would just be
   guessing. Fix 1 + Fix 2 make the *current* failure mode invisible to
   users and reversible (orphans get GC'd on the next wipe). Root cause goes
   in the next ADR cycle.

---

## Operator runbook — emergency orphan cleanup

If a property page reports 404 from `/api/floorplans/scene` despite a DXF
being visible in the DXF Viewer for the same floor:

1. List Firestore `files` for the floor:
   ```bash
   curl -X POST \
     "https://firestore.googleapis.com/v1/projects/pagonis-87766/databases/(default)/documents:runQuery" \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     -H "Content-Type: application/json" \
     -d '{"structuredQuery":{"from":[{"collectionId":"files"}],"where":{"compositeFilter":{"op":"AND","filters":[
       {"fieldFilter":{"field":{"fieldPath":"entityId"},"op":"EQUAL","value":{"stringValue":"<floorId>"}}},
       {"fieldFilter":{"field":{"fieldPath":"entityType"},"op":"EQUAL","value":{"stringValue":"floor"}}}
     ]}}}}'
   ```
2. Cross-check `storagePath` of each active record against
   `gcloud storage ls gs://pagonis-87766.firebasestorage.app/<storagePath>` —
   any record whose binary is missing is an orphan.
3. Soft-delete the orphan via Firestore REST PATCH
   (`isDeleted: true`, `lifecycleState: trash`).
4. Reload the property page — `getFilesByEntity` will now return the next
   valid record (per Fix 1 ordering) and `/api/floorplans/scene` will
   resolve normally.

After ADR-352 lands, this orphan class should auto-resolve at the next
floorplan upload (Fix 2 sweeps them as part of `wipe-floor`).

---

## Related

- **ADR-292** — Floorplan Upload Consolidation Map
- **ADR-340** — Phase 4 reborn (floor wipe service)
- **ADR-214** — Firestore Query Centralization (client-side sort policy)
- **ADR-351** — Firebase Storage CORS Policy (the *other* 2026-05-15
  incident, unrelated root cause but same property page)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-15 | **ADR created. Fix 1 + Fix 2 implemented.** Manually cleaned orphan `file_0a506eea-a8b1-4f55-9566-1a820b242599` (soft-delete via Firestore REST API) to restore the affected property page immediately. Fix 3 (upload rollback) deferred pending root-cause investigation. |
