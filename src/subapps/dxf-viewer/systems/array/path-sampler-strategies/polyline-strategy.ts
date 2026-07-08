/**
 * ADR-353 C1 — Path arc-length sampler: POLYLINE / LWPOLYLINE strategy (analytical).
 * Handles straight-segment polylines. Bulge (arc-segment) support deferred to C2.
 */

import type { Entity, PolylineEntity, LWPolylineEntity } from '../../../types/entities';
import { isPolylineEntity, isLWPolylineEntity } from '../../../types/entities';
import type { PathSample, PathSamplerStrategy } from '../path-arc-length-sampler';
import { clamp01 } from '../../../utils/scalar-math';
import { degeneratePointSample, sampleAlongPointList } from './path-sample-math';

type PolylineLike = PolylineEntity | LWPolylineEntity;

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
    const raw = entity.vertices;
    const degenerate = degeneratePointSample(raw);
    if (degenerate) return degenerate;

    // Reverse convention: walk the vertex list backwards (tangent flips naturally,
    // so tangentFlip stays +1). Closed polylines append the first vertex to close.
    const pts = reversed ? [...raw].reverse() : raw;
    const walkVerts = entity.closed && pts.length > 2 ? [...pts, pts[0]] : pts;
    return sampleAlongPointList(walkVerts, clamp01(u), 1);
  }
}
