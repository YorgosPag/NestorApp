# ADR-499 — Αυτο-διορθούμενος Οργανισμός: capacity ceiling + auto-size διατομών + στρέψη + global feasibility

**Status:** 🟡 IN PROGRESS — Slice A + B1 + B2 + C(v1 sensor) + D + **πλήρες §6.3 ACTUATOR (§6.3-a plumbing + §6.3-b section-grow + §6.3-c στρεπτικός οπλισμός)** DONE (UNCOMMITTED)· DEFER: μη-ορθογώνιες δοκοί + B2 L/T/U/I/circular shape-grow + slab simple-span auto-size
**Date:** 2026-06-19
**Author:** Opus session (συνέχεια ADR-498)
**Υλοποιεί:** ADR-487 §3-§5 (Living Structural Organism — δυναμική επανα-διαστασιολόγηση)
**Cross-ref:** ADR-475 (auto member sizing), ADR-472 (load-aware N-M οπλισμός), ADR-486/498 (topology-aware support / cantilever slab), ADR-491/497 (FEM-driven), ADR-481/483 (FEM διαγράμματα).

---

## 1. Πρόβλημα (repro-confirmed, live DB Firestore proj_12788b6a)

2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + **πλάκα-πρόβολος**. Μεγαλώνοντας τον πρόβολο 2.77m → 7.48m:

| Πρόβολος | Slab top σχάρα | Beam οπλισμός | Beam ύψος | Κολώνες |
|---|---|---|---|---|
| 2.77m | Ø10/75 | 2Ø22 | 400 | 400×400 |
| 7.48m | **Ø25/75** (σε πλάκα 200mm!) | **4Ø32** | **400 (ίδιο)** | **400×400 (ίδιο)** |

Ο app **οπλίζει μέλη σε απομόνωση** χωρίς: **(A)** έλεγχο αν η διατομή αντέχει την καμπτική ροπή (`M_Ed ≤ M_Rd,lim`), **(B)** μεγέθυνση διατομών (πάχος πλάκας / διατομή κολώνας δεν μεγαλώνουν ποτέ — μόνο ο οπλισμός, απεριόριστος), **(C)** στρέψη δοκαριού από μονόπλευρο πρόβολο, **(D)** global feasibility. Παράγει «οπλισμό που ικανοποιεί τη ροπή» ενώ οι **διατομές μένουν φυσικά αδύνατες**.

**Όραμα (ADR-487 §2-§4):** ο «στατικός» (η εφαρμογή) **αυτο-διορθώνει** διατομές+σίδηρο+οντότητες σε κάθε κίνηση· warning ΜΟΝΟ στην έσχατη, αποδεδειγμένα-αδύνατη περίπτωση. Η προειδοποίηση «αύξησε το πάχος» = αποτυχία του οράματος.

---

## 2. Απόφαση — 4 slices (A → B → C → D)

### A — Flexural-capacity ceiling (η ΦΥΣΙΚΗ ΠΥΛΗ) ✅ DONE (UNCOMMITTED)
NEW SSoT `codes/flexural-capacity.ts`: `M_Rd,lim = μ_lim·f_cd·b·d²` (EC2 Annex A, μ_lim≈0.295). Ο suggester (δοκάρι **και** πλάκα) **κορεστεί** τον εφελκυόμενο χάλυβα στο `A_s,lim` όταν `M_Ed > M_Rd,lim` — δεν παράγει ψεύτικη λύση (4Ø32 σε 250×400 / Ø25/75 σε 200mm). Η ανεπάρκεια διορθώνεται με μεγαλύτερη διατομή (Slice B), όχι περισσότερο σίδερο.

**Μηχανική:** ο cap εκφράζεται ως συντελεστής `min(1, M_Rd,lim/M_Ed)` επί του `A_s,strength` — ο μοχλοβραχίονας `z=0.9·d` απλοποιείται (`A_s,strength·M_Rd,lim/M_Ed = A_s,lim`), άρα το cap module δεν χρειάζεται `z`/`f_yd` ⇒ μηδέν circular import, μηδέν duplicate λεβιέ. `cap=1` όταν επαρκεί ⇒ **μηδέν regression**.

**SSoT:** `μ_lim` = provider method `flexuralLimitMuLim()` (code-specific, EC2 vs ΕΚΩΣ· τώρα 0.295 και τα δύο)· ο τύπος `μ·f_cd·b·d²` κοινός. Extracted `beamDesignMomentNmm` / `slabDesignMomentNmmPerM` = ΕΝΑ M_Ed που μοιράζονται οπλισμός + πύλη.

### B — Auto-size ΔΙΑΤΟΜΩΝ (το κύριο ζητούμενο)

