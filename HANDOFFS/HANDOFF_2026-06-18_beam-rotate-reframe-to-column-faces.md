# HANDOFF — Beam **rotate/move** re-frame στις παρειές κολωνών (επέκταση ADR-492: όχι μόνο column-move)

**Ημ/νία:** 2026-06-18 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλους agents. `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. tsc = ένας τη φορά (N.17 — έλεγξε running tsc πρώτα). **ΜΗΝ αγγίξεις** τα uncommitted ADR-484/483/488/489/490/491 αρχείων άλλων agents.

**Απαιτήσεις Giorgio:** full enterprise + full SSOT, Revit-grade (όπως οι μεγάλοι). **ΠΡΙΝ γράψεις κώδικα → πραγματικό SSoT audit (grep)** για να μη φτιάξεις διπλότυπα. Plan mode (cross-cutting) πριν υλοποιήσεις.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (στιγμιότυπα-απόδειξη)

- `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-18 223818.jpg` (rotated/3D view — το δοκάρι **δεν** ακουμπά τις κολώνες, πράσινο βέλος δείχνει το κενό/άκρο εκτός παρειάς)
- `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-18 223858.jpg` (οριζόντια κάτοψη με διάγραμμα M)

**Giorgio:** «Περιέστρεψα το δοκάρι ώστε να συνδέει τις εσωτερικές παρειές των δύο κολωνών, αλλά αυτό δεν κολλάει πλέον σωστά πάνω στις κολώνες.»

Δηλαδή: όταν ο χρήστης **περιστρέφει (ή μετακινεί) το ΙΔΙΟ το δοκάρι** (όχι την κολώνα), τα άκρα του **δεν ξανα-κολλάνε** στις κοντινές παρειές των κολωνών που θα έπρεπε να πλαισιώνει. Μένουν εκεί που τα άφησε η περιστροφή → κενό ή υπερκάλυψη.

---

## 2. ΤΙ ΗΔΗ ΕΓΙΝΕ — ADR-492 (DONE, UNCOMMITTED) — η βάση που ΕΠΕΚΤΕΙΝΕΙΣ

ADR-492 (`docs/centralized-systems/reference/adrs/ADR-492-associative-beam-reframe-on-column-move.md`) — υλοποιήθηκε **column-move → beam re-frame** (Revit-canonical, stored re-frame). 36 jest GREEN, tsc clean, UNCOMMITTED (ο Giorgio θα κάνει commit).

**Έτοιμα SSoT (REUSE, ΜΗΔΕΝ διπλότυπα):**

| Concept | SSoT (extend, ΜΗΝ διπλασιάσεις) |
|---|---|
| **Pure re-frame** ενός δοκαριού στις παρειές κολωνών | `bim/beams/beam-column-reframe.ts` → `reframeBeamEndpointsToColumns(beam, columns)` → `{ startPoint, endPoint } | null`. Per-end συσχέτιση **πλησιέστερης συγγραμμικής** κολώνας (perp ≤ μισό πλάτος δοκαριού), idempotent, διατηρεί perpendicular justification, reuse `columnSupportAlong`. **Δουλεύει ΗΔΗ για οποιονδήποτε προσανατολισμό άξονα** (χρησιμοποιεί τη διεύθυνση u του δοκαριού). |
| **Projection κέντρου κολώνας στον άξονα** (collinearity + along) | `bim/columns/column-face-trim.ts` → `projectColumnCenterOnAxis(col, ax, ay, ux, uy)` → `{ along, perp }`. SSoT, καταναλώνεται ΚΑΙ από `beamFramesColumn`. |
| **Face-offset** (μισό πλάτος κολώνας στη διεύθυνση) | `bim/columns/column-face-trim.ts` → `columnSupportAlong(col, dirX, dirY)`. ADR-441. |
| **Command-time cascade** (το «πότε») | `bim/beams/beam-column-reframe-cascade.ts` → `cascadeBeamReframeForColumns(movedIds, sceneManager)`. **Καλείται μέσα στο `MoveEntityCommand`/`MoveMultipleEntitiesCommand`** (execute/undo/redo) — mirror του `cascadeHostedOpeningsForWalls`. |

**🚨🚨 ΚΡΙΣΙΜΟ ΜΑΘΗΜΑ (μη το ξεχάσεις):** Η ΠΡΩΤΗ υλοποίηση ήταν **reactive effect** (`useBeamReframeEffect`, mirror wall-retrim) που **ξανα-εξέπεμπε** `bim:entities-moved`. Αυτό μπήκε σε **βρόχο με τον engaged proactive στατικό κύκλο** (ADR-488 organism→ADR-491 FEM reinforce/loads/sizing→params-updated→effect→emit→…) → **storm με βαρύ LDLᵀ solve → η εφαρμογή ΚΟΛΛΑΓΕ μόλις πατούσες «Ανάλυση»**. Διορθώθηκε με **cascade-στην-εντολή** (synchronous, ΕΝΑ emit, μηδέν reactive re-trigger). **ΠΟΤΕ ΞΑΝΑ reactive effect που re-emit-άρει geometry event μέσα σε proactive analysis cascade.** Χρησιμοποίησε ΠΑΝΤΑ command-time cascade.

---

## 3. ΓΙΑΤΙ ΔΕΝ ΔΟΥΛΕΥΕΙ ΓΙΑ ROTATE/BEAM-MOVE (root cause από τον κώδικα)

1. **`cascadeBeamReframeForColumns(movedIds, …)` ενεργεί ΜΟΝΟ όταν ένα moved id είναι ΚΟΛΩΝΑ** (`if (!columns.some(c => movedSet.has(c.id))) return []`). Όταν περιστρέφεις/μετακινείς το **δοκάρι**, το moved id είναι δοκάρι → **no-op**.
2. **Το `RotateEntityCommand` (ΚΑΙ `ScaleEntityCommand`, `MirrorEntityCommand`) ΔΕΝ καλεί καθόλου το beam-reframe cascade** — μόνο `cascadeHostedOpeningsForWalls`. Άρα η περιστροφή δοκαριού δεν ξανα-κόβει.
3. **⚠️ `RotateEntityCommand` ΔΕΝ εκπέμπει `bim:entities-moved`** (έλεγξα: μηδέν `EventBus.emit` στο αρχείο — μόνο openings cascade). Άρα διαφορετικό persistence/organism path από το move. **Πρέπει να βρεις πώς persist-άρεται & αν re-derive-άρει ο organism μετά από rotate** (πιθανώς selection-debounce auto-save· ο organism ίσως ΔΕΝ re-derive-άρει σε rotate → χωριστό κενό).

---

## 4. ΖΗΤΟΥΜΕΝΟ (Revit-grade) — plan mode + έγκριση πριν υλοποίηση

**Πυρήνας:** το δοκάρι είναι associatively attached στις κολώνες που πλαισιώνει. **ΚΑΘΕ transform του δοκαριού** (rotate / move / scale / mirror) ΚΑΙ κάθε column-move πρέπει να ξανα-κόβει τα άκρα στις κοντινές παρειές των κολωνών που γίνονται collinear με τον (νέο) άξονα.

### Anchors προς υλοποίηση (ΕΠΕΚΤΕΙΝΕ, μηδέν duplicate):
1. **Γενίκευσε** το `cascadeBeamReframeForColumns` → να reframe-άρει ΚΑΙ (α) δοκάρια που πλαισιώνουν κινούμενη κολώνα (ήδη), ΚΑΙ (β) **το ίδιο το δοκάρι** όταν αυτό είναι στα `movedIds` (rotate/move/scale του δοκαριού). Πιθανό rename → `cascadeBeamReframe(movedIds, sceneManager)` (proceed όταν moved περιέχει κολώνα **ή** δοκάρι· reuse `reframeBeamEndpointsToColumns` αυτούσιο — δουλεύει για κάθε γωνία). Κράτα idempotency.
2. **Wire** το cascade στα transform commands που ήδη καλούν `cascadeHostedOpeningsForWalls`: `RotateEntityCommand` (execute/undo/redo, **όχι** copyMode), `ScaleEntityCommand`, `MirrorEntityCommand`. (Το `MoveEntityCommand` το έχει ήδη — απλώς θα πιάνει & beam-move μετά τη γενίκευση.)
3. **Persistence:** το `RotateEntityCommand` δεν εκπέμπει `bim:entities-moved`. Πρέπει τα reframed δοκάρια (ΚΑΙ το rotated δοκάρι) να persist-άρουν. Επέλεξε **command-time** path (ΟΧΙ reactive). Δες πώς persist-άρει σήμερα το rotated entity (auto-save selection-debounce;) και εξασφάλισε ότι το reframed beam μπαίνει στο dirty set. Αν χρειαστεί emit, κάν' το **μία φορά μέσα στην εντολή** (όχι reactive listener) — προσοχή στον engaged κύκλο (§2 μάθημα).
4. **Collinearity μετά την περιστροφή:** επιβεβαίωσε ότι όταν ο χρήστης περιστρέφει «για να συνδέσει τις εσωτερικές παρειές», οι κολώνες όντως γίνονται collinear (perp ≤ μισό πλάτος δοκαριού) με τον νέο άξονα. Αν η πρόθεση του χρήστη είναι πιο «χαλαρή» (π.χ. snap σε κολώνα που δεν είναι τέλεια collinear), σκέψου αν χρειάζεται μεγαλύτερη ανοχή — αλλά **ΜΗΝ** χαλαρώσεις τόσο που να πιάνει άσχετες κολώνες. Συζήτησέ το στο plan.

### Edge cases:
- Free rotation σε γωνία που ΔΕΝ ευθυγραμμίζεται με κολώνες → `reframeBeamEndpointsToColumns` επιστρέφει null → το δοκάρι μένει ελεύθερο (σωστό).
- Rotate δοκαριού που πλαισιώνει 2 κολώνες → snap και στα 2 άκρα.
- Undo/redo rotate → re-derive idempotent (όπως τα openings).
- curved/split → DEFER (parity ADR-458/492).
- ADR-040 perf: command-time, μηδέν high-freq subscription.
- **Μην** σπάσεις τον freeze-fix: ΚΑΝΕΝΑ reactive effect, ΚΑΝΕΝΑ re-emit μέσα σε proactive cycle.

---

## 5. SSoT AUDIT (κάνε ΕΣΥ grep πριν γράψεις — επιβεβαίωσε/επέκτεινε)
- `reframeBeamEndpointsToColumns`, `cascadeBeamReframeForColumns`, `projectColumnCenterOnAxis`, `columnSupportAlong` (τα δικά μας SSoT — REUSE).
- `cascadeHostedOpeningsForWalls` (το πρότυπο cascade-στην-εντολή· δες ποια commands το καλούν: Move/Rotate/Mirror/Scale/UpdateWallParams).
- `RotateEntityCommand` / `ScaleEntityCommand` / `MirrorEntityCommand` — δομή execute/undo/redo + πώς persist-άρουν (emit; auto-save;).
- `bim/transforms/bim-rotate-geometry.ts` (`calculateBimRotatedGeometry`) — πώς περιστρέφεται το beam params (startPoint/endPoint).
- Πώς re-derive-άρει ο `useStructuralOrganism` μετά από rotate (ORGANISM_EVENTS δεν έχει rotate event — πιθανό κενό).
- Beam **rotation grip** (ADR-397 rotation-handle): η περιστροφή δοκαριού μέσω grip → ποια εντολή; (RotateEntityCommand ή UpdateBeamParamsCommand;). Grep `RotateEntityCommand`/`rotation-handle`/beam grip path.

---

## 6. ΕΚΤΕΛΕΣΗ
1. Διάβασε στιγμιότυπα + §2 ADR-492 + `reference_associative_beam_reframe_on_column_move` (memory) + ADR-458/441.
2. **SSoT grep audit** (επιβεβαίωσε anchors + βρες το rotate/persist path).
3. **Plan mode** → σχεδίασε τη γενίκευση + wiring + persistence, **ζήτα έγκριση** (ειδικά για το persistence path του rotate).
4. Υλοποίηση + jest (επέκτεινε `beam-column-reframe-cascade.test.ts` με rotate/beam-move case) + tsc background (N.17, ένας τη φορά).
5. Update **ADR-492** (νέα φάση: rotate/transform) ή νέο ADR — **έλεγξε `adr-index.md`**, πάρε επόμενο ελεύθερο **≥493** αν νέο (491=FEM column, 492=δικό μου· άλλοι agents παίρνουν νούμερα ταυτόχρονα). + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).
6. **ΜΗΝ** commit — ο Giorgio.

## 7. ❌ ΜΗΝ
- ΜΗΝ commit/push (Giorgio μόνο). ΜΗΝ `git add -A` (shared tree).
- **ΜΗΝ φτιάξεις reactive effect** που re-emit-άρει geometry event (freeze — §2 μάθημα). Command-time cascade ΠΑΝΤΑ.
- ΜΗΝ διπλασιάσεις `reframeBeamEndpointsToColumns` / `columnSupportAlong` / `projectColumnCenterOnAxis` / τον cutback (ADR-458).
- ΜΗΝ αγγίξεις τα uncommitted ADR-484/483/488/489/490/491 άλλων agents.

## 8. Αρχεία ADR-492 (δικά μου, UNCOMMITTED — ο Giorgio θα τα κάνει commit μαζί με τη δική σου δουλειά ή χωριστά)
`bim/beams/beam-column-reframe.ts`(+test), `bim/beams/beam-column-reframe-cascade.ts`(+test), `core/commands/entity-commands/MoveEntityCommand.ts`, `bim/columns/column-face-trim.ts`, `bim/columns/column-structural-attach-coordinator.ts`, `ADR-492`+adr-index.
