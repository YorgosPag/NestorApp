# HANDOFF — ADR-499 συνέχεια: Slice B2 (auto-size ΚΟΛΩΝΑΣ) → C (στρέψη δοκαριού) → D (global feasibility warning)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (§3 ΕΝΑΣ οργανισμός, §4 «σε κάθε κίνηση recompute ΟΛΑ + αυτο-διόρθωση», §5 δυναμική επανα-διαστασιολόγηση). **ΜΕΤΑ** διάβασε ΟΛΟΚΛΗΡΟ το `docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md` (Slice A + B1 ήδη υλοποιημένα — εκεί είναι όλο το context, τα SSoT modules και η αρχιτεκτονική του auto-correction loop).

**Ημ/νία:** 2026-06-19 · **Από:** Opus session (ολοκλήρωσε ADR-499 Slice A + B1, verified jest) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST ανά slice. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ** (ξανα-τρέξε — ο κώδικας αλλάζει).
**Απαιτήσεις Giorgio (verbatim):** Revit/Robot-grade, **Full Enterprise + Full SSoT, ΧΩΡΙΣ ΔΙΠΛΟΤΥΠΑ**. Πριν κώδικα → πραγματικό grep audit για reuse.

---

## 0. ΤΟ ΟΡΑΜΑ (γιατί υπάρχει αυτή η δουλειά)

ADR-487: η εφαρμογή = ο «επιβλέπων στατικός» που **αυτο-διορθώνει** διατομές + σίδηρο + οντότητες σε κάθε κίνηση του αρχιτέκτονα. **Warning ΜΟΝΟ** στην έσχατη, αποδεδειγμένα-αδύνατη περίπτωση (= Slice D). Η προειδοποίηση «μεγάλωσε το Χ» = αποτυχία του οράματος. Ο στόχος: ο μηχανικός να ΜΗΝ παρεμβαίνει.

**Repro (live DB Firestore `proj_12788b6a`, greek-legacy/C25/30):** 2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + **πλάκα-πρόβολος**. Μεγαλώνοντας τον πρόβολο 2.77m→7.48m, ο app έβγαζε **Ø25/75 σε πλάκα 200mm** + **4Ø32 σε δοκάρι 250×400** ως «λύση», με τις διατομές & κολώνες **αμετάβλητες** → κατάρρευση.

---

## 1. ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (ADR-499 Slice A + B1 — UNCOMMITTED, ΜΗΝ ΤΑ ΞΑΝΑΓΡΑΨΕΙΣ)

### Slice A — Flexural-capacity ceiling (η φυσική πύλη `M_Ed ≤ M_Rd,lim`)
- **NEW `bim/structural/codes/flexural-capacity.ts`** — ΕΝΑ SSoT: `limitMomentNmm(b,d,fcd,μ)` = μ·f_cd·b·d² (EC2 Annex A)· `flexuralCapacityCapFactor(mEd,mLim)` = min(1, M_lim/M_Ed)· `capacityDepthMm(mEd,fcd,μ,b)` = √(M/(μ·fcd·b)) (αντιστροφή).
- **Provider `flexuralLimitMuLim(): number`** (στο `StructuralCodeProvider` + EC2/ΕΚΩΣ = 0.295).
- Cap στον οπλισμό **δοκαριού** (`suggest-reinforcement.suggestBeamReinforcementFrom`) + **πλάκας** (`suggest-slab-reinforcement` suspended branch): ο χάλυβας κορεστεί στο A_s,lim αντί ψεύτικου Ø25/75. **🧠 ο cap = ratio M_lim/M_Ed → ο μοχλοβραχίονας z ακυρώνεται → μηδέν circular import.** cap=1 όταν επαρκεί → μηδέν regression.

