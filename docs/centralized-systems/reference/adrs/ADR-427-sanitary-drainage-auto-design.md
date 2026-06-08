# ADR-427 — Sanitary Drainage Auto-Design (the 2nd discipline)

> **Status:** 🟢 Slice 1 (headless engine) IMPLEMENTED — 2026-06-09 (Opus 4.8). Child-ADR of **ADR-423** (MEP Auto-Design framework). The **2nd discipline** after the water-supply pilot (ADR-426) — it proves the framework promise (a new network = *a registry entry + a recognizer*, not a new engine) and **gives birth to the `MepDisciplineRegistry`** the water pilot deferred. Consumes Stage 0 recognition (**ADR-425**).
> **Scope:** turn a recognized storey into a **proposed gravity drainage network** — Demand → Outfall → Routing → Sizing → Slope — as pure data (`DrainageNetworkProposal`). **Slice 1 is headless**: no canvas, no commit, no persistence. Slice 2 will turn the proposal into real sloped `mep-segment`s + a `MepSystem` (Revit "Generate → review → accept").
> **Decision driver (Giorgio, 2026-06-09):** *«FULL ENTERPRISE + FULL SSOT, όπως οι μεγάλοι παίχτες / η Revit / MagiCAD / 4M FINE»*. Drainage reuses the water engine as *parameters, not a new engine*; the only genuinely new logic is gravity slope assignment.

---

## 1. Context

ADR-423 §6 makes drainage the discipline that generalises the pilot into the full engine. A code sweep before writing confirmed: **every drainage primitive already exists** — `mep-segment` with `classification:'sanitary-drainage'` + `slopePercent` + per-endpoint z (own `'drain-pipe'` V/G category), the **φρεάτιο** = `mep-manifold` kind `'drainage-collector'` (N inlets → 1 outlet), the sanitary fixtures' **drain connector** (`buildSanitaryDrainConnector`, classification fixed `sanitary-drainage`), the brown drain palette, the auto-fitting reconciler, 2D/3D symbols and the BOQ ΗΛΜ feed. What was missing is only the **brain**: a discharge-demand model, gravity routing, drainage sizing, and slope assignment. Nothing below the recognition layer is touched.

---

## 2. Decision

A staged pipeline over the Stage 0 `RecognitionModel`, parameterised by the drainage **discipline descriptor** (the 2nd `MepDisciplineRegistry` entry):

```
RecognitionModel ─▶ Demand (DU) ─▶ Outfall resolve (collector) ─▶ Routing (gravity) ─▶ Sizing (ΣDU→DN, growing) ─▶ Slope (descending z) ─▶ DrainageNetworkProposal
```

**Drainage vs water — the inversion (same engine, different parameters):**

| Axis | Water supply (ADR-426) | Sanitary drainage (this) |
|---|---|---|
| Flow model | pressurised, radiates FROM a source | **gravity**, converges INTO a collector |
| Graph root | the source (manifold/boiler outlet) | **the collector** (φρεάτιο); fixtures are leaves |
| Demand | EN 806 / DIN 1988 Loading Units | **EN 12056-2 Discharge Units (DU)** |
| Sizing | ΣLU→DN, **diminishing** toward fixtures | ΣDU→DN, **growing** toward the collector + **min branch DN per appliance** (WC = DN100) |
| Elevation | flat at the source datum | **per-segment slope, monotonically descending** to the collector invert |
| Palette | cold teal / hot warm-red | **brown** (`drain-pipe`, already SSoT) |

**Key reuse insight:** the shared orthogonal trunk-branch router already computes, per trunk run, the **cumulative** loading of everything fed through it. With `root = collector` and `targets = fixture drain points`, that cumulative IS the cumulative DU — largest near the collector, smallest at the branches. So the cumulative→DN relationship is *structurally identical* to water; only the tables (DU/DN), the per-appliance min-DN floor, and the slope/z step differ.

