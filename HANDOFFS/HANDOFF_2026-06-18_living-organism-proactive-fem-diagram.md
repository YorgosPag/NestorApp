# HANDOFF — Living Organism: Proactive FEM re-analysis + ζωντανό διάγραμμα M/V/N σε κάθε κίνηση (Revit/Robot-grade)

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε ADR-486 topology-aware beam support + browser-verified ADR-483 διαγράμματα) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ.** ΜΗΝ γράψεις πριν εγκριθεί το plan.

> ⚠️ **Shared working tree** με άλλον agent. **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A.** **commit = Giorgio (ΟΧΙ εσύ). tsc = Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέξε από repo root.**
> **Full Enterprise + Full SSOT + Revit/Robot-grade (GOL).** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en), μηδέν inline styles/div-soup, Select = `@/components/ui/select` (ADR-001).
> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`. Αυτό το task είναι **συγκεκριμένο βήμα** προς το όραμα §4 («σε κάθε κίνηση recompute»).

---

## 0. ΤΟ ΣΕΝΑΡΙΟ (τι παρατήρησε ο Giorgio — στιγμιότυπο 2026-06-18 20:10)

Κάτοψη: 2 κολώνες + 1 δοκάρι. Το διάγραμμα M/V/N ήταν σχεδιασμένο όταν το δοκάρι συνδεόταν **και** στις δύο κολώνες (αμφιέρειστη παραβολή — sagging). Ο Giorgio **μετακίνησε/αποσύνδεσε την αριστερή κολώνα** → στην κάτοψη το δοκάρι συνδέεται πλέον **ΜΟΝΟ** με τη δεξιά (πρόβολος).

**ΤΟ ΠΡΟΒΛΗΜΑ:** Το διάγραμμα **ΔΕΝ ΑΛΛΑΞΕ ΚΑΘΟΛΟΥ** — παρέμεινε η αμφιέρειστη παραβολή, δεν έγινε πρόβολος. Δηλαδή **η FEM ανάλυση δεν ξανα-έτρεξε στη μετακίνηση**. Ο φορέας δεν είναι «ζωντανός» — έμεινε στην παλιά αλήθεια (ADR-487 §3: «δεν επιτρέπεται να μείνει στην παλιά αλήθεια»).

## 1. 🔬 ΠΡΟΚΑΤΑΡΚΤΙΚΗ ΥΠΟΘΕΣΗ (από γρήγορο grep — ΕΠΑΛΗΘΕΥΣΕ, μην την εμπιστευτείς τυφλά)

**Κύριος ύποπτος — ΕΠΙΒΕΒΑΙΩΜΕΝΟΣ:** ο FEM solver τρέχει **ΜΟΝΟ explicit**, όχι proactive.
- `hooks/useProactiveStructuralAnalysis.ts` → `return EventBus.on('bim:run-structural-analysis', schedule);` — ακούει **ΜΟΝΟ** το κουμπί «Ανάλυση». **ΔΕΝ** ακούει `bim:entities-moved` / `bim:beam-params-updated` / `bim:column-params-updated` / detach events.
- Άρα μετά τη μετακίνηση, ο `AnalysisResultsStore` (solver output, ADR-481) κρατά **stale** M/V/N → το `StructuralDiagramOverlay` (ADR-483) ζωγραφίζει την παλιά παραβολή.

**Κρίσιμη αντίθεση (επαλήθευσέ την):**
- Το **analytical model (ADR-480)** ΕΙΝΑΙ ήδη proactive — ξαναχτίζεται στο `useStructuralOrganism` σε κάθε structural αλλαγή (κόμβοι/μέλη/στηρίξεις topology-fresh).
- Ο **tributary οπλισμός (ADR-471/472/486)** ΕΙΝΑΙ ήδη proactive (`useProactiveStructuralLoads` + `useProactiveOrganismReinforce` ακούν `bim:entities-moved`).
- Αλλά ο **FEM SOLVER (ADR-481)** ΔΕΝ είναι → το διάγραμμα μένει πίσω. **Αυτό είναι το κενό.**

**Στόχος (Revit/Robot way, ADR-487 §4):** σε κάθε κίνηση (move/connect/detach/edit) → ο solver ξανα-τρέχει → M/V/N + διάγραμμα + readouts ακολουθούν αυτόματα την τοπολογία. Πρόβολος → η παραβολή γίνεται πρόβολος αμέσως.

## 2. ⚖️ Η ΚΕΝΤΡΙΚΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΕΝΤΑΣΗ (απάντησέ τη ΠΡΙΝ το plan)

Ο explicit trigger ΗΤΑΝ **σκόπιμη απόφαση** (ADR-481/482: «explicit «Ανάλυση» trigger, ΟΧΙ eager») για λόγους **κόστους** — ο FEM είναι βαρύτερος από το tributary (K·u=F, LDLᵀ). Το όραμα (ADR-487 §4) θέλει «σε κάθε κίνηση». **Συμβίβασε τα δύο.** Επιλογές προς αξιολόγηση (διάλεξε Revit-grade & δικαιολόγησε):

- **(A) Πλήρως proactive + coalesced** — mirror του υπάρχοντος pattern (`useProactiveStructuralLoads`: shared event list + `queueMicrotask` coalesce). Κάθε structural αλλαγή → re-solve (debounced). Απλό, συνεπές με τα άλλα proactive hooks· ρίσκο κόστους σε μεγάλα μοντέλα.
- **(B) Latch «η ανάλυση είναι ενεργή»** — proactive re-solve ΜΟΝΟ αφού ο χρήστης πάτησε «Ανάλυση» μία φορά (ή ενεργοποίησε το diagram toggle). Πριν: dormant. Μετά: ζωντανό. Ισορροπεί κόστος/όραμα (πιο κοντά σε Revit «Analytical model active»).
- **(C) Proactive μόνο όταν το diagram overlay είναι ΟΡΑΤΟ** (`analysis-diagram-view-store` ON) — re-solve μόνο όταν ο χρήστης βλέπει το διάγραμμα. Lazy + ζωντανό όταν χρειάζεται.

> Σύσταση προηγούμενου agent (όχι δεσμευτική): **(B) ή (C)** — ζωντανό όταν ο μηχανικός «κοιτά» τα στατικά, dormant αλλιώς → Revit-grade + προστασία κόστους. Τεκμηρίωσε την απόφαση στο νέο ADR.

## 3. 🔴 SSOT AUDIT (GREP) — ΤΡΕΞΕ ΟΛΑ ΠΡΙΝ ΓΡΑΨΕΙΣ. Παραδοτέο: πίνακας reuse vs new + απάντηση §2.

### 3.1 Ο trigger του solver (Ο ΠΥΡΗΝΑΣ)
```
src/subapps/dxf-viewer/hooks/useProactiveStructuralAnalysis.ts   ← ΜΟΝΟ 'bim:run-structural-analysis' (το κενό)
src/subapps/dxf-viewer/hooks/structural-analysis-core.ts          ← τι κάνει το pass (build model → solve → store)
src/subapps/dxf-viewer/ui/ribbon/data/analyze-tab.ts             ← το κουμπί «Ανάλυση» (emit)
grep -rn "bim:run-structural-analysis\|AnalysisResultsStore" src/subapps/dxf-viewer
```

### 3.2 Το ΥΠΑΡΧΟΝ proactive pattern (REUSE — ΜΗΝ εφεύρεις νέο μηχανισμό)
```
src/subapps/dxf-viewer/hooks/useProactiveStructuralLoads.ts      ← shared event list + queueMicrotask coalesce (το πρότυπο)
src/subapps/dxf-viewer/hooks/useProactiveOrganismReinforce.ts    ← ίδιο pattern (PROACTIVE_REINFORCE_EVENTS)
src/subapps/dxf-viewer/hooks/useStructuralOrganism.ts            ← ORGANISM_EVENTS list + analytical model ΗΔΗ proactive εδώ
```
🔑 **SSoT ευκαιρία:** οι 3 hooks έχουν σχεδόν ΙΔΙΑ event list (`entities-moved`, `*-params-updated`, from-grid…). Σκέψου αν η event-list πρέπει να γίνει **ΕΝΑ shared const** (boy-scout, N.0.2) αντί να αντιγραφεί 4η φορά στο νέο proactive-analysis hook.

### 3.3 Results store + diagram + readouts (οι καταναλωτές)
```
src/subapps/dxf-viewer/bim/structural/analytical/solver/analysis-results-store.ts  ← stale εδώ
src/subapps/dxf-viewer/components/dxf-layout/StructuralDiagramOverlay.tsx           ← ζωγραφίζει από το store
src/subapps/dxf-viewer/ui/structural-analysis/useEntityAnalysisForces.ts            ← N/V/M readout panels
src/subapps/dxf-viewer/state/analysis-diagram-view-store.ts                         ← toggle ορατότητας (για επιλογή C)
src/subapps/dxf-viewer/hooks/useStructuralAnalysisNotification.tsx                  ← toasts (μην κάνεις spam σε κάθε move!)
```

### 3.4 Mounting (πού ζουν τα proactive hooks)
```
src/subapps/dxf-viewer/app/DxfViewerContent.tsx + useDxfViewerCallbacks.ts  ← πού mount-άρεται το useProactiveStructuralAnalysis
```

### 3.5 ADR-040 (αν αγγίξεις canvas/overlay/store)
```
docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md  ← stage αν αγγίξεις micro-leaf (CHECK 6B/6D)· ο solver είναι heavy → ΠΟΤΕ σε high-freq path
```

## 4. ΣΧΕΤΙΚΑ ADR (διάβασε όσα αγγίζεις· code = source of truth)
**ADR-487 (ΟΡΑΜΑ — διάβασέ το ΠΡΩΤΟ)** · ADR-481 (FEM solver — explicit trigger by design) · ADR-482 (analysis UI surface — κουμπί+readout) · ADR-483 (διαγράμματα M/V/N) · ADR-480 (analytical model — ΗΔΗ proactive) · ADR-486 (topology-aware beam support — μόλις έγινε) · ADR-459 (organism) · ADR-467 (load-path).

## 5. ΚΑΤΑΣΤΑΣΗ TREE (UNCOMMITTED — ΜΗΝ τα πειράξεις, είναι προηγούμενων sessions)
- **ADR-486** (topology-aware beam support — δικό μου, μόλις τελείωσε): NEW `bim/structural/organism/derive-beam-support.ts` + `beam-support-condition-store.ts` + override threading + κεντρικός `resolveActiveBeamRebarLayout`. 35 jest GREEN. UNCOMMITTED (Giorgio commit).
- **ADR-483/484/485** (διαγράμματα / cross-level foundation / utilization) — UNCOMMITTED από προηγούμενα/παράλληλα sessions. ΜΗΝ τα αγγίξεις.
- ⚠️ Άλλος agent στο shared tree. **git add ΜΟΝΟ τα δικά σου.** Επόμενο ελεύθερο ADR = **πιθανώς 488** (487=όραμα· 486=δικό μου· **επιβεβαίωσε με `ls docs/centralized-systems/reference/adrs/` πριν δεσμεύσεις αριθμό**).
- Γνωστά **pre-existing jest failures** (όχι δικά σου): 2 raft/slab (`maxFreeSpanM` undefined fixture, ADR-476).

## 6. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST:** ADR-487 read → SSoT audit (grep §3) → πίνακας reuse vs new + απάντηση §2 (ποια επιλογή A/B/C & γιατί) → plan → **περίμενε «προχώρα»** → code.
- **ADR-driven (N.0.1):** PHASE 1 read CURRENT code (code wins) → update ADR αν αποκλίνει → implement → PHASE 3 update ADR + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (ίδιο commit).
- **N.8:** πιθανώς cross-cutting (proactive hook + store + diagram + toasts + mounting) → αν 5+ αρχεία/2+ domains, **ενημέρωσε Giorgio** πριν orchestrator.
- **Full SSoT:** ΜΗΝ εφεύρεις νέο proactive μηχανισμό — **mirror** το `useProactiveStructuralLoads` pattern· σκέψου shared event-list const. ΜΗΝ διπλασιάσεις τον solver-run κώδικα (reuse `structural-analysis-core`).
- **Κόστος/ADR-040:** ο solver είναι heavy — **coalesce per microtask**, ΠΟΤΕ σε high-freq (pan/zoom/hover/grip-drag-frame). Re-solve στο **commit** της κίνησης (`bim:entities-moved`), όχι σε κάθε frame του drag.
- **Toasts:** μην κάνεις toast spam σε κάθε proactive re-solve (το `useStructuralAnalysisNotification` ίσως πρέπει να μείνει σιωπηλό στο proactive, να μιλά μόνο στο explicit — όπως ο reinforce).
- **commit/tsc = Giorgio.** jest = τρέξε από root. **Shared tree: git add ΜΟΝΟ δικά σου.** **Απάντα Ελληνικά.**

## 7. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ
Το ίδιο σενάριο: 2 κολώνες + δοκάρι (αμφιέρειστο διάγραμμα) → μετακίνησε/αποσύνδεσε τη μία κολώνα → **το διάγραμμα M/V/N πρέπει ΑΜΕΣΩΣ να γίνει πρόβολος** (hogging στην πάκτωση, μηδέν στο ελεύθερο άκρο) + τα N/V/M readouts να αλλάξουν + (αν 0 στηρίξεις) διαγνωστικό αστάθειας. Σύγκρινε με τον topology-aware οπλισμό (ADR-486) — πρέπει να συμφωνούν.

## 8. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (ADR-487 §4)
«Σε κάθε κίνηση»: physical edit → **ανα-σύνθεση οργανισμού (ΗΔΗ proactive)** → **επανα-επίλυση FEM (ΤΟ ΚΕΝΟ)** → derived M/V/N/διάγραμμα/readouts ακολουθούν → καθοδηγητική ενημέρωση. Καθαρός διαχωρισμός, ΕΝΑ source of truth, μηδέν stale, coalesced (μηδέν 60fps re-solve).
