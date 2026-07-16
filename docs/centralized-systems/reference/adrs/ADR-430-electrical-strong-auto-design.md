# ADR-430 — Electrical-strong (ισχυρά) Auto-Design (the 4th discipline)

> **Status:** 🟢 Slice 0 (socket terminal + recognizer) + 🟢 Slice 1 (headless engine) + 🟢 Slice 2 (preview + commit) IMPLEMENTED — 2026-06-09 (Opus 4.8). Child-ADR of **ADR-423** (MEP Auto-Design framework). The **4th discipline** after water-supply (ADR-426), sanitary drainage (ADR-427) and heating (ADR-428). Consumes Stage 0 recognition (**ADR-425**).
> **Scope (v1):** turn a recognized storey into **proposed branch circuits** — lighting (10A) + general sockets (16A) — grouped, phase-balanced and sized to **ΕΛΟΤ HD 384 / IEC 60364**, then committed as `MepSystem` circuits. Strong current only; weak current (data/controls), motors, earthing = reserved (next slices).
> **Decision driver (Giorgio, 2026-06-09):** *«FULL ENTERPRISE + FULL SSOT, όπως οι μεγάλοι παίχτες / Revit / MagiCAD / 4M FINE»*.

---

## 1. Context — why electrical is NOT a pipe discipline

The three prior disciplines (water/drainage/heating) produce **physical `mep-segment` geometry** through the shared trunk-branch router + A\* + supply/return pairing. **Electrical does not.** In this app the wiring is **logical / derived**: a circuit stores only `sourceEntityId` + `members[]`, and the home-run polyline is recomputed at render by `computeCircuitWirePaths` — no conduit/cable geometry is ever persisted.

Consequences (confirmed by a code sweep before writing):

- The auto-design **output is N circuits (`MepSystem`s), not segments.** The wires draw for free from the existing render path.
- The **A\* router + pairing core are NOT the engine here** — they model physical conduit, deferred to a later slice.
- The real "brain" is **circuit grouping + sizing** (load grouping under breaker/point limits + phase balance + conductor + voltage drop) — entirely new; no electrical demand/sizing existed in the code.

**Already in place (reused):** Stage 0 source recognizer already recognizes the `electrical-panel` as a `RecognizedSource`; the `MepDisciplineRegistry` had a `reserved` `electrical-strong` slot; the circuit model (`MepElectricalSystemParams`), `computeCircuitWirePaths`, the 2D `HomeRunWiresOverlay` and 3D wire sync, and `CreateMepSystemCommand` all work (manual circuit-from-selection). **Missing:** a socket terminal kind, an electrical terminal recognizer, and the demand/grouping/sizing brain.

---

## 2. Decision — the pipeline (Revit-grade, HD 384)

```
RecognitionModel ─▶ Source resolve (panel) ─▶ Demand (VA/point) ─▶ skip already-circuited
   ─▶ Grouping (split-by-service · group-by-zone · bin-pack) ─▶ Phase balance (LPT)
   ─▶ Sizing (conductor/breaker + voltage drop) ─▶ ElectricalNetworkProposal { N circuits }
```

Parameterised by the **electrical-strong discipline descriptor** (the 4th `MepDisciplineRegistry` entry, flipped `reserved`→`active` here). Like the pipe disciplines, *a discipline is parameters, not an engine* — but unlike them it shares no routing engine; its engine IS the bin-packing grouping + HD 384 sizing.

### Locked Revit-grade decisions (ΕΛΟΤ HD 384 / IEC 60364, ελληνική πρακτική)

| Axis | Decision | Pluggable standard |
|---|---|---|
| **Demand (VA)** | luminaire **100 VA**, socket **200 VA** / point, 230 V single-phase | `HD384_DEMAND_STANDARD` |
| **Lighting circuit** | **10 A MCB / 1.5 mm²**, ≤ ~1840 VA (10·230·0.8) **or** ≤ 12 points | `HD384_GROUPING_STANDARD.rules.lighting` |
| **Socket circuit** | **16 A MCB / 2.5 mm²**, ≤ ~2944 VA (16·230·0.8) **or** ≤ 8 points | `…rules.power` |
| **Grouping (brain)** | split lighting vs sockets → group by Stage-0 zone (space) → bin-pack under load + point caps; unzoned → one bucket | `electrical-circuit-grouping.ts` |
| **Phase balance** | **least-loaded (LPT) greedy** across L1/L2/L3 (3-phase panel); phase is metadata + in the circuit name | `…phases` |
| **Sizing** | conductor/breaker from the rule; **voltage drop** ΔU% = 2·ρ·L·I/(A·U)·100 (advisory): limits **3% lighting / 5% sockets**; L = derived home-run length | `HD384_SIZING_STANDARD` |
| **Non-destructive** | circuits ONLY terminals not already on a circuit (skip + count); manual circuits never clobbered | orchestrator |
| **Classifications** | reuse existing `'lighting'` + `'power'` (no enum expansion → manual circuits regression-free) | — |
| **Output** | N `MepElectricalSystemParams` (poles=1, 230 V, System colour amber/blue); commit = N `CreateMepSystemCommand` in ONE `CompoundCommand`. **Zero segments.** | `build-electrical-commit.ts` |

---

## 3. Slices implemented

