# HANDOFF — ADR-487 §7 «Αυτόματη Μελέτη» (auto-study iterative convergence loop)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` — **ειδικά §7** (αυτο-διορθούμενη μελέτη / επαναληπτική σύγκλιση) + §7.3 (τα κομμάτια υπάρχουν ήδη) + §7.4 (πότε σταματά) + §9 (scope guard: ΟΧΙ ML, ντετερμινιστικό).

**Ημ/νία:** 2026-06-19 · **Από:** Opus session (ολοκλήρωσε ADR-499 πλήρες §6.3 actuator, committed ad0ab159) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ** (ξανα-τρέξε — shared tree, ο κώδικας αλλάζει· οι πίνακες εδώ είναι confirmed 2026-06-19 αλλά επιβεβαίωσέ τους).
**Απαιτήσεις Giorgio (verbatim):** Revit/Robot-grade, **Full Enterprise + Full SSoT, ΧΩΡΙΣ ΔΙΠΛΟΤΥΠΑ**. Πριν κώδικα → πραγματικό grep audit για reuse. **ΜΗΝ φτιάξεις νέο engine — ΕΝΟΡΧΗΣΤΡΩΣΕ τα υπάρχοντα.**
**🚨 COMMIT + tsc = ο GIORGIO, ΟΧΙ εσύ.** jest = από repo ROOT. Επαλήθευση: live DB Firestore MCP (`proj_12788b6a`).
**🎯 Μοντέλο:** Opus (αρχιτεκτονική, cross-cutting ενορχήστρωση). `/model opus`
**⚠️ SHARED WORKING TREE με άλλον agent** — `git add` ΜΟΝΟ τα δικά σου. ΜΗΝ αγγίξεις ADR-496 (`bim/columns/column-beam-align*`) ούτε ADR-483 (`analytical/diagrams/*`, `StructuralDiagramOverlay`) = άλλου agent.

---

## 0. ΤΟ ΟΡΑΜΑ + ΤΙ ΖΗΤΑΕΙ Ο GIORGIO

ADR-487 §4 = «σε κάθε κίνηση recompute ΟΛΑ» (**τοπική** αυτο-διόρθωση — ΥΠΑΡΧΕΙ ήδη μέσω proactive hooks). **§7 = ο επόμενος ορίζοντας:** ένα κουμπί **«Αυτόματη Μελέτη»** που μελετά **ολόκληρο το κτίριο μόνο του** με έναν βρόχο:

> **δοκίμασε → έλεγξε → διόρθωσε → ξανά, μέχρι να μη μένει τίποτα κόκκινο** (ή μέχρι όριο γύρων → «εδώ χρειάζομαι εσένα»).

Η εμπειρία χρήστη (§7.2, verbatim όραμα):
> «Η Κ3 ζορίζεται 120% — τη μεγαλώνω.» → «Το Δ7 δίπλα παίρνει λιγότερο — ξαναϋπολογίζω.» → «Το πέδιλο της Κ3 θέλει κι αυτό λίγο — διορθώνω.» → «Ξαναελέγχω… Κ3 85%, όλα κάτω από το όριο.» → **«Τελείωσα. 4 γύροι. Άλλαξα 6 κολώνες, 3 δοκάρια, 2 πέδιλα.» ✅**

**Κρίσιμο (§7.1 + §9):** ΟΧΙ machine learning. **Ντετερμινιστικός** βρόχος που βάζει τα ΥΠΑΡΧΟΝΤΑ auto-correct κομμάτια **σε σειρά** μέσα σε ένα loop με όριο γύρων.

---

## 1. ΓΙΑΤΙ ΕΙΝΑΙ «ΚΟΝΤΑ» — ΟΛΑ ΤΑ ΚΟΜΜΑΤΙΑ ΥΠΑΡΧΟΥΝ (§7.3, confirmed grep)

**Δεν φτιάχνεις νέο engine.** Βάζεις σε βρόχο τα παρακάτω SSoT cores που ΗΔΗ τρέχουν single-pass reactively:

