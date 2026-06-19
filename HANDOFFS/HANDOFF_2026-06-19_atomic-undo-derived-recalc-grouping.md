# HANDOFF — Atomic undo: ομαδοποίηση παράγωγου auto-recalc στην εντολή χρήστη (Revit transaction group)

**Ημ/νία:** 2026-06-19 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλον agent. `git add` **ΜΟΝΟ δικά σου**, **ΠΟΤΕ `git add -A`**. **ΜΗΝ αγγίξεις** `bim/structural/*`, `bim/structural/{sizing,organism,codes}/*`, `bim-3d/diagrams/*`, `ADR-483/499/502/503/504*`.

---

## 0. ΤΟ ΠΡΟΒΛΗΜΑ (τι παρατήρησε ο Giorgio, DB-verified)
Διαγραφή ενός δοκαριού → **2× Ctrl+Z** χρειάστηκαν για να επανέλθει πλήρως η κατάσταση (το δοκάρι + το re-attach της κολώνας). Η Revit κάνει τη διαγραφή **+ όλες τις παράγωγες/αυτόματες συνέπειές της σε ΕΝΑ atomic undo**. Στόχος: **1× Ctrl+Z** να αναιρεί τα πάντα.

**ΤΙ ΔΕΝ φταίει:** το ADR-401 detach-on-delete. Επιβεβαιωμένα **atomic** — η `DeleteEntityCommand` εκτελεί/αναιρεί τα child `DetachColumns/WallsCommand` μέσα στο δικό της execute/undo (ΕΝΑ entry: δοκάρι πίσω + κολώνα re-attach μαζί). DB-verified live (proj_12788b6a): single undo επανέφερε ΚΑΙ τα δύο. **ΜΗΝ ξαναπειράξεις αυτό.**

**ΤΙ φταίει (υπόθεση προς ΕΠΑΛΗΘΕΥΣΗ):** η διαγραφή πυροδοτεί **proactive structural recalc** (load takedown / member sizing / auto-study) που μπαίνει ως **ΞΕΧΩΡΙΣΤΟ** entry στο command-history → 2η εγγραφή → 2η αναίρεση.
**Απόδειξη:** στο 1ο test διαγραφής (πριν το re-link), **και οι 4** κολώνες ξανα-γράφτηκαν (`updatedAt` άλλαξε, `appliedLoad` recompute) παρόλο που **καμία** δεν αναφερόταν στο σβησμένο δοκάρι → το auto-recalc τρέχει ως δικό του βήμα.

---

## 1. 🔴 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
Ο Giorgio το ζητά ρητά: **πραγματικό SSoT audit, μηδέν διπλότυπα, reuse υπάρχοντος**.
```
grep -rn "appendToLast\|executeGrouped\|CompositeCommand" src/subapps/dxf-viewer/core/commands
grep -rn "appendToLast\|executeGrouped\|history.execute\|getGlobalCommandHistory" src/subapps/dxf-viewer/hooks
grep -rn "proactive\|coalesc\|mergeTimeWindow" src/subapps/dxf-viewer/hooks
grep -rn "executeGrouped\|appendToLast\|history.execute" src/subapps/dxf-viewer/hooks/useProactive*  src/subapps/dxf-viewer/hooks/structural-auto-study-core.ts
```
**Read** ΥΠΟΧΡΕΩΤΙΚΑ (paths/υπογραφές μπορεί να μετακινήθηκαν — shared tree):
`core/commands/CommandHistory.ts`, `core/commands/CompositeCommand.ts`, `core/commands/useCommandHistory.ts`,
`hooks/proactive-coalescer.ts`, `hooks/useProactiveStructuralLoads.ts`, `hooks/useProactiveMemberSizing.ts`,
`hooks/useProactiveStructuralAnalysis.ts`, `hooks/structural-auto-study-core.ts`.

---

## 2. Ο ΥΠΑΡΧΩΝ SSoT ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ (ΟΧΙ νέος μηχανισμός)
| SSoT | Τι δίνει | Σημείωση |
|---|---|---|
| `core/commands/CommandHistory.ts` → **`appendToLast(command)`** | Εκτελεί derived command + το **ομαδοποιεί** με το αμέσως προηγούμενο entry σε **`CompositeCommand`** = ΕΝΑ atomic undo (Revit transaction group, ADR-459 Φ7). | ⚠️ Έχει **time-window guard** (`config.mergeConfig.mergeTimeWindow`): αν το derived έρθει **εκτός παραθύρου** → γίνεται **standalone** entry (αυτό πιθανότατα είναι η ρίζα του 2× undo, λόγω του coalescer microtask/debounce). |
| `core/commands/CompositeCommand.ts` | Το transaction group (undo σε αντίστροφη σειρά). | Reuse — μην ξαναγράψεις. |
| `core/commands/useCommandHistory.ts` → **`executeGrouped(cmd)`** | React wrapper του `appendToLast`. | Το canonical entry-point για παράγωγες reactions. |
| `hooks/proactive-coalescer.ts` + `hooks/useProactive*` + `hooks/structural-auto-study-core.ts` | Το proactive recalc pipeline (loads/sizing/reinforce/foundation). | **ΕΔΩ** ψάξε ΠΩΣ dispatch-άρει: `execute` (standalone) vs `executeGrouped` (grouped), ΚΑΙ το **timing** σε σχέση με το `mergeTimeWindow`. |

