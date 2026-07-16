# ADR-431 — Electrical-weak (ασθενή) Auto-Design (the 6th discipline)

> **Status:** 🟢 Slice 0 (data-outlet terminal + comms-rack source) + 🟢 Slice 1 (headless engine, shared-core generalization) + 🟢 Slice 2 (preview + commit) IMPLEMENTED — 2026-06-09 (Opus 4.8). Child-ADR of **ADR-423** (MEP Auto-Design framework). The **6th discipline** (ADR-423 §6 order) after water-supply (426), drainage (427), heating (428) and electrical-strong (**ADR-430**). The **sibling of ADR-430** — same circuit model, different source/sizing/classifications. Consumes Stage 0 recognition (**ADR-425**).
> **Scope (v1):** turn a recognized storey into **proposed structured-cabling channels** — data (RJ45) homed at a comms-rack, grouped under a switch **port budget** and length-checked to the **ISO/IEC 11801 / EN 50173** 90 m permanent link, then committed as `MepSystem` channels. `controls` is engine-supported but ships no dedicated terminal yet; TV/SAT/CCTV/intercom = reserved.
> **Decision driver (Giorgio, 2026-06-09):** *«FULL ENTERPRISE + FULL SSOT, όπως οι μεγάλοι παίχτες / Revit / MagiCAD / 4M FINE»*.

---

## 1. Context — the weak-current sibling of the strong engine

Electrical-weak is **the same logical-circuit discipline as electrical-strong (ADR-430)**: the output is **N channels (`MepSystem`s), NOT segments**; the home-run wire is derived at render by `computeCircuitWirePaths`. The A\* router + pairing core remain irrelevant (physical conduit/tray, deferred). So the ADR-430 pipeline is ~entirely reusable — the **enterprise move (Boy-Scout N.0.2) was to GENERALIZE the strong engine into a discipline-agnostic core and make weak the 2nd consumer**, not to copy-paste a new folder.

The three genuine differences (the only new logic):

1. **Source** — not the power panel but a **comms-rack / patch-panel**. Decided: a comms-rack is a **NEW KIND of the existing `electrical-panel` entity** (`ElectricalPanelKind += 'comms-rack'`), NOT a new entity family. The type's own doc already invites appending kinds; Revit models both the power panel and the data panel under one *Electrical Equipment* category, sub-typed. This reuses the entire ~25-file panel pipeline (geometry/symbol/renderer/ghost/grips/tool/3D/persistence/commands) — only the out-connector classification (`'data'` vs `'power'`) and the 2D glyph differ.
2. **Sizing** — no breaker / voltage drop. Instead: the **structured-cabling permanent-link length ≤ 90 m** (ISO/IEC 11801 / TIA-568, the 100 m channel less patch cords) + **port-budget grouping** (one channel per switch port budget). Advisory readout (like the strong ΔU%).
3. **Classifications** — reuse the existing `'data'` + `'controls'` enum members (reserved-but-now-wired). No enum expansion (manual circuits + strong stay regression-free). Finer taxonomy (TV/CCTV/…) lives at registry level (ADR-423 §2.1), not the connector enum.

---

## 2. Decision — the pipeline (Revit-grade, ISO/IEC 11801)

```
RecognitionModel ─▶ Source resolve (comms-rack) ─▶ Demand (ports/outlet) ─▶ skip already-channelled
   ─▶ Grouping (SHARED bin-packer: split-by-service · group-by-zone · bin-pack under port budget)
   ─▶ Sizing (90 m channel-length check) ─▶ WeakNetworkProposal { N channels }
```

Parameterised by the **electrical-weak discipline descriptor** (the 6th `MepDisciplineRegistry` entry, flipped `reserved`→`active` here). NO phase balancing (star topology homed at the rack, not a 3-phase panel).

### The shared-core generalization (Boy-Scout, zero strong regression)

`circuit-grouping-core.ts` (NEW) holds the discipline-agnostic brain, generic over the service union `S` and the discipline rule `R extends CircuitCap { maxLoad; maxPoints }`:
- `TerminalDemand<S>` (`load` = the abstract demand unit — VA for strong, ports for weak),
- `CircuitGroup<S, R>`, `GroupingStandard<S, R>`,
- `groupIntoCircuits<S, R>` (split-by-service · group-by-zone · bin-pack) — **the verbatim brain both disciplines call**,
- `balancePhases` (strong-only; weak passes `phases: []` and never invokes it),
- `daisyChainLengthM` (shared home-run length — strong voltage drop + weak channel length).

