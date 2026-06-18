# ADR-482 — Static Analysis UI Surface (T3-UI — κουμπί «Ανάλυση» + M/V/N readout + diagnostics)

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-481 (static FEM solver — το INPUT, engine), ADR-480 (analytical model), ADR-459 (organism diagnostics store + EntityWarningsSection), ADR-345 (ribbon action routing), ADR-467 (tributary takedown — ζει ΠΑΡΑΛΛΗΛΑ), ADR-040 (low-freq store reads).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.
**Roadmap:** «Δρόμος Α» — κάνει τον αόρατο T3 engine (ADR-481) **ορατό & επαληθεύσιμο** ΠΡΙΝ χτιστεί ο σεισμός (T4). Πηγή: `HANDOFFS/HANDOFF_2026-06-18_T3-UI_analysis-results-surface.md`.

---

## 1. Context — γιατί

Το ADR-481 (T3) έφτιαξε πλήρη στατικό FEM solver (3D space-frame K·u=F → πραγματικά M/V/N + διαγράμματα + envelope, 13 jest GREEN) **αλλά εντελώς αόρατο**: κανένα κουμπί δεν τον έτρεχε, κανένα UI δεν έδειχνε αποτελέσματα, τα diagnostics δεν εμφανίζονταν. Ο `useProactiveStructuralAnalysis` ήταν mounted αλλά **dormant** (άκουγε event που κανείς δεν εξέπεμπε). Όπως Revit→Robot: engine έτοιμος, λείπει το presentation layer.

## 2. Decision — καθαρός διαχωρισμός engine ↔ presentation, μηδέν διπλότυπο

Presentation slice πάνω στον έτοιμο engine, με **reuse** όλων των υπαρχόντων SSoT (ribbon/panel/diagnostics/notification patterns). Ο engine (`bim/structural/analytical/solver/*`) **δεν τροποποιήθηκε** — μόνο καταναλώνεται read-only μέσω του `AnalysisResultsStore`.

**Ροή:** κουμπί «Ανάλυση» → `wrappedHandleAction('organism.run-analysis')` → `EventBus.emit('bim:run-structural-analysis')` → ο dormant hook ξυπνά → `runStructuralAnalysis` → γράφει `AnalysisResultsStore` + emit `bim:analysis-solved` → **το UI διαβάζει το store** (readout + toast + diagnostics).

## 3. Αρχιτεκτονική — 3 slices

### Slice 1 — Κουμπί «Ανάλυση» + toast (ορατό trigger)
- **`ui/ribbon/data/analyze-tab.ts`**: +button `organism.run-analysis` (icon `struct-run-analysis`) στο `STRUCTURAL_REINFORCE_PANEL`, πρώτο (η ανάλυση προηγείται οπλισμού/φορτίων). Mirror του `analyze.compute-loads` (ADR-345).
- **`ui/ribbon/components/buttons/RibbonButtonIcon.tsx`**: +case `struct-run-analysis` → lucide `Activity` (ήδη imported).
- **`app/useDxfViewerCallbacks.ts`**: +branch `if (action === 'organism.run-analysis') EventBus.emit('bim:run-structural-analysis', {})`.
- **NEW `hooks/useStructuralAnalysisNotification.tsx`**: ακούει `bim:analysis-solved` → `toast.success` (πλήθος συνδυασμών) / `toast.warning` (μηχανισμός). Mirror toast pattern του `useStructuralOrganismNotification`. Mounted στο `DxfViewerContent`.

### Slice 2 — Per-entity M/V/N readout (δες αποτελέσματα)
- **NEW `ui/structural-analysis/useEntityAnalysisForces.ts`**: `useSyncExternalStore` reader → `MemberForceExtrema | null` από `AnalysisResultsStore.envelopeByMember.get(entityId)` (memberId===entityId, 1:1 ADR-480). Low-freq → ADR-040 safe· σταθερή αναφορά → μηδέν re-render loop.
- **NEW `ui/structural-analysis/AnalysisForcesSection.tsx`**: read-only `<section>` (mirror `EntityWarningsSection`) — N_Ed/V_Ed/M_Ed/T_Ed envelope. ΕΝΑ component για κολόνα+δοκάρι. Null όταν δεν έχει τρέξει ανάλυση.
- **Mount**: `ColumnAdvancedPanel` + `BeamAdvancedPanel` (μετά το `EntityWarningsSection`).

