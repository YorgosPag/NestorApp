/**
 * MEP wire waypoint hit-testing — ADR-408 Φ7 FU#3 (SSoT, pure).
 *
 * Maps a world-space cursor point to either an existing waypoint **node**
 * (for move / delete) or a host **segment** (for insertion), over the host-level
 * segments of one circuit (`computeCircuitHostSegments`, pre-filtered to the
 * active system by the caller). All distances are in **canvas units**; the
 * interaction layer converts a pixel tolerance to world units via the transform.
 *
 * Reuses the canonical segment-distance helpers (ADR-065) — no bespoke geometry.
 * Pure — no store / React / Date / Math.random.
 *
 * @see ./mep-wire-routing.ts (CircuitHostSegment)
 * @see ./mep-wire-waypoints.ts (orientation)
 * @see ../../../rendering/entities/shared/geometry-utils.ts (distance helpers)
 */

import type { Point2D } from '../../rendering/types/Types';
import { getNearestPointOnLine, pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import type { CircuitHostSegment } from './mep-wire-routing';
import { getOrientedWaypoints, type WireWaypointMap, type WirePlanPoint } from './mep-wire-waypoints';

/** A cursor hit on an existing waypoint node (draw orientation). */
export interface WaypointNodeHit {
  /** Endpoint keys of the segment in draw direction (for the `*Oriented` editors). */
  readonly keyA: string;
  readonly keyB: string;
  /** Index of the node within the segment's draw-oriented waypoint list. */
  readonly orientedIndex: number;
  readonly point: WirePlanPoint;
}

/** A cursor hit on a host segment, with the projected insertion point + index. */
export interface SegmentInsertHit {
  readonly keyA: string;
  readonly keyB: string;
  /** Draw-oriented index at which a new waypoint should be inserted. */
  readonly orientedInsertIndex: number;
  readonly point: WirePlanPoint;
}

/**
 * Nearest existing waypoint node within `tolWorld` of `worldPos`, or `null`. Node
 * hit takes priority over segment hit (a click on a node moves it, not inserts).
 */
export function hitTestWaypointNode(
  worldPos: Point2D,
  segments: readonly CircuitHostSegment[],
  map: WireWaypointMap | undefined,
  tolWorld: number,
): WaypointNodeHit | null {
  const tolSq = tolWorld * tolWorld;
  let best: WaypointNodeHit | null = null;
  let bestDistSq = tolSq;
  for (const seg of segments) {
    const wps = getOrientedWaypoints(map, seg.keyA, seg.keyB);
    for (let i = 0; i < wps.length; i++) {
      const wp = wps[i]!;
      const dx = wp.x - worldPos.x;
      const dy = wp.y - worldPos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = { keyA: seg.keyA, keyB: seg.keyB, orientedIndex: i, point: { x: wp.x, y: wp.y } };
      }
    }
  }
  return best;
}

/**
 * Nearest host segment within `tolWorld` of `worldPos`, returning the projected
 * point on the broken `a→waypoints→b` polyline and the draw-oriented index at
 * which a new waypoint splits that sub-segment, or `null`.
 */
export function hitTestInsertion(
  worldPos: Point2D,
  segments: readonly CircuitHostSegment[],
  map: WireWaypointMap | undefined,
  tolWorld: number,
): SegmentInsertHit | null {
  let best: SegmentInsertHit | null = null;
  let bestDist = tolWorld;
  for (const seg of segments) {
    const wps = getOrientedWaypoints(map, seg.keyA, seg.keyB);
    // Draw vertex sequence: [a, ...wps, b] → (wps.length + 1) sub-segments.
    const verts: Point2D[] = [seg.a, ...projectVerticesTo2D(wps), seg.b];
    for (let k = 0; k < verts.length - 1; k++) {
      const dist = pointToLineDistance(worldPos, verts[k]!, verts[k + 1]!);
      if (dist <= bestDist) {
        bestDist = dist;
        const proj = getNearestPointOnLine(worldPos, verts[k]!, verts[k + 1]!, true);
        best = {
          keyA: seg.keyA,
          keyB: seg.keyB,
          orientedInsertIndex: k,
          point: { x: proj.x, y: proj.y },
        };
      }
    }
  }
  return best;
}