| Κομμάτι του βρόχου | Υπάρχον SSoT (confirmed 2026-06-19) | Τι κάνει |
|---|---|---|
| **«μεγάλωσε το μέλος που ζορίζεται»** | `hooks/member-auto-size-core.ts:46` **`runMemberAutoSize(levelManager, entityIds, provider, exec)`** → `new AutoSizeMembersCommand` | auto-size διατομών (δοκός ύψος + στρέψη §6.3-b· πλάκα πάχος· κολώνα διατομή). ADR-475/486§C/499. **Επιστρέφει count** resized. |
| **«όπλισε σωστά μετά την αλλαγή»** | `hooks/structural-auto-reinforce-core.ts:66` **`runOrganismAutoReinforce(levelManager, entityIds, provider, exec)`** → `new AutoReinforceOrganismCommand` | auto-reinforce (καμπτικός + στρεπτικός §6.3-c + FEM-M κολώνας ADR-491). **Επιστρέφει count** reinforced. |
| **«διόρθωσε τα πέδιλα»** | `hooks/useAutoFoundationDesign.tsx` (Φ7 core — **grep το exported core name**, πιθανώς `runAutoFoundationDesign`) | auto-size πεδίλων (ADR-464/489/497 FEM-N). |
| **«δες τι ζορίζεται / τι έμεινε κόκκινο»** | `bim/structural/organism/structural-diagnostics-store.ts:28` **`StructuralDiagnosticsStore`** (`.getState()`/`.subscribe`/`.getForEntity`) + `StructuralDiagnostic{severity:'info'\|'warning'\|'error'}` (`structural-organism-types.ts:147`) | η **SSoT λίστα diagnostics** = το «τι μένει κόκκινο». **Το convergence signal.** |
| **«ανέφικτο στο max» (terminal)** | `bim/structural/organism/feasibility-checks.ts` **`runFeasibilityChecks`** (ADR-499 D) | error «απαιτείται αλλαγή σχεδιασμού» → σήμα **exit-to-human** (§7.4). |
| **utilization ≤ 1** | `bim/structural/utilization/member-utilization.ts` (ADR-485) | δευτερεύον convergence signal (χρώμα επάρκειας). |
| **atomic undo (ΕΝΑ Ctrl+Z)** | `core/commands/useCommandHistory.ts` **`executeGrouped`** + `CommandHistory.appendToLast` + `core/commands/CompositeCommand.ts` | όλοι οι γύροι = ΕΝΑ undo step. **Πρότυπο:** `hooks/useAutoFoundationDesign.tsx` Φ7 (`executeGrouped` + `GEOMETRY_EDIT_TRIGGERS`). |
| **κουμπί ribbon** | `ui/ribbon/data/analyze-tab.ts` (ADR-482, το «Ανάλυση» κουμπί) + `app/useDxfViewerCallbacks.ts` | δίπλα στο «Ανάλυση» → νέο «Αυτόματη Μελέτη». |

**ΔΕΝ υπάρχει** orchestrator «Αυτόματη Μελέτη» (grep `auto-study|Αυτόματη Μελέτη|converge` → μηδέν structural orchestrator). Είναι γνήσια **νέα ενορχήστρωση**.

---

## 2. ΠΑΡΑΔΟΤΕΟ — ο βρόχος σύγκλισης (PLAN-FIRST, μετά «προχώρα»)

