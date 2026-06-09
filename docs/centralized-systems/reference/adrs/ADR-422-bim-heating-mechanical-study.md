# ADR-422 — BIM Μηχανολογική Μελέτη Θέρμανσης (ΤΟΤΕΕ/ΚΕΝΑΚ)

**Status:** 🟡 IN PROGRESS — L0→L7.3 IMPLEMENTED (L7.3 per-space συντελεστής σκίασης υαλοπινάκων EN ISO 13790 §11.4.3 / ΤΟΤΕΕ 20701-1, 49/49 tests· pending browser-verify + commit)
**Date:** 2026-06-08
**Owner:** Giorgio (YorgosPag)
**Πρότυπο (κλειδωμένο):** Ελληνικό **ΤΟΤΕΕ/ΚΕΝΑΚ** — ΤΟΤΕΕ 20701-1 (υπολογισμοί / θερμοκρασίες σχεδιασμού), ΤΟΤΕΕ 20701-3 (κλιματικά δεδομένα), με βάση **EN 12831**.
**Εντολή Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (Revit/4M-FineHEAT) — FULL ENTERPRISE + FULL SSOT. ΠΛΗΡΗΣ ΣΥΜΜΟΡΦΩΣΗ ΜΕ ΤΟΥΣ ΕΛΛΗΝΙΚΟΥΣ ΚΑΝΟΝΙΣΜΟΥΣ.»

---

## 1. Context

Πλήρης μηχανολογική μελέτη κεντρικής θέρμανσης «σαν Revit/4M-FineHEAT», χτισμένη **ΠΑΝΩ** στο υπάρχον BIM (ADR-408 MEP entities) + θερμικό κέλυφος (ADR-396). Παράγει ανά χώρο/σύστημα:
1. **Θερμικό φορτίο** (W) — απώλειες αγωγής + αερισμού/διείσδυσης (+ θερμογέφυρες/reheat).
2. **Διαστασιολόγηση** — ισχύς σωμάτων (W) + διάμετρος σωλήνων ανά κλάδο.
3. **Υδραυλική εξισορρόπηση** — παροχές, πτώσεις πίεσης, index circuit, preset βαλβίδων.

### Recognition (code = source of truth, 2026-06-08)

**Υπάρχον θεμέλιο (reuse, μην fork):**
- **U-value math** — `bim/thermal/assembly-u-value.ts` (`computeAssemblyUValue`, ISO 6946) + `SURFACE_RESISTANCES_BY_FLOW` (wall/roof/floor). `bim/thermal/wall-assembly-thermal.ts` → `computeWallTypeUValue(dna)` per wall-type, on-demand.
- **ΚΕΝΑΚ config** — `bim/thermal/kenak-thermal-config.ts`: ζώνες A/B/C/D (ΤΟΤΕΕ 20701-3) + `KENAK_MAX_U_WALL`. ⚠️ **Δεν υπάρχει design outdoor temp (Te) ανά ζώνη** → προστίθεται στο L1.
- **MEP entities** — `mep-radiator` (ήδη `thermalOutputW?`), `mep-boiler`, `mep-segment` (`diameter`/`classification`), `mep-manifold` (`outletCount`), `mep-underfloor`. Δίκτυο = `MepSystem` + auto-fittings.
- **Envelope graph** — `bim/geometry/envelope-perimeter.ts` / `envelope-wall-graph.ts` → per-region `chain.wallIds` + exterior face loop. `bim/walls/perimeter-from-faces.ts` → click-in-region SSoT (ADR-419).
- **Openings** — `OpeningGeometry.area` (m²). ⚠️ Δεν υπάρχει per-opening glazing U (Ug) — προστίθεται στο L1.
- **Schedule/PDF** — `bim/schedule/*` (`BimScheduleDialog`, `SchedulePreviewTable`, `scheduleToPdfBlob` + `registerGreekFont`).

**Κρίσιμο κενό:** Δεν υπάρχει «θερμικός χώρος» (Space/Room με όγκο/χρήση/setpoint/ACH). Το `FloorFinish` (IfcCovering) είναι θερμικά αδρανές. → το L0 το καλύπτει.

---

## 2. Αποφάσεις (Giorgio approved, 2026-06-08)

| # | Απόφαση | Τεκμηρίωση |
|---|---------|-----------|
| **D1** | **Θερμικός χώρος = νέο entity `thermal-space` (IfcSpace)**, ΟΧΙ FloorFinish. Footprint **auto-derive** από κλειστό βρόχο τοίχων (Revit «Place Space»), snapshot. `useType` = το `kind`. | Revit ξεχωρίζει Room (αρχιτεκτονικό) από Space (αναλυτικό HVAC, IfcSpace). FloorFinish=IfcCovering → λάθος semantics για HVAC δεδομένα. |
| **D2** | **Defaults Ti/ACH ανά χρήση = config SSoT** (ΤΟΤΕΕ 20701-1)· per-space override. | Revit «type default, instance override». |
| **D3** | **Te (design outdoor temp) ανά κλιματική ζώνη** → προσθήκη στο `kenak-thermal-config` (L1). | ΤΟΤΕΕ 20701-3. |
| **D4** | **ΔΤ συστήματος = multi-preset SSoT** (80/60, 70/55, 45/35 ενδοδαπέδια)· nominal σώματος @ ΔΤ=50K + exponent correction (LMTD). | Revit «System Type temperatures»· ΤΟΤΕΕ exponent n. |
| **D5** | **Pipe sizing = velocity + friction (R Pa/m)** συνδυασμένο. | Revit «Velocity and Friction». |
| **D6** | **Hydraulic balancing = Darcy-Weisbach + τοπικές αντιστάσεις → index circuit → preset βαλβίδων.** | EN 12831 / 4M-FineHEAT. |

---

## 3. Αρχιτεκτονική (5 στρώματα)

| L | Τι | SSoT engines (pure) |
|---|---|---|
| **L0** | Θερμικός χώρος (IfcSpace) + click-in-region «Place Space» + contextual tab | `thermal-space-types`, `thermal-space-use-catalog` |
| **L1** | Heat-load engine: Φ = Σ U·A·ΔΤ·f + 0.34·n·V·ΔΤ (+ θερμογέφυρες/reheat). ΔΤ = Ti − Te(ζώνη). | `bim/thermal/heat-load/*` (+ Te config, opening Ug) |
| **L2** | Radiator sizing: Φ_room → ισχύς, LMTD/exponent. Γράφει `mep-radiator.params` (derived cache). | `bim/thermal/sizing/radiator-sizing` |
| **L3** | Pipe sizing: m = Φ/(c·ΔΤ) → DN από velocity+R. Γράφει `mep-segment.params.diameter`. | `bim/thermal/sizing/pipe-sizing` |
| **L4** | Hydraulic balancing: Darcy + τοπικές αντιστάσεις → index circuit → valve presets. | `bim/thermal/balancing/*` |
| **Report** | Πίνακας μελέτης ανά χώρο/σύστημα + PDF (reuse schedule + Greek font). | `bim/schedule/*` reuse |

**Execution:** στρώμα-στρώμα με Plan Mode (Giorgio), per-layer verify + commit.

---

## 4. Changelog

### L0 — Θερμικός Χώρος (2026-06-08, Opus, Plan Mode)

**Νέα οντότητα `thermal-space` (IfcSpace), area-based mirror του floor-finish. FULL SSOT — μηδέν fork.**

