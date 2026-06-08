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

### Stage 0 — Semantic Recognition (THE FOUNDATION — currently missing)
A bare DXF is *lines*; auto-design needs a *meaning model*. Common to all disciplines, with **pluggable per-discipline recognizers**:
- **Room/Space detection:** closed wall loops → spaces; classify (bathroom / kitchen / WC / living) from contained fixtures. (Reuse perimeter/region engine — ADR-419.)
- **Terminal recognition:** locate the discipline's terminals — DXF block-name / geometry matching **or** existing BIM entities — and auto-promote them to *connectable* entities. Water/drainage → sanitary fixtures (ADR-408 Φ14 ✅); electrical → luminaires/sockets; heating → radiators; ventilation → diffusers.
- **Source detection:** entry point (meter), equipment location (boiler / panel / AHU).

> **Without Stage 0 nothing downstream has meaning.** It is the single non-negotiable prerequisite and the first thing to build.
>
> **Binding SSOT constraint (ADR-424):** Stage 0 is **shared** with the Building Auto-Modeling framework. Its contract MUST be designed **discipline-agnostic / authoring-agnostic** — not MEP-only — so structural/architectural auto-modeling consumes the same recognition without a fork. Build the semantic layer once; both frameworks read it.

### Stage 1 — Demand Model (design intent)
Each terminal declares its demand: which services (cold/hot/drain/power/air) + a **load figure** (Loading Units EN 806, DU EN 12056, VA / circuit for electrical, m³/h for air). Drives sizing.

### Stage 2 — Auto-placement of equipment
- **Manifold/source** per wet-group / floor / circuit, at an accessible point. (`mep-manifold` ✅, `electrical-panel` ✅)
- **Risers** in shafts for multi-floor distribution. (ADR-408 Φ15 ✅ — vertical `mep-segment`, cross-floor «through» symbol.)

### Stage 3 — Auto-routing (the 2nd big gap)
Source → each terminal connector: **pathfinding** (A* / Manhattan along walls, avoiding openings & obstacles, respecting clearances), parallel runs for paired services (cold+hot, supply+return), snap to connectors (✅). Corner/junction auto-fittings (ADR-408 Φ11 ✅).

### Stage 4 — Auto-sizing
Per-segment dimension from cumulative load + the discipline's sizing standard. Reducers where diameter steps down (✅ reducing elbow, Φ11).

### Stage 5 — 3D + BOQ (already automatic)
3D mesh ✅, MEP → Προμετρήσεις/BOQ ✅.

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
| **Stage 0 Recognition** | ❌ | **NEW — the foundation** |
| **Stage 3 Auto-routing (pathfinding)** | ❌ | **NEW** |
| **Stage 4 Auto-sizing** | ❌ | **NEW** |
| **Discipline registry** | ❌ | **NEW (small)** |

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

## Changelog
- **2026-06-08 (Opus 4.8) — alignment session.** Folded in the discussion decisions: (a) **§2.1 full discipline taxonomy** — 8 discipline groups / ~30 system classifications, with the previously-missing **strong-current / weak-current** electrical split (sockets, switches, motors, appliance feeds, earthing vs data/wifi/fiber/TV/audio/CCTV/intercom/security/BMS); (b) **§2.2 current-state inventory** grounded in a code sweep (4 functional disciplines, HVAC primitive-only, gas/fire/weak-current absent) with SSOT extension-point confirmation; (c) **§6 confirmed implementation order** (Water→Drainage→Heating→Electrical STRONG→HVAC→Electrical WEAK→Fire→Gas); (d) **§8 open questions RESOLVED** (tiered recognition, suggest+batch-preview routing, full Loading-Units demand from day one, re-route deferred to Phase 2, full taxonomy committed now). Decisions taken by Giorgio (Revit-grade, full enterprise + SSOT). Still no code.
- **2026-06-08 (Opus 4.8)** — ADR created (PROPOSED). Holistic architecture for automating all MEP networks via one engine + discipline registry + common recognition layer, after Giorgio asked whether to design all disciplines before starting water supply (answer: yes — framework first). No code; defines the abstraction, the pipeline (Recognition→Demand→Placement→Routing→Sizing→3D/BOQ), the reuse map, and the roadmap (water pilot first). Builds on ADR-408 (MEP connectors/segments/fittings/manifolds/risers), ADR-422 (thermal spaces), ADR-415 (2D symbols), ADR-419 (region/perimeter), ADR-375 (palette), ADR-399 (multi-floor).
