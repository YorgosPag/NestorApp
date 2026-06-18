# HANDOFF — T3: Static FEM Solver (3D space-frame, K·u=F → πραγματικά M/V/N)

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε T2/ADR-480 Analytical Model) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST — μεγάλο, math-heavy, cross-cutting. **ΜΗΝ γράψεις κώδικα πριν εγκριθεί το plan.**
**Roadmap:** Tier 3 του gap analysis στατικής μελέτης. Πηγές (αυτοτελείς):
`HANDOFFS/HANDOFF_2026-06-18_GAP-ANALYSIS_static-study-vs-app.md` (§3.A, §4 T3) +
`docs/centralized-systems/reference/adrs/ADR-480-analytical-model-ssot.md` (το θεμέλιο που καταναλώνεις).

> ⚠️ **Shared working tree** με άλλους agents (ADR-479 presets, ADR-471/476). **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A.**
> **commit/push = Giorgio** (όχι εσύ). **tsc = Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέχει κανονικά.**
> **Επόμενο ελεύθερο ADR = 481** (479=presets, 480=analytical model). **Γλώσσα: Ελληνικά πάντα.**

---

## 0. TL;DR — τι είναι το T3 και γιατί

Σήμερα όλη η διαστασιολόγηση τρέφεται από **tributary takedown** (gravity-only, FEM-free, ADR-467):
αξονικά φορτία από εμβαδά ευθύνης — **ΟΧΙ** από επίλυση πλαισίου. Δεν υπάρχουν πραγματικά εντατικά
μεγέθη (M/V/N από ανάλυση), ούτε διαγράμματα.

