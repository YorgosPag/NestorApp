/**
 * ADR-650 M8α — LAS reader tests.
 *
 * Every fixture is a LAS file BUILT IN MEMORY (`buildLas`, in `pointcloud-fixtures` — shared with
 * the M8β LAZ suite, N.18), so the suite is deterministic, byte-exact and needs no binary blob in
 * the repo. The numbers are analytic: with `scale = 0.001` and a metre offset, every world
 * coordinate is an exact integer number of millimetres, so an assertion can be exact rather than
 * "close enough".
 */

import { ASPRS_CLASS, LAS_RECORD_LENGTH } from '../asprs-las-spec';
import { readLasHeader, readLasPointCloud } from '../las-reader';
import { detectPointCloudFormat, readPointCloud, POINTCLOUD_MSG } from '../pointcloud-read';
import type { PointCloudReadOptions } from '../pointcloud-types';
import {
  LAS_HEADER_SIZE,
  LAS_OFFSET,
  LAS_SCALE,
  buildLas,
  worldMm,
  type SourcePoint,
} from './pointcloud-fixtures';

// ─── Fixture data ─────────────────────────────────────────────────────────────

const HEADER_SIZE = LAS_HEADER_SIZE;
const SCALE = LAS_SCALE;
const OFFSET = LAS_OFFSET;
const OPTS: PointCloudReadOptions = { unit: 'm', maxPointsInMemory: 1_000_000 };

/** Three points; X/Y in metres, chosen so the world mm values are exact integers. */
const POINTS: readonly SourcePoint[] = [
  { x: 384_512.345, y: 4_201_234.567, z: 12.5, classByte: ASPRS_CLASS.GROUND },
  { x: 384_520.0, y: 4_201_240.0, z: 15.25, classByte: ASPRS_CLASS.HIGH_VEGETATION },
  { x: 384_500.0, y: 4_201_230.0, z: 10.0, classByte: ASPRS_CLASS.GROUND },
];

// ─── Header ───────────────────────────────────────────────────────────────────

describe('readLasHeader', () => {
  it('reads the public header of a LAS 1.2 / PDRF 1 file', () => {
    const header = readLasHeader(buildLas({ pdrf: 1, points: POINTS }));

    expect(header.versionMajor).toBe(1);
    expect(header.versionMinor).toBe(2);
    expect(header.pointDataFormat).toBe(1);
    expect(header.pointDataRecordLength).toBe(LAS_RECORD_LENGTH[1]);
    expect(header.pointCount).toBe(3);
    expect(header.offsetToPointData).toBe(HEADER_SIZE);
    expect(header.scale.x).toBeCloseTo(SCALE, 10);
    expect(header.offset.y).toBeCloseTo(OFFSET.y, 6);
    expect(header.min.z).toBeCloseTo(10, 6);
    expect(header.max.z).toBeCloseTo(15.25, 6);
    expect(header.isCompressed).toBe(false);
  });

  it('flags LAZ compression from the PDRF high bits and keeps the real format', () => {
    const header = readLasHeader(buildLas({ pdrf: 6, points: POINTS, compressed: true }));

    expect(header.isCompressed).toBe(true);
    expect(header.pointDataFormat).toBe(6);
  });

  it('throws the notLas key when the magic is not LASF (e.g. an AutoCAD Layer State .las)', () => {
    const buffer = buildLas({ pdrf: 1, points: POINTS });
    new DataView(buffer).setUint8(0, 'X'.charCodeAt(0));

    expect(() => readLasHeader(buffer)).toThrow(POINTCLOUD_MSG.ERROR_NOT_LAS);
  });

  it('throws the lasTruncated key when the buffer cannot even hold a header', () => {
    expect(() => readLasHeader(new ArrayBuffer(32))).toThrow(POINTCLOUD_MSG.ERROR_LAS_TRUNCATED);
  });
});

// ─── Point records ────────────────────────────────────────────────────────────

