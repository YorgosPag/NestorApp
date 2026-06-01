# ADR-404 — 3D BIM Element Tilt (Slope-Based, All Axes)

| Field | Value |
|---|---|
| Status | 🟢 ACCEPTED — **Phase 1 (data model + 3Δ converters)** DONE (pending commit, 🔴 browser verify) · Phase 2 (gizmo X/Z rings) + Phase 3 (2Δ cut-plane projection) PENDING |
| Date | 2026-06-01 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | ADR-402 (3D editing — αυτό ξεκλειδώνει τα X/Z rings του), ADR-401 (slope precedents beam/slab), ADR-369 (elevation convention), ADR-188 (rotation) |

---

## Context

Στο `/dxf/viewer` → 3Δ καμβά, όταν επιλέγεις BIM στοιχείο εμφανίζεται gizmo με 3 βελάκια
μετακίνησης + **ένα** δαχτυλίδι περιστροφής (rotate-Y, κάτοψη). Τα δαχτυλίδια X/Z είναι
**κρυμμένα** (ADR-402 «Τίμια όρια Phase A») γιατί:
1. Η `RotateEntityCommand` είναι **μόνο** plan-rotation γύρω από τον κατακόρυφο άξονα (ADR-188).
2. **Το BIM data model δεν αποθηκεύει 3Δ κλίση** — οι οντότητες ορίζονται με γεωμετρία
   κάτοψης + ύψος/elevation. Μόνες εξαιρέσεις: κεκλιμένο δοκάρι (`topElevationEnd`,
   αξονική κλίση) + κεκλιμένη πλάκα (`SlabSlope`, ADR-401) — **ειδικές** slope παράμετροι.

Ο Giorgio ζήτησε να μπορεί να **γέρνει** στοιχεία (raking column, battered wall, κεκλιμένο
δοκάρι/στέγη). **Αυτή η φάση σπάει το θεμελιώδες αξίωμα του ADR-402** («3Δ editing = γέφυρα,
μηδέν νέα μαθηματικά/εντολές») → δικαιολογεί ξεχωριστό ADR.

### Αποφάσεις Giorgio (design Q&A, 2026-06-01)
1. **Στοιχεία:** Κολώνα + δοκάρι + τοίχος + πλάκα. **ΟΧΙ σκάλα** — η κλίση της είναι
   παραμετρική (`run`/`stepCount`), τα πατήματα μένουν οριζόντια (Revit-correct: η σκάλα
   δεν «γέρνει» σαν όγκος).
2. **Μοντέλο:** **Slope-based (γωνία + διεύθυνση), ανά τύπο pattern** — ΟΧΙ quaternion.
   Industry convergence (Revit/ArchiCAD/Tekla: slanted column = angle/endpoint-driven,
   slanted wall = «Angle From Vertical», sloped beam = endpoints, sloped slab = direction+angle).
3. **2Δ κάτοψη:** **Προβολή στο cut plane (Revit-style)** — το στοιχείο εμφανίζεται
   μετατοπισμένο όπου το κόβει το επίπεδο τομής (Phase 3).
4. **Snap:** βήματα 5/15/30/45° + ελεύθερο με **Shift** (Phase 2).

### Αρχές (Revit-aligned)
- **Τοίχος:** κλίση = «Angle From Vertical» = γωνία γύρω από τον άξονα του τοίχου (lean
  κάθετα στη φορά run, **ένας DOF**). ΟΧΙ ελεύθερη διεύθυνση.
- **Tilt = shear** (συνεπές με beam/slab slope SSoT): η κορυφή μετατοπίζεται κατά
  `height·tan(angle)`, η βάση + το ύψος/elevation μένουν (ADR-369 ανέπαφο, height-based BOQ).

---

## Decision — μοντέλο κλίσης ανά τύπο

