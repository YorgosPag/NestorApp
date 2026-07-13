/**
 * ADR-650 M8α — ASPRS LAS reader (LAS 1.0 → 1.4, Point Data Record Formats 0–10).
 *
 * The spec's one gift to a reader: in EVERY PDRF the first 12 bytes are `int32 x, int32 y,
 * int32 z`, and world = `int32 * scale + offset` (in the file's own source units). So a reader
 * needs exactly three things per format — the record length, where the classification byte sits,
 * and whether that byte needs the legacy 5-bit mask. All three live in `asprs-las-spec.ts`; not
 * one of them is re-derived here.
 *
 * ⚠️ UNITS. The LAS public header does NOT say what unit its coordinates are in (it lives in an
 * optional CRS VLR that half the instruments omit). Civil 3D asks the user; so do we — `opts.unit`
 * comes from the wizard's existing `TopoUnit` dropdown and scales through `TOPO_UNIT_SCALE_TO_MM`.
 *
 * ⚠️ LAZ (M8β). A `.laz` is this same header followed by arithmetic-coded chunks. Once `laz-reader`
 * has run those chunks through laz-perf it holds UNCOMPRESSED point records in exactly the layout
 * below — so it does not re-derive any of this: it hands the records to {@link decodeLasRecords},
 * the one decoder both formats share (N.18 — a second copy of the hot loop is the sibling-clone
 * trap). This file stays synchronous; only the WASM decompression upstream of it is async.
 *
 * ⚠️ NOT AutoCAD Layer State. `services/las-parser.ts` handles those `.las` files. The `LASF`
 * magic is the discriminator; a Layer State file lands on `error.notLas`.
 */

import { TOPO_UNIT_SCALE_TO_MM } from '../topo-import-types';
import type { LocalOrigin, TopoBounds } from '../topo-types';
import {
  LAS_14_HEADER_SIZE,
  LAS_CLASSIFICATION_OFFSET,
  LAS_HEADER_OFFSETS,
  LAS_PDRF_MASK,
  LAS_RECORD_LENGTH,
  LAS_SIGNATURE,
  LAS_XYZ_OFFSETS,
  LAS_14_PDRF_MIN,
  LAZ_COMPRESSION_MASK,
  LEGACY_CLASS_MASK,
} from './asprs-las-spec';
import type {
  LasHeader,
  LasVec3,
  PointCloudFormat,
  PointCloudReadOptions,
  PointCloudReadResult,
} from './pointcloud-types';
import {
  POINTCLOUD_MSG,
  buildReadResult,
  computeStride,
  createBounds,
  freezeBounds,
  growBounds,
  localOriginFromBounds,
  sampledCount,
} from './pointcloud-read';

/** Smallest public header we can read every field we need out of (LAS 1.0 header size). */
const MIN_HEADER_BYTES = 227;

/** How often the parse loop reports progress. A power of two so the check is a cheap mask. */
const PROGRESS_POINT_STRIDE = 1 << 20;

// ─── Public header ────────────────────────────────────────────────────────────

function readSignature(view: DataView): string {
  return String.fromCharCode(
    view.getUint8(LAS_HEADER_OFFSETS.SIGNATURE),
    view.getUint8(LAS_HEADER_OFFSETS.SIGNATURE + 1),
    view.getUint8(LAS_HEADER_OFFSETS.SIGNATURE + 2),
    view.getUint8(LAS_HEADER_OFFSETS.SIGNATURE + 3),
  );
}

/** Three consecutive float64 (x, y, z) starting at `offset`. */
function readVec3(view: DataView, offset: number): LasVec3 {
  return {
    x: view.getFloat64(offset, true),
    y: view.getFloat64(offset + 8, true),
    z: view.getFloat64(offset + 16, true),
  };
}

/** The spec stores bounds as max,min PER AXIS (not min,max) — a classic off-by-one-field bug. */
function readHeaderBounds(view: DataView): { min: LasVec3; max: LasVec3 } {
  const o = LAS_HEADER_OFFSETS;
  return {
    max: { x: view.getFloat64(o.MAX_X, true), y: view.getFloat64(o.MAX_Y, true), z: view.getFloat64(o.MAX_Z, true) },
    min: { x: view.getFloat64(o.MIN_X, true), y: view.getFloat64(o.MIN_Y, true), z: view.getFloat64(o.MIN_Z, true) },
  };
}

/**
 * LAS ≤1.3 carries a uint32 point count; LAS 1.4 added a uint64 that SUPERSEDES it whenever the
 * legacy field is zero (which is what a >4 G-point file must write). Take the larger truth.
 */
