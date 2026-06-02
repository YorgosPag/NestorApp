# HANDOFF — ADR-408 MEP Connectors & Systems
**Φ4 Cascade/Integrity DONE (pending commit) · Φ5 Circuit-UI + color-by-system + reconciliation = NEXT**
Ημερομηνία: 2026-06-02 · Μοντέλο: Opus 4.8 · Mode: Plan→Implement

---

## §0 — ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)

- 🚫 **COMMIT/PUSH τα κάνει Ο GIORGIO, ΟΧΙ ο agent** (N.(-1)). Μην κάνεις commit μόνος σου.
- 🚫 **ΠΟΤΕ `--no-verify`** (N.(-1.1)). Αν κολλήσει pre-commit hook → ανάφερε, μη bypass.
- ⚠️ **SHARED WORKING TREE** — δουλεύει ΚΑΙ άλλος agent ταυτόχρονα (railings). **ΠΟΤΕ `git add -A`**. Μόνο specific `git add <file>` + `git diff --cached` πριν από οτιδήποτε.
- 🌐 Απαντάς **στα Ελληνικά** πάντα (LANGUAGE RULE).
- 📋 N.14 (δήλωσε μοντέλο) + N.8 (execution mode) πριν γράψεις κώδικα. N.0.1 ADR-driven (code=SoT). N.15 (ενημέρωσε ΕΚΚΡΕΜΟΤΗΤΕΣ+ADR+adr-index+memory μαζί).

---

## §1 — ΤΙ ΕΓΙΝΕ (Φ4 — Cascade / Integrity)

MEP «σαν Revit» σε επίπεδα: ADR-405 disciplines → ADR-406 φωτιστικό → **ADR-408 connectivity backbone** (Φ1+Φ2) → Φ3 ηλεκτρικός πίνακας (circuit «πηγή») → **Φ4 ακεραιότητα δικτύου**.

**Αποφάσεις Giorgio (AskUserQuestion):** (1) **COHERENT single-undo** — ένα Ctrl+Z επαναφέρει ΚΑΙ entity ΚΑΙ τα διαλυμένα κυκλώματα/μέλη μαζί. (2) **Full enterprise / full SSoT, Revit-grade** — command-based undoable mutations, ΟΧΙ side-effects.

**Υλοποίηση (transactional design, reuse υπάρχοντος `CompoundCommand`):**
- **Detection (pure SSoT):** NEW `resolveMepCascadeOnDelete(deletedIds, systems): MepCascadePlan` στον `mep-system-coordinator.ts` — reuse `findSystemsBySource`· επιστρέφει `{ dissolve[], memberRemovals[] }`· system που διαλύεται εξαιρείται από member-edits (δεν πειράζουμε doomed doc). Καμία side effect.
- **Bridge (SSoT-preserving):** NEW `bim/mep-systems/mep-system-mutator.ts` — port registry (`setMepSystemMutator`/`getMepSystemMutator` + `MepSystemMutator` interface). Module-level γέφυρα hook↔command (mirror `wall-cascade-delete-store`). **Τα commands ΔΕΝ γράφουν Firestore** — καλούν τον port → προωθεί στο `useMepSystemPersistence` = sole writer. Null-safe (headless no-op).
- **Commands (undoable, target=mutator port ΟΧΙ ISceneManager αφού System δεν είναι scene entity):** NEW `UpdateMepSystemParamsCommand` (member-removal τώρα + rename/assign Φ5 + drag-merge) + `DissolveMepSystemCommand` (κρατά πλήρες `MepSystemEntity` snapshot· undo = **id-preserving** `restoreSystem`, αφού `saveSystem` δέχεται `id`).
- **COHERENT UNDO:** `useSmartDelete` τυλίγει το entity delete + τα cascade commands σε ΕΝΑ `CompoundCommand('Delete MEP')` = atomic undo unit. Τα υπάρχοντα `bim:*-delete-requested` emits (Firestore delete panel/fixture) μένουν ανέπαφα. Undo reverse-order: member-removal(prev) → dissolve(restore) → entity restore.
- **Persistence:** `useMepSystemPersistence` +`restoreSystem` (id-preserving `saveSystem` + audit `'restored'` + un-suppress `deletedIds`) + register/unregister mutator port (useEffect).
- **Safety net:** resync-time `notifyMissingSystemMembers` (ήδη υπήρχε) μένει για dangling refs εκτός cascade path.

**Επαλήθευση:** `npx tsc --noEmit` = **0**. **15 νέα tests** (cascade-plan 5 + commands/compound integration 10) PASS → 31 mep-system suite. **72/72 regression** (panel/fixture/connector). **Zero νέα Firestore query** (καμία αλλαγή rules/indexes/coverage → CHECK 3.15/3.16 δεν ενεργοποιούνται). NO barrel edit (direct path import όπως panel/fixture/slab Update commands). `UpdateMepSystemParamsCommand` έχει production consumer → μηδέν dead-code risk.

---

## §2 — ΑΡΧΕΙΑ Φ4 ΓΙΑ COMMIT (ΑΚΡΙΒΗΣ ΛΙΣΤΑ — shared tree, `git add` ΜΟΝΟ αυτά!)

### ✅ ΝΕΑ (4)
```
src/subapps/dxf-viewer/bim/mep-systems/mep-system-mutator.ts
src/subapps/dxf-viewer/core/commands/entity-commands/UpdateMepSystemParamsCommand.ts
src/subapps/dxf-viewer/core/commands/entity-commands/DissolveMepSystemCommand.ts
src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/mep-system-commands.test.ts
```

