# HANDOFF — BIM copy+mirror: το αντίγραφο δεν persist-άρει → εξαφανίζεται

**Ημερομηνία:** 2026-06-01
**Συντάκτης:** Opus 4.8 — εντοπίστηκε κατά το browser-verify της ADR-363 Φ2b/Φ3b.
**ADR:** ADR-363 §6/§7.2 (mirror) + persistence layer. Topic memory: `project_adr363_from_perimeter_walls.md`.
**Γλώσσα:** Ελληνικά πάντα. **Commit/push:** ΜΟΝΟ Giorgio.
**Shared working tree:** `git add <specific>`, ΠΟΤΕ `-A`/`checkout`/`restore`/`reset` σε ξένα.
**Model:** Plan Mode / Opus (cross-cutting: command + persistence + undo, 5 BIM τύποι — κανόνας N.8).

---

## 🎯 ΤΟ BUG

Όταν κάνεις **mirror με αντίγραφο** (dialog «κράτα αρχικό;» → **ΝΑΙ**, `keepOriginals=true`) ένα BIM στοιχείο (π.χ. τοιχίο/κολώνα), το αντίγραφο **εμφανίζεται και αστραπιαία εξαφανίζεται** (intermittent).

**ΔΕΝ** είναι geometry bug — τα `bim-mirror-geometry` unit tests περνούν. Είναι **persistence gap στο command**.

## 🔍 ROOT CAUSE (επιβεβαιωμένο από κώδικα)

- `core/commands/entity-commands/MirrorEntityCommand.ts` → `execute()` (keepOriginals branch, γρ. 58-62):
  ```ts
  const newId = generateEntityId();
  const newEntity = { ...entity, ...updates, id: newId };
  this.sceneManager.addEntity(newEntity);   // σκέτο scene add
  ```
  **ΧΩΡΙΣ** enterprise ID (N.6 παραβίαση), **ΧΩΡΙΣ** `drawing:entity-created`, **ΧΩΡΙΣ** persistence.

- `hooks/data/useColumnPersistence.ts` (γρ. 218-225): το Firestore subscription είναι **source of truth**. Diff-merge: column στο scene που **δεν** είναι στα Firestore docs ΚΑΙ δεν είναι `dirty`/`pending` → `mutated=true` → **αφαιρείται** στο επόμενο snapshot. → το αντίγραφο εξαφανίζεται. Intermittent = εξαρτάται πότε σκάει το snapshot.

- **Σωστό pattern (αναφορά):** `hooks/grips/grip-parametric-copy.ts` → `commitColumnCopy`/`commitWallCopy`: χτίζουν NEW entity με `buildColumnEntity`/`buildWallEntity` (→ `createColumn`/`createWall`, **enterprise ID**) και inserting via `addColumnToScene`/`addWallToScene` (→ εκπέμπουν `drawing:entity-created` → persistence σώζει → **επιβιώνει**).

## ⚠️ ΕΥΡΟΣ
**Προϋπάρχον** κενό. Αφορά **copy+mirror ΟΛΩΝ των BIM στοιχείων** (κολώνα/τοίχος/δοκάρι/πλάκα/σκάλα), όχι ειδικά Π/τοιχίο ούτε τη Φ2b. **In-place mirror (`keepOriginals=false`) ΔΟΥΛΕΥΕΙ** (ενημερώνει υπάρχον persisted στοιχείο → `useBimEntityMovedPersistEffect` το σώζει). Άρα workaround: mirror χωρίς αντίγραφο.

## 🔧 ΣΧΕΔΙΟ ΔΙΟΡΘΩΣΗΣ (RECOGNITION πρώτα)

Το αντίγραφο BIM στο copy+mirror πρέπει να ακολουθεί το ΙΔΙΟ insertion SSoT με το grip-copy:
1. **Enterprise ID ανά τύπο** (`createColumn`/`createWall`/… μέσω `build<X>Entity`), όχι `generateEntityId()`.
2. **Persistence broadcast:** `drawing:entity-created` (ή το per-type insertion `add<X>ToScene`) ώστε να σωθεί.
3. **Undo:** να εκπέμπει `*-delete-requested` (π.χ. `bim:column-delete-requested`) → να σβήνει από Firestore· αλλιώς το επόμενο snapshot **ξαναφέρνει** το αντίγραφο μετά το undo (deletedIdsRef tombstone).
4. **Redo:** re-create (μην ξανα-mint id — κράτα το ίδιο, ώστε undo/redo idempotent).

