# ADR-404 — 3D BIM Element Tilt (Slope-Based, All Axes)

| Field | Value |
|---|---|
| Status | 🟢 ACCEPTED — **Phase 1 (data model + 3Δ converters) + Phase 2 (gizmo X/Z rings → tilt) + Phase 3 (2Δ cut-plane projection + section parity) + Phase 4 (pieces/prism 3Δ tilt — attached/με-ανοίγματα) + Phase 4.1 (tilt-aware attach clip) + Phase 4.2 (tilt pocket band-split + sloped-underside host) + Phase 4.3 (topology-aware sub-loft) + Phase 5 (UX placement 2-κλικ + ribbon/property αριθμητικά — κολώνα) + Phase 5b (ribbon UX κεκλιμένος ΤΟΙΧΟΣ — 1-DOF magnitude+side, selected + drawing-mode born-tilted)** DONE (pending commit, 🔴 browser verify) |
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
tilt (ίδιο pattern, ξεχωριστά)· curved/polyline τοίχος με tilt
(`buildWallMeshWithOpenings`). Δοκάρι/πλάκα = δικό slope (ανεπηρέαστα). Σκάλα = no tilt by design.

### Phase 4.2 — Tilt pocket band-split (7→9) + sloped-underside host
**Bug:** σε **κεκλιμένο** attached τοίχο κάτω από δοκάρι που τον διασχίζει **λοξά**, ο
ομοιόμορφος shear (Phase 4 `emit()`) έγερνε ΚΑΙ τη διαγώνια κοπή του δοκαριού → η ζώνη
`Hu→nominal` ξέφευγε από την **κατακόρυφη** παρειά → δύο τριγωνικές τρύπες.
**Fix (band-split):** ΝΕΟ `clipWallBandTopRegionsTilted` (`wall-top-clip.ts`) — σπάει κάθε
**outside** μεταβατική περιοχή στο `Hu`: κάτω prism (`base→Hu`) + πάνω **loft band**
(`Hu→nominal`, `topFootprint = bottom − Δcut`, `Δcut = shear(nominal)−shear(Hu)`) ώστε μετά
τον shear η κοπή να ξαναγίνεται κατακόρυφη στο `host_real`. ΝΕΟ `buildWallLoftBandGeometry`
(`wall-piece-geometry.ts`, two-ring loft). Κριτήριο split = `hasPocket` (geometry-free).
**Sloped-underside host (Giorgio 2026-06-01, Firestore-verified):** δοκάρι με
`topElevationEnd≠topElevation` (π.χ. κλίση 3.7mm — οπτικά επίπεδο) θέτει `undersideZmmAt` →
το αρχικό gate **παρέκαμπτε** το band-split → fallback vertical clip → οι τρύπες επέστρεφαν.
**Fix:** το gate δέχεται πλέον single sloped host· `Hu` + `Δcut` γίνονται **per-vertex**
(`huLocalMAt(v)`/`dCutFn(v)`)· `WallTopLoftBand.huLocalM` → `bottomLocalM[]` (per-vertex,
sloped loft bottom)· lower prism top == loft bottom (watertight seam). Η πλαϊνή παρειά
δοκαριού είναι **κατακόρυφη** (σταθερό footprint extruded μεταξύ sloped top/underside) → η
κοπή ξαναγίνεται κατακόρυφη σε **κάθε** ύψος της κλίσης. `wall-tilt-pocket-band-split.test.ts`
62 PASS (incl. exact sloped-host repro), tsc 0. Διατηρείται multi-host fallback. Η
αντιστάθμιση (`tiltCompensateWallTopClip`) μένει single-shift (σφάλμα `Δh·tan(tilt)` sub-mm).

### Phase 4.3 — Topology-aware sub-loft
**Bug (Giorgio):** ακόμη τριγωνικές τρύπες σε λοξή διασταύρωση. Το constructive
`buildTopFootprintFromBottom` (ίδιο vertex-count, ΕΝΑ πολύγωνο) είναι **λάθος** όταν η κοπή,
μετατοπιζόμενη κατά `Δcut` ανεβαίνοντας, αλλάζει **τοπολογία** (γωνίες + **split** σε πολλά
πολύγωνα — μετρήθηκε `quad−host_atNominal` = 4-γωνο+3-γωνο). **Fix:** σπάσε το `Hu→nominal` στα
critical heights (`computeTiltLoftCriticalTs`, robust **sampling+bisection** του topology
signature — πιάνει edge-edge bridges) και loft **ανά slab σταθερής τοπολογίας ανά sub-polygon**
(`buildTiltTransitionLofts`): εκεί το constructive είναι exact, η επίπεδη παρειά δοκαριού κάνει
τα slabs συνεπίπεδα (μηδέν stepping). Watertight: top(slab j)==bottom(slab j+1)· lower prism
@Hu==slab-0 bottom.

