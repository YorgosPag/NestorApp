# ADR-637 — Stair Rest Landings (πλατύσκαλα) — kind-independent SSoT

- **Status**: Accepted — Phase 1 + Phase 2 (rectilinear family: straight/multi-flight/v-shape) + Phase 2b (turning family: L/U/Γ edge-origin flights) + Phase 3 (walkline-following family: elliptical/sketch; radial + walkline-grips deferred) + Phase 4-A (draggable/resizable landing grips) + Phase 4-B (add/remove/length/depth panel UI) implemented
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
| **Walkline-following** | elliptical, sketch | flat-z stretch on the sampled walkline — reuse ADR-619 flat-z + `buildWalklineTreads` |
| **Radial** (deferred) | spiral, helical, triangular-fan | treads come from an angular grid, not the walkline → own landing insertion needed; deferred (see Phase 3) |

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
- **Phase 2 — DONE** (this commit): rectilinear family SSoT + flagship kinds.
  - New `stair-flight-run-builder.ts` (`buildRectilinearRun`) — the SSoT that
    generalizes the straight-run inner loop for ONE centreline-origin flight
    carrying rest landings. Reuses `buildRectilinearFlight` (per sub-flight) +
    `buildCornerLanding` (per landing) via `planStairRunSegments`; empty schedule
    ⇒ a single sub-flight identical to a bare `buildRectilinearFlight`.
  - `partitionRestLandingsByFlight()` (in `stair-run-landings.ts`) maps a global
    `at` schedule to per-flight local `at`, routing by cumulative tread range and
    clamping boundary landings inward.
  - `computeStraightWithLandings` **refactored** to dogfood `buildRectilinearRun`
    (duplication removed; jscpd-clean).
  - **multi-flight** (flagship): rest landings re-route each flight through
    `buildRectilinearRun`; turn landings + the quarter-turn advance now come from
    the extracted SSoT `advanceMultiFlightTurn` (shared with `walkMultiFlight`, so
    the turn math can never diverge). Sub-flight `flightSplit`/`cutDirs` and
    interleaved rest+turn `landings[]` feed the existing label/cut-line paths.
  - **v-shape**: each arm (centreline-origin from the apex) is one
    `buildRectilinearRun` with its partitioned landings; the apex stays a
    junction (not a landing).
  - Tests: `stair-run-landings.test.ts` (+8 partition), plus new
    `StairGeometryService-multiflight-landings.test.ts` (8) and
    `StairGeometryService-vshape-landings.test.ts` (7). Full stair geometry suite
    green (360) + `stair-turn-point` (13).
- **Phase 2b — DONE** (resolves the Phase 2 deferral): **L-shape / U-shape / Γ
  (gamma)** now honour `restLandings`. The deferred `buildEdgeOriginRun` mirror of
  `buildFlightFromEdge` was written (`stair-flight-run-builder.ts`) as the
  edge-origin sibling of `buildRectilinearRun`; both now share ONE segment walk
  (`walkStairRun` core injected with per-origin builders — N.18, no sibling clone).
  Key insight: the level model is **z-invariant** — a rest landing consumes one
  level WITHIN its flight's span, so every turn landing stays at its old level
  (`n1`, `n1+n2+1`, …) and every downstream edge-origin flight keeps its old
  `zFirstTread`; only the plan footprint grows. Each kind therefore just anchors
  its turn landing(s) + edge-origin flight(s) at the preceding run's real plan end
  (`run.endXY`) instead of a hard-coded `tread·n1`. The three kind computers were
  **merged to a single path each** (no `computeXWithRestLandings` twin): flight 1
  via `centrelineRun`, flights 2+ via `edgeRun`, prologue via `beginTurnRun`,
  assembly + rest/turn-landing interleave + grip-handle surfacing via
  `assembleTurnRunStair`, and the walkline is the bespoke builder when there are no
  rest landings (byte-identical to pre-2b) or the run-stitched centreline
  (`appendRunAcrossNinetyTurn` / kind-specific stitch) otherwise. New shared SSoT:
  `walkStairRun`, `buildEdgeOriginRun`/`edgeRun`, `centrelineRun`, `beginTurnRun`,
  `assembleTurnRunStair`, `appendRunAcrossNinetyTurn` (all in
  `stair-flight-run-builder.ts`) + `offsetAlong` (`stair-geometry-shared.ts`).
  `stairKindSupportsRestLandings` now also returns `true` for `l-shape` / `u-shape`
  / `gamma`, so the panel + grips light up automatically (grips need no new wiring
  — they read `restLandingHandles`, which all three now emit). The L-shape
  **winder-corner** variant still ignores rest landings (its corner is fan treads,
  not a run boundary). Tests: `stair-edge-origin-run.test.ts` (3),
  `StairGeometryService-{lshape,ushape,gamma}-landings.test.ts` (8+7+7); full stair
  geometry suite green (34 suites / 391) incl. the exhaustive per-kind coordinate
  tests (proves byte-identical no-rest paths after the merge); jscpd-diff clean.
