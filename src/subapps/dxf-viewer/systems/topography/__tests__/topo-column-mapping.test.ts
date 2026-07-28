/**
 * ADR-650 Milestone 2 — column-mapping ground truth.
 *
 * The headline assertion is the N/E swap: `PNEZD` = id, **Northing(Y)**, **Easting(X)**, Z.
 * A mirrored survey still "looks like a site", so this is the test that must never go green
 * by accident.
 */

import { applyColumnMapping, hasPositionMapping, isMappingComplete, suggestMappingFromHeaders } from '../topo-column-mapping';
import { getOrderPresetMapping } from '../topo-order-presets';
import { readDelimitedText } from '../topo-delimited-reader';
import type { ColumnRole, RawTable } from '../topo-import-types';
import type { TopoPoint } from '../topo-types';

const table = (rows: string[][], headers: string[] = []): RawTable => ({ headers, rows });

/**
 * ΕΓΣΑ'87 coordinates in mm are ~4.2e9, where IEEE-754 doubles land a few hundred
 * nanometres off an exact integer (4201233.1 × 1000 = 4201233099.9999995). Assert to
 * micrometre tolerance — far below any survey instrument — instead of bit-exactness.
 */
function expectPoint(actual: TopoPoint | undefined, expected: { x: number; y: number; z: number; code?: string }): void {
  expect(actual).toBeDefined();
  expect(actual!.x).toBeCloseTo(expected.x, 3);
  expect(actual!.y).toBeCloseTo(expected.y, 3);
  expect(actual!.z).toBeCloseTo(expected.z, 3);
  expect(actual!.code).toBe(expected.code);
}

describe('applyColumnMapping — column orders', () => {
  // A single Greek-site point: Easting 384512.345, Northing 4201233.100, elevation 12.470
  it('PNEZD puts NORTHING in Y and EASTING in X (not X,Y order)', () => {
    const mapping = getOrderPresetMapping('PNEZD')!;
    const { points } = applyColumnMapping(table([['1', '4201233.100', '384512.345', '12.470', 'KERB']]), mapping);

    expectPoint(points[0], { x: 384512345, y: 4201233100, z: 12470, code: 'KERB' });
  });

  it('PENZD is the mirror order and yields the SAME point', () => {
    const mapping = getOrderPresetMapping('PENZD')!;
    const { points } = applyColumnMapping(table([['1', '384512.345', '4201233.100', '12.470', 'KERB']]), mapping);

    expectPoint(points[0], { x: 384512345, y: 4201233100, z: 12470, code: 'KERB' });
  });

  it('XYZ needs no id column', () => {
    const { points } = applyColumnMapping(table([['10', '20', '5']]), getOrderPresetMapping('XYZ')!);
    expectPoint(points[0], { x: 10000, y: 20000, z: 5000 });
  });
});

describe('applyColumnMapping — units and locale', () => {
  it('scales mm and feet to canonical mm', () => {
    const m = getOrderPresetMapping('XYZ')!;
    expectPoint(applyColumnMapping(table([['100', '200', '3']]), m, 'mm').points[0], { x: 100, y: 200, z: 3 });
    expectPoint(applyColumnMapping(table([['1', '2', '3']]), m, 'ft').points[0], { x: 304.8, y: 609.6, z: 914.4 });
  });

  it('parses Greek-locale decimals (comma) via the locale-number SSoT', () => {
    const { points } = applyColumnMapping(table([['384512,345', '4201233,100', '12,470']]), getOrderPresetMapping('XYZ')!);
    expectPoint(points[0], { x: 384512345, y: 4201233100, z: 12470 });
  });
});

describe('applyColumnMapping — resilience', () => {
  it('reports unparseable rows instead of throwing, and keeps the good ones', () => {
    const { points, skipped } = applyColumnMapping(
      table([['10', '20', '5'], ['ΣΥΝΟΛΟ', '', ''], ['11', '21', '6']]),
      getOrderPresetMapping('XYZ')!,
    );
    expect(points).toHaveLength(2);
    expect(skipped).toEqual([2]);
  });

  it('yields nothing when the POSITION is not mapped', () => {
    expect(hasPositionMapping(['x', 'ignore', 'z'])).toBe(false);
    expect(applyColumnMapping(table([['10', '20', '5']]), ['x', 'ignore', 'z']).points).toEqual([]);
  });
});

