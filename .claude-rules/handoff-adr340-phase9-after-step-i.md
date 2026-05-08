# Handoff — ADR-340 Phase 9 (Multi-Kind Floorplan Overlays) — after STEP I (partial)

**Date:** 2026-05-08
**Status:** STEPS A/B/C/D/E/F/G/H/I-partial **DONE** in working tree (NOT committed). STEPS I-follow-up / J / K / L / M **PENDING**.
**Last commit on `main`:** `0942c3f6 feat(read-only-viewer): propertyLabels wired + overlay-polygon-renderer fix`

> ⚠️ All Phase 9 work (STEPS A-I) is in the working tree only. Per CLAUDE.md N.(-1): NO commit / NO push without explicit Giorgio order.

---

## TL;DR for the next agent

Continue ADR-340 Phase 9. Pick up at **STEP I follow-up** (wizard hook + reader hook + caller-side `unitsPerMeter` wiring) OR jump to **STEP K** (SSoT registry) if Giorgio orders. Use **Opus 4.7**.

---

## Read these in this order (Phase 1 Recognition)

1. `.claude-rules/MEMORY.md` (auto-loaded)
2. `.claude-rules/handoff-adr340-phase9-after-step-i.md` (this file)
3. `C:\Users\user\.claude\plans\declarative-snuggling-kay.md` — full plan, approved by Giorgio
4. `docs/centralized-systems/reference/adrs/ADR-340-raster-background-layers-system.md` — read top **9** changelog entries (STEPS A-I)
5. `src/types/floorplan-overlays.ts` — SSoT types
6. `src/components/shared/files/media/overlay-renderer/index.ts` — renderer barrel
7. `src/components/shared/files/media/MeasureToolOverlay.tsx` + `MeasureToolbar.tsx` — STEP H
8. `src/components/shared/files/media/CalibrateScaleDialog.tsx` — STEP I (dialog only)
9. `src/components/shared/files/media/FloorplanGallery.tsx` — measure tool integration + `unitsPerMeter` prop forward
10. `src/features/floorplan-import/FloorplanImportWizard.tsx` — STEP I follow-up integration target
11. `src/features/floorplan-import/components/StepUpload.tsx` — wizard upload step
12. `src/services/floorplan-background/floorplan-scale.service.ts` — STEP D server service (incl. `detectDxfInsUnits`)
13. `src/subapps/dxf-viewer/floorplan-background/stores/floorplanBackgroundStore.ts` — has `floors[floorId].background.scale` field shape

After reading, run sanity checks in background:
- `./node_modules/.bin/tsc --noEmit` (background)
- `npm run ssot:audit` (background)

---

## What's done (STEPS A-I)

### A — Type SSoT (`src/types/floorplan-overlays.ts` ~250 LOC)
Discriminated union `OverlayGeometry` (7 kinds), `OverlayRole` (6 values), `BackgroundScale`, `ROLE_ALLOWED_GEOMETRY` matrix, type guards, validation helpers.

### B — API + write gateway
- `src/app/api/floorplan-overlays/{schemas,types,handlers,route}.ts` — Zod discriminated-union, `validateRoleGeometryConsistency`, audit log, withAuth+rate-limit.
- `src/services/floorplan-overlay-mutation-gateway.ts` — sole client write path.

### C — Firestore rules + indexes + tests
- `firestore.rules` `floorplan_overlays` block: helpers + role↔geometry+linked invariants + D6 immutables; `floorplan_backgrounds` UPDATE rule validates optional `scale`.
- `firestore.indexes.json` +3 composite indexes.
- `tests/firestore-rules/suites/floorplan-overlays.rules.test.ts` 11-case role↔geometry matrix.

### D — Calibration scale + remap dispatch
- `src/services/floorplan-background/floorplan-scale.service.ts` — `setBackgroundScale`/`getBackgroundScale`/`detectDxfInsUnits` ($INSUNITS map).
- `src/app/api/floorplan-backgrounds/[id]/calibrate/route.ts` — POST handler.
- `src/services/floorplan-background/calibration-remap.service.ts` — `remapGeometry` discriminated dispatch (all 7 geometry kinds).

### E — Renderer SSoT split (`src/components/shared/files/media/overlay-renderer/`)
14 per-shape files + dispatch + legacy back-compat shim. `overlay-polygon-renderer.ts` = 1-line re-export.

### F — Read hook + multi-kind hit-test
- `src/hooks/useFloorOverlays.ts` — single subscription, `where('floorId','==',floorId)`, companyId auto-injected.
- `src/components/shared/files/media/overlay-hit-test.ts` — `computeGeometryAABB` + `hitTestGeometry` per-kind dispatch.
- `floorplan-overlay-system.ts` + `floorplan-pdf-overlay-renderer.ts` migrated to delegate.

