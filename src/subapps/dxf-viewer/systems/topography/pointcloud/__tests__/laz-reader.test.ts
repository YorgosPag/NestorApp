/**
 * ADR-650 M8β — LAZ reader tests.
 *
 * GROUND TRUTH: **a `.laz` must decode to the same cloud as its `.las` twin.** Nothing less is a
 * meaningful assertion — the engineer's survey does not change because his drone software zipped
 * it. So every test here builds ONE in-memory LAS file (`buildLas`, the M8α fixture) and reads it
 * TWICE: once through the real LAS reader, once through the LAZ reader with a fake laz-perf that
 * hands back exactly those records. Any divergence — origin, LOCAL frame, classification mask,
 * bounds — fails.
 *
 * WHY A FAKE laz-perf AND NOT A REAL `.laz` BLOB. laz-perf ships a DEcoder, no encoder, so a real
 * `.laz` fixture could not be built in-repo — it would have to be a checked-in binary blob whose
 * provenance no reviewer can verify. And it would test laz-perf (Hobu's job, already hardened by
 * potree/PDAL), not OUR code. What is ours is the seam: heap in, records out, stride, cleanup,
 * error keys. That is exactly what the fake exercises.
 *
 * The fake IS honest about the one thing that matters structurally: LAZ is a SEQUENTIAL stream —
 * `getPoint()` yields the next record and cannot seek — which is why the reader must sample during
 * decompression rather than skip records like the LAS reader does.
 */

import type { LazPerf } from 'laz-perf';
import { ASPRS_CLASS } from '../asprs-las-spec';
import { readLasHeader, readLasPointCloud } from '../las-reader';
import { readLazPointCloud } from '../laz-reader';
import { POINTCLOUD_MSG } from '../pointcloud-read';
import type { LazPerfFactory } from '../laz-runtime';
import type { PointCloudReadOptions } from '../pointcloud-types';
import { buildLas, type SourcePoint } from './pointcloud-fixtures';

// ─── The fake laz-perf ────────────────────────────────────────────────────────

/** A bump-allocated stand-in for the Emscripten heap. Tracks frees so a leak is a test failure. */
class FakeHeap {
  readonly HEAPU8 = new Uint8Array(1 << 22); // 4 MB — plenty for the fixtures below
  private next = 8; // never hand out 0: the reader treats it as a failed malloc
  private readonly live = new Set<number>();

  _malloc = (size: number): number => {
    const ptr = this.next;
    this.next += size;
    this.live.add(ptr);
    return ptr;
  };

  _free = (ptr: number): void => {
    this.live.delete(ptr);
  };

  get liveAllocations(): number {
    return this.live.size;
  }
}

/** How the fake `LASZip` should misbehave, when a test wants it to. */
type FakeFault = 'none' | 'open-throws' | 'empty-stream';

/**
 * A `LazPerf` module whose `LASZip` "decompresses" by simply walking the UNCOMPRESSED records that
 * are already sitting in the heap — which is precisely what a real decode produces.
 */
function fakeLazPerf(fault: FakeFault = 'none'): { module: LazPerf; heap: FakeHeap } {
  const heap = new FakeHeap();

  class FakeLasZip {
    private records = new Uint8Array(0);
    private recordLength = 0;
    private count = 0;
    private format = 0;
    private cursor = 0;

    open(ptr: number, length: number): void {
      if (fault === 'open-throws') throw new Error('boom: corrupt chunk table');
      const file = heap.HEAPU8.slice(ptr, ptr + length);
      const header = readLasHeader(file.buffer as ArrayBuffer);
      this.recordLength = header.pointDataRecordLength;
      this.count = fault === 'empty-stream' ? 0 : header.pointCount;
      this.format = header.pointDataFormat;
      this.records = file.subarray(header.offsetToPointData);
    }

    getPoint(dest: number): void {
      const start = this.cursor * this.recordLength;
      heap.HEAPU8.set(this.records.subarray(start, start + this.recordLength), dest);
      this.cursor++; // SEQUENTIAL — a real LAZ stream cannot seek either
    }

    getCount = (): number => this.count;
    getPointLength = (): number => this.recordLength;
    getPointFormat = (): number => this.format;
    delete = (): void => undefined;
  }

  // The reader touches four members of the Emscripten module (`_malloc`, `_free`, `HEAPU8`,
  // `LASZip`); the other ~40 belong to Emscripten's own runtime and are irrelevant here. The cast
  // is confined to this line — no `any` reaches the reader (N.2).
  const module = {
    _malloc: heap._malloc,
    _free: heap._free,
    HEAPU8: heap.HEAPU8,
    LASZip: FakeLasZip,
  } as unknown as LazPerf;

  return { module, heap };
}

