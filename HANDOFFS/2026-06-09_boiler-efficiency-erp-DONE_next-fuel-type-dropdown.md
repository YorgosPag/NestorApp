# HANDOFF — Λέβητας: EFFICIENCY/ErP DONE → επόμενο: standalone «Τύπος Καυσίμου» dropdown (Revit fuel-type instance param)

**Ημ/νία:** 2026-06-09 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ τουλάχιστον ένας agent στη **ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**`) — επιβεβαιωμένο από Giorgio. Πιθανώς ενεργοί και: **ΥΔΡΕΥΣΗ** (`systems/mep-design/water/**`), **ROUTING** (`systems/mep-design/routing/**`), **THERMAL STUDY** (`bim/thermal/heat-load/**`, ADR-422), **3D GIZMO** (`bim-3d/animation/**`, `bim-3d/scene/**`), **WALLS** (`bim/walls/opening-grips*`). **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (βλ. §5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος (πολλοί agents). Δες CLAUDE.md N.17.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Απόδοση καύσης + Ενεργειακή κατάταξη ErP

Revit «Boiler Efficiency» / IFC `Pset_BoilerTypeCommon.NominalEfficiency`. Ο λέβητας απέκτησε **εποχιακή απόδοση** + **κλάση ErP** (το μόνο κρίσιμο Revit/ΚΕΝΑΚ attribute που έλειπε). **Ξεμπλοκάρει ADR-422 L8** primary-energy ΚΕΝΑΚ (`Q_primary = Q_net / η`).

**🔑 Revit/ErP-grade απόφαση (EU 811/2013):** αποθηκεύεται **εποχιακή απόδοση συσκευής** `seasonalEfficiencyPercent` (= Revit Nominal Efficiency, user-facing). Η **κλάση ErP** = ΞΕΧΩΡΙΣΤΗ έννοια μέσω επίσημης κλίμακας η_s με **συντελεστή πρωτογενούς ενέργειας ανά καύσιμο**: gas/oil/heat-pump factor **1.0** (heat-pump 156 = ήδη SCOP-derived η_s>100%), direct electric **CC=2.5** → ~99% αντίσταση = η_s≈40% → **D** (φυσικά σωστό, ΟΧΙ «A+»). Κλίμακα: A+++≥150, A++≥125, A+≥98, A≥90, B≥82, C≥75, D≥36, E≥34, F≥30, G<30.

**NEW pure SSoT `bim/mep-boilers/boiler-efficiency.ts`** (`ErpEfficiencyClass` union + `ERP_EFFICIENCY_CLASSES` + `PRIMARY_ENERGY_FACTOR` + `resolveErpClass(pct, fuelType?)` + `isErpEfficiencyClass` + `DEFAULT_ERP_EFFICIENCY_CLASS`· μηδέν import από symbol/renderer — μοτίβο `boiler-flue-terminal.ts`). **Catalog:** `BoilerModelPreset += seasonalEfficiencyPercent` (gas 94/93/91, oil 89/88, heat-pump 156, electric 99)· apply γεμίζει· clear καθαρίζει (Type-Catalog property όπως `fuelType`, ≠ `thermalOutputW`). **Tag:** 2 γραμμές «Απόδοση: 94%»+«ErP: A» — **ΟΧΙ combustion-gated**. **UI = υπάρχον «Θερμικά» panel:** editable combobox «Απόδοση (%)» (80/85/90/94/98) + read-only readout «ErP» (disabled, mirror ADR-422 L2 sizing readouts· erpClass readout branch **πριν** τον `sizing` guard — ανεξάρτητο).

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (από Giorgio· `git add` ΜΟΝΟ αυτά):**
- `bim/mep-boilers/boiler-efficiency.ts` (NEW pure SSoT)
- `bim/mep-boilers/__tests__/boiler-efficiency.test.ts` (NEW, 15 tests)
- `bim/mep-boilers/boiler-model-catalog.ts` (+`seasonalEfficiencyPercent` field + 7 τιμές + apply + clear)
- `bim/types/mep-boiler-types.ts` (+`seasonalEfficiencyPercent?` additive optional)
- `bim/types/mep-boiler.schemas.ts` (+`seasonalEfficiencyPercent: z.number().positive().optional()`)
- `bim/mep-boilers/mep-boiler-tag.ts` (+2 γραμμές efficiency/ErP + `PERCENT_GLYPH`)
- `ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (+`params.efficiency` number key + `readouts.erpClass`)
- `ui/ribbon/hooks/useRibbonMepBoilerBridge.ts` (`NUMBER_KEY_TO_FIELD += efficiency→seasonalEfficiencyPercent` + erpClass readout branch)
- `ui/ribbon/data/contextual-mep-boiler-tab.ts` (2 controls στο «Θερμικά» panel + `EFFICIENCY_PERCENT_OPTIONS`)
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` (SHARED — **μόνο** δικά μου keys: `mepBoilerEditor.efficiency`/`.erpClass`, `mepBoilerTag.efficiency`/`.erp`· το αρχείο έχει & άλλων agents keys → Giorgio review diff)
- `bim/mep-boilers/__tests__/mep-boiler-tag.test.ts` + `boiler-model-catalog.test.ts` (regression updates)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (topic `project_adr408_combi_boiler.md` + index)

**Verify:** jest **124/124** (7 boiler suites: +15 efficiency / +5 tag / +3 catalog) · tsc **0 νέα** (μόνο pre-existing `mesh-to-object3d.ts:124`, gizmo agent — ΟΧΙ δικό μου). ΕΚΤΟΣ ADR-040. ΜΗΝ adr-index.
**🔴 Εκκρεμεί browser-verify** (Giorgio): λέβητας με μοντέλο → «Θερμικά» panel δείχνει «Απόδοση (%)» + «ErP» readout· tag «Απόδοση: 94%» + «ErP: A»· electric→D, heat-pump→A+++.

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return connectors · **combi DHW (hot/cold/recirc)** · **καπναγωγός (flue, duct domain)** · **vent terminal (καμινάδα)** · **τροφοδοσία καυσίμου (fuel domain)** · **απόδοση + ErP κλάση (μόλις τώρα)** · model catalog (7 μοντέλα, 4 fuel types) · θερμική ισχύς · L2 sizing readout (ADR-422) · 2D plan tag (Revit Mechanical Equipment Tag, 8 γραμμές) · WYSIWYG placement ghost · MEP→BOQ autofeed.

**Pattern που κυριαρχεί:** `buildBoilerConnectors(params)` = η ΜΟΝΗ SSoT των connectors· το 2D symbol κάνει loop πάνω της (connector-driven)· `UpdateMepBoilerParamsCommand` + reconciliation ξανακάνουν seed «δωρεάν». Το catalog (`applyBoilerModelToParams`) γεμίζει geometry+thermalOutputW+fuelType+seasonalEfficiencyPercent όταν διαλεγεί μοντέλο. **Pure SSoT helpers (μοτίβο, μηδέν cycle):** `boiler-flue-terminal.ts`, `boiler-efficiency.ts`. **Bridge string-pickers** διαχωρίζονται με dedicated guards ΠΡΙΝ τον model picker (`isMepBoilerFlueTerminationKey`).

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (προτεινόμενο) — Standalone «Τύπος Καυσίμου» dropdown (Revit fuel-type instance param)

**Το κενό:** το `fuelType` (`'gas'|'oil'|'electric'|'heat-pump'`) **υπάρχει ήδη** στο `MepBoilerParams` + schema, ΑΛΛΑ ορίζεται **ΜΟΝΟ** μέσω model catalog (`applyBoilerModelToParams`). Ένας **παραμετρικός λέβητας** (modelId=Παραμετρικό) **δεν μπορεί να δηλώσει καύσιμο** → τα panels «Καπναγωγός»/«Καύσιμο» (`visibilityKey: combustion`) **δεν εμφανίζονται ποτέ**, ο καπναγωγός/fuel connector δεν seed-άρονται, και ο ErP factor μένει στο default 1.0. Στη Revit το fuel/energy-source είναι **editable instance parameter** ανεξάρτητο από το family type.

**🔑 Γιατί ΑΥΤΟ και όχι άλλο (conflict-isolation):** **100% boiler-isolated** — μηδέν `systems/mep-design/**`, μηδέν `bim/thermal/**`, μηδέν `bim-3d/**`. Ο heating agent (+ όλοι οι άλλοι) είναι σε ΑΛΛΑ αρχεία (§5). Συνέργεια με το μόλις-τελειωμένο efficiency: μόλις ο χρήστης δηλώσει fuel σε παραμετρικό λέβητα → ανοίγουν combustion panels + σωστός ErP factor.

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**
- **Static-enum string combobox** «Τύπος Καυσίμου» (ΟΧΙ catalog) — ίδιο μοτίβο με τον flue-terminal picker (`isMepBoilerFlueTerminationKey`). NEW `stringParams.fuelType` commandKey + NEW guard `isMepBoilerFuelTypeKey` **ελεγμένο ΠΡΙΝ** τον model picker branch (όλα περνούν `isMepBoilerRibbonStringKey` → πρόσθεσε το `fuelType` στο `MEP_BOILER_STRING_KEY_SET`).
- **Options = οι 4 `BoilerFuelType`** (gas/oil/electric/heat-pump) — πηγή SSoT: εξήγαγε `BOILER_FUEL_TYPES: readonly BoilerFuelType[]` + `isBoilerFuelType` guard στο `boiler-model-catalog.ts` (σήμερα ο τύπος υπάρχει αλλά ΟΧΙ runtime array — χρειάζεται για options + validation). i18n: **reuse** `ribbon.commands.mepBoilerTag.fuelTypes.*` (ήδη υπάρχουν gas/oil/electric/heat-pump) ή NEW `mepBoilerEditor.fuelTypes.*` (προτίμησε reuse — SSoT).
- **Bridge:** `getComboboxState` branch → `value: params.fuelType ?? SELECT_CLEAR_VALUE` (με «—/Απροσδιόριστο» sentinel option ώστε να μπορεί να καθαρίσει → παραμετρικός χωρίς καύσιμο)· `onComboboxChange` → `isSelectClearValue` → `dispatchParams({...params, fuelType: undefined})` (αφαίρεση), αλλιώς `fuelType: value`. **ΠΡΟΣΟΧΗ:** το `UpdateMepBoilerParamsCommand` ήδη re-seed-άρει `buildBoilerConnectors` → αλλάζοντας fuelType, flue+fuel connectors εμφανίζονται/εξαφανίζονται **δωρεάν** + combustion panels ανοίγουν/κλείνουν. ΔΕΝ πειράζεις `modelId` (Revit instance-override: μπορεί να διαφέρει από το family default· tag δείχνει το model label).
- **Θέση:** στο **«Μοντέλο» panel** (`mep-boiler-model`, είναι το "Type" panel) δίπλα στο modelId + producesDhw toggle. Έτσι ο χρήστης δηλώνει type→fuel→combi σε ένα σημείο.

**Αναμενόμενα αρχεία (~6, boiler-isolated):** `boiler-model-catalog.ts` (+`BOILER_FUEL_TYPES` array + `isBoilerFuelType` guard) · `mep-boiler-command-keys.ts` (+`stringParams.fuelType` + `isMepBoilerFuelTypeKey` + προσθήκη στο string-key set) · `useRibbonMepBoilerBridge.ts` (get/onChange branches, ελεγμένα ΠΡΙΝ τον model picker) · `contextual-mep-boiler-tab.ts` (+combobox στο «Μοντέλο» panel, options δυναμικά από bridge ή static) · i18n el+en (`mepBoilerEditor.fuelType` label + «Απροσδιόριστο» sentinel· reuse fuelTypes.* από tag) · NEW/extend test (bridge ή catalog: `BOILER_FUEL_TYPES` πληρότητα + guard).

### Εναλλακτικές (μικρότερες, αν προτιμηθεί)
- **(β) Distinct 2D «βάνα/gas-cock» glyph** για το fuel stub (τώρα = plain stub· tag+θέση το διακρίνουν). Μόνο `mep-boiler-symbol.ts` + test. Boiler-isolated, καθαρά cosmetic.
- **(γ) Per-fuel default διάμετρος** (gas DN20 / oil DN15) — σήμερα κοινό DN20. Μικρό, boiler-isolated (`mep-boiler-geometry.ts` + test).

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict με ενεργούς agents)
- **ADR-422 L8 primary-energy ΚΕΝΑΚ wiring** — `bim/thermal/heat-load/**`, thermal agent ενεργός. (Το boiler-side efficiency SSoT είναι ΗΔΗ έτοιμο — `resolveErpClass` + `seasonalEfficiencyPercent`· λείπει μόνο το thermal-side `Q_primary = Q_net / η`.)
- **Boiler 2D grips** — shared grip/gizmo infra (gizmo agent ενεργός).
- **Flue/fuel 3D stub** — shared 3D converter (`mesh-to-object3d.ts:124` έχει pre-existing error από gizmo agent).
- **Fuel-network auto-design** — θα άγγιζε routing (`systems/mep-design/routing/**`, routing agent ενεργός).

## 5. ΑΡΧΕΙΑ ΑΛΛΩΝ AGENTS — ΜΗΝ ΑΓΓΙΞΕΙΣ
- **ΘΕΡΜΑΝΣΗ (ADR-428):** `systems/mep-design/heating/**` — **ΕΝΕΡΓΟΣ agent (επιβεβαιωμένο Giorgio)**
- **ΥΔΡΕΥΣΗ (ADR-426):** `systems/mep-design/water/**`
- **ROUTING (ADR-429):** `systems/mep-design/routing/**`
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**`
- **3D GIZMO:** `bim-3d/animation/**`, `bim-3d/scene/ThreeJsSceneManager.ts`
- **WALLS:** `bim/walls/opening-grips.ts` + test
- **GEOMETRY (shared):** `bim/geometry/shared/polygon-utils.ts`
- Διάφορα ADR docs (422/423/426/428/429) + HANDOFFS/* άλλων agents

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- N.0.1 ADR-driven 4 φάσεις: Recognition (διάβασε ΚΩΔΙΚΑ πρώτα: `boiler-model-catalog.ts`, `mep-boiler-command-keys.ts` [string-key guards + `isMepBoilerFlueTerminationKey` ως πρότυπο], `useRibbonMepBoilerBridge.ts` [string-picker branches, ελεγμένα ΠΡΙΝ τον model picker], `contextual-mep-boiler-tab.ts` [«Μοντέλο» panel]) → Plan Mode → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- N.14 model: fuel-type dropdown (Plan Mode, ~6 αρχεία, 1 domain) → **Opus**· δήλωσε & περίμενε «ok» (ή continuation).
- FULL SSOT: `BOILER_FUEL_TYPES` array = ΕΝΑ runtime source για options + guard + validation· reuse i18n `fuelTypes.*` (μην διπλασιάζεις)· καμία `any` (N.2)· καμία hardcoded string (N.11).
- N.15: μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (topic `project_adr408_combi_boiler.md` + index γραμμή). **ΜΗΝ** adr-index (shared tree).
- ΕΚΤΟΣ ADR-040 (fuel-type = pure data + ribbon· renderer subscriptions/cache-key ανέγγιχτα).
- COMMIT/PUSH **ΠΟΤΕ** εσύ (N.(-1)). `git add` ΜΟΝΟ δικά σου· έλεγξε `git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/` (τώρα baseline **124/124**).
- bridge tests (αν αγγίξεις bridge): ψάξε `useRibbonMepBoilerBridge` ή boiler-bridge suites.
- tsc μόνο στο τέλος, N.17 (έλεγξε process πρώτα — πολλοί agents). Αγνόησε το pre-existing `mesh-to-object3d.ts:124`.
- browser-verify το κάνει ο Giorgio.
