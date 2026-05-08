# Handoff — ADR-340 Phase 9 (Multi-Kind Floorplan Overlays) — after STEP G

**Date:** 2026-05-08
**Status:** STEPS A/B/C/D/E/F/G **DONE**, STEPS H/I/J/K/L/M **PENDING**
**Author of in-flight work:** Opus 4.7 + Giorgio
**Last commit on `main`:** `0942c3f6 feat(read-only-viewer): propertyLabels wired + overlay-polygon-renderer fix`

> ⚠️ **Working tree NOT committed.** All Phase 9 work (STEPS A-G) is in the working tree only. Giorgio decides when to commit (per N.(-1)). NO push without explicit order.

---

## TL;DR for the next agent

Open the plan file: `C:\Users\user\.claude\plans\declarative-snuggling-kay.md`. STEPS A-G done. Pick up at **STEP H** (FloorplanGallery transient client-side measure tool — NEVER writes Firestore). Use Opus 4.7.

If unsure why we're doing this: Giorgio confirmed via Plan-Mode Q&A 4-question flow → schema = single collection multi-kind discriminated union, geometry separate from role, native space + scale calibration on backgrounds, FloorplanGallery viewer-only + transient measure tool. Full data wipe → zero migration cost.

### STEP G summary (just completed)

- **NEW** `src/subapps/dxf-viewer/hooks/drawing/overlay-persistence-utils.ts` (~140 LOC) — pure `entityToGeometry(entity, tool)` mapper.
- **NEW** `src/subapps/dxf-viewer/hooks/drawing/useOverlayPersistence.ts` (~95 LOC) — gateway-wrapping hook.
- **EDIT** `src/subapps/dxf-viewer/hooks/drawing/completeEntity.ts` — added optional `persistToOverlays?` (caller-injected `persist` callback) + STEP 6 fire-and-forget.
- **NEW** `src/subapps/dxf-viewer/overlays/overlay-store-mappers.ts` (~210 LOC) — pure helpers translating between legacy `Overlay`/`UpdateOverlayData` store-view shape and the SSoT `FloorplanOverlay`/gateway payload shape.
- **REWRITE** `src/subapps/dxf-viewer/overlays/overlay-store.tsx` (446→~290 LOC) — read via `useFloorOverlays(floorId)`, write via `floorplan-overlay-mutation-gateway`. `floorId` from `useLevels()` (`level.floorId`), `backgroundId` from `useFloorplanBackgroundStore`.
- **EDIT** `src/subapps/dxf-viewer/overlays/types.ts` — removed dead `OVERLAY_COLLECTION_PREFIX`; reframed local `Overlay`/`CreateOverlayData`/`UpdateOverlayData` as **layering store-view types** (polygon-only projection of the multi-kind SSoT — different domain, not a duplicate; kept by design).
- **WIRE-UP NOT YET DONE**: `useUnifiedDrawing` (and other `completeEntity` callers) do NOT pass `persistToOverlays` yet. Layering polygons (via overlay-store) ARE fully wired and persist to `floorplan_overlays`. Non-polygon annotation entities (line/circle/arc/measure-*) remain scene-only — wiring deferred until `backgroundId`/`floorId` context plumbing is decided (likely interleaved with STEP H/I).
- ADR-340 changelog STEP G entry added.

### Verification status (STEP G)

- ✅ `tsc --noEmit` — STEP G files clean. Full-scan errors only in pre-existing `procurement` + `contacts` modules (unrelated).
- ⏳ `ssot:audit` — to be re-checked next session.
- ⏳ Manual smoke test on `/dxf-viewer` (DXF + PDF + Image floors) — recommended before STEP H starts; verify layering polygons render + create end-to-end via the new gateway path.

---

## What's done — STEPS A-D (backend) + E (renderer) + F (read hook)

### STEPS A-D — backend foundation
See previous handoff entries (now archived in commits / ADR-340 changelog). Summary:
- **A** — `src/types/floorplan-overlays.ts` SSoT, `OverlayGeometry` discriminated union, `OverlayRole`, `ROLE_ALLOWED_GEOMETRY`/`ROLE_REQUIRES_LINK`, type guards, validation helpers.
- **B** — `/api/floorplan-overlays` route + handlers + Zod schemas + `floorplan-overlay-mutation-gateway.ts` (sole client write path).
- **C** — `firestore.rules` `floorplan_overlays` block (helpers + integrity matrix), 3 new composite indexes, role↔geometry test matrix (11 cases).
- **D** — `floorplan-scale.service.ts` + `/api/floorplan-backgrounds/[id]/calibrate` + `remapGeometry` discriminated dispatch in `calibration-remap.service.ts` (handles all 7 geometry kinds).

