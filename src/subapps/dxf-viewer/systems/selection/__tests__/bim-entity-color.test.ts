/**
 * Unit tests for bim-entity-color — "Select Similar (same colour)" extended to
 * BIM entities (ADR-445 structural colour identity).
 *
 * Verifies that each BIM category resolves to its identity hue, that the three
 * colour-distinct subcategories (wall interior, column shear-wall, opening
 * window vs door) split apart, that raw DXF returns null (caller falls back to
 * the layer cascade), and that V/G + per-element overrides win.
 */

import { resolveBimEntityColorHex } from '../bim-entity-color';
import { BIM_CATEGORY_LINE_COLORS } from '../../../config/bim-object-styles';
import type { Entity } from '../../../types/entities';
import type { BimCategory, ObjectStyle } from '../../../config/bim-object-styles';

// Minimal BIM entity factory — only the fields the colour resolver reads matter.
const bim = (type: string, extra: Record<string, unknown> = {}): Entity =>
  ({ id: `${type}-1`, type, ...extra } as unknown as Entity);

const lc = (hex: string) => hex.toLowerCase();

describe('resolveBimEntityColorHex — category identity', () => {
  it('resolves column to steel-blue', () => {
    expect(resolveBimEntityColorHex(bim('column', { kind: 'rectangular' })))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.column));
  });

  it('resolves beam to amber', () => {
    expect(resolveBimEntityColorHex(bim('beam')))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.beam));
  });

  it('resolves foundation to sienna', () => {
    expect(resolveBimEntityColorHex(bim('foundation')))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.foundation));
  });

  it('resolves railing to steel-grey', () => {
    expect(resolveBimEntityColorHex(bim('railing')))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.railing));
  });
});

describe('resolveBimEntityColorHex — colour-distinct subcategories', () => {
  it('splits interior vs exterior walls', () => {
    expect(resolveBimEntityColorHex(bim('wall', { params: { category: 'interior' } })))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.wallInterior));
    expect(resolveBimEntityColorHex(bim('wall', { params: { category: 'exterior' } })))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.wallExterior));
  });

  it('splits shear-wall columns from ordinary columns', () => {
    expect(resolveBimEntityColorHex(bim('column', { kind: 'shear-wall' })))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.shearWall));
    expect(resolveBimEntityColorHex(bim('column', { kind: 'rectangular' })))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.column));
  });

  it('splits window openings from door openings', () => {
    expect(resolveBimEntityColorHex(bim('opening', { kind: 'window' })))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.window));
    expect(resolveBimEntityColorHex(bim('opening', { kind: 'door' })))
      .toBe(lc(BIM_CATEGORY_LINE_COLORS.door));
  });
});

describe('resolveBimEntityColorHex — fallbacks & overrides', () => {
  it('returns null for raw DXF entities (caller uses the layer cascade)', () => {
    expect(resolveBimEntityColorHex(bim('line'))).toBeNull();
    expect(resolveBimEntityColorHex(bim('circle'))).toBeNull();
  });

  it('honours a V/G category colour override', () => {
    const objectStyles: Partial<Record<BimCategory, ObjectStyle>> = {
      column: { projectionPen: 5, cutPen: 9, projectionColor: '#123456' },
    };
    expect(resolveBimEntityColorHex(bim('column', { kind: 'rectangular' }), objectStyles))
      .toBe('#123456');
  });

  it('honours a per-element style override (wins over category)', () => {
    expect(
      resolveBimEntityColorHex(
        bim('beam', { styleOverride: { color: '#ABCDEF' } }),
      ),
    ).toBe('#abcdef');
  });
});
