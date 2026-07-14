/**
 * ADR-650 M8α — BULK ASCII XYZ reader tests.
 *
 * The fixtures are deliberately the ugly kind of file a surveyor actually drops: a header line,
 * `#` comments, mixed delimiters, a junk trailer, an extra feature-code column. Everything is
 * analytic — metre inputs with 3 decimals become exact millimetre integers.
 */

import { readAsciiXyzPointCloud } from '../ascii-xyz-reader';
import { POINTCLOUD_MSG } from '../pointcloud-read';
import type { PointCloudReadOptions, PointCloudReadResult } from '../pointcloud-types';
import type { ColumnMapping } from '../../topo-import-types';

const OPTS: PointCloudReadOptions = { unit: 'm', maxPointsInMemory: 1_000_000 };

/** Three ΕΓΣΑ'87-scale points, in metres. The third is the planimetric min corner. */
const P1 = { x: 384_512.345, y: 4_201_234.567, z: 12.5 };
const P2 = { x: 384_520.0, y: 4_201_240.0, z: 15.25 };
const P3 = { x: 384_500.0, y: 4_201_230.0, z: 10.0 };

const MM = 1000;

describe('readAsciiXyzPointCloud — parsing', () => {
  it('reads a plain whitespace-delimited cloud into LOCAL x/y + WORLD z', () => {
    const text = [
      `${P1.x} ${P1.y} ${P1.z}`,
      `${P2.x} ${P2.y} ${P2.z}`,
      `${P3.x} ${P3.y} ${P3.z}`,
    ].join('\n');

    const { data, format, stats, warnings } = readAsciiXyzPointCloud(text, OPTS);

    expect(format).toBe('ascii-xyz');
    expect(warnings).toEqual([]);
    expect(data.count).toBe(3);
    expect(stats.totalPoints).toBe(3);

    // Origin = floored min corner → LOCAL + origin === WORLD (the SSoT convention).
    expect(data.origin.x).toBe(Math.floor(P3.x * MM));
    expect(data.origin.y).toBe(Math.floor(P3.y * MM));
    expect(data.x[0] + data.origin.x).toBeCloseTo(P1.x * MM, 1);
    expect(data.y[0] + data.origin.y).toBeCloseTo(P1.y * MM, 1);
    expect(data.z[0]).toBeCloseTo(P1.z * MM, 1);
    expect(data.x[2]).toBeCloseTo(0, 1); // the min-corner point sits at LOCAL zero
  });

  it('accepts comma, semicolon, tab and mixed delimiters (as the zero-config parser does)', () => {
    const text = [
      `${P1.x},${P1.y},${P1.z}`,
      `${P2.x};${P2.y};${P2.z}`,
      `${P3.x}\t${P3.y} \t ${P3.z}`,
    ].join('\r\n'); // CRLF too

    const { data } = readAsciiXyzPointCloud(text, OPTS);

    expect(data.count).toBe(3);
    expect(data.z[1]).toBeCloseTo(P2.z * MM, 1);
  });

  it('skips a header line and #/// comments without counting them as errors', () => {
    const text = [
      '# exported by TotalStation 9000',
      '// units: metres',
      'Easting Northing Elevation',
      '',
      `${P1.x} ${P1.y} ${P1.z}`,
      `${P2.x} ${P2.y} ${P2.z}`,
    ].join('\n');

    const { data, warnings } = readAsciiXyzPointCloud(text, OPTS);

    expect(data.count).toBe(2);
    expect(warnings).toEqual([]);
  });

  it('ignores extra columns — X Y Z are the first three numeric fields', () => {
    const text = `${P1.x} ${P1.y} ${P1.z} TREE 128\n${P2.x} ${P2.y} ${P2.z} EDGE 64`;

    const { data } = readAsciiXyzPointCloud(text, OPTS);

    expect(data.count).toBe(2);
    expect(data.z[0]).toBeCloseTo(P1.z * MM, 1);
    expect(data.z[1]).toBeCloseTo(P2.z * MM, 1);
  });

  it('skips unparseable lines after the first point and warns once', () => {
    const text = [
      `${P1.x} ${P1.y} ${P1.z}`,
      'TOTAL POINTS: 2',
      `${P2.x} ${P2.y} ${P2.z}`,
      'END OF FILE',
    ].join('\n');

    const { data, warnings } = readAsciiXyzPointCloud(text, OPTS);

    expect(data.count).toBe(2);
    expect(warnings).toEqual([POINTCLOUD_MSG.WARN_SKIPPED_LINES]);
  });

  it('carries no classification — ASCII XYZ has none to carry', () => {
    const { data, stats } = readAsciiXyzPointCloud(`${P1.x} ${P1.y} ${P1.z}`, OPTS);

    expect(data.classification).toBeNull();
    expect(stats.hasSourceClassification).toBe(false);
    expect(stats.classHistogram).toBeNull();
  });
});

