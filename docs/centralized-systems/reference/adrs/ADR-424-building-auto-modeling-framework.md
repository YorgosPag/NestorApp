# ADR-424 — Building Auto-Modeling Framework (Architectural + Structural from DXF)

> **Status:** 🔵 PROPOSED (architecture/vision — no code yet). Authored 2026-06-08 (Opus 4.8), at Giorgio's direction: *«όπως οι μεγάλοι παίχτες, όπως η Revit — FULL ENTERPRISE + FULL SSOT»*.
> **Scope:** the *sibling* framework to ADR-423. Where ADR-423 routes **MEP networks through an existing building**, this ADR is about **auto-creating the building itself** from a loaded DXF — architectural + structural elements (walls, columns, shear walls, beams, slabs, openings) **and the foundation family that does not yet exist** (footings, footing/tie beams, foundation beams, rafts, piles).
> **Decision driver (Giorgio, 2026-06-08):** asked whether auto-creation of columns/shear-walls/walls/beams/slabs/openings/footings belongs in the MEP auto-design (ADR-423). Answer: **no — it is a different kind of automation** (authoring the model, not routing flow), so it gets its own umbrella, **but it shares the common Recognition layer** with ADR-423.

---

## 1. Why this is NOT part of ADR-423

| | ADR-423 (MEP Auto-Design) | ADR-424 (this — Building Auto-Modeling) |
|---|---|---|
| **Input** | a modelled building | raw DXF geometry (lines, hatches, blocks) |
| **Output** | networks (pipes/ducts/wires) | the building elements themselves |
| **"Physics"** | flow graph: Source→Distribution→Terminals | geometry recognition + (for structure) loads & code-checking |
| **Engine** | routing + sizing of conduits | element recognition + generation + structural sizing |

Folding the two into one engine is the "giant blob" anti-pattern. Revit keeps them separate (Architecture/Structure authoring ≠ MEP systems). Two umbrellas, **one shared foundation: the Recognition layer (§3).**

---

## 2. The three sub-domains of building auto-modeling

1. **Element recognition & generation (geometry)** — DXF lines/hatches/blocks → BIM `wall` / `column` / shear-wall / `beam` / `slab` / `opening`. This is "DXF-to-BIM authoring" (scan-to-BIM). **Partly exists already** (§5).
2. **Foundation family (NEW entities)** — πέδιλα (pad footings), πεδιλοδοκοί (footing/tie beams), δοκοί θεμελίωσης (foundation/grade beams), γενική κοιτόστρωση (raft/mat), κεφαλόδεσμοι/πάσσαλοι (pile caps/piles). **Zero code today** — needs a new structural entity family first (IfcFooting / IfcPile / IfcBeam-as-foundation).
3. **Structural design/sizing (loads → dimensions)** — size footings/beams/columns from axial loads + a code (Eurocode 2/7, legacy ΕΚΩΣ/ΕΑΚ). This is an **engineering-calculation** layer analogous to MEP sizing, but it needs a load model / structural analysis. **Heaviest, most deferrable** — auto-*modeling* (1+2, geometry) is feasible reuse; auto-*design* of structure (3) is a separate major undertaking and may stay design-only or integrate an external analysis engine.

> Honest scoping: #1 and #2 are tractable on the existing primitives. #3 (real structural sizing) is a large, standards-heavy domain — flagged as a distinct later phase, not promised by this umbrella.

---

## 3. The shared Recognition layer (SSOT with ADR-423)

> **The single most important SSOT decision: Stage 0 Recognition is built ONCE and feeds BOTH frameworks.**

A bare DXF is *lines*; both MEP auto-design and building auto-modeling need a *meaning model*:
- lines → walls (centerlines, thickness from parallel pairs / hatch)
- closed loops → spaces/rooms (reuse perimeter/region engine — ADR-419)
- blocks/geometry → typed elements (columns, openings, fixtures)

ADR-423's Stage 0 and this ADR's recognition are **the same layer**. Therefore: **when Stage 0 is designed (the next ADR-423 step), its contract MUST be discipline-agnostic / authoring-agnostic** — not MEP-only — so building auto-modeling consumes it without a fork. This is a binding constraint on the Stage 0 child-ADR.

---

## 4. The pipeline (analog of ADR-423, authoring side)

