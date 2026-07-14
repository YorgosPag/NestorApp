/**
 * ADR-650 — ZERO-CONFIG survey-point text parser (`X Y Z [code]`, one point per line).
 *
 * This is the «just drop the file in» road: no wizard, no questions. It stays deliberately
 * LENIENT in a way the wizard's table reader is not, and the difference is intentional:
 *
 *   here (zero-config)              | `topo-delimited-reader` (wizard)
 *   ────────────────────────────────┼──────────────────────────────────────────────
 *   splits EACH LINE on any of      | detects ONE delimiter for the whole file, so the
 *   space/comma/semicolon/tab, so a | preview grid has stable columns the surveyor can
 *   hand-assembled mixed file works | map — a per-line guess cannot be shown as a table
 *   reports ORIGINAL line numbers   | reports row numbers within the table
 *
 * What they must NEVER duplicate is the INTERPRETATION of the split cells (number parsing,
 * unit scaling, optional code) — that is `mapRowToPoint`, imported below (ADR-650 M2).
 *
 * Units: survey files are almost always in METRES; canonical storage is mm (ADR-462).
 */

import { mapRowToPoint } from './topo-column-mapping';
import { isTopoCommentLine, splitTopoFields } from './topo-text-lines';
import type { ColumnMapping } from './topo-import-types';
import type { TopoPoint } from './topo-types';

/** The fixed field order of the zero-config format: `X Y Z [code]`. */
const XYZ_CODE_MAPPING: ColumnMapping = ['x', 'y', 'z', 'code'];

export interface ParseTopoResult {
  readonly points: TopoPoint[];
  /** Line numbers (1-based, in the ORIGINAL text) that could not be parsed as X Y Z. */
  readonly skipped: number[];
}

/**
 * Parse survey points from raw text. Each non-comment line must yield at least three
 * finite numbers (X, Y, Z); an optional 4th field becomes the feature `code`.
 */
export function parseTopoPoints(text: string, unitScaleToMm = 1000): ParseTopoResult {
  const points: TopoPoint[] = [];
  const skipped: number[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    if (isTopoCommentLine(lines[i])) continue;
    const point = mapRowToPoint(splitTopoFields(lines[i]), XYZ_CODE_MAPPING, unitScaleToMm);
    if (point) points.push(point);
    else skipped.push(i + 1);
  }
  return { points, skipped };
}