### NEW core (light module, jest-clean, mirror `runOrganismAutoReinforce`)
```
hooks/structural-auto-study-core.ts → runAutoStudy(levelManager, provider, exec, opts?)
```
**Ντετερμινιστικός βρόχος (ψευδοκώδικας — §7.1):**
```
const changed = { columns:Set, beams:Set, slabs:Set, footings:Set }
let round = 0
for (; round < MAX_STUDY_ROUNDS; round++) {           // MAX_STUDY_ROUNDS = 10 (§7.4 oscillation guard)
  const sized      = runMemberAutoSize(level, [], provider, exec)      // 1. μεγάλωσε (geometry ΠΡΩΤΑ)
  const reinforced = runOrganismAutoReinforce(level, [], provider, exec) // 2. όπλισε (steel)
  const footed     = runAutoFoundationDesign(level, ..., exec)          // 3. πέδιλα (μετά το column-N)
  const changedThisRound = sized + reinforced + footed
  // ο organism re-derives diagnostics proactively· διάβασέ τα ΜΕΤΑ τον γύρο
  const diags = StructuralDiagnosticsStore.getState()
  const hasBlocking = diags.some(d => d.severity==='error' || d.severity==='warning')
  if (changedThisRound === 0) break          // σύγκλιση (τίποτα δεν άλλαξε) Ή κόλλησε
  if (!hasBlocking) break                     // πλήρης σύγκλιση (μηδέν κόκκινο)
}
return { rounds: round, changed, remaining: StructuralDiagnosticsStore.getState() }
```
**Σειρά μέσα στον γύρο (ΚΡΙΣΙΜΟ):** size → reinforce → footing (mirror του mount order: `useProactiveMemberSizing` ΠΡΙΝ `useProactiveOrganismReinforce`· το πέδιλο εξαρτάται από το column-N που αλλάζει το sizing/reinforce).

### NEW ribbon button + trigger
```
ui/ribbon/data/analyze-tab.ts → «Αυτόματη Μελέτη» κουμπί (δίπλα στο «Ανάλυση»)
app/useDxfViewerCallbacks.ts → handler καλεί runAutoStudy(level, provider, executeGrouped)
hooks/useStructuralAutoStudy.tsx (ή callback) → wires provider (settings store) + level manager
i18n el+en → key «Αυτόματη Μελέτη» + report toast (ICU: rounds/columns/beams/footings/remaining)
```

### Report (§7.2) — toast ή dialog
> «Τελείωσα. Έκανα **N** γύρους. Άλλαξα **X** κολώνες, **Y** δοκάρια, **Z** πέδιλα.» ✅
> Αν `remaining.length > 0` μετά MAX: «**W** θέματα χρειάζονται εσένα: …» (§7.4 exit-to-human· δείξε τα μέσω του υπάρχοντος ADR-490 warning overlay — ΟΧΙ νέο UI).

### Atomic undo (§7.4 belt)
ΟΛΟΙ οι γύροι → ΕΝΑ undo group μέσω `executeGrouped`/`CompositeCommand`. **Πρότυπο:** `useAutoFoundationDesign.tsx`. ΕΝΑ Ctrl+Z αναιρεί όλη τη μελέτη.

---

## 3. SSoT AUDIT GREP (ξανα-τρέξε ΠΡΙΝ κώδικα)
```
auto-study|Αυτόματη Μελέτη|runAutoStudy|converge|MAX_STUDY_ROUNDS   (να μην υπάρχει ήδη)
runMemberAutoSize|runOrganismAutoReinforce|runAutoFoundationDesign   (τα 3 cores — υπογραφές)
StructuralDiagnosticsStore|StructuralDiagnostic|severity              (convergence signal)
executeGrouped|CompositeCommand|appendToLast                         (atomic undo)
useAutoFoundationDesign|GEOMETRY_EDIT_TRIGGERS                        (το Φ7 πρότυπο)
analyze-tab|useDxfViewerCallbacks                                    (ribbon wiring ADR-482)
```
Επιβεβαίωσε τις υπογραφές των 3 cores (επιστρέφουν count· δέχονται `exec`) + το exported name του foundation core (`useAutoFoundationDesign.tsx`).

---