- **Νέα αρχεία:**
  - `bim/types/thermal-space-types.ts` — params/geometry/entity + `computeThermalSpaceGeometry` (area/perimeter/**volume** = εμβαδό × ύψος).
  - `bim/thermal/thermal-space-use-catalog.ts` — ΤΟΤΕΕ 20701-1 config SSoT (useType → setpoint Ti + ACH) + `resolveThermalSpaceSetpointC`/`resolveThermalSpaceAch`/`listThermalSpaceUseTypes`.
  - `services/factories/thermal-space.factory.ts` (`createThermalSpace`, ifcType=IfcSpace, prefix `tsp`).
  - `bim/thermal-spaces/thermal-space-firestore-service.ts` (doc↔entity, ADR-420 floor-scope).
  - `hooks/data/useThermalSpacePersistence.ts` + `app/ThermalSpacePersistenceHost.tsx` (subscribe/diff-merge/first-save/auto-save/delete· **χωρίς 3D feed**).
  - `hooks/drawing/thermal-space-completion.ts` + `hooks/drawing/useThermalSpaceTool.ts` — **click-in-region** «Place Space» (reuse `getCachedRegionPerimeters`+`pickSmallestContainingPerimeter`+`isPerimeterOversized`+`findOpenChainLineIdsNear`).
  - `bim/renderers/ThermalSpaceRenderer.ts` — 2D fill + dashed outline + space tag (όνομα/εμβαδό/Ti).
  - `core/commands/entity-commands/UpdateThermalSpaceParamsCommand.ts`.
  - `ui/ribbon/data/contextual-thermal-space-tab.ts` + `ui/ribbon/hooks/bridge/thermal-space-command-keys.ts` + `ui/ribbon/hooks/useRibbonThermalSpaceBridge.ts` (useType/setpoint/ACH/height + close/delete).
- **Σημεία εγγραφής (mirror floor-finish):** `bim-base` (BimElementType), `types/entities` (DxfEntityUnion/AnySceneEntity/guards/isBimEntity), `dxf-types` (DxfThermalSpace), `bim-object-styles` (BimCategory+pen), `bim-subcategories`, `bim-discipline`, enterprise-id (prefix `tsp`), `dxf-scene-entity-converter` (CRITICAL case), `EntityRendererComposite`, `dxf-renderer-entity-model`, `bim-bounds`, `bim-entity-points`, `DeleteEntityCommand`, `drawing-types` (DrawingTool), `useSpecialTools`, `useCanvasClickHandler`/`canvas-click-types`, `CanvasSection`, `ribbon-contextual-config`, `useDxfBimBridges`/`useDxfViewerRibbon`/`useRibbonCommands`, `home-tab-draw`, `firestore-collections` (+FLOOR_SCOPED), `firestore.rules`, `firestore.indexes.json` (4), `drawing-event-map`, `DxfViewerTopBar`, i18n el+en.
- **Αναβλήθηκαν (τεκμηριωμένα):** grips (wall-bound boundary), 3D mesh (2D analytical overlay), IFC export serializer + BOQ atoe, independent move.
- **ΕΚΤΟΣ ADR-040** (κανένα high-freq store· renderer micro-leaf-compliant).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L1 — Heat-Load Engine + Analytical UI (2026-06-08, Opus, Plan Mode)

**Υπολογισμός θερμικού φορτίου Φ ανά χώρο (EN 12831 / ΤΟΤΕΕ 20701-1) + Revit «Heating Loads» analytical view. FULL SSOT — μηδέν fork.**

- **Pure engine (full unit-tested):**
  - `bim/thermal/heat-load/heat-load-engine.ts` — `computeSpaceHeatLoad` → Φ = Σ U·A·b·ΔΤ + 0.34·n·V·ΔΤ + breakdown.
  - `bim/thermal/heat-load/heat-load-types.ts` — resolved contracts (`SpaceHeatLoadInput`/`Result`/`HeatLoadBoundary`).
  - `bim/thermal/heat-load/heat-load-config.ts` — `BOUNDARY_TEMPERATURE_FACTOR` (b) + `AIR_VENTILATION_FACTOR` (0.34) + default U.
  - `bim/thermal/heat-load/space-boundary-resolver.ts` — scene → boundaries (εξωτ./adjacent από envelope shell + storey position).
  - `bim/thermal/heat-load/wall-footprint-match.ts` — όριο χώρου → όψεις τοίχων (per-room share κοινών τοίχων).
  - `bim/thermal/heat-load/derive-space-heat-loads.ts` — orchestration: `computeOneSpaceHeatLoad` + `deriveSpaceHeatLoads` (Map + εύρος W/m² + άθροισμα).
  - `bim/thermal/heat-load/heat-load-color.ts` — heat-map κλίμακα (μπλε→κόκκινο, σχετική στο εύρος ορόφου).
  - `bim/thermal/glazing-u-catalog.ts` — per-opening `Ug` (μονό/διπλό/τριπλό + instance override).
  - `kenak-thermal-config.ts` (MOD) — `KENAK_DESIGN_OUTDOOR_TEMP_C` (Te ανά ζώνη Α/Β/Γ/Δ) + `getDesignOutdoorTempC`.
- **Wiring (React):**
  - `hooks/data/useHeatLoadInputs.ts` — SSoT συλλογής active-floor inputs (spaces/walls/openings + exterior walls spec-free `computeEnvelopePerimeter` + Te από `Building.climateZone` + storeyPosition από `useFloorsByBuilding`). Κοινό overlay **και** tab.
  - `hooks/data/useSpaceHeatLoads.ts` — reactive wrapper (memo στα inputs, ΟΧΙ στο transform).
- **Analytical UI:**
  - `components/dxf-layout/HeatLoadOverlay.tsx` — ADR-040 leaf· heat-map fill + «Φ … W»/«… W/m²» label ανά χώρο· gated `showHeatLoad && mode==='2d'`. **STAGE ADR-040** (mount στο `CanvasLayerStack`, CHECK 6B/6D).
  - `ui/ribbon/components/ShowHeatLoadToggle.tsx` + view-tab widget `show-heat-load-toggle` + `RibbonPanel` case (default OFF).
  - `bim-render-settings-types.ts` + `bim-render-settings-store.ts` (MOD) — `showHeatLoad` per-view flag (Firestore-persisted, default false).
  - Per-space readout: panel «Θερμικό Φορτίο» στο `contextual-thermal-space-tab.ts` (2 disabled comboboxes Φ/W·W/m²) + `thermal-space-command-keys.ts` (readout keys) + `useRibbonThermalSpaceBridge.ts` (compute via `useSpaceHeatLoads`).
  - i18n el+en (`ribbon.commands.heatLoad.*`, `panels.thermalSpaceHeatLoad`, `thermalSpaceEditor.heatLoad*`).
- **Tests:** engine (11) + color (8) + derive (6 — storey branches + aggregation) = **25/25 PASS**.
- **Αναβλήθηκαν:** θερμογέφυρες/reheat· columns-bridge στο exterior-wall detection· full wall-matching geometry test (in-browser verify). → L2 radiator sizing.

### L2 — Equipment Sizing: Διαστασιολόγηση Λέβητα έναντι Φορτίου (2026-06-08, Opus, Plan Mode + 1 subagent)

**Ο λέβητας (`mep-boiler`) συνδέεται με το heat-load engine — Revit «Heating Loads → Equipment».** Read-only readout στο contextual tab: **Απαιτούμενη ισχύς** (από ΣΦ των χώρων που εξυπηρετεί × pickup) vs **Εγκατεστημένη** (`thermalOutputW`) + **δείκτης επάρκειας**. FULL SSOT, ΕΚΤΟΣ ADR-040 (ribbon-level, low-freq). jest **66/66** (27 pure + 15 bridge [+4 readout] + heat-load regression· tsc: βλ. session note· 🔴 browser verify + commit).

- **Αρχιτεκτονική (Revit-true):** ο λέβητας διαστασιολογείται έναντι του **δικτύου που εξυπηρετεί** (network-aware), όχι όλου του ορόφου. Walk: `resolveManagedSystems([boiler])` → member entityIds → τερματικοί (καλοριφέρ position / ενδοδαπέδια centroid) → `pointInPolygon` στα space footprints → ΣΦ αυτών. **Fallback floor-total** όταν δεν υπάρχει δίκτυο (μόλις τοποθετήθηκε). Pickup factor 1.15.
- **Νέα pure SSoT (generic, reuse για θερμοσίφωνα/αντλία θερμότητας):**
  - `bim/thermal/heating-equipment-sizing.ts` — `computeHeatingEquipmentSizing` → `{ requiredWithMarginW, installedW, status: ok|undersized|oversized|unknown, ratio }`· `DEFAULT_PICKUP_FACTOR=1.15`, `OVERSIZE_RATIO=1.5`.
  - `bim/thermal/resolve-source-served-spaces.ts` — `resolveSourceServedSpaces` (source→δίκτυο→τερματικοί→χώροι) + `sumServedHeatLoadW`. Reuse `resolveManagedSystems` + `pointInPolygon` + `polygonCentroid` (ADR-425).
- **UI wiring (mirror του L1 space readout):** `mep-boiler-command-keys.ts` (+`readouts`/`isMepBoilerReadoutKey`) · `contextual-mep-boiler-tab.ts` (νέο panel «Διαστασιολόγηση», 3 disabled comboboxes) · `useRibbonMepBoilerBridge.ts` (`useSpaceHeatLoads` + sizing `useMemo` + readout branch· status label `ribbon.commands.mepBoilerEditor.sizingStatus.*`) · `useRibbonCommands.ts` (route readouts στον boiler bridge) · i18n el+en.
- **Tests:** `heating-equipment-sizing` (17) + `resolve-source-served-spaces` (10) + EXT `useRibbonMepBoilerBridge` (+4 readout) = **66/66 PASS**.
- **ΜΑΘΗΜΑ:** equipment sizing = network-aware served load (όχι floor-blanket)· το read-only readout pattern (disabled combobox μέσω bridge) γενικεύεται από το L1 space readout· status labels υπό υπαρκτό i18n path (`ribbon.commands.mepBoilerEditor.*`, ΟΧΙ ανύπαρκτο root `mepBoiler.*`).
- **Next:** L2 radiator sizing (per-terminal output vs per-space Φ)· θερμοσίφωνας DHW sizing (reuse `computeHeatingEquipmentSizing`).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L2 — Radiator Sizing: Απαιτούμενη Ονομαστική Ισχύς Σώματος (2026-06-08, Opus, Plan Mode)

**Το canonical L2 του roadmap (per-terminal).** Παίρνει το Φ_room του L1 και διαστασιολογεί το **θερμαντικό σώμα** κάθε χώρου κατά **EN 442** — Revit «Heating Loads → equipment sizing» / 4M-FineHEAT. Read-only readout στο contextual tab του καλοριφέρ: **Απαιτούμενη ονομαστική ισχύς** @ΔΤ50K + **παράγοντας διόρθωσης** + **επάρκεια** vs κατάλογο. Διακριτό από το boiler equipment-sizing entry παραπάνω (εκεί = source adequacy· εδώ = per-terminal nominal-output correction). FULL SSOT, **ΕΚΤΟΣ ADR-040** (pure engine + ribbon readout, μηδέν canvas). jest **16/16**.

- **Πυρήνας (D4):** `ΔΤ_actual = (Tsupply+Treturn)/2 − Ti` (**AMTD**, σύμβαση EN 442)· `correctionFactor = (50/ΔΤ_actual)^n` (`n=1.30` panel)· `requiredNominalW = Φ_share · factor`. Worked: 75/65/20 & 80/60/20 → factor 1.0· 70/55/20 → ≈1.23· 45/35/20 → ≈3.29.
- **Αποφάσεις (Revit-grade, locked):**
  - **ΔΤ regime storage** = **per-radiator optional override** `MepRadiatorParams.systemRegimePreset` + config default. *Γιατί:* τα MepSystems εδώ είναι derived/transient (`mep-pipe-network-derive`), όχι persisted με editable params → το καλοριφέρ (persisted SSoT element) είναι το σωστό σημείο· Revit per-element override· μηδέν νέο persistence/command/store/rules (τα rules ελέγχουν μόνο την ύπαρξη του `params` key). *Future:* building/System-Type-level default.
  - **default regime** = `75/65` (ουδέτερο: AMTD@Ti20=50 → factor 1.0). Presets 80/60·75/65·70/55·45/35.
  - **assignment** = `pointInPolygon` (`position` ∈ `footprint`)· N σώματα/χώρο → ισοκατανομή Φ_room/N.
  - **sized result** = **TRANSIENT read-model** (mirror L1)· `requiredNominalW`/factor/adequacy **derived, ΠΟΤΕ persisted** (≠ `thermalOutputW` κατάλογος).
- **Νέα pure SSoT:**
  - `bim/thermal/sizing/radiator-sizing-config.ts` — `DELTA_T_NOMINAL_K=50`, `DEFAULT_RADIATOR_EXPONENT=1.30`, `SYSTEM_REGIME_PRESETS` + `resolveSystemRegime`.
  - `bim/thermal/sizing/radiator-sizing.ts` — `computeRequiredRadiatorOutput` (EN 442, guard ΔΤ≤0).
  - `bim/thermal/sizing/space-radiator-assignment.ts` — `assignRadiatorsToSpaces` (reuse `pointInPolygon`).
  - `hooks/data/useRadiatorSizing.ts` — reactive read-model (reuse `useSpaceHeatLoads` + assignment + engine).
- **UI wiring (mirror L1 space readout):** `mep-radiator-command-keys.ts` (+`stringParams.systemRegime`/`readouts`/guards) · `contextual-mep-radiator-tab.ts` (νέο panel «Διαστασιολόγηση»: regime selector + 3 disabled readouts) · `useRibbonMepRadiatorBridge.ts` (`useRadiatorSizing` + regime write + readout branch) · `mep-radiator-types.ts` (+`systemRegimePreset?`) · i18n el+en.
- **Tests:** `radiator-sizing` (10) + `space-radiator-assignment` (6) = **16/16 PASS**.
- **ΜΑΘΗΜΑ:** regime ζει στο persisted terminal όταν το System είναι transient· per-terminal sizing = Φ_room/N ισοκατανομή· derived output ΠΟΤΕ persisted (re-derive @load, mirror L1).
- **Next:** L3 pipe sizing (m=Φ/(c·ΔΤ)→DN).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L3 — Pipe Sizing: Διαστασιολόγηση Σωληνώσεων (velocity + friction / D5) (2026-06-09, Opus, Plan Mode)

**Παίρνει ΥΠΑΡΧΟΝ δίκτυο θέρμανσης (σωλήνες + καλοριφέρ + πηγή) και προτείνει DN ανά τμήμα** — Revit «Pipe Sizing» / 4M-FineHEAT. Η αθροιστική παροχή κατάντη → επιλογή διαμέτρου ώστε `v ≤ v_max ∧ R ≤ R_max`· **οι διάμετροι μικραίνουν προς τα τερματικά**. FULL SSOT — καταναλώνει τοπολογία (`derivePipeNetworks`), per-terminal φορτίο (`useRadiatorSizing` L2), regime (`resolveSystemRegime` L2). **L3a (engine) ΕΚΤΟΣ ADR-040· L3b overlay ΕΝΤΟΣ** (mount στο `CanvasLayerStack`, STAGE ADR-040). jest **19/19**, tsc 0.

- **Πυρήνας (D5):** `ṁ = Φ/(c·ΔΤ)` (kg/s) → `Q = ṁ/ρ` (m³/s) → `v = Q/A`, `R = f·ρ·v²/(2·d)` (Darcy–Weisbach, f=Blasius `0.316/Re^0.25` / laminar `64/Re`). c=4187, ρ=977.8, μ=4.04e-4 @~70°C (config SSoT).
- **Αποφάσεις (Revit-grade, locked):**
  - **conserved quantity = ΜΑΖΙΚΗ ΠΑΡΟΧΗ (kg/s), όχι W** — φυσικά σωστό (διατήρηση μάζας στους κόμβους) ΚΑΙ χειρίζεται μικτά per-radiator regimes χωρίς network-regime resolver (κάθε σώμα συνεισφέρει `ṁ_i = Φ_share_i/(c·ΔΤ_i)`).
  - **ΔΤ_pipe = `supplyC − returnC`** (regime), ΟΧΙ το AMTD/«50/ΔΤ» του L2 (διαφορετικό concept: L2=ισχύς σώματος, L3=παροχή).
  - **network walk = ΔΕΝΤΡΟ** — τα τερματικά ΔΕΝ είναι segments, ώστε ο κλάδος προσαγωγής και ο κλάδος επιστροφής βγαίνουν ΞΕΧΩΡΙΣΤΑ δέντρα (γέφυρα μόνο μέσω σώματος) → post-order subtree sum, χωρίς loop solver (back-edge → flag + v1 fallback).
  - **ρίζα = κόμβος κοντά σε connector πηγής** (boiler/manifold)· fallback ντετερμινιστικός (μικρότερος node index).
  - **DN ladder κρατά εξωτ.+εσωτ. διάμετρο** — `params.diameter` = ΕΞΩΤΕΡΙΚΗ (γράφεται στο apply)· v/R από ΕΣΩΤΕΡΙΚΗ.
  - **πρόταση = derived (overlay)· apply = explicit command** (μηδέν σιωπηλό persist). Pluggable `PipeSizingStandard` (mirror `water-sizing.ts`).
- **Νέα pure SSoT:** `bim/thermal/sizing/pipe-sizing-config.ts` (c/ρ/μ/ladder/όρια) · `pipe-sizing.ts` (mass/volume flow + velocity + friction) · `velocity-friction-standard.ts` (`diameterForFlow` με v/R guards + saturated) · `pipe-network-sizing.ts` (`sizePipeNetwork` graph+root+subtree walk) · `hooks/data/usePipeSizing.ts` (reactive read-model, reuse `useRadiatorSizing`).
- **UI (L3b — visualization):** `state/pipe-sizing-view-store.ts` (transient flag, ΟΧΙ persisted — analysis mode) · `components/dxf-layout/PipeSizingOverlay.tsx` (badge DN+ταχύτητα ανά σωλήνα, mirror `HeatLoadOverlay`, STAGE ADR-040) · `ui/ribbon/components/ShowPipeSizingToggle.tsx` + `view-tab-bim-settings.ts` (`PIPE_SIZING_BUTTON`) + `RibbonPanel.tsx` dispatch · i18n el+en (`ribbon.commands.pipeSizing.*`).
- **Tests:** `pipe-sizing` (engine+standard) + `pipe-network-sizing` (δέντρο walk: κορμός=Σκλάδων, source re-root, monotonic DN, empty) = **19/19 PASS**.
- **ΜΑΘΗΜΑ:** σε δίκτυο όπου τα τερματικά δεν είναι segments, η topology βγάζει supply/return ΞΕΧΩΡΙΣΤΑ δέντρα → ο walk είναι απλό subtree-sum (όχι loop solver)· conserve mass (kg/s) όχι ισχύ (W) για να αθροίζονται σωστά μικτά ΔΤ.
- **🔴 PENDING (επόμενο slice):** **Apply command** — ribbon action «Εφαρμογή Διαστασιολόγησης» → `CompoundCommand` από `UpdateMepSegmentParamsCommand` (γράφει `diameter=outerMm`, ένα undo). Mirror `useRibbonWaterAutoSupplyBridge`. **Αναβλήθηκε για αποφυγή concurrent edit στο shared `useRibbonCommands.ts`** (ο παράλληλος boiler agent το επεξεργάζεται).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L4 — Hydraulic Balancing: Index Circuit + Balancing Valves (Darcy / D6) (2026-06-09, Opus, Plan Mode)

**Παίρνει το ΔΙΑΣΤΑΣΙΟΛΟΓΗΜΕΝΟ δίκτυο του L3 (DN/R/v ανά σωλήνα + παροχή ανά σώμα) και υπολογίζει υδραυλική εξισορρόπηση** — Revit «System Inspector» / 4M-FineHEAT «balancing schedule». Πτώση πίεσης ανά τμήμα `ΔP = R·L + Σζ·(ρ·v²/2)` → πτώση κυκλώματος ανά τερματικό → **index circuit** (δυσμενέστερο, ορίζει το μανομετρικό κυκλοφορητή) → απαιτ. **kv balancing valve** ανά σώμα ώστε η υπερβάλλουσα πίεση να στραγγαλίζεται. FULL SSOT — **extract** των graph helpers του L3 σε κοινό module (μηδέν topology fork). **L4 engine ΕΚΤΟΣ ADR-040· overlay ΕΝΤΟΣ** (mount στο `CanvasLayerStack`, STAGE ADR-040). jest **22/22** (+19 L3 regression μετά το extract), tsc 0.

- **Πυρήνας (D6):** `ΔP_seg = R·L + ζ·(ρ·v²/2)` (Darcy friction + τοπικές αντιστάσεις). Cumulative drop κατεβαίνοντας το δέντρο (ρίζα→κόμβος)· `ΔP_circuit` = Σ paths ΟΛΩΝ των components που αγγίζουν οι connectors του σώματος (connector-agnostic: supply + return) + ονομαστική πτώση σώματος. `pumpHead = ΔP_index · safety`. `surplus = pumpHead − ΔP_circuit` → `kv = Q[m³/h]/√(ΔP[bar])`.
- **Αποφάσεις (Revit-grade, locked):**
  - **τοπικές αντιστάσεις = TOPOLOGY-DERIVED (D-A opt A)** — ζ από τον βαθμό του junction (degree ≤1=straight ζ=0· 2=elbow ζ=0.5· ≥3=tee ζ=1.0)· μηδέν εξάρτηση από `mep-fitting` entities (που μπορεί να λείπουν). Pluggable: entity-driven resolver μπαίνει πίσω από το ίδιο config σχήμα. Το local loss αποδίδεται ανά tree-edge με ζ του **parent junction**, v του ίδιου segment → path-summable.
  - **path-finding = EXTRACT, ΟΧΙ FORK (D-B opt ii)** — οι L3 graph helpers (`buildGraph`/`buildAdjacency`/`computeComponents`/`resolveComponentRoots`/`bfsTree`/`connectorWorldPoints`/`findNearestNode`) μετακινήθηκαν σε `bim/thermal/sizing/pipe-network-graph.ts`· **το L3 `pipe-network-sizing.ts` έγινε thin consumer** (19/19 tests αμετάβλητα). Κοινό SSoT τοπολογίας L3+L4.
  - **κύκλωμα = supply + return (D-C)** — connector-agnostic άθροισμα των max-paths ανά component (τα δύο δέντρα ενώνονται per-terminal αφού τα σώματα δεν είναι segments). `ΔP_terminal` = config (`TERMINAL_NOMINAL_DROP_PA`, default 0 v1).
  - **balancing valve = kv-based (D-D)** — standard, αγνωστικό βαλβίδας· index circuit → `kv=null` («πλήρως ανοιχτή», δεν στραγγαλίζεται)· `surplus < MIN_BALANCING_SURPLUS_PA` → null. Preset-catalog = future.
  - **πρόταση = derived (transient overlay), μηδέν persist** (mirror L1/L2/L3).
- **Νέα pure SSoT:** `bim/thermal/sizing/pipe-network-graph.ts` (extracted κοινός γράφος) · `bim/thermal/sizing/terminal-contributions.ts` (extracted `buildTerminalContributions`, reuse L3+L4) · `bim/thermal/balancing/balancing-config.ts` (ζ-table `zetaForDegree` + ρ reuse + kv/pump/surplus σταθερές) · `bim/thermal/balancing/pressure-drop.ts` (`segmentPressureDropPa`/`frictionDropPa`/`localDropPa`/`dynamicPressurePa`/`requiredKv`) · `bim/thermal/balancing/circuit-balancing.ts` (`balanceNetwork` → per-terminal `{circuitDropPa,isIndex,surplusPa,requiredKv}` + `indexTerminalId`/`pumpHeadPa`/`segmentDropPa`) · `hooks/data/useHydraulicBalancing.ts` (reactive read-model, reuse `usePipeSizing`+`useRadiatorSizing`).
- **UI (visualization):** `state/hydraulic-balancing-view-store.ts` (transient flag — analysis mode) · `components/dxf-layout/HydraulicBalancingOverlay.tsx` (badge ΔP[kPa]+kv ανά καλοριφέρ + index-circuit κόκκινο highlight + μανομετρικό «Hp» στην πηγή, mirror `PipeSizingOverlay`, STAGE ADR-040) · `ui/ribbon/components/ShowBalancingToggle.tsx` + `view-tab-bim-settings.ts` (`BALANCING_BUTTON`) + `RibbonPanel.tsx` dispatch · i18n el+en (`ribbon.commands.balancing.*`).
- **Tests:** `pressure-drop` (Darcy worked ΔP + kv) + `circuit-balancing` (index=δυσμενέστερο· kv surplus· ζ topology· δέντρο path· degenerate) = **22/22 PASS**· L3 regression **19/19** μετά το graph extract.
- **ΜΑΘΗΜΑ:** το «κύκλωμα» σε δέντρο-δίκτυο = parent-chain drop, ΟΧΙ loop solver· connector-agnostic άθροισμα paths ανά component λύνει supply+return χωρίς flow-direction· local loss path-summable όταν αποδίδεται ανά tree-edge με ζ του parent (όχι ανά node)· extract πριν fork (graph helpers κοινά L3+L4).
- **Next:** L3 Apply command (όταν ελευθερωθεί το shared `useRibbonCommands.ts`)· L5 Report PDF (μηχανολογική μελέτη printout).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L5 — Μηχανολογική Μελέτη Θέρμανσης: Printout / PDF Report (2026-06-09, Opus, Plan Mode)

**ΣΥΓΚΕΝΤΡΩΝΕΙ (δεν ξαναϋπολογίζει) τα 4 read-models L1→L4 σε ΕΝΑ εκτυπώσιμο πολυσέλιδο PDF report** — Revit «Schedules/Reports» / 4M-FineHEAT printout μελέτης. Header έργου/ορόφου + κανονισμοί (ΤΟΤΕΕ 20701-1 · ΚΕΝΑΚ · EN 12831 / EN 442) + **σύνοψη** (ΣΦ ορόφου, απαιτ. ισχύς σωμάτων, index ΔP, μανομετρικό, κυκλώματα, συν. παροχή) + **4 πίνακες** (φορτία χώρων / διαστασιολόγηση σωμάτων / διαστασιολόγηση σωληνώσεων / υδραυλική εξισορρόπηση). Όλα **derived** (μηδέν persist), per-active-floor. FULL SSOT — κατανάλωση των read-models + reuse του PDF/schedule stack. jest **4/4**. **ΕΚΤΟΣ ADR-040** (καθαρός data/PDF, μηδέν canvas).

- **Αποφάσεις (Revit-grade, locked):**
  - **multi-section PDF = ΝΕΟ standalone exporter** `thermal-study-pdf-exporter.ts` (κλώνος του multi-section pattern του `opening-schedule-pdf-exporter.ts`)· reuse `registerGreekFont`/`triggerExportDownload`/`formatCellForDisplay`/`nowISO`/`autoTable`· **ΟΧΙ edit** του shared `pdf-exporter.ts` (isolation από schedule/BOQ agents).
  - **analytical, ΟΧΙ entity schedule** — νέος ελαφρύς `ReportSection`/`ReportColumn`/`ThermalStudyReport` (reuse `ScheduleCellValue`/`ScheduleColumnValueType`/`ScheduleColumnAlign`)· **ΔΕΝ** επεκτείνεται το shared `ScheduleEntityType` union (αποφυγή σύγκρουσης).
  - **pure builder + thin hook** — `buildThermalStudyReport(4 read-models + lookups)` pure (i18n keys, μηδέν t())· `useThermalStudyReport` συνθέτει τα 4 hooks + builder (mirror `useHydraulicBalancing`).
  - **arm-on-demand (Google-level, μηδέν idle cost)** — τα read-models τρέχουν ΜΟΝΟ on-click (`armed`→`active`→render→effect download→disarm)· race-free μέσω `busyRef`.
  - **scope = per-active-floor v1** (mirror overlays L1-L4 via `getLevelScene`)· multi-floor = future.
  - **UI = αυτόνομο widget, ΑΠΟΦΥΓΗ `useRibbonCommands.ts`** (boiler agent) — `ExportThermalStudyButton.tsx` (mirror `ShowBalancingToggle`) + `view-tab-bim-settings.ts` (`THERMAL_STUDY_BUTTON`) + `RibbonPanel.tsx` dispatch.
  - **μονάδες**: πιέσεις Pa→kPa στον builder· units στα headers· Φ/DN ακέραια (`count`)· v/R/kPa/kg/s 2-δεκ. (`number`).
- **Νέα pure SSoT:** `bim/thermal/report/thermal-study-report-types.ts` · `bim/thermal/report/thermal-study-report.ts` (builder) · `bim/thermal/report/thermal-study-pdf-exporter.ts` (multi-section exporter) · `hooks/data/useThermalStudyReport.ts` (reactive read-model).
- **UI:** `ui/ribbon/components/ExportThermalStudyButton.tsx` + `view-tab-bim-settings.ts` (`THERMAL_STUDY_BUTTON`) + `RibbonPanel.tsx` dispatch · i18n el+en (`ribbon.commands.thermalStudy.*` + `thermalStudyReport.*`).
- **Tests:** `thermal-study-report` (σύνθεση sections, σύνοψη totals, index circuit, kv null, spaceLabel name→use-type fallback, empty floor isEmpty) = **4/4 PASS**.
- **ΜΑΘΗΜΑ:** το report layer = καθαρός read-model consumer (μηδέν re-compute)· arm-on-demand κρατά τα 4 read-models εκτός idle· pure builder με i18n keys κρατά την i18n SSoT στο React layer + τον exporter μεταφραστή-αγνωστικό· reuse του multi-section opening-exporter pattern αποφεύγει fork του font/download SSoT.
- **🔴 PENDING (ξεχωριστό slice, ΟΧΙ L5):** L3 Apply command (περιμένει να ελευθερωθεί το shared `useRibbonCommands.ts` από τον boiler agent).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L1.5 — Πληρότητα Φορτίου EN 12831: Θερμογέφυρες (ΔU_TB) + Επανέναρξη/Reheat (Φ_RH) (2026-06-09, Opus, Plan Mode)

**Ολοκλήρωση του τύπου EN 12831 / ΤΟΤΕΕ 20701-1: `Φ_HL = Φ_T(+TB) + Φ_V + Φ_RH`.** Ο L1 engine υπολόγιζε μόνο `Φ_T + Φ_V`· το L1.5 προσθέτει τους δύο όρους που έχουν Revit Heating Loads / 4M-FineHEAT, **όλα derived** (μηδέν persist στους υπολογισμούς) → κατεβαίνουν αυτόματα σε L2 σώματα / L3 σωλήνες / L4 balancing / L5 report. **ΚΡΙΣΙΜΟ zero-regression:** με defaults `none`/`continuous` (`ΔU_TB=0` + `f_RH=0`) το αποτέλεσμα είναι **ακριβώς** το φορτίο του L1 (τα 11 engine + 6 derive tests μένουν αμετάβλητα). FULL SSOT, **ΕΚΤΟΣ ADR-040** (καθαρή αριθμητική + ribbon/data, μηδέν canvas).

- **Αποφάσεις (Revit-grade, locked):**
  - **D-A — Θερμογέφυρες = απλοποιημένη blanket** EN 12831-1 §6.3.2 `U_corr = U + ΔU_TB` (ΟΧΙ λεπτομερής `Σ Ψ·l` — απαιτεί μήκη ακμών/junctions, γεωμετρία-βαριά, future). Εφαρμογή **μόνο σε αδιαφανή** στοιχεία περιβλήματος (`wall`/`floor`/`roof`/`ceiling` — παράθυρα/πόρτες ΟΧΙ, το frame TB είναι ήδη στο `U_w`) **και μόνο** προς εξωτ. αέρα/έδαφος (`external-air`/`ground`· `adjacent-heated` b=0 + `unheated` εξαιρούνται v1). Gate config-driven.
  - **D-B — Reheat** `Φ_RH = A_floor · f_RH` (`A_floor` = `input.floorArea`)· `f_RH` από config presets ανά λειτουργία θέρμανσης· default `continuous` (0).
  - **D-C — building-default 0 (zero-regression) + per-space override** `ThermalSpaceParams.thermalBridgeLevel?` / `reheatMode?` (Revit «type default, instance override», ΑΚΡΙΒΩΣ όπως `setpointTempC?`/`airChangesPerHour?`). **ΜΗΔΕΝ Firestore schema/rules** — η persistence γράφει/διαβάζει `params` ολόκληρο, `UpdateThermalSpaceParamsCommand` περνά ολόκληρο το params.
  - **D-D — additive result breakdown** `SpaceHeatLoadResult += { thermalBridgeW, reheatW }` + `BoundaryHeatLoss += thermalBridgeW`· το `transmissionW` **περιλαμβάνει** την προσαύξηση TB (lossW με `U_corr`)· το `thermalBridgeW` είναι **πληροφοριακό υποσύνολο** (ΟΧΙ ξανα-προστίθεται)· `totalW = transmissionW + ventilationW + reheatW`. Additive → μηδέν break consumers.
  - **D-E — UI:** 2 combobox («Θερμογέφυρες» level + «Λειτουργία θέρμανσης» reheat) στο `thermal-space-properties` panel + 2 στήλες («Θερμογέφ. (W)» / «Επανέναρξης (W)») στον πίνακα φορτίων του L5 report. **ΑΠΟΦΥΓΗ `useRibbonCommands.ts`** (boiler agent) — το thermal-space bridge είναι ήδη wired.
- **Config SSoT (`heat-load-config.ts`):** `THERMAL_BRIDGE_SURCHARGE_PRESETS` (`none 0`/`low 0.05`/`medium 0.10`/`high 0.15` W/m²K) + `REHEAT_FACTOR_PRESETS` (`continuous 0`/`night-setback 11`/`intermittent 22`/`boost 44` W/m²) + getters + `boundaryReceivesThermalBridge(kind, condition)` + gate sets + τύποι `ThermalBridgeLevel`/`ReheatMode`. **ΟΛΕΣ οι τιμές εδώ — μηδέν inline literal στο engine.**
- **MOD:** `heat-load-types.ts` (input/result/boundary additive) · `heat-load-engine.ts` (`U_corr` + `computeReheat` + sums) · `thermal-space-use-catalog.ts` (`resolveThermalSpaceThermalBridgeSurcharge`/`resolveThermalSpaceReheatFactor`, default→0) · `derive-space-heat-loads.ts` (περνά τα 2 inputs από resolvers) · `bim/types/thermal-space-types.ts` (2 optional params) · `thermal-space-command-keys.ts` + `contextual-thermal-space-tab.ts` + `useRibbonThermalSpaceBridge.ts` (2 string-key combobox) · `thermal-study-report.ts` (2 στήλες) · i18n el+en (`thermalSpaceEditor.thermalBridgeLevel`/`reheatMode`, `thermalSpace.thermalBridge.*`/`reheat.*`, `thermalStudyReport.columns.thermalBridge`/`reheat`).
- **Tests:** engine (+TB worked / reheat worked / zero-regression / gating) · derive (+per-space overrides) · catalog (+4 resolver rows) · report+resolve mocks (+2 πεδία) = **66/66 PASS** (incl. L2 sizing + types regression). Zero-regression επιβεβαιωμένο (παλιά worked numbers αμετάβλητα).
- **ΜΑΘΗΜΑ:** ο engine είναι ο μόνος producer των `SpaceHeatLoadResult`/`BoundaryHeatLoss` → νέα required πεδία σπάνε μόνο 2 test mocks (όχι production)· additive result fields + default-0 resolvers = πλήρες zero-regression· per-space override χωρίς schema αλλαγή επειδή η persistence γράφει `params` ολόκληρο (όπως setpoint/ACH).
- **🔴 PENDING:** tsc full background (δεν έτρεξε — N.17 slot, πιθανόν boiler agent tsc) · browser-verify + commit (Giorgio).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L6 — Έλεγχος Συμμόρφωσης Κελύφους ΚΕΝΑΚ (U-compliance) (2026-06-09, Opus)

**Η μελέτη γίνεται κανονιστικά πλήρης:** μετά τον υπολογισμό φορτίου, έλεγχος **μέγιστου συντελεστή θερμοπερατότητας `U`** κάθε στοιχείου εξωτ. κελύφους έναντι των ορίων ΚΕΝΑΚ / ΤΟΤΕΕ 20701-1 ανά κλιματική ζώνη (Revit Energy / 4M-FineHEAT-KENAK parity). **Advisory/soft** (mirror του ETICS `isAboveKenakUMax` — ΔΕΝ μπλοκάρει), **derived** (μηδέν persist), νέα 6η section «Έλεγχος Συμμόρφωσης Κελύφους ΚΕΝΑΚ» στο L5 report. **ΕΚΤΟΣ ADR-040** (καθαρή αριθμητική + data + report· μηδέν canvas).

- **Αποφάσεις (Revit-grade, locked):**
  - **D-A — όρια `U_max` ανά στοιχείο × ζώνη** σε config (reuse `KENAK_MAX_U_WALL` ADR-396· νέα `KENAK_MAX_U_ROOF`/`KENAK_MAX_U_FLOOR_GROUND`/`KENAK_MAX_U_OPENING` ΤΟΤΕΕ 20701-1 Πίν. 3.3α, documented editable defaults). Μηδέν inline literal στον engine.
  - **D-B — νέο αρχείο** `bim/thermal/heat-load/kenak-envelope-limits.ts` (όχι fork του ADR-396 `kenak-thermal-config`) — κρατά το L6 SSoT μαζεμένο + isolation· reuse `ClimateZone` + `KENAK_MAX_U_WALL`.
  - **D-C — `getKenakMaxU(kind, condition, zone)` κωδικοποιεί ΚΑΙ τον πίνακα ΚΑΙ το gate:** μόνο `external-air` (wall/window/door/roof) + `ground` (floor) ελέγχονται· `adjacent-heated`/`unheated` → `null` (skip). Έλεγχος στο **βασικό `U`** (το `ΔU_TB` θερμογέφυρας αφορά μόνο το φορτίο, όχι το κανονιστικό `U_max`).
  - **D-D — pure read-model** `deriveEnvelopeCompliance(results, zone)` = **aggregator** (mirror L5· διαβάζει τα ήδη-υπολογισμένα `SpaceHeatLoadResult.boundaries`, μηδέν re-resolve geometry) → per-element `{ kind, condition, uValue, uMax, compliant, refId }` + σύνοψη `checkedCount`/`compliantCount`.
  - **D-E — UI = νέα section στο L5 report** (χώρος/στοιχείο/`U`/`U_max`/συμμόρφωση ✓✗)· `climateZone: null` ⇒ section με 0 γραμμές (graceful). ΟΧΙ shared ribbon/overlay (isolation από boiler agent).
- **Νέα pure SSoT:** `bim/thermal/heat-load/kenak-envelope-limits.ts` (config + `getKenakMaxU` + `isAboveKenakBoundaryUMax`) · `bim/thermal/heat-load/derive-envelope-compliance.ts` (read-model).
- **MOD:** `bim/thermal/report/thermal-study-report.ts` (+`buildComplianceSection`/`complianceRow`, 6η section) + `thermal-study-report-types.ts` (doc) · `hooks/data/useThermalStudyReport.ts` (περνά `climateZone` από `spaceLoads`) · `ExportThermalStudyButton.tsx` (`boundaryKindLabel` lookup) · i18n el+en (`thermalStudyReport.sections.compliance` + `columns.element/uValue/uMax/compliant` + `elementKinds.*`).
- **Tests:** `kenak-envelope-limits` (mapping/gating/stricter-cold-zones/soft predicate) · `derive-envelope-compliance` (✓/✗ vs zone, gating, multi-space sort, empty) · `thermal-study-report` (6η section ✓/✗ + external-only gating + null-zone omit) = **15/15 PASS**.
- **ΜΑΘΗΜΑ:** το compliance layer = καθαρός consumer των boundaries (μηδέν re-resolve)· μία `getKenakMaxU` που επιστρέφει `number|null` κωδικοποιεί ταυτόχρονα τον πίνακα ορίων ΚΑΙ το gate εξωτ. κελύφους — αποφεύγει διπλό branching σε config + engine.
- **🔴 PENDING:** tsc full background (N.17 slot) · browser-verify + commit (Giorgio).
- **⚠️ Crash-recovery note:** το L6 code έγινε commit (`12c9b0c1`) με **ημιτελές `en` locale** (κράσαρε Bun mid-edit) + **σπασμένο report test** (5→6 sections) + **χωρίς dedicated engine tests** — ολοκληρώθηκαν follow-up (en locale 11 keys, report test, 2 νέα test files, +N.15 docs).

### L7 — Ετήσια Ενεργειακή Ζήτηση Θέρμανσης + Ενδεικτική Κατηγορία (degree-day) (2026-06-09, Opus, Plan Mode)

**Ο τελευταίος κανονιστικός κρίκος των «μεγάλων παιχτών» (Revit Energy / 4M-FineHEAT-KENAK): πόση ΕΝΕΡΓΕΙΑ καταναλώνει ετησίως το κτίριο** — το φορτίο σχεδιασμού (W, στιγμιαία αιχμή) δεν λέει kWh/έτος. Το L7 υπολογίζει **ετήσια ζήτηση θέρμανσης `Q_H`** (kWh/έτος) με τη **μέθοδο βαθμοημερών (ΤΟΤΕΕ 20701-3 / EN ISO 13790 simplified)**, ειδική ζήτηση `q_H` (kWh/m²·έτος) + **ενδεικτική κατηγορία** ζήτησης → νέα **7η section** στο L5 report + 3 νέα summary KPIs. **Όλα derived** (μηδέν persist), **advisory**, **ΕΚΤΟΣ ADR-040** (καθαρή αριθμητική + data + report· μηδέν canvas).
- **Φυσική (ανά χώρο, από τα ήδη-υπολογισμένα L1 results):** `H = (transmissionW + ventilationW) / deltaTC` [W/K] (το `transmissionW` ήδη φέρει θερμογέφυρες· το `reheatW` **ΕΞΑΙΡΕΙΤΑΙ** — εφάπαξ προθέρμανση, όχι συνεχής απώλεια)· `Q_H = H · HDD · 24 / 1000` [kWh/έτος] (οι βαθμοημέρες ολοκληρώνουν ΔΤ → **ΟΧΙ** το ΔΤ σχεδιασμού)· εσωτερικά/ηλιακά κέρδη συντηρητικά αμελούνται v1· `q_H = ΣQ_H / ΣA → κατηγορία`.
- **Έντιμο όριο (HONESTY):** η επίσημη ΚΕΝΑΚ κατάταξη (Α+→Η) = λόγος **πρωτογενούς ενέργειας** προς κτίριο αναφοράς (απαιτεί βαθμό απόδοσης λέβητα + συντελεστή καυσίμου — pending boiler agent). Άρα v1 = **ζήτηση** (system-independent) + **ενδεικτική** κατηγορία, ρητά μη-επίσημη. Πλήρης primary-energy = future **L8**.
- **Αποφάσεις (Revit-grade, locked):**
  - **D-A — μέθοδος degree-day** (μηδέν εξάρτηση από σύστημα/καύσιμο)· πηγή απωλειών = τα L1 results (μηδέν νέα φυσική/re-resolve geometry).
  - **D-B — νέο config** `bim/thermal/heat-load/annual-energy-config.ts` (όχι fork ADR-396· isolation, mirror της D-B του L6): `HEATING_DEGREE_DAYS` (A≈900/B≈1300/C≈1800/D≈2400 K·ημέρα) + `ENERGY_DEMAND_CLASS_BANDS` (αύξοντα κατώφλια kWh/m²·έτος → A+…H, documented indicative) + `getHeatingDegreeDays`/`classifyEnergyDemand`. Reuse `ClimateZone`· μηδέν inline literal στον engine.
  - **D-C — pure aggregator** `bim/thermal/heat-load/derive-annual-energy.ts` (mirror `deriveEnvelopeCompliance`): `deriveAnnualHeating(results, spaces, zone)` → per-space `{ spaceId, lossCoefficientWperK, floorAreaM2, annualDemandKWh, specificDemandKWhM2 }` + σύνοψη `{ rows, totalAnnualKWh, totalAreaM2, specificDemandKWhM2, energyClass, hdd, zone }`. Heated area από `space.geometry.area` (cached)· guard area>0 + ΔΤ>0.
  - **D-D — UI = 7η section στο L5 report + 3 summary KPIs** (ΟΧΙ νέο ribbon/overlay) → **μηδέν shared αρχείο με boiler agent**· `spaceLoads`+`climateZone` ήδη στο `ThermalStudyReportInput` → καμία αλλαγή hook/input. Shared `resolveAnnualHeating` (μία πηγή αλήθειας σύνοψη+πίνακα).
  - **D-E — έντιμη ονοματοδοσία:** «Ετήσια Ενεργειακή Ζήτηση Θέρμανσης (ενδεικτική)» · KPI «Ενδεικτική κατηγορία». `climateZone: null` ⇒ 0 γραμμές + KPI κατηγορία «—» (graceful).
  - **D-F — μονάδες:** H [W/K] `number` (2-δεκ)· A [m²] `area-m2`· Q [kWh] `count` (ακέραιο)· q [kWh/m²·έτος] `number`· class `text`. **Καμία νέα `ScheduleColumnValueType`** (FULL SSOT).
- **Νέα pure SSoT:** `bim/thermal/heat-load/annual-energy-config.ts` (config + getters) · `bim/thermal/heat-load/derive-annual-energy.ts` (read-model).
- **MOD:** `bim/thermal/report/thermal-study-report.ts` (+`buildAnnualEnergySection`/`annualEnergyRow`/`resolveAnnualHeating`, 7η section + 3 summary KPIs) + `thermal-study-report-types.ts` (doc 6 πίνακες) · i18n el+en (`thermalStudyReport.sections.annualEnergy` + `columns.{lossCoeff,floorArea,annualDemand,specificDemand}` + `summary.{annualEnergy,specificDemand,energyClass}`).
- **ΖΕΡΟ αλλαγή:** `useThermalStudyReport.ts`, `useRibbonCommands.ts`, οποιοδήποτε boiler/heating/MEP αρχείο (shared-tree isolation).
- **Worked example (sanity):** χώρος 4×4 m (A=16 m²), H=(600+200)/20=40 W/K, ζώνη Β (HDD 1300) → `Q=40·1300·24/1000=1248 kWh/έτος`· `q=78 kWh/m²·έτος` → ενδεικτική κατηγορία Β.
- **Tests:** `annual-energy-config` (HDD μονοτονία/getters · bands αύξοντα+Infinity · classify όρια/μονοτονία) · `derive-annual-energy` (worked example · **reheat εξαιρείται** · area από geometry · guards area/ΔΤ · totals+class · empty) · `thermal-study-report` (7η section + summary KPIs + null-zone omit) = **24/24 PASS** (3 suites).
- **ΜΑΘΗΜΑ:** η ετήσια ζήτηση = καθαρός consumer των L1 απωλειών — `H = ΣαπωλειώνW/ΔΤ`, οι βαθμοημέρες αντικαθιστούν το ΔΤ σχεδιασμού· isolation μέσω «section-only στο report» = μηδέν επαφή με το shared ribbon του boiler agent.
- **🔴 PENDING:** tsc full background (N.17 slot) · browser-verify + commit (Giorgio).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L7.1 — Καθαρή Ετήσια Ζήτηση με Συντελεστή Αξιοποίησης Κερδών (gain utilisation) (2026-06-09, Opus, Plan Mode)

**Το L7 δίνει τη ΜΕΙΚΤΗ ζήτηση (gross losses) αμελώντας τα ωφέλιμα κέρδη → υπερεκτιμά.** Οι «μεγάλοι παίχτες» (Revit Energy / 4M-FineHEAT-KENAK) υπολογίζουν **καθαρή** ζήτηση αφαιρώντας τα **αξιοποιήσιμα** κέρδη (εσωτερικά + ηλιακά) μέσω **συντελεστή αξιοποίησης `η_gn`** (EN ISO 13790 §12.2.1.1, simplified seasonal). Το L7.1 προσθέτει αυτό το στρώμα ως **καθαρά additive** επέκταση του υπάρχοντος aggregator + report — **μηδέν persist**, **advisory**, **ΕΚΤΟΣ ADR-040**.
- **Φυσική (ανά χώρο, πάνω στα ήδη-υπολογισμένα L7):** `Q_loss` = η μεικτή του L7 (αμετάβλητη — zero-regression)· `Q_int = q_int(use) · A · hours_season / 1000` [kWh]· `Q_sol = Σ_win A_win · g · F_F · F_sh · I_season(zone)` [kWh] (window area από τα ήδη-resolved `result.boundaries` όπου `window` & `external-air` — **μηδέν re-resolve**)· `γ = (Q_int+Q_sol)/Q_loss`· `η_gn = (1−γ^a0)/(1−γ^(a0+1))` (a0=1 ⇒ `1/(1+γ)`· γ=1 ⇒ 0.5· γ≤0 ⇒ 1· clamp [0,1])· **καθαρή** `Q_net = max(0, Q_loss − η·(Q_int+Q_sol))`· `q_net = ΣQ_net/ΣA → κατηγορία`.
- **Αποφάσεις (Revit-grade, locked):**
  - **D-A — μέθοδος = EN ISO 13790 simplified seasonal gain utilisation.** Πηγή απωλειών = τα L7/L1 (μηδέν re-resolve geometry). Καθαρά αριθμητική.
  - **D-B — νέο config** `bim/thermal/heat-load/annual-gains-config.ts` (ΞΕΧΩΡΙΣΤΟ SRP από το `annual-energy-config`· mirror isolation L6/L7): `INTERNAL_GAIN_W_PER_M2` (ανά `ThermalSpaceUseType`· bedroom 4/living-room 6/kitchen 6/bathroom 4/wc 2/hallway 2/office 6/generic 4 W/m²)· `HEATING_SEASON_HOURS` (A 2880/B 3600/C 4320/D 5040 h = ημέρες×24)· `SEASONAL_SOLAR_IRRADIATION_KWHM2` (κατακόρυφη, orientation-agnostic v1· A 350/B 300/C 250/D 200)· `GLAZING_SOLAR_FACTOR_G` 0.6 / `FRAME_FACTOR` 0.7 / `SHADING_FACTOR` 0.9 / `UTILISATION_NUMERIC_PARAM` a0=1· getters + pure `computeGainUtilisation(γ)`. Reuse `ClimateZone`/`ThermalSpaceUseType`· μηδέν inline literal στον engine.
  - **D-C — επέκταση του pure aggregator** `derive-annual-energy.ts` (ΟΧΙ νέο αρχείο): `AnnualEnergyRow` += `{ grossDemandKWh, internalGainKWh, solarGainKWh, utilisation, netDemandKWh }`· **`annualDemandKWh` = net** (downstream class/KPIs = καθαρή)· `AnnualHeatingResult` += `{ totalGrossKWh, totalInternalGainKWh, totalSolarGainKWh }`· `totalAnnualKWh` & `specificDemandKWhM2` & `energyClass` = καθαρά. `utilisation` ∈ [0,1] (×100 για % στο report).
  - **D-D — UI = επέκταση 7ης section + σύνοψη** (ΟΧΙ νέα section/widget): πίνακας +στήλες «Μεικτή/Κέρδη/Αξιοπ.(%)»· η `annualDemand` → **καθαρή** (relabel)· σύνοψη +KPI «Μεικτή ζήτηση»· `annualEnergy` KPI = καθαρή.
  - **D-E — κατηγορία = καθαρή ζήτηση** (πιο ρεαλιστική)· τα bands του `annual-energy-config` μένουν ίδια (indicative). `climateZone: null` ⇒ 0 γραμμές (graceful, ως τώρα).
  - **D-F — μονάδες:** Q [kWh] `count` (ακέραιο)· utilisation % `number` (2-δεκ). **Καμία νέα `ScheduleColumnValueType`** (FULL SSOT).
- **Νέα pure SSoT:** `bim/thermal/heat-load/annual-gains-config.ts` (config + getters + `computeGainUtilisation`).
- **MOD:** `derive-annual-energy.ts` (+gross/κέρδη/utilisation/net + totals· headline=net) · `report/thermal-study-report.ts` (+3 στήλες πίνακα + grossEnergy KPI) · i18n el+en (`columns.{grossDemand,gains,utilisation}` + relabel `annualDemand`→«Καθαρή»· `summary.grossEnergy` + relabel `annualEnergy`→«Καθαρή»).
- **ΖΕΡΟ αλλαγή:** `annual-energy-config.ts` (bands/HDD), `useThermalStudyReport.ts`, `useRibbonCommands.ts`, οποιοδήποτε boiler/heating/MEP/recognition αρχείο (shared-tree isolation).
- **Worked example (sanity, ζώνη Β):** χώρος 4×4 m, H=40 W/K → μεικτή 1248 kWh· living-room q_int=6 → `Q_int=6·16·3600/1000=345.6`· `γ=0.277`· `η=0.783`· **καθαρή `Q_net=1248−0.783·345.6=977 kWh`**· `q_net=61.1 → κατηγορία Β+` (η μεικτή έδινε 78 → Β).
- **Tests:** `annual-gains-config` (getters ανά use/zone· `computeGainUtilisation` γ=0→1, γ=1→0.5, φθίνουσα, clamp, μεγάλο γ→μικρό η) · `derive-annual-energy` (worked μεικτή+καθαρή· κέρδη>0· net<gross· ηλιακά από εξωτ. υαλοπίνακες + filter τοίχου/εσωτ.· guards gross=0⇒net=0· totals) · `thermal-study-report` (νέες στήλες + grossEnergy KPI + καθαρή class) = **27/27 PASS** (3 suites).
- **ΜΑΘΗΜΑ:** η αξιοποίηση κερδών = καθαρά additive layer πάνω στο L7 — η μεικτή μένει ορατή ως breakdown (Revit pattern)· τα ηλιακά κέρδη βγαίνουν δωρεάν από τα ήδη-resolved boundaries (window+external-air), μηδέν re-resolve.
- **🔴 PENDING:** tsc full background (N.17 slot) · browser-verify + commit (Giorgio). **L7.2** (orientation-aware ηλιακά) = ✅ DONE (βλ. παρακάτω) · **L8** (επίσημη ΚΕΝΑΚ primary-energy — BLOCKED boiler agent) = future.

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L7.2 — Ηλιακά Κέρδη ανά Προσανατολισμό (orientation-aware solar gains) (2026-06-09, Opus, Plan Mode)

**Το L7.1 χρησιμοποιεί ΜΙΑ μέση ηλιακή ακτινοβολία ανά ζώνη (orientation-agnostic) → νότιος & βόρειος υαλοπίνακας «κερδίζουν» το ίδιο (λάθος φυσικά).** Οι «μεγάλοι παίχτες» (Revit Energy / 4M-FineHEAT-KENAK / ΤΟΤΕΕ 20701-1 πίν. ηλιακής ακτινοβολίας) διαφοροποιούν την ακτινοβολία **ανά προσανατολισμό** (Β/ΒΑ/Α/ΝΑ/Ν/ΝΔ/Δ/ΒΔ). Το L7.2 αναβαθμίζει τα ηλιακά κέρδη ώστε η ακτινοβολία να εξαρτάται από τον προσανατολισμό κάθε υαλοπίνακα — **καθαρά additive** πάνω στο L7.1, **backward-compatible** (χωρίς προσανατολισμό → η μέση τιμή του L7.1, zero-regression), **advisory**, **ΕΚΤΟΣ ADR-040** (καθαρή αριθμητική + data + geometry resolver, μηδέν canvas).
- **Φυσική:** `Q_sol = Σ_win A_win · g · F_F · F_sh · I_season(zone, orientation(win))` [kWh]· `orientation(win) = azimuthToOrientation(azimuthDeg)`· `azimuthDeg` = εξωτερικό normal του τοίχου-ξενιστή (0°=Βορράς, clockwise). Τα `g`/`F_F`/`F_sh` παραμένουν σταθερές του L7.1 — μόνο η `I_season` γίνεται orientation-aware. Απουσία `azimuthDeg` ⇒ `I_season(zone)` μέση = fallback L7.1.
- **Αποφάσεις (Revit-grade, locked):**
  - **D-A — 8-way προσανατολισμός** (Revit/ΤΟΤΕΕ parity): νέος type `SolarOrientation = 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'` + `SOLAR_ORIENTATIONS` (compass order) στο `annual-gains-config.ts`. Κανένα υπάρχον compass/orientation enum στο dxf-viewer → νέο, χωρίς fork.
  - **D-B — νέος πίνακας** `SEASONAL_SOLAR_IRRADIATION_BY_ORIENTATION: Record<ClimateZone, Record<SolarOrientation, number>>` (kWh/m²·περίοδο, κατακόρυφη επιφάνεια· **Ν μέγιστο, Β ελάχιστο**, Α/Δ ενδιάμεσα, ΝΑ/ΝΔ κοντά στο Ν). **Βαθμονόμηση:** σχετικοί συντελεστές Β/ΒΑ/Α/ΝΑ/Ν = 0.40/0.55/0.95/1.45/1.70 (συμμετρικά Α↔Δ) με **μέσο 8 ≈ 1.00** → μέσος όρος ανά ζώνη ≈ η orientation-agnostic `SEASONAL_SOLAR_IRRADIATION_KWHM2[zone]` του L7.1 (zero-scale-shock). Το παλιό orientation-agnostic table κρατήθηκε ως **fallback** (δεν σβήστηκε).
  - **D-C — προσανατολισμός ανά υαλοπίνακα από geometry:** `HeatLoadBoundary` **και** `BoundaryHeatLoss` += `azimuthDeg?: number` (0°=Βορράς, clockwise, [0,360)). Υπολογισμός στον `space-boundary-resolver` **μόνο για εξωτ. κουφώματα** (`external-air`) από το footprint του χώρου. **N.0.2 Boy-Scout — reuse geometry SSoT:** νέοι pure helpers `directionAzimuthDeg(dx,dy)` + `nearestEdgeOutwardAzimuthDeg(polygon, p)` στο `geometry/shared/polygon-utils.ts` (reuse `segmentNormalX/Y` + `isPolygonCCW`· **winding-based outward → robust και για κοίλα**, χωρίς centroid· καμία inline math στον resolver).
  - **D-D — pure helpers στο config:** `azimuthToOrientation(azimuthDeg)` (8 τομείς των 45° με κέντρο κάθε σημείο πυξίδας, wrap-safe) + **overload** `getSeasonalSolarIrradiation(zone)` (μέση, backward-compatible) / `getSeasonalSolarIrradiation(zone, orientation)` (per-orientation).
  - **D-E — `solarGainKWh` per-window** στο `derive-annual-energy.ts`: loop ανά εξωτ. υαλοπίνακα με `I_season(zone, azimuth!=null ? azimuthToOrientation(azimuth) : μέση)`· internal gains/utilisation/net **αμετάβλητα**.
  - **D-F — UI = ΚΑΜΙΑ νέα στήλη** (το report δείχνει ήδη συγκεντρωτικά «Κέρδη (kWh)» — τώρα απλώς ακριβέστερα). **Καμία νέα `ScheduleColumnValueType`.** Per-orientation breakdown panel = DEFER.
  - **Σύμβαση πλαισίου:** scene **+Y = project north** (= true north, μηδέν περιστροφή) — documented advisory simplification· configurable north angle = future.
- **Νέα pure SSoT:** `directionAzimuthDeg` + `nearestEdgeOutwardAzimuthDeg` (`geometry/shared/polygon-utils.ts`) · `SolarOrientation`/`SOLAR_ORIENTATIONS`/`SEASONAL_SOLAR_IRRADIATION_BY_ORIENTATION`/`azimuthToOrientation` + overloaded `getSeasonalSolarIrradiation` (`annual-gains-config.ts`).
- **MOD:** `heat-load-types.ts` (+`azimuthDeg?` σε `HeatLoadBoundary` & `BoundaryHeatLoss`) · `heat-load-engine.ts` (+1 γρ. propagate azimuth, **μη-υπολογιστικό**) · `space-boundary-resolver.ts` (azimuth εξωτ. κουφωμάτων από footprint) · `derive-annual-energy.ts` (per-window orientation-aware `solarGainKWh`).
- **ΖΕΡΟ αλλαγή:** `report/thermal-study-report.ts`, `annual-energy-config.ts`, `useThermalStudyReport.ts`, `useRibbonCommands.ts`, οποιοδήποτε boiler/heating/MEP/recognition αρχείο (shared-tree isolation).
- **Worked example (sanity, ζώνη Β, 2 m², g0.6/F_F0.7/F_sh0.9 → optical 0.378):** μέση `I=300` → `Q_sol=226.8`· **νότιος `I_S=510` → `Q_sol=385.56`**· **βόρειος `I_N=120` → `Q_sol=90.72`**· ισοκατανεμημένοι ≈ 226.8 (μέσος 8 ≈ 300).
- **Tests:** `annual-gains-config` (+`azimuthToOrientation` κέντρα/κατώφλια/wrap· overload· Ν>Β· συμμετρία Α↔Δ· μέσος 8 ≈ agnostic) · `polygon-utils-azimuth` (NEW: `directionAzimuthDeg` άξονες/διαγώνιοι/null· `nearestEdgeOutwardAzimuthDeg` Ν→180/Α→90/Β→0/Δ→270· winding-invariant CW· null<3) · `space-boundary-resolver` (NEW: εξωτ. υαλοπίνακας νότιος→180/ανατολικός→90· μη-κουφώματα→absent) · `derive-annual-energy` (+νότιος>βόρειος· fallback χωρίς azimuth == L7.1 226.8· per-window sum) = **41/41 PASS** (4 suites)· +33/33 γειτονικά heat-load regression.
- **ΜΑΘΗΜΑ:** το outward normal βγαίνει **robust** από το winding του footprint (όχι centroid → δουλεύει και σε κοίλα δωμάτια)· το per-window pattern κρατά zero-regression μέσω fallback στη μέση τιμή όταν λείπει geometry· ο engine propagate-άρει το `azimuthDeg` χωρίς να το χρησιμοποιεί στον υπολογισμό φορτίου (μόνο τα ηλιακά κέρδη το διαβάζουν).
- **🔴 PENDING:** browser-verify + commit (Giorgio). Future: **L7.2+** orientation-aware shading (παράθυρα σε προεξοχές)· **L8** επίσημη ΚΕΝΑΚ primary-energy (BLOCKED boiler agent — βαθμός απόδοσης λέβητα).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).

### L7.3 — Συντελεστής Σκίασης Υαλοπινάκων (per-space solar obstruction shading) (2026-06-09, Opus, Plan Mode)

**Το L7.2 χρησιμοποιεί σταθερό `F_sh=0.9` για ΟΛΑ τα παράθυρα → ένα παράθυρο πίσω από ψηλό γειτονικό κτίριο / κάτω από βαθύ πρόβολο «κερδίζει» όσο ένα ελεύθερο (λάθος φυσικά).** Οι «μεγάλοι παίχτες» (Revit Energy «Shading» / 4M-FineHEAT-KENAK / ΤΟΤΕΕ 20701-1 πίν. σκίασης) μειώνουν τα ηλιακά κέρδη ανά παράθυρο με **συντελεστή σκίασης** (EN ISO 13790 §11.4.3 `F_sh,gl = F_hor·F_ov·F_fin`). Το L7.3 αντικαθιστά το σταθερό `F_sh` με **resolved συντελεστή σκίασης ανά χώρο** (Revit «type default + instance override», ΑΚΡΙΒΕΣ mirror του L1.5 `thermalBridgeLevel`/`reheatMode`) — **καθαρά additive** πάνω στο L7.2, **backward-compatible** (απουσία override → obstruction 1.0 → `F_sh=0.9` → zero-regression), **advisory**, **ΕΚΤΟΣ ADR-040** (καθαρή αριθμητική + data + per-space param + contextual tab, μηδέν canvas).
- **Φυσική:** `Q_sol = Σ_win A_win · g · F_F · SHADING_FACTOR · obstruction(space) · I_season(zone, orientation(win))` [kWh]· `obstruction = getSolarShadingObstructionFactor(resolveSolarShadingLevel(space.params))`. Το `SHADING_FACTOR=0.9` (baseline γενική σκίαση ορίζοντα) **ΑΜΕΤΑΒΛΗΤΟ**· ο `obstruction` είναι ο νέος πολλαπλασιαστικός όρος εξωτ. εμποδίων· orientation από L7.2.
- **Αποφάσεις (Revit-grade, locked):**
  - **D-A — διαχωρισμός baseline glazing-shading από obstruction:** το `SHADING_FACTOR=0.9` ΜΕΝΕΙ (γενική γωνία πρόσπτωσης/ορίζοντα)· νέος **ξεχωριστός** obstruction factor πολλαπλασιάζει. `F_sh_total = SHADING_FACTOR · obstruction(level)`. Default obstruction 1.0 ⇒ zero-regression by construction (καθαρός διαχωρισμός concerns).
  - **D-B — per-space override (mirror L1.5):** `ThermalSpaceParams += solarShadingLevel?: SolarShadingLevel` με `SolarShadingLevel = 'none'|'light'|'moderate'|'heavy'`. **ΜΗΔΕΝ Firestore schema/rules αλλαγή** — η persistence γράφει `params` ολόκληρο (όπως L1.5). Default absent ⇒ `'none'`.
  - **D-C — νέο config SSoT** στο `annual-gains-config.ts`: `SOLAR_SHADING_OBSTRUCTION_FACTOR: Record<SolarShadingLevel, number>` (**none 1.00 · light 0.90 · moderate 0.70 · heavy 0.50**, EN ISO 13790 / ΤΟΤΕΕ defaults, φθίνον· editable) + `SOLAR_SHADING_LEVELS` (σειρά dropdown) + `DEFAULT_SOLAR_SHADING_LEVEL='none'` + pure getter `getSolarShadingObstructionFactor(level)`.
  - **D-D — resolver** στο `thermal-space-use-catalog.ts` (mirror `resolveThermalBridgeLevel`/`resolveReheatMode`): `resolveSolarShadingLevel(params): SolarShadingLevel` → `params.solarShadingLevel ?? 'none'` (επιστρέφει το **επίπεδο**· ο πολλαπλασιαστής μέσω του getter).
  - **D-E — `solarGainKWh` με obstruction** στο `derive-annual-energy.ts`: νέα παράμετρος `obstruction`· ο caller `buildAnnualRow` έχει ήδη το `space` → resolve level → getter → multiply per-window. `space-boundary-resolver`/`heat-load-engine`/`heat-load-types` **ΑΜΕΤΑΒΛΗΤΑ** (per-space, διαβάζεται στον aggregator).
  - **D-F — UI:** ΕΝΑ νέο combobox «Σκίαση» στο thermal-space contextual tab (mirror «Θερμογέφυρες»/«Επανέναρξη»): `thermal-space-command-keys` (+`stringParams.solarShadingLevel`) · `contextual-thermal-space-tab` (+`SOLAR_SHADING_OPTIONS` + combobox) · `useRibbonThermalSpaceBridge` (getState + change branch). **ΟΧΙ `useRibbonCommands.ts`** (shared-tree isolation).
- **Νέα pure SSoT:** `SolarShadingLevel`/`SOLAR_SHADING_OBSTRUCTION_FACTOR`/`SOLAR_SHADING_LEVELS`/`DEFAULT_SOLAR_SHADING_LEVEL`/`getSolarShadingObstructionFactor` (`annual-gains-config.ts`) · `resolveSolarShadingLevel` (`thermal-space-use-catalog.ts`).
- **MOD:** `annual-gains-config.ts` · `derive-annual-energy.ts` (`solarGainKWh`+obstruction) · `thermal-space-types.ts` (+`solarShadingLevel?`) · `thermal-space-use-catalog.ts` (resolver) · 3 UI αρχεία (command-keys/tab/bridge) · i18n el+en (label «Σκίαση» + 4 options).
- **ΖΕΡΟ αλλαγή:** `space-boundary-resolver.ts`, `heat-load-engine.ts`, `heat-load-types.ts`, `report/thermal-study-report.ts`, `annual-energy-config.ts`, `useRibbonCommands.ts`, οποιοδήποτε boiler/heating/MEP/recognition αρχείο (shared-tree isolation).
- **Worked example (sanity, ζώνη Β, 2 m², νότιος, optical 0.378·I_S=510):** `none`/absent → `Q_sol=385.56` (zero-regression)· `heavy` (0.5) → `192.78`· `moderate` (0.7) → `269.892`. Λιγότερα κέρδη → μεγαλύτερη καθαρή ζήτηση.
- **Tests:** `annual-gains-config` (+`getSolarShadingObstructionFactor`: none→1.0, φθίνον, ∈(0,1], exhaustive) · `thermal-space-use-catalog` (+`resolveSolarShadingLevel`: absent→none, pass-through) · `derive-annual-energy` (+zero-regression absent==385.56, heavy→192.78, moderate→269.892, σκίαση↑→net↑· `makeSpace` fixture +`solarShadingLevel` override) = **49/49 PASS** (3 suites).
- **ΜΑΘΗΜΑ:** ο διαχωρισμός baseline `SHADING_FACTOR` (αμετάβλητο) από τον per-space `obstruction` (default 1.0) δίνει zero-regression **by construction**· το L1.5 per-space-override pattern (params + resolver + config presets + combobox, **χωρίς schema αλλαγή** γιατί η persistence γράφει params ολόκληρο) γενικεύεται 1:1 σε κάθε νέα per-space παράμετρο.
- **🔴 PENDING:** browser-verify + commit (Giorgio). Future (Slice B): **geometry-derived overhang** — ανίχνευση slab/roof πάνω από το παράθυρο → γωνία προβόλου → orientation-aware `F_ov` από ΤΟΤΕΕ πίνακα (το «βαρύ» Revit κομμάτι)· **L8** επίσημη ΚΕΝΑΚ primary-energy (BLOCKED boiler agent).

> **ΜΗΝ** ενημερωθεί το `adr-index.md` σε αυτό το slice (shared working tree).
