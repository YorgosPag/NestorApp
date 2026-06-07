# ADR-419 — Floor Finish Per Room (Revit-style IfcCovering FLOORING)

**Status**: ✅ APPROVED  
**Date**: 2026-06-06  
**Category**: BIM Entity Systems  
**Related**: ADR-401 (thermal host), ADR-413 (PBR textures), ADR-396 (ETICS covering), ADR-358 (scene units)

---

## 1. Problem

`SlabEntity` έχει ΕΝΑ DNA υλικό για ολόκληρο τον όροφο. Αδύνατο να αποδώσεις διαφορετικό υλικό δαπέδου ανά δωμάτιο (π.χ. πλακάκι στο μπάνιο, ξύλο στο υπνοδωμάτιο, μάρμαρο στο σαλόνι). Revit λύνει αυτό με `IfcCovering FLOORING`: λεπτό ξεχωριστό element πάνω στην πλάκα, ένα ανά δωμάτιο, με δικό του υλικό, hatch, BOQ, IFC type, και θερμική συμβολή.

---

## 2. Decision

- **`FloorFinishEntity`** — νέο BIM entity `type='floor-finish'`, `ifcType='IfcCovering'`
- **Structural slab αναλλοίωτο** — `SlabEntity` δεν αγγίζεται
- **Polygon footprint** (Polygon3D) — ένα ανά δωμάτιο, CCW, world coords mm
- **Material catalog SSoT** — 8 built-in υλικά με λ/ρ/cp/color/hatch/pbrSlug
- **Enterprise ID prefix `ffl_`** — μέσω `enterprise-id-prefixes.ts`
- **Firestore collection**: `floorplan_floor_finishes` (κοινή με άλλες BIM collections)
- **IFC**: `IfcCovering PredefinedType=FLOORING` + `Pset_CoveringCommon`

---

## 3. Material Catalog

| ID | Material | λ (W/m·K) | ρ (kg/m³) | cp (J/kg·K) | Hatch | PBR Slug |
|----|----------|-----------|-----------|-------------|-------|---------|
| `floor-wood-oak` | Δρυς | 0.18 | 700 | 1700 | wood | wood |
| `floor-wood-pine` | Πεύκο | 0.15 | 550 | 1600 | wood | wood |
| `floor-tile-ceramic` | Κεραμικό | 1.00 | 2000 | 840 | tile | tile |
| `floor-tile-marble` | Μάρμαρο | 2.80 | 2700 | 880 | tile | stone |
| `floor-laminate` | Laminate | 0.17 | 900 | 1500 | wood | wood |
| `floor-parquet` | Παρκέ | 0.18 | 700 | 1700 | wood | wood |
| `floor-epoxy` | Εποξειδικό | 0.23 | 1200 | 1000 | solid | — |
| `floor-carpet` | Χαλί | 0.06 | 200 | 1300 | dot | — |

---

## 4. Geometry & Entity Definition

```typescript
interface FloorFinishParams {
  footprint: Polygon3D;        // closed polygon, world coords mm
  materialId: FloorFinishMaterialId;
  thicknessMm: number;          // default 15mm
  finishLevel: number;          // mm offset above slab FFL (default 0)
  name?: string;                // user label
  sceneUnits?: SceneUnits;
  floorId?: string;
}
```

`computeFloorFinishGeometry(params)` — pure derivation:
- `bbox` — BoundingBox3D from footprint vertices
- `area` — m² (Shoelace formula)
- `perimeter` — m

---

## 5. IFC Mapping

```
IfcCovering
  .PredefinedType = FLOORING
  .Name = params.name ?? "Floor Finish"

Pset_CoveringCommon (IfcPropertySet via IfcRelDefinesByProperties)
  .Thickness = thicknessMm / 1000  [IfcLengthMeasure, m]
  .ThermalTransmittance = λ / (thicknessMm/1000)  [IfcThermalTransmittanceMeasure, W/m²K]
    → omitted if lambda unknown (custom material)
```

Σε αντίθεση με ETICS (ADR-396 semantic-only), το floor finish περιέχεται απευθείας στο `IfcBuildingStorey` μέσω `IfcRelContainedInSpatialStructure`.

