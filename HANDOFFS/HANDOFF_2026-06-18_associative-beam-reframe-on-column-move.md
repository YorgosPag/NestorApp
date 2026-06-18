# HANDOFF — Associative beam re-frame όταν μετακινείται η κολόνα (το δοκάρι να ξανα-κόβεται στην παρειά, ΟΧΙ να προβάλλει)

**Ημ/νία:** 2026-06-18 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλους agents. `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. tsc = ένας τη φορά (N.17 — έλεγξε running tsc πρώτα). **ΜΗΝ αγγίξεις** τα uncommitted ADR-484/483/488/489/490 αρχείων άλλων agents.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (με στιγμιότυπο-απόδειξη)

Στιγμιότυπο: `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-18 212609.jpg`.

Σκηνή: 2 κολόνες (αριστερή + δεξιά) με πέδιλα, ΕΝΑ δοκάρι που τις ενώνει. Αρχικά το δοκάρι ήταν συνδεμένο **ακριβώς στις εσωτερικές παρειές** (frame-into, clear span). Ο χρήστης **μετακίνησε τη δεξιά κολόνα προς τα αριστερά** → το δοκάρι **πέρασε ΜΕΣΑ από την κολόνα και προβάλλει από τη δεξιά της πλευρά** (το πράσινο βέλος στο στιγμιότυπο δείχνει το προεξέχον stub).

**Ζητούμενο (Revit-canonical):** όταν μετακινείται η κολόνα, το δοκάρι να **μειώνεται αυτόματα** ώστε το άκρο του να **κάθεται πάλι στην εσωτερική (κοντινή) παρειά** της κολόνας. Το δοκάρι είναι **associatively attached** στις κολόνες που frame-into — μετακινείς την κολόνα, ακολουθεί το άκρο.

---

## 2. 🔬 SSoT AUDIT (ΗΔΗ ΕΓΙΝΕ — grep 2026-06-18) — ΕΠΕΚΤΕΙΝΕ ΑΥΤΑ, ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ

### Γιατί συμβαίνει (root cause από τον κώδικα)
Το stored `endPoint` του δοκαριού (`BeamParams.startPoint`/`endPoint`) **ΔΕΝ ακολουθεί** την κολόνα όταν αυτή μετακινείται **μεμονωμένα**. Το frame-into εφαρμόζεται:
- **στο placement** (stored, μέσω `beam-completion.ts` → pull-back των endpoints), και
- **grid-coupled** μέσω `GuideBinding.extend` (`trimSegmentEndpointsToColumns`) — το extend είναι σταθερό **σχετικά με τον άξονα**, οπότε δουλεύει ΜΟΝΟ όταν ο κάναβος μετακινεί ΚΑΙ κολόνα ΚΑΙ άκρο μαζί.

Όταν ο χρήστης μετακινεί **μόνο** την κολόνα (όχι τον κάναβο), το stored `endPoint` μένει στο **παλιό** κέντρο → το δοκάρι εκτείνεται πέρα από τη νέα θέση της κολόνας. Ο ADR-458 cutback (`computeBeamCutbackOutline`) αφαιρεί σωστά τον όγκο της κολόνας, αλλά **αφήνει το stub** πέρα από τη μακρινή παρειά (δεν είναι bug του cutback — το δοκάρι όντως εκτείνεται ως εκεί).

### Anchors (έτοιμα SSoT — REUSE)
| Concept | Υπάρχον SSoT (extend, ΜΗΝ διπλασιάσεις) |
|---|---|
| **Frame-into trim σε παρειά κολόνας** (kind-agnostic τοίχος/δοκός) | `bim/columns/column-face-trim.ts` → `trimSegmentEndpointsToColumns` + **exported `columnSupportAlong(column, dirX, dirY)`** (= support distance / μισό πλάτος κολόνας στη διεύθυνση = το offset της παρειάς). ADR-441. |
| **Ποιες κολόνες frame-into ένα δοκάρι** (association, pure geometric) | `bim/columns/column-structural-attach-coordinator.ts` → **`findColumnsFramedByBeamForGraph(beam, entities)`** + private `beamFramesColumn` (κέντρο κολόνας προβάλλεται στον άξονα, perp ≤ μισό πλάτος, εντός span+support). Reuse — μηδέν νέα association math. |
| **Reactive re-trim ΠΑΤΕΡΝ on move (MIRROR ΑΥΤΟ)** | `hooks/tools/useSpecialTools-wall-retrim.ts` → `useWallRetrimEffect` (debounced 200ms σε `bim:wall-params-updated` → `computeWallTrims` → `applyTrimPatches` → `setLevelScene`). Ο **ΑΚΡΙΒΗΣ ανάλογος** για δοκάρι↔κολόνα ΛΕΙΠΕΙ. |
| **Cutback display (ADR-458, DERIVED)** | `bim/geometry/beam-column-cutback.ts` (`computeBeamCutbackOutline`/`computeBeamAxisToColumnContact`) + scene post-pass `hooks/canvas/dxf-scene-beam-cutback.ts` (`applyBeamColumnCutback2D`/`buildBeamCutbackDisplay` → `displayOutline`/`displayAxisPolyline`). DERIVED, ΠΟΤΕ persisted. |
| **Side-face flush** (related) | `bim/beams/beam-column-flush.ts`. |
| **Move events / persistence** | `core/commands/entity-commands/MoveEntityCommand.ts`, `bim:column-params-updated` / `bim:entities-moved` (βλ. `drawing-event-map-bim.ts`), `hooks/data/useBimEntityMovedPersistEffect.ts`, `useStructuralOrganism.ts` (re-derive on move). |
| **Organism graph (column-bearing edges)** | `bim/structural/organism/structural-graph.ts` (`findColumnsFramedByBeamForGraph` → `column-bearing` ακμές) — ΗΔΗ ξέρει ποια κολόνα στηρίζει ποιο δοκάρι. |

**Πρόσθεσε δικό σου grep** για κάθε νέα έννοια. Αν βρεις duplicate → centralize (N.0.2).

---

## 3. ΑΠΟΦΑΣΗ ΣΧΕΔΙΑΣΜΟΥ (Revit-grade) — plan mode + έγκριση πριν υλοποίηση

**Πυρήνας:** το δοκάρι είναι **associatively attached** στις κολόνες που frame-into. Όταν μετακινείται μια κολόνα, το αντίστοιχο **άκρο του δοκαριού επανα-υπολογίζεται στην κοντινή παρειά** της κολόνας (idempotent — ακολουθεί ΚΑΙ προς τα μέσα ΚΑΙ προς τα έξω).

Νέο άκρο = κέντρο της framed κολόνας **προβαλλόμενο στον άξονα του δοκαριού**, τραβηγμένο πίσω κατά `columnSupportAlong(column, προς-το-span)`. **Reuse** `findColumnsFramedByBeamForGraph` (association) + `columnSupportAlong` (face offset) — μηδέν νέα γεωμετρία.

### Δύο υπο-προσεγγίσεις — ζύγισέ τες στο plan, ζήτα έγκριση:
- **(A) Stored-endpoint re-frame (συνιστώμενη, persisted):** reactive effect (MIRROR `useWallRetrimEffect`) σε `bim:column-params-updated`/`bim:entities-moved` → για κάθε δοκάρι, βρες framed κολόνες → επανα-υπολόγισε `startPoint`/`endPoint` στην κοντινή παρειά → patch μέσω **Command (undo-able)** ή `setLevelScene` + persist (όπως ο wall-retrim). Συνεπές με το placement (που ήδη αποθηκεύει framed endpoints). ⚠️ Idempotency: υπολόγισε το άκρο **από τη θέση της κολόνας** (όχι από το τρέχον endpoint) ώστε να μη «μαζεύεται» σε επαναλαμβανόμενες μετακινήσεις, και να **επιμηκύνεται** όταν η κολόνα γυρίζει πίσω.
- **(B) DERIVED display-only (εναλλακτική, μη-persisted):** επέκτεινε το `buildBeamCutbackDisplay` ώστε όταν το δοκάρι frame-into μια κολόνα, να **απορρίπτει το stub** πέρα από την κοντινή παρειά (κρατά μόνο το span-side piece). Λιγότερο επεμβατικό, αλλά δεν αλλάζει το αναλυτικό μήκος μέλους (FEM/οπλισμός βλέπουν ακόμη το μακρύ δοκάρι) → λιγότερο Revit-canonical.

**Σύσταση:** (A) — το αναλυτικό μήκος του μέλους πρέπει να ακολουθεί (επηρεάζει load-path/οπλισμό/FEM ADR-467/471/481). Αλλά **ζήτα έγκριση** του Giorgio στο plan πριν υλοποιήσεις (cross-cutting).

### Edge cases να καλύψεις
- Δοκάρι που frame-into **και στα δύο** άκρα (re-trim ανά άκρο ανεξάρτητα).
- Κολόνα που μετακινείται **εκτός** του δοκαριού (δεν frame-into πια → άκρο επιστρέφει στο design intent / σταματά να ακολουθεί).
- Επιμήκυνση πίσω όταν η κολόνα γυρίζει (idempotent re-derive από column position).
- Curved/split δοκάρια (ADR-458 ήδη DEFER — κράτα parity).
- ADR-040 perf: debounce/coalesce (όπως ο wall-retrim 200ms)· low-freq· ΜΗΝ subscribe high-freq stores σε orchestrators.
- Undo: αν (A) μέσω Command → atomic undo μαζί με το column move (ή ξεχωριστό, αλλά συνεπές).

---

## 4. ΕΚΤΕΛΕΣΗ
1. **Διάβασε** το στιγμιότυπο + §2 anchors + ADR-458 (cutback) + ADR-441 (frame-into trim) + ADR-363 (beam placement) + memory `reference_beam_column_cutback_ssot`, `reference_beam_placement_wysiwyg_edge_anchor`, `reference_topology_aware_beam_support_ssot`.
2. **SSoT grep audit** (επιβεβαίωσε τα anchors + ψάξε για τυχόν υπάρχον beam-retrim πριν φτιάξεις νέο).
3. **Plan mode** (N.8 cross-cutting) → σχεδίασε (A) vs (B), **ζήτα έγκριση**.
4. Υλοποίηση + jest (mirror `beam-preview-cutback-parity.test.ts` / `column-structural-attach-coordinator.test.ts`) + tsc (background, N.17).
5. Update ADR (νέο ADR — **διάλεξε επόμενο ελεύθερο ≥491**, ΕΛΕΓΞΕ `adr-index.md` για collision γιατί άλλοι agents παίρνουν νούμερα ταυτόχρονα· 488/489/490 ΠΙΑΣΜΕΝΑ) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).
6. **ΜΗΝ** κάνεις commit — ο Giorgio.

## 5. ❌ ΜΗΝ
- ΜΗΝ commit/push (Giorgio μόνο).
- ΜΗΝ `git add -A` (shared tree).
- ΜΗΝ φτιάξεις νέα association/face-offset math — **reuse** `findColumnsFramedByBeamForGraph` + `columnSupportAlong`.
- ΜΗΝ αγγίξεις τα uncommitted ADR-484/483/488/489/490 άλλων agents.
- ΜΗΝ διπλασιάσεις τον cutback (ADR-458 είναι το display SSoT) ή το frame-into trim (ADR-441).