| Τύπος | X/Z ring σημαίνει | Αποθήκευση | Νέο/υπάρχον |
|---|---|---|---|
| **Κολώνα** (κατακόρυφη) | raking σε οποιαδήποτε διεύθυνση | `tilt?: {direction, angle}` | **ΝΕΟ** πεδίο |
| **Τοίχος** (κατακόρυφος) | battered, lean ⟂ στη run (1 DOF) | `tilt?: {angle}` (signed) | **ΝΕΟ** πεδίο |
| **Δοκάρι** (οριζόντιο) | αξονική κλίση (ramp) | `topElevationEnd` | ΥΠΑΡΧΕΙ (ADR-401) |
| **Πλάκα** (οριζόντια) | slope επιπέδου | `slope:{direction,angle}` + `geometryType:'tilted'` | ΥΠΑΡΧΕΙ (ADR-401) |

**Tilt-as-shear (δύο κατευθύνσεις):**
- Κολώνα/τοίχος (**κατακόρυφα**) → **οριζόντιο** shear: η θέση κάτοψης μετατοπίζεται ∝ ύψος.
- Δοκάρι/πλάκα (**οριζόντια**) → **κατακόρυφο** shear: το Z μετατοπίζεται ∝ θέση κάτοψης
  (ήδη υλοποιημένο, ADR-401 `applyBeamSlope`/`applySlabSlope`).

---

## Phase 1 — Data model + 3Δ converters (DONE)

**Στόχος:** το στοιχείο γέρνει στο **3Δ**. (Το 2Δ μένει αμετάβλητο — Phase 3.)

- **Νέα πεδία/τύποι:** `ColumnTilt {direction, angle}` + `tilt?` σε `ColumnParams`
  (`column-types.ts`)· `WallTilt {angle}` + `tilt?` σε `WallParams` (`wall-types.ts`).
  Optional → absent / `angle===0` = κατακόρυφο (no-tilt fast-path, mirror `isBeamTilted`).
- **Zod:** `ColumnTiltSchema`/`WallTiltSchema` (strict, `direction`/`angle` finite) +
  `tilt: …optional()` στα base schemas (`column.schemas.ts`, `wall.schemas.ts`). Χωρίς
  superRefine (absent = vertical).
- **Νέα SSoT γεωμετρίας** (αδέλφια των `beam-slope.ts`/`slab-slope.ts`, **unit-safe** —
  `tan` αδιάστατο):
  - `bim/geometry/column-tilt.ts` → `isColumnTilted` + `columnTiltShearAt(params,
    heightAboveBase) → {dx,dy}` = `height·tan(angle)·{cos,sin}(direction)`.
  - `bim/geometry/wall-tilt.ts` → `isWallTilted` + `wallTiltShearAt(params,
    heightAboveBase) → {dx,dy}` = `height·tan(angle)·perpUnit(start→end)`.
- **3Δ converter** `BimToThreeConverter.ts`: νέο κοινό `applyHorizontalTiltShear` (shear
  X/Z βάσει `pos.getY` = ύψος· coords μετά ROT_X_NEG_90: `worldX += dx`, `worldZ += −dy`)
  + `applyColumnTilt`/`applyWallTilt`, καλούνται μετά το `extrudeAndRotate` στο **flat
  solid path** των `columnToMesh`/`wallToMesh`. Beam/slab ήδη shear-άρουν.
- **File-size split (N.7.1):** η προσθήκη ανέβασε τον converter 493→535 γρ (>500). Οι
  **πέντε** shear functions (`applyBeamSlope`/`applySlabSlope`/`applyHorizontalTiltShear`/
  `applyColumnTilt`/`applyWallTilt`) εξήχθησαν σε ΝΕΟ **`bim-3d/converters/mesh-slope-shear.ts`**
  (boy-scout SSoT — μία στέγη για τη λογική κλίσης). Converter → 442 γρ, νέο module ~125.
- **Tests:** `column-tilt.test.ts` (10) + `wall-tilt.test.ts` (9) → **19/19 PASS**, tsc 0.

