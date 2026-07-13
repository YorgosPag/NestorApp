/**
 * ADR-650 M8α — Point-cloud read dispatcher + the low-level pieces both readers share.
 *
 * This is the ONLY entry point the pipeline (worker, wizard) calls: give it the bytes and the
 * file name, it decides the format and hands back a `PointCloudReadResult`. Nobody outside the
 * `pointcloud/` folder should ever import `las-reader` / `ascii-xyz-reader` directly.
 *
 *   bytes + name → detectPointCloudFormat → readLasPointCloud | readLazPointCloud | readAsciiXyzPointCloud
 *
 * `laz-reader` is reached by DYNAMIC import — it drags in a 214 KB WASM module that an engineer who
 * only ever opens `.las`/`.xyz` must never be made to download.
 *
 * ⚠️ WHY THE SHARED HELPERS LIVE HERE (N.18 / ADR-584): the two readers differ only in how they
 * DECODE a point — the bookkeeping around it (stride sampling, bounds accumulation, assembling
 * the SoA result) is identical, and writing it twice is exactly the sibling-clone trap the jscpd
 * ratchet exists to catch. So the hub owns it once and both readers import it. That makes the
 * import graph a deliberate, benign cycle (hub ↔ readers): every symbol involved is a hoisted
 * pure function and nothing executes at module load, so no partial-initialisation hazard exists.
 *
 * Format detection is MAGIC-FIRST, extension-second — deliberately. A `.las` in this repo is just
 * as likely to be an AutoCAD **Layer State** file (`services/las-parser.ts`, unrelated format,
 * same extension); the `LASF` magic is what tells the two apart, and a Layer State file dropped
 * here fails honestly with `error.notLas` instead of being parsed into garbage points.
 */

import type { LocalOrigin, TopoBounds } from '../topo-types';
import { computeLocalOrigin } from '../topo-local-origin';
import { LAS_HEADER_OFFSETS, LAS_SIGNATURE, LAZ_COMPRESSION_MASK } from './asprs-las-spec';
import type {
  PointCloudData,
  PointCloudFormat,
  PointCloudReadOptions,
  PointCloudReadResult,
} from './pointcloud-types';
import { readLasPointCloud } from './las-reader';
import { readAsciiXyzPointCloud } from './ascii-xyz-reader';

// ─── i18n keys (N.11 — readers emit KEYS, never text) ─────────────────────────

/** Every user-facing key the readers can produce. Warnings and errors alike. */
export const POINTCLOUD_MSG = {
  ERROR_NOT_LAS: 'topography.pointcloud.error.notLas',
  ERROR_LAS_TRUNCATED: 'topography.pointcloud.error.lasTruncated',
  ERROR_LAZ_UNSUPPORTED: 'topography.pointcloud.error.lazUnsupported',
  ERROR_LAZ_RUNTIME_UNAVAILABLE: 'topography.pointcloud.error.lazRuntimeUnavailable',
  ERROR_LAZ_DECODE_FAILED: 'topography.pointcloud.error.lazDecodeFailed',
  ERROR_UNSUPPORTED_PDRF: 'topography.pointcloud.error.unsupportedPdrf',
  ERROR_NO_POINTS: 'topography.pointcloud.error.noPoints',
  WARN_STRIDE_SAMPLED: 'topography.pointcloud.warn.strideSampled',
  WARN_SKIPPED_LINES: 'topography.pointcloud.warn.skippedLines',
  WARN_TRUNCATED_POINT_DATA: 'topography.pointcloud.warn.truncatedPointData',
  WARN_RECORD_LENGTH_MISMATCH: 'topography.pointcloud.warn.recordLengthMismatch',
  WARN_HEADER_BOUNDS_INVALID: 'topography.pointcloud.warn.headerBoundsInvalid',
} as const;

// ─── Format detection ─────────────────────────────────────────────────────────

const LAS_EXTENSIONS: readonly string[] = ['.las'];
const LAZ_EXTENSIONS: readonly string[] = ['.laz'];

