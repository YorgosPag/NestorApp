# ADR-285: DXF Levels + cadFiles Tenant Scoping & Module Split

**Status**: Accepted
**Date**: 2026-04-04
**Related**: Sentry NESTOR-APP-3 (FirebaseError: Missing or insufficient permissions)

## Context

Sentry reported a recurring `FirebaseError: Missing or insufficient permissions` on `/dxf/viewer` (5 occurrences per week, ONGOING). Firestore rules enforce tenant scoping (`companyId == getUserCompanyId()`) on parent documents. Two DXF-viewer write paths were creating documents **without** `companyId`/`createdBy` fields, blocking cross-user reads of their subcollections:

1. `LevelsSystem.addLevel()` — wrote `dxf-overlay-levels/{id}` without tenant fields, so `onSnapshot` on the `items` subcollection failed for other users in the same tenant.
2. `DxfFirestoreService.saveToStorage()` — wrote `cadFiles/{id}` metadata without tenant fields, so cross-user reads of scene metadata failed.

The target files were `LevelsSystem.tsx` (717 lines) and `dxf-firestore.service.ts` (783 lines) — both well over the 500-line pre-commit hook limit, blocking even a one-line fix.

## Decision

Apply the **Two-CL pattern** (Google code-review convention):

- **CL #1 — Refactor (95cd55a3)**: Pure structural split of the two oversized files into focused sub-modules. Zero behavior change. Facade pattern preserves public API.
- **CL #2 — Fix (378d3ea9)**: Apply the actual tenant-scoping fix to the now-editable files. Tiny diff.

Separating structural refactor from semantic change keeps each CL independently reviewable and revertable.

## Implementation

### CL #1: Module split

**`systems/levels/`** (LevelsSystem.tsx: 717 → 415 lines)
- `LevelsSystem.types.ts` — public props + wizard defaults (36 lines)
- `hooks/useLevelSceneLoader.ts` — scene auto-load useEffect + link-on-save (180 lines)
- `hooks/useLevelsFirestoreSync.ts` — `onSnapshot` subscription (94 lines)
- `hooks/useLevelOperations.ts` — 10 mutating level ops (306 lines)
- `LevelsSystem.tsx` — Context + Provider + thin orchestration hook

**`services/`** (dxf-firestore.service.ts: 783 → 398 lines)
- `dxf-firestore.types.ts` — `DxfSaveContext`, `DxfFileMetadata`, `DxfFileRecord` (64 lines, re-exported from the facade)
- `dxf-firestore-logger.ts` — `dxfLogger` + `isExpectedError` classifier (35 lines)
- `dxf-firestore-storage.impl.ts` — `saveToStorage`/`loadFromStorage`/dual-write impls (431 lines)
- `dxf-firestore.service.ts` — `DxfFirestoreService` class as thin facade delegating to impls

All callers (wizard, toolbar, migrations, auto-save manager, floorplan service) remain backward-compatible via type re-exports and unchanged static method signatures.

### CL #2: Tenant scoping fix

1. **`DxfFileMetadata`** gained two nullable fields: `companyId` and `createdBy`.
2. **`saveToStorageImpl`** writes them from `DxfSaveContext` (`null` when absent).
3. **`useAutoSaveSceneManager`** now calls `useAuth()` and merges `user.companyId` / `user.uid` into `DxfSaveContext` as fallbacks — Wizard-supplied values (when present) still win.
4. **`useLevelOperations.addLevel`** calls `useAuth()` and writes `companyId: user?.companyId ?? null, createdBy: user?.uid ?? null` into `newLevelData`.

## Consequences

### Positive
- Sentry NESTOR-APP-3 no longer fires for new `dxf-overlay-levels` / `cadFiles` documents.
- Each split module has a single responsibility, enabling targeted tests and future edits without hitting the 500-line limit.
- Facade pattern keeps the public API stable: zero migration work for existing callers.

### Migration considerations
- **Existing documents** (pre-fix) still lack `companyId`/`createdBy`. They will continue to throw permissions errors for cross-user reads. A one-off backfill migration can be run on `dxf-overlay-levels/*` and `cadFiles/*` if cross-user access on historical data is needed.
- The `createdBy` field on `cadFiles` is captured on every save — a DXF saved by user A and later saved by user B will show B as `createdBy`.

## Files Changed
- 9 files in CL #1 (1429 insertions, 955 deletions)
- 4 files in CL #2 (35 insertions, 2 deletions)