### Slice 3 — Diagnostics surfacing (μηχανισμός / παραλειπόμενο μέλος)
- **NEW `bim/structural/organism/diagnostics-index.ts`** (Boy-Scout N.0.2): εξαγωγή του `indexByEntity` από τον `StructuralDiagnosticsStore` → κοινός `indexDiagnosticsByEntity`, μοιράζεται 2 stores.
- **NEW `bim/structural/analytical/analysis-diagnostics-store.ts`**: mirror του organism store (χρησιμοποιεί τον helper). **Ξεχωριστός store** ώστε ο single-writer invariant του organism store (= `useStructuralOrganism`, ADR-040/459) να μένει ανέπαφος. Single-writer εδώ = `useProactiveStructuralAnalysis`.
- **`hooks/useProactiveStructuralAnalysis.ts`** (το μόνο engine-side αρχείο που αγγίχθηκε — με προσοχή): γράφει τα `diagnostics` που **ήδη επέστρεφε** ο `runStructuralAnalysis` στον νέο store.
- **NEW `ui/structural-analysis/useEntityAnalysisDiagnostics.ts`**: reader (mirror `useEntityStructuralDiagnostics`).
- **`ui/structural-warnings/EntityWarningsSection.tsx`**: **reader-side union** (`useMemo` concat των δύο πηγών· σταθερά refs → μηδέν loop). ΕΝΑ warnings panel, δύο πηγές.

## 4. Reuse (μηδέν διπλότυπο — N.0.2)
Ribbon: `STRUCTURAL_REINFORCE_PANEL` + `wrappedHandleAction` (ADR-345). Events: `bim:run-structural-analysis`/`bim:analysis-solved` (ήδη ορισμένα, ADR-481). Engine: `AnalysisResultsStore`/`MemberForceExtrema`/`runStructuralAnalysis`/`runAnalysisDiagnostics` (read-only). Toast: sonner+i18n pattern. Diagnostics surfacing: `EntityWarningsSection`/`StructuralDiagnostic` τύπος. i18n `staticAnalysis.diagnostics.*` (ήδη el+en). Indexer: εξαχθείς κοινός helper.

## 5. i18n (N.11 — el+en)
NEW: `ribbon.commands.runStructuralAnalysis` + `ribbon.tooltips.runStructuralAnalysis`· `staticAnalysis.solved` (ICU plural συνδυασμών) / `staticAnalysis.solvedUnstable`· `staticAnalysis.forces.{title,axial,shear,moment,torsion,empty}` (ICU `{value}` + μονάδα kN/kNm στο literal value).

## 6. Validation (jest)
NEW `bim/structural/analytical/__tests__/analysis-diagnostics-store.test.ts` — **7 GREEN**: shared indexer (1→N entityIds, σώρευση, κενό) + store (set/getForEntity/getAll, σταθερή κενή αναφορά, set([]) clear, subscribe/unsubscribe). +122 γειτονικά analytical/solver/organism GREEN (μηδέν regression από το organism-store refactor). (1 pre-existing raft/slab failure = shared tree ADR-476, **όχι** δικό μου.)

## 7. Όρια / DEFER
- **Canvas diagram overlay** M/V/N κατά μήκος μελών (data έτοιμα στο `MemberForceResult.diagram`) = ξεχωριστό βαρύτερο slice (Slice 4 / T7).
- Per-combination readout (μόνο envelope τώρα — Revit headline).
- Foundation/slab readout (κολόνα+δοκάρι πρώτα).
- Τα M/V/N παραμένουν **πληροφοριακά** — δεν αντικαθιστούν το tributary takedown (ADR-467) στη διαστασιολόγηση (ξεχωριστή απόφαση). Σεισμός T4 / έλεγχοι T5 εκτός.

## 8. Google-level (N.7.2)
✅ Proactive (lifecycle owner = proactive hook + notification hook)· ✅ idempotent (re-solve/re-render = ίδιο)· ✅ μηδέν race (low-freq stores, single writer ανά store, reader-side union με σταθερά refs)· ✅ SSoT (reuse ribbon/panel/diagnostics/notification· κοινός indexer)· ✅ read-only presentation (μηδέν mutation engine)· ✅ ADR-040 safe (low-freq subscriptions, μηδέν canvas leaf). ≤40γρ/fn, ≤500γρ/file, μηδέν any/hardcoded/inline-style/div-soup, Select N/A.

---

## Changelog
- **2026-06-18 (Opus, UNCOMMITTED):** Δημιουργία T3-UI. Slice 1 (ribbon button «Ανάλυση» + action routing + `useStructuralAnalysisNotification` toast + icon `struct-run-analysis` + i18n)· Slice 2 (`useEntityAnalysisForces` + `AnalysisForcesSection` read-only readout στα column/beam panels + i18n forces)· Slice 3 (κοινός `diagnostics-index` [Boy-Scout] + `AnalysisDiagnosticsStore` + writer στο proactive hook + `useEntityAnalysisDiagnostics` + reader-side union στο `EntityWarningsSection`). 7 jest GREEN + 122 γειτονικά. 🔴 tsc(Giorgio)+browser-verify+commit (git add ΜΟΝΟ δικά μου).