Το **T2 (ADR-480)** έφτιαξε το **Analytical Model** (κόμβοι/μέλη/στηρίξεις/διάφραγμα/load-cases) —
καθαρό data layer, **χωρίς solver**. Το **T3 = ο solver**: παίρνει το analytical model, στήνει το
μητρώο δυσκαμψίας, επιλύει **K·u=F** για κάθε συνδυασμό, και παράγει **πραγματικά εντατικά μεγέθη
M/V/N ανά μέλος + διαγράμματα**. Αυτό είναι το «3D χωρικό πλαίσιο» του εγκεκριμένου τεύχους (gap #1, #5).

**ΟΧΙ στο T3:** σεισμός/μάζες/ιδιομορφές/φάσμα EC8/CQC (=T4)· έλεγχοι θ/drift/ικανοτική (=T5).
Το T3 είναι **στατική γραμμική ανάλυση** (G/Q συνδυασμοί). Σχεδίασέ το ώστε το T4 να προσθέσει
σεισμικά load-cases + δυναμική χωρίς αναδόμηση.

### Η αρχή σχεδίασης (Revit way)
Η Revit κάνει export το analytical model στο **Robot** (solver). Εμείς γράφουμε **δικό μας** στατικό
FEM solver ΠΑΝΩ στο analytical model SSoT — **ξεχωριστό module**, pure, testable, μηδέν side-effects
στο physical BIM. Στο plan **αξιολόγησε** ρητά: δικός μας solver vs export σε open solver (OpenSees/
ASCII) — και πρότεινε με τεκμηρίωση (ο δικός μας solver είναι πιο integrated/Revit-grade αλλά μεγαλύτερη
επένδυση· πιθανώς ξεκινάμε με δικό μας 3D frame direct-stiffness, που είναι standard & well-bounded).

---

## 1. 🔴 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSOT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΟΤΙΔΗΠΟΤΕ

**Εντολή Giorgio: πραγματικό SSoT audit για να ΜΗΝ φτιάξεις διπλότυπα.** Κάνε ΟΛΑ τα παρακάτω greps
και **διάβασε** ό,τι βρεις, ΠΡΙΝ το plan. Παραδοτέο στο plan: πίνακας «τι υπάρχει ήδη → reuse» vs
«τι λείπει → νέο SSoT».

### 1.1 Υπάρχει ήδη solver / matrix / linear-algebra;
```
grep -rni "solver\|stiffness\|matrix\|gauss\|cholesky\|LU\|linsolve\|K·u\|Ku=F\|assemble\|dof\|degreesOfFreedom\|frameElement\|elementStiffness" src/subapps/dxf-viewer/bim/structural
grep -rni "matrix\|linearAlgebra\|mathjs\|ml-matrix\|numeric\|eig\|invert" src/subapps/dxf-viewer  package.json
```
→ Αναμένεται: ΔΕΝ υπάρχει solver. **ΕΠΙΒΕΒΑΙΩΣΕ.** Έλεγξε αν υπάρχει ήδη math/matrix dependency στο
   `package.json` (π.χ. `ml-matrix`, `mathjs`) — αν ναι & MIT/BSD/Apache → reuse· αν όχι → στο plan
   πρότεινε (license check N.5 ΥΠΟΧΡΕΩΤΙΚΟΣ· ή γράψε μικρό in-house dense solver — 3D frame είναι μικρά
   συστήματα). **ΜΗΝ** εγκαταστήσεις πακέτο χωρίς έγκριση Giorgio.

### 1.2 Το Analytical Model (T2 — ΤΟ INPUT ΣΟΥ) — ΔΙΑΒΑΣΕ ΤΟ ΠΛΗΡΩΣ
```
src/subapps/dxf-viewer/bim/structural/analytical/analytical-model-types.ts   ← AnalyticalNode/Member/Support/RigidDiaphragm/Level/Model + RestraintDof (6-DOF)
src/subapps/dxf-viewer/bim/structural/analytical/analytical-model-builder.ts ← buildAnalyticalModel({entities, graph, getOffset?})
src/subapps/dxf-viewer/bim/structural/analytical/analytical-model-store.ts   ← AnalyticalModelStore (get/set/subscribe) — το έτοιμο μοντέλο
src/subapps/dxf-viewer/bim/structural/analytical/load-cases.ts               ← buildLoadCombinations({factors?, seismic?}) + LoadCombination.combine(MemberLoad)→CombinedLoad
src/subapps/dxf-viewer/bim/structural/analytical/analytical-diagnostics.ts   ← ευστάθεια (μηχανισμός) — προκαταρκτικά· T3 = πλήρης έλεγχος
```
- **Κόμβοι** έχουν θέση σε **μέτρα** (xM/yM/zM) + `RestraintDof` (dx/dy/dz/rx/ry/rz booleans) + levelId.
- **Μέλη** (`memberType` column/beam) έχουν iNodeId/jNodeId + `entityId` (FK→physical, = section/material ref)
  + `lengthM`. Section/material properties **δεν** είναι στο μοντέλο — διάβασέ τα από το physical entity
  μέσω entityId (E, A, I, διατομή).
- **Στηρίξεις** = `fixed`/`pinned` σε κόμβους (πεδίλα). **Διάφραγμα** = nodeIds ανά στάθμη (rigid, in-plane).
- **Load-cases/combinations**: το `load-cases.ts` δίνει `combine(MemberLoad)→CombinedLoad` ανά συνδυασμό
  (ULS 1.35G+1.5Q, SLS). Το **φορτίο κάθε μέλους** είναι το `appliedLoad` (AppliedMemberLoad, G/Q kN) —
  βλ. §1.3.

### 1.3 Φορτία μελών (το F του K·u=F) — υπάρχουν ήδη
```
src/subapps/dxf-viewer/bim/structural/loads/structural-loads-types.ts   ← AppliedMemberLoad/MemberLoad (G/Q αξονικά+ροπές)
src/subapps/dxf-viewer/bim/structural/loads/load-combinations.ts        ← EN1990 ULS/SLS (combineUls/combineSls) — reuse μέσω load-cases.ts
src/subapps/dxf-viewer/bim/structural/loads/load-path-takedown.ts       ← πώς γεμίζει σήμερα το appliedLoad (tributary)
src/subapps/dxf-viewer/bim/structural/section-context.ts                ← resolveBeamDesignLoad: πώς το αξονικό smear-άρεται σε UDL/M_Ed σήμερα
```
- ⚠️ ΚΡΙΣΙΜΟ: σήμερα το φορτίο μέλους είναι **ισοδύναμο αξονικό kN** (tributary). Ο solver θέλει
  **κατανεμημένα/κομβικά φορτία** (UDL δοκών, κατακόρυφα κόμβων). Στο plan όρισε **πώς** μετατρέπεις
  το `appliedLoad` σε load vector F (member loads → fixed-end forces → κομβικά). Reuse τη λογική
  smear του `section-context.ts` (w_Ed = W/L) — μην εφεύρεις νέα.

### 1.4 Διατομές/υλικά (E, A, I) — για το element stiffness
```
grep -rni "elasticModulus\|youngModulus\|\bE_cm\|Ecm\|inertia\|momentOfInertia\|sectionModulus\|crossSection\|grossArea" src/subapps/dxf-viewer/bim/structural
src/subapps/dxf-viewer/bim/structural/section-context.ts        ← buildColumnSectionContext / beam section (area, διαστάσεις)
src/subapps/dxf-viewer/bim/structural/concrete-grades.ts        ← κατηγορίες σκυρ. (E_cm; αν λείπει → πρόσθεσε SSoT εκεί)
```
- Element stiffness 3D frame χρειάζεται: E (από concrete grade), A & I (από διατομή), L (από analytical
  member.lengthM). Βρες πού ζουν· αν λείπει το E_cm → centralize στο `concrete-grades.ts` (μην hardcode).

### 1.5 Proactive chain (πώς (επανα)τρέχει ο solver) — reuse pattern, ΜΗΝ εφεύρεις scheduler
```
src/subapps/dxf-viewer/hooks/structural-analytical-core.ts      ← runStructuralAnalyticalModel (T2) — το πρότυπο πυρήνα
src/subapps/dxf-viewer/hooks/useStructuralOrganism.ts           ← single low-freq writer (graph+model+diagnostics σε ΕΝΑ pass)
src/subapps/dxf-viewer/hooks/structural-load-takedown-core.ts   ← light-module pattern (injected settings, jest-clean)
grep -rn "bim:analytical-model-built\|AnalyticalModelStore\|bim:structural-loads-computed" src/subapps/dxf-viewer
```
- Το T2 ήδη emit-άρει `bim:analytical-model-built` + γράφει `AnalyticalModelStore`. Ο solver T3 είναι
  φυσικός **consumer**: τρέχει όταν αλλάζει το μοντέλο/φορτία. Αποθήκευσε αποτελέσματα σε νέο store
  (mirror `AnalyticalModelStore`) — π.χ. `AnalysisResultsStore` (M/V/N ανά μέλος/συνδυασμό).
- **ΠΡΟΣΟΧΗ κόστος:** ο solver είναι πιο βαρύς από το takedown. Σκέψου debounce/μεγαλύτερο coalescing
  και ίσως **explicit trigger** («Ανάλυση») αντί για eager σε κάθε edit. Πρότεινε στο plan (ADR-040 safe).

### 1.6 ADR landscape (μην διπλασιάσεις concepts)
Index: `docs/centralized-systems/reference/adr-index.md`. Κρίσιμα: **ADR-480 (analytical model — INPUT)**,
ADR-459 (organism graph), ADR-467 (tributary — ΜΗΝ το σπάσεις, ζει παράλληλα), ADR-464/472/475
(loads/reinforce/sizing — οι downstream consumers των M/V/N), ADR-477 (seismic-params — T4 hook),
ADR-456 (concrete grades/codes).

**Παραδοτέο audit (γράψε στο plan):** πίνακας reuse vs new. Αν βρεις duplicate → N.0.2 Boy Scout.

---

## 2. ΣΤΟΧΟΣ T3 (scope — τι ΝΑΙ / τι ΟΧΙ)

### ✅ ΕΝΤΟΣ T3 (Static linear FEM solver — pure)
1. **Element stiffness** 3D frame member (12×12 local: axial+2 bending+torsion) από E/A/I/L + transform
   local→global. SSoT helper, pure.
2. **Global assembly**: μητρώο K (sparse ή dense — 3D frame συνήθως μικρό· dense αρχικά OK) + DOF mapping
   (6 ανά κόμβο)· εφαρμογή **boundary conditions** (RestraintDof από στηρίξεις)· **rigid diaphragm**
   constraints (master-slave ή penalty — πρότεινε).
3. **Load vector F**: member loads (UDL/αξονικά από appliedLoad) → fixed-end forces → κομβικά (§1.3).
   Ανά **συνδυασμό** (buildLoadCombinations).
4. **Solve** K·u=F (direct stiffness· Cholesky/LU)· **post-process**: εντατικά μεγέθη μέλους **M/V/N**
   (+ envelope ανά μέλος over combinations) + κομβικές μετακινήσεις/αντιδράσεις.
5. **Results store** + proactive (re)run (§1.5) + νέα diagnostics (singular K → μηχανισμός, πλήρης έλεγχος).
6. **Diagrams**: δεδομένα διαγραμμάτων M/V/N ανά μέλος (sampling κατά μήκος). (Το **rendering** των
   διαγραμμάτων — αν θες ορατό — αξιολόγησέ το ως ξεχωριστό slice· πιθανώς data-first εδώ, render σε
   επόμενο slice/T7.)
7. **Tests** (jest): element stiffness (γνωστές αναλυτικές λύσεις — π.χ. πρόβολος, αμφιέρειστη δοκός
   UDL → M=wL²/8), assembly+BC, solve απλού πλαισίου vs χειρόλυση, envelope, singular-K detection, μονάδες.

### ❌ ΕΚΤΟΣ T3 (μην τα αγγίξεις — επόμενα tiers)
- Μάζες/eigenvalue/ιδιομορφές/φάσμα EC8/CQC/Newmark (T4 — μέσω `SeismicCombinationProvider` hook του T2).
- Έλεγχοι θ/drift/ευστρεψία/soft-storey/ικανοτική/κόμβοι (T5).
- Μη-γραμμικότητα/P-Δ second-order (πέρα από T3 v1 — DEFER).
- Winkler θεμελίωσης (T6).

**ΣΗΜΑΝΤΙΚΟ:** Μην σπάσεις το tributary path (ADR-467) — ο solver ζει **παράλληλα**. Αρχικά τα M/V/N
του solver είναι **πληροφοριακά/diagnostics**· η σύνδεσή τους στη διαστασιολόγηση (αντικατάσταση
tributary) είναι ξεχωριστή απόφαση (πρότεινε σταδιακό switch, μην το επιβάλεις).

---

## 3. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — από CLAUDE.md)
- **Full Enterprise + Full SSoT, Revit-grade, GOL.** ≤40 γρ/function, ≤500 γρ/code-file, μηδέν `any`/
  `as any`/`@ts-ignore`. (Types/config files = no limit.)
- **N.7.2 checklist** + δήλωση `✅/⚠️/❌ Google-level` στο τέλος.
- **ADR-driven (N.0.1):** PHASE 1 διάβασε κώδικα → SSoT audit → plan. PHASE 3: **ADR-481** (new) +
  adr-index (2 πίνακες) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY, **ίδιο σύνολο**.
- **N.8 execution mode:** μεγάλο/cross-cutting → **ΕΝΗΜΕΡΩΣΕ Giorgio + ζήτα έγκριση** (plan ή
  orchestrator) ΠΡΙΝ ξεκινήσεις. Μην τρέξεις orchestrator χωρίς ok.
- **PLAN MODE υποχρεωτικό** — παρουσίασε το plan, **περίμενε «προχώρα»** πριν κώδικα.
- **commit/push = Giorgio. tsc = Giorgio** (N.17 — έλεγξε ότι δεν τρέχει ήδη άλλος tsc· εσύ ΜΗΝ τρέξεις).
  **jest = τρέχει κανονικά.**
- **Shared tree:** git add **ΜΟΝΟ** τα δικά σου, ΠΟΤΕ `-A`. Άλλοι agents δουλεύουν ADR-479 (presets:
  `bim/structural/presets/*`, `state/structural-settings-store.ts`) + ADR-471/476.
- **License check (N.5):** οποιοδήποτε νέο npm package (math/matrix) → MIT/Apache/BSD ΜΟΝΟ· αλλιώς ρώτα.
- **ΜΗΝ επαναφέρεις kPa** στο building (φορτία από `building.category`, ADR-474).
- **Απάντα στα Ελληνικά πάντα.**

---

## 4. ΚΑΤΑΣΤΑΣΗ T2 (ADR-480 — μόλις ολοκληρώθηκε, UNCOMMITTED)
Analytical Model SSoT: DONE, **27 jest GREEN** (+81 γειτονικά), UNCOMMITTED. Ο Giorgio θα κάνει commit.
Δες `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (κορυφή) + MEMORY `project_adr480_analytical_model_ssot`. Η ΜΟΝΗ ορατή
αλλαγή T2 = νέα stability warnings στο per-entity `EntityWarningsSection` (πιθανή επικάλυψη με
`columnMissingFooting` — DEFER tuning). **Μην** πειράξεις τα αρχεία του T2· είναι το INPUT σου (το διαβάζεις).

## 5. ΠΗΓΗ ΜΕΛΕΤΗΣ (τι θέλει το επαγγελματικό τεύχος)
3D space-frame, μητρώα Κόμβων/Μελών/Φορτίων/**Εντατικών Μεγεθών**, διαγράμματα M/V/N δοκών+υποστυλωμάτων.
Λεπτομέρειες §1 + §3.A του gap-analysis handoff. Το T3 παράγει αυτά τα M/V/N — σχεδίασέ το ώστε το T4
(σεισμός) να προσθέσει load-cases χωρίς αναδόμηση.
