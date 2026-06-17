# HANDOFF — ADR-459 Φ7: 3Δ rotate κολώνας → η θεμελίωση δεν ακολουθεί

**Ημ/νία:** 2026-06-17 · **Από:** Opus session · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά στις απαντήσεις.

---

## 0. ΤΟ TASK

**Επιβεβαιωμένο από Giorgio:**
- **2Δ** περιστροφή κολώνας → το auto πέδιλο **ακολουθεί** σωστά (περιστρέφεται in-place). ✅
- **3Δ** περιστροφή κολώνας (gizmo) → η θεμελίωση **ΔΕΝ περιστρέφεται**. ❌

Ζητούμενο: **Full Enterprise + Full SSoT**, όπως Revit. **ΠΡΙΝ κώδικα → πραγματικό SSOT AUDIT (grep)** για
reuse, ΜΗΔΕΝ διπλότυπα. **PLAN MODE πρώτα** → plan → έγκριση → υλοποίηση → jest → docs. **Commit = Giorgio.**

---

## 1. 🚨 ΕΠΙΒΕΒΑΙΩΜΕΝΗ ΑΙΤΙΑ (grep done, αυτή τη session)

Ο `useAutoFoundationDesign` (+ `useStructuralOrganism`) ξανα-υπολογίζουν τη θεμελίωση όταν ακούσουν
**structural events**: `drawing:entity-created` / `bim:column-params-updated` / `bim:entities-moved` /
`bim:column-delete-requested` / `bim:structural-loads-computed` (`AUTO_DESIGN_EVENTS` στο
`hooks/useAutoFoundationDesign.tsx`).

**Γιατί δουλεύει το 2Δ:** η 2Δ περιστροφή κολώνας γίνεται μέσω **hot-grip** (ADR-397 free-rotate) →
`commitColumnGripDrag` (`hooks/grips/grip-parametric-commits.ts:~444-446`) → `deps.execute(cmd)` **+
`EventBus.emit('bim:column-params-updated', { columnId })`** → ο auto-designer πυροδοτείται → πέδιλο follow.

**Γιατί ΔΕΝ δουλεύει το 3Δ:** η 3Δ περιστροφή (gizmo) → `buildEditCommand` (outcome.kind==='rotate') →
**`RotateEntityCommand`** (`bim-3d/animation/bim3d-edit-command-builders.ts:228`). Το commit γίνεται στο
**`bim-3d/animation/bim3d-edit-interaction-handlers.ts:459`**:
```ts
getGlobalCommandHistory().execute(cmd);   // ← ΚΑΝΕΝΑ structural event μετά
```
- Το 3Δ **move** δουλεύει ΜΟΝΟ επειδή το `MoveEntityCommand` **αυτο-εκπέμπει** `bim:entities-moved` μέσα στο
  `execute()/undo()/redo()` (`core/commands/entity-commands/MoveEntityCommand.ts:81,99,268,299,325`).
- Το **`RotateEntityCommand` ΔΕΝ αυτο-εκπέμπει τίποτα** (ούτε `entities-moved` ούτε `column-params-updated`).
  Το ίδιο και τα `UpdateXParamsCommand` (το emit το κάνει το 2Δ UI layer, ΟΧΙ η command).
- Άρα μετά από 3Δ rotate **κανένα event** στο `AUTO_DESIGN_EVENTS` δεν φτάνει → ο auto-designer/organism
  δεν τρέχουν → **η θεμελίωση μένει ακίνητη**.

**Συμπέρασμα:** το 3Δ edit-commit (`commit` στο `bim3d-edit-interaction-handlers.ts:459`) **λείπει το
emit του structural-change event** που κάνει το 2Δ commit layer.

---

## 2. ΚΑΤΕΥΘΥΝΣΗ FIX (Revit-grade + SSoT) — προς επικύρωση σε PLAN MODE

**Αρχή (Revit):** μια αλλαγή γεωμετρίας δομικού μέλους πρέπει να **ανακοινώνεται μία φορά**, ανεξαρτήτως
surface (2Δ grip / 3Δ gizmo / ribbon / tool) → όλοι οι reactors (auto-design, organism, hosting reconciler,
move-persist) αντιδρούν ομοιόμορφα.

