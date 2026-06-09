# HANDOFF — Λέβητας: Expansion Vessel DONE → επόμενο: Pressure Gauge (μανόμετρο πίεσης)

**Ημ/νία:** 2026-06-10 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ **επιβεβαιωμένος agent στη ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**`). Πιθανώς ενεργοί και: ΗΛΕΚΤΡΟΛΟΓΙΚΑ (`mep-connector-types.ts`, `mep-system-color.ts`, `electrical-*`), ΥΔΡΕΥΣΗ/ROUTING (`systems/mep-design/**`), THERMAL (`bim/thermal/heat-load/**`), 3D GIZMO (`bim-3d/**`), WALLS, FIXTURES. **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (§5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος (WMI filter, ΟΧΙ `$_` που το τρώει το bash): `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%tsc%'\" | Select-Object ProcessId, CommandLine | Format-List"`.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Expansion Vessel, ΟΛΑ uncommitted (commit ο Giorgio)

**Δοχείο διαστολής (Revit Mechanical Equipment accessory / IFC `IfcTank` EXPANSION, δοχείο διαστολής)** — ο 2ος κωδικά υποχρεωτικός σύντροφος της ασφαλιστικής βαλβίδας σε ΣΦΡΑΓΙΣΜΕΝΟ σύστημα θέρμανσης (απορροφά τη θερμική διαστολή του νερού).

**🔑 Revit-grade αποφάσεις που πάρθηκαν:**
1. **Body glyph, ΟΧΙ connector** — η περίμετρος του footprint είναι ΓΕΜΑΤΗ (8 connectors). NEW pure `buildExpansionVesselGlyph(v0..v3)` = κλασικό σύμβολο διαφραγματικού δοχείου = **κύκλος** (16-gon polyline, `VESSEL_SEGMENTS=16` — ΔΕΝ υπάρχει arc primitive, το `BoilerStroke` είναι point array) + **οριζόντια χορδή-μεμβράνη** (diaphragm: νερό κάτω / άζωτο πάνω) + **κοντό stem** προς το σώμα· rotation-aware μέσω `along`/`perp` (μοτίβο `buildSafetyValveGlyph`/`buildFlameStrokes`)· **3 strokes**· 5 consts `VESSEL_*`. **Append στο ΥΠΑΡΧΟΝ `glyphStrokes`** όταν `params.expansionVessel` → renderer/ghost το ζωγραφίζουν warm-red THIN με υπάρχον loop → **ΜΗΔΕΝ drawing edit → ΕΚΤΟΣ ADR-040**.
2. **Τοποθέτηση χωρίς επικάλυψη** — άνω θάλαμος (`VESSEL_CENTRE_WIDTH_FRAC=0.28`, +width, όπως η βαλβίδα) ΑΛΛΑ **αντίθετη lateral πλευρά** (`VESSEL_CENTRE_DEPTH_FRAC=0.22` εφαρμοσμένο με **−perp**, ενώ η βαλβίδα με +perp). Οι δύο σύντροφοι sealed-system κάθονται πάνω, εκατέρωθεν, χωρίς να πέφτουν ο ένας πάνω στον άλλο.
3. **Volume = plain NUMERIC combobox, ΟΧΙ string** (κρίσιμη διαφορά από τη βαλβίδα). Οι όγκοι `[8,12,18,24,35]` είναι **ΑΚΕΡΑΙΟΙ** → μηδέν πρόβλημα rounding → χρήση του ΥΠΑΡΧΟΝΤΟΣ `NUMBER_KEY_TO_FIELD` path (πανομοιότυπα `serviceClearance`/`flueDiameter`). **Το string-combobox machinery (guards + bridge branches) κρατιέται ΜΟΝΟ για fractional/enum pickers** (relief pressure 1.5/2.5, flueTermination, fuelType) — αποφυγή over-engineering.
4. **SSoT presets** `BOILER_EXPANSION_VESSEL_VOLUMES_L=[8,12,18,24,35]` + `DEFAULT_BOILER_EXPANSION_VESSEL_L=12` (tab options + tag default καταναλώνουν το ΙΔΙΟ → μηδέν drift).
5. **Tag γραμμή 13** «Δοχείο: 12 L» gated by `expansionVessel` (NEW `LITRE_UNIT='L'` non-translatable· JSDoc 1-12→1-13).
6. **UI = ΕΠΕΚΤΑΣΗ του ΥΠΑΡΧΟΝΤΟΣ always-visible «Ασφάλεια» panel** (το δοχείο + η ασφαλιστική = ίδια οικογένεια «sealed-system pressurisation» → λογικό grouping, αποφυγή πληθώρας panels): toggle «Δοχείο διαστολής» + volume picker.

**Verify:** jest **220/220** στα 8 boiler+bridge suites (`mep-boiler-symbol.test.ts` +5· `mep-boiler-tag.test.ts` +3)· **tsc καθαρό** (μόνο το προϋπάρχον `mesh-to-object3d.ts:124` — gizmo agent, εκτός scope· εμφανίζεται στο grep μόνο επειδή το union literal περιέχει 'mep-boiler'). i18n el+en ✅. N.15 docs ✅.

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (Giorgio· `git add` ΜΟΝΟ αυτά· ΟΛΑ ΕΚΤΟΣ ADR-040):**
- `src/subapps/dxf-viewer/bim/types/mep-boiler-types.ts` (+`expansionVessel?`/`expansionVesselVolumeL?` + `DEFAULT_BOILER_EXPANSION_VESSEL_L=12` + `BOILER_EXPANSION_VESSEL_VOLUMES_L`)
- `src/subapps/dxf-viewer/bim/types/mep-boiler.schemas.ts` (2 optional)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-symbol.ts` (`buildExpansionVesselGlyph` + 5 `VESSEL_*` consts + push στο `glyphStrokes`)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-tag.ts` (γραμμή 13 + `LITRE_UNIT`)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (number key `expansionVesselVolume` + toggle `expansionVessel`)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepBoilerBridge.ts` (NUMBER + TOGGLE map entries)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-boiler-tab.ts` («Ασφάλεια» panel +toggle +combobox + `EXPANSION_VESSEL_VOLUME_L_OPTIONS` από SSoT)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/mep-boiler-symbol.test.ts` · `mep-boiler-tag.test.ts`
- `src/i18n/locales/el/dxf-viewer-shell.json` · `en/dxf-viewer-shell.json` (additive — ΠΡΟΣΕΞΕ μην χαλάσεις άλλα keys, το γράφει κι άλλος agent)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (`project_adr408_combi_boiler.md` + index)

> ⚠️ **ΣΗΜ.:** Στο `git status` φαίνονται ΚΑΙ `MepBoilerGhostRenderer.ts`, `mep-boiler-geometry.ts/.test.ts` ως modified — αυτά είναι από **ΠΡΟΗΓΟΥΜΕΝΑ boiler slices** (clearance/geometry), ΟΧΙ απ' αυτό το session. Boiler-owned, ο Giorgio αποφασίζει αν μπαίνουν στο ίδιο commit. Επίσης υπάρχουν uncommitted αρχεία ΑΛΛΩΝ agents (heating `systems/mep-design/heating/**`, thermal `bim/thermal/heat-load/**`, electrical, gizmo) — **ΜΗΝ τα κάνεις `git add`.**

**🔴 Εκκρεμεί browser-verify (Giorgio):** λέβητας → panel «Ασφάλεια» → toggle «Δοχείο διαστολής» → σύμβολο κύκλου+μεμβράνης (warm-red) στην επάνω παρειά (αντίθετη πλευρά από την ασφαλιστική) + tag «Δοχείο: 12 L»· αλλαγή όγκου σε 24 → «Δοχείο: 24 L».

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return · combi DHW (hot/cold/recirc) · καπναγωγός (flue) + chevron + vent terminal · τροφοδοσία καυσίμου (fuel) + gas-cock glyph + per-fuel διάμετροι · αποχέτευση συμπυκνωμάτων (condensate) + σιφώνι/U-trap + εξουδετερωτής/cartridge · connector stubs χρωματισμένα ανά System Classification · απόδοση + ErP · τύπος καυσίμου dropdown · model catalog (7 μοντέλα) · θερμική ισχύς · L2 sizing (ADR-422) · service clearance zone (dashed) · ασφαλιστική βαλβίδα (safety relief valve) + set pressure · **δοχείο διαστολής (expansion vessel) + volume** · **2D plan tag (13 γραμμές)** · WYSIWYG placement ghost · MEP→BOQ autofeed.

**🟢 Η ΟΙΚΟΓΕΝΕΙΑ CONNECTORS ΕΙΝΑΙ ΠΛΗΡΗΣ** (8 connectors, περίμετρος ΓΕΜΑΤΗ) → κάθε νέο εξάρτημα = **body glyph** στο `glyphStrokes`, ΟΧΙ connector.

**Μοτίβα που κυριαρχούν (FULL SSOT):**
- **Connector-driven symbol:** `buildBoilerConnectors(params)` = η ΜΟΝΗ SSoT· symbol/renderer/ghost loop πάνω της.
- **Pure glyph builders (μηδέν renderer import):** `buildFlueVentStroke`, `buildFlueTerminalGlyph`, `buildFuelCockStroke`, `buildCondensateTrapStroke`, `buildCondensateNeutraliserStroke`, `buildClearanceOutline`, `buildSafetyValveGlyph`, **`buildExpansionVesselGlyph`**.
- **`BoilerSymbolGeometry` arrays που ζωγραφίζει ΗΔΗ ο renderer/ghost (→ νέο glyph εκεί = ΕΚΤΟΣ ADR-040):** `strokes` (classified) · `ventStrokes` (classified) · `fuelStrokes` (warm-red) · **`glyphStrokes` (warm-red THIN — divider+flame+safety-valve+expansion-vessel, body identity)** · `clearanceOutline` (dashed).
- **Tag = content SSoT:** `buildBoilerTagLines(params, t)` (pure, injected translator· i18n `ribbon.commands.mepBoilerTag.*` ns `dxf-viewer-shell`). Non-translatable unit glyphs ως consts: `DIAMETER_GLYPH='Ø'`, `PERCENT_GLYPH='%'`, `MM_GLYPH='mm'`, `CHECK_GLYPH='✓'`, `BAR_UNIT='bar'`, **`LITRE_UNIT='L'`**.
- **UI:** `mep-boiler-command-keys.ts` (keys + guards) → `useRibbonMepBoilerBridge.ts` (`TOGGLE_KEY_TO_FIELD` / `NUMBER_KEY_TO_FIELD` / dedicated string branches / `getPanelVisibility`) → `contextual-mep-boiler-tab.ts` (panels). Always-visible panels (καθολική ιδιότητα, χωρίς visibilityKey) = «Καθαρός χώρος» + **«Ασφάλεια» (sealed-system: βαλβίδα + δοχείο)**. **Integer presets → plain numeric combobox· fractional/enum → static-enum STRING combobox** (guard checked ΠΡΙΝ τον model picker, ΠΟΤΕ generic numeric rounding corruption).

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (απόφαση agent, Revit-grade) — Pressure Gauge (μανόμετρο πίεσης)

**🔑 Γιατί ΑΥΤΟ:** Η «τριάδα» κάθε **σφραγισμένου** συστήματος θέρμανσης είναι **ασφαλιστική βαλβίδα** (✅) + **δοχείο διαστολής** (✅) + **μανόμετρο πίεσης** (Pressure Gauge). Το μανόμετρο είναι το προφανές επόμενο που **ολοκληρώνει θεματικά** την οικογένεια instrumentation στο «Ασφάλεια» panel. **Conflict-safe** (100% boiler-owned, μηδέν `systems/mep-design`, μηδέν shared) και **ΕΚΤΟΣ ADR-040** (body glyph στο ΥΠΑΡΧΟΝ `glyphStrokes`, drawn by existing loop → ΜΗΔΕΝ renderer/ghost edit). Ίδιο proven pattern με βαλβίδα/δοχείο.

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**

1. **ΟΧΙ connector** (περίμετρος γεμάτη) → **body glyph** στο σώμα.
2. **Params (`mep-boiler-types.ts` + `.schemas.ts`, additive optional):**
   - `pressureGauge?: boolean` (toggle· μοτίβο `safetyReliefValve`/`expansionVessel`).
   - `systemPressureBar?: number` (κρύα πίεση πλήρωσης δικτύου· absent ⇒ default). **ΣΗΜΑΝΤΙΚΟ: διαφορετική ιδιότητα από το `reliefValvePressureBar`** — η fill pressure είναι ~1–1.5 bar (cold), η set pressure 3 bar (relief). Μην τις μπερδέψεις.
   - `export const DEFAULT_BOILER_SYSTEM_PRESSURE_BAR = 1.5;` (τυπική κρύα πίεση πλήρωσης).
   - `export const BOILER_SYSTEM_PRESSURES_BAR: readonly number[] = [1, 1.2, 1.5, 2];` (SSoT presets — **ΚΛΑΣΜΑΤΙΚΕΣ** → **static-enum STRING picker** ΥΠΟΧΡΕΩΤΙΚΑ, ΟΠΩΣ το relief pressure· generic numeric path θα διέφθειρε 1.2/1.5 με `Math.round`).
3. **Glyph (`mep-boiler-symbol.ts`, ΕΚΤΟΣ ADR-040):** NEW pure `buildPressureGaugeGlyph(v0..v3): BoilerStroke[]` (rotation-aware μέσω along/perp, μοτίβο `buildExpansionVesselGlyph`). Σχήμα = **μανόμετρο** = μικρός **κύκλος** (16-gon, REUSE `VESSEL_SEGMENTS` ή νέο `GAUGE_SEGMENTS`) + **ακτινική βελόνα/δείκτης** (γραμμή από το κέντρο προς ~45° → distinct από τον κύκλο+οριζόντια-μεμβράνη του δοχείου) + μικρή τελεία/κουκίδα στο κέντρο (pivot). **Τοποθέτηση ΤΡΙΤΟ διακριτό σημείο** — ΟΧΙ πάνω στη βαλβίδα (+w,+d) ούτε στο δοχείο (+w,−d)· πρότεινε **κάτω θάλαμος** σε μία πλευρά (π.χ. −width, +depth) ή κεντρικά κάτω, ώστε 3 glyphs (φλόγα/βαλβίδα/δοχείο/μανόμετρο) να μην επικαλύπτονται. Consts `GAUGE_*`. **Append στο `glyphStrokes`** όταν `params.pressureGauge` → warm-red THIN δωρεάν.
4. **Tag (`mep-boiler-tag.ts`):** NEW γραμμή 14 «Πίεση: 1.5 bar» gated by `params.pressureGauge`· format `${t('pressureGauge')}: ${bar} ${BAR_UNIT}` (REUSE `BAR_UNIT='bar'`). i18n key `ribbon.commands.mepBoilerTag.pressureGauge`. JSDoc 1-13 → 1-14. **ΠΡΟΣΟΧΗ:** το tag label πρέπει να ξεχωρίζει από το «Ασφαλιστικό» (relief) — π.χ. «Πίεση δικτύου» ή «Πίεση» (system fill) έναντι «Ασφαλιστικό» (relief set).
5. **UI (`command-keys` + `bridge` + `tab`):** **ΕΠΕΚΤΕΙΝΕ το ΥΠΑΡΧΟΝ always-visible «Ασφάλεια» panel** (instrumentation family): toggle «Μανόμετρο» (`toggles.pressureGauge`) + pressure picker (`stringParams.systemPressure`, **STRING** γιατί fractional). Πρόσθεσε: toggle union+array+set + `TOGGLE_KEY_TO_FIELD`· string union+set + NEW guard `isMepBoilerSystemPressureKey` checked **ΠΡΙΝ** τον model picker + bridge `getComboboxState`/`onComboboxChange` branches (μοτίβο `isMepBoilerReliefPressureKey` ΑΥΤΟΛΕΞΕΙ — δες πώς έγινε για το relief pressure).
6. **i18n (N.11 — ΠΡΩΤΑ τα keys):** editor `ribbon.commands.mepBoilerEditor.pressureGauge`/`.systemPressure` + tag `ribbon.commands.mepBoilerTag.pressureGauge`, σε **el ΚΑΙ en**.
7. **Tests:** `mep-boiler-symbol.test.ts` (pressureGauge → επιπλέον `glyphStrokes` πέρα από τα base 4· stacks με valve+vessel→μετράς σωστά· absent → χωρίς gauge glyph· rotation 90° finite)· `mep-boiler-tag.test.ts` (γραμμή «pressureGauge: 1.5 bar» present/absent· explicit + fractional override π.χ. 1.2).

**Αναμενόμενα αρχεία (~9, 100% boiler-owned, ΕΚΤΟΣ ADR-040 — ΜΗΔΕΝ drawing edit):** `mep-boiler-types.ts` · `mep-boiler.schemas.ts` · `mep-boiler-symbol.ts` · `mep-boiler-tag.ts` · `mep-boiler-command-keys.ts` · `useRibbonMepBoilerBridge.ts` · `contextual-mep-boiler-tab.ts` · i18n el+en · 2 test files.

**ADR-040:** **ΕΚΤΟΣ** (glyph στο ΥΠΑΡΧΟΝ `glyphStrokes`). ΜΗΝ adr-index.

### Εναλλακτικές (αν Giorgio θέλει αλλού)
- **Διαμόρφωση/Modulation (turndown)** — `minThermalOutputW` + tag «Διαμόρφωση: 6–24 kW» (turndown ratio π.χ. 4:1). **Data-only, μηδέν glyph, conflict-safe**, λειτουργικά πιο ουσιαστικό (modulating boilers = ο κανόνας· τροφοδοτεί μελλοντικό part-load sizing). Ζει στο «Θερμικά» panel δίπλα στο thermalOutput. Πολύ Revit (boilers έχουν part-load properties).
- **Design flow/return θερμοκρασίες** — `designFlowTempC`/`designReturnTempC` (π.χ. 80/60 ή 70/55· condensing θέλει return <55°C). Data-only, conflict-safe, οδηγεί τη hydronic ΔT. ⚠️ ίσως το θέλει αργότερα ο thermal/heating agent ως input — αλλά SSoT-σωστό να ζει στον λέβητα (source owns design temps).
- **Filling loop (βρόχος πλήρωσης)** — body glyph (double-check valve) + το `systemPressureBar`. Συγγενικό του μανόμετρου· θα μπορούσε να ενοποιηθεί.
- **MepBoilerKind `floor-boiler` (επιδαπέδιος)** — νέος kind + plinth glyph + defaults. Μεγαλύτερο slice, αγγίζει `MepBoilerKind` union + geometry defaults (ακόμη boiler-owned). Πιο «Revit family type».

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
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**`
- **ΗΛΕΚΤΡΟΛΟΓΙΚΑ (ADR-430/431):** `bim/types/mep-connector-types.ts`· `electrical-*`
- **MEP COLOR (shared, contended):** `bim/mep-systems/mep-system-color.ts` — READ-ONLY import μόνο
- **ΥΔΡΕΥΣΗ/ROUTING (ADR-426/429):** `systems/mep-design/water/**`, `systems/mep-design/routing/**`
- **3D GIZMO:** `bim-3d/**` · **FIXTURES (shared):** `bim/types/mep-fixture-types.ts` · **WALLS:** `bim/walls/opening-grips.ts`

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- **N.0.1 ADR-driven:** Recognition (διάβασε ΚΩΔΙΚΑ πρώτα: `mep-boiler-symbol.ts` [`buildExpansionVesselGlyph`/`buildSafetyValveGlyph`/`buildFlameStrokes` rotation-aware pattern· `glyphStrokes` push· `pointAt`/`unit` helpers], `mep-boiler-tag.ts` [unit glyph consts· line gating 1-13], `mep-boiler-command-keys.ts` [toggle/string/number unions+sets+guards· `isMepBoilerReliefPressureKey` pattern], `useRibbonMepBoilerBridge.ts` [TOGGLE/NUMBER maps· dedicated STRING branches ΠΡΙΝ model picker — δες relief pressure], `contextual-mep-boiler-tab.ts` [always-visible «Ασφάλεια» panel + options από SSoT]) → **Plan Mode** → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- **N.14 model:** pressure gauge (1 domain, glyph+data+UI, μηδέν drawing) → **Opus ή Sonnet** (δική σου κρίση· είναι σχεδόν πανομοιότυπο με βαλβίδα/δοχείο).
- **N.11 i18n:** ΠΡΩΤΑ τα keys σε el **ΚΑΙ** en, μετά ο κώδικας· καμία hardcoded string· καμία `any` (N.2).
- **N.15:** μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (`project_adr408_combi_boiler.md` + index). **ΜΗΝ** adr-index (shared tree). ΕΚΤΟΣ ADR-040.
- **COMMIT/PUSH ΠΟΤΕ εσύ (N.(-1)).** `git add` ΜΟΝΟ δικά σου· `git status`/`git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/` (baseline μετά expansion vessel: symbol +5 + tag +3).
- bridge: `npx jest src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepBoilerBridge.test.tsx` (baseline **31/31**).
- συνολικό boiler+bridge: **220/220** μετά το expansion vessel.
- i18n: νέα keys σε el **ΚΑΙ** en (CHECK 3.8· μην αφήσεις `defaultValue` με literal).
- tsc μόνο στο τέλος, **N.17** (έλεγξε process ΠΡΩΤΑ — WMI filter, όχι `$_`). Αγνόησε pre-existing `mesh-to-object3d.ts:124` + `mep-fixture-types.ts`.
- browser-verify το κάνει ο Giorgio: λέβητας με toggle «Μανόμετρο» → σύμβολο μανομέτρου (κύκλος+βελόνα) στο σώμα (τρίτο διακριτό σημείο) + tag γραμμή «Πίεση: 1.5 bar».
