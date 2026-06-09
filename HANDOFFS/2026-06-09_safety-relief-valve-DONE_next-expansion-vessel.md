# HANDOFF — Λέβητας: Safety Relief Valve DONE → επόμενο: Expansion Vessel (δοχείο διαστολής)

**Ημ/νία:** 2026-06-09 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ **επιβεβαιωμένος agent στη ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**`). Πιθανώς ενεργοί και: ΗΛΕΚΤΡΟΛΟΓΙΚΑ (`mep-connector-types.ts`, `mep-system-color.ts`, `electrical-*`), ΥΔΡΕΥΣΗ/ROUTING (`systems/mep-design/**`), THERMAL (`bim/thermal/heat-load/**`), 3D GIZMO (`bim-3d/**`), WALLS, FIXTURES. **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (§5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος (WMI filter, ΟΧΙ `$_` που το τρώει το bash): `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%tsc%'\" | Select-Object ProcessId, CommandLine | Format-List"`.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Safety Relief Valve, ΟΛΑ uncommitted (commit ο Giorgio)

**Ασφαλιστική βαλβίδα εκτόνωσης πίεσης (Revit «Safety Relief Valve», set pressure 3 bar)** — κωδικά υποχρεωτικό device ασφαλείας.

**🔑 Revit-grade αποφάσεις που πάρθηκαν:**
1. **Body glyph, ΟΧΙ connector** — η περίμετρος του footprint είναι ΓΕΜΑΤΗ (8 connectors). NEW pure `buildSafetyValveGlyph(v0..v3)` = relief-valve P&ID glyph στην επάνω παρειά (bow-tie «▷◁» 2 τρίγωνα apex-to-apex + discharge stem + chevron arrowhead εκτόνωσης)· rotation-aware μέσω widthDir/depthDir (μοτίβο `buildFlameStrokes`)· 5 strokes· 7 consts `VALVE_*`. **Append στο ΥΠΑΡΧΟΝ `glyphStrokes`** → renderer/ghost το ζωγραφίζουν warm-red THIN με υπάρχον loop → **ΜΗΔΕΝ drawing edit → ΕΚΤΟΣ ADR-040**.
2. **Pressure = static-enum STRING combobox, ΟΧΙ generic numeric** — κρίσιμο: οι set-pressures είναι κλασματικές (1.5/2.5 bar)· το generic numeric path του bridge κάνει `String(Math.round(raw))` που θα διέφθειρε 1.5→2. Guard `isMepBoilerReliefPressureKey` checked ΠΡΙΝ τον model picker· αποθηκεύεται ως `number` param.
3. **SSoT presets** `BOILER_RELIEF_PRESSURES_BAR=[1.5,2.5,3,4,6]` + `DEFAULT_BOILER_RELIEF_PRESSURE_BAR=3` (bridge options + tab options καταναλώνουν το ΙΔΙΟ → μηδέν drift).
4. **Tag γραμμή 12** «Ασφαλιστικό: 3 bar» gated by `safetyReliefValve` (NEW `BAR_UNIT='bar'` non-translatable· JSDoc 1-11→1-12).
5. **UI = NEW always-visible «Ασφάλεια» panel** (καθολική ιδιότητα → ΟΧΙ visibility gate, μοτίβο «Καθαρός χώρος»): toggle «Ασφαλιστική βαλβίδα» + pressure picker.

**Verify:** jest **212/212** στα 8 boiler+bridge suites (`mep-boiler-symbol.test.ts` +4· `mep-boiler-tag.test.ts` +3)· **tsc καθαρό** (μόνο το προϋπάρχον `mesh-to-object3d.ts:124` — gizmo agent, εκτός scope· εμφανίστηκε στο φίλτρο μόνο επειδή το union literal του περιέχει τη λέξη 'mep-boiler'). i18n el+en ✅. N.15 docs ✅.

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (Giorgio· `git add` ΜΟΝΟ αυτά· ΟΛΑ ΕΚΤΟΣ ADR-040):**
- `src/subapps/dxf-viewer/bim/types/mep-boiler-types.ts` (+`safetyReliefValve?`/`reliefValvePressureBar?` + `DEFAULT_BOILER_RELIEF_PRESSURE_BAR=3` + `BOILER_RELIEF_PRESSURES_BAR`)
- `src/subapps/dxf-viewer/bim/types/mep-boiler.schemas.ts` (2 optional)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-symbol.ts` (`buildSafetyValveGlyph` + 7 `VALVE_*` consts + push στο `glyphStrokes`)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-tag.ts` (γραμμή 12 + `BAR_UNIT`)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (toggle + stringParam + `isMepBoilerReliefPressureKey`)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepBoilerBridge.ts` (TOGGLE map + 2 branches πριν τον model picker)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-boiler-tab.ts` (NEW «Ασφάλεια» panel + `RELIEF_PRESSURE_BAR_OPTIONS` από SSoT)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/mep-boiler-symbol.test.ts` · `mep-boiler-tag.test.ts`
- `src/i18n/locales/el/dxf-viewer-shell.json` · `en/dxf-viewer-shell.json` (additive — ΠΡΟΣΕΞΕ μην χαλάσεις άλλα keys, το γράφει κι άλλος agent)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (`project_adr408_combi_boiler.md` + index)

> ⚠️ **ΣΗΜ.:** Στο working tree υπάρχουν ΚΑΙ uncommitted αρχεία ΑΛΛΩΝ agents (heating `systems/mep-design/heating/**`, thermal `bim/thermal/heat-load/**`, electrical, gizmo). **ΜΗΝ τα κάνεις `git add`.**

**🔴 Εκκρεμεί browser-verify (Giorgio):** λέβητας → panel «Ασφάλεια» → toggle «Ασφαλιστική βαλβίδα» → σύμβολο βαλβίδας (warm-red) στην επάνω παρειά + tag «Ασφαλιστικό: 3 bar»· αλλαγή πίεσης σε 6 → «Ασφαλιστικό: 6 bar».

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return · combi DHW (hot/cold/recirc) · καπναγωγός (flue) + chevron + vent terminal · τροφοδοσία καυσίμου (fuel) + gas-cock glyph + per-fuel διάμετροι · αποχέτευση συμπυκνωμάτων (condensate) + σιφώνι/U-trap + εξουδετερωτής/cartridge · connector stubs χρωματισμένα ανά System Classification · απόδοση + ErP · τύπος καυσίμου dropdown · model catalog (7 μοντέλα) · θερμική ισχύς · L2 sizing (ADR-422) · service clearance zone (dashed) · **ασφαλιστική βαλβίδα (safety relief valve) + set pressure** · **2D plan tag (12 γραμμές)** · WYSIWYG placement ghost · MEP→BOQ autofeed.

**🟢 Η ΟΙΚΟΓΕΝΕΙΑ CONNECTORS ΕΙΝΑΙ ΠΛΗΡΗΣ** (8 connectors, περίμετρος ΓΕΜΑΤΗ) → κάθε νέο εξάρτημα = **body glyph** στο `glyphStrokes`, ΟΧΙ connector.

**Μοτίβα που κυριαρχούν (FULL SSOT):**
- **Connector-driven symbol:** `buildBoilerConnectors(params)` = η ΜΟΝΗ SSoT· symbol/renderer/ghost loop πάνω της.
- **Pure glyph builders (μηδέν renderer import):** `buildFlueVentStroke`, `buildFlueTerminalGlyph`, `buildFuelCockStroke`, `buildCondensateTrapStroke`, `buildCondensateNeutraliserStroke`, `buildClearanceOutline`, **`buildSafetyValveGlyph`**.
- **`BoilerSymbolGeometry` arrays που ζωγραφίζει ΗΔΗ ο renderer/ghost (→ νέο glyph εκεί = ΕΚΤΟΣ ADR-040):** `strokes` (classified) · `ventStrokes` (classified) · `fuelStrokes` (warm-red) · **`glyphStrokes` (warm-red THIN — divider+flame+safety valve, body identity)** · `clearanceOutline` (dashed).
- **Tag = content SSoT:** `buildBoilerTagLines(params, t)` (pure, injected translator· i18n `ribbon.commands.mepBoilerTag.*` ns `dxf-viewer-shell`). Non-translatable unit glyphs ως consts: `DIAMETER_GLYPH='Ø'`, `PERCENT_GLYPH='%'`, `MM_GLYPH='mm'`, `CHECK_GLYPH='✓'`, `BAR_UNIT='bar'`.
- **UI:** `mep-boiler-command-keys.ts` (keys + guards) → `useRibbonMepBoilerBridge.ts` (`TOGGLE_KEY_TO_FIELD` / `NUMBER_KEY_TO_FIELD` / dedicated string branches / `getPanelVisibility`) → `contextual-mep-boiler-tab.ts` (panels). Always-visible panels (καθολική ιδιότητα, χωρίς visibilityKey) = «Καθαρός χώρος» + «Ασφάλεια». **Fractional/static picker = static-enum STRING combobox** (guard checked ΠΡΙΝ τον model picker), ΠΟΤΕ generic numeric (rounding corruption).

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (απόφαση agent, Revit-grade) — Expansion Vessel (δοχείο διαστολής)

**🔑 Γιατί ΑΥΤΟ:** Σε κάθε **σφραγισμένο** σύστημα θέρμανσης τα ΔΥΟ κωδικά υποχρεωτικά εξαρτήματα πίεσης/ασφάλειας είναι **ασφαλιστική βαλβίδα** (μόλις έγινε) + **δοχείο διαστολής** (Revit Mechanical Equipment accessory / IFC `IfcTank` EXPANSION). Είναι ο φυσικός σύντροφος του relief valve και το προφανές επόμενο. **Conflict-safe** (100% boiler-owned, μηδέν `systems/mep-design`) και **ΕΚΤΟΣ ADR-040** (body glyph στο ΥΠΑΡΧΟΝ `glyphStrokes`, drawn by existing loop → ΜΗΔΕΝ renderer/ghost edit). Ίδιο proven pattern με το relief valve.

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**

1. **ΟΧΙ connector** (περίμετρος γεμάτη) → **body glyph** στο σώμα.
2. **Params (`mep-boiler-types.ts` + `.schemas.ts`, additive optional):**
   - `expansionVessel?: boolean` (toggle· μοτίβο `safetyReliefValve`).
   - `expansionVesselVolumeL?: number` (όγκος δοχείου σε λίτρα· absent ⇒ default).
   - `export const DEFAULT_BOILER_EXPANSION_VESSEL_L = 12;` (τυπικό οικιακό 12 L).
   - `export const BOILER_EXPANSION_VESSEL_VOLUMES_L: readonly number[] = [8, 12, 18, 24, 35];` (SSoT presets — όλα ακέραια → μπορεί να πάει είτε static-enum string picker είτε generic numeric· **ΣΥΣΤΑΣΗ: static-enum string picker** για συνέπεια + ευκολία, αφού είναι διακριτές standard διαβαθμίσεις· ΑΝ το κάνεις numeric, ΟΚ γιατί είναι ακέραια — δεν έχει το πρόβλημα rounding του relief valve).
3. **Glyph (`mep-boiler-symbol.ts`, ΕΚΤΟΣ ADR-040):** NEW pure `buildExpansionVesselGlyph(v0..v3): BoilerStroke[]` (rotation-aware μέσω widthDir/depthDir, μοτίβο `buildSafetyValveGlyph`/`buildFlameStrokes`). Σχήμα = **κλασικό σύμβολο δοχείου διαστολής** = μικρός **κύκλος/κάψουλα** (approximate polyline ~16-gon — ΔΕΝ υπάρχει arc primitive· το `BoilerStroke` είναι point array) με **οριζόντια γραμμή μεμβράνης** (diaphragm: νερό κάτω / άζωτο πάνω) + κοντό connection stem στο σώμα. Τοποθέτηση σε **διαφορετικό σημείο** από το relief valve (π.χ. lower chamber ή αντίθετη lateral πλευρά) ώστε να μην επικαλύπτονται· consts κλάσματα όπως `VALVE_*`/`FLAME_*` (`VESSEL_*`). **Append στο `glyphStrokes`** όταν `params.expansionVessel` → warm-red THIN δωρεάν.
4. **Tag (`mep-boiler-tag.ts`):** NEW γραμμή 13 «Δοχείο: 12 L» gated by `params.expansionVessel`· format `${t('expansionVessel')}: ${volume} ${LITRE_UNIT}` (NEW const `LITRE_UNIT='L'` non-translatable). i18n key `ribbon.commands.mepBoilerTag.expansionVessel`. JSDoc 1-12 → 1-13.
5. **UI (`command-keys` + `bridge` + `tab`):** **ΕΠΕΚΤΕΙΝΕ το ΥΠΑΡΧΟΝ always-visible «Ασφάλεια» panel** (το δοχείο διαστολής + η ασφαλιστική = ίδια οικογένεια «sealed-system safety/pressurisation» → λογικό grouping, αποφεύγει πληθώρα panels): toggle «Δοχείο διαστολής» (`toggles.expansionVessel`) + volume picker (`stringParams.expansionVesselVolume` ή number key). Πρόσθεσε στα toggle union+array+set + `TOGGLE_KEY_TO_FIELD`, και (αν static-enum) string union+set + NEW guard `isMepBoilerExpansionVolumeKey` checked ΠΡΙΝ τον model picker + bridge branches. *(Εναλλακτικά νέο panel «Δοχείο διαστολής» — δική σου κρίση στο Plan.)*
6. **i18n (N.11 — ΠΡΩΤΑ τα keys):** editor `ribbon.commands.mepBoilerEditor.expansionVessel`/`.expansionVesselVolume` + tag `ribbon.commands.mepBoilerTag.expansionVessel`, σε **el ΚΑΙ en**. (Αν κρατήσεις το «Ασφάλεια» panel, ΔΕΝ χρειάζεσαι νέο panel key.)
7. **Tests:** `mep-boiler-symbol.test.ts` (expansionVessel → επιπλέον `glyphStrokes` πέρα από τα base 4 / 9-με-relief· absent → χωρίς το vessel glyph· rotation 90° finite)· `mep-boiler-tag.test.ts` (γραμμή «expansionVessel: 12 L» present/absent· explicit volume override).

**Αναμενόμενα αρχεία (~9, 100% boiler-owned, ΕΚΤΟΣ ADR-040 — ΜΗΔΕΝ drawing edit):** `mep-boiler-types.ts` · `mep-boiler.schemas.ts` · `mep-boiler-symbol.ts` · `mep-boiler-tag.ts` · `mep-boiler-command-keys.ts` · `useRibbonMepBoilerBridge.ts` · `contextual-mep-boiler-tab.ts` · i18n el+en · 2 test files.

**ADR-040:** **ΕΚΤΟΣ** (glyph στο ΥΠΑΡΧΟΝ `glyphStrokes`). ΜΗΝ adr-index.

### Εναλλακτικές (αν Giorgio θέλει αλλού)
- **Μανόμετρο / θερμόμετρο σώματος** (gauge glyph) — cosmetic, ίδιο μοτίβο glyphStrokes· λιγότερο κρίσιμο.
- **MepBoilerKind floor-standing** (επιδαπέδιος λέβητας· νέος kind + plinth glyph + defaults) — μεγαλύτερο slice, αγγίζει περισσότερα.
- **Διαμόρφωση/turndown** (`minThermalOutputW` + tag «6-24 kW») — data-only.
- **Auto-sizing δοχείου διαστολής** από όγκο νερού συστήματος — DEFER (χρειάζεται network/heat-load = thermal/routing agents).

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict με ενεργούς agents)
- **Flue/fuel/condensate 3D stub** — shared 3D converter (`bim-3d/converters/mesh-to-object3d.ts:124` pre-existing error, gizmo agent).
- **Fuel color στο `mep-system-color.ts`** — shared + contended (όταν ελευθερωθεί: fuel colors στον SSoT → gas-cock χρωματίζεται).
- **Boiler 2D grips** — shared grip/gizmo infra (gizmo agent).
- **Condensate/fuel-network auto-design** — routing (`systems/mep-design/routing/**`).
- **ADR-422 L8 primary-energy ΚΕΝΑΚ wiring** — `bim/thermal/heat-load/**`, thermal agent (boiler-side efficiency SSoT ΗΔΗ έτοιμο).
- **Per-face clearance** (front/back/left/right) — boiler-owned αλλά αμφίβολης αξίας χωρίς wall-context (uniform=η έντιμη επιλογή).

## 5. ΑΡΧΕΙΑ ΑΛΛΩΝ AGENTS — ΜΗΝ ΑΓΓΙΞΕΙΣ
- **ΘΕΡΜΑΝΣΗ (ADR-428):** `systems/mep-design/heating/**` — **ΕΝΕΡΓΟΣ agent (επιβεβαιωμένο Giorgio)**
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**` (`annual-gains-config.ts` + `derive-annual-energy.ts` τροποποιημένα — **ΜΗΝ τα add**)
- **ΗΛΕΚΤΡΟΛΟΓΙΚΑ (ADR-430/431):** `bim/types/mep-connector-types.ts`· `electrical-*`
- **MEP COLOR (shared, contended):** `bim/mep-systems/mep-system-color.ts` — READ-ONLY import μόνο
- **ΥΔΡΕΥΣΗ/ROUTING (ADR-426/429):** `systems/mep-design/water/**`, `systems/mep-design/routing/**`
- **3D GIZMO:** `bim-3d/**` · **FIXTURES (shared):** `bim/types/mep-fixture-types.ts` · **WALLS:** `bim/walls/opening-grips.ts`

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- **N.0.1 ADR-driven:** Recognition (διάβασε ΚΩΔΙΚΑ πρώτα: `mep-boiler-symbol.ts` [`buildSafetyValveGlyph`/`buildFlameStrokes` rotation-aware pattern· `glyphStrokes` push· `pointAt`/`unit` helpers], `mep-boiler-tag.ts` [unit glyph consts· line gating 1-12], `mep-boiler-command-keys.ts` [toggle/string unions+sets+guards], `useRibbonMepBoilerBridge.ts` [TOGGLE map· dedicated string branches ΠΡΙΝ model picker], `contextual-mep-boiler-tab.ts` [always-visible «Ασφάλεια»/«Καθαρός χώρος» panel pattern + options από SSoT]) → **Plan Mode** → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- **N.14 model:** expansion vessel (1 domain, glyph+data+UI, μηδέν drawing) → **Opus ή Sonnet** (δική σου κρίση· είναι σχεδόν πανομοιότυπο με το relief valve).
- **N.11 i18n:** ΠΡΩΤΑ τα keys σε el **ΚΑΙ** en, μετά ο κώδικας· καμία hardcoded string· καμία `any` (N.2).
- **N.15:** μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (`project_adr408_combi_boiler.md` + index). **ΜΗΝ** adr-index (shared tree). ΕΚΤΟΣ ADR-040.
- **COMMIT/PUSH ΠΟΤΕ εσύ (N.(-1)).** `git add` ΜΟΝΟ δικά σου· `git status`/`git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/` (baseline μετά relief valve: symbol 8 + tag 6 νέα).
- bridge: `npx jest src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepBoilerBridge.test.tsx` (baseline **31/31**).
- συνολικό boiler+bridge: **212/212** μετά το relief valve.
- i18n: νέα keys σε el **ΚΑΙ** en (CHECK 3.8· μην αφήσεις `defaultValue` με literal).
- tsc μόνο στο τέλος, **N.17** (έλεγξε process ΠΡΩΤΑ — WMI filter, όχι `$_`). Αγνόησε pre-existing `mesh-to-object3d.ts:124` + `mep-fixture-types.ts`.
- browser-verify το κάνει ο Giorgio: λέβητας με toggle «Δοχείο διαστολής» → σύμβολο δοχείου (κύκλος+μεμβράνη) στο σώμα + tag γραμμή «Δοχείο: 12 L».
