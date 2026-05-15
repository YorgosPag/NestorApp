/**
 * ADR-353 C1 — Path arc-length sampler: POLYLINE / LWPOLYLINE strategy (analytical).
 * Handles straight-segment polylines. Bulge (arc-segment) support deferred to C2.
 */

import type { Entity, PolylineEntity, LWPolylineEntity } from '../../../types/entities';
import { isPolylineEntity, isLWPolylineEntity } from '../../../types/entities';
import type { PathSample, PathSamplerStrategy } from '../path-arc-length-sampler';

type PolylineLike = PolylineEntity | LWPolylineEntity;

/** Cumulative arc-length table from vertex list (index 0 = 0). */
function buildCumLengths(pts: readonly { x: number; y: number }[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return cum;
}

export class PolylineStrategy implements PathSamplerStrategy<PolylineLike> {
  matches(entity: Entity): entity is PolylineLike {
    return isPolylineEntity(entity) || isLWPolylineEntity(entity);
  }

  totalLength(entity: PolylineLike): number {
    const v = entity.vertices;
    if (v.length < 2) return 0;
    let len = 0;
    for (let i = 1; i < v.length; i++) {
      len += Math.hypot(v[i].x - v[i - 1].x, v[i].y - v[i - 1].y);
    }
    if (entity.closed && v.length > 2) {
      len += Math.hypot(v[0].x - v[v.length - 1].x, v[0].y - v[v.length - 1].y);
    }
    return len;
  }

  sample(entity: PolylineLike, u: number, reversed: boolean): PathSample {
    const cu = Math.max(0, Math.min(1, u));
    const raw = entity.vertices;
    if (raw.length === 0) return { position: { x: 0, y: 0 }, tangentDeg: 0 };
    if (raw.length === 1) return { position: { x: raw[0].x, y: raw[0].y }, tangentDeg: 0 };

    const pts = reversed ? [...raw].reverse() : raw;
    const walkVerts = entity.closed && pts.length > 2 ? [...pts, pts[0]] : pts;
    const cum = buildCumLengths(walkVerts);
    const total = cum[cum.length - 1];

    if (total === 0) return { position: { x: pts[0].x, y: pts[0].y }, tangentDeg: 0 };

    const target = cu * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;

    const segStart = walkVerts[i - 1];
    const segEnd = walkVerts[i];
    const segLen = cum[i] - cum[i - 1];
    const t = segLen === 0 ? 0 : (target - cum[i - 1]) / segLen;
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;

    return {
      position: { x: segStart.x + t * dx, y: segStart.y + t * dy },
      tangentDeg: Math.atan2(dy, dx) * (180 / Math.PI),
    };
  }
}
