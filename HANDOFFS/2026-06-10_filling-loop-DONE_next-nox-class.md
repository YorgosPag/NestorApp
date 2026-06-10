# HANDOFF — Λέβητας: Filling Loop DONE → επόμενο: NOx Emission Class (data-only)

**Ημ/νία:** 2026-06-10 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ **επιβεβαιωμένος agent στη ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**`). Πιθανώς ενεργοί και: ΗΛΕΚΤΡΟΛΟΓΙΚΑ, ΥΔΡΕΥΣΗ/ROUTING (`systems/mep-design/**`), THERMAL (`bim/thermal/heat-load/**`), 3D GIZMO (`bim-3d/**`), COORDINATION/CLASH (`systems/coordination/**`), WALLS, FIXTURES. **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (§5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος. **ΧΡΗΣΙΜΟΠΟΙΗΣΕ WMI -Filter, ΟΧΙ `$_`** (το bash τρώει τα `$`-variables → σκουπίδια):
> `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%tsc%'\" | Select-Object ProcessId, CommandLine | Format-List"`
> Αν επιστρέψει PID → τρέχει tsc άλλου agent → **ΠΕΡΙΜΕΝΕ**. Αν τίποτα → ελεύθερος.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Βρόχος Πλήρωσης (Filling Loop), ΟΛΑ uncommitted (commit ο Giorgio)

**Βρόχος πλήρωσης (Filling Loop / double-check valve, Revit/IFC `IfcValve` CHECK).** Ο φυσικός σύντροφος του μανομέτρου: σε κάθε σφραγισμένο σύστημα θέρμανσης γεμίζεις/συμπληρώνεις στην πίεση που διαβάζει το μανόμετρο (`systemPressureBar` ~1.5 bar). **Body glyph** (η περίμετρος είναι ΓΕΜΑΤΗ, 8 connectors), 100% boiler-owned, **ΜΗΔΕΝ conflict** με τον ενεργό heating agent, **ΕΚΤΟΣ ADR-040** (reuse `glyphStrokes`). Έκλεισε την ομάδα **πλήρωση → ασφάλεια → όργανα** (βαλβίδα + δοχείο + μανόμετρο + βρόχος πλήρωσης).

**🔑 Αποφάσεις που πάρθηκαν:**
1. **NEW pure `buildFillingLoopGlyph(v0..v3)`** στο `mep-boiler-symbol-glyphs.ts` (μοτίβο `buildPressureGaugeGlyph`): διπλή βαλβίδα αντεπιστροφής (2 chevrons «»» σε σειρά, κατεύθυνση ροής +perp) + εύκαμπτος βρόχος (ημικύκλιο N-gon bulge +width, **reuse `VESSEL_SEGMENTS`**) + 2 ticks βανών απομόνωσης στα άκρα. Rotation-aware along/perp. **6 strokes σταθερά**: `[run, chevron1, chevron2, loopArc, tick1, tick2]`. 7 consts `FILLING_*`.
2. **Append στο ΥΠΑΡΧΟΝ `glyphStrokes`** (`mep-boiler-symbol.ts`, μετά το `pressureGauge` push) όταν `params.fillingLoop` → warm-red THIN δωρεάν → **ΕΚΤΟΣ ADR-040**. ΟΧΙ νέο field τύπου `fillingStrokes`.
3. **Τοποθέτηση (4ο διακριτό σημείο):** κάτω θάλαμος (−width) **αντίθετη** lateral πλευρά μανομέτρου (−depth). Κατειλημμένα: φλόγα=κέντρο, βαλβίδα=(+w,+d), δοχείο=(+w,−d), μανόμετρο=(−w,+d), **βρόχος=(−w,−d)** → μηδέν επικάλυψη.
4. **Param `fillingLoop?: boolean`** present/absent flag — **ΜΗΔΕΝ numeric/string** (η πίεση πλήρωσης είναι ΗΔΗ το `systemPressureBar` του μανομέτρου — SSoT, ΟΧΙ διπλασιασμός).
5. **Tag γραμμή 16** «Βρόχος πλήρωσης: ✓» gated by `fillingLoop` (reuse `CHECK_GLYPH`, μοτίβο `neutraliser`· JSDoc 1-15→1-16).
6. **UI:** toggle key `fillingLoop` + toggle button «Βρόχος πλήρωσης» στο **always-visible «Ασφάλεια» panel** (sealed-system family). **ΜΗΔΕΝ picker.** Το bridge get/onChange είναι ήδη ΓΕΝΙΚΑ (`isMepBoilerToggleKey` + `TOGGLE_KEY_TO_FIELD`) — μηδέν per-key branch.

**Verify:** jest **252/252** στα 9 boiler+bridge suites (`mep-boiler-symbol.test.ts` +5, `mep-boiler-tag.test.ts` +2)· **tsc καθαρό στα δικά μου** (το μόνο match `mesh-to-object3d.ts:124` είναι του gizmo agent — η συμβολοσειρά του union type περιέχει «mep-boiler», ΟΧΙ δικό μου error). i18n el+en ✅. N.15 docs ✅.

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (Giorgio· `git add` ΜΟΝΟ αυτά· ΟΛΑ ΕΚΤΟΣ ADR-040):**
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-symbol-glyphs.ts` (NEW builder `buildFillingLoopGlyph` + 7 `FILLING_*` consts)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-symbol.ts` (import + 1 glyphStrokes push)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-tag.ts` (γραμμή 16 + JSDoc)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/mep-boiler-symbol.test.ts` (+5)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/mep-boiler-tag.test.ts` (+2)
- `src/subapps/dxf-viewer/bim/types/mep-boiler-types.ts` (+`fillingLoop?`)
- `src/subapps/dxf-viewer/bim/types/mep-boiler.schemas.ts` (1 optional)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (toggle key union+array)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-boiler-tab.ts` (1 toggle στο «Ασφάλεια» panel)
- `src/i18n/locales/el/dxf-viewer-shell.json` · `en/dxf-viewer-shell.json` (`fillingLoop` σε editor + tag — ⚠️ SHARED, το αγγίζει κι άλλος agent)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (`project_adr408_combi_boiler.md` + index)
- ⚠️ `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-param-maps.ts` (1 `TOGGLE_KEY_TO_FIELD` γραμμή): **SHARED** αρχείο (split από άλλον agent) — **έλεγξε `git diff` πριν το add**.

**🔴 Εκκρεμεί browser-verify (Giorgio):** λέβητας → «Ασφάλεια» panel → toggle «Βρόχος πλήρωσης» → σύμβολο (διπλή βαλβίδα + βρόχος) κάτω-αριστερά + tag «Βρόχος πλήρωσης: ✓».

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return · combi DHW (hot/cold/recirc) · καπναγωγός (flue) + chevron + vent terminal · τροφοδοσία καυσίμου (fuel) + gas-cock + per-fuel διάμετροι · αποχέτευση συμπυκνωμάτων (condensate) + σιφώνι + εξουδετερωτής · connector stubs χρωματισμένα ανά System Classification · απόδοση + ErP · τύπος καυσίμου dropdown · model catalog (7 μοντέλα) · θερμική ισχύς · διαμόρφωση/turndown · L2 sizing (ADR-422) · service clearance zone · **sealed-system ΟΛΟΚΛΗΡΩΜΕΝΟ: ασφαλιστική βαλβίδα + δοχείο διαστολής + μανόμετρο + βρόχος πλήρωσης** · **2D plan tag (16 γραμμές)** · WYSIWYG placement ghost · MEP→BOQ autofeed.

**🟢 Η ΟΙΚΟΓΕΝΕΙΑ CONNECTORS ΕΙΝΑΙ ΠΛΗΡΗΣ** (8 connectors, περίμετρος ΓΕΜΑΤΗ) → κάθε νέο **φυσικό** εξάρτημα = **body glyph** στο `glyphStrokes`, ΟΧΙ connector.

**Μοτίβα που κυριαρχούν (FULL SSOT):**
- **Connector-driven symbol:** `buildBoilerConnectors(params)` = η ΜΟΝΗ SSoT· symbol/renderer/ghost loop πάνω της.
- **Pure glyph builders** (μηδέν renderer import), όλοι στο `mep-boiler-symbol-glyphs.ts`: `buildSafetyValveGlyph`, `buildExpansionVesselGlyph`, `buildPressureGaugeGlyph`, `buildFillingLoopGlyph`, `buildFlueVentStroke`, `buildFuelCockStroke`, `buildCondensateTrapStroke`, `buildCondensateNeutraliserStroke`, `buildFlueTerminalGlyph`, `buildClearanceOutline`.
- **`glyphStrokes` (warm-red THIN, body identity)** στο `mep-boiler-symbol.ts:220-251`: divider+flame + safety-valve + expansion-vessel + pressure-gauge + **filling-loop** → νέο body glyph εκεί (append) = **ΕΚΤΟΣ ADR-040**.
- **Pure data SSoT modules (μηδέν renderer, ΜΗΔΕΝ glyph):** `boiler-efficiency.ts`, `boiler-modulation.ts`, `boiler-flue-terminal.ts`, `boiler-model-catalog.ts` — **πρότυπο για κάθε data-only feature** (όπως το NOx παρακάτω).
- **Tag = content SSoT:** `buildBoilerTagLines(params, t)` (pure, injected translator· i18n `ribbon.commands.mepBoilerTag.*` ns `dxf-viewer-shell`). Glyphs: `DIAMETER_GLYPH='Ø'`, `PERCENT_GLYPH='%'`, `MM_GLYPH='mm'`, `CHECK_GLYPH='✓'`, `BAR_UNIT='bar'`, `LITRE_UNIT='L'`, `RANGE_DASH='–'`. (kW = i18n key `kWUnit`.)
- **UI:** `mep-boiler-command-keys.ts` (keys + guards) → `mep-boiler-param-maps.ts` (**SHARED**: `TOGGLE_KEY_TO_FIELD`/`NUMBER_KEY_TO_FIELD`) → `useRibbonMepBoilerBridge.ts` (get/onChange branches) → `contextual-mep-boiler-tab.ts` (panels). Always-visible panels = «Καθαρός χώρος» + «Ασφάλεια». **Integer presets → plain numeric (NUMBER_KEY_TO_FIELD)· fractional/enum → static-enum STRING combobox (guard ΠΡΙΝ τον model picker)· Boolean device → toggle, μηδέν picker.**

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (απόφαση agent, Revit-grade) — NOx Emission Class (data-only, ErP/ecodesign)

**🔑 Γιατί ΑΥΤΟ:** Είναι ο **φυσικός σύντροφος του ErP** που ήδη υπάρχει. Το ErP/ecodesign compliance story έχει ΔΥΟ άξονες: **energy class** (✅ έγινε — `seasonalEfficiencyPercent` → `resolveErpClass`) και **NOx emission class** (❌ λείπει). Η EU Ecodesign 813/2013 βάζει **όριο NOx** για να πουληθεί λέβητας: αέριο ≤ 56 mg/kWh, πετρέλαιο ≤ 120 mg/kWh. Χωρίς αυτό το compliance story είναι μισό. **Data-only, ΜΗΔΕΝ glyph** (όπως efficiency/ErP/modulation), 100% boiler-owned, **ΜΗΔΕΝ conflict** με τον ενεργό heating agent, **ΕΚΤΟΣ ADR-040 εντελώς**. Σχήμα ΠΑΝΟΜΟΙΟΤΥΠΟ με το modulation που μόλις έγινε.

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**

1. **NEW pure SSoT `boiler-nox.ts`** (mirror `boiler-efficiency.ts`, μηδέν renderer import): `resolveNoxClass(mgKwh: number | undefined, fuelType: BoilerFuelType | undefined): NoxComplianceClass | null`. Επιστρέφει την **κλάση συμμόρφωσης** έναντι του ορίου ecodesign ανά καύσιμο (π.χ. `'compliant'` αν `mgKwh ≤ limit(fuelType)`, αλλιώς `'exceeds'`· ή 1-5 class scale αν θες πιο granular — ΑΠΟΦΑΣΙΣΕ Revit-grade). `null` όταν absent/άγνωστο. Όρια SSoT consts: `NOX_LIMIT_GAS_MG_KWH=56`, `NOX_LIMIT_OIL_MG_KWH=120` (electric/heat-pump → no combustion → null).
2. **Param `noxMgKwh?: number`** (μετρημένες εκπομπές NOx σε mg/kWh)· absent ⇒ unspecified. Additive/optional. **Κανένα νέο default const** (type-specific, από catalog). Schema `z.number().positive().optional()`.
3. **Catalog field** `BoilerModelPreset += noxMgKwh?` στα presets που έχουν καύσιμο (αέριο/πετρέλαιο)· `applyBoilerModelToParams` το γεμίζει, `clearBoilerModel` το αφαιρεί (Type-property, όπως `seasonalEfficiencyPercent`/`minThermalOutputW`).
4. **Tag γραμμή 17** «NOx: 40 mg/kWh (✓)» ή «NOx: A» — **καταναλώνει** το `resolveNoxClass` ώστε να μην σκάσει το dead-code ratchet CHECK 3.22. Gated by `noxMgKwh != null && COMBUSTION_FUELS.has(fuelType)` (μόνο combustion). NEW const `NOX_UNIT='mg/kWh'` non-translatable. JSDoc 1-16→1-17.
5. **UI:** read-only readout «NOx» **ΚΑΙ** editable numeric «NOx (mg/kWh)» στο **«Θερμικά» panel** δίπλα στο ErP readout (μοτίβο efficiency: editable τιμή + read-only class readout). Numeric key `noxMgKwh` → plain `NUMBER_KEY_TO_FIELD` (ακέραιοι mg → μηδέν rounding). NEW readout key `noxClass` (μοτίβο `erpClass` — disabled combobox state από bridge).
6. **i18n (N.11 — ΠΡΩΤΑ τα keys):** editor `ribbon.commands.mepBoilerEditor.nox` + readout `ribbon.commands.mepBoilerEditor.noxClass` + tag `ribbon.commands.mepBoilerTag.nox`, σε **el ΚΑΙ en**.
7. **Tests:** NEW `boiler-nox.test.ts` (limit ανά fuel, compliant/exceeds, electric→null, absent→null)· `mep-boiler-tag.test.ts` (γραμμή present/absent ανά fuel)· `boiler-model-catalog.test.ts` (preset apply/clear γεμίζει/αφαιρεί). Μοτίβο modulation.

**Αναμενόμενα αρχεία (~10, 100% boiler-owned, ΕΚΤΟΣ ADR-040):** NEW `boiler-nox.ts` + test · `mep-boiler-types.ts` (+`noxMgKwh?`) · `mep-boiler.schemas.ts` (1 optional) · `mep-boiler-tag.ts` (γραμμή 17 + import) · `boiler-model-catalog.ts` (preset field + apply/clear) · `mep-boiler-command-keys.ts` (numeric key + readout key) · `mep-boiler-param-maps.ts` (1 NUMBER_KEY_TO_FIELD γραμμή· **SHARED**) · `useRibbonMepBoilerBridge.ts` (readout branch· **SHARED**) · `contextual-mep-boiler-tab.ts` («Θερμικά» panel + numeric + readout) · i18n el+en · 2-3 test files.

**ADR-040:** **ΕΚΤΟΣ** (data-only, μηδέν drawing edit). ΜΗΝ adr-index.

### Εναλλακτική (αν Giorgio θέλει glyph/physical αντί data-only)
- **MepBoilerKind `floor-boiler` (επιδαπέδιος λέβητας)** — νέος kind στο `MepBoilerKind` union + plinth/βάση glyph + geometry defaults (μεγαλύτερο σώμα). Αγγίζει το kind union (`mep-boiler-types.ts`) + το symbol/3D — μεγαλύτερο scope, αλλά πάλι 100% boiler-owned. Revit «Floor-Standing Boiler» family.
- **Boiler 2D grips / 3D stubs** — DEFER: shared grip/gizmo + 3D converter infra (gizmo agent ενεργός, βλ. §4).

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict με ενεργούς agents)
- **Design flow/return θερμοκρασίες** (`designFlowTempC`/`designReturnTempC`) — input του ενεργού heating agent· περίμενε να ελευθερωθεί το `systems/mep-design/heating`.
- **Flue/fuel/condensate 3D stub** — shared 3D converter (`bim-3d/converters/mesh-to-object3d.ts:124` pre-existing error, gizmo agent).
- **Fuel color στο `mep-system-color.ts`** — shared + contended (READ-ONLY import μόνο).
- **Boiler 2D grips** — shared grip/gizmo infra (gizmo agent).
- **Condensate/fuel-network auto-design** — routing (`systems/mep-design/routing/**`).
- **ADR-422 L8 primary-energy ΚΕΝΑΚ wiring** — `bim/thermal/heat-load/**`, thermal agent (boiler-side efficiency + modulation SSoT ΗΔΗ έτοιμα).
- **Per-face clearance** — boiler-owned αλλά αμφίβολης αξίας χωρίς wall-context.

## 5. ΑΡΧΕΙΑ ΑΛΛΩΝ AGENTS — ΜΗΝ ΑΓΓΙΞΕΙΣ
- **ΘΕΡΜΑΝΣΗ (ADR-428):** `systems/mep-design/heating/**` — **ΕΝΕΡΓΟΣ agent (επιβεβαιωμένο Giorgio)**
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**`
- **ΗΛΕΚΤΡΟΛΟΓΙΚΑ (ADR-430/431):** `bim/types/mep-connector-types.ts`· `electrical-*`· `electrical-proposal-store.ts`
- **COORDINATION/CLASH (ADR-435):** `systems/coordination/**` (π.χ. `entity-world-aabb.ts` — tsc error δικό τους)
- **3D GIZMO / SNAP:** `bim-3d/**` (π.χ. `mesh-to-object3d.ts`, `bim3d-snap-bridge.ts`, `ProSnapToolbar.tsx` — tsc errors δικά τους)
- **PROPOSAL GHOST REFACTOR (ενεργό):** `components/dxf-layout/canvas-layer-stack-*-proposal-ghost.tsx`, `ProposalGhostOverlay.tsx`, `proposal-ghost-paint.ts`, `bim-3d/proposal/`, διαγραμμένα `hooks/tools/use*ProposalGhostPreview.ts` — **ΟΛΑ άλλου agent**
- **MEP COLOR (shared, contended):** `bim/mep-systems/mep-system-color.ts` — READ-ONLY import μόνο
- **ΥΔΡΕΥΣΗ/ROUTING (ADR-426/429):** `systems/mep-design/water/**`, `systems/mep-design/routing/**`
- **FIXTURES (shared):** `bim/types/mep-fixture-types.ts` · **WALLS:** `bim/walls/opening-grips.ts`
- ⚠️ **SHARED boiler UI (contended):** `useRibbonMepBoilerBridge.ts` + `mep-boiler-param-maps.ts` — άγγιξέ τα ΜΟΝΟ αν χρειαστεί (NOx readout branch + 1 NUMBER γραμμή), έλεγξε `git diff` πρώτα.

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- **N.0.1 ADR-driven:** Recognition (διάβασε ΚΩΔΙΚΑ πρώτα: `boiler-efficiency.ts` + `boiler-modulation.ts` [πρότυπο pure data-only SSoT fn], `mep-boiler-tag.ts` [line gating 1-16· import resolver· readout], `mep-boiler-command-keys.ts` [numeric key + readout key union+array+guards], `mep-boiler-param-maps.ts` [NUMBER_KEY_TO_FIELD], `contextual-mep-boiler-tab.ts` [«Θερμικά» panel: efficiency editable + erpClass readout — το ΑΚΡΙΒΕΣ μοτίβο για NOx], `boiler-model-catalog.ts` [preset field + apply/clear]) → **Plan Mode** → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- **N.14 model:** NOx (data-only, 1 domain, pure fn + tag + numeric/readout UI, μηδέν glyph) → **Sonnet ή Opus** (δική σου κρίση· σχεδόν πανομοιότυπο με modulation/efficiency).
- **N.11 i18n:** ΠΡΩΤΑ τα keys σε el **ΚΑΙ** en· καμία hardcoded string· καμία `any` (N.2)· κανένα `as any`/`@ts-ignore`.
- **N.15:** μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (`project_adr408_combi_boiler.md` + index). **ΜΗΝ** adr-index (shared tree). ΕΚΤΟΣ ADR-040.
- **COMMIT/PUSH ΠΟΤΕ εσύ (N.(-1)).** `git add` ΜΟΝΟ δικά σου· `git status`/`git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/` + bridge `src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepBoilerBridge.test.tsx`. **Baseline μετά το filling loop: 252/252 στα 9 boiler+bridge suites.**
- i18n: νέα keys σε el **ΚΑΙ** en (CHECK 3.8· μην αφήσεις `defaultValue` με literal).
- tsc μόνο στο τέλος, **N.17** (έλεγξε process ΠΡΩΤΑ· αν τρέχει άλλος, ΠΕΡΙΜΕΝΕ). **Αγνόησε pre-existing/άλλων-agents errors:** `mesh-to-object3d.ts:124`, `bim3d-snap-bridge.ts`, `entity-world-aabb.ts`, `ProSnapToolbar.tsx`, `mep-fixture-types.ts`.
- browser-verify το κάνει ο Giorgio: λέβητας αερίου με NOx τιμή → «Θερμικά» panel → editable «NOx (mg/kWh)» + read-only «NOx» class readout + tag γραμμή «NOx: …».
