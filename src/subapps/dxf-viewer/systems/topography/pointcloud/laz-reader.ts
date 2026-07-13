/**
 * ADR-650 M8β — LAZ reader. The drone road: DJI Terra, Pix4D and Terrasolid all export `.laz`,
 * never `.las`, so without this the whole M8α point-cloud pipeline demanded a manual conversion
 * step before the engineer could even open his own survey.
 *
 *   .laz bytes → laz-perf (WASM) → UNCOMPRESSED LAS records → decodeLasRecords → PointCloudData
 *                                                             ^^^^^^^^^^^^^^^^
 * That arrow is the whole design. A LAZ file IS a LAS file whose point records went through an
 * arithmetic coder: same header, same PDRF, same 12-byte int32 XYZ, same classification byte. So
 * once the chunks are decoded there is nothing LAZ-specific left to do, and this file does NOT
 * re-derive the origin rule, the bounds rule, the legacy class mask or the hot loop — it hands the
 * records to the ONE decoder `las-reader.ts` owns (N.18: a second copy of that loop is exactly the
 * sibling clone the jscpd ratchet exists to catch).
 *
 * ⚠️ WHY STRIDE HAPPENS HERE, NOT IN THE DECODER. LAZ chunks cannot be skipped without decoding
 * them — there is no random access into an arithmetic-coded stream. So every point IS decompressed,
 * and the sampling decides only which of them we KEEP. The decoder is then told `stride: 1`.
 *
 * ⚠️ THE MEMORY COST LAS DOES NOT PAY. `.las` decodes in place, straight out of the file's own
 * bytes. `.laz` must first materialise the uncompressed records somewhere — a real, transient cost
 * of ~34 B per kept point. That is why `LAZ_MAX_POINTS_IN_MEMORY` is lower than the LAS ceiling;
 * past it the cloud is stride-sampled and the engineer is told so (`warn.strideSampled`).
 */

import type { LazPerf } from 'laz-perf';
import type { LasHeader, PointCloudReadOptions, PointCloudReadResult } from './pointcloud-types';
import {
  assertSupportedPdrf,
  decodeLasRecords,
  readLasHeader,
  resolveRecordLength,
} from './las-reader';
import { POINTCLOUD_MSG, computeStride, sampledCount } from './pointcloud-read';
import { LAZ_MAX_POINTS_IN_MEMORY } from './pointcloud-defaults';
import { loadLazPerf, type LazPerfFactory } from './laz-runtime';

/** One opened LAZ stream (laz-perf's `LASZip`), named so the helpers below can take it explicitly. */
type LasZipStream = InstanceType<LazPerf['LASZip']>;

/** How often the decompression loop reports progress. A power of two — the check is a cheap mask. */
const PROGRESS_POINT_STRIDE = 1 << 18;

/**
 * laz-perf reads the compressed stream's OWN idea of the point layout out of the LASzip VLR. Where
 * it disagrees with the public header (extra bytes, a padded record), the stream wins — it is what
 * the records actually are. The rest of the header (scale, offset, bounds) is untouched by
 * compression and is taken as-is.
 */
function reconcileHeader(header: LasHeader, pointCount: number, recordLength: number): LasHeader {
  return { ...header, pointCount, pointDataRecordLength: recordLength, isCompressed: false };
}

interface Decompressed {
  readonly records: Uint8Array;
  readonly keptCount: number;
  readonly recordLength: number;
  readonly header: LasHeader;
  /** `> 1` when the cloud was too big for the ceiling and had to be sampled. */
  readonly stride: number;
}

/** The decompression loop, once the heap and the stream are open. Extracted to keep it ≤40 lines. */
function drainPoints(
  lazPerf: LazPerf,
  laszip: LasZipStream,
  layout: { sourceCount: number; recordLength: number; stride: number; pointPtr: number },
  onProgress?: (ratio: number) => void,
): { records: Uint8Array; kept: number } {
  const { sourceCount, recordLength, stride, pointPtr } = layout;
  const records = new Uint8Array(sampledCount(sourceCount, stride) * recordLength);
  let kept = 0;

  for (let i = 0; i < sourceCount; i++) {
    laszip.getPoint(pointPtr); // sequential — every point IS decoded, kept or not
    if (i % stride === 0) {
      records.set(lazPerf.HEAPU8.subarray(pointPtr, pointPtr + recordLength), kept * recordLength);
      kept++;
    }
    if (i % PROGRESS_POINT_STRIDE === 0) onProgress?.(i / sourceCount);
  }
  return { records, kept };
}