Strong stays **byte-identical at runtime** (the generalization is type-level; `electrical-circuit-grouping.ts` now only carries the strong rules + `HD384_GROUPING_STANDARD`). The only renames were the now-generic fields `loadVa→load`, `connectedLoadVa→connectedLoad`, `maxLoadVa→maxLoad` (the persisted `MepSystem` shape is unaffected).

### Locked Revit-grade decisions (ISO/IEC 11801 / EN 50173)

| Axis | Decision | Pluggable standard |
|---|---|---|
| **Standard** | ISO/IEC 11801 / EN 50173 structured cabling | descriptor (mirror HD 384) |
| **Source** | comms-rack = **new KIND of `electrical-panel`** (`'comms-rack'`), out connector `'data'`; classification-aware resolver (strong→`power`, weak→`data`/`controls`) | `resolveElectricalSource` |
| **Demand** | **1 port / data outlet** (RJ45), service `data` | `ISO11801_DEMAND_STANDARD` |
| **Grouping (brain)** | split by service → group by Stage-0 zone → bin-pack under **24-port switch budget** (shared bin-packer) | `ISO11801_GROUPING_STANDARD` |
| **Sizing** | **channel length ≤ 90 m** permanent link (advisory); cable type **Cat6** | `ISO11801_SIZING_STANDARD` |
| **Phase** | **none** (`phases: []`) | — |
| **Non-destructive** | channels ONLY outlets not already on a weak channel (skip + count) | orchestrator |
| **Classifications** | reuse existing `'data'` + `'controls'` (no enum expansion) | — |
| **Output** | N `MepElectricalSystemParams` (NO voltage/poles, System colour data-green/controls-purple); commit = N `CreateMepSystemCommand` in ONE `CompoundCommand`. **Zero segments.** | `build-electrical-weak-commit.ts` |

---

## 3. Slices implemented

**Slice 0 — foundation** (ΕΚΤΟΣ ADR-040):
- NEW `MepFixtureKind 'data-outlet'` (πρίζα δικτύου) — a connectable weak-current fixture with a `'data'`-in connector (`buildDefaultDataConnector`), IFC `IfcOutlet`, the **same wall-box 3D geometry as the socket** (shared path), a downward-triangle telecom 2D glyph. Reuses the electrical V/G + mesh category. SSoT `data-outlet-symbol-spec.ts`. Ribbon tool «Πρίζα Δικτύου» (`mep-data-outlet`).
- NEW `ElectricalPanelKind 'comms-rack'` — the weak-current source; `buildDefaultCommsRackOutgoingConnector` (`'data'` out), a patch-panel 2D glyph variant, kind-aware connector seed + completion. Ribbon tool «Rack Ασθενών» (`mep-comms-rack`) reusing the panel tool with a kind preset.
- The existing `electricalTerminalRecognizer` is **already service-agnostic** (reads the connector classification) → it recognizes data-outlets with no change.

**Slice 1 — headless engine + generalization** `systems/mep-design/electrical/` (ΕΚΤΟΣ ADR-040):
- NEW shared `circuit-grouping-core.ts` (the generic brain); strong `electrical-circuit-grouping.ts` / `-design-types.ts` / `-demand.ts` / `-sizing.ts` refactored to consume it (byte-identical runtime).
- NEW weak files: `electrical-weak-design-types.ts`, `electrical-weak-demand.ts`, `electrical-weak-grouping.ts`, `electrical-weak-sizing.ts`, `electrical-weak-discipline.ts`, `design-electrical-weak.ts`.
- `electrical-source-resolve.ts` generalized → classification-aware `resolveElectricalSource(entities, accept)`. Registry `electrical-weak` flipped → `active`.

**Slice 2 — preview + commit** (STAGE ADR-040 — touches canvas leaves):
- **REUSE** the strong `electrical-proposal-store.ts` (its `proposal` field widened to a shared `ProposalReviewSummary` both proposals satisfy) + the ghost leaf + `computeCircuitWirePaths` + `drawCircuitWires` (data-green wires for free).
- NEW pure `commit/build-electrical-weak-commit.ts` (proposal → N channel `MepSystem`s, no voltage/poles).
- NEW thin `useRibbonElectricalWeakAutoBridge` + `electrical-weak-auto-command-keys.ts`, «Αυτόματα Ασθενή» Generate/Accept/Reject, EventBus weak toasts, i18n el+en. The strong bridge stays untouched.

