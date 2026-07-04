/**
 * ADR-362 Phase D11 / J3 — associativity capture for the dimension creation flow.
 *
 * Split out of `dimension-create-entity-builder.ts` for the 500-LOC SRP cap.
 * Pure, click-time mappers (no observers): given the collected `clicks` and the
 * already-built `DimensionEntity`, materialise the `DimensionAssociation`s that
 * bind each def point to the geometry it was picked on, so recompute can keep the
 * dimension following its hosts on move/resize.
 *
 * The single public entry point `collectAssociations` is invoked by
 * `buildCommittedDimensionEntity` at commit time.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionAssociation, DimensionEntity } from '../../types/dimension';
import type { ClickRecord, DimensionCreateState } from './dimension-create-state';
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { getLineParameter, getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
import { calculateAngle, calculateDistance } from '../../rendering/entities/shared/geometry-vector-utils';

// ──────────────────────────────────────────────────────────────────────────────
// D11 — associativity capture (click-time, no observers)
// ──────────────────────────────────────────────────────────────────────────────

export function collectAssociations(
  state: DimensionCreateState,
  entity: DimensionEntity,
): readonly DimensionAssociation[] {
  // ADR-362 Phase N — pick-entity linear/aligned dims anchor BOTH span endpoints
  // (defPoints[0,1]) to the single picked line/wall so the dim follows it on
  // move/resize. defPoints[2] (placement) stays free. Radius/diameter fall
  // through to their own `dimensionType` cases below (unchanged capture).
  if (
    state.mode === 'entity' &&
    (entity.dimensionType === 'linear' || entity.dimensionType === 'aligned')
  ) {
    return collectEntityPickSpanAssociations(state);
  }

  const out: DimensionAssociation[] = [];
  switch (entity.dimensionType) {
    case 'linear':
    case 'aligned':
    case 'angular3P':
      state.clicks.forEach((click, i) => {
        const a = makeAssociation(i, click);
        if (a) out.push(a);
      });
      return out;
    case 'angular2L':
      // defPoints[0,1] ← clicks[0].pickedEntity, defPoints[2,3] ← clicks[1].pickedEntity.
      pushLineAssociation(out, state.clicks[0]?.pickedEntity, 0);
      pushLineAssociation(out, state.clicks[0]?.pickedEntity, 1);
      pushLineAssociation(out, state.clicks[1]?.pickedEntity, 2);
      pushLineAssociation(out, state.clicks[1]?.pickedEntity, 3);
      // arcPoint pick (rare but possible).
      if (state.clicks[2]?.pickedEntity) {
        const a = makeAssociation(4, state.clicks[2]);
        if (a) out.push(a);
      }
      return out;
    case 'radius':
    case 'joggedRadius': {
      // defPoints[0] = center (anchored to the picked arc/circle).
      const picked = state.clicks[0]?.pickedEntity;
      if (picked) out.push(makeCenterAssociation(0, picked));
      return out;
    }
    case 'diameter': {
      // defPoints[0,1] both ride on the picked circle (antipodal on perimeter).
      // ADR-362 Phase J3 — anchor each via its angular `param` so they follow
      // the circle on move/resize: side1 = direction of click 1, side2 = +π.
      const click = state.clicks[0];
      const picked = click?.pickedEntity;
      if (picked && picked.type === 'circle') {
        const baseAngle = calculateAngle(picked.center, click.world);
        out.push(makeCircleAngleAssociation(0, picked.id, baseAngle, 0));
        out.push(makeCircleAngleAssociation(1, picked.id, baseAngle + Math.PI, 1));
      }
      return out;
    }
    case 'arcLength': {
      // defPoints[0]=center, defPoints[1]=arcStart, defPoints[2]=arcEnd — all anchored to the arc.
      const picked = state.clicks[0]?.pickedEntity;
      if (picked && picked.type === 'arc') {
        out.push(makeCenterAssociation(0, picked));
        out.push({
          defPointIndex: 1,
          geometryId: picked.id,
          associationType: 'endpoint',
          subIndex: 0,
        });
        out.push({
          defPointIndex: 2,
          geometryId: picked.id,
          associationType: 'endpoint',
          subIndex: 1,
        });
      }
      return out;
    }
    case 'ordinate': {
      // defPoints[0] = measured feature; bind to the host entity if click 1 hovered one.
      const a = makeAssociation(0, state.clicks[0]);
      if (a) out.push(a);
      return out;
    }
    case 'baseline':
    case 'continued': {
      // defPoints[0] = new extOrigin2; bind to hovered host if click 1 picked one.
      // Inherited points (extOrigin1 / dimLineRef) trace back through `parentDimensionId`
      // — chained-builder.ts:resolveChain walks the chain at render time, so no
      // associations are duplicated here.
      const a = makeAssociation(0, state.clicks[0]);
      if (a) out.push(a);
      return out;
    }
    default:
      return out;
  }
}

function makeCenterAssociation(
  defPointIndex: number,
  entity: DetectableEntity,
): DimensionAssociation {
  return {
    defPointIndex,
    geometryId: entity.id,
    associationType: 'center',
  };
}

/**
 * ADR-362 Phase J3 — `nearest` anchor on a circle/arc addressed by `angle`.
 * Used by diameter (two antipodal perimeter points) so they orbit the circle.
 */
