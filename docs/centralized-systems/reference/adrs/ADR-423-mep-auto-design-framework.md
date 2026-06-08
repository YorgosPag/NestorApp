# ADR-423 — MEP Auto-Design Framework (Single Engine, All Disciplines)

> **Status:** 🔵 PROPOSED — architecture/vision **aligned & decisions locked** (2026-06-08 discussion session, Opus 4.8). No code yet. Authored at Giorgio's direction: *«όπως οι μεγάλοι παίχτες, όπως η Revit — FULL ENTERPRISE + FULL SSOT»*. Next step: Stage-0 Recognition child-ADR (Plan Mode).
> **Scope:** the *holistic* design for automating MEP network generation from a loaded DXF plan — **for ALL disciplines** (water, drainage, heating, electrical, ventilation, gas), through **one** parameterised engine, **not** six separate ones.
> **Decision driver (Giorgio):** before writing a single line of water-supply auto-design, define the common framework so every later discipline is *parameters, not a new engine*.

---

## 1. Context & Problem

Today the app has **all the building blocks** of every MEP network — linear segments, fittings, manifolds/sources, terminals, connectors, classification, auto-fittings, 3D, BOQ — but **no brain** that turns a freshly loaded architectural plan into a finished network automatically. A user still draws every pipe/wire/duct by hand.

The naive path — "automate water supply first, then copy-paste for heating, then for electrical…" — produces **six divergent engines** and violates SSOT. The big players (Autodesk Revit MEP, MagiCAD, 4M FINE/IDEA) do the opposite: **one MEP routing/sizing engine**, parameterised per discipline. Every MEP network is the *same abstract problem*.

**Decision:** build **one** MEP Auto-Design engine over the existing entity primitives. Water supply is the **pilot** that proves the framework; every subsequent discipline is a **registry entry + a recognizer**, measured in days not months.

> **Scope boundary (vs ADR-424):** this ADR routes MEP networks *through an existing building*. **Auto-creating the building itself** — walls/columns/shear-walls/beams/slabs/openings and the new foundation family (πέδιλα/πεδιλοδοκοί/δοκοί θεμελίωσης) — is a **different automation** (model authoring, not flow routing) and lives in its **sibling umbrella ADR-424 (Building Auto-Modeling)**. The two share **one** thing: the Stage-0 Recognition layer (see below).

---

## 2. The Common Abstraction — every network is a graph

> **Source → Distribution → Terminals**

| Discipline | Source | Distribution | Terminals | Flow model |
|---|---|---|---|---|
| Water (cold/hot) | meter / boiler | pipes + manifold | sanitary fixtures | pressurised, branched/manifold |
| Drainage | — (gravity) | pipes + φρεάτιο + risers | fixture traps | gravity + **slope** + venting |
| Heating (hydronic) | boiler | pipes + manifold | radiators / underfloor | closed supply+return loop |
| Electrical | panel | cables / circuits | luminaires / sockets | radial circuits (load, not flow) |
| Ventilation | AHU / fan | ducts | diffusers/grilles | air, large sections |
| Gas | meter | pipes | appliances | pressurised, safety-critical |

**What is COMMON (build once — the framework):** the graph model, recognition, routing, fittings, 3D, BOQ.
**What VARIES (parameters per discipline — never a new engine):** flow physics, sizing standard, terminal kinds, classification colours, routing constraints.

This is not aspirational: the existing entities (`mep-segment`, `mep-fitting`, `mep-manifold`, connectors, classification) are **already shared** across water/drainage/heating — which is the proof that the auto-design layer must be shared too.

### 2.1 Full discipline taxonomy (SSOT — committed in full now, implemented incrementally)

> **Decision (Giorgio, 2026-06-08): the registry declares ALL disciplines/classifications from day one** (reserved slots), so the model is SSOT-complete like Revit; terminals are built per the roadmap order. The two-level model is **Discipline → System Classification**. A crucial gap in the first draft was the missing **strong-current / weak-current** split — in Greek Η/Μ practice these are distinct studies/drawings (ισχυρά vs ασθενή ρεύματα).