### ✅ MODIFIED (5)
```
src/subapps/dxf-viewer/bim/mep-systems/mep-system-coordinator.ts
src/subapps/dxf-viewer/bim/mep-systems/__tests__/mep-system-coordinator.test.ts
src/subapps/dxf-viewer/hooks/data/useMepSystemPersistence.ts
src/subapps/dxf-viewer/hooks/canvas/useSmartDelete.ts
docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
```

> ΣΗΜ: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ενημερωμένο) είναι gitignored· memory εκτός repo· `adr-index.md` ΔΕΝ άλλαξε στο Φ4 (γενικό «✅ APPROVED», όχι phase-granularity). **Επίσης pending commit από προηγ. sessions:** Φ1+Φ2+Φ3 (ADR-408) + ADR-405/406/407 — αν committαρεις όλα μαζί, η λίστα Φ4 προστίθεται.

**Προτεινόμενο commit message (Φ4 μόνο):**
```
feat(bim): ADR-408 Φ4 MEP cascade/integrity (coherent undo)

Delete circuit source → dissolve its circuits; delete member → drop it
from members[]. Coherent single-undo via CompoundCommand bundling the
entity delete with system commands. Pure resolveMepCascadeOnDelete
(reuse findSystemsBySource) + mep-system-mutator port (hook↔command,
SSoT-preserving) + UpdateMepSystemParamsCommand + DissolveMepSystemCommand
(id-preserving restore). 15 new tests, tsc 0, zero new Firestore query.
```

---

## §3 — ΕΠΟΜΕΝΗ ΦΑΣΗ: Φ5 — Circuit UI + color-by-system + scene-time reconciliation (μέγεθος L)

**Στόχος:** εδώ «καταναλώνεται» ο κορμός Φ1+Φ2 — ο χρήστης φτιάχνει κυκλώματα από το UI, τα βλέπει χρωματισμένα, και το `connector.systemId` cache γράφεται στα fixtures/panels.

**3 κομμάτια (locked από ADR-408 §Roadmap + §4):**

1. **UI «Δημιουργία ηλεκτρικού κυκλώματος» από selection** — διάλεξε πίνακα (source) + φωτιστικά (members) → `createSystem(buildDefaultCircuitParams(...))`. Rename / add-member / remove-member μέσω **`UpdateMepSystemParamsCommand`** (ΗΔΗ έτοιμο, undoable). Single-circuit guard (ένας connector ⊂ ένα κύκλωμα, Revit rule) ζει ΕΔΩ (βλ. σχόλιο `buildConnectorSystemIndex`).
2. **color-by-system** — render fixtures/panels χρωματισμένα ανά system. Χρειάζεται color resolver (από `useMepSystemStore` membership) + integration σε 2D renderers + 3D `BimSceneLayer` materials/`MaterialCatalog3D`. Πρότυπο: discipline visibility threading (ADR-405 §4).
3. **scene-time reconciliation** — wire `reconcileEntityConnectors` (ΗΔΗ έτοιμο στον coordinator, «System always wins») στο resync path ώστε να γράφεται `connector.systemId` στα fixture/panel entities. Coordinator pattern (ADR-401 C).

**Έτοιμα hook-in points (Φ1+Φ2+Φ4):**
- Persistence: `useMepSystemPersistence` → `createSystem` / `updateSystem` / `deleteSystem` / `restoreSystem` + mutator port.
- Commands: `UpdateMepSystemParamsCommand` (rename/assign), `DissolveMepSystemCommand`.
- Coordinator (pure): `buildConnectorSystemIndex`, `reconcileEntityConnectors`, `findSystemMembershipsByEntity`, `resolveMepCascadeOnDelete`.
- Store: `useMepSystemStore` (read consumers). EventBus: `bim:mep-system-changed`.
- Defaults: `buildDefaultCircuitParams`, `buildDefaultPanelOutgoingConnector`.

**ΠΡΟΣΟΧΕΣ (SSoT — μη το σπάσεις):**
- **System κατέχει `members[]`** · `connector.systemId` = derived cache · reconciliation **System→connector (System always wins)**.
- Το `MepSystem` **ΔΕΝ** μπαίνει ποτέ στο scene `Entity` union (geometry-less, δικό του zustand store).
- ⚠️ Αν color-by-system αγγίξει ADR-040 micro-leaf αρχεία → stage ΚΑΙ ADR-040 (CHECK 6B/6C/6D).

**Workflow:** Plan Mode → recognition (πρότυπα: `useMepSystemPersistence` + `mep-system-coordinator` + ADR-405 §4 discipline-visibility threading για το color-by-system) → εκτέλεση. Δήλωσε μοντέλο (N.14, Opus για L cross-cutting) + execution mode (N.8 — L → ίσως ρώτα Orchestrator vs Plan).

---

## §4 — VERIFY ΕΝΤΟΛΕΣ
```
npx jest "mep-system" "electrical-panel" "mep-fixture" "mep-connector"
npx tsc --noEmit
```
Για Φ5: πρόσθεσε tests για create-circuit, assign/remove member (UpdateMepSystemParamsCommand), reconcileEntityConnectors scene-time wiring, color resolver. Pre-commit: file ≤500 / func ≤40 (CHECK 4)· αν color αγγίξει micro-leaf → stage ADR-040.
```
