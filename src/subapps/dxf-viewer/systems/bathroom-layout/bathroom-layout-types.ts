/**
 * Bathroom Auto-Layout — agnostic contract (SSoT types) · ADR-638.
 *
 * A rule-based generative space planner: given a bathroom room polygon + which
 * sanitary fixtures to place, it emits several ranked candidate layouts (each a
 * set of wall-hugging fixture placements that respect use-zone clearances and the
 * door swing). Pure & headless — zero React/store/Firestore coupling, everything
 * in **millimetres** (the caller converts scene-units → mm before solving and the
 * placements back to `mep-fixture` entities after choosing one).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-638-bathroom-auto-layout-generator.md
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * A fixture kind the layout solver can place. The five sanitary terminals + the
 * washing-machine appliance are real `mep-fixture` kinds (dims reused from
 * `SANITARY_SPEC`/`APPLIANCE_SPEC`); `vanity` (επιπλομπάνιο) has no catalog entry
 * yet — its dims are authored in the clearance spec until a `FurnitureKind:'vanity'`
 * lands (ADR-638 later stage).
 */
export type LayoutFixtureKind =
  | 'wc'
  | 'washbasin'
  | 'shower'
  | 'bathtub'
  | 'bidet'
  | 'washing-machine'
  | 'vanity';

/**
 * Resolved geometry + clearance requirement of one fixture kind (mm). `widthMm`
 * runs ALONG the wall, `depthMm` INTO the room; `frontClearanceMm` is the approach
 * ("use") zone in front. `wet` fixtures want to cluster (shorter plumbing).
 */
export interface FixtureFootprintSpec {
  readonly kind: LayoutFixtureKind;
  /** mm — footprint extent along the wall. */
  readonly widthMm: number;
  /** mm — footprint extent into the room (fixture back sits on the wall). */
  readonly depthMm: number;
  /** mm — clear approach depth in front of the fixture (ergonomic use-zone). */
  readonly frontClearanceMm: number;
  /** mm — comfort gap kept on each side of the fixture. */
  readonly sideClearanceMm: number;
  /** Needs water/drain — a grouping hint for the plumbing score. */
  readonly wet: boolean;
  /** Preferred placement: hug a wall face, or tuck into a corner. */
  readonly placement: 'wall' | 'corner';
  /** Lower = placed first (bigger / more constrained fixtures win space). */
  readonly priority: number;
}

/** Room + constraints handed to the solver. Polygon CCW, millimetres. */
export interface RoomInput {
  /** Outer boundary of the bathroom, CCW, millimetres. */
  readonly polygonMm: readonly Point2D[];
  /** Which fixtures to arrange (deduped by the solver). */
  readonly fixtures: readonly LayoutFixtureKind[];
  /**
   * Optional keep-clear polygon (door swing / entry zone), millimetres. Fixture
   * footprints must not intrude here; use-zones overlapping it are penalised.
   */
  readonly doorKeepClearMm?: readonly Point2D[];
  /**
   * Optional index (into the solver's wall segmentation) of a wall carrying an
   * existing plumbing stack/riser — wet fixtures placed on it score higher.
   */
  readonly wetWallHintIndex?: number;
}

/** One placed fixture in a candidate layout (millimetres, world/room frame). */
export interface FixturePlacement {
  readonly kind: LayoutFixtureKind;
  /** Footprint centroid — the `mep-fixture` insertion point (mm). */
  readonly center: Point2D;
  /** Degrees CCW; the footprint's local +Y (depth) points INTO the room. */
  readonly rotationDeg: number;
  readonly widthMm: number;
  readonly depthMm: number;
  /** 4 corners, CCW, mm. */
  readonly footprint: readonly Point2D[];
  /** Clearance rectangle in front of the fixture, CCW, mm. */
  readonly useZone: readonly Point2D[];
  /** Index of the room wall this fixture hugs. */
  readonly wallIndex: number;
}

/** Per-axis score components (each 0..1, higher is better). */
export interface LayoutScoreBreakdown {
  /** Use-zones fit inside the room & are unobstructed. */
  readonly ergonomics: number;
  /** Wet fixtures clustered (short pipe runs). */
  readonly plumbing: number;
  /** Door path clear & central floor open. */
  readonly circulation: number;
  /** Fixtures grouped on few walls / aligned. */
  readonly tidiness: number;
  /** Fraction of requested fixtures actually placed. */
  readonly completeness: number;
}

/** A ranked candidate arrangement. */
export interface BathroomLayoutSolution {
  /** Deterministic id (strategy + rounded placement signature). */
  readonly id: string;
  /** Human-readable strategy label (i18n key resolved by the UI layer). */
  readonly strategy: string;
  readonly placements: readonly FixturePlacement[];
  /** Overall 0..1 (weighted breakdown × completeness). */
  readonly score: number;
  readonly scoreBreakdown: LayoutScoreBreakdown;
  /** Kinds that could not be placed, + advisory notes. */
  readonly warnings: readonly string[];
}

/** Tunable solver knobs (all mm except counts). */
export interface SolveOptions {
  /** Max candidate solutions returned (default 3). */
  readonly maxSolutions?: number;
  /** Gap kept between adjacent fixtures on the same wall (default 50). */
  readonly gapMm?: number;
  /** Margin kept from each wall corner (default 50). */
  readonly wallMarginMm?: number;
}
