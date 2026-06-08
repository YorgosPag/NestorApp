# ADR-428 — Heating (Hydronic) Auto-Design (the 3rd discipline)

> **Status:** 🟢 Slice 1 (headless engine) + 🟢 Slice 2 (preview + commit) IMPLEMENTED — 2026-06-09 (Opus 4.8). Child-ADR of **ADR-423** (MEP Auto-Design framework). The **3rd discipline** after the water-supply pilot (ADR-426) and sanitary drainage (ADR-427). Consumes Stage 0 recognition (**ADR-425**).
> **Scope (Slice 1):** turn a recognized storey into a **proposed two-pipe heating loop** — Demand → Source/Sink → Routing ×2 → Sizing — as pure data (`HeatingNetworkProposal` with a supply + a return network). No canvas, no commit (Slice 2 = preview + commit, mirroring water/drainage; **ENTΟΣ ADR-040**).
> **Decision driver (Giorgio, 2026-06-09):** *«FULL ENTERPRISE + FULL SSOT, όπως οι μεγάλοι παίχτες / η Revit / MagiCAD / 4M FINE»*. Heating reuses BOTH the water and the drainage engines as *parameters, not a new engine*; the only genuinely new logic is thermal-load demand (W → l/s) and velocity-based sizing.

---

## 1. Context