### STEP E — Renderer SSoT split (DONE, this commit)
Split `src/components/shared/files/media/overlay-polygon-renderer.ts` (297 LOC, polygon-only) into 14 per-shape files under `overlay-renderer/`:
- `types.ts` (re-export geometry SSoT + local `SceneBounds`/`FitTransform`/`OverlayLabel`/`OverlayRenderContext`)
- `transform.ts` (`computeFitTransform`/`worldToScreen`/`screenToWorld`/`rectBoundsToScene`)
- `colors.ts` (`OVERLAY_FALLBACK`, `resolvePolygonColors`, `resolveAnnotationStroke`)
- `format-utils.ts` (`formatNumber`/`formatDistance`/`formatArea`/`formatAngle`)
- `polygon.ts` (closed+open via `closed` flag), `line.ts`, `circle.ts`, `arc.ts` (Y-flip negates angles + swaps CCW), `dimension.ts` (extension+arrows+label), `measurement.ts` (3 modes), `text.ts` (Y-flip rotation `ctx.rotate(-rotation)`, fontSize world→screen clamp 8-72px), `label.ts` (vertex-based centroid + 3-line label)
- `dispatch.ts` — `renderOverlay(ctx, overlay: FloorplanOverlay, bounds, fit, ctx)` switch on `geometry.type`
- `legacy.ts` — `renderOverlayPolygon`/`renderOverlayPolygons` for `FloorOverlayItem` back-compat
- `index.ts` — public barrel

**Compatibility shim**: `overlay-polygon-renderer.ts` rewritten to single line `export * from './overlay-renderer'` — zero import-path changes for the 8 grep-confirmed consumers.

**`.ssot-registry.json`**: module renamed `overlay-polygon-renderer` → `overlay-renderer`, allowlist extended to all 14 new files + the shim. ForbiddenPattern preserved.

### STEP F — Read hook + multi-kind hit-test (DONE, this commit)
- **REWRITE** `src/hooks/useFloorOverlays.ts` (~210 LOC):
  - Single `firestoreQueryService.subscribe('FLOORPLAN_OVERLAYS', …, { constraints: [where('floorId','==',floorId), orderBy('createdAt','asc')] })` — `companyId` auto-injected via `buildTenantConstraints` default mapping (FLOORPLAN_OVERLAYS not in `tenant-config.ts` overrides → `DEFAULT_TENANT_CONFIG = companyId`).
  - Helpers: `isValidGeometry` (whitelist via `OVERLAY_GEOMETRY_TYPES`), `extractPolygon` (vertices for polygon kind, `[]` otherwise), `roleToKind` (1:1 for property/parking/storage/footprint, fallback 'property' for annotation/auxiliary), `normalizeOverlay` (full doc validation).
  - Output `FloorOverlayItem extends FloorplanOverlay` + back-compat `polygon: Point2D[]` + `kind: OverlayKind` + `resolvedStatus: PropertyStatus`. **Renderer.legacy and `useEntityStatusResolver` keep working with zero changes.**
  - Footprints filtered (`role === 'footprint' → continue`).
  - Removed: 2-step `dxf_viewer_levels` fan-out, `subscribeSubcollection`, `normalizePolygon` 3-format adapter (gateway writes canonical `geometry.vertices`).
- **NEW** `src/components/shared/files/media/overlay-hit-test.ts` (~165 LOC):
  - `computeGeometryAABB(geometry)` returns world-space AABB per kind (polygon/line/circle/arc/dimension/measurement/text).
  - `hitTestGeometry(point, geometry, id, tolerance)` dispatches per `geometry.type`. Polygon-closed → `isPointInPolygon` ray-cast. Polygon-open / measurement-non-area → polyline `distanceToSegment ≤ tol`. Line/dimension → segment distance. Circle/arc → `|distance − radius| ≤ tol`. Text → AABB.
  - Bundle isolation: imports only `@/types/floorplan-overlays` + `@core/polygon-system` (no DXF subapp imports).
