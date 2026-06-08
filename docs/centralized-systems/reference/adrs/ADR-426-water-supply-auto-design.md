# ADR-426 — Water-Supply Auto-Design (the pilot discipline)

> **Status:** 🟢 Slice 1 (headless engine) + 🟢 Slice 2 (preview + commit) IMPLEMENTED — 2026-06-08 (Opus 4.8). Child-ADR of **ADR-423** (MEP Auto-Design framework). The first discipline that proves the framework end-to-end, consuming the Stage 0 recognition layer (**ADR-425**). Revit "Generate → review → accept" is now live on the canvas (ribbon «Αυτόματη Ύδρευση»).
> **Scope:** turn a recognized storey into a **proposed cold + hot water network** — Demand → Source → Routing → Sizing — as pure data (`WaterNetworkProposal`). **Slice 1 is headless**: no canvas, no commit, no persistence. Slice 2 turns the proposal into real `mep-segment`s + a `MepSystem`.
> **Decision driver (Giorgio, 2026-06-08):** *«FULL ENTERPRISE + FULL SSOT, όπως η Revit»*. Water supply is the pilot (ADR-423 §6); every later discipline reuses this engine as *parameters, not a new engine*.

---

## 1. Context

ADR-423 §6 makes water supply the pilot that proves the single-engine vision. The Stage 0 recognition layer (ADR-425) already yields classified spaces + recognized sanitary terminals (with their cold/hot/drain connectors) + sources. What was missing — confirmed by a code sweep before writing anything — is the **brain on top**: there is **no** demand model (Loading Units), **no** sizing (flow→Ø), and **no** pipe router anywhere in the codebase. Everything below the recognition layer (segments, fittings, networks, 3D, BOQ) already exists and is reused untouched.

---

## 2. Decision

A four-stage pipeline over the Stage 0 `RecognitionModel`, parameterised by a **discipline descriptor** (the seed of the ADR-423 §4 `MepDisciplineRegistry`):

```
RecognitionModel ─▶ Demand (LU) ─▶ Source resolve ─▶ Routing (Manhattan) ─▶ Sizing (ΣLU→DN) ─▶ WaterNetworkProposal
```

- **Stage 1 Demand** — each recognized terminal's supply connectors → `FixtureDemand` (Loading Units per service + world point). LU from a **pluggable `DemandStandard`** (EN 806 / DIN 1988-3 table). This is the *demand* figure, distinct from the nominal connector DN.
- **Stage 2 Source** (pilot) — resolve the network origin from the recognized manifold/boiler outlet matching the service classification. **Missing source ⇒ warning, not error** (auto-placement is a later slice — honest pilot).
- **Stage 3 Routing** — a **deterministic orthogonal (Manhattan) trunk-branch router** (ADR-423 §8 "deterministic orthogonal first"): a spine from the source along the dominant-spread axis, bidirectional arms, each fixture taps off via an orthogonal drop. Each trunk run carries the **cumulative LU** of everything fed through it; each branch carries one fixture's LU. NOT yet wall-obstacle-aware — architected so a later A* slice swaps `routeOrthogonalTrunkBranch` with the contract unchanged.
- **Stage 4 Sizing** — cumulative LU → DN from a **pluggable `SizingStandard`** (simplified DIN 1988-3 peak-flow table). Trunk near the source = big DN, branch to one fixture = small DN → **diameters diminish toward the terminals** (Revit-correct). A validated hydraulic engine (Colebrook/CIBSE, velocity, pressure-drop — ADR-423 §4 gap) swaps in behind the same interface later.

Output: `WaterNetworkProposal` = cold + hot `ProposedNetwork`s (sized, routed segments + source + served terminals + ΣLU) + honest `warnings`. **Transient — never persisted.**

---

## 3. Slicing (Revit-grade incremental)

| Slice | Scope | Status |
|---|---|---|
| **1 (this)** | Headless engine: Demand + Routing + Sizing → `WaterNetworkProposal`. Pure, tested, integration-printed. Outside ADR-040. | 🟢 done |
| **2 (this)** | Preview + commit: proposal store + ghost mount + accept → `CompoundCommand` emit `mep-segment`s + `CreateMepSystemCommand`; fittings auto-appear. Touches ADR-040. | 🟢 done |
| **3+** | Wall-obstacle-aware routing (A*), auto-place source, hot-water recirculation (DHWR), validated hydraulics. | ⬜ |