function readPointCount(view: DataView, headerSize: number): number {
  const legacy = view.getUint32(LAS_HEADER_OFFSETS.LEGACY_POINT_COUNT, true);
  if (headerSize < LAS_14_HEADER_SIZE) return legacy;
  if (view.byteLength < LAS_HEADER_OFFSETS.POINT_COUNT_14 + 8) return legacy;
  const wide = Number(view.getBigUint64(LAS_HEADER_OFFSETS.POINT_COUNT_14, true));
  return wide > 0 ? wide : legacy;
}

/**
 * Parse the LAS public header block.
 *
 * @throws Error(`error.notLas`) when the magic is not `LASF`, or (`error.lasTruncated`) when the
 *         buffer is too small to even hold a public header.
 */
export function readLasHeader(buffer: ArrayBuffer): LasHeader {
  if (buffer.byteLength < MIN_HEADER_BYTES) throw new Error(POINTCLOUD_MSG.ERROR_LAS_TRUNCATED);
  const view = new DataView(buffer);
  if (readSignature(view) !== LAS_SIGNATURE) throw new Error(POINTCLOUD_MSG.ERROR_NOT_LAS);

  const o = LAS_HEADER_OFFSETS;
  const headerSize = view.getUint16(o.HEADER_SIZE, true);
  const rawFormat = view.getUint8(o.POINT_DATA_FORMAT);
  const { min, max } = readHeaderBounds(view);

  return {
    versionMajor: view.getUint8(o.VERSION_MAJOR),
    versionMinor: view.getUint8(o.VERSION_MINOR),
    pointDataFormat: rawFormat & LAS_PDRF_MASK,
    pointDataRecordLength: view.getUint16(o.POINT_DATA_RECORD_LENGTH, true),
    pointCount: readPointCount(view, headerSize),
    offsetToPointData: view.getUint32(o.OFFSET_TO_POINT_DATA, true),
    scale: readVec3(view, o.SCALE_X),
    offset: readVec3(view, o.OFFSET_X),
    min,
    max,
    isCompressed: (rawFormat & LAZ_COMPRESSION_MASK) !== 0,
  };
}

// ─── Point records ────────────────────────────────────────────────────────────

/**
 * `world_mm = int32 * (scale * unitScale) + (offset * unitScale)` — the two per-axis constants
 * are folded ONCE so the hot loop is a multiply-add per coordinate instead of two.
 */
interface WorldTransform {
  readonly mx: number;
  readonly my: number;
  readonly mz: number;
  readonly bx: number;
  readonly by: number;
  readonly bz: number;
}

function worldTransform(header: LasHeader, unitScale: number): WorldTransform {
  return {
    mx: header.scale.x * unitScale,
    my: header.scale.y * unitScale,
    mz: header.scale.z * unitScale,
    bx: header.offset.x * unitScale,
    by: header.offset.y * unitScale,
    bz: header.offset.z * unitScale,
  };
}

/**
 * A PDRF this build knows the layout of (0–10). Shared with the LAZ reader: laz-perf hands back
 * records in the PDRF the header declares, so an unknown format is just as undecodable compressed
 * as it is raw — and must fail BEFORE we pay for a WASM instantiation.
 *
 * @throws Error(`error.unsupportedPdrf`)
 */
export function assertSupportedPdrf(header: LasHeader): void {
  if (LAS_RECORD_LENGTH[header.pointDataFormat] === undefined) {
    throw new Error(POINTCLOUD_MSG.ERROR_UNSUPPORTED_PDRF);
  }
}

/** Bytes per record: the header's own value wins (a file may pad), but never below the spec's. */
export function resolveRecordLength(header: LasHeader, warnings: string[]): number {
  const spec = LAS_RECORD_LENGTH[header.pointDataFormat];
  if (header.pointDataRecordLength >= spec) return header.pointDataRecordLength;
  warnings.push(POINTCLOUD_MSG.WARN_RECORD_LENGTH_MISMATCH);
  return spec;
}

/** How many records the file can actually hold — a truncated download must not read past the end. */
function resolvePointCount(
  header: LasHeader,
  byteLength: number,
  recordLength: number,
  warnings: string[],
): number {
  const available = Math.max(0, Math.floor((byteLength - header.offsetToPointData) / recordLength));
  if (available < header.pointCount) {
    warnings.push(POINTCLOUD_MSG.WARN_TRUNCATED_POINT_DATA);
    return available;
  }
  return header.pointCount;
}

/** LAS ≤1.3 packs class flags into the top 3 bits; LAS 1.4 (PDRF ≥6) gives the class a full byte. */
function readClassification(view: DataView, record: number, offset: number, legacy: boolean): number {
  const raw = view.getUint8(record + offset);
  return legacy ? raw & LEGACY_CLASS_MASK : raw;
}

// ─── Origin ───────────────────────────────────────────────────────────────────

/** Slack (mm) allowed when checking a point against the header's declared bounds. */
const BOUNDS_TOLERANCE_MM = 1;

