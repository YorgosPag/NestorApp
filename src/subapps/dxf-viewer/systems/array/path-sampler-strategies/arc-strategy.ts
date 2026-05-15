/**
 * ADR-353 C1 — Path arc-length sampler: ARC strategy (analytical).
 * ArcEntity angles are in degrees; counterclockwise flag controls direction.
 */

import type { Entity, ArcEntity } from '../../../types/entities';
import { isArcEntity } from '../../../types/entities';
import type { PathSample, PathSamplerStrategy } from '../path-arc-length-sampler';

const DEG_TO_RAD = Math.PI / 180;

/** Normalize degrees to [0, 360). */
function positiveSweep(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function sweepDegFor(entity: ArcEntity): number {
  return entity.counterclockwise ?? false
    ? positiveSweep(entity.endAngle - entity.startAngle)
    : positiveSweep(entity.startAngle - entity.endAngle);
}

export class ArcStrategy implements PathSamplerStrategy<ArcEntity> {
  matches(entity: Entity): entity is ArcEntity {
    return isArcEntity(entity);
  }

  totalLength(entity: ArcEntity): number {
    return entity.radius * sweepDegFor(entity) * DEG_TO_RAD;
  }

  sample(entity: ArcEntity, u: number, reversed: boolean): PathSample {
    const cu = Math.max(0, Math.min(1, u));
    const sweep = sweepDegFor(entity);

    if (sweep === 0 || entity.radius === 0) {
      const a = entity.startAngle * DEG_TO_RAD;
      return {
        position: { x: entity.center.x + entity.radius * Math.cos(a), y: entity.center.y + entity.radius * Math.sin(a) },
        tangentDeg: 0,
      };
    }

    const ccw = entity.counterclockwise ?? false;
    const actualCCW = reversed ? !ccw : ccw;
    const effectiveStart = reversed ? entity.endAngle : entity.startAngle;
    const dir = actualCCW ? +1 : -1;
    const angleDeg = effectiveStart + dir * cu * sweep;
    const angleRad = angleDeg * DEG_TO_RAD;

    return {
      position: {
        x: entity.center.x + entity.radius * Math.cos(angleRad),
        y: entity.center.y + entity.radius * Math.sin(angleRad),
      },
      tangentDeg: angleDeg + dir * 90,
    };
  }
}