Headless-first mirrors ADR-425: prove the hard logic (LU/router/sizing) with tests before any canvas risk.

---

## 4. Files (all ≤500 lines, functions ≤40) — `src/subapps/dxf-viewer/systems/mep-design/water/`

| File | Role |
|---|---|
| `water-design-types.ts` | SSoT types (`WaterService`, `FixtureDemand`, `ProposedSegment/Network`, `WaterNetworkProposal`) |
| `water-loading-units.ts` | EN806/DIN1988-3 LU table + `DemandStandard` |
| `water-sizing.ts` | DIN1988-3 ΣLU→DN table + `SizingStandard` |
| `water-supply-discipline.ts` | the discipline descriptor (registry-entry seed, ADR-423 §4) |
| `connector-resolve.ts` | host connector world point (reuse `connectorWorldPosition`) |
| `water-source-resolve.ts` | resolve source per classification |
| `water-demand.ts` | `buildWaterDemandModel` |
| `orthogonal-router.ts` | `routeOrthogonalTrunkBranch` (Manhattan trunk-branch) |
| `design-water-supply.ts` | the orchestrator |
| `index.ts` | barrel |
| `__tests__/water-design.test.ts` | 7 tests (demand/sizing/router/orchestrator) |
| `__tests__/water-design.integration.test.ts` | realistic bathroom, printed proposal |

**Reuse (zero duplication):** Stage 0 `RecognitionModel`/`isRecognizedTerminal`, `connectorWorldPosition`, `getEntityConnectors`, the source entity guards, `PlumbingSystemClassification`. Slice 2 will reuse `completeMepSegmentFromTwoClicks` + `buildDefaultPipeNetworkParams` + `CreateMepSystemCommand` + the auto-fitting reconciler.

### 4b. Slice 2 files (preview + commit)

| File | Role | New/Mod |
|---|---|---|
| `water/water-proposal-store.ts` | LOW-FREQ proposal store (ADR-040): `set` on Generate, `reset` on Accept/Reject + `useWaterProposal()` leaf hook | NEW |
| `water/commit/build-water-supply-commit.ts` | **pure** `WaterNetworkProposal` → `{segmentEntities, systemEntities}` (reuses `completeMepSegmentFromTwoClicks` + `pipeSegmentMembers` + `buildDefaultPipeNetworkParams`) | NEW |
| `core/commands/entity-commands/CreateMepSegmentsCommand.ts` | batch segment create (one undo) — scene via `ISceneManager`, Firestore via deferred `drawing:entity-created` per segment (precedent `MergeColumnsCommand`) | NEW |
| `hooks/tools/useWaterProposalGhostPreview.ts` + `components/dxf-layout/canvas-layer-stack-water-proposal-ghost.tsx` | micro-leaf ghost: reuses `MepSegmentGhostRenderer` per run, cold=teal/hot=warm-red, half-width ∝ sized DN | NEW |
| `ui/ribbon/hooks/useRibbonWaterAutoSupplyBridge.ts` + `bridge/water-auto-supply-command-keys.ts` | Generate/Accept/Reject bridge (recognize → `designWaterSupply` → store; accept → `CompoundCommand`) | NEW |
| `MepSegmentGhostRenderer.ts` | +optional `strokeOverride`/`fillOverride` (manual-tool default unchanged) | MOD |
| `canvas-layer-stack-leaves.tsx`, `home-tab-draw.ts`, `useRibbonCommands.ts`, `useDxfBimBridges.ts`, `useDxfViewerRibbon.ts`, `useDxfViewerNotifications.ts`, `drawing-event-map.ts`, `water/index.ts`, locales el+en | wiring (mount, ribbon submenu, bridge compose, toasts, events, barrel, i18n) | MOD |

**Slice 2 tests:** `__tests__/water-supply-commit.test.ts` (commit builder: segment count, 1 system/network, classification+source, members = endpoints ∪ servedConnectors) + `core/commands/.../CreateMepSegmentsCommand.test.ts` (symmetric scene add/remove across execute/undo/redo, validation, affected ids) — **12 tests / 2 suites green**. Fittings are NOT built here: the auto-reconciler grows elbows/tees once segments land.

---