describe('readLasPointCloud — geometry', () => {
  it('applies scale + offset + unit scaling and stores x/y LOCAL, z WORLD (PDRF 1)', () => {
    const { data, stats, format, warnings } = readLasPointCloud(buildLas({ pdrf: 1, points: POINTS }), OPTS);

    expect(format).toBe('las');
    expect(warnings).toEqual([]);
    expect(data.count).toBe(3);
    expect(stats.totalPoints).toBe(3);

    // The origin is the floored min corner (topo SSoT), so LOCAL + origin === WORLD.
    const min = worldMm(POINTS[2]);
    expect(data.origin.x).toBe(Math.floor(min.x));
    expect(data.origin.y).toBe(Math.floor(POINTS[2].y * 1000));

    POINTS.forEach((p, i) => {
      const w = worldMm(p);
      expect(data.x[i] + data.origin.x).toBeCloseTo(w.x, 1);
      expect(data.y[i] + data.origin.y).toBeCloseTo(w.y, 1);
      expect(data.z[i]).toBeCloseTo(w.z, 1); // z is WORLD, never offset
    });
  });

  it('reports WORLD mm bounds of the stored points', () => {
    const { stats } = readLasPointCloud(buildLas({ pdrf: 1, points: POINTS }), OPTS);

    expect(stats.boundsWorldMm.minX).toBeCloseTo(384_500_000, 1);
    expect(stats.boundsWorldMm.maxX).toBeCloseTo(384_520_000, 1);
    expect(stats.boundsWorldMm.minZ).toBeCloseTo(10_000, 1);
    expect(stats.boundsWorldMm.maxZ).toBeCloseTo(15_250, 1);
  });

  it('honours the source unit (a millimetre-unit file is not rescaled)', () => {
    const buffer = buildLas({ pdrf: 1, points: POINTS });
    const { data } = readLasPointCloud(buffer, { unit: 'mm', maxPointsInMemory: 1_000 });

    // Source z = 12.5 «mm» → 12.5 mm canonical (not 12 500).
    expect(data.z[0]).toBeCloseTo(12.5, 2);
  });

  it('falls back to a bounds scan (and warns) when the header bounds are junk', () => {
    const { data, warnings } = readLasPointCloud(buildLas({ pdrf: 1, points: POINTS, junkBounds: true }), OPTS);

    expect(warnings).toContain(POINTCLOUD_MSG.WARN_HEADER_BOUNDS_INVALID);
    expect(data.origin.x).toBe(Math.floor(384_500 * 1000));
    expect(data.x[2]).toBeCloseTo(0, 1); // the min-corner point sits at LOCAL zero
  });
});

// ─── Classification ───────────────────────────────────────────────────────────

describe('readLasPointCloud — classification', () => {
  it('masks the legacy 5-bit class (PDRF 0–5) and ignores the synthetic/key-point flags', () => {
    const flagged: SourcePoint[] = POINTS.map((p) => ({ ...p, classByte: (p.classByte ?? 0) | 0x80 }));
    const { data, stats } = readLasPointCloud(buildLas({ pdrf: 1, points: flagged }), OPTS);

    expect(data.classification).not.toBeNull();
    expect(Array.from(data.classification ?? [])).toEqual([
      ASPRS_CLASS.GROUND,
      ASPRS_CLASS.HIGH_VEGETATION,
      ASPRS_CLASS.GROUND,
    ]);
    expect(stats.hasSourceClassification).toBe(true);
    expect(stats.classHistogram).toEqual({ [ASPRS_CLASS.GROUND]: 2, [ASPRS_CLASS.HIGH_VEGETATION]: 1 });
  });

  it('reads the full classification byte at the LAS 1.4 offset (PDRF 6)', () => {
    const points: SourcePoint[] = [
      { ...POINTS[0], classByte: ASPRS_CLASS.GROUND },
      { ...POINTS[1], classByte: 200 }, // user-defined class — must survive unmasked
      { ...POINTS[2], classByte: ASPRS_CLASS.BUILDING },
    ];
    const { data, stats } = readLasPointCloud(buildLas({ pdrf: 6, points }), OPTS);

    expect(Array.from(data.classification ?? [])).toEqual([ASPRS_CLASS.GROUND, 200, ASPRS_CLASS.BUILDING]);
    expect(stats.classHistogram).toEqual({ [ASPRS_CLASS.GROUND]: 1, 200: 1, [ASPRS_CLASS.BUILDING]: 1 });
  });

  it('drops the classification array when every point is class 0 (never classified)', () => {
    const raw: SourcePoint[] = POINTS.map((p) => ({ ...p, classByte: 0 }));
    const { data, stats } = readLasPointCloud(buildLas({ pdrf: 1, points: raw }), OPTS);

    expect(data.classification).toBeNull();
    expect(stats.hasSourceClassification).toBe(false);
    expect(stats.classHistogram).toBeNull();
  });
});

