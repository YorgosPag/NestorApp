/**
 * ADR-650 Milestone 2 — column-mapping ground truth.
 *
 * The headline assertion is the N/E swap: `PNEZD` = id, **Northing(Y)**, **Easting(X)**, Z.
 * A mirrored survey still "looks like a site", so this is the test that must never go green
 * by accident.
 */

import { applyColumnMapping, isMappingComplete, suggestMappingFromHeaders } from '../topo-column-mapping';
import { getOrderPresetMapping } from '../topo-order-presets';
import { readDelimitedText } from '../topo-delimited-reader';
import type { RawTable } from '../topo-import-types';
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

  it('yields nothing when X/Y/Z are not all mapped (mapping is incomplete)', () => {
    expect(isMappingComplete(['x', 'y', 'ignore'])).toBe(false);
    expect(applyColumnMapping(table([['10', '20', '5']]), ['x', 'y', 'ignore']).points).toEqual([]);
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