### Επιλογή A (SSoT-cleanest, προτεινόμενη) — emit στο 3Δ commit, μέσω ΚΟΙΝΟΥ helper
- Στο `bim3d-edit-interaction-handlers.ts` μετά το `getGlobalCommandHistory().execute(cmd)` → κάλεσε ΕΝΑΝ
  **kind-aware emitter** για τα edited entities (column→`bim:column-params-updated`, beam→`bim:beam-params-updated`,
  foundation→`bim:foundation-params-updated`, wall→`bim:wall-params-updated`, slab→`bim:slab-params-updated`).
- **Boy-scout SSoT (N.0.2):** σήμερα το 2Δ `grip-parametric-commits.ts` εκπέμπει αυτά **inline ανά kind**
  (wall/beam/column/opening...). Εξάγαγε **ΕΝΑ** helper `emitBimEntityParamsUpdated(entity)` (kind→event) και
  χρησιμοποίησέ το **και** στο 2Δ (dedup) **και** στο 3Δ commit. → ένα SSoT για «ανακοίνωσε αλλαγή μέλους».
- Skip το emit για kinds που η command ήδη αυτο-εκπέμπει (move = `MoveEntityCommand` → entities-moved), για να
  μη διπλο-εκπέμπεται (αν και ο auto-designer coalesce-άρει σε microtask → αβλαβές· προτίμησε καθαρότητα).

### Επιλογή B (βαθύτερο SSoT, μεγαλύτερο blast radius) — η command αυτο-εκπέμπει
- Κάνε το `RotateEntityCommand` να εκπέμπει `bim:entities-moved` στο execute/undo/redo (mirror MoveEntityCommand).
  Καλύπτει ΟΛΑ τα rotate surfaces (2Δ tool + 3Δ gizmo + future) με ΕΝΑ σημείο. ⚠️ Επηρεάζει και το 2Δ
  `useRotationTool` + το `move-persist` effect (rotation θα persist-άρει — επιθυμητό, αλλά verify διπλό persist
  με τον hot-grip που ήδη persist-άρει).

**Σύσταση:** Επιλογή **A** (mirror του υπάρχοντος 2Δ SSoT, εντοπισμένο blast radius) + Boy-scout extraction του
kind→event helper. Επικύρωσε σε PLAN MODE.

### Πώς συνεργάζεται με το v8.3 (atomic undo — ΜΟΛΙΣ έγινε)
Το v8.3 (in-place footing update + transaction group) **συνθέτει σωστά**: μόλις φτάσει το structural event, ο
auto-designer τρέχει σε microtask και καλεί `executeGrouped` → `CommandHistory.appendToLast` → τυλίγει το
`RotateEntityCommand` (που μόλις έγινε push από το 3Δ commit) + το `ApplyFoundationLayoutCommand` σε **ΕΝΑ**
undo step. Δηλαδή μόλις πυροδοτηθεί το event, το 3Δ rotate θα έχει αυτόματα: in-place follow + atomic undo,
**χωρίς επιπλέον δουλειά**. (Time-window guard `mergeTimeWindow`=500ms → το microtask είναι εντός.)

⚠️ Πρόσεξε: το 3Δ commit κάνει `getGlobalCommandHistory().execute(cmd)` **απευθείας** (όχι μέσω
`useCommandHistory`). Ο auto-designer όμως ακούει event + χρησιμοποιεί το δικό του `executeGrouped` →
ανεξάρτητο, δουλεύει. Απλώς βεβαιώσου ότι το emit γίνεται **μετά** το `execute(cmd)` (ώστε το RotateEntityCommand
να είναι το last command όταν τρέξει το microtask).

---

## 3. SSOT AUDIT MAP — grep targets (κάνε πραγματικό grep ΠΡΙΝ κώδικα)

| Στόχος | Path | Τι ψάχνεις |
|---|---|---|
| 3Δ edit commit (το «λείπει emit» σημείο) | `bim-3d/animation/bim3d-edit-interaction-handlers.ts:~449-461` | `getGlobalCommandHistory().execute(cmd)` — πρόσθεσε emit μετά |
| 3Δ command builder | `bim-3d/animation/bim3d-edit-command-builders.ts` | `outcome.kind==='rotate'` → `RotateEntityCommand`· move→MoveEntityCommand· resize→UpdateXParamsCommand |
| 2Δ kind→event emit (SSoT να εξάγεις) | `hooks/grips/grip-parametric-commits.ts` | `EventBus.emit('bim:{wall,beam,column,opening,slab}-params-updated', …)` inline ανά kind |
| auto-designer reactors | `hooks/useAutoFoundationDesign.tsx` (`AUTO_DESIGN_EVENTS`) + `hooks/useStructuralOrganism.ts` (`ORGANISM_EVENTS`) | ποια events πυροδοτούν recompute |
| Self-emitting command (πρότυπο) | `core/commands/entity-commands/MoveEntityCommand.ts` | `EventBus.emit('bim:entities-moved', …)` σε execute/undo/redo |
| Event types | `systems/events/EventBus.ts` (`DrawingEventType`) | υπάρχοντα `*-params-updated` / `entities-moved` |
| v8.3 grouping | `hooks/useAutoFoundationDesign.tsx` (`executeGrouped`, `GEOMETRY_EDIT_TRIGGERS`) + `core/commands/{CompositeCommand,CommandHistory,useCommandHistory}.ts` | πώς γίνεται το atomic undo (μόλις προστέθηκε) |

