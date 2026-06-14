/**
 * ADR-457 — detail-sheet-dim unit tests.
 *
 * Verifies the linear-dimension resolver produces the expected extension
 * lines, dimension line, two arrowheads and a rotation-corrected text anchor.
 */

import { resolveDimGeometry } from '../detail-sheet-dim';
import type { DimPrimitive } from '../detail-sheet-types';

const stroke = { colorHex: '#333', widthMm: 0.13 };

describe('resolveDimGeometry (ADR-457)', () => {
  it('resolves a horizontal dimension below the measured edge', () => {
    const dim: DimPrimitive = {
      kind: 'dim', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 },
      offsetMm: 8, text: '100', stroke,
    };
    const geo = resolveDimGeometry(dim);

    expect(geo.dimensionLine[0]).toEqual({ x: 0, y: 8 });
    expect(geo.dimensionLine[1]).toEqual({ x: 100, y: 8 });
    expect(geo.extensionLines).toHaveLength(2);
    expect(geo.arrowheads).toHaveLength(2);
    for (const tri of geo.arrowheads) expect(tri).toHaveLength(3);
    // Text sits on the offset side (below) and is horizontal.
    expect(geo.textPosition.y).toBeGreaterThan(8);
    expect(geo.textAngleRad).toBeCloseTo(0, 6);
    expect(geo.text).toBe('100');
  });

  it('places the dimension line on the negative side for a negative offset', () => {
    const dim: DimPrimitive = {
      kind: 'dim', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 },
      offsetMm: -5, text: '100', stroke,
    };
    const geo = resolveDimGeometry(dim);
    expect(geo.dimensionLine[0].y).toBeCloseTo(-5, 6);
    expect(geo.textPosition.y).toBeLessThan(-5);
  });

  it('keeps vertical-dimension text upright (no upside-down)', () => {
    const dim: DimPrimitive = {
      kind: 'dim', p1: { x: 0, y: 100 }, p2: { x: 0, y: 0 },
      offsetMm: 6, text: '400', stroke,
    };
    const geo = resolveDimGeometry(dim);
    // Axis points upward (−y) → angle would be −π/2; corrected to +π/2.
    expect(Math.abs(geo.textAngleRad)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('honours an explicit text height', () => {
    const dim: DimPrimitive = {
      kind: 'dim', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 },
      offsetMm: 4, text: '50', stroke, textHeightMm: 3.5,
    };
    expect(resolveDimGeometry(dim).textHeightMm).toBe(3.5);
  });
});