function makeCircleAngleAssociation(
  defPointIndex: number,
  geometryId: string,
  angle: number,
  subIndex: number,
): DimensionAssociation {
  return {
    defPointIndex,
    geometryId,
    associationType: 'nearest',
    param: angle,
    subIndex,
  };
}

/**
 * ADR-362 Phase N — pick-entity span capture. defPoints[0,1] both ride on the
 * single picked line/wall as its two span endpoints (subIndex 0 = start / first,
 * 1 = end / last). The resolver's `endpoint` case handles both line and wall
 * (BIM key-points) so the dim follows the host on move/resize.
 */
function collectEntityPickSpanAssociations(
  state: DimensionCreateState,
): readonly DimensionAssociation[] {
  const picked = state.clicks[0]?.pickedEntity;
  if (!picked || (picked.type !== 'line' && picked.type !== 'wall')) return [];
  return [
    { defPointIndex: 0, geometryId: picked.id, associationType: 'endpoint', subIndex: 0 },
    { defPointIndex: 1, geometryId: picked.id, associationType: 'endpoint', subIndex: 1 },
  ];
}

function pushLineAssociation(
  out: DimensionAssociation[],
  entity: DetectableEntity | undefined,
  defPointIndex: number,
): void {
  if (!entity || entity.type !== 'line') return;
  out.push({
    defPointIndex,
    geometryId: entity.id,
    associationType: 'endpoint',
    subIndex: defPointIndex % 2,
  });
}

/**
 * Generic geometry-pick association (linear / aligned / angular3P / ordinate /
 * chained extOrigin). ADR-362 Phase J3 (gap #2) closes the prior placeholder:
 *
 *   - INTERSECTION snap → `intersection` anchor on both hosts (`geometryId` ×
 *     `geometryId2`); recompute re-solves the crossing.
 *   - otherwise → `nearest` anchor with a parametric `param` (line/polyline t,
 *     circle/arc angle) computed by projecting the clicked point onto the host,
 *     so the def point follows the geometry instead of staying frozen.
 *
 * Unknown host shapes fall back to a bare `nearest` (geometry ref kept for
 * orphan tracking, recompute preserves position — matches the 2026-05-19 hotfix).
 */
function makeAssociation(
  defPointIndex: number,
  click: ClickRecord | undefined,
): DimensionAssociation | null {
  const entity = click?.pickedEntity;
  if (!click || !entity) return null;

  if (click.snapMode === ExtendedSnapType.INTERSECTION && click.pickedEntity2) {
    return {
      defPointIndex,
      geometryId: entity.id,
      geometryId2: click.pickedEntity2.id,
      associationType: 'intersection',
    };
  }

  const anchor = computeNearestParam(entity, click.world);
  if (!anchor) {
    return { defPointIndex, geometryId: entity.id, associationType: 'nearest' };
  }
  return {
    defPointIndex,
    geometryId: entity.id,
    associationType: 'nearest',
    param: anchor.param,
    ...(anchor.subIndex !== undefined ? { subIndex: anchor.subIndex } : {}),
  };
}

/**
 * Project `world` onto `entity` and return the parametric anchor:
 *   - line            → { param: t }
 *   - polyline/lwpoly → { param: t, subIndex: nearest segment index }
 *   - circle/arc      → { param: angle }
 * Returns null for shapes without a parametric nearest (caller preserves).
 * Reuses the geometry SSoT (`getLineParameter` / `getNearestPointOnLine` /
 * `calculateAngle`) — no new projection math.
 */
function computeNearestParam(
  entity: DetectableEntity,
  world: Point2D,
): { param: number; subIndex?: number } | null {
  switch (entity.type) {
    case 'line':
      return { param: getLineParameter(world, entity.start, entity.end) };
    case 'circle':
    case 'arc':
      return { param: calculateAngle(entity.center, world) };
    case 'polyline':
    case 'lwpolyline': {
      const verts = entity.vertices;
      if (!verts || verts.length < 2) return null;
      let bestSeg = 0;
      let bestDist = Infinity;
      const last = entity.closed ? verts.length : verts.length - 1;
      for (let i = 0; i < last; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        const foot = getNearestPointOnLine(world, a, b, true);
        const d = calculateDistance(world, foot);
        if (d < bestDist) {
          bestDist = d;
          bestSeg = i;
        }
      }
      const a = verts[bestSeg];
      const b = verts[(bestSeg + 1) % verts.length];
      return { param: getLineParameter(world, a, b), subIndex: bestSeg };
    }
    default:
      return null;
  }
}
