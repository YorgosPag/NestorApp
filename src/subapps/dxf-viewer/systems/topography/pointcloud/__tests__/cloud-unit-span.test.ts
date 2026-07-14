/**
 * ADR-650 M8β/Ε — unit-aware binary cloud tests.
 *
 * The silent failure this milestone removes: a LAS/LAZ header states no unit, so a file in feet or
 * millimetres was read as metres — a valid-looking cloud of the wrong site, at the wrong scale.
 * Two guards are tested here:
 *   1. the wizard's extent READOUT (what the site measures under each unit) so the pick is verifiable;
 *   2. the belt-and-suspenders span sanity WARNING the reader appends when the result is absurd.
 * Both are deterministic — zero LLM — and every fixture is a LAS built in memory (`buildLas`).
 */

import { readLasHeader, readLasPointCloud } from '../las-reader';
import { POINTCLOUD_MSG, isCloudSpanImplausible } from '../pointcloud-read';
import {
  cloudSourceExtentFromBuffer,
  cloudSourceExtentFromLasHeader,
  unitSpanReadouts,
} from '../cloud-unit-span';
import { SPAN_SANITY_MAX_HORIZONTAL_MM, SPAN_SANITY_MAX_VERTICAL_MM } from '../pointcloud-defaults';
import type { PointCloudReadOptions } from '../pointcloud-types';
import type { TopoBounds } from '../../topo-types';
import { buildLas, type SourcePoint } from './pointcloud-fixtures';

const OPTS: PointCloudReadOptions = { unit: 'm', maxPointsInMemory: 1_000_000 };

/** A tiny survey (source units): 20 wide × 10 deep × 5.25 tall — a plausible plot when read as metres. */
const PLOT: readonly SourcePoint[] = [
  { x: 384_500, y: 4_201_230, z: 10 },
  { x: 384_520, y: 4_201_240, z: 15.25 },
];

// ─── Source extent (off the header, unit-agnostic) ─────────────────────────────

describe('cloudSourceExtentFromLasHeader / FromBuffer', () => {
  it('reads the raw per-axis extent straight off the public header', () => {
    const extent = cloudSourceExtentFromBuffer(buildLas({ pdrf: 1, points: PLOT }));

    expect(extent).not.toBeNull();
    expect(extent?.dx).toBeCloseTo(20, 6);
    expect(extent?.dy).toBeCloseTo(10, 6);
    expect(extent?.dz).toBeCloseTo(5.25, 6);
  });

  it('matches the header-based helper (a .laz header is uncompressed → same path)', () => {
    const buffer = buildLas({ pdrf: 6, points: PLOT, compressed: true });
    const fromHeader = cloudSourceExtentFromLasHeader(readLasHeader(buffer));

    expect(fromHeader.dx).toBeCloseTo(20, 6);
    expect(fromHeader.dz).toBeCloseTo(5.25, 6);
  });

  it('returns null when the bytes are not a readable LAS header (ASCII, truncated, Layer State)', () => {
    expect(cloudSourceExtentFromBuffer(new ArrayBuffer(16))).toBeNull();
    expect(cloudSourceExtentFromBuffer(new TextEncoder().encode('1 2 3\n').buffer)).toBeNull();
  });
});

// ─── Unit readouts (the eye-verifiable evidence) ───────────────────────────────

describe('unitSpanReadouts', () => {
  const readouts = unitSpanReadouts({ dx: 200, dy: 180, dz: 12 });
  const byUnit = Object.fromEntries(readouts.map((r) => [r.unit, r]));

  it('offers exactly m, mm and ft', () => {
    expect(readouts.map((r) => r.unit)).toEqual(['m', 'mm', 'ft']);
  });

  it('metres pass through unscaled — the sane plot the engineer recognises', () => {
    expect(byUnit.m.widthMeters).toBeCloseTo(200, 6);
    expect(byUnit.m.depthMeters).toBeCloseTo(180, 6);
    expect(byUnit.m.heightMeters).toBeCloseTo(12, 6);
  });

  it('millimetres collapse the site to a fraction of a metre — clearly wrong', () => {
    expect(byUnit.mm.widthMeters).toBeCloseTo(0.2, 6);
    expect(byUnit.mm.heightMeters).toBeCloseTo(0.012, 6);
  });

  it('feet scale by 0.3048 — a smaller, still-plausible plot (why we never auto-pick)', () => {
    expect(byUnit.ft.widthMeters).toBeCloseTo(60.96, 4);
    expect(byUnit.ft.depthMeters).toBeCloseTo(54.864, 4);
  });
});

// ─── Span sanity (belt-and-suspenders, every format) ───────────────────────────

describe('isCloudSpanImplausible', () => {
  const ok: TopoBounds = { minX: 0, maxX: 200_000, minY: 0, maxY: 180_000, minZ: 0, maxZ: 12_000 };

  it('passes a normal 200 m × 180 m × 12 m site', () => {
    expect(isCloudSpanImplausible(ok)).toBe(false);
  });

  it('flags a horizontal span past the ceiling', () => {
    expect(isCloudSpanImplausible({ ...ok, maxX: SPAN_SANITY_MAX_HORIZONTAL_MM + 1 })).toBe(true);
  });

  it('flags a vertical span past the ceiling', () => {
    expect(isCloudSpanImplausible({ ...ok, maxZ: SPAN_SANITY_MAX_VERTICAL_MM + 1 })).toBe(true);
  });
});

describe('readLasPointCloud — span sanity warning', () => {
  it('stays silent for a plausible metre-unit plot', () => {
    const { warnings } = readLasPointCloud(buildLas({ pdrf: 1, points: PLOT }), OPTS);

    expect(warnings).not.toContain(POINTCLOUD_MSG.WARN_SPAN_IMPLAUSIBLE);
  });

  it('warns when a millimetre-scale file is read as metres (the 1000× silent bug)', () => {
    // Source coords 200 000 units wide: as metres that is 200 km — no survey site is that big.
    const mmAsMeters: readonly SourcePoint[] = [
      { x: 384_500, y: 4_201_230, z: 10 },
      { x: 584_500, y: 4_401_230, z: 15 },
    ];
    const { warnings } = readLasPointCloud(buildLas({ pdrf: 1, points: mmAsMeters }), OPTS);

    expect(warnings).toContain(POINTCLOUD_MSG.WARN_SPAN_IMPLAUSIBLE);
  });
});