function factoryFor(fault: FakeFault = 'none'): { factory: LazPerfFactory; heap: FakeHeap } {
  const { module, heap } = fakeLazPerf(fault);
  return { factory: () => Promise.resolve(module), heap };
}

// ─── Fixture data ─────────────────────────────────────────────────────────────

const OPTS: PointCloudReadOptions = { unit: 'm', maxPointsInMemory: 1_000_000 };

const POINTS: readonly SourcePoint[] = [
  { x: 384_512.345, y: 4_201_234.567, z: 12.5, classByte: ASPRS_CLASS.GROUND },
  { x: 384_520.0, y: 4_201_240.0, z: 15.25, classByte: ASPRS_CLASS.HIGH_VEGETATION },
  { x: 384_500.0, y: 4_201_230.0, z: 10.0, classByte: ASPRS_CLASS.GROUND },
];

// ─── The one assertion that matters ───────────────────────────────────────────

describe('readLazPointCloud — a .laz decodes to the same cloud as its .las twin', () => {
  it.each([1, 6])('is byte-for-byte identical to the LAS reader (PDRF %i)', async (pdrf) => {
    const las = readLasPointCloud(buildLas({ pdrf, points: POINTS }), OPTS);
    const { factory } = factoryFor();
    const laz = await readLazPointCloud(buildLas({ pdrf, points: POINTS, compressed: true }), OPTS, undefined, factory);

    expect(laz.format).toBe('laz'); // the ONLY thing that may differ
    expect(las.format).toBe('las');

    expect(laz.data.count).toBe(las.data.count);
    expect(laz.data.origin).toEqual(las.data.origin);
    expect(laz.stats.boundsWorldMm).toEqual(las.stats.boundsWorldMm);
    expect(Array.from(laz.data.x)).toEqual(Array.from(las.data.x));
    expect(Array.from(laz.data.y)).toEqual(Array.from(las.data.y));
    expect(Array.from(laz.data.z)).toEqual(Array.from(las.data.z));
    expect(Array.from(laz.data.classification ?? [])).toEqual(Array.from(las.data.classification ?? []));
    expect(laz.stats.classHistogram).toEqual(las.stats.classHistogram);
  });

  it('keeps x/y LOCAL and z WORLD — the Float32 precision frame survives decompression', async () => {
    const { factory } = factoryFor();
    const { data } = await readLazPointCloud(
      buildLas({ pdrf: 1, points: POINTS, compressed: true }),
      OPTS,
      undefined,
      factory,
    );

    expect(data.origin.x).toBe(Math.floor(384_500 * 1000)); // floored min corner (topo SSoT)
    POINTS.forEach((p, i) => {
      expect(data.x[i] + data.origin.x).toBeCloseTo(p.x * 1000, 1);
      expect(data.z[i]).toBeCloseTo(p.z * 1000, 1); // z is WORLD, never offset
    });
  });

  it('recovers the origin by scanning when the header bounds are junk', async () => {
    const { factory } = factoryFor();
    const { data, warnings } = await readLazPointCloud(
      buildLas({ pdrf: 1, points: POINTS, compressed: true, junkBounds: true }),
      OPTS,
      undefined,
      factory,
    );

    expect(warnings).toContain(POINTCLOUD_MSG.WARN_HEADER_BOUNDS_INVALID);
    expect(data.x[2]).toBeCloseTo(0, 1); // the min-corner point sits at LOCAL zero
  });
});

// ─── Sampling + hygiene ───────────────────────────────────────────────────────

