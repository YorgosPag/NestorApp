# HANDOFF — T2: Analytical Model SSoT (στρατηγικό θεμέλιο για FEM/σεισμό)

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε T1/ADR-478) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔵 PLAN-FIRST — μεγάλο, cross-cutting, στρατηγικό. **ΜΗΝ γράψεις κώδικα πριν εγκριθεί το plan.**
**Roadmap:** Tier 2 του gap analysis στατικής μελέτης. Πηγή roadmap:
`HANDOFFS/HANDOFF_2026-06-18_GAP-ANALYSIS_static-study-vs-app.md` (§4 T2, §1 τι θέλει το τεύχος).

> ⚠️ **Shared working tree** με άλλον agent (ADR-471/473/476). **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A.**
> **commit/push = Giorgio** (όχι εσύ). **tsc = Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέχει κανονικά.**
> **Γλώσσα: Ελληνικά πάντα.**

---

## 0. TL;DR — τι είναι το T2 και γιατί

Σήμερα όλη η διαστασιολόγηση τρέφεται από **tributary takedown** (gravity-only, FEM-free, ADR-467):
κάθε μέλος παίρνει αξονικό φορτίο από εμβαδό ευθύνης — **ΟΧΙ** από επίλυση πλαισίου. Δεν υπάρχει
lateral/σεισμός, ούτε πραγματικά εντατικά μεγέθη (M/V/N από ανάλυση).

**T2 = το θεμέλιο πάνω στο οποίο χτίζονται T3 (FEM solver), T4 (σεισμός EC8), T5 (έλεγχοι).**
Δεν είναι ο solver. Είναι το **Analytical Model**: μια καθαρή, αμιγώς αναλυτική αναπαράσταση του
φορέα (κόμβοι/μέλη/στηρίξεις/διάφραγμα/load-cases/συνδυασμοί) **παραγόμενη** από το physical BIM —
**ΟΧΙ** χειρόγραφη, **ΟΧΙ** mutating το physical.

### Η αρχή σχεδίασης (Revit way — ΚΡΙΣΙΜΟ)
Η **Revit ΔΕΝ κάνει σεισμική ανάλυση**. Κρατά ξεχωριστά:
- **Physical model** (τι κατασκευάζεται — οι BimEntities μας: κολόνες/δοκοί/πλάκες/τοίχοι/πέδιλα).
- **Analytical model** (αναλυτικοί κόμβοι/ράβδοι/στηρίξεις) — παράγωγο, συγχρονισμένο, και
  **export** σε εξωτερικό solver (Robot/OpenSees) ή τροφή σε δικό μας FEM (T3).

Άρα: **Analytical Model SSoT = ένα pure, derived module** πάνω στον υπάρχοντα `structural-organism`
graph (ADR-459). Μηδέν διπλασιασμός γεωμετρίας — διαβάζει physical, παράγει analytical.

---

## 1. 🔴 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSOT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΟΤΙΔΗΠΟΤΕ

**Εντολή Giorgio: πραγματικό SSoT audit για να ΜΗΝ φτιάξεις διπλότυπα.** Πιθανότατα υπάρχει ήδη
αρκετό υπόβαθρο (organism graph, load path, settings). Πρέπει να το **επεκτείνεις/επαναχρησιμοποιήσεις**,
όχι να ξαναγράψεις. Κάνε ΟΛΑ τα παρακάτω greps και **διάβασε** τον κώδικα που βρίσκεις, ΠΡΙΝ το plan:

### 1.1 Υπάρχει ήδη analytical model / FEM / solver;
```
grep -rn "analytical\|AnalyticalModel\|analytic-node\|stiffness\|stiffnessMatrix\|K·u\|Ku=F\|solver\|FEM\|space-frame\|spaceFrame\|eigen\|modal\|fem-" src/subapps/dxf-viewer/bim/structural
```
→ Αν υπάρχει ΟΤΙΔΗΠΟΤΕ → διάβασέ το πλήρως, χτίσε ΠΑΝΩ του. (Αναμένεται: ΔΕΝ υπάρχει solver — αλλά
   ΕΠΙΒΕΒΑΙΩΣΕ, μην υποθέσεις.)

