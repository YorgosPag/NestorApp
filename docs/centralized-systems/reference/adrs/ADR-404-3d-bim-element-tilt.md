# ADR-404 — 3D BIM Element Tilt (Slope-Based, All Axes)

| Field | Value |
|---|---|
| Status | 🟢 ACCEPTED — **Phase 1 (data model + 3Δ converters) + Phase 2 (gizmo X/Z rings → tilt) + Phase 3 (2Δ cut-plane projection + section parity) + Phase 4 (pieces/prism 3Δ tilt — attached/με-ανοίγματα)** DONE (pending commit, 🔴 browser verify) |
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

## Phase 2 — Gizmo X/Z rings → tilt εντολές (DONE)

**Στόχος:** ο χρήστης γέρνει στοιχείο με το gizmo στο 3Δ· persist + **ΕΝΑ undo**· live
preview· snap 5/15/30/45° + Shift=free. (Η κάτοψη μένει flat — Phase 3.)

- **Drag bridge** `bim-gizmo-drag-bridge.ts`: η rotate math γενικεύτηκε σε **άξονα**
  (`rotateAxis` από `constraint.axis`, signed = `atan2(axis·(start×cur), dot)`,
  `projectRotateVector` προβάλλει στο επίπεδο με normal=ring axis). Νέο outcome
  `{kind:'tilt'; axis:'x'|'z'; angleDeg}` (Y ring → `rotate` όπως πριν, X/Z → `tilt`).
  Angle **snap ΜΟΝΟ για tilt** (`setShiftHeld` → free).
- **Tilt SSoT** ΝΕΟ `bim-3d/gizmo/bim3d-tilt-bridge.ts` (αδελφό του `bim3d-resize-bridge`):
  `snapTiltAngleDeg` (magnetic 15°-multiples μέσω `AngleUtils.snapAngleToStep` SSoT +
  standalone 5°) + `compute{Column,Wall,Beam,Slab}TiltParams`. Mapping gizmo→patch από
  τη shear convention του converter (preview === commit):
  - **Κολώνα** → `tilt {direction, angle}` (set-per-plane· `topMotionDirPlan`: X-ring →
    plan-Y, Z-ring → plan-X· πρόσημο drag → πλευρά).
  - **Τοίχος** → `tilt {angle}` signed (lean ⟂ run· το ring ∥ run γέρνει, το ⟂ run = roll
    → no-op· magnitude = snapped angle, πλευρά από perp-component sign).
  - **Δοκάρι** → `topElevationEnd = topElevation + runMm·tan(angle)` (ring ⟂ axis ραμπάρει·
    ∥ axis = roll → no-op).
  - **Πλάκα** → `geometryType:'tilted' + slope {direction, angle%}` (`tan(deg)·100`).
  - Drag ~0 → **straighten** (drop tilt / `geometryType:'box'`).
- **NO νέες εντολές (recognition):** το patch περνά από τα ΥΠΑΡΧΟΝΤΑ view-agnostic
  `Update{Column,Wall,Beam,Slab}ParamsCommand` — **ακριβώς όπως το resize** (το αρχικό plan
  ανέφερε `SetColumnTiltCommand`· απορρίφθηκε υπέρ του reuse). ΕΝΑ undo step.
- **Overlay** `bim-gizmo-overlay.ts`: ΝΕΟ `TILT_HANDLES_BY_TYPE` (column/wall/beam/slab →
  `rotate-x`+`rotate-z`· σκάλα = κανένα). Single-select μόνο: multi → `editBimType=null`
  → χωρίς tilt rings (mirror resize).
- **Live preview** (shear ≠ rigid rotate): `GizmoLivePreview` += `{kind:'tilt'; axis;
  angleDeg}`· ο controller το επιστρέφει για X/Z rings (Y → `rotate`). Ο handler κάνει
  **per-frame converter rebuild** μέσω ΝΕΟΥ `buildTiltPreviewObject` (αδελφό του
  `buildResizePreviewObject`) + swap στο ίδιο hide-and-replace path (`captureResize`/
  `applyResize`). Commit → resync (μηδέν πήδημα)· Esc/no-op → reset.
- **Dispatch** `bim3d-edit-interaction-handlers.ts`: ΝΕΟ `case 'tilt'` → `buildTiltCommand`
  (single-only, mirror resize).
