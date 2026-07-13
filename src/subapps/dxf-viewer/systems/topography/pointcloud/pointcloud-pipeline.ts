/**
 * ADR-650 M8α — the pure ingest pipeline: cloud bytes → bare-earth → survey-grade point set.
 *
 *   readPointCloud → classifyGround → voxelDecimate → buildCloudPreview
 *
 * Deliberately pure (no store, no DOM, no Worker API) so it runs IDENTICALLY on the main thread
 * (small files, `io/pointcloud-import.ts`) and inside `workers/pointcloud.worker.ts` (large
 * files) — the exact "same SSoT on both sides of the boundary" pattern `utils/run-dxf-parse.ts`
 * uses for the DXF parser. Errors propagate as thrown `Error`s whose `message` is an i18n KEY
 * (N.11) — every stage below already honours that (`POINTCLOUD_MSG`, `VOXEL_ERROR_*`).
 */

import type {
  CsfOptions,
  PointCloudPipelineResult,
  PointCloudReadOptions,
  PointCloudStageKey,
  VoxelDecimateOptions,
} from './pointcloud-types';
import { readPointCloud } from './pointcloud-read';
import { classifyGround } from './classify-ground';
import { voxelDecimate } from './voxel-decimate';
import { buildCloudPreview } from './pointcloud-preview';

export interface PointCloudPipelineOptions {
  readonly read: PointCloudReadOptions;
  readonly csf: CsfOptions;
  readonly decimate: VoxelDecimateOptions;
  /** When true, run CSF even if the source carried a classification (engineer's override). */
  readonly forceCsf: boolean;
}

/**
 * Run the full ingest pipeline over one file's bytes.
 *
 * ⚠️ ASYNC SINCE M8β — only because the READ stage is (LAZ decompression is WebAssembly, which
 * cannot be instantiated synchronously). Classification, decimation and preview are unchanged pure
 * synchronous CPU work; nothing here yields between them.
 *
 * @param onProgress advisory, fired per stage with a 0..1 ratio WITHIN that stage; the caller
 *   (worker or `importPointCloud`) decides how to blend the three stages into one overall bar.
 * @throws Error whose `message` is an i18n KEY — never caught/wrapped here (N.11: the caller,
 *   not this pure core, decides how an error becomes user-facing text).
 */
export async function runPointCloudPipeline(
  buffer: ArrayBuffer,
  fileName: string,
  opts: PointCloudPipelineOptions,
  onProgress?: (stageKey: PointCloudStageKey, ratio: number) => void,
): Promise<PointCloudPipelineResult> {
  const read = await readPointCloud(buffer, fileName, opts.read, (ratio) => onProgress?.('reading', ratio));

  const ground = classifyGround(read.data, opts.csf, opts.forceCsf, (ratio) =>
    onProgress?.('classifying', ratio),
  );

  onProgress?.('decimating', 0);
  const decimated = voxelDecimate(read.data, ground.groundIndices, opts.decimate);
  onProgress?.('decimating', 1);

  const preview = buildCloudPreview(read.data, ground);

  return {
    stats: read.stats,
    format: read.format,
    method: ground.method,
    groundCount: ground.groundCount,
    nonGroundCount: ground.nonGroundCount,
    points: decimated.points,
    preview,
    warnings: read.warnings,
  };
}
