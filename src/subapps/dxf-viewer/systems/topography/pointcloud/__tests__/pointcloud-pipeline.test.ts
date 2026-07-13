/**
 * ADR-650 M8α — end-to-end pipeline test (main thread only — jsdom has no `Worker`, so the
 * Worker routing itself is NOT exercised here; that lives in `io/pointcloud-import.ts` /
 * `workers/pointcloud.worker.ts`, mirroring how `io/__tests__/dxf-import-worker-routing.test.ts`
 * mocks the Worker instead of running jsdom against one).
 *
 * Ground truth: a synthetic FLAT ASCII XYZ grid (6×6 points, 2 m spacing, 100 m elevation).
 * ASCII XYZ carries no ASPRS classification, so the pipeline must fall through to CSF — and on a
 * perfectly flat surface CSF settles the cloth exactly onto every point, so the ground-truth
 * expectation ("every point survives as ground, at exactly 100 m") is unambiguous.
 */

import { runPointCloudPipeline, type PointCloudPipelineOptions } from '../pointcloud-pipeline';
import { CSF_DEFAULTS, VOXEL_DEFAULTS, READ_DEFAULTS } from '../pointcloud-defaults';
import { PREVIEW_MAX_POINTS } from '../pointcloud-defaults';
import type { PointCloudStageKey } from '../pointcloud-types';

const GRID_SIZE = 6;
const STEP_M = 2;
const ELEVATION_M = 100;

/** `X Y Z` per line, metres, one point per grid cell — the zero-config ASCII XYZ convention. */
function buildFlatGridXyzText(): string {
  const lines: string[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      lines.push(`${col * STEP_M} ${row * STEP_M} ${ELEVATION_M}`);
    }
  }
  return lines.join('\n');
}

function textToBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

const PIPELINE_OPTS: PointCloudPipelineOptions = {
  read: { ...READ_DEFAULTS, unit: 'm' },
  csf: CSF_DEFAULTS,
  decimate: VOXEL_DEFAULTS,
  forceCsf: false,
};

describe('runPointCloudPipeline (ADR-650 M8α)', () => {
  it('turns a flat ASCII XYZ grid into WORLD-mm ground points + a bounded preview', async () => {
    const buffer = textToBuffer(buildFlatGridXyzText());
    const result = await runPointCloudPipeline(buffer, 'flat-grid.xyz', PIPELINE_OPTS);

    expect(result.format).toBe('ascii-xyz');
    expect(result.method).toBe('csf'); // ASCII carries no classification — always derived
    expect(result.groundCount).toBe(GRID_SIZE * GRID_SIZE);
    expect(result.nonGroundCount).toBe(0);

    expect(result.points.length).toBeGreaterThan(0);
    for (const p of result.points) {
      expect(p.z).toBeCloseTo(ELEVATION_M * 1000, 0); // canonical mm, flat surface
    }

    expect(result.preview.count).toBeGreaterThan(0);
    expect(result.preview.count).toBeLessThanOrEqual(PREVIEW_MAX_POINTS);
    expect(result.preview.positions.length).toBe(result.preview.count * 3);
  });

  it('reports progress stages in order: reading → classifying → decimating', async () => {
    const buffer = textToBuffer(buildFlatGridXyzText());
    const seenStages: PointCloudStageKey[] = [];
    await runPointCloudPipeline(buffer, 'flat-grid.xyz', PIPELINE_OPTS, (stageKey) => {
      if (seenStages[seenStages.length - 1] !== stageKey) seenStages.push(stageKey);
    });

    expect(seenStages).toEqual(['reading', 'classifying', 'decimating']);
  });

  it('colours the preview uniformly ground (earth tone) on an all-ground flat cloud', async () => {
    const buffer = textToBuffer(buildFlatGridXyzText());
    const result = await runPointCloudPipeline(buffer, 'flat-grid.xyz', PIPELINE_OPTS);

    expect(result.preview.colors).not.toBeNull();
    const colors = result.preview.colors!;
    const first: readonly number[] = [colors[0]!, colors[1]!, colors[2]!];
    for (let i = 0; i < result.preview.count; i++) {
      expect([colors[i * 3]!, colors[i * 3 + 1]!, colors[i * 3 + 2]!]).toEqual(first);
    }
    // Earth tone (ASPRS_CLASS_COLOR[GROUND]), not the grey non-ground fallback.
    expect(first[0]).toBeGreaterThan(first[2]!); // brown: R > B
  });

  it('propagates an i18n-key Error for an unparsable (empty) cloud', async () => {
    const buffer = textToBuffer('# nothing but a comment\n');
    await expect(runPointCloudPipeline(buffer, 'empty.xyz', PIPELINE_OPTS)).rejects.toThrow(
      /^topography\.pointcloud\./,
    );
  });
});