**Slice 0 — socket terminal + recognizer** (ΕΚΤΟΣ ADR-040):
- NEW `MepFixtureKind 'socket'` (πρίζα) — a connectable electrical fixture with a `'power'`-in connector (`buildDefaultPowerConnector`), IFC `IfcOutlet`, wall-mounted 3D box, IEC socket 2D glyph. Reuses the `'light-fixture'` V/G + mesh category (electrical bucket) → zero discipline/styles cascade. SSoT `socket-symbol-spec.ts`. Ribbon tool «Πρίζα» (`mep-socket`).
- NEW `electricalTerminalRecognizer` (luminaire + socket → `RecognizedTerminal`, service from the connector classification), registered in `mep-recognition.ts`.

**Slice 1 — headless engine** `systems/mep-design/electrical/` (ΕΚΤΟΣ ADR-040):
`electrical-design-types.ts`, `electrical-strong-discipline.ts`, `electrical-demand.ts`, **`electrical-circuit-grouping.ts` (the brain)**, `electrical-sizing.ts`, `electrical-source-resolve.ts`, `design-electrical-strong.ts`, `index.ts`. Registry `electrical-strong` flipped → `active`.

**Slice 2 — preview + commit** (STAGE ADR-040 — touches canvas leaves):
`electrical-proposal-store.ts` (low-freq), pure `commit/build-electrical-commit.ts` (proposal → N circuit `MepSystem`s), ghost leaf (`useElectricalProposalGhostPreview` + `canvas-layer-stack-electrical-proposal-ghost.tsx`, reuses `computeCircuitWirePaths` + `drawCircuitWires`, colour-by-classification), `useRibbonElectricalAutoBridge` «Αυτόματος Ηλεκτρολογικός» Generate/Accept/Reject, EventBus toasts, i18n el+en.

---

## 4. Consequences

- **Same Slice-2 UX as the pipe disciplines** (Generate → review → accept), but commits circuits, not segments — the bridge pre-routes the ghost wires at Generate so the ghost is scene-free.
- **Regression-free:** manual circuits / `computeCircuitWirePaths` / wire overlays untouched; pipe disciplines untouched; the shared recognizer registration adds electrical terminals, which every pipe demand stage filters out by classification.
- **Advisory voltage drop** (like ADR-422 L6 ΚΕΝΑΚ) — flagged, never blocking.

### Next (deferred)
- Weak current (6th discipline — data/cctv/intercom: same radial grouping, new terminal kinds + classifications).
- Voltage-drop report / panel schedule / single-line diagram (ADR-423 deliverables).
- Physical conduit/cable-tray geometry (THEN the A\* router + pairing become relevant).
- Multi-panel / per-zone panel selection; 3-phase loads / motors / earthing.

---

## 5. Changelog
- **2026-07-16 (Sonnet 5):** SSoT de-duplication (jscpd/CHECK 3.28 ratchet) — the socket + data-outlet contextual ribbon tabs (`contextual-mep-socket-tab.ts` / `contextual-mep-data-outlet-tab.ts`) were field-for-field clones (~366 dup tokens). Extracted `mep-outlet-contextual-tab-factory.ts` (`buildMepOutletContextualTab(config)`, mirrors the ADR-408 `mep-manifold-contextual-tab-factory.ts` pattern): SINGLE source of the panel structure + shared mm/deg presets; both tabs are now thin configs differing only in ids + trigger + tab/panel i18n labelKeys — zero behavioural change (ids/labelKeys verified byte-identical to the pre-refactor objects). Also hoisted the `ROTATION_DEG_OPTIONS` 0-315° ladder (copy-pasted across 9 contextual-tab files) into `literalNumberOptions()` (`ribbon-numeric-options.ts`, existing SSoT), and added `catalogOptions()` + the shared `MEP_FIXTURE_PARAMETRIC_3D_VIEW_OPTIONS` constant to the same module to clear two follow-on jscpd:diff clusters (catalog-mapper duplicate, scale-ladder duplicate, and the appliance/sanitary 3D-view-fallback duplicate). `jscpd:diff` clean on all touched files; `resolve-contextual-trigger-coverage` / `resolve-tool-active-trigger-coverage` / `ui/ribbon/data/__tests__` — 13 suites / 112 tests green, unchanged.
- **2026-06-10 (Opus 4.8):** Contextual properties tab fix — a selected socket (πρίζα) was mislabelling as «Ιδιότητες Φωτιστικού» (it fell through to the light-fixture default in `resolveContextualTrigger`). Added a dedicated **`mep-socket-selected` contextual tab «Ιδιότητες Πρίζας»** (distinct Revit "Electrical Fixtures" category), routed by the precise `isSocketKind` guard BEFORE the light default. FULL SSoT — the tab is a thin copy reusing the kind-agnostic `useRibbonMepFixtureBridge` + `MEP_FIXTURE_RIBBON_KEYS` (zero new bridge). New SSoT guard `isElectricalDeviceKind` (`mep-fixture-types.ts`, = socket ∨ data-outlet) consolidates the repeated `isSocketKind||isDataOutletKind` (IfcOutlet resolver + 3D box converter, Boy-Scout N.0.2). +1 test. (Data outlet counterpart → ADR-431.)
- **2026-06-09 (Opus 4.8):** ADR created. Slices 0+1+2 implemented. Tests: socket (Slice 0) + engine (Slice 1, demand/grouping/phase/sizing/integration) + commit (Slice 2), all green; full mep-design suite regression-free. Registry `electrical-strong` → active.
