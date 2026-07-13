/**
 * ADR-650 M8α — BULK ASCII XYZ reader (millions of lines → typed arrays).
 *
 * ⚠️ THIS IS NOT `parse-topo-points.ts`. The two look alike and must not be merged:
 *
 *   parse-topo-points (M2)                 | this file (M8α)
 *   ───────────────────────────────────────┼──────────────────────────────────────────────
 *   a SURVEY file: hundreds of points,     | a POINT CLOUD: millions of points, dumped by a
 *   each one shot deliberately by a         | scanner/drone — nobody named them, nobody will
 *   surveyor and carrying a feature code    | ever look at one individually
 *   → `TopoPoint[]` (objects, with `code`)  | → SoA `Float32Array` (30M objects would be ~3 GB
 *                                           |   of heap and would kill the tab)
 *   goes STRAIGHT into `TopoPointStore`     | goes into the ground filter → decimator FIRST
 *
 * What they DO share is the surveyor-facing leniency of the text format itself — mixed
 * whitespace/comma/semicolon delimiters, `#` / `//` comments, a stray header line, junk trailer
 * lines — and this file matches `parse-topo-points`'s behaviour there on purpose, because the
 * same engineer drops the same kind of file down both roads and must not get two different
 * verdicts. Number parsing goes through the same `parseLocaleNumber` SSoT.
 *
 * TWO PASSES, and why: the SoA layout needs a LOCAL origin before it can store an x, and the
 * origin needs the bounds, and a text file has no header to ask. Pass 1 measures (bounds, valid
 * count); pass 2 fills. Buffering the world coordinates instead would cost a Float64 staging
 * array — 480 MB at 30M points — to save a re-scan that is memory-bound and cheap.
 */

import { parseLocaleNumber } from '@/lib/number/locale-number';
import { TOPO_UNIT_SCALE_TO_MM } from '../topo-import-types';
import type { LocalOrigin } from '../topo-types';
import type { PointCloudReadOptions, PointCloudReadResult } from './pointcloud-types';
import {
  POINTCLOUD_MSG,
  buildReadResult,
  computeStride,
  createBounds,
  freezeBounds,
  growBounds,
  hasBounds,
  localOriginFromBounds,
  sampledCount,
  type MutableBounds,
} from './pointcloud-read';

/** Same split as the zero-config parser: any run of whitespace / comma / semicolon / tab. */
const FIELD_SPLIT = /[\s,;]+/;

/** A field must LOOK numeric before we spend `parseLocaleNumber` on it — `TREE1` is not a number. */
const NUMERIC_FIELD = /^[+-]?[\d.,]+$/;

/** Πόσες ΓΡΑΜΜΕΣ (όχι ms) μεσολαβούν μεταξύ αναφορών προόδου. */
const PROGRESS_LINE_STRIDE = 1 << 18;

/** X, Y, Z — the three numbers a cloud line must yield. */
const XYZ_FIELDS = 3;

/** Each of the two passes owns half of the reported progress. */
const HALF = 0.5;

// ─── Line scanning ────────────────────────────────────────────────────────────

function isSkippable(line: string): boolean {
  const t = line.trim();
  return t.length === 0 || t.startsWith('#') || t.startsWith('//');
}

/**
 * Walk the text line by line WITHOUT materialising a `string[]`: `text.split()` on a 30M-line
 * file allocates 30M string objects on top of the (already huge) source string. `indexOf('\n')`
 * costs nothing and lets both passes stream.
 */
function forEachLine(text: string, visit: (line: string, index: number, ratio: number) => void): void {
  const len = text.length;
  let start = 0;
  let index = 0;
  while (start < len) {
    let nl = text.indexOf('\n', start);
    if (nl === -1) nl = len;
    let end = nl;
    if (end > start && text.charCodeAt(end - 1) === 13) end--; // strip CR of a CRLF file
    visit(text.slice(start, end), index++, start / len);
    start = nl + 1;
  }
}

/**
 * One field → number. The fast path is `Number()` (the overwhelming majority of cloud lines are
 * plain dot-decimals); anything it rejects but that still looks numeric falls back to the
 * `parseLocaleNumber` SSoT, so a Greek-locale export parses identically to the wizard's road.
 */
function parseField(field: string): number | null {
  if (!NUMERIC_FIELD.test(field)) return null;
  const fast = Number(field);
  if (Number.isFinite(fast)) return fast;
  return parseLocaleNumber(field);
}

