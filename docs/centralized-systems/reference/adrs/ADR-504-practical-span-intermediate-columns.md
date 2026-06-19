# ADR-504 — Practical-span advisory + opt-in ενδιάμεσες κολώνες (Revit-grade)

**Status:** 🟡 Φάση 1 DONE (practical-span soft warning, PURE) · Φάση 2 DONE (S0-S3: continuous μηχανική + topology span model + SSoT wiring· **S4-S6: even-split θέσεις + FEM subdivision + opt-in action/confirm**) — UNCOMMITTED 2026-06-19 · 🔴 browser-verify + commit
**Date:** 2026-06-19
**Υλοποιεί:** ADR-487 §8.4 (ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί) + §9 (scope guard: Revit-grade, ΟΧΙ Robot/SAP)
**Σχετικά:** ADR-499 (auto-correcting organism / global feasibility §D — το hard `error` επίπεδο), ADR-475 (auto member sizing), ADR-486 (topology-aware beam support), ADR-448/450 (storey context SSoT)

---

## 1. Πρόβλημα (Giorgio)

Στιγμιότυπο 2026-06-19: αρχικό πλαίσιο ~5×5m με 4 κολώνες/2 δοκάρια· ο Giorgio έσυρε 2 κολώνες ~11m δεξιά → η μελέτη υπολόγισε **δοκάρι 250×1450mm σε άνοιγμα 16.46m**. Παρατήρηση: **κατασπατάληση χώρου + υλικών + χρημάτων** (1.45m βάθος = δεν περνάς από κάτω).

**Αίτημα:** πάνω από ένα όριο ύψους δοκαριού, η εφαρμογή να **προτείνει** ενδιάμεσες κολώνες (αντί για 2 τεράστια δοκάρια → π.χ. 6 κολώνες + λογικά δοκάρια). **ΑΛΛΑ** σε αίθριο/αίθουσα/πυλωτή ο μηχανικός **θέλει** το μεγάλο δοκάρι → η λύση **ΔΕΝ** επιβάλλεται σιωπηλά.

**Φιλοσοφία μεγάλων (Revit/Robot/ETABS/Generative):** το layout = απόφαση μηχανικού· το λογισμικό **βελτιστοποιεί μέσα του + προειδοποιεί** (utilization/βέλος), προτείνει εναλλακτικούς κανάβους ως **opt-in**, ποτέ σιωπηλά. Ταιριάζει 1:1 με ADR-487 §8.4.

## 2. Διάγνωση — Practical ≠ Feasible

- Ο auto-sizer (ADR-475/499) κάνει σωστά τη δουλειά του: 16.46m → EC2 §7.4.2 (βέλος) απαιτεί ~1450mm, **οριακά κάτω** από το hard cap `BEAM_MAX_PRACTICAL_DEPTH_MM = 1500`.
- **Μηχανικά σωστό, σχεδιαστικά ελλιπές.** Έλειπε το επίπεδο «αυτό το άνοιγμα είναι **μη-πρακτικό** (όχι ανέφικτο) → λογική λύση = ενδιάμεση στήριξη».
- Το feasibility (ADR-499 §D) βγάζει `error` ΜΟΝΟ όταν ανέφικτο στο max (1500mm). Το 1450 δεν πιάνεται → χρειάζεται **soft `warning`** επίπεδο **κάτω** από το hard cap. Διαφορετικός code → μηδέν διπλό μήνυμα.

## 3. Δυναμικό threshold — έρευνα ΝΟΚ / Κτιριοδομικού (Giorgio: «σκληροκωδικοποιημένο ή δυναμικό;»)

Το ζητούμενο καθαρό ύψος **κάτω από δοκό** δεν είναι ένας αριθμός — εξαρτάται από τη **χρήση**:

| Χώρος κάτω από τη δοκό | Ελάχ. καθαρό ύψος | Πηγή |
|---|---|---|
| Όροφος κατοικίας (περνά **κούφωμα/πόρτα**) | **2,20 m** | τυπική πόρτα 220cm |
| Όροφος — απόλυτο κάτω από δοκό | 2,00 m | Κτιριοδομικός Άρθρο 8 |
| Πυλωτή / στάθμευση (κάτω από στοιχείο οροφής) | 1,90 m | ΚΠΝ στάθμευσης |
| Υπόγειο / απόληξη κλιμακοστασίου / βοηθητικός | ~2,00 m | Άρθρο 8 |

**Απόφαση: ΔΥΝΑΜΙΚΟ** (όχι μαγικό 800). Σύμβαση ADR-369: η δοκός κρέμεται από την οροφή → **καθαρό ύψος κάτω της = ύψος ορόφου − depth**. Άρα:

```
practical max depth = storeyHeightMm − requiredClearUnderBeam(storeyKind)
```

- `storeyHeightMm` = πραγματικό ύψος ορόφου (SSoT `ActiveStoreyContext.storeyHeightMm`, ADR-450) → προσαρμόζεται σε 2,8 / 3,0 / 3,2m.
- `requiredClearUnderBeam` = SSoT πίνακας ανά `FloorKind` (τεκμηριωμένος): κατοικήσιμος (ground/standard/mezzanine) → **2200**· ειδικός/βοηθητικός (basement/stair-penthouse/roof/foundation) → **2000**.
- **Graceful default** (χωρίς active storey): 3000 − 2200 = **800mm** = ακριβώς ο αριθμός που υπέθετε το handoff → μηδέν regression.

**Γιατί δυναμικό κι όχι hardcoded:** πυλωτή (1,90m) επιτρέπει depth έως ~1100 ενώ όροφος (2,20m) μόνο 800 — διαφορά 300mm· ένα σταθερό νούμερο ή θα γκρίνιαζε άδικα ή θα σιωπούσε επικίνδυνα.

**Πυλωτή:** δεν υπάρχει διακριτό `FloorKind 'pilotis'` (μοντελοποιείται ως `ground` με χρήση στάθμευσης) → **συντηρητικά 2200** (το soft warning αγνοείται όπου δεν μπαίνει κούφωμα· under-warning σε ισόγειο-κατοικία θα έχανε πραγματική σύγκρουση πόρτας). **DEFER:** ρητό pilotis flag / per-storey clearance override → 1900.

## 4. Φάση 1 — Υλοποίηση (PURE, μηδέν μετάλλαξη σκηνής)

**NEW SSoT** `bim/structural/codes/clear-height-under-beam.ts`: `requiredClearHeightUnderBeamMm(kind)` + `practicalBeamDepthLimitMm(storeyHeightMm, kind)` + `clearHeightUnderBeamMm(storeyHeightMm, depthMm)` + σταθερές `LIVING_CLEAR_HEIGHT_UNDER_BEAM_MM=2200` / `AUXILIARY_…=2000`. Pure, τεκμηριωμένες οι κανονιστικές πηγές.

**NEW pure** `bim/structural/organism/practical-span-checks.ts` (mirror `feasibility-checks`/`beam-torsion-checks`):
- `suggestIntermediateColumnCount(provider, ctx, practicalDepthLimitMm) → { columns, subSpanMm, suggestedDepthMm }`: loop `k=1..MAX_INTERMEDIATE_COLUMNS(5)`, `subSpan = span/(k+1)`, clone ctx με μειωμένο `spanMm` (το γραμμικό φορτίο kN/m είναι span-independent → ίδιο), **reuse `suggestBeamSection`** (μηδέν νέα φυσική). Πρώτο k ≤ όριο· αλλιώς clamp στο MAX.
- `runPracticalSpanChecks(entities, graph, provider, storey) → StructuralDiagnostic[]` (severity `warning`): per AUTO δοκό· **skip** locked (`autoSized:false`) / πρόβολος / <2 στηρίξεις (reuse `resolveBeamSupportCondition`)· αν `suggestBeamSection().depthMm > practicalLimit` → `beamSpanImpractical` diagnostic με params `{width, span, depth, clear, minClear, columns, subSpan, suggestedDepth}` (το μήνυμα δείχνει το **γιατί**: καθαρό ύψος < όριο).
- Νέος code `beamSpanImpractical` στο `StructuralDiagnosticCode` union.

**Wiring (ΕΝΑ σημείο)** `hooks/structural-organism-core.ts`: `readActiveStoreyContext()` → `{storeyHeightMm, storeyKind}` (fallback `DEFAULT_STOREY_HEIGHT_MM`/null) → `...runPracticalSpanChecks(entities, graph, provider, storey)` δίπλα στο `runFeasibilityChecks`. **Μηδέν νέο reactive trigger** (τρέχει στο υπάρχον diagnostics pass).

**i18n** (el+en, N.11): `structuralOrganism.diagnostics.beamSpanImpractical` (ICU plural στο `columns`).

**SSoT reuse (μηδέν νέα φυσική):** `suggestBeamSection`, `buildBeamSectionContext`, `resolveBeamSupportCondition`, `ActiveStoreyContext`, `FloorKind`.

## 5. Φάση 2 — opt-in action (ΣΕ ΕΞΕΛΙΞΗ)

