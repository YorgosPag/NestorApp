# ADR-433 — Fire-Protection / Sprinkler Auto-Design (7th MEP discipline)

> **Status:** 🟢 Slices 0 + 0b (foundation + fixtures/recognizer) + 1 (headless engine) + 🟢 Slice 2 (preview + commit) IMPLEMENTED — 2026-06-09 (Opus 4.8). Child-ADR of **ADR-423** (MEP Auto-Design framework). The **3rd pure pressurised-pipe discipline** (after water-supply and 2-pipe heating): it produces physical round **pipes** (`mep-segment` domain `'pipe'`) that CARRY the `fire-sprinkler` classification — a faithful mirror of the water-supply pilot (ADR-426), NOT the HVAC duct. Revit "Generate → review → accept" is live on the canvas (ribbon «Αυτόματη Πυρόσβεση»).
> **Scope (v1):** turn a recognized storey into a **proposed wet-pipe sprinkler network** — Demand (design flow) → Source (fire riser) → Routing → Sizing — as pure data (`FireNetworkProposal`), then commit it to real pipes + the EXISTING `pipe-network` `MepSystem`. **Sprinkler (wet pipe) only**; standpipe / hose-reel / dry-pipe are future services.
> **Decision driver (Giorgio, 2026-06-09):** *«FULL ENTERPRISE + FULL SSOT, όπως Revit / MagiCAD / 4M FINE / Hydratec»*. Fire protection reuses the framework's router + preview/commit layer + the existing pipe-network system as **parameters, not a new engine** (ADR-423 §6).

---

## 1. Context

ADR-423 makes every MEP network one graph (Source → Distribution → Terminals). Six disciplines (water, drainage, heating, electrical-strong, electrical-weak, HVAC) were live; fire protection is the 7th and was a **reserved** registry slot with no code.

A code sweep before writing anything confirmed the discipline registry already typed fire protection as **`flowModel: 'pressurised'`** — the decisive fact. Pressurised fire water is **plumbing** (it flows through pipes under pressure, exactly like cold/hot supply), so fire protection is a *pipe* discipline, not a duct one. That means it reuses, untouched: the `'pipe'` segment domain, the existing **`pipe-network` `MepSystem`** (Φ9), the shared A\* router (ADR-429), and the proposal/commit/ghost layer (ADR-426 Slice 2). The genuinely-new pieces are minimal: a new `fire-sprinkler` plumbing classification + its fire-red colour, two fixture kinds (sprinkler head terminal + fire riser source), a recognizer, and the fire **demand + sizing** standards.

The defining difference from HVAC (the previous new discipline): a duct segment carries **no** classification (the System owns the air type), so HVAC had to found a new `duct-network` system family. A fire pipe, like every water pipe, **carries its classification on the segment** — so fire protection needs **NO new system type**: it commits onto the existing `pipe-network` `MepSystem` with `systemClassification: 'fire-sprinkler'`. This is the cheapest possible new discipline — a registry flip + a colour + two fixtures + a demand/sizing table.

---

## 2. Decision

A four-stage pipeline over the Stage 0 `RecognitionModel`, parameterised by the fire-protection discipline descriptor (ADR-423 §4 registry entry):

```
RecognitionModel ─▶ Demand (L/min) ─▶ Source (riser outlet) ─▶ Routing (Manhattan + A* wall-aware) ─▶ Sizing (Σflow→DN) ─▶ FireNetworkProposal
```

