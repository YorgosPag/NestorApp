# ADR-288: CAD File Metadata Centralization

**Status**: Accepted
**Date**: 2026-04-05
**Related**: ADR-031 (File Storage Consolidation), ADR-238 (Entity Creation Centralization), ADR-285 (DXF Tenant Scoping), ADR-286 (DXF Level Creation Centralization)

## Context

The `cadFiles` collection holds metadata records for every persisted DXF scene
(file identity, storage path, size, entity count, checksum, security-validation
snapshot, version, tenant scoping). Scene bytes live in Firebase Storage; the
Firestore doc is metadata-only and is the primary read surface for every DXF
load in the viewer.

Until now, **every write to `cadFiles` happened directly from the browser**
(`dxf-firestore-storage.impl.ts` called `setDoc(doc(db, 'cadFiles', fileId), …)`
and then dual-wrote an enterprise FileRecord to the `files` collection using
the client SDK). That flow bypassed every SSOT guarantee we built for other
entities (ADR-238 / ADR-286):

- No audit trail. `logAuditEvent` never ran for cadFiles writes.
- Tenant isolation relied on the *client* remembering to inject `companyId`
  / `createdBy` into the payload. ADR-285 documents the Sentry incident
  (NESTOR-APP-3) where this was forgotten and cross-user reads broke.
- No rate limiting. Rapid auto-save bursts wrote directly to Firestore from
  untrusted clients.
- No validation. The shape of the doc depended entirely on what the browser
  chose to send.
- The dual-write to `files` ran with client-side credentials, increasing
  blast radius for ADR-031 consolidation bugs.

Callers affected (browser-side writers): `useAutoSaveSceneManager`, `CADProcessor`,
`BuildingFloorplanService`, the legacy `DxfFirestoreService.autoSave`, and the
one-off migration `004_dxf_legacy_to_storage_migration.ts`.

The write pattern is **upsert with client-supplied fileId** — auto-save calls
the same fileId repeatedly and expects the `version` field to increment. This
differs from the fresh-create pattern in ADR-238 / ADR-286 (where `createEntity()`
generates a new enterprise ID each call) and drove the design choice below.

## Decision

Introduce a centralized server endpoint `/api/cad-files` that owns every
`cadFiles` metadata write. No direct browser → Firestore writes on `cadFiles`
or `files` remain anywhere in the DXF stack.

### Upsert semantics (single POST endpoint)

`POST /api/cad-files` receives `{ fileId, fileName, storageUrl, storagePath,
sizeBytes, entityCount, checksum?, securityValidation?, context? }` and performs
an idempotent upsert:

- If `cadFiles/{fileId}` exists and belongs to the caller's tenant → update
  metadata, increment `version`.
- If the doc does not exist → create it with `version = 1`, set `createdAt`,
  `companyId`, `createdBy` from the server auth context.
- If the doc exists but belongs to another tenant → 403 + audit `access_denied`.

This is a single network round-trip replacing the previous client-side
[read-current-version → setDoc → dual-write] sequence.

### Server-side dual-write to `files`

The client-side `writeToFilesCollection` helper was deleted. Its logic is now
`src/app/api/cad-files/dual-write-to-files.ts`, invoked from the server upsert
handler using the admin SDK. The displayName is still generated via
`buildFileDisplayName` (server-safe fallbacks, ADR-191), preserving identical
FileRecord shape. The dual-write remains **non-blocking** — failures are
logged but do not fail the cadFiles upsert, matching ADR-031's "cadFiles
primary, files fallback" contract.

### Registry entry (documentation only)

`ServerEntityType` gains `'cadFile'` and `ENTITY_REGISTRY` gets a matching
entry (hierarchy `tenant-scoped`, idGenerator `generateFileId`, parentField
`null`, no codeType). The registry entry exists for SSOT documentation; the
handler does **not** route through `createEntity()` because the upsert
semantics (client-supplied ID, version increment on existing docs) do not fit
`createEntity()`'s fresh-create contract.

### Client wrapper

`src/services/cad-file-mutation-gateway.ts` exposes `upsertCadFileWithPolicy`,
`getCadFileMetadata`, `deleteCadFileWithPolicy`. These mirror the ADR-286
`dxf-level-mutation-gateway` conventions and use the enterprise API client
(Bearer token auto-injection, contract-violation detection, retry logic).

### Permissions

