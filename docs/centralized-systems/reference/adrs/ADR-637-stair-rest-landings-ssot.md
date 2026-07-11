# ADR-637 — Stair Rest Landings (πλατύσκαλα) — kind-independent SSoT

- **Status**: Accepted — Phase 1 implemented
- **Date**: 2026-07-11
- **Owners**: DXF/BIM stair subsystem
- **Related**: ADR-611 (stair geometry generators SSoT), ADR-633 (multi-flight turn points), ADR-619 (stair-from-region walkline / `preserveZ`), ADR-358 (stair tool), ADR-631/625 (command + drag-preview bases), ADR-040 (micro-leaf subscribers)

## Context

Stairs in the app span 13 kinds (`straight`, `l-shape`, `u-shape`, `gamma`,
`multi-flight`, `spiral`, `helical`, `elliptical`, `winder`, `triangular-fan`,
`triangular-outline`, `sketch`, `v-shape`). The user needs to add **intermediate
rest landings** (πλατύσκαλα) — one _or several_ — anywhere along a run of **any**
kind, then **drag** each landing along the run and **resize** its length, with the
treads re-flowing in real time.

The naïve approach — a per-kind landing feature — would produce 13 twin
mechanisms and violate SSoT (N.0.2). Investigation of the existing code showed the
building blocks already exist but were siloed to _turns_:

- `StairGeometry.landings: Polygon3D[]` is already a first-class output, but only
  emitted at direction changes (l-shape/u-shape/gamma/multi-flight).
- `buildCornerLanding(...)` (ADR-611) is the single landing-quad generator.
- `stair-turn-insert.ts` already splits a straight run at a parametric point and
  conserves the tread total — but forces a direction change.
- `adjustFlightSplit()` already implements "slide the split point → treads
  re-quantize" for L/U/Γ grips.
- The commit path `UpdateStairParamsCommand → computeStairGeometry` (ADR-631)
  already recomputes geometry with undo-merge.
- `stair-region-fill.ts` (ADR-619) already inserts flat-z landing stretches into a
  walkline for `sketch` kind via `StairVariantSketch.preserveZ`.

So the magic existed — fragmented. This ADR **unifies** it.

## Decision

A rest landing is **not** a per-kind feature. It is a kind-independent schedule
on `StairParams`, consumed by every kind through ONE planner.

### 1. Data model (kind-independent)

```ts
// stair-types.ts
interface StairRestLanding {
  readonly id: string;               // stable identity (multiple landings / grip target)
  readonly at: number;               // 0..1 along the developed run
  readonly length: 'auto' | number;  // plan length along travel; 'auto' → width
  readonly depth?: 'auto' | number;  // cross-width; 'auto'/absent → width
}

interface StairParams {
  // ...
  readonly restLandings?: readonly StairRestLanding[]; // optional, back-compat
}
```

Distinct from **turn landings** (which live in the variant and imply a direction
change). A rest landing keeps the travel direction — it is a "0° landing".

### 2. The level model (matches the existing turn-landing z-model)

A run of `stepCount` **levels** `0..stepCount−1`, level `i` at `z = base.z + i·rise`.
Each level is a TREAD or a LANDING. A landing consumes exactly one level (one
rise), replacing the tread there — identical to L-shape's `n1 + 1 + n2 = stepCount`.

Therefore: **total rise and riser count are invariant** when a landing is added;
only the plan footprint grows by the landing's length. Levels `0` and
`stepCount−1` are reserved as treads (a rest landing always has ≥1 tread on each
side), so valid landing levels are `1..stepCount−2`.

### 3. The SSoT planner

```ts
// stair-run-landings.ts
function planStairRunSegments(
  stepCount: number,
  restLandings: readonly StairRestLanding[] | undefined,
): StairRunSegment[]   // ordered flight / landing segments
```

`at` maps to a level `round(at·(stepCount−1))`, clamped to `[1, stepCount−2]`.
Collisions nudge outward to the nearest free level (no landing silently dropped
unless the band is exhausted). With no landings (or `stepCount < 3`) it returns a
single flight of `stepCount` treads → geometry stays **byte-identical** to the
pre-ADR-637 path.

### 4. Two family renderers, one schedule

| Family | Kinds | Landing rendering |
|---|---|---|
| **Rectilinear flights** | straight, L, Γ, Π/U, multi-flight, V, winder | `buildCornerLanding` quad (0° corner) — reuse ADR-611 |
| **Walkline** | spiral, helical, elliptical, sketch | flat-z stretch on the walkline — reuse ADR-619 `preserveZ` |

Each family builds its **flights** its own way and shares the landing scheduling.
No new tread/landing math is written — flights reuse `buildRectilinearFlight` /
`buildFlightFromEdge`, landings reuse `buildCornerLanding`. Zero jscpd clones.

### 5. Interaction (roadmap — Phases 4-5)

- **Grips**: `stair-landing-slide` (moves `at`) + length grips, in `pushLandingGrips`,
  a pure transform mirroring `adjustFlightSplit()`.
- **Live re-flow while dragging**: a stair ghost re-running `computeStairGeometry`
  off scratch params each frame (ADR-625 WYSIWYG harness); commit only on mouse-up
  via `UpdateStairParamsCommand` with `isDragging: true` (single undo entry).
- **Pick/highlight**: add `part: 'landing'` to `StairSubElementRef` (ADR-358 Q19)
  and tag the landing mesh — reuse the 2D/3D highlighter unchanged.

## Consequences

- **One source of truth** for landings across all 13 kinds; adding a kind costs
  nothing extra for landings.
- Turn landings and rest landings share `StairGeometry.landings[]`, the same
  labels/BOQ/3D-extrude paths, and (eventually) the same grip/highlight infra.
- Total-rise/riser-count invariance means a landing never desyncs a stair from its
  floor-to-floor height — the footprint absorbs the change.
- Back-compat: `restLandings` is optional; existing stairs are unaffected.

## Implementation status

- **Phase 1 — DONE** (this commit): data model (`StairRestLanding`,
  `StairParams.restLandings`), the SSoT planner `stair-run-landings.ts`
  (`planStairRunSegments`, `resolveRestLandingLength/Depth`, `hasRestLandings`),
  straight-run integration (`computeStraightWithLandings` via `assembleMultiFlight`),
  and tests (`stair-run-landings.test.ts` — 12; `StairGeometryService-straight-landings.test.ts` — 7).
- **Phase 2 — pending**: rectilinear family (L/Γ/Π/multi-flight/V) consumes
  `restLandings` per flight segment, unified with turn landings.
- **Phase 3 — pending**: walkline family (spiral/helical/elliptical/sketch) via
  `preserveZ`.
- **Phase 4 — pending**: draggable landing grips + live re-flow preview + commit.
- **Phase 5 — pending**: 2D/3D pick+highlight (`part:'landing'`) + advanced-panel
  add/remove/length UI.

## Changelog

- **2026-07-11** — Phase 1: kind-independent rest-landing SSoT + straight-run proof.