- **EDIT** `src/components/shared/files/media/floorplan-overlay-system.ts` — `computeOverlayAABBs` + `hitTestOverlays` (with new `tolerance` param, default `DEFAULT_HIT_TOLERANCE`=1) now delegate to `overlay-hit-test.ts`. AABB pre-filter expanded by tolerance.
- **EDIT** `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts` — `hitTestPdfOverlays` body simplified to `hitTestGeometry(world, overlay.geometry, overlay.id, DEFAULT_HIT_TOLERANCE)` — removed inline `isPointInPolygon` + `UniversalPolygon` construction.

### ADR-340 changelog
6 entries added (STEP A/B/C/D/E/F) at the top of the changelog table in `docs/centralized-systems/reference/adrs/ADR-340-raster-background-layers-system.md`.

---

## Decisions confirmed by Giorgio (DO NOT REOPEN)

1. **Single collection** `floorplan_overlays` with discriminated-union schema. Deprecate `dxf_overlay_levels/{levelId}/items` (full data wipe → no migration).
2. **Geometric `geometry` field** + **semantic `role` field** orthogonal. Old `kind` field deprecated (kept transiently as back-compat in `useFloorOverlays` output for the legacy renderer + status-resolver — to be removed when those callers migrate to `geometry`/`role` directly).
3. **Native coordinate space per-background** (DXF=CAD world, PDF/Image=pixel) + new `BackgroundScale` calibration metadata on `floorplan_backgrounds`. DXF auto-detect $INSUNITS, PDF/Image manual click-to-calibrate.
4. **FloorplanGallery** = viewer + transient client-side measure tool (NO Firestore writes). **DXF Viewer subapp** = full authoring surface. Strict bundle isolation: gallery imports MUST NOT pull in DXF Viewer subapp.

### Tool → geometry mapping (DO NOT REOPEN, applies in STEP G)
| Tool(s) | `geometry.type` | `role` |
|---------|-----------------|--------|
| `line` / `line-perpendicular` / `line-parallel` | `line` | `annotation` |
| `rectangle` | `polygon` (4 vertices, `closed:true`) | `annotation` |
| `circle` (8 variants) | `circle` | `annotation` |
| `arc` (3 variants) | `arc` | `annotation` |
| `polyline` | `polygon` with `closed:false` | `annotation` |
| `polygon` | `polygon` with `closed:true` | `annotation` |
| `layering` (existing 4 sub-modes) | `polygon` | `property`/`parking`/`storage`/`footprint` |
| `measure-distance` (+ continuous) | `measurement` (`mode:'distance'`) | `annotation` |
| `measure-area` | `measurement` (`mode:'area'`) | `annotation` |
| `measure-angle` (5 variants) | `measurement` (`mode:'angle'`, `points:[vertex,p1,p2]`) | `annotation` |

---

## Next steps (STEPS H-M — UI + cleanup)

### STEP H — FloorplanGallery transient measure tool
- **NEW** `src/components/shared/files/media/MeasureToolOverlay.tsx` (~200 LOC) — transparent overlay canvas; modes distance/area/angle; local React state ONLY; ESC/click-outside clears; **NEVER writes Firestore**.
- **NEW** `src/components/shared/files/media/MeasureToolbar.tsx` (~60 LOC) — 3 toggle buttons (Απόσταση/Εμβαδόν/Γωνία).
- **EDIT** `src/components/shared/files/media/FloorplanGallery.tsx` — integrate toolbar + overlay; pass `bounds`, `fit`, `unitsPerMeter` from `background.scale`.
- **Bundle isolation rule**: `MeasureToolOverlay`/`MeasureToolbar` import only from `./overlay-renderer/`, React, `@/i18n/`, `@/hooks/useZoomPan`. **Zero imports from `src/subapps/dxf-viewer/`** — verified via grep before commit.

### STEP I — Calibration UI
- **NEW** `src/components/floorplan/CalibrateScaleDialog.tsx` (~200 LOC) — Dialog with 2-click canvas + real-world distance input + unit select; calls `POST /api/floorplan-backgrounds/[id]/calibrate` (already exists from STEP D).
- **EDIT** floorplan import wizard — after PDF/Image upload prompt calibration; for DXF show "Detected: 1mm = 1 unit. Override?" using `detectDxfInsUnits()`.

### STEP J — i18n keys (pure-Greek el locale)
- **EDIT** `src/i18n/locales/{el,en}/files-media.json` — add `floorplan.measure.*` (~10 keys) + `floorplan.calibrate.*` (~8 keys).
- **NEW** `src/i18n/locales/{el,en}/floorplan-overlays.json` namespace — `roles.*` (6) + `geometry.*` (7) labels.
- **HARD CONSTRAINT** (memory `feedback_pure_greek_locale`): el locale = ZERO English words.
- **HARD CONSTRAINT** (memory `feedback_no_hardcoded_i18n_defaultvalue`): NEVER `defaultValue: 'literal text'` — only `defaultValue: ''`.