**Robustness (root cause των κενών/penetration — Giorgio browser console):** το
`safeDifference` (`polygon-clipping`) **αποτυγχάνει** («Unable to complete output ring») στις
σχεδόν-εκφυλισμένες θέσεις όπου το λεπτό δοκάρι **γεφυρώνει** τον λεπτό τοίχο στο `Hu` (t≈0) →
graceful fallback κενό → διαφθορά τοπολογίας. **Fix:** ΝΕΟ SSoT `convex-polygon-difference.ts`
(analytic **half-plane peel**, Sutherland–Hodgman ανά ακμή του κυρτού host) — `quad ∖ host`
χωρίς boolean lib, **ποτέ** ring-completion failure, ξένα convex κομμάτια. Ο tilted clip
(`diffQuadMinusHostPieces`) το χρησιμοποιεί για **κυρτό** host (αποτύπωμα δοκαριού)· μη-κυρτό
host (L-shaped slab) → boolean fallback. Εξαλείφει ΚΑΙ το performance spam (μηδέν clipper στο
48-sample detection). 73/73 tests (νέο `convex-polygon-difference.test.ts` 11/11 + robustness
regression στις ακριβείς runtime coords: μηδέν clipper failure + watertight), tsc 0.

---

## Phase 5 — UX placement (2-κλικ base→top-lean) + ribbon/property αριθμητικά (κολώνα) — UNCOMMITTED 2026-06-22

**Στόχος (Giorgio):** να μπορεί ο χρήστης να **σχεδιάσει** κεκλιμένη κολώνα (όχι μόνο μέσω 3D gizmo
Phase 2). Recognition: όλη η γεωμετρία/3D/2D/undo της κλίσης υπάρχει ήδη (Φ1–Φ4.3) — **το μόνο κενό
ήταν το UX placement/numeric**. Μηδέν νέα γεωμετρία· αποκλειστικά wiring πάνω στο `tilt` SSoT.

- **NEW SSoT `bim/columns/column-tilt-from-points.ts`** — `tiltAngleFromBaseTop` (η **μόνη νέα** πράξη:
  `angle = atan(distMm/heightMm)`, αντίστροφο του `columnTiltShearAt`, unit-safe `canvasToMmScaleFor`, clamp 80°)
  + `resolveTopLeanTilt` (SSoT **composer**: direction μέσω **υπάρχοντος** `resolveColumnRotationDeg` (snapped),
  angle μέσω **υπάρχοντος** `snapTiltAngleDeg` — μηδέν διπλό atan2). Ο composer καλείται ΚΑΙ από το commit ΚΑΙ
  από το preview → **preview ≡ commit by construction**.
- **2-κλικ placement (Domain 1):** NEW `systems/cursor/ColumnTopLeanStore.ts` (sibling του `ColumnRotationStore`,
  κρατά `basePoint+anchor+rotationDeg`). `useColumnTool`: νέα FSM φάση `awaitingTopLean` + `slantMode` state·
  όταν slant ON + ελεύθερη τοποθέτηση → 1ο κλικ κλειδώνει βάση, 2ο ορίζει top-lean (reuse `resolveColumnRotationDeg`
  για snapped direction + `snapTiltAngleDeg` για γωνία). `column-preview-helpers`: live tilt ghost (mirror του
  rotation block). `ColumnParamOverrides += tilt`. **Slant μόνο σε freehand + ελεύθερη (όχι face-snap).**
- **Ribbon + property panel (Domain 2 — data-driven):** NEW command keys `tiltEnabled` (string) + `tiltAngle`/
  `tiltDirection` (nested `tilt.*` group στο `column-bridge-param-routing`, default 0 + **πλήρες ColumnTilt** σε
  μερικό patch)· combobox resolver: drawing-mode `tiltEnabled`→`setSlantMode`, selected→`params.tilt`· NEW ribbon
  panel `column-tilt` (toggle + γωνία + φορά) + NEW property group `tilt` (γράφει μέσω **υπάρχοντος**
  `UpdateColumnParamsCommand` — ίδιο με το gizmo, μηδέν νέα εντολή). i18n el+en (N.11).
- **Tests:** NEW `column-tilt-from-points.test.ts` (7) + `column-bridge-param-routing-tilt.test.ts` (5)· regression
  163/163 (column-face-snap + column-tilt geometry + bridge suites). 🔴 tsc (N.17) + browser-verify + commit.

