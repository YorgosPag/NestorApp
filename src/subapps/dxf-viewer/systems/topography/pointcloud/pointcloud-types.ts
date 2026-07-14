/**
 * ADR-650 M8α — Point-cloud ingestion domain types (cloud → bare-earth → TopoPointStore).
 *
 * Big-player pattern (Autodesk ReCap / Civil 3D «Point Cloud to Surface», Trimble RealWorks,
 * CloudCompare): a point cloud is NOT a bag of survey points. It is a bulk, immutable buffer
 * that gets CLASSIFIED and then DECIMATED down to a survey-grade point set. Only that final,
 * thin set enters the existing `TopoPointStore` — from there `getTopoSurface()` gives contours,
 * 3D, QA and volumes for free (M1–M7, unchanged).
 *
 *   PointCloudData  →  GroundClassifyResult  →  voxel decimate  →  TopoPoint[]  →  TopoPointStore
 *   (millions)         (which idx are ground)   (thousands)        (existing SSoT)
 *
 * ⚠️ MEMORY — why structure-of-arrays (SoA) and not `{x,y,z}[]`:
 *   30M points as JS objects ≈ 3 GB heap → the tab dies. As typed arrays: 30M × 3 × 4B = 360 MB.
 *   This is exactly what Potree/PDAL/laz-perf do, and it mirrors the parallel-array layout the
 *   existing `TinSurface` already uses (`positions` / `elevations` / `triangles`).
 *
 * ⚠️ PRECISION — why a LOCAL origin and Float32:
 *   ΕΓΣΑ'87 easting in canonical mm is ~3e8..9e8. Float32 has a 24-bit mantissa, so a raw world
 *   mm value at 9e8 carries ~64 mm of error — worse than the survey tolerance it must preserve.
 *   Storing LOCAL mm (world − origin) keeps values inside a site extent (~2 km = 2e6 mm) where
 *   Float32 resolves to ≤0.25 mm. Identical trick, identical reason as `TinSurface.origin`
 *   (see topo-types.ts). Elevation stays WORLD (same convention as `TinSurface.elevations`);
 *   at 3e6 mm (3000 m, above Olympus) Float32 still resolves to ≤0.25 mm.
 *
 * ⚠️ NAMING — there is an unrelated `services/las-parser.ts` / `las-exporter.ts` in this repo for
 *   AutoCAD **Layer State** (.las) files. That is a namespace collision, NOT this format. Every
 *   symbol here is prefixed `pointCloud*` / `Asprs*` / `Las*Record` and lives in `pointcloud/`.
 *
 * There is NO logic in this file (types only — exempt from the 500-line rule).
 */

import type { LocalOrigin, TopoBounds } from '../topo-types';
import type { ColumnMapping, TopoUnit } from '../topo-import-types';

// ─── The bulk buffer ──────────────────────────────────────────────────────────

/**
 * An immutable point cloud, structure-of-arrays. All four arrays are `count` long and share
 * an index: point `i` is `(x[i], y[i], z[i])` with class `classification?.[i]`.
 *
 * Frames: `x`/`y` are LOCAL mm (add `origin` to get WORLD). `z` is WORLD mm.
 */
export interface PointCloudData {
  readonly count: number;
  /** LOCAL mm (world − origin). */
  readonly x: Float32Array;
  /** LOCAL mm (world − origin). */
  readonly y: Float32Array;
  /** WORLD mm elevation (never offset — mirrors `TinSurface.elevations`). */
  readonly z: Float32Array;
  /**
   * ASPRS classification byte per point, or `null` when the source carried none
   * (ASCII XYZ always; a LAS file whose points are all class 0 «never classified»).
   * When present, this is the field that lets us SKIP the CSF filter entirely —
   * see `GroundClassifyResult.method`.
   */
  readonly classification: Uint8Array | null;
  /** LOCAL→WORLD re-projection for `x`/`y`. */
  readonly origin: LocalOrigin;
  /** WORLD mm bounds (x/y re-projected, z as-is). */
  readonly bounds: TopoBounds;
}

// ─── Reading ──────────────────────────────────────────────────────────────────

/** Which concrete on-disk format a cloud came from. Drives the reader, not the pipeline. */
export type PointCloudFormat = 'ascii-xyz' | 'las' | 'laz';

/**
 * Header of an ASPRS LAS/LAZ file (the subset we consume). All coordinate fields are in the
 * file's own SOURCE units — the LAS spec does NOT state the unit anywhere in the header (it
 * lives in an optional CRS VLR). Like Civil 3D, we ask the user instead: the wizard's existing
 * `TopoUnit` dropdown supplies the scale, and the reader multiplies by `TOPO_UNIT_SCALE_TO_MM`.
 */
