/**
 * ADR-362 Round 23 — dim-transform-live-hosts unit tests.
 *
 * Verifies the live-follow host builder produces the SAME transformed geometry
 * the entity ghost + command commit produce (preview ≡ commit), per transform:
 *   - rotate  → rotateEntity
 *   - mirror  → mirrorEntity
 *   - scale   → scaleEntity
 *   - stretch → translateEntityByAnchor (anchor) + applyVertexDisplacement (vertex)
 *
 * Pure (no React / canvas / firebase) — the math SSoT is shared, so confirming
 * the map values match the SSoT output guarantees no divergence.
 */

import type { SceneEntity } from '../../../core/commands/interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { VertexRef } from '../../stretch/stretch-vertex-classifier';
import { buildTransformedHosts } from '../dim-transform-live-hosts';

function line(id: string, start: Point2D, end: Point2D): SceneEntity {
  return { id, type: 'line', start, end, layerId: 'L', visible: true } as unknown as SceneEntity;
}
function circle(id: string, center: Point2D, radius: number): SceneEntity {
  return { id, type: 'circle', center, radius, layerId: 'L', visible: true } as unknown as SceneEntity;
}

const lineOf = (e: SceneEntity) => e as unknown as { start: Point2D; end: Point2D };
const circleOf = (e: SceneEntity) => e as unknown as { center: Point2D; radius: number };

describe('buildTransformedHosts', () => {
  it('rotate: rotates host line 90° CCW about the pivot', () => {
    const orig = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const getEntity = (id: string) => (id === 'L1' ? orig : undefined);

    const moving = buildTransformedHosts(
      { kind: 'rotate', entityIds: ['L1'], pivot: { x: 0, y: 0 }, angleDeg: 90 },
      getEntity,
    );

    const m = lineOf(moving.get('L1')!);
    expect(m.start.x).toBeCloseTo(0, 6);
    expect(m.start.y).toBeCloseTo(0, 6);
    expect(m.end.x).toBeCloseTo(0, 6);
    expect(m.end.y).toBeCloseTo(100, 6);
  });

  it('mirror: reflects host line across the vertical axis x=50', () => {
    const orig = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const getEntity = (id: string) => (id === 'L1' ? orig : undefined);

    const moving = buildTransformedHosts(
      { kind: 'mirror', entityIds: ['L1'], axis: { p1: { x: 50, y: 0 }, p2: { x: 50, y: 100 } } },
      getEntity,
    );

    const m = lineOf(moving.get('L1')!);
    expect(m.start.x).toBeCloseTo(100, 6);
    expect(m.end.x).toBeCloseTo(0, 6);
  });

  it('scale: scales host line ×2 about the base', () => {
    const orig = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const getEntity = (id: string) => (id === 'L1' ? orig : undefined);

    const moving = buildTransformedHosts(
      { kind: 'scale', entityIds: ['L1'], base: { x: 0, y: 0 }, sx: 2, sy: 2 },
      getEntity,
    );

    const m = lineOf(moving.get('L1')!);
    expect(m.end.x).toBeCloseTo(200, 6);
  });

  it('stretch (anchor): rigidly translates a captured circle by the delta', () => {
    const orig = circle('C1', { x: 0, y: 0 }, 25);
    const getEntity = (id: string) => (id === 'C1' ? orig : undefined);

    const moving = buildTransformedHosts(
      { kind: 'stretch', capturedEntities: ['C1'], capturedVertices: [], delta: { x: 10, y: 20 } },
      getEntity,
    );

    const c = circleOf(moving.get('C1')!);
    expect(c.center.x).toBeCloseTo(10, 6);
    expect(c.center.y).toBeCloseTo(20, 6);
    expect(c.radius).toBeCloseTo(25, 6); // rigid move — radius invariant
  });

  it('stretch (vertex): moves only the captured line endpoint', () => {
    const orig = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const getEntity = (id: string) => (id === 'L1' ? orig : undefined);
    const refs: VertexRef[] = [{ entityId: 'L1', kind: 'line-end' } as unknown as VertexRef];

    const moving = buildTransformedHosts(
      { kind: 'stretch', capturedEntities: [], capturedVertices: refs, delta: { x: 0, y: 30 } },
      getEntity,
    );

    const m = lineOf(moving.get('L1')!);
    expect(m.start).toEqual({ x: 0, y: 0 }); // start NOT captured → unchanged
    expect(m.end.x).toBeCloseTo(100, 6);
    expect(m.end.y).toBeCloseTo(30, 6);
  });

  it('skips missing hosts and emits an empty map when nothing resolves', () => {
    const moving = buildTransformedHosts(
      { kind: 'rotate', entityIds: ['ghost'], pivot: { x: 0, y: 0 }, angleDeg: 45 },
      () => undefined,
    );
    expect(moving.size).toBe(0);
  });
});
