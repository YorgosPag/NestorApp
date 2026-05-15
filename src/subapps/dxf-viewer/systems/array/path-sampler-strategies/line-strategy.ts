/**
 * ADR-353 C1 — Path arc-length sampler: LINE strategy (analytical).
 */

import type { Entity, LineEntity } from '../../../types/entities';
import { isLineEntity } from '../../../types/entities';
import type { PathSample, PathSamplerStrategy } from '../path-arc-length-sampler';

export class LineStrategy implements PathSamplerStrategy<LineEntity> {
  matches(entity: Entity): entity is LineEntity {
    return isLineEntity(entity);
  }

  totalLength(entity: LineEntity): number {
    return Math.hypot(entity.end.x - entity.start.x, entity.end.y - entity.start.y);
  }

  sample(entity: LineEntity, u: number, reversed: boolean): PathSample {
    const cu = Math.max(0, Math.min(1, u));
    const from = reversed ? entity.end : entity.start;
    const to = reversed ? entity.start : entity.end;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) === 0) {
      return { position: { x: from.x, y: from.y }, tangentDeg: 0 };
    }
    return {
      position: { x: from.x + cu * dx, y: from.y + cu * dy },
      tangentDeg: Math.atan2(dy, dx) * (180 / Math.PI),
    };
  }
}
