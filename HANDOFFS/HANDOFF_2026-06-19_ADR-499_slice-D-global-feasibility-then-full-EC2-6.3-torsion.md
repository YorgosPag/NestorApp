# HANDOFF — ADR-499 συνέχεια: Slice D (global feasibility escalation) → πλήρες EC2 §6.3 torsion (actuator)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (§3 ΕΝΑΣ οργανισμός, §4 «σε κάθε κίνηση recompute ΟΛΑ + αυτο-διόρθωση», §7 αυτο-διορθούμενη μελέτη — warning ΜΟΝΟ στην έσχατη, αποδεδειγμένα-αδύνατη περίπτωση). **ΜΕΤΑ** διάβασε ΟΛΟΚΛΗΡΟ το `docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md` (Slice A + B1 + B2 + C v1 ήδη υλοποιημένα — εκεί είναι όλο το context, τα SSoT modules, ο auto-correction loop).

**Ημ/νία:** 2026-06-19 · **Από:** Opus session (ολοκλήρωσε ADR-499 Slice B2 + C v1, verified jest) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST ανά slice. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ** (ξανα-τρέξε — ο κώδικας αλλάζει, shared tree).
**Απαιτήσεις Giorgio (verbatim):** Revit/Robot-grade, **Full Enterprise + Full SSoT, ΧΩΡΙΣ ΔΙΠΛΟΤΥΠΑ**. Πριν κώδικα → πραγματικό grep audit για reuse.
**🚨 COMMIT + tsc = ο GIORGIO, ΟΧΙ εσύ.** jest = από repo ROOT. Επαλήθευση: live DB Firestore MCP (`proj_12788b6a`).

---

## 0. ΤΟ ΟΡΑΜΑ (γιατί υπάρχει αυτή η δουλειά)

ADR-487: η εφαρμογή = ο «επιβλέπων στατικός» που **αυτο-διορθώνει** διατομές + σίδηρο σε κάθε κίνηση του αρχιτέκτονα. **Warning ΜΟΝΟ** στην έσχατη, αποδεδειγμένα-αδύνατη περίπτωση (= Slice D). Η αυτο-διόρθωση στρέψης (πλήρες §6.3) είναι ο «actuator» πάνω στον sensor που μόλις μπήκε (C v1).

**Repro (live DB, greek-legacy/C25/30):** 2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + **πλάκα-πρόβολος**. Μεγαλώνοντας τον πρόβολο 2.77m→7.48m, ο app έβγαζε Ø25/75 σε πλάκα 200mm + 4Ø32 σε δοκάρι 250×400 + κολώνες αμετάβλητες → κατάρρευση. **Λύθηκε** A→cap, B1→πάχος πλάκας, B2→διατομή κολώνας, C v1→ανίχνευση στρέψης δοκού. **Μένει** D (escalation στο φυσικό αδύνατο) + πλήρης στρεπτικός σχεδιασμός.

---

## 1. ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (ADR-499 A+B1+B2+C v1 — ΟΛΑ UNCOMMITTED, ΜΗΝ ΤΑ ΞΑΝΑΓΡΑΨΕΙΣ)

### Slice A — Flexural-capacity ceiling (`M_Ed ≤ M_Rd,lim`)
- **`codes/flexural-capacity.ts`** SSoT: `limitMomentNmm(b,d,fcd,μ)`=μ·f_cd·b·d²· `flexuralCapacityCapFactor(mEd,mLim)`=min(1,M_lim/M_Ed)· `capacityDepthMm(M,fcd,μ,b)`=√(M/(μ·fcd·b)). Provider `flexuralLimitMuLim()`=0.295. Cap στον οπλισμό δοκαριού+πλάκας (saturation αντί ψεύτικου Ø25/75).
- ⚠️ **`isFlexurallyAdequate` ΔΕΝ υπάρχει** (το αφαίρεσε ο A ως dead-code, CHECK 3.22). **Πρόσθεσέ το στο D** μαζί με τον consumer του.

### Slice B1 — Auto-size ΠΑΧΟΥΣ πλάκας-προβόλου
- **`sizing/slab-sizing.ts`** `suggestSlabThickness` (d_req=max(L/d, `capacityDepthMm`)+cover· module 10mm· clamp **`MAX_PRACTICAL_SLAB_THICKNESS_MM=1200`**· cantilever-only). **`sizing/slab-size-patch.ts`** `buildSlabSizePatch` (convergence guard 10mm). `SlabParams.autoSized`.