**B1 — Auto-size πάχους πλάκας-προβόλου ✅ DONE (UNCOMMITTED).** NEW `sizing/slab-sizing.ts` `suggestSlabThickness`: `d_req = max(L/d serviceability [slabSpanDepthLimit, ADR-498], capacity [`capacityDepthMm = √(M_Ed/(μ_lim·f_cd·b))`, η αντιστροφή του `limitMomentNmm`]) → thickness = d_req + cover` (module 10mm, clamp 1200). Scope: ΜΟΝΟ αναρτημένη πλάκα-πρόβολος (`suspended`+`cantilever`)· raft/simple = no-op (ο Slice A cap τα προστατεύει). NEW `sizing/slab-size-patch.ts` `buildSlabSizePatch` (convergence guard 10mm-quantized + `isSlabAutoSized` [composite/dna εξαιρείται] + undoable). NEW `SlabParams.autoSized`. `AutoSizeMembersCommand` → **member-generic** (dispatch by kind: beam ύψος / slab πάχος· per-kind `compute*Geometry`+`validate*Params`). `member-auto-size-core` scope `isBeamEntity‖isSlabEntity` + per-kind emit μέσω `emitBimEntityParamsUpdated` (ADR-459 Φ7 SSoT). Μπαίνει στον υπάρχοντα proactive κύκλο (`useProactiveMemberSizing` mount ΠΡΙΝ reinforce) — **κανένα νέο reactive trigger**· convergence: ο πρόβολος χρησιμοποιεί spatial `cantileverSpanMm` (footprint-independent) → καθαρή σύγκλιση.

**B2 — Auto-size διατομής κολώνας ✅ DONE (UNCOMMITTED).** NEW `sizing/column-sizing.ts` `suggestColumnSection(provider, params, femMomentKnm?)`: η χαρακτηριστική διάσταση **ορθογώνιας** κολώνας αυτο-μεγαλώνει (square-equivalent grow, upward-only, module 50mm) ώσπου ΤΑΥΤΟΧΡΟΝΑ (1) **χωράει ο οπλισμός** `As,req ≤ ρ_max·A_c` (ρ_max=0.04 EC8· `As,req` = `asStrengthColumnMm2` ήδη N-M aware ADR-472/491 — ο αξονικός όρος `(N_Ed−f_cd·A_c)/f_yd` καλύπτει σιωπηλά και το `N_Rd`, μηδέν διπλότυπος τύπος) και (2) **λυγηρότητα** `min(w,d) ≥ height/MAX_SLENDERNESS_RATIO` (ΙΔΙΟ geometric κριτήριο που ελέγχει ο `validateColumnParams` → μηδέν validation drift· proper `λ=l0/i` EC2 §5.8.3.1 = DEFER). **Iterative** (όχι closed-form: η `As,req` εξαρτάται από τη διάσταση)· clamp `MAX_PRACTICAL_COLUMN_DIMENSION_MM=1200` (→ Slice D). NEW `sizing/column-size-patch.ts` `buildColumnSizePatch` (convergence guard 50mm-quantized + `isColumnAutoSized` + undoable) + NEW `ColumnParams.autoSized`. Ίδιο **member-generic** wiring: `AutoSizeMembersCommand` + `member-auto-size-core` `else if isColumnEntity` με την engaged-gated FEM ροπή (`resolveActiveColumnFemMoment`, ADR-491). **Scope v1: μόνο `rectangular`** (L/T/U/I/circular/wall = DEFER — shared tree ADR-496). **Latent fix:** το `asStrengthColumnMm2` έκανε short-circuit `if(N≤0) return 0` αγνοώντας την καμπτική συνιστώσα — αντίθετα με το documented ADR-491 intent· τώρα η ροπή μετρά ΠΑΝΤΑ (η αξονική μόνο σε θλίψη). 17 νέα jest. Μπαίνει στον υπάρχοντα proactive κύκλο — **κανένα νέο reactive trigger**.

### C — Beam torsion από μονόπλευρο πρόβολο