1. **Recognition** (shared, §3) — lines/blocks/loops → typed geometry + spaces.
2. **Element generation** — promote recognized geometry to BIM entities (walls/columns/shear-walls/beams/slabs/openings), with family-type assignment (reuse ADR-412 auto-typing).
3. **Structural assembly** — column grid, beam-to-column framing, slab-on-beams, then the foundation family under columns/walls.
4. **(Sub-domain #3) Load takeoff + sizing** — cumulative loads → member/footing dimensions + reinforcement, per the selected code. Deferred / heaviest.
5. **3D + BOQ** — already automatic for existing element types; foundations need new mesh + BOQ (ΑΤΟΕ/structural articles).

---

## 5. What we ALREADY have (reuse map)

| Capability | Status | Where |
|---|---|---|
| Element entities: wall/column/beam/slab/opening/stair/roof/railing/floor-finish | ✅ | base-entity `EntityType` |
| Shear wall (τοιχίο) via column adjacency merge | ✅ | ADR-363 |
| Interactive auto-creation: columns/walls "σε περιοχή" from perimeters | ✅ | ADR-419, `auto-area`, `column-from-faces`, `perimeter-from-faces`, `column-adjacency-detector` |
| Family/Types + auto-typing on create/load | ✅ | ADR-412/414/421 |
| Region/perimeter detection (smallest-loop, gap-tol) | ✅ | ADR-419 |
| 3D mesh + BIM→BOQ for existing elements | ✅ | ADR-413 etc. |
| **Full-plan auto-modeling (recognize whole DXF → generate all structure)** | ❌ | **NEW — shared Recognition + element generation** |
| **Foundation entity family** (footing/footing-beam/foundation-beam/raft/pile) | ❌ | **NEW — structural entities** |
| **Structural load takeoff + sizing** | ❌ | **NEW — heaviest, deferrable (sub-domain #3)** |

The superstructure primitives + interactive auto-area already exist. Missing: (a) **whole-plan** recognition→generation (shared with ADR-423), (b) the **foundation family**, (c) **structural sizing**.

---

## 6. Roadmap (incremental)

1. **ADR-424 (this) — framework architecture.** Define the boundary vs ADR-423, the shared-recognition constraint, the foundation family contract.
2. **Shared Stage 0 Recognition (authored under ADR-423)** — designed authoring-agnostic so both frameworks consume it.
3. **Element generation pilot** — whole-plan walls + columns + openings from recognition (extends ADR-419 from interactive to full-plan).
4. **Foundation family** — new structural entities (πέδιλα/πεδιλοδοκοί/δοκοί θεμελίωσης/raft/piles) + 3D + BOQ; auto-place under columns/walls.
5. **Structural sizing (sub-domain #3)** — load takeoff + code-based dimensioning. Separate, standards-heavy; may integrate external analysis. Deferred.

Each step is its own Plan-Mode ADR; this ADR is the umbrella.

---

## 7. Open Questions (to resolve before code)
1. **Recognition trust** — same tiered contract as ADR-423 §8 (BIM entities → block-names → geometry/ML). Shared, not duplicated.
2. **Generation autonomy** — suggest + preview (like ADR-423 routing) vs auto-commit. Recommended: suggest + preview, reuse the same review UX.
3. **Foundation entity granularity** — one `foundation` entity with a `kind` discriminator (pad/strip/beam/raft/pile-cap/pile), mirroring `mep-manifold`/`mep-fixture` kind pattern? (Recommended — minimises `EntityType` churn.)
4. **Structural sizing scope** — design-only geometry now, real Eurocode sizing later, or out of scope entirely? (Giorgio to decide when #4/#5 approach.)

---

## 8. Decision
Building auto-modeling (architectural + structural element creation from DXF, **including a new foundation family**) is a **sibling framework to ADR-423**, not part of it. The two share **one Recognition layer** (built once, authoring-agnostic). Structural *sizing* (loads→dimensions) is a distinct, deferrable sub-domain. This ADR is the umbrella; each stage is a child ADR in Plan Mode.

---

## Changelog
- **2026-06-08 (Opus 4.8)** — ADR created (PROPOSED). Sibling umbrella to ADR-423, after Giorgio asked whether auto-creation of columns/shear-walls/walls/beams/slabs/openings/footings/footing-beams/foundation-beams belongs in MEP auto-design (answer: no — it is model-authoring automation, a different engine, sharing only the Recognition layer). Defines the boundary vs ADR-423, the three sub-domains (element recognition/generation, the NEW foundation family, structural design/sizing), the binding shared-recognition constraint on ADR-423's Stage 0, the reuse map (superstructure primitives + ADR-419 interactive auto-area exist; whole-plan recognition + foundation family + structural sizing are NEW), and the roadmap. No code. Builds on ADR-419 (region/perimeter), ADR-363 (column adjacency/shear walls), ADR-412/414/421 (family types/auto-typing), ADR-423 (shared Recognition).
