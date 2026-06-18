# ADR-480 — Analytical Model SSoT (T2 — αναλυτικός φορέας, θεμέλιο για FEM/σεισμό)

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-459 (structural organism graph — η πηγή connectivity), ADR-467 (load path), ADR-464 (loads model EN1990), ADR-477 (seismic-params EC8), ADR-478 (wall line-loads, T1), ADR-040 (low-freq store writes).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.
**Roadmap:** Tier 2 (T2) του gap analysis στατικής μελέτης (`HANDOFFS/HANDOFF_2026-06-18_GAP-ANALYSIS_static-study-vs-app.md` §4). Το **στρατηγικό θεμέλιο** πάνω στο οποίο χτίζονται T3 (FEM solver), T4 (φασματική σεισμική EC8), T5 (έλεγχοι EC8).

> ⚠️ Το ADR-479 πιάστηκε από τον agent των Structural Project Presets (ίδια ημέρα) → ο αναλυτικός φορέας πήρε **ADR-480**.

---

## 1. Context — γιατί

Σήμερα **όλη** η διαστασιολόγηση τρέφεται από **tributary takedown** (gravity-only, FEM-free, ADR-467): κάθε μέλος παίρνει αξονικό φορτίο από εμβαδό ευθύνης — **ΟΧΙ** από επίλυση πλαισίου. Δεν υπάρχει lateral/σεισμός ούτε πραγματικά εντατικά μεγέθη (M/V/N από ανάλυση).

Το επαγγελματικό τεύχος (Statics 2025) είναι πλήρης 3D space-frame FEM + δυναμική φασματική σεισμική EC8 + ικανοτικός σχεδιασμός. Η Revit δεν κάνει σεισμική ανάλυση μόνη της: κρατά **physical model** (τι κατασκευάζεται) ξεχωριστά από **analytical model** (κόμβοι/ράβδοι/στηρίξεις) και κάνει export σε εξωτερικό solver (Robot). Το μεγάλο κενό μας = **αναλυτικό μοντέλο + solver + σεισμός**.

## 2. Decision — ξεχωριστό, DERIVED Analytical Model layer πάνω στον organism graph

**Αρχιτεκτονική απόφαση (Revit physical↔analytical split):** το analytical model **ΔΕΝ** επεκτείνει τον organism graph (ADR-459) — τον **διαβάζει**. Ο organism κρατά «τι-στηρίζει-τι» (load-path connectivity, FK-driven, τρέφει το takedown)· το analytical model κρατά «κόμβοι / βαθμοί ελευθερίας / μέλη / διάφραγμα» (numerical). Κρατώντας τα χωριστά: ο organism μένει stable (μηδέν regression takedown) και το analytical είναι ελεύθερο να εξελιχθεί προς solver.

**Section/material ref = το `entityId`** — το αναλυτικό μέλος δεν αντιγράφει ιδιότητες διατομής/υλικού· τις αναφέρει μέσω του physical entity (SSoT). Μονάδες: **όλες οι θέσεις σε μέτρα (m)**.

Το T2 είναι **καθαρό data layer + diagnostics** — **ΔΕΝ** επιλύει (solver = T3), **ΔΕΝ** κάνει σεισμό (T4). Σχεδιάστηκε extensible ώστε να τα χωράει.

