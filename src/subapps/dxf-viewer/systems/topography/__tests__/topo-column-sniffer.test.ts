/**
 * ADR-650 M8β/Δ — the column sniffer.
 *
 * The bug it exists to kill: a PENZD/PNEZD file (point number FIRST — the Greek/Civil 3D default)
 * read as «the first three numeric fields» yields X = the point id. Silent, plausible, wrong site.
 */

import { proposeColumnMapping } from '@/lib/terrain/survey-import/topo-mapping-edit';
import { sniffMappingFromRows, suggestMappingFromRows } from '../topo-column-sniffer';
import { sampleTopoRows } from '../topo-text-lines';

/** id, Easting(X), Northing(Y), Z, code — the file that used to be read as X=id. */
const PENZD = `1 345678.123 4201234.456 125.30 EDGE
2 345679.500 4201235.000 125.45 EDGE
3 345680.000 4201236.100 125.60 KERB
4 345681.250 4201237.900 126.05 KERB`;

/** id, Northing(Y), Easting(X), Z, code — N BEFORE E (the 45°-mirror trap). */
const PNEZD = `1 4201234.456 345678.123 125.30 EDGE
2 4201235.000 345679.500 125.45 EDGE
3 4201236.100 345680.000 125.60 KERB
4 4201237.900 345681.250 126.05 KERB`;

const rowsOf = (text: string) => sampleTopoRows(text, 50);

describe('suggestMappingFromRows — id-first survey formats', () => {
  it('reads PENZD as pointId, X, Y, Z, code', () => {
    expect(suggestMappingFromRows(rowsOf(PENZD))).toEqual(['pointId', 'x', 'y', 'z', 'code']);
  });

  it('reads PNEZD as pointId, Y, X, Z, code (Northing is Y — never swapped)', () => {
    expect(suggestMappingFromRows(rowsOf(PNEZD))).toEqual(['pointId', 'y', 'x', 'z', 'code']);
  });

  it('handles a Greek-locale export (semicolon delimiter + decimal commas)', () => {
    const text = `1;345678,123;4201234,456;125,30;EDGE
2;345679,500;4201235,000;125,45;EDGE
3;345680,000;4201236,100;125,60;KERB`;
    // The delimiter must be declared, exactly as the wizard declares it (`detectDelimiter`):
    // split leniently, a decimal comma would tear each value into two fields.
    expect(sampleTopoRows(text, 50, ';').map((r) => r.length)).toEqual([5, 5, 5]);
    expect(suggestMappingFromRows(sampleTopoRows(text, 50, ';')))
      .toEqual(['pointId', 'x', 'y', 'z', 'code']);
  });
});

describe('suggestMappingFromRows — plain scanner dumps (no regression)', () => {
  it('leaves a bare x y z dump as x, y, z', () => {
    const text = `345678.123 4201234.456 125.30
345679.500 4201235.000 125.45
345680.000 4201236.100 125.60`;
    expect(suggestMappingFromRows(rowsOf(text))).toEqual(['x', 'y', 'z']);
  });

  it('never steals X for a pointId when only three columns exist, even if they are sorted integers', () => {
    const text = `1 2 3
2 3 4
3 4 5`;
    expect(suggestMappingFromRows(rowsOf(text))).toEqual(['x', 'y', 'z']);
  });

  it('keeps file order for a LOCAL dump where no column stands out as an elevation', () => {
    const text = `1.20 3.40 0.50
2.10 3.90 0.55
2.80 4.10 0.62`;
    expect(suggestMappingFromRows(rowsOf(text))).toEqual(['x', 'y', 'z']);
  });

  it('ignores trailing intensity / RGB columns', () => {
    const text = `345678.123 4201234.456 125.30 812 120 130 118
345679.500 4201235.000 125.45 790 122 131 119
345680.000 4201236.100 125.60 801 124 133 121`;
    expect(suggestMappingFromRows(rowsOf(text)))
      .toEqual(['x', 'y', 'z', 'ignore', 'ignore', 'ignore', 'ignore']);
  });
});

describe('suggestMappingFromRows — no proposal', () => {
  it('proposes nothing when the file has fewer than three columns', () => {
    expect(suggestMappingFromRows(rowsOf('345678.123 4201234.456\n345679.5 4201235.0'))).toBeNull();
  });

  it('proposes nothing when fewer than three columns are numeric', () => {
    expect(suggestMappingFromRows(rowsOf('A B C\nD E F'))).toBeNull();
  });

  it('proposes nothing for an empty sample', () => {
    expect(suggestMappingFromRows([])).toBeNull();
  });
});

/**
 * ADR-920 §13.10 Α — the live file (`topo-test-ridge-dense.txt`): `x y z`, no header, X 0..12 · Y 0..60, Z a sawtooth
 * of X (0,1,2,3,2,1,0,…). Its first 61 rows have X = 0 and Z = 0, and the old sniffer read «Z · Y · X».
 */
const SAW = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0];
function sawtoothRows(order: (x: number, y: number, z: number) => number[]): string[][] {
  const rows: string[][] = [];
  SAW.forEach((z, x) => {
    for (let y = 0; y <= 60; y++) rows.push(order(x, y, z).map(String));
  });
  return rows;
}

describe('ADR-920 §13.10 Α — a constant head, and the surface signal', () => {
  it('reads the whole sawtooth as x, y, z — from the SURFACE (one candidate keeps z(x, y) consistent)', () => {
    const table = { headers: [], rows: sawtoothRows((x, y, z) => [x, y, z]) };
    expect(proposeColumnMapping(table)).toEqual({ mapping: ['x', 'y', 'z'], basis: 'surface' });
  });

  it('reads its first 50 rows (X and Z constant) as x, y, z — a constant column judges no magnitude', () => {
    const head = sawtoothRows((x, y, z) => [x, y, z]).slice(0, 50);
    expect(sniffMappingFromRows(head)).toEqual({ mapping: ['x', 'y', 'z'], basis: 'file-order' });
  });

  it('finds the elevation FIRST in a `z x y` file, where magnitude cannot tell', () => {
    const table = { headers: [], rows: sawtoothRows((x, y, z) => [z, x, y]) };
    expect(proposeColumnMapping(table)).toEqual({ mapping: ['z', 'x', 'y'], basis: 'surface' });
  });

  it('keeps the magnitude basis for a projected survey (the surface is consistent in every order)', () => {
    expect(sniffMappingFromRows(rowsOf(PENZD))?.basis).toBe('magnitude');
  });
});