// ─── Guards ───────────────────────────────────────────────────────────────────

describe('readLasPointCloud — guards', () => {
  it('stride-samples while parsing when the cloud exceeds maxPointsInMemory', () => {
    const many: SourcePoint[] = Array.from({ length: 6 }, (_, i) => ({
      x: 384_500 + i,
      y: 4_201_200 + i,
      z: i,
      classByte: ASPRS_CLASS.GROUND,
    }));
    const { data, stats, warnings } = readLasPointCloud(buildLas({ pdrf: 1, points: many }), {
      unit: 'm',
      maxPointsInMemory: 2,
    });

    expect(warnings).toContain(POINTCLOUD_MSG.WARN_STRIDE_SAMPLED);
    expect(data.count).toBe(2); // stride 3 over 6 points
    expect(stats.totalPoints).toBe(2);
    expect(data.z[0]).toBeCloseTo(0, 1);
    expect(data.z[1]).toBeCloseTo(3_000, 1); // kept points are 0 and 3
  });

  it('refuses a LAZ buffer with the lazUnsupported key instead of loading nothing', () => {
    const buffer = buildLas({ pdrf: 6, points: POINTS, compressed: true });

    expect(() => readLasPointCloud(buffer, OPTS)).toThrow(POINTCLOUD_MSG.ERROR_LAZ_UNSUPPORTED);
  });

  it('warns and clamps when the point data is truncated mid-file', () => {
    const full = buildLas({ pdrf: 1, points: POINTS });
    const cut = full.slice(0, full.byteLength - LAS_RECORD_LENGTH[1]);
    const { data, warnings } = readLasPointCloud(cut, OPTS);

    expect(warnings).toContain(POINTCLOUD_MSG.WARN_TRUNCATED_POINT_DATA);
    expect(data.count).toBe(2);
  });

  it('throws noPoints for a header that declares an empty cloud', () => {
    expect(() => readLasPointCloud(buildLas({ pdrf: 1, points: [] }), OPTS)).toThrow(
      POINTCLOUD_MSG.ERROR_NO_POINTS,
    );
  });

  it('reports progress monotonically in 0..1', () => {
    const ratios: number[] = [];
    readLasPointCloud(buildLas({ pdrf: 1, points: POINTS }), OPTS, (r) => ratios.push(r));

    expect(ratios.length).toBeGreaterThan(0);
    expect(ratios[ratios.length - 1]).toBe(1);
    expect(ratios.every((r) => r >= 0 && r <= 1)).toBe(true);
  });
});

// ─── Dispatcher ───────────────────────────────────────────────────────────────

describe('detectPointCloudFormat / readPointCloud', () => {
  it('detects LAS from the magic even when the extension lies', () => {
    expect(detectPointCloudFormat('survey.txt', buildLas({ pdrf: 1, points: POINTS }))).toBe('las');
  });

  it('detects LAZ from the PDRF high bits, not from the extension', () => {
    expect(detectPointCloudFormat('survey.las', buildLas({ pdrf: 6, points: POINTS, compressed: true }))).toBe(
      'laz',
    );
  });

  it('falls back to ascii-xyz for text drops', () => {
    expect(detectPointCloudFormat('cloud.xyz', new ArrayBuffer(0))).toBe('ascii-xyz');
    expect(detectPointCloudFormat('cloud.laz', new ArrayBuffer(0))).toBe('laz'); // no magic → extension
  });

  it('routes a LAS buffer to the LAS reader', async () => {
    const result = await readPointCloud(buildLas({ pdrf: 1, points: POINTS }), 'survey.las', OPTS);

    expect(result.format).toBe('las');
    expect(result.data.count).toBe(3);
  });

  // M8β: LAZ is no longer refused here — it routes to `laz-reader` (see `laz-reader.test.ts`).
});
