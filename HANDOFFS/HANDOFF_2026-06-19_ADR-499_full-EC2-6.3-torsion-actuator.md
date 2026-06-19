# HANDOFF — ADR-499: πλήρες EC2 §6.3 torsion ACTUATOR (section-grow + στρεπτικός οπλισμός + 2Δ/3Δ render)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (§3 ΕΝΑΣ οργανισμός, §4 «σε κάθε κίνηση recompute ΟΛΑ + αυτο-διόρθωση»). **ΜΕΤΑ** διάβασε ΟΛΟΚΛΗΡΟ το `docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md` (Slice A+B1+B2+C v1+D **ΟΛΑ DONE, UNCOMMITTED** — εκεί είναι όλο το context, τα SSoT modules, ο auto-correction loop).

**Ημ/νία:** 2026-06-19 · **Από:** Opus session (ολοκλήρωσε Slice D + grounded audit για §6.3) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST ανά sub-slice. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ** (ξανα-τρέξε — shared tree, ο κώδικας αλλάζει).
**Απαιτήσεις Giorgio (verbatim):** Revit/Robot-grade, **Full Enterprise + Full SSoT, ΧΩΡΙΣ ΔΙΠΛΟΤΥΠΑ**. Πριν κώδικα → πραγματικό grep audit για reuse.
**🚨 COMMIT + tsc = ο GIORGIO, ΟΧΙ εσύ.** jest = από repo ROOT. Επαλήθευση: live DB Firestore MCP (`proj_12788b6a`).
**🎯 Μοντέλο:** Opus (αρχιτεκτονική, cross-cutting). `/model opus`

---

## 0. ΤΟ ΟΡΑΜΑ + ΠΟΥ ΕΙΜΑΣΤΕ

ADR-487: η εφαρμογή = ο «επιβλέπων στατικός» που **αυτο-διορθώνει** διατομές + σίδηρο σε κάθε κίνηση. Ο C v1 (sensor) μόνο **ανιχνεύει** στρέψη (`T_Ed > T_Rd,max` → warning). Το πλήρες §6.3 είναι ο **ACTUATOR**: (α) **μεγαλώνει** τη διατομή της δοκού ώστε `T/T_Rd,max + V/V_Rd,max ≤ 1` και (β) βάζει **στρεπτικό οπλισμό** (κλειστοί συνδετήρες + διαμήκεις). Μετά απ' αυτό, το warning του C v1 σβήνει όταν η λύση είναι εφικτή· μένει μόνο το D error για το φυσικό αδύνατο.

**Repro (live DB, greek-legacy/C25/30):** 2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + **πλάκα-πρόβολος**. Μεγαλώνοντας τον πρόβολο, η μονόπλευρη πλάκα στρίβει τη φέρουσα δοκό. Σήμερα: warning (growToFix) ή error (infeasible). **Μετά το §6.3:** η δοκός **μεγαλώνει ύψος μόνη της** + παίρνει στρεπτικούς συνδετήρες· το warning σβήνει όταν λυθεί.

---

## 1. ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (ADR-499 A+B1+B2+C v1+D — ΟΛΑ UNCOMMITTED, ΜΗΝ ΤΑ ΞΑΝΑΓΡΑΨΕΙΣ)

Πλήρες context στο ADR-499 §2/§4. Σύνοψη των SSoT που θα **χρησιμοποιήσεις** στο §6.3:

