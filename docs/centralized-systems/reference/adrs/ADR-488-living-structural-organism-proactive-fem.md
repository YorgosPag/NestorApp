# ADR-488 — Ζωντανός Στατικός Οργανισμός: Proactive FEM επανα-επίλυση (engaged latch)

**Status:** ✅ Implemented (UNCOMMITTED 2026-06-18) — browser-verify pending
**Date:** 2026-06-18
**Σχετικά:** ADR-487 (ΟΡΑΜΑ §4) · ADR-481 (FEM solver) · ADR-482 (analysis UI surface) · ADR-483 (διαγράμματα M/V/N) · ADR-480 (analytical model) · ADR-486 (topology-aware beam support) · ADR-485 (utilization overlay)

---

## 1. Πρόβλημα (το κενό του ζωντανού οργανισμού)

Κάτοψη: 2 κολώνες + 1 δοκάρι → το διάγραμμα M/V/N σχεδιάστηκε ως **αμφιέρειστη παραβολή** (sagging). Ο μηχανικός **μετακίνησε/αποσύνδεσε** την αριστερή κολώνα → το δοκάρι έγινε **πρόβολος**. **Το διάγραμμα ΔΕΝ άλλαξε** — έμεινε στην παλιά αλήθεια.

**Ρίζα:** ο FEM solver (ADR-481) ήταν **dormant** — έτρεχε ΜΟΝΟ με το ρητό κουμπί «Ανάλυση» (`bim:run-structural-analysis`). Ο `useProactiveStructuralAnalysis` **δεν** άκουγε καμία geometry/topology μεταβολή → ο `AnalysisResultsStore` έμενε stale → ο reactive `StructuralDiagramOverlay` (ADR-483) ζωγράφιζε την παλιά καμπύλη.

**Αντίθεση:** το analytical model (ADR-480) **ΗΤΑΝ ήδη** proactive (ξαναχτίζεται στο `useStructuralOrganism` σε κάθε κίνηση), όπως και ο tributary οπλισμός (ADR-471/472/486). **Μόνο ο solver** δεν ακολουθούσε. Παραβίαση ADR-487 §3 («δεν επιτρέπεται να μείνει στην παλιά αλήθεια»).

## 2. Η αρχιτεκτονική ένταση: όραμα ↔ κόστος

Ο explicit trigger του ADR-481 ήταν **σκόπιμη απόφαση κόστους** — ο FEM (K·u=F, πυκνή LDLᵀ ανά συνδυασμό) είναι βαρύτερος από το tributary takedown. Πλήρως eager re-solve σε κάθε edit = σπατάλη για το 95% των χρηστών που ποτέ δεν ανοίγουν στατικά (ADR-487 §7: «Revit-grade πρακτικός», ΟΧΙ SAP).

## 3. Απόφαση: **engaged latch** (Revit «analytical results enabled»)

Proactive re-solve **μόνο όταν ο μηχανικός παρατηρεί στατικά**. ΕΝΑ SSoT predicate:

```
isAnalysisEngaged = analysisLive(latch) || showAnalysisDiagrams || showUtilization
```

- **`analysisLive`** — latch που οπλίζεται από το ρητό κουμπί «Ανάλυση» (state στο `analysis-diagram-view-store`, transient).
- **`showAnalysisDiagrams` / `showUtilization`** — τα ήδη υπάρχοντα results overlays (ADR-483/485).

**Γιατί (B∪C) κι όχι σκέτο A/C:**
- **ΟΧΙ (A) πλήρως proactive:** σπάει την απόφαση κόστους ADR-481· solver για χρήστες που δεν βλέπουν στατικά.
- **ΟΧΙ σκέτο (C) (μόνο diagram ορατό):** ο `AnalysisResultsStore` έχει **3** consumers — diagram, `useEntityAnalysisForces` (readout N/V/M), `StructuralUtilizationOverlay`. Gating μόνο στο diagram → stale readouts/utilization (κρυφό bug).
- **(B∪C):** ΕΝΑ predicate → **ομοιόμορφο** gating όλων των consumers (SSoT, μηδέν scattered gating). Engaged → πλήρως ζωντανός σε κάθε κίνηση (ADR-487 §4)· εκτός engaged → dormant, μηδέν κόστος (διατηρεί ADR-481).

