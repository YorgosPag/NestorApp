# ADR-432 — HVAC / Ventilation Auto-Design (5th MEP discipline)

> **Status:** 🟢 Slices 0a + 0b + 1 (foundation + headless engine) + 🟢 Slice 2 (preview + commit) IMPLEMENTED — 2026-06-09 (Opus 4.8). Child-ADR of **ADR-423** (MEP Auto-Design framework). The **first air discipline** — it produces physical round **ducts** (`mep-segment` domain `'duct'`), not logical circuits, so it founds a genuinely new system family: the **`duct-network` `MepSystem`** (mirror of the ADR-408 Φ9 pipe-network). Revit "Generate → review → accept" is now live on the canvas (ribbon «Αυτόματος Αερισμός»).
> **Scope (v1):** turn a recognized storey into a **proposed supply-air duct network** — Demand (air-flow) → Source (AHU) → Routing → Duct Sizing — as pure data (`DuctNetworkProposal`), then commit it to real round ducts + a `duct-network` `MepSystem`. **Supply-air only**; return-air is a follow-up slice.
> **Decision driver (Giorgio, 2026-06-09):** *«FULL ENTERPRISE + FULL SSOT, όπως Revit / MagiCAD / 4M FINE»*. HVAC reuses the framework's router + preview/commit layer as **parameters, not a new engine** (ADR-423 §6).

---

## 1. Context

ADR-423 makes every MEP network one graph (Source → Distribution → Terminals). Four disciplines (water, drainage, heating, electrical) were live; HVAC is the 5th. A code sweep before writing anything confirmed the air domain had **no** foundation: no duct-network system type, no air-flow demand, no duct sizing, no AHU/air-terminal fixtures. Everything below the recognition layer that already existed — segments (`'duct'` domain was already a `MepSegmentDomain`), fittings, the shared A\* router, the proposal/commit/ghost layer — is reused untouched.

The defining difference from electrical (the previous new discipline): electrical output is **logical/derived** (circuits, wiring rendered for free). HVAC output is **physical geometry** (ducts you draw), so it is pipe-style — it reuses the water/drainage/heating engine, not the electrical one. The genuinely-new pieces are the **air medium** (m³/h, not LU), **round-duct sizing** (ASHRAE equal-friction), the **AHU source**, and the **`duct-network` system family**.

---

## 2. Decision

A four-stage pipeline over the Stage 0 `RecognitionModel`, parameterised by the HVAC discipline descriptor (ADR-423 §4 registry entry):

```
RecognitionModel ─▶ Demand (m³/h) ─▶ Source (AHU outlet) ─▶ Routing (Manhattan + A* wall-aware) ─▶ Duct Sizing (Σcmh→round Ø) ─▶ DuctNetworkProposal
```