### Slice B2 — Auto-size ΔΙΑΤΟΜΗΣ ορθογ. ΚΟΛΩΝΑΣ
- **`sizing/column-sizing.ts`** `suggestColumnSection(provider, params, femMomentKnm?)`: **iterative** grow (square-equiv, upward-only, module 50mm) ώσπου `As,req≤ρ_max·A_c` (reuse `asStrengthColumnMm2` N-M) + λυγηρότητα `min(w,d)≥height/MAX_SLENDERNESS_RATIO`· clamp **`MAX_PRACTICAL_COLUMN_DIMENSION_MM=1200`**· returns `{widthMm, depthMm, governedBy:'reinforcement'|'slenderness'|'minimum'}`. **`sizing/column-size-patch.ts`** `buildColumnSizePatch` + `isColumnAutoSized`. `ColumnParams.autoSized`. **Μόνο `rectangular`** (L/T/U/I/circular/wall=DEFER).
- **Latent fix:** `asStrengthColumnMm2` έκανε `if(N≤0) return 0` αγνοώντας την καμπτική συνιστώσα → τώρα η ροπή μετρά ΠΑΝΤΑ (αξονική μόνο σε θλίψη).
- `AutoSizeMembersCommand` = **member-generic** (beam ύψος + slab πάχος + column διατομή· dispatch by kind)· `member-auto-size-core` scope beam‖slab‖column.

### Slice C v1 — Beam torsion SENSOR (ανίχνευση, ΟΧΙ διόρθωση)
- **ΕΝΑ SSoT:** το hogging της προβόλου-πλάκας ανά μέτρο = **`slabDesignMomentNmmPerM`** (q·L²/2, ήδη σε οπλισμό+sizing) **ΕΙΝΑΙ** ο κατανεμημένος στρεπτικός φόρτος `t_Ed` (kNm/m).
- **`loads/beam-torsion.ts`** `computeBeamDesignTorsion(entities)`→`Map<beamId→T_Ed (kNm)>` (`T_Ed = t_Ed·L_cov/2`, αντίδραση στρεπτικά-πακτωμένης δοκού· reuse `computeSlabSupportConditions`).
- **`SlabSupportCondition`** +additive `bearingBeamId?`/`coverageLengthM?` (populated στο cantilever branch).
- **`codes/torsion-capacity.ts`** `plasticTorsionalResistanceKnm(b,h,fcd)`=`T_Rd,max` (EC2 §6.3.2 solid→thin-wall tube: `tef=A/u`, `Ak=(b-tef)(h-tef)`, `T_Rd,max=0.6·fcd·Ak·tef`· ν₁=0.6, cotθ=1). **ΒΑΣΙΚΟ μόνο** (θλιπτήρας).
- **`organism/beam-torsion-checks.ts`** `runBeamTorsionChecks(entities)`→warning **ΜΟΝΟ** όταν `T_Ed>T_Rd,max` (mirror `runSlabChecks`). Wired στο `useStructuralOrganism` diagnostics pass. diagnostic code `beamCantileverTorsionExceedsCapacity` + i18n el+en.

### 🔴 Pre-existing jest fails (ΟΧΙ δικά σου, ΜΗΝ ανησυχήσεις): **6 raft** (ADR-476) — `raft-bearing` (4) + `reinforcement-checks foundation-slab raft` (2). Αιτία: `slab.geometry.maxFreeSpanM` undefined σε fixtures (`section-context.ts:453`). Verified pre-existing. **Τελευταίο verified state: 759 structural pass / 6 fail.**