Κουμπί/💡 που **με τη συγκατάθεση** του μηχανικού εκτελεί την πρόταση: K κολώνες + αυτόματα πέδιλα (reconciler) → ο δοκός μικραίνει. **Αποφάσεις (Giorgio 2026-06-19):**
- **Μηχανισμός = Επιλογή A** (inter-support span, ΕΝΑ element· industry standard Revit/Robot — ποτέ beam-split). Ο δοκός γίνεται **`'continuous'`**, sizing-span = μέγιστο καθαρό υπο-άνοιγμα.
- **Scope = Επίπεδο 1+2 (Robot-grade):** closed-form **εφεδρεία** (`'continuous'` divisor 10 = envelope hogging 1ης εσωτερικής στήριξης· συμμετρικός άνω/κάτω οπλισμός για hogging· l/d K=1.5) **+** FEM subdivision (S5, authoritative όταν engaged). SSoT ιεραρχία mirror ADR-497: μία πηγή ακρίβειας (FEM)· συντηρητική εφεδρεία (δεν διπλασιάζει τον FEM → μηδέν double-truth).

### 5.1 Sub-slices
- **S0 i18n (DONE):** `structuralOrganism.addIntermediateColumns{Action,Title,Message,Confirm,Done}` (el+en, ICU plural).
- **S1 continuous μηχανική (DONE):** `BeamSupportType += 'continuous'`· `spanMomentDivisor('continuous')=10`· συμμετρικός άνω οπλισμός (`topReinforcementAreaMm2`)· l/d K=1.5 (eurocode+greek-legacy providers)· `StructuralNode.supportType` → canonical `BeamSupportType`.
- **S2 topology span model (DONE):** NEW `deriveBeamSpanModel`/`buildBeamSpanModelMap` (≥3 στηρίξεις → continuous + max sub-span από προβολή footprint στον άξονα, reuse `projectColumnFootprintOnAxis`+`beamSupportColumnIds`)· NEW `BeamSpanStore` + `resolveActiveBeamSpanMm`· `buildBeamSectionContext(+sizingSpanOverrideMm)` (spanMm από sub-span, **w από πλήρες** άνοιγμα)· threaded σε sizing (`buildBeamSizePatch`+`AutoSizeMembersCommand`)+reinforce (`buildReinforcePatch`+`AutoReinforceOrganismCommand`+core)+checks (`reinforcement-checks`)+utilization· publish 2 stores από ΕΝΑ pass στον organism core.
- **S3 Φ1 alignment (DONE):** `suggestIntermediateColumnCount` προτείνει με `'continuous'` (συμφωνία Φ1↔Φ2).
- **S4 θέσεις κολωνών (DONE):** NEW `bim/columns/intermediate-column-placement.ts` — `intermediateColumnPositions(beam,K)` (even-split `t=i/(K+1)`, αυστηρά εσωτερικά) + `buildIntermediateColumns(beam,template,K,layerId,sceneUnits)` (clone διατομής στηρίζουσας κολώνας μέσω του idiom `buildDefaultColumnParams`+`buildColumnEntity`· fresh Enterprise IDs N.6 από το `createColumn` factory). Pure.
- **S5 FEM subdivision (DONE):** NEW `bim/structural/analytical/beam-interior-supports.ts` (`beamInteriorSupports` — εσωτερικές στηρίξεις ως κλάσμα `t∈(0,1)`, reuse `projectColumnFootprintOnAxis`+`beamSupportColumnIds`· end-support = footprint καλύπτει άκρο). `analytical-model-builder` `appendBeam`: ενδιάμεσοι κόμβοι + υπο-μέλη `i→s1→…→j` (κοινό `entityId`, μοναδικά `memberId`)· `mergeFramingEdges` ενώνει interior κόμβο με κορυφή στηρίζουσας κολώνας → πραγματικός συνεχής δοκός (sagging+hogging). Downstream ασφαλές (solver=διατομή ανά entityId, διαγράμματα ανά memberId). Ενημέρωση ADR-480/481.
- **S6 action+confirm (DONE):** NEW pure `bim/columns/add-intermediate-columns-command.ts` (`buildAddIntermediateColumnsCommand` — one-shot `buildStructuralGraph` στην ενέργεια χρήστη, template=πρώτη στηρίζουσα, `CompoundCommand[CreateColumnsCommand(K)]`· null guards) + NEW `ui/structural-warnings/IntermediateColumnsAction.tsx` (εμφανίζεται μόνο σε `beamSpanImpractical`· confirm dialog `dxf-modal-*`· ESC bus· toast `addIntermediateColumnsDone`) wired στο `BeamAdvancedPanel`. Πέδιλα+resize αυτόματα (proactive, μηδέν νέος reactive trigger)· ΕΝΑ atomic undo.

Πάντα **confirm**, ποτέ σιωπηλά (ADR-487 §8.4).