### Documented limitations (Phase 5)
- Slant + face-snap συνδυασμός = DEFER (slant μόνο σε ελεύθερη τοποθέτηση)· grips στην κεκλιμένη κάτοψη μένουν
  στο 3D gizmo (κληρονομιά Φ3)· το 2-κλικ top-lean **αντικαθιστά** το rotation-2-κλικ όταν slant ON (η rotation
  διατομής έρχεται από το ribbon).

---

## Phase 5b — UX ribbon κεκλιμένος ΤΟΙΧΟΣ (1-DOF, selected + drawing-mode) — UNCOMMITTED 2026-06-22

**Στόχος (Giorgio):** ο χρήστης να ορίζει την **κλίση τοίχου** από το UI (όχι μόνο 3D gizmo Phase 2) —
αδελφό της κολώνας Phase 5, αλλά **προσαρμοσμένο στη φύση του τοίχου**. Recognition (SSoT audit, grep):
όλη η γεωμετρία/3D/2D/undo υπάρχει ήδη (`wall-tilt.ts` `WallTilt {angle}` + `wallTiltShearAt`/`isWallTilted`,
`computeWallTiltParams` gizmo, `UpdateWallParamsCommand`). **Το μόνο κενό = το ribbon wiring.** Μηδέν νέα γεωμετρία.

**Κρίσιμη διαφορά από κολώνα (ΟΧΙ copy-paste):**
- Τοίχος = **1-DOF** (`WallTilt {angle}` signed, lean ⟂ run) → **ΚΑΜΙΑ «φορά»**, **ΚΑΝΕΝΑ 2-κλικ** base→top
  (δεν φτιάχτηκε `wall-tilt-from-points` — δεν χρειάζεται· ο τοίχος γέρνει πάντα ⟂ στη run).
- UI επιλογή Giorgio: **μέγεθος γωνίας (0..80°) + πλευρά (Αριστερά/Δεξιά)** αντί ενός signed πεδίου. Το
  stored `tilt.angle` μένει το ΕΝΑ signed SSoT· η μετάφραση γίνεται σε ένα dedicated pure module.
- Drawing-mode: ο τοίχος **δεν είχε** tool-bridge store (η κολώνα έχει `columnToolBridgeStore`). Επειδή ο
  Giorgio θέλει «σχεδίασε ήδη κεκλιμένο», φτιάχτηκε **minimal** `wall-tool-bridge-store` (μόνο
  `{isActive, overrides, setParamOverrides}` — ΟΧΙ kind/anchor/slant-2-κλικ): ο τοίχος γεννιέται born-tilted
  μέσω `overrides.tilt` στο **υπάρχον** `buildDefaultWallParams`.

**Υλοποίηση (data-driven, μηδέν νέα εντολή):**
- **NEW `wall-tilt-param.ts`** — pure SSoT αμφίδρομης μετάφρασης signed `tilt.angle` ↔ {enabled, side, magnitude}:
  Αριστερά→**+**γωνία (κορυφή προς αριστερή κάθετη της φοράς start→end), Δεξιά→**−**. `resolveWallTiltComboboxState`
  / `applyWallTiltComboboxChange` χειρίζονται **ΚΑΙ** selected `WallEntity` (`dispatchParams`→`UpdateWallParamsCommand`)
  **ΚΑΙ** drawing-mode (`wallToolBridgeStore` overrides). Clamp 0..80°.
- **NEW `wall-tool-bridge-store.ts`** — minimal publish handle (mirror κολώνας, χωρίς το slant/kind machinery).
- **`wall-command-keys.ts`** — NEW `tilt` group (`tiltEnabled`/`tiltSide`/`tiltAngle`) + `isWallTiltKey` (διακριτό
  set → δρομολόγηση στον dedicated resolver, ΟΧΙ στους generic helpers).
- **`useRibbonWallBridge.ts`** — tilt branch σε `getComboboxState`/`onComboboxChange` (ΠΡΙΝ το null-check ώστε να
  τρέχει και σε drawing-mode), delegate στον resolver. **Καμία άλλη αλλαγή** (το pipeline υπήρχε).
- **`useWallTool.ts`** — publish του handle (single-writer effect, mirror columnToolBridgeStore).
- **`wall-completion.ts`** — `WallParamOverrides += tilt?` + apply στο `buildDefaultWallParams` (born-tilted).
- **`contextual-wall-tab.ts`** — NEW panel «Κλίση» (3 combobox: enabled + angle `numericInput {0,80}` + side).
- **i18n el+en (N.11):** `ribbon.commands.wallEditor.tilt.*` + `ribbon.panels.wallTilt`.
- **Tests:** NEW `wall-tilt-param.test.ts` (10) — signed↔magnitude+side, on/off, side flip, clamp, no-op.