| Module | Τι δίνει (έτοιμο) |
|---|---|
| `loads/beam-torsion.ts` | `computeBeamDesignTorsion(entities)→Map<beamId→T_Ed kNm>` (demand)· **`classifyBeamTorsion`/`assessBeamTorsion`** (3-level: ok/growToFix/infeasible — D) |
| `codes/torsion-capacity.ts` | `plasticTorsionalResistanceKnm(b,h,fcd)→T_Rd,max` (EC2 §6.3.2· `t_ef=A/u`, `A_k`, `T_Rd,max=0.6·fcd·A_k·t_ef` **inline**) |
| `codes/flexural-capacity.ts` | `limitMomentNmm`/`capacityDepthMm`/`flexuralCapacityCapFactor`/`isFlexurallyAdequate` |
| `sizing/member-sizing.ts` | `suggestBeamSection(provider, ctx)→{widthMm,depthMm,governedBy}`· **`VRD_MAX_COEFF=0.27`** (V_Rd,max SSoT)· `shearDepthMm` (V_Ed logic)· `BEAM_MAX_PRACTICAL_DEPTH_MM=1500`· module 50mm |
| `sizing/beam-size-patch.ts` | `buildBeamSizePatch(entity, provider, supportTypeOverride?)` (convergence guard 50mm) |
| `section-context.ts` | `buildBeamSectionContext(beam, supportTypeOverride?)→BeamSectionContext` |
| `codes/structural-code-types.ts` | `BeamSectionContext` (widthMm/depthMm/spanMm/supportType/designLineLoadKnM?/concreteGrade?) |
| `codes/suggest-reinforcement.ts` | `suggestBeamReinforcementFrom(provider, ctx)→BeamReinforcement`· `beamDesignMomentNmm`· `asStrengthBeamMm2`· `BEAM_LEVER_ARM_FACTOR=0.9`· `spanMomentDivisor` |
| `reinforcement/beam-reinforcement-types.ts` | `BeamReinforcement` {bottom/top/stirrups/coverMm/auto?}· `BeamStirrups` {diameterMm/spacingMm/spacingCriticalMm?/legs?/type?} |
| `organism/derived-map-store.ts` | `createDerivedMapStore<T>()` (SSoT factory για transient stores — Beam/Slab/ColumnBase) |
| `active-reinforcement.ts` | pattern `resolveActiveBeamSupportType`/`resolveActiveSlabSupportCondition`/`resolveActiveColumnFemMoment` (store-coupled resolvers)· `resolveActiveBeamReinforcementForEntity`· `resolveActiveBeamRebarLayout` |
| `hooks/useStructuralOrganism.ts` | organism pass — εδώ γράφονται τα transient stores (`SlabSupportConditionStore.set` κ.λπ.) |
| `reinforcement/beam-rebar-layout.ts` + `beam-rebar-2d.ts`/`beam-rebar-3d.ts` | render path (2Δ/3Δ) — εδώ μπαίνει το render στρεπτικού |

### 🔴 Pre-existing jest fails (ΟΧΙ δικά σου): **6 raft** (ADR-476) — `slab.geometry.maxFreeSpanM` undefined σε fixtures (`section-context.ts:453`). **Τελευταίο verified state: 775 structural pass / 6 fail.**

---

## 2. 🔧 ΔΙΟΡΘΩΣΕΙΣ AUDIT (κρίσιμες — επιβεβαιωμένες με grep+read στην προηγ. συνεδρία)

Το **παλιό** handoff (`...slice-D-global-feasibility...`) είχε 3 ανακρίβειες στους πίνακες §6.3. ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΑΥΤΕΣ:

1. **`analytical/solver/member-section-properties.ts` `rectangularTorsionConstant` = St.Venant J για FEM δυσκαμψία — ΟΧΙ EC2 §6.3 σχεδιασμό.** ΜΗΝ το reuse. Το σωστό SSoT για §6.3 είναι το **πλαστικό thin-wall tube** (`A_k`/`u_k`/`t_ef`) που είναι ΗΔΗ inline στο `torsion-capacity.ts` → **EXTEND το `torsion-capacity.ts`** (εξαγωγή helper `torsionTubeProperties(b,h)→{tEfMm,akMm2,ukMm}`, refactor ώστε το `plasticTorsionalResistanceKnm` να το ξαναχρησιμοποιεί → μηδέν inline duplicate).
2. **Οι τρέχοντες συνδετήρες δοκού = code-minimum** (`limits.minStirrupDiameterMm` + `roundSpacingDown(limits.maxStirrupSpacingMm)` στο `suggestBeamReinforcementFrom`), **ΟΧΙ demand-driven**. ΔΕΝ υπάρχει σήμερα `Asw/s` από V_Ed. Άρα ο στρεπτικός `A_st/s` θα είναι ο **πρώτος** demand-driven εγκάρσιος → πρέπει να συντεθεί **additively** με το code-minimum (`max`), όχι να το αντικαταστήσει.
3. **`classifyBeamTorsion`/`assessBeamTorsion` υπάρχουν ΗΔΗ** (μπήκαν στο Slice D, `loads/beam-torsion.ts`). ΜΗΝ τα ξαναγράψεις — χρησιμοποίησέ τα. Όταν το §6.3 actuator μεγαλώνει τη δοκό, το warning (growToFix) θα μετατρέπεται σε ok μόνο του (ο classifier ξανατρέχει στη νέα διατομή).

