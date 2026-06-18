# HANDOFF — T3-UI: Ορατή/χρήσιμη επιφάνεια του στατικού FEM solver (κουμπί «Ανάλυση» + αποτελέσματα M/V/N + diagnostics)

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε T3/ADR-481 — τον engine του FEM solver) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST — UI slice πάνω σε έτοιμο engine. **ΜΗΝ γράψεις κώδικα πριν εγκριθεί το plan.**
**Roadmap:** «Δρόμος Α» — κάνει τον αόρατο T3 engine **ορατό & επαληθεύσιμο** ΠΡΙΝ χτιστεί ο σεισμός (T4) από πάνω. Πηγές (αυτοτελείς):
`docs/centralized-systems/reference/adrs/ADR-481-static-fem-solver.md` (ο engine που καταναλώνεις) +
`HANDOFFS/HANDOFF_2026-06-18_T3_fem-solver.md` (το προηγούμενο T3 handoff) +
`HANDOFFS/HANDOFF_2026-06-18_GAP-ANALYSIS_static-study-vs-app.md` (roadmap).

> ⚠️ **Shared working tree** με άλλους agents (ADR-479 presets, ADR-471/476). **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A.**
> **commit/push = Giorgio** (όχι εσύ). **tsc = Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέχει κανονικά.**
> **Επόμενο ελεύθερο ADR = 482.** **Γλώσσα: Ελληνικά πάντα.** **Full Enterprise + Full SSoT + Revit-grade (GOL).**

---

## 0. TL;DR — τι λείπει & τι φτιάχνεις

Ο T3 (ADR-481) έφτιαξε **πλήρη στατικό FEM solver** (3D space-frame, K·u=F → πραγματικά M/V/N + διαγράμματα + envelope), 13 jest GREEN. **ΑΛΛΑ είναι εντελώς αόρατος:** κανένα κουμπί δεν τον τρέχει, κανένα UI δεν δείχνει τα αποτελέσματα, τα diagnostics δεν εμφανίζονται πουθενά. Ο hook `useProactiveStructuralAnalysis` είναι **mounted αλλά dormant** (ακούει event που κανείς δεν εκπέμπει).

**Στόχος T3-UI (Revit-grade):** δώσε στον μηχανικό τρόπο να (1) **τρέξει** την ανάλυση, (2) **δει** τα εντατικά μεγέθη/μετακινήσεις, (3) **ενημερωθεί** για μηχανισμό/παραλειπόμενα μέλη. Όπως η Revit→Robot επιστρέφει αποτελέσματα και τα δείχνει σε results panel + diagrams.

---

## 1. 🔴 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSOT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΟΤΙΔΗΠΟΤΕ

**Εντολή Giorgio: πραγματικό SSoT audit για να ΜΗΝ φτιάξεις διπλότυπα — χρησιμοποίησε υπάρχοντα patterns.** Κάνε ΟΛΑ τα παρακάτω greps + **διάβασε** ό,τι βρεις. Παραδοτέο στο plan: πίνακας «reuse vs new».

### 1.1 Ribbon κουμπί + action routing (το «Ανάλυση» trigger)
```
src/subapps/dxf-viewer/ui/ribbon/data/analyze-tab.ts          ← STRUCTURAL_REINFORCE_PANEL (id 'structural'): εδώ ζουν «Αυτόματος Οπλισμός» + «Υπολογισμός Φορτίων». ΤΟ ΝΕΟ ΚΟΥΜΠΙ ΜΠΑΙΝΕΙ ΕΔΩ.
grep -rn "wrappedHandleAction\|'organism.compute-loads'\|'organism.auto-reinforce'" src/subapps/dxf-viewer/app/useDxfViewerCallbacks.ts
grep -rn "bim:compute-loads-requested\|EventBus.emit" src/subapps/dxf-viewer/hooks/useStructuralLoadTakedown.ts
```
- **Pattern (ADR-345):** ribbon button `command.action` (string) → `wrappedHandleAction` (useDxfViewerCallbacks) → `EventBus.emit(...)`. Το πλησιέστερο mirror = `analyze.compute-loads` (action `organism.compute-loads`). **ΤΟ ΝΕΟ:** action `organism.run-analysis` → `EventBus.emit('bim:run-structural-analysis', {})` (το event ΥΠΑΡΧΕΙ ήδη — ADR-481). Reuse το ΑΚΡΙΒΕΣ pattern, μην εφεύρεις νέο μηχανισμό.
- i18n ribbon keys: `grep -rn "computeTakedownLoads\|autoReinforceOrganism" src/i18n/locales` → πρόσθεσε `ribbon.commands.runStructuralAnalysis` + tooltip (el+en). Icon: `grep -rn "struct-auto-reinforce" src/subapps/dxf-viewer/ui/ribbon` (RibbonButtonIcon cases) → reuse ή πρόσθεσε.

