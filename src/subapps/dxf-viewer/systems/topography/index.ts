/**
 * ADR-650 Milestone 1 — topography subsystem barrel.
 *
 * Pipeline: TopoPointStore (raw SSoT) → generateContours (CDT → marching → chain) →
 * buildContourEntities → completeEntity. See ADR-650 §12.1.
 */

export * from './topo-types';
export * from './contour-config';
export * from './topo-local-origin';
export * from './TopoPointStore';
export { buildTin } from './tin-builder';
export { generateLevels, generateContourSegments } from './marching-triangles';
export { chainContours } from './contour-chainer';
export { generateContours, type ContourResult } from './contour-generator';
export {
  buildContourEntities, formatElevationLabel, type ContourLayerIds,
} from './topo-to-entities';
export { ensureContourLayers } from './ensure-contour-layers';
export { parseTopoPoints, type ParseTopoResult } from './parse-topo-points';
// ADR-650 M6 — όγκοι cut/fill: ο ίδιος TIN, τρίτη «στιλιστική» ανάγνωση (πρίσματα + daylight split).
export { getTopoSurface, hasTopoSurface, invalidateTopoSurface } from './topo-surface';
export {
  computeCutFill, datumReference, surfaceReference, type ElevationReference,
} from './cut-fill';
export {
  crossCheckCutFill, CUTFILL_DIVERGENCE_WARN_PCT, type CutFillCrossCheck,
} from './cut-fill-crosscheck';
export { createTinSampler, type TinSampler } from './tin-sampler';
// NOTE: `useTopoContours` (React hook) is deliberately NOT re-exported here — this barrel
// stays React-free so the pure geometry can be imported anywhere (incl. server) without
// pulling React in (mirror του formatting-barrel React-leak gotcha). Import the hook directly.

// ADR-650 M8α — point cloud → bare-earth ground filter → TopoPointStore (§12.1 pipeline extends
// with `PointCloudData → GroundClassifyResult → voxel decimate → TopoPoint[]`). The Worker
// (`workers/pointcloud.worker.ts`) and the import entry point (`io/pointcloud-import.ts`) are
// deliberately NOT re-exported here: a Worker module cannot be imported like a normal module, and
// `io/` is its own layer (mirrors `io/dxf-import.ts` staying out of any barrel).
export * from './pointcloud/pointcloud-types';
export * from './pointcloud/pointcloud-defaults';
// M8β: `pointcloud/laz-reader` (+ `laz-runtime`, `laz-wasm-url`) are deliberately NOT re-exported
// either. They pull in the 214 KB laz-perf WASM module, and `readPointCloud` reaches them through a
// DYNAMIC import so that cost lands only on an engineer who actually opens a `.laz`. A barrel
// re-export would make it static again and hand the bill to everyone.
export { readPointCloud, detectPointCloudFormat, POINTCLOUD_MSG } from './pointcloud/pointcloud-read';
export { classifyGround } from './pointcloud/classify-ground';
export { voxelDecimate, VOXEL_ERROR_INVALID_CELL_SIZE } from './pointcloud/voxel-decimate';
export { buildCloudPreview } from './pointcloud/pointcloud-preview';
export { runPointCloudPipeline, type PointCloudPipelineOptions } from './pointcloud/pointcloud-pipeline';
