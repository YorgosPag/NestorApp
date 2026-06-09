# HANDOFF — Λέβητας: FUEL INLET DONE → επόμενο: Απόδοση καύσης + ενεργειακή κατάταξη ErP (ΚΕΝΑΚ feed)

**Ημ/νία:** 2026-06-09 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχουν ΠΑΡΑΛΛΗΛΑ agents σε **ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**`), **ΥΔΡΕΥΣΗ** (`systems/mep-design/water/**`), **ROUTING** (`systems/mep-design/routing/**`), **THERMAL STUDY** (`bim/thermal/heat-load/**`, ADR-422), **3D GIZMO** (`bim-3d/animation/**`, `bim-3d/scene/**`), **WALLS** (`bim/walls/opening-grips*`). **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (βλ. §5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος (πολλοί agents). Δες CLAUDE.md N.17.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Τροφοδοσία Καυσίμου (Fuel Supply Inlet)

Revit «Mechanical Equipment → fuel connector». Ο λέβητας gas/oil απέκτησε **είσοδο καυσίμου** (έβγαζε καυσαέρια μέσω καπναγωγού αλλά δεν είχε είσοδο).

**🔑 Αρχιτεκτονική απόφαση (locked, (β)): ΝΕΟ `fuel` domain** (mirror του πώς ο flue θεμελίωσε το `duct`). ΟΧΙ `pipe`+νέο `PlumbingSystemClassification` member — το καύσιμο ≠ νερό, και θα μόλυνε shared classification switches (color-resolver/pipe-network-source/auto-design) ΕΚΕΙ που δουλεύουν οι MEP agents. **Zero-regression verified:** κανένα exhaustive `switch(domain)`/`: never` πάνω στο `MepConnectorDomain` (μόνο equality `=== 'pipe'`/`'duct'`) → το `'fuel'` το αγνοούν αυτόματα οι pipe consumers· ο `else` του symbol → plain stub χωρίς logic change.

**Connector:** id `boiler-fuel`, `domain:'fuel'`, `flow:'in'`, classification `fuel-gas`/`fuel-oil` (από `fuelType`), θέση **front-centre `{0,+hl}`** (διακριτό από supply/return y=0, 4 DHW γωνίες, back-centre flue `{0,-hl}`). Gated μόνο `fuelType ∈ {gas,oil}` (ανεξάρτητα combi/DHW + flue). Διάμετρος = `fuelConnectorDiameterMm ?? DEFAULT_BOILER_FUEL_DIAMETER_MM` (DN20· options 15/20/25). 2D symbol + WYSIWYG ghost **δωρεάν** (connector-driven loop). Tag: 6η γραμμή «Παροχή: Ø DNxx». UI: NEW «Καύσιμο» panel (reuse `combustion` visibility key).

**+ Label fix (μετά από feedback Giorgio):** το combobox label el `fuelDiameter` άλλαξε «Διάμετρος τροφοδοσίας»→**«Διάμετρος καυσίμου»** (το «τροφοδοσία» ήταν ασαφές με νερό). **ΣΗΜΕΙΩΣΗ UX:** ο `RibbonPanel.tsx` **ΔΕΝ render-άρει τίτλους panel** — άρα η λέξη «Καύσιμο»/«Καπναγωγός»/«ΖΝΧ» ΔΕΝ φαίνεται πουθενά (μόνο τα combobox labels). Ο χρήστης αναγνωρίζει το control από το label του combobox.

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (από Giorgio· `git add` ΜΟΝΟ αυτά):**
- `bim/types/mep-connector-types.ts` (SHARED — `MepConnectorDomain +='fuel'` + `FuelSystemClassification` + `MepFuelConnectorParams` + `fuel?` + `BOILER_FUEL_CONNECTOR_ID` + `buildBoilerFuelConnector`)
- `bim/types/mep-connector.schemas.ts` (SHARED — `+'fuel'` enum + `FuelSystemClassificationSchema` + `MepFuelConnectorParamsSchema` + `.fuel` branch)
- `bim/mep-boilers/mep-boiler-geometry.ts` (fuel inlet gated-by-fuelType)
- `bim/mep-boilers/mep-boiler-tag.ts` (+fuel-supply line)
- `bim/mep-boilers/mep-boiler-symbol.ts` (μόνο JSDoc — fuel αυτόματα ως stub)
- `bim/types/mep-boiler-types.ts` (+`fuelConnectorDiameterMm?` + `DEFAULT_BOILER_FUEL_DIAMETER_MM`)
- `bim/types/mep-boiler.schemas.ts` (+`fuelConnectorDiameterMm` optional)
- `ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (`params.fuelDiameter`)
- `ui/ribbon/hooks/useRibbonMepBoilerBridge.ts` (1 γραμμή `NUMBER_KEY_TO_FIELD`)
- `ui/ribbon/data/contextual-mep-boiler-tab.ts` (NEW «Καύσιμο» panel)
- `bim/mep-boilers/__tests__/boiler-fuel-connector.test.ts` (NEW)
- `bim/mep-boilers/__tests__/mep-boiler-geometry.test.ts` + `mep-boiler-symbol.test.ts` + `mep-boiler-tag.test.ts` (regression updates)
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` (SHARED — **μόνο** boiler keys δικά μου: `mepBoilerFuel`, `mepBoilerEditor.fuelDiameter`, `mepBoilerTag.fuelSupply`· **το αρχείο έχει & άλλων agents keys** → Giorgio review diff)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (topic+index)

**Verify:** jest **101/101** (6 boiler suites) · tsc **0 νέα** (μόνο pre-existing `mesh-to-object3d.ts:124`, ΟΧΙ δικό μου) · 119/120 affected MEP (1 fail `bim-discipline.test.ts` **ΠΡΟΫΠΑΡΧΕΙ** — stale `mep-water-heater`/`mep-underfloor` plumbing categories, άσχετο). ΕΚΤΟΣ ADR-040. ΜΗΝ adr-index.
**🔴 Εκκρεμεί browser-verify** (Giorgio): λέβητας gas/oil → «Καύσιμο» panel («Διάμετρος καυσίμου») + tag «Παροχή: Ø DN20» + fuel stub front-centre.

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (τι υπάρχει ήδη — ΟΛΑ DONE)

footprint · supply/return connectors · **combi DHW (hot/cold/recirc)** · **καπναγωγός (flue, duct domain)** · **vent terminal (καμινάδα)** · **τροφοδοσία καυσίμου (fuel domain — μόλις τώρα)** · model catalog (7 μοντέλα, 4 fuel types) · θερμική ισχύς · L2 sizing readout (ADR-422) · 2D plan tag (Revit Mechanical Equipment Tag, 6 γραμμές) · WYSIWYG placement ghost · MEP→BOQ autofeed.

**Pattern που κυριαρχεί:** `buildBoilerConnectors(params)` = η ΜΟΝΗ SSoT των connectors· το 2D symbol κάνει loop πάνω της (connector-driven, μηδέν hardcode)· `UpdateMepBoilerParamsCommand` + reconciliation ξανακάνουν seed «δωρεάν». Το catalog (`applyBoilerModelToParams`) γεμίζει geometry+thermalOutputW+fuelType όταν διαλεγεί μοντέλο.

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (προτεινόμενο) — Απόδοση καύσης + Ενεργειακή κατάταξη ErP (Revit «Boiler Efficiency» / IFC `Pset_BoilerTypeCommon.NominalEfficiency`)

**Γιατί:** Είναι το **μόνο κρίσιμο Revit/ΚΕΝΑΚ attribute που λείπει** από τον λέβητα. Ένας Revit boiler έχει `Nominal Efficiency` (Type param)· η EU ErP (811/2013) δίνει εποχιακή απόδοση θέρμανσης η_s + κλάση A+++…G. **Ξεμπλοκάρει το ADR-422 L8** (primary-energy ΚΕΝΑΚ rating: `Q_primary = Q_net / η`) που είναι flagged ως BLOCKED-on-boiler-efficiency.

**🔑 Γιατί ΑΥΤΟ και όχι άλλο (conflict-isolation):** είναι **100% boiler-isolated** — μηδέν `mep-connector-*`, μηδέν `systems/mep-design/**`, μηδέν `bim/thermal/**`. Όλοι οι άλλοι MEP/thermal/gizmo agents είναι σε ΑΛΛΑ αρχεία (βλ. §5). Τα boiler 2D grips & flue 3D stub παραμένουν DEFER (shared gizmo/3D converter).

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**
- **NEW SSoT `bim/mep-boilers/boiler-efficiency.ts`:** `ErpEfficiencyClass` union (`'A+++'|'A++'|'A+'|'A'|'B'|'C'|'D'|'E'|'F'|'G'`) + `ERP_EFFICIENCY_CLASSES` registry + `DEFAULT_*` + pure `resolveErpClass(seasonalEfficiencyPercent, fuelType): ErpEfficiencyClass` (κατώφλια ErP ανά fuel — π.χ. condensing gas η_s≥90→A· heat-pump η_s≥125→A++/A+++· electric ~D λόγω primary-energy factor) + `isErpEfficiencyClass` guard. **Pure, unit-tested, μηδέν import από symbol/renderer** (μοτίβο `boiler-flue-terminal.ts`).
- **Catalog:** `BoilerModelPreset += seasonalEfficiencyPercent` (ρεαλιστικές τιμές: gas condensing ~94, oil ~89, heat-pump ~150, electric ~99 appliance) · `applyBoilerModelToParams` το γεμίζει· `clearBoilerModel` το καθαρίζει.
- **Param:** `MepBoilerParams += seasonalEfficiencyPercent?` (additive optional· `.schemas.ts` `.positive().optional()`).
- **Tag:** NEW γραμμή «Απόδοση: 94%» + «ErP: A» (**ΟΧΙ** combustion-gated — όλοι οι λέβητες έχουν απόδοση/κλάση, incl. electric/heat-pump· εμφάνιση όταν `seasonalEfficiencyPercent` present).
- **UI:** στο υπάρχον **«Θερμικά» panel**: editable combobox «Απόδοση (%)» (number key, options π.χ. 80/85/90/94/98) + **read-only readout** «ErP» (disabled combobox, mirror των sizing readouts — `resolveErpClass`). ΟΧΙ νέο panel.

**Αναμενόμενα αρχεία (~9, boiler-isolated):** NEW `boiler-efficiency.ts` + test · `boiler-model-catalog.ts` (+field + apply/clear) · `mep-boiler-types.ts`/`.schemas.ts` (+`seasonalEfficiencyPercent?`) · `mep-boiler-tag.ts` (+2 γραμμές) · `mep-boiler-command-keys.ts` (+`params.efficiency` number key + `readouts.erpClass`) · `useRibbonMepBoilerBridge.ts` (number field + erp readout branch) · `contextual-mep-boiler-tab.ts` (2 controls στο «Θερμικά» panel) · i18n el+en · regression `mep-boiler-tag.test.ts`/`boiler-model-catalog.test.ts`.

> ⚠️ **L8 ΚΕΝΑΚ integration = DEFER:** το `bim/thermal/heat-load/**` (primary-energy) το δουλεύει **ΑΛΛΟΣ agent ΤΩΡΑ** (uncommitted changes εκεί). Άσε το L8 wiring ως follow-up — ο boiler agent παρέχει ΜΟΝΟ το efficiency SSoT (boiler-side). Σημείωσέ το ως pending.

### Εναλλακτικές (μικρότερες, αν προτιμηθεί)
- **(α) Standalone «Τύπος Καυσίμου» dropdown** (gas/oil/electric/heat-pump) πάντα ορατό → ώστε ΚΑΙ παραμετρικός λέβητας (χωρίς μοντέλο) να δηλώνει fuel & να ανοίγουν τα combustion panels (καπναγωγός/καύσιμο). Boiler-isolated, ~3 αρχεία. **Σημερινό κενό:** το `fuelType` ορίζεται ΜΟΝΟ μέσω model catalog.
- **(β) Distinct 2D «βάνα/gas-cock» glyph** για το fuel stub (τώρα = plain stub· tag+θέση το διακρίνουν). Μόνο `mep-boiler-symbol.ts` + test.

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict)
- **Boiler 2D grips** — shared grip/gizmo infra (gizmo agent ενεργός).
- **Flue/fuel 3D stub** — shared 3D converter (`mesh-to-object3d.ts` έχει ΗΔΗ pre-existing error:124 από gizmo agent).
- **ADR-422 L8 primary-energy ΚΕΝΑΚ** — `bim/thermal/heat-load/**`, thermal agent ενεργός.
- **Fuel-network auto-design** — θα άγγιζε routing (`systems/mep-design/routing/**`, routing agent ενεργός).

## 5. ΑΡΧΕΙΑ ΑΛΛΩΝ AGENTS — ΜΗΝ ΑΓΓΙΞΕΙΣ (uncommitted ΤΩΡΑ στο tree)
- **ΘΕΡΜΑΝΣΗ (ADR-428):** `systems/mep-design/heating/**` (π.χ. `pair-supply-return.ts`)
- **ΥΔΡΕΥΣΗ (ADR-426):** `systems/mep-design/water/**` (`design-water-supply.ts`, `pair-cold-hot.ts`, `index.ts`)
- **ROUTING (ADR-429):** `systems/mep-design/routing/**` (`offset-pairing.ts`)
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**` (`annual-gains-config`, `derive-annual-energy`, `heat-load-engine`, `heat-load-types`, `space-boundary-resolver`)
- **3D GIZMO:** `bim-3d/animation/**`, `bim-3d/scene/ThreeJsSceneManager.ts`
- **WALLS:** `bim/walls/opening-grips.ts` + test
- **GEOMETRY (shared):** `bim/geometry/shared/polygon-utils.ts` (+azimuth test) — κάποιος το άλλαξε· μην το αγγίξεις
- Διάφορα ADR docs (422/423/426/429) + HANDOFFS/* άλλων agents

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- N.0.1 ADR-driven 4 φάσεις: Recognition (διάβασε ΚΩΔΙΚΑ πρώτα: `boiler-model-catalog.ts`, `mep-boiler-tag.ts`, `boiler-flue-terminal.ts` ως πρότυπο SSoT, `contextual-mep-boiler-tab.ts` «Θερμικά» panel, bridge readout pattern) → Plan Mode → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- N.14 model: για efficiency (Plan Mode, ~9 αρχεία, 1 domain) → **Opus**· δήλωσε & περίμενε «ok» (ή continuation).
- FULL SSOT: pure unit-tested `boiler-efficiency.ts` (μηδέν cycle)· catalog-driven· i18n SSoT el+en (ΟΧΙ hardcoded strings, N.11)· καμία `any` (N.2).
- N.15: μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (topic `project_adr408_combi_boiler.md` + index γραμμή). **ΜΗΝ** adr-index (shared tree).
- ΕΚΤΟΣ ADR-040 (efficiency = pure data + tag line + ribbon· renderer subscriptions/cache-key ανέγγιχτα).
- COMMIT/PUSH **ΠΟΤΕ** εσύ (N.(-1)). `git add` ΜΟΝΟ δικά σου· έλεγξε `git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/`
- tsc μόνο στο τέλος, N.17 (έλεγξε process πρώτα — πολλοί agents). Αγνόησε το pre-existing `mesh-to-object3d.ts:124`.
- browser-verify το κάνει ο Giorgio.
