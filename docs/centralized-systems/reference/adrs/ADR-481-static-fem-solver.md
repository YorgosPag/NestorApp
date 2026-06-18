# ADR-481 — Static Linear FEM Solver (T3 — 3D space-frame K·u=F → πραγματικά M/V/N)

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-480 (analytical model — το INPUT), ADR-459 (organism graph), ADR-467 (tributary takedown — ζει ΠΑΡΑΛΛΗΛΑ), ADR-464/472/475 (loads/reinforce/sizing — downstream consumers των M/V/N), ADR-456 (concrete grades — E_cm), ADR-477 (seismic-params — T4 hook), ADR-040 (low-freq store writes).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.
**Roadmap:** Tier 3 (T3) του gap analysis στατικής μελέτης (`HANDOFFS/HANDOFF_2026-06-18_GAP-ANALYSIS_static-study-vs-app.md` §3.A/§4 + `HANDOFFS/HANDOFF_2026-06-18_T3_fem-solver.md`). Καταναλώνει το ADR-480 (T2). Θεμέλιο για T4 (φασματική σεισμική EC8), T5 (έλεγχοι).

---

## 1. Context — γιατί

Το T2 (ADR-480) έφτιαξε τον DERIVED **αναλυτικό φορέα** (κόμβοι/μέλη/στηρίξεις/διάφραγμα/load-cases) — καθαρό data layer **χωρίς solver**. Όλη η διαστασιολόγηση μέχρι τώρα τρέφεται από **tributary takedown** (gravity-only, αξονικά από εμβαδά ευθύνης, ADR-467) — **ΟΧΙ** από επίλυση πλαισίου· δεν υπάρχουν πραγματικά εντατικά μεγέθη (M/V/N από ανάλυση) ούτε διαγράμματα.