**C v1 — Sensor (DETECTION) ✅ DONE (UNCOMMITTED).** Η μονόπλευρη πρόβολος-πλάκα στρίβει τη φέρουσα δοκό. **ΕΝΑ SSoT, μηδέν νέα load μηχανική:** το hogging της προβόλου-πλάκας ανά μέτρο = `slabDesignMomentNmmPerM` (q·L²/2, που ήδη χρησιμοποιεί ο οπλισμός+sizing) **είναι** ο κατανεμημένος στρεπτικός φόρτος `t_Ed` (kNm/m). NEW `loads/beam-torsion.ts` `computeBeamDesignTorsion` → `Map<beamId → T_Ed (kNm)>` (`T_Ed = t_Ed·L_cov/2`, αντίδραση στρεπτικά-πακτωμένης δοκού· reuse `computeSlabSupportConditions` + νέα additive πεδία `bearingBeamId`/`coverageLengthM` στο `SlabSupportCondition`). NEW `codes/torsion-capacity.ts` `plasticTorsionalResistanceKnm` (EC2 §6.3.2 θλιπτήρας: `T_Rd,max = 0.6·f_cd·A_k·t_ef`, solid→thin-wall tube). NEW `organism/beam-torsion-checks.ts` `runBeamTorsionChecks` → warning **ΜΟΝΟ** όταν `T_Ed > T_Rd,max` (καμία ποσότητα συνδετήρων δεν αρκεί → απαιτείται μεγαλύτερη διατομή/αλλαγή σχεδιασμού — η έσχατη παρέμβαση, τροφοδοτεί Slice D). Wired στο `useStructuralOrganism` (mirror `runSlabChecks`). i18n el+en. 13 jest.

**C — πλήρες EC2 §6.3 ACTUATOR (σε 3 sub-slices, πάνω στον v1 sensor):**

- **§6.3-a — Plumbing ✅ DONE (UNCOMMITTED).** EXTEND `torsion-capacity.ts`: εξαγωγή `torsionTubeProperties(b,h)→{tEfMm,akMm2,ukMm}` (EC2 §6.3.2 ισοδύναμος σωλήνας — **ΕΝΑ SSoT**· `plasticTorsionalResistanceKnm` το reuse → μηδέν inline duplicate) + `shearTorsionUtilization(T_Ed,T_Rd,max,V_Ed,V_Rd,max)=T_Ed/T_Rd,max + V_Ed/V_Rd,max` (EC2 §6.3.2(4)). NEW `organism/beam-torsion-store.ts` `BeamTorsionStore=createDerivedMapStore<number>()` (T_Ed kNm ανά beamId) + `resolveActiveBeamTorsion` (pure store read, mirror `resolveActiveBeamSupportType`). `BeamSectionContext += designTorsionKnm?` (additive). `buildBeamSectionContext(beam, supportTypeOverride?, designTorsionKnm?)` (thread). `useStructuralOrganism` → `BeamTorsionStore.set(computeBeamDesignTorsion(entities))` δίπλα στο `SlabSupportConditionStore.set` (κανένα νέο reactive trigger). **St.Venant J (`member-section-properties`) ΔΕΝ reused — είναι FEM δυσκαμψία, ΟΧΙ §6.3 σχεδιασμός.** 6 νέα jest (torsion-capacity → 10). UNCOMMITTED.
- **§6.3-b — Section-grow ✅ DONE (UNCOMMITTED).** EXTEND `member-sizing.ts`: εξαγωγή `designShearKn(ctx)` (ΕΝΑ SSoT V_Ed· `shearDepthMm` refactored να το reuse) + `shearResistanceKn(b,h,fcd)` (V_Rd,max) + NEW **iterative** `torsionDepthMm(ctx)` (βήμα 50mm ώσπου `shearTorsionUtilization(T_Ed, T_Rd,max(b,h), V_Ed, V_Rd,max(b,h)) ≤ 1`· ανέφικτο→`BEAM_MAX_PRACTICAL_DEPTH_MM`, το D error το πιάνει) + 5ο candidate `governedBy:'torsion'` στο `suggestBeamSection`. Thread `buildBeamSizePatch(entity, provider, supportTypeOverride?, designTorsionKnm?)` + `AutoSizeMembersCommand` beam branch περνά `resolveActiveBeamTorsion(id)`. **Parity sensor↔actuator:** η interaction (T/T_Rd + V/V_Rd ≤ 1) είναι **αυστηρότερη** από το `T_Ed ≤ T_Rd,max` του classifier → όταν ο actuator λύσει, το C-v1 warning (growToFix) σβήνει μόνο του (monotonic). Convergence guard 50mm ήδη υπάρχει· **κανένα νέο reactive trigger**. 5 νέα jest (member-sizing → 14). UNCOMMITTED.
- **§6.3-c — Στρεπτικός οπλισμός ✅ DONE (UNCOMMITTED).** **In-place bump** (απόκλιση από handoff, Giorgio-approved — καθαρότερο SSoT, μηδέν νέο render, μηδέν ADR-040 ρίσκο): ο στρεπτικός χάλυβας προστίθεται στα **πραγματικά** bars του `suggestBeamReinforcementFrom`, ώστε render + ΠΟΣΟΤΗΤΕΣ να ακολουθούν αυτόματα (geometry-is-SSoT). NEW `resolveBeamTorsionDemand(ctx)` (reuse `torsionTubeProperties`→A_k/u_k· `A_st/s=T_Ed/(2·A_k·f_yd)`, `A_sl=T_Ed·u_k/(2·A_k·f_yd)`, cotθ=1) + `resolveBeamStirrups` (reuse `resolveMatMesh` — κλειστοί συνδετήρες ≥ A_st/s, default=code-min). `A_sl/2` ανά παρειά additive σε bottom/top. Threading: `resolveActiveBeamReinforcement(+designTorsionKnm?)` → `resolveActiveBeamReinforcementForEntity` (live 2Δ/3Δ) + `buildReinforcePatch(+beamTorsionKnm?)` → `AutoReinforceOrganismCommand` map → `structural-auto-reinforce-core` (`computeBeamDesignTorsion`). `beamReinforcementMateriallyDiffers` += σύγκριση stirrups (αλλιώς πυκνότεροι torsion συνδετήρες δεν περνούν τον convergence guard). **Μηδέν render αρχείο, μηδέν νέο type πεδίο.** Scope v1: ορθογώνιες (side-bars ψηλών δοκών = DEFER). 5 νέα jest. UNCOMMITTED.