---

## 3. 🎯 ΠΑΡΑΔΟΤΕΟ — ΠΛΗΡΕΣ EC2 §6.3, σε 3 sub-slices (PLAN-FIRST ανά sub-slice)

### §6.3-a — Plumbing (demand → context → store)
**SSoT AUDIT GREP:** `torsion|T_Ed|designTorsion|BeamTorsionStore|tef|Ak`.
**REUSE:** `plasticTorsionalResistanceKnm` (extend), `VRD_MAX_COEFF` (V_Rd,max), `createDerivedMapStore`, `computeBeamDesignTorsion`, `buildBeamSectionContext`.
**NEW:**
```
torsion-capacity.ts → export torsionTubeProperties(b,h)→{tEfMm,akMm2,ukMm}   (refactor: plasticTorsionalResistanceKnm το reuse)
torsion-capacity.ts → export shearTorsionUtilization(tEd,tRdMax,vEd,vRdMax)=tEd/tRdMax + vEd/vRdMax   (EC2 §6.3.2(4))
organism/beam-torsion-store.ts → BeamTorsionStore = createDerivedMapStore<number>()   (T_Ed ανά beamId)
useStructuralOrganism.ts → BeamTorsionStore.set(computeBeamDesignTorsion(entities))   (δίπλα στο SlabSupportConditionStore.set)
active-reinforcement.ts → resolveActiveBeamTorsion(beamId): number|undefined   (mirror resolveActiveBeamSupportType· pure store read)
structural-code-types.ts → BeamSectionContext += designTorsionKnm?: number   (additive)
section-context.ts → buildBeamSectionContext(beam, supportTypeOverride?, designTorsionKnm?)   (thread το override)
```
**Μηχανική:** `T_Rd,max` ήδη. Πρόσθεσε `A_k=(b-t_ef)(h-t_ef)`, `u_k=2((b-t_ef)+(h-t_ef))` ως exported helpers (τώρα inline). `t_ef=A/u`. Όλα EC2 §6.3.2.

### §6.3-b — Section-grow (auto-correct — ΠΡΟΤΕΡΑΙΟΤΗΤΑ οράματος)
**REUSE:** `suggestBeamSection` (extend), `shearTorsionUtilization`, `buildBeamSizePatch` (extend), `AutoSizeMembersCommand` beam branch.
**NEW/EXTEND:**
```
member-sizing.ts → suggestBeamSection(provider, ctx) με ctx.designTorsionKnm → ΝΕΟΣ iterative torsion candidate ύψους
   ώσπου shearTorsionUtilization(T_Ed, T_Rd,max(b,h), V_Ed, V_Rd,max(b,h)) ≤ 1   (iterative: το T_Rd,max μη-γραμμικό στο h, όπως column B2)
   V_Ed: reuse το shearDepthMm logic (UDL αντίδραση w·L/2, πρόβολος w·L)· V_Rd,max=VRD_MAX_COEFF·fcd·b·d
beam-size-patch.ts → buildBeamSizePatch(entity, provider, supportTypeOverride?, designTorsionKnm?)   (thread)
AutoSizeMembersCommand.ts beam branch → περνά resolveActiveBeamTorsion(entityId)   (mirror resolveActiveBeamSupportType)
```
**Convergence guard:** ήδη 50mm-quantized στο `buildBeamSizePatch` → καθαρή σύγκλιση. **ΚΑΝΕΝΑ νέο reactive trigger** (μπαίνει στον υπάρχοντα `useProactiveMemberSizing` κύκλο). 🚨 μαθήματα ADR-491/488: μην προσθέσεις self-sustaining trigger.