// ─── ADR-650 M8β/Δ — the declared column mapping ────────────────────────────────

/** id, Easting(X), Northing(Y), Z, code — the id-first export that used to be read as X=id. */
const PENZD = [
  `1 ${P1.x} ${P1.y} ${P1.z} EDGE`,
  `2 ${P2.x} ${P2.y} ${P2.z} EDGE`,
  `3 ${P3.x} ${P3.y} ${P3.z} KERB`,
].join('\n');

const PENZD_MAPPING: ColumnMapping = ['pointId', 'x', 'y', 'z', 'code'];

/** WORLD mm of stored point `i` (x/y are LOCAL in the buffer, z is already WORLD). */
function worldOf(result: PointCloudReadResult, i: number) {
  const { data } = result;
  return { x: data.x[i] + data.origin.x, y: data.y[i] + data.origin.y, z: data.z[i] };
}

describe('readAsciiXyzPointCloud — declared column mapping (M8β/Δ)', () => {
  it('reads a PENZD cloud as a survey — the leading point number is an id, not an X', () => {
    const result = readAsciiXyzPointCloud(PENZD, { ...OPTS, mapping: PENZD_MAPPING });

    expect(result.data.count).toBe(3);
    const first = worldOf(result, 0);
    expect(first.x).toBeCloseTo(P1.x * MM, 1);
    expect(first.y).toBeCloseTo(P1.y * MM, 1);
    expect(first.z).toBeCloseTo(P1.z * MM, 1);
  });

  it('keeps the mapped cloud inside a site-sized extent (no kilometre-tall monster)', () => {
    const { stats } = readAsciiXyzPointCloud(PENZD, { ...OPTS, mapping: PENZD_MAPPING });

    expect(stats.boundsWorldMm.maxZ - stats.boundsWorldMm.minZ).toBeLessThan(10_000); // 5.25 m of relief
  });

  it('honours N=Northing=Y in a PNEZD cloud (never mirrored about the 45° line)', () => {
    const text = `1 ${P1.y} ${P1.x} ${P1.z} EDGE\n2 ${P2.y} ${P2.x} ${P2.z} EDGE`;

    const result = readAsciiXyzPointCloud(text, { ...OPTS, mapping: ['pointId', 'y', 'x', 'z', 'code'] });

    expect(worldOf(result, 0).x).toBeCloseTo(P1.x * MM, 1);
    expect(worldOf(result, 0).y).toBeCloseTo(P1.y * MM, 1);
  });

  it('reads a Greek-locale export when the delimiter is declared (comma = DECIMAL, not separator)', () => {
    const text = '1;384512,345;4201234,567;12,5;EDGE\n2;384520,0;4201240,0;15,25;EDGE';

    const result = readAsciiXyzPointCloud(text, { ...OPTS, mapping: PENZD_MAPPING, delimiter: ';' });

    expect(result.data.count).toBe(2);
    expect(worldOf(result, 0).x).toBeCloseTo(P1.x * MM, 1);
    expect(worldOf(result, 0).z).toBeCloseTo(P1.z * MM, 1);
  });

  it('falls back to the historical read when the mapping is incomplete', () => {
    const text = `${P1.x} ${P1.y} ${P1.z}`;

    const result = readAsciiXyzPointCloud(text, { ...OPTS, mapping: ['x', 'y', 'ignore'] });

    expect(worldOf(result, 0).z).toBeCloseTo(P1.z * MM, 1); // Z still came from the third field
  });

  it('DOCUMENTS the trap: an UN-mapped PENZD file reads the point number as X', () => {
    const result = readAsciiXyzPointCloud(PENZD, OPTS);

    expect(worldOf(result, 0).x).toBeCloseTo(1 * MM, 1); // «1» — the point id. This is the bug M8β/Δ removes.
    expect(worldOf(result, 0).y).toBeCloseTo(P1.x * MM, 1);
  });
});

