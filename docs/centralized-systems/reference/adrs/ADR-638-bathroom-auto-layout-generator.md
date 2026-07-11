# ADR-638 — Bathroom Auto-Layout Generator (generative space planning)

**Status:** Accepted (Στάδιο 0 + 1 + 2 implemented — headless solver + live ribbon command)
**Date:** 2026-07-11
**Domain:** dxf-viewer / systems (space planning)
**Related:** ADR-425 (Stage-0 semantic recognition — `RecognizedSpace`/bathroom classification, the room INPUT), ADR-406/408 (`mep-fixture` sanitary terminals — the placement OUTPUT), ADR-567 (structural-placement-overlap — the collision pattern reused), ADR-426/427 (water-supply / drainage auto-design — consume the placed fixtures downstream), ADR-419 (perimeter engine — room polygon)

## Context

A bathroom always needs the same kit — WC, washbasin, shower or bathtub, bidet,
a vanity, a washing-machine — arranged against the walls with enough clear space
in front of each and without blocking the door. Doing this by hand for every
bathroom in a plan is slow and repetitive. Every ingredient to automate it already
existed in the codebase, but nothing tied them together:

- **Room geometry** — `detectSpaces()` / `getCachedRegionPerimeters()` (ADR-425/419)
  already produce a classified `RecognizedSpace` (`classification:'bathroom'`) with
  a CCW polygon, area and centroid.
- **Fixtures** — all seven kinds exist as real, connectable entities with authored
  footprints: `SANITARY_SPEC` (wc/washbasin/shower/bathtub/bidet) + `APPLIANCE_SPEC`
  (washing-machine). Placing them programmatically is `buildMepFixtureEntity` →
  `appendEntitiesToScene` (one undoable command).
- **Geometry primitives** — `insetPolygonMiter` (clearance shrink), `pointInPolygon`,
  `polygonIntersectionAreaMm2` (S-H clip), `polygonArea/Bbox`, and the ADR-567
  overlap-ratio pattern — all reusable, no new math needed.
- **Openings** — `OpeningEntity` (`wallId` + `offsetFromStart` + `hingeArc`) locates
  doors so their swing can be kept clear.

What was missing: the **solver** — the rule-based engine that reads a room, applies
clearance rules, and generates several ranked candidate arrangements. That is this ADR.

## Decision — staged

### Στάδιο 0 — Contract + clearance SSoT (DONE)

- `systems/bathroom-layout/bathroom-layout-types.ts` — the agnostic contract
  (`LayoutFixtureKind`, `RoomInput`, `FixturePlacement`, `BathroomLayoutSolution`,
  `LayoutScoreBreakdown`, `SolveOptions`). Everything in **millimetres**.
- `systems/bathroom-layout/sanitary-clearance-spec.ts` — the **only** new authored
  data: the ergonomic use-zone (front approach + side gap), wet/placement/priority
  hints per kind, and the vanity footprint (no catalog entry yet). Footprint dims are
  **reused** from `SANITARY_SPEC`/`APPLIANCE_SPEC` — zero dimensional drift (N.0.2/N.18).

### Στάδιο 1 — Headless rule-based solver + ranking (DONE)

- `room-walls.ts` — `segmentRoomWalls(polygon)` → oriented `RoomWall[]` (unit
  along-direction + inward normal, CCW-normalised via `isPolygonCCW`);
  `buildFixtureRects(wall, s, w, d, front)` → wall-hugging footprint + front use-zone
  (CCW rectangles) + insertion pose (`center`, `rotationDeg`).
- `layout-geometry.ts` — thin 2D adapters over the polygon SSoT (`lift`, `areaOf`,
  `allCornersInside`, `cornerInsideFraction`, `rectOverlapMm2`, `roomDiagonalMm`) so
  solver + scorer share ONE lift-to-3D idiom.
- `bathroom-layout-solver.ts` — `solveBathroomLayout(input, options)`:
  1. Segment walls; resolve + priority-sort fixture specs (bulky first).
  2. Derive the door wall from the keep-clear centroid.
  3. Enumerate a small set of deterministic **strategies** (distinct wall visiting
     orders + door-wall include/exclude): `wetGroup`, `longestWall`, `compact`,
     `perimeter`, `alt`.
  4. Per strategy, greedily pack each fixture wall-hugging via a **scan** that steps
     past obstacles, validating every placement: inside room (`allCornersInside`),
     no footprint↔footprint / footprint↔use-zone collision, no intrusion into the
     door keep-clear.
  5. Score, dedupe (50 mm grid signature), sort best-first, slice to `maxSolutions`.
- `bathroom-layout-scoring.ts` — four 0..1 axes gated by completeness:
  **ergonomics** (use-zones inside & unobstructed), **plumbing** (wet fixtures
  clustered + on the wet-wall hint), **circulation** (door path clear + central floor
  open), **tidiness** (fewer walls / aligned runs). `score = completeness × Σ w·axis`.
- `index.ts` — public barrel.

### Στάδιο 2 — Live ribbon command + scene commit (DONE)