- **Stage 1 Demand** — each recognized terminal's `sanitary-drainage` connector → `FixtureDischarge` (DU + min branch DN + world point), from a **pluggable `DischargeDemandStandard`** (EN 12056-2 System I).
- **Stage 2 Outfall** — resolve the `drainage-collector` manifold's sanitary-drainage outlet as the gravity root + its invert elevation. **Missing collector ⇒ warning, not error** (auto-placement later — honest pilot).
- **Stage 3 Routing** — the **shared** `routeOrthogonalTrunkBranch` (ADR-426), rooted at the collector. Generically extended (§A) so a per-target **minimum branch diameter** propagates up the spine as a suffix-max — a WC line is ≥ DN100 the whole way.
- **Stage 4 Sizing** — cumulative DU → DN from a **pluggable `DrainageSizingStandard`**, floored by the propagated min-DN. Trunk near the collector = big DN → **diameters grow toward the outfall**.
- **Stage 5 Slope** — a forward tree-walk from the collector invert assigns each run the standard's minimum gradient for its DN and a pair of descending per-endpoint elevations (the end nearer the collector is lower). The whole network drops monotonically into the φρεάτιο.

Output: `DrainageNetworkProposal` = the gravity `ProposedDrainageNetwork`(s) (sized + sloped runs + collector + served terminals + ΣDU) + honest `warnings`. **Transient — never persisted.**

---

## 3. Standards (EN 12056-2 System I — pluggable, never hard-coded in the engine)

System I (partially-filled branch discharge pipes, fill 0.5 — the European/Greek default).

- **Discharge Units (DU)** per appliance: washbasin/bidet 0.5, shower 0.6, bathtub 0.8, floor-drain 0.8, **WC 2.0**.
- **Minimum branch DN** per appliance: washbasin/bidet DN40, shower/bath/floor-drain DN50, **WC DN100**.
- **Sizing ΣDU→DN** (ascending): ≤0.5→40, ≤1.5→50, ≤4→70, ≤20→100, ≤70→125, else 150 mm.
- **Minimum gradient per DN** (self-cleansing): DN≤50 → 2.5 % (≈1:40), DN70 → 2.0 % (1:50), DN100 → 1.5 % (1:67), DN≥125 → 1.0 % (1:100).
- **Peak flow** Qww = K·√ΣDU, K = 0.5 (dwellings) — reported, not used for v1 sizing.

Both demand + sizing sit behind interfaces in the discipline descriptor → a different code (DIN 1986-100, BS EN 12056, UPC) is a new table, not an engine change.

---

## 4. The `MepDisciplineRegistry` (ADR-423 §4 — born here)

`systems/mep-design/registry/mep-discipline-registry.ts` — the SSoT catalog of the 8 MEP disciplines (locked roadmap order), with the first **two ACTIVE** entries (`water-supply`, `sanitary-drainage`) and 6 reserved slots (heating … gas). It is metadata, not an engine: each discipline's concrete parameter object (`WATER_SUPPLY_DISCIPLINE`, `SANITARY_DRAINAGE_DISCIPLINE`) is what its `design*` orchestrator consumes; the registry catalogs them by id (flow model, classifications, standard ids, status) so tooling/UX can enumerate the disciplines without importing every engine.

**§A Generalisation (the framework promise made real):** the shared engine pieces were promoted out of `water/` into discipline-agnostic homes, consumed by both disciplines with zero duplication:
- `systems/mep-design/routing/orthogonal-router.ts` (moved) — + generic `RouteTarget.minBranchDiameterMm` and `RoutedSegment.cumulativeMinDiameterMm` (suffix-max). Water passes none ⇒ 0 ⇒ **zero behavioural change** (20 water tests stay green).
- `systems/mep-design/shared/connector-resolve.ts` (moved) — host connector world-point resolver, reused by both demand + source/outfall resolvers.

---

## 5. Files (all ≤500 lines, functions ≤40) — `src/subapps/dxf-viewer/systems/mep-design/`

