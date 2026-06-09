# HANDOFF — Λέβητας: Pressure Gauge DONE → επόμενο: Modulation / Turndown (Διαμόρφωση ισχύος)

**Ημ/νία:** 2026-06-10 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ **επιβεβαιωμένος agent στη ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**`). Πιθανώς ενεργοί και: ΗΛΕΚΤΡΟΛΟΓΙΚΑ (`mep-connector-types.ts`, `mep-system-color.ts`, `electrical-*`), ΥΔΡΕΥΣΗ/ROUTING (`systems/mep-design/**`), THERMAL (`bim/thermal/heat-load/**`), 3D GIZMO (`bim-3d/**`), WALLS, FIXTURES. **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (§5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος (WMI filter, ΟΧΙ `$_` που το τρώει το bash). Αν τρέχει → ΠΕΡΙΜΕΝΕ, μην ξεκινήσεις δεύτερο. Έλεγχος: `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%tsc%'\" | Select-Object ProcessId, CommandLine | Format-List"`. Tip που δούλεψε: γράψε ένα μικρό `.ps1` wait-loop (το bash αλλιώς τρώει τα `$`-variables).

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Pressure Gauge, ΟΛΑ uncommitted (commit ο Giorgio)

**Μανόμετρο πίεσης (Revit Mechanical Equipment accessory / IFC `IfcSensor` PRESSURE, μανόμετρο)** — το **3ο όργανο της «τριάδας»** σφραγισμένου συστήματος θέρμανσης: ασφαλιστική βαλβίδα (✅) + δοχείο διαστολής (✅) + **μανόμετρο** (✅). Η οικογένεια instrumentation **έκλεισε**. Διαβάζει την πίεση πλήρωσης του δικτύου.

**🔑 Revit-grade αποφάσεις που πάρθηκαν:**
1. **Body glyph, ΟΧΙ connector** — η περίμετρος είναι ΓΕΜΑΤΗ (8 connectors). NEW pure `buildPressureGaugeGlyph(v0..v3)` = σύμβολο μανομέτρου = **κύκλος-καντράν** (16-gon polyline, **reuse `VESSEL_SEGMENTS`**) + **ακτινική βελόνα-δείκτης** (από το κέντρο σε σταθερό ~45° dial reading μέσω `GAUGE_NEEDLE_COS/SIN = Math.SQRT1_2`) + **κεντρική κουκίδα-pivot** (μικρός κλειστός ρόμβος). Rotation-aware μέσω along/perp· **3 strokes**· 6 consts `GAUGE_*`. **ΟΠΤΙΚΑ ΔΙΑΚΡΙΤΟ από το δοχείο** (κύκλος + **διαγώνια** βελόνα + pivot, vs κύκλος + **οριζόντια** χορδή-μεμβράνη + stem). **Append στο ΥΠΑΡΧΟΝ `glyphStrokes`** όταν `params.pressureGauge` → warm-red THIN δωρεάν → **ΜΗΔΕΝ drawing edit → ΕΚΤΟΣ ADR-040**.
2. **Τοποθέτηση 3ο διακριτό σημείο** — **κάτω θάλαμος** (`−width`, `GAUGE_CENTRE_WIDTH_FRAC=0.28`) στην πλευρά της βαλβίδας (`+depth`, `GAUGE_CENTRE_DEPTH_FRAC=0.22`). Σύνοψη θέσεων glyphs ώστε να μην επικαλύπτονται: φλόγα=κέντρο-κάτω(perp=0), βαλβίδα=(+w,+d), δοχείο=(+w,−d), **μανόμετρο=(−w,+d)**.
3. **Pressure = static-enum STRING combobox** (όπως η relief, ΟΧΙ numeric) — οι πιέσεις πλήρωσης είναι **κλασματικές** (`[1, 1.2, 1.5, 2]`)· το generic numeric path (`Math.round`) θα διέφθειρε 1.2/1.5. NEW `stringParams.systemPressure` + guard `isMepBoilerSystemPressureKey` (checked ΠΡΙΝ το model picker, μοτίβο `isMepBoilerReliefPressureKey`).
4. **🔑 ΚΡΙΣΙΜΟ — διακριτή ιδιότητα:** `systemPressureBar` (κρύα πίεση πλήρωσης δικτύου ~1.5 bar) **≠** `reliefValvePressureBar` (set pressure βαλβίδας ~3 bar). Διαφορετικά πεδία / pickers / tag labels — ΜΗΝ τα μπερδέψεις.
5. **SSoT presets** `BOILER_SYSTEM_PRESSURES_BAR=[1,1.2,1.5,2]` + `DEFAULT_BOILER_SYSTEM_PRESSURE_BAR=1.5` (tab options + bridge + tag default → μηδέν drift).
6. **Tag γραμμή 14** «Πίεση: 1.5 bar» gated by `pressureGauge` (reuse `BAR_UNIT='bar'`· label «Πίεση» ώστε να ξεχωρίζει από το «Ασφαλιστικό» της relief· JSDoc 1-13→1-14).
7. **UI = ΕΠΕΚΤΑΣΗ του ΥΠΑΡΧΟΝΤΟΣ always-visible «Ασφάλεια» panel** (instrumentation family: βαλβίδα + δοχείο + μανόμετρο): toggle «Μανόμετρο» + system-pressure picker.

**Verify:** jest **228/228** στα 8 boiler+bridge suites (`mep-boiler-symbol.test.ts` +5· `mep-boiler-tag.test.ts` +3)· **tsc καθαρό** (μόνο pre-existing `mesh-to-object3d.ts:124` — gizmo agent, εκτός scope). i18n el+en ✅. N.15 docs ✅.

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (Giorgio· `git add` ΜΟΝΟ αυτά· ΟΛΑ ΕΚΤΟΣ ADR-040):**
- `src/subapps/dxf-viewer/bim/types/mep-boiler-types.ts` (+`pressureGauge?`/`systemPressureBar?` + `DEFAULT_BOILER_SYSTEM_PRESSURE_BAR=1.5` + `BOILER_SYSTEM_PRESSURES_BAR=[1,1.2,1.5,2]`)
- `src/subapps/dxf-viewer/bim/types/mep-boiler.schemas.ts` (2 optional)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-symbol.ts` (`buildPressureGaugeGlyph` + 6 `GAUGE_*` consts + push στο `glyphStrokes`)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-tag.ts` (γραμμή 14 + import `DEFAULT_BOILER_SYSTEM_PRESSURE_BAR`)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (string `systemPressure` + toggle `pressureGauge` + `isMepBoilerSystemPressureKey`)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepBoilerBridge.ts` (TOGGLE map + 2 string branches σε get/onChange)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-boiler-tab.ts` («Ασφάλεια» panel +toggle +combobox + `SYSTEM_PRESSURE_BAR_OPTIONS` από SSoT)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/mep-boiler-symbol.test.ts` · `mep-boiler-tag.test.ts`
- `src/i18n/locales/el/dxf-viewer-shell.json` · `en/dxf-viewer-shell.json` (additive — ΠΡΟΣΕΞΕ μην χαλάσεις άλλα keys, το γράφει κι άλλος agent)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (`project_adr408_combi_boiler.md` + index)

> ⚠️ **ΣΗΜ.:** Στο `git status` φαίνονται ΚΑΙ αρχεία από **ΠΡΟΗΓΟΥΜΕΝΑ boiler slices** (clearance/geometry/renderer/ghost) + uncommitted αρχεία **ΑΛΛΩΝ agents** (heating `systems/mep-design/heating/**`, thermal `bim/thermal/heat-load/**`, electrical, gizmo) — **ΜΗΝ τα κάνεις `git add`.**

**🔴 Εκκρεμεί browser-verify (Giorgio):** λέβητας → panel «Ασφάλεια» → toggle «Μανόμετρο» → σύμβολο κύκλου+διαγώνιας βελόνας (warm-red) στην κάτω-δεξιά παρειά (κάτω από τη βαλβίδα) + tag «Πίεση: 1.5 bar»· αλλαγή πίεσης σε 1.2 → tag «Πίεση: 1.2 bar».

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return · combi DHW (hot/cold/recirc) · καπναγωγός (flue) + chevron + vent terminal · τροφοδοσία καυσίμου (fuel) + gas-cock glyph + per-fuel διάμετροι · αποχέτευση συμπυκνωμάτων (condensate) + σιφώνι/U-trap + εξουδετερωτής/cartridge · connector stubs χρωματισμένα ανά System Classification · απόδοση + ErP · τύπος καυσίμου dropdown · model catalog (7 μοντέλα) · θερμική ισχύς · L2 sizing (ADR-422) · service clearance zone (dashed) · **ΤΡΙΑΔΑ sealed-system: ασφαλιστική βαλβίδα + δοχείο διαστολής + μανόμετρο πίεσης** · **2D plan tag (14 γραμμές)** · WYSIWYG placement ghost · MEP→BOQ autofeed.

**🟢 Η ΟΙΚΟΓΕΝΕΙΑ CONNECTORS ΕΙΝΑΙ ΠΛΗΡΗΣ** (8 connectors, περίμετρος ΓΕΜΑΤΗ) → κάθε νέο **φυσικό** εξάρτημα = **body glyph** στο `glyphStrokes`, ΟΧΙ connector.

**Μοτίβα που κυριαρχούν (FULL SSOT):**
- **Connector-driven symbol:** `buildBoilerConnectors(params)` = η ΜΟΝΗ SSoT· symbol/renderer/ghost loop πάνω της.
- **Pure glyph builders (μηδέν renderer import):** `buildFlueVentStroke`, `buildFlueTerminalGlyph`, `buildFuelCockStroke`, `buildCondensateTrapStroke`, `buildCondensateNeutraliserStroke`, `buildClearanceOutline`, `buildSafetyValveGlyph`, `buildExpansionVesselGlyph`, **`buildPressureGaugeGlyph`**.
- **`glyphStrokes` (warm-red THIN, body identity):** divider+flame + safety-valve + expansion-vessel + **pressure-gauge** → νέο body glyph εκεί = ΕΚΤΟΣ ADR-040.
- **Tag = content SSoT:** `buildBoilerTagLines(params, t)` (pure, injected translator· i18n `ribbon.commands.mepBoilerTag.*` ns `dxf-viewer-shell`). Non-translatable unit glyphs: `DIAMETER_GLYPH='Ø'`, `PERCENT_GLYPH='%'`, `MM_GLYPH='mm'`, `CHECK_GLYPH='✓'`, `BAR_UNIT='bar'`, `LITRE_UNIT='L'`. (kW glyph = i18n key `kWUnit`.)
- **Pure data SSoT modules (μηδέν renderer):** `boiler-efficiency.ts` (ErP class), `boiler-flue-terminal.ts`, `boiler-model-catalog.ts` — **πρότυπο για το επόμενο data-only feature**.
- **UI:** `mep-boiler-command-keys.ts` (keys + guards) → `useRibbonMepBoilerBridge.ts` (`TOGGLE_KEY_TO_FIELD` / `NUMBER_KEY_TO_FIELD` / dedicated string branches / `getPanelVisibility`) → `contextual-mep-boiler-tab.ts` (panels). Always-visible panels = «Καθαρός χώρος» + «Ασφάλεια» (sealed-system instrumentation). **Integer presets → plain numeric combobox· fractional/enum → static-enum STRING combobox** (guard ΠΡΙΝ τον model picker).

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (απόφαση agent, Revit-grade) — Διαμόρφωση / Turndown (Modulation Ratio)

**🔑 Γιατί ΑΥΤΟ:** Είναι το πιο **ουσιαστικό conflict-safe** επόμενο. Οι σύγχρονοι λέβητες είναι **modulating** (δεν δουλεύουν on/off — ρυθμίζουν την ισχύ τους μεταξύ ελάχιστης και ονομαστικής). Στη Revit/IFC ο λέβητας έχει part-load properties (`Pset_BoilerTypeCommon`: `PartialLoadEfficiency`, ελάχιστη ισχύς). Το **turndown ratio** (π.χ. 4:1 = 24kW max / 6kW min) είναι θεμελιώδης ιδιότητα εξοπλισμού που **λείπει**. **Data-only** (όπως efficiency/ErP — ΜΗΔΕΝ glyph), **100% boiler-owned** (μηδέν `systems/mep-design`, μηδέν shared, μηδέν conflict με τον heating agent), **ΕΚΤΟΣ ADR-040**, και **τροφοδοτεί μελλοντικό part-load sizing** (επέκταση του ADR-422 L2 που είναι ήδη δικό μας).

**⛔ ΣΚΟΠΙΜΑ ΑΠΟΦΕΥΓΩ τις design flow/return θερμοκρασίες** (`designFlowTempC`/`designReturnTempC`): πιθανότατα τις θέλει ο **ενεργός heating agent** ως input για τη hydronic ΔT / pipe sizing → conceptual ownership conflict ΤΩΡΑ. Άφησέ τες για όταν ελευθερωθεί το `systems/mep-design/heating`.

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**

1. **Data-only, ΜΗΔΕΝ glyph** (η διαμόρφωση είναι θερμική ιδιότητα, όχι φυσικό εξάρτημα στην κάτοψη — όπως efficiency/ErP).
2. **Param (`mep-boiler-types.ts` + `.schemas.ts`, additive optional):**
   - `minThermalOutputW?: number` (ελάχιστη modulating ισχύς· η ονομαστική/μέγιστη = το ΥΠΑΡΧΟΝ `thermalOutputW`). Absent ⇒ on/off (καμία διαμόρφωση).
   - **ΟΧΙ νέο default const** που να επιβάλλεται μόνο του (η διαμόρφωση είναι type-specific· έρχεται από το catalog). Μπορείς να βάλεις προαιρετικά SSoT presets `BOILER_MIN_OUTPUT_W_OPTIONS` για τον picker.
3. **NEW pure SSoT `boiler-modulation.ts`** (mirror `boiler-efficiency.ts` — pure, unit-tested, μηδέν renderer import):
   - `resolveTurndownRatio(minW: number | undefined, maxW: number | undefined): number | null` → `maxW/minW` όταν και τα δύο > 0 και `minW < maxW`· αλλιώς `null` (on/off ή invalid). Στρογγυλοποίηση σε 1 δεκαδικό (π.χ. 4.0, 3.5).
   - (προαιρετικά) `formatModulationRangeKw(minW, maxW)` αν θες το range string κεντρικά· αλλιώς το format γίνεται στο tag.
   - **+ test `boiler-modulation.test.ts`** (ratio σωστό· min≥max → null· absent → null· fractional 24/7 → 3.4).
4. **Tag (`mep-boiler-tag.ts`):** NEW **γραμμή 15** gated by `minThermalOutputW && thermalOutputW > 0`. Πρότεινε format **range σε kW**: «Διαμόρφωση: 6–24 kW» (πιο ευανάγνωστο από το ratio· χρησιμοποιεί τον υπάρχοντα `kWUnit`). i18n key `ribbon.commands.mepBoilerTag.modulation`. JSDoc 1-14 → 1-15. (Εναλλακτικά/επιπλέον ratio «Turndown: 4:1» — δική σου κρίση, αλλά κράτα το **1 γραμμή**.)
5. **Catalog (`boiler-model-catalog.ts`, boiler-owned):** `BoilerModelPreset += minThermalOutputW?` στους **modulating** presets (gas condensing → min ~25–30% του max, π.χ. 24kW→6kW· oil/electric on/off → χωρίς min). `applyBoilerModelToParams` το γεμίζει· `clearBoilerModel` το καθαρίζει (Type-property, όπως `seasonalEfficiencyPercent`/`fuelType`· **≠** `thermalOutputW` που διατηρείται — δες πώς ήδη γίνεται).
6. **UI (`command-keys` + `bridge` + `tab`):** NEW **numeric** key `minThermalOutput` (ακέραιοι W → plain `NUMBER_KEY_TO_FIELD`, ΟΧΙ string — δεν υπάρχει rounding hazard, μοτίβο `thermalOutput`/`serviceClearance`). Πρόσθεσε στο union+array + `NUMBER_KEY_TO_FIELD` map. **Θέση: υπάρχον «Θερμικά» panel** δίπλα στο `thermalOutput` (ίδια οικογένεια). Combobox με `MIN_THERMAL_OUTPUT_W_OPTIONS` (π.χ. 3000/6000/9000/12000).
7. **i18n (N.11 — ΠΡΩΤΑ τα keys):** editor `ribbon.commands.mepBoilerEditor.minThermalOutput` + tag `ribbon.commands.mepBoilerTag.modulation`, σε **el ΚΑΙ en**.
8. **Tests:** NEW `boiler-modulation.test.ts` (resolveTurndownRatio) · `mep-boiler-tag.test.ts` (γραμμή modulation present όταν min+max· absent όταν λείπει min· σωστό range string) · (προαιρετικά) `boiler-model-catalog.test.ts` (modulating preset → min present· on/off preset → απουσία).

**Αναμενόμενα αρχεία (~9–10, 100% boiler-owned, ΕΚΤΟΣ ADR-040 — ΜΗΔΕΝ drawing edit):** `mep-boiler-types.ts` · `mep-boiler.schemas.ts` · NEW `boiler-modulation.ts` + test · `mep-boiler-tag.ts` · `boiler-model-catalog.ts` · `mep-boiler-command-keys.ts` · `useRibbonMepBoilerBridge.ts` · `contextual-mep-boiler-tab.ts` · i18n el+en · `mep-boiler-tag.test.ts`.

**ADR-040:** **ΕΚΤΟΣ** (data-only, μηδέν drawing edit). ΜΗΝ adr-index.

### Εναλλακτικές (αν Giorgio θέλει αλλού)
- **Filling loop (βρόχος πλήρωσης)** — body glyph (double-check valve / διπλή βαλβίδα αντεπιστροφής) στο `glyphStrokes`· φυσικός σύντροφος του μανομέτρου (το `systemPressureBar` είναι η πίεση που πληρώνεις μέσω αυτού). Continuation του sealed-system visual theme. ~9 αρχεία, conflict-safe.
- **MepBoilerKind `floor-boiler` (επιδαπέδιος)** — νέος kind στο `MepBoilerKind` union + plinth glyph + geometry defaults. Μεγαλύτερο slice, πιο «Revit family type». Boiler-owned αλλά αγγίζει το kind union.
- **Boiler 3D representation** — flue/fuel/condensate 3D stub. ⚠️ **DEFER** — shared 3D converter (`bim-3d/converters/mesh-to-object3d.ts`, gizmo agent· pre-existing error :124).

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict με ενεργούς agents)
- **Design flow/return θερμοκρασίες** (`designFlowTempC`/`designReturnTempC`) — πιθανό input του heating agent· περίμενε να ελευθερωθεί το `systems/mep-design/heating`.
- **Flue/fuel/condensate 3D stub** — shared 3D converter (`mesh-to-object3d.ts:124` pre-existing, gizmo agent).
- **Fuel color στο `mep-system-color.ts`** — shared + contended (όταν ελευθερωθεί: fuel colors στον SSoT → gas-cock χρωματίζεται).
- **Boiler 2D grips** — shared grip/gizmo infra (gizmo agent).
- **Condensate/fuel-network auto-design** — routing (`systems/mep-design/routing/**`).
- **ADR-422 L8 primary-energy ΚΕΝΑΚ wiring** — `bim/thermal/heat-load/**`, thermal agent (boiler-side efficiency SSoT ΗΔΗ έτοιμο· το modulation θα τροφοδοτήσει μελλοντικό part-load sizing).
- **Per-face clearance** (front/back/left/right) — boiler-owned αλλά αμφίβολης αξίας χωρίς wall-context (uniform=η έντιμη επιλογή).

## 5. ΑΡΧΕΙΑ ΑΛΛΩΝ AGENTS — ΜΗΝ ΑΓΓΙΞΕΙΣ
- **ΘΕΡΜΑΝΣΗ (ADR-428):** `systems/mep-design/heating/**` — **ΕΝΕΡΓΟΣ agent (επιβεβαιωμένο Giorgio)**
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**`
- **ΗΛΕΚΤΡΟΛΟΓΙΚΑ (ADR-430/431):** `bim/types/mep-connector-types.ts`· `electrical-*`
- **MEP COLOR (shared, contended):** `bim/mep-systems/mep-system-color.ts` — READ-ONLY import μόνο
- **ΥΔΡΕΥΣΗ/ROUTING (ADR-426/429):** `systems/mep-design/water/**`, `systems/mep-design/routing/**`
- **3D GIZMO:** `bim-3d/**` · **FIXTURES (shared):** `bim/types/mep-fixture-types.ts` · **WALLS:** `bim/walls/opening-grips.ts`

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- **N.0.1 ADR-driven:** Recognition (διάβασε ΚΩΔΙΚΑ πρώτα: `boiler-efficiency.ts` [πρότυπο pure data-only SSoT module + test], `boiler-model-catalog.ts` [apply/clear Type-property pattern· πώς `seasonalEfficiencyPercent` γεμίζει/καθαρίζει αλλά `thermalOutputW` διατηρείται], `mep-boiler-tag.ts` [line gating 1-14· kW format γραμμή 2], `mep-boiler-command-keys.ts` [numeric union+array+set· `NUMBER_KEY_TO_FIELD`], `useRibbonMepBoilerBridge.ts` [NUMBER_KEY_TO_FIELD map + thermalOutput branch], `contextual-mep-boiler-tab.ts` [«Θερμικά» panel + THERMAL_OUTPUT_W_OPTIONS]) → **Plan Mode** → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- **N.14 model:** modulation (1 domain, data+tag+UI+1 pure module, μηδέν drawing) → **Sonnet ή Opus** (δική σου κρίση· είναι σχεδόν πανομοιότυπο με efficiency/ErP).
- **N.11 i18n:** ΠΡΩΤΑ τα keys σε el **ΚΑΙ** en, μετά ο κώδικας· καμία hardcoded string· καμία `any` (N.2).
- **N.15:** μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (`project_adr408_combi_boiler.md` + index). **ΜΗΝ** adr-index (shared tree). ΕΚΤΟΣ ADR-040.
- **COMMIT/PUSH ΠΟΤΕ εσύ (N.(-1)).** `git add` ΜΟΝΟ δικά σου· `git status`/`git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/` (baseline μετά pressure gauge: **228/228** στα 8 boiler+bridge suites μαζί με το bridge test).
- bridge: `npx jest src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepBoilerBridge.test.tsx` (baseline **31/31**).
- συνολικό boiler+bridge: **228/228** μετά το pressure gauge.
- i18n: νέα keys σε el **ΚΑΙ** en (CHECK 3.8· μην αφήσεις `defaultValue` με literal).
- tsc μόνο στο τέλος, **N.17** (έλεγξε process ΠΡΩΤΑ — WMI filter· αν τρέχει άλλος, ΠΕΡΙΜΕΝΕ). Αγνόησε pre-existing `mesh-to-object3d.ts:124` + `mep-fixture-types.ts`.
- browser-verify το κάνει ο Giorgio: λέβητας με `thermalOutputW`=24000 + `minThermalOutputW`=6000 → tag γραμμή «Διαμόρφωση: 6–24 kW»· επιλογή modulating μοντέλου από catalog → auto-fill min.
