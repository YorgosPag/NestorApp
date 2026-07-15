/**
 * @module systems/guides/commands/guide-command-geometry
 * @description Pure geometry helpers shared by the guide command family.
 *
 * Extracted so that entity→guide construction and guide rotation live in ONE
 * place instead of being copy-pasted across the create / entity / rotate
 * command classes (jscpd sibling clones).
 *
 * @see ADR-613 (Guide command SSoT)
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-07-09
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import type { EntityGuideParams } from './guide-entity-commands';
import { rotatePoint } from '../../../utils/rotation-math';

/** Start/end pair describing a finite guide segment. */
export interface GuideEndpoints {
  start: Point2D;
  end: Point2D;
}

/** Half-length extent for converting infinite X/Y guides to finite segments. */
export const GUIDE_ROTATION_EXTENT = 10_000;
/** Half-length extent for guides synthesised from picked DXF entities. */
export const GUIDE_ENTITY_EXTENT = 10_000;

/** Minimum segment length below which a direction is considered degenerate. */
const MIN_SEGMENT_LENGTH = 0.001;

/**
 * Unit direction from `from` to `to`, or `null` when the two points coincide
 * (segment shorter than {@link MIN_SEGMENT_LENGTH}).
 */
export function unitDirection(from: Point2D, to: Point2D): Point2D | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= MIN_SEGMENT_LENGTH) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * Push `created` onto `target`, first copying the source guide's style (if any).
 * No-op when `created` is undefined (the store rejected the guide — that is what
 * `addGuideRaw` / `addDiagonalGuideRaw` return on rejection, and they are the only
 * producers here). Shared by the mirror and copy-pattern commands, which clone a
 * source guide's visual style.
 */
export function pushStyledGuide(target: Guide[], created: Guide | undefined, source: Guide): void {
  if (!created) return;
  if (source.style) created.style = { ...source.style };
  target.push(created);
}

/** Extend a segment symmetrically through `origin` along unit `dir` by `extent`. */
export function extendThroughPoint(origin: Point2D, dir: Point2D, extent: number): GuideEndpoints {
  return {
    start: { x: origin.x - dir.x * extent, y: origin.y - dir.y * extent },
    end: { x: origin.x + dir.x * extent, y: origin.y + dir.y * extent },
  };
}

/**
 * Rotate a guide around `pivot` by `angleDeg`, returning the new endpoints.
 *
 * X/Y (infinite) guides are first materialised as finite ±{@link GUIDE_ROTATION_EXTENT}
 * segments centred on the pivot axis; XZ guides use their existing endpoints.
 */
export function computeRotatedGuideEndpoints(
  guide: Guide,
  pivot: Point2D,
  angleDeg: number,
): GuideEndpoints {
  let originalStart: Point2D;
  let originalEnd: Point2D;

  if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
    originalStart = guide.startPoint;
    originalEnd = guide.endPoint;
  } else if (guide.axis === 'X') {
    originalStart = { x: guide.offset, y: pivot.y - GUIDE_ROTATION_EXTENT };
    originalEnd = { x: guide.offset, y: pivot.y + GUIDE_ROTATION_EXTENT };
  } else {
    originalStart = { x: pivot.x - GUIDE_ROTATION_EXTENT, y: guide.offset };
    originalEnd = { x: pivot.x + GUIDE_ROTATION_EXTENT, y: guide.offset };
  }

  return {
    start: rotatePoint(originalStart, pivot, angleDeg),
    end: rotatePoint(originalEnd, pivot, angleDeg),
  };
}

/**
 * Build guide(s) from a single picked DXF entity (ADR-189 B8):
 * - LINE / POLYLINE segment → XZ diagonal guide along the segment direction
 * - CIRCLE → X + Y guides through the centre
 * - ARC → XZ radial guide from centre through the click point
 *
 * Returns the guides actually created (may be empty for degenerate input).
 */
export function buildGuidesFromEntityParams(store: GuideStore, params: EntityGuideParams): Guide[] {
  const { entityType, lineStart, lineEnd, center, clickPoint } = params;
  const created: Guide[] = [];

  if ((entityType === 'LINE' || entityType === 'POLYLINE') && lineStart && lineEnd) {
    const dir = unitDirection(lineStart, lineEnd);
    if (dir) {
      const mid: Point2D = { x: (lineStart.x + lineEnd.x) / 2, y: (lineStart.y + lineEnd.y) / 2 };
      const { start, end } = extendThroughPoint(mid, dir, GUIDE_ENTITY_EXTENT);
      const guide = store.addDiagonalGuideRaw(start, end);
      if (guide) created.push(guide);
    }
  } else if (entityType === 'CIRCLE' && center) {
    const gx = store.addGuideRaw('X', center.x);
    if (gx) created.push(gx);
    const gy = store.addGuideRaw('Y', center.y);
    if (gy) created.push(gy);
  } else if (entityType === 'ARC' && center && clickPoint) {
    const dir = unitDirection(center, clickPoint);
    if (dir) {
      const { start, end } = extendThroughPoint(center, dir, GUIDE_ENTITY_EXTENT);
      const guide = store.addDiagonalGuideRaw(start, end);
      if (guide) created.push(guide);
    }
  }

  return created;
}