describe('readAsciiXyzPointCloud — units', () => {
  it('scales metres to canonical mm', () => {
    const { data, stats } = readAsciiXyzPointCloud('10 20 1.5', { unit: 'm', maxPointsInMemory: 10 });

    expect(data.z[0]).toBeCloseTo(1_500, 3);
    expect(stats.boundsWorldMm.maxZ).toBeCloseTo(1_500, 3);
  });

  it('leaves a millimetre file alone', () => {
    const { data } = readAsciiXyzPointCloud('10 20 1500', { unit: 'mm', maxPointsInMemory: 10 });

    expect(data.z[0]).toBeCloseTo(1_500, 3);
  });

  it('scales feet to canonical mm', () => {
    const { data } = readAsciiXyzPointCloud('10 20 1', { unit: 'ft', maxPointsInMemory: 10 });

    expect(data.z[0]).toBeCloseTo(304.8, 2);
  });
});

describe('readAsciiXyzPointCloud — guards', () => {
  it('stride-samples valid points (not lines) when the cloud exceeds maxPointsInMemory', () => {
    const lines = ['# header comment'];
    for (let i = 0; i < 6; i++) lines.push(`${384_500 + i} ${4_201_200 + i} ${i}`);
    const text = lines.join('\n');

    const { data, warnings } = readAsciiXyzPointCloud(text, { unit: 'm', maxPointsInMemory: 2 });

    expect(warnings).toContain(POINTCLOUD_MSG.WARN_STRIDE_SAMPLED);
    expect(data.count).toBe(2); // stride 3 over 6 points
    expect(data.z[0]).toBeCloseTo(0, 1);
    expect(data.z[1]).toBeCloseTo(3_000, 1); // kept points are the 1st and the 4th
  });

  it('bounds cover the STORED points and stay consistent with the origin', () => {
    const text = `${P1.x} ${P1.y} ${P1.z}\n${P2.x} ${P2.y} ${P2.z}\n${P3.x} ${P3.y} ${P3.z}`;

    const { data, stats } = readAsciiXyzPointCloud(text, OPTS);

    expect(stats.boundsWorldMm.minX).toBeCloseTo(P3.x * MM, 1);
    expect(stats.boundsWorldMm.maxX).toBeCloseTo(P2.x * MM, 1);
    expect(stats.boundsWorldMm.minZ).toBeCloseTo(P3.z * MM, 1);
    expect(stats.boundsWorldMm.maxZ).toBeCloseTo(P2.z * MM, 1);
    expect(data.bounds).toBe(stats.boundsWorldMm);
  });

  it('throws the noPoints key when no line yields a finite X/Y/Z', () => {
    expect(() => readAsciiXyzPointCloud('# nothing here\nnot a point\n', OPTS)).toThrow(
      POINTCLOUD_MSG.ERROR_NO_POINTS,
    );
    expect(() => readAsciiXyzPointCloud('', OPTS)).toThrow(POINTCLOUD_MSG.ERROR_NO_POINTS);
  });

  it('rejects a line with fewer than three numbers', () => {
    const text = `${P1.x} ${P1.y}\n${P2.x} ${P2.y} ${P2.z}`;

    const { data, warnings } = readAsciiXyzPointCloud(text, OPTS);

    expect(data.count).toBe(1);
    expect(warnings).toEqual([]); // the bad line precedes the first point → treated as preamble
  });

  it('reports progress in 0..1 and ends at 1', () => {
    const ratios: number[] = [];
    readAsciiXyzPointCloud(`${P1.x} ${P1.y} ${P1.z}`, OPTS, (r) => ratios.push(r));

    expect(ratios[ratios.length - 1]).toBe(1);
    expect(ratios.every((r) => r >= 0 && r <= 1)).toBe(true);
  });
});
