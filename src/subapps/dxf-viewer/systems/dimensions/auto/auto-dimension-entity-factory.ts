/**
 * ADR-563 (Auto-Dimension) — Entity factory (pure).
 *
 * Turns `PlannedSegment[]` into real `LinearDimensionEntity[]` using the exact
 * same shape the interactive dimension tool produces, so every downstream
 * consumer (renderer, grips, DXF export, associativity observer) works with
 * zero special-casing.
 *
 * - `id` via the enterprise-id SSoT (`generateDimensionId`, N.6) — never a
 *   bespoke uuid.
 * - `associations` recorded per anchored def point as `bimExtent` (ADR-563 Φ2):
 *   the association graph tracks host→dim (orphan cleanup on delete) AND the dims
 *   FOLLOW the host on move — `recomputeAssociatedDefPoint` reads the host bbox
 *   and updates the measured axis while preserving the perpendicular baseline.
 * - Optional belt-and-suspenders sanity via `buildDimensionGeometry` — a
 *   degenerate segment that the geometry builder rejects is dropped.
 */

import { generateDimensionId } from '@/services/enterprise-id-convenience';
import type {
  DimensionAssociation,
  DimStyle,
  LinearDimensionEntity,
} from '../../../types/dimension';
import { buildDimensionGeometry } from '../dim-geometry-builder';
import { sideMeasuresX, type PlannedSegment } from './auto-dimension-types';

/** Everything the factory needs that isn't derivable from a segment. */
export interface AutoDimensionFactoryContext {
  /** DimStyle id every produced dim references (active style / ISO built-in). */
  readonly styleId: string;
  /** Layer id applied to every produced dim (annotation / dims layer). */
  readonly layerId: string;
  /** Resolved style — when present, enables degenerate-segment sanity drop. */
  readonly style?: DimStyle;
}

function associationsFor(seg: PlannedSegment): DimensionAssociation[] | undefined {
  // Φ2 — the parent dim measures X on N/S sides, Y on E/W sides; each anchored
  // def point rides its host's bbox `edge` on that axis (follow-on-move).
  const axis: 'x' | 'y' = sideMeasuresX(seg.side) ? 'x' : 'y';
  const out: DimensionAssociation[] = [];
  if (seg.source1) {
    out.push({ defPointIndex: 0, geometryId: seg.source1.id, associationType: 'bimExtent', bimAnchor: { axis, edge: seg.source1.edge } });
  }
  if (seg.source2) {
    out.push({ defPointIndex: 1, geometryId: seg.source2.id, associationType: 'bimExtent', bimAnchor: { axis, edge: seg.source2.edge } });
  }
  return out.length ? out : undefined;
}

function makeEntity(seg: PlannedSegment, ctx: AutoDimensionFactoryContext): LinearDimensionEntity {
  return {
    id: generateDimensionId(),
    type: 'dimension',
    layerId: ctx.layerId,
    dimensionType: 'linear',
    styleId: ctx.styleId,
    defPoints: seg.defPoints,
    rotation: seg.rotation,
    userText: '<>', // measured value (default token)
    associations: associationsFor(seg),
  };
}

/** True when the geometry builder accepts the entity (or no style to check). */
function passesSanity(entity: LinearDimensionEntity, style?: DimStyle): boolean {
  if (!style) return true;
  try {
    buildDimensionGeometry(entity, style);
    return true;
  } catch {
    return false;
  }
}

/** Build all dimension entities for the planned segments (drops degenerate). */
export function buildAutoDimensionEntities(
  segments: readonly PlannedSegment[],
  ctx: AutoDimensionFactoryContext,
): LinearDimensionEntity[] {
  const out: LinearDimensionEntity[] = [];
  for (const seg of segments) {
    const entity = makeEntity(seg, ctx);
    if (passesSanity(entity, ctx.style)) out.push(entity);
  }
  return out;
}