### Πλήρης λίστα UNCOMMITTED αρχείων (A+B1+B2+C v1) — git add ΜΟΝΟ αυτά:
```
# Slice A+B1
NEW  src/subapps/dxf-viewer/bim/structural/codes/flexural-capacity.ts (+__tests__/flexural-capacity-ceiling.test.ts)
MOD  src/subapps/dxf-viewer/bim/structural/codes/{structural-code-types,eurocode-provider,greek-legacy-provider,suggest-reinforcement,suggest-slab-reinforcement}.ts
NEW  src/subapps/dxf-viewer/bim/structural/sizing/{slab-sizing,slab-size-patch}.ts (+__tests__/{slab-sizing,slab-size-patch}.test.ts)
MOD  src/subapps/dxf-viewer/bim/types/slab-types.ts
# Slice B2
NEW  src/subapps/dxf-viewer/bim/structural/sizing/{column-sizing,column-size-patch}.ts (+__tests__/{column-sizing,column-size-patch}.test.ts)
MOD  src/subapps/dxf-viewer/bim/types/column-types.ts
MOD  src/subapps/dxf-viewer/core/commands/entity-commands/AutoSizeMembersCommand.ts
MOD  src/subapps/dxf-viewer/hooks/member-auto-size-core.ts
MOD  src/subapps/dxf-viewer/bim/structural/__tests__/topology-aware-beam-support.test.ts
# Slice C v1
NEW  src/subapps/dxf-viewer/bim/structural/loads/beam-torsion.ts (+__tests__/beam-torsion.test.ts)
NEW  src/subapps/dxf-viewer/bim/structural/codes/torsion-capacity.ts (+__tests__/torsion-capacity.test.ts)
NEW  src/subapps/dxf-viewer/bim/structural/organism/beam-torsion-checks.ts (+__tests__/beam-torsion-checks.test.ts)
MOD  src/subapps/dxf-viewer/bim/structural/loads/slab-beam-support.ts
MOD  src/subapps/dxf-viewer/bim/structural/organism/structural-organism-types.ts
MOD  src/subapps/dxf-viewer/hooks/useStructuralOrganism.ts
MOD  src/i18n/locales/{el,en}/dxf-viewer-shell.json
# Docs (ίδιο commit)
NEW  docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
MOD  docs/centralized-systems/reference/adr-index.md
(local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt = gitignored, ενημερωμένο)
```

---

## 2. 🎯 ΠΑΡΑΔΟΤΕΟ 1 — SLICE D: Global feasibility escalation (το «ανέφικτο» warning)

**Στόχος (ADR-487 §7 — η ΜΟΝΑΔΙΚΗ έσχατη παρέμβαση):** όταν το auto-size φτάσει το **πρακτικό μέγιστο** (`MAX_PRACTICAL_{SLAB_THICKNESS,COLUMN_DIMENSION}_MM` / `BEAM_MAX_PRACTICAL_DEPTH_MM`) και η διατομή είναι **ΑΚΟΜΑ ανεπαρκής** → escalate diagnostic **severity `error`** «ανέφικτο — απαιτείται αλλαγή σχεδιασμού (π.χ. στήριξη ελεύθερης άκρης)». Εδώ ο οργανισμός «παραδίδεται στον άνθρωπο».

### 2.1 🔴 SSoT AUDIT (GREP) — ΤΡΕΞΕ ΞΑΝΑ. Reuse vs new:
**REUSE:**
```
sizing/slab-sizing.ts        ← MAX_PRACTICAL_SLAB_THICKNESS_MM + suggestSlabThickness (governedBy)
sizing/column-sizing.ts      ← MAX_PRACTICAL_COLUMN_DIMENSION_MM + suggestColumnSection (governedBy)
sizing/member-sizing.ts      ← BEAM_MAX_PRACTICAL_DEPTH_MM + suggestBeamSection (governedBy)
codes/flexural-capacity.ts   ← limitMomentNmm (M_Rd,lim @max section) — η πύλη
codes/torsion-capacity.ts    ← plasticTorsionalResistanceKnm (T_Rd,max @max section)
codes/suggest-reinforcement.ts ← asStrengthColumnMm2 (As,req κολώνας @max)
organism/slab-checks.ts + organism/beam-torsion-checks.ts ← ΤΟ PATTERN (StructuralDiagnostic runner)
organism/structural-organism-types.ts ← StructuralDiagnostic + StructuralDiagnosticCode union
hooks/useStructuralOrganism.ts ← diagnostics pass (όπου μπαίνει το νέο runner)
bim/structural/section-context.ts ← buildBeamSectionContext / buildColumnSectionContextFromParams / buildSlabFoundationSectionContext
overlay ADR-490 (structural warning overlay) ← ΗΔΗ δείχνει diagnostics (μηδέν νέο UI)
```
**NEW:**
```
organism/feasibility-checks.ts → runFeasibilityChecks(entities, provider): StructuralDiagnostic[]   [NEW]
codes/flexural-capacity.ts → isFlexurallyAdequate(mEd, mLim): boolean   [RE-ADD — τώρα έχει consumer (feasibility-checks)]
StructuralDiagnosticCode += 'sectionInfeasibleAtMaxSize'   [additive union]
i18n el+en: structuralOrganism.diagnostics.sectionInfeasibleAtMaxSize   [N.11]
```