### D — Global feasibility escalation (το ΜΟΝΑΔΙΚΟ `error`) ✅ DONE (UNCOMMITTED)
Όταν το auto-size (B/§6.3) φτάσει το πρακτικό μέγιστο (`MAX_PRACTICAL_{SLAB_THICKNESS,COLUMN_DIMENSION}_MM` / `BEAM_MAX_PRACTICAL_DEPTH_MM`) και η διατομή είναι **ΑΚΟΜΑ ανεπαρκής** → diagnostic `severity:'error'` «ανέφικτο — απαιτείται αλλαγή σχεδιασμού». Η έσχατη παρέμβαση (ADR-487 §7): εδώ η αυτο-διόρθωση έχει εξαντληθεί, ο «στατικός» παραδίδεται στον άνθρωπο.

NEW `organism/feasibility-checks.ts` `runFeasibilityChecks(entities, provider, femMomentByColumnId)` (pure, mirror `runSlabChecks`): **πλάκα** `!isFlexurallyAdequate(M_Ed, M_Rd,lim@max thickness)` · **κολώνα** `isColumnInfeasibleAtMaxSection` (reuse private `columnSectionFits` @MAX → μηδέν διπλό `As≤ρ_max·A_c`) · **δοκός-στρέψη** `assessBeamTorsion → 'infeasible'`. RE-ADD `flexural-capacity.isFlexurallyAdequate` (μαζί με τον consumer → CHECK 3.22 clean). NEW `buildActiveColumnFemMomentMap` (active-reinforcement· engaged-gated, ίδια ροπή με τον B2 sizer → μηδέν διπλή αλήθεια· store coupling έξω από τον pure runner, mirror `buildActiveFootingFemAxialMap`).

**Warning↔error dedup (Giorgio: «πάντα ΕΝΑ μήνυμα»):** NEW shared classifier `beam-torsion.classifyBeamTorsion → 'ok'|'growToFix'|'infeasible'` + `assessBeamTorsion` (ΕΝΑ SSoT). Ο C-v1 runner (`beam-torsion-checks`) βγάζει **warning ΜΟΝΟ σε `'growToFix'`** (λύνεται μεγαλώνοντας)· το D βγάζει **error ΜΟΝΟ σε `'infeasible'`** (ανέφικτο ακόμη και @ `BEAM_MAX_PRACTICAL_DEPTH_MM`) → αμοιβαία αποκλειόμενα, μηδέν διπλό diagnostic. ΕΝΑ i18n key `sectionInfeasibleAtMaxSize` (ICU select στο `memberKind` token, el+en). Wired στο `useStructuralOrganism` diagnostics pass — **κανένα νέο reactive trigger**. 25 jest (3 suites), 775 structural pass· 6 fails = pre-existing raft (ADR-476).

---

## 3. Αρχιτεκτονική — The auto-correction loop (ADR-487 §4)

Ο proactive κύκλος **υπάρχει ήδη** (`useProactiveMemberSizing` mount ΠΡΙΝ `useProactiveOrganismReinforce`) και τερματίζει στον convergence guard. Το B επεκτείνεται **μέσα** σ' αυτόν (slab/column patches), ΧΩΡΙΣ νέο self-sustaining trigger. Το `flexural-capacity` γίνεται η **ΕΝΑ** πηγή που οδηγεί ΚΑΙ το cap (A) ΚΑΙ το required depth (B).

---

## 4. Αρχεία