---

## 6. Rendering

### 2D Canvas
- `FloorFinishRenderer` extends `BaseEntityRenderer`
- Stroke: catalog color, opacity 0.7
- Fill: catalog color, opacity 0.15 (translucent)
- Hatch: `wood` / `tile` / `dot` / `solid` ανά material family
- Grips: 2N grips — N vertex + N edge-midpoint (same as SlabRenderer)
- ADR-040 compliant: zero high-freq subscriptions

### 3D BIM View (ADR-413 PBR)
- `floorFinishToMesh()` — thin extrusion via `buildShape` + `extrudeAndRotate`
- Material: `getMaterial3D(PBR_SLUG_TO_MAT_KEY[pbrSlug])` from ADR-413 registry
- Position Y: `(floorElevationMm + finishLevel) * MM_TO_M + buildingBaseM`
- Units-safe: XY via `sceneUnitsToMeters`, Z via `MM_TO_M`

---

## 7. Persistence

- Firestore collection: `floorplan_floor_finishes`
- Service: `FloorFinishFirestoreService` — `subscribeFloorFinishes / saveFloorFinish / updateFloorFinish / deleteFloorFinish`
- Host: `FloorFinishPersistenceHost` — always-on, mirrors `RoofPersistenceHost`
- Hook: `useFloorFinishPersistence` — 500ms auto-save debounce, diff-merge
- First-save: on `drawing:entity-created` (tool: `'floor-finish'`)
- Delete: on `bim:floor-finish-delete-requested`
- 3D store: `setFloorFinishes()` on `currentScene` change

---

## 8. Ribbon Contextual Tab

- Trigger: `FLOOR_FINISH_CONTEXTUAL_TRIGGER = 'floor-finish-selected'`
- Panels: Material (Radix Select) | Geometry (thicknessMm) | Actions (delete)
- i18n: `ribbon.tabs.floorFinishProperties`, `ribbon.panels.floorFinish*`, `floorFinish.materials.*`

---

## 9. Enterprise ID

| Field | Value |
|-------|-------|
| Prefix | `ffl_` |
| Generator | `generateFloorFinishId()` |
| Module | `enterprise-id-class.ts` |
| Collection | `floorplan_floor_finishes` |

---

## 10. File Structure

```
src/subapps/dxf-viewer/bim/
  types/floor-finish-types.ts          — FloorFinishEntity + computeFloorFinishGeometry
  types/floor-finish.schemas.ts         — (optional Zod)
  floor-finishes/
    floor-finish-material-catalog.ts   — 8 materials SSoT
    floor-finish-grips.ts              — getFloorFinishGrips + applyFloorFinishGripDrag
    floor-finish-firestore-service.ts  — Firestore CRUD
    __tests__/
      floor-finish-material-catalog.test.ts
      floor-finish-grips.test.ts
      compute-floor-finish-geometry.test.ts
  renderers/FloorFinishRenderer.ts     — 2D canvas

src/subapps/dxf-viewer/bim-3d/
  converters/floor-finish-to-three.ts  — 3D mesh

src/subapps/dxf-viewer/hooks/data/
  useFloorFinishPersistence.ts

src/subapps/dxf-viewer/app/
  FloorFinishPersistenceHost.tsx

src/subapps/dxf-viewer/ui/ribbon/
  data/contextual-floor-finish-tab.ts
  hooks/bridge/floor-finish-command-keys.ts

src/services/ifc/serializers/
  ifc-covering-serializer.ts           — +serializeFloorFinishCoverings()
  __tests__/ifc-covering-flooring.test.ts
```

---

## 11. Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-06-06 | v1.0 | Initial implementation — Slices 1–10 complete. Types + catalog + enterprise-id + 2D renderer + grips + scene integration + hit testing + 3D converter + persistence + ribbon contextual tab + IFC serializer + 73 tests. |
| 2026-06-07 | v1.1 | Grips wired into unified grip system (grip-registry + grip-parametric-commits + grip-commit-adapters + apply-entity-preview). DxfViewerContent: useColumnAdjacencyNotification hook added (column merge toast). |
