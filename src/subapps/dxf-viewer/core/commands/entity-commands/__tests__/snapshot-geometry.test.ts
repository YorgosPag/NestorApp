/**
 * ADR-507 §8 — `geometryFromSnapshot` SSoT tests.
 *
 * Default keeps `type` (type-changing edits are reversible); `excludeType`
 * drops it (Extend/Trim geometry-only restore onto an entity that keeps its type).
 * Identity fields (`id`, `layer`, `visible`) are ALWAYS stripped.
 */
import { geometryFromSnapshot } from '../snapshot-geometry';
import type { SceneEntity } from '../../interfaces';

const snapshot = {
  id: 'e1',
  type: 'line',
  layer: 'L1',
  visible: true,
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 10, y: 0 },
} as unknown as SceneEntity;

describe('geometryFromSnapshot', () => {
  it('strips identity fields (id/layer/visible) by default', () => {
    const geom = geometryFromSnapshot(snapshot) as Record<string, unknown>;
    expect(geom.id).toBeUndefined();
    expect(geom.layer).toBeUndefined();
    expect(geom.visible).toBeUndefined();
  });

  it('keeps geometry + `type` by default', () => {
    const geom = geometryFromSnapshot(snapshot) as Record<string, unknown>;
    expect(geom.type).toBe('line');
    expect(geom.startPoint).toEqual({ x: 0, y: 0 });
    expect(geom.endPoint).toEqual({ x: 10, y: 0 });
  });

  it('drops `type` when excludeType is set (Extend/Trim), keeps geometry', () => {
    const geom = geometryFromSnapshot(snapshot, { excludeType: true }) as Record<string, unknown>;
    expect(geom.type).toBeUndefined();
    expect(geom.id).toBeUndefined();
    expect(geom.startPoint).toEqual({ x: 0, y: 0 });
    expect(geom.endPoint).toEqual({ x: 10, y: 0 });
  });
});
