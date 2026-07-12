/**
 * ADR-641 — BEDIT view transform (real-size + recenter) round-trip + compute tests.
 */

import {
  computeBlockEditViewTransform,
  viewFromDef,
  defFromView,
  type BlockEditViewTransform,
} from '../block-edit-view-transform';
import type { BlockEntity, LineEntity, CircleEntity } from '../../../types/entities';

function line(id: string, x1: number, y1: number, x2: number, y2: number): LineEntity {
  return {
    id, type: 'line', layerId: '0',
    start: { x: x1, y: y1 }, end: { x: x2, y: y2 },
  } as LineEntity;
}

function block(scaleX: number, scaleY: number, entities: BlockEntity['entities']): BlockEntity {
  return {
    id: 'blk1', type: 'block', name: 'NEC32_BLOCK', layerId: '0',
    position: { x: 18_202_599, y: 3_650_006 }, scale: { x: scaleX, y: scaleY }, rotation: 180,
    entities, visible: true,
  } as BlockEntity;
}

describe('computeBlockEditViewTransform', () => {
  it('derives per-axis scale from the instance + the definition bounds-centre', () => {
    // Members span x∈[18170, 18171], y∈[3504, 3506] → centre (18170.5, 3505).
    const b = block(1000, 1000, [line('l1', 18170, 3504, 18171, 3506)]);
    const t = computeBlockEditViewTransform(b);
    expect(t.sx).toBe(1000);
    expect(t.sy).toBe(1000);
    expect(t.cx).toBeCloseTo(18170.5, 6);
    expect(t.cy).toBeCloseTo(3505, 6);
  });

  it('degrades a zero/absent scale axis to 1 (identity axis)', () => {
    const b = block(0, 1000, [line('l1', 0, 0, 10, 10)]);
    expect(computeBlockEditViewTransform(b).sx).toBe(1);
  });

  it('centres on the origin for an empty member set', () => {
    const t = computeBlockEditViewTransform(block(1000, 1000, []));
    expect(t.cx).toBe(0);
    expect(t.cy).toBe(0);
  });
});

describe('viewFromDef / defFromView', () => {
  const t: BlockEditViewTransform = { sx: 1000, sy: 1000, cx: 18170.5, cy: 3505 };

  it('viewFromDef scales to world magnitude and recentres on the origin', () => {
    // A 0.8×2.1 (def-unit) span → 800×2100 mm (world), centred near the origin.
    const v = viewFromDef(line('l1', 18170.1, 3504.0, 18170.9, 3506.1), t) as LineEntity;
    // (18170.1 − 18170.5)·1000 = −400 ; (3504 − 3505)·1000 = −1000
    expect(v.start.x).toBeCloseTo(-400, 3);
    expect(v.start.y).toBeCloseTo(-1000, 3);
    expect(v.end.x).toBeCloseTo(400, 3);
    expect(v.end.y).toBeCloseTo(1100, 3);
  });

  it('defFromView is the exact inverse of viewFromDef (line)', () => {
    const def = line('l1', 18170.1, 3504.0, 18170.9, 3506.1);
    const round = defFromView(viewFromDef(def, t), t) as LineEntity;
    expect(round.start.x).toBeCloseTo(def.start.x, 6);
    expect(round.start.y).toBeCloseTo(def.start.y, 6);
    expect(round.end.x).toBeCloseTo(def.end.x, 6);
    expect(round.end.y).toBeCloseTo(def.end.y, 6);
  });

  it('round-trips a circle (uniform scale keeps it a circle, radius × scale)', () => {
    const c = {
      id: 'c1', type: 'circle', layerId: '0',
      center: { x: 18170.5, y: 3505 }, radius: 0.05,
    } as CircleEntity;
    const v = viewFromDef(c, t) as CircleEntity;
    expect(v.radius).toBeCloseTo(50, 6); // 0.05 × 1000 = 50 mm
    const round = defFromView(v, t) as CircleEntity;
    expect(round.radius).toBeCloseTo(0.05, 9);
    expect(round.center.x).toBeCloseTo(18170.5, 6);
    expect(round.center.y).toBeCloseTo(3505, 6);
  });
});