### Slice A (DONE, UNCOMMITTED)
- **NEW** `bim/structural/codes/flexural-capacity.ts` — `limitMomentNmm`, `flexuralCapacityCapFactor`, `capacityDepthMm` (B).
- **NEW** `bim/structural/codes/__tests__/flexural-capacity-ceiling.test.ts` — 13 jest.
- **MOD** `codes/structural-code-types.ts` — `flexuralLimitMuLim()` στο `StructuralCodeProvider`.
- **MOD** `codes/eurocode-provider.ts` + `greek-legacy-provider.ts` — μ_lim = 0.295.
- **MOD** `codes/suggest-reinforcement.ts` — extracted `beamDesignMomentNmm` + cap στο `suggestBeamReinforcementFrom`.
- **MOD** `codes/suggest-slab-reinforcement.ts` — extracted+exported `slabDesignMomentNmmPerM` + cap στο suspended branch.

### Slice B1 (DONE, UNCOMMITTED)
- **NEW** `bim/structural/sizing/slab-sizing.ts` — `suggestSlabThickness` (+ `MAX_PRACTICAL_SLAB_THICKNESS_MM`).
- **NEW** `bim/structural/sizing/slab-size-patch.ts` — `buildSlabSizePatch`, `isSlabAutoSized`.
- **NEW** `sizing/__tests__/slab-sizing.test.ts` (7) + `sizing/__tests__/slab-size-patch.test.ts` (9 jest).
- **MOD** `codes/flexural-capacity.ts` — `capacityDepthMm` (αντιστροφή `limitMomentNmm`).
- **MOD** `bim/types/slab-types.ts` — `SlabParams.autoSized?`.
- **MOD** `core/commands/entity-commands/AutoSizeMembersCommand.ts` — member-generic (beam+slab dispatch).
- **MOD** `hooks/member-auto-size-core.ts` — scope `beam‖slab` + per-kind emit (`emitBimEntityParamsUpdated`).
- **MOD** `bim/structural/__tests__/topology-aware-beam-support.test.ts` — φορτίο εντός χωρητικότητας (ο Slice A cap αλλιώς κορέννυε & τα δύο· intent διατηρείται).

### Slice B2 (DONE, UNCOMMITTED)
- **NEW** `bim/structural/sizing/column-sizing.ts` — `suggestColumnSection` (+ `MAX_PRACTICAL_COLUMN_DIMENSION_MM`).
- **NEW** `bim/structural/sizing/column-size-patch.ts` — `buildColumnSizePatch`, `isColumnAutoSized`.
- **NEW** `sizing/__tests__/column-sizing.test.ts` (8) + `sizing/__tests__/column-size-patch.test.ts` (9 jest).
- **MOD** `bim/types/column-types.ts` — `ColumnParams.autoSized?`.
- **MOD** `core/commands/entity-commands/AutoSizeMembersCommand.ts` — column branch (`buildColumnSizePatch` + `computeColumnGeometry` + `validateColumnParams(p, provider.id)`).
- **MOD** `hooks/member-auto-size-core.ts` — scope `+ isColumnEntity`.
- **MOD** `codes/suggest-reinforcement.ts` — latent fix `asStrengthColumnMm2` (η καμπτική συνιστώσα μετρά πάντα· αξονική μόνο σε θλίψη).

### Slice C v1 (DONE, UNCOMMITTED)
- **NEW** `bim/structural/loads/beam-torsion.ts` — `computeBeamDesignTorsion` (`Map<beamId → T_Ed>`).
- **NEW** `bim/structural/codes/torsion-capacity.ts` — `plasticTorsionalResistanceKnm` (T_Rd,max).
- **NEW** `bim/structural/organism/beam-torsion-checks.ts` — `runBeamTorsionChecks` (warning T_Ed>T_Rd,max).
- **NEW** `codes/__tests__/torsion-capacity.test.ts` (4) + `loads/__tests__/beam-torsion.test.ts` (5) + `organism/__tests__/beam-torsion-checks.test.ts` (4 jest).
- **MOD** `loads/slab-beam-support.ts` — `SlabSupportCondition` +`bearingBeamId?`/`coverageLengthM?` (additive).
- **MOD** `organism/structural-organism-types.ts` — `StructuralDiagnosticCode` +`beamCantileverTorsionExceedsCapacity`.
- **MOD** `hooks/useStructuralOrganism.ts` — `...runBeamTorsionChecks(entities)` στο diagnostics pass.
- **MOD** `i18n/locales/{el,en}/dxf-viewer-shell.json` — `beamCantileverTorsionExceedsCapacity`.

