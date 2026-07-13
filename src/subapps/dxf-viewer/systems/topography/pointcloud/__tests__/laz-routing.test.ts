/**
 * ADR-650 M8β — the dispatcher's LAZ road.
 *
 * Its own file because it MOCKS `laz-reader`, and the reader's real suite (`laz-reader.test.ts`)
 * must run against the real thing. What is proved here is narrow and worth proving on its own: a
 * `.laz` now reaches `readLazPointCloud` (M8α refused it), while `.las`/`.xyz` never even touch the
 * module — the 214 KB WASM bundle stays behind its dynamic import for everyone who does not open a
 * compressed cloud.
 */

import { readPointCloud } from '../pointcloud-read';
import { readLazPointCloud } from '../laz-reader';
import type { PointCloudReadOptions } from '../pointcloud-types';
import { buildLas, type SourcePoint } from './pointcloud-fixtures';

jest.mock('../laz-reader', () => ({
  readLazPointCloud: jest.fn(() => Promise.resolve({ format: 'laz', data: { count: 42 } })),
}));

const mockedLazReader = jest.mocked(readLazPointCloud);

const OPTS: PointCloudReadOptions = { unit: 'm', maxPointsInMemory: 1_000_000 };
const POINTS: readonly SourcePoint[] = [
  { x: 384_512.0, y: 4_201_234.0, z: 12.5 },
  { x: 384_520.0, y: 4_201_240.0, z: 15.25 },
];

beforeEach(() => mockedLazReader.mockClear());

describe('readPointCloud — LAZ routing (M8β)', () => {
  it('sends compressed bytes to the LAZ reader instead of refusing them', async () => {
    const buffer = buildLas({ pdrf: 1, points: POINTS, compressed: true });

    const result = await readPointCloud(buffer, 'drone-survey.laz', OPTS);

    expect(mockedLazReader).toHaveBeenCalledTimes(1);
    expect(mockedLazReader).toHaveBeenCalledWith(buffer, OPTS, undefined);
    expect(result.format).toBe('laz');
  });

  it('routes by the PDRF high bits, not the extension (a .las that is really LAZ)', async () => {
    await readPointCloud(buildLas({ pdrf: 6, points: POINTS, compressed: true }), 'survey.las', OPTS);

    expect(mockedLazReader).toHaveBeenCalledTimes(1);
  });

  it('never loads the LAZ reader for an uncompressed LAS', async () => {
    const result = await readPointCloud(buildLas({ pdrf: 1, points: POINTS }), 'survey.las', OPTS);

    expect(mockedLazReader).not.toHaveBeenCalled();
    expect(result.format).toBe('las');
    expect(result.data.count).toBe(2);
  });

  it('never loads the LAZ reader for an ASCII cloud', async () => {
    const buffer = new TextEncoder().encode('384512 4201234 12.5\n384520 4201240 15.25\n').buffer;

    const result = await readPointCloud(buffer, 'survey.xyz', OPTS);

    expect(mockedLazReader).not.toHaveBeenCalled();
    expect(result.format).toBe('ascii-xyz');
  });
});
