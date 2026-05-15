/**
 * ADR-353 C1 — Path arc-length sampler: CIRCLE strategy (analytical).
 * Starts at angle 0 (east). CCW by default; reversed = CW traversal.
 */

import type { Entity, CircleEntity } from '../../../types/entities';
import { isCircleEntity } from '../../../types/entities';
import type { PathSample, PathSamplerStrategy } from '../path-arc-length-sampler';

const TAU = Math.PI * 2;
const RAD_TO_DEG = 180 / Math.PI;

export class CircleStrategy implements PathSamplerStrategy<CircleEntity> {
  matches(entity: Entity): entity is CircleEntity {
    return isCircleEntity(entity);
  }

  totalLength(entity: CircleEntity): number {
    return TAU * entity.radius;
  }

  sample(entity: CircleEntity, u: number, reversed: boolean): PathSample {
    const cu = Math.max(0, Math.min(1, u));
    if (entity.radius === 0) {
      return { position: { x: entity.center.x, y: entity.center.y }, tangentDeg: 0 };
    }
    const dir = reversed ? -1 : +1;
    const angleRad = dir * cu * TAU;
    const angleDeg = angleRad * RAD_TO_DEG;
    return {
      position: {
        x: entity.center.x + entity.radius * Math.cos(angleRad),
        y: entity.center.y + entity.radius * Math.sin(angleRad),
      },
      tangentDeg: angleDeg + dir * 90,
    };
  }
}