### 1.2 Ο engine API που καταναλώνεις (T3 — ΜΗΝ τον πειράξεις, τον διαβάζεις)
```
src/subapps/dxf-viewer/bim/structural/analytical/solver/analysis-results-store.ts  ← AnalysisResultsStore { get/subscribe/set }
src/subapps/dxf-viewer/bim/structural/analytical/solver/solver-types.ts            ← AnalysisResult/CombinationResult/MemberForceResult/MemberForceExtrema/NodeDisplacement/DiagramStation
src/subapps/dxf-viewer/bim/structural/analytical/solver/analysis-diagnostics.ts    ← runAnalysisDiagnostics(result, memberIds) → StructuralDiagnostic[]
src/subapps/dxf-viewer/hooks/structural-analysis-core.ts                           ← runStructuralAnalysis({entities, model}) → {result, diagnostics}
src/subapps/dxf-viewer/hooks/useProactiveStructuralAnalysis.ts                     ← dormant hook (ακούει 'bim:run-structural-analysis')
```
- **Ροή:** κουμπί → emit `bim:run-structural-analysis` → ο dormant hook ξυπνά → `runStructuralAnalysis` → γράφει `AnalysisResultsStore` + emit `bim:analysis-solved` → **εδώ μπαίνει το δικό σου UI** (διαβάζει το store).
- **Result shape:** `AnalysisResult { combinations: CombinationResult[], envelopeByMember: Map<memberId, MemberForceExtrema>, skippedMemberIds, unstable }`. `MemberForceExtrema { maxAbsAxialN, maxAbsShear, maxAbsMoment, maxAbsTorsion }` (kN/kNm). `CombinationResult { combinationId, combinationKind, singular, displacements[], memberForces[] }`. `MemberForceResult { memberId, endForcesLocal[12], diagram: DiagramStation[], extrema }`. **memberId === entityId** (1:1, ADR-480).

### 1.3 Diagnostics surfacing (μηχανισμός / παραλειπόμενο μέλος → warnings panel)
```
src/subapps/dxf-viewer/bim/structural/organism/structural-diagnostics-store.ts    ← StructuralDiagnosticsStore (SINGLE writer = useStructuralOrganism) + getForEntity
src/subapps/dxf-viewer/bim/structural/organism/useEntityStructuralDiagnostics.ts  ← per-entity reactive selector (useSyncExternalStore)
src/subapps/dxf-viewer/ui/structural-warnings/EntityWarningsSection.tsx           ← όπου εμφανίζονται στα property panels
```
- ⚠️ **Single-writer invariant:** ο `StructuralDiagnosticsStore` γράφεται ΜΟΝΟ από τον `useStructuralOrganism` (ADR-040). Η ανάλυση είναι **explicit/on-demand** → ΔΕΝ ανήκει σε εκείνο το pass. **Αξιολόγησε στο plan:** (A — προτείνεται) ξεχωριστό `AnalysisDiagnosticsStore` (mirror) + ο reader (`useEntityStructuralDiagnostics` ή `EntityWarningsSection`) **ενώνει** τα δύο sets· (B) γράψε τα analysis diagnostics από τον `useProactiveStructuralAnalysis` (δικό μου αρχείο) σε δικό τους store. **ΜΗΝ** σπάσεις τον single-writer του οργανισμού.

### 1.4 Πού δείχνεις τα M/V/N (per-entity readout) — reuse panels
```
src/subapps/dxf-viewer/ui/column-advanced-panel/   (+ column-property-fields.ts descriptor)
src/subapps/dxf-viewer/ui/beam-advanced-panel/BeamAdvancedPanel.tsx
grep -rn "useSyncExternalStore\|BimPropertyRow" src/subapps/dxf-viewer/ui/column-advanced-panel
```
- Reuse το descriptor/`BimPropertyRow` pattern (read-only readout section «Εντατικά μεγέθη / Ανάλυση»: N_Ed, V_Ed, M_Ed envelope από `AnalysisResultsStore.envelopeByMember.get(entityId)`). Panels = low-freq → `useSyncExternalStore(AnalysisResultsStore.subscribe, …)` είναι ADR-040 safe (ΟΧΙ canvas leaf).

### 1.5 (Αν κάνεις canvas diagrams) — υπάρχον overlay rendering
```
grep -rni "diagram\|moment\|shear" src/subapps/dxf-viewer/bim/structural --include=*.ts | grep -iv test
src/subapps/dxf-viewer/bim/labels/bim-dim-labels.ts        ← drawing primitives pattern (pills/labels)
src/subapps/dxf-viewer/bim/structural/detail-sheet/        ← Canvas/jsPDF primitives (αν θες sheet-style)
```
- **Δεν υπάρχει** moment/shear diagram renderer σήμερα — θα ήταν νέο. **Πρότεινε στο plan:** Phase 1 = panel readout (μικρό, Revit-grade), Phase 2 = canvas diagram overlay (ξεχωριστό slice, βαρύτερο — μην το φορτώσεις όλο μαζί).

**Παραδοτέο audit (γράψε στο plan):** πίνακας reuse vs new. Boy-Scout (N.0.2) αν βρεις duplicate.

---

## 2. ΣΤΟΧΟΣ T3-UI (scope — τι ΝΑΙ / τι ΟΧΙ)