### Slice D (DONE, UNCOMMITTED)
- **NEW** `bim/structural/organism/feasibility-checks.ts` — `runFeasibilityChecks` (πλάκα/κολώνα/δοκός-στρέψη ανέφικτα @ max → error).
- **NEW** `bim/structural/organism/__tests__/feasibility-checks.test.ts` (10 jest).
- **MOD** `codes/flexural-capacity.ts` — RE-ADD `isFlexurallyAdequate` (consumer = feasibility-checks).
- **MOD** `sizing/column-sizing.ts` — `isColumnInfeasibleAtMaxSection` (reuse private `columnSectionFits` @MAX).
- **MOD** `sizing/slab-sizing.ts` — export `SLAB_DESIGN_STRIP_MM` (reuse στο feasibility-check).
- **MOD** `loads/beam-torsion.ts` — `classifyBeamTorsion` (`'ok'|'growToFix'|'infeasible'`) + `assessBeamTorsion` (ΕΝΑ SSoT για warning+error).
- **MOD** `organism/beam-torsion-checks.ts` — refactor → warning ΜΟΝΟ σε `'growToFix'` (μηδέν διπλό με το D error).
- **MOD** `bim/structural/active-reinforcement.ts` — `buildActiveColumnFemMomentMap` (engaged-gated, B2-parity).
- **MOD** `organism/structural-organism-types.ts` — `StructuralDiagnosticCode` += `sectionInfeasibleAtMaxSize`.
- **MOD** `hooks/useStructuralOrganism.ts` — `...runFeasibilityChecks(entities, provider, buildActiveColumnFemMomentMap(entities))`.
- **MOD** `i18n/locales/{el,en}/dxf-viewer-shell.json` — `sectionInfeasibleAtMaxSize` (ICU select στο `memberKind`).
- **MOD** `loads/__tests__/beam-torsion.test.ts` + `organism/__tests__/beam-torsion-checks.test.ts` — classifier + νέα σημασιολογία (warning↔error).

---

### §6.3-a Plumbing (DONE, UNCOMMITTED)
- **MOD** `codes/torsion-capacity.ts` — `export torsionTubeProperties` (EC2 §6.3.2 tube SSoT) + refactor `plasticTorsionalResistanceKnm` να το reuse + `export shearTorsionUtilization` (§6.3.2(4)).
- **NEW** `organism/beam-torsion-store.ts` — `BeamTorsionStore = createDerivedMapStore<number>()`.
- **MOD** `active-reinforcement.ts` — `resolveActiveBeamTorsion(beamId)` (pure store read).
- **MOD** `codes/structural-code-types.ts` — `BeamSectionContext += designTorsionKnm?`.
- **MOD** `section-context.ts` — `buildBeamSectionContext(beam, supportTypeOverride?, designTorsionKnm?)`.
- **MOD** `hooks/useStructuralOrganism.ts` — `BeamTorsionStore.set(computeBeamDesignTorsion(entities))`.
- **MOD** `codes/__tests__/torsion-capacity.test.ts` — +6 jest (`torsionTubeProperties` + `shearTorsionUtilization` + regression). Suite 10 GREEN· 17 με beam-torsion+checks.

### §6.3-b Section-grow (DONE, UNCOMMITTED)
- **MOD** `sizing/member-sizing.ts` — εξαγωγή `designShearKn` (ΕΝΑ SSoT V_Ed) + `shearResistanceKn` (V_Rd,max) + NEW iterative `torsionDepthMm` + 5ο candidate `'torsion'` (`BeamSizingGovernedBy += 'torsion'`).
- **MOD** `sizing/beam-size-patch.ts` — `buildBeamSizePatch(entity, provider, supportTypeOverride?, designTorsionKnm?)` (thread).
- **MOD** `core/commands/entity-commands/AutoSizeMembersCommand.ts` — beam branch περνά `resolveActiveBeamTorsion(entityId)`.
- **MOD** `sizing/__tests__/member-sizing.test.ts` — +5 jest (torsion candidate grow / zero-regression / interaction ≤1 / monotonic / clamp). Suite 14 GREEN· 786 structural pass / 6 raft fail (ADR-476).

### §6.3-c Στρεπτικός οπλισμός (DONE, UNCOMMITTED — in-place bump)
- **MOD** `codes/suggest-reinforcement.ts` — NEW `resolveBeamTorsionDemand` (A_st/s + A_sl, reuse `torsionTubeProperties`) + `resolveBeamStirrups` (reuse `resolveMatMesh`) + A_sl/2 ανά παρειά στο `suggestBeamReinforcementFrom`.
- **MOD** `section-context.ts` — `resolveActiveBeamReinforcement(+designTorsionKnm?)`.
- **MOD** `active-reinforcement.ts` — `resolveActiveBeamReinforcementForEntity` περνά `resolveActiveBeamTorsion` (live render path).
- **MOD** `reinforce-patch.ts` — `buildReinforcePatch(+beamTorsionKnm?)` + `beamReinforcementMateriallyDiffers` += stirrups.
- **MOD** `core/commands/entity-commands/AutoReinforceOrganismCommand.ts` — ctor `beamTorsionByBeamId?` map.
- **MOD** `hooks/structural-auto-reinforce-core.ts` — `computeBeamDesignTorsion(entities)` → map → command.
- **MOD** `codes/__tests__/beam-reinforcement-suggest.test.ts` — +5 jest (zero-regression / A_sl bottom+top / A_st/s denser / monotonic). 1120 pass / 7 fail (6 raft ADR-476 + 1 pre-existing wall).

