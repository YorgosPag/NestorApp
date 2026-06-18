# HANDOFF — Έξυπνη αλλαγή τύπου κολώνας: το νέο σχήμα (L/T/U/I) να **ευθυγραμμίζεται στο δοκάρι** + πλήρης αυτόματη επανα-μελέτη οργανισμού

**Ημ/νία:** 2026-06-19 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλους agents. `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. tsc = ένας τη φορά (N.17 — έλεγξε running tsc πρώτα). **ΜΗΝ αγγίξεις** uncommitted αρχεία άλλων agents (έλεγξε `git status` πρώτα· π.χ. ADR-495 slab-load τρέχει παράλληλος agent).

**Απαιτήσεις Giorgio:** full enterprise + full SSOT, Revit-grade (όπως οι μεγάλοι παίκτες). **ΠΡΙΝ γράψεις κώδικα → πραγματικό SSoT audit (grep)** (τα anchors είναι έτοιμα στο §4/§5 — ΕΠΕΚΤΕΙΝΕ, μηδέν διπλότυπα). **Plan mode** (cross-cutting) πριν υλοποιήσεις, **ζήτα έγκριση**. Διάβασε ΠΡΩΤΑ: `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`.

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (στιγμιότυπα-απόδειξη)

`C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-18 235720.jpg` (+ context: `…231904.jpg`)

**Στήσιμο:** 2 κολώνες 40×40 + πέδιλα, ενωμένες με δοκάρι (`w=250 d=700`) στις εσωτερικές παρειές (πλήρως μελετημένος οργανισμός). Ο χρήστης **άλλαξε τον τύπο της αριστερής κολώνας** `rectangular → L-shape`. Η ADR-494 (μόλις υλοποιήθηκε) έλυσε το **στατικό** σκέλος: η L αναγνωρίζεται πλέον ως στήριξη (όχι πρόβολος). **ΑΛΛΑ μένει το γεωμετρικό/τοποθέτησης σκέλος.**

**Το πρόβλημα (235720.jpg, πράσινες σημειώσεις):** το νέο L τοποθετήθηκε **έκκεντρα** — το σκέλος του δεν «πατά» στο δοκάρι. Σημειώσεις:
- βέλος **«1»** → η **αριστερή παρειά #1 του δοκαριού**.
- **«α»** (κυκλωμένο) → η **μικρή/λεπτή όψη του σκέλους** της L (το πάχος του σκέλους).

**Τι θέλει ο Giorgio (Revit-grade smart placement on type-change):**
1. Η όψη **«α»** του σκέλους της νέας L να **κολλάει ακριβώς (flush)** στην **αριστερή παρειά #1** του δοκαριού — ΟΧΙ έκκεντρα.
2. Ο **άξονας του σκέλους** της L να **ταυτίζεται** με τον **άξονα του δοκαριού**.
3. Το **πάχος του σκέλους** της L να **ταυτίζεται** με το **πλάτος του δοκαριού** (`armWidth == beam.width`).
4. **Και τα δύο σκέλη** (οριζόντιο + κατακόρυφο) να **προσαρμόζονται αυτόματα**· το **οριζόντιο σκέλος** με τη **δεξιά του πλευρά** να ακολουθεί την **αριστερή πλευρά του δοκαριού**.
5. **«Τα αποθηκευμένα είδη κολώνας είναι απλά catalog διατομές για να δείχνουν τύπους· κατά την αλλαγή το σύστημα πρέπει να είναι ΕΞΥΠΝΟ και να ΤΟΠΟΘΕΤΕΙ σωστά τη νέα κολώνα ταιριάζοντάς την στον οργανισμό.»** → τα defaults (`armWidth=width/3` κ.λπ.) είναι catalog placeholders· το smart-fit τα **υπερισχύει** βάσει του δοκαριού.

**Πλήρης αυτοματοποίηση (μετά το fit):** να ξανα-υπολογιστούν αυτόματα → διατομές + οπλισμός **κολώνας**, **πέδιλο** νέας κολώνας + οπλισμοί πεδίλου, **διατομές + οπλισμός δοκαριού**. (ADR-487 living organism.)

> **Αρχή αναφοράς (επιβεβαίωση από Giorgio):** το **δοκάρι είναι ο reference** — η **κολώνα προσαρμόζεται** στο δοκάρι (άξονας/πάχος/παρειά). Το δοκάρι ΜΕΝΕΙ στη θέση του.

---

## 2. ΤΙ ΗΔΗ ΛΥΘΗΚΕ (μην το ξανακάνεις)

**ADR-494 (committed `2669122f`, 2026-06-18):** footprint-based kind-agnostic αναγνώριση στήριξης δοκαριού→κολώνας. Η L/T/U/I/τοιχείο αναγνωρίζεται πλέον ΩΣ στήριξη (το διάγραμμα ροπών δεν κρέμεται σαν πρόβολος). NEW SSoT `projectPolygonOnAxis` (polygon-axis-projection.ts) + `projectColumnFootprintOnAxis` (column-face-trim.ts). **Αυτό το handoff χτίζει ΕΠΑΝΩ — το στατικό OK· λείπει το γεωμετρικό alignment τοποθέτησης.**

**Ο proactive κύκλος ΗΔΗ τρέχει** σε `bim:column-params-updated`: ORGANISM_EVENTS (`useStructuralOrganism`) ∩ AUTO_DESIGN_EVENTS (`useAutoFoundationDesign`) → organism re-derive + auto-foundation + reinforce + FEM. **Άρα η «πλήρης αυτοματοποίηση» (§1) ΗΔΗ πυροδοτείται** — αρκεί η αλλαγή params να βγει σωστή ΜΙΑ φορά (command-time).

---

## 3. ROOT CAUSE (γιατί βγαίνει έκκεντρο)

Στο `useColumnParamsDispatcher` η αλλαγή τύπου περνά **αυτούσια** στο `UpdateColumnParamsCommand` (ίδιο `position`/`anchor`, μόνο `kind` αλλάζει). Το `buildLshapeLocal` στήνει το L **γύρω από το ίδιο insertion point** με catalog defaults (`armWidth=width/3`, `armLength=depth/3`) → ασύμμετρο footprint γύρω από το `position` → το σκέλος δεν πέφτει στον άξονα/παρειά του δοκαριού → **έκκεντρο**. Κανείς δεν «ταιριάζει» το νέο σχήμα στον φορέα.

---

## 4. SSoT AUDIT (έγινε grep — επιβεβαίωσε/επέκτεινε· ΜΗΔΕΝ διπλότυπα)

| Concept | SSoT (extend, ΜΗΝ διπλασιάσεις) |
|---|---|
| **Command-time hook (kind-change)** | `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts:44-60` → `UpdateColumnParamsCommand` + emit `bim:column-params-updated`. **ΕΔΩ** ανιχνεύεις `nextParams.kind !== column.params.kind` και εφαρμόζεις το smart-fit στα `nextParams` **ΠΡΙΝ** το command. **Command-time, ΟΧΙ reactive** (μάθημα ADR-492 freeze §6). |
| **Γεωμετρία L/T (knobs)** | `bim/geometry/column-geometry.ts` → `buildLshapeLocal` (176· `armWidth`/`armLength`), `buildTshapeLocal` (203· `flangeLength`/`webThickness`), `computeColumnGeometry` (91· anchor offset + rotation). |
| **L/T params + anchor** | `bim/types/column-types.ts` → `ColumnLshapeParams` (77· armLength/armWidth/flipY), `ColumnTshapeParams` (93), `ColumnAnchor` (66· 9-position), `ColumnKind` (51). |
| **Framing/axis detection (ADR-494 — REUSE)** | `bim/columns/column-structural-attach-coordinator.ts` → `findColumnsFramedByBeamForGraph` / `beamFramesColumn`· `bim/columns/column-face-trim.ts` → `projectColumnFootprintOnAxis` + `columnSupportAlong`. **Βρες ΕΤΣΙ ποιο δοκάρι πλαισιώνει + τον άξονά του** (μηδέν νέα detection). |
| **Beam axis / width** | `BeamParams.startPoint/endPoint/width/sceneUnits` (`bim/types/beam-types.ts`). Ο άξονας = (start→end), το πάχος = `width`. |
| **Flush direction math (REUSE)** | `bim/beams/beam-column-flush.ts` `resolveBeamColumnFlushJustification` + `bim/grid/axis-normal.ts` `canonicalAxisNormal` (orientation-invariant normal). Ίδιο perpendicular-offset concept για να βρεις ποια πλευρά. |
| **Grid column-aware justification (reference)** | `bim/grid/grid-column-aware-justification.ts` / `grid-column-justification.ts` — η bindings-based εκδοχή (column↔segment). Reference για τη λογική alignment, αν χρειαστεί. |
| **Beam reframe (ADR-492)** | `bim/beams/beam-column-reframe.ts` `reframeBeamEndpointsToColumns`. **ΠΡΟΣΟΧΗ:** ο cascade τρέχει σε Move/Rotate/Scale/Mirror commands, **ΟΧΙ σε type-change**. Εδώ το δοκάρι ΜΕΝΕΙ (η κολώνα προσαρμόζεται), οπότε ίσως δεν χρειάζεται reframe — **αλλά** μετά το reshape το άκρο του δοκαριού πρέπει να κάθεται στη νέα παρειά → επιβεβαίωσε με `beamFramesColumn`. Συντονίσου με τον ADR-492 agent αν αγγίξεις reframe. |
| **Proactive re-study (ΗΔΗ wired — verify, μην ξαναφτιάξεις)** | `hooks/useStructuralOrganism.ts` `ORGANISM_EVENTS`· `hooks/useAutoFoundationDesign.tsx` `AUTO_DESIGN_EVENTS`· reinforce/FEM hooks (ADR-475/471/472/481/485). Όλα ακούν `bim:column-params-updated`. |

---

## 5. Anchors προς υλοποίηση (ΕΠΕΚΤΕΙΝΕ, μηδέν duplicate)

1. **NEW pure SSoT `alignColumnToFramingBeam(column, nextParams, beams) → ColumnParams | null`** (πιθανή θέση: `bim/columns/column-beam-align.ts`, mirror `beam-column-flush.ts`). Pure, unit-testable, μηδέν γνώση σκηνής/React. Λογική:
   - Βρες το/τα δοκάρι/α που πλαισιώνουν την κολώνα (**reuse** `beamFramesColumn` / `projectColumnFootprintOnAxis`, ADR-494).
   - Από το πλαισιωμένο δοκάρι: άξονας (start→end, μοναδιαίο `u`), πλάτος `w`, αριστερή παρειά #1 (το άκρο που ακουμπά την κολώνα).
   - Υπολόγισε τα `nextParams` ώστε: **(α)** `armWidth` (το σκέλος) `== w`· **(β)** ο άξονας του σκέλους ≡ άξονας δοκαριού (perpendicular alignment μέσω `canonicalAxisNormal`)· **(γ)** η όψη «α» flush στην παρειά #1· **(δ)** προσαρμογή `position`/`anchor`/`armLength` ώστε το σκέλος να καθίσει σωστά (το δοκάρι ΜΕΝΕΙ).
   - **Orientation-aware:** ποιο σκέλος της L (οριζόντιο vs κατακόρυφο) ευθυγραμμίζεται εξαρτάται από τη διεύθυνση του δοκαριού (οριζόντιο δοκάρι → οριζόντιο σκέλος). Υπολόγισε από το `u` του άξονα + το `rotation` της κολώνας. Πιθανώς χρειάζεται set/override `lshape.flipY` ή `rotation` ώστε η γωνία της L να «κοιτά» σωστά.
2. **Hook στο `useColumnParamsDispatcher`** (command-time): όταν `nextParams.kind !== column.params.kind` ΚΑΙ το νέο kind είναι asymmetric (L/T/U/I/composite), τρέξε `alignColumnToFramingBeam` → αν επιστρέψει patch, χρησιμοποίησέ το αντί για το raw `nextParams`. Ένα `UpdateColumnParamsCommand`, ένα emit. **ΟΧΙ reactive effect.**
3. **Full-automation verify:** μετά το fit + emit, επιβεβαίωσε ότι ο proactive κύκλος ξαναστήνει διατομές/οπλισμό κολώνας + πέδιλο + οπλισμό πεδίλου + διατομές/οπλισμό δοκαριού (§2). Αν κάποιος hook ΔΕΝ ακούει type-change → πρόσθεσέ το (command-time/event, ΟΧΙ reactive re-emit).
4. **Beam endpoint after reshape:** επιβεβαίωσε ότι το άκρο του δοκαριού κάθεται στη νέα παρειά της κολώνας (το cutback ADR-458/493 το χειρίζεται οπτικά· το αναλυτικό μήκος ίσως θέλει το reframe ADR-492 — δες §4 προσοχή).

### Edge cases
- Δοκάρι **οριζόντιο** vs **κατακόρυφο** vs **λοξό** → το σωστό σκέλος ευθυγραμμίζεται (γενική λύση μέσω άξονα, ΟΧΙ hard-coded X/Y).
- **2 δοκάρια** σε γωνιακή κολώνα (L φυσικά ταιριάζει σε γωνία!) → ιδανικά κάθε σκέλος ευθυγραμμίζεται στο αντίστοιχο δοκάρι. v1 ίσως ένα δοκάρι· flag τα 2-beam ως επόμενο.
- Κανένα framing δοκάρι → catalog defaults (μηδέν fit, μηδέν regression).
- T/U/I/composite → ίδια αρχή (σκέλος/κορμός ≡ άξονας δοκαριού, πάχος = πλάτος δοκαριού).
- Διατήρησε undo ατομικό (ένα command).

---

## 6. 🚨 ΜΑΘΗΜΑΤΑ (μη τα ξεχάσεις)
- **ADR-492 FREEZE LESSON:** ΠΟΤΕ reactive effect που re-emit-άρει geometry event μέσα στον engaged proactive κύκλο → freeze. Κάθε re-trigger = **command-time** (μέσα στο dispatcher/command), ΕΝΑ emit.
- **CODE = SOURCE OF TRUTH (N.0.1):** reuse `projectColumnFootprintOnAxis`/`beamFramesColumn`/`canonicalAxisNormal`/`columnSupportAlong`/`buildLshapeLocal` — ΜΗΝ ξαναγράψεις detection/flush/geometry.
- **Boy-scout (N.0.2):** αν χρειαστείς perpendicular/along projection → `projectPolygonOnAxis`/`projectPointOnAxis` (ADR-494, polygon-axis-projection.ts). ΜΗΝ φτιάξεις νέο vertex loop (η ADR-494 κεντρικοποίησε ΗΔΗ 3 hand-rolled loops).
- **Catalog vs smart:** τα stored kind defaults = placeholders· το smart-fit τα υπερισχύει βάσει φορέα (Giorgio §1.5).

---

## 7. ❌ ΜΗΝ
- ΜΗΝ commit/push (Giorgio μόνο). ΜΗΝ `git add -A` (shared tree).
- ΜΗΝ διπλασιάσεις detection/flush/projection/geometry (§4/§6) — reuse/extend.
- ΜΗΝ φτιάξεις reactive effect που re-emit-άρει geometry event (freeze).
- ΜΗΝ αγγίξεις uncommitted αρχεία άλλων agents (έλεγξε `git status`· ADR-495 slab-load τρέχει παράλληλα).

---

## 8. ΕΚΤΕΛΕΣΗ
1. Διάβασε ADR-487 (vision) + ADR-494 (footprint detection, just-built) + ADR-492 (reframe) + ADR-363 §5.6/§5.7 (column kinds + flush) + τα 2 στιγμιότυπα.
2. **SSoT grep audit** (επιβεβαίωσε anchors §4/§5 + βρες τυχόν proactive hook που χάνει type-change).
3. **Plan mode** → `alignColumnToFramingBeam` SSoT + command-time hook + automation verify· **ζήτα έγκριση**.
4. Υλοποίηση + jest (alignment με L/T fixtures: οριζόντιο/κατακόρυφο/λοξό δοκάρι· flush + axis-coincidence + width-match· catalog fallback) + tsc background (N.17, ένας τη φορά).
5. **ADR:** έλεγξε `adr-index.md` για επόμενο ελεύθερο — **ADR-495 φαίνεται πιασμένο** (slab-load, άλλος agent) → πιθανό **≥496** Ή **επέκτεινε ADR-363** (column placement intelligence) / **ADR-494**. + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).
6. **ΜΗΝ** commit — ο Giorgio.

## 9. Σχετικά αρχεία (anchors)
`ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts` (hook) · `core/commands/entity-commands/UpdateColumnParamsCommand.ts` · `bim/geometry/column-geometry.ts` (`buildLshapeLocal` 176, `computeColumnGeometry` 91) · `bim/types/column-types.ts` (`ColumnLshapeParams` 77, `ColumnAnchor` 66) · `bim/columns/column-structural-attach-coordinator.ts` (`beamFramesColumn`) · `bim/columns/column-face-trim.ts` (`projectColumnFootprintOnAxis`, `columnSupportAlong`) · `bim/beams/beam-column-flush.ts` (`resolveBeamColumnFlushJustification`) · `bim/grid/axis-normal.ts` (`canonicalAxisNormal`) · `bim/beams/beam-column-reframe.ts` (ADR-492) · `hooks/useStructuralOrganism.ts` (ORGANISM_EVENTS) · `hooks/useAutoFoundationDesign.tsx` (AUTO_DESIGN_EVENTS) · `bim/geometry/shared/polygon-axis-projection.ts` (`projectPolygonOnAxis`, ADR-494 REUSE).