Το επαγγελματικό τεύχος απαιτεί 3D space-frame ανάλυση με μητρώα Κόμβων/Μελών/Φορτίων/**Εντατικών Μεγεθών** + διαγράμματα. Η Revit κάνει export το analytical model σε εξωτερικό solver (Robot). **Απόφαση (εγκεκριμένη από Giorgio):** γράφουμε **δικό μας** στατικό FEM solver (3D frame direct-stiffness) πάνω στο analytical model SSoT — πιο integrated/Revit-grade από export, standard & well-bounded math.

## 2. Decision — δικός μας pure FEM solver, in-house γραμμική άλγεβρα, explicit trigger

- **Δικός μας solver** vs export (OpenSees/ASCII): δικός μας → μηδέν εξωτερική διεργασία/εξάρτηση, πλήρως testable, integrated.
- **In-house γραμμική άλγεβρα** vs npm (ml-matrix BSD): in-house dense LDLᵀ → **μηδέν dependency, μηδέν license check (N.5 N/A)**. Τα frame συστήματα είναι μικρά πυκνά (6·κόμβοι DOF).
- **Explicit «Ανάλυση» trigger** (`bim:run-structural-analysis`) — ΟΧΙ eager σε κάθε edit (ο solver είναι βαρύτερος από το takedown). ADR-040 safe.
- **Διάφραγμα = penalty method** (v1): απλό/robust, διατηρεί συμμετρία· master-slave condensation = μελλοντική βελτίωση για T4.
- **Ζει ΠΑΡΑΛΛΗΛΑ με tributary (ADR-467)** — τα M/V/N αρχικά **πληροφοριακά/diagnostics**· η σύνδεσή τους στη διαστασιολόγηση (αντικατάσταση takedown) = ξεχωριστή μελλοντική απόφαση.

**ΟΧΙ στο T3:** σεισμός/μάζες/ιδιομορφές/φάσμα EC8/CQC (T4)· έλεγχοι θ/drift/ικανοτική (T5)· P-Δ second-order (DEFER)· Winkler θεμελίωσης (T6). Σχεδιασμένο extensible: ο solver δέχεται **οποιουσδήποτε** `LoadCombination` (incl. σεισμικούς από `buildLoadCombinations({seismic})` ADR-480) ομοιόμορφα → T4 χωρίς αναδόμηση.

## 3. Σύστημα μονάδων (SSoT)

Μήκη **m**, δυνάμεις **kN**, ροπές **kNm**, στροφές **rad**. E από `CONCRETE_GRADES.ecmGpa` × 10⁶ (GPa→kN/m²). A σε m², I/J σε m⁴ (διαστάσεις διατομής mm→m). DOF ανά κόμβο: `[u_x, u_y, u_z, θ_x, θ_y, θ_z]`.

## 4. Αρχιτεκτονική — NEW φάκελος `bim/structural/analytical/solver/` (pure)

- **`dense-matrix.ts`** — πυκνό μητρώο/διάνυσμα + `scatterAdd`/`scatterAddVector` (assembly), `matMul`/`transpose` (μετασχηματισμός), `matVec`/`gatherVector`, `maxAbsDiagonal`.
- **`cholesky-solve.ts`** — `solveSymmetric(K,F)` μέσω **LDLᵀ** με ανίχνευση μηδενικού pivot → `singular` (μηχανισμός, χωρίς √αρνητικού). `PIVOT_REL_TOL=1e-12`.
- **`member-section-properties.ts`** — `resolveMemberSectionProperties(member, entity)` → `{E,G,A,Iy,Iz,J}` (kN,m). **Reuse** `concrete-grades` (E) + `section-context` (διαστάσεις, N.0.2). I=b·h³/12· J=St.Venant ορθογ. (Roark)· G=E/(2(1+ν)), ν=0.2. Μη-ορθογ. → bbox approx (v1).
- **`frame-element-stiffness.ts`** — τοπικό 12×12 (αξονικό+στρέψη+2 κάμψεις, Euler-Bernoulli) + ορθοκανονικός τριάδος αξόνων (κατακόρυφο μέλος → ref global-X, αλλιώς global-Z) → `kGlobal = Tᵀ·k_local·T`. `DOF_PER_NODE=6`.
- **`dof-map.ts`** — κόμβος→6 DOF· `elementDofs`· `restrainedDofs` (από `RestraintDof`)· `restrainMatrix`/`restrainVector` (μηδενική προδιαγεγραμμένη μετακίνηση — γραμμή/στήλη 0, διαγώνιο 1· διατηρεί SPD).
- **`diaphragm-constraints.ts`** — `applyDiaphragmPenalty`: εντός-επιπέδου ακαμψία (3 εξισώσεις/slave: u_x, u_y, rz ως προς master) μέσω **penalty** (`PENALTY_FACTOR=1e6` × maxDiag).
- **`global-assembly.ts`** — `assembleGlobalStiffness(model, sectionProvider)` → K (με penalty+BC) + cache στοιχείων + `skippedMemberIds`. K **κοινό** σε όλους τους συνδυασμούς.
- **`load-vector.ts`** — `buildLoadVector(elements, combination, loadProvider, …)` ανά συνδυασμό. **Πηγή φορτίου v1 = ΜΟΝΟ δοκάρια**: το tributary total (`combine().axialKn`) → γραμμικό q=W/L (ίδια smear λογική με `section-context`, N.0.2) στη βαρύτητα (−Z) → consistent κομβικά φορτία. **Η αξονική κολόνας προκύπτει από το πλαίσιο** (αλλιώς διπλομέτρηση). `elementLocalLoad` = SSoT τοπικού Pₑ (μοιράζεται με post-process).
- **`member-end-forces.ts`** — `Q_local = k_local·(T·u) − Pₑ,local` (ο όρος −Pₑ προσθέτει fixed-end forces).
- **`member-diagrams.ts`** — δειγματοληψία N/Vy/Vz/T/My/Mz κατά μήκος (9 σταθμές default) από i-end + UDL· `diagramExtrema` (max-abs, σύμβαση-ανεξάρτητα).
- **`solver-types.ts`** — `NodeDisplacement`/`DiagramStation`/`MemberForceExtrema`/`MemberForceResult`/`CombinationResult`/`AnalysisResult` (+ envelope ανά μέλος) + `EMPTY_ANALYSIS_RESULT`.
- **`frame-solver.ts`** — `solveStaticFrame({model, sectionProvider, loadProvider, combinations})` orchestrator: assemble (μία φορά) → ανά συνδυασμό build F + solve + post-process → envelope (max-abs). Pure (injected providers → jest-clean).
- **`analysis-results-store.ts`** — external store (mirror `AnalyticalModelStore`) — κρατά το τελευταίο `AnalysisResult` για consumers (ADR-472/475, T5, render).
- **`analysis-diagnostics.ts`** — `runAnalysisDiagnostics(result, memberIds)` → `staticAnalysisUnstable` (μηχανισμός) / `staticAnalysisMemberSkipped` (warning). `StructuralDiagnostic[]` (ADR-459 τύπος).

### Proactive wiring (explicit trigger)
- **`hooks/structural-analysis-core.ts`** — `runStructuralAnalysis({entities, model})`: στήνει providers (διατομή από entity· φορτίο από δοκάρι `appliedLoad`) → `solveStaticFrame` → γράφει `AnalysisResultsStore` → emit `bim:analysis-solved` → επιστρέφει result+diagnostics. Light module (mirror `structural-analytical-core` T2, jest-clean).
- **`hooks/useProactiveStructuralAnalysis.ts`** — ακούει `bim:run-structural-analysis` (coalesced microtask), διαβάζει `AnalyticalModelStore.get()` + entities ενεργού ορόφου → καλεί τον core. Mounted στο `DxfViewerContent` δίπλα στο `useStructuralOrganism`.

### Events (NEW στο `drawing-event-map-bim.ts`)
- `bim:run-structural-analysis` (explicit trigger, on-demand) · `bim:analysis-solved` (`{combinationCount, unstable}`).

### Reuse (μηδέν διπλότυπο — N.0.2)
- E_cm: `concrete-grades.ts` (ADR-456). Διαστάσεις διατομής: `section-context.ts`. Συνδυασμοί: `load-cases.ts`/`load-combinations.ts` (ADR-480/464). Φορτίο: `resolveAppliedMemberLoad` (ADR-464). Diagnostic τύπος: ADR-459. Store pattern: `AnalyticalModelStore` (ADR-480).

## 5. Validation (jest, 13 tests GREEN)
Έναντι **γνωστών αναλυτικών λύσεων**: αμφιέρειστη δοκός UDL → M_mid=wL²/8, V_max=wL/2· πρόβολος UDL → M_base=wL²/2, V_base=wL, βέλος=wL⁴/8EI (επικυρώνει χρήση EI)· φορέας χωρίς στήριξη → singular K· LDLᵀ σε γνωστό SPD· skipped-member path· diagnostics· store roundtrip. (+27 γειτονικά T2 GREEN, μηδέν regression.)

## 6. Όρια / DEFER
- Πηγή φορτίου v1 = μόνο δοκάρια (UDL)· point loads/self-weight κολόνας/slab-to-beam distribution = μελλοντικό slice.
- Μη-ορθογωνικές διατομές → bbox approx (κυκλική/τοίχωμα ακριβές I = μελλοντικό).
- Render διαγραμμάτων M/V/N (data έτοιμα) = ξεχωριστό slice / T7.
- **UI κουμπί «Ανάλυση»** που εκπέμπει `bim:run-structural-analysis` = μικρό follow-up (ο engine + hook + store είναι έτοιμα· ο hook είναι dormant μέχρι να υπάρξει ο emitter).
- Master-slave διάφραγμα (αντί penalty) + P-Δ = T4/μελλοντικά.

## 7. Google-level (N.7.2)
✅ Proactive (explicit trigger, lifecycle owner = `useProactiveStructuralAnalysis`)· ✅ idempotent (re-solve = ίδιο)· ✅ μηδέν race (coalesced microtask, single store writer)· ✅ SSoT (results store, reuse E/section/combinations)· ✅ await (sync solve)· ✅ ADR-040 safe (low-freq).

---

## Changelog
- **2026-06-18 (Opus, UNCOMMITTED):** Δημιουργία T3. NEW `bim/structural/analytical/solver/*` (13 αρχεία: dense-matrix, cholesky-solve, member-section-properties, frame-element-stiffness, dof-map, diaphragm-constraints, global-assembly, load-vector, member-end-forces, member-diagrams, solver-types, frame-solver, analysis-results-store, analysis-diagnostics) + `hooks/structural-analysis-core.ts` + `hooks/useProactiveStructuralAnalysis.ts` (mounted). Additive: `StructuralDiagnosticCode` += `staticAnalysisUnstable`/`staticAnalysisMemberSkipped`· 2 events· i18n `staticAnalysis.diagnostics.*` (el+en). 13 jest GREEN. 🔴 tsc(Giorgio)+browser-verify+commit.
- **2026-06-18 (Opus, UNCOMMITTED) — BUGFIX false-singular (εντοπίστηκε μέσω ADR-482 T3-UI):** Στηριγμένο portal (2 κολόνες πακτωμένες + δοκάρι + **άκαμπτο διάφραγμα**) αναφερόταν λανθασμένα ως «μηχανισμός». **Ρίζα:** το κατώφλι μηδενικού pivot στο `solveSymmetric` ήταν σχετικό προς το `maxAbsDiagonal(k)` **μετά** το penalty διαφράγματος (~1e6× → ~9e11) → `tol≈0.9` «έκοβε» γνήσια μικρά pivots ⇒ false-singular. Τα 13 αρχικά jest κάλυπταν μόνο **μεμονωμένα** μέλη (πρόβολος/αμφιέρειστη) + σκόπιμα-ασταθή — ΠΟΤΕ συνδεδεμένο πλαίσιο με διάφραγμα. **Fix (root-cause, χειρουργικός):** `global-assembly` καταγράφει τη **φυσική** κλίμακα ακαμψίας (`maxAbsDiagonal` ΠΡΙΝ το penalty) → `AssembledStiffness.physicalStiffnessScale`· ο `frame-solver` την περνά στο `solveSymmetric(k, f, stiffnessScale?)` (νέα προαιρετική παράμετρος, default=legacy) ώστε η ανίχνευση μηχανισμού να είναι **ανεξάρτητη** του penalty inflation. Το διάφραγμα μένει **πλήρως άκαμπτο** (PENALTY_FACTOR=1e6 αμετάβλητο — σωστό για σεισμό T4). MOD `cholesky-solve.ts`/`global-assembly.ts`/`frame-solver.ts`. NEW regression στο `frame-solver.test.ts` (portal+διάφραγμα → ΟΧΙ singular· penalty δεν αλλοιώνει ροπή δοκαριού <1% vs χωρίς διάφραγμα). 16 jest GREEN (13+1 group/2). Επικύρωση ακρίβειας: M_uls δοκαριού WITH-dia 21.63 vs NO-dia 21.60 (0.14%).
