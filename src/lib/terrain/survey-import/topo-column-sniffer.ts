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
 *
 * ADR-920 §13.10 Α — two lessons from a live `x y z` file whose first 61 rows had X = 0 and Z = 0:
 *   - a CONSTANT column says nothing about magnitude. Its mean |value| of 0 is «50× smaller» than anything, so it
 *     was crowned the elevation, and a 0 in `assignHorizontal` made the other column look like a northing ⇒
 *     «Z · Y · X» and hundreds of invented contradictions. A constant column now judges neither rule.
 *   - before magnitude, ask the SURFACE. A terrain is a function z(x, y): for each of the three candidate elevation
 *     columns, count positions stated twice with two different elevations (`survey-position-census`, the very count
 *     the owner is shown). When exactly one candidate leaves the surface consistent and the others clearly do not,
 *     that is the elevation — whatever the units. (Swapping X and Y never changes the count, so the six orders
 *     reduce to three questions.) The thresholds below are an estimate, not a cited figure.
 * The verdict carries its `basis`, so the screen can say how sure it is: `file-order` means «no evidence».
 */

import type { TerrainSourcePoint } from '../publication/listing-terrain-source';
import type { ColumnMapping, ColumnRole } from './topo-import-types';
import { surveyFactsOf } from './survey-position-census';
import { parseTopoField } from './topo-text-lines';

/** A column counts as numeric when at least this share of its non-empty cells parse as numbers. */
const MIN_NUMERIC_RATIO = 0.8;

/** X, Y and Z — the three columns a usable mapping must produce. */
const COORD_COLUMNS = 3;

/** An elevation is «clearly» the elevation when it is at least this much smaller than a coordinate. */
const ELEVATION_MAGNITUDE_RATIO = 50;

/** The first horizontal column is a NORTHING when it dwarfs the second by at least this factor. */
const NORTHING_MAGNITUDE_RATIO = 4;

/** The surface signal speaks only when a rejected candidate shows at least this many contradictions… */
const SURFACE_MIN_CONFLICTS = 3;

/** …and at least this many times as many as the winner. */
const SURFACE_DECISIVE_RATIO = 10;

/** What the elevation was recognised FROM — `file-order` = no evidence, the last coordinate column was assumed. */
export type SniffBasis = 'surface' | 'magnitude' | 'file-order';

export interface SniffedMapping {
  readonly mapping: ColumnMapping;
  readonly basis: SniffBasis;
}

interface ColumnStats {
  /** Share of non-empty cells that parsed as a number (0..1). */
  readonly numericRatio: number;
  readonly isNumeric: boolean;
  readonly allInteger: boolean;
  readonly strictlyIncreasing: boolean;
  /** Mean of |value| over the numeric cells — the magnitude the heuristics compare. */
  readonly meanAbs: number;
  /** Every numeric cell holds the same value — the column says nothing about magnitude. */
  readonly constant: boolean;
}

/** A cell as a finite number, or `null`. */
function cellNumber(row: readonly string[], index: number): number | null {
  const cell = (row[index] ?? '').trim();
  if (cell.length === 0) return null;
  const value = parseTopoField(cell);
  return value !== null && Number.isFinite(value) ? value : null;
}

