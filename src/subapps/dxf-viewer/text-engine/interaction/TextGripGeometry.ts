/**
 * ADR-344 Phase 6.C — Pure geometry helpers for text grips.
 *
 * Computes the world-space position and shape of every grip handle
 * attached to a DXF TEXT/MTEXT entity, and answers hit-test queries.
 * Grip kinds:
 *
 *   - move          : at the entity insertion point (1)
 *   - resize-*      : 4 corners of the bbox (MTEXT only; ignored for TEXT)
 *   - rotation      : at a small offset above the top-mid edge
 *   - mirror        : at the right-edge midpoint
 *
 * All points are returned in world space, with rotation applied around
 * the insertion point. The renderer is expected to draw plain squares
 * of side `gripPixelSize / scale` centered on `point` — drawing concerns
 * live elsewhere; this module is canvas-free for testability.
 */

import type { DxfTextSceneEntity } from '../../core/commands/text/types';
import type { Rect } from '../layout/attachment-point';
import type { Point2D } from '../../rendering/types/Types';

export type TextGripKind =
  | 'move'
  | 'resize-tl'
  | 'resize-tr'
  | 'resize-bl'
  | 'resize-br'
  | 'rotation'
  | 'mirror';

export interface TextGrip {
  readonly kind: TextGripKind;
  readonly point: Point2D;
  /** Pre-rotation local point; useful for debug overlays. */
  readonly localPoint: Point2D;
}

export interface ComputeGripsOptions {
  /** Vertical world-space offset between top-mid edge and rotation grip. */
  readonly rotationGripOffset: number;
}

function rotate(p: Point2D, origin: Point2D, radians: number): Point2D {
  if (radians === 0) return p;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

function deg(d: number): number {
  return (d * Math.PI) / 180;
}

/**
 * Compute every grip for `entity`. TEXT entities receive only `move`,
 * `rotation`, and `mirror`. MTEXT entities receive all 7.
 */
export function computeGrips(
  entity: DxfTextSceneEntity,
  bbox: Rect,
  opts: ComputeGripsOptions,
): TextGrip[] {
  const insertion = entity.position;
  const rad = deg(entity.textNode.rotation);

  const local: Record<TextGripKind, Point2D> = {
    move: insertion,
    'resize-tl': { x: bbox.x, y: bbox.y },
    'resize-tr': { x: bbox.x + bbox.width, y: bbox.y },
    'resize-bl': { x: bbox.x, y: bbox.y + bbox.height },
    'resize-br': { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    rotation: { x: bbox.x + bbox.width / 2, y: bbox.y - opts.rotationGripOffset },
    mirror: { x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2 },
  };

  const kinds: TextGripKind[] =
    entity.type === 'mtext'
      ? ['move', 'resize-tl', 'resize-tr', 'resize-bl', 'resize-br', 'rotation', 'mirror']
      : ['move', 'rotation', 'mirror'];

  return kinds.map((kind) => ({
    kind,
    localPoint: local[kind],
    point: kind === 'move' ? insertion : rotate(local[kind], insertion, rad),
  }));
}

/**
 * Find the grip closest to `cursor` within `worldTolerance`. Returns
 * `null` when no grip is in range. When multiple grips lie within the
 * tolerance, the closer one wins; ties break in `computeGrips` order.
 */
export function hitTestGrips(
  grips: readonly TextGrip[],
  cursor: Point2D,
  worldTolerance: number,
): TextGrip | null {
  let best: TextGrip | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const g of grips) {
    const d = Math.hypot(g.point.x - cursor.x, g.point.y - cursor.y);
    if (d <= worldTolerance && d < bestDist) {
      best = g;
      bestDist = d;
    }
  }
  return best;
}
