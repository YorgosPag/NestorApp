/**
 * ADR-650 Milestone 2 — DXF → survey points.
 *
 * The load-bearing assertion: the elevation comes from group code **30** (POINT) or from the
 * text LABEL (TEXT). The viewer's 2D scene has no Z at all, so if this ever silently reads
 * the scene instead of the file, every imported site becomes dead flat.
 */

import { readDxfInsunits } from '@/lib/dxf/dxf-insunits';
import { splitDxfLines } from '@/lib/dxf/dxf-line-stream';

import { DxfEntityParser } from '../../../utils/dxf-entity-parser';
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

/**
 * ADR-920 Β4.1β — CHARACTERISATION, pinned against the pre-lib extractor (`DxfEntityParser`) BEFORE the body moved to
 * `@/lib/terrain/survey-import/dxf-survey-points`. Every case here passed on the old code; the move must keep them green.
 */
describe('extractTopoPointsFromDxf — behaviour the lib scanner must preserve', () => {
  const POINT_M = ['0', 'POINT', '8', 'SPOT', '10', '1.5', '20', '2.5', '30', '3.5'].join('\n');
  const entitiesOnly = (entities: string): string =>
    ['0', 'SECTION', '2', 'ENTITIES', entities, '0', 'ENDSEC', '0', 'EOF'].join('\n');
  const withInsunits = (value: string): string =>
    ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', value, '0', 'ENDSEC', entitiesOnly(POINT_M)].join('\n');

  it('a header WITHOUT $INSUNITS reads as millimetres (the parser default 4), not metres', () => {
    expect(extractTopoPointsFromDxf(entitiesOnly(POINT_M)).points[0]).toMatchObject({ x: 1.5, y: 2.5, z: 3.5 });
  });

  it('an explicit unitless $INSUNITS 0 falls back to metres', () => {
    expect(extractTopoPointsFromDxf(withInsunits('0')).points[0]).toMatchObject({ x: 1500, y: 2500, z: 3500 });
  });

  it('an unparseable $INSUNITS behaves like an absent one (millimetres)', () => {
    expect(extractTopoPointsFromDxf(withInsunits('xx')).points[0]).toMatchObject({ x: 1.5 });
  });

  it('declared feet scale by 304.8', () => {
    expect(extractTopoPointsFromDxf(withInsunits('2')).points[0]!.x).toBeCloseTo(457.2, 9);
  });

  it('ignores points inside BLOCK definitions when an ENTITIES section exists', () => {
    const blocks = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', 'B1', POINT_M, '0', 'ENDBLK', '0', 'ENDSEC'].join('\n');
    const file = [blocks, entitiesOnly(['0', 'POINT', '8', '0', '10', '9', '20', '8', '30', '7'].join('\n'))].join('\n');
    const { points, pointCount } = extractTopoPointsFromDxf(file);
    expect(pointCount).toBe(1);
    expect(points).toEqual([{ x: 9, y: 8, z: 7 }]);
  });

  it('scans the whole stream when the file has no ENTITIES section', () => {
    expect(extractTopoPointsFromDxf([POINT_M, '0', 'EOF'].join('\n')).points).toHaveLength(1);
  });

  it('stops reading an entity at its embedded object (group 101)', () => {
    const embedded = ['0', 'POINT', '8', 'SPOT', '10', '1', '20', '2', '101', 'Embedded Object', '30', '5'].join('\n');
    expect(extractTopoPointsFromDxf(entitiesOnly(embedded)).points).toEqual([]);
  });

  it('keeps the LAST value of a repeated group code', () => {
    const repeated = ['0', 'POINT', '8', 'A', '8', 'B', '10', '1', '20', '2', '30', '3', '30', '4'].join('\n');
    expect(extractTopoPointsFromDxf(entitiesOnly(repeated)).points).toEqual([{ x: 1, y: 2, z: 4, code: 'B' }]);
  });

  it('walks past an old-style POLYLINE group and still reads the POINT after it', () => {
    const polyline = ['0', 'POLYLINE', '8', 'P', '0', 'VERTEX', '10', '1', '20', '1', '30', '1', '0', 'SEQEND'].join('\n');
    expect(extractTopoPointsFromDxf(entitiesOnly([polyline, POINT_M].join('\n'))).points).toHaveLength(1);
  });

  it('reads a CRLF file exactly like an LF one', () => {
    const crlf = entitiesOnly(POINT_M).replace(/\n/g, '\r\n');
    expect(extractTopoPointsFromDxf(crlf)).toEqual(extractTopoPointsFromDxf(entitiesOnly(POINT_M)));
  });

  it('the lib `$INSUNITS` reader agrees with the importer’s `parseHeader` (two readers, ONE answer)', () => {
    for (const value of ['6', '0', '2', '21', 'xx']) {
      const lines = splitDxfLines(withInsunits(value));
      expect(readDxfInsunits(lines) ?? 4).toBe(DxfEntityParser.parseHeader(lines).insunits);
    }
    const noHeader = splitDxfLines(entitiesOnly(POINT_M));
    expect(readDxfInsunits(noHeader) ?? 4).toBe(DxfEntityParser.parseHeader(noHeader).insunits);
  });

  it('reads a Greek-comma TEXT label as an elevation and drops an empty layer to «no code»', () => {
    const label = ['0', 'TEXT', '8', '', '10', '1', '20', '2', '1', '12,47'].join('\n');
    expect(extractTopoPointsFromDxf(entitiesOnly(label)).points).toEqual([{ x: 1, y: 2, z: 12.47 }]);
  });
});