/** How many columns the sample rows imply (the widest row wins — ragged tails are normal). */
function columnCount(rows: readonly (readonly string[])[]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function analyseColumn(rows: readonly (readonly string[])[], index: number): ColumnStats {
  const values: number[] = [];
  let filled = 0;

  for (const row of rows) {
    if ((row[index] ?? '').trim().length === 0) continue;
    filled++;
    const value = cellNumber(row, index);
    if (value !== null) values.push(value);
  }

  const numericRatio = filled === 0 ? 0 : values.length / filled;
  const sum = values.reduce((acc, v) => acc + Math.abs(v), 0);

  return {
    numericRatio,
    isNumeric: values.length > 0 && numericRatio >= MIN_NUMERIC_RATIO,
    allInteger: values.length > 0 && values.every((v) => Number.isInteger(v)),
    strictlyIncreasing: values.length > 1 && values.every((v, i) => i === 0 || v > values[i - 1]),
    meanAbs: values.length === 0 ? 0 : sum / values.length,
    constant: values.length > 0 && values.every((v) => v === values[0]),
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

/** How many positions contradict themselves when `zIndex` is the elevation and the other two are the position. */
function conflictsWithElevation(rows: readonly (readonly string[])[], triple: readonly number[], zIndex: number): number {
  const [a, b] = triple.filter((i) => i !== zIndex);
  const points: TerrainSourcePoint[] = [];
  for (const row of rows) {
    const x = cellNumber(row, a);
    const y = cellNumber(row, b);
    const z = cellNumber(row, zIndex);
    if (x !== null && y !== null && z !== null) points.push([x, y, z]);
  }
  return surveyFactsOf(points).conflictingElevations;
}

/** The elevation by the SURFACE signal — `null` unless exactly one candidate keeps the surface consistent. */
function findElevationBySurface(rows: readonly (readonly string[])[], triple: readonly number[]): number | null {
  const scores = triple.map((zIndex) => conflictsWithElevation(rows, triple, zIndex));
  const [best, second] = [...scores].sort((p, q) => p - q);
  const decisive = second >= SURFACE_MIN_CONFLICTS && second >= SURFACE_DECISIVE_RATIO * best;
  return decisive ? triple[scores.indexOf(best)] : null;
}

/** Which of the three coordinate columns is the elevation by MAGNITUDE — `null` when none stands out. */
function findElevationColumn(triple: readonly number[], stats: readonly ColumnStats[]): number | null {
  const magnitudes = triple.map((i) => stats[i].meanAbs);
  const smallest = magnitudes.indexOf(Math.min(...magnitudes));
  if (stats[triple[smallest]].constant) return null;
  const others = magnitudes.filter((_, i) => i !== smallest);
  const largestOther = Math.max(...others);
  const clearlySmaller = magnitudes[smallest] * ELEVATION_MAGNITUDE_RATIO < largestOther;
  return clearlySmaller ? triple[smallest] : null;
}

/** The elevation column and what it was recognised from: surface → magnitude → file order (the last of three). */
function chooseElevation(
  rows: readonly (readonly string[])[],
  triple: readonly number[],
  stats: readonly ColumnStats[],
): { readonly zIndex: number; readonly basis: SniffBasis } {
  const bySurface = findElevationBySurface(rows, triple);
  if (bySurface !== null) return { zIndex: bySurface, basis: 'surface' };
  const byMagnitude = findElevationColumn(triple, stats);
  if (byMagnitude !== null) return { zIndex: byMagnitude, basis: 'magnitude' };
  return { zIndex: triple[COORD_COLUMNS - 1], basis: 'file-order' };
}

/**
 * The two horizontal columns → X and Y. File order stands unless the first one is several times
 * larger than the second, which in any projected CRS means Northing-before-Easting (PNEZD, NEZ).
 * A constant column compares nothing (its 0 would make any other column «4× larger»).
 */
function assignHorizontal(
  pair: readonly [number, number],
  stats: readonly ColumnStats[],
  roles: ColumnRole[],
): void {
  const [first, second] = pair;
  const comparable = !stats[first].constant && !stats[second].constant;
  const northingFirst = comparable && stats[first].meanAbs >= NORTHING_MAGNITUDE_RATIO * stats[second].meanAbs;
  roles[first] = northingFirst ? 'y' : 'x';
  roles[second] = northingFirst ? 'x' : 'y';
}

/**
 * Propose a `ColumnMapping` from the DATA of sample rows (no headers needed), with what the elevation was recognised
 * from. The rows should be spread over the whole file, not its head (`topo-mapping-edit`): a head can be constant.
 *
 * Returns `null` when the rows do not carry three coordinate columns at all — the caller then keeps
 * whatever it did before (for the cloud reader: «the first three numeric fields», unchanged), so a
 * file this sniffer cannot read is never made WORSE by it.
 */
export function sniffMappingFromRows(rows: readonly (readonly string[])[]): SniffedMapping | null {
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

  const triple = numeric.filter((i) => i !== pointId).slice(0, COORD_COLUMNS);
  const { zIndex, basis } = chooseElevation(rows, triple, stats);
  const horizontal = triple.filter((i) => i !== zIndex);

  roles[zIndex] = 'z';
  assignHorizontal([horizontal[0], horizontal[1]], stats, roles);

  return { mapping: roles, basis };
}

/** The mapping alone — for callers that do not show the basis (the viewer's ASCII cloud). */
export function suggestMappingFromRows(rows: readonly (readonly string[])[]): ColumnMapping | null {
  return sniffMappingFromRows(rows)?.mapping ?? null;
}