### 1.2 Ο organism graph (το θεμέλιο που ΘΑ επεκτείνεις) — ΔΙΑΒΑΣΕ ΤΟΝ ΠΛΗΡΩΣ
```
src/subapps/dxf-viewer/bim/structural/organism/structural-organism-types.ts   ← StructuralGraph/Node/Edge
src/subapps/dxf-viewer/bim/structural/organism/structural-graph.ts            ← buildStructuralGraph()
src/subapps/dxf-viewer/bim/structural/loads/load-path-walk.ts                 ← topological order, beamSupportColumnIds, footingColumnId
```
- Ο graph σήμερα έχει nodes **μόνο** footing|column|beam + edges (footing-bearing/column-bearing/
  top-attachment). **Walls & slabs ΕΚΤΟΣ graph.** Το analytical model πιθανώς θέλει ΟΛΑ τα φέροντα.
- Κρίσιμη ερώτηση plan: **επεκτείνω τον organism graph** ή **νέο analytical-model layer** που τον
  διαβάζει; (Revit-grade = ξεχωριστό analytical layer, ώστε ο organism να μένει «τι-στηρίζει-τι» και
  το analytical να είναι «κόμβοι/βαθμοί ελευθερίας/μητρώα».) Πρότεινε με τεκμηρίωση.

### 1.3 Load cases / συνδυασμοί (μην ξαναφτιάξεις — υπάρχουν)
```
src/subapps/dxf-viewer/bim/structural/loads/structural-loads-types.ts   ← AppliedMemberLoad/MemberLoad/CombinedLoad
src/subapps/dxf-viewer/bim/structural/loads/load-combinations.ts        ← EN1990 ULS/SLS factors (combineUls κλπ)
src/subapps/dxf-viewer/bim/structural/loads/load-takedown.ts            ← computeMemberTakedown
src/subapps/dxf-viewer/bim/structural/loads/load-path-takedown.ts       ← computeLoadPathPatches (entity-aware)
src/subapps/dxf-viewer/bim/structural/loads/occupancy-loads.ts          ← area loads (ADR-474)
src/subapps/dxf-viewer/bim/structural/loads/wall-line-loads.ts          ← γραμμικά τοίχου (ADR-478, T1 ΜΟΛΙΣ ΕΓΙΝΕ)
src/subapps/dxf-viewer/bim/structural/loads/wall-beam-support.ts        ← wall→beam aggregation (ADR-478)
```
→ `grep -rn "EN1990\|combineUls\|combineSls\|ULS_FACTORS\|loadCombination\|load-case\|LoadCase\|γG\|γQ\|psi\|ψ2" src/subapps/dxf-viewer/bim/structural/loads`
   Τα analytical load-cases (G/Q/E + Newmark ±1.0/±0.3 σεισμικοί) **πρέπει να χτιστούν ΠΑΝΩ** σ' αυτά.

### 1.4 Γεωμετρία/συντεταγμένες (για analytical nodes)
```
grep -rn "footprint\|columnCenterM\|axisVertices\|startPoint\|endPoint\|centerline\|toM(\|mmToSceneUnits\|sceneUnits" src/subapps/dxf-viewer/bim/structural/loads/member-load-geometry.ts
```
- `member-load-geometry.ts` έχει ΗΔΗ `columnCenterM` (grid-anchored node, m) + self-weight helpers.
  **Reuse** για τους analytical nodes (μην ξαναϋπολογίσεις κέντρα).
- ΠΡΟΣΟΧΗ μονάδες (μάθημα T1): wall axis = `params.start/end`· beam axis = `params.startPoint/endPoint`·
  column center = `geometry.footprint.vertices`. Canvas units vs mm vs m — δες `member-load-geometry`.

### 1.5 Settings / building-level (σεισμικές παράμετροι — μερικώς υπάρχουν ήδη!)
```
src/subapps/dxf-viewer/bim/structural/structural-settings.ts
src/subapps/dxf-viewer/state/structural-settings-store.ts   (ή παρόμοιο)
src/subapps/dxf-viewer/bim/structural/loads/seismic-params.ts   ← ADR-477 ΗΔΗ έφτιαξε S/ε + a_gR/ground type!
```
→ `grep -rn "seismic\|a_gR\|agR\|groundType\|spectrum\|Sd(\|behaviourFactor\|q-factor\|importance\|γI\|zone\|ζώνη" src/subapps/dxf-viewer/bim/structural`
   **Το ADR-477 ΗΔΗ εισήγαγε `seismic-params.ts`** (πίνακες S/ε, `seismicTieForceFactor`). Το T4
   (φάσμα EC8) θα χτίσει ΠΑΝΩ του — άρα στο T2 σχεδίασε ώστε το analytical model να ΔΕΧΕΤΑΙ σεισμικά
   load-cases χωρίς αναδόμηση (extensibility hook), αλλά **μην** υλοποιήσεις σεισμό εδώ.