**Παράδειγμα ήδη σωστού grouping (πρότυπο):** auto-foundation re-derive μετά από column edit → `executeGrouped`/`appendToLast` (δες ADR-489 / `useRibbonFoundationBridge`, `ReconcileCrossLevelFoundationsCommand`). Τα Create* commands (CreateBeams/Columns/Walls/Foundations) ήδη είναι «μία Revit transaction».

---

## 3. ΠΙΘΑΝΕΣ ΑΙΤΙΕΣ & ΠΡΟΣΕΓΓΙΣΕΙΣ (επικύρωσε ΠΡΩΤΑ, μετά διάλεξε)
1. **Timing έξω από `mergeTimeWindow`:** ο coalescer τρέχει το recalc σε microtask/debounce → `appendToLast` βλέπει «παλιό» last → standalone. → Λύση: είτε το recalc να γίνει **σύγχρονα** εντός του ίδιου tick με την εντολή, είτε ο coalescer να κρατά **reference** στην originating εντολή και να κάνει `appendToLast` σε αυτήν (transaction-id based grouping, όχι time-window).
2. **Dispatch via `execute` αντί `executeGrouped`:** το proactive recalc απλώς δεν χρησιμοποιεί το grouping API. → Λύση: routing μέσω `executeGrouped`.
3. **Explicit transaction scope (πιο Revit-grade):** «άνοιξε transaction» στην αρχή της user-εντολής, ό,τι derived τρέχει μέσα → προσκολλάται. Αν δεν υπάρχει τέτοιο API, **πρόσθεσέ το στο `CommandHistory`** (π.χ. `beginTransaction()/endTransaction()` ή `runInTransaction(fn)`) — αλλά **μόνο αν** το `appendToLast` δεν αρκεί. Πρώτη επιλογή = reuse `appendToLast`.

⚠️ **Μην** φτιάξεις δεύτερο grouping σύστημα. Επέκτεινε το `CommandHistory`/`CompositeCommand` αν χρειαστεί.

---

## 4. ΕΠΑΛΗΘΕΥΣΗ ΡΙΖΑΣ (κάνε το ΠΡΙΝ τον κώδικα)
- Repro: σε δοκάρι που στηρίζει κολώνα → delete → μέτρα πόσα entries μπήκαν στο undo stack (log `getGlobalCommandHistory().size()` πριν/μετά, ή `history.subscribe`).
- Εντόπισε **ποιο** ακριβώς command είναι το 2ο entry (auto-size? takedown? auto-study?) και **από ποιον** hook dispatch-άρεται.
- Επιβεβαίωσε αν φταίει το time-window (πρόσθεσε temp log στο `appendToLast` fallback branch).

## 5. TESTS (πράσινα πριν & μετά· N.10 αν αγγίξεις ai-pipeline — δεν αναμένεται)
```
npx jest \
  src/subapps/dxf-viewer/core/commands/__tests__/composite-command-history.test.ts \
  src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/DeleteEntityCommand.test.ts \
  src/subapps/dxf-viewer/hooks/__tests__/proactive-coalescer.test.ts \
  src/subapps/dxf-viewer/hooks/__tests__/structural-auto-study-core.test.ts
```
+ ΝΕΟ test: «delete δοκαριού-με-εξαρτημένο-recalc → ΕΝΑ undo entry → 1× undo επαναφέρει τα πάντα».
**tsc (N.17):** ΕΝΑ τη φορά — έλεγξε πρώτα ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process ... tsc`), μετά background.

## 6. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.0.1 / N.15)
- ADR: πιθανότατα **ADR-459 Φ7** (CompositeCommand/appendToLast) ή νέο ADR αν προστεθεί transaction API. Update changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory.
- **ΜΗΝ** κάνεις commit (Giorgio).

---

## 7. ΕΚΚΡΕΜΕΣ ΑΠΟ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (ΜΗΝ το ξανακάνεις — απλώς ΜΗΝ το χαλάσεις)
**ADR-401 SSoT host-delete detach + stale re-link** — UNCOMMITTED, **DB-verified LIVE**, εκκρεμεί **ΜΟΝΟ commit (Giorgio)**.
Δικά μου αρχεία (μην τα πειράξεις άσχετα): `bim/entities/entity-attach-detach.ts`(+test), `bim/cascade/bim-cascade-resolver.ts`(+test), `bim/columns/column-structural-attach-coordinator.ts`, `core/commands/entity-commands/DeleteEntityCommand.ts`, `ADR-401`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
> Το σημερινό task (atomic undo grouping) είναι **ανεξάρτητο** — πιάνει `core/commands/CommandHistory*` + `hooks/useProactive*`, ΟΧΙ τα παραπάνω αρχεία.

## 8. ΓΝΩΣΤΟ DEFER (χαμηλή προτεραιότητα, ΟΧΙ τώρα)
- **Restored-beam geometry:** μετά το undo-restore, το `floorplan_beams/beam_f26de02f` επανήλθε **χωρίς** πεδίο `geometry` στο Firestore (μόνο `params`). Πιθανώς recompute-on-load → αβλαβές, αλλά άξιο επιβεβαίωσης σε ξεχωριστό task (ADR-390 restore path).
- **ADR-401 re-link union vs replace:** το auto-attach σε stale κολώνα κάνει union → αφήνει το ghost στη λίστα μέχρι το επόμενο detach. Αβλαβές. DEFER.