| Group | System classification (registry id) | Greek | Status |
|---|---|---|---|
| **🔵 Plumbing / Drainage** | `domestic-cold-water` | ύδρευση κρύο | ✅ |
| | `domestic-hot-water` | ύδρευση ζεστό | ✅ |
| | `domestic-hot-water-recirc` | ανακυκλοφορία ζεστού | ❌ |
| | `sanitary-drainage` | αποχέτευση λυμάτων | ✅ |
| | `storm-drainage` | όμβρια | ❌ |
| | `drainage-vent` | αερισμός αποχέτευσης | ❌ (riser geom ✅) |
| **🟠 Heating / Cooling** | `hydronic-supply` / `hydronic-return` | θέρμανση προσαγωγή/επιστροφή | ✅ |
| | (underfloor — uses hydronic) | ενδοδαπέδια | ✅ |
| | `chilled-water-supply` / `-return` | ψύξη (fan coils) | ❌ |
| | `hvac-supply-air` / `-return-air` / `-exhaust-air` | αερισμός HVAC | ⚠️ duct primitive only |
| | `refrigerant` | VRV/split (ψυκτικό) | ❌ |
| **🟡 Fuel** | `natural-gas` (+ lpg variant) | φυσικό αέριο / υγραέριο | ❌ |
| **🔴 Fire protection** | `fire-suppression` | πυρόσβεση (sprinklers — pressurised water) | ❌ |
| | `fire-detection` | πυρανίχνευση (weak-current signal) | ❌ |
| **⚡ Electrical — STRONG current** | `lighting` | φωτισμός | ✅ |
| | `power-sockets` | ρευματοδότες/πρίζες | ❌ |
| | `lighting-control` | διακόπτες φωτισμού | ❌ |
| | `appliance-power` | παροχές συσκευών | ❌ |
| | `motor-power` | κινητήρες (ρολά/τέντες/ανεμούρια/γκαραζόπορτες) | ❌ |
| | `hvac-power` | παροχή κλιματιστικών | ❌ |
| | `earthing` | γείωση / αντικεραυνική | ❌ |
| **📡 Electrical — WEAK current** | `data-network` | δομημένη καλωδίωση / internet (RJ45) | ❌ |
| | `wireless-ap` | WiFi access points | ❌ |
| | `fiber-optic` | οπτικές ίνες | ❌ |
| | `tv-antenna` | TV / κεραία / δορυφορικό | ❌ |
| | `audio` | ηχητικά (ηχεία) | ❌ |
| | `cctv` | κάμερες / CCTV | ❌ |
| | `intercom` | θυροτηλέφωνο / θυροτηλεόραση | ❌ |
| | `security-alarm` | συναγερμός / ασφάλεια (PIR) | ❌ |
| | `building-automation` | BMS / αυτοματισμοί (θερμοστάτες) | ❌ |

> The current code connector enum `ElectricalSystemClassification = 'power' | 'lighting' | 'data' | 'controls'` (`mep-connector-types.ts:48`) is a **coarse subset** of the strong/weak catalog above; `'data'`/`'controls'` are reserved-but-unwired. The precise enum-vs-registry split (keep connector enum coarse + a finer registry classification, or expand the enum) is an implementation decision for the Stage-0 / discipline child-ADRs — the taxonomy here is the SSOT catalog the registry owns.

### 2.2 Current-state inventory (code = source of truth, 2026-06-08)

Verified by code sweep. **Four disciplines are functional end-to-end** (Source→Distribution→Terminals): water cold/hot, sanitary drainage, hydronic heating, electrical power/lighting circuits. Gaps that the framework must fill:

- **HVAC/ventilation:** only the `duct` primitive exists (`mep-segment` domain); **no** source (AHU/fan), terminals (diffusers), fan-coil or split units.
- **Gas:** zero code.
- **Storm drainage / drainage vent:** only `sanitary-drainage`; όμβρια & vent classifications absent.
- **Fire (`'fire'` discipline):** reserved but empty (`fire: []`).
- **Electrical:** only luminaires + panel + lighting/power circuits + derived home-run wires. **No** sockets, switches, motors, appliance feeds. Weak-current entirely absent (`'telecom'` discipline reserved-empty, `telecom: []`).

