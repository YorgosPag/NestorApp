# HANDOFF — Ριζικό refactor: ΕΝΑΣ μακρόβιος SceneManager/level (Revit Document/Transaction model)

**Ημερομηνία:** 2026-06-25
**Προτεινόμενο ADR:** ADR-525 (επόμενο ελεύθερο· highest = ADR-524)
**Προτεινόμενο μοντέλο:** Opus (architecture / cross-cutting, 99 αρχεία) → **Orchestrator** (N.8: 5+ αρχεία, 2+ domains, υψηλό ρίσκο)
**Εκτίμηση:** ~99 αρχεία αγγίζονται δυνητικά· υψηλό ρίσκο· ~2.5–3.5x tokens.

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ ΓΙΑ ΑΥΤΗ ΤΗ ΔΟΥΛΕΙΑ (Giorgio, ρητά)

1. **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep** (βλ. §4). Ψάξε αν υπάρχει ΗΔΗ αντίστοιχος μηχανισμός/SSoT ώστε να τον **χρησιμοποιήσεις** — ΜΗΝ δημιουργήσεις διπλότυπο.
2. **FULL ENTERPRISE + FULL SSoT** — «όπως η Revit / οι μεγάλοι παίκτες». Όχι μπαλώματα.
3. **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO** — ΟΧΙ εσύ. (N.(-1)) Ετοίμασε, σταμάτα, ανέφερε.
4. **Shared working tree** — άλλος agent δουλεύει ΤΑΥΤΟΧΡΟΝΑ (την ώρα του handoff άγγιζε το `useColumnTool.ts` — πρόσθεσε `useColumnToolStateActions`, `getColumnFaceRotation/Sizing`). **Διάβαζε φρέσκο πριν κάθε Edit**, μην πατήσεις αλλαγές άλλου.
5. **N.17 single-tsc** — ΕΝΑ `tsc` τη φορά. Έλεγξε running tsc πριν ξεκινήσεις.
6. **ADR-driven (N.0.1)** — Phase 1 recognition (κώδικας = αλήθεια), Phase 3 ADR update, ίδιο commit.
7. **GOL** (N.7): ≤500 γραμμές/αρχείο, ≤40/συνάρτηση, zero race, idempotent, optimistic.

---

## 1. ΓΙΑΤΙ — Το ριζικό πρόβλημα (αρχιτεκτονικό smell)

Ο Giorgio εντόπισε σωστά: **το `appendEntityToScene` δημιουργεί νέο `LevelSceneManagerAdapter` σε ΚΑΘΕ κλήση.** Αυτό **ΔΕΝ είναι enterprise / δεν θα το έκανε η Revit.**

### Η μηχανική του bug
- `src/subapps/dxf-viewer/systems/entity-creation/LevelSceneManagerAdapter.ts` έχει **`pendingScene` cache** (γρ. 57–117) που λύνει ένα React race: το `getLevelScene` είναι **closure-captured → STALE** μέσα σε ένα sync batch mutations. Το cache κρατά το «running scene» **μόνο per-instance**, και καθαρίζεται σε `queueMicrotask`.
- Όταν γίνονται **N× single appends** (π.χ. batch κολόνες), κάθε `appendEntityToScene` φτιάχνει **ΝΕΟ adapter** → **N ανεξάρτητα pendingScene caches** → κάθε προσθήκη διαβάζει stale scene → οι αλλαγές πατούν η μία την άλλη + downstream readers (auto-foundation κ.λπ.) δεν βλέπουν όλο το set.
- Το ότι **υπάρχει** το `pendingScene` hack ΚΑΙ το ADR-511 `appendEntitiesToScene` (batch CompoundCommand) είναι **το αποδεικτικό** ότι λείπει ΕΝΑ live scene SSoT.

### Τι κάνει η Revit (ο στόχος)
**ΕΝΑ μακρόβιο `Document`** (SSoT) + **Transactions**: ανοίγεις transaction → πολλές αλλαγές στο ΙΔΙΟ live document (η μία βλέπει την άλλη) → `Commit()` = ΕΝΑ atomic undo step. **Ποτέ** «νέος adapter/manager ανά οντότητα».

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ (context — μην το ξανακάνεις)

**ADR-524 «Πολλαπλή πλήρωση όμοιων πλαισίων κολόνας»** — IMPLEMENTED, UNCOMMITTED (ο Giorgio θα κάνει commit). Δες `docs/centralized-systems/reference/adrs/ADR-524-column-batch-fill-same-color-frames.md`.

