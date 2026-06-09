# ADR-434 — Gas / Φυσικό Αέριο Auto-Design (8th & FINAL MEP discipline)

> **Status:** 🟢 Slices 0 + 0b (foundation + fixtures/recognizer) + 1 (headless engine) + 🟢 Slice 2 (preview + commit) IMPLEMENTED — 2026-06-10 (Opus 4.8). Child-ADR of **ADR-423** (MEP Auto-Design framework). The **8th & final** discipline — it **completes the 8/8 MEP grid**. It is an **HVAC-style new-system-family** discipline: gas is `flowModel:'pressurised'` but its connector lives on the disjoint **`'fuel'`** domain (carved out earlier for the boiler fuel inlet), so it founds a new `fuel-network` `MepSystem` family — a 1:1 mirror of how HVAC (ADR-432) founded `duct-network`, NOT the pipe-reuse of fire (ADR-433). Revit "Generate → review → accept" is live on the canvas (ribbon «Αυτόματο Αέριο»).
> **Scope (v1):** turn a recognized storey into a **proposed fuel-gas supply network** — Demand (m³/h) → Source (gas meter) → Routing → Sizing (DN) — as pure data (`GasNetworkProposal`), then commit it to real **fuel** pipes (`mep-segment` domain `'fuel'`) + a NEW `fuel-network` `MepSystem`. **Natural-gas (low-pressure) only**; LPG / oil distribution are future services.
> **Decision driver (Giorgio, 2026-06-09):** *«FULL ENTERPRISE + FULL SSOT, όπως Revit / MagiCAD / 4M FINE»*. Gas reuses the framework's router + preview/commit layer + the fixture rails as **parameters, not a new engine** (ADR-423 §6) — the only genuinely new foundation is the `fuel` segment domain + the `fuel-network` system family.

---

## 1. Context

ADR-423 makes every MEP network one graph (Source → Distribution → Terminals). Seven disciplines (water, drainage, heating, electrical-strong, electrical-weak, HVAC, fire) were live; gas is the **8th and last** — a **reserved** registry slot with no engine.

A code sweep confirmed **half the foundation was already built** by the boiler work: the `MepConnectorDomain` already had `'fuel'`, `FuelSystemClassification = 'fuel-gas' | 'fuel-oil'`, `MepFuelConnectorParams`, `MepConnector.fuel`, and `buildBoilerFuelConnector` — so a **gas-fuelled boiler is already a gas terminal for free** (its fuel inlet). What was missing: the fuel **segment** domain, the `fuel-network` **system** family, a **gas-meter source**, and the **engine**.

The defining choice (vs fire): gas is `pressurised` but its connector domain is **`'fuel'`**, deliberately disjoint from `'pipe'` (so a gas line never reads as water plumbing — the disjointness the boiler work established). A `'fuel'` segment therefore carries **no** classification (mirror of the HVAC duct) — the **System owns** the `fuel-gas` classification. So gas is an **HVAC-style new-system-family** discipline: it founds `fuel-network` exactly as HVAC founded `duct-network`, with `'duct'`→`'fuel'`, AHU→gas-meter, air-terminal→gas-appliance.

---

## 2. Decision

A four-stage pipeline over the Stage 0 `RecognitionModel`, parameterised by the gas discipline descriptor (ADR-423 §4 registry entry):

```
RecognitionModel ─▶ Demand (m³/h) ─▶ Source (meter outlet) ─▶ Routing (Manhattan + A* wall-aware) ─▶ Sizing (Σflow→DN) ─▶ GasNetworkProposal
```

