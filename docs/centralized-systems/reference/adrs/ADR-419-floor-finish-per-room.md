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
| 2026-07-03 | v2.4 | **§region-fill «μία διαδρομή δημιουργίας» — preview ≡ commit 100% + rejected = κόκκινο + ΛΟΓΟΣ (Giorgio, επιλογή Α).** Σύμπτωμα: ο **εντοπισμός** πλαισίων (πράσινες διακεκομμένες) ήταν σωστός, αλλά η **ΔΗΜΙΟΥΡΓΙΑ** τοίχων απέκλινε («δείχνει-αλλά-δεν-φτιάχνει» / «φτιάχνει-αλλιώς»). **Root cause (deep code-trace):** η αλυσίδα **διχαζόταν** μετά το `pick.rects` — το preview (`resolvePerimeterPreview`) ζωγράφιζε το **ωμό `rect.polygon`** (μόνο γεωμετρία), ενώ ο commit (`commitInRegionRects`→`buildFillingWalls`) περνούσε **3 στάδια** που το preview ΔΕΝ έτρεχε: (α) validate (`buildWallFillingRect` → null σε length/thickness reject), (β) `extendFillingWallToNeighbors` (Revit auto-join, επεκτείνει άκρα στους γείτονες), (γ) `addWallToScene` = `computeWallTrims`+`applyTrimPatches` (miter/bevel) + ADR-567 structural-overlap block. **FIX (big-player Revit transaction-preview — «το preview ΕΙΝΑΙ το μοντέλο, μη-δεσμευμένο»· ΕΝΑ SSoT compute, δύο καταλήξεις):** **(1) NEW pure** `bim/walls/filling-walls-compute.ts` → `computeFillingWalls(rects, overrides, sceneUnits, levelId, sceneEntities): {walls, rejected}` — build+validate (**NEW** `buildWallFillingRectResult` στο `wall-in-region.ts`, κρατά τον validator hardError key αντί για null) + `extendFillingWallToNeighbors` + ADR-567 `findStructuralOverlap` guard με το **ΙΔΙΟ incremental scene** (existing + δεκτοί παρτίδας) όπως το `addWallToScene` → μηδέν απόκλιση αποδοχής/απόρριψης. Ο validator key χαρτογραφείται σε φιλικό `regionPerimeter.rejected.*` (lengthTooShort/thicknessTooThick/…), overlap → `occupied`. **(2)** `computeFillingWallFootprints(walls, sceneEntities): Point2D[][]` — τρέχει το ΙΔΙΟ `computeWallTrims`+`applyTrimPatches` **transient** (μηδέν mutation) → επιστρέφει τα ΤΕΛΙΚΑ **mitered** footprints (reuse `collectColumnFootprints`+`wallFootprintPolygon`). **(3) commit** (`use-wall-commit.buildFillingWalls`) refactored να καλεί `computeFillingWalls` (μετά `onWallCreated` ανά τοίχο = authoritative miter+persist — μηδέν διπλο-miter) — **συμπεριφορά ταυτόσημη**. **(4) preview** (`resolvePerimeterPreview`) καλεί το **ΙΔΙΟ** `computeFillingWalls` → πράσινο = ΑΚΡΙΒΩΣ οι τοίχοι που θα χτιστούν (extended+mitered footprints)· `rejected` → κόκκινη ζώνη + tooltip με τον λόγο. **(5)** `RegionPerimeterZone` += optional `reason?: string` (i18n key)· `RegionPerimeterPreviewOverlay` δείχνει κόκκινο + `<title>` tooltip όταν `reason`/`occupied`. **(6) i18n** `regionPerimeter.rejected.*` (lengthTooShort/thicknessTooThick/thicknessInvalid/heightInvalid/occupied/invalid) el+en. **Tests:** NEW `filling-walls-compute.test.ts` **10/10** (build parity με `buildWallFillingRect`, δύο δωμάτια→2 τοίχοι, rejected κοντός→`lengthTooShort` & χοντρός→`thicknessTooThick`, mixed batch, transient miter 1:1 non-mutating)· regression wall-in-region/wall-footprint-decompose/wall-merge/wall-split/wall-validator **97/97** GREEN. tsc SKIP (N.17). CHECK 6B/6D: overlay leaf → stage ADR-040+419. ✅ Google-level: YES — Revit transaction-preview (preview≡commit διά κατασκευής, ΕΝΑ `computeFillingWalls` σε preview+commit), full SSoT (reuse buildWallFillingRectResult/extend/trims/structural-overlap, μηδέν διπλότυπο), rejected διαφανές (κόκκινο+ΛΟΓΟΣ αντί σιωπηλής απόκρυψης). 🔴 browser-verify (hover: πράσινο = ΑΚΡΙΒΩΣ οι τοίχοι που θα γίνουν + κόκκινο+tooltip για rejected· κλικ → ΙΔΙΟΙ τοίχοι) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v2.3 | **§T-junction (άξονας) — κοντός-χοντρός τοίχος έβγαινε άξονα ΠΑΡΑΛΛΗΛΟ αντί ΚΑΘΕΤΟ στον γείτονα (Giorgio, screenshot 164823 + κανόνας).** Κανόνας Giorgio: όταν 2 τοίχοι ενώνονται κάθετα, οι **άξονές τους (centerlines) πρέπει να είναι κάθετοι & να συναντιούνται** — ΑΚΟΜΗ κι όταν ο μικρός είναι 5×10cm (μήκος 5cm, κολλάει με την 10cm παρειά). **Root cause (repro-verified):** ο `buildWallFillingRect` επέλεγε άξονα = **μεγάλη πλευρά**. Για έναν **κοντό-χοντρό** stub (μήκος 5cm < πάχος 10cm) η μεγάλη πλευρά = το ΠΑΧΟΣ → ο άξονας έβγαινε **παράλληλος** στον γείτονα (repro: stub 50×100 → axis VERTICAL, thick=50 — λάθος). Ο `decomposeWallsFromFootprint` ΓΝΩΡΙΖΕΙ ήδη τον προσανατολισμό (H/V) αλλά χανόταν στο `toDetectedRect` (max/min). **FIX (FULL SSoT, backward-compatible):** **(1)** `DetectedRectangle` += optional `axis?: [Point2D,Point2D]` (ΡΗΤΗ centerline)· **(2)** `toDetectedRect(r, ang, orient)` το γεμίζει από τον γνωστό H/V προσανατολισμό (H→κατά X στο y-κέντρο, V→κατά Y στο x-κέντρο)· τα hRects/vRects mapped ΞΕΧΩΡΙΣΤΑ με orient· **(3)** NEW SSoT `detectedRectAxis(rect): {start,end,length,thickness}` — τιμά το ρητό `axis` (μήκος=|axis|, **πάχος=area/μήκος**), αλλιώς corner-graph fallback (μεγάλη πλευρά)· `buildWallFillingRect` το καλεί· **(4) preview≡commit:** `resolvePerimeterPreview` χρησιμοποιεί το ΙΔΙΟ `detectedRectAxis` για filter (μήκος ≥ region-fill floor) + label (μήκος×πάχος) — ο stub μετριέται στον σωστό κάθετο άξονα. Αποτέλεσμα: stub 50×100 → axis **HORIZONTAL** (κάθετος), thick=100· το `extendFillingWallToNeighbors` (v2.2) επεκτείνει το άκρο στον άξονα του μεγάλου → **κάθετη συνάντηση centerlines**. `longSide`/`shortSide` **αμετάβλητα** (max/min) → κολόνες (`rectColumnPlacement`/aspect) ΜΗΔΕΝ επίδραση (το `axis` optional, το αγνοούν). Κανονικοί τοίχοι (μήκος>πάχος): `axis` = μεγάλη πλευρά = ΙΔΙΟ με πριν → μηδέν regression. **Tests:** wall-in-region +2 (explicit axis → perpendicular / no-axis → long-side fallback)· wall-footprint-decompose +1 (CASE 6 fat-stub → άξονας οριζόντιος)· **169/169** GREEN (wall+column+auto-area· CASE 5 T-junction & offset/centered-T αμετάβλητα). ⚠️ Προϋπάρχον fail `add-column-to-scene.test.ts` (column grip-copy, ΑΛΛΟΥ agent — verified fails ΚΑΙ χωρίς τις αλλαγές μου). tsc SKIP (N.17). i18n: καμία. ✅ Google-level: YES — Revit centerline-join rule (κάθετοι άξονες πάντα), full SSoT (ΕΝΑ `detectedRectAxis` σε builder+preview), backward-compatible (optional field, κολόνες/corner-graph ανέπαφα). 🔴 browser-verify (5×10 stub → κάθετος άξονας κολλάει στον μεγάλο) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v2.2 | **§T-junction — ψηλότερος κάθετος κορμός διέκοπτε τον διαμπερή οριζόντιο τοίχο (Giorgio, screenshot 164053).** Σύμπτωμα: σε σχήμα Τ (οριζόντιος 2.65m×0.20 + κάθετος κορμός ~3m×0.10 από πάνω), ο κάθετος **διέκοψε** τον οριζόντιο, δημιούργησε miter, κι άφησε το αριστερό κομμάτι του οριζόντιου χωρίς τοίχο. Ζητούμενο (Revit): ο οριζόντιος = **ΕΝΑΣ ενιαίος** τοίχος, ο κάθετος **κολλάει (butt)** πάνω του. **Root cause (repro-verified στον πραγματικό `decomposeWallsFromFootprint`):** ο κανόνας κυριότητας junction ήταν «**μακρύτερο run κερδίζει**» (`assignOrientations`). Ο κορμός (vRun 3200, συμπερ. bar) > οριζόντιος (hRun 2650) → ο κορμός κέρδιζε το junction cell → ο οριζόντιος έσπαγε σε **1200 + 1350** κι ο κορμός έτρεχε **διαμπερώς (3200)**. **FIX (Revit T-junction, ΑΝΕΞΑΡΤΗΤΑ μήκους):** νέος κανόνας «**ΔΙΑΜΠΕΡΗΣ κερδίζει, ΤΕΡΜΑΤΙΖΩΝ κολλάει**» — κελί με συμπαγή γείτονες **ΚΑΙ στις δύο** πλευρές κατά μια διεύθυνση = διαμπερής εκεί· στο junction κερδίζει ο διαμπερής. Ισοπαλία (σταυρός/άκρο/κανένας διαμπερής) → μακρύτερο run (**προηγούμενη συμπεριφορά** → μηδέν regression). NEW pure helper `isSolidCell` (out-of-bounds guard). Αποτέλεσμα: T ψηλού-κορμού → **2 rects** (οριζόντιος **2650** ενιαίος + κάθετος **3000** που τερματίζει), αντί 3 (σπασμένος). **Εκτός scope:** ο miter/trim στο junction (`wall-trims.ts`) + το `extendFillingWallToNeighbors` παραμένουν — τώρα δουλεύουν σωστά αφού ο οριζόντιος είναι ενιαίος. **Tests:** wall-footprint-decompose +1 (CASE 5 ψηλός κορμός → οριζόντιος ενιαίος)· CASE 3 (offset-T) & CASE 4 (centered-T) **αμετάβλητα** (bar ήταν ήδη ο μακρύτερος → ίδιο αποτέλεσμα). **73/73** (decompose+perimeter+wall-from-perimeter+column-from-faces) GREEN. tsc SKIP (N.17). i18n: καμία. CHECK 6B/6D: όχι → stage ADR-419 μόνο. ✅ Google-level: YES — Revit-faithful T-junction (through-wall continuity), length-independent, zero regression (ισοπαλία = παλιός κανόνας). 🔴 browser-verify (Τ ψηλού-κορμού → οριζόντιος ενιαίος + κάθετος κολλάει, μηδέν αριστερό κενό) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v2.1 | **§region-tolerance (follow-up) — «εντοπίζει σωστά, δημιουργεί λάθος»: κοντά στελέχη ΔΕΝ γίνονταν τοίχοι (Giorgio, screenshot 160316).** Παρατήρηση Giorgio: ο εντοπισμός (preview) βρίσκει σωστά τα πλαίσια αλλά το commit «λείπουν μικρά κομμάτια». **Root cause (trace ΟΛΟΥ του pipeline):** εντοπισμός & δημιουργία **ΔΕΝ** είναι πλήρως κοινός κώδικας — ο εντοπισμός (`pickRegionPerimeterAt`, καθαρή γεωμετρία) είναι κοινός hover+click, ΑΛΛΑ η δημιουργία έχει ΕΝΑ ΕΠΙΠΛΕΟΝ στρώμα που το preview ΔΕΝ τρέχει: `commitInRegionRects`→`buildFillingWalls`→`buildWallFillingRect`→**`buildWallEntity`→`wall-validator`**. Ο validator απορρίπτει hard `length < MIN_WALL_LENGTH_MM (100mm)`. Σε σχήμα Τ, ο κατακόρυφος κορμός (μακρύτερος) κερδίζει το junction (σωστό `decomposeWallsFromFootprint`), οπότε η οριζόντια κεφαλή σπάει σε 2 **κοντά** στελέχη (~50–60mm) → και τα δύο < 100mm → hard-reject → κενά, ΕΝΩ το preview τα έδειχνε (δεν τρέχει validator). **FIX (Giorgio option 3: δημιουργία + preview≡commit, FULL SSoT μέσω παραμετροποίησης — ΟΧΙ global αλλαγή):** **(1) NEW** `REGION_FILL_MIN_WALL_LENGTH_MM = 20` (`wall-types.ts`) — degenerate floor· ο πυρήνας `MIN_WALL_LENGTH_MM=100` μένει για **freehand** (φυλάει από τυχαίο διπλό-κλικ), αλλά στο region-fill κάθε rect είναι **πραγματική εντοπισμένη γεωμετρία**, όχι degenerate. **(2)** `validateWallParams(params, sceneUnits, {minLengthMm?})` + `validateGeometry(..., minLengthMm)` — default `MIN_WALL_LENGTH_MM` → **μηδέν regression** για τους 20+ callers/tests που δεν το περνούν. **(3)** `buildWallEntity(..., {minLengthMm?})` το προωθεί· `buildWallFillingRect` (region-fill builder) περνά `REGION_FILL_MIN_WALL_LENGTH_MM` → **κοντά στελέχη δημιουργούνται**. **(4) preview≡commit:** `resolvePerimeterPreview` (`useRegionPerimeterMouseMove`) φιλτράρει τα `pick.rects` με το ΙΔΙΟ floor (`longSide ≥ 20mm·scale`) → το πράσινο δείχνει ΑΚΡΙΒΩΣ όσα θα κτιστούν (κάτω από 20mm ούτε δείχνεται ούτε κτίζεται· όλα κάτω→null). **Εκτός scope (Giorgio ΔΕΝ το επέλεξε):** ο κορμός που «ξεφεύγει» (`extendFillingWallToNeighbors` Revit auto-join, ≤~150mm) — αμετάβλητο. **Tests:** wall-validator +3 (short 60mm accept@20 / reject@default-100 / degenerate 10mm reject@20)· wall-in-region +2 (build 60×40 / null 15×12)· **35/35** + regression **84/84** (wall-from-perimeter/entity/grid, perimeter-from-faces, wall-region-autojoin, wall-footprint-decompose) GREEN. tsc SKIP (N.17). i18n: καμία (το `lengthTooShort` υπάρχει ήδη). CHECK 6B/6D: όχι overlay/renderer touch → stage ADR-419 μόνο. ✅ Google-level: YES — παραμετροποίηση αντί global-mutation (freehand guard ανέπαφο), preview≡commit διά κατασκευής (ίδιο floor σε validator+preview), full SSoT. 🔴 browser-verify (Τ-region → όλα τα στελέχη γίνονται τοίχοι, μηδέν κενά) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v2.0 | **§region-tolerance — μικρό κλειστό πλαίσιο ΔΕΝ ανιχνευόταν (node-merge collapse), FULL SSoT (Giorgio, screenshot 143935).** Σύμπτωμα: με `wall-region-inside` σε exploded κάτοψη, ένα μικρό magenta κουτί (μικρή πλευρά < ~50mm) **δεν έβγαζε πράσινη preview** ενώ οι μεγάλοι τοίχοι ναι. **Root cause (εμπειρικά επαληθευμένο με repro στον πραγματικό `findClosedPolygonsFromLines`, ΟΧΙ υπόθεση):** το `resolveRegionLoopTolWorld` επέστρεφε `max(pixel, LOOP_JOIN_TOLERANCE_MM=50mm)` και το περνούσε **ΚΑΙ ως node-merge ΚΑΙ ως gap-closure** (`buildPolygonLoops(pairs, tol, tol)`). Το node-merge στα ≥50mm **συγχωνεύει τις απέναντι κορυφές** κάθε κλειστού feature με πλευρά < tol → degenerate → κανένα loop. (Repro: κουτί 300×40 @merge=50→**0 faces**· @merge=10,gap=50→**1 face**· gapped-rect κενό-30mm @merge=10,gap=50→**κλείνει ακόμα** μέσω bridge). Το `auto-area-hit.ts` είχε ΗΔΗ λύσει το ταυτόσημο (ADR-507 §5β.3) με `min(pixel,50)` (CAP) + χωριστό gapTol — το region path έμεινε πίσω με λάθος `max`. **FIX (SSoT, ευθυγράμμιση με auto-area, μηδέν νέος μηχανισμός):** **(1) NEW** `resolveRegionLoopTolerances(sceneUnits): {mergeTol, gapTol}` (`region-tolerance.ts`) — `mergeTol=min(pixel,50)` (node-merge = ιδιότητα δεδομένων, capped), `gapTol=50mm` floor (HPGAPTOL bridge — ΠΡΟΣΘΕΤΕΙ ακμή, δεν καταρρέει κόμβους). Το `resolveRegionLoopTolWorld` μένει (corner-graph/diagnostics). **(2)** thread του capped `mergeTol` στο `perimeter-from-faces.ts`: `buildPolygonLoops(segs, mergeTol, gapTol)` → `findClosedPolygonsFromLines(mergeTol, gapTol)`· `extractClosedPolygons(entities, tol, mergeTol=tol)` (+polygonKey dedup στο mergeTol)· `perimeterFacesToRects(…, {mergeTol?})` — ΟΛΟ το downstream shape-math (`classifyPerimeter`/`decomposeWallsFromFootprint` grid+degenerate-filter/`normalize`) τρέχει στο **ψιλότερο `feat=mergeTol??tol`** (αλλιώς πλευρά < gap-floor φιλτράρεται ως degenerate → χάνει τα σκέλη)· `getCachedRegionPerimeters(…, mergeTol=tol)` (mergeTol στο cache-key)· `pickRegionPerimeterAt` → `resolveRegionLoopTolerances`. **Default `mergeTol=tol` → μηδέν αλλαγή για single-tol callers/tests.** **(3)** `use-wall-region-clicks.ts` — το CLICK 'inside' δρομολογεί ΚΑΙ το **απλό** εσώκλειστο (rects **≥1**, πρώην >1) μέσω του διορθωμένου loop detector· ο corner-graph `fillEnclosingRectAt` μένει ΜΟΝΟ ως fallback (rects=[]) → **preview ≡ commit** (πριν: hover=loop έδειχνε, click=corner-graph κατέρρεε το κουτί). Fixes αυτόματα ΚΑΙ `column-region-inside` + thermal-space (ίδιο `pickRegionPerimeterAt`). **Known-latent (εκτός scope, τεκμηριωμένο):** box-select «από περίγραμμα» (`perimeterFacesToColumns`/wall box-select listener) + plain-`wall`/`column` corner-graph (`findRectanglesFromSegments`/`mergeNodes` + `rectFromCorners` degenerate `<tol`) έχουν το ίδιο root — κρατούν `resolveRegionLoopTolWorld` (floor), default `feat=tol` → αμετάβλητα (μηδέν regression)· wiring capped mergeTol = follow-up. **Tests:** perimeter-from-faces +6 (small-box 300×40 collapse@50 vs detect@merge10 σε γεω-coords ~1e7, pick-inside, gap-closure επιβιώνει@merge10, big-wall αμετάβλητο)· **44/44** + regression **47/47** (wall-footprint-decompose/wall-from-perimeter/wall-in-region/auto-area) + **31/31** (column-from-faces/space-separator) GREEN. tsc SKIP (N.17). i18n: καμία (καθαρή γεωμετρία). CHECK 6B/6D: όχι overlay/renderer touch → stage ADR-419 μόνο. ✅ Google-level: YES — big-player feature-aware tolerance (node-merge=data-property capped, gap-closure=bridge), full SSoT (ευθυγράμμιση με ADR-507 auto-area, μηδέν διπλότυπο), preview ≡ commit. 🔴 browser-verify (hover+click στο μικρό magenta πλαίσιο → πράσινη preview + τοίχος) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v1.9 | **§wall-centerline-split (ΔΙΟΡΘΩΣΗ του v1.8) + §gap-close (Giorgio, 2 screenshots).** **(Α) Ο χωρισμός του v1.8 ήταν ΛΑΘΟΣ.** Το `decomposeRectilinear` (slab-sweep) έκοβε τον τοίχο σε **λωρίδες ΚΑΤΑ ΜΗΚΟΣ** (π.χ. οριζόντιος διαφορετικού πάχους με κοινή κάτω παρειά → «1.75×0.15» + «2.70×0.10», δύο λωρίδες που ακουμπούν face-to-face στη ΜΕΓΑΛΗ πλευρά — παράλογο). Giorgio: κόψε στα **junctions & στις αλλαγές πάχους**, κάθε τοίχος **πλήρους πάχους**, ένωση στις **άκρες/γωνία-Τ**. FIX: **NEW pure** `bim/walls/wall-footprint-decompose.ts → decomposeWallsFromFootprint(polygon, tol): DetectedRectangle[]` (grid decomposition: unique-x/y κάναβος → cells solid μέσω `isPointInPolygon` SSoT → κάθε cell ανατίθεται στον προσανατολισμό με το **μεγαλύτερο συνεχές run** ⇒ ο μακρύτερος/κύριος τοίχος κερδίζει το junction, το stub σταματά στην παρειά → merge H κατά X, V κατά Y). Ίδιο `DetectedRectangle[]` interface ⇒ **ένα-γραμμή swap** στο `perimeterFacesToRects` (αντικαθιστά `decomposeRectilinear`)· preview + `wall-region-inside` + `wall-from-perimeter` το παίρνουν αυτόματα (κοινό `pick.rects`). Column path αμετάβλητο (χρησιμοποιεί polygon+shape· `column-adopt-rect` μόνο `shape==='rectangle'` → ίδιο 1 rect· `perimeter-measure` oversized ίδιο). `decomposeRectilinear` μένει (slab tool + column-adjacency). 5 νέα jest (screenshot-bug CASE 2 χωρίς strip-split, offset-T/proper-T junctions, non-rectilinear→[]) + τα v1.8 thickness-zones περνούν identical με το ΣΩΣΤΟ decompose. **(Β) §gap-close:** όταν το open-loop feedback (v1.7) βρίσκει ΑΚΡΙΒΩΣ 1 κενό (2 άκρα) → confirm «Να κλείσω το κενό;»· «Ναι» → προσθέτει γραμμή που ενώνει τα άκρα (κλείνει τον βρόχο) → ο χρήστης ξανακλικάρει & γεμίζει τοίχο. **NEW** `gap-close-confirm-store.ts` (reuse `createConfirmStore` SSoT), `GapCloseConfirmDialog.tsx` (mirror ColumnPerimeterConfirmDialog + EscapeCommandBus + dxf-modal-* classes), `use-region-gap-close.ts` (listener → `appendEntityToScene` undoable line, layer κληρονομημένο από την ανοιχτή παρειά, `visible:true`). NEW event `bim:region-gap-detected`· region-clicks open-loop paths ενοποιήθηκαν σε `emitOpenLoopFeedback` (warning+highlight+markers+gap-detected). i18n `regionPerimeter.gapClose.*` el+en. Mount: `useSpecialTools` (hook) + `DxfViewerDialogs` (lazy dialog). **108/108 targeted jest** (9 suites incl. column regression). tsc SKIP (N.17). CHECK 6B/6D: overlay leaf → stage ADR-040+419. ✅ Google-level: YES — big-player wall split (πλήρες πάχος, junction=κύριος), full SSoT (ΕΝΑ decompose σε preview+commit· createConfirmStore/appendEntityToScene reuse), undoable line insert. 🔴 browser-verify (έκεντρο-Τ 3 σωστοί τοίχοι + «Να κλείσω το κενό;»→Ναι→κλείνει) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v1.8 | **§thickness-zones — ένας τοίχος = ΕΝΑ πάχος· σύνθετο περίγραμμα σπάει σε ζώνες σταθερού πλάτους (Giorgio).** Σύμπτωμα (screenshot 132755): με `wall-region-lines` σε έκεντρο-Τ, η πράσινη διακεκομμένη εντόπιζε ΕΝΑ ενιαίο περίγραμμα `2.70×0.85` που ένωνε τον οριζόντιο τοίχο + την κατακόρυφη «μύτη» **διαφορετικού πάχους** → θα δημιουργούσε έναν τοίχο με 2 πάχη (λάθος: κάθε τοίχος = 1 πάχος + 1 διαστρωμάτωση). Ζητούμενο (Giorgio): μόλις εντοπίζει αλλαγή πάχους → **σπάσε**, δημιούργησε **και τα δύο τμήματα ως ξεχωριστούς τοίχους** με ένα κλικ. **Audit (probe-verified):** το core `decomposeRectilinear` (slab-sweep) ΗΔΗ σπάει σωστά σε σκέλη σταθερού πλάτους (έκεντρο-Τ → `[{2700,200},{450,400}]`, junction στον κύριο/μακρύτερο) — το εργαλείο υπήρχε, 3 κενά το εμπόδιζαν: **(A)** `perimeterFacesToRects` gate `shape==='composite' ? []` πετούσε ΚΑΙ τα 100% ορθογωνικά με >8 κορυφές (πολλαπλές μύτες) → αντικαταστάθηκε με `decomposeRectilinear(polygon, tol)` (επιστρέφει ήδη [] για μη-ορθογωνικά → αγνοούνται σωστά). **(B)** preview (`resolvePerimeterPreview`) έδειχνε ΟΛΟΚΛΗΡΟ το loop → τώρα δείχνει **ΚΑΘΕ σκέλος ξεχωριστά** (thickness-zones): το store έγινε **zone-based** (`RegionPerimeterZone[]` αντί ενός `polygon`+`label`), ο overlay ζωγραφίζει loop+ετικέτα ανά ζώνη → **preview ≡ commit**. Οι single-shape resolvers (σκέτος τοίχος/κολόνα) → 1 zone (μηδέν αλλαγή όψης). **(C)** `wall-region-inside` commit (`onRegionClick`) έφτιαχνε 1 ορθογώνιο → τώρα, αν το εσώκλειστο περίγραμμα σπάει σε >1 σκέλη, `commitInRegionRects(pick.rects)` (ένας τοίχος ανά σκέλος)· απλό ορθογώνιο → υπάρχον single-rect path (μηδέν regression). Junction policy: το κοινό τετράγωνο → **κύριος/συνεχής (μακρύτερος) τοίχος** (Revit default· ο slab-sweep το δίνει ήδη έτσι). **Files:** MOD `perimeter-from-faces.ts` (gate), `RegionPerimeterPreviewStore.ts` (zone-based interface), `RegionPerimeterPreviewOverlay.tsx` (multi-zone render), `useRegionPerimeterMouseMove.ts` (3 resolvers → zones), `use-wall-region-clicks.ts` (inside split), i18n καμία. **Tests:** perimeter-from-faces +3 (έκεντρο-Τ 2 σκέλη + πολυζωνικό 12-κορυφο 3 σκέλη + απλό ορθογώνιο 1 σκέλος)· 39/39 GREEN. Το core geometry ΔΕΝ άλλαξε (probe-verified). Εκτός scope (συνειδητά): `wall-region-lines` accumulate (manual pick 4 γραμμών = 1 ορθογώνιο, δεν προκύπτει σύνθετο)· κολόνα (ίδιο pattern αργότερα). tsc SKIP (N.17). **CHECK 6B/6D** (RegionPerimeterPreviewOverlay = 2D overlay leaf) → stage ADR-040+419. ✅ Google-level: YES — Revit-faithful (ένα πάχος/τοίχος), full SSoT (ίδιο `decomposeRectilinear` σε preview+commit, μηδέν νέα geometry), preview ≡ commit. 🔴 browser-verify (έκεντρο-Τ → preview 2 ζώνες → κλικ → 2 τοίχοι διαφορετικού πάχους) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v1.7 | **§Layer 5b — «gap markers» στα ανοιχτά άκρα όταν το region/perimeter pick δεν κλείνει βρόχο (AutoCAD `BOUNDARY` red-circles, Giorgio).** Το open-loop feedback του Layer 5 έδειχνε toast + `dxf.highlightByIds{mode:'select'}` — αλλά το highlight ήταν **απλή επιλογή** (SelectedEntitiesStore), δεν ξεχώριζε ως σφάλμα και **δεν έδειχνε ΠΟΥ** είναι το κενό. Big-player audit (Giorgio «θα το έκανε η Revit;»): η Revit **δεν** εκθέτει ρυθμιζόμενη tolerance — καθοδηγεί με «closed loop» error· ο AutoCAD `BOUNDARY` βάζει **κόκκινους κύκλους στα gap endpoints**. FIX (FULL SSoT, μηδέν νέο overlay σύστημα): **(1) NEW pure** `findOpenChainEndpointsNear` (`perimeter-from-faces.ts`) — reuse του ΙΔΙΟΥ `buildSegmentGraph` με το `findOpenChainLineIdsNear`, αλλά επιστρέφει τα **σημεία** των κόμβων βαθμού-1 (όχι ids). **(2) NEW** `RegionGapMarkersStore` (zero-React pub/sub, αδελφό του `RegionPerimeterPreviewStore`) + **NEW** `RegionGapMarkersOverlay` (ADR-040 leaf SVG, κόκκινοι δακτύλιοι + halo, mirror του preview overlay· mount στο `canvas-layer-stack-2d-overlays-leaf`). **(3) Wiring** στα δύο rejection paths (`use-wall-region-clicks` inside+perimeter, `use-column-perimeter-commit`): `setRegionGapMarkers(findOpenChainEndpointsNear(...))` επιπλέον του υπάρχοντος toast+line-highlight. **Lifecycle:** clear στην αρχή κάθε κλικ (επιτυχές=καθαρό) + clear-on-tool-exit (`useRegionPerimeterMouseMove`)· ΟΧΙ clear στο mousemove (μένουν μέχρι ο χρήστης να δράσει, σαν AutoCAD). **(4) Μήνυμα** `regionPerimeter.noClosedLoop` → action-oriented Revit tone (el+en): «Οι γραμμές δεν σχηματίζουν κλειστό βρόχο. Ενώστε τα σημειωμένα άκρα (○) και δοκιμάστε ξανά.» Εκτός scope (συνειδητά): το `mode:'select'` line-highlight μένει ως context «ποιες γραμμές» — τα κόκκινα markers είναι το κύριο σήμα «πού». 41/41 targeted jest (perimeter-from-faces +2 endpoint tests, RegionGapMarkersStore ×5). tsc SKIP (N.17). **CHECK 6B/6D** (νέο overlay leaf + 2D-overlays-leaf touch) → stage ADR-040 + ADR-419. ✅ Google-level: YES — AutoCAD-faithful, full SSoT (ίδιος graph/overlay pattern, μηδέν διπλότυπο), zero-React overlay (ADR-040). 🔴 browser-verify (κλικ σε ασύνδετο «Γ» → κόκκινοι κύκλοι στα κενά + μήνυμα· ένωσε → χάνονται· άλλαξε εργαλείο → καθαρίζουν) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v1.6 | **§planar-faces — region detection σε πραγματικά exploded DXF (junctions βαθμού >2 + αμβλείες γωνίες), SSoT auto-area (Giorgio).** Μετά το v1.5, ο Giorgio δοκίμασε «Κολώνα μέσα σε περιοχή» σε exploded αρχιτεκτονική κάτοψη (`...EXPLODE_ΧΩΡΙΣ_ΧΑΤΣ.dxf`, καθαρές `LINE`) και **δεν έβγαινε ούτε preview** στο μωβ «Γ». Root cause: ο loop-finder `walkSimpleCycle`/`buildPolygonLoops` (`perimeter-from-faces.ts`) δούλευε **μόνο** σε κόμβους βαθμού 2 (γρ. `if (nbrs.length !== 2) return null`)· σε κάτοψη «σκάρα» το εξωτερικό περίγραμμα μοιράζεται κορυφές με τους εσωτερικούς διαχωρισμούς → κόμβοι junction βαθμού ≥3 → ο walker «έχανε ΟΛΑ» τα loops. Το μόνο workaround (`findRectanglesFromSegments`/`detectTouchingRects`) έπιανε **μόνο ορθογώνια** — το Γ έχει αμβλεία γωνία. FIX (SSoT, μηδέν νέος αλγόριθμος): αντικατάσταση του σώματος του private `buildPolygonLoops` με reuse του **`findClosedPolygonsFromLines`** (`systems/auto-area/auto-area-geometry.ts`) — half-edge **planar face traversal** (angular CCW sort → junctions οποιουδήποτε βαθμού· `atan2` → αμβλείες/οξείες γωνίες· `planarizeSegments` → X/T-crossings· `bridgeCollinearGaps` → κενά μετά explode). Ίδιος δοκιμασμένος detector με auto-measure-area + hatch pick-point (ADR-507). **Μηδέν public API αλλαγή** (η `buildPolygonLoops` είναι private). Διορθώνει ταυτόχρονα preview + commit + κολώνες + τοίχους + thermal spaces (όλοι μέσω `extractClosedPolygons`) → **preview ≡ commit**. **Boy-Scout cleanup:** το `detectTouchingRects` option + ο `walkSimpleCycle` ΑΦΑΙΡΕΘΗΚΑΝ (dead μετά το planar swap· το workaround προκαλούσε και double-count λόγω collinear κορυφών από το planarize). `buildSegmentGraph` μένει (χρήση στο `findOpenChainLineIdsNear`). Γνωστό κόστος: `planarizeSegments` O(n²) pairwise — mitigated από το 2-level cache του `getCachedRegionPerimeters`. 327/327 jest (32 suites: κολώνες/τοίχοι/spaces/auto-area/hatch) + 2 νέα (αμβλεία-Γ→composite, junction-βαθμού-3→ελάχιστο μισό). tsc SKIP (N.17). 🔴 browser-verify (το πραγματικό DXF) + commit. | Claude Opus 4.8 |
| 2026-07-03 | v1.5 | **«Κολώνα μέσα σε περιοχή» — non-rectangular fallback (Γ/L/T/composite), preview≡commit (Giorgio).** Bug: το click-inside (`column-region-inside`) καλούσε ΜΟΝΟ `findEnclosingRectangle` (corner-graph, ορθές γωνίες ±4.6°) → για μη-ορθογώνιο κλειστό περίγραμμα (π.χ. «Γ» με αμβλεία γωνία) επέστρεφε `null` → **no-op**, ΕΝΩ το hover-preview έδειχνε ήδη σωστά το πολύγωνο (χρησιμοποιεί `pickRegionPerimeterAt`, loop-based). Ασυμφωνία **preview ≠ commit**. FIX (SSoT, μηδέν νέο geometry): στο `useColumnTool.onCanvasClick` (`in-region`), **rectangle-first** (`onRegionClick`) και αν αποτύχει + `regionMethod==='inside'` → **fallback (delegate) στο υπάρχον `onPerimeterClick`** (ίδιος loop-detector `pickRegionPerimeterAt` → `buildColumnsFromPerimeters` → composite `ColumnEntity`, EC2 §9.6.1 guard, oversized/open-loop diagnostics). Απόφαση Giorgio (AskUserQuestion): μη-ορθογώνιο → **ΕΝΑ σύνθετο τοιχίο (composite)**· ορθογώνιο κρατά υπάρχουσα συμπεριφορά (rectangular/shear-wall/batch-fill ADR-524 άθικτα). `onPerimeterClick` ήδη wired+στο dependency array (χρήση στο outer-perimeter) → μηδέν νέο import. Συνειδητά: batch-fill (ADR-524) δεν τρέχει στο composite fallback (δεν έχει νόημα για μοναδικό μη-ορθογώνιο). preview≡commit επιτυγχάνεται (ίδιος detector κλικ+hover). | Claude Opus 4.8 |
| 2026-06-06 | v1.0 | Initial implementation — Slices 1–10 complete. Types + catalog + enterprise-id + 2D renderer + grips + scene integration + hit testing + 3D converter + persistence + ribbon contextual tab + IFC serializer + 73 tests. |
| 2026-06-07 | v1.1 | Grips wired into unified grip system (grip-registry + grip-parametric-commits + grip-commit-adapters + apply-entity-preview). DxfViewerContent: useColumnAdjacencyNotification hook added (column merge toast). |
| 2026-06-08 | v1.4 | **«Κολώνα σε περιοχή» — intent-aware confirm για επίμηκες (τοιχίο) + ICU plural fix (post-verify Giorgio).** (1) Το `use-column-region-clicks` δημιουργούσε ΣΙΩΠΗΛΑ μέλος για επίμηκη περιοχή (το `buildColumnFillingRect` ήδη ταξινομεί aspect>4→shear-wall, αλλά χωρίς ερώτηση). Giorgio: «να γίνεται τοιχίο / να ρωτάει». Πλέον δρομολογείται μέσω του ΙΔΙΟΥ intent-aware confirm με το «από περίγραμμα» (`requestColumnDiscreteIntentConfirm`, intent=columns) + breakdown toast — μηδέν νέο dialog. NEW SSoT helper `splitColumnsByIntent` (column-from-faces· reuse ΚΑΙ στο discrete path, αφαίρεσε inline duplicate). +gap-tolerant tol (`resolveRegionLoopTolWorld`) στο column-region (έλειπε — Layer 2 consistency). (2) **ICU plural bug (προϋπάρχον, ποτέ browser-verified):** το dialog έδειχνε raw key «perimeterColumnDiscrete.nWalls». Το i18n χρησιμοποιεί **i18next-icu** → η πληθυντικότητα γίνεται με ICU syntax μέσα στο key, ΟΧΙ με `_one`/`_other` suffixes. Μετατροπή 8 suffix keys → 4 ICU keys (`{count, plural, one {# τοιχίο} other {# τοιχία}}`) σε el+en (nColumns/nWalls/built/builtWalls). 76 tests (+2 splitColumnsByIntent)· tsc 0. | Claude Opus 4.8 |
| 2026-06-08 | v1.3 | **Fix «γιγάντιο περίγραμμα» στα region/perimeter tools (κολώνες+τοίχοι) — 5-layer defense-in-depth, FULL SSOT (Giorgio).** Bug: click-inside σε μικρή περιοχή δημιουργούσε κολώνα ~όλο το σχέδιο (27.78×25.35m), γιατί (α) το filter κρατούσε ΟΛΑ τα εμπεριέχοντα περιγράμματα όχι το μικρότερο, (β) κενά στις γραμμές εμπόδιζαν την ανίχνευση του μικρού loop, (γ) κανένας έλεγχος μεγέθους. **Layer 1** `pickSmallestContainingPerimeter` (perimeter-from-faces) — μικρότερο εμπεριέχον loop (mirror auto-area). **Layer 2** `resolveRegionLoopTolWorld` (NEW region-tolerance.ts) — gap-closure floor `REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM=50` (boy-scout: κεντρικοποίησε το διπλό `regionTol`). **Layer 3** Revit hover preview: NEW RegionPerimeterPreviewStore + RegionPerimeterPreviewOverlay (SVG leaf, ADR-040 mirror auto-area· πράσινο dashed + διαστάσεις· oversized → κανένα preview, warning μόνο στο κλικ) + useRegionPerimeterMouseMove (gate `isBimRegionOrPerimeterTool`· WeakMap cache ανά entities/tol + skip same-ref → μηδέν lag, post-verify Giorgio fix). **Layer 4** `isPerimeterOversized`/`perimeterMemberThicknessMm` (MAX_MEMBER_THICKNESS_MM=3000· μόνο μικρή πλευρά → false-positive-free) net στο `buildPerimeterColumn`+`buildColumnFillingRect` (οι τοίχοι ήδη καλύπτονται από MAX_WALL_THICKNESS_MM=2000). **Layer 5** `findOpenChainLineIdsNear` + `bim:region-perimeter-rejected` event → warning toast (`regionPerimeter.oversized`/`noClosedLoop` el+en) + highlight ασύνδετων άκρων (reuse `dxf.highlightByIds`). Wiring: use-column-perimeter-commit + use-wall-region-clicks (+getSceneUnits). 74 tests PASS (4 suites· incl. 12 νέα)· tsc 0. Cleanup 2 garbage columns+BOQ (ήδη done, verified MCP). |
| 2026-06-07 | v1.2 | **Ribbon «Δομικά Στοιχεία» reorg + region 3-way split (Giorgio).** (1) Το ενιαίο submenu «Κολόνα/Τοιχίο» (`columnGroup`) έσπασε σε δύο: **«Κολώνες»** (`columnsGroup`) + **«Τοιχία»** (`wallPiersGroup`). (2) Το «σε περιοχή» (κολώνα **και** τοίχος) έσπασε από 1 «έξυπνο» εργαλείο σε **3 διακριτές εντολές** ανά τύπο: `column-region-lines/inside/box` + `wall-region-lines/inside/box` (πρώην `column-in-region`/`wall-in-region` αφαιρέθηκαν). Νέο SSoT `systems/tools/region-tool-ids.ts` (tool id → `RegionMethod` + predicates· αντικαθιστά scattered `activeTool === 'X-in-region'` σε mouse-handlers/renderer/contextual-config). Tool state: `+regionMethod` (κολώνα+τοίχος), gate σε `onRegionClick` + box-select listeners. (3) **«Πολλαπλή δημιουργία»**: το discrete-from-perimeter εμφανίζεται σε ΚΑΙ τα δύο submenus — `column-discrete-from-perimeter` (intent=columns, «Πολλαπλή δημιουργία κολωνών») + νέο `column-discrete-from-perimeter-walls` (intent=walls, «…τοιχίων»). `+discreteIntent` στο column state. **Intent-aware confirm dialog** (αντικαθιστά has-walls mode): δημιουργεί κατευθείαν ό,τι ταιριάζει στην πρόθεση, ρωτά με 3/2 κουμπιά για τα υπόλοιπα (μη αλλοίωση στατικών — split μέσω `isWallColumnKind`). i18n el+en (ribbon labels/tooltips/status/dialog). Confirm-store test ξαναγράφτηκε. |