**Αρχιτεκτονική επιλογή (Q για Giorgio στο RECOGNITION):**
- **(Α)** Κρατάς το copy μέσα στο `MirrorEntityCommand` αλλά για BIM τύπους εκπέμπεις EventBus `drawing:entity-created`/`*-delete-requested` (το command ΗΔΗ είναι BIM-aware: import-άρει `calculateBimMirroredGeometry` + `cascadeHostedOpeningsForWalls`). Χρειάζεται per-type map: tool name + delete event + id generator.
- **(Β)** Βγάζεις το copy+mirror των BIM από το command και το περνάς μέσα από το per-entity insertion SSoT (`add<X>ToScene`) στο tool layer (`useMirrorTool`), mirror του `commitHotGripCopy`. Πιο καθαρό SSoT, αλλά πρέπει να λυθεί το undo (πώς γίνεται undo ένα drawn-then-inserted BIM στοιχείο — δες `useBimEntityRestoredPersistEffect` + `deletedIdsRef`).

**Πρόταση:** (Β) είναι πιο SSoT-καθαρό (ένα insertion path), αλλά (Α) είναι πιο κοντά στο υπάρχον command/undo. Διάλεξε στο RECOGNITION.

## 📂 ΑΡΧΕΙΑ
- `core/commands/entity-commands/MirrorEntityCommand.ts` (copy branch + undo/redo).
- `hooks/tools/useMirrorTool.ts` (αν πας Β).
- Reference SSoT: `hooks/grips/grip-parametric-copy.ts`, `bim/columns/add-column-to-scene.ts`, `bim/walls/add-wall-to-scene.ts`, `hooks/drawing/column-completion.ts` (`buildColumnEntity`/`createColumn`), αντίστοιχα beam/slab/stair.
- Persistence: `hooks/data/useColumnPersistence.ts` (+ wall/beam/slab/stair persistence — ίδιο pattern, `useBimEntity{Moved,Restored}PersistEffect`).
- **Έλεγξε** αν `CopyEntityCommand.ts` έχει το ΙΔΙΟ bug (πιθανόν — ίδιο raw `addEntity`).

## 🧪 TEST PLAN
- Unit: copy+mirror column → εκπέμπεται `drawing:entity-created` με enterprise id· undo → `delete-requested`. (Mirror `MirrorEntityCommand.bim.test.ts`.)
- Browser: copy+mirror τοιχίο Π → αντίγραφο **παραμένει** μετά από snapshot· undo → φεύγει & **δεν ξαναέρχεται**· redo → επανέρχεται. Επανάληψη για κανονική κολώνα + τοίχο.

## 📌 N.15 TRACKERS (μετά τη διόρθωση)
ADR-363 §7.2 changelog · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · memory.

---

## ✅ ΚΑΤΑΣΤΑΣΗ ΠΡΙΝ ΤΟ HANDOFF (μην το ξαναφτιάξεις)

**ADR-363 Φ2b + Φ3b — DONE, pending commit, browser-verified εκτός του copy+mirror:**
- **Φ2b** (επεξεργασία polygon-backed τοιχίων): per-vertex grips, manual-Π grips, mirror polygon, panel U-shape, section symbols. 3 NEW + ~12 MOD αρχεία.
- **Φ3b** (auto-union γειτονικών πλαισίων): 3 ορθογώνια Π → 1 τοιχίο U-shape. `unionTouchingPolygons` (reuse `safeUnion`). 2 MOD + test.
- **Browser verify Giorgio 2026-06-01:** TEST A (centering, μετά union) ✅ · B (per-vertex grips) ✅ · D (section symbol) ✅ · E (manual Π panel) ✅ · C in-place mirror ✅ · **C copy+mirror 🔴 = ΑΥΤΟ ΤΟ BUG**.
- Tests: 345 + 17 + 18 + 41 PASS, tsc 0. Όλα **pending commit** (ο Giorgio committάρει).
- Λεπτομέρειες: `project_adr363_from_perimeter_walls.md` + ADR-363 §12 changelog (2026-06-01 entries).

**Deferred (ξεχωριστά):** polygon vertex add/remove· holes σε union.