### Documented limitations (Phase 1)
- **Flat path μόνο:** η κλίση εφαρμόζεται στο ίσιο solid extrude. Attached-to-host κολώνα/
  τοίχος (`buildAttachedColumnPrism`, ADR-401 profile path) **+** τοίχος **με ανοίγματα**
  (`buildStraightWallWithOpenings`) ΔΕΝ γέρνουν ακόμα — follow-up.
- **Καμία UX ακόμα:** το `tilt` γράφεται μόνο προγραμματιστικά (test/console). Το gizmo
  X/Z ring έρχεται στο Phase 2· η 2Δ προβολή στο Phase 3.

---

## Phase 2 — Gizmo X/Z rings → tilt εντολές (PENDING)
Γενίκευση `bim-gizmo-drag-bridge` rotate math σε άξονα· νέο `tilt` outcome· per-type
`TILT_HANDLES_BY_TYPE` στο overlay· live-preview axis (per-frame rebuild)· angle snap
(reuse `AngleUtils.snapAngleToStep`, 5/15/30/45° + Shift)· νέες `SetColumnTiltCommand`/
`SetWallTiltCommand` (+ beam→`topElevationEnd`, slab→`SlabSlope`)· dispatch branch.

## Phase 3 — 2Δ προβολή στο cut plane + section parity (PENDING)
Κοινό `cut-plane-tilt.ts` (`tiltPlanShift(tilt, cutPlaneMm, baseMm)`)· εφαρμογή στα
`compute{Column,Wall,Beam,Slab}Geometry` + στα section adapters (`toSlabPlan`/`toWallPlan`
διαβάζουν params απευθείας → parity). BOQ αμετάβλητο (Revit projected plan area).

---

## SSoT reuse (μηδέν διπλά μαθηματικά)
- Shear loop: ΕΝΑ `applyHorizontalTiltShear` (κολώνα+τοίχος).
- Tilt math: `columnTiltShearAt`/`wallTiltShearAt` (αδέλφια `beamSlopeOffsetZmm`/
  `slabSlopeOffsetZmm`). Δοκάρι/πλάκα: reuse υπαρχόντων `topElevationEnd`/`SlabSlope`.

## Verification
- **Tests:** `npx jest src/subapps/dxf-viewer/bim/geometry/__tests__/{column,wall}-tilt`
  → 19/19 PASS. `npx tsc --noEmit` 0.
- **🔴 Browser** (Phase 1): γράψε `tilt:{direction:0,angle:20}` σε column (ή `{angle:15}`
  σε wall) μέσω test/console → το 3Δ mesh γέρνει· η βάση μένει· το ύψος αμετάβλητο· η
  κάτοψη ακόμα flat (Phase 3 pending).

---

## Changelog
- **2026-06-01 (Opus 4.8, Plan Mode, Developer A SOLO)** — **Phase 1: data model + 3Δ
  converters** (pending commit, 🔴 browser verify). ΝΕΑ πεδία `ColumnTilt`/`WallTilt` +
  `tilt?` (column/wall types + Zod schemas)· ΝΕΑ SSoT `column-tilt.ts`/`wall-tilt.ts`
  (unit-safe shear, αδέλφια beam/slab slope)· ΝΕΟ κοινό `applyHorizontalTiltShear` +
  `applyColumnTilt`/`applyWallTilt` στο `BimToThreeConverter` (flat solid path).
  Tilt-as-shear (κορυφή γέρνει, βάση+ύψος μένουν, ADR-369). **+File-size split:** οι 5
  shear functions εξήχθησαν σε ΝΕΟ `mesh-slope-shear.ts` (converter 493→535→442 γρ <500).
  93/93 tests (tilt 19 + converter slope/beam/slab 74), tsc 0.
  Limitations: flat path μόνο (attached/openings = follow-up)· καμία UX (Phase 2/3).