Στα πλαίσιά του διορθώθηκε το **σύμπτωμα** του race ΓΙΑ ΤΙΣ ΚΟΛΟΝΕΣ (ενδιάμεση λύση, σέβεται ADR-511):
- NEW `addColumnsToScene` (`bim/columns/add-column-to-scene.ts`) → `appendEntitiesToScene` (**ΕΝΑΣ** adapter + `CompoundCommand`).
- NEW batch callback `onColumnsCreated` (`useColumnTool` options → `useSpecialTools` → `addColumnsToScene`).
- ΟΛΑ τα multi-column hooks (batch-fill + region + perimeter) γράφουν πλέον μέσω ΕΝΟΣ `appendColumnsBatchRef` (per-entity fallback).
- `appendColumnsWithBreakdown` δέχεται batch `appendAll`.
- 11/11 jest GREEN, tsc 0.

**ΑΥΤΟ ΤΟ HANDOFF αφορά το ΡΙΖΙΚΟ** — να μην χρειάζεται το κάθε domain (walls, slabs, beams, foundations, openings, mep, dimensions, copy/move/array…) να ανακαλύπτει μόνο του το ίδιο race. Το ριζικό λύνει το πρόβλημα **μία φορά για όλους**.

---

## 3. SCOPE (από grep audit 2026-06-25)

- **`new LevelSceneManagerAdapter` / `levelSceneManagerFor` / `createLevelSceneManagerAdapter`: 127 occurrences σε 99 αρχεία.**
- Πολλά call-sites κάνουν `new LevelSceneManagerAdapter(...)` **απευθείας** (όχι μέσω του SSoT factory `levelSceneManagerFor`). Πρώτο βήμα centralization: όλα μέσω factory.
- `pendingScene` / `getGlobalCommandHistory` / `implements ISceneManager`: 45 αρχεία (βλ. grep).

Βασικά αρχεία:
- `systems/entity-creation/LevelSceneManagerAdapter.ts` — ο adapter + `pendingScene` hack + factory `levelSceneManagerFor` / `createLevelSceneManagerAdapter`.
- `core/commands/interfaces.ts` — `ISceneManager` contract.
- `core/commands/CommandHistory.ts` + `useCommandHistory.ts` — global history, `execute/executeGrouped/appendToLast` (ADR-459 transaction-group πρωτόλειο).
- `bim/scene/append-entity-to-scene.ts` — `appendEntityToScene` (single) + `appendEntitiesToScene` (batch, ADR-511).
- `core/commands/CompoundCommand.ts` — atomic N-command wrapper.

---

## 4. ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT — ΤΡΕΞΕ ΑΥΤΑ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Στόχος: βρες αν υπάρχει ΗΔΗ live-scene SSoT / singleton manager / transaction API ώστε να **επεκτείνεις**, όχι να φτιάξεις νέο.

```
# 1. Υπάρχει external (zustand/store) SSoT για τη scene, πέρα από το React useLevels;
grep -rn "getLevelScene\|setLevelScene\|getSnapshot" src/subapps/dxf-viewer/systems/levels src/subapps/dxf-viewer/state
grep -rln "createStore\|useSyncExternalStore" src/subapps/dxf-viewer/state src/subapps/dxf-viewer/systems/levels

# 2. Το ISceneManager contract + όλοι οι implementors
grep -rn "implements ISceneManager\|interface ISceneManager" src/subapps/dxf-viewer

# 3. Transaction / grouping primitives που ΗΔΗ υπάρχουν (ADR-459)
grep -rn "executeGrouped\|appendToLast\|beginTransaction\|CompoundCommand\|transaction" src/subapps/dxf-viewer/core/commands

# 4. Όλα τα adapter construction sites (να ενοποιηθούν στο factory)
grep -rn "new LevelSceneManagerAdapter\|levelSceneManagerFor\|createLevelSceneManagerAdapter" src/subapps/dxf-viewer

# 5. pendingScene — πού βασίζονται σε αυτό (μην το σπάσεις πριν το αντικαταστήσεις)
grep -rn "pendingScene\|getLatestScene\|commitScene" src/subapps/dxf-viewer

# 6. Πώς ορίζεται το getLevelScene — είναι React closure ή live ref;
grep -rn "getLevelScene" src/subapps/dxf-viewer/systems/levels/useLevels* 
```

