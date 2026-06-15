# HANDOFF — Structural Organism: Phase 4d (Reinforcement Warnings + Auto-Apply Command)

**Ημερομηνία:** 2026-06-15
**Συντάκτης:** Opus 4.8 (συνεδρία Phase 4c)
**Θέμα νέας συνεδρίας:** **Phase 4d του ADR-459 — «Στατικός Οργανισμός».** Δύο deliverables πάνω στον υπάρχοντα οργανισμό + την οργανική συνέχεια (Phase 4c): **(A) reinforcement διαγνωστικά** (Revit-grade warnings: λείπει οπλισμός / ρ εκτός ορίων / αναντιστοιχία ράβδων σε κόμβο) στο checks registry + surfacing, και **(B) auto-apply** `AutoReinforceOrganismCommand` (undoable batch: κάθε μέλος χωρίς οπλισμό → code-suggested οπλισμός) + ribbon «Αυτόματος Οπλισμός». **FULL ENTERPRISE + FULL SSoT + Revit-grade** (πρότυπο Revit «Reinforcement» + analytical warnings).

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> ⚠️ **COMMIT:** Ο Giorgio κάνει τα commit/push, ΟΧΙ εσύ. Ποτέ `git commit`/`push` χωρίς ρητή εντολή (N.(-1)).
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent ταυτόχρονα (ADR-460 shape-aware columns — αγγίζει τα ΙΔΙΑ codes files). `git add` ΜΟΝΟ τα δικά σου αρχεία — ΠΟΤΕ `git add -A`.
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … *tsc*`). Ένα tsc τη φορά.
> ⚠️ **MODEL (N.14):** cross-cutting (checks + command + ribbon + i18n + store) → **Opus**. Δήλωσέ το.
> ⚠️ **i18n (N.11):** ΚΑΘΕ νέο `t('key')` → πρώτα keys σε `el` ΚΑΙ `en` locale JSON, ΜΕΤΑ κώδικας.

---

## ΜΕΡΟΣ 0 — UNCOMMITTED ΑΠΟ ΤΙΣ ΠΡΟΗΓΟΥΜΕΝΕΣ ΣΥΝΕΔΡΙΕΣ

- **Phase 0+1+2 = COMMITTED `f23becb8`** (graph + «λείπει το πέδιλο» + explicit FK κολόνα↔πέδιλο).
- **Phase 4a (beam) + 4b (footing) + 4c (organism continuity) = DONE, UNCOMMITTED** — **209 structural jest GREEN, tsc-clean**. Ο Giorgio θα κάνει browser-verify + commit. **Ιδανικά το 4d χτίζεται πάνω σε committed 4c**· αν δεν έχει γίνει commit, λειτουργεί στο ίδιο working tree.

**`git add` ΜΟΝΟ αυτά (4a+4b+4c, shared tree):**
- NEW `bim/structural/reinforcement/{beam,footing}-reinforcement-types.ts`, `{beam,footing}-reinforcement-compute.ts` (+`__tests__`)
- NEW `bim/structural/organism/reinforcement-continuity.ts` (+`__tests__/reinforcement-continuity.test.ts`)
- MOD `bim/structural/rebar-catalog.ts` (`developmentLengthMm` + `BarDevelopmentModifiers`)
- MOD `bim/structural/reinforcement/{column,beam,footing}-reinforcement-compute.ts` (continuity-aware param)
- MOD `bim/types/{beam,foundation}-types.ts`, `{beam,foundation}.schemas.ts`
- DOC `docs/.../adrs/ADR-459-structural-organism-connectivity.md`, `adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`
- **⚠️ MIXED files** (περιέχουν ΚΑΙ δικά μου ΚΑΙ ADR-460 άλλου agent — σταδιάζοντάς τα παίρνεις και τα δύο sets· συντόνισέ το): `bim/structural/codes/{structural-code-types,eurocode-provider,greek-legacy-provider}.ts`, `bim/structural/reinforcement/column-reinforcement-compute.ts`

---

## ΜΕΡΟΣ 1 — GROUND TRUTH (διάβασε ΠΡΙΝ κώδικα — code = source of truth, N.0.1)

### Ο DERIVED graph + checks (Phase 0-1, COMMITTED) — `bim/structural/organism/`
- **`structural-organism-types.ts`:**
  - `StructuralNode { id, memberKind:'footing'|'column'|'beam', entityType, footprint?, axis?, supportType?, footingId?, baseZmm, topZmm }`. **Ο node ΔΕΝ φέρει reinforcement** (διαβάζεται από entities).
  - `StructuralEdge { id, supportId(κάτω), supportedId(πάνω), kind }`, `StructuralConnectionKind = 'footing-bearing'|'column-bearing'|'top-attachment'`.
  - `StructuralDiagnosticSeverity = 'error' | 'warning'` — **ΕΔΩ προσθέτεις `'info'`** για advisories (4d).
  - `StructuralDiagnosticCode = 'columnMissingFooting' | 'beamUnsupportedEnd' | 'memberIsolated'` — **ΕΔΩ προσθέτεις** `'memberMissingReinforcement' | 'ratioOutOfRange' | 'barMismatchAtJoint'`.
  - `StructuralDiagnostic { id, code, severity, messageKey, primaryEntityId, entityIds }`.
- **`organism-checks.ts`:** `const CHECKS: ReadonlyArray<(g: StructuralGraph) => StructuralDiagnostic[]>` + `runOrganismChecks(graph)`. **ΟΛΟΙ οι υπάρχοντες checks είναι geometry-only `(graph) => …`** — δεν έχουν entities/provider. Prefix i18n: `const MSG = 'structuralOrganism.diagnostics'`. **Τα reinforcement checks χρειάζονται entities + provider + continuity → χρειάζονται ΝΕΑ signature** (βλ. ΜΕΡΟΣ 2 §A — μην σπάσεις το `runOrganismChecks(graph)`).
- **`structural-diagnostics-store.ts`:** `StructuralDiagnosticsStore.set/getAll/getForEntity/subscribe` — low-freq, **ADR-040 safe**. SSoT writer = `useStructuralOrganism`· readers = `EntityWarningsSection`. **Δέχεται οποιοδήποτε `StructuralDiagnostic[]` — δεν χρειάζεται αλλαγή** (απλώς θα πάρει και τα reinforcement findings στο ίδιο `set`).
- **Surfacing (Phase 1, μην το σπάσεις):** `hooks/useStructuralOrganism.ts` (shell hook, mounted `DxfViewerContent`· ακούει structural events· coalesced microtask recompute → `StructuralDiagnosticsStore.set` → emit `bim:structural-organism-updated`)· `organism/useEntityStructuralDiagnostics.ts` (per-entity reactive selector)· `ui/structural-warnings/EntityWarningsSection.tsx` (ΕΝΑ generic component κολόνα/δοκάρι/πέδιλο· διαβάζει store· **εδώ προσθέτεις styling για `info` severity** αν το προσθέσεις).

### Reinforcement subsystem (Phase 4a/4b/4c)
- **Data models (persisted intent):** `reinforcement/column-reinforcement-types.ts` (`ColumnReinforcement`), `beam-reinforcement-types.ts` (`BeamReinforcement`: bottom/top layers+stirrups+cover), `footing-reinforcement-types.ts` (`FootingReinforcement` discriminated pad/strip/tie-beam). Persisted στα `ColumnParams.reinforcement?` / `BeamParams.reinforcement?` / `FoundationParams.reinforcement?` (per-kind, optional).
- **Compute (derived ποσότητες + ρ):** `column|beam|footing-reinforcement-compute.ts` → `compute{Column|Beam|Footing}ReinforcementQuantities(ctx, r, continuity?)`. Επιστρέφουν `…Quantities` με **`ratio`** (ρ) + μήκη/βάρη. **Το `ratio` είναι το input του `ratioOutOfRange` check.**
- **Phase 4c continuity (DERIVED):** `organism/reinforcement-continuity.ts` →
  `computeOrganismReinforcementContinuity(graph, entities, provider): OrganismContinuityResult`
  - `OrganismContinuityResult { byMember: Map<id, ReinforcementContinuityItem[]>, items, columnDevelopmentMm: Map<id,number>, beamDevelopmentMm: Map<id,{bottomMm,topMm}> }`.
  - `ReinforcementContinuityItem { kind:'dowel'|'lap'|'anchorage', count, diameterMm, lengthMm, fromMemberId, toMemberId, edgeId }`.
  - **Το `items`/`byMember` είναι το input του `barMismatchAtJoint` check** (π.χ. dowel count ≠ column longitudinal count, ή ασυμβατότητα Ø σε joint).

### Code providers — SSoT limits + suggest + lap/anchorage
- `codes/structural-code-types.ts` — `StructuralCodeProvider`: `{column|beam|footing}ReinforcementLimits(ctx[, Ø])` (επιστρέφουν `minRatio`/`maxRatio`/…) + `suggest{Column|Beam|Footing}Reinforcement(ctx)` + `lapLengthMm`/`anchorageLengthMm` (Φ4c). Section contexts: `ColumnSectionContext` (+ ADR-460 shape-aware optional fields), `BeamSectionContext`, `FootingSectionContext` (discriminated pad/strip/tie-beam).
- `codes/index.ts` — **`resolveStructuralCode(id)` → provider** (ΕΝΑ SSoT για επιλογή κανονισμού).
- `structural-settings.ts` — **building-level code selection SSoT** (ποιος κανονισμός ισχύει ανά κτίριο).
- **Section-context builders + suggest consumers ΥΠΑΡΧΟΥΝ ήδη** (auto-apply: μην ξαναγράψεις — REUSE/εξαγωγή SSoT, N.0.2): `ui/ribbon/hooks/bridge/column-structural-bridge.ts` + `ui/ribbon/hooks/bridge/structural-param.ts` (χτίζουν section context από entity + καλούν provider). **Βρες τον SSoT builder entity→SectionContext· αν είναι inline → εξήγαγέ τον σε pure helper πριν τον χρησιμοποιήσεις στο command.**

### Το command pattern προς MIRROR — `core/commands/entity-commands/AttachColumnFootingCommand.ts` (Phase 2)
- `class AttachColumnFootingCommand implements ICommand` — batch, undoable. Per-entity `{prev,next}` patches χτίζονται **ΜΙΑ φορά** στο πρώτο `execute()` (`buildPatches`)· `undo`/`redo` = pure re-applies (idempotent). `applyPatch` → `sceneManager.updateEntity(id, { kind, params, geometry, validation })`. Persist via **`signalEntitiesAttached(sceneManager, ids)`** (`./attach-persist-signal`). `id = generateEntityId()`. `serialize()` με `version:1`. **Mirror αυτό ακριβώς για `AutoReinforceOrganismCommand`** (next.params = prev + `reinforcement`).

### i18n — `src/i18n/locales/{el,en}/dxf-viewer-shell.json`
Υπάρχον block (επέκτεινέ το — el ΚΑΙ en):
```json
"structuralOrganism": { "diagnostics": {
  "title": "Στατικός Έλεγχος",
  "columnMissingFooting": "…", "beamUnsupportedEnd": "…", "memberIsolated": "…"
}}
```

---

## ΜΕΡΟΣ 2 — PHASE 4d: ο σχεδιασμός

### A. Reinforcement διαγνωστικά (Revit-grade warnings)

1. **Types** (`structural-organism-types.ts`): `StructuralDiagnosticSeverity += 'info'`· `StructuralDiagnosticCode += 'memberMissingReinforcement' | 'ratioOutOfRange' | 'barMismatchAtJoint'`.
2. **i18n ΠΡΩΤΑ** (el+en): `structuralOrganism.diagnostics.{memberMissingReinforcement,ratioOutOfRange,barMismatchAtJoint}` (+ ICU placeholders αν χρειάζονται, π.χ. `{member}`, `{ratio}`, `{min}` — ICU single-brace, ΟΧΙ `{{}}`, βλ. CHECK 3.9).
3. **NEW `organism/reinforcement-checks.ts`** (pure· **ΜΗΝ** βάλεις τα reinforcement checks στο geometry-only `CHECKS` registry — διαφορετική signature):
   ```ts
   export function runReinforcementChecks(
     graph: StructuralGraph,
     entities: readonly Entity[],
     provider: StructuralCodeProvider,
   ): StructuralDiagnostic[]
   ```
   - **`memberMissingReinforcement`** (`info`): μέλος node (column/beam/footing) με entity που **δεν** έχει `params.reinforcement`. (Το ίδιο κενό που το 4c `skip`άρει — τώρα γίνεται ορατό.)
   - **`ratioOutOfRange`** (`warning`): build section context (REUSE SSoT builder) → `compute…Quantities(ctx, r, continuityFor(member))` → `ratio` vs `provider.…Limits(ctx).minRatio/maxRatio`. ρ<ρ_min ή ρ>ρ_max → finding.
   - **`barMismatchAtJoint`** (`warning`): από το `OrganismContinuityResult` — π.χ. dowel `count` ≠ column longitudinal count, ή Ø ασύμβατο σε joint, ή ράβδος δοκαριού που «δεν αναπτύσσεται» (length ≤ 0 / missing). Διάβασε `result.items`/`byMember`.
   - Pure· διάβασε `params.reinforcement`· **μηδέν mutation/persist**· i18n key μόνο.
4. **Surfacing wiring** (`hooks/useStructuralOrganism.ts`): στο coalesced recompute, μετά το `runOrganismChecks(graph)`, **πρόσθεσε** `runReinforcementChecks(graph, entities, resolveStructuralCode(activeCodeId))` και κάνε **ΕΝΑ** `StructuralDiagnosticsStore.set([...geo, ...reinf])`. Πάρε τον active code από το building-level SSoT (`structural-settings`). **ADR-040 safe** (ίδιο low-freq path). `EntityWarningsSection`: render `info` με ήπιο styling (όχι κόκκινο).

### B. Auto-apply — `AutoReinforceOrganismCommand`

1. **NEW `core/commands/entity-commands/AutoReinforceOrganismCommand.ts`** (mirror `AttachColumnFootingCommand`):
   - Constructor `(entityIds, sceneManager, provider)` (ή πάρε provider μέσω resolveStructuralCode στο build).
   - `buildPatches()`: για κάθε entity **χωρίς** `params.reinforcement` → build section context (REUSE SSoT) → `provider.suggest{Column|Beam|Footing}Reinforcement(ctx)` → `next = { ...prev, reinforcement }`. Idempotent (skip αν έχει ήδη).
   - `applyPatch` → `updateEntity({ kind, params, geometry, validation })`· persist `signalEntitiesAttached`.
   - undo/redo pure re-applies· `serialize` version:1.
   - **Foundation per-kind:** το `suggestFootingReinforcement(ctx)` θέλει discriminated ctx (pad/strip/tie-beam) — χρησιμοποίησε τον υπάρχοντα footing section-context builder.
2. **Ribbon** «Αυτόματος Οπλισμός» στην ομάδα **«Ανάλυση»** (εκεί ζει το structural). Dispatch το command μέσω του command stack (όπως τα άλλα entity commands). Μετά → emit/signal ώστε το `useStructuralOrganism` να ξανατρέξει (warnings ενημερώνονται). i18n label el+en ΠΡΩΤΑ.
3. **Scope:** «επιλεγμένα μέλη» ή «όλα του ορόφου» — διάλεξε Revit-grade default (πρόταση: αν υπάρχει selection → selected· αλλιώς όλος ο οργανισμός ορόφου). Πάρε εσύ την απόφαση (feedback: make-revit-grade-decisions-yourself) + ζήτα έγκριση plan.

### C. Tests (μηδέν browser)
- `reinforcement-checks.test.ts`: memberMissingReinforcement (μέλος χωρίς r)· ratioOutOfRange (ρ κάτω από min → finding· εντός → κανένα)· barMismatchAtJoint (dowel count ≠ column count)· DERIVED invariant (entities deep-equal).
- `AutoReinforceOrganismCommand.test.ts`: execute θέτει `reinforcement` σε members χωρίς· idempotent (δεύτερο execute = no-op)· undo επαναφέρει `undefined`· redo re-applies· δεν αγγίζει members που έχουν ήδη.

---

## ΜΕΡΟΣ 3 — ENTERPRISE/SSoT ΑΡΧΕΣ (ΑΠΑΡΑΒΑΤΕΣ)
- **Diagnostics = DERIVED** (store/panel), ΠΟΤΕ στο `entity.validation` (per-entity validators owner). **Reinforcement intent = persisted** (μόνο μέσω command). **Continuity = DERIVED** (4c).
- **ΕΝΑ SSoT** για: bar-selection (`resolveBarSet`/`resolveMatMesh`), lap/anchorage (provider μέθοδοι Φ4c), code-selection (`resolveStructuralCode` + building `structural-settings`), entity→SectionContext builder (REUSE/εξαγωγή — N.0.2, μην το ξαναγράψεις στο command).
- **Pure layers:** checks (pure), command (scene-mutating αλλά undoable/idempotent). Μηδέν React/DOM/Firestore στα pure modules.
- **N.7.1:** αρχεία ≤500 γρ., functions ≤40 (σπάσε per-check/per-kind handlers). **N.2:** no `any`/`as any`. **N.11:** i18n keys el+en ΠΡΩΤΑ. **N.6:** command id μέσω `generateEntityId`/enterprise-id (όχι `Date.now()`/`crypto.randomUUID` inline). **ADR-040 safe** (organism = low-freq EventBus).
- **N.0.2 Boy Scout:** αν ο entity→SectionContext builder είναι inline στο ribbon bridge → εξήγαγέ τον σε pure SSoT helper πριν τον χρησιμοποιήσει ΚΑΙ το command.

---

## ΜΕΡΟΣ 4 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό το handoff + **ADR-459** (§4 checks, §5 surfacing, §6/§6c, Phase 2 command) + τα ground-truth αρχεία (ΜΕΡΟΣ 1: organism-checks, diagnostics-store, useStructuralOrganism, EntityWarningsSection, AttachColumnFootingCommand, reinforcement-continuity, codes/index + structural-settings, ribbon bridge structural-param/column-structural-bridge).
2. **Δήλωσε μοντέλο** (Opus).
3. **PHASE 1 (N.0.1):** επιβεβαίωσε ground truth — ειδικά (α) τον SSoT entity→SectionContext builder, (β) πώς dispatch-άρονται τα entity commands από ribbon, (γ) από πού παίρνεται ο active code (building `structural-settings`).
4. **Πρότεινε plan Phase 4d** (A διαγνωστικά → B command → ribbon → tests) + το scope default (selected vs όλος ο όροφος) + ζήτα έγκριση. **ΜΗΝ γράψεις κώδικα πριν εγκρίνει ο Giorgio.**
5. commit = Giorgio· shared tree → `git add` ΜΟΝΟ δικά σου (⚠️ τα codes files είναι MIXED με ADR-460)· ένα tsc τη φορά (N.17).
6. Μετά την υλοποίηση: ενημέρωσε ADR-459 (§6f + changelog v6 + phase table 4d ✅) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).

**ADR αναφορές:** ADR-459 (master), ADR-456 (στατικά/ποσότητες SSoT), ADR-458 (DERIVED philosophy), ADR-040 (canvas perf — μην αγγίξεις high-freq), ADR-017/210/294 (enterprise IDs, για το command).
