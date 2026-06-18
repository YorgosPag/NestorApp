# HANDOFF — Έξυπνη αλλαγή τύπου κολώνας σε **Γ (L-shape)** σε **ΓΩΝΙΑ με ΔΥΟ κάθετα δοκάρια**: dual-leg corner alignment + πλήρης επανα-μελέτη

**Ημ/νία:** 2026-06-19 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλους agents. `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. tsc = ένας τη φορά (N.17 — έλεγξε running tsc ΠΡΩΤΑ με `Get-CimInstance`). **ΜΗΝ αγγίξεις** uncommitted αρχεία άλλων agents (έλεγξε `git status` πρώτα· ADR-495 slab-load + ADR-497 FEM-axial έτρεχαν παράλληλα → `bim/structural/*`, `beam-structural-*`, `useStructuralOrganism`, `active-reinforcement`, `AutoReinforce*`).

**Απαιτήσεις Giorgio (αυτολεξεί):** «ΟΠΩΣ Η REVIT, ΜΕ ΣΥΣΤΗΜΑ FULL ENTERPRISE + FULL SSOT». **ΠΡΙΝ γράψεις κώδικα → πραγματικό SSoT audit (grep)** για να μη δημιουργήσεις διπλότυπα. **Plan mode** πριν υλοποιήσεις, **ζήτα έγκριση**. Διάβασε ΠΡΩΤΑ: `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`.

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (στιγμιότυπο-απόδειξη)

`C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-19 014157.jpg`

**Στήσιμο:** ορθογωνικό πλαίσιο δοκαριών με **κολώνες τύπου «Γ» (L-shape) στις ΓΩΝΙΕΣ**. Σε κάθε γωνία ενώνονται **ΔΥΟ κάθετα δοκάρια** (ένα οριζόντιο + ένα κατακόρυφο, και τα δύο **καταλήγουν** στη γωνία — corner junction, ΟΧΙ T-junction).

**Το πρόβλημα:** οι **μικρές επιφάνειες (παρειές) των σκελών** της Γ-κολώνας **δεν ενώνονται flush** με τις **μικρές πλευρές (παρειές) των δοκαριών**. Ο Giorgio: *«ΔΕΝ ΕΙΝΑΙ ΔΥΝΑΤΟΝ σε ένα ορθογώνιο πλαίσιο οι μικρές επιφάνειες των σκελών της κολώνας τύπου Γ να μην ενώνονται απόλυτα με τις μικρές πλευρές των δοκαριών. Θέλω έξυπνο σύστημα, όχι μπακάλικο γειτονιάς.»*

**Τι θέλει (Revit-grade, dual-leg corner):**
1. Το **κατακόρυφο σκέλος** του Γ → δομική συνέχεια του **κατακόρυφου δοκαριού** (πάχος σκέλους = πλάτος δοκαριού, άξονας≡άξονας, παρειές flush).
2. Το **οριζόντιο σκέλος** του Γ → δομική συνέχεια του **οριζόντιου δοκαριού** (ομοίως).
3. Η **γωνία** του Γ κάθεται στον **κόμβο** (τομή των δύο αξόνων). Ο σωστός **προσανατολισμός + handedness** προκύπτει αυτόματα από τις δύο κατευθύνσεις των δοκαριών — το Γ «γεμίζει» τη γωνία, τα δύο ελεύθερα άκρα βλέπουν προς τα ανοίγματα.
4. **Τα δοκάρια = reference, η κολώνα προσαρμόζεται.** Μετά το fit → πλήρης αυτόματη επανα-μελέτη (ΗΔΗ wired, §2).

> **Διαφορά από ADR-496 Phase 1 (single beam):** εκεί ευθυγραμμιζόταν **ΕΝΑ** σκέλος (bearing arm) στο πλησιέστερο δοκάρι· το δεύτερο σκέλος έμενε catalog-default → στη γωνία **δεν πατά** στο 2ο δοκάρι. **Διαφορά από Phase 2 (T-shape):** το T έχει **συμμετρικό** πέλμα + ένα δοκάρι «περνά ευθεία»· το **Γ είναι ασύμμετρο** και **ΚΑΙ ΤΑ ΔΥΟ δοκάρια καταλήγουν** → handedness και στους δύο άξονες.

---

## 2. ΤΙ ΗΔΗ ΛΥΘΗΚΕ (ΧΤΙΣΕ ΕΠΑΝΩ — ΜΗΝ ξανακάνεις, ΜΗΝ διπλασιάσεις)

**ADR-496 (UNCOMMITTED — Phase 1 + Phase 2, του προηγούμενου agent):** `docs/.../adrs/ADR-496-smart-column-type-change-align-to-beam.md`. Παρέδωσε **έτοιμο, reusable μηχανισμό** που το L-corner θα **ΕΠΕΚΤΕΙΝΕΙ** — όλα στο `bim/columns/column-beam-align.ts`:

- **Phase 1** `alignColumnToFramingBeam(column, nextParams, framingBeams)` — **single-beam** L bearing-arm fit (κλειστή λύση anchor='center': `position = E_n − R(θ)·(P_local·s)`). **ΑΥΤΟ είναι το σημείο που επεκτείνεις** για το 2-beam case.
- **Phase 2** `alignTShapeColumnToFramingBeams(...)` — **dual-beam T-junction**. Το **μοτίβο που θα μιμηθείς** (node = τομή αξόνων, per-leg πάχη = beam widths, κλειστή λύση).
- **Dispatcher** `alignColumnOnTypeChange(column, nextParams, framingBeams)` — routing ανά kind (L→Phase1, T→Phase2). **Εδώ προσθέτεις/αλλάζεις** το L branch ώστε με 2 κάθετα δοκάρια → dual-leg.
- **PRIVATE helpers στο ίδιο module (reuse ΑΠΕΥΘΕΙΑΣ — μηδέν export, μηδέν διπλότυπο):**
  - `bestPerpendicularPair(axes, cx, cy)` → βρίσκει το κάθετο ζεύγος + τον **κόμβο N** (τομή αξόνων, πλησιέστερος στο κέντρο).
  - `beamAxes(beams)` → beams + μοναδιαίες διευθύνσεις.
  - `beamEndsByProximity(beam, px, py)` → `{near, far, nearDist, farDist}` (ποιο άκρο κοντά/μακριά).
- **Command-time hook** στο `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts`: gate σε **κάθε** type-change → `alignColumnOnTypeChange` ΠΡΙΝ το `UpdateColumnParamsCommand` (ΕΝΑ command/emit, **ΟΧΙ reactive** — μάθημα ADR-492 freeze). **ΗΔΗ καλεί το dispatcher — δεν το αλλάζεις, απλώς ο dispatcher θα κάνει πλέον dual-leg για L.**

**Cross-cutting SSoT που έφτιαξε το Phase 2 (REUSE, exported):**
- `rotationDegToAlignLocalY(target)` — `bim/grips/grip-math.ts`. Κλειστή λύση «rotation ώστε τοπικό +Y → world διάνυσμα» (`atan2(−target.x, target.y)`). **ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟ** — ΜΗΝ ξαναγράψεις raw `atan2`.
- `lineIntersectionPoint(p0, u0, p1, u1)` — `bim/geometry/shared/polygon-utils.ts` (re-export από `polygon-axis-projection.ts`). Γενική τομή αξόνων (για τον κόμβο N).
- `findBeamsFramingColumn(column, entities)` — `bim/columns/column-structural-attach-coordinator.ts` (kind-agnostic footprint-based detection, ADR-494).

**Ο proactive κύκλος ΗΔΗ τρέχει** σε `bim:column-params-updated` (`useStructuralOrganism` / `useAutoFoundationDesign` / `useProactiveStructuralLoads` / `useProactiveOrganismReinforce` / `useColumnPersistence`). **Άρα η «πλήρης αυτοματοποίηση» πυροδοτείται ήδη** — αρκεί το command-time fit να βγάλει σωστά params ΜΙΑ φορά.

---

## 3. ROOT CAUSE (γιατί τα σκέλη του Γ δεν πατούν στη γωνία)

Στο `useColumnParamsDispatcher` η αλλαγή σε L-shape καλεί `alignColumnOnTypeChange` → branch L = `alignColumnToFramingBeam` (**single-beam**: διαλέγει το **πλησιέστερο** δοκάρι μέσω `nearestFramingBeam`, ευθυγραμμίζει ΜΟΝΟ το bearing arm). Το **δεύτερο** δοκάρι της γωνίας αγνοείται → το οριζόντιο σκέλος (`armLength`) μένει catalog-default `depth/3` → **δεν πατά** στην παρειά του 2ου δοκαριού (μπακάλικο). Χρειάζεται **dual-leg**: όταν υπάρχουν **2 κάθετα** framing beams, **και τα δύο** σκέλη να ευθυγραμμιστούν.

---

## 4. SSoT AUDIT (anchors — ΕΠΕΚΤΕΙΝΕ, ΜΗΔΕΝ διπλότυπα· ΚΑΝΕ ΚΑΙ ΔΙΚΟ ΣΟΥ grep)

| Concept | SSoT (reuse/extend) |
|---|---|
| **Single-beam L fit (EXTEND)** | `bim/columns/column-beam-align.ts` `alignColumnToFramingBeam`. Πρόσθεσε dual-leg μονοπάτι (ή NEW `alignLShapeColumnToFramingBeams`) + ρύθμισε το dispatcher L branch ώστε `framingBeams≥2 κάθετα → dual-leg`, αλλιώς → υπάρχον single. |
| **Dual-beam μοτίβο (MIMIC)** | `alignTShapeColumnToFramingBeams` (Phase 2) — node = `bestPerpendicularPair`, per-leg πάχη = beam.width, κλειστή λύση `position = N − R(θ)·(P_local·s)`. |
| **Perp-pair + node + endpoints (REUSE, private same-module)** | `bestPerpendicularPair` / `beamAxes` / `beamEndsByProximity` (column-beam-align.ts). |
| **rotation → align τοπικό +Y (REUSE)** | `bim/grips/grip-math.ts` `rotationDegToAlignLocalY`. ΜΗΝ ξαναγράψεις `atan2`. |
| **Τομή αξόνων (REUSE)** | `bim/geometry/shared/polygon-utils.ts` `lineIntersectionPoint`. |
| **Framing detection (REUSE)** | `column-structural-attach-coordinator.ts` `findBeamsFramingColumn` (επιστρέφει ΟΛΑ τα framing beams· εδώ περιμένεις 2 κάθετα). |
| **L-shape γεωμετρία** | `bim/geometry/column-geometry.ts` `buildLshapeLocal` (176). **Local frame (flipY=false):** vertical leg `x∈[−hw, −hw+armWidth]` πλήρες depth (κατά +Y)· horizontal leg (foot) `y∈[−hd, −hd+armLength]` πλήρες width (κατά +X)· **outer corner** `(−hw,−hd)` (κάτω-αρ), reentrant `(−hw+armWidth, −hd+armLength)`. Leg centerlines τέμνονται στο `(−hw+armWidth/2, −hd+armLength/2)` = ο **κόμβος** (→ N). |
| **L-shape params** | `bim/types/column-types.ts` `ColumnLshapeParams` (77): `armLength?` (πάχος foot, Y), `armWidth?` (πάχος vertical leg, X), `flipY?`. **⚠️ ΠΙΘΑΝΟ GAP — handedness:** υπάρχει ΜΟΝΟ `flipY` (όχι `flipX`). Πιθανώς **δεν χρειάζεται** `flipX` (αφού `flipX = flipY ∘ R(180°)` και η rotation είναι συνεχής), αλλά **ΕΠΑΛΗΘΕΥΣΕ** ότι το ζεύγος `(rotation, flipY)` καλύπτει **και τις 4 γωνίες** με σωστή αντιστοίχιση `armWidth↔κατακόρυφο beam / armLength↔οριζόντιο beam`. Αν ΟΧΙ → NEW `flipX` (mirror του `flangeThickness` pattern: type + `column.schemas.ts` + `buildLshapeLocal` + `bim-mirror-geometry` + grips). |
| **flangeThickness pattern (REFERENCE αν χρειαστείς νέο field)** | Phase 2 πρόσθεσε `ColumnTshapeParams.flangeThickness` → δες πώς wired: type + Zod + `buildTshapeLocal` + `materializeTshape` (de-dup) + validator. Ίδιο μοτίβο αν χρειαστείς `flipX`. |
| **Mirror handedness (REFERENCE)** | `bim/transforms/bim-mirror-geometry.ts` (~232): L-shape mirror = toggle `lshape.flipY`. |
| **Proactive re-study (ΗΔΗ wired — verify only)** | `hooks/useStructuralOrganism.ts` / `useAutoFoundationDesign.tsx` / `useProactiveStructuralLoads.ts` / `useProactiveOrganismReinforce.ts`. |

---

## 5. Anchors προς υλοποίηση (ΕΠΕΚΤΕΙΝΕ — μηδέν duplicate)

1. **Dual-leg L alignment** — στο `column-beam-align.ts`:
   - Όταν `framingBeams` έχουν **2 κάθετα** (reuse `beamAxes` + `bestPerpendicularPair` → κόμβος N): NEW `alignLShapeColumnToFramingBeams` (ή dual-leg branch).
   - **Αντιστοίχιση σκελών:** και τα δύο δοκάρια καταλήγουν στον κόμβο. outward dir κάθε δοκαριού = `unitVector(N, beamEndsByProximity(beam, N).far)`. Διάλεξε ποιο = **vertical leg** (∥ local +Y) και ποιο = **horizontal leg / foot** (∥ local +X).
   - **πάχη:** `armWidth = (vertical-leg beam).width`, `armLength = (horizontal-leg beam).width`.
   - **rotation:** `rotationDegToAlignLocalY(u_verticalOut)` (το vertical σκέλος εκτείνεται από τη γωνία κατά +Y προς το δοκάρι του).
   - **handedness:** μετά το rotation, έλεγξε αν `R(θ)·(+X) == u_horizontalOut` (foot εκτείνεται +X). Αν είναι **αντίθετο** → είτε swap vertical↔horizontal assignment, είτε `flipY` (δες §4 gap — προτίμησε rotation+flipY αν αρκεί· χρησιμοποίησε **cross product sign** `sign(cross(u_vertical, u_horizontal))` για deterministic chirality, ΟΧΙ if/else ανά γωνία).
   - **position (anchor='center'):** `P_local = (−W/2 + armWidth/2, −D/2 + armLength/2)` (ο κόμβος σε τοπικές mm, με το σωστό flipY) → `position = N − R(θ)·(P_local·s)`. Κλειστή λύση — ίδιο μοτίβο με Phase 1/2.
   - **bbox:** `W = max(width, armWidth)`, `D = max(depth, armLength)` (όπως Phase 1· τα leg lengths = catalog overall extents).
2. **Dispatcher:** το L branch → `framingBeams≥2 κάθετα ? dual-leg : alignColumnToFramingBeam(single)`. Διατήρησε το single-beam fallback (μηδέν regression για 1 δοκάρι).
3. **(Αν χρειαστεί) `ColumnLshapeParams.flipX`** — μόνο αν αποδειχθεί ότι rotation+flipY ΔΕΝ καλύπτει κάποια γωνία/αντιστοίχιση (mirror το `flangeThickness` wiring).
4. **Full-automation verify:** μετά το fit + emit → αυτόματη επανα-μελέτη (§2).

### Edge cases
- **Ακριβώς 2 κάθετα** → ιδανικό Γ corner. **1 δοκάρι** → υπάρχον single-beam bearing-arm (Phase 1, μηδέν regression). **>2** → καλύτερο κάθετο ζεύγος (`bestPerpendicularPair` ήδη διαλέγει το πλησιέστερο στο κέντρο). **μη-κάθετα** → `null` (catalog fallback).
- **Beam endpoints μετά το reshape:** ο cutback (ADR-458) χειρίζεται οπτικά την επικάλυψη· το αναλυτικό μήκος → ADR-492 reframe (ΜΗΝ φτιάξεις reactive re-emit → freeze).
- Διατήρησε undo ατομικό (ένα command).

---

## 6. 🚨 ΜΑΘΗΜΑΤΑ (από Phase 1+2 — διάβασέ τα)
- **SSoT self-audit ΣΤΟ ΔΙΚΟ ΣΟΥ diff:** ΠΡΙΝ πεις «τελείωσα», `grep` το diff σου για επαναλαμβανόμενα closed-forms (`atan2`/`Math.hypot`/cos-sin) + vertex loops → named helper. Στο Phase 2 ο agent είχε αφήσει `atan2` ×2 + endpoint `hypot` ×3 → ο Giorgio το έπιασε σε audit → de-dup σε `rotationDegToAlignLocalY` + `beamEndsByProximity`. **ΜΗΝ το ξανακάνεις.**
- **ADR-492 FREEZE:** ΠΟΤΕ reactive effect που re-emit-άρει geometry event μέσα στον engaged κύκλο → freeze. Κάθε re-trigger = **command-time, ΕΝΑ emit**.
- **CODE = SOURCE OF TRUTH:** reuse `rotationDegToAlignLocalY`/`lineIntersectionPoint`/`bestPerpendicularPair`/`beamEndsByProximity`/`unitVector`/`rotateVector`/`findBeamsFramingColumn` — ΜΗΝ ξαναγράψεις.
- **Catalog vs smart:** τα stored kind defaults (`armWidth=width/3`, `armLength=depth/3`) = placeholders· το smart-fit τα υπερισχύει.
- **Handedness deterministic:** χρησιμοποίησε **πρόσημο cross-product** (chirality), ΟΧΙ hard-coded if-ανά-γωνία (μπακάλικο). Κλειστή λύση, scale/rotation-invariant.

## 7. ❌ ΜΗΝ
- ΜΗΝ commit/push (Giorgio μόνο). ΜΗΝ `git add -A` (shared tree).
- ΜΗΝ διπλασιάσεις detection/perp-pair/node/rotation/endpoint math — reuse §4.
- ΜΗΝ φτιάξεις reactive effect που re-emit-άρει geometry event.
- ΜΗΝ αγγίξεις uncommitted άλλων agents (`git status` πρώτα: `bim/structural/*`, `beam-structural-*`, `useStructuralOrganism`, `active-reinforcement`, `AutoReinforce*`).
- ΜΗΝ λύσεις handedness με 4 hard-coded περιπτώσεις γωνίας — closed-form chirality.

## 8. ΕΚΤΕΛΕΣΗ
1. Διάβασε ADR-487 (vision) + **ADR-496** (Phase 1 single + Phase 2 dual-beam μοτίβο που επεκτείνεις) + ADR-494 (footprint detection) + ADR-492 (reframe) + το στιγμιότυπο.
2. **SSoT grep audit** (επιβεβαίωσε anchors §4· έλεγξε ειδικά αν rotation+flipY αρκεί ή χρειάζεσαι `flipX`).
3. **Plan mode** → dual-leg L alignment + (αν χρειαστεί) `flipX` + dispatcher branch + verify· **ζήτα έγκριση Giorgio**.
4. Υλοποίηση + jest (Γ σε 4 γωνίες ορθογωνίου: κάθε σκέλος flush+άξονας≡δοκάρι+πάχος=beam.width· orientation/handedness ανά γωνία· 1-beam→single fallback· μη-κάθετα→null) + tsc background (N.17, ένας τη φορά).
5. **ADR:** επέκτεινε **ADR-496** ως **Phase 3 (L-shape dual-beam / corner)** — ίδιο concern. + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ενημέρωσε τη γραμμή ADR-496) + MEMORY (`reference_smart_column_beam_align_on_type_change`). N.15.
6. **ΜΗΝ** commit — ο Giorgio.

## 9. Σχετικά αρχεία (anchors)
`bim/columns/column-beam-align.ts` (alignColumnToFramingBeam[Phase1 EXTEND] · alignTShapeColumnToFramingBeams[Phase2 MIMIC] · alignColumnOnTypeChange[dispatcher] · bestPerpendicularPair/beamAxes/beamEndsByProximity[private reuse]) · `bim/grips/grip-math.ts` (rotationDegToAlignLocalY) · `bim/geometry/shared/polygon-utils.ts`+`polygon-axis-projection.ts` (lineIntersectionPoint) · `bim/columns/column-structural-attach-coordinator.ts` (findBeamsFramingColumn) · `bim/geometry/column-geometry.ts` (buildLshapeLocal 176) · `bim/types/column-types.ts` (ColumnLshapeParams 77 — flipY only) · `bim/types/column.schemas.ts` (ColumnLshapeParamsSchema 70) · `bim/transforms/bim-mirror-geometry.ts` (~232 L flipY) · `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts` (command-time hook — ΗΔΗ καλεί dispatcher) · `hooks/useStructuralOrganism.ts`+`hooks/useAutoFoundationDesign.tsx` (proactive re-study) · `docs/.../adrs/ADR-496-...md` (base ADR — extend ως Phase 3).