/**
 * A data line → its first three numeric fields, scaled to WORLD canonical mm.
 *
 * Extra columns (point id, feature code, intensity, RGB) are simply not consumed: X Y Z are the
 * first three NUMERIC fields, which is the convention every scanner export follows. Returns
 * `null` for a line that never produces three numbers — a header, a legend, a trailer total.
 */
function parseXyz(line: string, unitScale: number, out: Float64Array): boolean {
  const fields = line.trim().split(FIELD_SPLIT);
  let found = 0;
  for (let i = 0; i < fields.length && found < XYZ_FIELDS; i++) {
    const value = parseField(fields[i]);
    if (value === null) continue;
    out[found++] = value * unitScale;
  }
  return found === XYZ_FIELDS;
}

// ─── Pass 1 — measure ─────────────────────────────────────────────────────────

interface Measured {
  readonly validCount: number;
  /** Unparseable lines AFTER the first valid one (a preamble/header is not an error). */
  readonly invalidCount: number;
  readonly bounds: MutableBounds;
}

function measure(text: string, unitScale: number, onProgress?: (ratio: number) => void): Measured {
  const xyz = new Float64Array(XYZ_FIELDS);
  const bounds = createBounds();
  let validCount = 0;
  let invalidCount = 0;

  forEachLine(text, (line, index, ratio) => {
    if (index % PROGRESS_LINE_STRIDE === 0) onProgress?.(HALF * ratio); // pass 1 owns the first half
    if (isSkippable(line)) return;
    if (!parseXyz(line, unitScale, xyz)) {
      if (validCount > 0) invalidCount++; // before the first point it is a header, not junk
      return;
    }
    growBounds(bounds, xyz[0], xyz[1], xyz[2]);
    validCount++;
  });

  return { validCount, invalidCount, bounds };
}

// ─── Pass 2 — fill ────────────────────────────────────────────────────────────

interface Filled {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly bounds: MutableBounds;
}

/** Keep every `stride`-th VALID point (not every stride-th line — comments must not shift it). */
function fill(
  text: string,
  unitScale: number,
  origin: LocalOrigin,
  count: number,
  stride: number,
  onProgress?: (ratio: number) => void,
): Filled {
  const xyz = new Float64Array(XYZ_FIELDS);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const bounds = createBounds();
  let seen = 0;
  let out = 0;

  forEachLine(text, (line, index, ratio) => {
    if (index % PROGRESS_LINE_STRIDE === 0) onProgress?.(HALF + HALF * ratio); // pass 2 owns the second
    if (out >= count || isSkippable(line)) return;
    if (!parseXyz(line, unitScale, xyz)) return;
    if (seen++ % stride !== 0) return;
    x[out] = xyz[0] - origin.x;
    y[out] = xyz[1] - origin.y;
    z[out] = xyz[2];
    growBounds(bounds, xyz[0], xyz[1], xyz[2]);
    out++;
  });

  return { x, y, z, bounds };
}

// ─── The read ─────────────────────────────────────────────────────────────────

/**
 * Read an ASCII XYZ cloud into the canonical SoA buffer.
 *
 * ASCII carries no ASPRS classification, so `data.classification` is always `null` and the
 * pipeline will have to derive the ground itself (CSF) — that is not a defect of this reader,
 * it is what the format is.
 *
 * @throws Error(`error.noPoints`) when not one line yielded a finite X/Y/Z.
 */
export function readAsciiXyzPointCloud(
  text: string,
  opts: PointCloudReadOptions,
  onProgress?: (ratio: number) => void,
): PointCloudReadResult {
  const unitScale = TOPO_UNIT_SCALE_TO_MM[opts.unit];
  const measured = measure(text, unitScale, onProgress);
  if (measured.validCount === 0 || !hasBounds(measured.bounds)) {
    throw new Error(POINTCLOUD_MSG.ERROR_NO_POINTS);
  }

  const warnings: string[] = [];
  if (measured.invalidCount > 0) warnings.push(POINTCLOUD_MSG.WARN_SKIPPED_LINES);

  const stride = computeStride(measured.validCount, opts.maxPointsInMemory);
  if (stride > 1) warnings.push(POINTCLOUD_MSG.WARN_STRIDE_SAMPLED);

  const origin = localOriginFromBounds(freezeBounds(measured.bounds));
  const count = sampledCount(measured.validCount, stride);
  const filled = fill(text, unitScale, origin, count, stride, onProgress);
  onProgress?.(1);

  return buildReadResult({
    format: 'ascii-xyz',
    x: filled.x,
    y: filled.y,
    z: filled.z,
    classification: null,
    classHistogram: null,
    origin,
    bounds: freezeBounds(filled.bounds),
    warnings,
  });
}