- **Read** (`GET`): `dxf:files:view`
- **Write / Delete** (`POST`, `DELETE`): `dxf:files:upload`

Matches the existing permission set (`roles.ts`, `permission-sets.ts`). No new
permissions introduced.

## Implementation

### New files
- `src/app/api/cad-files/route.ts` — GET/POST/DELETE route (thin)
- `src/app/api/cad-files/cad-files.handlers.ts` — upsert / get / delete logic
- `src/app/api/cad-files/cad-files.schemas.ts` — Zod validation
- `src/app/api/cad-files/cad-files.types.ts` — response payload types
- `src/app/api/cad-files/dual-write-to-files.ts` — server-side FileRecord dual-write
- `src/services/cad-file-mutation-gateway.ts` — client gateway

### Modified files
- `src/lib/firestore/entity-creation.types.ts` — added `'cadFile'` to
  `ServerEntityType` + `'generateFileId'` to `EntityIdGeneratorName` + registry entry
- `src/config/domain-constants.ts` — added `API_ROUTES.CAD_FILES.LIST`
- `src/subapps/dxf-viewer/services/dxf-firestore-storage.impl.ts` —
  `saveToStorageImpl` now calls `upsertCadFileWithPolicy` instead of
  `setDoc()`; removed `writeToFilesCollection` helper; dropped imports of
  `db`, `doc`, `setDoc`, `serverTimestamp`, `Timestamp`, `COLLECTIONS`,
  `buildFileDisplayName`
- `src/subapps/dxf-viewer/services/dxf-firestore.service.ts` — legacy
  `autoSave()` delegates to `saveToStorageImpl` (no direct Firestore writes)

## Consequences

### Positive
- Every `cadFiles` write is now audited (`logAuditEvent`), tenant-verified
  server-side, and rate-limited (`withStandardRateLimit`).
- Sentry NESTOR-APP-3 class of bugs (missing `companyId`/`createdBy`) is
  eliminated — the server always derives these from `AuthContext`.
- The dual-write to `files` runs with service-account credentials (admin SDK)
  instead of user credentials, tightening ADR-031's consolidation path.
- Browser-side code shrinks: `dxf-firestore-storage.impl.ts` lost ~130 lines
  of Firestore write logic; the facade no longer imports `doc`/`setDoc`.
- The client supplies the enterprise fileId (already standard via
  `generateFileId`), so no changes required for the wizard / FileRecord reuse
  flows that depend on cadFiles and `files` sharing the same document ID.

### Trade-offs
- One extra HTTP hop per save (auto-save, wizard upload, migration). In
  practice the debounce window (`STORAGE_TIMING.SCENE_AUTOSAVE_DEBOUNCE`)
  absorbs this; the previous 2 Firestore writes become 1 HTTP call.
- `createEntity('cadFile', …)` is *callable* via the registry but
  intentionally not used by the handler (upsert semantics). Documented in
  the registry entry comment to avoid confusion.

### Known follow-up (out of scope here)
- `BuildingFloorplanService.generateFileId(buildingId, type)` still produces
  deterministic legacy IDs (`building_floorplan_{id}_{type}`) that violate
  the enterprise ID policy (SOS N.6). The upsert endpoint accepts them (by
  design — tenant isolation is enforced on the doc), but this should be
  migrated to proper enterprise IDs in a later ADR.

## Files Changed
10 files — 1 new ADR, 6 new source files, 3 modified source files, +1 trivial
config update.

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** | **Hub** | Full upload architecture map — all 6 paths, service diagram, consolidation roadmap |
| **[ADR-285](./ADR-285-dxf-tenant-scoping-and-module-split.md)** | Upstream | Tenant scoping — identified the client-side write problem this ADR solves server-side |
| **[ADR-240](./ADR-240-floorplan-pipeline-unification.md)** | Upstream | Pipeline unification — identified dual-write as root cause of visibility bugs |
| **[ADR-191](./ADR-191-enterprise-document-management.md)** | Upstream | FileRecord model — dual-write target collection defined by this model |
| **[ADR-202](./ADR-202-floorplan-save-orchestrator.md)** | Sibling | Save orchestrator — parallel canonical save path that also writes to `files` |
| **[ADR-293](./ADR-293-file-naming-storage-path-ssot-audit.md)** | Audit | Naming/path SSoT audit — violation #7: dual-write legacy fallback documented as transitional |