/** Read the 4 magic bytes as ASCII (`''` when the buffer is too short to hold them). */
function readMagic(buffer: ArrayBuffer): string {
  if (buffer.byteLength < 4) return '';
  const bytes = new Uint8Array(buffer, 0, 4);
  return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

/**
 * Which concrete format the bytes are. The `LASF` magic wins over the extension; only when the
 * magic is absent does the extension get a say, and the final fallback is plain text (ASCII XYZ),
 * because every other survey drop we accept is text.
 */
export function detectPointCloudFormat(fileName: string, buffer: ArrayBuffer): PointCloudFormat {
  if (readMagic(buffer) === LAS_SIGNATURE) {
    return isLazCompressed(buffer) ? 'laz' : 'las';
  }
  const ext = extensionOf(fileName);
  if (LAZ_EXTENSIONS.includes(ext)) return 'laz';
  if (LAS_EXTENSIONS.includes(ext)) return 'las';
  return 'ascii-xyz';
}

/** LAZ sets the two high bits of the Point Data Format byte; the rest of the header is LAS. */
function isLazCompressed(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength <= LAS_HEADER_OFFSETS.POINT_DATA_FORMAT) return false;
  const raw = new DataView(buffer).getUint8(LAS_HEADER_OFFSETS.POINT_DATA_FORMAT);
  return (raw & LAZ_COMPRESSION_MASK) !== 0;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Read any supported point cloud into the canonical SoA buffer.
 *
 * ⚠️ ASYNC SINCE M8β, and that is not incidental. LAZ decompression is WebAssembly, and a WASM
 * module can only be instantiated asynchronously — so the honest signature for «read a point
 * cloud» is a Promise. The two synchronous readers are simply awaited through it; `.las` and
 * `.xyz` pay nothing (the laz-perf module is behind a dynamic import and is never even fetched
 * unless a `.laz` arrives). `onProgress` receives 0..1 and is advisory.
 *
 * @throws Error whose `message` is an i18n KEY from {@link POINTCLOUD_MSG} (N.11).
 */
export async function readPointCloud(
  buffer: ArrayBuffer,
  fileName: string,
  opts: PointCloudReadOptions,
  onProgress?: (ratio: number) => void,
): Promise<PointCloudReadResult> {
  const format = detectPointCloudFormat(fileName, buffer);
  if (format === 'laz') {
    const { readLazPointCloud } = await import('./laz-reader');
    return readLazPointCloud(buffer, opts, onProgress);
  }
  if (format === 'las') return readLasPointCloud(buffer, opts, onProgress);

  const text = new TextDecoder('utf-8').decode(buffer);
  return readAsciiXyzPointCloud(text, opts, onProgress);
}

// ─── Shared: stride sampling ──────────────────────────────────────────────────

/**
 * How many source points to skip between kept points so the result fits `maxPointsInMemory`.
 * `1` = keep everything. The readers apply this DURING the parse — they never allocate the full
 * cloud and then throw points away (that is the whole point of the ceiling).
 */
export function computeStride(pointCount: number, maxPointsInMemory: number): number {
  if (maxPointsInMemory <= 0 || pointCount <= maxPointsInMemory) return 1;
  return Math.ceil(pointCount / maxPointsInMemory);
}

/** How many points survive `computeStride` — the exact length of the typed arrays to allocate. */
export function sampledCount(pointCount: number, stride: number): number {
  return stride <= 1 ? pointCount : Math.ceil(pointCount / stride);
}

// ─── Shared: bounds accumulation ──────────────────────────────────────────────

/** Growable WORLD-mm bounds, filled point by point while a reader streams. */
export interface MutableBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function createBounds(): MutableBounds {
  return {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
}

export function growBounds(b: MutableBounds, x: number, y: number, z: number): void {
  if (x < b.minX) b.minX = x;
  if (x > b.maxX) b.maxX = x;
  if (y < b.minY) b.minY = y;
  if (y > b.maxY) b.maxY = y;
  if (z < b.minZ) b.minZ = z;
  if (z > b.maxZ) b.maxZ = z;
}

/** True once at least one point has been seen (an untouched accumulator stays infinite). */
export function hasBounds(b: MutableBounds): boolean {
  return Number.isFinite(b.minX) && Number.isFinite(b.minY) && Number.isFinite(b.minZ);
}

export function freezeBounds(b: MutableBounds): TopoBounds {
  return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, minZ: b.minZ, maxZ: b.maxZ };
}

/**
 * The LOCAL origin for a cloud with these WORLD bounds. Delegates to the topography SSoT
 * (`computeLocalOrigin`, ADR-650 M1) so the «floored min corner» convention is defined exactly
 * once for the TIN, the contours AND the cloud — a cloud offset by a different rule than the TIN
 * it feeds would put the surface metres away from the points that made it.
 */
export function localOriginFromBounds(bounds: TopoBounds): LocalOrigin {
  return computeLocalOrigin([{ x: bounds.minX, y: bounds.minY, z: bounds.minZ }]);
}

// ─── Shared: result assembly ──────────────────────────────────────────────────

export interface ReadResultParts {
  readonly format: PointCloudFormat;
  /** LOCAL mm. */
  readonly x: Float32Array;
  /** LOCAL mm. */
  readonly y: Float32Array;
  /** WORLD mm. */
  readonly z: Float32Array;
  /** Already decided by the reader: `null` when the source carried no usable classification. */
  readonly classification: Uint8Array | null;
  /** `classCode → count` over the STORED points; `null` when `classification` is null. */
  readonly classHistogram: Readonly<Record<number, number>> | null;
  readonly origin: LocalOrigin;
  /** WORLD mm bounds of the STORED points (post stride-sampling — never the source's claim). */
  readonly bounds: TopoBounds;
  readonly warnings: readonly string[];
}

/**
 * Assemble the immutable `PointCloudReadResult` both readers return.
 *
 * `stats.totalPoints` is the number of points actually HELD (`data.count`), not the source's
 * point count: when the cloud was stride-sampled the two differ, and every downstream consumer
 * (CSF, decimation, preview) indexes into what is held. The `warn.strideSampled` warning is what
 * tells the engineer the source was bigger.
 */
export function buildReadResult(parts: ReadResultParts): PointCloudReadResult {
  const data: PointCloudData = {
    count: parts.x.length,
    x: parts.x,
    y: parts.y,
    z: parts.z,
    classification: parts.classification,
    origin: parts.origin,
    bounds: parts.bounds,
  };
  return {
    data,
    format: parts.format,
    stats: {
      totalPoints: data.count,
      boundsWorldMm: parts.bounds,
      hasSourceClassification: parts.classification !== null,
      classHistogram: parts.classification !== null ? parts.classHistogram : null,
    },
    warnings: parts.warnings,
  };
}
