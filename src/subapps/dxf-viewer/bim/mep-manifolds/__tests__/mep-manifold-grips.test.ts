/**
 * ADR-408 Φ12 — Plumbing manifold grip adapter (thin over the centred-box SSoT).
 * Pins the 5-grip emission (rotation + 4 corners) and that the move drag
 * translates `position`, mirroring the electrical-panel adapter.
 * ADR-363 Φ1G.5 Slice 2: move grip no longer emitted by getCentredBoxGrips.
 */

import { getMepManifoldGrips, applyMepManifoldGripDrag } from '../mep-manifold-grips';
import { buildMepManifoldEntity, buildDefaultMepManifoldParams } from '../../../hooks/drawing/mep-manifold-completion';
import type { MepManifoldEntity } from '../../types/mep-manifold-types';
import {
  MIN_MANIFOLD_OUTLET_COUNT,
  MAX_MANIFOLD_OUTLET_COUNT,
} from '../../types/mep-manifold-types';

function manifold(): MepManifoldEntity {
  const res = buildMepManifoldEntity(buildDefaultMepManifoldParams({ x: 100, y: 100 }), '0');
  if (!res.ok) throw new Error('invalid');
  return res.entity;
}

/** A manifold with an explicit `outletCount` (for clamp-bound action-grip tests). */
function manifoldWith(outletCount: number): MepManifoldEntity {
  const params = { ...buildDefaultMepManifoldParams({ x: 100, y: 100 }), outletCount };
  const res = buildMepManifoldEntity(params, '0');
  if (!res.ok) throw new Error('invalid');
  return res.entity;
}

describe('getMepManifoldGrips', () => {
  // ADR-363 Φ1G.5 Slice 2: move grip removed → 5 box grips (rotation + 4 corners).
  it('emits the 5 centred-box grips (rotation, 4 corners) first', () => {
    const grips = getMepManifoldGrips(manifold());
    // Array index 0 is now rotation (gripIndex 1 — unchanged field value).
    expect(grips[0].mepManifoldGripKind).toBe('mep-manifold-rotation');
    expect(grips.slice(1, 5).map((g) => g.mepManifoldGripKind)).toEqual([
      'mep-manifold-corner-ne',
      'mep-manifold-corner-nw',
      'mep-manifold-corner-sw',
      'mep-manifold-corner-se',
    ]);
  });
});

describe('getMepManifoldGrips — outlet action grips (Revit array control ▲/▼)', () => {
  it('emits both add (▲) and remove (▼) action grips at a mid count', () => {
    // ADR-363 Φ1G.5 Slice 2: move grip removed → 5 box grips + 2 action grips = 7 total.
    const grips = getMepManifoldGrips(manifold());
    expect(grips).toHaveLength(7);
    const kinds = grips.map((g) => g.mepManifoldGripKind);
    expect(kinds).not.toContain('mep-manifold-move');
    expect(kinds).toContain('mep-manifold-outlet-add');
    expect(kinds).toContain('mep-manifold-outlet-remove');
    const add = grips.find((g) => g.mepManifoldGripKind === 'mep-manifold-outlet-add')!;
    const remove = grips.find((g) => g.mepManifoldGripKind === 'mep-manifold-outlet-remove')!;
    // gripIndex field values are unchanged (action grips still assigned indices 6 & 7).
    expect(add.gripIndex).toBe(6);
    expect(remove.gripIndex).toBe(7);
    expect(add.movesEntity).toBe(false);
    expect(remove.movesEntity).toBe(false);
  });

  it('action grips sit beyond the +X (width) short end of the bar (no rotation)', () => {
    const grips = getMepManifoldGrips(manifold());
    const add = grips.find((g) => g.mepManifoldGripKind === 'mep-manifold-outlet-add')!;
    const remove = grips.find((g) => g.mepManifoldGripKind === 'mep-manifold-outlet-remove')!;
    // Both stand off to +X of the centre (x = 100); add above, remove below.
    expect(add.position.x).toBeGreaterThan(100);
    expect(remove.position.x).toBeGreaterThan(100);
    expect(add.position.y).toBeGreaterThan(remove.position.y);
  });

  it('hides the ▲ add grip at MAX outlet count (no no-op click)', () => {
    const grips = getMepManifoldGrips(manifoldWith(MAX_MANIFOLD_OUTLET_COUNT));
    const kinds = grips.map((g) => g.mepManifoldGripKind);
    expect(kinds).not.toContain('mep-manifold-outlet-add');
    expect(kinds).toContain('mep-manifold-outlet-remove');
  });

  it('hides the ▼ remove grip at MIN outlet count (no no-op click)', () => {
    const grips = getMepManifoldGrips(manifoldWith(MIN_MANIFOLD_OUTLET_COUNT));
    const kinds = grips.map((g) => g.mepManifoldGripKind);
    expect(kinds).toContain('mep-manifold-outlet-add');
    expect(kinds).not.toContain('mep-manifold-outlet-remove');
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