### §6.3-c — Στρεπτικός οπλισμός (ΠΟΣΟΤΗΤΕΣ + 2Δ/3Δ RENDER — ο Giorgio διάλεξε render)
**SSoT AUDIT GREP:** `stirrup|Asw|A_st|legs|beam-rebar|BeamStirrups|longitudinal`.
**REUSE:** `suggestBeamReinforcementFrom` (extend additive), `BeamReinforcement`/`BeamStirrups` (additive fields), `beam-rebar-layout.ts`, `beam-rebar-2d.ts`/`beam-rebar-3d.ts`, `resolveActiveBeamRebarLayout`.
**NEW/EXTEND:**
```
beam-reinforcement-types.ts → BeamReinforcement additive torsion πεδία (στρεπτικοί κλειστοί A_st/s + διαμήκεις A_sl)
   π.χ. torsionStirrupAreaPerMetreMm2? + torsionLongitudinalAreaMm2? (additive, optional, non-breaking)
suggest-reinforcement.ts → suggestBeamReinforcementFrom: όταν ctx.designTorsionKnm>0:
   A_st/s = T_Ed/(2·A_k·f_yd·cotθ)   (κλειστοί συνδετήρες, additive στο code-min stirrup — max)
   A_sl   = T_Ed·u_k·cotθ/(2·A_k·f_yd)   (διαμήκεις γωνιακοί, additive στους υπάρχοντες)
   cotθ=1 (θ=45°, ίδιο με T_Rd,max). Reuse torsionTubeProperties(b,h) → A_k/u_k.
reinforce-patch.ts → buildReinforcePatch περνά τη στρέψη (mirror supportTypeOverride threading)
beam-rebar-layout.ts + beam-rebar-2d/3d → απεικόνιση στρεπτικού (επιπλέον κλειστοί + διαμήκεις γωνιακοί)
```
**Scope v1: ΟΡΘΟΓΩΝΙΕΣ δοκοί μόνο** (reuse `torsionTubeProperties` ορθογ.). Μη-ορθογώνιες = DEFER.
**⚠️ Render: ΠΡΟΣΟΧΗ ADR-040** — τα `beam-rebar-2d/3d` είναι pure renderers (διαβάζουν μέσω `resolveActiveBeamRebarLayout`). ΜΗΝ προσθέσεις `useSyncExternalStore` σε orchestrator. Διάβασε ADR-040 πριν αγγίξεις render path.

---

## 4. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST ανά sub-slice:** ADR-487 → ADR-499 → SSoT audit (grep) → reuse-vs-new πίνακας → plan → **περίμενε «προχώρα»** → code. Σειρά: **§6.3-a → §6.3-b → §6.3-c**.
- **Full SSoT (N.0.2):** EXTEND τα υπάρχοντα (`torsion-capacity`, `member-sizing`, `beam-size-patch`, `suggest-reinforcement`, `AutoSizeMembersCommand`, `beam-rebar-*`). ΜΗΝ φτιάξεις νέο engine. **Grep το ΔΙΚΟ σου diff** για closed-forms/duplicate πριν πεις «τελείωσα» (ο Giorgio κάνει αυστηρό SSoT audit).
- **GOL:** ≤40γρ/func, ≤500γρ/file (code), μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en αν προσθέσεις diagnostic/label), Select=`@/components/ui/select`.
- **Dead-code ratchet (CHECK 3.22):** ΜΗΝ export-άρεις helper πριν υπάρχει consumer — μπαίνει στο sub-slice που το καταναλώνει.
- **🚨 SHARED WORKING TREE:** **άλλος agent** δουλεύει ADR-496 column-align: `bim/columns/*`, `bim/geometry/column-geometry` (read-only), `bim/grips/grip-math`, `bim/validators/column-validator` (read-only), `useColumnParamsDispatcher`, `ADR-496*`. **git add ΜΟΝΟ τα δικά σου.** Δες `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` για το ποιος έχει τι (ADR-483 member-diagrams = άλλος).
- **commit + tsc = ο GIORGIO, ΟΧΙ εσύ** (N.(-1), N.17 ένα tsc τη φορά). **jest = από repo ROOT.** **Απάντα ΠΑΝΤΑ Ελληνικά.**
- **Μετά από ΚΑΘΕ sub-slice (N.15+N.0.1):** update ADR-499 (changelog+status) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (`reference_flexural_capacity_ceiling.md`).

## 5. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ (live DB — Firestore MCP, `proj_12788b6a`)
2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + πλάκα-πρόβολος. **Μετά §6.3:** μεγαλώνοντας τον πρόβολο → η φέρουσα **δοκός μεγαλώνει ύψος μόνη της** ώστε `T/T_Rd,max + V/V_Rd,max ≤ 1` + παίρνει **στρεπτικούς κλειστούς συνδετήρες + διαμήκεις** (ορατούς 2Δ+3Δ)· το C v1 warning σβήνει όταν η λύση είναι εφικτή· μένει μόνο το D error στο φυσικό αδύνατο.