### 5.2 Tests (S0-S3, από repo ROOT) — GREEN
`derive-beam-span-model.test.ts` (13: base/continuous/map + divisor 10 + span override w-invariance + συμμετρικός top/bottom). Affected suites 89 pass· 2 raft fails = pre-existing ADR-476 (slab path, ΟΧΙ δικά μου).

## 6. Tests (από repo ROOT)

`src/subapps/dxf-viewer/bim/structural/organism/__tests__/practical-span-checks.test.ts` — **12/12 GREEN**: 16m φορτισμένη (2 στηρίξεις)→warning+columns≥1· μήνυμα clear<minClear· 5m→no-op· πρόβολος→no-op· <2 στηρίξεις→no-op· locked→no-op· ψηλός όροφος 4m→no-op (limit 1800>cap 1500)· πίνακας ελαχίστων (standard 800 / basement 1000 / 4m 1800)· basement εξακολουθεί να προειδοποιεί· `suggestIntermediateColumnCount` monotonic + clamp στο MAX + μειώνει το ύψος.

Pre-existing baseline fails (ΟΧΙ δικά μου): 6 raft (ADR-476) + 1 AssignWallType.

## 7. Changelog

- **2026-06-19 (Φάση 2 S4-S6 DONE, UNCOMMITTED)** — Το «χέρι» της πρότασης. **S4** NEW `intermediate-column-placement.ts` (even-split θέσεις + build clone διατομής, Enterprise IDs N.6 μέσω `createColumn` factory)· 8 jest. **S5** NEW `analytical/beam-interior-supports.ts` + `analytical-model-builder` subdivision (συνεχής δοκός: ενδιάμεσοι analytical κόμβοι ενωμένοι με κορυφές στηριζουσών κολωνών, υπο-μέλη κοινού `entityId`/μοναδικού `memberId` → sagging+hogging envelope από τον FEM)· downstream verified ασφαλές (solver per-entityId section, διαγράμματα per-memberId)· 9 jest· ADR-480/481 changelog. **S6** NEW pure `add-intermediate-columns-command.ts` (`buildAddIntermediateColumnsCommand`: one-shot `buildStructuralGraph` user-action, `CompoundCommand[CreateColumnsCommand]`, ΕΝΑ atomic undo, null guards) + NEW `ui/structural-warnings/IntermediateColumnsAction.tsx` (opt-in button + confirm dialog ADR-487 §8.4, toast) wired στο `BeamAdvancedPanel`· 5 jest. Πέδιλα+resize ρέουν αυτόματα από τον proactive κύκλο (μηδέν νέος reactive trigger). 22 νέα jest GREEN (52 affected pass, 87 analytical pass μηδέν regression). 🔴 browser-verify + commit (commit/tsc = Giorgio).
- **2026-06-19 (Φάση 2 S0-S3, UNCOMMITTED)** — Μηχανισμός Α + Robot-grade (Επίπεδο 1+2) αποφασίστηκαν. **S0** i18n (5 keys el+en). **S1** `'continuous'` τύπος + divisor 10 + συμμετρικός άνω οπλισμός + l/d K=1.5 (2 providers) + node-type sync. **S2** NEW `derive-beam-span-model.ts` (`deriveBeamSpanModel`/`buildBeamSpanModelMap`) + NEW `beam-span-store.ts` + `resolveActiveBeamSpanMm` + `buildBeamSectionContext(+sizingSpanOverrideMm)` (w-invariant) threaded σε sizing/reinforce/checks/utilization (18 αρχεία) + publish 2 stores από ΕΝΑ organism pass. **S3** Φ1 alignment. 13 νέα jest GREEN (89 affected pass· 2 pre-existing raft ADR-476). **S4-S6 PENDING** (θέσεις κολωνών + FEM subdivision + action/confirm). 🔴 ολοκλήρωση S4-S6 + browser-verify + commit (commit/tsc = Giorgio).
- **2026-06-19** — Φάση 1 DONE (UNCOMMITTED). NEW `clear-height-under-beam.ts` (SSoT καθαρού ύψους, δυναμικό threshold από ΝΟΚ/Κτιριοδομικό Άρθρο 8 + ΚΠΝ στάθμευσης + κουφώματα) + NEW `practical-span-checks.ts` (soft warning + πρόταση ενδιάμεσων κολωνών, reuse `suggestBeamSection`) + `beamSpanImpractical` code + wiring ΕΝΑ σημείο στον organism core + i18n el+en + 12 jest. Φάση 2 (opt-in εισαγωγή κολωνών) = DEFER μετά από απόφαση μοντέλου ροπών (§5). 🔴 browser-verify + commit (commit/tsc = Giorgio).
