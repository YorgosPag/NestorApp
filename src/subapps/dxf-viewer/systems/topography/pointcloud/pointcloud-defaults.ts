/**
 * ADR-650 M8α — Tunable defaults for the point-cloud ingest pipeline.
 *
 * Every magic number the pipeline uses lives HERE (SSoT). No inline literals in the readers,
 * the CSF filter, the decimator or the wizard. Values are canonical mm (ADR-462) unless the
 * name says otherwise.
 *
 * Config only — no logic (exempt from the 500-line rule).
 */

import { DXF_TIMING } from '../../../config/dxf-timing';
import type { CsfOptions, VoxelDecimateOptions, PointCloudReadOptions } from './pointcloud-types';

/**
 * CSF defaults. Taken from the Zhang et al. (2016) paper's recommended settings and the values
 * CloudCompare ships in its CSF plugin — an engineer who has used CloudCompare will recognise
 * every one of these. `rigidness: 2` («relief») is the safe middle for Greek terrain: plots are
 * rarely table-flat but rarely alpine either.
 */
export const CSF_DEFAULTS: CsfOptions = {
  clothResolutionMm: 500, // 0.5 m — matches the default survey point spacing below
  classThresholdMm: 500, // 0.5 m
  rigidness: 2,
  timeStep: 0.65,
  maxIterations: 500,
  slopeSmoothing: true,
};

/**
 * Decimation defaults. 0.5 m spacing on a 1-hectare plot yields ~40 000 points — dense enough
 * that the TIN captures every real break, thin enough that `cdt2d` runs in well under a second.
 * `lowest` is the conservative DTM representative (see `VoxelRepresentative` doc).
 */
export const VOXEL_DEFAULTS: VoxelDecimateOptions = {
  cellSizeMm: 500,
  representative: 'lowest',
};

/**
 * Hard ceiling on points held in RAM while reading. 30M × 3 × 4 B = 360 MB of typed array, plus
 * the classification byte array — already at the edge of what a browser tab tolerates alongside
 * the DXF scene. Past this the reader STRIDE-SAMPLES during the parse (it never allocates the
 * full buffer and then throws points away).
 */
export const READ_DEFAULTS: Omit<PointCloudReadOptions, 'unit'> = {
  maxPointsInMemory: 30_000_000,
};

/**
 * ADR-650 M8β/Δ — how much of an ASCII cloud the wizard reads to PROPOSE a column mapping.
 *
 * 64 KB is the head slice pulled off the `File` (never the whole 250 MB — the sniff happens before
 * the engineer has even pressed «filter»), and 50 data rows is what the sniffer reasons over. Fifty
 * rows is enough for the two signals that matter — «is this column a strictly increasing integer»
 * (a point id) and «is this column orders of magnitude smaller» (an elevation) — while staying
 * small enough that the grid preview and the sniff read the exact same rows.
 */
export const ASCII_SNIFF_BYTES = 64 * 1024;
export const ASCII_SNIFF_ROWS = 50;

/**
 * ADR-650 M8β — the LAZ ceiling, and why it is LOWER than the LAS one.
 *
 * A `.las` decodes IN PLACE: the reader walks the file's own bytes and writes straight into the
 * SoA arrays. A `.laz` cannot — the records only exist once laz-perf has decoded them, so they must
 * be materialised into a transient uncompressed buffer first (~34 B per kept point, freed as soon
 * as the SoA arrays are built). 12M points × 34 B ≈ 400 MB of that buffer, on top of the ~160 MB of
 * SoA arrays it produces: a peak a browser tab survives. The full 30M would not be.
 *
 * Past this the cloud is STRIDE-SAMPLED during decompression and the engineer is told so
 * (`warn.strideSampled`). It costs him nothing real: the surveyed geometry is the decimated ground
 * set (voxel, 0.5 m → tens of thousands of points), not the raw cloud.
 */
export const LAZ_MAX_POINTS_IN_MEMORY = 12_000_000;

/**
 * Ceiling for the raw-cloud 3D preview layer. 2M points is comfortably interactive as a single
 * `THREE.Points` draw call on integrated graphics, and is plenty to SEE the site. This is a
 * visual budget, not a survey one — the measured geometry is the decimated ground set, which
 * has its own (much lower) count.
 */
export const PREVIEW_MAX_POINTS = 2_000_000;

/** Point size (px) for the 3D preview cloud — a single flat splat, no attenuation. */
export const PREVIEW_POINT_SIZE_PX = 1.5;

/**
 * Guard rail on the CSF cloth grid. A 0.1 m cloth over a 2 km site would be 20 000² = 400M
 * particles. Beyond this many the filter refuses and the wizard tells the engineer to coarsen
 * the cloth resolution — an honest failure beats a frozen tab.
 */
export const CSF_MAX_CLOTH_PARTICLES = 4_000_000;

/**
 * Below this many points, skip the worker entirely and run on the main thread — spawning a
 * worker and transferring the buffer costs more than the parse itself. Mirrors the DXF import
 * threshold pattern (`DXF_IMPORT_THRESHOLDS.WORKER_PARSE_MIN_BYTES`).
 */
export const POINTCLOUD_WORKER_MIN_BYTES = 2 * 1024 * 1024;

/**
 * Worker liveness + parse ceilings, mirroring `DXF_IMPORT_THRESHOLDS` (ADR-639 Στάδιο 1).
 * The ms themselves live in DXF_TIMING (ADR-516) — every timing literal in the viewer has ONE home.
 * These are named re-exports so the pipeline reads in its own vocabulary without a second source.
 */
export const POINTCLOUD_WORKER_READY_PROBE_MS = DXF_TIMING.lifecycle.POINTCLOUD_WORKER_READY_PROBE;
export const POINTCLOUD_WORKER_TIMEOUT_MS = DXF_TIMING.lifecycle.POINTCLOUD_WORKER_PARSE_TIMEOUT;
