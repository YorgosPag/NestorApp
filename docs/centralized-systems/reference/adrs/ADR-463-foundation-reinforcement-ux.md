# ADR-463 — Foundation Reinforcement UX (mirror Column: Ribbon → Properties → 2Δ/3Δ → PDF → Auto)

**Status:** 🟢 Slices 0-7 IMPLEMENTED 2026-06-16 (Opus) — UNCOMMITTED (🔴 browser-verify + commit). **Slice 6 (PDF detail-sheet) DONE** (φύλλο σχεδίου κάτοψη/τομή/3Δ/στοιχεία + PDF, mirror ADR-457). jest: footing-detail-sheet 7/7 + όλο το detail-sheet suite 14 suites/77 GREEN· foundation-structural-param 8/8, footing-rebar-3d+foundation-to-three 9/9, foundation-preset 5/5, +183 schedule/bridge GREEN (μηδέν regression).
**Discipline:** Δομοστατικά / Structural Engineering — Θεμελίωση (substructure)
**Scope:** Η **ίδια ακριβώς** end-to-end εμπειρία οπλισμού που έχει η **κολώνα** (ADR-456/457/459/460/363) εφαρμόζεται στα **θεμελιακά στοιχεία** του ADR-436: μεμονωμένο πέδιλο (`pad`), συνεχές πέδιλο/λωρίδα (`strip`), πεδιλοδοκός/συνδετήρια δοκός (`tie-beam`). Δηλαδή: επιλογή → contextual ribbon tab → αριστερό «Ιδιότητες» panel με πεδία οπλισμού → 2Δ+3Δ render οπλισμού → PDF detail-sheet → «Αυτόματος Οπλισμός». FULL ENTERPRISE + FULL SSoT, Revit-grade.

---

## 1. Context & Problem

Ο **compute/model/persist/providers/auto-reinforce/organism** κορμός του οπλισμού θεμελίωσης **υπάρχει ήδη πλήρης** (ADR-459 Φ4b/4d + ADR-456):

- **Types/persist:** `FoundationParams.reinforcement` ανά kind — `PadReinforcement` (δι-διευθυντική σχάρα) / `StripReinforcement` (εγκάρσιες + διαμήκεις + συνδετήρες) / `TieBeamReinforcement` (REUSE `BeamReinforcement`). Optional, persisted, geometry-is-SSoT.
- **Compute:** `computeFootingReinforcementQuantities` (`footing-reinforcement-compute.ts`) — dispatcher ανά kind, tie-beam delegate→beam.
- **Code providers:** EC2 + ΕΚΩΣ `suggestFootingReinforcement` + limits.
- **Auto-reinforce:** `buildReinforcePatch`/`buildFoundationReinforcePatch` (`section-context.ts`) + `AutoReinforceOrganismCommand` + `useStructuralAutoReinforce` (`isFoundationEntity` ήδη μέσα) + κουμπί ribbon «Αυτόματος Οπλισμός» (`foundation-structural` panel) που ήδη emit-άρει `bim:auto-reinforce-requested`.
- **Organism ratio check:** ήδη καλύπτει foundation.
- **Contextual ribbon tab:** `CONTEXTUAL_FOUNDATION_TAB` + `useRibbonFoundationBridge` ήδη ζωντανά (geometry params + auto-reinforce action).

**Το κενό είναι αποκλειστικά το UX/render/PDF chain** (που για την κολώνα έγινε στα ADR-363/456/457/460):

| Layer | Κολώνα | Πέδιλο/Πεδιλοδοκός | ADR-463 |
|---|---|---|---|
| Αριστερό «Ιδιότητες» με πεδία οπλισμού | ✅ | ❌ | **NEW** |
| 2Δ rebar render | ✅ | ❌ | **NEW** |
| 3Δ rebar render | ✅ | ❌ | **NEW** |
| PDF detail-sheet | ✅ | ❌ | **NEW (region builders· framework 95% generic)** |
| BOQ/schedule steel weight | ✅ | ❌ | **NEW (wiring)** |

**Αρχή (εντολή Giorgio):** ΜΗΝ ξαναγραφτεί κανένα type/compute/provider/command — **mirror** ακριβώς το pattern της κολώνας, επεκτείνοντας μόνο το UX/render/PDF.

---

## 2. Architecture — mirror της κολώνας, ένα SSoT ανά concern