### G — DXF Viewer subapp tool migration
- `src/subapps/dxf-viewer/hooks/drawing/{overlay-persistence-utils,useOverlayPersistence}.ts` — `entityToGeometry` + persistence hook.
- `src/subapps/dxf-viewer/hooks/drawing/completeEntity.ts` — `persistToOverlays?` opt + STEP 6.
- `src/subapps/dxf-viewer/overlays/overlay-store-mappers.ts` — pure mappers legacy↔SSoT.
- `src/subapps/dxf-viewer/overlays/overlay-store.tsx` — REWRITE: read via `useFloorOverlays(floorId)`, write via gateway. `floorId` from `useLevels()`, `backgroundId` from `useFloorplanBackgroundStore`.
- `src/subapps/dxf-viewer/overlays/types.ts` — cleanup + doc reframe.
- ⚠️ Layering polygons fully wired. Non-polygon `completeEntity` callers do NOT pass `persistToOverlays` yet (deferred — annotation entities remain scene-only until layer panel UX decided).
- ✅ Smoke test 2026-05-08: layering polygon CREATE + UPDATE confirmed via log (`POST /api/floorplan-overlays 200`, `PATCH /api/floorplan-overlays 200`).

### H — FloorplanGallery transient measure tool
- NEW `src/components/shared/files/media/MeasureToolbar.tsx` (~70 LOC) — 3 toggle Ruler/Square/Triangle.
- NEW `src/components/shared/files/media/MeasureToolOverlay.tsx` (~240 LOC) — local-state-only canvas; modes distance/area/angle; ESC clear; reuses `drawMeasurement` SSoT; bundle-isolated.
- NEW `src/components/shared/files/media/FloorplanGalleryZoomControls.tsx` (~100 LOC) — extracted from gallery to free LOC budget.
- EDIT `src/components/shared/files/media/FloorplanGallery.tsx` 495→449 LOC — toolbar in inline header + overlay layer in figure; hit-test disabled in measure mode.
- i18n el+en `floorplan.measure.*` 13 keys (pure Greek).

### I — Calibration UI (PARTIAL)
- NEW `src/components/shared/files/media/CalibrateScaleDialog.tsx` (~297 LOC) — 2-click canvas + distance/unit form + POST. Bundle-isolated, single-purpose calibration writer.
- EDIT `src/components/shared/files/media/floorplan-gallery-config.ts` — added prop `unitsPerMeter?: number | null` to `FloorplanGalleryProps`.
- EDIT `src/components/shared/files/media/FloorplanGallery.tsx` — forward `unitsPerMeter` to `<MeasureToolOverlay>`.
- i18n el+en `floorplan.calibrate.*` 15 keys (pure Greek; ICU single-brace `{count}`).

---

## STEP I follow-up — pending tasks

1. **Wizard hook**: in `src/features/floorplan-import/FloorplanImportWizard.tsx` (or `StepUpload.tsx`), after a PDF/Image upload completes, prompt the user to open `<CalibrateScaleDialog>` with the freshly-uploaded background. For DXF, surface the `detectDxfInsUnits($INSUNITS)` result with an "Override?" option.
2. **Reader hook**: NEW `src/hooks/useBackgroundScale.ts` — given `floorId`, reads the active `floorplan_backgrounds` record and returns `{ unitsPerMeter, sourceUnit, isCalibrated }` (subscribes via `firestoreQueryService` with companyId auto-injection).
3. **Caller wiring**: pass `unitsPerMeter` prop into `<FloorplanGallery>` from:
   - `src/features/read-only-viewer/components/ListLayout.tsx`
   - `src/features/read-only-viewer/components/ReadOnlyMediaSubTabs.tsx`
   - `src/components/shared/files/property/floorplan/...` (FloorPlanTab consumers)
   Use the new `useBackgroundScale(floorId)` hook.
4. **Gallery header affordance**: add a calibration icon (e.g., `<Compass>`) to `FloorplanGallery` header that opens `<CalibrateScaleDialog>` with the currently-displayed raster (PDF page-1 image OR raw image) — only meaningful for `isRaster` files; hidden for DXF (DXF uses auto-detect).

---

## Remaining steps (J → M)

- **J** — i18n full pass: namespace `floorplan-overlays` (`roles.*` × 6 + `geometry.*` × 7) NEW; verification of existing `files-media.*` measure/calibrate keys.
- **K** — SSoT registry: add modules `floorplan-overlay-gateway` (forbid raw `collection('floorplan_overlays')` outside allowlist) and `floorplan-overlay-types` (forbid local re-defs of `FloorplanOverlay`/`OverlayGeometry`); `npm run ssot:baseline`.
- **L** — Cascade cleanup (post-wipe ONLY): remove DXF subcollection arm from `floorplan-cascade-delete.service.ts` and `dxfOverlayCount`/`dxfLevelCount` from `floorplan-floor-wipe.service.ts`. Trigger only on Giorgio's wipe-confirmed signal.
- **M** — Tests + ADR-340 finalize: per-shape renderer tests under `overlay-renderer/__tests__/`, `MeasureToolOverlay` test (assert no `createFloorplanOverlay` import), `overlay-persistence-utils` matrix test, `overlay-hit-test` per-kind test, `CalibrateScaleDialog` POST mock test. Flip ADR-340 Phase 9 status to ✅ **IMPLEMENTED**.