**Grep keywords:** `bim3d-edit-interaction-handlers|buildEditCommand|RotateEntityCommand|grip-parametric-commits|
bim:column-params-updated|bim:entities-moved|AUTO_DESIGN_EVENTS|ORGANISM_EVENTS|emit\(`.

---

## 4. ΚΑΤΑΣΤΑΣΗ ΤΩΡΑ (v8.1→v8.3, ΟΛΑ UNCOMMITTED — δες ADR-459 §8)

- **v8.1**: cross-level footing rendering (all-floors) — model SSoT keyed-by-floorId sourcing.
- **v8.2** (ΑΛΛΟΥ agent): cross-level autosave-origin fix (`foundation-cross-level-writer.ts`).
- **v8.3** (αυτή η γραμμή δουλειάς): in-place footing update (Revit stable-identity) + atomic undo
  (`CompositeCommand` + `CommandHistory.appendToLast`). **Αυτό το task (3Δ rotate) είναι συνέχεια του v8.3** —
  μόλις φτάσει το event στο 3Δ, το follow + atomic undo δουλεύουν αυτόματα.

**jest πράσινα** (v8.3): reconcile updates, CompositeCommand, CommandHistory.appendToLast, foundation-level-store
tombstone, foundation-footing-candidates.

---

## 5. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **COMMIT/PUSH = Giorgio**, ΟΧΙ ο agent. **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα) →
  `git add` **ΜΟΝΟ τα δικά σου** αρχεία, ΠΟΤΕ `git add -A`. ⚠️ **ΜΗΝ** σταδιοποιήσεις
  `useSmartDelete.ts` / `smart-delete-bim-events.ts` / `foundation-cross-level-writer.ts` (άλλος agent / v8.2).
- **tsc = Giorgio** (PowerShell denied για agent). **jest** τρέχει κανονικά (`npx jest <path> --silent`).
- **ADR-040**: το `bim3d-edit-interaction-handlers` είναι commit-time (όχι 60fps) → το emit εκεί είναι safe.
  Πρόσεξε CHECK 6B/6D αν αγγίξεις renderer/3D-core αρχεία (stage ADR αν χρειαστεί).
- **PLAN MODE πρώτα** → SSOT audit → plan → έγκριση → υλοποίηση → jest → docs (ADR-459 §6j + changelog +
  `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory). Απαντάς **Ελληνικά**.

## 6. VERIFICATION (end-to-end)
1. jest για όποιον νέο/εξαγμένο helper (kind→event) + regression.
2. tsc = Giorgio.
3. Browser (καθαρό test project: κτίριο Ισόγειο + όροφος Θεμελίωσης, κολώνες με auto πέδιλα):
   - **3Δ** περιστροφή κολώνας → η θεμελίωση **περιστρέφεται in-place** (ίδιο id — Firestore audit: ίδιο doc).
   - **ΕΝΑ Ctrl+Z** αναιρεί **κολώνα + πέδιλο μαζί** (v8.3 atomic undo, καμία «λοξή κολώνα σε ίσιο πέδιλο»).
   - 3Δ move εξακολουθεί να δουλεύει (regression).

## 7. ΠΡΩΤΟ ΒΗΜΑ
1. SSOT audit (grep §3) — επιβεβαίωσε το emit-gap στο `bim3d-edit-interaction-handlers.ts:459` + βρες τυχόν
   υπάρχον kind→event helper (αν υπάρχει → reuse· αλλιώς εξάγαγε από `grip-parametric-commits.ts`).
2. PLAN MODE → plan (Επιλογή A vs B· σύσταση A) → έγκριση Giorgio.
3. Υλοποίηση → jest → docs. ΟΧΙ commit.