- **Stage 1 Demand** — each recognized air terminal's supply connector → `TerminalAirDemand` (design air-flow m³/h + world point). Air-flow from a **pluggable `AirDemandStandard`** (v1: constant 150 m³/h/terminal — a validated per-space ventilation-rate standard, e.g. ΚΕΝΑΚ / EN 16798, swaps in behind the interface later).
- **Stage 2 Source** — resolve the network origin from a recognized AHU (ΚΚΜ) supply-air duct outlet (`flow:'out'`, `'supply-air'`). **Missing source ⇒ warning, not error** (honest pilot).
- **Stage 3 Routing** — the **shared** `routeWallAware` (ADR-429) the other 3 pipe disciplines use: a root-outward Manhattan trunk-branch spine carrying cumulative air-flow, A\*-detoured around walls. Air-flow is the cumulative-sum driver (the router's `loadingUnits` is an air-flow proxy). NO new router.
- **Stage 4 Duct Sizing** — cumulative air-flow → round duct Ø from a **pluggable `DuctSizingStandard`** (ASHRAE equal-friction step table). Trunk near the AHU = big Ø, branch to one terminal = small Ø → **diameters diminish toward the terminals** (Revit-correct).

Output: `DuctNetworkProposal` = supply `ProposedDuctNetwork`(s) (sized, routed duct runs + AHU source + served terminals + Σcmh) + honest `warnings`. **Transient — never persisted.** Accept turns it into real entities via a `CompoundCommand`.

### 2b. Why a new `duct-network` `MepSystem` (the genuinely-new foundation)

A `mep-segment` of domain `'duct'` carries **no** classification (the `classification` field is pipe-only). The air classification (`'supply-air'`) is owned by the **System**, exactly as a pipe-network owns its plumbing classification. So HVAC needed a new `MepSystemType 'duct-network'` (`MepDuctSystemParams` + `isDuctSystemParams` + `buildDefaultDuctNetworkParams`) — a structural mirror of the Φ9 pipe-network. Every `isPipe`/`isElectrical` guard in the System backbone is an **if-check, not an exhaustive switch**, so the new arm is zero-regression.

---

## 3. Slicing (Revit-grade incremental)

| Slice | Scope | Status |
|---|---|---|
| **0a** | `duct-network` domain foundation: `MepSystemType 'duct-network'` + params/guard/builder; `DuctSystemClassification` += `supply-air`/`return-air`; `ductClassificationDefaultColor` + widened `resolveSegmentClassificationColor`; air connectors (`buildAirTerminalSupplyConnector` in, `buildAhuSupplyAirConnector` out). Outside ADR-040. | 🟢 done |
| **0b** | `air-terminal` (στόμιο, Ø125) + `ahu` (ΚΚΜ, Ø250 plenum 2800 mm) as **`mep-fixture` kinds** (ride the fixture rails — placement/persistence/3D/tool free); air-terminal recognizer (flow-aware: duct **inlet** = terminal). Outside ADR-040. | 🟢 done |
| **1** | Headless engine (`systems/mep-design/hvac/`): Demand + Source + shared routing + ASHRAE duct sizing → `DuctNetworkProposal`. Registry `hvac` flipped `active`. Outside ADR-040. | 🟢 done |
| **2 (this)** | Preview + commit: proposal store + ghost mount + accept → `CompoundCommand` emit duct `mep-segment`s + a `CreateMepSystemCommand` (`duct-network`); fittings auto-appear. Touches ADR-040. | 🟢 done |
| **3+** | Return-air network (supply/return pairing, mirror water cold/hot), AHU auto-placement, validated per-space ventilation-rate demand, full duct fittings. | ⬜ |

**AHU = a `mep-fixture` kind, not a standalone Mechanical-Equipment entity (autonomous decision, flagged for veto).** It rides the existing fixture pipeline (~250 added lines) instead of a ~2500-line boiler-style entity mirror. Source resolve is connector-driven (find the entity with a supply-air duct OUT). Promotion to a full entity is a future refinement.

---

## 4. Files (all ≤500 lines, functions ≤40) — `src/subapps/dxf-viewer/systems/mep-design/hvac/`

| File | Role | Slice |
|---|---|---|
| `hvac-design-types.ts` | SSoT types (`AirService`, `TerminalAirDemand`, `ProposedDuctSegment/Network`, `DuctNetworkProposal`) | 1 |
| `air-flow-standard.ts` | constant-air-flow `AirDemandStandard` (150 m³/h, pluggable) | 1 |
| `duct-sizing.ts` | ASHRAE equal-friction Σcmh→round Ø table + `DuctSizingStandard` | 1 |
| `hvac-air-demand.ts` | `buildHvacDemandModel` (mirror water-demand) | 1 |
| `hvac-source-resolve.ts` | connector-driven AHU resolve (`HvacSource`) | 1 |
| `hvac-discipline.ts` | the discipline descriptor (standards + services) | 1 |
| `design-hvac.ts` | the orchestrator (REUSE `routeWallAware` + `wallObstacles`) | 1 |
| `index.ts` | barrel | 1 |
| `hvac-proposal-store.ts` | LOW-FREQ proposal store (ADR-040): `set` on Generate, `reset` on Accept/Reject + `useHvacProposal()` leaf hook | 2 |
| `commit/build-hvac-commit.ts` | **pure** `DuctNetworkProposal` → `{segmentEntities, systemEntities}` (reuses `completeMepSegmentFromTwoClicks(...,'duct',{sectionKind:'round',diameter})` + `pipeSegmentMembers` + `buildDefaultDuctNetworkParams`) | 2 |
| `__tests__/hvac-design.test.ts` | 7 tests (demand/sizing/source/orchestrator) | 1 |
| `commit/__tests__/build-hvac-commit.test.ts` | 8 tests (duct segments, duct-network system, members, no-classification, flat elevation, SSoT colour, store) | 2 |

**Slice 2 wiring (outside the engine folder):** `hooks/tools/useHvacProposalGhostPreview.ts` + `components/dxf-layout/canvas-layer-stack-hvac-proposal-ghost.tsx` (micro-leaf ghost, `domain:'duct'`, SSoT classification colour); `ui/ribbon/hooks/useRibbonHvacAutoBridge.ts` + `bridge/hvac-auto-command-keys.ts` (Generate/Accept/Reject); MOD `canvas-layer-stack-leaves.tsx`, `home-tab-draw.ts`, `useRibbonCommands.ts`(+`-types`), `useDxfBimBridges.ts`, `useDxfViewerRibbon.ts`, `useDxfViewerNotifications.ts`, `drawing-event-map.ts`, locales el+en (wiring; mount, ribbon submenu, bridge compose, toasts, events, i18n).

**Reuse (zero duplication):** Stage 0 `RecognitionModel`, the shared `routeWallAware`/`wallObstacles` router (ADR-429), `completeMepSegmentFromTwoClicks` (segment SSoT), `pipeSegmentMembers` (domain-agnostic members SSoT), `MepSegmentGhostRenderer` (`domain:'duct'` already in its palette), `resolveSegmentClassificationColor`/`ductClassificationDefaultColor` (colour SSoT), `CreateMepSegmentsCommand` + `CreateMepSystemCommand` + `CompoundCommand`, the auto-fitting reconciler.

---

## 5. Standards (pluggable, never hard-coded in the engine)
- **Demand:** constant 150 m³/h per air terminal (v1 placeholder for a per-space ventilation-rate standard — ΚΕΝΑΚ / EN 16798-1). Behind `AirDemandStandard`.
- **Sizing:** ASHRAE equal-friction step table (cumulative m³/h → round duct Ø). Behind `DuctSizingStandard`. A validated equal-friction / static-regain engine swaps in behind the same interface.

---

## 6. Test coverage
15 tests / 2 suites, all green. **Engine (7):** demand (per-terminal air-flow), duct sizing (ascending Ø steps), AHU source resolve (connector-driven; missing-source warning), orchestrator (supply network + warning when no AHU). **Commit (8):** one round-duct segment per proposed run (`domain:'duct'`, `sectionKind:'round'`), a duct segment carries **no** classification (System owns it), one `duct-network` `MepSystem` with `supply-air` classification + AHU source, SSoT `#38bdf8` palette seed, members = segment endpoints ∪ served terminal connectors, every duct flat at the AHU outlet elevation (Revit "Connect To"), empty proposal yields nothing, store set/get/reset. Full `mep-design` + `recognition` + `mep-fixtures` regression green (266/266).

---

## 7. Next steps
- **Slice 3** — return-air network (supply/return offset pairing, mirror water cold/hot + heating supply/return), AHU auto-placement, validated per-space ventilation-rate demand, full duct fittings/transitions.
- **Promotion** — AHU from a fixture kind to a full Mechanical-Equipment entity if richer parametrics (coils, fans, filters) are needed.

---

## Changelog
- **2026-06-09 (Opus 4.8)** — **Slice 2 IMPLEMENTED (preview + commit).** Revit "Generate → review → accept" on the canvas: ribbon «Αυτόματος Αερισμός» (Generate/Accept/Reject) → recognize storey (ADR-425) + `designHvac` (Slice 1) → LOW-FREQUENCY `hvac-proposal-store` (ADR-040-safe: writes only on the 3 discrete actions, never per-frame; shell never subscribes — CHECK 6C) → micro-leaf ghost reusing `MepSegmentGhostRenderer` (`domain:'duct'`, stroke = SSoT `resolveSegmentClassificationColor('supply-air')` = `#38bdf8`, half-width ∝ sized Ø; **zero hardcoded palette**). Accept → pure `buildHvacCommit` → one atomic `CompoundCommand` (`CreateMepSegmentsCommand` of round ducts + a `CreateMepSystemCommand` for the `duct-network`); the duct segment carries **no** classification (the System owns `supply-air` via `buildDefaultDuctNetworkParams`, seeded with the SSoT colour); members = segment endpoints ∪ proposal `servedConnectors`; runs flat at the AHU outlet elevation; the auto-fitting reconciler grows the fittings afterwards. Reject = `store.reset()` (zero Firestore). **The preview/commit layer is now reused VERBATIM across all 5 disciplines** (same stores/commands/ghost-renderer; only the proposal shape + duct domain differ). 15 HVAC tests / 2 suites green; 266/266 mep-design+recognition+mep-fixtures regression green. FULL SSOT — zero fork of the manual duct-draw / system / fitting paths. i18n el+en. ADR-040 staged (CHECK 6B/6D). See **ADR-423**.
- **2026-06-09 (Opus 4.8)** — ADR created + Slices 0a/0b/1 IMPLEMENTED (foundation + headless engine). NEW `duct-network` `MepSystem` family (mirror Φ9 pipe-network) + `supply-air`/`return-air` classifications + duct palette; `air-terminal` + `ahu` as `mep-fixture` kinds + flow-aware air-terminal recognizer; four-stage HVAC auto-design (`systems/mep-design/hvac/`) reusing the shared A\* router + ASHRAE duct sizing + connector-driven AHU source → `DuctNetworkProposal` (supply-air only, transient). Registry `hvac` flipped `active`. Pluggable demand/sizing standards. 127/127 mep-design green. Outside ADR-040. Builds on ADR-425 (recognition), ADR-408 (segments/fittings/connectors), ADR-429 (router), ADR-423 (framework).