/** The header's min/max block, scaled from the file's source unit to canonical mm. */
function headerBoundsWorldMm(header: LasHeader, unitScale: number): TopoBounds {
  return {
    minX: header.min.x * unitScale,
    minY: header.min.y * unitScale,
    minZ: header.min.z * unitScale,
    maxX: header.max.x * unitScale,
    maxY: header.max.y * unitScale,
    maxZ: header.max.z * unitScale,
  };
}

/**
 * Is the header's min/max block believable? Finite, correctly ordered — AND it must actually
 * CONTAIN the first point. That last check is the one that matters: writing an all-zero bounds
 * block is a common instrument bug, and a zero block passes «finite and ordered» while being a
 * lie. Believing it would put the origin at 0,0 and hand Float32 raw ΕΓΣΑ'87 magnitudes, which
 * silently eats ~64 mm per coordinate — the exact precision failure the LOCAL frame exists to
 * prevent.
 */
function boundsAreBelievable(view: DataView, layout: ScanLayout, t: WorldTransform, b: TopoBounds): boolean {
  const values = [b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ];
  if (!values.every((v) => Number.isFinite(v))) return false;
  if (b.minX > b.maxX || b.minY > b.maxY || b.minZ > b.maxZ) return false;

  const wx = view.getInt32(layout.base + LAS_XYZ_OFFSETS.X, true) * t.mx + t.bx;
  const wy = view.getInt32(layout.base + LAS_XYZ_OFFSETS.Y, true) * t.my + t.by;
  const tol = BOUNDS_TOLERANCE_MM;
  return wx >= b.minX - tol && wx <= b.maxX + tol && wy >= b.minY - tol && wy <= b.maxY + tol;
}

/**
 * The LOCAL origin. The header's min corner gives it away for free; when the header lies we pay
 * for one extra (allocation-free) scan of the int32 XYZ rather than accept a wrong origin.
 */
function resolveOrigin(
  view: DataView,
  header: LasHeader,
  layout: ScanLayout,
  t: WorldTransform,
  warnings: string[],
): LocalOrigin {
  const declared = headerBoundsWorldMm(header, TOPO_UNIT_SCALE_TO_MM[layout.unit]);
  if (boundsAreBelievable(view, layout, t, declared)) return localOriginFromBounds(declared);

  warnings.push(POINTCLOUD_MSG.WARN_HEADER_BOUNDS_INVALID);
  return localOriginFromBounds(scanBounds(view, layout, t));
}

interface ScanLayout {
  readonly base: number;
  readonly recordLength: number;
  readonly pointCount: number;
  readonly unit: PointCloudReadOptions['unit'];
}

/** Full pass over the XYZ triplets — no allocation, used only when the header's bounds are junk. */
function scanBounds(view: DataView, layout: ScanLayout, t: WorldTransform): TopoBounds {
  const b = createBounds();
  for (let i = 0; i < layout.pointCount; i++) {
    const rec = layout.base + i * layout.recordLength;
    growBounds(
      b,
      view.getInt32(rec + LAS_XYZ_OFFSETS.X, true) * t.mx + t.bx,
      view.getInt32(rec + LAS_XYZ_OFFSETS.Y, true) * t.my + t.by,
      view.getInt32(rec + LAS_XYZ_OFFSETS.Z, true) * t.mz + t.bz,
    );
  }
  return freezeBounds(b);
}

// ─── The read ─────────────────────────────────────────────────────────────────

interface FillOutput {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly classes: Uint8Array;
  readonly histogram: Record<number, number>;
  readonly bounds: TopoBounds;
}

/** The one hot loop: decode → LOCAL mm → typed arrays, keeping every `stride`-th record. */
function fillPoints(
  view: DataView,
  layout: ScanLayout,
  t: WorldTransform,
  origin: LocalOrigin,
  stride: number,
  classOffset: number,
  legacy: boolean,
  onProgress?: (ratio: number) => void,
): FillOutput {
  const out = sampledCount(layout.pointCount, stride);
  const x = new Float32Array(out);
  const y = new Float32Array(out);
  const z = new Float32Array(out);
  const classes = new Uint8Array(out);
  const histogram: Record<number, number> = {};
  const b = createBounds();

  for (let i = 0, o = 0; i < layout.pointCount && o < out; i += stride, o++) {
    const rec = layout.base + i * layout.recordLength;
    const wx = view.getInt32(rec + LAS_XYZ_OFFSETS.X, true) * t.mx + t.bx;
    const wy = view.getInt32(rec + LAS_XYZ_OFFSETS.Y, true) * t.my + t.by;
    const wz = view.getInt32(rec + LAS_XYZ_OFFSETS.Z, true) * t.mz + t.bz;
    x[o] = wx - origin.x;
    y[o] = wy - origin.y;
    z[o] = wz;
    growBounds(b, wx, wy, wz);
    const cls = readClassification(view, rec, classOffset, legacy);
    classes[o] = cls;
    histogram[cls] = (histogram[cls] ?? 0) + 1;
    if (i % PROGRESS_POINT_STRIDE === 0) onProgress?.(i / layout.pointCount);
  }
  return { x, y, z, classes, histogram, bounds: freezeBounds(b) };
}