### STEP K — SSoT registry
- **EDIT** `.ssot-registry.json` — add 2 modules:
  ```json
  "floorplan-overlay-gateway": {
    "ssotFile": "src/services/floorplan-overlay-mutation-gateway.ts",
    "forbiddenPatterns": [
      "collection\\(['\"]floorplan_overlays['\"]\\)",
      "FLOORPLAN_OVERLAYS.*\\.doc\\("
    ],
    "allowlist": [
      "src/services/floorplan-overlay-mutation-gateway.ts",
      "src/app/api/floorplan-overlays/",
      "src/services/floorplan-background/floorplan-cascade-delete.service.ts",
      "src/services/floorplan-background/floorplan-floor-wipe.service.ts",
      "src/services/floorplan-background/calibration-remap.service.ts"
    ]
  },
  "floorplan-overlay-types": {
    "ssotFile": "src/types/floorplan-overlays.ts",
    "forbiddenPatterns": [
      "interface FloorplanOverlay \\{",
      "type OverlayGeometry ="
    ],
    "allowlist": ["src/types/floorplan-overlays.ts"]
  }
  ```
- **GREP RULE** (memory `feedback_grep_no_noncapturing_groups`): GNU grep 3.0 ERE silently breaks `(?:...)` — use `(...)` only.
- **Run** `npm run ssot:baseline` after registering.

### STEP L — Cascade cleanup (post-wipe ONLY)
- **REMOVE** DXF subcollection arm from `src/services/floorplan-background/floorplan-cascade-delete.service.ts`.
- **REMOVE** `dxfOverlayCount` / `dxfLevelCount` from `floorplan-floor-wipe.service.ts` preview/result.
- **TRIGGER**: only after Giorgio confirms data wipe complete.

### STEP M — Tests + ADR-340 finalize
- **NEW** renderer per-shape tests: `src/components/shared/files/media/overlay-renderer/__tests__/{line,circle,arc,dimension,measurement,text}.test.ts` — mock `CanvasRenderingContext2D` spies, ~40 LOC each.
- **NEW** `src/components/shared/files/media/__tests__/MeasureToolOverlay.test.tsx` — assert no `createFloorplanOverlay` import.
- **NEW** `src/subapps/dxf-viewer/hooks/drawing/__tests__/overlay-persistence-utils.test.ts` — entity→geometry mapping matrix.
- **NEW** `src/components/shared/files/media/__tests__/overlay-hit-test.test.ts` — per-kind hit-test cases (polygon ray-cast, line distance tolerance, circle radius tolerance, arc, measurement modes, text AABB).
- **UPDATE** ADR-340 — flip Phase 9 status to ✅ **IMPLEMENTED** in header + final changelog entry summarizing all steps.

---

## Critical files to read in next session (Phase 1 Recognition)

Before touching code, **read** in this order:
1. `C:\Users\user\.claude\plans\declarative-snuggling-kay.md` — full plan (already approved by Giorgio).
2. `C:\Nestor_Pagonis\src\types\floorplan-overlays.ts` — SSoT types (geometry+role).
3. `C:\Nestor_Pagonis\src\services\floorplan-overlay-mutation-gateway.ts` — client gateway (sole write path).
4. `C:\Nestor_Pagonis\src\subapps\dxf-viewer\overlays\overlay-store.tsx` — DXF subapp store (target of STEP G rewrite).
5. `C:\Nestor_Pagonis\src\subapps\dxf-viewer\hooks\drawing\completeEntity.ts` — entity completion entry (STEP G hook point).
6. `C:\Nestor_Pagonis\src\subapps\dxf-viewer\overlays\types.ts` — legacy `Overlay`/`CreateOverlayData`/`UpdateOverlayData` (STEP G deletes these).
7. `C:\Nestor_Pagonis\src\subapps\dxf-viewer\utils\overlay-drawing.ts` — `OverlayDrawingEngine` (STEP G grip/snap adaptation).
8. `C:\Nestor_Pagonis\src\hooks\useFloorOverlays.ts` — current shape (already migrated).
9. `C:\Nestor_Pagonis\docs\centralized-systems\reference\adrs\ADR-340-raster-background-layers-system.md` — read 6 most-recent changelog entries (Phase 9 STEPS A-F).

