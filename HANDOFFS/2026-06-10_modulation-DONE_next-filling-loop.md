# HANDOFF — Λέβητας: Modulation/Turndown DONE → επόμενο: Βρόχος Πλήρωσης (Filling Loop)

**Ημ/νία:** 2026-06-10 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ **επιβεβαιωμένος agent στη ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**`). Πιθανώς ενεργοί και: ΗΛΕΚΤΡΟΛΟΓΙΚΑ, ΥΔΡΕΥΣΗ/ROUTING (`systems/mep-design/**`), THERMAL (`bim/thermal/heat-load/**`), 3D GIZMO (`bim-3d/**`), COORDINATION/CLASH (`systems/coordination/**`), WALLS, FIXTURES. **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (§5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος. **ΧΡΗΣΙΜΟΠΟΙΗΣΕ WMI -Filter, ΟΧΙ `$_`** (το bash τρώει τα `$`-variables → σκουπίδια). Δούλεψε καθαρά:
> `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%tsc%'\" | Select-Object ProcessId, CommandLine | Format-List"`
> Αν επιστρέψει PID → τρέχει tsc άλλου agent → **ΠΕΡΙΜΕΝΕ**, μην ξεκινήσεις δεύτερο. Αν τίποτα → ελεύθερος.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Modulation / Turndown, ΟΛΑ uncommitted (commit ο Giorgio)

**Διαμόρφωση / Turndown ισχύος λέβητα (Modulation Ratio, Revit «Turndown Ratio» / IFC `Pset_BoilerTypeCommon` part-load family).** Οι σύγχρονοι λέβητες είναι **modulating** (ρυθμίζουν ισχύ μεταξύ ελάχιστης και ονομαστικής, ΟΧΙ on/off). Το turndown ratio (π.χ. 4:1 = 24kW max / 6kW min) ήταν θεμελιώδης ιδιότητα εξοπλισμού που έλειπε. **Data-only** (όπως efficiency/ErP — ΜΗΔΕΝ glyph), 100% boiler-owned, **ΜΗΔΕΝ conflict με τον ενεργό heating agent**, **ΕΚΤΟΣ ADR-040**, τροφοδοτεί μελλοντικό part-load sizing (ADR-422 L2).

**🔑 Revit-grade αποφάσεις που πάρθηκαν:**
1. **Param** `minThermalOutputW?: number` (ελάχιστη modulating ισχύς· μέγιστη = το ΥΠΑΡΧΟΝ `thermalOutputW`)· absent ⇒ on/off. **Κανένα νέο default const** (type-specific, έρχεται από catalog).
2. **NEW pure SSoT `boiler-modulation.ts`** (mirror `boiler-efficiency.ts`, μηδέν renderer import): `resolveTurndownRatio(minW, maxW): number | null` → `maxW/minW` σε 1 δεκαδικό όταν και τα δύο >0 **και** `minW < maxW`· αλλιώς `null` (on/off / invalid).
3. **Tag γραμμή 15** «Διαμόρφωση: 6–24 kW (4:1)» (range kW + turndown ratio). **Σκόπιμα δείχνει range+ratio σε μία γραμμή** ώστε το `resolveTurndownRatio` να **καταναλώνεται σε production** → μηδέν κίνδυνος dead-code (CHECK 3.22). Reuse `kWUnit` + NEW const `RANGE_DASH='–'`. JSDoc 1-14→1-15.
4. **Catalog**: `BoilerModelPreset += minThermalOutputW?` στα **3 αερίου** modulating presets (24k→6k, 35k→9k, 28k→7k ~4:1)· oil/electric/heat-pump on/off χωρίς min (v1)· `applyBoilerModelToParams` το γεμίζει (clear σε on/off model)· `clearBoilerModel` το αφαιρεί (Type-property, όπως `seasonalEfficiencyPercent`).
5. **UI**: NEW **numeric** key `minThermalOutput` (ακέραιοι W → plain `NUMBER_KEY_TO_FIELD`, μηδέν rounding hazard)· combobox `MIN_THERMAL_OUTPUT_W_OPTIONS` [3000/6000/9000/12000] στο **«Θερμικά» panel** δίπλα στο thermalOutput.

**Verify:** jest **245/245** στα 9 boiler+bridge suites (NEW `boiler-modulation.test.ts` +9, `mep-boiler-tag.test.ts` +5, `boiler-model-catalog.test.ts` +3)· **tsc καθαρό στα δικά μου** (οι 4 εναπομείναντες errors είναι ΑΛΛΩΝ agents: `mesh-to-object3d.ts:124` pre-existing, `bim3d-snap-bridge.ts:126`, `entity-world-aabb.ts:94`, `ProSnapToolbar.tsx:22` — **ΟΧΙ δικά μου, αγνόησέ τα**). i18n el+en ✅. N.15 docs ✅.

**⚠️ ΣΗΜΑΝΤΙΚΟ — CONCURRENT REFACTOR (shared tree):** Ενώ δούλευα, **άλλος agent έκανε split** τα `TOGGLE_KEY_TO_FIELD`/`NUMBER_KEY_TO_FIELD` από το `useRibbonMepBoilerBridge.ts` σε **NEW αρχείο** `ui/ribbon/hooks/bridge/mep-boiler-param-maps.ts` (όριο 500 γραμμών N.7.1). Το δικό μου `minThermalOutput → minThermalOutputW` mapping **επιβίωσε** (βρίσκεται τώρα στο `mep-boiler-param-maps.ts:35`). **Για το ΕΠΟΜΕΝΟ feature**: τα toggle/number maps είναι ΠΛΕΟΝ στο `mep-boiler-param-maps.ts`, ΟΧΙ μέσα στο bridge. Πρόσεξε ποιανού είναι αυτό το αρχείο όταν κάνεις `git add` (μπορεί να είναι του άλλου agent).

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (Giorgio· `git add` ΜΟΝΟ αυτά· ΟΛΑ ΕΚΤΟΣ ADR-040):**
- `src/subapps/dxf-viewer/bim/mep-boilers/boiler-modulation.ts` **(NEW)** + `__tests__/boiler-modulation.test.ts` **(NEW)**
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-tag.ts` (γραμμή 15 + import `resolveTurndownRatio` + `RANGE_DASH`)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/mep-boiler-tag.test.ts` (+5)
- `src/subapps/dxf-viewer/bim/mep-boilers/boiler-model-catalog.ts` (preset field + 3 presets + apply/clear)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/boiler-model-catalog.test.ts` (+3)
- `src/subapps/dxf-viewer/bim/types/mep-boiler-types.ts` (+`minThermalOutputW?`)
- `src/subapps/dxf-viewer/bim/types/mep-boiler.schemas.ts` (1 optional)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (numeric key union+array)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-boiler-tab.ts` (`MIN_THERMAL_OUTPUT_W_OPTIONS` + combobox)
- `src/i18n/locales/el/dxf-viewer-shell.json` · `en/dxf-viewer-shell.json` (`minThermalOutput` + `modulation` — ΠΡΟΣΕΞΕ, το γράφει κι άλλος agent)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (`project_adr408_combi_boiler.md` + index)
- ⚠️ `useRibbonMepBoilerBridge.ts` + `mep-boiler-param-maps.ts`: το mapping μου είναι εκεί ΑΛΛΑ το split το έκανε άλλος agent — **έλεγξε `git diff` πριν τα κάνεις add** (μπορεί ο άλλος agent να τα έχει ήδη commitάρει).

**🔴 Εκκρεμεί browser-verify (Giorgio):** λέβητας με `thermalOutputW`=24000 + `minThermalOutputW`=6000 → tag γραμμή «Διαμόρφωση: 6–24 kW (4:1)»· επιλογή modulating μοντέλου αερίου από catalog → auto-fill min.

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return · combi DHW (hot/cold/recirc) · καπναγωγός (flue) + chevron + vent terminal · τροφοδοσία καυσίμου (fuel) + gas-cock glyph + per-fuel διάμετροι · αποχέτευση συμπυκνωμάτων (condensate) + σιφώνι/U-trap + εξουδετερωτής/cartridge · connector stubs χρωματισμένα ανά System Classification · απόδοση + ErP · τύπος καυσίμου dropdown · model catalog (7 μοντέλα) · θερμική ισχύς · **διαμόρφωση/turndown** · L2 sizing (ADR-422) · service clearance zone (dashed) · **ΤΡΙΑΔΑ sealed-system instrumentation: ασφαλιστική βαλβίδα + δοχείο διαστολής + μανόμετρο πίεσης** · **2D plan tag (15 γραμμές)** · WYSIWYG placement ghost · MEP→BOQ autofeed.

**🟢 Η ΟΙΚΟΓΕΝΕΙΑ CONNECTORS ΕΙΝΑΙ ΠΛΗΡΗΣ** (8 connectors, περίμετρος ΓΕΜΑΤΗ) → κάθε νέο **φυσικό** εξάρτημα = **body glyph** στο `glyphStrokes`, ΟΧΙ connector.

**Μοτίβα που κυριαρχούν (FULL SSOT):**
- **Connector-driven symbol:** `buildBoilerConnectors(params)` = η ΜΟΝΗ SSoT· symbol/renderer/ghost loop πάνω της.
- **Pure glyph builders (μηδέν renderer import), όλοι στο `mep-boiler-symbol-glyphs.ts`:** `buildFlueVentStroke`, `buildFlueTerminalGlyph`, `buildFuelCockStroke`, `buildCondensateTrapStroke`, `buildCondensateNeutraliserStroke`, `buildClearanceOutline`, `buildSafetyValveGlyph`, `buildExpansionVesselGlyph`, `buildPressureGaugeGlyph`. **ΑΥΤΑ είναι το πρότυπο για τον επόμενο body glyph.**
- **`glyphStrokes` (warm-red THIN, body identity)** στο `mep-boiler-symbol.ts:220-243`: divider+flame + safety-valve + expansion-vessel + pressure-gauge → νέο body glyph εκεί (append) = **reuse glyphStrokes → renderer/ghost ΑΜΕΤΑΒΛΗΤΟΙ → ΕΚΤΟΣ ADR-040** (μην φτιάξεις νέο field τύπου `ventStrokes`/`fuelStrokes` — εκείνο ζητά renderer edit → STAGE).
- **Tag = content SSoT:** `buildBoilerTagLines(params, t)` (pure, injected translator· i18n `ribbon.commands.mepBoilerTag.*` ns `dxf-viewer-shell`). Glyphs: `DIAMETER_GLYPH='Ø'`, `PERCENT_GLYPH='%'`, `MM_GLYPH='mm'`, `CHECK_GLYPH='✓'`, `BAR_UNIT='bar'`, `LITRE_UNIT='L'`, `RANGE_DASH='–'`. (kW = i18n key `kWUnit`.)
- **Pure data SSoT modules (μηδέν renderer):** `boiler-efficiency.ts`, `boiler-modulation.ts`, `boiler-flue-terminal.ts`, `boiler-model-catalog.ts` — **πρότυπο για κάθε data-only feature**.
- **UI:** `mep-boiler-command-keys.ts` (keys + guards) → `mep-boiler-param-maps.ts` (**NEW**: `TOGGLE_KEY_TO_FIELD`/`NUMBER_KEY_TO_FIELD`) → `useRibbonMepBoilerBridge.ts` (get/onChange branches) → `contextual-mep-boiler-tab.ts` (panels). Always-visible panels = «Καθαρός χώρος» + «Ασφάλεια» (sealed-system instrumentation). **Integer presets → plain numeric· fractional/enum → static-enum STRING combobox** (guard ΠΡΙΝ τον model picker). **Boolean device → toggle, μηδέν picker.**

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (απόφαση agent, Revit-grade) — Βρόχος Πλήρωσης (Filling Loop / double-check valve)

**🔑 Γιατί ΑΥΤΟ:** Είναι ο **φυσικός σύντροφος του μανομέτρου** που μόλις τελείωσε. Σε κάθε σφραγισμένο σύστημα θέρμανσης ο βρόχος πλήρωσης (Revit/IFC `IfcValve` CHECK — διπλή βαλβίδα αντεπιστροφής WRAS + εύκαμπτος σύνδεσμος + 2 βάνες απομόνωσης) είναι η συσκευή με την οποία **γεμίζεις/συμπληρώνεις** το σύστημα στην πίεση που διαβάζει το μανόμετρο (`systemPressureBar` ~1.5 bar). Κλείνει την ομάδα **πλήρωση → ασφάλεια → όργανα** του sealed-system. **Body glyph** (η περίμετρος είναι ΓΕΜΑΤΗ, 8 connectors), 100% boiler-owned, **ΜΗΔΕΝ conflict** με τον heating agent, **ΕΚΤΟΣ ADR-040** (reuse `glyphStrokes`).

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**

1. **Body glyph, ΟΧΙ connector.** NEW pure `buildFillingLoopGlyph(v0,v1,v2,v3)` στο `mep-boiler-symbol-glyphs.ts` (πρότυπο: `buildPressureGaugeGlyph`/`buildSafetyValveGlyph` — rotation-aware along/perp, σταθερά `FILLING_*` consts, μηδέν renderer import). **Σύμβολο βρόχου πλήρωσης** = **διπλή βαλβίδα αντεπιστροφής** (δύο chevrons «»» σε σειρά, κατεύθυνση ροής) + **εύκαμπτος βρόχος** (μικρό τόξο/ημικύκλιο polyline ή U) + **2 ticks βανών απομόνωσης** στα άκρα. Κράτα το συμπαγές & **οπτικά διακριτό** από τα υπόλοιπα glyphs.
2. **Append στο ΥΠΑΡΧΟΝ `glyphStrokes`** (`mep-boiler-symbol.ts`, δίπλα στο `buildPressureGaugeGlyph` push) όταν `params.fillingLoop` → warm-red THIN δωρεάν → **ΕΚΤΟΣ ADR-040**. ⚠️ **ΜΗΝ** φτιάξεις νέο field τύπου `fillingStrokes` (θα ζητούσε renderer edit → STAGE· κράτα το reuse).
3. **Τοποθέτηση (4ο διακριτό σημείο):** ελεύθερη η **κάτω-αριστερή** γωνία (−width, −depth) — οι κατειλημμένες: φλόγα=κέντρο-κάτω(perp=0), βαλβίδα=(+w,+d), δοχείο=(+w,−d), μανόμετρο=(−w,+d). Νέες σταθερές `FILLING_LOOP_CENTRE_WIDTH_FRAC`/`_DEPTH_FRAC`.
4. **Param:** `fillingLoop?: boolean` flag (Yes/No, visualisation only — **μηδέν numeric/string**, ο βρόχος πλήρωσης είναι present/absent). Gated ανεξάρτητα (κάθε sealed system έχει έναν). Additive/optional. **Δεν χρειάζεται νέα ιδιότητα** — η πίεση που γεμίζεις είναι ήδη το `systemPressureBar` του μανομέτρου (SSoT, μην το διπλασιάσεις).
5. **Schema:** `fillingLoop: z.boolean().optional()`.
6. **Tag γραμμή 16** «Βρόχος πλήρωσης: ✓» gated by `fillingLoop` (reuse `CHECK_GLYPH`, μοτίβο `neutraliser`). JSDoc 1-15→1-16.
7. **UI:** NEW toggle key `fillingLoop` (toggles union+array στο `mep-boiler-command-keys.ts` + `TOGGLE_KEY_TO_FIELD` στο **`mep-boiler-param-maps.ts`**). Toggle button «Βρόχος πλήρωσης» στο **always-visible «Ασφάλεια» panel** (sealed-system family: βαλβίδα + δοχείο + μανόμετρο + **βρόχος πλήρωσης**). **Μηδέν picker.**
8. **i18n (N.11 — ΠΡΩΤΑ τα keys):** editor `ribbon.commands.mepBoilerEditor.fillingLoop` + tag `ribbon.commands.mepBoilerTag.fillingLoop`, σε **el ΚΑΙ en**.
9. **Tests:** `mep-boiler-symbol.test.ts` (glyph present όταν flag· absent όταν off — μοτίβο pressure-gauge symbol tests) · `mep-boiler-tag.test.ts` (γραμμή present/absent). Δεν χρειάζεται νέο pure module (boolean glyph).

**Αναμενόμενα αρχεία (~9, 100% boiler-owned, ΕΚΤΟΣ ADR-040):** `mep-boiler-types.ts` · `mep-boiler.schemas.ts` · `mep-boiler-symbol-glyphs.ts` (NEW builder + consts) · `mep-boiler-symbol.ts` (1 push) · `mep-boiler-tag.ts` (γραμμή 16) · `mep-boiler-command-keys.ts` (toggle) · `mep-boiler-param-maps.ts` (1 TOGGLE γραμμή) · `contextual-mep-boiler-tab.ts` (1 toggle) · i18n el+en · symbol+tag tests.

**ADR-040:** **ΕΚΤΟΣ** (reuse glyphStrokes, renderer/ghost loop unchanged). **ΑΝ** το pre-commit CHECK 6B/6D μπλοκάρει το `mep-boiler-symbol.ts` → stage το ADR-408 (όχι αλλαγή αρχιτεκτονικής). ΜΗΝ adr-index.

### Εναλλακτική (αν Giorgio θέλει data-only ξανά)
- **NOx emission class (ErP 813/2013)** — pure `boiler-nox.ts` (mirror `boiler-efficiency.ts`): `resolveNoxClass(mgKwh, fuelType)` έναντι των ορίων ecodesign (αέριο ≤56 mg/kWh, πετρέλαιο ≤120)· catalog field `noxMgKwh?`· tag line + read-only readout στο «Θερμικά» panel δίπλα στο ErP. **Data-only, ΜΗΔΕΝ glyph, ΕΚΤΟΣ ADR-040 εντελώς**, conflict-safe — κλείνει το ErP/ecodesign compliance story (energy class ✅, NOx ❌). Ίδιο σχήμα με το modulation που μόλις έγινε.
- **MepBoilerKind `floor-boiler` (επιδαπέδιος)** — νέος kind στο union + plinth glyph + geometry defaults. Μεγαλύτερο, αγγίζει το kind union.

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict με ενεργούς agents)
- **Design flow/return θερμοκρασίες** (`designFlowTempC`/`designReturnTempC`) — input του ενεργού heating agent· περίμενε να ελευθερωθεί το `systems/mep-design/heating`.
- **Flue/fuel/condensate 3D stub** — shared 3D converter (`bim-3d/converters/mesh-to-object3d.ts:124` pre-existing, gizmo agent).
- **Fuel color στο `mep-system-color.ts`** — shared + contended.
- **Boiler 2D grips** — shared grip/gizmo infra (gizmo agent).
- **Condensate/fuel-network auto-design** — routing (`systems/mep-design/routing/**`).
- **ADR-422 L8 primary-energy ΚΕΝΑΚ wiring** — `bim/thermal/heat-load/**`, thermal agent (boiler-side efficiency + **modulation** SSoT ΗΔΗ έτοιμα· το modulation θα τροφοδοτήσει μελλοντικό part-load sizing).
- **Per-face clearance** — boiler-owned αλλά αμφίβολης αξίας χωρίς wall-context.

## 5. ΑΡΧΕΙΑ ΑΛΛΩΝ AGENTS — ΜΗΝ ΑΓΓΙΞΕΙΣ
- **ΘΕΡΜΑΝΣΗ (ADR-428):** `systems/mep-design/heating/**` — **ΕΝΕΡΓΟΣ agent (επιβεβαιωμένο Giorgio)**
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**`
- **ΗΛΕΚΤΡΟΛΟΓΙΚΑ (ADR-430/431):** `bim/types/mep-connector-types.ts`· `electrical-*`
- **COORDINATION/CLASH (ADR-435):** `systems/coordination/**` (π.χ. `entity-world-aabb.ts` — tsc error δικό τους)
- **3D GIZMO / SNAP:** `bim-3d/**` (π.χ. `mesh-to-object3d.ts`, `bim3d-snap-bridge.ts`, `ProSnapToolbar.tsx` — tsc errors δικά τους)
- **MEP COLOR (shared, contended):** `bim/mep-systems/mep-system-color.ts` — READ-ONLY import μόνο
- **ΥΔΡΕΥΣΗ/ROUTING (ADR-426/429):** `systems/mep-design/water/**`, `systems/mep-design/routing/**`
- **FIXTURES (shared):** `bim/types/mep-fixture-types.ts` · **WALLS:** `bim/walls/opening-grips.ts`
- ⚠️ **SHARED boiler UI (contended):** `useRibbonMepBoilerBridge.ts` + `mep-boiler-param-maps.ts` — άγγιξέ τα ΜΟΝΟ αν χρειαστεί (1 γραμμή στο TOGGLE map), έλεγξε `git diff` πρώτα.

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- **N.0.1 ADR-driven:** Recognition (διάβασε ΚΩΔΙΚΑ πρώτα: `mep-boiler-symbol-glyphs.ts` [πρότυπο pure glyph builders: `buildPressureGaugeGlyph`/`buildSafetyValveGlyph` — consts, along/perp, rotation-aware], `mep-boiler-symbol.ts:220-243` [πώς γίνεται push στο glyphStrokes, placement v0..v3], `mep-boiler-tag.ts` [line gating 1-15· CHECK_GLYPH μοτίβο neutraliser], `mep-boiler-command-keys.ts` [toggles union+array+set], `mep-boiler-param-maps.ts` [TOGGLE_KEY_TO_FIELD], `contextual-mep-boiler-tab.ts` [«Ασφάλεια» panel toggles]) → **Plan Mode** → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- **N.14 model:** filling loop (1 domain, glyph+tag+UI boolean, μηδέν νέο pure module) → **Sonnet ή Opus** (δική σου κρίση· σχεδόν πανομοιότυπο με safety-valve/gauge).
- **N.11 i18n:** ΠΡΩΤΑ τα keys σε el **ΚΑΙ** en, μετά ο κώδικας· καμία hardcoded string· καμία `any` (N.2)· κανένα `as any`/`@ts-ignore`.
- **N.15:** μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (`project_adr408_combi_boiler.md` + index). **ΜΗΝ** adr-index (shared tree). ΕΚΤΟΣ ADR-040.
- **COMMIT/PUSH ΠΟΤΕ εσύ (N.(-1)).** `git add` ΜΟΝΟ δικά σου· `git status`/`git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/` + bridge `src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepBoilerBridge.test.tsx`. **Baseline μετά το modulation: 245/245 στα 9 boiler+bridge suites.**
- i18n: νέα keys σε el **ΚΑΙ** en (CHECK 3.8· μην αφήσεις `defaultValue` με literal).
- tsc μόνο στο τέλος, **N.17** (έλεγξε process ΠΡΩΤΑ — WMI filter· αν τρέχει άλλος, ΠΕΡΙΜΕΝΕ). **Αγνόησε pre-existing/άλλων-agents errors:** `mesh-to-object3d.ts:124`, `bim3d-snap-bridge.ts:126`, `entity-world-aabb.ts:94`, `ProSnapToolbar.tsx:22`, `mep-fixture-types.ts`.
- browser-verify το κάνει ο Giorgio: λέβητας → «Ασφάλεια» panel → toggle «Βρόχος πλήρωσης» → σύμβολο (διπλή βαλβίδα + βρόχος) στην κάτω-αριστερή παρειά + tag «Βρόχος πλήρωσης: ✓».