- **Stage 1 Demand** — each recognized sprinkler head's `fire-sprinkler` pipe inlet → `SprinklerDemand` (design discharge flow L/min + world point). Flow from a **pluggable `FireDemandStandard`** (v1: constant 80 L/min/head ≈ NFPA 13 light-hazard density 5 mm/min × ~12 m² coverage; a full per-hazard-class density × area-of-operation model, or the explicit K-factor Q = K·√P, swaps in behind the interface).
- **Stage 2 Source** — resolve the network origin from a recognized fire riser (στήλη) `fire-sprinkler` pipe outlet (`flow:'out'`). Connector-driven (entity-agnostic, mirror of the HVAC AHU resolve), the classification guard keeps non-fire pipe outlets out. **Missing source ⇒ warning, not error** (honest pilot).
- **Stage 3 Routing** — the **shared** `routeWallAware` (ADR-429) the other 3 pipe disciplines use: a root-outward Manhattan trunk-branch spine carrying cumulative flow, A\*-detoured around walls. Design flow is the cumulative-sum driver (the router's `loadingUnits` is a flow proxy). NO new router.
- **Stage 4 Sizing** — cumulative flow → nominal DN from a **pluggable `FireSizingStandard`** (v1: velocity-limited, v ≤ ~6 m/s wet pipe, pre-evaluated as a step table). Trunk near the riser = big DN, branch to one head = small DN → **diameters diminish toward the heads** (Revit / Hydratec-correct).

Output: `FireNetworkProposal` = sprinkler `ProposedNetwork`(s) (sized, routed pipe runs + riser source + served heads + Σflow) + honest `warnings`. **Transient — never persisted.** Accept turns it into real entities via a `CompoundCommand`.

### 2b. Why NO new system type (the cheap-discipline insight)

A `mep-segment` of domain `'pipe'` **carries** its `classification` (pipe-only field). So the `fire-sprinkler` classification rides on every emitted segment, and the commit reuses the existing `buildDefaultPipeNetworkParams` (`MepSystemType 'pipe-network'`, `systemClassification: 'fire-sprinkler'`) — the SAME system family water/heating use. No `duct-network`-style new foundation was needed. The colour-by-system, the 2D/3D renderers, the fittings reconciler, the BOQ all read the new classification through the existing pipe code paths for free; only its industry colour and ATOE category are new data points.

---

## 3. Slicing (Revit-grade incremental)

| Slice | Scope | Status |
|------|-------|--------|
| **0** | Foundation: `fire-sprinkler` `PlumbingSystemClassification` + schema + fire-red colour (`#b91c1c`) in `classificationDefaultColor` + `buildSprinklerSupplyConnector` / `buildFireRiserSupplyConnector` + ATOE category ΗΛΜ-19.01 + manual pipe classification dropdown option | 🟢 DONE |
| **0b** | Fixtures + recognizer: `sprinkler` (head terminal) + `fire-riser` (source) `mep-fixture` kinds (symbol specs + IFC + V/G + connector seed + tool rails + ribbon buttons) + flow-aware `sprinkler-recognizer` | 🟢 DONE |
| **1** | Headless engine `systems/mep-design/fire/`: design-types + demand + flow-standard + sizing + source-resolve + discipline descriptor + `designFire` orchestrator; registry flip `fire-protection` → active | 🟢 DONE |
| **2** | Preview + commit: low-freq `fire-proposal-store` + pure `build-fire-commit` (pipe WITH classification) + ghost leaf (`#b91c1c`, domain `'pipe'`) + `useRibbonFireAutoBridge` + ribbon «Αυτόματη Πυρόσβεση» Generate/Accept/Reject + 3 toasts | 🟢 DONE |

---

## 4. Architecture (files)

**Slice 0 — foundation (outside ADR-040):**
- `bim/types/mep-connector-types.ts` — `+'fire-sprinkler'` in `PlumbingSystemClassification`; `buildSprinklerSupplyConnector` (pipe/flow:in) + `buildFireRiserSupplyConnector` (pipe/flow:out) + ids.
- `bim/types/mep-connector.schemas.ts` — enum entry.
- `bim/mep-systems/mep-system-color.ts` — `classificationDefaultColor` case `#b91c1c` + `ALL_PLUMBING_CLASSIFICATIONS` entry (so `resolveSegmentClassificationColor` + `isDefaultClassificationColor` pick it up automatically).
- `bim/config/bim-to-atoe-mapping.ts` — `MEP_SEGMENT_PIPE_MAPPING` ΗΛΜ-19.01 entry (the `Record<PlumbingSystemClassification, …>` is exhaustive → mandatory).
- `ui/ribbon/data/contextual-mep-segment-tab.ts` — manual pipe `CLASSIFICATION_OPTIONS` fire-sprinkler entry.

**Slice 0b — fixtures + recognizer (outside ADR-040):**
- NEW `bim/mep-fixtures/sprinkler-symbol-spec.ts` (round head + deflector cross glyph, circular, Ø150, pipe inlet Ø20) + `fire-riser-symbol-spec.ts` (riser circle + fire-cross + valve bow-tie, rectangular 300, pipe outlet DN65).
- `bim/types/mep-fixture-types.ts` (+kinds; `IfcFireSuppressionTerminal` / `IfcFlowController`; shared `'pipe'` V/G category) + `mep-fixture.schemas.ts`.
- Fixture rails: `mep-fixture-symbol.ts` dispatch · `mep-fixture-completion.ts` connector seed + placement defaults · `useMepFixtureTool.ts` status · `useSpecialTools-placement-tools.ts` tool→kind · `useCanvasClickHandler.ts` gate · `tool-definitions.ts` · `ui/toolbar/types.ts` ToolType union · `home-tab-draw.ts` ribbon buttons.
- NEW `systems/recognition/recognizers/sprinkler-recognizer.ts` (flow-aware: pipe INLET `fire-sprinkler` → terminal; riser OUT ignored) + registered in `mep-recognition.ts`.

**Slice 1 — headless engine (outside ADR-040), `systems/mep-design/fire/`:**
- `fire-design-types.ts` · `fire-flow-standard.ts` (`FireDemandStandard`) · `fire-demand.ts` · `fire-sizing.ts` (`FireSizingStandard`) · `fire-source-resolve.ts` · `fire-protection-discipline.ts` · `design-fire.ts` (reuse `routeWallAware` + `wallObstacles`) · `index.ts`.
- `registry/mep-discipline-registry.ts` — `fire-protection` reserved → **active** + `classifications: ['fire-sprinkler']` + standard ids.

**Slice 2 — preview/commit (Slice-2 leaf staged into ADR-040), `systems/mep-design/fire/`:**
- NEW `fire-proposal-store.ts` (low-freq, ⚠️ ADR-040 header) · `commit/build-fire-commit.ts` (pure; pipe segments via `completeMepSegmentFromTwoClicks(...,'pipe',{classification:'fire-sprinkler',diameter})` flat @ `sourceElevationMm` + `buildDefaultPipeNetworkParams`; members = `pipeSegmentMembers` ∪ `servedConnectors`).
- NEW `hooks/tools/useFireProposalGhostPreview.ts` (domain `'pipe'`, stroke = SSoT `resolveSegmentClassificationColor('fire-sprinkler')`) + `components/dxf-layout/canvas-layer-stack-fire-proposal-ghost.tsx` leaf.
- NEW `ui/ribbon/hooks/useRibbonFireAutoBridge.ts` + `bridge/fire-auto-command-keys.ts`.
- SHARED additive: `canvas-layer-stack-leaves.tsx` · `useDxfBimBridges.ts` · `useDxfViewerRibbon.ts` · `useRibbonCommands.ts`(+`-types`) · `home-tab-draw.ts` submenu · `drawing-event-map.ts` (3 events) · `useDxfViewerNotifications.ts` (3 toasts) · i18n el+en.

---

## 5. Standards (pluggable, transparent)

| Stage | Standard (v1) | id | Swap-in later |
|-------|---------------|----|----|
| Demand | NFPA 13 light-hazard, constant 80 L/min/head | `NFPA13/light-hazard(80lpm-per-head)` | per-hazard-class density × area-of-operation; K-factor Q = K·√P |
| Sizing | velocity-limited wet pipe (v ≤ ~6 m/s) | `velocity-limited(v≤6m/s,wet)` | Hazen-Williams head loss + solved area-of-operation |

Both live behind the discipline descriptor (`FIRE_PROTECTION_DISCIPLINE`), declared in the registry's `demandStandardId` / `sizingStandardId` for transparency — never hard-coded in the engine.

---

## 6. Tests

- `bim/mep-fixtures/__tests__/mep-fixture-fire.test.ts` — kind guards, tool mapping, glyphs, IFC + V/G, connector seed (in/out), recognizer flow-awareness.
- `systems/mep-design/fire/__tests__/fire-design.test.ts` — demand, sizing (velocity-limited steps), source resolve, orchestrator (wet-pipe network + missing-source warning).
- `systems/mep-design/fire/commit/__tests__/build-fire-commit.test.ts` — segment count, pipe **carries** classification, one `pipe-network` MepSystem, members, flat elevation, proposal store.
- `bim/mep-systems/__tests__/mep-system-color.test.ts` + `recognition.test.ts` — extended for the new classification colour + the 6th recognizer.

All green; zero regression across all `mep-design` / `recognition` / `mep-fixtures` suites.

---

## 7. Decisions taken (Revit-grade, autonomous)

1. **Source = new `fire-riser` fixture kind** (not a reused manifold): semantic clarity, rides fixture rails (~250 lines vs a ~2500-line standalone entity). Connector-driven resolve → a future standalone fire-pump entity drops in for free.
2. **Colour `#b91c1c`** (deep fire-red), deliberately distinct from hot-water `#dc2626`.
3. **Demand 80 L/min/head** constant (NFPA 13 light hazard), pluggable.
4. **Sizing velocity-limited** (v ≤ 6 m/s wet pipe), pluggable.
5. **No new system type** — commit onto the existing `pipe-network` (the segment carries the classification).

---

## 8. Changelog

- **2026-06-09 (Opus 4.8):** ADR created. Slices 0 + 0b + 1 + 2 implemented in one session (full vertical slice). Fire protection is the 7th MEP discipline and the 3rd pure pressurised-pipe consumer — a faithful mirror of the water-supply pilot (ADR-426). The preview/commit layer is now shared verbatim across all 6 auto-design disciplines (water, drainage, heating, electrical-strong, electrical-weak, HVAC, fire). Next: standpipe/hose-reel service; full hydraulic demand/sizing; fire-pump entity promotion; 8th discipline = gas.