### 1.6 Proactive chain (πώς συγχρονίζεται το analytical με αλλαγές)
```
src/subapps/dxf-viewer/hooks/useProactiveStructuralLoads.ts   ← το pattern (T1 πρόσθεσε wall triggers)
src/subapps/dxf-viewer/hooks/structural-load-takedown-core.ts  ← runStructuralLoadTakedown + emit
grep -rn "bim:structural-loads-computed\|useStructuralOrganism\|ORGANISM_EVENTS\|bim:.*-params-updated" src/subapps/dxf-viewer
```
- Το analytical model είναι **derived** → πρέπει να (επανα)παράγεται proactively σε geometry/load
  change (όπως το organism/takedown). Reuse το event pattern, **μην** εφεύρεις νέο scheduler.

### 1.7 ADR landscape (μην διπλασιάσεις concepts)
Διάβασε index: `docs/centralized-systems/reference/adr-index.md` — ειδικά ADR-456 (structural
quantities/codes), **ADR-459 (organism graph + tributary + proactive — ΤΟ ΚΕΝΤΡΙΚΟ)**, ADR-467
(load path engine), ADR-474 (occupancy loads), ADR-477 (seismic-params), ADR-478 (wall line-loads).
Επόμενο ελεύθερο ADR: **479** (478 πιάστηκε από T1).

**Παραδοτέο του audit (γράψε στο plan):** πίνακας «τι υπάρχει ήδη → πώς το reuse-άρω» vs «τι λείπει
→ νέο SSoT». Αν βρεις duplicate/scattered → N.0.2 Boy Scout (flag ή fix).

---

## 2. ΣΤΟΧΟΣ T2 (scope — τι ΝΑΙ / τι ΟΧΙ)

### ✅ ΕΝΤΟΣ T2 (Analytical Model SSoT — pure data layer)
1. **Analytical types** (SSoT): `AnalyticalNode` (id, θέση x/y/z σε ΕΝΑ unit system, DOF/restraints),
   `AnalyticalMember` (id, i-node/j-node, section/material ref, member-type: beam/column/brace),
   `AnalyticalSupport` (κόμβος + δεσμεύσεις — πακτώσεις στα πέδιλα), `RigidDiaphragm` (ανά στάθμη),
   `AnalyticalModel` (nodes/members/supports/diaphragms/levels).
2. **Builder** (pure): `buildAnalyticalModel(entities, organismGraph, settings, getOffset?)` →
   `AnalyticalModel`. Παράγωγο του physical — reuse organism edges για connectivity, `columnCenterM`
   για nodes, beam axes για members. Node-merging (συντρέχοντα άκρα → ένας κόμβος, tolerance-based).
3. **Load-case model** (SSoT, χτισμένο ΠΑΝΩ στα υπάρχοντα EN1990): `LoadCase` (G, Q, [hook για E]),
   `LoadCombination` (EN1990 ULS/SLS — reuse `load-combinations.ts`). Σχεδίασε ώστε σεισμικά cases +
   Newmark ±1.0/±0.3 να προστίθενται στο T4 χωρίς αναδόμηση (registry/strategy, ΟΧΙ hardcoded).
4. **Validation/diagnostics** (pure): ασύνδετοι κόμβοι, μέλη χωρίς στήριξη, mechanism warnings
   (προκαταρκτικά — πλήρες stability = T3).
5. **Proactive sync**: re-build σε geometry/load change (reuse event pattern §1.6).
6. **Tests** (jest): node-merging, connectivity από organism, supports από πέδιλα, diaphragm ανά
   στάθμη, load-case extensibility, μονάδες.

