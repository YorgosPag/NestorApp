/**
 * ADR-353 C2 — Path arc-length sampler: SPLINE strategy (chord-length).
 * Catmull-Rom interpolation with 256 uniform samples. Covers 90%+ of DXF splines.
 * De Boor (NURBS) not required for path-array purposes.
 */

import type { Entity, SplineEntity } from '../../../types/entities';
import { isSplineEntity } from '../../../types/entities';
import type { PathSample, PathSamplerStrategy } from '../path-arc-length-sampler';
import type { Point2D } from '../../../rendering/types/Types';

const SAMPLE_N = 256;

function catmullRomPoint(pts: readonly Point2D[], t: number): Point2D {
  const n = pts.length - 1;
  const seg = Math.min(Math.floor(t * n), n - 1);
  const u = t * n - seg;
  const u2 = u * u;
  const u3 = u2 * u;
  const p0 = pts[Math.max(0, seg - 1)];
  const p1 = pts[seg];
  const p2 = pts[Math.min(n, seg + 1)];
  const p3 = pts[Math.min(n, seg + 2)];
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
  };
}

function buildSplineSamples(entity: SplineEntity): Point2D[] {
  const pts = entity.controlPoints;
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ x: pts[0].x, y: pts[0].y }];
  const samples: Point2D[] = [];
  for (let i = 0; i <= SAMPLE_N; i++) {
    samples.push(catmullRomPoint(pts, i / SAMPLE_N));
  }
  return samples;
}

function buildCumLengths(pts: readonly Point2D[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return cum;
}

export class SplineStrategy implements PathSamplerStrategy<SplineEntity> {
  matches(entity: Entity): entity is SplineEntity {
    return isSplineEntity(entity);
  }

  totalLength(entity: SplineEntity): number {
    const pts = buildSplineSamples(entity);
    if (pts.length < 2) return 0;
    const cum = buildCumLengths(pts);
    return cum[cum.length - 1];
  }

  sample(entity: SplineEntity, u: number, reversed: boolean): PathSample {
    const cu = Math.max(0, Math.min(1, u));
    const pts = buildSplineSamples(entity);

    if (pts.length === 0) return { position: { x: 0, y: 0 }, tangentDeg: 0 };
    if (pts.length === 1) return { position: { x: pts[0].x, y: pts[0].y }, tangentDeg: 0 };

    const cum = buildCumLengths(pts);
    const total = cum[cum.length - 1];
    if (total === 0) return { position: { x: pts[0].x, y: pts[0].y }, tangentDeg: 0 };

    const target = (reversed ? 1 - cu : cu) * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;

    const segLen = cum[i] - cum[i - 1];
    const t = segLen === 0 ? 0 : (target - cum[i - 1]) / segLen;
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const flip = reversed ? -1 : 1;
    return {
      position: { x: p0.x + t * dx, y: p0.y + t * dy },
      tangentDeg: Math.atan2(flip * dy, flip * dx) * (180 / Math.PI),
    };
  }
}
