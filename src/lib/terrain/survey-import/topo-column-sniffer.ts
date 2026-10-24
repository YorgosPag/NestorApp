/**
 * ADR-650 M8β/Δ — VALUE-based column sniffer (deterministic, zero LLM).
 *
 * `suggestMappingFromHeaders` (topo-column-mapping) reads the LABELS. A point cloud — and half the
 * survey exports in circulation — has no header row at all, and that is exactly where the silent
 * killer lives: a `PENZD` file (`1 345678.123 4201234.456 125.30 EDGE`) fed to a reader that takes
 * «the first three numbers» yields X=1, Y=345678, Z=4201234. No error, no warning, a 4.000 km-tall
 * cloud, and contours computed from garbage. A wrong column does not produce a FAILURE — it
 * produces a plausible view of the wrong site.
 *
 * So this file does what CloudCompare's ASCII dialog, PDAL's `readers.text` and Civil 3D's Point
 * File Format all do, and none of them skips: it **proposes** an assignment from the DATA and hands
 * it to the engineer to certify. It never applies anything by itself.
 *
 * The four signals, in the order they fire (each one removes its column from the pool):
 *   1. `pointId` — all-integer AND strictly increasing, and only if ≥3 numeric columns survive
 *      its removal. A bare `x y z` dump therefore keeps all three columns, whatever they contain.
 *   2. `code`    — the first predominantly NON-numeric column (`EDGE`, `TREE`, `KERB`).
 *   3. `z`       — of the three surviving coordinate columns, the one whose magnitude is orders of
 *      magnitude SMALLER than the others (an elevation is metres; a projected easting/northing is
 *      hundreds of thousands). When no such separation exists — a local scanner dump where all
 *      three are small — no guess is made and the file order (X, Y, Z) stands.
 *   4. `x`/`y`   — file order, UNLESS the first horizontal column is several times larger than the
 *      second. In ΕΓΣΑ'87 (and every UTM zone) the northing is ~4.2e6 while the easting is ~1e5-1e6,
 *      so «big then small» is the signature of an N-before-E order (PNEZD/NEZ). This is the
 *      N=Northing=Y trap that `topo-order-presets` exists to kill — here it is only ever a
 *      SUGGESTION the engineer sees in the grid and can override with one dropdown.
 *
 * Ratios, not absolutes: the same file in mm scales every magnitude by 1000 and every rule still
 * holds. Pure — no I/O, no state, fully testable.
 */

import type { ColumnMapping, ColumnRole } from './topo-import-types';
import { parseTopoField } from './topo-text-lines';

/** A column counts as numeric when at least this share of its non-empty cells parse as numbers. */
const MIN_NUMERIC_RATIO = 0.8;

/** X, Y and Z — the three columns a usable mapping must produce. */
const COORD_COLUMNS = 3;

/** An elevation is «clearly» the elevation when it is at least this much smaller than a coordinate. */
const ELEVATION_MAGNITUDE_RATIO = 50;

/** The first horizontal column is a NORTHING when it dwarfs the second by at least this factor. */
const NORTHING_MAGNITUDE_RATIO = 4;

interface ColumnStats {
  /** Share of non-empty cells that parsed as a number (0..1). */
  readonly numericRatio: number;
  readonly isNumeric: boolean;
  readonly allInteger: boolean;
  readonly strictlyIncreasing: boolean;
  /** Mean of |value| over the numeric cells — the magnitude the heuristics compare. */
  readonly meanAbs: number;
}