### ❌ ΕΚΤΟΣ T2 (μην τα αγγίξεις — επόμενα tiers)
- Μητρώο δυσκαμψίας / επίλυση K·u=F (T3).
- Eigenvalue / φάσμα EC8 / CQC / μάζες-ιδιομορφές (T4).
- Έλεγχοι θ/drift/ευστρεψία/ικανοτική τέμνουσα/κόμβοι (T5).
- **Export σε external solver** (OpenSees/ASCII) — αξιολόγησέ το στο plan ως ΕΠΙΛΟΓΗ για T3, μην το
  υλοποιήσεις.

**ΣΗΜΑΝΤΙΚΟ:** Το T2 δεν αλλάζει τη συμπεριφορά του χρήστη ακόμη (καμία ορατή διαστασιολόγηση δεν
βασίζεται σ' αυτό). Είναι καθαρό data foundation + diagnostics. **Μην** σπάσεις το υπάρχον tributary
path (ADR-467) — το analytical model ζει **παράλληλα**, δεν το αντικαθιστά (ακόμη).

---

## 3. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — από CLAUDE.md)
- **Full Enterprise + Full SSoT, Revit-grade, GOL.** ≤40 γρ/function, ≤500 γρ/code-file, μηδέν `any`/
  `as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n SSoT αν υπάρχει UI — μάλλον δεν υπάρχει UI στο T2).
- **N.7.2 checklist** + δήλωση `✅/⚠️/❌ Google-level` στο τέλος.
- **ADR-driven (N.0.1):** PHASE 1 διάβασε κώδικα → σύγκρινε ADR → ENHΜΕΡΩΣΕ ADR αν διαφέρει → plan.
  PHASE 3: ADR-479 (new) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY, **ίδιο σύνολο αλλαγών**.
- **N.8 execution mode:** 5+ αρχεία / 2+ domains → **ΕΝΗΜΕΡΩΣΕ Giorgio + ζήτα έγκριση** (plan ή
  orchestrator) ΠΡΙΝ ξεκινήσεις. Μην τρέξεις orchestrator χωρίς ok.
- **PLAN MODE υποχρεωτικό** — παρουσίασε το plan, **περίμενε «προχώρα»** πριν κώδικα.
- **commit/push = Giorgio.** **tsc = Giorgio** (N.17 — έλεγξε ότι δεν τρέχει ήδη άλλος tsc· εσύ ΜΗΝ
  τρέξεις). **jest = τρέχει κανονικά.**
- **Shared tree:** git add **ΜΟΝΟ** τα δικά σου, ΠΟΤΕ `-A`. Άλλος agent δουλεύει ADR-471/473/476
  (shared structural files: `codes/*`, `section-context.ts`, `suggest-reinforcement.ts`,
  `reinforcement-checks.ts`, slab/joint). **Απόφυγε** να τα τροποποιήσεις· αν χρειαστεί, ελάχιστα.
- **ΜΗΝ επαναφέρεις kPa** στο building (φορτία από `building.category`, ADR-474).
- **Απάντα στα Ελληνικά πάντα.**

---

## 4. ΚΑΤΑΣΤΑΣΗ T1 (ADR-478 — μόλις ολοκληρώθηκε, UNCOMMITTED)
T1 wall line-loads: DONE, **30 jest GREEN**, UNCOMMITTED. Ο Giorgio θα κάνει commit + browser-verify.
Δες `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (κορυφή) + MEMORY `project_adr478_wall_line_loads`. **Μην** πειράξεις τα
αρχεία του T1· είναι ανεξάρτητα από το T2 (το analytical model απλώς θα τα διαβάζει ως load source).

## 5. ΠΗΓΗ ΜΕΛΕΤΗΣ (τι θέλει το επαγγελματικό τεύχος — για να ξέρεις προς τα πού πάμε)
Εγκεκριμένο τεύχος (Statics 2025): 3D space-frame, 279 ιδιομορφές, CQC, φάσμα EC8, μάζες/Jm/Is ανά
στάθμη, rigid diaphragm, σεισμικοί συνδυασμοί Newmark, ικανοτικός σχεδιασμός. Λεπτομέρειες §1 του
`HANDOFF_2026-06-18_GAP-ANALYSIS_static-study-vs-app.md`. **Το T2 στήνει τη δομή δεδομένων που θα
τραφεί απ' όλα αυτά** — σχεδίασέ το ώστε να τα χωράει (extensible), χωρίς να τα υλοποιείς τώρα.