## 4. Triggers — DERIVED events (όχι raw geometry)

Ο hook ακούει **παράγωγα** events (που εκπέμπονται **αφού** το μοντέλο/φορτία settle), ΟΧΙ raw geometry → μηδέν intra-tick ordering race μεταξύ proactive hooks:

| Event | Πηγή | Gate | Toast |
|---|---|---|---|
| `bim:run-structural-analysis` | ρητό κουμπί «Ανάλυση» | πάντα | **loud** |
| `bim:structural-organism-updated` | `useStructuralOrganism` (φρέσκια τοπολογία ADR-480) | engaged | silent |
| `bim:structural-loads-computed` | `useProactiveStructuralLoads` (φρέσκα φορτία) | engaged | silent |
| flip του engaged → true | view-store subscribe (π.χ. άναψε diagram μετά από move) | — | silent |

Coalesced ανά microtask (mirror `useProactiveStructuralLoads`), low-freq → **ADR-040 safe** (ο πυρήνας γράφει μόνο `AnalysisResultsStore`/`AnalysisDiagnosticsStore`· καμία αλλαγή σε canvas/overlay micro-leaf).

**Silent στο proactive:** το `bim:analysis-solved` φέρει `silent` flag → ο `useStructuralAnalysisNotification` κάνει toast ΜΟΝΟ στη ρητή «Ανάλυση» (μηδέν toast spam — mirror reinforce/loads background behaviour).

## 5. Αρχεία (NEW/MOD — δικά μου)

- **MOD** `state/analysis-diagram-view-store.ts` — +`analysisLive` latch + `setAnalysisLive` + pure **`isAnalysisEngaged`** (SSoT predicate) + `AnalysisEngagedState` τύπος.
- **MOD** `hooks/useProactiveStructuralAnalysis.ts` — από single explicit trigger → engaged-gated derived triggers + view-store flip subscribe + loud/silent.
- **MOD** `hooks/structural-analysis-core.ts` — `runStructuralAnalysis(input, { silent })` → `bim:analysis-solved` φέρει `silent`.
- **MOD** `hooks/useStructuralAnalysisNotification.tsx` — `if (silent) return` (no toast στο proactive).
- **MOD** `systems/events/drawing-event-map-bim.ts` — `bim:analysis-solved` +`silent?: boolean`.
- **MOD** `app/useDxfViewerCallbacks.ts` — `organism.run-analysis` οπλίζει το latch (`setAnalysisLive(true)`) πριν το emit.
- **NEW** `state/__tests__/analysis-diagram-view-store.test.ts` — 5 jest (predicate matrix).

## 6. Επαλήθευση (ΟΡΑΜΑ §4 + ADR-486 parity)

2 κολώνες + δοκάρι (engaged: άναψε διάγραμμα ή «Ανάλυση») → μετακίνησε/αποσύνδεσε τη μία κολώνα → το διάγραμμα **αμέσως** γίνεται πρόβολος (hogging στην πάκτωση, μηδέν στο ελεύθερο άκρο) + αλλάζουν τα N/V/M readouts + (0 στηρίξεις) διαγνωστικό αστάθειας. **Συμφωνεί** με τον topology-aware οπλισμό (ADR-486).

## 7. Boy-scout (DEFER — N.0.2)

Οι 4 proactive hooks (`*Loads`/`*Reinforce`/`*MemberSizing`/`Organism`) έχουν σχεδόν ίδιες **raw** geometry event-lists (διαφέρουν σε loop-guards). Ο νέος hook χρησιμοποιεί DERIVED events → δεν τις μοιράζεται. Η εξαγωγή κοινής `STRUCTURAL_GEOMETRY_EVENTS` const → `pending-ratchet-work.md` (4-file refactor, on-touch).

## 8. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-18 | **Δημιουργία + υλοποίηση.** Engaged latch (B∪C) → proactive FEM re-solve σε κάθε κίνηση όταν ο μηχανικός παρατηρεί στατικά· derived triggers· silent proactive· 5 jest GREEN. UNCOMMITTED. |