describe('readLazPointCloud — sampling and heap hygiene', () => {
  const MANY: SourcePoint[] = Array.from({ length: 6 }, (_, i) => ({
    x: 384_500 + i,
    y: 4_201_200 + i,
    z: i,
    classByte: ASPRS_CLASS.GROUND,
  }));

  it('stride-samples DURING decompression (every point is decoded; only some are kept)', async () => {
    const { factory } = factoryFor();
    const { data, stats, warnings } = await readLazPointCloud(
      buildLas({ pdrf: 1, points: MANY, compressed: true }),
      { unit: 'm', maxPointsInMemory: 2 },
      undefined,
      factory,
    );

    expect(warnings).toContain(POINTCLOUD_MSG.WARN_STRIDE_SAMPLED);
    expect(data.count).toBe(2); // stride 3 over 6 points
    expect(stats.totalPoints).toBe(2);
    expect(data.z[0]).toBeCloseTo(0, 1);
    expect(data.z[1]).toBeCloseTo(3_000, 1); // kept points are 0 and 3 — the SEQUENCE was respected
  });

  it('frees every WASM allocation, even when the decode throws', async () => {
    const ok = factoryFor();
    await readLazPointCloud(buildLas({ pdrf: 1, points: POINTS, compressed: true }), OPTS, undefined, ok.factory);
    expect(ok.heap.liveAllocations).toBe(0);

    const bad = factoryFor('open-throws');
    await expect(
      readLazPointCloud(buildLas({ pdrf: 1, points: POINTS, compressed: true }), OPTS, undefined, bad.factory),
    ).rejects.toThrow(POINTCLOUD_MSG.ERROR_LAZ_DECODE_FAILED);
    expect(bad.heap.liveAllocations).toBe(0);
  });

  it('reports progress monotonically in 0..1', async () => {
    const ratios: number[] = [];
    const { factory } = factoryFor();
    await readLazPointCloud(
      buildLas({ pdrf: 1, points: POINTS, compressed: true }),
      OPTS,
      (r) => ratios.push(r),
      factory,
    );

    expect(ratios.length).toBeGreaterThan(0);
    expect(ratios[ratios.length - 1]).toBe(1);
    expect(ratios.every((r) => r >= 0 && r <= 1)).toBe(true);
  });
});

// ─── Honest failures (N.11 — every message is an i18n key) ────────────────────

describe('readLazPointCloud — failures carry i18n keys', () => {
  it('throws noPoints when the stream decodes to nothing', async () => {
    const { factory } = factoryFor('empty-stream');

    await expect(
      readLazPointCloud(buildLas({ pdrf: 1, points: POINTS, compressed: true }), OPTS, undefined, factory),
    ).rejects.toThrow(POINTCLOUD_MSG.ERROR_NO_POINTS);
  });

  it('throws lazDecodeFailed when laz-perf aborts on a corrupt stream', async () => {
    const { factory } = factoryFor('open-throws');

    await expect(
      readLazPointCloud(buildLas({ pdrf: 1, points: POINTS, compressed: true }), OPTS, undefined, factory),
    ).rejects.toThrow(POINTCLOUD_MSG.ERROR_LAZ_DECODE_FAILED);
  });

  it('throws lazRuntimeUnavailable when the WASM module cannot be instantiated', async () => {
    const failing: LazPerfFactory = () => Promise.reject(new Error('WebAssembly is disabled'));

    await expect(
      readLazPointCloud(buildLas({ pdrf: 1, points: POINTS, compressed: true }), OPTS, undefined, failing),
    ).rejects.toThrow(POINTCLOUD_MSG.ERROR_LAZ_RUNTIME_UNAVAILABLE);
  });

  it('refuses an unsupported PDRF BEFORE paying for a WASM instantiation', async () => {
    let instantiated = false;
    const spy: LazPerfFactory = () => {
      instantiated = true;
      return Promise.resolve(fakeLazPerf().module);
    };
    const buffer = buildLas({ pdrf: 1, points: POINTS, compressed: true });
    new DataView(buffer).setUint8(104, 99 | 0x80); // POINT_DATA_FORMAT ← PDRF 99, still flagged LAZ

    await expect(readLazPointCloud(buffer, OPTS, undefined, spy)).rejects.toThrow(
      POINTCLOUD_MSG.ERROR_UNSUPPORTED_PDRF,
    );
    expect(instantiated).toBe(false);
  });
});
