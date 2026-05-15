/**
 * ADR-353 C2 — Path arc-length sampler: ELLIPSE strategy (numerical).
 * Gauss-Legendre 5-point quadrature for arc-length integration.
 * majorAxis/minorAxis are semi-axes (radii). rotation is degrees. params are radians.
 */

import type { Entity, EllipseEntity } from '../../../types/entities';
import { isEllipseEntity } from '../../../types/entities';
import type { PathSample, PathSamplerStrategy } from '../path-arc-length-sampler';

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const SAMPLE_N = 128;

const GL5_NODES = [-0.9061798459, -0.5384693101, 0.0, 0.5384693101, 0.9061798459];
const GL5_WEIGHTS = [0.2369268851, 0.4786286705, 0.5688888889, 0.4786286705, 0.2369268851];

function gaussLegendre(f: (t: number) => number, a: number, b: number): number {
  const mid = (a + b) / 2;
  const half = (b - a) / 2;
  let sum = 0;
  for (let i = 0; i < 5; i++) sum += GL5_WEIGHTS[i] * f(mid + half * GL5_NODES[i]);
  return half * sum;
}

function dLdt(a: number, b: number, t: number): number {
  const sinT = Math.sin(t);
  const cosT = Math.cos(t);
  return Math.sqrt(a * a * sinT * sinT + b * b * cosT * cosT);
}

function effectiveRange(entity: EllipseEntity): [number, number] {
  return [entity.startParam ?? 0, entity.endParam ?? TWO_PI];
}

function buildCumLengths(
  a: number, b: number, tStart: number, tEnd: number, n: number,
): { ts: Float64Array; cum: Float64Array } {
  const ts = new Float64Array(n + 1);
  const cum = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) ts[i] = tStart + (i / n) * (tEnd - tStart);
  for (let i = 1; i <= n; i++) {
    cum[i] = cum[i - 1] + gaussLegendre((t) => dLdt(a, b, t), ts[i - 1], ts[i]);
  }
  return { ts, cum };
}

function evalPoint(
  ts: Float64Array, cum: Float64Array, a: number, b: number,
  cosR: number, sinR: number, cx: number, cy: number, target: number,
): { px: number; py: number; dtx: number; dty: number } {
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid; else hi = mid;
  }
  const segFrac = cum[hi] === cum[lo] ? 0 : (target - cum[lo]) / (cum[hi] - cum[lo]);
  const t = ts[lo] + segFrac * (ts[hi] - ts[lo]);
  const sinT = Math.sin(t);
  const cosT = Math.cos(t);
  return {
    px: cx + a * cosT * cosR - b * sinT * sinR,
    py: cy + a * cosT * sinR + b * sinT * cosR,
    dtx: -a * sinT * cosR - b * cosT * sinR,
    dty: -a * sinT * sinR + b * cosT * cosR,
  };
}

export class EllipseStrategy implements PathSamplerStrategy<EllipseEntity> {
  matches(entity: Entity): entity is EllipseEntity {
    return isEllipseEntity(entity);
  }

  totalLength(entity: EllipseEntity): number {
    const [tStart, tEnd] = effectiveRange(entity);
    return gaussLegendre((t) => dLdt(entity.majorAxis, entity.minorAxis, t), tStart, tEnd);
  }

  sample(entity: EllipseEntity, u: number, reversed: boolean): PathSample {
    const cu = Math.max(0, Math.min(1, u));
    const a = entity.majorAxis;
    const b = entity.minorAxis;
    const rotRad = (entity.rotation ?? 0) * DEG_TO_RAD;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const cx = entity.center.x;
    const cy = entity.center.y;
    const [tStart, tEnd] = effectiveRange(entity);
    const { ts, cum } = buildCumLengths(a, b, tStart, tEnd, SAMPLE_N);
    const total = cum[SAMPLE_N];

    if (total === 0) {
      const t0 = reversed ? tEnd : tStart;
      const cosT = Math.cos(t0), sinT = Math.sin(t0);
      return {
        position: {
          x: cx + a * cosT * cosR - b * sinT * sinR,
          y: cy + a * cosT * sinR + b * sinT * cosR,
        },
        tangentDeg: 0,
      };
    }

    const target = (reversed ? 1 - cu : cu) * total;
    const { px, py, dtx, dty } = evalPoint(ts, cum, a, b, cosR, sinR, cx, cy, target);
    const flip = reversed ? -1 : 1;
    return {
      position: { x: px, y: py },
      tangentDeg: Math.atan2(flip * dty, flip * dtx) * (180 / Math.PI),
    };
  }
}