/** How many columns the sample rows imply (the widest row wins — ragged tails are normal). */
function columnCount(rows: readonly (readonly string[])[]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function analyseColumn(rows: readonly (readonly string[])[], index: number): ColumnStats {
  const values: number[] = [];
  let filled = 0;

  for (const row of rows) {
    const cell = (row[index] ?? '').trim();
    if (cell.length === 0) continue;
    filled++;
    const value = parseTopoField(cell);
    if (value !== null && Number.isFinite(value)) values.push(value);
  }

  const numericRatio = filled === 0 ? 0 : values.length / filled;
  const sum = values.reduce((acc, v) => acc + Math.abs(v), 0);

  return {
    numericRatio,
    isNumeric: values.length > 0 && numericRatio >= MIN_NUMERIC_RATIO,
    allInteger: values.length > 0 && values.every((v) => Number.isInteger(v)),
    strictlyIncreasing: values.length > 1 && values.every((v, i) => i === 0 || v > values[i - 1]),
    meanAbs: values.length === 0 ? 0 : sum / values.length,
  };
}

/**
 * The column that is a point NUMBER, not a coordinate: all-integer and strictly increasing down
 * the file. Two guards, both learned the hard way:
 *
 *  - only the FIRST numeric column may claim it. In every P-format the industry ships (PNEZD,
 *    PENZD, PNEZ…) the point number LEADS. Without this guard any ascending integer column steals
 *    the role — an RGB channel that happens to climb over the sample rows would become the id.
 *  - the survivor rule: claiming it must still leave three coordinate columns, otherwise a plain
 *    `x y z` file whose values happen to be sorted integers would lose its X.
 */
function findPointIdColumn(numeric: readonly number[], stats: readonly ColumnStats[]): number | null {
  const first = numeric[0];
  if (!stats[first].allInteger || !stats[first].strictlyIncreasing) return null;
  return numeric.length - 1 >= COORD_COLUMNS ? first : null;
}

/** Which of the three coordinate columns is the elevation — `null` when none stands out. */
function findElevationColumn(triple: readonly number[], stats: readonly ColumnStats[]): number | null {
  const magnitudes = triple.map((i) => stats[i].meanAbs);
  const smallest = magnitudes.indexOf(Math.min(...magnitudes));
  const others = magnitudes.filter((_, i) => i !== smallest);
  const largestOther = Math.max(...others);
  const clearlySmaller = magnitudes[smallest] * ELEVATION_MAGNITUDE_RATIO < largestOther;
  return clearlySmaller ? triple[smallest] : null;
}

/**
 * The two horizontal columns → X and Y. File order stands unless the first one is several times
 * larger than the second, which in any projected CRS means Northing-before-Easting (PNEZD, NEZ).
 */
function assignHorizontal(
  pair: readonly [number, number],
  stats: readonly ColumnStats[],
  roles: ColumnRole[],
): void {
  const [first, second] = pair;
  const northingFirst = stats[first].meanAbs >= NORTHING_MAGNITUDE_RATIO * stats[second].meanAbs;
  roles[first] = northingFirst ? 'y' : 'x';
  roles[second] = northingFirst ? 'x' : 'y';
}

/**
 * Propose a `ColumnMapping` from the DATA of a few sample rows (no headers needed).
 *
 * Returns `null` when the rows do not carry three coordinate columns at all — the caller then keeps
 * whatever it did before (for the cloud reader: «the first three numeric fields», unchanged), so a
 * file this sniffer cannot read is never made WORSE by it.
 */
export function suggestMappingFromRows(rows: readonly (readonly string[])[]): ColumnMapping | null {
  const width = columnCount(rows);
  if (width < COORD_COLUMNS) return null;

  const stats = Array.from({ length: width }, (_, i) => analyseColumn(rows, i));
  const roles: ColumnRole[] = Array.from({ length: width }, () => 'ignore');

  const numeric = stats.map((s, i) => (s.isNumeric ? i : -1)).filter((i) => i !== -1);
  if (numeric.length < COORD_COLUMNS) return null;

  const pointId = findPointIdColumn(numeric, stats);
  if (pointId !== null) roles[pointId] = 'pointId';

  const code = stats.findIndex((s, i) => !s.isNumeric && s.numericRatio === 0 && roles[i] === 'ignore');
  if (code !== -1) roles[code] = 'code';

  // No magnitude separation → the file order stands: the LAST of the three is the elevation.
  const triple = numeric.filter((i) => i !== pointId).slice(0, COORD_COLUMNS);
  const zIndex = findElevationColumn(triple, stats) ?? triple[COORD_COLUMNS - 1];
  const horizontal = triple.filter((i) => i !== zIndex);

  roles[zIndex] = 'z';
  assignHorizontal([horizontal[0], horizontal[1]], stats, roles);

  return roles;
}