### Slice B1 — Auto-size ΠΑΧΟΥΣ πλάκας-προβόλου
- **NEW `bim/structural/sizing/slab-sizing.ts`** — `suggestSlabThickness(provider,ctx)`: `d_req = max(L/d serviceability [slabSpanDepthLimit], capacityDepthMm)` → `thickness = d_req + cover` (module 10mm, clamp `MAX_PRACTICAL_SLAB_THICKNESS_MM=1200`). **Cantilever-only** (suspended+cantilever)· raft/simple = `undefined` (no-op).
- **NEW `bim/structural/sizing/slab-size-patch.ts`** — `buildSlabSizePatch` + `isSlabAutoSized` (composite `dna` & locked εξαιρούνται· convergence guard 10mm).
- **NEW `SlabParams.autoSized?: boolean`**.
- **`AutoSizeMembersCommand` έγινε MEMBER-GENERIC** (dispatch by kind: beam ύψος / slab πάχος· per-kind `compute*Geometry`+`validate*Params`· `SizePatchEntry` = `{entityId, entityType:'beam'|'slab', prev, next}`).
- **`hooks/member-auto-size-core.ts`** scope `isBeamEntity‖isSlabEntity` + per-kind emit μέσω `emitBimEntityParamsUpdated` (ADR-459 Φ7 SSoT).
- 29 νέα jest GREEN. **Convergence:** ο πρόβολος χρησιμοποιεί spatial `cantileverSpanMm` (footprint-independent) → καθαρή σύγκλιση· μπαίνει στον **ΥΠΑΡΧΟΝΤΑ** proactive κύκλο (`useProactiveMemberSizing`) — **κανένα νέο reactive trigger**.

### 🔴 Pre-existing jest fails (ΟΧΙ δικά σου, ΜΗΝ ανησυχήσεις): 6 raft (ADR-476) — `raft-bearing` (4) + `reinforcement-checks foundation-slab raft` (2). Αιτία: `slab.geometry` undefined σε fixtures (section-context.ts:453 `maxFreeSpanM`). Verified pre-existing.

### Πλήρης λίστα UNCOMMITTED αρχείων μου (A+B1) — git add ΜΟΝΟ αυτά:
```
NEW  bim/structural/codes/flexural-capacity.ts
NEW  bim/structural/codes/__tests__/flexural-capacity-ceiling.test.ts
NEW  bim/structural/sizing/slab-sizing.ts
NEW  bim/structural/sizing/slab-size-patch.ts
NEW  bim/structural/sizing/__tests__/slab-sizing.test.ts
NEW  bim/structural/sizing/__tests__/slab-size-patch.test.ts
MOD  bim/structural/codes/structural-code-types.ts        (flexuralLimitMuLim στο interface)
MOD  bim/structural/codes/eurocode-provider.ts            (μ_lim 0.295)
MOD  bim/structural/codes/greek-legacy-provider.ts        (μ_lim 0.295)
MOD  bim/structural/codes/suggest-reinforcement.ts        (beamDesignMomentNmm + beam cap)
MOD  bim/structural/codes/suggest-slab-reinforcement.ts   (slabDesignMomentNmmPerM export + slab cap)
MOD  bim/types/slab-types.ts                              (SlabParams.autoSized)
MOD  core/commands/entity-commands/AutoSizeMembersCommand.ts (member-generic beam+slab)
MOD  hooks/member-auto-size-core.ts                       (scope beam‖slab + per-kind emit)
MOD  bim/structural/__tests__/topology-aware-beam-support.test.ts (φορτίο εντός χωρητικότητας)
NEW  docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
MOD  docs/centralized-systems/reference/adr-index.md      (γραμμή ADR-499)
(local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt = gitignored, ενημερωμένο)
```

---

## 2. 🎯 SLICE B2 — Auto-size ΔΙΑΤΟΜΗΣ ΚΟΛΩΝΑΣ (το επόμενο)

**Στόχος:** η κολώνα στήριξης προβόλου (που τώρα μένει 400×400 ενώ το φορτίο εκτοξεύεται) να **αυτο-μεγαλώνει** ώστε `N_Ed ≤ N_Rd`, `As,req ≤ ρ_max·A_c` (η διατομή χωρά τον οπλισμό), και `λ ≤ λ_lim` (λυγηρότητα). Mirror του B1, στον ίδιο member-generic command.

### 2.1 🔴 SSoT AUDIT (GREP) — ΤΡΕΞΕ ΞΑΝΑ. Reuse vs new:

**REUSE (μην ξαναφτιάξεις):**
```
bim/structural/codes/flexural-capacity.ts            ← limitMomentNmm/capacityDepthMm (αν χρειαστεί M-N όριο)
bim/structural/codes/suggest-reinforcement.ts        ← asStrengthColumnMm2 (N-M demand As, ADR-472), nominalColumnMomentKnm, asMomentColumnMm2
bim/structural/section-context.ts                    ← buildColumnSectionContext / buildColumnSectionContextFromParams (designAxialKn, designMomentKnm, grossAreaMm2, heightMm, minThicknessMm, mode)
bim/structural/analytical/column-fem-axial.ts        ← FEM N_Ed (ADR-497, engaged-gated)
bim/structural/analytical/column-fem-moment.ts       ← FEM M_Ed (ADR-491)
bim/structural/active-reinforcement.ts               ← resolveActive* (πρότυπο για column N/M override resolver στον command — mirror resolveActiveSlabSupportCondition)
bim/geometry/column-geometry.ts                      ← computeColumnGeometry(params) [προφίλ optional — κάλεσέ το χωρίς, όπως UpdateColumnParamsCommand]
bim/validators/column-validator.ts                   ← validateColumnParams(params, codeId)  ⚠️ ΘΕΛΕΙ 2ο arg codeId = provider.id
bim/structural/sizing/member-sizing.ts               ← το pattern (BeamSizing/governedBy)· bim/structural/sizing/beam-size-patch.ts + slab-size-patch.ts = mirror
bim/types/column-types.ts                            ← MIN_COLUMN_DIMENSION_MM=250, MAX_SLENDERNESS_RATIO=30, MIN_SHEAR_WALL_THICKNESS_MM=150, DEFAULT_COLUMN_*
bim/structural/analytical/solver/member-section-properties.ts ← section A/I (radius of gyration i=√(I/A) για λ=l0/i)
core/commands/entity-commands/UpdateColumnParamsCommand.ts ← το geometry+validation recompute mirror (applyPatch: computeColumnGeometry + validateColumnParams(params, codeId))
```
**NEW (δεν υπάρχουν — grep confirmed):**
```
bim/structural/sizing/column-sizing.ts       ← suggestColumnSection(provider, ctx)  [NEW]
bim/structural/sizing/column-size-patch.ts   ← buildColumnSizePatch + isColumnAutoSized  [NEW]
ColumnParams.autoSized?: boolean             ← bim/types/column-types.ts  [NEW additive field]
slenderness / N_Rd / λ_lim                   ← ΔΕΝ ΥΠΑΡΧΟΥΝ πουθενά (μόνο σχόλια EC2 §5.8). NEW — βάλ' τα ΚΑΘΑΡΑ ως provider ή pure helpers (SSoT).
```

### 2.2 Προτεινόμενη μηχανική (Revit-grade, EC2)
`suggestColumnSection` μεγαλώνει τη **χαρακτηριστική διάσταση** ώσπου ΤΑΥΤΟΧΡΟΝΑ:
1. **Χωρά τον οπλισμό:** `As,req(N-M) ≤ ρ_max · A_c` (ρ_max=0.04, EC8). Το `As,req` = `asStrengthColumnMm2(ctx)` (ήδη N-M aware, ADR-472/491). Αν `As,req > ρ_max·A_c` → μεγάλωσε.
2. **Λυγηρότητα:** `λ = l0/i ≤ λ_lim` (EC2 §5.8.3.1: `λ_lim = 20·A·B·C/√n`, ή conservative `MAX_SLENDERNESS_RATIO=30`). `i = √(I/A)` (reuse member-section-properties).
3. (προαιρετικά) **N_Rd:** `N_Rd = α_cc·f_cd·A_c + f_yd·As,max`. Αν `N_Ed > N_Rd,max` → μεγάλωσε.
Τελική διάσταση = `max(όλων) ∨ MIN_COLUMN_DIMENSION_MM`, module 50mm, clamp `MAX_PRACTICAL` (NEW const, π.χ. 1200mm → Slice D).

### 2.3 ⚠️ SCOPE GUARD (κρίσιμο — shared tree + πολυπλοκότητα):
- **ΞΕΚΙΝΑ ΜΟΝΟ ΟΡΘΟΓΩΝΙΕΣ κολώνες** (`kind === 'rectangular'`· μεγάλωσε width &/ή depth). **DEFER L/T/U/I/circular/wall** shape-grow — αυτά είναι πολυδιάστατα ΚΑΙ τα `bim/columns/*` + `column-types` τα πειράζει ο **άλλος agent (ADR-496 column-align)**. Το `suggestColumnSection` επιστρέφει `undefined` για μη-ορθογώνιες (no-op) σε B2 v1.
- `ColumnParams.autoSized` = additive field (ασφαλές). Τα νέα `sizing/column-*` = δικά σου αρχεία (ασφαλή).

