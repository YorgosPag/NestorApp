/**
 * ADR-408 Φ12 — Plumbing manifold grip adapter (thin over the centred-box SSoT).
 * Pins the 6-grip emission (move + rotation + 4 corners) and that the move drag
 * translates `position`, mirroring the electrical-panel adapter.
 */

import { getMepManifoldGrips, applyMepManifoldGripDrag } from '../mep-manifold-grips';
import { buildMepManifoldEntity, buildDefaultMepManifoldParams } from '../../../hooks/drawing/mep-manifold-completion';
import type { MepManifoldEntity } from '../../types/mep-manifold-types';

function manifold(): MepManifoldEntity {
  const res = buildMepManifoldEntity(buildDefaultMepManifoldParams({ x: 100, y: 100 }), '0');
  if (!res.ok) throw new Error('invalid');
  return res.entity;
}

describe('getMepManifoldGrips', () => {
  it('emits 6 grips (move, rotation, 4 corners) with manifold grip kinds', () => {
    const grips = getMepManifoldGrips(manifold());
    expect(grips).toHaveLength(6);
    expect(grips[0].mepManifoldGripKind).toBe('mep-manifold-move');
    expect(grips[1].mepManifoldGripKind).toBe('mep-manifold-rotation');
    expect(grips.slice(2).map((g) => g.mepManifoldGripKind)).toEqual([
      'mep-manifold-corner-ne',
      'mep-manifold-corner-nw',
      'mep-manifold-corner-sw',
      'mep-manifold-corner-se',
    ]);
  });

  it('move grip sits on the centre (position)', () => {
    const grips = getMepManifoldGrips(manifold());
    expect(grips[0].position.x).toBeCloseTo(100, 6);
    expect(grips[0].position.y).toBeCloseTo(100, 6);
  });
});

describe('applyMepManifoldGripDrag', () => {
  it('move translates position by the delta', () => {
    const p = manifold().params;
    const next = applyMepManifoldGripDrag('mep-manifold-move', { originalParams: p, delta: { x: 50, y: -20 } });
    expect(next.position.x).toBeCloseTo(p.position.x + 50, 6);
    expect(next.position.y).toBeCloseTo(p.position.y - 20, 6);
  });

  it('zero delta returns the original params reference (commit short-circuit)', () => {
    const p = manifold().params;
    expect(applyMepManifoldGripDrag('mep-manifold-move', { originalParams: p, delta: { x: 0, y: 0 } })).toBe(p);
  });
});
