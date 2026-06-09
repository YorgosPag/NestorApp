# ADR-435 — Coordination / Clash Detection (MEP ↔ MEP ↔ Structural)

**Status:** 🟢 Slice 0 (engine) + Slice 1 (2D UI) + Slice 1b (3D markers + DOM report panel) implemented 2026-06-10 (Opus 4.8) · browser-verify + commit pending (Giorgio)
**Parent:** ADR-423 §10 (Coordination = committed stage, between routing and finalize)
**Relates:** ADR-426→434 (the 8 auto-routing disciplines that produce the clashable entities), ADR-040 (preview-canvas performance — the overlay is a micro-leaf)

> **Code = Source of Truth.** This ADR documents what the code does. If they
> disagree, the code wins and this file is updated.

---

## 1. Context

After the 8/8 MEP auto-routing disciplines (ADR-426→434), the produced networks plus
the structural model can **intersect in 3D space**. The first Coordination deliverable
is **Clash Detection** — a Revit/Navisworks/Solibri-grade, **read-only** clash report:
no persisted entities in v1, mirror of the auto-design proposal-store pattern.

Clash kinds:
- **Hard clash** — two solids occupy the same volume (pipe through a beam, pipe through a column, gas pipe crossing a water pipe).
- **Clearance / soft clash** — a minimum-distance regulation is violated (e.g. drainage too close to potable water).
- **Penetration / sleeve** — a pipe legally passing through a wall/slab → auto sleeve. **Phase 2 (out of scope here).**

## 2. Architecture — one engine over the existing geometry caches

Mirror of the auto-design framework: like every discipline is "recognizer + registry
entry, not a new engine", clash detection is **ONE broad-phase + narrow-phase engine**
over the EXISTING entity geometry — **zero new geometry**.

New folder `src/subapps/dxf-viewer/systems/coordination/` (sibling of `systems/mep-design/`):

| File | Role |
|------|------|
| `clash-types.ts` | `Vec3`, `Aabb3`, `ClashCapsule`, `ClashEntity`, `Clash`, `ClashRule`, `ClashReport`, `ClashType`/`ClashSeverity` |
| `entity-world-aabb.ts` | **SSoT normaliser** `entityWorldAABB(entity, sceneUnits, systemIds)` — the one place that reconciles mixed-unit caches into a single metric space (see §3) |
| `aabb.ts` | `aabbOverlap` (3D SAT, + margin), `aabbOverlapVolumeM3`, `aabbCenter`, `aabbMaxExtent`, `aabbFromPoints` |
| `broad-phase.ts` | uniform spatial-hash grid → candidate index pairs (O(n) build), with cell-population cap + overflow logging (no silent caps) |
| `clash-narrow-phase.ts` | `closestDistanceBetweenSegments` (capsule↔capsule, Ericson §5.1.9) + `segmentAabbHit` (capsule↔box, Smits slab clip) |
| `clash-pair-filter.ts` | `sharesSystem` / `shouldSkipPair` — skip same-entity & same-`MepSystem` (legit connection) |
| `clash-rules.ts` | pluggable `ClashRule` registry — `hardSeverity`, `DEFAULT_CLEARANCE_RULES`, `maxClearanceM` |
| `detect-clashes.ts` | orchestrator `detectClashes({entities, systems, sceneUnits})` → `ClashReport` |
| `clash-report-store.ts` | low-freq transient store (⚠️ ADR-040) — `clashReportStore.set/reset/get`, `useClashReport()` |
| `index.ts` | barrel |

## 3. The mixed-units problem (why a normaliser is mandatory)

The cached `entity.geometry.bbox` is **not** directly usable for 3D collision:
- XY is in **canvas/scene units**, Z is already in **metres** (mixed).
- `column` / `mep-fixture` / `mep-radiator` / `mep-boiler` / `mep-water-heater` store
  `bbox.z = 0` (footprint only) — the vertical extent lives in params
  (`height`, or `mountingElevationMm ± bodyHeightMm/2`).

`entityWorldAABB` is the single place that reconciles all of that into one consistent
space `(planX_m, planY_m, elevation_m)`:
- XY → metres via `sceneUnitsToMeters(sceneUnits)`.
- Z: passthrough for segment/fitting/beam/wall/slab (already metres); from params for
  the z=0 kinds (column → `[0, height]`, mounted equipment → `mounting ± body/2`).
- MEP segments additionally yield an exact **capsule** (axis endpoints + outer radius)
  from `resolveSegmentEndpointElevationsMm` + `resolveSegmentSection`.

The engine is **THREE-free** → fully pure / headless / deterministic / snapshot-testable.

## 4. v1 narrow-phase scope (handoff-locked, bounded like auto-routing v1)