### 2.2 Μηχανική (μηδέν νέο engine — re-evaluate adequacy ΣΤΗΝ clamped διάσταση)
Ο sizer ήδη clamp-άρει στο MAX. Το D ρωτά ανά auto-sized μέλος: «είσαι στο MAX **ΚΑΙ** ακόμα ανεπαρκής;»
- **Πλάκα-πρόβολος:** `suggestSlabThickness` επιστρέφει `thicknessMm === MAX_PRACTICAL_SLAB_THICKNESS_MM` **ΚΑΙ** `!isFlexurallyAdequate(M_Ed, M_Rd,lim@max)` → error.
- **Κολώνα:** `suggestColumnSection` επιστρέφει διάσταση `=== MAX_PRACTICAL_COLUMN_DIMENSION_MM` **ΚΑΙ** `asStrengthColumnMm2 > ρ_max·A_c @max` → error.
- **Δοκάρι (στρέψη):** `T_Ed > T_Rd,max` ήδη στο `beam-torsion-checks` (C v1 warning)· το D **κλιμακώνει** σε `error` αν `T_Ed > T_Rd,max` **και** το ύψος είναι στο `BEAM_MAX_PRACTICAL_DEPTH_MM` (ή αναμένει τον §6.3 actuator — δες ΠΑΡΑΔΟΤΕΟ 2· συντονισμός σειράς).
Severity **`error`** (vs τα `warning` των B/C). Wired στο `useStructuralOrganism` diagnostics pass (μηδέν νέο reactive trigger).

### 2.3 ⚠️ SCOPE GUARD
- Diagnostic-only (δείχνει στο υπάρχον overlay ADR-490). **ΜΗΝ** προσθέσεις νέο reactive trigger.
- **CHECK 3.22 dead-code:** το `isFlexurallyAdequate` μπαίνει **ΜΑΖΙ** με τον consumer (`feasibility-checks.ts`) — αλλιώς knip block.

---

## 3. 🎯 ΠΑΡΑΔΟΤΕΟ 2 — ΠΛΗΡΕΣ EC2 §6.3 TORSION (ο actuator πάνω στον C v1 sensor)

**Στόχος:** ο C v1 μόνο **ανιχνεύει** (`T_Ed > T_Rd,max` → warning). Το πλήρες §6.3 **αυτο-διορθώνει** (όραμα §4): (α) **section-grow** του δοκαριού + (β) **στρεπτικός οπλισμός**. Μετά απ' αυτό, το warning του C v1 σβήνει όταν η λύση είναι εφικτή· μένει μόνο το D για το φυσικό αδύνατο.

### 3.1 🔴 SSoT AUDIT (GREP) — ΤΡΕΞΕ: `torsion|T_Ed|stirrup|Asw|A_st`. Reuse vs new:
**REUSE (το θεμέλιο μπήκε στο C v1):**
```
loads/beam-torsion.ts        ← computeBeamDesignTorsion (T_Ed demand) — ΕΤΟΙΜΟ
codes/torsion-capacity.ts    ← plasticTorsionalResistanceKnm (T_Rd,max) — επέκτεινε με Ak/uk/tef helpers
analytical/solver/member-section-properties.ts ← rectangularTorsionConstant (J) ΗΔΗ υπάρχει
codes/suggest-reinforcement.ts ← suggestBeamReinforcementFrom (beam stirrups path — additive στρεπτικοί)
sizing/member-sizing.ts      ← suggestBeamSection (torsion-depth candidate — section grow)
sizing/beam-size-patch.ts    ← buildBeamSizePatch (περνά torsion override, mirror supportTypeOverride)
reinforce-patch.ts + active-reinforcement.ts ← το pattern για store-coupled override resolver
reinforcement/beam-reinforcement-types.ts ← BeamReinforcement (additive torsion stirrup/longitudinal fields)
SlabSupportCondition.bearingBeamId/coverageLengthM ← ΕΤΟΙΜΑ (C v1)
```
**NEW (πλήρες §6.3, EC2 §6.3.2-§6.3.3):**
```
NEW transient BeamTorsionStore (mirror SlabSupportConditionStore· γράψε στο useStructuralOrganism δίπλα στο SlabSupportConditionStore.set)
NEW resolveActiveBeamTorsion(beamId) στο active-reinforcement (mirror resolveActiveSlabSupportCondition)
NEW BeamSectionContext.designTorsionKnm (additive· περνά override μέσω buildBeamSectionContext)
NEW provider torsion methods: A_st/s = T_Ed/(2·A_k·f_yd·cotθ) (στρεπτικοί συνδετήρες) + διαμήκης A_sl = T_Ed·u_k·cotθ/(2·A_k·f_yd)
NEW shear-torsion interaction: T_Ed/T_Rd,max + V_Ed/V_Rd,max ≤ 1 (στο member-sizing depth candidate + στο reinforce)
section-grow: torsion candidate στο suggestBeamSection (ύψος/πλάτος ώστε interaction ≤ 1)
```

