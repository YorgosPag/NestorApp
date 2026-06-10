# HANDOFF — Λέβητας: NOx Emission Class DONE → επόμενο: Sound Power Level L_WA (data-only)

**Ημ/νία:** 2026-06-10 · **Μοντέλο:** Opus 4.8 · **ADR:** 408 (MEP connectors & systems, Εύρος Β #2 λέβητας)

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT/PUSH:** ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ (N.(-1)). Μην `git commit`/`git push` ποτέ. Μην `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE — ΠΟΛΛΟΙ AGENTS:** Τρέχει ΠΑΡΑΛΛΗΛΑ **επιβεβαιωμένος agent στη ΘΕΡΜΑΝΣΗ** (ADR-428, `systems/mep-design/heating/**` — ο Giorgio το επιβεβαίωσε ξανά 2026-06-10). Πιθανώς ενεργοί και: ΗΛΕΚΤΡΟΛΟΓΙΚΑ, ΥΔΡΕΥΣΗ/ROUTING (`systems/mep-design/**`), THERMAL (`bim/thermal/heat-load/**`), 3D GIZMO (`bim-3d/**`), COORDINATION/CLASH (`systems/coordination/**`), PROPOSAL-GHOST refactor, WALLS, FIXTURES. **ΜΗΝ ΑΓΓΙΞΕΙΣ τίποτα από αυτά** (§5). `git add` ΜΟΝΟ δικά σου.
> ⚠️ **N.17 — ΕΝΑΣ tsc ΤΗ ΦΟΡΑ:** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος. **WMI -Filter, ΟΧΙ `$_`**:
> `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%tsc%'\" | Select-Object ProcessId, CommandLine | Format-List"`
> Αν επιστρέψει PID → τρέχει tsc άλλου agent → **ΠΕΡΙΜΕΝΕ**. Αν τίποτα → ελεύθερος.

---

## 1. ΤΙ ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτό το session) — NOx Emission Class, ΟΛΑ uncommitted (commit ο Giorgio)

**Κλάση εκπομπών NOx (NOx Emission Compliance, Revit «NOx Emission» / EU Ecodesign 813/2013).** Ο φυσικός σύντροφος του ErP: το ecodesign compliance story έχει ΔΥΟ άξονες — **energy class** (✅ ήδη: `seasonalEfficiencyPercent`→`resolveErpClass`) **και NOx emission compliance** (μόλις έγινε). Η EU Ecodesign 813/2013 βάζει νομικό όριο NOx για να πουληθεί λέβητας: **αέριο ≤ 56, πετρέλαιο ≤ 120 mg/kWh**. **Data-only, ΜΗΔΕΝ glyph**, 100% boiler-owned, **ΕΚΤΟΣ ADR-040 εντελώς**, μηδέν conflict με τον ενεργό heating agent.

**🔑 Αποφάσεις (Revit-grade, πάρθηκαν από τον agent):**
1. **NEW pure SSoT `boiler-nox.ts`** (mirror `boiler-efficiency.ts`, μηδέν renderer import): `resolveNoxClass(mgKwh, fuel)` → **verdict συμμόρφωσης** `NoxComplianceClass = 'compliant' | 'exceeds'` έναντι του per-fuel ορίου (`boilerNoxLimit`)· `null` για non-combustion (electric/heat-pump) ή absent/αρνητική τιμή. Consts `NOX_LIMIT_GAS_MG_KWH=56`, `NOX_LIMIT_OIL_MG_KWH=120`.
2. **ΓΙΑΤΙ verdict κι όχι EN-15502 1-6 κλίμακα:** το ecodesign όριο είναι ο **πραγματικός νομικός γκέιτ πώλησης**, δουλεύει ομοιόμορφα gas+oil (οι EN κλάσεις είναι gas-centric)· ο tag δείχνει τη μετρημένη τιμή ΚΑΙ το verdict → πλήρης πληροφορία.
3. **Param `noxMgKwh?: number`** (μετρημένες εκπομπές, GCV)· additive/optional· schema `z.number().positive().optional()`.
4. **Tag γραμμή 17** «NOx: 40 mg/kWh (✓/✗)» — **καταναλώνει** το `resolveNoxClass` (single gate → μηδέν dead-code CHECK 3.22)· NEW consts `NOX_UNIT='mg/kWh'` + `CROSS_GLYPH='✗'`· JSDoc 1-16→1-17.
5. **Catalog** `BoilerModelPreset += noxMgKwh?` στα combustion presets (gas 32/38/45, oil 110/115· electric/heat-pump OMITTED)· `applyBoilerModelToParams` γεμίζει· `clearBoilerModel` αφαιρεί (Type-property).
6. **UI:** «Θερμικά» panel δίπλα στο `erpClass`: editable numeric «NOx (mg/kWh)» (`NUMBER_KEY_TO_FIELD`) + read-only «NOx» compliance readout (disabled combobox, μοτίβο `erpClass`· localized «Συμμόρφωση»/«Υπέρβαση»/«—»).

**Verify:** jest **277/277** στα **10 boiler+bridge suites** (NEW `boiler-nox.test.ts` +19, `mep-boiler-tag.test.ts` +7, `boiler-model-catalog.test.ts` +4)· **tsc καθαρό στα δικά μου** (έλεγξα N.17 — δεν έτρεχε άλλος). i18n el+en ✅. N.15 docs ✅.

**ΔΙΚΑ ΜΟΥ ΑΡΧΕΙΑ — ΕΚΚΡΕΜΟΥΝ COMMIT (Giorgio· `git add` ΜΟΝΟ αυτά· ΟΛΑ ΕΚΤΟΣ ADR-040):**
- **NEW** `src/subapps/dxf-viewer/bim/mep-boilers/boiler-nox.ts`
- **NEW** `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/boiler-nox.test.ts`
- `src/subapps/dxf-viewer/bim/mep-boilers/mep-boiler-tag.ts` (γραμμή 17 + import + 2 consts)
- `src/subapps/dxf-viewer/bim/mep-boilers/boiler-model-catalog.ts` (preset field + 5 presets + apply/clear)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/mep-boiler-tag.test.ts` (+7)
- `src/subapps/dxf-viewer/bim/mep-boilers/__tests__/boiler-model-catalog.test.ts` (+4)
- `src/subapps/dxf-viewer/bim/types/mep-boiler-types.ts` (+`noxMgKwh?`)
- `src/subapps/dxf-viewer/bim/types/mep-boiler.schemas.ts` (1 optional)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-command-keys.ts` (numeric key `nox` + readout key `noxClass`)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-boiler-tab.ts` (options + 2 comboboxes)
- `src/i18n/locales/el/dxf-viewer-shell.json` · `en/dxf-viewer-shell.json` (`nox`/`noxClass`/`noxCompliant`/`noxExceeds` + tag `nox` — ⚠️ SHARED)
- `docs/.../ADR-408-mep-connectors-and-systems.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (`project_adr408_combi_boiler.md` + index)
- ⚠️ `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/mep-boiler-param-maps.ts` (1 `NUMBER_KEY_TO_FIELD` γραμμή): **SHARED** — έλεγξε `git diff` πριν το add.
- ⚠️ `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepBoilerBridge.ts` (`noxClass` readout branch + import): **SHARED** — έλεγξε `git diff` πριν το add.

> ℹ️ Στο ίδιο uncommitted batch υπάρχουν ΚΑΙ τα αρχεία του προηγούμενου slice (Filling Loop): `mep-boiler-symbol.ts`, `mep-boiler-symbol-glyphs.ts`, `mep-boiler-symbol.test.ts`. Είναι ΟΛΑ boiler-owned, δικά μας, εκκρεμούν commit μαζί.

**🔴 Εκκρεμεί browser-verify (Giorgio):** λέβητας αερίου με NOx τιμή → «Θερμικά» panel → editable «NOx (mg/kWh)» + read-only «NOx» readout («Συμμόρφωση»/«Υπέρβαση») + tag γραμμή «NOx: …».

---

## 2. ΚΑΤΑΣΤΑΣΗ ΛΕΒΗΤΑ ΣΗΜΕΡΑ (όλα DONE)

footprint · supply/return · combi DHW (hot/cold/recirc) · καπναγωγός (flue) + chevron + vent terminal · τροφοδοσία καυσίμου (fuel) + gas-cock + per-fuel διάμετροι · αποχέτευση συμπυκνωμάτων (condensate) + σιφώνι + εξουδετερωτής · connector stubs χρωματισμένα ανά System Classification · **απόδοση + ErP** · **NOx emission compliance** · τύπος καυσίμου dropdown · model catalog (7 μοντέλα) · θερμική ισχύς · διαμόρφωση/turndown · L2 sizing (ADR-422) · service clearance zone · sealed-system ΟΛΟΚΛΗΡΩΜΕΝΟ (ασφαλιστική βαλβίδα + δοχείο διαστολής + μανόμετρο + βρόχος πλήρωσης) · **2D plan tag (17 γραμμές)** · WYSIWYG placement ghost · MEP→BOQ autofeed.

**🟢 Η ΟΙΚΟΓΕΝΕΙΑ CONNECTORS ΕΙΝΑΙ ΠΛΗΡΗΣ** (8 connectors, περίμετρος ΓΕΜΑΤΗ) → κάθε νέο **φυσικό** εξάρτημα = **body glyph** στο `glyphStrokes`, ΟΧΙ connector.

**🟢 ΕΤΙΚΕΤΑ ΕΝΕΡΓΕΙΑΣ EU (Regulation 811/2013 + 813/2013):** άξονας 1 = η_s/ErP ✅ · άξονας 2 = NOx ✅ · **άξονας 3 = Στάθμη ηχητικής ισχύος L_WA ❌ (= το επόμενο βήμα §3)**.

**Μοτίβα που κυριαρχούν (FULL SSOT):**
- **Pure data SSoT modules (μηδέν renderer, ΜΗΔΕΝ glyph):** `boiler-efficiency.ts`, `boiler-nox.ts`, `boiler-modulation.ts`, `boiler-flue-terminal.ts`, `boiler-model-catalog.ts` — **πρότυπο για κάθε data-only feature** (το νέο L_WA τα μιμείται 1:1).
- **Tag = content SSoT:** `buildBoilerTagLines(params, t)` (pure, injected translator· i18n `ribbon.commands.mepBoilerTag.*` ns `dxf-viewer-shell`). Glyphs: `DIAMETER_GLYPH='Ø'`, `PERCENT_GLYPH='%'`, `MM_GLYPH='mm'`, `CHECK_GLYPH='✓'`, `CROSS_GLYPH='✗'`, `BAR_UNIT='bar'`, `LITRE_UNIT='L'`, `NOX_UNIT='mg/kWh'`, `RANGE_DASH='–'`. (kW = i18n key `kWUnit`.)
- **Readout SSoT στο bridge:** `useRibbonMepBoilerBridge.ts` → `getComboboxState` → `isMepBoilerReadoutKey` branch· `erpClass`/`noxClass` λύνονται ΠΡΙΝ τον sizing guard (εξαρτώνται από params, όχι sizing), disabled combobox.
- **UI pipeline:** `mep-boiler-command-keys.ts` (keys + guards) → `mep-boiler-param-maps.ts` (**SHARED**: `TOGGLE/NUMBER_KEY_TO_FIELD`) → `useRibbonMepBoilerBridge.ts` (get/onChange) → `contextual-mep-boiler-tab.ts` (panels). **Integer presets → plain numeric (`NUMBER_KEY_TO_FIELD`)· fractional/enum → static-enum STRING combobox (guard ΠΡΙΝ τον model picker)· read-only → readout key + bridge disabled-combobox branch.**

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ (απόφαση agent, Revit-grade) — Στάθμη Ηχητικής Ισχύος L_WA (Sound Power Level, data-only)

**🔑 Γιατί ΑΥΤΟ:** Είναι το **τρίτο και τελευταίο σκέλος της ετικέτας ενέργειας EU** που ήδη ξεκινήσαμε: η ετικέτα ενός θερμαντήρα χώρου (Reg. 811/2013) τυπώνει ΥΠΟΧΡΕΩΤΙΚΑ τρία δεδομένα — **(1) εποχιακή απόδοση η_s → ErP class** (✅), **(2) εκπομπές NOx** (✅ μόλις τώρα), **(3) στάθμη ηχητικής ισχύος εσωτερικού `L_WA` σε dB(A)** (❌ λείπει). Η Revit Mechanical Equipment κρατά «Sound» δεδομένα· το IFC `Pset_SoundAttenuation`/`Pset_BoilerTypeCommon` φέρει ηχητική στάθμη ώστε ο μελετητής να κρίνει **καταλληλότητα τοποθέτησης** (σαλόνι/υπνοδωμάτιο vs λεβητοστάσιο). **Data-only, ΜΗΔΕΝ glyph** (όπως efficiency/ErP/NOx/modulation), 100% boiler-owned, **ΜΗΔΕΝ conflict** με τον ενεργό heating agent, **ΕΚΤΟΣ ADR-040 εντελώς**. Σχήμα **ΠΑΝΟΜΟΙΟΤΥΠΟ με το NOx** που μόλις έγινε → γρήγορο, καθαρό, χαμηλού ρίσκου.

**🔑 ΑΠΟΦΑΣΕΙΣ ΓΙΑ PLAN MODE (πάρ' τες μόνος σου, Revit-grade· ζήτα μόνο έγκριση plan — feedback Giorgio «make Revit-grade decisions yourself»):**

1. **NEW pure SSoT `boiler-acoustics.ts`** (mirror `boiler-nox.ts`, μηδέν renderer import): `resolveAcousticBand(dbA: number | undefined): AcousticBand | null`. Επιστρέφει **placement-suitability band** `AcousticBand = 'quiet' | 'standard' | 'loud'` (καταλληλότητα τοποθέτησης εσωτερικού χώρου), `null` όταν absent/μη-θετική τιμή.
   - **⚠️ ΕΝΤΙΜΟΤΗΤΑ (N.HONESTY):** ΔΕΝ υπάρχει νομικό όριο θορύβου EU για λέβητες (σε αντίθεση με το NOx). Τα κατώφλια είναι **engineering-guidance UX heuristic** (όχι legal limit) — τεκμηρίωσέ το ΡΗΤΑ στο JSDoc. Προτεινόμενα consts: `ACOUSTIC_QUIET_MAX_DBA=45` (κατάλληλο για χώρους διαβίωσης/ύπνου), `ACOUSTIC_STANDARD_MAX_DBA=55` (κουζίνα/βοηθητικός/λεβητοστάσιο)· `>55` → `'loud'` (αφιερωμένο λεβητοστάσιο / ηχομονωτικό κέλυφος). Τυπικοί επίτοιχοι λέβητες αερίου ≈ 40–50 dB(A).
   - **Το pure fn ΠΡΕΠΕΙ να καταναλώνεται σε PRODUCTION** (όχι μόνο tests) για το dead-code ratchet CHECK 3.22 — το consume **το bridge readout** (§5 παρακάτω). Αυτό αρκεί.
2. **Param `soundPowerDbA?: number`** (στάθμη ηχητικής ισχύος εσωτερικού, dB(A))· absent ⇒ unspecified· additive/optional· schema `z.number().positive().optional()`.
3. **Catalog** `BoilerModelPreset += soundPowerDbA?` σε **ΟΛΑ** τα presets (ο θόρυβος αφορά κάθε τύπο — η αντλία/ανεμιστήρας/καυστήρας κάνουν θόρυβο, ΟΧΙ μόνο combustion· ≠ NOx που είναι combustion-only)· ρεαλιστικές τιμές (επίτοιχα αερίου ≈ 45–49, επιδαπέδιο πετρελαίου ≈ 55–60, αντλία θερμότητας ≈ 50–58, ηλεκτρικός ≈ 40)· `applyBoilerModelToParams` γεμίζει, `clearBoilerModel` αφαιρεί (Type-property, όπως `seasonalEfficiencyPercent`/`noxMgKwh`).
4. **Tag γραμμή 18** «Θόρυβος: 49 dB(A)» — gated by `soundPowerDbA != null` (**ΟΧΙ combustion-gated** — αφορά κάθε τύπο, όπως efficiency/ErP). NEW const `DB_UNIT='dB(A)'` non-translatable. JSDoc 1-17→1-18. (Το tag δείχνει την ΤΙΜΗ· το band φαίνεται στο readout — μην βάλεις band mark στο tag, κράτα το καθαρό· η κατανάλωση του pure fn γίνεται από το bridge readout.)
5. **UI:** read-only readout «Θόρυβος» **ΚΑΙ** editable numeric «Θόρυβος (dB(A))» στο **«Θερμικά» panel** δίπλα στο NOx readout (μοτίβο NOx 1:1: editable τιμή + read-only band readout). Numeric key `soundPower` → plain `NUMBER_KEY_TO_FIELD` (ακέραιοι dB). NEW readout key `acousticBand` (μοτίβο `noxClass` — disabled combobox από bridge· localized band label «Ήσυχος»/«Κανονικός»/«Θορυβώδης» ή «—»).
6. **i18n (N.11 — ΠΡΩΤΑ τα keys, el ΚΑΙ en):** editor `ribbon.commands.mepBoilerEditor.soundPower` + readout `ribbon.commands.mepBoilerEditor.acousticBand` + 3 band labels `ribbon.commands.mepBoilerEditor.acousticQuiet`/`acousticStandard`/`acousticLoud` + tag `ribbon.commands.mepBoilerTag.soundPower`.
7. **Tests:** NEW `boiler-acoustics.test.ts` (band boundaries 45/55, quiet/standard/loud, absent/μη-θετικό→null)· `mep-boiler-tag.test.ts` (γραμμή present ανά τιμή / absent όταν λείπει· **ΟΧΙ** combustion-gated → δείξε ότι φαίνεται και σε electric/heat-pump)· `boiler-model-catalog.test.ts` (preset apply/clear γεμίζει/αφαιρεί σε όλους τους τύπους). Μοτίβο NOx.

**Αναμενόμενα αρχεία (~13, 100% boiler-owned, ΕΚΤΟΣ ADR-040):** NEW `boiler-acoustics.ts` + test · `mep-boiler-types.ts` (+`soundPowerDbA?`) · `mep-boiler.schemas.ts` (1 optional) · `mep-boiler-tag.ts` (γραμμή 18 + import + `DB_UNIT`) · `boiler-model-catalog.ts` (preset field + values σε ΟΛΑ + apply/clear) · `mep-boiler-command-keys.ts` (numeric key `soundPower` + readout key `acousticBand`) · `mep-boiler-param-maps.ts` (1 `NUMBER_KEY_TO_FIELD` γραμμή· **SHARED**) · `useRibbonMepBoilerBridge.ts` (`acousticBand` readout branch· **SHARED**) · `contextual-mep-boiler-tab.ts` («Θερμικά» panel + numeric + readout) · i18n el+en · 3 test files.

**ADR-040:** **ΕΚΤΟΣ** (data-only, μηδέν drawing edit). ΜΗΝ adr-index (shared tree).

### Εναλλακτική (αν Giorgio θέλει φυσικό/geometry αντί data-only)
- **MepBoilerKind `floor-boiler` (επιδαπέδιος λέβητας)** — Revit «Floor-Standing Boiler» family. NEW kind στο `MepBoilerKind` union + βάση/plinth glyph + geometry defaults (μεγαλύτερο σώμα, χωρίς mounting elevation). **Κράτα το 2D-only** (footprint + plinth glyph + defaults) και **DEFER το 3D** ώστε να ΜΗΝ αγγίξεις `bim-3d/converters/mesh-to-object3d.ts` (gizmo agent). Αγγίζει το 2D symbol → **ADR-040 STAGE (CHECK 6B/6D)** — πρέπει να κάνεις stage το ADR-040 μαζί. Πάλι 100% boiler-owned, αλλά μεγαλύτερο scope + ADR-040 touch.
- **Boiler 2D grips / 3D stubs** — DEFER: shared grip/gizmo + 3D converter infra (gizmo agent ενεργός, §5).

---

## 4. DEFERRED (ΜΗΝ τα πιάσεις — conflict με ενεργούς agents)
- **Design flow/return θερμοκρασίες** (`designFlowTempC`/`designReturnTempC`) — input του ενεργού heating agent· περίμενε να ελευθερωθεί το `systems/mep-design/heating`.
- **Flue/fuel/condensate/NOx 3D stub** — shared 3D converter (`bim-3d/converters/mesh-to-object3d.ts`, gizmo agent).
- **Fuel color στο `mep-system-color.ts`** — shared + contended (READ-ONLY import μόνο).
- **Boiler 2D grips** — shared grip/gizmo infra (gizmo agent).
- **Condensate/fuel-network auto-design** — routing (`systems/mep-design/routing/**`).
- **ADR-422 L8 primary-energy ΚΕΝΑΚ wiring** — `bim/thermal/heat-load/**`, thermal agent (boiler-side efficiency + NOx + modulation SSoT ΗΔΗ έτοιμα).

## 5. ΑΡΧΕΙΑ ΑΛΛΩΝ AGENTS — ΜΗΝ ΑΓΓΙΞΕΙΣ
- **ΘΕΡΜΑΝΣΗ (ADR-428):** `systems/mep-design/heating/**` — **ΕΝΕΡΓΟΣ agent (επιβεβαιωμένο Giorgio 2026-06-10)**
- **THERMAL STUDY (ADR-422):** `bim/thermal/heat-load/**`
- **ΗΛΕΚΤΡΟΛΟΓΙΚΑ (ADR-430/431):** `bim/types/mep-connector-types.ts`· `electrical-*`· `electrical-proposal-store.ts`
- **COORDINATION/CLASH (ADR-435):** `systems/coordination/**` (π.χ. `entity-world-aabb.ts`)
- **3D GIZMO / SNAP:** `bim-3d/**` (π.χ. `mesh-to-object3d.ts`, `bim3d-snap-bridge.ts`, `ProSnapToolbar.tsx` — tsc errors δικά τους)
- **PROPOSAL GHOST REFACTOR (ενεργό):** `components/dxf-layout/canvas-layer-stack-*-proposal-ghost.tsx`, `ProposalGhostOverlay.tsx`, `bim-3d/proposal/` — άλλου agent
- **MEP COLOR (shared, contended):** `bim/mep-systems/mep-system-color.ts` — READ-ONLY import μόνο
- **ΥΔΡΕΥΣΗ/ROUTING (ADR-426/429):** `systems/mep-design/water/**`, `systems/mep-design/routing/**`
- **FIXTURES (shared):** `bim/types/mep-fixture-types.ts` · **WALLS:** `bim/walls/opening-grips.ts`
- ⚠️ **SHARED boiler UI (contended):** `useRibbonMepBoilerBridge.ts` + `mep-boiler-param-maps.ts` — άγγιξέ τα ΜΟΝΟ για τις 2 additive γραμμές (acousticBand readout branch + 1 NUMBER γραμμή), έλεγξε `git diff` πρώτα.

## 6. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio: «όπως οι μεγάλοι, σαν Revit, FULL ENTERPRISE + FULL SSOT»)
- **N.0.1 ADR-driven:** Recognition (διάβασε ΚΩΔΙΚΑ πρώτα: `boiler-nox.ts` [το ΑΚΡΙΒΕΣ πρότυπο — pure verdict fn], `boiler-efficiency.ts`, `mep-boiler-tag.ts` [line gating 1-17· import· consts], `mep-boiler-command-keys.ts` [numeric key + readout key union+array+set], `mep-boiler-param-maps.ts` [NUMBER_KEY_TO_FIELD], `useRibbonMepBoilerBridge.ts` [`noxClass`/`erpClass` readout branch — το ΑΚΡΙΒΕΣ μοτίβο για `acousticBand`], `contextual-mep-boiler-tab.ts` [«Θερμικά» panel: NOx editable + noxClass readout], `boiler-model-catalog.ts` [preset field + apply/clear]) → **Plan Mode** → **έγκριση Giorgio** → Implement → ADR/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY update → (commit Giorgio).
- **N.14 model:** L_WA (data-only, 1 domain, pure fn + tag + numeric/readout UI, μηδέν glyph) → **Sonnet αρκεί** (σχεδόν πανομοιότυπο με NOx)· Opus αν θες extra ασφάλεια. Δήλωσε μοντέλο, πάρε «ok».
- **N.11 i18n:** ΠΡΩΤΑ τα keys σε el **ΚΑΙ** en· καμία hardcoded string· καμία `any` (N.2)· κανένα `as any`/`@ts-ignore`.
- **N.15:** μετά την υλοποίηση ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog + MEMORY (`project_adr408_combi_boiler.md` + index). **ΜΗΝ** adr-index (shared tree). ΕΚΤΟΣ ADR-040.
- **COMMIT/PUSH ΠΟΤΕ εσύ (N.(-1)).** `git add` ΜΟΝΟ δικά σου· `git status`/`git diff` πριν.

## 7. VERIFY ΠΡΩΤΟΚΟΛΛΟ
- jest boiler suites: `npx jest src/subapps/dxf-viewer/bim/mep-boilers/__tests__/ src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonMepBoilerBridge.test.tsx`. **Baseline μετά το NOx: 277/277 στα 10 boiler+bridge suites.** (Το i18n `warnOnce` του react-i18next στο bridge test είναι προϋπάρχον noise, ΟΧΙ failure.)
- i18n: νέα keys σε el **ΚΑΙ** en (CHECK 3.8· μην αφήσεις `defaultValue` με literal).
- tsc μόνο στο τέλος, **N.17** (έλεγξε process ΠΡΩΤΑ· αν τρέχει άλλος, ΠΕΡΙΜΕΝΕ). **Αγνόησε errors άλλων agents:** `mesh-to-object3d.ts`, `bim3d-snap-bridge.ts`, `entity-world-aabb.ts`, `ProSnapToolbar.tsx`, `mep-fixture-types.ts`. Φίλτραρε: `npx tsc --noEmit 2>&1 | grep -iE "boiler-acoustics|mep-boiler|boiler-model|contextual-mep-boiler|useRibbonMepBoilerBridge"`.
- browser-verify το κάνει ο Giorgio: λέβητας → «Θερμικά» panel → editable «Θόρυβος (dB(A))» + read-only «Θόρυβος» band readout + tag γραμμή «Θόρυβος: …». Δείξε ότι φαίνεται και σε ηλεκτρικό/αντλία (όχι combustion-gated).
