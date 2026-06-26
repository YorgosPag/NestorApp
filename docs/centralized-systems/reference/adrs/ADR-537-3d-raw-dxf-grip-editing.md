# ADR-537 — Επιλογή & επεξεργασία ωμών DXF οντοτήτων με λαβές στην 3D προβολή

**Status:** 🟢 Φ1 IMPLEMENTED (UNCOMMITTED) — line/polyline/circle/arc, single active floor, mm scenes · **Date:** 2026-06-27
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
- `bim-3d/grips/dxf-grip-ghost-paint.ts` — pure `buildDxfGhostSegments` (line/polyline/circle· arc deferred).
- `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts` — το hook (seat/drag/commit/arbitration).

## 5. Τροποποιημένα αρχεία

- `bim-3d/stores/Grip3DOverlayStore.ts` — `dxfGhostEntityId` + `setDxfGhostEntityId` (ghost signal· reset στο setGrips/clear).
- `bim-3d/viewport/grips/BimGripOverlay2D.tsx` — ghost pass (no-op για BIM).
- `bim-3d/viewport/use-bim3d-pointer-handlers.ts` — DXF pick + selection arbitration.
- `bim-3d/viewport/BimViewport3D.tsx` — mount του hook.
- `bim-3d/animation/bim3d-edit-drag-snap.ts` — εξήχθη `syncSnapEngineViewport3D` (SSoT, N.0.2 boy-scout).

---

## 6. Εύρος / Όρια (Φ1)

- **Τύποι:** line / polyline / circle / arc. Το `text` δεν έχει 3D wireframe → αναβάλλεται.
- **Single active floor**, **single-select** (mirror BIM 3D).
- **mm scenes μόνο:** ο κοινός projector `dxfPlanToWorld` είναι mm-based. Σε non-mm DXF το wireframe είναι
  unit-scaled ενώ οι λαβές όχι → το pick/seat **δεν ενεργοποιείται** (gate σε `dxfScene.units`). Full unit
  support = follow-up.
- **Arc ghost:** αναβάλλεται (μόνο το τετράγωνο λαβής ακολουθεί στο Φ1)· το commit του arc λειτουργεί κανονικά.

---

## 7. Έλεγχοι / Tests

- 4 colocated jest suites (23 tests): `rawDxfReshapeGrips`, hit-test pure core, `buildDxfGhostSegments`, `commitDxfGrip3D`.
- 🔴 Browser-verify (Giorgio): επιλογή DXF στο 3D → λαβές ίδιες με 2D + ενοποιημένη επιλογή· drag+ghost+OSNAP·
  άφημα → resync + 1 undo· arbitration BIM↔DXF· empty → clear.
- Pre-commit CHECK 6B/6D: stage ADR-537 (+ ADR-535 αν χρειαστεί) μαζί με τα 3D/canvas αρχεία.

---

## Changelog

- **2026-06-27** — Φ1 implemented (uncommitted). Νέο raw-DXF 3D grip subsystem πάνω στην υποδομή ADR-535,
  full SSoT με 2D (grips/commit/selection). 23 jest GREEN. Browser-verify + commit εκκρεμούν.
