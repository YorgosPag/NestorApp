# ADR-422 — BIM Μηχανολογική Μελέτη Θέρμανσης (ΤΟΤΕΕ/ΚΕΝΑΚ)

**Status:** 🟡 IN PROGRESS — L0 IMPLEMENTED (pending browser-verify + commit)
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