**SSOT confirmation:** the architecture absorbs the full taxonomy without forks. Extension points already exist: `MepFixtureKind` (annotated "future families append here"), `ElectricalSystemClassification` (non-breaking enum extension), `Discipline` (`'telecom'`/`'fire'` reserved). Every new network = **registry entry + recognizer + terminal kind**, never a new engine (§4).

---

## 3. The Pipeline — what runs the moment a DXF plan loads

### Stage 0 — Semantic Recognition (THE FOUNDATION — 🟢 pilot IMPLEMENTED, see **ADR-425**)
A bare DXF is *lines*; auto-design needs a *meaning model*. Common to all disciplines, with **pluggable per-discipline recognizers**. **Built 2026-06-08 — child-ADR ADR-425** (`systems/recognition/`): agnostic kernel (`RecognizedSpace`/`RecognizedElement`/`Recognizer`/`recognizeScene`/`RecognitionRegistry`) + sanitary terminal recognizer (pilot) + source recognizer + sanitary space classifier, reusing the ADR-419 region engine & ADR-408 Φ14 connectable fixtures. Authoring-agnostic per the binding ADR-424 §3 constraint. 16 tests green.
- **Room/Space detection:** closed wall loops → spaces; classify (bathroom / kitchen / WC / living) from contained fixtures. (Reuse perimeter/region engine — ADR-419.)
- **Terminal recognition:** locate the discipline's terminals — DXF block-name / geometry matching **or** existing BIM entities — and auto-promote them to *connectable* entities. Water/drainage → sanitary fixtures (ADR-408 Φ14 ✅); electrical → luminaires/sockets; heating → radiators; ventilation → diffusers.
- **Source detection:** entry point (meter), equipment location (boiler / panel / AHU).

> **Without Stage 0 nothing downstream has meaning.** It is the single non-negotiable prerequisite and the first thing to build.
>
> **Binding SSOT constraint (ADR-424):** Stage 0 is **shared** with the Building Auto-Modeling framework. Its contract MUST be designed **discipline-agnostic / authoring-agnostic** — not MEP-only — so structural/architectural auto-modeling consumes the same recognition without a fork. Build the semantic layer once; both frameworks read it.

### Stage 1 — Demand Model (design intent)
Each terminal declares its demand: which services (cold/hot/drain/power/air) + a **load figure** (Loading Units EN 806, DU EN 12056, VA / circuit for electrical, m³/h for air). Drives sizing.

> **Gap (research §10):** demand must be **standard-driven + diversified**, not a flat sum. Big players use an **editable loading-unit / discharge-unit database** per standard and apply a **diversity factor K** (water BS EN 806/8558/CIPHE; drainage EN 12056 `Qww = K·Σ√DU`). Also missing: **DHWR** (hot-water recirculation/return) demand. → the Demand model owns an editable LU/DU table + K-factor + recirculation, in the registry.

### Stage 2 — Auto-placement of equipment
- **Manifold/source** per wet-group / floor / circuit, at an accessible point. (`mep-manifold` ✅, `electrical-panel` ✅)
- **Risers** in shafts for multi-floor distribution. (ADR-408 Φ15 ✅ — vertical `mep-segment`, cross-floor «through» symbol.)

### Stage 3 — Auto-routing (the 2nd big gap)
Source → each terminal connector: **pathfinding** (A* / Manhattan along walls, avoiding openings & obstacles, respecting clearances), parallel runs for paired services (cold+hot, supply+return), snap to connectors (✅). Corner/junction auto-fittings (ADR-408 Φ11 ✅).

### Stage 4 — Auto-sizing & hydraulic calculation
Per-segment dimension from cumulative load + the discipline's sizing standard. Reducers where diameter steps down (✅ reducing elbow, Φ11).

