# HANDOFF — Έξυπνη αλλαγή τύπου κολώνας σε **Τ (T-shape)** με **ΔΥΟ κάθετα δοκάρια**: dual-beam alignment + πλήρης επανα-μελέτη

**Ημ/νία:** 2026-06-19 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλους agents. `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. tsc = ένας τη φορά (N.17 — έλεγξε running tsc πρώτα). **ΜΗΝ αγγίξεις** uncommitted αρχεία άλλων agents (έλεγξε `git status` πρώτα).

**Απαιτήσεις Giorgio:** full enterprise + full SSOT, Revit-grade (όπως οι μεγάλοι παίκτες). **ΠΡΙΝ γράψεις κώδικα → πραγματικό SSoT audit (grep)** (τα anchors είναι έτοιμα στο §4/§5 — ΕΠΕΚΤΕΙΝΕ, μηδέν διπλότυπα). **Plan mode** πριν υλοποιήσεις, **ζήτα έγκριση**. Διάβασε ΠΡΩΤΑ: `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`.

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (στιγμιότυπο-απόδειξη)

`C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-19 004244.jpg`

**Στήσιμο:** ορθογωνική κολώνα στην οποία **κολλάνε ΔΥΟ δοκάρια με κάθετες μεταξύ τους διευθύνσεις** (ένα οριζόντιο που «περνά ευθεία», ένα κατακόρυφο που «καταλήγει» → T-junction, πλήρως μελετημένος οργανισμός). Ο χρήστης **άλλαξε τον τύπο της κολώνας** `rectangular → T-shape` (Τ κεφαλαίο ελληνικό).

**Το πρόβλημα (πράσινες σημειώσεις α1/α2/β1/β2):** το νέο Τ τοποθετήθηκε **έκκεντρα/λάθος προσανατολισμένο** — τα σκέλη του (πέλμα + κορμός) δεν «πατάνε» στα δοκάρια. Φαίνεται σχεδόν σαν περιστραμμένος σταυρός, όχι ευθυγραμμισμένο Τ.

**Τι θέλει ο Giorgio (Revit-grade smart placement, dual-beam):**
1. Το **σκέλος του ποδιού του Τ** (ο **κορμός/web**, βάση **Α1**) να **ταυτιστεί flush** με την **πλευρά Α2** του ενός δοκαριού.
2. Το **δεξί σκέλος του Τ** (το **πέλμα/flange**, **Β1**) να **ταυτιστεί flush** με την **αριστερή πλευρά Β2** του άλλου (κάθετου) δοκαριού.
3. Δηλαδή: **κάθε στοιχείο του Τ ευθυγραμμίζεται στο αντίστοιχο δοκάρι** — οι παρειές του ταυτίζονται με τις παρειές του δοκαριού, ο προσανατολισμός (rotation) προκύπτει από τις **δύο κάθετες διευθύνσεις** των δοκαριών, η γωνία/συμβολή του Τ κάθεται στον **κόμβο** (τομή των δύο αξόνων).
4. **«Το σύστημα πρέπει να είναι ΕΞΥΠΝΟ»** — τα catalog defaults του Τ (`flangeLength=width`, `webThickness=depth/3`) είναι placeholders· το smart-fit τα **υπερισχύει** βάσει των δοκαριών.

**Πλήρης αυτοματοποίηση (μετά το fit):** ξανα-υπολογισμός διατομών + οπλισμού **κολώνας**, **πέδιλο** + οπλισμοί, **διατομές + οπλισμός δοκαριών** (ο proactive κύκλος ακούει ήδη `bim:column-params-updated` — ΗΔΗ wired, βλ. §2).

> **Αρχή αναφοράς:** τα **δοκάρια είναι ο reference** — η **κολώνα Τ προσαρμόζεται** (προσανατολισμός/πάχη σκελών/θέση). Τα δοκάρια ΜΕΝΟΥΝ στη θέση τους.

---

## 2. ΤΙ ΗΔΗ ΛΥΘΗΚΕ (χτίσε ΕΠΑΝΩ — μην το ξανακάνεις)

**ADR-496 (UNCOMMITTED, 2026-06-19, δικό μου):** έξυπνη ευθυγράμμιση κολώνας στο **ΕΝΑ** πλαισιωτικό δοκάρι κατά την αλλαγή τύπου, **v1 = L-shape μόνο**. Παρέδωσε **τον γενικό μηχανισμό** που το T-shape dual-beam θα **ΕΠΕΚΤΕΙΝΕΙ**:
- **NEW pure SSoT** `bim/columns/column-beam-align.ts` → `alignColumnToFramingBeam(column, nextParams, framingBeams) → ColumnParams | null`. Bearing-arm fit: `armWidth==beam.width`, άξονας≡άξονας δοκαριού, όψη flush στην παρειά. **Κλειστή λύση anchor='center':** `position = E_n − R(θ)·(P_local·s)`, `θ=atan2(−u.x, u.y)`. Reuse `unitVector`+`rotateVector` (grip-math SSoT), `mmToSceneUnits`.
- **NEW** `findBeamsFramingColumn(column, entities)` στο `column-structural-attach-coordinator.ts` (reverse του `findColumnsFramedByBeamForGraph`, reuse `beamFramesColumn` ADR-494).
- **Command-time hook** στο `useColumnParamsDispatcher.ts`: αλλαγή `kind` → fit ΠΡΙΝ το `UpdateColumnParamsCommand` (ΕΝΑ command/emit, **ΟΧΙ reactive** — μάθημα ADR-492 freeze).
- **7 jest** `bim/columns/__tests__/column-beam-align.test.ts`.
- **DEFER που γράφτηκε ρητά → ΑΥΤΟ ΕΙΝΑΙ ΤΟ TASK ΣΟΥ:** «corner κολώνα **2 δοκάρια** (dual-leg alignment)» + «T/U/I/composite (ίδιο μοτίβο)».

**Ο proactive κύκλος ΗΔΗ τρέχει** σε `bim:column-params-updated` (`useStructuralOrganism` / `useAutoFoundationDesign` / `useProactiveStructuralLoads` / `useProactiveOrganismReinforce` / `useColumnPersistence`). **Άρα η «πλήρης αυτοματοποίηση» ΗΔΗ πυροδοτείται** — αρκεί η αλλαγή params να βγει σωστή ΜΙΑ φορά (command-time).

---

## 3. ROOT CAUSE (γιατί βγαίνει λάθος το Τ)

(α) Ο command-time hook στο `useColumnParamsDispatcher` καλεί `alignColumnToFramingBeam` **μόνο για `kind==='L-shape'`** → για `T-shape` περνά τα raw `nextParams` αυτούσια → το `buildTshapeLocal` στήνει το Τ γύρω από το ίδιο insertion point με catalog defaults → **έκκεντρο/λάθος προσανατολισμός**.

(β) Ακόμη κι αν περνούσε από align, το **single-beam** bearing-arm μοντέλο δεν αρκεί: το Τ θέλει **δύο** δοκάρια να ορίσουν **ταυτόχρονα** προσανατολισμό (rotation) + θέση + πάχη **δύο** σκελών (πέλμα + κορμός).

---

## 4. SSoT AUDIT (anchors — ΕΠΕΚΤΕΙΝΕ, ΜΗΔΕΝ διπλότυπα· ΚΑΝΕ ΚΑΙ ΔΙΚΟ ΣΟΥ grep)

| Concept | SSoT (extend) |
|---|---|
| **Single-beam align (REUSE/EXTEND)** | `bim/columns/column-beam-align.ts` `alignColumnToFramingBeam` (το μοτίβο near-end/u_span/anchor-center inverse). Πρόσθεσε dual-beam branch ή νέα `alignTShapeColumnToFramingBeams`. |
| **Framing detection (REUSE)** | `column-structural-attach-coordinator.ts` `findBeamsFramingColumn` (επιστρέφει **όλα** τα framing beams· εδώ περιμένεις **2 κάθετα**). `beamFramesColumn` (ADR-494, private) + `projectColumnFootprintOnAxis` / `columnSupportAlong` (`column-face-trim.ts`). |
| **T-shape γεωμετρία** | `bim/geometry/column-geometry.ts` `buildTshapeLocal` (203). ⚠️ **ΚΡΙΣΙΜΟ GAP:** `flangeDepth = Math.max(s, (depth/3)*s)` είναι **HARD-CODED**, ΟΧΙ override field! Για να γίνει `πάχος πέλματος == πλάτος flange-δοκαριού` χρειάζεσαι **νέο `ColumnTshapeParams.flangeThickness`** (mirror `webThickness`) ΚΑΙ wiring σε `buildTshapeLocal` + `columnFootprintDims` + grips/anchors. |
| **T-shape params** | `bim/types/column-types.ts` `ColumnTshapeParams` (93): `flangeLength?` (πλάτος πέλματος X), `webThickness?` (πάχος κορμού Y), `flipY?`. **ΛΕΙΠΕΙ `flangeThickness?`** (βλ. πάνω). |
| **Axis normal / direction (REUSE)** | `bim/grid/axis-normal.ts` `canonicalAxisNormal` (orientation-invariant)· `bim/grips/grip-math.ts` `unitVector` + `rotateVector` (→ `rotatePoint`, ADR-188). ΜΗΝ ξανα-υπολογίσεις unit vector με το χέρι (το διόρθωσα ήδη μία φορά στο ADR-496). |
| **Centre-anchored transform (REUSE)** | `bim/grips/centred-anchor-frame.ts` `centredPolyToWorld`/`centredLocalToWorld` (`world = position + R·p_local` με anchor='center'). Το ADR-496 το αντιστρέφει για να λύσει `position`. |
| **Flush direction (reference)** | `bim/beams/beam-column-flush.ts` `resolveBeamColumnFlushJustification` (freehand δοκάρι→flush σε κολώνα — **αντίστροφο** concern· reference για το «ποια πλευρά»). |
| **Proactive re-study (ΗΔΗ wired — verify)** | `hooks/useStructuralOrganism.ts` / `useAutoFoundationDesign.tsx` / `useProactiveStructuralLoads.ts` / `useProactiveOrganismReinforce.ts` — όλα ακούν `bim:column-params-updated`. |

---

## 5. Anchors προς υλοποίηση (ΕΠΕΚΤΕΙΝΕ, μηδέν duplicate)

1. **`ColumnTshapeParams.flangeThickness?`** (NEW field, mm) + wiring στο `buildTshapeLocal` (αντικατάστησε το hard-coded `depth/3` με `override?.flangeThickness ?? depth/3`) + `columnFootprintDims` (αν επηρεάζει bbox — το flange depth ΔΕΝ αλλάζει bbox X/Y, αλλά verify) + grips/anchors/panel descriptor (`column-property-fields.ts`). **Αυτό είναι προϋπόθεση** για «πάχος πέλματος == πλάτος δοκαριού».
2. **Dual-beam alignment** — επέκτεινε το `column-beam-align.ts`:
   - NEW pure `alignTShapeColumnToFramingBeams(column, nextParams, framingBeams) → ColumnParams | null` (ή γενίκευσε το υπάρχον με per-kind branch).
   - Λογική: βρες **2 κάθετα** framing beams (perp-check μέσω `unitVector` dot ≈ 0). Όρισε ποιο = **flange-beam** (το «συνεχόμενο», ∥ πέλμα) και ποιο = **web-beam** (το «καταλήγον», ∥ κορμός). Heuristic: το web-beam «καταλήγει» στον κόμβο (το ένα άκρο του ≈ τομή αξόνων)· το flange-beam «περνά ευθεία» (ο κόμβος είναι **εσωτερικός** στο span του). Αν και τα δύο καταλήγουν → όποιο ταιριάζει στον προσανατολισμό· flag ambiguity.
   - **rotation:** το τοπικό +Y του Τ (κατεύθυνση κορμού→πέλμα) ευθυγραμμίζεται ώστε ο **κορμός** ∥ web-beam ΚΑΙ το **πέλμα** ∥ flange-beam (κάθετα — αυτόματα συμβατό αφού τα δοκάρια είναι κάθετα). `rotation` από `atan2` της κατεύθυνσης κορμού (web-beam outward).
   - **πάχη:** `webThickness = web-beam.width`, `flangeThickness = flange-beam.width`.
   - **position (anchor='center'):** λύσε ώστε (i) ο κορμός centerline ≡ άξονας web-beam· (ii) το πέλμα centerline ≡ άξονας flange-beam· (iii) η παρειά Α1 του κορμού flush στην παρειά Α2 + η παρειά Β1 του πέλματος flush στην Β2. Με 2 κάθετους περιορισμούς το (position, rotation) ορίζεται **πλήρως** (κλειστή λύση — αντιστροφή `centredLocalToWorld`, ίδιο pattern ADR-496· πιν P_local = το reentrant-corner ή ο κόμβος, πιν στην τομή των αξόνων).
3. **Hook στο `useColumnParamsDispatcher`:** πρόσθεσε `T-shape` στο command-time gate (μαζί με L-shape· ίδιο ΕΝΑ command/emit, **ΟΧΙ reactive**).
4. **Full-automation verify:** μετά το fit + emit, επιβεβαίωσε επανα-μελέτη (§2).

### Edge cases
- **Ακριβώς 2 κάθετα δοκάρια** → ιδανικό Τ. **1 δοκάρι** → fallback (πιθανώς single-beam fit στο πέλμα ή κορμό· flag). **>2 / μη-κάθετα** → πλησιέστερο ζεύγος ή catalog fallback (μηδέν regression).
- Ποιο σκέλος = πέλμα vs κορμός: από το «συνεχόμενο vs καταλήγον» (κόμβος εσωτερικός/ακραίος στο span).
- Διατήρησε undo ατομικό (ένα command).
- **Beam endpoints after reshape:** μετά το reshape, τα άκρα των δοκαριών πρέπει να κάθονται στις νέες παρειές του Τ — ο cutback (ADR-458) το χειρίζεται οπτικά· το αναλυτικό μήκος ίσως θέλει το ADR-492 reframe (συντονίσου, ΜΗΝ φτιάξεις reactive re-emit → freeze).

---

## 6. 🚨 ΜΑΘΗΜΑΤΑ
- **ADR-492 FREEZE:** ΠΟΤΕ reactive effect που re-emit-άρει geometry event μέσα στον engaged proactive κύκλο → freeze. Κάθε re-trigger = **command-time**, ΕΝΑ emit.
- **CODE = SOURCE OF TRUTH:** reuse `alignColumnToFramingBeam`/`findBeamsFramingColumn`/`beamFramesColumn`/`unitVector`/`rotateVector`/`centredPolyToWorld` — ΜΗΝ ξαναγράψεις. (Στο ADR-496 ξανα-υπολόγισα unit vector με το χέρι → ο Giorgio το έπιασε σε SSoT audit → διορθώθηκε. **Μην το ξανακάνεις.**)
- **Catalog vs smart:** τα stored kind defaults = placeholders· το smart-fit τα υπερισχύει.
- **T-shape geometry gap:** το `flangeDepth` είναι hard-coded `depth/3` — χρειάζεται νέο param πριν το «πάχος πέλματος == πλάτος δοκαριού».

## 7. ❌ ΜΗΝ
- ΜΗΝ commit/push (Giorgio μόνο). ΜΗΝ `git add -A` (shared tree).
- ΜΗΝ διπλασιάσεις detection/flush/projection/geometry/unit-vector (§4) — reuse/extend.
- ΜΗΝ φτιάξεις reactive effect που re-emit-άρει geometry event.
- ΜΗΝ αγγίξεις uncommitted αρχεία άλλων agents (έλεγξε `git status`· ο ADR-497 FEM-axial agent + ADR-495 slab-load έτρεχαν παράλληλα).

## 8. ΕΚΤΕΛΕΣΗ
1. Διάβασε ADR-487 (vision) + **ADR-496** (το single-beam μοτίβο που επεκτείνεις) + ADR-494 (footprint detection) + ADR-492 (reframe) + ADR-363 §5.6 (T-shape kind) + το στιγμιότυπο.
2. **SSoT grep audit** (επιβεβαίωσε anchors §4/§5· έλεγξε αν υπάρχει ήδη `flangeThickness` ή dual-beam helper).
3. **Plan mode** → `flangeThickness` field + `alignTShapeColumnToFramingBeams` + command-time hook + automation verify· **ζήτα έγκριση**.
4. Υλοποίηση + jest (T-shape με 2 κάθετα δοκάρια: web∥beamA flush + flange∥beamB flush + πάχη· orientation οριζόντιο/κατακόρυφο/λοξό ζεύγος· 1-beam fallback· catalog fallback) + tsc background (N.17, ένας τη φορά).
5. **ADR:** **ADR-496 = δικό μου (column-beam-align L-shape), ADR-497 = άλλος agent (FEM-axial)** → πάρε **ADR-498** Ή **επέκτεινε ADR-496** (T-shape dual-beam ως Phase 2 του ίδιου concern — πιθανώς πιο καθαρό). Έλεγξε `adr-index.md` για collision πριν. + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).
6. **ΜΗΝ** commit — ο Giorgio.

## 9. Σχετικά αρχεία (anchors)
`bim/columns/column-beam-align.ts` (alignColumnToFramingBeam — EXTEND) · `bim/columns/column-structural-attach-coordinator.ts` (findBeamsFramingColumn / beamFramesColumn) · `bim/columns/column-face-trim.ts` (projectColumnFootprintOnAxis / columnSupportAlong) · `bim/geometry/column-geometry.ts` (buildTshapeLocal 203 — flangeDepth hard-coded!) · `bim/types/column-types.ts` (ColumnTshapeParams 93 — ΛΕΙΠΕΙ flangeThickness) · `bim/grid/axis-normal.ts` (canonicalAxisNormal) · `bim/grips/grip-math.ts` (unitVector / rotateVector) · `bim/grips/centred-anchor-frame.ts` (centredPolyToWorld) · `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts` (command-time hook — πρόσθεσε T-shape) · `ui/column-advanced-panel/column-property-fields.ts` (panel descriptor αν προσθέσεις flangeThickness UI) · `hooks/useStructuralOrganism.ts` + `hooks/useAutoFoundationDesign.tsx` (proactive re-study) · `docs/.../adrs/ADR-496-smart-column-type-change-align-to-beam.md` (το base ADR).