### 2.1 Reuse map (ΧΡΗΣΙΜΟΠΟΙΟΥΜΕ ως έχει — μηδέν duplicate, N.0.2)
- **Compute/types:** `footing-reinforcement-compute.ts` (+`-types.ts`), `beam-reinforcement-compute.ts`, `slab-foundation-reinforcement-compute.ts`.
- **Catalogs/codes:** `rebar-catalog.ts` (`REBAR_DIAMETERS_MM`), `concrete-grades.ts`, `codes/*` (providers + `resolveStructuralCode`), `section-context.ts` (`buildFootingSectionContext`, `buildReinforcePatch`), `structural-settings-store`.
- **Panel shell:** `BimPropertiesShell.tsx` (`foundation` ήδη στο `isBimEntity`) → `BimPropertiesRouter.tsx` (1 νέο `if`).
- **Descriptor pattern:** `column-property-fields.ts` + `ColumnAdvancedPanel.tsx` + `ColumnPropertyRow.tsx`.
- **Ribbon bridge:** `useRibbonFoundationBridge.ts` + `foundation-command-keys.ts` (επεκτείνονται).
- **2Δ pass pattern:** `DxfRenderer.drawColumnReinforcement2D` + `bim/renderers/column-rebar-2d.ts` + `isReinforcementVisible()` gate.
- **3Δ:** `bim-3d/converters/column-rebar-3d.ts` (`REBAR_MATERIAL` singleton, `buildRods`, InstancedMesh) + `scalePoints`/`sceneToM` (ADR-462) + `foundation-to-three.ts`.
- **PDF (100% generic reuse):** `detail-sheet-types.ts`, `detail-sheet-layout.ts`, `detail-sheet-dim.ts`, `detail-sheet-fit.ts`, `render/detail-canvas-renderer.ts`, `render/detail-pdf-renderer.ts` (`buildColumnDetailPdf` παίρνει generic `DetailSheetModel`), `render/detail-raster-*.ts`, `ColumnDetailDialog.tsx`.

### 2.2 Νέα modules (mirror-pattern)
- **Bridge:** `foundation-command-keys.ts` += `FOUNDATION_STRUCTURAL_KEYS` + `FOUNDATION_STRUCTURAL_READOUT_KEYS` (kind-aware)· NEW `foundation-structural-param.ts` (option lists reuse `REBAR_DIAMETERS_MM`)· NEW `foundation-structural-bridge.ts` (`resolve/applyFoundationStructuralChange` + readouts μέσω `computeFootingReinforcementQuantities`)· NEW `foundation-bridge-combobox-resolvers.ts`· NEW `useFoundationParamsDispatcher.ts` (extract του inline dispatchParams).
- **Panel:** NEW `ui/foundation-advanced-panel/` (`foundation-property-fields.ts` kind-aware descriptor + `FoundationAdvancedPanel.tsx` + `FoundationPropertiesTab.tsx` + reuse `ColumnPropertyRow`).
- **Render resolver:** NEW `bim/structural/active-footing-reinforcement.ts` (`resolveActiveFootingReinforcementForParams` — stored design· render SSoT).
- **2Δ:** NEW `bim/renderers/footing-rebar-2d.ts` + `DxfRenderer.drawFoundationReinforcement2D` pass.
- **3Δ:** NEW `bim-3d/converters/footing-rebar-3d.ts` + `foundation-to-three.attachFoundationRebar`· shared `REBAR_MATERIAL`/`buildRods` εξάγονται από `column-rebar-3d.ts`.
- **PDF:** NEW `footing-detail-sheet.ts` + region builders (`footing-detail-plan/-elevation/-schedule/-titleblock/-perspective`) + `render/footing-detail-3d-capture.ts` + `FoundationDetailHost.tsx`· ribbon «Λεπτομέρεια Οπλισμού» button + `bim:foundation-detail-requested`.
- **BOQ:** `schedule-presets.ts` wire foundation steel weight.

### 2.3 Kind-aware UX (η μόνη ουσιαστική διαφορά από κολώνα)
Η κολώνα έχει ΕΝΑ shape-family· το foundation είναι **discriminated union** 3 kinds με διαφορετικά πεδία οπλισμού. Το Properties descriptor + 2Δ/3Δ/PDF builders dispatch-άρουν ανά `params.kind`:
- **pad** → κάτω σχάρα X/Y (Ø+βήμα) + προαιρετική άνω σχάρα + cover.
- **strip** → εγκάρσια σχάρα (Ø+βήμα) + διαμήκεις διανομής (Ø+πλήθος) + προαιρ. συνδετήρες + cover.
- **tie-beam** → κάτω/άνω διαμήκης (Ø+πλήθος) + συνδετήρες + cover (beam-like).

