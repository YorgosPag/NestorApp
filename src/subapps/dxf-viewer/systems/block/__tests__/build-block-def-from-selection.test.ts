/**
 * ADR-652 M6 — buildBlockDefFromSelection (pure world-selection → InSessionBlockDef).
 *
 * Επιβεβαιώνει το κρίσιμο invariant: base = AABB min-corner, members baked → origin (byte-συμβατά
 * με το import path), boundsMm σε canonical mm, όνομα διατηρείται. Ίδιο μοντέλο με createBlockInstance.
 */

import { buildBlockDefFromSelection } from '../build-block-def-from-selection';
import type { Entity } from '../../../types/entities';

const mkLine = (id: string, x: number, y: number): Entity =>
  ({
    id,
    type: 'line',
    layerId: 'lyr_test',
    visible: true,
    start: { x, y },
    end: { x: x + 1, y: y + 1 },
  }) as unknown as Entity;

describe('ADR-652 M6 — buildBlockDefFromSelection', () => {
  it('returns null for an empty selection', () => {
    expect(buildBlockDefFromSelection([], 'Empty')).toBeNull();
  });

  it('base = AABB min-corner of the world selection', () => {
    const built = buildBlockDefFromSelection([mkLine('l1', 10, 5), mkLine('l2', 20, 5)], 'Sofa');
    expect(built).not.toBeNull();
    // min corner across both lines: x=10, y=5
    expect(built!.base).toEqual({ x: 10, y: 5 });
  });

  it('bakes members to BLOCK-LOCAL space (min corner at origin)', () => {
    const built = buildBlockDefFromSelection([mkLine('l1', 10, 5), mkLine('l2', 20, 5)], 'Sofa');
    expect(built).not.toBeNull();
    // boundsMm is computed on the baked members → min must sit on the origin.
    expect(built!.def.boundsMm.minX).toBeCloseTo(0);
    expect(built!.def.boundsMm.minY).toBeCloseTo(0);
    // width spanned 10..21 → 11; height 5..6 → 1.
    expect(built!.def.boundsMm.maxX).toBeCloseTo(11);
    expect(built!.def.boundsMm.maxY).toBeCloseTo(1);
  });

  it('preserves the name and regenerates member ids (def is a template, not an alias)', () => {
    const built = buildBlockDefFromSelection([mkLine('l1', 10, 5)], 'Chair');
    expect(built!.def.name).toBe('Chair');
    expect(built!.def.localMembers).toHaveLength(1);
    // id regenerated → must NOT alias the live scene entity id.
    expect(built!.def.localMembers[0].id).not.toBe('l1');
  });

  it('at-origin selection is a no-op bake (base {0,0})', () => {
    const built = buildBlockDefFromSelection([mkLine('l1', 0, 0)], 'Origin');
    expect(built!.base).toEqual({ x: 0, y: 0 });
    expect(built!.def.boundsMm.minX).toBeCloseTo(0);
    expect(built!.def.boundsMm.minY).toBeCloseTo(0);
  });
});