---

## Constraints / pitfalls (recap)

- **N.(-1)**: NO commit / NO push without Giorgio's explicit order.
- **N.7.1**: 500 LOC max per file, 40 LOC max per function (React components are conventionally lax — see existing FloorplanGallery for precedent).
- **N.7.2**: declare ✅/⚠️/❌ Google-level explicitly per step.
- **N.10**: AI pipeline tests required IF you touch `src/services/ai-pipeline/` — verified zero refs in Phase 9 work (skip).
- **N.11**: NO hardcoded `defaultValue: 'literal text'` — only `''`. Pure-Greek el locale.
- **CHECK 3.10** (Firestore companyId): any new `query()` + `where()` MUST include `where('companyId','==',companyId)` — `firestoreQueryService.subscribe`/`getAll` auto-injects via `buildTenantConstraints` default config.
- **Bundle isolation** (gallery): `src/components/shared/files/media/` MUST NOT import from `src/subapps/dxf-viewer/`. Verify with grep before commit.
- **Gateway is sole write path**: STEPS G+ consumers MUST use `floorplan-overlay-mutation-gateway`. No direct Firestore writes.
- **Pure-Greek**: el locale = ZERO English words (per `feedback_pure_greek_locale`).
- **CHECK 3.9**: ICU single-brace `{var}`, NOT `{{var}}`.
- **N.14 model enforcement**: Opus 4.7 is the right model for STEP I follow-up + STEPS K/L/M (cross-cutting). Suggest a model switch only if Giorgio queries.

---

## Suggested commit cadence (per phase, on Giorgio's order)

13 commits total, one per STEP. STEPS A-I-partial together = 9 commits already prepared (working tree only). Per CLAUDE.md ADR-driven workflow Phase 4: code AND ADR update in the SAME commit. Each ADR-340 changelog entry was already written alongside its STEP — they will commit together.

Naming examples:
1. `feat(types): ADR-340 Phase 9.A — multi-kind overlay types SSoT`
2. `feat(api): ADR-340 Phase 9.B — floorplan-overlays API + write gateway`
3. `feat(rules): ADR-340 Phase 9.C — multi-kind overlays rules + indexes + matrix tests`
4. `feat(calibration): ADR-340 Phase 9.D — scale service + remap dispatch`
5. `refactor(renderer): ADR-340 Phase 9.E — overlay-renderer SSoT split per-shape`
6. `feat(read-hook): ADR-340 Phase 9.F — single subscription + multi-kind hit-test`
7. `refactor(dxf-viewer): ADR-340 Phase 9.G — overlay-store + persistence migration`
8. `feat(gallery): ADR-340 Phase 9.H — transient measure tool (distance/area/angle)`
9. `feat(calibration-ui): ADR-340 Phase 9.I — CalibrateScaleDialog + measure-tool prop wiring`

---

## Status check (after STEP I-partial)

- TypeScript: ✅ STEP I files clean. Full `tsc --noEmit` shows only pre-existing unrelated errors (procurement, contacts, building-management/boq, RoleManagement).
- SSoT audit: 33 violations / 36 baseline (8% progress to zero), no new violations from STEPS A-I.
- Tests: rules tests pending emulator run (`npm run test:firestore-rules -- floorplan-overlays`) — deferred to STEP M.
- Visual smoke test:
  - STEP G ✅ confirmed via real-world log: layering polygon CREATE + UPDATE successful via gateway.
  - STEP H ⏳ not yet observed in logs (gallery measure toolbar) — Giorgio still to navigate to `property → floorplan tab`.
  - STEP I ⏳ dialog standalone-functional but no caller opens it yet (deferred to STEP I follow-up integration).

---

## Open observations from log review (2026-05-08)

- API contract warnings on `/api/floorplan-overlays`, `/api/floorplan-backgrounds/[id]`, `/api/companies` — responses do not match the canonical `{ data, ... }` envelope. Soft warning, non-blocking, but worth normalizing during STEP M cleanup.
- `[CoordinateTransforms] screenToWorld: Invalid viewport dimensions { width: 0, height: 0 }` — DXF subapp legacy, NOT STEP H. Pre-existing, not introduced by Phase 9.
- Concurrent `PATCH /api/floorplan-backgrounds/rbg_...` calls observed (transform updates) — possible debounce gap on the floorplan-background panel save flow. Out of scope for Phase 9 but worth flagging.