- `bathroom-fixture-commit.ts` — pure `buildBathroomFixtureEntities(solution, ctx)`:
  each placement → `buildDefaultMepFixtureParams` → `buildMepFixtureEntity` (dims mm,
  centre mm→scene, rotation from the footprint's wall edge). `commitBathroomSolution`
  wraps it in `appendEntitiesToScene` (one undoable batch). The `vanity` has no entity
  kind yet → reported in `skipped` (N.7.2), not dropped.
- `recognized-space-adapter.ts` — pure `recognizedSpaceToRoomInput(polygon, units, …)`:
  scene→mm polygon (reuses `polygon2DCentroid`) + primary-door keep-clear from
  `DoorMarker`s.
- `run-bathroom-auto-arrange-flow.ts` — the `'bathroom.actions.autoArrange'` glue:
  resolve units → `detectSpaces` → pick target bathroom (smallest space containing the
  selection, else smallest room) → extract door markers from `OpeningEntity`s → solve →
  commit best → notify. Mirrors `run-auto-dimension-flow.ts`.
- Wiring: one `actionBtn` in the Ύδρευση tab's `water-fixtures` panel
  (`systems-discipline-tabs.ts`); one `if` in `app/dxf-special-actions.ts`; i18n
  label (`ribbon.commands.bim.bathroomAutoArrange`, dxf-viewer-shell el/en) + notification
  keys (`callbacks.bathroomAutoArrange`, dxf-viewer el/en). No new bridge/hook (ADR-609
  factory deliberately NOT cloned — too heavy for a one-click action).

### Στάδιο 3+ — pending (not in this commit)

- **Στάδιο 3** — solutions-preview UI: cycle A/B/C candidates as WYSIWYG placement
  ghosts (ADR-624), Accept/Next.
- **Στάδιο 4** (optional) — after commit, run `designWaterSupply`/`designDrainage`
  (ADR-426/427) to auto-route pipes to the freshly-placed fixtures.
- **Vanity** — add a `FurnitureKind:'vanity'` + catalog entry so the épiplo is a real
  furniture entity rather than a solver-only footprint.

## Consequences

- A bathroom can be furnished from a room polygon + a fixture list with zero manual
  placement, offering the user several ranked alternatives to choose from.
- The solver is **pure, deterministic and unit-tested** (13 tests) — same input ⇒
  same solutions; easy to extend (new fixture kind = one clearance-spec row).
- Built entirely on existing SSoT (dims, geometry, overlap) — no duplicated math.

### ⚠️ Known limitations (not yet Google-level)

- Containment uses a corner-inside proxy (`pointInPolygon` on rect corners), exact for
  convex/rectangular rooms; a use-zone can slightly clip a concave (L/Γ) notch without
  being rejected. Rectangular bathrooms (the overwhelming common case) are exact.
- Fixtures are axis-aligned to walls only (no free-angle placement); no 3D stacking
  (wall-hung shelf over WC), no per-fixture mirroring heuristics yet.
- Door swing is modelled as a keep-clear polygon supplied by the caller; the solver
  does not yet read `OpeningEntity.hingeArc` itself (that is Στάδιο 2 wiring).

## Files

- `src/subapps/dxf-viewer/systems/bathroom-layout/bathroom-layout-types.ts`
- `src/subapps/dxf-viewer/systems/bathroom-layout/sanitary-clearance-spec.ts`
- `src/subapps/dxf-viewer/systems/bathroom-layout/room-walls.ts`
- `src/subapps/dxf-viewer/systems/bathroom-layout/layout-geometry.ts`
- `src/subapps/dxf-viewer/systems/bathroom-layout/bathroom-layout-scoring.ts`
- `src/subapps/dxf-viewer/systems/bathroom-layout/bathroom-layout-solver.ts`
- `src/subapps/dxf-viewer/systems/bathroom-layout/index.ts`
- **Στάδιο 2:** `bathroom-fixture-commit.ts`, `recognized-space-adapter.ts`,
  `run-bathroom-auto-arrange-flow.ts` (all under `systems/bathroom-layout/`)
- **Στάδιο 2 edits:** `ui/ribbon/data/systems-discipline-tabs.ts`,
  `app/dxf-special-actions.ts`, `src/i18n/locales/{el,en}/dxf-viewer-shell.json`,
  `src/i18n/locales/{el,en}/dxf-viewer.json`

## Tests

- `__tests__/bathroom-layout-solver.test.ts` — 13 tests: dims-reuse, wall segmentation
  (CW→CCW normalise), rect building, full-fixture placement (inside-room + no collision),
  door keep-clear respected, ranking order, determinism, 7-fixture set, degenerate room,
  unplaced-warning.
- `__tests__/bathroom-layout-commit.test.ts` — 8 tests (Στάδιο 2): solution→mep-fixture
  entities, vanity skip, mm→scene unit bridge, commit no-op without a level, scene→mm
  polygon, door keep-clear derivation. Total 21/21 green.

## Changelog

- **2026-07-11 (Opus 4.8)** — Στάδιο 0 + Στάδιο 1: contract + clearance SSoT + headless
  rule-based solver + four-axis ranking. 13/13 jest green. jscpd clean (no new clones).
  Number bumped 637→638 (ADR-637 claimed by stair-rest-landings mid-session).
- **2026-07-11 (Opus 4.8)** — Στάδιο 2: live «Αυτόματη Διαρρύθμιση Μπάνιου» ribbon command
  (Ύδρευση tab) + pure commit-builder (solution → undoable `mep-fixture` batch) + recognition
  adapter (scene→mm + door keep-clear from openings). 4 edits + 3 new files, no new
  bridge/hook. 21/21 jest green, jscpd clean, 4 locale JSONs valid.