| File | Role | New/Mod |
|---|---|---|
| `routing/orthogonal-router.ts` | shared Manhattan trunk-branch router (+ generic min-Ø propagation) | MOVED+EXT |
| `shared/connector-resolve.ts` | shared host connector world point | MOVED |
| `registry/mep-discipline-registry.ts` | the `MepDisciplineRegistry` (2 active + 6 reserved) | NEW |
| `drainage/drainage-design-types.ts` | SSoT types (`FixtureDischarge`, `ProposedDrainageSegment/Network`, `DrainageNetworkProposal`) | NEW |
| `drainage/discharge-units.ts` | EN 12056-2 DU + min-branch-DN + `DischargeDemandStandard` + Qww | NEW |
| `drainage/drainage-sizing.ts` | ΣDU→DN (growing) + min-slope per DN + `DrainageSizingStandard` | NEW |
| `drainage/slope-assignment.ts` | gravity slope + descending per-endpoint elevations (tree walk) | NEW |
| `drainage/drainage-demand.ts` | `buildDrainageDemandModel` | NEW |
| `drainage/outfall-resolve.ts` | resolve the `drainage-collector` root + invert | NEW |
| `drainage/gravity-router.ts` | route → size → slope composition | NEW |
| `drainage/design-drainage.ts` | the orchestrator | NEW |
| `drainage/drainage-discipline.ts` | `SANITARY_DRAINAGE_DISCIPLINE` descriptor | NEW |
| `drainage/index.ts` | barrel | NEW |
| `drainage/__tests__/drainage-design.test.ts` + `.integration.test.ts` | 9 tests (demand/sizing/slope/router min-Ø/orchestrator + realistic bathroom) | NEW |
| `water/{design-water-supply,water-demand,water-source-resolve,index}.ts` + `__tests__/water-design.test.ts` | re-point imports to the moved shared modules | MOD |

**Reuse (zero fork):** Stage 0 `RecognitionModel`/`isRecognizedTerminal` (the sanitary recognizer already exposes the drain connector ref), `connectorWorldPosition`/`getEntityConnectors`, `isDrainageCollectorKind`, `resolveMepConnectorElevationMmAt`, `PlumbingSystemClassification`. Slice 2 will reuse `completeMepSegmentFromTwoClicks` (with `classification` + `slopePercent` + per-endpoint z) + `CreateMepSegmentsCommand` + `CreateMepSystemCommand` + the auto-fitting reconciler.

---

## 6. Test coverage

22 tests / 5 suites green (9 new drainage + 13 water regression). Drainage: demand (DU + min-DN per kind, supply refs ignored), sizing (ascending DN ladder + max; steeper slope for smaller bore), router min-Ø suffix-max (a downstream WC lifts the shared trunk to DN100), orchestrator (collector-rooted network, growing Ø, WC branch ≥ DN100, every run rises outward from the invert, missing-collector warning), integration (realistic bathroom: ΣDU 3.3, Qww 0.91 l/s, DN {40,50,100}, slopes {1.5,2.5}, monotonic descent). The 20 water tests confirm the §A generalisation is behaviour-preserving.

---

## 7. Scope & next steps

**v1 scope (parity with the water pilot):** single storey, horizontal branch+collector runs with gravity slope, rooted at one `drainage-collector` φρεάτιο.

**Deferred (flagged, future slices):**
- **Slice 2** — preview + commit: `drainage-proposal-store` (low-freq, ADR-040) + brown ghost (reuse `MepSegmentGhostRenderer`) + ribbon «Αυτόματη Αποχέτευση» (Generate/Accept/Reject) → one atomic `CompoundCommand` of sloped segments + a drainage `MepSystem`; fittings auto-appear.
- **Vertical stacks / risers** (Φ15 cross-floor), **secondary ventilation / vent stacks** (EN 12056-2), **stormwater / rainwater**, **grease interceptors**.
- **Wall-obstacle-aware routing (A\*)** — the shared swap that benefits every discipline (water Slice 3), contract unchanged.
- **Auto-place collector** when none is recognized; validated hydraulics (Manning, fill ratio, velocity check) behind the same `DrainageSizingStandard` interface.

---

## Changelog
- **2026-06-09 (Opus 4.8)** — ADR created + **Slice 1 IMPLEMENTED (headless)**. Gravity drainage auto-design (`systems/mep-design/drainage/`) over the Stage 0 model: EN 12056-2 System I discharge demand + collector-rooted gravity routing (growing cumulative-DU diameters, WC ≥ DN100 via suffix-max min-Ø propagation) + DN-aware slope assignment (monotonic descent to the φρεάτιο invert) → `DrainageNetworkProposal`. **Born the `MepDisciplineRegistry`** (2 active + 6 reserved) and **generalised** the shared router + connector resolver out of `water/` (behaviour-preserving — generic `minBranchDiameterMm` propagation; 20 water tests green). Pluggable demand/sizing standards via the discipline descriptor. 22 tests / 5 suites green. Transient (no persistence), outside ADR-040. Confirmed by code sweep that demand/routing/sizing/slope did not previously exist; all drainage primitives reused untouched. Builds on ADR-425 (recognition), ADR-426 (water pilot + shared engine), ADR-408 (segments/collector/connectors/slope), ADR-423 (framework).