- **Tests:** ΝΕΟ `bim3d-tilt-bridge.test.ts` (16: snap + 4 τύποι + straighten/roll/no-op) +
  drag-bridge tilt (4: axis x/z outcome, getLiveTiltDeg, Y-stays-rotate regression) +
  overlay tilt (3: rings per type, σκάλα/multi καμία) → tilt+drag+overlay **59/59 PASS**, tsc 0.

### Documented limitations (Phase 2)
- **Flat path μόνο** (κληρονομιά Phase 1): attached-to-host κολώνα/τοίχος + τοίχος με
  ανοίγματα δεν δείχνουν tilt ούτε live ούτε στο commit — follow-up.
- **Single-select μόνο** (mirror resize)· multi-select tilt = follow-up.
- **Off-axis wall/beam:** το ⟂-DOF μοντέλο εφαρμόζει το πλήρες snapped angle ⟂ run / axis
  ανεξάρτητα από την κλίση του ring (κρατά το snap ακριβές)· accumulate-across-planes
  (κολώνα) = follow-up (τώρα set-per-plane).
- **2Δ κάτοψη ακόμα flat** (Phase 3).

## Phase 3 — 2Δ προβολή στο cut plane + section parity (DONE)
Κοινό SSoT `cut-plane-tilt.ts` (`columnCutPlaneShiftMm`/`wallCutPlaneShiftMm` — reuse
Phase-1 `columnTiltShearAt`/`wallTiltShearAt` στο `heightAboveBase = clamp(cutPlaneMm −
baseOffset, 0, height)`). Η κεκλιμένη κολώνα/τοίχος εμφανίζεται **μετατοπισμένη όπου την
κόβει το cut plane** (Revit-style).

**🔴 Recognition-driven απόκλιση από το αρχικό plan (code = source of truth, N.0.1):**
Το plan πρότεινε shift μέσα στα `compute{Column,Wall}Geometry`. **Επιβεβαιώθηκε ότι
σπάει το 3Δ**: ο `BimToThreeConverter` διαβάζει το ΙΔΙΟ footprint → extrude →
`applyColumnTilt`/`applyWallTilt` ⇒ **διπλό shift**· επιπλέον 69 consumers (grips/hit-test/
BOQ) θα μετατοπίζονταν λάθος. → Το shift μπαίνει **render-time μόνο** (`ColumnRenderer`/
`WallRenderer` μέσω `ctx.translate` ομοιόμορφα σε όλο το ορατό σύμβολο).