## 5. Standards (pluggable, never hard-coded in the engine)
- **Demand:** EN 806 / DIN 1988-3 Loading Units — `wc` 1c/0h, `washbasin`/`bidet` 1c/1h, `shower` 2c/2h, `bathtub` 4c/4h.
- **Sizing:** simplified DIN 1988-3 peak-flow ΣLU→DN — ≤1→15, ≤4→18, ≤10→22, ≤20→28, ≤50→35, ≤100→42, else 54 mm.

Both behind interfaces in the discipline descriptor → a different code (CIPHE BS 8558, etc.) is a new table, not an engine change.

---

## 6. Test coverage
8 tests / 2 suites, all green: demand (cold-only WC vs cold+hot washbasin, correct LU), sizing (ascending DN steps + max), router (diminishing trunk cumulative LU + branch drops, two-arm bidirectional, empty), orchestrator (cold network + missing-hot-source warning; both networks when both sources exist), integration (realistic bathroom: COLD ΣLU=6 DN{15,18,22}, HOT ΣLU=5, diminishing trunk ≥ branch).

---

## 7. Next steps
- **Slice 3** — wall-obstacle-aware routing (A*), auto-place source, hot-water recirculation (DHWR), validated hydraulics (Colebrook/CIBSE).
- **Generalise** (ADR-423 §6 step 4) — promote the water-specific descriptor into the full `MepDisciplineRegistry`; drainage becomes the 2nd descriptor (its own flow model + EN 12056 standards).

---

## Changelog
- **2026-06-08 (Opus 4.8)** — **Slice 2 follow-up: elevation-at-source.** Browser verify showed the committed pipes sat at the default ceiling centreline (2800 mm), disconnected from the low source/fixtures. Fix: the proposal now carries `sourceElevationMm` (the source outlet's world mm elevation, from the SSoT `resolveMepConnectorElevationMmAt`), and the commit builder passes it as every segment's start+end elevation → the network is built flat at the manifold/boiler outlet height (~400 mm), exactly like the manual pipe tool inheriting a snapped connector's elevation (Revit "Connect To"). Files: `water-source-resolve.ts` (+`elevationMm`, NaN-guarded), `water-design-types.ts` (+`sourceElevationMm` on `ProposedNetwork`), `design-water-supply.ts`, `commit/build-water-supply-commit.ts`. +1 test (21 total). Browser-verified low in 3D.
- **2026-06-08 (Opus 4.8)** — **Slice 2 IMPLEMENTED (preview + commit).** Revit "Generate → review → accept" on the canvas: ribbon «Αυτόματη Ύδρευση» (Generate/Accept/Reject) → recognize storey (ADR-425) + `designWaterSupply` (Slice 1) → LOW-FREQUENCY `water-proposal-store` (ADR-040-safe: writes only on the 3 discrete actions, never per-frame; shell never subscribes — CHECK 6C) → micro-leaf ghost reusing `MepSegmentGhostRenderer` (cold=teal/hot=warm-red, half-width ∝ sized DN). Accept → pure `buildWaterSupplyCommit` → one atomic `CompoundCommand` (`CreateMepSegmentsCommand` + a `CreateMepSystemCommand` per network); members = segment endpoints ∪ proposal `servedConnectors`; the auto-fitting reconciler grows elbows/tees afterwards. Reject = `store.reset()` (zero Firestore). +`servedConnectors` carried on `ProposedNetwork` (Slice-1 type extension, so the commit needs no scene re-derivation). 12 tests / 2 suites green. FULL SSOT — zero fork of the manual pipe-draw / network / fitting paths. i18n el+en. ADR-040 staged (CHECK 6B/6D).
- **2026-06-08 (Opus 4.8)** — ADR created + Slice 1 IMPLEMENTED (headless). Four-stage water auto-design (`systems/mep-design/water/`) over the Stage 0 model: EN806 demand + Manhattan trunk-branch router (diminishing cumulative-LU diameters) + DIN1988-3 sizing → `WaterNetworkProposal`. Pluggable demand/sizing standards via the discipline descriptor (registry-entry seed). 8 tests green. Transient (no persistence), outside ADR-040. Confirmed by code sweep that demand/sizing/routing did not previously exist. Builds on ADR-425 (recognition), ADR-408 (segments/fittings/networks/connectors), ADR-423 (framework).
