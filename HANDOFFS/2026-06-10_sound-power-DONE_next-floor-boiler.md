# HANDOFF — Λέβητας: Sound Power L_WA DONE → επόμενο: Επιδαπέδιος Λέβητας (Floor-Standing mounting)

**Ημ/νία:** 2026-06-10 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ **επιβεβαιωμένος agent στη ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**` — ο Giorgio το επιβεβαίωσε ΞΑΝΑ 2026-06-10). Πιθανώς ενεργοί και: 3D GIZMO (`bim-3d/**`), THERMAL (`bim/thermal/heat-load/**`), ΗΛΕΚΤΡΟΛΟΓΙΚΑ, ΥΔΡΕΥΣΗ/ROUTING, COORDINATION/CLASH, PROPOSAL-GHOST. **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (§5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος. **WMI -Filter, ΟΧΙ `$_`**:
> `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%tsc%'\" | Select-Object ProcessId, CommandLine | Format-List"`
> Αν επιστρέψει PID → τρέχει tsc άλλου agent → **ΠΕΡΙΜΕΝΕ**. Αν τίποτα → ελεύθερος.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — Sound Power Level L_WA, ΟΛΑ uncommitted (commit ο Giorgio)

**Στάθμη ηχητικής ισχύος L_WA (Sound Power Level, Revit Mechanical Equipment «Sound» / IFC `Pset_SoundAttenuation`).** Ο **3ος & τελευταίος άξονας της ετικέτας ενέργειας EU** (Reg. 811/2013): η_s/ErP ✅ + NOx ✅ + **θόρυβος dB(A)** ✅. **Data-only, ΜΗΔΕΝ glyph**, 100% boiler-owned, **ΕΚΤΟΣ ADR-040 εντελώς**, μηδέν conflict με τον ενεργό heating agent. Σχήμα **πανομοιότυπο με το NOx**.

**🔑 Αποφάσεις (Revit-grade, πάρθηκαν από τον agent):**
1. **NEW pure SSoT `boiler-acoustics.ts`** (mirror `boiler-nox.ts`, μηδέν renderer import): `resolveAcousticBand(dbA)` → **placement-suitability band** `AcousticBand = 'quiet' | 'standard' | 'loud'`· `null` για absent/μη-θετική τιμή. Consts `ACOUSTIC_QUIET_MAX_DBA=45`, `ACOUSTIC_STANDARD_MAX_DBA=55`.
2. **⚠️ ΕΝΤΙΜΟΤΗΤΑ (N.HONESTY):** ΔΕΝ υπάρχει νομικό όριο θορύβου EU (σε αντίθεση με το NOx που είναι νομικός γκέιτ) → επέστρεψα **engineering band κι ΟΧΙ verdict συμμόρφωσης**, τεκμηριωμένο ΡΗΤΑ ως UX heuristic στο JSDoc + στο `AcousticBand` type.
3. **Param `soundPowerDbA?: number`**· additive/optional· schema `z.number().positive().optional()`.
4. **Tag γραμμή 18** «Θόρυβος: 49 dB(A)» — gated `soundPowerDbA > 0`, **ΟΧΙ combustion-gated** (αφορά ΚΑΘΕ τύπο — pump/fan/burner κάνουν θόρυβο, ≠ NOx combustion-only). NEW const `DB_UNIT='dB(A)'`. JSDoc 1-17→1-18. Το tag δείχνει την ΤΙΜΗ· το band φαίνεται στο readout (το pure fn καταναλώνεται από το **bridge readout** → μηδέν dead-code CHECK 3.22).
5. **Catalog** `BoilerModelPreset += soundPowerDbA?` σε **ΟΛΑ τα 7 presets** (αερίου 45/48/47, πετρ. 56/58, αντλία 52, ηλεκτρ. 40 — ≠ NOx που ήταν combustion-only)· `applyBoilerModelToParams` γεμίζει· `clearBoilerModel` αφαιρεί (Type-property).
6. **UI:** «Θερμικά» panel δίπλα στο `noxClass`: editable numeric «Θόρυβος (dB(A))» (`NUMBER_KEY_TO_FIELD`) + read-only «Θόρυβος» band readout (disabled combobox, μοτίβο `noxClass`· localized «Ήσυχος»/«Κανονικός»/«Θορυβώδης»/«—»).

**Verify:** jest **295/295** στα **11 boiler+bridge suites** (NEW `boiler-acoustics.test.ts` +9, `mep-boiler-tag.test.ts` +4, `boiler-model-catalog.test.ts` +2)· **tsc καθαρό στα δικά μου** (έλεγξα N.17 — δεν έτρεχε άλλος· μόνο pre-existing `mesh-to-object3d.ts:124` του gizmo agent)· τα 2 i18n JSON έγκυρα. N.15 docs ✅.

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (Giorgio· `git add` ΜΟΝΟ αυτά· ΟΛΑ ΕΚΤΟΣ ADR-040):**
- **NEW** `src/subapps/dxf-viewer/bim/mep-boilers/boiler-acoustics.ts`
- **NEW** `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/boiler-acoustics.test.ts`
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-tag.ts` (γραμμή 18 + `DB_UNIT`)
- `src/subapps/dxf-viewer/bim/mep-boilers/boiler-model-catalog.ts` (preset field + 7 τιμές + apply/clear)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/mep-boiler-tag.test.ts` (+4)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/boiler-model-catalog.test.ts` (+2)
- `src/subapps/dxf-viewer/bim/types/mep-boiler-types.ts` (+`soundPowerDbA?`)
- `src/subapps/dxf-viewer/bim/types/mep-boiler.schemas.ts` (1 optional)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (numeric key `soundPower` + readout key `acousticBand`)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-boiler-tab.ts` (options + 2 comboboxes)
- `src/i18n/locales/el/dxf-viewer-shell.json` · `en/dxf-viewer-shell.json` (`soundPower`/`acousticBand`/`acousticQuiet`/`acousticStandard`/`acousticLoud` + tag `soundPower` — ⚠️ SHARED)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (gitignored) · MEMORY (`project_adr408_combi_boiler.md` + index)
- ⚠️ `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-param-maps.ts` (1 `NUMBER_KEY_TO_FIELD` γραμμή): **SHARED** — έλεγξε `git diff` πριν το add.
- ⚠️ `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepBoilerBridge.ts` (`acousticBand` readout branch + import): **SHARED** — έλεγξε `git diff` πριν το add.

> ℹ️ Στο ίδιο uncommitted batch υπάρχουν ΚΑΙ τα αρχεία προηγούμενων slices: NOx (`boiler-nox.ts` + test) + Filling Loop (`mep-boiler-symbol.ts`, `mep-boiler-symbol-glyphs.ts`, `mep-boiler-symbol.test.ts`). ΟΛΑ boiler-owned, δικά μας, εκκρεμούν commit μαζί.

**🔴 Εκκρεμεί browser-verify (Giorgio):** λέβητας με τιμή θορύβου → «Θερμικά» panel → editable «Θόρυβος (dB(A))» + read-only «Θόρυβος» band readout («Ήσυχος»/«Κανονικός»/«Θορυβώδης») + tag γραμμή «Θόρυβος: …». **Δείξε ότι φαίνεται και σε ηλεκτρικό/αντλία** (όχι combustion-gated).

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return · combi DHW (hot/cold/recirc) · καπναγωγός (flue) + chevron + vent terminal · τροφοδοσία καυσίμου (fuel) + gas-cock + per-fuel διάμετροι · αποχέτευση συμπυκνωμάτων (condensate) + σιφώνι + εξουδετερωτής · connector stubs χρωματισμένα ανά System Classification · **ΕΤΙΚΕΤΑ ΕΝΕΡΓΕΙΑΣ EU ΟΛΟΚΛΗΡΗ** (απόδοση/ErP + NOx + **στάθμη ηχητικής ισχύος L_WA**) · τύπος καυσίμου dropdown · model catalog (7 μοντέλα) · θερμική ισχύς · διαμόρφωση/turndown · L2 sizing (ADR-422) · service clearance zone · sealed-system ΟΛΟΚΛΗΡΩΜΕΝΟ (ασφαλιστική βαλβίδα + δοχείο διαστολής + μανόμετρο + βρόχος πλήρωσης) · **2D plan tag (18 γραμμές)** · WYSIWYG placement ghost · MEP→BOQ autofeed.

**🟢 Η ΟΙΚΟΓΕΝΕΙΑ CONNECTORS ΕΙΝΑΙ ΠΛΗΡΗΣ** (8 connectors, περίμετρος ΓΕΜΑΤΗ) → κάθε νέο **φυσικό** εξάρτημα = **body glyph** στο `glyphStrokes`, ΟΧΙ connector.

**🟢 ΕΤΙΚΕΤΑ ΕΝΕΡΓΕΙΑΣ EU (811/2013 + 813/2013) ΟΛΟΚΛΗΡΗ:** η_s/ErP ✅ · NOx ✅ · L_WA ✅. **Δεν λείπει άλλος άξονας ετικέτας.**

**Μοτίβα που κυριαρχούν (FULL SSOT) — ΔΙΑΒΑΣΕ ΤΑ ΩΣ ΠΡΟΤΥΠΟ:**
- **Pure data SSoT modules (μηδέν renderer, ΜΗΔΕΝ glyph):** `boiler-acoustics.ts` (το ΝΕΟΤΕΡΟ — engineering band), `boiler-nox.ts` (verdict), `boiler-efficiency.ts`, `boiler-modulation.ts`, `boiler-model-catalog.ts`.
- **Tag = content SSoT:** `buildBoilerTagLines(params, t)` (pure, injected translator· i18n `ribbon.commands.mepBoilerTag.*` ns `dxf-viewer-shell`). Glyphs/units: `DIAMETER_GLYPH='Ø'`, `PERCENT_GLYPH='%'`, `MM_GLYPH='mm'`, `CHECK_GLYPH='✓'`, `CROSS_GLYPH='✗'`, `BAR_UNIT='bar'`, `LITRE_UNIT='L'`, `NOX_UNIT='mg/kWh'`, `DB_UNIT='dB(A)'`, `RANGE_DASH='–'`. (kW = i18n key `kWUnit`.)
- **Readout SSoT στο bridge:** `useRibbonMepBoilerBridge.ts` → `getComboboxState` → `isMepBoilerReadoutKey` branch· `erpClass`/`noxClass`/`acousticBand` λύνονται ΠΡΙΝ τον sizing guard (εξαρτώνται από params, όχι sizing), disabled combobox.
- **2D σύμβολο / glyphs:** `mep-boiler-symbol.ts` (connector-driven loop + `strokes`/`ventStrokes`/`fuelStrokes`/`glyphStrokes`/`clearanceOutline`)· `mep-boiler-symbol-glyphs.ts` (pure body-glyph builders: valve/vessel/gauge/filling-loop)· `MepBoilerRenderer.ts` (2D leaf) + `MepBoilerGhostRenderer.ts` (WYSIWYG ghost — ΙΔΙΟΣ symbol-builder SSoT).
- **UI pipeline:** `mep-boiler-command-keys.ts` (keys + guards) → `mep-boiler-param-maps.ts` (**SHARED**: `TOGGLE/NUMBER_KEY_TO_FIELD`) → `useRibbonMepBoilerBridge.ts` (get/onChange) → `contextual-mep-boiler-tab.ts` (panels). **Integer presets → plain numeric· fractional/enum → static-enum STRING combobox (guard ΠΡΙΝ τον model picker)· read-only → readout key + bridge disabled-combobox branch.**

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (απόφαση agent, Revit-grade) — ΕΠΙΔΑΠΕΔΙΟΣ ΛΕΒΗΤΑΣ (Floor-Standing Boiler mounting)

**🔑 Γιατί ΑΥΤΟ:** **Πραγματική functional ασυνέπεια.** Ο catalog έχει «**Πετρελαίου επιδαπέδιος** 30/45 kW» (`oil-floor-30`, `oil-floor-45`) ΑΛΛΑ **όλοι** οι λέβητες είναι `kind: 'wall-boiler'` με `mountingElevationMm` (επίτοιχοι, κρεμασμένοι σε ύψος) → ένας **επιδαπέδιος** πετρελαίου ζωγραφίζεται/τοποθετείται λανθασμένα σαν επίτοιχος. Η Revit έχει **διακριτές οικογένειες** «Wall-Hung Boiler» vs «Floor-Standing Boiler» (διαφορετική βάση/plinth, χωρίς mounting elevation, μεγαλύτερο σώμα). Είναι core Revit-grade modelling gap, **conflict-safe** ως προς τον ενεργό heating agent (ΔΕΝ αγγίζει `systems/mep-design/heating/**`).

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**

1. **Νέο `MepBoilerKind` member `'floor-boiler'`** (το υπάρχον union έχει `'wall-boiler'`). ⚠️ **ΚΡΙΣΙΜΟ RECOGNITION (πρώτο πράγμα):** ψάξε για **exhaustive `switch(kind)` / `: never`** πάνω στο `MepBoilerKind` — ΕΙΔΙΚΑ στο `bim-3d/converters/mesh-to-object3d.ts` (gizmo agent· ήδη έχει pre-existing TS2345 error εκεί) + σε renderers/geometry. Αν υπάρχει exhaustive switch που θα έσπαγε → **μην προσθέσεις στο union· κάνε `mountingType` enum field αντί νέου kind** (δες απόφαση 1β). Αν δεν υπάρχει (μόνο `=== 'wall-boiler'` equality checks) → νέο kind είναι ασφαλές.
   - **1β (fallback, ΑΣΦΑΛΕΣΤΕΡΟ αν το switch σπάει):** ΟΧΙ νέο kind, αλλά **`mountingType?: 'wall-hung' | 'floor-standing'`** optional param (default `'wall-hung'` όταν absent → μηδέν regression). Καθαρά additive, μηδέν exhaustive-switch risk, μηδέν 3D-converter touch. **Αυτό είναι πιθανότατα το σωστό Revit-grade move** (η Revit κρατά "mounting" ως type-property· εδώ ελαχιστοποιεί το blast radius στο shared tree).
2. **2D ΜΟΝΟ — DEFER το 3D εντελώς:** Ο επιδαπέδιος → **footprint + βάση/plinth glyph** (ορθογώνια βάση κάτω από το σώμα) στην κάτοψη + **χωρίς mounting elevation** (στο έδαφος, `mountingElevationMm` αγνοείται/μηδενίζεται όταν floor-standing). **ΜΗΝ αγγίξεις** `bim-3d/converters/mesh-to-object3d.ts` (gizmo agent). Το 3D box υπάρχει ήδη· η βάση 3D = DEFER.
3. **Plinth glyph (αν επιλέξεις να φανεί):** NEW pure `buildBoilerPlinthOutline` (μοτίβο `buildClearanceOutline`) → νέο πεδίο `BoilerSymbolGeometry.plinthOutline` (ή reuse `glyphStrokes` αν προτιμάς μηδέν renderer-touch). **ΠΡΟΣΟΧΗ ADR-040:** αν αγγίξεις `mep-boiler-symbol.ts`/`MepBoilerRenderer.ts`/`MepBoilerGhostRenderer.ts` → **ADR-040 STAGE υποχρεωτικό** (CHECK 6B/6D blocking). Αν πας το 1β + ΜΟΝΟ data/tag χωρίς glyph → ΕΚΤΟΣ ADR-040.
4. **Catalog:** τα `oil-floor-30`/`oil-floor-45` παίρνουν `mountingType: 'floor-standing'` (ή `kind`)· υπόλοιπα `'wall-hung'`/absent. `applyBoilerModelToParams` γεμίζει· `clearBoilerModel` αφαιρεί (Type-property).
5. **UI:** static-enum picker «Τοποθέτηση» (wall-hung / floor-standing) στο «Μοντέλο» ή «Geometry» panel + (όταν floor-standing) απόκρυψη/disable του `mountingElevation` combobox. Tag: προαιρετική γραμμή «Τοποθέτηση: Επιδαπέδιος» (ή μην το βάλεις — Revit δεν το tag-άρει συνήθως).
6. **i18n (N.11 — ΠΡΩΤΑ τα keys, el ΚΑΙ en):** `mepBoilerEditor.mountingType` + labels `mountingWallHung`/`mountingFloorStanding`.
7. **Tests:** geometry/catalog (apply/clear γεμίζει/αφαιρεί mounting)· αν glyph → symbol test (plinth present floor / absent wall)· bridge picker.

**Αναμενόμενα αρχεία (~8-12, boiler-owned):** `mep-boiler-types.ts` (+`mountingType?` ή `MepBoilerKind` += member) · `mep-boiler.schemas.ts` · `boiler-model-catalog.ts` (2 oil presets + apply/clear) · `mep-boiler-command-keys.ts` (string key) · `useRibbonMepBoilerBridge.ts` (picker branch· **SHARED**) · `mep-boiler-param-maps.ts` (ίσως· **SHARED**) · `contextual-mep-boiler-tab.ts` · i18n el+en · tests. **+ (αν glyph)** `mep-boiler-symbol.ts` + `MepBoilerRenderer.ts` + `MepBoilerGhostRenderer.ts` → **ADR-040 STAGE**.

**ADR-040:** **ΕΚΤΟΣ** αν μείνεις data/tag-only (1β χωρίς glyph)· **STAGE (CHECK 6B/6D)** αν αγγίξεις symbol/renderer/ghost για plinth. ΜΗΝ adr-index (shared tree).

### Εναλλακτική (αν το `mesh-to-object3d` switch σπάει ή θες ΜΗΔΕΝΙΚΟ ρίσκο shared tree)
- **ΔΕΔΟΜΕΝΑ ΕΓΚΑΤΑΣΤΑΣΗΣ (Weight + Water content)** — 100% data-only, ΜΗΔΕΝ glyph, ΜΗΔΕΝ shared touch, **ΕΚΤΟΣ ADR-040**, mirror NOx/sound-power 1:1:
  - `weightKg?` (βάρος εξοπλισμού· Revit Mechanical Equipment «Weight»· structural loading) + `waterContentL?` (περιεχόμενο νερού· IFC `Pset_BoilerTypeCommon.WaterStorageCapacity`· συνδέεται με το ήδη υλοποιημένο **δοχείο διαστολής** — η μηχανική διαστασιολογεί το δοχείο από το συνολικό water volume).
  - NEW tag γραμμές «Βάρος: 35 kg» / «Νερό: 2.5 L»· catalog values σε όλα τα presets· editable numeric στο «Θερμικά» ή νέο «Τεχνικά» panel. **Πανομοιότυπο σχήμα με sound-power — γρήγορο, μηδενικού ρίσκου.** ΧΩΡΙΣ pure resolver (απλά δεδομένα), εκτός αν θες readout «Προτεινόμενο δοχείο διαστολής» (band/sizing — προαιρετικό).

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict με ενεργούς agents)
- **Design flow/return θερμοκρασίες** (`designFlowTempC`/`designReturnTempC`) — input του ενεργού heating agent· περίμενε να ελευθερωθεί το `systems/mep-design/heating`.
- **ΟΛΑ τα 3D stubs** (flue/fuel/condensate/NOx/floor-base) — shared 3D converter (`bim-3d/converters/mesh-to-object3d.ts`, gizmo agent· έχει ήδη pre-existing TS2345 error).
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
- **N.0.1 ADR-driven:** Recognition (διάβασε ΚΩΔΙΚΑ πρώτα — ΕΙΔΙΚΑ ψάξε exhaustive `switch(kind)` πριν αποφασίσεις kind vs mountingType· `boiler-acoustics.ts`/`boiler-nox.ts` [pure SSoT πρότυπο], `mep-boiler-symbol.ts` [connector-driven loop + geometry πεδία], `MepBoilerRenderer.ts`/`MepBoilerGhostRenderer.ts` [αν glyph], `mep-boiler-command-keys.ts`, `useRibbonMepBoilerBridge.ts`, `contextual-mep-boiler-tab.ts`, `boiler-model-catalog.ts` [preset apply/clear], `mep-boiler-geometry.ts` [mounting/footprint]) → **Plan Mode** → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- **N.14 model:** Floor-boiler (kind/mounting + ίσως plinth glyph + UI) → **Sonnet** πιθανώς αρκεί· **Opus** αν αγγίξεις 3D switch / πολλά shared. Δήλωσε μοντέλο, πάρε «ok». Data-only εναλλακτική → σίγουρα Sonnet.
- **N.11 i18n:** ΠΡΩΤΑ τα keys σε el **ΚΑΙ** en· καμία hardcoded string· καμία `any` (N.2)· κανένα `as any`/`@ts-ignore`.
- **N.15:** μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (`project_adr408_combi_boiler.md` + index). **ΜΗΝ** adr-index (shared tree).
- **COMMIT/PUSH ΠΟΤΕ εσύ (N.(-1)).** `git add` ΜΟΝΟ δικά σου· `git status`/`git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/ src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepBoilerBridge.test.tsx`. **Baseline μετά το sound-power: 295/295 στα 11 boiler+bridge suites.** (Το i18n `warnOnce` του react-i18next στο bridge test είναι προϋπάρχον noise, ΟΧΙ failure.)
- i18n: νέα keys σε el **ΚΑΙ** en (CHECK 3.8· μην αφήσεις `defaultValue` με literal).
- tsc μόνο στο τέλος, **N.17** (έλεγξε process ΠΡΩΤΑ· αν τρέχει άλλος, ΠΕΡΙΜΕΝΕ). **Αγνόησε errors άλλων agents:** `mesh-to-object3d.ts`, `bim3d-snap-bridge.ts`, `entity-world-aabb.ts`, `ProSnapToolbar.tsx`, `mep-fixture-types.ts`. Φίλτραρε: `npx tsc --noEmit 2>&1 | grep -iE "mep-boiler|boiler-|contextual-mep-boiler|useRibbonMepBoilerBridge"`.
- browser-verify το κάνει ο Giorgio.