- **Stage 1 Demand** — each recognized gas appliance's `fuel-gas` inlet → `TerminalGasDemand` (design gas flow m³/h + world point). Flow from a **pluggable `GasDemandStandard`** (v1: per-kind constant — gas cooker 1.1 m³/h, any other appliance e.g. boiler 2.5 m³/h; a thermal-output-derived model — appliance kW ÷ calorific value ≈ 9.5–10 kWh/m³ — swaps in behind the interface).
- **Stage 2 Source** — resolve the network origin from a recognized gas meter `fuel-gas` outlet (`flow:'out'`). Connector-driven (entity-agnostic, mirror of the HVAC AHU resolve), the classification guard keeps non-gas fuel outlets out. **Missing source ⇒ warning, not error** (honest pilot).
- **Stage 3 Routing** — the **shared** `routeWallAware` (ADR-429) every other discipline uses: root-outward Manhattan trunk-branch spine carrying cumulative flow, A\*-detoured around walls. Gas flow is the cumulative-sum driver (the router's `loadingUnits` is a flow proxy). NO new router.
- **Stage 4 Sizing** — cumulative flow → nominal DN from a **pluggable `GasSizingStandard`** (v1: velocity-limited low-pressure, DVGW G600 / EN 1775, v ≤ 6 m/s, pre-evaluated as a step table DN15…DN50). Trunk near the meter = big DN, branch to one hob = small DN → **diameters diminish toward the appliances** (Revit / MagiCAD-correct).

Output: `GasNetworkProposal` = `ProposedFuelNetwork`(s) (sized, routed fuel runs + meter source + served appliances + Σflow) + honest `warnings`. **Transient — never persisted.** Accept turns it into real entities via a `CompoundCommand`.

### 2b. Why a NEW system type (the HVAC-mirror insight)

A `mep-segment` of domain `'fuel'` carries **no** classification (mirror of the duct — the System owns it). So the commit cannot reuse the pipe-network family; it founds **`MepSystemType 'fuel-network'`** (`MepFuelSystemParams`, `buildDefaultFuelNetworkParams`, `isFuelSystemParams`) — a byte-for-byte mirror of `duct-network`. Colour-by-system, the 2D renderer (`DOMAIN_STROKE`/`DOMAIN_FILL` `'fuel'` = yellow), the members SSoT (`pipeSegmentMembers`, domain-agnostic), and the ghost all read the new domain/family through the existing code paths. The new V/G category `'fuel'` (Revit groups gas piping under Mechanical) keeps gas lines toggling independently of water pipes and air ducts.

---

## 3. Slicing (Revit-grade incremental)

| Slice | Scope | Status |
|------|-------|--------|
| **0** | Foundation: `MepSegmentDomain += 'fuel'` (+ schema, renderer palette yellow `#eab308`) + `MepSystemType 'fuel-network'` family (`MepFuelSystemParams` + `isFuelSystemParams` + `buildDefaultFuelNetworkParams` + schema) + `fuelClassificationDefaultColor` + `resolveSegmentClassificationColor` fuel branch + new `'fuel'` `BimCategory` (object-styles + subcategories + discipline) + `IfcFlowMeter`/`IfcBurner` in IFC mixin + `MepSystemClassification += FuelSystemClassification` + gas connector builders | 🟢 DONE |
| **0b** | Fixtures + recognizer: `gas-meter` (source) + `gas-cooker` (terminal) `mep-fixture` kinds (symbol specs + IFC + V/G `'fuel'` + connector seed + tool rails + ToolType union + ribbon buttons) + flow-aware `gas-recognizer` (fuel inlet → terminal; catches cooker **and** boiler) | 🟢 DONE |
| **1** | Headless engine `systems/mep-design/gas/`: design-types + demand + flow-standard + sizing + source-resolve + discipline descriptor + `designGas` orchestrator; registry flip `gas` → active **(8/8!)** | 🟢 DONE |
| **2** | Preview + commit: low-freq `gas-proposal-store` + pure `build-gas-commit` (fuel WITHOUT classification, new `fuel-network` System) + ghost leaf (`#eab308`, domain `'fuel'`) + `useRibbonGasAutoBridge` + ribbon «Αυτόματο Αέριο» Generate/Accept/Reject + 3 toasts | 🟢 DONE |

---

## 4. Architecture (files)

**Slice 0 — foundation (outside ADR-040):**
- `bim/types/mep-segment-types.ts` — `MepSegmentDomain += 'fuel'`; `resolveSegmentSection` fuel→pipe default. `bim/types/mep-segment.schemas.ts` — enum `'fuel'`.
- `bim/types/mep-connector-types.ts` — `MepSystemClassification += FuelSystemClassification`; `buildSegmentEndpointConnector` domain widened; `buildGasMeterOutletConnector` (fuel/out/fuel-gas) + `buildGasCookerSupplyConnector` (fuel/in/fuel-gas) + ids.
- `bim/types/mep-system-types.ts` — `MepFuelSystemParams` + `isFuelSystemParams` + `buildDefaultFuelNetworkParams` + `MepSystemType += 'fuel-network'`. `bim/types/mep-system.schemas.ts` — `MepFuelSystemParamsSchema` + discriminated-union arm.
- `bim/mep-systems/mep-system-color.ts` — `fuelClassificationDefaultColor` (`#eab308`/`#92400e`) + `isFuelClassification` + `resolveSegmentClassificationColor` fuel branch.
- `bim/renderers/MepSegmentRenderer.ts` — `DOMAIN_STROKE`/`DOMAIN_FILL` `'fuel'` entries (yellow).
- `config/bim-object-styles.ts` — `BimCategory += 'fuel'` + `BIM_CATEGORIES` + `MODEL_BIM_CATEGORIES` + `DEFAULT_OBJECT_STYLES`. `config/bim-subcategories.ts` — `SUBCATEGORY_TAXONOMY` `fuel: []`. `bim/discipline/bim-discipline.ts` — `DISCIPLINE_BY_CATEGORY` `fuel: 'mechanical'`.
- `bim/types/ifc-entity-mixin.ts` — `IfcFlowMeter` + `IfcBurner` in `IfcEntityType` **AND** `IFC_ENTITY_TYPE_VALUES` **AND** `IfcEntityTypeSchema` (the schema enum was also synced for 4 pre-existing missing entries — Boy-Scout).

**Slice 0b — fixtures + recognizer (outside ADR-040):**
- `bim/mep-fixtures/gas-meter-symbol-spec.ts` (source, dial+needle glyph) + `bim/mep-fixtures/gas-cooker-symbol-spec.ts` (terminal, 4-burner glyph).
- `bim/types/mep-fixture-types.ts` — kind union + `IfcFlowMeter`/`IfcBurner` + `resolveFixtureIfcType` + `resolveFixtureBimCategory` → `'fuel'`. `bim/types/mep-fixture.schemas.ts` — kind + IfcType enums.
- 8 fixture rails: `mep-fixture-symbol.ts` (dispatch), `mep-fixture-completion.ts` (connector seed), `useSpecialTools-placement-tools.ts`, `useCanvasClickHandler.ts`, `useMepFixtureTool.ts`, `tool-definitions.ts`, `ui/toolbar/types.ts` (ToolType union), `ui/ribbon/data/home-tab-draw.ts` (buttons).
- `systems/recognition/recognizers/gas-recognizer.ts` (flow-aware fuel inlet → terminal; narrows to fixture **or** boiler) + registered in `mep-recognition.ts` (recognizer count 6→7).
- i18n el+en: `tools.mepGas*`, `ribbon.commands.bim.mepGas*`.

**Slice 1 — headless engine (outside ADR-040), `systems/mep-design/gas/`:**
- `gas-design-types.ts`, `gas-flow-standard.ts` (`GasDemandStandard`), `gas-demand.ts`, `gas-sizing.ts` (`GasSizingStandard`), `gas-source-resolve.ts`, `gas-discipline.ts`, `design-gas.ts` (reuses `routeWallAware` + `wallObstacles`), `index.ts`.
- `systems/mep-design/registry/mep-discipline-registry.ts` — `gas` flipped `active` + standard ids. **8/8 active.**

**Slice 2 — preview + commit (STAGE ADR-040 CHECK 6B/6D):**
- `gas-proposal-store.ts` (low-freq), `commit/build-gas-commit.ts` (fuel segments via `completeMepSegmentFromTwoClicks(...,'fuel',...)` flat @ source elevation + `buildDefaultFuelNetworkParams`).
- `hooks/tools/useGasProposalGhostPreview.ts` (domain `'fuel'`, yellow stroke+fill SSoT) + `components/dxf-layout/canvas-layer-stack-gas-proposal-ghost.tsx` leaf.
- `ui/ribbon/hooks/useRibbonGasAutoBridge.ts` + `ui/ribbon/hooks/bridge/gas-auto-command-keys.ts`.
- Shared additive: `canvas-layer-stack-leaves.tsx` (mount), `useDxfBimBridges.ts`, `useDxfViewerRibbon.ts`, `useRibbonCommands(-types).ts`, `home-tab-draw.ts` («Αυτόματο Αέριο» submenu), `drawing-event-map.ts` (3 events), `useDxfViewerNotifications.ts` (3 toasts), i18n el+en.

---

## 5. Tests

- `systems/mep-design/gas/__tests__/gas-design.test.ts` — demand / sizing / source / orchestrator (8).
- `systems/mep-design/gas/commit/__tests__/build-gas-commit.test.ts` — fuel segments without classification, 1 fuel-network system, members, flat elevation, store (8).
- `bim/mep-fixtures/__tests__/mep-fixture-gas.test.ts` — guards/tool/glyph/IFC+fuel V/G/connector seed/recognizer flow-aware (6).
- Extended `mep-system-color.test.ts` (+fuel case) + `recognition.test.ts` (count 6→7).
- **Regression:** 60 mep-design/recognition/mep-fixtures/mep-system suites — 529 tests green.

---

## 6. Consequences

- **8/8 MEP disciplines complete.** The framework promise (ADR-423) held to the last discipline: a new network = a registry entry + a recognizer + (here) a thin new-system-family mirror. The preview/commit layer is now shared **verbatim across all 8 disciplines**.
- Gas piping is a first-class V/G discipline (`'fuel'` category, yellow), toggling independently of water pipes and air ducts — Revit-faithful.
- **Follow-ups:** thermal-output-derived demand; pressure-drop (Renouard) sizing; LPG/oil services; gas-meter as a full Mechanical-Equipment entity; 3D fuel-pipe BOQ category.

---

## 7. Changelog

- **2026-06-10 (Opus 4.8)** — Slices 0 + 0b + 1 + 2 implemented (full vertical slice). New `fuel` segment domain + `fuel-network` system family + gas-meter/gas-cooker fixtures + `gas-recognizer` + `systems/mep-design/gas/` engine + registry flip (8/8 active) + preview/commit + ribbon «Αυτόματο Αέριο». 22 new tests, 529 regression green. **Closes ADR-434 v1.**