### 2.4 Wiring (mirror B1):
- `AutoSizeMembersCommand`: πρόσθεσε `else if (isColumnEntity(entity))` branch → `buildColumnSizePatch(entity, provider, <FEM N/M override resolver>)`. `SizePatchEntry.entityType` += `'column'`. `applyPatch` column branch: `computeColumnGeometry(p)` + `validateColumnParams(p, this.provider.id).bimValidation`.
- `member-auto-size-core`: scope `+isColumnEntity`. Το per-kind emit (`emitBimEntityParamsUpdated(entity.type, id)`) ήδη γενικό → δουλεύει για 'column' αυτόματα.
- Για το N/M override στον command: mirror `resolveActiveSlabSupportCondition` → φτιάξε/χρησιμοποίησε resolver που διαβάζει FEM N (`column-fem-axial`) + FEM M (`column-fem-moment`) engaged-gated (ADR-491/497). Δες πώς ο `structural-auto-reinforce-core` χτίζει `columnFemMomentById` + `buildPadFootingDesignInput` το FEM-N.

### 2.5 🚨 Convergence/infinite-loop (μαθήματα ADR-491/488):
Geometry change κολώνας → `bim:column-params-updated` → loads/FEM → re-trigger sizing → **convergence guard** (`columnSectionMateriallyDiffers` 50mm-quantized → null patch → STOP). Idempotent, σιωπηλά, μέσα στον υπάρχοντα proactive κύκλο — **ΜΗΝ προσθέσεις νέο reactive trigger**.

---

## 3. 🎯 SLICE C — Beam torsion από μονόπλευρο πρόβολο

**Πρόβλημα:** ο μονόπλευρος πρόβολος-πλάκα δίνει στρεπτική ροπή `T_Ed = q_Ed·L_cant²/2` ανά μέτρο στο φέρον δοκάρι· ένα 250×400 θα στριβόταν. **GREP confirmed:** `torsion` υπάρχει ΜΟΝΟ στον FEM solver (αποτέλεσμα) — **καμία σχεδίαση/έλεγχος**.
- **REUSE** `computeSlabSupportConditions` (ADR-498, `loads/slab-beam-support.ts`) — ξέρει ποια δοκός φέρει τον πρόβολο + `cantileverLengthM`. Reuse `SlabSupportConditionStore` / `resolveActiveSlabSupportCondition`.
- **NEW:** provider `torsionalResistanceMoment` / `suggestTorsionReinforcement` (EC2 §6.3: `T_Rd,max`, στρεπτικοί συνδετήρες + διαμήκης). Το `T_Ed` → επηρεάζει (α) **διατομή δοκαριού** (μέσω B-style sizer: ύψος/πλάτος) και (β) **συνδετήρες** (μέσω reinforce-patch).
- Σύνδεσε με: section-context (νέο `designTorsionKnm` πεδίο στο BeamSectionContext), suggest-reinforcement (στρεπτικός οπλισμός), member-sizing (torsion depth).
- **Plan-first.** Άνοιξε με grep audit για `torsion|T_Ed|stirrup`.

---

## 4. 🎯 SLICE D — Global feasibility escalation (warning ΜΟΝΟ εδώ)

Όταν το auto-size (B) φτάσει **πρακτικό μέγιστο** (`MAX_PRACTICAL_SLAB_THICKNESS_MM` / beam / column) και ΑΚΟΜΑ `M_Ed > M_Rd,lim` ή `λ > λ_lim` → **τότε** escalate diagnostic «ανέφικτο — απαιτείται αλλαγή σχεδιασμού (π.χ. στήριξη στην ελεύθερη άκρη)». Αυτή είναι η **έσχατη** παρέμβαση που ζητά ο Giorgio (ADR-487 §7).
- **REUSE** `StructuralDiagnostic` + `runSlabChecks` (ADR-498, `organism/slab-checks.ts`) + `runOrganismChecks`/`reinforcement-checks` pattern. Πρόσθεσε severity `'error'` code `sectionInfeasibleAtMaxSize` (i18n el+en — **ΟΧΙ hardcoded string, N.11**).
- Reuse `flexural-capacity.isFlexurallyAdequate` (πρόσθεσέ το ΤΩΡΑ που θα έχει consumer — στο A το αφαίρεσα ως dead-code).
- Εμφάνιση στο υπάρχον structural warning overlay (ADR-490).