Διάβασε ΠΛΗΡΩΣ: `LevelSceneManagerAdapter.ts`, `interfaces.ts` (ISceneManager), `CommandHistory.ts`, `append-entity-to-scene.ts`, και πώς το `useLevels` παρέχει `getLevelScene/setLevelScene`.

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΚΑΤΕΥΘΥΝΣΗ (επικύρωσέ την μετά το audit — ΜΗΝ την ακολουθήσεις τυφλά)

**Στόχος:** ΕΝΑΣ μακρόβιος SceneManager ανά (project, level) ως live SSoT· όλα τα commands τον μοιράζονται· transaction API· κατάργηση `pendingScene` hack.

Δύο πιθανές διαδρομές (διάλεξε βάσει audit):

**(A) Singleton-per-level adapter (χαμηλότερο ρίσκο, incremental).**
- Κάνε το `levelSceneManagerFor(levelManager, levelId)` να επιστρέφει **cached singleton** ανά κλειδί (όχι `new` κάθε φορά). Όλα τα call-sites που ήδη το χρησιμοποιούν μοιράζονται αυτόματα ΕΝΑΝ adapter (ίδιο pendingScene) → το race φεύγει χωρίς αλλαγή στα call-sites.
- ΠΡΩΤΑ: ενοποίησε τα ~direct `new LevelSceneManagerAdapter(...)` ώστε ΟΛΑ να περνούν από το factory (SSoT). Μετά singleton-cache στο factory.
- Cache invalidation: όταν αλλάζει project/level ή το `getLevelScene/setLevelScene` identity.

**(B) Live scene store + transaction API (πλήρες Revit, μεγαλύτερο ρίσκο).**
- External store ως SSoT για scenes με `getSnapshot()` πάντα-live → ο adapter διαβάζει live, **καταργείται** το `pendingScene`.
- `beginTransaction()/commit()` στο CommandHistory (επέκταση του υπάρχοντος `executeGrouped/appendToLast`) → πολλές αλλαγές = ΕΝΑ React flush + ΕΝΑ undo + ΕΝΑ emit batch.

⚠️ Προτίμησε να **επεκτείνεις** ό,τι βρει το audit (ISceneManager, CommandHistory grouping, appendEntitiesToScene) αντί να φτιάξεις παράλληλο σύστημα. Στόχος = ΕΝΑ SSoT, μηδέν διπλότυπο.

---

## 6. ΣΧΕΤΙΚΑ ADRs (διάβασέ τα)
- **ADR-040** preview-canvas-performance — store/subscription layer (CHECK 6B/6D: αν αγγίξεις micro-leaf αρχεία, stage ADR-040).
- **ADR-511** slab batch create (`appendEntitiesToScene` / CompoundCommand) — το υπάρχον batch precedent.
- **ADR-390** symmetric BIM delete/undo + CreateBimEntityCommand.
- **ADR-459** structural-organism-connectivity — `executeGrouped/appendToLast` transaction grouping (πρωτόλειο που μπορείς να επεκτείνεις).
- **ADR-524** column batch-fill (το ενδιάμεσο fix· §6b περιγράφει το ίδιο race).

---

## 7. VERIFICATION
- `npx tsc --noEmit` (N.17 — ΕΝΑ τη φορά, έλεγξε running πρώτα).
- Jest: `column-batch-fill`, `column-in-region`, + ό,τι αγγίξεις (move/array/copy/grid-commit suites).
- Browser (localhost): batch κολόνες → ΟΛΕΣ μπαίνουν + ΟΛΕΣ παίρνουν πέδιλο· ΕΝΑ Ctrl+Z αναιρεί όλο το batch· δοκίμασε ΚΑΙ wall/slab/beam grid-commit, copy/array (ίδιο race).
- Regression: το single placement να ΜΗΝ αλλάξει συμπεριφορά.

## 8. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push (ο Giorgio).
- ΜΗΝ φτιάξεις νέο παράλληλο scene system πριν το audit.
- ΜΗΝ σπάσεις τα 99 call-sites — incremental, backward-compatible, type-safe (μηδέν `any`).
- ΜΗΝ πατήσεις αλλαγές του άλλου agent (shared tree) — διάβαζε φρέσκο.
- ΜΗΝ αφαιρέσεις το `pendingScene` πριν υπάρχει live-SSoT αντικαταστάτης (θα σπάσει τα batch commands JoinEntity/Move/Array).