/**
 * A cloud whose points are ALL class 0 («created, never classified») carries no usable
 * classification — keeping a megabyte-sized array of zeros would only fool the pipeline into
 * skipping CSF. Drop it, and let the ground filter do its job.
 */
function keepClassification(histogram: Record<number, number>): boolean {
  return Object.keys(histogram).some((code) => Number(code) !== 0);
}

/**
 * A run of UNCOMPRESSED, contiguous LAS point records — whatever produced them.
 *
 * `.las` points this straight at the mapped file (`base = offsetToPointData`); `.laz` points it at
 * the buffer laz-perf just decompressed into (`base = 0`, `stride = 1` because the sampling had to
 * happen DURING decompression — LAZ chunks cannot be skipped without decoding them).
 */
export interface LasRecordSource {
  readonly header: LasHeader;
  readonly view: DataView;
  /** Byte offset of record 0 inside `view`. */
  readonly base: number;
  readonly recordLength: number;
  /** Records actually present in `view` (already stride-sampled, if the producer sampled). */
  readonly pointCount: number;
  /** Sampling still to APPLY here. `1` when the producer already sampled. */
  readonly stride: number;
  readonly format: PointCloudFormat;
  /** Accumulated by the producer (record-length, truncation, stride…) and returned as-is. */
  readonly warnings: string[];
}

/**
 * THE decoder — records → LOCAL-mm SoA cloud. Both `.las` and `.laz` land here, so the origin
 * rule, the bounds rule, the legacy-classification mask and the hot loop exist exactly once.
 *
 * @throws Error(`error.noPoints`) when the source holds nothing to decode.
 */
export function decodeLasRecords(
  src: LasRecordSource,
  opts: PointCloudReadOptions,
  onProgress?: (ratio: number) => void,
): PointCloudReadResult {
  if (src.pointCount <= 0) throw new Error(POINTCLOUD_MSG.ERROR_NO_POINTS);

  const layout: ScanLayout = {
    base: src.base,
    recordLength: src.recordLength,
    pointCount: src.pointCount,
    unit: opts.unit,
  };
  const t = worldTransform(src.header, TOPO_UNIT_SCALE_TO_MM[opts.unit]);
  const origin = resolveOrigin(src.view, src.header, layout, t, src.warnings);

  const legacy = src.header.pointDataFormat < LAS_14_PDRF_MIN;
  const classOffset = LAS_CLASSIFICATION_OFFSET[src.header.pointDataFormat];
  const filled = fillPoints(src.view, layout, t, origin, src.stride, classOffset, legacy, onProgress);
  onProgress?.(1);

  const classified = keepClassification(filled.histogram);
  return buildReadResult({
    format: src.format,
    x: filled.x,
    y: filled.y,
    z: filled.z,
    classification: classified ? filled.classes : null,
    classHistogram: classified ? filled.histogram : null,
    origin,
    bounds: filled.bounds,
    warnings: src.warnings,
  });
}

/**
 * Read an UNCOMPRESSED LAS buffer into the canonical SoA cloud.
 *
 * A `.laz` reaching here is a routing bug, not a user error — `readPointCloud` sends compressed
 * bytes to `readLazPointCloud`. We still refuse rather than decode arithmetic-coded chunks as if
 * they were int32 coordinates, which would produce a plausible-looking cloud made of noise.
 *
 * @throws Error with an i18n KEY: `error.lazUnsupported`, `error.notLas`, `error.lasTruncated`,
 *         `error.unsupportedPdrf`, `error.noPoints`.
 */
export function readLasPointCloud(
  buffer: ArrayBuffer,
  opts: PointCloudReadOptions,
  onProgress?: (ratio: number) => void,
): PointCloudReadResult {
  const header = readLasHeader(buffer);
  if (header.isCompressed) throw new Error(POINTCLOUD_MSG.ERROR_LAZ_UNSUPPORTED);
  assertSupportedPdrf(header);

  const warnings: string[] = [];
  const recordLength = resolveRecordLength(header, warnings);
  const pointCount = resolvePointCount(header, buffer.byteLength, recordLength, warnings);

  const stride = computeStride(pointCount, opts.maxPointsInMemory);
  if (stride > 1) warnings.push(POINTCLOUD_MSG.WARN_STRIDE_SAMPLED);

  return decodeLasRecords(
    {
      header,
      view: new DataView(buffer),
      base: header.offsetToPointData,
      recordLength,
      pointCount,
      stride,
      format: 'las',
      warnings,
    },
    opts,
    onProgress,
  );
}