### ✅ ΕΝΤΟΣ (πρότεινε slicing στο plan· μικρά, jest/verify ανά βήμα)
1. **Κουμπί «Ανάλυση»** στο `STRUCTURAL_REINFORCE_PANEL` (analyze-tab) → `organism.run-analysis` → emit `bim:run-structural-analysis`. (+ toast «Ανάλυση: N συνδυασμοί» στο `bim:analysis-solved`, reuse υπάρχον notification pattern.)
2. **Per-entity results readout**: section στα column/beam advanced panels με envelope N_Ed/V_Ed/M_Ed (+ ανά συνδυασμό, αν εύκολο) από `AnalysisResultsStore`. Read-only.
3. **Diagnostics surfacing**: `staticAnalysisUnstable` / `staticAnalysisMemberSkipped` → `EntityWarningsSection` (μέσω §1.3 approach A/B). Τα i18n keys `staticAnalysis.diagnostics.*` ΥΠΑΡΧΟΥΝ ήδη (el+en, ADR-481).
4. *(Προαιρετικά / επόμενο slice)* **Canvas diagram overlay** M/V/N κατά μήκος μελών (data έτοιμα στο `MemberForceResult.diagram`).

### ❌ ΕΚΤΟΣ (μην τα αγγίξεις)
- Ο engine του solver (`bim/structural/analytical/solver/*`) — **είναι το input σου, μην τον τροποποιήσεις** (πλην ίσως του `useProactiveStructuralAnalysis.ts` για το diagnostics wiring — με προσοχή).
- Σεισμός/μάζες/φάσμα (T4)· έλεγχοι EC8 (T5).
- Tributary path (ADR-467) — ζει ΠΑΡΑΛΛΗΛΑ, μην το σπάσεις. Τα M/V/N παραμένουν **πληροφοριακά** (δεν αντικαθιστούν το takedown στη διαστασιολόγηση — ξεχωριστή απόφαση).
- **ΜΗΝ επαναφέρεις kPa** (φορτία από `building.category`, ADR-474).

---

## 3. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — από CLAUDE.md)
- **Full Enterprise + Full SSoT, Revit-grade, GOL.** ≤40 γρ/function, ≤500 γρ/code-file, μηδέν `any`/`as any`/`@ts-ignore`. **Μηδέν hardcoded strings** (N.11 — i18n keys· τα `staticAnalysis.*` υπάρχουν, πρόσθεσε ribbon keys el+en).
- **N.3/N.4:** μηδέν inline styles, μηδέν div-soup (semantic HTML). **ADR-001:** Select = `@/components/ui/select`.
- **N.7.2 checklist** + δήλωση `✅/⚠️/❌ Google-level` στο τέλος.
- **ADR-driven (N.0.1):** PHASE 1 SSoT audit → plan. PHASE 3: **ADR-482** (new· UI surface του solver) + adr-index (2 πίνακες) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY, **ίδιο σύνολο**.
- **N.8 execution mode:** αξιολόγησε (πιθανώς Plan Mode — 4-8 αρχεία, 1-2 domains: ribbon+panels+store-read). Αν μεγαλώσει → ενημέρωσε Giorgio.
- **PLAN MODE υποχρεωτικό** — παρουσίασε plan, **περίμενε «προχώρα»** πριν κώδικα.
- **commit/push = Giorgio. tsc = Giorgio** (N.17 — έλεγξε ότι δεν τρέχει ήδη άλλος tsc· εσύ ΜΗΝ τρέξεις). **jest = τρέχει κανονικά.**
- **Shared tree:** git add **ΜΟΝΟ** τα δικά σου, ΠΟΤΕ `-A`.
- **Απάντα στα Ελληνικά πάντα.**

---

## 4. ΚΑΤΑΣΤΑΣΗ T3 (ADR-481 — μόλις ολοκληρώθηκε, UNCOMMITTED)
Static FEM solver: DONE, **13 jest GREEN** (+27 T2 GREEN), UNCOMMITTED — ο Giorgio θα κάνει commit. NEW `bim/structural/analytical/solver/*` (14 αρχεία) + `hooks/{structural-analysis-core, useProactiveStructuralAnalysis}.ts` + 2 events + 2 diagnostic codes + i18n `staticAnalysis.*`. Δες `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ADR-481) + MEMORY `project_adr481_static_fem_solver`.
**Μηδέν ορατή αλλαγή σήμερα** (γι' αυτό υπάρχεις). **Μην** πειράξεις τα solver/* (input σου).

## 5. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (Revit way)
Η Revit→Robot τρέχει την ανάλυση on-demand και επιστρέφει αποτελέσματα σε **results panel + diagrams**, ξεχωριστά από το physical model. Εμείς: κουμπί «Ανάλυση» → solver → `AnalysisResultsStore` → read-only readout στα panels + diagrams + diagnostics. Καθαρός διαχωρισμός engine (έτοιμος) ↔ presentation (η δουλειά σου). Μηδέν διπλότυπο: reuse ribbon/panel/diagnostics SSoT (§1).
