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
 * What they DO share — since M8β/Δ, literally, through the `topo-text-lines` SSoT — is the
 * surveyor-facing leniency of the text format itself: mixed whitespace/comma/semicolon delimiters,
 * `#` / `//` comments, a stray header line, junk trailer lines, Greek-locale decimals. The same
 * engineer drops the same file down both roads and must not get two different verdicts, and since
 * M8β/Δ they also share the COLUMN vocabulary (`ColumnMapping`) — see `parseXyz` below.
 *
 * TWO PASSES, and why: the SoA layout needs a LOCAL origin before it can store an x, and the
 * origin needs the bounds, and a text file has no header to ask. Pass 1 measures (bounds, valid
 * count); pass 2 fills. Buffering the world coordinates instead would cost a Float64 staging
 * array — 480 MB at 30M points — to save a re-scan that is memory-bound and cheap.
 */

import { TOPO_UNIT_SCALE_TO_MM } from '../topo-import-types';
import { resolveXyzColumns, type XyzColumns } from '../topo-column-mapping';
import { fieldSplitterFor, forEachTopoLine, isTopoCommentLine, parseTopoField } from '../topo-text-lines';
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

/** Πόσες ΓΡΑΜΜΕΣ (όχι ms) μεσολαβούν μεταξύ αναφορών προόδου. */
const PROGRESS_LINE_STRIDE = 1 << 18;

/** X, Y, Z — the three numbers a cloud line must yield. */
const XYZ_FIELDS = 3;

/** Each of the two passes owns half of the reported progress. */
const HALF = 0.5;

// ─── Line scanning ────────────────────────────────────────────────────────────
// Lexing (comment lines, field split, locale-tolerant numbers) is the `topo-text-lines` SSoT —
// the same one `parse-topo-points` uses, so the same file split into columns identically on both
// roads. Only the two PASSES below are this reader's own (SoA, not objects).

/**
 * A data line → X, Y, Z in WORLD canonical mm, written into `out`.
 *
 * TWO MODES, and the difference is the whole of M8β/Δ:
 *
 *  - `columns === null` (no mapping declared) — the historical behaviour: **the first three numeric
 *    fields**. Correct for the bare `x y z [intensity r g b]` dump every scanner emits, where the
 *    coordinates lead and the extras trail.
 *  - `columns` given — X, Y and Z are read from the DECLARED column indices, and every other field
 *    (point id, feature code, intensity, RGB) is skipped by POSITION. This is what makes a PENZD
 *    file (`1 345678.123 4201234.456 125.30 EDGE`) read as a survey and not as a 4.000 km-tall
 *    monster: the leading point number is a column with a NAME, not «the first number».
 *
 * Returns `false` for a line that does not yield three finite numbers — a header, a legend, a
 * trailer total — exactly as before.
 */
interface LineFormat {
  /** How a line breaks into fields — delimiter-aware when the wizard detected one. */
  readonly split: (line: string) => string[];
  /** The certified X/Y/Z column indices, or `null` for the historical positional read. */
  readonly columns: XyzColumns | null;
  readonly unitScale: number;
}

/** How to read every line of THIS file — decided once, before either pass starts. */
function lineFormatFor(opts: PointCloudReadOptions): LineFormat {
  return {
    split: fieldSplitterFor(opts.delimiter),
    columns: resolveXyzColumns(opts.mapping),
    unitScale: TOPO_UNIT_SCALE_TO_MM[opts.unit],
  };
}

function parseXyz(line: string, fmt: LineFormat, out: Float64Array): boolean {
  const fields = fmt.split(line);
  return fmt.columns === null
    ? parsePositional(fields, fmt.unitScale, out)
    : parseMapped(fields, fmt.unitScale, out, fmt.columns);
}