ADR-423 §6 makes heating the 3rd discipline. A code sweep before writing confirmed: **every heating primitive already exists** — the `mep-radiator` panel radiator and `mep-underfloor` radiant loop (ADR-408 Εύρος Β) each carry a fixed `hydronic-supply` inlet + `hydronic-return` outlet; the `mep-boiler` (ADR-408 Εύρος Β #2) sources the supply outlet and sinks the return inlet; `params.thermalOutputW` is made real by **ADR-422 L2** (boiler/radiator sizing); the hydronic palette, auto-fittings, 2D/3D symbols and the BOQ ΗΛΜ feed are all in place. What was missing is only the **brain**: a thermal-flow demand model, a heating terminal recognizer, and flow → DN sizing. Nothing below the recognition layer is rewritten.

---

## 2. Decision

A staged pipeline over the Stage 0 `RecognitionModel`, parameterised by the heating **discipline descriptor** (the 3rd `MepDisciplineRegistry` entry — already declared `reserved` by ADR-427, flipped `active` here):

```
RecognitionModel ─▶ Demand (W→l/s) ─▶ Source+Sink resolve (boiler) ─▶ Routing ×2 (shared) ─▶ Sizing (Σflow→DN, velocity) ─▶ HeatingNetworkProposal { supply, return }
```

**The big SSoT insight — heating needs NO new engine.** A two-pipe loop is two networks, and BOTH are already covered by the shared orthogonal trunk-branch router (ADR-426/§A), which emits runs **root-outward** carrying the **cumulative** loading of everything fed through them:

| Network | Root | Targets | Diameter trend |
|---|---|---|---|
| **Supply** | boiler `hydronic-supply` **outlet** | radiator/loop `hydronic-supply` **inlets** | large at boiler → small at terminal |
| **Return** | boiler `hydronic-return` **inlet** | radiator/loop `hydronic-return` **outlets** | large at boiler → small at terminal |

The drainage "converge-to-root" framing (ADR-427) and the water "radiate-from-source" framing are the **same** root-outward routing with cumulative loading — the router already does both. Drainage only added *slope* on top, which heating does **not** need (the loop is pressurised, not gravity). So each heating network is one water-style `buildNetwork` call: same router, same cumulative→DN sizing shape; only the root endpoint and the target connector differ.

**Heating vs the two prior disciplines (same engine, different parameters):**

| Axis | Water supply (426) | Drainage (427) | **Heating (this)** |
|---|---|---|---|
| Flow model | pressurised | gravity | **closed-loop (2-pipe)** |
| Networks | 2 (cold, hot) | 1 | **2 (supply, return)** |
| Source | manifold/boiler/WH outlet | — | **boiler supply outlet** |
| Sink/root | — | φρεάτιο collector | **boiler return inlet** |
| Demand | EN 806 Loading Units | EN 12056-2 Discharge Units | **thermal output → mass-flow (l/s)** |
| Sizing | ΣLU→DN (DIN1988) | ΣDU→DN (EN12056) | **Σflow→DN (velocity ≤ 1.0 m/s)** |
| Elevation | flat at source datum | per-segment descending slope | **flat at boiler tapping datum (no slope)** |
| Palette | cold teal / hot red | brown | **hydronic-supply red / -return blue** (SSoT) |

- **Stage 1 Demand** — each recognized heating terminal's `thermalOutputW` (from the host, or a standard default when unsized) → design mass-flow via the heat-carrier equation `V̇ = Q / (ρ·c·ΔΤ)·1000`, from a **pluggable `HeatingDemandStandard`** (70/50 regime, ΔΤ = 20K). One `TerminalHeatDemand` carries the flow + both connector world points (supply inlet, return outlet). The flow is identical on both networks (closed-loop mass conservation).
- **Stage 2 Source/Sink** — resolve the boiler's `hydronic-supply` outlet (supply root) and `hydronic-return` inlet (return root) + their world tapping elevations. **Missing endpoint ⇒ warning, not error** (auto-placement later — honest pilot, mirroring water/drainage).
- **Stage 3 Routing** — the **shared** `routeOrthogonalTrunkBranch` (ADR-426), invoked twice (once per root). The router's `loadingUnits` is read as a **flow proxy** (l/s) — zero engine change.
- **Stage 4 Sizing** — cumulative flow → DN from a **pluggable `HeatingSizingStandard`**: the smallest nominal DN on a standard ladder whose bore velocity at that flow ≤ v_max (1.0 m/s). DN is **derived from physics** (`v = V̇/A`), not a magic table. Trunk near the boiler carries Σ-of-all flow → big DN.
- **No Stage 5** — the loop is pressurised; there is no slope/gravity z (the deliberate difference from drainage).

---

## 3. Decisions taken (Revit-grade, LOCKED — pluggable)

| Decision | v1 choice | Rationale |
|---|---|---|
| **Demand basis** | `thermalOutputW` per terminal (radiator/underfloor), fallback 1500W | self-contained; ADR-422 L2 makes it real; no heat-load inputs needed |
| **Design ΔΤ** | 70/50 → ΔΤ = 20K | residential Revit default; pluggable in the descriptor |
| **W → l/s** | `Q / (ρ·c·ΔΤ)·1000`, ρ=1000, c=4187 | e.g. 2000W → ~0.024 l/s |
| **Sizing** | velocity-based, v_max=1.0 m/s, DN ladder [10,12,15,20,25,32,40,50,65,80,100] | quiet, low-erosion residential hydronics; computed not tabulated |
| **Topology** | 2 independent routed networks (supply/return) | honest pilot, like cold/hot; **true parallel pairing (offset runs) = Slice 3** |
| **Underfloor** | point terminal (manifold-fed), supply-in/return-out connectors | serpentine geometry already exists (ADR-408); not recomputed |

---

## 4. What was built

**NEW — `systems/mep-design/heating/`:**
- `heating-design-types.ts` — `HeatingNetworkProposal`, `ProposedHeatingNetwork` (×2), `ProposedHeatingSegment` (NO slope), `TerminalHeatDemand`, `HEATING_ROLE_CLASSIFICATION` SSoT.
- `heating-flow.ts` — pluggable `HeatingDemandStandard` (`HEATING_70_50_DEMAND_STANDARD`) + `flowLpsForTerminal`.
- `heating-sizing.ts` — pluggable `HeatingSizingStandard` (`HYDRONIC_VELOCITY_SIZING`), velocity-limited DN ladder.
- `heating-demand.ts` — terminals → per-terminal demand (W→l/s + both connector points).
- `heating-source-resolve.ts` — `resolveHeatingSupplySource` (boiler supply outlet) + `resolveHeatingReturnSink` (boiler return inlet).
- `heating-discipline.ts` — the `HEATING_DISCIPLINE` descriptor.
- `design-heating.ts` — the orchestrator → `HeatingNetworkProposal` (2 networks via the shared router).
- `index.ts` — barrel.
- `__tests__/heating-design.test.ts` + `heating-design.integration.test.ts` — 12 tests.

**NEW — `systems/recognition/recognizers/heating-terminal-recognizer.ts`** — Tier-1 recognizer (radiator + underfloor → `RecognizedTerminal`); radiator point = `params.position`, underfloor point = footprint centroid (SSoT `polygonCentroid`).

**MOD (additive):**
- `systems/mep-design/shared/connector-resolve.ts` — delegated the host plan transform to the canonical SSoT `getConnectorHostPlanTransform` (Boy-Scout, ADR-423 N.0.2): removed a duplicate private `hostTransform` and thereby gained radiator + underfloor host support (behaviour-preserving for water/drainage's 4 hosts).
- `systems/recognition/recognizers/mep-recognition.ts` — registered `heatingTerminalRecognizer`.
- `systems/mep-design/registry/mep-discipline-registry.ts` — heating `reserved`→`active` + standard ids.

Outside **ADR-040** (transient/headless; the ghost mount comes in Slice 2).

---

## 5. Deferred
- **Slice 3** — true parallel supply/return pairing (offset runs), shared with the A* wall-aware router. (Until then, the two networks may overlap geometrically; v1 draws both.)
- Heating space classifier (the demand reads terminals directly, so it is not needed for the engine).
- Diversity factor, low-temp regimes (heat pump 45/35), validated hydraulic balancing (ADR-422 L4 already balances placed networks per kv).

---

## Changelog
- **2026-06-09 (Opus 4.8) — Slice 2 (preview + commit) IMPLEMENTED.** The Revit "Generate → review → accept" loop for the 3rd discipline, mirroring the water Slice 2 1:1 (heating is a flat 2-network system like cold/hot, not sloped like drainage): low-freq `heating-proposal-store` (`HeatingProposalReview {proposal, sceneUnits}`, ADR-040-safe set/reset/get — the shell does not subscribe, only the leaf), pure `commit/build-heating-commit` (`buildHeatingCommit` → flat elevation = `network.sourceElevationMm` on both endpoints via SSoT `completeMepSegmentFromTwoClicks {classification, diameter}`, **no slope**; MepSystem rooted at the boiler supply-out / return-in; members = segments ∪ servedConnectors; one atomic `CompoundCommand`), the ghost leaf `useHeatingProposalGhostPreview` + `canvas-layer-stack-heating-proposal-ghost` (**per-segment** SSoT colour via `resolveSegmentClassificationColor(seg.classification)` → supply red / return blue + `hexToRgba(stroke, 0.22)` fill — no literal hex, no per-network branch), and a Generate/Accept/Reject ribbon bridge (`useRibbonHeatingAutoBridge` + `heating-auto-command-keys`, `designHeating(model, entities)` then store; EventBus `bim:heating-generated`/`-empty`/`-committed`) composed through `useDxfBimBridges` → `useDxfViewerRibbon` → `useRibbonCommands`. 2 MepSystems named «Θέρμανση Προσαγωγή» / «Θέρμανση Επιστροφή». 7 NEW files + ~9 additive shared MOD (barrel, leaves mount [STAGEs ADR-040], home-tab-draw submenu, 3 ribbon-command files, 3 bridge-compose files, notifications 3 toasts, event-map 3 payloads, i18n el+en). `build-heating-commit.test.ts` + 12 Slice-1 + water/drainage regression green (48 mep-design tests). Confirms the preview/commit layer is reusable verbatim across all three disciplines — only the proposal shape and the source/sink roles differ. Ghost mount STAGEs ADR-040. Slice 3 (parallel offset pairing) deferred.
- **2026-06-09 (Opus 4.8) — Slice 1 (headless engine) IMPLEMENTED.** Heating (hydronic) auto-design (`systems/mep-design/heating/`) over the Stage 0 model: thermal-output → mass-flow demand (70/50 ΔΤ20K) + boiler source/sink resolve + the **shared** orthogonal trunk-branch router invoked twice (supply + return) + velocity-limited flow→DN sizing → `HeatingNetworkProposal` (2 networks, transient). Proves heating needs **no new engine** — both loop sides are the same root-outward cumulative routing water/drainage already use, minus the slope. New heating terminal recognizer (radiator + underfloor). §4 registry heating entry flipped `active`. Boy-Scout: `shared/connector-resolve.ts` delegated to the canonical `getConnectorHostPlanTransform` SSoT (radiator/underfloor host support, behaviour-preserving). 12 heating tests + water/drainage/recognition regression green. Outside ADR-040 (Slice 2 = preview+commit next).