- **Phase 3 — DONE (walkline-following subset: elliptical + sketch)**: rest
  landings for the walkline-following family. New SSoT
  `stair-walkline-run-builder.ts` (`buildWalklineRunWithLandings`) — the walkline
  analogue of `buildRectilinearRun`. It folds `planStairRunSegments` into a
  **stretched walkline**: at each landing level the chord is stretched from its
  natural going to the landing's plan `length` along the SAME base tangent, and
  every downstream point is rigid-translated by the extra plan offset. **z values
  are untouched**, so total rise and riser count stay invariant (ADR §2) and only
  the plan footprint grows. The stretched chord's wedge (built by the shared
  `buildWalklineTreads`, flat at `z_level`) IS the landing quad — it is
  **reclassified** out of the tread list into `landings[]` (reuse, not new math —
  N.18, no clone of the wedge loop). `computeWalklineStair` branches on
  `hasRestLandings`: the no-rest path is byte-identical (still
  `assembleSingleFlightWalkline`), the rest path re-flows treads/risers/stringers/
  cut-line over the new walkline and assembles via `assembleStairGeometry` with the
  real `flightSplit` + `landings` (so `buildTreadLabelsWithLandings` numbers
  correctly — `landings.length === flightSplit.length − 1`).
  `stairKindSupportsRestLandings` += `sketch` / `elliptical`, so the panel lights
  up. Tests: `stair-walkline-run-builder.test.ts` (5) +
  `StairGeometryService-{sketch,elliptical}-landings.test.ts` (3+3); full stair
  geometry + stairs suites green (59 suites / 747, incl. the unchanged
  sketch/elliptical coordinate tests — proves byte-identical no-rest path);
  jscpd-diff clean.
  - **Deferred — radial family** (spiral / helical / triangular-fan): their treads
    come from an **angular grid** (`buildRadialTreads`), not the walkline, so the
    flat-z walkline trick does not apply — a radial landing would be a flat annular
    sector needing its own grid insertion. Mid-run landings on a parametric radial
    run are also unusual (Revit/ArchiCAD model curved-run mid-landings as **separate
    landing components**, not a consumed step). Deferred to avoid a half-broken
    z-model, mirroring the Phase 2 L/U/Γ deferral. Not added to
    `stairKindSupportsRestLandings` (panel shows the hint).
  - **Deferred — walkline-family grips**: `restLandingHandles` are intentionally
    NOT surfaced for elliptical/sketch. The `slideRestLanding` transform projects
    the cursor axially on `params.direction` / `params.totalRun`, but curved kinds
    run with `totalRun = 0` and no meaningful axial direction, so a slide grip would
    snap the landing to the top. Curved-run landing grips need an
    arclength-projection model (a future phase). The panel add/remove/length/depth
    path is fully functional today (writes `restLandings` → recompute).
  - **Elliptical note**: on a parametric curve the tangent-stretch translates the
    post-landing arc rigidly (the ellipse "opens" past the landing) — geometrically
    valid + z-correct, natural for a free sketch. Visually confirmed in a plan-view
    artifact.