/**
 * Run the whole file through laz-perf, keeping only what fits under `ceiling`.
 *
 * Emscripten owns a flat heap, so the file has to be copied INTO it (`_malloc` + `HEAPU8.set`) and
 * every decoded record copied back OUT of it. Both allocations are released in `finally` — a WASM
 * heap leak outlives the import and would starve the next one.
 *
 * @throws Error(`error.lazDecodeFailed`) — a corrupt stream, or a heap that could not grow.
 */
async function decompress(
  buffer: ArrayBuffer,
  header: LasHeader,
  ceiling: number,
  factory: LazPerfFactory | undefined,
  onProgress?: (ratio: number) => void,
): Promise<Decompressed> {
  const lazPerf = await loadLazPerf(factory);
  const laszip = new lazPerf.LASZip();
  let filePtr = 0;
  let pointPtr = 0;

  try {
    const bytes = new Uint8Array(buffer);
    filePtr = lazPerf._malloc(bytes.byteLength);
    if (!filePtr) throw new Error(POINTCLOUD_MSG.ERROR_LAZ_DECODE_FAILED);
    lazPerf.HEAPU8.set(bytes, filePtr);
    laszip.open(filePtr, bytes.byteLength);

    // The STREAM's own layout (from the LASzip VLR) — authoritative over the public header.
    const recordLength = laszip.getPointLength();
    const sourceCount = laszip.getCount();
    if (recordLength <= 0 || sourceCount <= 0) throw new Error(POINTCLOUD_MSG.ERROR_NO_POINTS);

    pointPtr = lazPerf._malloc(recordLength);
    if (!pointPtr) throw new Error(POINTCLOUD_MSG.ERROR_LAZ_DECODE_FAILED);

    const stride = computeStride(sourceCount, ceiling);
    const { records, kept } = drainPoints(lazPerf, laszip, { sourceCount, recordLength, stride, pointPtr }, onProgress);
    return { records, keptCount: kept, recordLength, stride, header: reconcileHeader(header, kept, recordLength) };
  } catch (error) {
    throw toDecodeError(error);
  } finally {
    if (pointPtr) lazPerf._free(pointPtr);
    if (filePtr) lazPerf._free(filePtr);
    laszip.delete();
  }
}

/** Keep our own i18n keys; turn anything laz-perf throws (an Emscripten abort) into an honest one. */
function toDecodeError(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith('topography.pointcloud.')) return error;
  console.error('❌ laz-perf: decode failed:', error);
  return new Error(POINTCLOUD_MSG.ERROR_LAZ_DECODE_FAILED);
}

/**
 * Read a compressed LAZ buffer into the canonical SoA cloud — indistinguishable from what the same
 * survey would have produced as `.las`, apart from `format: 'laz'`.
 *
 * @param factory test seam only: an injected laz-perf factory. Production passes nothing and gets
 *   the shared WASM singleton.
 * @throws Error whose `message` is an i18n KEY: `error.notLas`, `error.lasTruncated`,
 *   `error.unsupportedPdrf`, `error.noPoints`, `error.lazRuntimeUnavailable`, `error.lazDecodeFailed`.
 */
export async function readLazPointCloud(
  buffer: ArrayBuffer,
  opts: PointCloudReadOptions,
  onProgress?: (ratio: number) => void,
  factory?: LazPerfFactory,
): Promise<PointCloudReadResult> {
  const header = readLasHeader(buffer);
  assertSupportedPdrf(header); // fail before we pay for a WASM instantiation

  const warnings: string[] = [];
  resolveRecordLength(header, warnings); // warns on a header/spec mismatch; the STREAM decides below

  const ceiling = Math.min(opts.maxPointsInMemory, LAZ_MAX_POINTS_IN_MEMORY);
  const out = await decompress(buffer, header, ceiling, factory, onProgress);
  if (out.stride > 1) warnings.push(POINTCLOUD_MSG.WARN_STRIDE_SAMPLED);

  return decodeLasRecords(
    {
      header: out.header,
      view: new DataView(out.records.buffer, out.records.byteOffset, out.records.byteLength),
      base: 0,
      recordLength: out.recordLength,
      pointCount: out.keptCount,
      stride: 1, // already sampled during decompression — LAZ chunks cannot be skipped
      format: 'laz',
      warnings,
    },
    opts,
    // decompression owned 0..1 of «reading»; the decode pass is comparatively instant
    () => onProgress?.(1),
  );
}