Only pairs that involve a MEP **segment** are tested:
- **segment ↔ segment** → exact capsule distance. Hard if `dist ≤ r₁+r₂`; otherwise a
  matching clearance rule fires if `dist ≤ r₁+r₂ + clearance`.
- **segment ↔ everything** (beam/column/wall/slab/fitting/equipment) → capsule vs the
  other's AABB (hard only). **Structural-as-AABB is a deliberate, documented
  simplification** (conservative — never misses a real penetration; true swept-solid
  clip = Phase 2).
- structural↔structural and equipment↔equipment are **not** tested in v1 (avoids
  beam-touches-slab false positives).

**Severity** (deterministic): structural penetration = `high`; MEP↔MEP hard = `medium`;
clearance = `low`.

**Clearance rules (v1 demos, segment-classification-driven, pluggable data):**
1. `drainage-potable-separation` — `sanitary-drainage` ↔ `domestic-cold/hot-water`, 50 mm, medium.
2. `fire-services-separation` — `fire-sprinkler` ↔ other piped services, 30 mm, low.

**Legit-connection filter:** two entities sharing a `MepSystem` membership (or where one
is the system's `sourceEntityId`) touch by design at their connectors → never a clash.
Membership truth = `MepSystemEntity.params.members[].entityId` + `sourceEntityId`,
read from `useMepSystemStore`.

## 5. UI (Slice 1) — mirror proposal-store, ADR-040-safe

- **`clashReportStore`** — low-freq (set on Detect, clear on Clear); the shell never subscribes (CHECK 6C).
- **2D overlay leaf** — `canvas-layer-stack-clash-overlay.tsx` (`ClashOverlayMount`, memo→null) +
  `hooks/tools/useClashOverlayPreview.ts`: subscribes `useClashReport()`, single RAF on
  report change + pan/zoom. Draws a severity-coloured ring + crosshair at each clash point
  (clearance = dashed) and a top-left count badge. Clash point metres → canvas units
  (÷`sceneUnitsToMeters`) → screen via the shared `CoordinateTransforms.worldToScreen`.
  Mounted in `PreviewCanvasMounts` (`canvas-layer-stack-leaves.tsx`) — **STAGE ADR-040**
  (CHECK 6B/6D).
- **Ribbon** — `ui/ribbon/hooks/useRibbonClashDetectionBridge.ts` (Detect/Clear, **no commit**)
  + `bridge/clash-detection-command-keys.ts` + button `draw.bim.clashDetection` in
  `home-tab-draw.ts` + wiring through `useDxfBimBridges` / `useDxfViewerRibbon` /
  `useRibbonCommands(-types)`. i18n `ribbon.commands.bim.clashDetection*` (el + en).

## 5b. UI (Slice 1b) — unified ⊙ markers + DOM report panel (Navisworks Clash Detective)

Browser-verified end-to-end 2026-06-10 (Giorgio). The 2D and 3D markers share ONE glyph (Giorgio's
SSoT requirement: "use the 2D code in 3D") — there is no second shape definition.

- **Severity colour SSoT** — `systems/coordination/clash-severity-color.ts` (`CLASH_SEVERITY_COLOR`
  + `clashSeverityColorInt`). Boy-Scout: extracted so every clash surface shares ONE palette.
- **Shared glyph + layer** — `components/dxf-layout/clash-markers/ClashMarkerGlyph.tsx` (the SVG ⊙ =
  ring + crosshair; dashed ring = clearance; severity colour) and `ClashMarkerLayer.tsx` (renders one
  glyph per clash ONCE, then positions them **imperatively** via refs + CSS `translate` on a caller-
  supplied `project` + `subscribe`). Used by BOTH overlays → byte-identical, and zero-lag (positions
  bypass React, like the canvases — ADR-040). Only the projection differs:
  - **2D** — `canvas-layer-stack-clash-overlay.tsx`: clash point (metres) → canvas units
    (÷`sceneUnitsToMeters`) → screen via `CoordinateTransforms.worldToScreen` reading the **immediate**
    transform; reproject driven by a LOW-priority `UnifiedFrameScheduler` subsystem (`clash-markers-2d`,
    gated on the transform sig) so it is frame-synced with the 2D canvases → zero-lag pan/zoom. Persists
    when idle (DOM, not the wiped shared preview canvas). **Hidden while the 3D view is active.**
  - **3D** — `bim-3d/coordination/ClashMarkers3DOverlay.tsx` (mounted in `BimViewport3D`): clash point →
    world (`clash-marker-math.clashPointToWorld` = plan-metres `(x, z, −y)`, same axes as
    `segmentAxisEndpointsWorld`) → screen via `camera.project()` (CSS2D pattern). Reproject driven by a
    LOW-priority scheduler subsystem (`bim-3d-clash-markers`) that runs AFTER `bim-3d-scene` (camera
    already updated this frame → zero-lag) and ONLY when the camera changed (no idle spin). **No Three.js
    objects** — screen-space, always visible, screen-constant. v1 limitation: floor-relative elevation.
- **DOM report panel** — `components/dxf-layout/ClashReportPanel.tsx`: a **draggable** floating card
  via the centralized `FloatingPanel` SSoT (`@/components/ui/floating`), default-positioned clear of
  the top-right 3D toggle / ViewCube. Subscribes `useClashReport`; lists each clash (`aKind ↔ bKind`,
  type chip, severity dot, penetration/gap mm) + severity breakdown + scanned/tested footer; Close →
  `clashReportStore.reset()`. Mounted in `CanvasLayerStack`. Row `key` is index-suffixed (a `Clash.id`
  can repeat — see §6 dedup).
- **Click → zoom to clash** — `systems/coordination/clash-focus-bus.ts` (pure pub/sub). The panel
  decides by active view: 3D → `requestClashFocus` → `ClashMarkers3DOverlay` → `viewport.frameBounds`
  (±0.6 m box); 2D → reuses the `canvas-fit-to-view-selected` EventBus SSoT, with the focus box sized
  in **metres** (×`toCanvas`) so it is scale-correct for mm OR metre units (a fixed canvas-unit pad
  zoomed a metre-unit drawing out to nothing).

## 6. Tests

`systems/coordination/__tests__/clash-detection.test.ts` — 17 pure/deterministic tests:
AABB math, `closestDistanceBetweenSegments`, `segmentAabbHit`, broad-phase, the
`entityWorldAABB` z-normalisation (segment capsule, column height, mounted equipment),
and the orchestrator (crossing pipes = hard, same-system = skipped, pipe↔beam = high,
drainage↔potable = clearance, distant = none).

## 7. Out of scope (Phase 2 / future)

Penetrations/sleeves auto-element + opening reservation · true structural swept-solid clip
(vs AABB) · fitting/equipment narrow-phase · clearance regulation library beyond the 2 demos ·
re-detect on edit · clash grouping/grid/sweep-and-prune tuning · multi-building base-elevation
offset for 3D markers (v1 = floor-relative) · element highlight on clash select (Navisworks green/red).

## Changelog
- **2026-06-10 (Opus 4.8)** — ADR created. Slice 0 engine (`systems/coordination/`, 17 tests
  green) + Slice 1 UI (store + 2D overlay leaf + ribbon Detect/Clear + i18n el/en). 3D markers
  and DOM report panel deferred to Slice 1b. Browser-verify + commit pending.
- **2026-06-10 (Opus 4.8)** — Slice 1b first cut: severity-colour SSoT (Boy-Scout), 3D
  `ClashMarkerOverlay` (Three.js), `ClashReportPanel`, click-to-zoom. (Superseded below.)
- **2026-06-10 (Opus 4.8) — Slice 1b BROWSER-VERIFIED + unified (Giorgio, live session).** Driven by
  Giorgio's testing, the markers were unified to **one ⊙ glyph for 2D and 3D** (his SSoT requirement)
  and several issues found + fixed:
  1. **Unified glyph** — extracted `ClashMarkerGlyph` (SVG ⊙) + `ClashMarkerLayer` (imperative,
     zero-lag positioning). The Three.js `ClashMarkerOverlay` + `use-bim3d-clash-markers` were
     **removed**; 3D now renders the SAME DOM ⊙ projected via `camera.project()` (CSS2D), so 2D and 3D
     are byte-identical.
  2. **2D persistence** — the markers were on the shared transient preview canvas (wiped every frame →
     vanished when idle). Moved to DOM. Latent in every ghost overlay; clash was the first persistent one.
  3. **Zero-lag** — both overlays reproject via a LOW-priority `UnifiedFrameScheduler` subsystem
     (frame-synced with the canvas / after the 3D render), not React, so they track pan/zoom/orbit with
     no lag. 2D hidden in 3D (no double set).
  4. **Panel** — now a draggable `FloatingPanel` (SSoT) so it never covers the 3D toggle / ViewCube;
     row `key` index-suffixed (duplicate `Clash.id`).
  5. **Engine fixes** — `detectClashes` now **dedups entities by id** at intake (the level scene can
     contain the same id twice → inflated counts + duplicate `Clash.id`); 2D click-to-zoom focus box is
     in **metres** (scale-correct).
  - **Known issues (deferred):** segment↔fitting false positives (a fitting on its own run isn't
     filtered when the pipes aren't yet in a shared `MepSystem` — pair-filter needs connectivity, not
     just shared-system); upstream duplicate-entity data in the level scene (worth a separate look).
  - 24 coordination jest green (marker-math + severity + detection). Coordination Phase 1 complete.
    Commit pending (Giorgio).