### NEW φάκελος `bim/structural/analytical/` (pure)
- **`analytical-model-types.ts`** — `AnalyticalNode` (θέση m + `RestraintDof` 6-DOF + `levelId`), `AnalyticalMember` (iNodeId/jNodeId, `memberType` column/beam, `entityId` FK, `lengthM`), `AnalyticalSupport` (`fixed`/`pinned` + FK πεδίλου), `RigidDiaphragm` (levelId+nodeIds+master), `AnalyticalLevel`, `AnalyticalModel`. `FREE_DOF`/`FIXED_DOF`/`PINNED_DOF` + `EMPTY_ANALYTICAL_MODEL`.
- **`analytical-node-merge.ts`** — `NodeUnionFind` (priority-aware: ο root με τη μέγιστη προτεραιότητα — κορυφή κολόνας > άκρο δοκαριού· ισοπαλία → μικρότερο id), `mergeByProximity` (spatial-hash 3D, ~O(n), `NODE_MERGE_TOLERANCE_M=0.05`), `clusterElevations` (στάθμες για το διάφραγμα).
- **`analytical-model-builder.ts`** — `buildAnalyticalModel({entities, graph, getOffset?})`: κόμβοι κολόνας (βάση+κορυφή μέσω `columnCenterM`, grid-anchored) + δοκαριού (2 άκρα μέσω `beamEndpointsM`)· Z από τον graph (baseZmm/topZmm — ήδη απόλυτα cross-level)· connectivity merge `column-bearing`→κορυφή κολόνας· spatial merge· στηρίξεις από `footing-bearing` (πάκτωση)· διάφραγμα ανά στάθμη (κόμβοι-δοκαριών ≥2).
- **`load-cases.ts`** — ταξινομία `LoadCaseKind` (permanent/variable/**seismic hook**) + μητρώο συνδυασμών `buildLoadCombinations({factors?, seismic?})` **ΠΑΝΩ** στο `load-combinations.ts` (reuse `EN1990_ULS_FACTORS`/`combineUls`/`combineSls`). Σεισμικοί + Newmark = `SeismicCombinationProvider` (composition-by-concatenation) → **T4 χωρίς αναδόμηση**.
- **`analytical-diagnostics.ts`** — προκαταρκτικοί έλεγχοι ευστάθειας: `analyticalModelUnstable` (μέλη χωρίς καμία στήριξη), `analyticalMemberUnsupported` (BFS reachability από στηρίξεις → αποσπασμένο μέλος). Επιστρέφει `StructuralDiagnostic[]` (ADR-459 τύπος).
- **`analytical-model-store.ts`** — external store (mirror `StructuralDiagnosticsStore`) — κρατά το τελευταίο DERIVED μοντέλο για consumers T3/T4.

### Reuse (μηδέν διπλότυπο — N.0.2)
- Connectivity: `buildStructuralGraph` + `StructuralGraph`/`StructuralNode`/edges (ADR-459).
- Κέντρα/άκρα: `columnCenterM` (υπήρχε) + **NEW** `beamEndpointsM` (centralized canvas→m στο `member-load-geometry.ts`).
- Συνδυασμοί: `load-combinations.ts` (EN1990). Σεισμικές παράμετροι: `seismic-params.ts` (ADR-477) = hook για T4.

### Proactive sync + diagnostics surfacing (single-writer invariant)
- **`hooks/structural-analytical-core.ts`** — `runStructuralAnalyticalModel({entities, graph, getOffset})`: χτίζει μοντέλο → γράφει `AnalyticalModelStore` → emit `bim:analytical-model-built` → επιστρέφει diagnostics ευστάθειας.
- **Integration στο `useStructuralOrganism`** (ΟΧΙ δεύτερος writer): στο ΙΔΙΟ low-freq microtask pass που ήδη χτίζει τον graph, καλείται ο core και τα analytical diagnostics ενώνονται στο **ΕΝΑ** `StructuralDiagnosticsStore.set([...])`. Μηδέν διπλό compute, μηδέν race, ADR-040 safe. (Ο `StructuralDiagnosticsStore` έχει **single writer** — γι' αυτό η ενσωμάτωση εδώ αντί για ξεχωριστό 2ο hook.)
- **NEW event** `bim:analytical-model-built {nodeCount, memberCount}` — υποδοχή για T3/T4.

## 3. Consequences
- ✅ Υπάρχει πλέον αναλυτική δομή δεδομένων (κόμβοι/μέλη/στηρίξεις/διάφραγμα/load-cases) έτοιμη να τραφεί στον FEM solver (T3).
- ✅ Μηδέν αλλαγή στο tributary path (ADR-467) — το analytical model ζει **παράλληλα**.
- ✅ Νέα diagnostics ευστάθειας (μηχανισμός/αποσπασμένα μέλη) surface στο per-entity panel.
- ⚠️ Το μοντέλο είναι preliminary: column base = πάκτωση (default)· beam framing datum = άνω παρειά· πλήρης έλεγχος βαθμών ελευθερίας/μηχανισμού = T3. Walls/slabs ΕΚΤΟΣ αναλυτικού φορέα (shear walls = T6).

## 4. Tests (jest)
`analytical/__tests__/`: node-merge (priority union-find, spatial merge, level clustering), builder (portal frame — node-merging, supports, diaphragm, μονάδες m), load-cases (EN1990 ULS/SLS + seismic extensibility), diagnostics (modelUnstable/memberUnsupported). **27 jest GREEN** (+81 γειτονικά loads/core χωρίς regression).

## 5. DEFER (επόμενα tiers)
- T3: μητρώο δυσκαμψίας K·u=F, πραγματικά M/V/N, diagrams. Export σε external solver (OpenSees/ASCII) = επιλογή προς αξιολόγηση.
- T4: μάζες/eigenvalue/φάσμα EC8/CQC/Newmark (μέσω `SeismicCombinationProvider` + `seismic-params`).
- T5: θ/drift/ευστρεψία/soft-storey/ικανοτική τέμνουσα/κόμβοι.
- pinned vs fixed επιλογή στήριξης ανά πέδιλο· κέντρο μάζας διαφράγματος· walls/slabs ως αναλυτικά στοιχεία.

## 6. Changelog
- **2026-06-18 (Opus, UNCOMMITTED)** — T2 αρχική υλοποίηση: NEW `analytical/` (6 modules + 4 test suites), `beamEndpointsM` (member-load-geometry), `structural-analytical-core` + wiring στο `useStructuralOrganism`, event `bim:analytical-model-built`, diagnostic codes `analyticalModelUnstable`/`analyticalMemberUnsupported` + i18n keys (el/en). 🔴 tsc(Giorgio full) + browser-verify + commit.