> **Gap (research §10):** sizing alone is not the deliverable — the big players run a **validated hydraulic engine**: pressure-drop per network (Colebrook + CIBSE Guide C roughness, **dynamic factor auto-selected per fitting/flow**), **fan/pump head at the operating point** (minimum / fan / given-pressure modes), and **insulation/lagging series selection** as part of sizing. The engine must compute & validate, not just dimension. (Discipline-specific items — NPSH, pump curves, Hunter's curve — flagged §10 open.)

### Stage 5 — 3D + BOQ (already automatic)
3D mesh ✅, MEP → Προμετρήσεις/BOQ ✅.

### Stage 6 — Calculation, Validation & Compliance (NEW layer — the biggest gap)
A round-trip **calculation report** per discipline: sizing + balancing, with **design-criteria validation** (flags segments/terminals where criteria are not met) and **edit-in-report → update-model**. For electrical: **voltage-drop** (from wire sizes + feeder/branch lengths by equipment location) + load balancing. This is the "μηχανολογική μελέτη" deliverable that turns a drawn network into a *verified* one (ΤΟΤΕΕ/ΚΕΝΑΚ relevance).

### Stage 7 — Documentation Deliverables (NEW layer)
- **Automatic riser / single-line schematic diagrams** generated *and kept in sync* with the 3D model (bidirectional: model↔schematic). Covers electrical + ELV/data/communication.
- **Panel / switchboard schedules**, **cable-tray fill ratios & containment layout**, automatic **cable-packet routing** along trays, **parallel-supply multipliers**.
- Tags/annotations, single-line vs double-line representation, system browser / filters / color-fill. *(flagged §10 open — not verified this cycle.)*

### Stage 8 — Downstream Interoperability (NEW layer) — **interop-only (locked)**
**Decision (Giorgio, 2026-06-08): import/interop only — we do NOT build an internal radiosity/energy engine** (specialized, competes with ElumTools/IES — out of scope).
- **gbXML export** to energy-analysis engines (IES VE / OpenStudio-EnergyPlus / TRACE 3D Plus / Insight) for energy / CO₂ / comfort.
- **Photometric:** **import** external lighting studies (DIALux evo → IFC) with auto-placement of luminaires by storey/elevation. No in-app lux calculation.

### Coordination (committed stage, between Stage 3 and finalize)
**Decision (Giorgio, 2026-06-08): committed as a stage.** **Clash / interference detection** + **auto penetrations / sleeves** through walls & slabs — reuses our region/3D engine. (Exact feature-set vs Revit/Navisworks/MagiCAD flagged §10 open — to be detailed per the relevant child-ADR.)

---

## 4. Discipline Registry (SSOT — parameters, not engines)

A single `MepDisciplineRegistry` describes each network so the common engine specialises at runtime:

```
interface MepDiscipline {
  id: 'water-cold' | 'water-hot' | 'drainage' | 'heating' | 'electrical' | 'ventilation' | 'gas';
  terminalRecognizers: TerminalRecognizer[];   // Stage 0 — find the terminals
  sourceKind: EntityKind;                       // manifold | boiler | panel | AHU | meter
  segmentClassification: PlumbingSystemClassification | ...;
  flowModel: 'pressurised-branched' | 'gravity-slope' | 'closed-loop' | 'radial-circuit' | 'air-duct';
  sizingStandard: 'EN806' | 'EN12056' | 'HD384' | 'EN1505' | ...;
  paletteColor: string;                         // classification colour (ADR-375)
  routingConstraints: RoutingConstraints;       // min slope, clearances, parallel pairs
}
```

Adding gas, for example, becomes one registry entry + one terminal recognizer — **the engine, routing, fittings, 3D and BOQ are reused untouched.**

---

## 5. What we ALREADY have (reuse map — minimise new code)

| Capability | Status | Where |
|---|---|---|
| Linear segments (pipe/duct) + 3D placement | ✅ | `mep-segment`, ADR-408 Φ8 |
| Auto-fittings (elbow/tee/cross/reducer/cap) | ✅ | ADR-408 Φ11 |
| Manifolds / sources | ✅ | `mep-manifold`, boiler, panel |
| Risers + cross-floor symbol | ✅ | ADR-408 Φ15 |
| Connectors + snap | ✅ | ADR-408 Φ9 |
| Classification + palette | ✅ | ADR-408 hydronic / ADR-375 |
| Sanitary fixtures (connectable) | ✅ | ADR-408 Φ14 |
| Electrical (panel/wires/home-run) | ✅ | ADR-408 Φ3/Φ7 |
| Heating (radiator/boiler/underfloor/thermal spaces) | ✅ | ADR-408 Εύρος Β / ADR-422 |
| 2D floorplan symbols + library | ✅ | ADR-415 |
| 3D mesh + MEP→BOQ | ✅ | ADR-408 |
| **Stage 0 Recognition** | 🟢 | **ADR-425 — pilot built (`systems/recognition/`)** |
| **Stage 1 Demand (Loading Units)** | 🟢 | **ADR-426 — water pilot (EN806 LU, `systems/mep-design/water/`)** |
| **Stage 3 Auto-routing (pathfinding)** | 🟡 | **ADR-426 — deterministic Manhattan trunk-branch (v1, not yet wall-aware)** |
| **Stage 4 Auto-sizing** | 🟡 | **ADR-426 — ΣLU→DN (DIN1988-3); validated hydraulics later** |
| **Discipline registry** | 🟡 | **ADR-426 — water descriptor seed (full registry when 2nd discipline lands)** |

We own almost every brick of every network. We are missing the **brain**: Recognition + Routing + Sizing + the Registry that binds them.

---

## 6. Roadmap (incremental, water = pilot)

1. **ADR-423 (this) — framework architecture.** Define the graph model, the registry, the Stage-0 contract.
2. **Stage 0 Recognition (common)** — room detection + a *sanitary* terminal recognizer (pilot). Output: connectable fixtures + classified spaces.
3. **Water-supply pilot** — Demand → Placement → Routing → Sizing end-to-end, proving the framework on one discipline.
4. **Generalise** — promote anything water-specific that leaked into the engine back to the registry.
5. **Add disciplines** — each = registry entry + recognizer.

**Confirmed implementation order (Giorgio, 2026-06-08)** — maximises reuse, follows the flow of a Greek Η/Μ study:

> **Water supply (pilot) → Drainage → Heating → Electrical STRONG → HVAC/Ventilation → Electrical WEAK → Fire (suppression + detection) → Gas.**

Rationale: the plumbing group (water + drainage) ships first — all its primitives exist (pipes/slope/risers/φρεάτιο). Heating reuses the closed-loop terminals already built. Electrical strong-current is high-value (every project) and reuses panel/circuit/home-run. HVAC needs duct sizing + terminals. Weak-current is the same radial/star engine as strong, added as terminal kinds + classifications. Fire suppression reuses the pressurised-water engine; fire detection reuses weak-current. Gas is smallest (meter→appliances) but safety-critical, so last.

Each step is its own Plan-Mode ADR; this ADR is the umbrella they hang from.

---

## 7. Standards (per-discipline sizing references)
- Water: EN 806 / DIN 1988 (Loading Units).
- Drainage: EN 12056 (Discharge Units, slope).
- Electrical: ΕΛΟΤ HD 384 (circuits, loads).
- Ventilation: EN 1505/1506 (duct sizing).
- Gas: EN 1775 / national gas code.

(Each lives behind `sizingStandard` in the registry — pluggable, never hard-coded in the engine.)

---

## 8. Open Questions — RESOLVED (Giorgio, 2026-06-08)
All decisions taken at Giorgio's direction: *«όπως οι μεγάλοι παίχτες, όπως η Revit — FULL ENTERPRISE + FULL SSOT»*.

1. **Recognition source → tiered, one contract.** Tier 1 (pilot): existing BIM entities (sanitary fixtures already connectable, Φ14) + room detection (reuse ADR-419 perimeter engine). Tier 2: DXF block-name catalog (imported plans). Tier 3 (deferred): geometry/ML fuzzy matching for messy plans. All tiers feed the **same** recognition contract — no rewrite when later tiers land.
2. **Routing autonomy → suggest + batch preview.** Revit-style "Generate → review → accept": the engine produces the whole network, shows a preview, the user edits individual runs before commit. Engine starts as a **deterministic orthogonal (Manhattan) router** in one distribution plane, architected to grow into full 3D obstacle-aware pathfinding.
3. **Re-routing on edit → Phase 2.** Reuse the cross-floor re-feed pattern (ADR-421).
4. **Discipline order → confirmed** (see §6): Water → Drainage → Heating → Electrical STRONG → HVAC → Electrical WEAK → Fire → Gas.
5. **Demand model → full Loading Units from day one.** The data model holds EN 806 / EN 12056 loading/discharge units from the start; the pilot runs with a standard per-fixture table; the sizing standard is **pluggable** in the registry (never hard-coded in the engine).
6. **Taxonomy scope → full ~30-classification catalog committed now** (§2.1), implemented incrementally per §6.

---

## 9. Decision
Build a **single MEP Auto-Design engine** over the existing entity primitives, parameterised by a **Discipline Registry**, fed by a **common Recognition layer**. Water supply is the pilot. No discipline gets a bespoke engine. This ADR is the umbrella; each stage/discipline is a child ADR in Plan Mode.

---

## 10. Competitive gap analysis (deep web research, 2026-06-08)

Multi-agent web research (109 agents, 26 sources, 25 claims adversarially verified — 23 confirmed 3-0, 2 killed). Benchmarked against **MagiCAD** (for Revit/AutoCAD/BricsCAD), **Design Master ElectroBIM**, **ElumTools**, with cross-checks on Revit MEP / Trimble / gbXML.org. **Core finding:** our pipeline correctly builds & routes the model, but **stops at Stage 5 (3D+BOQ)** — the leading tools add three layers on top. The methodology note confirms our direction: those tools also compute *on an already-modeled network*, so our auto-placement/auto-routing (Stages 2–3) is the right precursor; the real gap is the **calculation / validation / deliverables** layer on top.

| Gap | Stage | Who has it | Why it matters |
|---|---|---|---|
| Validated **hydraulic / pressure-drop** engine (Colebrook + CIBSE Guide C, dynamic-factor per fitting, fan/pump head, 3 pressure modes) | 4 | MagiCAD (CIBSE-certified) | Sizing alone ≠ a verified network |
| **Diversity factor K + editable LU/DU database + DHWR** | 1 | MagiCAD (BS EN 806/8558/12056) | Flat sums over-size; codes mandate diversification |
| **Insulation / lagging selection** in calc reports | 4–5 | MagiCAD | Part of sizing & BOQ; missing entirely from us |
| **Calculation report + balancing + design-criteria validation** (edit-in-report→update-model) | 6 | MagiCAD | The "μηχανολογική μελέτη" deliverable (ΤΟΤΕΕ/ΚΕΝΑΚ) |
| **Voltage-drop + panel/switchboard schedules** | 6 | ElectroBIM, MagiCAD | Mandatory electrical study output |
| **Cable-tray fill ratios + auto cable-packet routing + parallel-supply multipliers** | 6–7 | MagiCAD | We only derive home-run wires |
| **Automatic riser / single-line schematics, bidirectional model↔schematic sync** | 7 | MagiCAD, ElectroBIM | Standard electrical + ELV deliverable |
| **gbXML export → energy/CO₂/comfort engines** | 8 | Revit/AutoCAD MEP/Bentley/ArchiCAD → Insight/TRACE/IES VE/OpenStudio | Downstream energy analysis interoperability |
| **Photometric / lux analysis** (radiosity) or DIALux-evo→IFC import | 8 | ElumTools, MagiCAD 2025 | We have lighting discipline but zero lux calc |
| **Clash detection + penetrations/sleeves** | coord. | Revit/Navisworks, MagiCAD | Coordination deliverable *(flagged open)* |

**Honesty caveats (from the research):** (1) most claims rest on vendor primary sources (capability-existence, not independent performance benchmarks) — several cross-checked with non-marketing help docs / CIBSE certification. (2) Several explicitly-requested topics **did not pass verification this cycle** and are NOT confirmed here: clash detection, vent-stack sizing, hangers/supports, penetrations/sleeves, NPSH/Hunter's curve, tags/single-vs-double-line, prefabrication/spooling, accessories, access clearances, system browser/color-fill. Their absence ≠ the tools lack them (they have them) — only that they weren't verified. (3) Two claims were **refuted**: MagiCAD-Electrical↔DIALux-evo on *all* platforms (0-3); dedicated riser tool on Revit+AutoCAD+BricsCAD *simultaneously* (1-2) — exact platform coverage varies per feature. → these gaps need a targeted follow-up research/Plan-Mode pass before committing, especially weighed against Greek regulatory must-haves (ΤΟΤΕΕ/ΚΕΝΑΚ) vs nice-to-have.

### 10.1 Scope decisions (locked — Giorgio, 2026-06-08)
- **Stage 6 (Calculation / Validation / Compliance) → CORE deliverable.** The "μηχανολογική μελέτη" (pressure-drop, voltage-drop, calc reports, design-criteria validation per ΤΟΤΕΕ/ΚΕΝΑΚ) is a primary goal — without it the app is a drawing tool, not a study tool.
- **Stage 8 (Energy / Photometric) → import/interop ONLY.** gbXML export to external engines + DIALux→IFC import. **No** internal radiosity/energy engine.
- **Coordination (clash + penetrations/sleeves) → COMMITTED** as a stage between routing and finalize, reusing the region/3D engine.
- **No second research pass now** — the unverified items (clash feature-set, vent-stack/DN-DFU, NPSH/pump curves, annotations) are researched **per discipline when its turn comes**. Priority = implementation: next step is the shared Stage-0 Recognition child-ADR.

---

## Changelog
- **2026-06-09 (Opus 4.8) — Drainage (2nd discipline) Slice 2 IMPLEMENTED: preview + commit (child ADR-427).** The Revit "Generate → review → accept" loop for the 2nd discipline, mirroring the water Slice 2 1:1 — low-freq `drainage-proposal-store` (ADR-040-safe), pure `build-drainage-commit` (sloped segments via SSoT `completeMepSegmentFromTwoClicks`, per-endpoint descending z + slope, MepSystem rooted at the φρεάτιο), brown ghost leaf (SSoT colour, no literal hex), and a Generate/Accept/Reject ribbon bridge composed through `useDxfBimBridges`/`useRibbonCommands`. Confirms the framework's preview/commit layer is itself reusable across disciplines (same stores/commands/ghost-renderer; only the proposal shape differs). 14 drainage tests + 15 water regression green. Ghost mount STAGEs ADR-040. See **ADR-427**.
- **2026-06-09 (Opus 4.8) — Drainage (2nd discipline) Slice 1 IMPLEMENTED + `MepDisciplineRegistry` born (child ADR-427).** The discipline that generalises the pilot: gravity sanitary-drainage auto-design (`systems/mep-design/drainage/`) over the Stage 0 model — EN 12056-2 System I Discharge-Unit demand + collector-rooted gravity routing (growing cumulative-DU diameters; WC ≥ DN100 via suffix-max min-Ø propagation) + DN-aware slope assignment (monotonic descent to the φρεάτιο invert) → `DrainageNetworkProposal` (transient). **§4 registry now real** (`registry/mep-discipline-registry.ts`: 2 active + 6 reserved) and the shared engine **generalised** out of `water/` — `routing/orthogonal-router.ts` (moved, + generic `minBranchDiameterMm` propagation; water unchanged) + `shared/connector-resolve.ts` (moved). Proves the framework promise: a new network = a registry entry + a recognizer (the sanitary recognizer already exposed the drain connector). Pluggable demand/sizing standards. 22 tests green (9 drainage + 13 water regression). Outside ADR-040 (Slice 2 = preview+commit next). See **ADR-427**.
- **2026-06-08 (Opus 4.8) — Water-supply pilot Slice 1 IMPLEMENTED (child ADR-426).** Headless 4-stage engine (`systems/mep-design/water/`) over the Stage 0 model: EN806 Loading-Units demand + deterministic Manhattan **trunk-branch router** (cumulative-LU → diminishing diameters) + DIN1988-3 ΣLU→DN sizing → `WaterNetworkProposal` (transient). Pluggable demand/sizing standards via a discipline descriptor (the §4 registry seed). Confirmed by code sweep that demand/sizing/routing did not exist before. 8 tests green. Slice 2 (preview+commit, touches ADR-040) next. Updated §3 Stage 1/3/4 + §5 reuse map. See **ADR-426**.
- **2026-06-08 (Opus 4.8) — Stage 0 pilot IMPLEMENTED (child ADR-425).** Built the agnostic recognition layer (`systems/recognition/`): kernel (spaces/elements/recognizer/engine/registry) + sanitary terminal recognizer + MEP source recognizer + sanitary space classifier, reusing the ADR-419 region engine and ADR-408 Φ14 connectable fixtures. Authoring-agnostic (binding ADR-424 §3). `polygonCentroid` SSoT added to polygon-math (Boy-Scout). 16 tests green. Transient read-model (no persistence). Outside ADR-040. Updated §3 Stage 0 + §5 reuse map. See **ADR-425** for the full design.
- **2026-06-08 (Opus 4.8) — competitive gap analysis.** Deep web research (109-agent harness, MagiCAD/ElectroBIM/ElumTools benchmarked, 23/25 claims confirmed 3-0). Added **§10 gap analysis** and extended the pipeline (§3): enriched **Stage 1** (diversity factor K + editable LU/DU DB + DHWR), **Stage 4** (validated hydraulic engine: Colebrook/CIBSE pressure-drop, fan/pump head, insulation selection), and added three new layers — **Stage 6 Calculation/Validation/Compliance** (calc reports, balancing, design-criteria validation, voltage-drop, schedules), **Stage 7 Documentation Deliverables** (auto riser/single-line schematics with bidirectional sync, panel/switchboard schedules, cable-tray fill, tags), **Stage 8 Downstream Interoperability** (gbXML energy export, photometric/lux). Added a cross-cutting **Coordination** note (clash detection + penetrations/sleeves). Honesty caveats preserved (vendor sources; clash/hangers/sleeves/NPSH unverified this cycle). No code.
- **2026-06-08 (Opus 4.8) — alignment session.** Folded in the discussion decisions: (a) **§2.1 full discipline taxonomy** — 8 discipline groups / ~30 system classifications, with the previously-missing **strong-current / weak-current** electrical split (sockets, switches, motors, appliance feeds, earthing vs data/wifi/fiber/TV/audio/CCTV/intercom/security/BMS); (b) **§2.2 current-state inventory** grounded in a code sweep (4 functional disciplines, HVAC primitive-only, gas/fire/weak-current absent) with SSOT extension-point confirmation; (c) **§6 confirmed implementation order** (Water→Drainage→Heating→Electrical STRONG→HVAC→Electrical WEAK→Fire→Gas); (d) **§8 open questions RESOLVED** (tiered recognition, suggest+batch-preview routing, full Loading-Units demand from day one, re-route deferred to Phase 2, full taxonomy committed now). Decisions taken by Giorgio (Revit-grade, full enterprise + SSOT). Still no code.
- **2026-06-08 (Opus 4.8)** — ADR created (PROPOSED). Holistic architecture for automating all MEP networks via one engine + discipline registry + common recognition layer, after Giorgio asked whether to design all disciplines before starting water supply (answer: yes — framework first). No code; defines the abstraction, the pipeline (Recognition→Demand→Placement→Routing→Sizing→3D/BOQ), the reuse map, and the roadmap (water pilot first). Builds on ADR-408 (MEP connectors/segments/fittings/manifolds/risers), ADR-422 (thermal spaces), ADR-415 (2D symbols), ADR-419 (region/perimeter), ADR-375 (palette), ADR-399 (multi-floor).