---

## Constraints / pitfalls

- **N.(-1)**: NO commit/push without Giorgio's explicit order.
- **N.7.1**: 500 LOC max per file, 40 LOC max per function.
- **N.7.2**: declare ✅/⚠️/❌ Google-level explicitly per step.
- **N.10**: AI pipeline tests required IF you touch `src/services/ai-pipeline/` — STEP G-M should NOT touch this directory (verified via grep in plan).
- **N.11**: NO hardcoded `defaultValue: 'literal text'` in i18n calls. Only empty string `''`.
- **CHECK 3.10 / Firestore CompanyId**: any new `query()` + `where()` MUST include `where('companyId', '==', companyId)` — `firestoreQueryService.subscribe`/`getAll` auto-injects via `buildTenantConstraints` default config.
- **Bundle isolation** (STEP H): `src/components/shared/files/media/` must NOT import from `src/subapps/dxf-viewer/`. Verify with grep before commit.
- **Greek pure** in `el` locale (memory `feedback_pure_greek_locale`).
- **Gateway is sole write path**: STEP G consumers MUST use `floorplan-overlay-mutation-gateway`. No direct Firestore writes.

---

## Suggested commit cadence (per phase, on Giorgio's order)

13 commits total, one per STEP. Per CLAUDE.md ADR-driven workflow Phase 4: code AND ADR update in the SAME commit.

For STEPS A-G (already implemented in working tree), 7 commits:
1. `feat(types): ADR-340 Phase 9.A — multi-kind overlay types SSoT`
2. `feat(api): ADR-340 Phase 9.B — floorplan-overlays API + write gateway`
3. `feat(rules): ADR-340 Phase 9.C — multi-kind overlays rules + indexes + matrix tests`
4. `feat(calibration): ADR-340 Phase 9.D — scale service + remap dispatch`
5. `refactor(renderer): ADR-340 Phase 9.E — overlay-renderer SSoT split per-shape`
6. `feat(read-hook): ADR-340 Phase 9.F — single subscription + multi-kind hit-test`
7. `refactor(dxf-viewer): ADR-340 Phase 9.G — overlay-store + persistence migration`

Each commit includes the ADR-340 changelog entry for that step (already added).

---

## Status check (after STEP G)

- TypeScript: ✅ STEP G files clean. Full `tsc --noEmit` shows only pre-existing errors in `procurement` + `contacts` (unrelated).
- SSoT audit: re-check next session.
- Tests: rules tests need emulator run (`npm run test:firestore-rules -- floorplan-overlays`) — deferred to STEP M.
- Lint: not yet run.
- Visual smoke test on `/dxf-viewer` (DXF + PDF + Image floors): RECOMMENDED before STEP H — verify layering polygons render + create end-to-end via the new gateway path.

Run sanity `tsc --noEmit` + `npm run ssot:audit` in background BEFORE STEP H starts; if clean, proceed with FloorplanGallery measure tool.

---

## STEP H implementation sketch

Files to create:
```
src/components/shared/files/media/
  MeasureToolOverlay.tsx   ~200 LOC  — transparent overlay canvas; modes distance/area/angle
  MeasureToolbar.tsx       ~60 LOC   — 3 toggle buttons (Απόσταση/Εμβαδόν/Γωνία)
```

Files to edit:
```
src/components/shared/files/media/FloorplanGallery.tsx
  + integrate <MeasureToolbar/> + <MeasureToolOverlay/> overlay layer
  + pass scene bounds, fit transform, unitsPerMeter from background.scale
```

Behavior contract (NON-NEGOTIABLE):
- Local React state ONLY — `useState`/`useRef`. NO `createFloorplanOverlay`, NO Firestore writes, NO mutation gateway import.
- ESC key + click-outside clear current measurement.
- Distance: 2 clicks → segment + length label in real-world units (via `unitsPerMeter`).
- Area: ≥3 clicks + double-click finish → closed polygon + area label.
- Angle: 3 clicks (vertex first or vertex middle — match DXF Viewer convention) → arc indicator + angle label.

Bundle isolation:
- Imports allowed: `react`, `@/i18n/`, `@/hooks/useZoomPan`, `./overlay-renderer/` (per-shape draw helpers from STEP E).
- ZERO imports from `src/subapps/dxf-viewer/`. Verify with grep BEFORE commit.
- Reuse `drawLine`/`drawPolygon`/`renderOverlayLabel` from `overlay-renderer/` for visual consistency with persisted overlays.
