/**
 * Bathroom layout → scene commit · ADR-638 (Στάδιο 2).
 *
 * Turns a chosen {@link BathroomLayoutSolution} (millimetres) into real, undoable
 * `mep-fixture` entities in the active level scene. Reuses the existing SSoT
 * builders verbatim (`buildDefaultMepFixtureParams` → `buildMepFixtureEntity` →
 * `appendEntitiesToScene`, ADR-406/397/511) — zero new entity/persistence math.
 *
 * Units bridge: the solver works in mm; a fixture's `position` is stored in SCENE
 * units while its `width`/`length` stay in mm. So we scale each placement centre
 * mm→scene (`mmToSceneUnits`) and pass the footprint dims straight through in mm.
 *
 * Facing (Στάδιο 3): the entity rotation is derived from the placement's `rotationDeg`
 * (= `atan2(inward)`, the wall's into-room normal) so every fixture sits with its BACK
 * on the wall and its FRONT into the room (Revit "room-bounding fixture facing"). The
 * `mep-fixture` symbol draws its front at local −Y (`symbol-vector-helpers` convention
 * `v=0 → front edge`), so aligning that front with `inward` needs a +90° offset — see
 * {@link MEP_FIXTURE_SYMBOL_FRONT_OFFSET_DEG}.
 *
 * The `vanity` (επιπλομπάνιο) has no `mep-fixture`/furniture kind yet (ADR-638 later
 * stage adds `FurnitureKind:'vanity'`); it is reported in `skipped`, not silently
 * dropped (N.7.2).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-638-bathroom-auto-layout-generator.md
 */

import { appendEntitiesToScene, type SceneAppendAccessor } from '../../bim/scene/append-entity-to-scene';
import {
  buildDefaultMepFixtureParams,
  buildMepFixtureEntity,
} from '../../hooks/drawing/mep-fixture-completion';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import { isPlumbingFixtureKind } from '../../bim/mep-fixtures/plumbing-fixture-spec';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { BathroomLayoutSolution } from './bathroom-layout-types';

/** Context needed to materialise a solution: which layer + the scene's units. */
export interface BathroomCommitContext {
  readonly layerId: string;
  readonly sceneUnits: SceneUnits;
}

/** A placement that could not become an entity, with a machine-readable reason. */
export interface SkippedFixture {
  readonly kind: string;
  readonly reason: string;
}

/** Pure build result: the entities to append + what was skipped and why. */
export interface BathroomFixtureBuildResult {
  readonly entities: MepFixtureEntity[];
  readonly skipped: SkippedFixture[];
}

/**
 * Degrees added to a placement's `rotationDeg` (= `atan2(inward)`) to make the fixture
 * FACE the room (back on the wall). Derivation:
 *   - `mep-fixture` rotation θ (CCW) maps the symbol's local +Y to world angle θ+90°,
 *     local −Y to θ−90° (`mep-fixture-geometry.ts` `transformFootprint`).
 *   - The symbol draws its FRONT at local −Y (`symbol-vector-helpers` convention
 *     `v=0 → front edge, v=1 → back edge`; e.g. the WC cistern sits at v≈1, the bowl at
 *     v≈0). This is a single global convention shared by every sanitary/appliance drawer.
 *   - We want local −Y (front) to point along `inward`: θ−90° = atan2(inward) = rotationDeg
 *     ⇒ θ = rotationDeg + 90°.
 * A fixed +90° (not per-kind), because the front-at-−Y convention is uniform across kinds.
 */
export const MEP_FIXTURE_SYMBOL_FRONT_OFFSET_DEG = 90;

/**
 * Rotation (deg CCW) for a placed fixture so its back hugs the wall and its front looks
 * into the room. Reuses the solver's `rotationDeg` (`atan2(inward)`) — the wall-facing
 * ground truth — plus the symbol front offset. No footprint-edge recomputation.
 */
function fixtureFacingRotationDeg(placementRotationDeg: number): number {
  return placementRotationDeg + MEP_FIXTURE_SYMBOL_FRONT_OFFSET_DEG;
}

/**
 * Build the `mep-fixture` entities for a solution (pure — no scene mutation).
 * Non-committable kinds (currently `vanity`) and hard validation failures land in
 * `skipped`.
 */
export function buildBathroomFixtureEntities(
  solution: BathroomLayoutSolution,
  ctx: BathroomCommitContext,
): BathroomFixtureBuildResult {
  const entities: MepFixtureEntity[] = [];
  const skipped: SkippedFixture[] = [];
  const toScene = mmToSceneUnits(ctx.sceneUnits);
  for (const p of solution.placements) {
    if (!isPlumbingFixtureKind(p.kind)) {
      skipped.push({ kind: p.kind, reason: 'no-entity-kind' });
      continue;
    }
    const params = buildDefaultMepFixtureParams(
      { x: p.center.x * toScene, y: p.center.y * toScene },
      { kind: p.kind, width: p.widthMm, length: p.depthMm, rotation: fixtureFacingRotationDeg(p.rotationDeg) },
      ctx.sceneUnits,
    );
    const res = buildMepFixtureEntity(params, ctx.layerId);
    if (res.ok) entities.push(res.entity);
    else skipped.push({ kind: p.kind, reason: res.hardErrors.join('; ') || 'build-failed' });
  }
  return { entities, skipped };
}

/** Outcome of committing a solution to the scene. */
export interface BathroomCommitSummary {
  readonly committed: number;
  readonly skipped: SkippedFixture[];
}

/**
 * Materialise a chosen solution into the active level scene as ONE undoable batch
 * (`appendEntitiesToScene`, Ctrl+Z removes the whole arrangement). No-op append
 * when nothing built. Returns how many landed + what was skipped.
 */
export function commitBathroomSolution(
  accessor: SceneAppendAccessor,
  solution: BathroomLayoutSolution,
  ctx: BathroomCommitContext,
): BathroomCommitSummary {
  const { entities, skipped } = buildBathroomFixtureEntities(solution, ctx);
  if (entities.length > 0) {
    appendEntitiesToScene(accessor, entities, 'bathroom-auto-layout', 'Auto-arrange bathroom');
  }
  return { committed: entities.length, skipped };
}
