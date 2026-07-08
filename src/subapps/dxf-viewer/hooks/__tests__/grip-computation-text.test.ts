/**
 * ADR-557 — `computeDxfEntityGrips` emits the full text/mtext rect-box grip set.
 *
 * Regression guard for «I only see ONE grip on a text»: the `case 'text'` must
 * route through `getTextGrips` (10 grips), not the legacy single centre grip.
 */

import { computeDxfEntityGrips } from '../grip-computation';
import { gripKindOf } from '../grip-kinds';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';

function dxfText(extra: Partial<DxfText> = {}): DxfEntityUnion {
  return { id: 't1', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'DDD', height: 10, ...extra } as DxfEntityUnion;
}

describe('computeDxfEntityGrips — text', () => {
  it('emits 10 grips (4 corners + 4 edges + move + rotation)', () => {
    const grips = computeDxfEntityGrips(dxfText());
    expect(grips).toHaveLength(10);
  });

  it('every grip carries a textGripKind discriminator', () => {
    const grips = computeDxfEntityGrips(dxfText());
    expect(grips.every(g => gripKindOf(g, 'text') !== undefined)).toBe(true);
  });

  it('exposes exactly one centre-move grip and four corner grips', () => {
    const grips = computeDxfEntityGrips(dxfText());
    expect(grips.filter(g => gripKindOf(g, 'text') === 'text-move')).toHaveLength(1);
    expect(grips.filter(g => gripKindOf(g, 'text')?.startsWith('text-corner-'))).toHaveLength(4);
    expect(grips.filter(g => gripKindOf(g, 'text')?.startsWith('text-edge-'))).toHaveLength(4);
  });

  it('works for an MTEXT-derived box (carried width)', () => {
    const grips = computeDxfEntityGrips(dxfText({ width: 120, text: 'X' }));
    expect(grips).toHaveLength(10);
  });
});
