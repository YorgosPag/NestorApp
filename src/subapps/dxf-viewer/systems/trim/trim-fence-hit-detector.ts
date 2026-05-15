/**
 * TRIM FENCE HIT DETECTOR — ADR-350 Phase 4
 *
 * Pure function: given the fence segment (dragStart → dragCurrent) and the
 * current scene, returns every entity the fence segment geometrically crosses.
 * Each hit carries the intersection point used as the pick point for the cutter.
 *
 * Design:
 *   - Reuses {@link computeIntersectionPoints} from the intersection mapper SSoT.
 *   - The fence is modelled as a synthetic LINE entity (id '__fence__') so it
 *     fits naturally into the CuttingEdge protocol without code duplication.
 *   - Quick mode: all visible/unlocked trimmable entities are candidates.
 *   - Standard mode: only entities whose id is in `cuttingEdgeIds`.
 *
 * No React, no state, no side effects.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §Phase 4
 */

import type { Entity, LineEntity } from '../../types/entities';
import type { SceneLayer, SceneModel } from '../../types/scene';
import { isValidCuttingCandidate, isTrimmable } from './trim-boundary-resolver';
import { computeIntersectionPoints } from './trim-intersection-mapper';
import type { CuttingEdge, TrimMode } from './trim-types';
import type { Point2D } from '../../rendering/types/Types';

// Synthetic ID — never matches a real entity ID (enterprise IDs use prefix_uuid pattern).
const FENCE_ENTITY_ID = '__fence__';

export interface FenceHit {
  /** ID of the entity that the fence segment crosses. */
  readonly entityId: string;
  /** Intersection point of the entity with the fence segment (used as pick point). */
  readonly pickPoint: Point2D;
}

export interface DetectFenceHitsArgs {
  readonly fenceStart: Point2D;
  readonly fenceEnd: Point2D;
  readonly scene: SceneModel;
  readonly mode: TrimMode;
  /** Empty array = Quick mode (all visible entities). Populated in Standard mode. */
  readonly cuttingEdgeIds: ReadonlyArray<string>;
}

/**
 * Return every trimmable entity in the scene that the fence segment crosses.
 * Preserves scene order for deterministic results.
 */
export function detectFenceHits(args: DetectFenceHitsArgs): FenceHit[] {
  const { fenceStart, fenceEnd, scene, mode, cuttingEdgeIds } = args;

  const fenceEdge = buildFenceEdge(fenceStart, fenceEnd);
  const layers: Record<string, SceneLayer> = scene.layers ?? {};
  const allow = mode === 'standard' ? new Set(cuttingEdgeIds) : null;
  const hits: FenceHit[] = [];

  for (const rawEntity of scene.entities) {
    if (!isTrimmable(rawEntity)) continue;
    if (!isValidCuttingCandidate(rawEntity, layers)) continue;
    if (allow && !allow.has(rawEntity.id)) continue;

    const entity = rawEntity as Entity;
    const pts = computeIntersectionPoints(entity, [fenceEdge]);
    if (pts.length === 0) continue;

    hits.push({ entityId: entity.id, pickPoint: closestToOrigin(pts, fenceStart) });
  }

  return hits;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFenceEdge(start: Point2D, end: Point2D): CuttingEdge {
  const entity: LineEntity = {
    id: FENCE_ENTITY_ID,
    type: 'line',
    start,
    end,
    layer: '',
  };
  return { sourceEntityId: FENCE_ENTITY_ID, entity, extended: false };
}

/** Returns the point from `pts` closest to `origin` (shortest squared distance). */
function closestToOrigin(pts: ReadonlyArray<Point2D>, origin: Point2D): Point2D {
  let best = pts[0];
  let bestD2 = distSq(pts[0], origin);
  for (let i = 1; i < pts.length; i++) {
    const d2 = distSq(pts[i], origin);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = pts[i];
    }
  }
  return best;
}

function distSq(a: Point2D, b: Point2D): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