## 5. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **§6.3-c (στρεπτικός οπλισμός — πλήρες §6.3 ACTUATOR ΟΛΟΚΛΗΡΩΘΗΚΕ).** **In-place bump** (Giorgio-approved απόκλιση από handoff: αντί νέα type πεδία + νέο render, ο στρεπτικός χάλυβας μπαίνει στα πραγματικά bars → render + ΠΟΣΟΤΗΤΕΣ auto-follow, **μηδέν ADR-040 ρίσκο**). NEW `resolveBeamTorsionDemand` (`A_st/s=T_Ed/(2·A_k·f_yd)`, `A_sl=T_Ed·u_k/(2·A_k·f_yd)`, cotθ=1, reuse `torsionTubeProperties`) + `resolveBeamStirrups` (reuse `resolveMatMesh` — κλειστοί ≥ A_st/s, default code-min) + A_sl/2 ανά παρειά additive σε bottom/top. Threading live (`resolveActiveBeamReinforcementForEntity`→`resolveActiveBeamTorsion`) + persisted (`buildReinforcePatch`+`AutoReinforceOrganismCommand`+`structural-auto-reinforce-core`/`computeBeamDesignTorsion`). `beamReinforcementMateriallyDiffers` += stirrups (convergence guard για demand-driven συνδετήρες). 5 νέα jest, 1120 pass / 7 fail (6 raft + 1 wall, pre-existing). Ορθογώνιες v1. UNCOMMITTED. |
| 2026-06-19 | **§6.3-b (section-grow δοκαριού — auto-correct ACTUATOR).** EXTEND `member-sizing.ts`: εξαγωγή `designShearKn` (ΕΝΑ SSoT V_Ed, `shearDepthMm` το reuse) + `shearResistanceKn` (V_Rd,max) + NEW iterative `torsionDepthMm` (βήμα 50mm ώσπου `shearTorsionUtilization ≤ 1`· ανέφικτο→`BEAM_MAX_PRACTICAL_DEPTH_MM`) + 5ο candidate `governedBy:'torsion'`. Thread `buildBeamSizePatch(+designTorsionKnm?)` + `AutoSizeMembersCommand` beam branch `resolveActiveBeamTorsion`. Parity sensor↔actuator: interaction αυστηρότερη του classifier `T_Ed≤T_Rd,max` → growToFix warning σβήνει μόνο του. Convergence guard 50mm ήδη· κανένα νέο reactive trigger. 5 νέα jest (member-sizing→14), 786 structural pass / 6 raft fail (ADR-476). **DEFER §6.3-c στρεπτικός οπλισμός A_st/s+A_sl + 2Δ/3Δ render.** UNCOMMITTED. |
| 2026-06-19 | **§6.3-a (πλήρες EC2 §6.3 ACTUATOR — plumbing).** EXTEND `torsion-capacity.ts`: `torsionTubeProperties` (ΕΝΑ SSoT ισοδύναμου σωλήνα Ak/uk/tef· `plasticTorsionalResistanceKnm` το reuse → μηδέν inline) + `shearTorsionUtilization` (§6.3.2(4) διάτμηση-στρέψη). NEW `BeamTorsionStore` (`createDerivedMapStore<number>`) + `resolveActiveBeamTorsion` (mirror `resolveActiveBeamSupportType`). `BeamSectionContext += designTorsionKnm?` (additive) + threading στο `buildBeamSectionContext`. `useStructuralOrganism` → `BeamTorsionStore.set(computeBeamDesignTorsion)` (δίπλα στο SlabSupportConditionStore, κανένα νέο reactive trigger). St.Venant J (FEM) ΟΧΙ reused — σωστό SSoT = thin-wall tube. 6 νέα jest (torsion-capacity → 10), 17 με beam-torsion+checks. **DEFER §6.3-b section-grow + §6.3-c στρεπτικός οπλισμός/render.** UNCOMMITTED. |
| 2026-06-19 | **Slice D (global feasibility escalation — το ΜΟΝΑΔΙΚΟ `error`).** NEW `organism/feasibility-checks.ts` `runFeasibilityChecks` (πλάκα `!isFlexurallyAdequate@max thickness` + κολώνα `isColumnInfeasibleAtMaxSection` reuse `columnSectionFits@MAX` + δοκός-στρέψη `assessBeamTorsion→'infeasible'`). RE-ADD `flexural-capacity.isFlexurallyAdequate` (με consumer → CHECK 3.22). NEW `buildActiveColumnFemMomentMap` (engaged-gated, B2-parity). **Warning↔error dedup** (Giorgio «πάντα ΕΝΑ μήνυμα»): NEW shared `beam-torsion.classifyBeamTorsion`/`assessBeamTorsion` (`'ok'|'growToFix'|'infeasible'`)· C-v1 warning ΜΟΝΟ σε `growToFix`, D error ΜΟΝΟ σε `infeasible` → αμοιβαία αποκλειόμενα. ΕΝΑ i18n key `sectionInfeasibleAtMaxSize` (ICU select `memberKind`, el+en). Wired `useStructuralOrganism` — κανένα νέο reactive trigger. 25 jest GREEN· 775 structural pass· 6 fails = pre-existing raft (ADR-476). **DEFER: πλήρες §6.3 actuator** (section-grow + στρεπτικός οπλισμός + 2Δ/3Δ render). UNCOMMITTED. |
| 2026-06-19 | **Δημιουργία + Slice A.** Flexural-capacity ceiling (`M_Ed ≤ M_Rd,lim`). NEW `flexural-capacity.ts` SSoT + provider `flexuralLimitMuLim()`. Cap στον οπλισμό δοκαριού & πλάκας (saturation αντί ψεύτικου Ø25/75). 13 jest GREEN, 51 στο cluster, μηδέν regression. Roadmap B/C/D plan-first. UNCOMMITTED. |
| 2026-06-19 | **Slice C v1 (sensor).** Beam torsion από μονόπλευρη πρόβολο-πλάκα — DETECTION only. NEW `loads/beam-torsion.ts` (`computeBeamDesignTorsion`, ΕΝΑ SSoT: `t_Ed = slabDesignMomentNmmPerM` hogging/μέτρο, `T_Ed = t_Ed·L_cov/2`) + `codes/torsion-capacity.ts` (`plasticTorsionalResistanceKnm` = T_Rd,max EC2 §6.3.2) + `organism/beam-torsion-checks.ts` (`runBeamTorsionChecks` warning όταν `T_Ed>T_Rd,max`). `SlabSupportCondition` +`bearingBeamId`/`coverageLengthM`. Wired στο `useStructuralOrganism`. i18n el+en. 13 jest GREEN· 759 structural pass· 6 fails = pre-existing raft. **DEFER (νέα συνεδρία): πλήρες §6.3** (στρεπτικός οπλισμός + section-grow + shear-torsion interaction + διαμήκης). UNCOMMITTED. |
| 2026-06-19 | **Slice B2.** Auto-size **διατομής κολώνας** (ορθογώνιας). NEW `column-sizing.ts` (`suggestColumnSection` — iterative grow ώσπου `As,req≤ρ_max·A_c` + λυγηρότητα `height/λ_max`, reuse `asStrengthColumnMm2`/`buildColumnSectionContextFromParams`/`columnReinforcementLimits`) + `column-size-patch.ts` (`buildColumnSizePatch`, convergence guard 50mm) + `ColumnParams.autoSized`. `AutoSizeMembersCommand`/`member-auto-size-core` → column branch με engaged-gated FEM ροπή (`resolveActiveColumnFemMoment`, ADR-491). Latent fix `asStrengthColumnMm2` (καμπτική συνιστώσα μετρά πάντα). Scope v1 = `rectangular` (L/T/U/I/circular/wall DEFER). 17 νέα jest GREEN· 746 structural pass· 6 fails = pre-existing raft (ADR-476). **Κανένα νέο reactive trigger.** UNCOMMITTED. |
| 2026-06-19 | **Slice B1.** Auto-size πάχους πλάκας-προβόλου. NEW `slab-sizing.ts` (`suggestSlabThickness`) + `slab-size-patch.ts` (`buildSlabSizePatch`) + `capacityDepthMm` (αντιστροφή ceiling) + `SlabParams.autoSized`. `AutoSizeMembersCommand` έγινε **member-generic** (beam+slab). 16 νέα jest. Διόρθωση ADR-486 topology test (το cap κορέννυε & τα δύο σε ανεπαρκές section). 729 structural pass· 6 fails = pre-existing raft fixtures (ADR-476, `slab.geometry` undefined). UNCOMMITTED. |