- **Κολώνα/τοίχος (κάτοψη, Revit slanted-in-plan):** το πλήρες σώμα (fill/hatch/**παχύ**
  stroke = cut στυλ) μεταφέρεται στο **cut plane** (όπου κόβεται)· η **βάση** = **λεπτό**
  projection outline (πραγματική θέση) + **connecting lines** στις γωνίες (κοινός helper
  `cut-plane-tilt-projection.ts`). Section parity: ίδιο shift στα `toColumnPlan`/`toWallPlan`
  (`cutPlaneMm` από `viewRange`).
- **Δοκάρι/πλάκα = section-only** (κατακόρυφη κλίση → η **προβολή κάτοψης δεν
  μετατοπίζεται**, Revit: ίδιο footprint + slope arrows). Η τομή τους ήδη σωστή
  (`slopeYAt`, Phase E/E2) — μηδέν Phase-3 δουλειά.
- **BOQ αμετάβλητο** (το shift είναι render-only, εκτός `compute*Geometry`).
- **+File-size split:** `KIND_STROKE`/`KIND_FILL` → ΝΕΟ `column-render-palette.ts`
  (ColumnRenderer 498→498 <500).

**Limitations:** grips/hit-test μένουν στο πραγματικό footprint (η κλίση επεξεργάζεται
μόνο μέσω 3Δ gizmo)· section column/wall = single-slice shift (όχι πλήρες παραλληλόγραμμο
lean — το `SectionRect` είναι rect· follow-up).

---

## Phase 4 — Pieces/prism 3Δ tilt (attached / με ανοίγματα) (DONE)

**Στόχος (3Δ === 2Δ):** ο **attached** τοίχος/κολώνα ή ο τοίχος **με ανοίγματα** πήγαινε
**πάντα** στον pieces/prism path (`buildStraightWallWithOpenings` / `buildAttachedColumnPrism`),
που ΔΕΝ καλούσε `applyWallTilt`/`applyColumnTilt` → η κλίση φαινόταν στην 2Δ κάτοψη
(Phase 3, ανεξάρτητο read) **αλλά ο τοίχος έμενε κατακόρυφος στο 3Δ** (Giorgio live 2026-06-01).
Αίρει το «**Flat path μόνο**» limitation των Phase 1/2.

- **`mesh-slope-shear.ts` (SSoT):** `applyHorizontalTiltShear`/`applyWallTilt`/`applyColumnTilt`
  παίρνουν optional `baseHeightM = 0`. Στον solid path το geometry Y=0 είναι ήδη στη βάση →
  `baseHeightM=0` (byte-for-byte). Στον pieces/prism path τα vertices ζουν σε **floor-local Y**
  και το mesh ανεβαίνει κατά `mesh.position.y = yOffset` → `baseHeightM = yOffset − floorY`
  ώστε `heightAboveBase = pos.getY(i) + baseHeightM` (anchor=0 στο FFL — **ίδιο datum** με το
  2Δ cut-plane & τον solid path).
- **`BimToThreeConverter`:** το `emit()` του `buildStraightWallWithOpenings` καλεί
  `applyWallTilt(geo, wall.params, yOffset − floorY)` **πριν** τα edges → καλύπτει και τα 3 piece
  kinds (flat extrude `zBotAM` / wedge `0` / column-prism clip `0`) με ΕΝΑ σημείο. Ο attached
  column prism path καλεί `applyColumnTilt(prism, column.params)` (prism σε floor-local Y, base
  στο FFL → `baseHeightM=0`).
- **Live preview αυτόματα:** το `bim3d-preview-rebuild.ts` ξαναχτίζει μέσω `wallToMesh`/
  `columnToMesh` → το live tilt preview attached/με-ανοίγματα στοιχείου διορθώνεται χωρίς αλλαγή εκεί.
- **No-op flat:** `isWallTilted`/`isColumnTilted` false → καμία αλλαγή (regression-safe). ADR-401
  clip/wedge/prism άθικτα (το shear είναι τελικός μετασχηματισμός μετά το χτίσιμο των pieces).
- **Tests:** ΝΕΟ `wall-tilt-pieces-3d.test.ts` (7: wall pieces flat-vs-tilted per-vertex shear +
  βάση αγκυρωμένη + 3Δ===2Δ == `wallTiltShearAt`· column prism shear dir-0 + no-op flat) → 7/7 PASS·
  regression `wall-top-angled-crossing`/`wall-opening-pieces`/`column-piece-geometry` 34/34,
  `bim3d-edit-live-preview` 14/14, tsc 0.

### Phase 4.1 — Tilt-aware attach clip (το pocket του δοκαριού ακολουθεί την κλίση)
**Bug (Giorgio live + screenshot):** σε attached τοίχο με δοκάρι που «χωνεύει» στην κορυφή
(ADR-401 `clipWallBandTopRegions`), δίνοντας κλίση η **εγκοπή** μετακινούνταν μαζί με τον
γερμένο τοίχο ενώ το δοκάρι έμενε ακίνητο → ξεκρέμαστη «τρύπα», το δοκάρι δεν χωνεύει.
**Root:** ο clip δουλεύει σε **plan** υποθέτοντας κατακόρυφη προβολή· το Phase-4 shear
μετατοπίζει την κορυφή του pocket κατά `wallTiltShearAt(params, Hu)` (Hu = host underside),
αλλά το host μένει.
**Fix (geometrically exact):** η plan-θέση του pocket στο ύψος `Hu` στον sheared κόσμο =
`(quad + shear(Hu)) ∩ host`· στον un-sheared frame (όπου χτίζεται + ξανα-shear-άρεται) =
`quad ∩ (host − shear(Hu))`. Άρα **un-shear κάθε host footprint κατά `−shear(Hu)` ΠΡΙΝ το
clip** (ΝΕΟ `tiltCompensateWallTopClip` στο `wall-top-clip.ts`· τα ύψη `undersideZmm` μένουν,
breakpoints recompute). Ο converter το καλεί μόνο σε `isWallTilted` (no-op flat). ΝΕΟ
`wall-tilt-attach-clip-3d.test.ts` 5/5 (host un-shear + breakpoints + pocket⊆host + e2e),
tsc 0. Σημείωση: αν η κλίση είναι τόσο μεγάλη που η γερμένη κορυφή ξεπερνά το host, το pocket
σωστά εξαφανίζεται (ο τοίχος έγειρε εκτός δοκαριού — Revit-correct).

**Limitations (Phase 4):** base-attach pocket + tilt (follow-up)· attached **κολώνα** prism +
tilt (ίδιο pattern, ξεχωριστά)· sloped-underside host (η αντιστάθμιση είναι uniform translate —
exact για flat δοκάρι, approx για κεκλιμένο)· curved/polyline τοίχος με tilt
(`buildWallMeshWithOpenings`). Δοκάρι/πλάκα = δικό slope (ανεπηρέαστα). Σκάλα = no tilt by design.

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
- **🔴 Browser** (Phase 2): επίλεξε column/wall/beam/slab στο 3Δ → εμφανίζονται X/Z rings →
  σύρε → γέρνει **live** → release **μένει** γερμένο → **undo** επαναφέρει· snap στις 15°·
  **Shift** = ελεύθερη γωνία. Σκάλα = χωρίς tilt rings· multi-select = χωρίς tilt rings.
- **🔴 Browser** (Phase 3): γείρε κολώνα/τοίχο στο 3Δ → γύρνα στην **2Δ κάτοψη** → φαίνονται
  **ΔΥΟ περιγράμματα ενωμένα με γραμμές**: το **cut-plane footprint** (μετατοπισμένο,
  **παχύ/cut** στυλ + hatch) και η **βάση** (πραγματική θέση, **λεπτό** outline)· grips στη
  βάση. Δοκάρι/πλάκα = ίδιο footprint (μόνο τομή αλλάζει). **BOQ αμετάβλητο**.

---

## Changelog
- **2026-06-01 (Opus 4.8) — Phase 4.1: tilt-aware attach clip** (pending commit, 🔴 verify Giorgio). Μετά το Phase 4, σε attached τοίχο+δοκάρι (το δοκάρι χωνεύει στην κορυφή) η κλίση μετακινούσε την εγκοπή μαζί με τον τοίχο ενώ το δοκάρι έμενε → ξεκρέμαστη τρύπα. Root: ο ADR-401 clip είναι plan-based (κατακόρυφη προβολή). Fix: ΝΕΟ `tiltCompensateWallTopClip` (`wall-top-clip.ts`) που un-shear-άρει κάθε host footprint κατά `−wallTiltShearAt(params, Hu)` ΠΡΙΝ το clip (geometrically: `quad ∩ (host − shear(Hu))`)· breakpoints recompute· ύψη ανέπαφα. Ο converter το καλεί μόνο `isWallTilted` (no-op flat). ΝΕΟ `wall-tilt-attach-clip-3d.test.ts` 5/5 + regression 46/46, tsc 0.
- **2026-06-01 (Opus 4.8) — Phase 4: pieces/prism 3Δ tilt** (pending commit, 🔴 verify Giorgio). Η κλίση τοίχου/κολώνας φαινόταν στην 2Δ κάτοψη αλλά ΟΧΙ στο 3Δ όταν το στοιχείο ήταν **attached** ή είχε **ανοίγματα** (πήγαινε στον pieces/prism path που δεν καλούσε `applyWallTilt`/`applyColumnTilt`). Fix: `mesh-slope-shear.ts` shear functions += optional `baseHeightM` (anchor=FFL για τα floor-local pieces· default 0 = solid path byte-for-byte)· `emit()` του `buildStraightWallWithOpenings` shear-άρει κάθε piece (`yOffset−floorY`)· ο attached column prism path καλεί `applyColumnTilt`. 3Δ === 2Δ (ίδιο `wallTiltShearAt`/`columnTiltShearAt` SSoT). Live preview διορθώνεται αυτόματα (περνά από `wallToMesh`/`columnToMesh`). ΝΕΟ `wall-tilt-pieces-3d.test.ts` 7/7· regression 34/34 + live-preview 14/14, tsc 0. Αίρει το «Flat path μόνο» limitation. Follow-up: curved/polyline τοίχος με tilt.
- **2026-06-01 (Opus 4.8) — 🐛 FIX: περιστροφή ΚΕΚΛΙΜΕΝΗΣ κολώνας/πλάκας δεν περιέστρεφε τη φορά κλίσης** (pending commit, 🔴 verify Giorgio). Σύμπτωμα Giorgio: κεκλιμένη κολώνα (lean στην κάτοψη) → δεξιόστροφη περιστροφή → **preview σωστό** (βάση+κορυφή+κλίση στρέφονται γύρω από το κέντρο), αλλά στο **release** η βάση πάει στη νέα θέση **χωρίς να ολοκληρωθεί η περιστροφή** — «σαν μετακίνηση». **Root cause:** η `rotateColumn`/`rotateSlab` (`bim-rotate-geometry.ts`, ADR-363 Phase 7.2 — γράφτηκε **πριν** το ADR-404 tilt) περιέστρεφε `position`+`rotation` (κολώνα) / `outline` (πλάκα) αλλά **όχι** το `tilt.direction` / `slope.direction`, που είναι **ΑΠΟΛΥΤΗ plan-γωνία** (`columnTiltShearAt`/`slabSlopeOffsetZmm` = cos/sin(direction), ανεξάρτητο `rotation`/outline). Άρα η commit-γεωμετρία είχε το lean στην **παλιά** φορά → ≠ rigid preview (που στρέφει τα πάντα) → «snap» στο release. **Γιατί μόνο κολώνα/πλάκα:** ο τοίχος (`tilt {angle}` ⟂ run) + το δοκάρι (`topElevationEnd` κατά τον άξονα) παράγουν την κλίση τους από `start/end`, που **ήδη** περιστρέφονται → ακολουθούν αυτόματα. **Fix:** `rotateColumn`/`rotateSlab` → `tilt.direction`/`slope.direction` += `angleDeg` (normalizeAngleDeg) όταν υπάρχει tilt/slope· no-op για flat (byte-for-byte). +3 tests (`bim-rotate-geometry.test.ts`: column tilt.direction rotates / non-tilted no tilt field / slab slope.direction rotates) → 20/20 PASS, tsc 0. **Follow-up (flagged, ξεχωριστό):** το `bim-mirror-geometry.ts` (mirror transform) έχει ανάλογο κενό — η αντανάκλαση κεκλιμένου στοιχείου πρέπει να **ανακλά** το direction (όχι μόνο +angle)· δεν το άγγιξα (Giorgio δεν ανέφερε mirror).
- **2026-06-01 (Opus 4.8) — Bug fix ADR-401↔402/404 (attached element vanish on gizmo
  commit), pending browser verify:** μετά το ADR-401 persistence fix (attached τοίχοι/κολώνες
  μένουν `attached`), εκτέθηκε flat-path κενό στο gizmo preview. **Fix:** το `bim3d-preview-
  rebuild.ts` re-resolve-άρει πλέον τα attach top/base profiles (mirror `BimSceneLayer.
  syncWalls`/`syncColumns` — `buildWallHostInputs` + `resolveWall/ColumnTop/BaseProfile`,
  `floorElevationMm=0`) στο tilt + resize preview → **preview === committed** (κανένα flat-top
  drift). Non-attached → byte-for-byte fast path. 249/249 gizmo/animation tests, tsc 0.
  ⚠️ **Επιφύλαξη:** το static analysis έδειξε ότι το `wallToMesh` έχει fall-back στο flat
  solid (δεν θα έπρεπε να βγάζει null), οπότε το ακριβές vanish mechanism δεν επιβεβαιώθηκε
  στατικά· ο **plan-rotate (Y-ring)** χρησιμοποιεί ξεχωριστό rigid path (captures το profiled
  original) — αν συνεχίσει να εξαφανίζεται μετά απ' αυτό, το πρόβλημα είναι στο resync
  trigger/timing, όχι στο preview. **ΜΗΝ πειραχθεί** το ADR-401 persist (`bim:entities-attached`).
- **2026-06-01 (Opus 4.8) — Phase 3 fix ×2 (browser feedback Giorgio):** (1) αρχικά
  μετατόπιζε ΟΛΟ το σύμβολο → η βάση χανόταν· (2) έδειχνε **δύο** περιγράμματα αλλά με
  ανεστραμμένα line weights (βάση παχιά/cut λεπτό). **Τελικό σωστό Revit slanted-in-plan:**
  το πλήρες σώμα (fill/hatch/**παχύ** stroke = cut στυλ) μεταφέρεται στο **cut plane** (όπου
  κόβεται πραγματικά)· η **βάση** = **λεπτό** projection outline στην πραγματική θέση·
  **connecting lines** στις γωνίες. ΝΕΟΣ κοινός helper `cut-plane-tilt-projection.ts`
  (`drawCutPlaneTiltProjection` βάση+connectors + `cutPlaneShiftScreenDelta` για το body
  translate· κολώνα ring=footprint, τοίχος ring=outer+inner.reversed)· screen-delta →
  `columnCutPlaneShiftCanvas`/`wallCutPlaneShiftCanvas` (canvas-world shift). Grips στη βάση
  (ευθυγραμμισμένα με το λεπτό base square). 32/32 tests, tsc 0.
- **2026-06-01 (Opus 4.8, Plan Mode, Developer A SOLO)** — **Phase 3: 2Δ προβολή στο
  cut plane + section parity** (pending commit, 🔴 browser verify). ΝΕΟ SSoT
  `cut-plane-tilt.ts` (`columnCutPlaneShiftMm`/`wallCutPlaneShiftMm` + screen-delta helpers,
  reuse Phase-1 `columnTiltShearAt`/`wallTiltShearAt`, clamp `[0,height]`). Render-time
  `ctx.translate` σε `ColumnRenderer`/`WallRenderer` (κάτοψη) + ίδιο shift στα
  `toColumnPlan`/`toWallPlan` (`section-intersect`) + `cutPlaneMm` feed από
  `section-scene-sync`. **Recognition: ΟΧΙ shift στα `compute*Geometry`** (διπλό 3Δ shift +
  69 consumers) — render-time μόνο. **Δοκάρι/πλάκα = section-only** (κατακόρυφη κλίση →
  κάτοψη αμετάβλητη· τομή ήδη `slopeYAt`). BOQ αμετάβλητο. File-size split:
  `column-render-palette.ts`. 32/32 tests (cut-plane 13 νέα + section 19), tsc 0.
  Limitations: grips/hit-test στο πραγματικό footprint· section single-slice (όχι lean).
- **2026-06-01 (Opus 4.8, Developer A SOLO)** — **Phase 2: gizmo X/Z rings → tilt**
  (pending commit, 🔴 browser verify). Drag bridge rotate→axis-generalized + ΝΕΟ `tilt`
  outcome + angle snap (`setShiftHeld`)· ΝΕΟ SSoT `bim3d-tilt-bridge.ts`
  (`snapTiltAngleDeg` reuse `AngleUtils.snapAngleToStep` + `compute*TiltParams`)· overlay
  `TILT_HANDLES_BY_TYPE` (column/wall/beam/slab, single-select)· live preview per-frame
  converter rebuild (ΝΕΟ `buildTiltPreviewObject`, swap path του resize)· dispatch
  `case 'tilt'`→`buildTiltCommand`. **Recognition: reuse `Update*ParamsCommand`** (column/
  wall `tilt`, beam `topElevationEnd`, slab `slope`) — **καμία νέα εντολή**, ΕΝΑ undo (το
  plan ανέφερε `SetColumnTiltCommand`, απορρίφθηκε). 59/59 gizmo tests (tilt 16 + drag 4 +
  overlay 3 νέα), tsc 0. Limitations: flat path / single-select / off-axis ⟂-DOF / 2Δ flat.
- **2026-06-01 (Opus 4.8, Plan Mode, Developer A SOLO)** — **Phase 1: data model + 3Δ
  converters** (pending commit, 🔴 browser verify). ΝΕΑ πεδία `ColumnTilt`/`WallTilt` +
  `tilt?` (column/wall types + Zod schemas)· ΝΕΑ SSoT `column-tilt.ts`/`wall-tilt.ts`
  (unit-safe shear, αδέλφια beam/slab slope)· ΝΕΟ κοινό `applyHorizontalTiltShear` +
  `applyColumnTilt`/`applyWallTilt` στο `BimToThreeConverter` (flat solid path).
  Tilt-as-shear (κορυφή γέρνει, βάση+ύψος μένουν, ADR-369). **+File-size split:** οι 5
  shear functions εξήχθησαν σε ΝΕΟ `mesh-slope-shear.ts` (converter 493→535→442 γρ <500).
  93/93 tests (tilt 19 + converter slope/beam/slab 74), tsc 0.
  Limitations: flat path μόνο (attached/openings = follow-up)· καμία UX (Phase 2/3).