export interface LasHeader {
  readonly versionMajor: number;
  readonly versionMinor: number;
  /** Point Data Record Format, 0..10. Determines the byte layout of each point record. */
  readonly pointDataFormat: number;
  readonly pointDataRecordLength: number;
  readonly pointCount: number;
  readonly offsetToPointData: number;
  /** LAS stores X as int32; world = `int32 * scale + offset`, in SOURCE units. */
  readonly scale: LasVec3;
  readonly offset: LasVec3;
  readonly min: LasVec3;
  readonly max: LasVec3;
  /** True when the point data is LAZ-compressed (PDRF high bit set) → needs `laz-perf`. */
  readonly isCompressed: boolean;
}

export interface LasVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * ADR-650 M8β/Ε — the raw planimetric+vertical extent of a binary cloud, in the file's OWN source
 * units (unit-agnostic: `max − min` per axis, straight off the LAS/LAZ public header). It is the
 * seed for the wizard's unit readout — a LAS header does not state its unit (§ `LasHeader` doc),
 * so the engineer picks it, and this is the evidence that makes the pick verifiable.
 */
export interface CloudSourceExtent {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

/**
 * ADR-650 M8β/Ε — one row of the wizard's "what would the site measure under this unit" readout.
 * All three fields are METRES (the unit a surveyor reasons about a site extent in), so the engineer
 * reads down the three candidates and recognises the sane one — «200 × 180 m» is a plot, «0.2 m» is
 * not, «61 m» might be a small plot in feet. Deterministic, zero LLM.
 */
export interface UnitSpanReadout {
  readonly unit: TopoUnit;
  readonly widthMeters: number;
  readonly depthMeters: number;
  readonly heightMeters: number;
}

/** What every point-cloud reader returns. `warnings` are user-facing i18n KEYS, never text. */
export interface PointCloudReadResult {
  readonly data: PointCloudData;
  readonly format: PointCloudFormat;
  readonly stats: PointCloudStats;
  readonly warnings: readonly string[];
}

/** What the wizard shows the engineer BEFORE they commit — the human-certifier surface. */
export interface PointCloudStats {
  readonly totalPoints: number;
  readonly boundsWorldMm: TopoBounds;
  /** True when the source already carried a usable ASPRS classification (≥1 point not class 0). */
  readonly hasSourceClassification: boolean;
  /** `classCode → point count`, only when `hasSourceClassification`. Feeds the wizard's legend. */
  readonly classHistogram: Readonly<Record<number, number>> | null;
}

/** Options every reader accepts. `unit` comes from the wizard's existing TopoUnit dropdown. */
export interface PointCloudReadOptions {
  readonly unit: TopoUnit;
  /**
   * Hard ceiling on points held in memory. Beyond it the reader stride-samples while parsing
   * (never allocates the full buffer). Guards the tab against a 500M-point survey drop.
   */
  readonly maxPointsInMemory: number;
  /**
   * ADR-650 M8β/Δ — the engineer-certified column order of an ASCII cloud (`PENZD`, `PNEZD`, …),
   * the SAME `ColumnMapping` vocabulary the CSV/TXT road uses (`topo-import-types`). Only the
   * ASCII reader consults it; LAS/LAZ carry their columns in a binary header and ignore it.
   *
   * ABSENT (the default) → the reader keeps its historical «first three numeric fields» behaviour,
   * which is right for the bare `x y z` dump a scanner emits. PRESENT → X/Y/Z are read from the
   * declared columns, so a leading point-number column is a `pointId` and not an X.
   *
   * A plain `readonly string[]` — it crosses to the Worker by structured clone untouched.
   */
  readonly mapping?: ColumnMapping;
  /**
   * ADR-650 M8β/Δ — the ASCII cloud's field separator, as detected by the wizard (`detectDelimiter`,
   * the M2 SSoT). It travels WITH the mapping because it is what makes the mapping's column indices
   * mean anything: a Greek export (`1;345678,123;…`) split leniently tears its decimal commas into
   * extra fields and every index shifts. Absent → the historical lenient split.
   */
  readonly delimiter?: string;
}

// ─── Ground classification (bare-earth) ───────────────────────────────────────

/**
 * HOW the ground was decided. This distinction is the big-player behaviour that a naive
 * implementation misses: clouds from DJI Terra / Pix4D / Terrasolid arrive ALREADY classified
 * (ASPRS class 2 = Ground). ReCap and Civil 3D HONOUR that classification rather than
 * re-deriving it — re-running a filter over an already-classified cloud is slower AND worse
 * (the vendor had the raw returns; we only have XYZ).
 *   - `source-classification` — the file told us. Free, exact, preferred.
 *   - `csf`                   — we derived it ourselves (unclassified source, or user override).
 */
export type GroundFilterMethod = 'source-classification' | 'csf';

export interface GroundClassifyResult {
  /** Indices into `PointCloudData` that are bare earth. Sorted ascending. */
  readonly groundIndices: Uint32Array;
  readonly method: GroundFilterMethod;
  readonly groundCount: number;
  readonly nonGroundCount: number;
}

/**
 * Cloth Simulation Filter parameters (Zhang et al. 2016, Apache-2.0 reference implementation;
 * re-implemented in-house — zero dependency). These are the SAME four knobs CloudCompare's CSF
 * plugin and PDAL's `filters.csf` expose, with the same meaning, so an engineer who knows one
 * knows ours. Defaults live in `CSF_DEFAULTS` (pointcloud-defaults.ts), never inline.
 */
export interface CsfOptions {
  /** Cloth grid spacing in mm. Smaller = finer terrain detail, quadratically slower. */
  readonly clothResolutionMm: number;
  /** A point is ground when its distance to the settled cloth is ≤ this (mm). */
  readonly classThresholdMm: number;
  /** Terrain rigidness: 1 = steep slope, 2 = relief, 3 = flat. (CSF's `rigidness`.) */
  readonly rigidness: CsfRigidness;
  /** Simulation step size. The CSF paper's 0.65 is stable for all rigidness values. */
  readonly timeStep: number;
  readonly maxIterations: number;
  /** Post-pass that rescues points on steep slopes the cloth over-shot. CSF's `slope smoothing`. */
  readonly slopeSmoothing: boolean;
}

export type CsfRigidness = 1 | 2 | 3;

// ─── Decimation ───────────────────────────────────────────────────────────────

/**
 * WHICH point survives a voxel cell. For a DTM the honest default is `lowest`: after ground
 * filtering, any residual noise is almost always ABOVE the true surface (a missed shrub, a
 * mis-classified kerb), never below it. Taking the lowest Z per cell is the conservative,
 * survey-defensible choice and is what PDAL's `filters.sample`/CloudCompare's «minimum» do.
 */
export type VoxelRepresentative = 'lowest' | 'mean';

export interface VoxelDecimateOptions {
  /** Voxel cell size in mm (planimetric). The user's «point spacing» in the wizard. */
  readonly cellSizeMm: number;
  readonly representative: VoxelRepresentative;
}

/** Result of decimating a classified cloud down to a survey-grade point set. */
export interface DecimateResult {
  /** The thin set that enters `TopoPointStore`. WORLD mm — ready for `setTopoPoints`. */
  readonly points: readonly import('../topo-types').TopoPoint[];
  readonly inputCount: number;
  readonly cellsOccupied: number;
}

// ─── Worker protocol ──────────────────────────────────────────────────────────

/**
 * Main thread → worker. The `ArrayBuffer` is TRANSFERRED (not cloned) — a 250 MB LAZ file must
 * not be structured-cloned across the boundary. See `pointcloud-import.ts`.
 */
export interface PointCloudWorkerRequest {
  readonly type: 'read-and-classify';
  readonly requestId: string;
  readonly fileName: string;
  readonly buffer: ArrayBuffer;
  readonly read: PointCloudReadOptions;
  readonly csf: CsfOptions;
  readonly decimate: VoxelDecimateOptions;
  /** When true, run CSF even if the source carried a classification (engineer's override). */
  readonly forceCsf: boolean;
}

/** Worker → main thread. Progress is advisory; `done` / `error` are terminal. */
export type PointCloudWorkerResponse =
  | { readonly type: 'worker-ready' }
  | {
      readonly type: 'progress';
      readonly requestId: string;
      /** i18n KEY for the current stage — never user-facing text (N.11). */
      readonly stageKey: PointCloudStageKey;
      readonly ratio: number;
    }
  | {
      readonly type: 'done';
      readonly requestId: string;
      readonly result: PointCloudPipelineResult;
    }
  | {
      readonly type: 'error';
      readonly requestId: string;
      /** i18n KEY, never a raw message (N.11). */
      readonly errorKey: string;
      readonly detail?: string;
    };

export type PointCloudStageKey = 'reading' | 'classifying' | 'decimating';

/**
 * The full ingest answer the wizard renders and the engineer approves. Note it carries BOTH
 * the thin `points` (what commits to the store) AND `preview` (a display-decimated copy of the
 * RAW cloud for the 3D layer) — the engineer never filters blind (ReCap/CloudCompare parity).
 */
export interface PointCloudPipelineResult {
  readonly stats: PointCloudStats;
  readonly format: PointCloudFormat;
  readonly method: GroundFilterMethod;
  readonly groundCount: number;
  readonly nonGroundCount: number;
  /** Survey-grade thin set, WORLD mm → `setTopoPoints`. */
  readonly points: readonly import('../topo-types').TopoPoint[];
  /** Display-only decimated cloud for the 3D preview layer. Never enters the TIN. */
  readonly preview: PointCloudPreview;
  readonly warnings: readonly string[];
}

/**
 * Display-only cloud for the three.js `Points` layer. Capped at `PREVIEW_MAX_POINTS`; this is a
 * VISUAL artefact and is explicitly NOT survey geometry — it never reaches `TopoPointStore`,
 * never reaches the TIN, and must never be measured against (ADR-650 §6: visualization layer,
 * never geometry of measurement).
 */
export interface PointCloudPreview {
  readonly count: number;
  /** Interleaved LOCAL mm xyz — three.js `BufferAttribute`-ready. */
  readonly positions: Float32Array;
  /** Per-point RGB (0..1), coloured by ASPRS class. Null when the cloud is unclassified. */
  readonly colors: Float32Array | null;
  readonly origin: LocalOrigin;
}