---

## 3. Decisions (Revit-grade)
1. **Scope = και τα 3 kinds**, μέσω του ΕΝΟΣ foundation tab/bridge/panel.
2. **Render parity χωρίς νέο `auto` flag** στο shared model (ADR-459/460 types αμετάβλητα): ο render resolver επιστρέφει το stored `reinforcement` (undefined → δεν ζωγραφίζεται, ίδια συμπεριφορά με κολώνα πριν το auto). Trigger = «Αυτόματος Οπλισμός» ή χειροκίνητη επεξεργασία πεδίου.
3. **Πεδία οπλισμού στο Properties panel** (όχι στο ribbon) — ακριβώς όπως η κολώνα μετά το ADR-363. Το ribbon κρατά «Αυτόματος Οπλισμός» + «Λεπτομέρεια» + (NEW) show-reinforcement toggle.
4. **PDF framework reuse**: ο `DetailSheetModel` + canvas/pdf/dim/fit/layout renderers είναι ήδη backend-agnostic → μόνο νέοι region builders + 3D capture.

## 4. DEFER
- Real-time auto re-derive σε αλλαγή διαστάσεων πεδίλου (χρειάζεται `auto` flag στο shared model — ξεχωριστό slice/ADR, συντονισμός ADR-459/460).
- Stepped/sloped pad rebar geometry (Phase 1 = flat).
- Πλουσιότερο schedule (dowels/αναμονές οργανισμού — ADR-459 items).

## 5. Verification
- **Jest:** foundation-structural-bridge (resolve/apply ανά kind), footing-rebar-2d/3d geometry, footing-detail builders· + όλο το structural suite GREEN (μηδέν regression).
- **tsc:** ένα τη φορά (N.17), δικά μου clean.
- **Browser (Firestore baseline comp_9c7c1a50… / Κτήριο Α1):** φτιάξε πέδιλο + πεδιλοδοκό + συνδετήρια → επίλεξε → (α) ribbon foundation tab· (β) αριστερά «Ιδιότητες» με πεδία οπλισμού· (γ) «Αυτόματος Οπλισμός» + show-reinforcement → 2Δ+3Δ rebar· (δ) «Λεπτομέρεια Οπλισμού» → PDF preview===export. Side-by-side με κολώνα.

---

## 6. Changelog
- **2026-06-16 (Opus):** ADR δημιουργήθηκε (Slice 0). Plan approved. Reuse map + mirror-pattern + 8 slices. Έρευνα: όλο το compute/model/persist/providers/auto-reinforce υπάρχει ήδη· κενό = UX/render/PDF.
- **2026-06-16 (Opus):** Slices 0-5 + 7 ΥΛΟΠΟΙΗΘΗΚΑΝ (UNCOMMITTED):
  - **S1 bridge:** NEW `foundation-structural-param.ts` (kind-aware read/patch + option lists reuse `REBAR_DIAMETERS_MM`), `foundation-structural-bridge.ts` (resolve/apply/readouts via `computeFootingReinforcementQuantities` + `buildFootingSectionContext`· `code`→settings store), `foundation-bridge-combobox-resolvers.ts`, `useFoundationParamsDispatcher.ts`· επέκταση `foundation-command-keys.ts` (+`FOUNDATION_STRUCTURAL_KEYS`/`_READOUT_KEYS` + guards).
  - **S2 panel:** NEW `ui/foundation-advanced-panel/` (`foundation-property-fields.ts` kind-aware descriptor [reuse `ColumnProperty*` types + `ColumnPropertyRow`], `FoundationAdvancedPanel.tsx`, `FoundationPropertiesTab.tsx`)· `BimPropertiesRouter` +`isFoundationEntity` case· i18n el+en (`foundationStructural.*` + `foundationAdvancedPanel.sections.*`).
  - **S3 render resolver:** NEW pure `bim/structural/active-footing-reinforcement.ts` (stored design· no `auto` flag· zero store import).
  - **S4 2Δ:** NEW `bim/renderers/footing-rebar-2d.ts` (kind-aware από footprint corners)· `DxfRenderer.drawFoundationReinforcement2D` scene-level pass (gate `isReinforcementVisible`).
  - **S5 3Δ:** NEW `bim-3d/converters/rebar-3d-shared.ts` (εξαγωγή `REBAR_MATERIAL`/`buildRods`/`toThree`/`Seg`/`MM_TO_M`/`MIN_RADIUS` από `column-rebar-3d`· **pure → λύνει το `fetch is not defined` landmine** για τα converter tests)· NEW `footing-rebar-3d.ts` (οριζόντιες σχάρες + κάθετοι συνδετήρες)· `foundation-to-three.attachFoundationRebar` (sibling cage group· return → `THREE.Object3D`).
  - **S7 BOQ:** `schedule-presets.mapFoundation` + `steelWeight` (via footing compute) + νέα στήλη `FOUNDATION_COLUMNS`.
  - ΜΑΘΗΜΑ: `column-rebar-3d` σέρνει το store-coupled `active-reinforcement` (fetch landmine)· τα κοινά 3Δ primitives ΠΡΕΠΕΙ να ζουν σε pure shared module για να τα reuse-άρει το foundation cage χωρίς μόλυνση converter tests.
