/**
 * Bathroom Auto-Layout system — public barrel · ADR-638.
 *
 * A rule-based generative space planner for bathrooms: room polygon + fixture list
 * → several ranked, wall-hugging layouts respecting use-zone clearances + the door
 * swing. Headless & pure (millimetres); the UI / commit layer (later stages) turns a
 * chosen {@link BathroomLayoutSolution} into `mep-fixture` entities.
 */

export type {
  LayoutFixtureKind,
  FixtureFootprintSpec,
  RoomInput,
  FixturePlacement,
  LayoutScoreBreakdown,
  BathroomLayoutSolution,
  SolveOptions,
} from './bathroom-layout-types';
export { resolveFixtureSpec, resolveFixtureSpecs } from './sanitary-clearance-spec';
export { segmentRoomWalls, buildFixtureRects, type RoomWall, type PlacedRects } from './room-walls';
export { solveBathroomLayout } from './bathroom-layout-solver';
