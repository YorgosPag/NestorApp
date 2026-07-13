/**
 * ADR-650 M8α/M8β — shared, deterministic fixtures for the reader / ground-filter / decimation
 * tests.
 *
 * NOT a test suite (jest's `testMatch` only picks up `*.test.ts`), just the builders the suites
 * need, so they do not grow copy-pasted twins (N.18).
 *
 * Two builders live here:
 *  - `makeCloud` / `groundGrid` — an already-decoded `PointCloudData` (CSF, decimation tests).
 *  - `buildLas` — a byte-exact LAS FILE built in memory (reader tests). The LAZ suite builds the
 *    very same bytes and feeds them through a fake laz-perf, which is precisely how it proves that
 *    a `.laz` and its `.las` twin decode to the identical cloud.
 */

import type { PointCloudData } from '../pointcloud-types';
import type { LocalOrigin } from '../../topo-types';
import {
  LAS_CLASSIFICATION_OFFSET,
  LAS_HEADER_OFFSETS,
  LAS_RECORD_LENGTH,
  LAZ_COMPRESSION_MASK,
} from '../asprs-las-spec';

/** Authoring frame: x/y LOCAL mm (as `PointCloudData` stores them), z WORLD mm, class optional. */
export interface FixturePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly cls?: number;
}

/** Build a `PointCloudData` (SoA + WORLD bounds) out of plain authored points. */
export function makeCloud(
  points: readonly FixturePoint[],
  origin: LocalOrigin = { x: 0, y: 0 },
  withClassification = false,
): PointCloudData {
  const count = points.length;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const classification = withClassification ? new Uint8Array(count) : null;

  for (let i = 0; i < count; i++) {
    x[i] = points[i].x;
    y[i] = points[i].y;
    z[i] = points[i].z;
    if (classification) classification[i] = points[i].cls ?? 0;
  }

  return { count, x, y, z, classification, origin, bounds: worldBounds(points, origin) };
}

function worldBounds(points: readonly FixturePoint[], origin: LocalOrigin) {
  const xs = points.map((p) => p.x + origin.x);
  const ys = points.map((p) => p.y + origin.y);
  const zs = points.map((p) => p.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

/**
 * A regular grid of bare-earth points over `[0, extent]²` (LOCAL mm), elevated by `elevation(x, y)`.
 * The synthetic «survey» every CSF test starts from.
 */
export function groundGrid(
  extentMm: number,
  spacingMm: number,
  elevation: (x: number, y: number) => number,
): FixturePoint[] {
  const out: FixturePoint[] = [];
  for (let gx = 0; gx <= extentMm; gx += spacingMm) {
    for (let gy = 0; gy <= extentMm; gy += spacingMm) {
      out.push({ x: gx, y: gy, z: elevation(gx, gy) });
    }
  }
  return out;
}

// ─── LAS file builder ─────────────────────────────────────────────────────────
//
// A LAS file BUILT IN MEMORY (public header + N point records via `DataView`) — so the reader
// suites are deterministic, byte-exact and need no binary blob in the repo. The numbers are
// analytic: with `scale = 0.001` and a metre offset, every world coordinate is an exact integer
// number of millimetres, so assertions can be exact rather than "close enough".

export const LAS_HEADER_SIZE = 227; // LAS 1.2 public header
export const LAS_SCALE = 0.001; // millimetre resolution in a metre-unit file
export const LAS_OFFSET = { x: 384_000, y: 4_201_000, z: 0 }; // keeps ΕΓΣΑ'87 coords inside int32

/** A point in SOURCE units (metres) plus its raw classification byte. */
export interface SourcePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The raw byte written at the PDRF's classification offset (flags included, on purpose). */
  readonly classByte?: number;
}

export interface LasFixture {
  readonly pdrf: number;
  readonly points: readonly SourcePoint[];
  /** Set the PDRF's high bits, as a LAZ writer does. The RECORDS stay uncompressed. */
  readonly compressed?: boolean;
  /** Override the header's min/max block (to simulate an instrument that writes junk). */
  readonly junkBounds?: boolean;
}

function writeVec3(view: DataView, offset: number, v: { x: number; y: number; z: number }): void {
  view.setFloat64(offset, v.x, true);
  view.setFloat64(offset + 8, v.y, true);
  view.setFloat64(offset + 16, v.z, true);
}

export function buildLas(fixture: LasFixture): ArrayBuffer {
  const recordLength = LAS_RECORD_LENGTH[fixture.pdrf];
  const buffer = new ArrayBuffer(LAS_HEADER_SIZE + fixture.points.length * recordLength);
  const view = new DataView(buffer);
  const o = LAS_HEADER_OFFSETS;

  for (const [i, ch] of [...'LASF'].entries()) view.setUint8(o.SIGNATURE + i, ch.charCodeAt(0));
  view.setUint8(o.VERSION_MAJOR, 1);
  view.setUint8(o.VERSION_MINOR, 2);
  view.setUint16(o.HEADER_SIZE, LAS_HEADER_SIZE, true);
  view.setUint32(o.OFFSET_TO_POINT_DATA, LAS_HEADER_SIZE, true);
  view.setUint8(o.POINT_DATA_FORMAT, fixture.compressed ? fixture.pdrf | LAZ_COMPRESSION_MASK : fixture.pdrf);
  view.setUint16(o.POINT_DATA_RECORD_LENGTH, recordLength, true);
  view.setUint32(o.LEGACY_POINT_COUNT, fixture.points.length, true);
  writeVec3(view, o.SCALE_X, { x: LAS_SCALE, y: LAS_SCALE, z: LAS_SCALE });
  writeVec3(view, o.OFFSET_X, LAS_OFFSET);
  writeLasBounds(view, fixture);
  writeLasPoints(view, fixture, recordLength);
  return buffer;
}

const ZERO_AXIS = { min: 0, max: 0 };

function writeLasBounds(view: DataView, fixture: LasFixture): void {
  const o = LAS_HEADER_OFFSETS;
  const axes = (['x', 'y', 'z'] as const).map((axis) => ({
    min: Math.min(...fixture.points.map((p) => p[axis])),
    max: Math.max(...fixture.points.map((p) => p[axis])),
  }));
  const [x, y, z] = fixture.junkBounds ? [ZERO_AXIS, ZERO_AXIS, ZERO_AXIS] : axes;
  view.setFloat64(o.MAX_X, x.max, true);
  view.setFloat64(o.MIN_X, x.min, true);
  view.setFloat64(o.MAX_Y, y.max, true);
  view.setFloat64(o.MIN_Y, y.min, true);
  view.setFloat64(o.MAX_Z, z.max, true);
  view.setFloat64(o.MIN_Z, z.min, true);
}

function writeLasPoints(view: DataView, fixture: LasFixture, recordLength: number): void {
  const classOffset = LAS_CLASSIFICATION_OFFSET[fixture.pdrf];
  fixture.points.forEach((p, i) => {
    const rec = LAS_HEADER_SIZE + i * recordLength;
    view.setInt32(rec + 0, Math.round((p.x - LAS_OFFSET.x) / LAS_SCALE), true);
    view.setInt32(rec + 4, Math.round((p.y - LAS_OFFSET.y) / LAS_SCALE), true);
    view.setInt32(rec + 8, Math.round((p.z - LAS_OFFSET.z) / LAS_SCALE), true);
    view.setUint8(rec + classOffset, p.classByte ?? 0);
  });
}

/** WORLD mm of a source point (metres → mm). */
export function worldMm(p: SourcePoint): { x: number; y: number; z: number } {
  return { x: p.x * 1000, y: p.y * 1000, z: p.z * 1000 };
}
