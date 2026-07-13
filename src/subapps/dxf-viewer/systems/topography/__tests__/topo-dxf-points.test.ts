/**
 * ADR-650 Milestone 2 — DXF → survey points.
 *
 * The load-bearing assertion: the elevation comes from group code **30** (POINT) or from the
 * text LABEL (TEXT). The viewer's 2D scene has no Z at all, so if this ever silently reads
 * the scene instead of the file, every imported site becomes dead flat.
 */

import { extractTopoPointsFromDxf } from '../topo-dxf-points';

/** Minimal DXF: ENTITIES section only, metres ($INSUNITS = 6). */
function dxf(entities: string): string {
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', '6',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    entities,
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

const POINT = ['0', 'POINT', '8', 'SPOT', '10', '384512.345', '20', '4201233.100', '30', '12.470'].join('\n');
const POINT_NO_Z = ['0', 'POINT', '8', '0', '10', '1.0', '20', '2.0'].join('\n');
const TEXT = ['0', 'TEXT', '8', 'ELEV', '10', '100.0', '20', '200.0', '30', '0.0', '1', '12.47'].join('\n');
const TEXT_LABEL = ['0', 'TEXT', '8', 'NOTES', '10', '5.0', '20', '6.0', '1', 'ΟΙΚΟΠΕΔΟ'].join('\n');

describe('extractTopoPointsFromDxf — POINT', () => {
  it('reads the elevation from group code 30 and the feature code from the layer', () => {
    const { points, pointCount } = extractTopoPointsFromDxf(dxf(POINT));
    expect(pointCount).toBe(1);
    // ΕΓΣΑ'87 mm are ~4.2e9 → doubles land sub-micrometre off an exact integer. Assert to
    // micrometre tolerance (orders of magnitude below any instrument), not bit-exactness.
    expect(points[0]!.x).toBeCloseTo(384512345, 3);
    expect(points[0]!.y).toBeCloseTo(4201233100, 3);
    expect(points[0]!.z).toBeCloseTo(12470, 3);
    expect(points[0]!.code).toBe('SPOT');
  });

  it('skips a 2D POINT (no group 30) instead of placing it at z = 0', () => {
    const { points } = extractTopoPointsFromDxf(dxf(POINT_NO_Z));
    expect(points).toEqual([]);
  });
});

describe('extractTopoPointsFromDxf — TEXT', () => {
  it('takes the elevation from the LABEL, not from the text insertion Z', () => {
    const { points, textCount } = extractTopoPointsFromDxf(dxf(TEXT));
    expect(textCount).toBe(1);
    // Insertion Z is 0.0 — the label 12.47 is the measurement.
    expect(points[0]).toEqual({ x: 100000, y: 200000, z: 12470, code: 'ELEV' });
  });

  it('ignores annotation whose label is not a number', () => {
    expect(extractTopoPointsFromDxf(dxf(TEXT_LABEL)).points).toEqual([]);
  });
});

describe('extractTopoPointsFromDxf — source filter', () => {
  it('can harvest POINT only, TEXT only, or both', () => {
    const both = dxf([POINT, TEXT].join('\n'));
    expect(extractTopoPointsFromDxf(both, 'both').points).toHaveLength(2);
    expect(extractTopoPointsFromDxf(both, 'point').points).toHaveLength(1);
    expect(extractTopoPointsFromDxf(both, 'text').points).toHaveLength(1);
  });

  it('honours an explicit unit scale override (drawing already in mm)', () => {
    const { points } = extractTopoPointsFromDxf(dxf(POINT), 'point', 1);
    expect(points[0]).toMatchObject({ x: 384512.345, z: 12.47 });
  });
});
