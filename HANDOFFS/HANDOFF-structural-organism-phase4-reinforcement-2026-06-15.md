# HANDOFF — Structural Organism: Phase 4b/4c/4d (auto-reinforcement → οργανική συνέχεια → warnings)

**Ημερομηνία:** 2026-06-15
**Συντάκτης:** Opus 4.8 (συνεδρία Phase 2 + Phase 4a)
**Θέμα νέας συνεδρίας:** Συνέχεια του subsystem «Στατικός Οργανισμός» (ADR-459), discipline **αυτόματος οπλισμός σαν ΕΝΑΣ οργανισμός** (πρότυπο Revit Structural / Analytical Rebar + lap/anchorage continuity). **Full enterprise + full SSoT + Revit-grade.**

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md).
> ⚠️ **COMMIT:** Ο Giorgio κάνει τα commit, ΟΧΙ εσύ. Ποτέ `git commit`/`push` χωρίς ρητή εντολή.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent ταυτόχρονα. `git add` ΜΟΝΟ τα δικά σου αρχεία — ΠΟΤΕ `git add -A`.
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος. Ένα tsc τη φορά.
> ⚠️ **MODEL (N.14):** architecture/cross-cutting → **Opus**. Δήλωσέ το, ζήτα επιβεβαίωση.

---

## ΜΕΡΟΣ 0 — UNCOMMITTED ΑΠΟ ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (ADR-459 Phase 4a)

Phase 0+1+2 (graph + «λείπει το πέδιλο» + explicit FK κολόνα↔πέδιλο) είναι **COMMITTED `f23becb8`**.
**Phase 4a (Beam reinforcement)** ολοκληρώθηκε, **156 structural jest GREEN, tsc-clean (μόνο pre-existing errors), UNCOMMITTED** (browser-verify + commit από Giorgio).