- **Phase 4-A — DONE**: draggable + resizable rest-landing grips (recompute on
  release, matching every other stair grip). Chain:
  - **Handle SSoT (geometry)**: `buildRectilinearRun` now emits
    `landingHandles: RestLandingHandle[]` (id + world centroid + travel `along` +
    resolved length/depth) from the SAME cursor walk as the landing quad, so a
    grip can never disagree with what's drawn. Threaded up as the optional
    `StairGeometry.restLandingHandles` (defined in `stair-types.ts`) by all three
    centreline-origin consumers (`computeStraightWithLandings`,
    `computeMultiFlightWithLandings`, `computeVShapeWithLandings`). Absent when a
    stair carries no rest landings (back-compat, byte-identical geometry).
  - **Grip emission**: `pushRestLandingGrips` (in `stair-grips.ts`, called from
    `getStairGrips` on both the straight + non-straight paths) emits PER handle a
    slide grip at the centroid (`stair-rest-landing-slide`) + two length grips at
    `center ± along·(length/2)` (`…-length-lo` / `…-length-hi`). Each grip carries
    the target `GripInfo.landingId` (a minimal new id channel on `GripInfo` /
    `UnifiedGripInfo`, forwarded through `wrapDxfGrip`) so a run with several
    landings edits the right one.
  - **Pure transforms** (`stair-grip-transforms.ts`): `slideRestLanding` projects
    the cursor axially onto the run (mirror of `adjustFlightSplit`) → a 0..1
    fraction written to `restLandings[i].at`, clamped to `(0,1)` by ε; the
    geometry re-quantizes to the nearest legal level on recompute. Length grips
    (both edges share one transform) project onto `along` from the handle centre →
    `length = 2·|projection|`, clamped to `[tread, developed run]`. The targeted
    landing is patched immutably by id; every other grip kind falls through
    unchanged.
  - **Commit**: NO change to the dispatch — `PARAMETRIC_COMMIT_HANDLERS` routes by
    entity type (`stair` → `commitStairGripDrag`), so the 3 new kinds "just work";
    `commitStairGripDrag` now forwards `grip.landingId` into the drag input.
    `UpdateStairParamsCommand` recomputes geometry on mouse-up (`isDragging:false`,
    the existing stair UX). **Live-during-drag re-flow is deferred** (a future WYSIWYG
    ghost re-running `computeStairGeometry` each frame per ADR-625) — out of scope here.
  - **KNOWN LIMITATION**: grips appear only for kinds that surface handles
    (straight / multi-flight / v-shape); L/U/Γ still no-op on rest landings (Phase 2
    edge-origin limitation).
  - Tests: `StairGeometryService-restlanding-handles.test.ts` (4) +
    `stair-rest-landing-grips.test.ts` (12); stair grip + geometry suites green
    (52 suites / 710); grip discriminator coverage green; jscpd-clean.