---

## 5. ⚙️ Η ΑΡΧΗ — THE AUTO-CORRECTION LOOP (ADR-487 §4, κρίσιμο)
Σε κάθε structural event ο proactive κύκλος: **(1) resize διατομών** (B: slab✅/column/beam) ώστε M_Ed≤M_Rd,lim + L/d≤όριο + λ≤λ_lim + torsion OK → **(2) auto-reinforce** στη ΝΕΑ διατομή → **(3) re-check· iterate** μέχρι σύγκλιση Ή **escalate (D)**. Σειρά mount: `useProactiveMemberSizing` (size) **ΠΡΙΝ** `useProactiveOrganismReinforce` (reinforce). `useStructuralOrganism` = **pure diagnostics** (ΟΧΙ sizing/reinforce). **ΜΗΝ** προσθέσεις self-sustaining reactive trigger — convergence guard (materiallyDiffers quantized) σε ΚΑΘΕ patch builder.

---

## 6. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST ανά slice:** ADR-487 read → ADR-499 read → SSoT audit (grep) → reuse-vs-new πίνακας → plan → **περίμενε «προχώρα»** → code. Σειρά: **B2 → C → D**.
- **Full SSoT (N.0.2):** EXTEND `member-sizing`/`AutoSizeMembersCommand` (ήδη member-generic μετά το B1). Capacity = `flexural-capacity` SSoT. ΜΗΝ φτιάξεις νέο sizing engine/duplicate. **Grep το ΔΙΚΟ σου diff** για closed-forms/vertex-loops πριν πεις «τελείωσα» (ο Giorgio κάνει αυστηρό SSoT audit).
- **GOL:** ≤40γρ/func, ≤500γρ/file (code), μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en αν UI — Slice D warning!), Select=`@/components/ui/select`.
- **Dead-code ratchet (CHECK 3.22):** ΜΗΝ export-άρεις helper/predicate πριν υπάρχει consumer (knip block). Π.χ. το `isFlexurallyAdequate` μπαίνει στο D μαζί με τον consumer του.
- **🚨 SHARED TREE:** ο **άλλος agent** δουλεύει ADR-496 column-align: `bim/columns/*`, `bim/geometry/{column-geometry προσοχή — το διαβάζεις μόνο}, shared/polygon-*`, `bim/grips/grip-math`, `bim/validators/column-validator` (διάβασέ το, ΜΗΝ το αλλάξεις), `useColumnParamsDispatcher`, `ADR-496*`. **git add ΜΟΝΟ τα δικά σου.** Το `ColumnParams.autoSized` (additive) + τα `sizing/column-*` (NEW) είναι ασφαλή· αν χρειαστεί edit σε `column-types.ts`/`AutoSizeMembersCommand.ts`, είναι δικά σου αλλά συντονίσου (μικρό additive).
- **commit + tsc = ο GIORGIO, ΟΧΙ εσύ** (N.(-1), N.17 ένα tsc τη φορά). **jest = από repo ROOT.** **Απάντα ΠΑΝΤΑ Ελληνικά.**
- **Μετά από ΚΑΘΕ slice (N.15+N.0.1):** update ADR-499 (changelog+status) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (`reference_flexural_capacity_ceiling.md`).

## 7. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ (live DB — Firestore MCP)
Project `proj_12788b6a`. 2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + πλάκα-πρόβολος. **Μετά B2:** η κολώνα στήριξης αυτο-μεγαλώνει με τον πρόβολο (σύγκρινε width/depth πριν/μετά)· κλειδωμένη (`autoSized:false`) δεν αλλάζει. **Μετά C:** το δοκάρι μεγαλώνει/οπλίζεται για στρέψη. **Μετά D:** warning ΜΟΝΟ όταν φυσικά αδύνατο στο μέγιστο.
```
🎯 Μοντέλο: Opus (αρχιτεκτονική, cross-cutting). /model opus
```