### 3.2 Μηχανική
1. **T_Rd,max ήδη** (C v1). Πρόσθεσε `A_k = (b-tef)(h-tef)`, `u_k = 2((b-tef)+(h-tef))` ως exported helpers στο `torsion-capacity.ts` (τώρα είναι inline).
2. **Section-grow** (auto-correct, ΠΡΟΤΕΡΑΙΟΤΗΤΑ οράματος): `suggestBeamSection` με `designTorsionKnm` → νέος candidate ύψους ώστε `T_Ed/T_Rd,max + V_Ed/V_Rd,max ≤ 1`. Iterative (όπως column B2 — το T_Rd,max είναι μη-γραμμικό στο h).
3. **Στρεπτικός οπλισμός** στη ΝΕΑ διατομή: κλειστοί συνδετήρες `A_st/s` (additive στους διατμητικούς) + διαμήκεις γωνιακοί `A_sl`.
4. **Wiring:** `AutoSizeMembersCommand` beam branch περνά `resolveActiveBeamTorsion(id)` στο `buildBeamSizePatch` (mirror `resolveActiveBeamSupportType`). `reinforce-patch` περνά torsion στον beam reinforce.

### 3.3 ⚠️ SCOPE GUARD
- **Ορθογώνιες δοκοί μόνο** v1 (reuse `rectangularTorsionConstant`). Μη-ορθογώνιες = DEFER.
- **Convergence guard** σε ΚΑΘΕ νέο patch (mirror B): geometry change → loads/FEM → re-trigger → quantized materiallyDiffers → STOP. **ΜΗΝ** προσθέσεις self-sustaining reactive trigger (μαθήματα ADR-491/488).
- **Σειρά mount:** `useProactiveMemberSizing` (size) ΠΡΙΝ `useProactiveOrganismReinforce` (reinforce). `useStructuralOrganism` = pure diagnostics.

---

## 4. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST ανά slice:** ADR-487 → ADR-499 → SSoT audit (grep) → reuse-vs-new πίνακας → plan → **περίμενε «προχώρα»** → code. Σειρά: **D → πλήρες §6.3**.
- **Full SSoT (N.0.2):** EXTEND τα υπάρχοντα (`flexural-capacity`, `torsion-capacity`, `member-sizing`, `AutoSizeMembersCommand`, diagnostics runners). ΜΗΝ φτιάξεις νέο engine/duplicate. **Grep το ΔΙΚΟ σου diff** για closed-forms/vertex-loops πριν πεις «τελείωσα» (ο Giorgio κάνει αυστηρό SSoT audit).
- **GOL:** ≤40γρ/func, ≤500γρ/file (code), μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en — τα warnings!), Select=`@/components/ui/select`.
- **Dead-code ratchet (CHECK 3.22):** ΜΗΝ export-άρεις helper/predicate πριν υπάρχει consumer (π.χ. `isFlexurallyAdequate` → μαζί με feasibility-checks).
- **🚨 SHARED TREE:** **άλλος agent** δουλεύει ADR-496 column-align: `bim/columns/*`, `bim/geometry/column-geometry` (read-only), `bim/grips/grip-math`, `bim/validators/column-validator` (read-only), `useColumnParamsDispatcher`, `ADR-496*`. **git add ΜΟΝΟ τα δικά σου.** Έλεγξε ποιος έχει τα ADR-483 (member-diagrams) — δες `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
- **commit + tsc = ο GIORGIO, ΟΧΙ εσύ** (N.(-1), N.17 ένα tsc τη φορά). **jest = από repo ROOT.** **Απάντα ΠΑΝΤΑ Ελληνικά.**
- **Μετά από ΚΑΘΕ slice (N.15+N.0.1):** update ADR-499 (changelog+status) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (`reference_flexural_capacity_ceiling.md`).

## 5. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ (live DB — Firestore MCP)
Project `proj_12788b6a`. 2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + πλάκα-πρόβολος. **Μετά D:** όταν ο πρόβολος γίνει τεράστιος ώστε ούτε το MAX πάχος/διατομή να αρκεί → `error` «ανέφικτο». **Μετά §6.3:** το δοκάρι μεγαλώνει + παίρνει στρεπτικούς συνδετήρες· το C v1 warning σβήνει όταν η λύση είναι εφικτή.
```
🎯 Μοντέλο: Opus (αρχιτεκτονική, cross-cutting). /model opus
```