- **2026-06-16 (Opus) — Slice 6 (PDF detail-sheet) ΥΛΟΠΟΙΗΘΗΚΕ (UNCOMMITTED), mirror ADR-457:**
  - **Region builders (pure, sheet-mm):** NEW `footing-detail-plan.ts` (κάτοψη σχάρας/ράβδων/συνδετήρα ανά kind), `footing-detail-elevation.ts` (εγκάρσια ΔΙΑΤΟΜΗ width×thickness — κουκκίδες κύριων/άνω ράβδων + stirrup outline), `footing-detail-schedule.ts` (πίνακας ποσοτήτων via `computeFootingReinforcementQuantities` + `buildFootingSectionContext`· στήλες Στοιχείο|Οπλισμός|Μήκος|Βάρος + κύριος/δευτερεύων/συνδετήρες/σύνολο/ρ), `footing-detail-titleblock.ts` (kind/διατομή/πάχος/σκυρ./χάλυβας/cover/κύριος+δευτ.). geometry-is-SSoT (διαστάσεις από section-context, οπλισμός από `resolveActiveFootingReinforcementForParams`).
  - **3Δ capture:** NEW shared `render/detail-3d-capture-core.ts` (εξαγωγή SSoT scaffolding: isometric camera tight-fit / concrete prism / projectNorm / offscreen render / dispose) + NEW `render/footing-detail-3d-capture.ts` (CANONICAL un-rotated footing → prism + `buildFootingRebarCage` → isometric PNG + W/L/H dims· marks=[] [σχάρες]· 🚨 dispose geometry-only στον κλωβό [shared `REBAR_MATERIAL`]). Reuse γενικού `buildColumnPerspectiveRegion` (kind-neutral).
  - **Orchestrator:** NEW `footing-detail-sheet.ts` (`buildFootingDetailSheet({foundation,labels,layoutInput?,perspective3d?})` → 5 regions) + footing label types στο `detail-sheet-types.ts`.
  - **Dialog SSoT:** NEW `ui/components/detail-sheet/DetailSheetDialog.tsx` (γενικός presentational — labels prop, zero i18n· preview===PDF)· `ColumnDetailDialog` → thin wrapper· rename `buildColumnDetailPdf`→`buildDetailSheetPdf`.
  - **Host + wiring:** NEW `ui/components/foundation-detail/FoundationDetailHost.tsx` (listen `bim:foundation-detail-requested`→build+capture+dialog)· EventBus type· `FOUNDATION_RIBBON_KEYS_ACTIONS.reinforcementDetail`· κουμπί «Λεπτομέρεια Οπλισμού» στο `foundation-structural` panel· `useRibbonFoundationBridge` emit· lazy-components + `DxfViewerDialogs` mount· i18n `foundationDetail.*` (el+en).
  - **Jest:** NEW `footing-detail-sheet.test.ts` (7: layout 5 regions, non-empty plan/section/schedule/titleblock pad+strip+tie, raster slot, empty χωρίς οπλισμό, schedule numbers == compute SSoT)· όλο το detail-sheet suite 14/77 GREEN.
  - ΜΑΘΗΜΑ: ο γενικός `buildColumnPerspectiveRegion`/`ColumnDetail3dCapture` είναι kind-neutral → reuse ως-έχει· το column 3D-capture migrate-άρεται στο `detail-3d-capture-core` on-touch (flag pending-ratchet).