**git add ΜΟΝΟ αυτά (shared tree):**
- NEW `src/subapps/dxf-viewer/bim/structural/reinforcement/beam-reinforcement-types.ts`
- NEW `…/bim/structural/reinforcement/beam-reinforcement-compute.ts`
- NEW `…/bim/structural/reinforcement/__tests__/beam-reinforcement-compute.test.ts`
- NEW `…/bim/structural/codes/__tests__/beam-reinforcement-suggest.test.ts`
- MOD `…/bim/structural/codes/structural-code-types.ts` (BeamSectionContext + BeamReinforcementLimits + 2 provider methods)
- MOD `…/bim/structural/codes/suggest-reinforcement.ts` (**`resolveBarSet` SSoT** κολόνα+δοκάρι + `suggestBeamReinforcementFrom`)
- MOD `…/bim/structural/codes/eurocode-provider.ts` + `greek-legacy-provider.ts` (beam limits + suggest)
- MOD `…/bim/types/beam-types.ts` (`BeamParams.reinforcement?`) + `…/bim/types/beam.schemas.ts` (`BeamReinforcementSchema`, **strict**)
- DOC `docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md` (§6c + changelog v3), `…/adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

---

## ΜΕΡΟΣ 1 — GROUND TRUTH (διάβασε ΠΡΙΝ κώδικα — code = source of truth, N.0.1)

### Reinforcement subsystem (κολόνα + ΤΩΡΑ δοκάρι)
- **Data models** (persisted intent, DERIVED quantities — geometry-is-SSoT):
  `reinforcement/column-reinforcement-types.ts` (`ColumnReinforcement`: longitudinal + stirrups + cover + crossTiePattern),
  `reinforcement/beam-reinforcement-types.ts` (`BeamReinforcement`: bottom + top + stirrups + cover) **[Phase 4a]**.
- **Compute** (derived μήκη/βάρος/ρ): `column-reinforcement-compute.ts`, `beam-reinforcement-compute.ts`. Και τα δύο έχουν flat `LONGITUDINAL_LAP_FACTOR=50·Ø` — **εδώ μπαίνει η οργανική συνέχεια (4c)**.
- **2D/3D cage geometry** (κολόνα): `column-rebar-layout.ts` (`computeColumnRebarLayout`, `STIRRUP_HOOK_EXTENSION_FACTOR`, `computeStirrupLevelsMm`, `stirrupCenterlinePerimeterMm`), `column-cross-ties.ts`, `column-confinement.ts`, `rebar-visibility.ts`. (Δοκάρι/πέδιλο: ΔΕΝ έχουν cage geometry ακόμη — DEFER, εκτός αν ζητηθεί.)
- **Detail sheet** (κολόνα μόνο): `detail-sheet/` (PDF/canvas, ADR-457).

### Code providers (κανονισμοί) — SSoT για limits + suggest
- `codes/structural-code-types.ts` — **`StructuralCodeProvider` interface**: `columnReinforcementLimits` + `suggestColumnReinforcement` + `beamReinforcementLimits` + `suggestBeamReinforcement` (Phase 4a) + contexts `ColumnSectionContext`/`BeamSectionContext` + limits interfaces. **ΕΔΩ προσθέτεις footing (4b) + lap/anchorage (4c).**
- `codes/eurocode-provider.ts` (EC2/EC8 + Greek NA, σεισμός→EC8 DCM κυριαρχεί), `codes/greek-legacy-provider.ts` (ΕΚΩΣ 2000 + ΕΑΚ 2003). **Κάθε νέα μέθοδος interface → υλοποίηση ΚΑΙ στους 2.**
- `codes/suggest-reinforcement.ts` — **`resolveBarSet(asRequired, initialCount, seedDia, addStep)` = SSoT** επιλογής ράβδων (κολόνα+δοκάρι· ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟ και για footing). `suggestColumnReinforcementFrom`, `suggestBeamReinforcementFrom`.
- `codes/index.ts` — `resolveStructuralCode(id)` → provider.
- `rebar-catalog.ts` (`barAreaMm2`, `barMassPerMeterKg`, `nextRebarDiameterMm`, B500C), `concrete-grades.ts`, `structural-settings.ts` (building-level code selection SSoT).

### Organism graph (Phase 0-2, COMMITTED f23becb8) — `bim/structural/organism/`
- `structural-graph.ts` → **`buildStructuralGraph(entities): StructuralGraph`** — DERIVED. Nodes `footing|column|beam` (column node φέρει `footingId`). Edges: `footing-bearing` (πέδιλο→βάση κολόνας, explicit-FK-wins + spatial fallback), `column-bearing` (κολόνα→δοκάρι, REUSE `findColumnsFramedByBeam`), `top-attachment` (`attachTopToIds`). **ΑΥΤΟΣ Ο GRAPH ΕΙΝΑΙ ΤΟ ΥΠΟΒΑΘΡΟ ΤΗΣ ΣΥΝΕΧΕΙΑΣ (4c).**
- `organism-checks.ts` → `runOrganismChecks(graph)` registry (`columnMissingFooting`/`beamUnsupportedEnd`/`memberIsolated`). **Επεκτείνεται με reinforcement warnings (4d).**
- `structural-diagnostics-store.ts` (low-freq, ADR-040-safe) + `useEntityStructuralDiagnostics.ts` + `hooks/useStructuralOrganism.ts` (shell recompute, listens `ORGANISM_EVENTS`) + `ui/structural-warnings/EntityWarningsSection.tsx` (generic per-entity, mounted στο `ColumnAdvancedPanel`).
- **SSoT helpers (Phase 2):** `bim/foundations/footing-column-coverage.ts` (bearing κριτήριο), `footing-element-summary.ts` (`isFootingElement`/`resolveFootingSummary`), `foundation-column-attach-coordinator.ts` (αμφίδρομος), `core/commands/entity-commands/AttachColumnFootingCommand.ts` (undoable, geometry-neutral, `signalEntitiesAttached`).

### Types
- `bim/types/column-types.ts` (`ColumnParams`: width/depth/height, `footingId`, `reinforcement`, `concreteGrade`), `column.schemas.ts` (**`.strict()`**).
- `bim/types/beam-types.ts` (`BeamParams`: width/depth, span via `geometry.maxFreeSpanM`/`length`, `supportType`, `reinforcement` [4a]), `beam.schemas.ts` (**`.strict()`**).
- `bim/types/foundation-types.ts` (`FoundationParams` discriminated pad/strip/tie-beam· pad: width/length/thicknessMm· strip/tie-beam: start/end/width/thicknessMm). **`foundation.schemas.ts` → ΕΠΑΛΗΘΕΥΣΕ αν είναι `.strict()` ΠΡΙΝ προσθέσεις `reinforcement` (μάθημα: column+beam ήταν strict → νέο persisted πεδίο χωρίς Zod = silent reject στο persist/load).**

### 🚨 ΜΑΘΗΜΑ-ΚΛΕΙΔΙ (Phase 2 + 4a)
`column.schemas.ts` ΚΑΙ `beam.schemas.ts` είναι **`.strict()`**. Κάθε νέο **persisted** πεδίο στα params ΠΡΕΠΕΙ να προστεθεί ΚΑΙ στο αντίστοιχο Zod schema, αλλιώς το Zod απορρίπτει την οντότητα στο persist/load. Ισχύει για το `foundation.schemas.ts` (4b).

---

## ΜΕΡΟΣ 2 — PHASE 4b: FOOTING REINFORCEMENT (επόμενο άμεσο)

**Στόχος:** οπλισμός πεδίλου/πεδιλοδοκού/συνδετήριας, mirror κολόνας/δοκαριού (data model + provider limits + suggester + compute + tests). Πρότυπο Revit Structural Foundation rebar.

### Σχεδιασμός (Revit-grade, ζήτα έγκριση plan ΠΡΙΝ κώδικα)
1. **NEW `reinforcement/footing-reinforcement-types.ts`** — discriminated ανά foundation kind:
   - **pad** → 2-way κάτω σχάρα (mat): `bottomMeshX {diameterMm, spacingMm}` + `bottomMeshY` + optional `topMesh` + `coverMm` (EC2 §9.8.2 πέδιλα).
   - **strip** (πεδιλοδοκός) → ανεστραμμένη δοκός: εγκάρσιες ράβδοι κάτω (`transverse {diameterMm, spacingMm}`) + διαμήκεις διανομής (`longitudinal {diameterMm, count}`) + optional συνδετήρες + cover.
   - **tie-beam** (συνδετήρια) → **είναι δοκός**: REUSE `BeamReinforcement` (top/bottom + stirrups + cover) — μηδέν duplicate.
2. **Provider επέκταση** (`structural-code-types.ts` + 2 providers): `FootingSectionContext` (kind, διαστάσεις, grossArea) + `FootingReinforcementLimits` (ρ_min mat EC2 §9.8.2 / min Ø / max spacing / cover) + `footingReinforcementLimits` + `suggestFootingReinforcement`. **REUSE `resolveBarSet` για τις διαμήκεις· για mat → spacing-based count από footprint.**
3. **NEW `reinforcement/footing-reinforcement-compute.ts`** — derived ποσότητες (mat bar counts από footprint dims / spacing, μήκη, βάρος, ρ). Mirror beam-compute.
4. **`FoundationParams.reinforcement?`** + **`foundation.schemas.ts` Zod (strict-safe)**.
5. **Tests:** compute (pad mat + strip) + suggester (2 κανονισμοί).

---

## ΜΕΡΟΣ 3 — PHASE 4c: ORGANISM CONTINUITY (Ο «ΕΝΙΑΙΟΣ ΟΡΓΑΝΙΣΜΟΣ» — Η ΚΑΡΔΙΑ ΤΟΥ ΑΙΤΗΜΑΤΟΣ)

**Αυτό ζήτησε ρητά ο Giorgio:** «να το υπολογίζει σαν ΕΝΑΝ ενιαίο οργανισμό, να δίνει προεκτάσεις/ματίσεις οπλισμού προς τα όμορα BIM αντικείμενα ΚΑΙ αντίστροφα». Πρότυπο Revit rebar coupling / lap & anchorage σε joints.

### Σχεδιασμός (DERIVED, ΠΟΤΕ persisted — φιλοσοφία graph/ADR-458)
1. **Lap/anchorage SSoT στον provider:** πρόσθεσε `lapLengthMm(diameterMm, ctx)` + `anchorageLengthMm(diameterMm, ctx)` στο `StructuralCodeProvider` (EC2 §8.4 lbd / §8.7 ls· detailing-grade factor·Ø — eurocode ~50·Ø lap / 40·Ø anchor, legacy συντηρητικότερα). **Αντικαθιστά το flat `LONGITUDINAL_LAP_FACTOR`** όπου υπάρχει πραγματικό joint.
2. **NEW `organism/reinforcement-continuity.ts`** (pure): `computeOrganismReinforcementContinuity(graph, entities, provider)` → ανά edge παράγει συνέχειες ΑΜΦΙΔΡΟΜΑ:
   - **`footing-bearing`** → η κολόνα απαιτεί **αναμονές/dowels** από το πέδιλο: count=column longitudinal count, Ø=column Ø, αγκύρωση μέσα στο πέδιλο = `anchorageLengthMm`, προέκταση πάνω = `lapLengthMm` (μάτισμα με τις ράβδους κολόνας). Το πέδιλο «μαθαίνει» ότι φιλοξενεί dowels.
   - **`column-bearing`** (κολόνα→δοκάρι) → οι ράβδοι δοκαριού αγκυρώνονται στον κόμβο/κολόνα (EC8 §5.6.2.2 beam-column joint): `anchorageLengthMm`.
   - **`top-attachment`** (κολόνα→κολόνα επόμενου ορόφου) → **μάτισμα ορόφου** (lap splice) στη στάθμη: `lapLengthMm`.
   - Output: per-member `ContinuityItem[] {kind:'dowel'|'lap'|'anchorage', count, diameterMm, lengthMm, fromMemberId, toMemberId}` → προστίθεται στο takeoff ΚΑΘΕ μέλους + το όμορο μέλος το «γνωρίζει» (αμφίδρομη αναφορά).
3. **Compute integration:** column/beam/footing compute διαβάζουν τη συνέχεια (όταν υπάρχει joint) αντί για flat lap. Isolated μέλος → flat fallback.
4. **Tests:** dowel pairing πεδίλου↔κολόνας, lap ορόφου, anchorage δοκαριού· αμφίδρομη αναφορά· DERIVED (μηδέν mutation params).

---

## ΜΕΡΟΣ 4 — PHASE 4d: WARNINGS + AUTO-APPLY

1. **Reinforcement διαγνωστικά** στο `organism-checks` registry (επέκταση): `memberMissingReinforcement` (info), `ratioOutOfRange` (ρ<ρ_min ή >ρ_max), `anchorageInsufficient`/`barMismatchAtJoint` (dowel count/Ø πεδίλου↔κολόνας δεν ταιριάζει· ράβδος δοκαριού δεν αναπτύσσεται στον κόμβο). Διαβάζουν continuity (4c) + per-member reinforcement. → surfacing μέσω `StructuralDiagnosticsStore` + `EntityWarningsSection` (ήδη generic). **i18n keys el+en ΠΡΩΤΑ (N.11).**
2. **Auto-apply:** NEW undoable `AutoReinforceOrganismCommand` (mirror `AttachColumnFootingCommand`): για κάθε δομικό μέλος χωρίς `reinforcement` → `provider.suggest*` → set `params.reinforcement` (batch, undoable, persist via `signalEntitiesAttached`). Προαιρετικό ribbon «Αυτόματος Οπλισμός» (Ανάλυση). Emit event + ORGANISM_EVENTS.

---

## ΜΕΡΟΣ 5 — ENTERPRISE/SSoT ΑΡΧΕΣ (ΑΠΑΡΑΒΑΤΕΣ)
- **Reinforcement intent = persisted· continuity (ματίσεις/αναμονές) = DERIVED** (ποτέ persisted).
- **ΕΝΑ provider interface**, υλοποιούν ΚΑΙ οι 2 κανονισμοί. **`resolveBarSet` = το SSoT** επιλογής ράβδων (reuse παντού). lap/anchorage = ΕΝΑ SSoT στον provider.
- **Zod strict:** κάθε νέο persisted πεδίο → +schema (foundation.schemas έλεγχος).
- **N.7.1:** αρχεία ≤500 γρ., functions ≤40 γρ. **N.2:** no `any`. **N.11:** i18n keys el+en ΠΡΩΤΑ. **N.6:** enterprise-id αν φτιάξεις Firestore docs (δεν αναμένεται — reinforcement ζει στα params).
- **ADR-040 safe** (organism = discrete EventBus, όχι high-freq).
- **N.0.2 Boy Scout:** tie-beam reinforcement = REUSE `BeamReinforcement` (μηδέν duplicate)· mat counts από footprint = κοινός helper.

---

## ΜΕΡΟΣ 6 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό το handoff + **ADR-459** + το reinforcement subsystem (ΜΕΡΟΣ 1: column/beam reinforcement, codes/, organism/).
2. **Δήλωσε μοντέλο** (Opus), ζήτα επιβεβαίωση.
3. **PHASE 1 (N.0.1):** διάβασε τον υπάρχοντα κώδικα (providers, beam/footing types, organism graph) — επιβεβαίωσε ground truth· **έλεγξε `foundation.schemas.ts` strictness**.
4. **Πρότεινε plan Phase 4b** (footing reinforcement) + ζήτα έγκριση. ΜΗΝ γράψεις κώδικα πριν εγκρίνει ο Giorgio. Μετά 4c (continuity) → 4d (warnings), σειριακά με έγκριση.
5. commit = Giorgio· shared tree → `git add` ΜΟΝΟ δικά σου· ένα tsc τη φορά (N.17).