---

## 4. Files

**NEW:** `data-outlet-symbol-spec.ts`, `circuit-grouping-core.ts`, `electrical-weak-{design-types,demand,grouping,sizing,discipline}.ts`, `design-electrical-weak.ts`, `commit/build-electrical-weak-commit.ts`, `electrical-weak-auto-command-keys.ts`, `useRibbonElectricalWeakAutoBridge.ts`, tests `mep-fixture-data-outlet.test.ts` / `electrical-weak-design.test.ts` / `build-electrical-weak-commit.test.ts`.

**MODIFIED (strong byte-identical / additive):** `mep-fixture-types.ts` + `.schemas.ts`, `mep-connector-types.ts`, `mep-connector-seed.ts`, `mep-fixture-symbol.ts`, `bim-three-point-converters.ts`, `mep-fixture-completion.ts`, `useMepFixtureTool.ts`, `useSpecialTools-placement-tools.ts`, `useCanvasClickHandler.ts`, `toolbar/types.ts`, `tool-definitions.ts`, `home-tab-draw.ts`; `electrical-panel-types.ts` + `.schemas.ts`, `electrical-panel-completion.ts`, `electrical-panel-symbol.ts`, `useElectricalPanelTool.ts`; the strong engine core files + `index.ts` + the registry; `electrical-proposal-store.ts`, `drawing-event-map.ts`, `useDxfViewerNotifications.ts`, the 4 ribbon-command composition files; i18n el+en.

---

## 5. Regression invariants
- **Electrical-strong (ADR-430)** byte-identical (its 17-test suite + the socket suite stay green after the generic refactor).
- **Manual circuits / `computeCircuitWirePaths` / wire overlays** untouched functionally.
- **Pipe disciplines + shared recognition** untouched (each demand stage filters by classification).

## 6. Tests
`electrical-weak-design.test.ts` (demand/grouping/channel-length/orchestrator + classification-aware source), `mep-fixture-data-outlet.test.ts` (data-outlet + comms-rack Slice 0), `build-electrical-weak-commit.test.ts` (Slice 2 commit). Strong regression: `electrical-design.test.ts` + `build-electrical-commit.test.ts` + `mep-fixture-socket.test.ts` + `electrical-panel-symbol.test.ts`. **59 tests green** across the electrical engine.

## 7. Changelog
- **2026-07-16 (Sonnet 5):** SSoT de-duplication (jscpd/CHECK 3.28 ratchet) — `contextual-mep-data-outlet-tab.ts` was a field-for-field clone of `contextual-mep-socket-tab.ts` (~366 dup tokens). Both now delegate to the new `mep-outlet-contextual-tab-factory.ts` (`buildMepOutletContextualTab(config)`, ADR-408 manifold-factory pattern) — thin config (ids/trigger/labelKeys) only, zero behavioural change (verified byte-identical to the pre-refactor tab object). Full details + the related `ROTATION_DEG_OPTIONS` / `literalNumberOptions()` / `catalogOptions()` / `MEP_FIXTURE_PARAMETRIC_3D_VIEW_OPTIONS` hoists → see ADR-430 changelog (same commit, shared factory file).
- **2026-06-10 (Opus 4.8):** Contextual properties tab fix — a selected data outlet (πρίζα δικτύου) was mislabelling as «Ιδιότητες Φωτιστικού» (light-fixture default fall-through in `resolveContextualTrigger`). Added a dedicated **`mep-data-outlet-selected` contextual tab «Ιδιότητες Πρίζας Δικτύου»** (distinct Revit "Communication Devices" category), routed by `isDataOutletKind` BEFORE the light default. FULL SSoT — thin copy reusing the kind-agnostic `useRibbonMepFixtureBridge` (zero new bridge). Shares the new `isElectricalDeviceKind` SSoT guard (see ADR-430 changelog).
- **2026-06-09 (Opus 4.8):** Slices 0+1+2 implemented. Boy-Scout generalization of the strong engine into `circuit-grouping-core.ts`; weak = 2nd consumer. comms-rack as an `electrical-panel` kind. Registry `electrical-weak` → active. 🔴 Pending: browser-verify + commit (Giorgio).