/**
 * ADR-720 — a survey point without an elevation is data, not an error.
 *
 * Measured 2026-07-28 on the survey that forced this: 7 of the 9 parcel corners were CSV points
 * matching the boundary polyline to 2–6 mm, and NOT ONE carried an elevation. The importer's
 * `z === null → return null` therefore deleted precisely the parcel and kept the neighbours'
 * spot heights — which is why the corners appeared to «fall outside the plot».
 */
describe('applyColumnMapping — points measured in plan only (ADR-720)', () => {
  const xyz = () => getOrderPresetMapping('XYZ')!;

  it('imports a row with an EMPTY elevation cell instead of skipping it', () => {
    const { points, skipped } = applyColumnMapping(
      table([['10', '20', '5'], ['11', '21', ''], ['12', '22', '7']]),
      xyz(),
    );
    expect(skipped).toEqual([]);
    expect(points).toHaveLength(3);
    expect(points[1]).toEqual({ x: 11000, y: 21000 });
  });

  it('omits the `z` KEY rather than storing `undefined` (one shape for "no elevation")', () => {
    const { points } = applyColumnMapping(table([['11', '21', '']]), xyz());
    expect(Object.prototype.hasOwnProperty.call(points[0]!, 'z')).toBe(false);
  });

  it('still refuses a row with no POSITION — an empty Z is not an empty X', () => {
    const { points, skipped } = applyColumnMapping(table([['', '21', '6']]), xyz());
    expect(points).toEqual([]);
    expect(skipped).toEqual([1]);
  });

  it('imports a file with NO elevation column at all (Civil 3D `<unused>` / LandXML 2D CgPoint)', () => {
    // The parcel-corner export a surveyor sends when you asked for the boundary: X and Y only.
    const mapping: ColumnRole[] = ['x', 'y'];
    expect(hasPositionMapping(mapping)).toBe(true);
    expect(isMappingComplete(mapping)).toBe(false); // the CLOUD road's stricter gate still says no

    const { points, skipped } = applyColumnMapping(table([['10', '20'], ['11', '21']]), mapping);
    expect(skipped).toEqual([]);
    expect(points).toEqual([{ x: 10000, y: 20000 }, { x: 11000, y: 21000 }]);
  });

  it('keeps the code and point number on a planimetric point (identity is not elevation)', () => {
    const { points } = applyColumnMapping(
      table([['52', '10', '20', '', 'CORNER']]),
      ['pointId', 'x', 'y', 'z', 'code'],
    );
    expect(points[0]).toEqual({ x: 10000, y: 20000, pointNumber: '52', code: 'CORNER' });
  });
});

describe('suggestMappingFromHeaders', () => {
  it('recognises English survey headers', () => {
    expect(suggestMappingFromHeaders(['Point', 'Northing', 'Easting', 'Elevation', 'Code']))
      .toEqual(['pointId', 'y', 'x', 'z', 'code']);
  });

  it('recognises Greek survey headers', () => {
    expect(suggestMappingFromHeaders(['Σημείο', 'Χ', 'Ψ', 'Υψόμετρο', 'Περιγραφή']))
      .toEqual(['pointId', 'x', 'y', 'z', 'code']);
  });

  it('leaves unknown columns unmapped rather than guessing wrong', () => {
    expect(suggestMappingFromHeaders(['foo', 'bar'])).toEqual(['ignore', 'ignore']);
  });
});

describe('reader + mapper end to end', () => {
  it('imports a headered, semicolon-separated PNEZD export', () => {
    const csv = 'Point;Northing;Easting;Elevation;Code\n1;4201233,100;384512,345;12,470;KERB\n2;4201240,000;384520,000;13,000;KERB';
    const parsed = readDelimitedText(csv);
    const mapping = suggestMappingFromHeaders(parsed.headers);
    const { points, skipped } = applyColumnMapping(parsed, mapping);

    expect(parsed.delimiter).toBe(';');
    expect(skipped).toEqual([]);
    expect(points).toHaveLength(2);
    expectPoint(points[0], { x: 384512345, y: 4201233100, z: 12470, code: 'KERB' });
  });
});