/** Historical mode — the first three numeric fields, wherever they sit. */
function parsePositional(fields: readonly string[], unitScale: number, out: Float64Array): boolean {
  let found = 0;
  for (let i = 0; i < fields.length && found < XYZ_FIELDS; i++) {
    const value = parseTopoField(fields[i]);
    if (value === null) continue;
    out[found++] = value * unitScale;
  }
  return found === XYZ_FIELDS;
}

/** Declared mode — X/Y/Z come from the engineer-certified column indices. */
function parseMapped(
  fields: readonly string[],
  unitScale: number,
  out: Float64Array,
  columns: XyzColumns,
): boolean {
  const x = parseTopoField(fields[columns.x] ?? '');
  const y = parseTopoField(fields[columns.y] ?? '');
  const z = parseTopoField(fields[columns.z] ?? '');
  if (x === null || y === null || z === null) return false;
  out[0] = x * unitScale;
  out[1] = y * unitScale;
  out[2] = z * unitScale;
  return true;
}

// ─── Pass 1 — measure ─────────────────────────────────────────────────────────

interface Measured {
  readonly validCount: number;
  /** Unparseable lines AFTER the first valid one (a preamble/header is not an error). */
  readonly invalidCount: number;
  readonly bounds: MutableBounds;
}

function measure(text: string, fmt: LineFormat, onProgress?: (ratio: number) => void): Measured {
  const xyz = new Float64Array(XYZ_FIELDS);
  const bounds = createBounds();
  let validCount = 0;
  let invalidCount = 0;

  forEachTopoLine(text, (line, index, ratio) => {
    if (index % PROGRESS_LINE_STRIDE === 0) onProgress?.(HALF * ratio); // pass 1 owns the first half
    if (isTopoCommentLine(line)) return;
    if (!parseXyz(line, fmt, xyz)) {
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

interface FillOptions {
  readonly fmt: LineFormat;
  readonly origin: LocalOrigin;
  readonly count: number;
  readonly stride: number;
}

/** Keep every `stride`-th VALID point (not every stride-th line — comments must not shift it). */
function fill(text: string, opts: FillOptions, onProgress?: (ratio: number) => void): Filled {
  const { fmt, origin, count, stride } = opts;
  const xyz = new Float64Array(XYZ_FIELDS);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const bounds = createBounds();
  let seen = 0;
  let out = 0;

  forEachTopoLine(text, (line, index, ratio) => {
    if (index % PROGRESS_LINE_STRIDE === 0) onProgress?.(HALF + HALF * ratio); // pass 2 owns the second
    if (out >= count || isTopoCommentLine(line)) return;
    if (!parseXyz(line, fmt, xyz)) return;
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
 * `opts.mapping` (M8β/Δ) is the engineer's certified column order. Absent or incomplete → the
 * historical «first three numeric fields» path runs, byte for byte: a bare `x y z` dump behaves
 * exactly as it did before this milestone existed.
 *
 * @throws Error(`error.noPoints`) when not one line yielded a finite X/Y/Z.
 */
export function readAsciiXyzPointCloud(
  text: string,
  opts: PointCloudReadOptions,
  onProgress?: (ratio: number) => void,
): PointCloudReadResult {
  const fmt = lineFormatFor(opts);
  const measured = measure(text, fmt, onProgress);
  if (measured.validCount === 0 || !hasBounds(measured.bounds)) {
    throw new Error(POINTCLOUD_MSG.ERROR_NO_POINTS);
  }

  const warnings: string[] = [];
  if (measured.invalidCount > 0) warnings.push(POINTCLOUD_MSG.WARN_SKIPPED_LINES);

  const stride = computeStride(measured.validCount, opts.maxPointsInMemory);
  if (stride > 1) warnings.push(POINTCLOUD_MSG.WARN_STRIDE_SAMPLED);

  const origin = localOriginFromBounds(freezeBounds(measured.bounds));
  const count = sampledCount(measured.validCount, stride);
  const filled = fill(text, { fmt, origin, count, stride }, onProgress);
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
