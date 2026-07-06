# ADR-537 — Επιλογή & επεξεργασία ωμών DXF οντοτήτων με λαβές στην 3D προβολή

**Status:** 🟢 Φ1 + Φ1.1 + γ + δ + β + **Φ2** IMPLEMENTED (UNCOMMITTED) — line/polyline/circle/arc/**text** (+arc ghost & deg/rad commit fix +ΟΛΕΣ οι μονάδες mm/cm/m/in/ft +multi-floor edit/hover «Όλοι οι όροφοι» +text select/hover/grip σε 3D **+Φ2: ίχνη ευθυγράμμισης + λευκές ενδείξεις HUD στο 3D grip drag, parity με 2D**) · **Date:** 2026-06-27 (Φ2: 2026-07-06)
**Type:** Feature (DXF Viewer — 3D viewport editing). Full SSoT με το 2D.
**Builds on:** ADR-535 (3D grip overlay infra — Canvas2D overlay + `BimGripController3D` + `Grip3DOverlayStore`) · ADR-183 (Unified Grip System) · ADR-349/363 (StretchEntityCommand / grip commit adapters) · ADR-366 (3D coordinate transforms) · ADR-532 (SelectedEntitiesStore SSoT) · ADR-402 (3D BIM editing) · ADR-040 (leaf renderers / micro-leaf)
**Related:** ADR-049 (unified move SSoT DXF+BIM)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-27)

Στην **3D προβολή** (`/dxf/viewer`) μπορείς να επιλέγεις/επεξεργάζεσαι **μόνο BIM** οντότητες (τοίχοι/πλάκες/
κολόνες) μέσω του ADR-535. Οι **ωμές DXF** οντότητες (line / polyline / circle / arc) ζωγραφίζονται μεν στο
3D ως επίπεδο wireframe (`DxfToThreeConverter`), αλλά **δεν επιλέγονται και δεν επεξεργάζονται** — δεν είναι
raycastable ανά-οντότητα και δεν τους σταθεροποιούνται λαβές.

**Ζητούμενο:** στην 3D να επιλέγω και να επεξεργάζομαι DXF οντότητες **ακριβώς όπως στη 2D**, με τις **ίδιες
λαβές**, χρησιμοποιώντας τον **ίδιο κώδικα** (μία πηγή αλήθειας).

**Απάντηση: εφικτό, χωρίς SSoT-blocker.** Όλα τα commit paths, η grip computation, ο scene-manager adapter
και ο drag controller είναι ήδη κοινά με το BIM 3D path — το ωμό DXF είναι το **απλούστερο** σκέλος του
`commitDxfGripDragModeAware` (default `StretchEntityCommand` / bulge).

---

## 2. Τι επαναχρησιμοποιείται ΑΥΤΟΥΣΙΟ (η SSoT)

| Ανάγκη | 2D / κοινή SSoT |
|---|---|
| Επιλεγμένες dxf-entity ids (ενοποιημένες 2D+3D) | `systems/selection/SelectedEntitiesStore.ts` |
| Υπολογισμός λαβών οντότητας | `hooks/grip-computation.ts` `computeDxfEntityGrips` |
| Render λαβών (Canvas2D, 7px τετράγωνο) | `rendering/grips/UnifiedGripRenderer` μέσω `BimGripOverlay2D` |
| Drag FSM (ray∩plane → snap → deltaMm) | `bim-3d/grips/bim-grip-controller-3d.ts` (ήδη generic) |
| Grip set store + non-reactive interaction | `bim-3d/stores/Grip3DOverlayStore.ts` |
| Commit (stretch/anchor/bulge) | `hooks/grips/grip-commit-adapters.ts` + `grip-scene-manager-adapter.ts` |
| Adapter deps εκτός 2D React tree | `bim-3d/animation/bim3d-edit-interaction-helpers.ts` `buildDeps` |
| OSNAP engine + 3D viewport sync | `snapping/global-snap-engine.ts` + `syncSnapEngineViewport3D` (εξήχθη SSoT) |

---

## 3. Ροή δεδομένων: select → seat-grips → drag → ghost → commit

1. **Pick** — 3D pointer (`use-bim3d-pointer-handlers.ts handleClick`). BIM raycast hit ⇒ BIM (αμετάβλητο).
   Miss ⇒ `pickDxfEntityAt` (plan-space proximity πάνω στο floor wireframe).
2. **Select (ενοποιημένο)** — DXF hit: `Selection3DStore.clearSelection()` + `SelectedEntitiesStore.replaceEntitySelection([id])`.
   BIM hit: επιπλέον `clearByType('dxf-entity')`. Κενό: clear και τα δύο → πάντα ΕΝΑ grip set.
3. **Seat grips** — `useBim3DDxfEditInteraction` (νέο hook): resolve `DxfEntity` από `useDxfOverlay3DStore`,
   `computeDxfEntityGrips` → φίλτρο `rawDxfReshapeGrips` → `setGrips(grips, ()=>0, ()=>0)` (επίπεδο Y=0) +
   `setDxfGhostEntityId(id)`.
4. **Drag** — `BimGripController3D` αυτούσιος· OSNAP μέσω `makeResizeSnapFn` + `syncSnapEngineViewport3D`.
5. **Ghost (live)** — `BimGripOverlay2D` ζωγραφίζει: τετράγωνο λαβής στο `livePlanPos` (free) + **ghost**
   της οντότητας (`buildDxfGhostSegments`, plan→canvas με τον ΙΔΙΟ projector). Dashed Revit-blue, κάτω από τα τετράγωνα.
6. **Commit** — `commitDxfGrip3D(grip, deltaMm, levels, levelId)` → `commitDxfGripDragModeAware(unified, delta, deps, 'stretch')`
   με πραγματικό `execute: getGlobalCommandHistory().execute`. Γράφει `setLevelScene` → `useDxfOverlay3DSync`
   → `resyncDxfOverlay` ξαναχτίζει το wireframe → οι λαβές ξανα-σταθεροποιούνται. Ένα command = ένα undo.

---

## 4. Νέα αρχεία

- `bim-3d/grips/grip-3d-dxf-raw-grips.ts` — pure `rawDxfReshapeGrips` (full 2D parity· drop μόνο BIM kinds).
- `bim-3d/grips/grip-3d-dxf-commit.ts` — `commitDxfGrip3D` + `toRawDxfUnifiedGrip` (NO BIM kind, forward `polylineGripKind`).
- `bim-3d/grips/dxf-wireframe-hit-test.ts` — `pickDxfEntityAt` + pure `nearestDxfEntityWithin` / `distanceToDxfEntityMm`.
- `bim-3d/grips/dxf-grip-ghost-paint.ts` — pure `buildDxfGhostSegments` (line/polyline/circle/**arc**).
- `bim-3d/converters/dxf-arc-circle-sample.ts` — **canonical tessellation SSoT** plan-mm samplers
  `circlePolyline` / `arcPolyline` (Φ1.1, N.0.2 boy-scout). **ΕΝΑ** tessellation tile για ΚΑΙ τα 3:
  wireframe (`appendEntitySegments`) + hover outline + grip ghost. `ccw`-faithful.
- `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts` — το hook (seat/drag/commit/arbitration).
- `bim-3d/scene/dxf-3d-floor-scope.ts` (γ/δ) — **scope SSoT** `getDxfFloorScope` + `findDxfEntityInScope`
  (single active floor ή στοιβαγμένοι όροφοι· entity+elevation+scene). Mirror του `resyncDxfOverlay`.
- `bim-3d/converters/dxf-text-3d.ts` (β) — `buildDxfTextMesh` (flat CanvasTexture-on-plane, native units,
  reuse `text-rendering-config` font/metrics SSoT). Disposable bundle (geometry+material+texture).

## 5. Τροποποιημένα αρχεία

- `bim-3d/stores/Grip3DOverlayStore.ts` — `dxfGhostEntityId` + `setDxfGhostEntityId` (ghost signal· reset στο setGrips/clear).
- `bim-3d/viewport/grips/BimGripOverlay2D.tsx` — ghost pass (no-op για BIM).
- `bim-3d/viewport/use-bim3d-pointer-handlers.ts` — DXF pick + selection arbitration.
- `bim-3d/viewport/BimViewport3D.tsx` — mount του hook.
- `bim-3d/animation/bim3d-edit-drag-snap.ts` — εξήχθη `syncSnapEngineViewport3D` (SSoT, N.0.2 boy-scout).
- **Φ1.1 (arc ghost + commit fix):**
  - `rendering/entities/shared/geometry-arc-utils.ts` — **νέο SSoT** `arcFromMovedEndpoint` (bulge-preserving
    single-endpoint reshape, **μοίρες**). ΕΝΑ helper για commit ΚΑΙ ghost (preview ≡ commit).
  - `systems/stretch/stretch-entity-transform.ts` — 🔴 **διόρθωση deg/rad bug**: `stretchArcSingleEndpoint` /
    `stretchArcMidpoint` αντιμετώπιζαν τις γωνίες ως ακτίνια ενώ ο `ArcEntity` τις κρατά σε μοίρες (παραμόρφωνε
    το reshape — και στο **2D**). Πλέον delegate στα `arcFromMovedEndpoint` / `arcFrom3Points` (SSoT). Αφαιρέθηκαν
    τα αχρησιμοποίητα `arcEndpoint` (radians) + `circumcenter` (dup του `circleFrom3Points`).
  - `bim-3d/grips/dxf-entity-outline.ts` — reuse του canonical sampler (`dxf-arc-circle-sample.ts`), `ccw`-faithful.
  - `bim-3d/converters/DxfToThreeConverter.ts` — N.0.2 boy-scout: το `appendEntitySegments` (wireframe) πλέον
    χρησιμοποιεί τον canonical sampler (αφαιρέθηκε η παράλληλη arc/circle tessellation)· `DXF_UNIT_TO_METRES`
    (προϋπάρχον διπλότυπο) αντικαταστάθηκε με το **υπάρχον SSoT** `sceneUnitsToMeters` (`scene-units.ts`).
    Output byte-identical (tests GREEN).
- **γ (non-mm units):**
  - `utils/scene-units.ts` — **νέο SSoT** `dxfUnitToMm(units)` (= `sceneUnitsToMeters × 1000`) +
    `dxfSceneUnitToMm(scene)` (mirror της unit-resolution του wireframe).
  - `bim-3d/grips/grip-3d-dxf-raw-grips.ts` — pure `scaleDxfGripsToMm(grips, unitToMm)` (scale μόνο position).
  - `bim-3d/grips/dxf-grip-ghost-paint.ts` + `dxf-entity-outline.ts` + `grip-3d-dxf-commit.ts` — optional
    `unitToMm` param (default 1 = mm no-op).
  - `bim-3d/grips/dxf-wireframe-hit-test.ts` — `pickDxfEntityAt`: gate removed, cursor/tol ÷unitToMm.
  - `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts` — gate removed, seat ×unitToMm, commit ÷unitToMm.
  - `bim-3d/viewport/grips/BimGripOverlay2D.tsx` + `DxfHoverGlowOverlay2D.tsx` — pass `dxfSceneUnitToMm(scene)`.
- **δ (multi-floor):**
  - `bim-3d/grips/dxf-wireframe-hit-test.ts` — `pickDxfEntityAcrossFloors` (ray∩κάθε επίπεδο ορόφου,
    nearest-wins cross-floor) + `nearestDxfEntityDetailed` (επιστρέφει dist)· `pickDxfEntityAt` = wrapper.
  - `bim-3d/viewport/use-bim3d-pointer-handlers.ts` — hover+click pick → `pickDxfEntityAcrossFloors(getDxfFloorScope())`.
  - `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts` — `resolveEligibleDxfEntity` cross-scope, seat στο
    `floorElevationMm`, snap-anchor elevation, commit unitToMm από floor scene· +re-seat subscriptions
    (scope toggle + multi-floor stack).
  - `bim-3d/viewport/grips/BimGripOverlay2D.tsx` + `DxfHoverGlowOverlay2D.tsx` — `findDxfEntityInScope`
    (entity+scene+elevation)· το glow projector ρίχνει στο `floorElevationMm`.
- **β (text):**
  - `bim-3d/converters/DxfToThreeConverter.ts` — text pass (build textured-plane meshes) + disposal
    (Mesh geometry+material+texture)· το early `colorBuckets.size===0` guard αφαιρέθηκε (scene μόνο-text).
  - `bim-3d/grips/dxf-wireframe-hit-test.ts` — `distanceToDxfEntityMm` case 'text' (bbox distance).
  - `bim-3d/grips/dxf-entity-outline.ts` — case 'text' (closed bbox rectangle, unit-scaled).
  - `bim-3d/converters/dxf-text-3d.ts` — `depthTest:false` + `renderOrder=999` (always-visible label).
  - `bim-3d/viewport/grips/BimGripOverlay2D.tsx` — skip grip occlusion for raw-DXF (flat underlay).
- **post-FX overlay pass (Revit/Maxon-grade — underlay + gizmo, γενικευμένο SSoT):**
  - `bim-3d/scene/post-fx-overlay-pass.ts` — **νέο SSoT**: **scene-scoped registry** (`registerPostFxOverlay`/
    `collectPostFxOverlayRoots`) + `renderPostFxOverlays(renderer, scene, camera)` + `PostFxOverlayPass extends Pass`.
    ΟΛΑ τα UI/reference overlays που πρέπει να παρακάμπτουν το post-FX (DXF underlay **+ edit gizmo** + μελλοντικά)
    ζωγραφίζονται σε **ξεχωριστό forward pass ΜΕΤΑ το lit scene + SSAO**, depth-tested στο scene depth αλλά
    **ποτέ AO/GI/tone-shaded**. Per-root materials ορίζουν depth (underlay `depthTest:true`/occluded· gizmo
    `depthTest:false`/always-on-top). Owners **εγγράφονται** (decoupled — converter scene-side, gizmo React-side).
    **z-order (ADR-558 v7):** όταν 2+ overlays είναι coplanar `depthWrite:false` (π.χ. το C4D ground grid + το DXF
    underlay, και τα δύο `'underlay'` στο Y=0), το depth δεν αποφασίζει — αποφασίζει η **σειρά σχεδίασης**. Γι' αυτό
    το `registerPostFxOverlay` δέχεται `order` (`OVERLAY_ORDER={GROUND:-100,CONTENT:0}`) και ο `collectPostFxOverlayRoots`
    κάνει **stable-sort κατά order** (ground πρώτα). Το grid εγγράφεται `GROUND` → πάντα κάτω από τις DXF οντότητες,
    ανεξάρτητα από σειρά κατασκευής. Default `CONTENT` → καμία αλλαγή για underlay/gizmo/ghosts.
  - `bim-3d/converters/DxfToThreeConverter.ts` — `group.visible=false` (main render το παρακάμπτει) +
    `registerPostFxOverlay(scene, () => root ? [root] : [])` (constructor) / unregister (dispose) + wireframe `depthWrite:false`.
  - `bim-3d/converters/dxf-text-3d.ts` — αφαιρέθηκαν τα band-aids `depthTest:false`/`renderOrder=999`·
    το text ενοποιήθηκε στο overlay pass (depth-correct, `depthWrite:false`).
  - `bim-3d/gizmo/bim-gizmo-overlay.ts` — decoupling `.visible`→**`active`/`snapShown`/`basePointShown`** flags
    (root objects κρατιούνται `visible=false`· public `get visible()` → `active`, ΜΗΔΕΝ regression σε hit-test/
    handlers)· `registerPostFxOverlay(scene, () => collectOverlayRoots())` / unregister (dispose).
  - `bim-3d/lighting/ssao-modulator.ts` — `PostFxOverlayPass` ανάμεσα σε SSAO↔CopyPass (render στο composer
    readBuffer που κρατά το scene depth)· `renderPostFxOverlays` στα `renderRaster()` + `disableSSAO()`.
  - `bim-3d/scene/section-scene-controller.ts` — `renderPostFxOverlays(deps.scene)` μετά τα caps (section mode).

---

## 6. Εύρος / Όρια (Φ1)

- **Τύποι:** line / polyline / circle / arc / **text (✅ β)**. Το text ζωγραφίζεται ως **flat textured-
  plane** (CanvasTexture) στο επίπεδο ορόφου (native units, group-scale → metres)· pick/hover μέσω του
  axis-aligned bbox SSoT (`getEntityBBox`)· grip = center (ΗΔΗ από `computeDxfEntityGrips`) → move ολόκληρης
  της οντότητας. **v1 όριο:** οριζόντιο text (rotation αγνοείται — οι περισσότερες annotations είναι όρθιες·
  rotated → όρθιο, documented follow-up). Font/height/width reuse το 2D SSoT `text-rendering-config.ts`.
- **Single ή στοιβαγμένοι όροφοι (✅ δ):** «Όλοι οι όροφοι» (`floor3DScope==='all'`) → pick/seat/hover σε
  ΟΠΟΙΟΝΔΗΠΟΤΕ όροφο. ΕΝΑ scope SSoT `dxf-3d-floor-scope.ts` (`getDxfFloorScope`/`findDxfEntityInScope`,
  mirror του `resyncDxfOverlay`): single → active scene @Y=0· all → multi-floor stack, κάθε όροφος στο
  datum elevation του. `pickDxfEntityAcrossFloors` τέμνει την ακτίνα με κάθε επίπεδο ορόφου (nearest-wins,
  tie→κάμερα). Seat στο `floorElevationMm` (ο controller+overlay διαβάζουν τα elevation closures → grips/
  ghost/drag/snap ριζώνουν στο σωστό επίπεδο)· commit via `resolveEntityLevelId` (βρίσκει το σωστό level
  cross-floor ήδη). **Όριο:** edit ορόφου που ΔΕΝ είναι στη μνήμη (μόνο Firestore snapshot) → ο commit
  πέφτει στον active level (rare).
- **single-select** (mirror BIM 3D).
- **ΟΛΕΣ οι μονάδες (✅ γ):** mm/cm/m/in/ft. Ο κοινός projector `dxfPlanToWorld` είναι mm-based ενώ το
  wireframe (`DxfToThreeConverter`) ζωγραφίζει raw entity coords scaled ×`sceneUnitsToMeters`. ΕΝΑ factor
  στα boundaries — `dxfUnitToMm = sceneUnitsToMeters × 1000` (SSoT `scene-units.ts`): seat/ghost/outline
  ×unitToMm → mm· pick: cursor-mm ÷unitToMm → entity units· commit: deltaMm ÷unitToMm → entity units
  (το `gripToVertexRefs` είναι index-based, μόνο το delta χρειάζεται μετατροπή). **Κανένας δεύτερος
  projector**, ο shared ADR-535 controller δουλεύει σε mm αμετάβλητος. mm → factor 1 (no-op).
- **Arc ghost:** ✅ Φ1.1 — το τόξο-ghost ακολουθεί live (centre/mid → rigid translate· start/end →
  bulge-preserving recompute), πιστό στο (διορθωμένο) commit.

---

## 7. Έλεγχοι / Tests

- 4 colocated jest suites (23 tests): `rawDxfReshapeGrips`, hit-test pure core, `buildDxfGhostSegments`, `commitDxfGrip3D`.
- **Φ1.1:** +arc ghost cases (`dxf-grip-ghost-paint`), +`arcFromMovedEndpoint` (`geometry-arc-utils`),
  +arc commit regression (`stretch-entity-transform-arc`). 35 tests στα σχετικά suites GREEN.
- **γ (non-mm units):** +`scene-units-dxf-unit-to-mm` (dxfUnitToMm/dxfSceneUnitToMm round-trip),
  +non-mm cases σε `dxf-entity-outline` / `dxf-grip-ghost-paint` / `grip-3d-dxf-commit`, +`scaleDxfGripsToMm`
  (`grip-3d-dxf-raw-grips`). 48 tests στα 6 σχετικά suites GREEN.
- **δ (multi-floor):** +`dxf-3d-floor-scope` (getDxfFloorScope/findDxfEntityInScope single+all),
  +`nearestDxfEntityDetailed` (`dxf-wireframe-hit-test`). 56 tests στα 7 σχετικά suites GREEN. Το
  `pickDxfEntityAcrossFloors` (ray∩plane) browser-verified (jsdom δεν δίνει getBoundingClientRect).
- **β (text):** +text bbox pick (`dxf-wireframe-hit-test`) + text outline (`dxf-entity-outline`) +
  `dxf-text-3d` guard (empty/whitespace → null· το mesh είναι browser-verified, jsdom δεν έχει 2D canvas).
  62 tests στα 8 σχετικά suites GREEN.
- 🔴 Browser-verify (Giorgio): επιλογή DXF στο 3D → λαβές ίδιες με 2D + ενοποιημένη επιλογή· drag+ghost+OSNAP·
  άφημα → resync + 1 undo· arbitration BIM↔DXF· empty → clear.
- Pre-commit CHECK 6B/6D: stage ADR-537 (+ ADR-535 αν χρειαστεί) μαζί με τα 3D/canvas αρχεία.

---

## Changelog

- **2026-07-06 — Φ2: ίχνη ευθυγράμμισης + λευκές ενδείξεις (HUD) στο 3D grip drag (parity με 2D, full SSoT).**
  Στο 3D raw-DXF grip drag εμφανίζονται πλέον τα **ΙΔΙΑ** λευκά/Polar AutoAlign ίχνη + intersection halos +
  tooltip **ΚΑΙ** οι λευκές ενδείξεις (μήκος + ∠γωνία) με το 2D — για **κορυφές ΚΑΙ μέσα** (segment-midpoint
  slide «λαβές των μέσων») σε line/polyline. Πριν: το 3D grip drag έδειχνε μόνο grip squares + μπλε ghost.
  **Full SSoT — μηδέν νέα μηχανή:**
  - **Εξαγωγή κοινού SSoT επιλογής** (`systems/grip/grip-drag-alignment-role.ts`, νέο): `GripAlignmentRole`
    (minimal κοινό view 2D `dp` ↔ 3D `GripInfo`, `anchorPos≡grip.position`, `isRotation` από το glyph-registry SSoT),
    `resolveGripAlignmentAnchors` (base-point move · line endpoint · polyline vertex/edge-slide, arc-apex εξαιρείται),
    `resolvePolylineHudSegments` (edge-slide vs vertex-incident), `gripInfoToAlignmentRole`. Η λογική «ποιες anchors /
    ποια σκέλη» ζούσε **inline** στα 2D helpers — τώρα ΜΙΑ πηγή, thin adapters και στις δύο πλευρές (μηδέν διπλότυπο).
  - **2D helpers → thin adapters:** `grip-ghost-preview-overlay-helpers.ts` (`paintGripActionAlignmentTraces`) +
    `grip-ghost-preview-hud-helpers.ts` (`drawMemberGripHud` polyline branch) καλούν το extract (BIM-footprint
    fallback μένει 2D-only). Συμπεριφορά **αμετάβλητη** (298 tests πράσινα).
  - **3D γεωμετρία HUD:** `bim-3d/grips/dxf-grip-ghost-paint.ts` → export `buildDxfGripReshapedVertices`
    (reshaped INDEXABLE vertices, reuse του «which vertices move» SSoT του ghost· `reshapedPolylineVertices` core).
  - **2 νέα passes (ADR-555 dispatch, resolve-in-draw, μηδέν αλλαγή στον controller → multi-agent-safe):**
    `use-grip-tracking-pass.ts` (traces: resolve σε **native DXF units** → `sceneEntities` περνούν **χωρίς μετατροπή**
    → πλήρη ambient hints· ΙΔΙΟΣ `resolveActionAlignmentTracking` + `tracking-paint` painters + `makePlacementOverlayProjector`,
    byte-parity με `use-bim3d-wall-placement`) + `use-grip-hud-pass.ts` (HUD σε plan-mm· ΙΔΙΟ `paintWallHudCore`+
    `paintProjectedAlignedDim`, mirror `use-wall-hud-pass`). Registered στο `BimOverlayDispatchCanvas` (z-order:
    grip → grip-tracking → grip-HUD).
  - **Tests:** +17 `grip-drag-alignment-role.test.ts`, +5 `dxf-grip-ghost-paint.test.ts`. Jest μόνο (N.17).
  - **Απόφαση Giorgio (2026-07-06):** τα ίχνη στα «μέσα» ξεκινούν από το σημείο που έπιασες (base-point move),
    ΟΧΙ από τις γείτονες κορυφές — ΙΔΙΑ σημασιολογία με το 2D. **Full parity (ambient συμπεριλαμβανόμενο).**
  - **Related:** ADR-561/508/543/555 (2D SSoT + overlay dispatch).

- **2026-07-05 (Option 2) — Full NaN-safe bounds consolidation + pre-commit ratchet (μηδέν raw NaN-τυφλό site).**
  Το αρχικό fix δρομολόγησε 4 sites· ο audit βρήκε **12 ακόμη raw `new THREE.Box3().setFromObject(obj)` +
  `.isEmpty()`** production sites (NaN-τυφλά — μπορούσαν να ξανα-δηλητηριάσουν την ΚΟΙΝΗ κάμερα / section box).
  **Route (11 sites) → `finiteBox3FromObject`** (null-guard κατά τοπική σημασιολογία, μηδέν αλλαγή fallback):
  `systems/section/section-cap-geometry.ts` (🔴 cap sizing), `converters/mesh-to-object3d.ts` (anchor bbox),
  `animation/bim3d-edit-interaction-helpers.ts` (`findBimEntityWorldBox`),
  `library/bim-mesh-library/mesh-footprint-recentre.ts`, `accessibility/FocusOutlineRenderer.ts`,
  `accessibility/focus-order.ts` (×2), `bim/structural/detail-sheet/render/{slab,footing,column,beam}-detail-3d-capture.ts`
  (offscreen capture cameras — ασφαλή). **Dead-code sweep (site #12):** `scene/DxfFloorPlanOverlay.ts`
  **διαγράφηκε** — superseded από `DxfToThreeConverter` (single-color MVP), μηδέν importers/barrel/test
  (χειροκίνητο transitive grep· knip αγνοεί dxf-viewer). **Ratchet (N.12):** NEW `.ssot-registry.json` module
  `nan-safe-box3-bounds` (tier 3) που μπλοκάρει `\.setFromObject\(` σε νέο κώδικα, **allowlist** μόνο το
  `bim-3d/scene/finite-bounds.ts` (η μόνη νόμιμη χρήση)· test files global-exempt. Μετά migration = **0
  violations** (grep-verified). Tests: υπάρχον `finiteBox3FromObject` describe καλύπτει το SSoT contract
  (NaN→null / finite→box / empty→null, 11/11 GREEN)· `test:registry-golden` 56/56 (ERE validity). ΟΧΙ tsc (N.17).
  🔴 Giorgio: `npm run ssot:baseline` (0-violation module, formal register) + commit.
- **2026-07-05 — FIX: άδειος 3D καμβάς (ΟΥΤΕ DXF ΟΥΤΕ BIM) — NaN bounds → NaN κάμερα.**
  **Root cause (Giorgio console error):** μία οντότητα με μη-πεπερασμένη συντεταγμένη έβαζε `NaN` στο
  position buffer του underlay → `DxfToThreeConverter.getBounds()` (`new Box3().setFromObject`) γύριζε
  **NaN box**. Κρίσιμο: το `Box3.isEmpty()` είναι **NaN-τυφλό** (`max < min` = `false` όταν NaN) → το NaN
  box περνούσε το `!isEmpty()` guard σε `applyDxfOverlayFraming` → `viewport.frameBounds(NaN…)` → η
  **ΚΟΙΝΗ κάμερα** έπαιρνε NaN position/target → NaN view/projection matrix → **όλη η σκηνή (DXF + BIM)
  εξαφανιζόταν**. Δεύτερη εκδήλωση: το ίδιο NaN-τυφλό pattern στο `unionSceneBounds`
  (`setFromObject(bimGroup)`) από BIM οντότητα με NaN συντεταγμένη → NaN section box.
  **Fix (3 επίπεδα, SSoT + defense-in-depth N.7.2):**
  1. **Πηγή (DXF):** `DxfToThreeConverter.pushSeg` απορρίπτει segment με μη-πεπερασμένη συντεταγμένη
     (chokepoint για line/circle/arc/polyline)· ο text loop απορρίπτει (και κάνει dispose) mesh με NaN θέση.
  2. **SSoT NaN-safe bounds:** NEW `bim-3d/scene/finite-bounds.ts` (`finiteBox3FromObject` +
     `isFiniteBox3`) — ΕΝΑ σημείο που κάνει `setFromObject` + finite-check → `null` σε empty/non-finite.
     Δρομολογήθηκαν ΟΛΑ τα bounds-from-object sites: `DxfToThreeConverter.getBounds`, `unionSceneBounds`,
     `computeSceneFramingBounds`, `computeBimSelectionBounds` (κατάργηση 4× inline NaN-τυφλού pattern, N.0.2).
  3. **Sink (κάμερα):** finite-guard στο `viewport-camera.ts frameBounds` — ΠΟΤΕ δεν κινεί την κάμερα σε
     μη-πεπερασμένο target· μία φύλαξη προστατεύει ΚΑΘΕ caller (DXF fit / frame-selection / animation).
  Αρχεία: `DxfToThreeConverter.ts`, NEW `scene/finite-bounds.ts`, `scene/section-scene-bounds.ts`,
  `scene/scene-framing-bounds.ts`, `viewport/viewport-camera.ts`, NEW test
  `converters/__tests__/dxf-to-three-nan-guard.test.ts` (8 tests). **Εκκρεμεί (ξεχωριστό data bug):** η
  BIM οντότητα που παράγει NaN geometry — το defense εμποδίζει το μαύρισμα, αλλά το THREE console warning
  θα μένει μέχρι να βρεθεί η πηγή. **Dev locator** (στο `finite-bounds.ts`, gated ως το `dxf-no-shadows`):
  στην κονσόλα `localStorage.setItem('dxf-nan-locate','1')` + toggle 2D↔3D → τυπώνει `bimType`/`bimId`
  της οντότητας-φταίχτη ώστε να διορθωθεί ο ακριβής converter στην πηγή.
- **2026-07-05 (follow-up A) — auto-fit fallback (ποτέ χειροκίνητο `F` στην πρώτη είσοδο).**
  Το αρχικό camera-fit κρεμόταν ΜΟΝΟ από τα DXF-overlay bounds (`applyDxfOverlayFraming`)· BIM-only σκηνή
  ή degenerate DXF (null bounds) → καμία αρχική εστίαση → ο χρήστης έπρεπε να πατήσει `F`. NEW
  `ThreeJsSceneManager.ensureInitialCameraFit()` (από `syncBimEntities` + `syncBimEntitiesMultiFloor`):
  ΜΟΝΟ όταν `dxfConverter.getBounds()` = null (DXF απών/degenerate) εστιάζει στα combined BIM∪DXF bounds
  (`getSceneFramingBounds`, NaN-safe)· μοιράζεται το ΙΔΙΟ `initialCameraFitDone` latch (fires ≤1×, δεν
  παλεύει με DXF path ή restored pose ADR-400). Το `getBounds()` guard κρατά το DXF path **primary** — η
  κανονική DXF-present ροή αμετάβλητη. Reuse του blessed `viewport.frameBounds` (ViewCube synced — μηδέν
  επανάληψη του reverted camera-fit regression). Αρχείο: `scene/ThreeJsSceneManager.ts`.
- **2026-06-27 — wall-placement overlay parity (mustard fix + 2D-parity snap + dynamic input) (uncommitted).**
  Τρία προβλήματα στη σχεδίαση τοίχου στο 3D (Giorgio), λυμένα με FULL SSoT (καθρέφτης του column ADR-544):
  1. **Wall ghost μουσταρδί** — ο `WallPlacementGhost` ήταν translucent `MeshStandardMaterial` στο main
     scene χωρίς εγγραφή → AO/warm-light tint στο idle (ΙΔΙΑ ρίζα με underlay/gizmo). FIX: εγγραφή στο
     **`post-fx-overlay-pass`** (root `visible=false`, flag-based show, provider) + αλλαγή σε **unlit
     `MeshBasicMaterial`** (ο pass ζωγραφίζει κάθε root standalone χωρίς φώτα → lit material θα έβγαινε
     μαύρο· flat translucent = σωστό CAD-ghost + μηδέν PBR blend → μηδέν μουσταρδί), `depthTest:true`/
     `depthWrite:false`. +2 colocated jest (`WallPlacementGhost` registration/dispose).
  2. **3D OSNAP «κύβος» (μουσταρδί + διπλότυπο)** — ο `PlacementSnapMarker` (wireframe BoxGeometry) ήταν
     παράλληλος μηχανισμός, ΟΧΙ 2D-parity. **ΑΦΑΙΡΕΘΗΚΕ από το wall placement** (παραμένει για MEP/
     furniture — follow-up): το `use-bim3d-wall-placement` δημοσιεύει πλέον το OSNAP `SnapIndicatorView`
     (από το ΗΔΗ-υπάρχον `resolvePlacementSnapWithView`, μία engine query) στο **κοινό `Snap3DOverlayStore`**
     → ζωγραφίζεται από το ΗΔΗ-υπάρχον ADR-542 `BimSnapIndicatorOverlay3D` (ίδιο ┘/▲/⊕ glyph+label με 2D
     & κολόνα). Ο `BimCrosshairOverlay3D` (που διαβάζει το ίδιο store) τώρα «κουμπώνει» και στη σχεδίαση
     τοίχου — bonus parity. Guard στον `use-bim3d-pointer-handlers.updateSnap3D`: ο hover υποχωρεί ΚΑΙ για
     `'wall'` (όχι μόνο `'column'`) ώστε ο placement hook να είναι ο μοναδικός κάτοχος του glyph.
  3. **Δυναμικές ενδείξεις (Radial Command Ring)** — έλειπε στο 3D. Mount του **ΙΔΙΟΥ** 2D SSoT
     `RadialCommandRing` (ADR-513) μέσω νέου thin leaf `bim-3d/viewport/DynamicInput3DLeaf.tsx` (gate:
     dynInput ON + wall `awaitingEnd`· self-driven από window mousemove· το lock Μήκους/Γωνίας τρέφει το
     ΙΔΙΟ `generateWallPreview` → ο 3D ghost υπακούει). Ο 2D `DynamicInputSubscriber` **υποχωρεί σε 3D**
     (`selectIs3D` gate) → ΠΟΤΕ δύο rings (διπλά window intercepts). Το linear Dynamic Input (L/θ) ΔΕΝ
     mountάρεται στο 3D (καμία 3D χρήση· το 3D wall HUD ήδη δείχνει μήκος/γωνία).
  Αρχεία: `WallPlacementGhost.ts`, `use-bim3d-wall-placement.ts`, `use-bim3d-pointer-handlers.ts`,
  `DynamicInputSubscriber.tsx`, `BimViewport3DCanvasOverlays.tsx`, NEW `DynamicInput3DLeaf.tsx`,
  `wall-preview-store.ts` (NEW pure SSoT `isWallAwaitingEnd` — εξάλειψη διπλότυπου gate), +tests.
  **🔴 Browser-verify (Giorgio):** (α) ghost μπλε flat, ΟΧΙ μουσταρδί· (β) έλξη = επίπεδο glyph «Γωνία/
  Μέσο τοίχου», ΟΧΙ κύβος· (γ) μετά το 1ο κλικ → radial ring (Μήκος/Γωνία/Πάχος/Ύψος) όπως 2D, ΕΝΑ μόνο.
  **Ανοικτά (browser-repro ΠΡΙΝ αλλαγή — handoff):** ghost «μακριά από κέρσορα» (audit ΔΕΝ βρήκε δομικό
  offset) + «crosshair δεν φαίνεται».
- **2026-06-27 — ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ ΟΛΩΝ των placement ghosts (Giorgio order «τα κεντρικοποιείς και αυτά»).**
  Προϋπάρχον διπλότυπο που εντοπίστηκε στο SSoT audit: **11 placement ghosts** κουβαλούσαν byte-identical
  translucent-material + scene add/remove + `userData={}`/`raycast=noop` + geometry disposal, ΚΑΙ ΟΛΟΙ
  χρησιμοποιούσαν lit `MeshStandardMaterial` → **ίδια μουσταρδί ρίζα** στο idle SSAO path (μη-εγγεγραμμένοι
  στο post-fx pass). **NEW SSoT `bim-3d/placement/placement-ghost-overlay.ts`** (`PlacementGhostOverlay`):
  unlit `MeshBasicMaterial` + `registerPostFxOverlay` + flag-based show (root `visible=false`) + non-pickable
  + disposal, ΕΝΑ μέρος. Migrated: Wall, Column, MepFixture, MepSegment, MepManifold, MepRadiator, MepBoiler,
  MepWaterHeater, ElectricalPanel, Furniture, BeamFromWall (κάθε ghost κρατά ΜΟΝΟ το build logic + bridge
  store + entity cache· delegate material/scene/register/show/dispose). Παραλλαγές καλυμμένες: `setColor`
  (MepSegment/MepManifold dynamic palette)· `disposePrevMaterials` (BeamFromWall fresh per-piece cutback
  materials — OFF by default για singleton-safe converters)· `showForWall`/`hide` wall-ref reuse (Beam).
  +NEW `placement-ghost-overlay.test.ts` (5)· ColumnPlacementGhost/BeamFromWallGhost tests ενημερώθηκαν στο
  νέο overlay contract (visibility μέσω `collectPostFxOverlayRoots`, όχι `mesh.visible`). 120 jest GREEN
  σε 20 placement suites. Τα δικά μου αρχεία tsc-clean (project exit 2 = προϋπάρχοντα errors ΑΛΛΩΝ agents).
  **🔴 Browser-verify (Giorgio):** όλοι οι ghosts (κολόνα/MEP/έπιπλα/δοκάρι) μπλε-flat στο settle, ΟΧΙ
  μουσταρδί. **Follow-up (ΟΧΙ duplicate — design parity):** ο 3D OSNAP «κύβος» (`PlacementSnapMarker`)
  παραμένει στα MEP/furniture placement hooks· αντικατάσταση με το ADR-542 glyph όπως ο τοίχος = ξεχωριστό
  task. Stage μαζί: ADR-537 (+ADR-040/542/513· CHECK 6B/6D).
- **2026-06-27 — proposal-ghost mustard fix + canonical disposal SSoT (Giorgio deeper SSoT audit).**
  Βαθύτερο grep audit (κάθε `*Ghost`/`*Preview` + κάθε translucent `MeshStandardMaterial` σε ΟΛΗ την app)
  βρήκε **ΑΛΛΟ subsystem** με την ίδια μουσταρδί ρίζα: ο AI MEP proposal ghost
  (`proposal-ghost-3d-builders.ts` translucent `MeshStandardMaterial` + `ProposalGhost3DOverlay.tsx`
  `scene.add(group)` ΧΩΡΙΣ post-fx registration). FIX: unlit `MeshBasicMaterial` + `registerPostFxOverlay`
  (group `visible=false`). (`OpeningHostWallPreview` + `Bim3DEditLivePreview` ελέγχθηκαν → ΔΕΝ είναι
  ghosts, κάνουν swap πραγματικών committed meshes· σωστά αμετάβλητα.) **FULL ENTERPRISE + FULL SSoT
  (Giorgio «όπως Revit/Maxon»):** το idiom `root.traverse(o => o.geometry.dispose())` (transient
  preview/ghost teardown) κεντρικοποιήθηκε σε NEW `bim-3d/scene/dispose-object-tree.ts`
  (`disposeObjectTree(root, { materials? })` — geometry πάντα· materials+textures opt-in όταν ο caller
  τα κατέχει· singleton-safe default). Migrated: `placement-ghost-overlay`, `ProposalGhost3DOverlay`
  (materials:true), `Bim3DEditLivePreview` (10 call-sites), `OpeningHostWallPreview`. Τα single-resource
  disposers (`this.marker.geometry.dispose()`) ΔΕΝ αγγίχτηκαν (δεν είναι tree-walk). +NEW
  `dispose-object-tree.test.ts` (5). 37 suites / 304 jest GREEN, δικά μου tsc-clean.
- **2026-06-27** — Φ1 implemented (uncommitted). Νέο raw-DXF 3D grip subsystem πάνω στην υποδομή ADR-535,
  full SSoT με 2D (grips/commit/selection). 23 jest GREEN. Browser-verify + commit εκκρεμούν.
- **2026-06-27** — Φ1.1 (uncommitted): **arc ghost** + 🔴 **deg/rad commit fix**. Trace του full pipeline
  (`grip-to-vertex-refs` → `stretch-entity-transform`) αποκάλυψε ότι το single-endpoint/midpoint arc reshape
  αντιμετώπιζε τις γωνίες ως ακτίνια ενώ αποθηκεύονται σε μοίρες → παραμόρφωση (2D+3D). Νέο SSoT
  `arcFromMovedEndpoint`· delegation commit ΚΑΙ ghost στον ίδιο helper (preview ≡ commit). **Πλήρης
  tessellation SSoT:** ΕΝΑΣ canonical sampler (`bim-3d/converters/dxf-arc-circle-sample.ts`) για wireframe +
  outline + ghost (το `appendEntitySegments` ενοποιήθηκε, output-identical)· +dedup `DXF_UNIT_TO_METRES` →
  `sceneUnitsToMeters`. 82 jest στα σχετικά suites GREEN. Browser-verify + commit εκκρεμούν (Giorgio).
- **2026-06-27** — **γ (non-mm units)** implemented (uncommitted). Αίρεται το «mm scenes μόνο» gate σε
  ΟΛΑ τα boundaries μέσω ΕΝΟΣ SSoT factor `dxfUnitToMm`/`dxfSceneUnitToMm` (`utils/scene-units.ts`,
  `= sceneUnitsToMeters × 1000`, linked με το `dxfPlanToWorld` ×0.001 ώστε να μην αποκλίνουν). Νέος pure
  `scaleDxfGripsToMm` (`grip-3d-dxf-raw-grips.ts`)· optional `unitToMm` params σε `buildDxfGhostSegments` /
  `dxfEntityOutlineSegments` / `commitDxfGrip3D` (default 1 = mm no-op, υπάρχοντα tests αμετάβλητα). Wiring:
  `use-bim3d-dxf-edit-interaction` (seat ×unitToMm, commit ÷unitToMm, gate removed), `pickDxfEntityAt`
  (cursor/tol ÷unitToMm, gate removed), `BimGripOverlay2D` + `DxfHoverGlowOverlay2D` (×unitToMm). Κανένας
  δεύτερος projector, ο shared ADR-535 controller άθικτος. 48 jest στα 6 σχετικά suites GREEN. Browser-verify
  (φόρτωσε cm/m DXF → grips/hover/pick ευθυγραμμισμένα, όχι 1000× off) + commit εκκρεμούν (Giorgio).
- **2026-06-27** — **δ (multi-floor edit/hover)** implemented (uncommitted). Στο «Όλοι οι όροφοι»
  (`floor3DScope==='all'`) το pick/seat/hover δουλεύει σε ΟΠΟΙΟΝΔΗΠΟΤΕ στοιβαγμένο όροφο, όχι μόνο τον
  active. ΕΝΑ scope SSoT `bim-3d/scene/dxf-3d-floor-scope.ts` (`getDxfFloorScope`/`findDxfEntityInScope`,
  mirror του `resyncDxfOverlay` — ίδιο scope flag, what-you-see=what-you-pick). Νέο `pickDxfEntityAcrossFloors`
  (ray∩κάθε επίπεδο ορόφου στο `floorElevationMm×0.001`, nearest-wins, tie→κάμερα)· `pickDxfEntityAt`=
  single-floor wrapper. Ο edit hook seat-άρει στο floor elevation (controller+overlays διαβάζουν τα elevation
  closures ⇒ grips/ghost/drag/snap στο σωστό επίπεδο ΔΩΡΕΑΝ)· commit μέσω `resolveEntityLevelId` (ήδη
  cross-floor)· +re-seat subs (scope toggle + multi-floor stack). Overlays (ghost+glow) resolve-άρουν via
  `findDxfEntityInScope`. Κανένα regression στο single scope (elev 0). 56 jest στα 7 σχετικά suites GREEN +
  targeted tsc clean. Browser-verify (Όλοι οι όροφοι → hover/edit σωστός όροφος/υψόμετρο) + commit εκκρεμούν.
- **2026-06-27** — **β (text σε 3D)** implemented (uncommitted). Λύνεται ο blocker «text skip στο
  `appendEntitySegments`»: νέο `bim-3d/converters/dxf-text-3d.ts` `buildDxfTextMesh` ζωγραφίζει το text ως
  **flat CanvasTexture-on-plane** στο επίπεδο ορόφου (native units → group scale), reuse του 2D SSoT
  `text-rendering-config.ts` (font/height/width· μηδέν διπλό text-metrics). `DxfToThreeConverter` text pass +
  disposal (Mesh geo+mat+texture). Pickable/hoverable: `distanceToDxfEntityMm`/`dxfEntityOutlineSegments`
  case 'text' = bbox (SSoT `getEntityBBox`, ίδιο box pick==glow). Grip = center (ΗΔΗ) → move. **v1:**
  οριζόντιο text (rotation follow-up). 62 jest στα 8 σχετικά suites GREEN + targeted tsc clean.
- **2026-06-27** — **β fixes (browser-verify, Giorgio)** — δύο runtime προβλήματα, διαγνωσμένα με temp logs:
  1. **«στο κείμενο δεν υπάρχει λαβή»:** pick ✓ + seat ✓ (gripCount 1) + projection ✓ (έγκυρο screen) →
     το αίτιο ήταν **occlusion**: οι λαβές του raw-DXF underlay είναι ΟΛΕΣ σε ΕΝΑ επίπεδο (Y=0), οπότε ο
     ADR-535 depth-occluder (σχεδιασμένος για BIM top/bottom faces) τις mis-culls (coplanar @ grazing
     angle / πάνω από BIM solid). FIX: **skip occlusion για raw-DXF επιλογές** στο `BimGripOverlay2D`
     (`dxfGhostEntityId !== null` → `visibility = null`), όπως ο 2D καμβάς (μηδέν grip occlusion). Καμία
     αλλαγή στον shared occluder. Controller hit-test (`isGrip3DVisible`) → null = όλες pickable.
  2. **«το κείμενο σε κάποιες γωνίες/zoom εξαφανίζεται — κάτι το σκεπάζει»:** z-fight/occlusion του flat
     text quad (coplanar Y=0 με wireframe/BIM base). FIX: `depthTest:false` + `renderOrder=999` στο
     `dxf-text-3d.ts` → always-visible annotation (Revit/CAD convention).
  3. **«το αριστερό σκέλος του Π κόβεται» (ΠΕΤΡΟΣ→ΓΕΤΡΟΣ):** ο texture canvas διαστασιολογούνταν με
     εκτίμηση `estimateTextWidth` (0.6×h) — στενός για φαρδιά κεφαλαία (Π) → clipping με `textAlign:center`.
     FIX: `ctx.measureText` για ΠΡΑΓΜΑΤΙΚΟ πλάτος + padding· ο καμβάς ΚΑΙ το plane παίρνουν αυτές τις
     διαστάσεις (px→units ίδιος factor, μηδέν distortion/clip).
  4. **(Giorgio insight) «και οι 2D οντότητες εξαφανίζονται σε γωνίες/zoom»:** ΙΔΙΟ z-fight — το wireframe
     coplanar Y=0 με BIM βάσεις/μεταξύ του. 1η απόπειρα `depthWrite:false` ΜΟΝΟ → νέο artifact: τα fragments
     που έκοβαν στο depth-**test** αναμειγνύονταν ημιδιάφανα με το BIM → «μουσταρδί» απόχρωση σε γωνίες/zoom.
     ΤΕΛΙΚΟ FIX (ίδιο με το text): `depthTest:false` + `depthWrite:false` + `renderOrder=998` στο wireframe
     (`DxfToThreeConverter`) → always-visible underlay (σαν DWG link), πλήρεις γραμμές με το ΔΙΚΟ τους χρώμα,
     μηδέν fight/blend. **Trade-off:** το underlay σχεδιάζεται πάνω από όγκους (όπως το text annotation).
     Browser-verify + commit εκκρεμούν.
- **2026-06-27 — underlay-depth (Revit/Maxon-grade) — ΡΙΖΙΚΗ ΛΥΣΗ, αντικαθιστά τα band-aids παραπάνω.**
  SSoT audit (grep) αποκάλυψε ότι το μουσταρδί/εξαφάνιση **ΔΕΝ ήταν z-fight** αλλά το **idle SSAO composer
  path**: στο settle τρέχει `ssaoModulator.render()` (EffectComposer + `SSAOPass.OUTPUT.Default`) που κάνει
  **multiply το AO πάνω στο beauty**· επειδή το wireframe είναι `transparent opacity:0.65`, ανακατεύεται με
  τη **θερμά-φωτισμένη BIM βάση** (`lighting-presets`: `sunColor:0xffddaa` + `groundColor:0x8b7355` = μουσταρδί)
  και το AO το σκιάζει — ενώ στην κίνηση τρέχει ο raster path (χωρίς SSAO) → σωστό λευκό. Τα band-aids
  `depthTest:false` απέτυχαν γιατί το πρόβλημα είναι pipeline-level, όχι depth. Το text (Mesh) επιβίωνε γιατί
  το `SSAOPass.overrideVisibility` κρύβει μόνο `isLine`/`isPoints`.
  **Λύση όπως Revit/Cinema-4D CAD underlay:** το reference linework δεν είναι shaded geometry — ζωγραφίζεται
  σε **dedicated forward pass ΜΕΤΑ** το lit scene + post-FX, depth-tested στο scene depth (LEQUAL → κερδίζει
  τα coplanar, χάνεται πίσω από τοίχους) αλλά **ποτέ AO/GI/tone**. Νέο SSoT `bim-3d/scene/underlay-pass.ts`
  (`renderUnderlay`/`UnderlayPass`): το underlay root μένει κανονικό child (picking/bounds/section αμετάβλητα
  — raycast/`Box3` αγνοούν `.visible`) αλλά `visible=false` ώστε ο main render να το παρακάμπτει· ζωγραφίζεται
  μόνο του (`renderer.render(root, camera)`) στο readBuffer (composer, ανάμεσα SSAO↔Copy) ή στην οθόνη
  (raster/section), πάντα με `autoClear=false`. wireframe+text ενοποιήθηκαν (band-aids αφαιρέθηκαν,
  `depthWrite:false`). Identical κίνηση≡settle, σε όλες τις γωνίες/zoom.
  **SSoT (Giorgio audit):** το underlay root **δεν** εντοπίζεται με parallel scene-scan/userData — έρχεται από
  τον **owner** μέσω `DxfToThreeConverter.getRoot()` (mirror του `getBounds()`), threaded ως `getUnderlayRoot`
  accessor-dep με το ΙΔΙΟ pattern που ήδη χρησιμοποιεί ο section renderer (`getDxfBounds`/`getBimGroup`).
  9 νέα jest (`underlay-pass`) + converter `getRoot()`/visible assertion. tsc clean. Browser-verify + commit
  εκκρεμούν (Giorgio· stage ADR-537 + ADR-040· CHECK 6B/6D → `DxfToThreeConverter` perf-critical).
- **2026-06-27 — post-FX overlay pass γενίκευση (Giorgio: «το gizmo βάφεται κι αυτό μουσταρδί»).** Ο Giorgio
  παρατήρησε ότι ΚΑΙ οι άξονες του edit gizmo βάφονται μουσταρδί (λευκοί στην κίνηση → μουσταρδί στο settle) —
  **ΙΔΙΑ ρίζα** (ημιδιάφανα μέρη του gizmo, στο main scene, AO-shaded από τον SSAO composer στο idle), προϋπάρχον.
  Αντί για χωριστό fix, **γενικεύτηκε το `underlay-pass.ts` → `post-fx-overlay-pass.ts`**: ΕΝΑΣ μηχανισμός
  «post-FX UI/reference overlay» με **scene-scoped registry** όπου οι owners (converter scene-side, gizmo React-side)
  εγγράφουν τα roots τους. Αφαιρέθηκε το προηγούμενο `getUnderlayRoot` accessor-threading (το registry decouple-άρει
  τους owners — απλούστερο). Το gizmo (`bim-gizmo-overlay.ts`) decouple-άρει `.visible`→`active`/`snapShown`/
  `basePointShown` flags (root objects μένουν `visible=false` ώστε ο main render να τα παρακάμπτει· public
  `get visible()`→`active` ⇒ μηδέν regression σε hit-test/controller/handlers, που ήδη χρησιμοποιούν το public
  accessor)· `updateScale`/`refreshBasePointMarker` δεν gate-άρουν σε `.visible` (τρέχουν κανονικά). underlay
  (depthTest:true) + gizmo (depthTest:false) συνυπάρχουν στο ΙΔΙΟ pass — materials ορίζουν depth, όλα AO-immune,
  identical κίνηση≡settle. 11 jest (`post-fx-overlay-pass`: registry scene-scoped + render + pass) + converter
  registry assertion. Όλα τα gizmo suites GREEN. tsc clean. Browser-verify (gizmo άξονες σωστά χρώματα σε settle/
  zoom + underlay) + commit εκκρεμούν (Giorgio).
