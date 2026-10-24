/**
 * ADR-920 Β4.1β — the lib DXF survey scanner: what it adds over the viewer road it replaced.
 * The viewer's behaviour (units policy, BLOCKS, embedded objects, POLYLINE groups, CRLF…) is pinned by
 * `dxf-viewer/systems/topography/__tests__/topo-dxf-points.test.ts`, which now runs through this scanner.
 */

import { INSUNITS_TO_MM, readDxfInsunits } from '@/lib/dxf/dxf-insunits';
import { splitDxfLines } from '@/lib/dxf/dxf-line-stream';

import { scaleSurveyPoints, scanDxfSurvey } from '../dxf-survey-points';

const entities = (body: string): string => ['0', 'SECTION', '2', 'ENTITIES', body, '0', 'ENDSEC', '0', 'EOF'].join('\n');
const header = (insunits: string): string =>
  ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1032', '9', '$INSUNITS', '70', insunits, '0', 'ENDSEC'].join('\n');

describe('scanDxfSurvey — DXF reals', () => {
  it('reads an exponent written by ezdxf-style writers as the real number (1.5E+02 = 150, never 1.502)', () => {
    const point = ['0', 'POINT', '8', 'SPOT', '10', '3.845123E+05', '20', '4.2012331E+06', '30', '1.5E+02'].join('\n');
    expect(scanDxfSurvey(entities(point)).points).toEqual([{ x: 384512.3, y: 4201233.1, z: 150, code: 'SPOT' }]);
  });

  it('keeps a hand-edited comma decimal readable (the locale fallback)', () => {
    const point = ['0', 'POINT', '8', '0', '10', '384512,345', '20', '2', '30', '12,5'].join('\n');
    expect(scanDxfSurvey(entities(point)).points).toEqual([{ x: 384512.345, y: 2, z: 12.5 }]);
  });

  it('returns points in DRAWING units — scaling is the caller’s decision', () => {
    const point = ['0', 'POINT', '8', '0', '10', '1', '20', '2', '30', '3'].join('\n');
    const scan = scanDxfSurvey([header('6'), entities(point)].join('\n'));
    expect(scan.points).toEqual([{ x: 1, y: 2, z: 3 }]);
    expect(scan.declaredInsunits).toBe(6);
  });
});

describe('readDxfInsunits — what the file DECLARES', () => {
  it.each([
    ['6', 6],
    ['0', 0], // «unitless» is a value, never «absent»
    ['xx', null],
  ])('$INSUNITS %s → %p', (value, expected) => {
    expect(readDxfInsunits(splitDxfLines(header(value)))).toBe(expected);
  });

  it('a file without a HEADER declares nothing', () => {
    expect(readDxfInsunits(splitDxfLines(entities('')))).toBeNull();
  });

  it('a HEADER without $INSUNITS declares nothing', () => {
    const noUnits = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1032', '0', 'ENDSEC'].join('\n');
    expect(readDxfInsunits(splitDxfLines(noUnits))).toBeNull();
  });
});

describe('INSUNITS_TO_MM — the corrected codes (ADR-920 §13.2)', () => {
  it('17 is Gigameters, not the «nautical mile» it used to claim', () => {
    expect(INSUNITS_TO_MM[17]).toBe(1e12);
  });

  it('21–24 are the US survey units (1 survey foot = 1200/3937 m), not «1 mm per unit»', () => {
    expect(INSUNITS_TO_MM[21]).toBeCloseTo(304.8006096, 7);
    expect(INSUNITS_TO_MM[22]).toBeCloseTo(25.4000508, 7);
    expect(INSUNITS_TO_MM[23]).toBeCloseTo(914.4018288, 7);
    expect(INSUNITS_TO_MM[24]).toBeCloseTo(1609347.2187, 3);
  });
});

describe('scaleSurveyPoints', () => {
  it('scales x/y/z and never invents a z for a planimetric point', () => {
    expect(scaleSurveyPoints([{ x: 1, y: 2, z: 3, code: 'A' }, { x: 4, y: 5 }], 1000)).toEqual([
      { x: 1000, y: 2000, z: 3000, code: 'A' },
      { x: 4000, y: 5000 },
    ]);
    expect('z' in scaleSurveyPoints([{ x: 1, y: 1 }], 10)[0]!).toBe(false);
  });
});