## 4. ΚΡΙΣΙΜΑ ΜΑΘΗΜΑΤΑ (μην τα πατήσεις)
- 🚨 **ΚΑΝΕΝΑ νέο reactive trigger** (μαθήματα ADR-491/488: ο proactive `bim:analysis-solved→reinforce` δημιουργούσε αυτοσυντηρούμενο infinite-loop/freeze). Η «Αυτόματη Μελέτη» είναι **one-shot explicit command** (κουμπί), τρέχει **σύγχρονα** μέσα από γύρους — **ΟΧΙ** event cycle.
- 🚨 **Όριο γύρων υποχρεωτικό** (§7.4): `MAX_STUDY_ROUNDS=10` + «no change → stop» (ταλάντωση Α↔Β). Χωρίς όριο = ατέρμονος βρόχος.
- 🚨 **Exit-to-human** (§7.4): αν μετά MAX μένουν diagnostics → σταμάτα + ανέφερε «εδώ χρειάζομαι εσένα» (μέσω ADR-490 overlay + report). ΜΗΝ επιμένεις σιωπηλά.
- **Convergence signal = `StructuralDiagnosticsStore` (warning+error)** ΟΧΙ νέος έλεγχος. `runFeasibilityChecks` (ADR-499 D) είναι ήδη μέσα στα diagnostics → το «ανέφικτο» εμφανίζεται ως error.
- **ΜΗΝ διπλασιάσεις** τη λογική των cores — κάλεσέ τους. Είναι ΗΔΗ idempotent + convergence-guarded (50mm/count·Ø) → ο βρόχος συγκλίνει φυσικά.
- **Σειρά:** size → reinforce → footing (geometry πριν steel πριν foundation).
- **GOL:** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en), Select=`@/components/ui/select`.
- **Dead-code ratchet (CHECK 3.22):** ΜΗΝ export helper πριν consumer.

---

## 5. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST:** ADR-487 §7 → SSoT audit (grep) → reuse-vs-new πίνακας → plan → **περίμενε «προχώρα»** → code. (Αν σπάσει σε slices: core+loop πρώτα, μετά ribbon+report.)
- **commit + tsc = ο GIORGIO.** jest = repo ROOT. **Απάντα ΠΑΝΤΑ Ελληνικά.**
- **SHARED TREE:** `git add` ΜΟΝΟ δικά σου. ΜΗΝ ADR-496 (`bim/columns/column-beam-align*`) ούτε ADR-483 (`analytical/diagrams/*`) = άλλου agent.
- **Μετά την υλοποίηση (N.15+N.0.1):** NEW ADR (επόμενο free = **ADR-500**· επιβεβαίωσε με adr-index) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές, ΜΟΝΟ τι εκκρεμεί) + MEMORY (νέο `reference_auto_study_convergence_loop.md`).
- **Pre-existing jest fails (ΟΧΙ δικά σου):** 6 raft (ADR-476 `maxFreeSpanM`) + 1 `AssignWallTypeCommand` undo.

## 6. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ (live DB — Firestore MCP `proj_12788b6a`)
2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + πλάκα-πρόβολος (μεγάλος, ανεπαρκής). **Μετά:** πάτα «Αυτόματη Μελέτη» → σε ≤10 γύρους η εφαρμογή **μόνη της** μεγαλώνει διατομές (δοκός/κολώνα/πλάκα) + οπλίζει (καμπτικά+στρεπτικά) + διορθώνει πέδιλα **μέχρι μηδέν κόκκινο**· toast «N γύροι, X/Y/Z άλλαξαν»· ΕΝΑ Ctrl+Z αναιρεί τα πάντα. Αν φυσικά αδύνατο → σταματά + «W θέματα χρειάζονται εσένα».

---

## 7. ΚΑΤΑΣΤΑΣΗ ΠΡΟΗΓΟΥΜΕΝΗΣ ΔΟΥΛΕΙΑΣ (context)
ADR-499 **πλήρες §6.3 torsion actuator** (A+B1+B2+C-v1+D + §6.3 a/b/c) **COMMITTED ad0ab159**. Η δοκός-πρόβολος πλέον αυτο-μεγαλώνει ύψος + παίρνει στρεπτικό οπλισμό. Όλα τα §4 «σε κάθε κίνηση» auto-correct κομμάτια είναι έτοιμα — **το §7 τα ενορχηστρώνει**. MEMORY: `reference_flexural_capacity_ceiling.md` (ADR-499 πλήρες). Working tree: μοιράζεται με άλλον agent (ADR-496/483).
