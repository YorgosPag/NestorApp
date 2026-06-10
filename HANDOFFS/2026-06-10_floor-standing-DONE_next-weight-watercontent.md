# HANDOFF — Λέβητας: Floor-Standing mounting DONE → επόμενο: Δεδομένα Εγκατάστασης (Βάρος + Περιεχόμενο Νερού)

**Ημ/νία:** 2026-06-10 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ **επιβεβαιωμένος agent στη ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**` — ο Giorgio το ΞΑΝΑΕΠΙΒΕΒΑΙΩΣΕ 2026-06-10). Πιθανώς ενεργοί και: 3D GIZMO (`bim-3d/**`), THERMAL (`bim/thermal/heat-load/**`), ΗΛΕΚΤΡΟΛΟΓΙΚΑ, ΥΔΡΕΥΣΗ/ROUTING, COORDINATION/CLASH, PROPOSAL-GHOST. **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (§5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος. **WMI -Filter, ΟΧΙ `$_`**:
> `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%tsc%'\" | Select-Object ProcessId, CommandLine | Format-List"`
> Αν επιστρέψει PID → τρέχει tsc άλλου agent → **ΠΕΡΙΜΕΝΕ**. Αν τίποτα → ελεύθερος.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Επιδαπέδιος Λέβητας (Floor-Standing mounting), ΟΛΑ uncommitted (commit ο Giorgio)

**Επιδαπέδιος Λέβητας (Floor-Standing Boiler mounting, Revit «Mounting» type-property — Wall-Hung vs Floor-Standing οικογένεια).** Έκλεισε **πραγματική functional ασυνέπεια**: ο catalog είχε «Πετρελαίου επιδαπέδιος 30/45 kW» (`oil-floor-30`/`oil-floor-45`) ΑΛΛΑ **όλοι** οι λέβητες ήταν `kind:'wall-boiler'` με `mountingElevationMm` (επίτοιχοι) → ο επιδαπέδιος μοντελοποιούνταν σαν κρεμασμένος. **Data-only, ΜΗΔΕΝ glyph, 100% boiler-owned, ΕΚΤΟΣ ADR-040 εντελώς**, μηδέν conflict με τον ενεργό heating agent.

**🔑 Αποφάσεις (Revit-grade, πάρθηκαν από τον agent):**
1. **Recognition (κρίσιμο πρώτα):** `MepBoilerKind` είναι **μονομελές** (`'wall-boiler'`)· το `bim-3d/converters/mesh-to-object3d.ts` (gizmo agent) **ΔΕΝ** κάνει `switch(kind)` πάνω στον λέβητα (grep `mep-boiler|wall-boiler` = No matches) → **κανένα exhaustive-switch break**.
2. **`mountingType?: 'wall-hung' | 'floor-standing'` FIELD (ΟΧΙ νέο `MepBoilerKind` member)** — στη Revit το mounting είναι **type-property**· additive/optional (absent ⇒ `'wall-hung'` default → μηδέν regression)· **μηδέν 3D-converter touch**.
3. **Data + tag** (κάτοψη wall-hung vs floor-standing = ίδιο footprint → ουσιαστικό fix = δεδομένα, κανένα glyph).
4. **NEW SSoT στο `boiler-model-catalog.ts`:** `MepBoilerMountingType` + `MEP_BOILER_MOUNTING_TYPES` + `isMepBoilerMountingType` guard + `DEFAULT_BOILER_MOUNTING_TYPE='wall-hung'` (πιστό mirror `BoilerFuelType`/`isBoilerFuelType`).
5. **Catalog:** τα 2 oil-floor presets → `mountingType:'floor-standing'`· υπόλοιπα absent (=wall-hung). `applyBoilerModelToParams` γεμίζει· `clearBoilerModel` αφαιρεί (Type-property).
6. **Tag γραμμή 19** «Τοποθέτηση: Επιδαπέδιος» — gated **ΜΟΝΟ** floor-standing (annotate την εξαίρεση· ο επίτοιχος default δεν tag-άρεται)· JSDoc 1-18→1-19.
7. **UI:** static-enum «Τοποθέτηση» picker στο «Μοντέλο» panel (mirror fuelType· **ΧΩΡΙΣ clear sentinel** — πάντα wall/floor· options reuse τα tag `mountingTypes.*` labels· routed `isMepBoilerMountingTypeKey` ΠΡΙΝ τον model picker).

**Verify:** jest **307/307** (από 295, +12) στα **11 boiler+bridge suites** (`boiler-model-catalog.test.ts` +9, `mep-boiler-tag.test.ts` +3)· **tsc καθαρό στα δικά μου** (μόνο το pre-existing `mesh-to-object3d.ts:124` του gizmo agent)· i18n el+en έγκυρα. N.15 docs ✅.

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (Giorgio· `git add` ΜΟΝΟ αυτά· ΟΛΑ ΕΚΤΟΣ ADR-040):**
- `src/subapps/dxf-viewer/bim/mep-boilers/boiler-model-catalog.ts` (type+array+guard+`DEFAULT_BOILER_MOUNTING_TYPE`+preset field+2 oil presets+apply/clear)
- `src/subapps/dxf-viewer/bim/types/mep-boiler-types.ts` (+`mountingType?`)
- `src/subapps/dxf-viewer/bim/types/mep-boiler.schemas.ts` (1 optional enum)
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-tag.ts` (γραμμή 19)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (string key `mountingType` + `isMepBoilerMountingTypeKey` guard + STRING_KEY_SET + union)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-boiler-tab.ts` (combobox «Τοποθέτηση»)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/boiler-model-catalog.test.ts` (+9) · `__tests__/mep-boiler-tag.test.ts` (+3)
- `src/i18n/locales/el/dxf-viewer-shell.json` · `en/dxf-viewer-shell.json` (`mepBoilerEditor.mountingType` + tag `mounting` + `mountingTypes.wall-hung`/`floor-standing` — ⚠️ SHARED)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (gitignored) · MEMORY (`project_adr408_combi_boiler.md` + index)
- ⚠️ `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepBoilerBridge.ts` (getComboboxState + onChange `mountingType` branch + 4 imports): **SHARED** — έλεγξε `git diff` πριν το add.

> ℹ️ Στο ίδιο uncommitted batch υπάρχουν ΚΑΙ τα αρχεία προηγούμενων slices (sound-power: `boiler-acoustics.ts`+test· NOx: `boiler-nox.ts`+test· filling-loop: `mep-boiler-symbol*.ts`+test· `mep-boiler-param-maps.ts`). ΟΛΑ boiler-owned, δικά μας, εκκρεμούν commit μαζί. **ΔΕΝ άγγιξα** `mep-boiler-param-maps.ts` αυτό το session (το `mountingType` είναι string picker → δεν περνά από param-maps).

**🔴 Εκκρεμεί browser-verify (Giorgio):** λέβητας με μοντέλο «Πετρελαίου επιδαπέδιος» Ή picker «Τοποθέτηση»→Επιδαπέδιος → tag γραμμή «Τοποθέτηση: Επιδαπέδιος»· επίτοιχος (default) → ΟΧΙ γραμμή.

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return · combi DHW (hot/cold/recirc) · καπναγωγός (flue) + chevron + vent terminal · τροφοδοσία καυσίμου (fuel) + gas-cock + per-fuel διάμετροι · αποχέτευση συμπυκνωμάτων (condensate) + σιφώνι + εξουδετερωτής · connector stubs χρωματισμένα ανά System Classification · **ΕΤΙΚΕΤΑ ΕΝΕΡΓΕΙΑΣ EU ΟΛΟΚΛΗΡΗ** (απόδοση/ErP + NOx + στάθμη ηχητικής ισχύος L_WA) · τύπος καυσίμου dropdown · **τοποθέτηση wall-hung/floor-standing** · model catalog (7 μοντέλα) · θερμική ισχύς · διαμόρφωση/turndown · L2 sizing (ADR-422) · service clearance zone · sealed-system ΟΛΟΚΛΗΡΩΜΕΝΟ (ασφαλιστική βαλβίδα + δοχείο διαστολής + μανόμετρο + βρόχος πλήρωσης) · **2D plan tag (19 γραμμές)** · WYSIWYG placement ghost · MEP→BOQ autofeed.

**🟢 Η ΟΙΚΟΓΕΝΕΙΑ CONNECTORS ΕΙΝΑΙ ΠΛΗΡΗΣ** (8 connectors, περίμετρος ΓΕΜΑΤΗ) → κάθε νέο **φυσικό** εξάρτημα = **body glyph** στο `glyphStrokes`, ΟΧΙ connector.

**🟢 ΕΤΙΚΕΤΑ ΕΝΕΡΓΕΙΑΣ EU ΟΛΟΚΛΗΡΗ** (energy + emissions + noise) — δεν λείπει άξονας ετικέτας.

**Μοτίβα που κυριαρχούν (FULL SSOT) — ΔΙΑΒΑΣΕ ΤΑ ΩΣ ΠΡΟΤΥΠΟ:**
- **Pure data SSoT modules (μηδέν renderer, ΜΗΔΕΝ glyph):** `boiler-acoustics.ts` (engineering band), `boiler-nox.ts` (verdict), `boiler-efficiency.ts`, `boiler-modulation.ts`, `boiler-model-catalog.ts` (catalog + fuel-type + **mounting-type** enums/guards).
- **Tag = content SSoT:** `buildBoilerTagLines(params, t)` (pure, injected translator· i18n `ribbon.commands.mepBoilerTag.*` ns `dxf-viewer-shell`). Glyphs/units: `DIAMETER_GLYPH='Ø'`, `PERCENT_GLYPH='%'`, `MM_GLYPH='mm'`, `CHECK_GLYPH='✓'`, `CROSS_GLYPH='✗'`, `BAR_UNIT='bar'`, `LITRE_UNIT='L'`, `NOX_UNIT='mg/kWh'`, `DB_UNIT='dB(A)'`, `RANGE_DASH='–'`. (kW = i18n key `kWUnit`.)
- **Readout SSoT στο bridge:** `useRibbonMepBoilerBridge.ts` → `getComboboxState` → `isMepBoilerReadoutKey` branch· `erpClass`/`noxClass`/`acousticBand` λύνονται ΠΡΙΝ τον sizing guard, disabled combobox.
- **UI pipeline:** `mep-boiler-command-keys.ts` (keys + guards) → `mep-boiler-param-maps.ts` (**SHARED**: `TOGGLE/NUMBER_KEY_TO_FIELD`) → `useRibbonMepBoilerBridge.ts` (get/onChange) → `contextual-mep-boiler-tab.ts` (panels). **Integer presets → plain numeric (`NUMBER_KEY_TO_FIELD`)· fractional/enum → static-enum STRING combobox (guard ΠΡΙΝ τον model picker)· read-only → readout key + bridge disabled-combobox branch.**

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (απόφαση agent, Revit-grade) — ΔΕΔΟΜΕΝΑ ΕΓΚΑΤΑΣΤΑΣΗΣ: ΒΑΡΟΣ (kg) + ΠΕΡΙΕΧΟΜΕΝΟ ΝΕΡΟΥ (L)

**🔑 Γιατί ΑΥΤΟ:** Είναι το **ασφαλέστερο + Revit-grade** επόμενο βήμα ενώ ο heating agent είναι ΕΝΕΡΓΟΣ: **100% data-only, ΜΗΔΕΝ glyph, ΜΗΔΕΝ shared touch πέρα από τα boiler-owned αρχεία, ΕΚΤΟΣ ADR-040, conflict-safe**. Πιστό mirror του sound-power/NOx 1:1. Δύο πραγματικές Revit Mechanical Equipment Type properties:
- **`weightKg?`** — βάρος εξοπλισμού (Revit Mechanical Equipment «Weight»)· structural loading· σημαντικό για επιδαπέδιους (βαρείς) vs επίτοιχους (στήριγμα τοίχου) → **φυσικός σύντροφος του mounting-type που μόλις έγινε**.
- **`waterContentL?`** — περιεχόμενο νερού λέβητα (IFC `Pset_BoilerTypeCommon.WaterStorageCapacity`)· **συνδέεται με το ήδη υλοποιημένο δοχείο διαστολής** (η μηχανική διαστασιολογεί το δοχείο από το συνολικό water volume).

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**

1. **Δύο NEW optional numeric params** `weightKg?: number` + `waterContentL?: number` στο `mep-boiler-types.ts` (+ JSDoc Revit/IFC αναφορές)· schema `z.number().positive().optional()` × 2.
2. **Catalog:** `BoilerModelPreset += weightKg? + waterContentL?` σε **ΟΛΑ τα 7 presets** (ρεαλιστικές τιμές: επίτοιχος αερίου ~35–40 kg / ~2.5–3.5 L· επιδαπέδιος πετρελαίου ~120–180 kg / ~25–40 L· αντλία ~60–90 kg· ηλεκτρικός ~20–30 kg)· `applyBoilerModelToParams` γεμίζει· `clearBoilerModel` αφαιρεί (Type-properties).
3. **Tag γραμμές 20 + 21** «Βάρος: 35 kg» / «Νερό: 2.5 L» — gated `> 0` (μοτίβο sound-power)· NEW consts `KG_UNIT='kg'` (το `LITRE_UNIT='L'` υπάρχει ήδη)· JSDoc 1-19→1-21. **Plain value display, ΧΩΡΙΣ pure resolver** (όπως οι γραμμές power/clearance — απλά δεδομένα, μηδέν dead-code concern· ο tag καταναλώνει το param απευθείας).
4. **UI:** editable numeric «Βάρος (kg)» + «Νερό (L)» (plain `NUMBER_KEY_TO_FIELD`, ακέραιοι/δεκαδικοί). **Απόφαση panel (Revit-grade, δική σου):** είτε στο ΥΠΑΡΧΟΝ «Θερμικά» panel (λιγότερο churn) είτε **NEW «Εγκατάσταση»/«Τεχνικά» panel** (Revit ομαδοποιεί τα installation/physical data μαζί — καθαρότερο). Πρότεινε το ένα, εξήγησε γιατί.
5. **i18n (N.11 — ΠΡΩΤΑ τα keys, el ΚΑΙ en):** `mepBoilerEditor.weight` + `mepBoilerEditor.waterContent` + tag `mepBoilerTag.weight` + `mepBoilerTag.waterContent` (+ panel label αν NEW panel).
6. **Tests:** `boiler-model-catalog.test.ts` (apply γεμίζει weight/waterContent· clear αφαιρεί) + `mep-boiler-tag.test.ts` (γραμμές present όταν >0, absent όταν 0/undefined).

**🔑 ΠΡΟΑΙΡΕΤΙΚΗ Revit-grade επέκταση (απόφασέ το μόνος):** read-only readout «Προτεινόμενο δοχείο διαστολής» που **ΚΑΤΑΝΑΛΩΝΕΙ** NEW pure `resolveRecommendedExpansionVesselL(waterContentL, ...)` (μοτίβο `resolveAcousticBand` consumed-by-readout → μηδέν dead-code 3.22). Συνδέει το `waterContentL` με το ήδη υπάρχον `expansionVesselVolumeL` (η μηχανική: όγκος δοχείου ≈ water content × expansion factor / acceptance). **Αν το βάλεις → readout key + bridge disabled-combobox branch (μοτίβο `acousticBand`).** Αν προτιμάς minimal → άστο για επόμενο slice.

**Αναμενόμενα αρχεία (~10-12, boiler-owned, ΕΚΤΟΣ ADR-040):** `mep-boiler-types.ts` (+2 params) · `mep-boiler.schemas.ts` (2 optional) · `boiler-model-catalog.ts` (2 preset fields + 7×2 τιμές + apply/clear) · `mep-boiler-tag.ts` (2 γραμμές + `KG_UNIT`) · `mep-boiler-command-keys.ts` (2 numeric keys [+1 readout key αν επέκταση]) · `mep-boiler-param-maps.ts` (2 `NUMBER_KEY_TO_FIELD` γραμμές· **SHARED** — git diff πρώτα) · `useRibbonMepBoilerBridge.ts` (μόνο αν readout επέκταση· **SHARED**) · `contextual-mep-boiler-tab.ts` (2 comboboxes [+ NEW panel αν επιλέξεις]) · i18n el+en · 2 test files · (+ NEW `boiler-expansion-sizing.ts`+test ΑΝ επέκταση).

**ADR-040:** **ΕΚΤΟΣ ΕΝΤΕΛΩΣ** (data/tag-only, μηδέν drawing edit). ΜΗΝ adr-index (shared tree).

### Εναλλακτικές (αν θες κάτι άλλο boiler conflict-safe)
- **Επιδαπέδιος 3D base / plinth glyph** → ⛔ DEFER: αγγίζει gizmo agent (`bim-3d/converters/mesh-to-object3d.ts`) + ADR-040 renderer (`MepBoilerRenderer.ts`/symbol/ghost).
- **flue/fuel/condensate/NOx/floor-base 3D stubs** → ⛔ DEFER: shared 3D converter (gizmo agent, pre-existing TS2345).
- **Fuel color στο `mep-system-color.ts`** → ⛔ DEFER: shared + contended (READ-ONLY import μόνο).
- **Design flow/return θερμοκρασίες** (`designFlowTempC`/`designReturnTempC`) → ⛔ DEFER: input του ΕΝΕΡΓΟΥ heating agent.

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict με ενεργούς agents)
- **Design flow/return θερμοκρασίες** — input του ενεργού heating agent· περίμενε `systems/mep-design/heating` να ελευθερωθεί.
- **ΟΛΑ τα 3D stubs** (flue/fuel/condensate/NOx/floor-base/plinth) — shared 3D converter (`bim-3d/**`, gizmo agent).
- **Fuel color στο `mep-system-color.ts`** — shared + contended (READ-ONLY import μόνο).
- **Boiler 2D grips** — shared grip/gizmo infra (gizmo agent).
- **Condensate/fuel-network auto-design** — routing (`systems/mep-design/routing/**`).
- **ADR-422 L8 primary-energy ΚΕΝΑΚ wiring** — `bim/thermal/heat-load/**`, thermal agent (boiler-side efficiency + NOx + modulation + sound-power SSoT ΗΔΗ έτοιμα).

## 5. ΑΡΧΕΙΑ ΑΛΛΩΝ AGENTS — ΜΗΝ ΑΓΓΙΞΕΙΣ
- **ΘΕΡΜΑΝΣΗ (ADR-428):** `systems/mep-design/heating/**` — **ΕΝΕΡΓΟΣ agent (επιβεβαιωμένο Giorgio 2026-06-10)**
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**`
- **ΗΛΕΚΤΡΟΛΟΓΙΚΑ (ADR-430/431):** `bim/types/mep-connector-types.ts`· `electrical-*`· `electrical-proposal-store.ts`
- **COORDINATION/CLASH (ADR-435):** `systems/coordination/**` (π.χ. `entity-world-aabb.ts`)
- **3D GIZMO / SNAP / CONVERTER:** `bim-3d/**` (π.χ. `mesh-to-object3d.ts` — pre-existing tsc error δικό τους, `bim3d-snap-bridge.ts`, `ProSnapToolbar.tsx`)
- **PROPOSAL GHOST REFACTOR:** `components/dxf-layout/canvas-layer-stack-*-proposal-ghost.tsx`, `ProposalGhostOverlay.tsx`, `bim-3d/proposal/`
- **MEP COLOR (shared, contended):** `bim/mep-systems/mep-system-color.ts` — READ-ONLY import μόνο
- **ΥΔΡΕΥΣΗ/ROUTING (ADR-426/429):** `systems/mep-design/water/**`, `systems/mep-design/routing/**`
- **FIXTURES (shared):** `bim/types/mep-fixture-types.ts` · **WALLS:** `bim/walls/opening-grips.ts`
- ⚠️ **SHARED boiler UI (contended):** `useRibbonMepBoilerBridge.ts` + `mep-boiler-param-maps.ts` — άγγιξέ τα ΜΟΝΟ για τις additive γραμμές που χρειάζεσαι, έλεγξε `git diff` πρώτα.

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- **N.0.1 ADR-driven:** Recognition (διάβασε ΚΩΔΙΚΑ πρώτα — `boiler-acoustics.ts`/`boiler-nox.ts` [pure SSoT πρότυπο], `mep-boiler-tag.ts` [tag lines + units], `boiler-model-catalog.ts` [preset apply/clear + enum/guard SSoT], `mep-boiler-command-keys.ts`, `useRibbonMepBoilerBridge.ts`, `contextual-mep-boiler-tab.ts`) → **Plan Mode** → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- **N.14 model:** Δεδομένα Εγκατάστασης (2 numeric params + tag + UI, data-only) → **Sonnet 4.6 αρκεί σίγουρα**. Δήλωσε μοντέλο, πάρε «ok».
- **N.11 i18n:** ΠΡΩΤΑ τα keys σε el **ΚΑΙ** en· καμία hardcoded string· καμία `any` (N.2)· κανένα `as any`/`@ts-ignore`.
- **N.15:** μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (`project_adr408_combi_boiler.md` + index). **ΜΗΝ** adr-index (shared tree).
- **COMMIT/PUSH ΠΟΤΕ εσύ (N.(-1)).** `git add` ΜΟΝΟ δικά σου· `git status`/`git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/ src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepBoilerBridge.test.tsx`. **Baseline μετά το floor-standing: 307/307 στα 11 boiler+bridge suites.** (Το i18n `warnOnce` του react-i18next στο bridge test είναι προϋπάρχον noise, ΟΧΙ failure.)
- i18n: νέα keys σε el **ΚΑΙ** en (CHECK 3.8· μην αφήσεις `defaultValue` με literal).
- tsc μόνο στο τέλος, **N.17** (έλεγξε process ΠΡΩΤΑ· αν τρέχει άλλος, ΠΕΡΙΜΕΝΕ). **Αγνόησε errors άλλων agents:** `mesh-to-object3d.ts`, `bim3d-snap-bridge.ts`, `entity-world-aabb.ts`, `ProSnapToolbar.tsx`, `mep-fixture-types.ts`. Φίλτραρε: `npx tsc --noEmit 2>&1 | grep -iE "mep-boiler|boiler-|contextual-mep-boiler|useRibbonMepBoilerBridge"`.
- browser-verify το κάνει ο Giorgio.