### Documented limitations (Phase 5b)
- Slant μόνο post-creation property + drawing-mode born-tilted (ομοιόμορφο για όλα τα τμήματα του εργαλείου)·
  η κλίση καμπύλου/polyline τοίχου ακολουθεί την υπάρχουσα flat-path συμπεριφορά (κληρονομιά Φ4 limitation)·
  η πλευρά είναι meaningful μόνο όταν `angle ≠ 0` (το πρόσημο του 0 δεν αποθηκεύει πλευρά — δεν υπάρχει lean).
- DEFER (handoff): ίδιο numeric UX για πλάκα (`slope {direction, angle}`, σχεδόν mirror κολώνας).

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
- **2026-06-22 (Opus 4.8) — Phase 5b: ribbon UX κεκλιμένος ΤΟΙΧΟΣ** (pending commit, 🔴 browser verify). Αδελφό της κολώνας Phase 5, αλλά **1-DOF** (`WallTilt {angle}` signed, lean ⟂ run — **καμία φορά, κανένα 2-κλικ**). Recognition (SSoT grep audit): όλη η γεωμετρία/3D/2D/undo υπήρχε ήδη (`wall-tilt.ts`, `UpdateWallParamsCommand`)· μόνο ribbon wiring έλειπε. **Giorgio choices:** (1) UI = **μέγεθος 0..80° + πλευρά** (Αριστερά/Δεξιά) αντί signed πεδίου· (2) **και drawing-mode** «σχεδίασε ήδη κεκλιμένο». NEW `wall-tilt-param.ts` (pure SSoT: signed `tilt.angle` ↔ {enabled,side,magnitude}· Αριστερά→+, Δεξιά→−· clamp 80°· selected→`dispatchParams`/`UpdateWallParamsCommand` + drawing→`wallToolBridgeStore` overrides) + NEW minimal `wall-tool-bridge-store.ts` (`{isActive,overrides,setParamOverrides}` — χωρίς το kind/slant machinery της κολώνας). `wall-command-keys` += `tilt` group + `isWallTiltKey`· `useRibbonWallBridge` += tilt branch (ΠΡΙΝ null-check → drawing-mode)· `useWallTool` publish handle· `WallParamOverrides += tilt` apply στο `buildDefaultWallParams` (born-tilted)· NEW panel «Κλίση» (3 combobox, angle `numericInput {0,80}`)· i18n el+en. **Μηδέν διπλότυπη γεωμετρία/εντολή** (Giorgio SSoT audit ✅). NEW `wall-tilt-param.test.ts` 10/10 PASS. 🔴 tsc (N.17, background) + browser-verify + commit.
- **2026-06-02 (Opus 4.8) — Phase 4.3 robustness: clipper-free convex difference** (pending commit, 🔴 verify Giorgio). **Root cause των κενών + penetration** (επιβεβαιωμένο από browser console του Giorgio, ΟΧΙ stale build): το `safeDifference` (`polygon-clipping` μέσω `safe-polygon-boolean.ts`) πετά «Unable to complete output ring» στις **σχεδόν-εκφυλισμένες** θέσεις όπου το λεπτό δοκάρι (250mm) **μόλις-μόλις γεφυρώνει** τον λεπτό τοίχο (200mm) ΑΚΡΙΒΩΣ στο ύψος προσάρτησης (το topology split είναι στο `t≈0`). Το `computeTiltLoftCriticalTs` το καλεί 48+26×/region → graceful fallback κενό → λάθος critical heights → το `buildTiltTransitionLofts` ξανα-αποτυγχάνει → κενά + στοιχεία μέσα στο δοκάρι. Η Phase 4.3 ΛΟΓΙΚΗ ήταν σωστή (67 tests + αναλυτική απόδειξη)· το πρόβλημα ήταν **καθαρά robustness του polygon boolean**. **Fix:** ΝΕΟ SSoT `bim/geometry/shared/convex-polygon-difference.ts` — `subject ∖ convexHole` με **analytic half-plane peel** (`convexHole = ⋂ Lᵢ` ⟹ `S∖H = ⋃ᵢ (S ∩ L̄ᵢ)`, peel ώστε ξένα convex κομμάτια· κάθε βήμα = Sutherland–Hodgman σε ΕΝΑ ημιεπίπεδο → **ποτέ** δεν αποτυγχάνει). Ο `wall-top-clip.ts` (`diffQuadMinusHostPieces`) δρομολογεί στο analytic path για **κυρτό** host (αποτύπωμα δοκαριού = ορθογώνιο)· μη-κυρτό host → boolean fallback. Αντικαθιστά τα 3 `safeDifference` call sites του tilted path (signature detection + slab construction + outside prisms). Εξαλείφει ΚΑΙ το performance spam (μηδέν clipper στο per-frame live-preview detection). +ΝΕΟ `convex-polygon-difference.test.ts` 11/11 (correctness + degenerate bridge δεν πετά) + robustness regression στις ακριβείς runtime coords `wall_c23277ef`+`beam_f704603a` (assert: καμία SafePolygonBoolean αποτυχία + lofts>0 + watertight). 73/73 tilt tests + 116 broader sweep PASS, tsc 0. **Αίρει** το «pending robustness fix» από το handoff 2026-06-02.
- **2026-06-02 (Opus 4.8) — Phase 4.3: topology-aware sub-loft** (pending commit, 🔴 verify Giorgio). Μετά το 4.2, ο γερμένος τοίχος κάτω από **λοξό** δοκάρι έδειχνε ακόμη τριγωνικές τρύπες. **Root cause (Giorgio + μέτρηση):** το `buildTopFootprintFromBottom` είναι **constructive** (ίδιο vertex-count, ΕΝΑ πολύγωνο), αλλά καθώς η κοπή μετατοπίζεται κατά `Δcut` (~13cm για 15°/50cm) η **τοπολογία αλλάζει** — η διατομή αποκτά γωνίες ΚΑΙ **σπάει σε πολλά πολύγωνα** (μετρήθηκε: αληθινό `quad−host_atNominal` = 4-γωνο + 3-γωνο ενώ constructive = ένα 4-γωνο). Single-ring loft σταθερού count → λάθος σχήμα → τρύπες. Ίσχυε **και για flat δοκάρι** (το committed band-split `4d21ae6e` ήταν ήδη ελλιπές σε πραγματικές λοξές διασταυρώσεις). **Fix:** ΝΕΟ `computeTiltLoftCriticalTs` (robust **sampling+bisection** του topology signature — πιάνει edge-edge bridges που το αναλυτικό vertex-on-edge μοντέλο έχανε) + ΝΕΟ `buildTiltTransitionLofts` που σπάει το `Hu→nominal` στα critical heights και χτίζει **ένα slab loft ανά υπο-διάστημα σταθερής τοπολογίας ανά sub-polygon** (constructive exact εντός slab· επίπεδη παρειά δοκαριού → συνεπίπεδα slabs, μηδέν stepping· per-vertex sloped bottom στο slab-0). Δεν υπάρχει 3D CSG lib → χρήση 2D `safeDifference`. 67/67 tests (νέο topology suite: split detection, stacked slabs, base→Hu watertight, slab stacking), tsc 0.
- **2026-06-01 (Opus 4.8) — Phase 4.2: tilt pocket band-split + sloped-underside host** (pending commit, 🔴 verify Giorgio). Γερμένος attached τοίχος κάτω από δοκάρι που τον διασχίζει **λοξά** → δύο τριγωνικές τρύπες (ο ομοιόμορφος shear έγερνε τη διαγώνια κοπή). Fix part 1 (band-split, committed `4d21ae6e`): ΝΕΟ `clipWallBandTopRegionsTilted` σπάει κάθε outside μεταβατική περιοχή στο `Hu` → κάτω prism + πάνω loft band (`topFootprint = bottom − Δcut`) → κατακόρυφη κοπή μετά τον shear· ΝΕΟ `buildWallLoftBandGeometry`. Fix part 2 (sloped host, αυτή η συνεδρία): **root cause επιβεβαιωμένο με Firestore** — το δοκάρι `beam_f704603a` έχει `topElevationEnd=3003.7≠topElevation=3000` (κλίση 3.7mm) → `undersideZmmAt` set → το gate παρέκαμπτε το band-split → fallback → τρύπες. Fix: gate δέχεται single sloped host· `Hu`+`Δcut` **per-vertex**· `WallTopLoftBand.huLocalM`→`bottomLocalM[]`· lower prism top==loft bottom (watertight). 62/62 tests (incl. exact sloped repro), tsc 0. Cleanup: αφαιρέθηκαν τα `[TILT-DIAG]` logs που είχαν διαρρεύσει στο `4d21ae6e`.
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
