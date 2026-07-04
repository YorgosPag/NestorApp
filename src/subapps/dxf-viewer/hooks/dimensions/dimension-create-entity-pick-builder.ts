/**
 * ADR-362 Phase N — Pick-entity quick dimension builder (`dim-entity` tool).
 *
 * AutoCAD `DIM` "select object" flow: click 1 picks a WHOLE entity, click 2 is
 * the placement. The measured geometry is auto-derived from the picked entity:
 *
 *   - line / wall  → the two span endpoints (centerline for walls). The 2nd
 *     click's drag direction decides the dimension kind (Q-A, Giorgio 2026-07-04):
 *       · drag ⟂ to the entity      → `aligned`   (true length)
 *       · drag vertically (↑/↓)      → `linear` rot 0   (horizontal projection ΔX)
 *       · drag horizontally (←/→)    → `linear` rot 90  (vertical projection ΔY)
 *   - circle → `diameter`  (delegates to the radial builder)
 *   - arc    → `radius`    (delegates to the radial builder)
 *
 * Pure `(state, opts) → DimensionEntity | null`, same contract as the other
 * creation builders. Routed from `dimension-create-entity-builder.ts` whenever
 * `state.mode === 'entity'`, ahead of the per-type dispatcher.
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  AlignedDimensionEntity,
  DimensionEntity,
  LinearDimensionEntity,
} from '../../types/dimension';
import type { Entity } from '../../snapping/extended-types';
import { GeometricCalculations } from '../../snapping/shared/GeometricCalculations';
import type { DimensionCreateState } from './dimension-create-state';
import { buildDiameter, buildRadius } from './dimension-create-radial-builders';

export interface EntityPickBuildOpts {
  readonly id: string;
  readonly layerId: string;
  readonly includeCursor: boolean;
}

/** Dimension kind chosen from the 2nd-click drag direction (line/wall only). */
export type EntityDimKind = 'aligned' | 'linear-h' | 'linear-v';

// ──────────────────────────────────────────────────────────────────────────────
// Public entry
// ──────────────────────────────────────────────────────────────────────────────

export function buildEntityPickDimension(
  state: DimensionCreateState,
  opts: EntityPickBuildOpts,
): DimensionEntity | null {
  const picked = state.clicks[0]?.pickedEntity;
  if (!picked) return null;
  switch (picked.type) {
    case 'circle':
      return buildDiameter(state, opts);
    case 'arc':
      return buildRadius(state, opts);
    case 'line':
    case 'wall':
      return buildLinearOrAligned(state, opts);
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Line / wall → aligned | linear (drag-driven)
// ──────────────────────────────────────────────────────────────────────────────

function buildLinearOrAligned(
  state: DimensionCreateState,
  opts: EntityPickBuildOpts,
): DimensionEntity | null {
  const picked = state.clicks[0]?.pickedEntity;
  if (!picked) return null;
  const span = spanEndpoints(picked as unknown as Entity);
  if (!span) return null;
  const placement = placementPoint(state, opts);
  if (!placement) return null;

  const [a, b] = span;
  const kind = resolveEntityDimKind(a, b, placement);
  if (kind === 'aligned') {
    const aligned: AlignedDimensionEntity = {
      id: opts.id,
      type: 'dimension',
      dimensionType: 'aligned',
      layerId: opts.layerId,
      styleId: state.styleId as string,
      defPoints: [a, b, placement],
    };
    return aligned;
  }
  // linear-h → dim line along WCS X (rotation 0, measures ΔX);
  // linear-v → dim line along WCS Y (rotation 90, measures ΔY).
  const linear: LinearDimensionEntity = {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'linear',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: [a, b, placement],
    rotation: kind === 'linear-h' ? 0 : 90,
  };
  return linear;
}

/** First + last endpoint of the picked entity (line ends / wall centerline span). */
function spanEndpoints(entity: Entity): readonly [Point2D, Point2D] | null {
  const pts = GeometricCalculations.getEntityEndpoints(entity);
  if (pts.length < 2) return null;
  return [pts[0], pts[pts.length - 1]];
}

/** Placement = the 2nd click (or the live cursor in preview). */
function placementPoint(
  state: DimensionCreateState,
  opts: EntityPickBuildOpts,
): Point2D | null {
  const explicit = state.clicks[1]?.world;
  if (explicit) return explicit;
  if (opts.includeCursor && state.cursorWorld) return state.cursorWorld;
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Zone logic — nearest-of-three-targets (mod 180°), Giorgio 2026-07-04
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Classify the placement drag against three undirected target axes:
 *   - the entity's perpendicular  → `aligned`   (true length)
 *   - the vertical axis (↑/↓ drag) → `linear-h`  (horizontal dim, ΔX)
 *   - the horizontal axis (←/→)    → `linear-v`  (vertical dim, ΔY)
 * The drag direction (placement − span midpoint) is assigned to whichever target
 * it is angularly closest to. Directions are undirected, so all maths is mod 180°.
 */
export function resolveEntityDimKind(
  a: Point2D,
  b: Point2D,
  placement: Point2D,
): EntityDimKind {
  const dragX = placement.x - (a.x + b.x) / 2;
  const dragY = placement.y - (a.y + b.y) / 2;
  if (Math.hypot(dragX, dragY) < 1e-9) return 'aligned';

  const dragAngle = mod180(Math.atan2(dragY, dragX));
  const perpAligned = mod180(Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2);
  const H_TARGET = mod180(Math.PI / 2); // vertical drag ⇒ horizontal dim
  const V_TARGET = 0; //                    horizontal drag ⇒ vertical dim

  const dAligned = circDist180(dragAngle, perpAligned);
  const dH = circDist180(dragAngle, H_TARGET);
  const dV = circDist180(dragAngle, V_TARGET);

  if (dAligned <= dH && dAligned <= dV) return 'aligned';
  return dH <= dV ? 'linear-h' : 'linear-v';
}

/** Fold an angle (radians) into the undirected range [0, π). */
function mod180(angle: number): number {
  return ((angle % Math.PI) + Math.PI) % Math.PI;
}

/** Smallest angular gap between two undirected angles in [0, π). */
function circDist180(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, Math.PI - d);
}