- **Phase 4-B — DONE**: add/remove/length/depth panel UI, `StairRestLandingsSection`
  (`ui/stair-advanced-panel/sections/StairRestLandingsSection.tsx`), composed into
  `StairAdvancedPanel` between per-riser overrides and cut-plane height. Mirrors
  the per-tread/per-riser override sections' look (reuses `StairOverrideRowShell`
  for the index cell + remove button; N.18 — no cloned row chrome).
  - **Gating (SSoT)**: `stairKindSupportsRestLandings` (new export,
    `bim/geometry/stairs/stair-run-landings.ts`) is the single source of truth for
    "does this kind's geometry generator consume `restLandings`" — currently
    `straight` / `multi-flight` / `v-shape` (matches Phase 4-A's grip-handle
    coverage and the Phase 2 known limitation). Other kinds (L/U/Γ, walkline
    family, etc.) show a hint instead of a no-op editor.
  - **Add**: appends `{ id: stln_N, at: 0.5, length: 'auto' }` — `stln_N` is a
    deterministic LOCAL sub-object id (max existing numeric suffix + 1; NOT a
    Firestore document id, so `enterprise-id.service` does not apply — N.6 scope
    is `setDoc()` documents). New pure helper module
    `sections/stair-rest-landing-helpers.ts` (`nextRestLandingId` /
    `appendRestLanding` / `removeRestLandingById` / `patchRestLandingById`),
    unit-tested independent of React.
  - **Length / depth editors**: per-row "auto" checkbox + numeric input (mm),
    same visual pattern as `StairCutPlaneSection`'s inherit toggle. Unchecking
    "auto" prefills the stair's own `width` (square landing default, matching
    `resolveRestLandingLength`/`resolveRestLandingDepth`). Writes go through the
    existing `dispatchStairParamPatch` → `UpdateStairParamsCommand` (undo +
    recompute), same as every other panel section.
  - **Known scope limits carried forward**: no click-into sub-element selection
    for landings yet (`part:'landing'` — Phase 5), and no live re-flow preview
    during a grip drag (still recompute-on-release, Phase 4-A's deferred item).
  - Tests: `stair-rest-landing-helpers.test.ts` (8) +
    `StairRestLandingsSection.test.tsx` (6); i18n audit clean (0 new violations);
    jscpd-diff clean.
- **Phase 5 — pending**: 2D/3D pick+highlight (`part:'landing'`) for the panel row +
  live re-flow preview during grip drag.

## Changelog

- **2026-07-11** — Phase 3: walkline-following rest landings (elliptical + sketch).
  New SSoT `stair-walkline-run-builder.ts` (`buildWalklineRunWithLandings`) —
  stretches each landing chord along its base tangent + rigid-translates the
  remainder (z invariant, footprint grows), reclassifies the stretched wedge from
  `buildWalklineTreads` into `landings[]` (N.18 — no clone). `computeWalklineStair`
  branches on `hasRestLandings` (no-rest byte-identical). `stairKindSupportsRest
  Landings` += sketch/elliptical. Radial family (spiral/helical/triangular-fan) +
  walkline grips deferred (angular-grid treads / `totalRun=0` axial slide). +11
  tests; stair suites 59/747 green; jscpd-clean.
- **2026-07-11** — Phase 2b: L / U / Γ rest landings (resolves the Phase 2
  deferral). `buildEdgeOriginRun` (edge-origin sibling of `buildRectilinearRun`,
  sharing the `walkStairRun` core) + `centrelineRun`/`edgeRun`/`beginTurnRun`
  helpers + `assembleTurnRunStair` (interleaves rest/turn landings + surfaces grip
  handles) + `appendRunAcrossNinetyTurn` (shared 90°-turn walkline stitch) +
  `offsetAlong` (Vec2 plan offset). Each kind computer merged to one path (bare +
  rest-landing), anchoring turn landings at the preceding run's `endXY`; z-model
  invariant, footprint grows. `stairKindSupportsRestLandings` += l-shape/u-shape/
  gamma. +25 tests; stair suite 391 green; jscpd-clean.
- **2026-07-11** — Phase 1: kind-independent rest-landing SSoT + straight-run proof.
- **2026-07-11** — Phase 2: rectilinear family. `buildRectilinearRun` SSoT
  (`stair-flight-run-builder.ts`) + `partitionRestLandingsByFlight`; straight
  refactored to dogfood it; multi-flight (via `advanceMultiFlightTurn` extracted
  from `walkMultiFlight`) and v-shape wired. L/U/Γ deferred (edge-origin flights —
  known limitation, no-op until `buildEdgeOriginRun`). +23 tests; suite 360 green;
  jscpd-clean.
- **2026-07-11** — Phase 4-A: draggable + resizable rest-landing grips.
  `RestLandingHandle` SSoT emitted by `buildRectilinearRun` → optional
  `StairGeometry.restLandingHandles` (populated by straight / multi-flight /
  v-shape); `pushRestLandingGrips` emits slide + 2 length grips per landing;
  `slideRestLanding` / `resizeRestLandingLength` pure transforms (edit `at` /
  `length` by id, clamped); minimal `landingId` channel on `GripInfo` /
  `UnifiedGripInfo` (forwarded in `wrapDxfGrip` + `commitStairGripDrag`); dispatch
  unchanged (routes by entity type). Recompute-on-release; live-during-drag
  deferred to Phase 4-B. +16 tests; stair suites 52/710 green; jscpd-clean.
- **2026-07-11** — Phase 4-B: add/remove/length/depth panel UI.
  `StairRestLandingsSection` composed into `StairAdvancedPanel`; gated on new
  `stairKindSupportsRestLandings` SSoT export (straight/multi-flight/v-shape);
  add seeds a deterministic local `stln_N` id (pure helpers in
  `stair-rest-landing-helpers.ts`, not an enterprise-id — sub-object, not a
  Firestore doc); length/depth editors reuse the cut-plane "auto" toggle
  pattern; writes through the existing `dispatchStairParamPatch`. i18n keys
  added under `stairAdvancedPanel.sections.restLandings` (el+en). +14 tests;
  i18n-audit clean; jscpd-diff clean.
