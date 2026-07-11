# ADR-611: Stair geometry generators + run computers SSoT

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the 12-kind stair geometry engine under `src/subapps/dxf-viewer/bim/geometry/stairs/`. Every `compute*` kind file (straight, l-shape, u-shape, gamma, spiral, helical, elliptical, winder, triangular-fan, triangular-outline, sketch, v-shape) repeated the SAME four families of geometry code — the `StairGeometry` assembly tail, the rectilinear/edge flight builders, the polar (radial) tread/riser/stringer/cut-line loops, and the walkline-following wedge builders. Collapsed onto two new SSoT modules — **`stair-geometry-generators.ts`** (low-level generators + assemblers) and **`stair-geometry-runs.ts`** (composed run computers) — turning most kind files into thin thunks with identical public API.

**Related:**
- **ADR-358** — the stair tool spec (all §5.1/§6.2/§6.3 conventions reproduced 1:1).
- **ADR-370 Phase 5.3** — the diagonal `Segment3D` riser encoding (preserved verbatim in every generator).
- **ADR-605 / 606 / 607 / 609 / 610** — the same multi-day jscpd sweep (factory / Template-Method + thin bindings archetype). ADR-611 is the pure-geometry bucket.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration to zero.

---

## Context

A real SSoT audit (grep + full diffs of all 14 stair files against `stair-geometry-shared.ts`, plus a jscpd pass listing **49 intra-dir clone pairs / 716 cloned lines** — `bim/geometry/stairs`, the 6th-largest cluster in `src/`) showed the only pre-existing shared owner was `stair-geometry-shared.ts` (Vec2/point/rectangleAt/cut-plane/stringer/handrail primitives). On top of those primitives every kind re-implemented the same structures, with the variance living on a small number of axes:

1. **Assembly tail** — arrow + cut-plane split + tread labels + handrails + bbox + the 13-field `StairGeometry` return — identical across all 12 kinds (u-shape and gamma even carried private copies of `splitTreadsByCutPlane`).
2. **Rectilinear flights** (straight / l-u-gamma flight 1 / v-shape arm / winder flight 1) and **edge-origin flights** (l-u flight 2 / gamma intermediate / winder flight 2) — same tread-quad + diagonal-riser loops, differing only by origin/axis/z-base.
3. **Radial kinds** (spiral / helical / triangular-fan) — spiral and fan are literally the same apex-wedge geometry with a different centre field; helical is the annular (inner+outer radius) generalisation. All three differ only by a `{center, innerRadius, outerRadius, sweep, turnDirection, apex}` config.
4. **Walkline-following kinds** (elliptical / sketch) — identical chord-perpendicular wedge treads + cut-line; sketch is exactly the elliptical `sign = +1` case (risers included).

---

## Decision

Big-player component model (Revit / ArchiCAD / Vectorworks expose a *small* set of StairsRun component types, not one bespoke generator per visual variant), split across two modules layered on the existing primitives:

### 1. `stair-geometry-generators.ts` — generators + assemblers
- **Flights:** `buildRectilinearFlight` (centreline origin) · `buildFlightFromEdge` (one-edge origin) → `FlightGeometry {treads, risers}`.
- **Polar primitives:** `buildAngularGrid` · `radialPoint` · `radialTangentAt`.
- **Walkline primitives:** `chordTangent` · `buildWalklineTreads` · `buildWalklineRisers` · `buildWalklineCutLine`.
- **Assemblers:** `assembleStairGeometry` (the universal builder) · `assembleSingleFlightWalkline` (single-flight, arrow = walkline endpoints) · `assembleMultiFlight` (stringers + `buildCutLineForFlights` + assemble) · `assembleTwoFlightLanding` + `resolveSwitchbackBase` (the l-shape/u-shape switchback pair).

### 2. `stair-geometry-runs.ts` — composed run computers
- **`computeRadialStair(params, RadialStairConfig)`** — the single SSoT for spiral / helical / triangular-fan (CurvedStairsRun). `apex` collapses the inner radius to a triangular wedge; annular mode gives quad treads.
- **`computeWalklineStair(params, walkline, sign)`** — the SSoT for elliptical / sketch (SketchStairsRun): treads/risers/stringers/cut-line all derive from the sampled walkline.

### 3. Thin kind files
- spiral / helical / triangular-fan → one `computeRadialStair(...)` call each (config-only).
- elliptical / sketch → sample the walkline, delegate to `computeWalklineStair`.
- l-shape / u-shape → `resolveSwitchbackBase` + build flights + `assembleTwoFlightLanding`.
- gamma / v-shape / winder → build flights + `assembleMultiFlight`. The winder-zone assembly is itself an SSoT (`assembleWinderRun` in `stair-geometry-winder.ts`) shared by the winder kind and l-shape-with-winders (arrow passed as a callback).
- straight stays in `StairGeometryService.ts` but its flight now comes from `buildRectilinearFlight` + `assembleStairGeometry`.

The winder kind keeps its exported layout/fan helpers (`WinderLayout`, `buildWinderLayout`, `buildWinderFlight1/2`, `buildWinderTreads`, `buildWinderWalkline`, `rotateVec`, `winderTangentAt`) for the l-shape-with-winders reuse; flights 1/2 now delegate to the shared generators.

### Consequences
- **−47 jscpd clones** in the full `src/` scan (3637 → 3590, CHECK 3.28).
- Intra-dir clones `716 → 0` cloned lines among the touched files (`--diff` clean; the sole residual pair is a pre-existing intra-file clone in the untouched `stair-geometry-labels.ts`).
- All **155 stair geometry tests** stay green (15 suites) — every migration is byte-identical geometry, verified against the per-kind `__tests__/`.
- **Sibling-clone iteration** (N.18): first cut 49→22, unifying assemblers 22→6, the radial-run + walkline-run + winder-run + switchback helpers 6→0.
- Public API unchanged: `computeStairGeometry` (247 external refs) + `computeWalkline` + the `stair-geometry-shared.ts` primitives + the winder exports all keep their signatures.
- A future radial variant = a `RadialStairConfig`; a future switchback = `resolveSwitchbackBase` + `assembleTwoFlightLanding`; a future free-form run = `computeWalklineStair`.

---

## Per-tread overrides (ADR-358 Q19 Φ4)

The 12-kind SSoT choke point (`assembleStairGeometry`) is also where **per-tread finish overrides** land. A `StairPerTreadOverride` (keyed by 0-based GLOBAL build-order tread index — the same key `resolveStairMaterial(treadIndex)` and the 3D `stairComponentIndex` tag use) can carry a scalar `nosing` overhang OR a full `customProfile` (Revit "Nosing Profile" — a `Point2D` depth×height section, **not** a plan outline).

- **`stair-tread-overrides.ts`** — the per-tread geometry SSoT:
  - `resolveTreadNosing(params, i)` → `{ overhangDepth, section? }`. Precedence: `customProfile` (overhang = max section depth) > `override.nosing` > `params.nosing`, clamped ≥0.
  - `applyPerTreadNosing(treads, params)` — plan-footprint pass run inside `assembleStairGeometry` **before** the cut-plane split (so index `i` aligns with the global build order). Extends each overridden tread's **leading edge** by `overhangDepth − params.nosing`. The leading edge is found **winding-agnostically** — forward travel dir from neighbour-tread centroids (`polygonCentroid` reuse), then the two vertices with the largest projection — so it is correct for rectilinear AND curved (wedge) treads without a per-kind branch. Returns the **same array reference** when the stair has no overrides → geometry stays byte-identical (155 legacy tests green).
- **Cascade:** the extended footprint flows automatically to the 2D renderer, the 3D flat extrude (`StairToThreeConverter`) and the BOQ — all read `StairGeometry.treads`. No change to the ADR-040-critical 3D converter for the overhang.
- **Φ4b (3D swept nose):** `bim-3d/converters/stair-tread-nosing-3d.ts` consumes `resolveTreadNosing(...).section`. It mirrors the `beam-ishape-geometry` swept-profile precedent (`THREE.Shape` → `ExtrudeGeometry` → basis matrix) and **reuses the exported `treadForwardDir`** (the same winding-agnostic travel dir Φ4a uses) to recover each tread's local frame — no clone of the direction logic. `customProfile` convention: `x` = forward depth from the riser line (0..overhang), `y` = height (0 = top face, negative down). Wired into `StairToThreeConverter.buildTreadMeshes`; returns `null` (→ flat-slab fallback) for a lone/degenerate tread, a <2-point section, or zero overhang, so stairs without a profile are visually unchanged.

## Changelog
- **2026-07-11** — **3D swept nosing solid (ADR-358 Q19 Φ4b).** Added `bim-3d/converters/stair-tread-nosing-3d.ts` (`buildTreadNosingMesh`) + exported `treadForwardDir`/`Vec2` from `stair-tread-overrides.ts` for reuse; wired into `StairToThreeConverter.buildTreadMeshes`. A per-tread `customProfile` now sweeps a shaped nose (mirror of the beam swept-profile pattern); no profile → flat-slab fallback (zero visual regression). 58 converter suites / 431 tests green, jscpd:diff clean.
- **2026-07-11** — **Per-tread nosing SSoT (ADR-358 Q19 Φ4a).** Added `stair-tread-overrides.ts` (`resolveTreadNosing` + `applyPerTreadNosing`) and wired it into `assembleStairGeometry` (treads + labels + bbox). Per-tread `nosing`/`customProfile` now drive the plan footprint (leading-edge extension, winding-agnostic), cascading to 2D + 3D flat-extrude + BOQ. Fast-path same-reference return keeps geometry byte-identical with no overrides; 293 stair tests green (24 suites, 155 legacy unchanged), jscpd:diff clean.
- **2026-07-09** — Created (611; next free after 610). Extracted `stair-geometry-generators.ts` (flights + polar/walkline primitives + 4 assemblers + switchback helpers) and `stair-geometry-runs.ts` (`computeRadialStair` + `computeWalklineStair`); migrated all 12 kinds + the service to thin thunks/bindings (identical public API). 155 tests green; jscpd intra-dir 716→0 cloned lines, full-scan 3637 → 3590, `--diff` clean.
