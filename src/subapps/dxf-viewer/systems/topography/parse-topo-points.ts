/**
 * ADR-650 Milestone 1 — BASIC survey-point text parser.
 *
 * Deliberately minimal (Q9): the full column-mapping importer (PNEZD/PENZD reorder,
 * delimiter detection, DXF POINT extraction) is Milestone 2. Here we accept the common
 * lowest-common-denominator export: one point per line as `X Y Z [code]`, separated by
 * comma / whitespace / tab / semicolon. Blank lines and `#`/`//` comments are skipped.
 *
 * Units: survey files are almost always in METRES; canonical storage is mm (ADR-462), so
 * planimetric + vertical values are multiplied by `unitScaleToMm` (default 1000 = m→mm).
 */

import type { TopoPoint } from './topo-types';

/** Split a data line into fields on comma / semicolon / whitespace. */
function splitFields(line: string): string[] {
  return line.trim().split(/[\s,;]+/).filter((f) => f.length > 0);
}

function isComment(line: string): boolean {
  const t = line.trim();
  return t.length === 0 || t.startsWith('#') || t.startsWith('//');
}

export interface ParseTopoResult {
  readonly points: TopoPoint[];
  /** Line numbers (1-based) that could not be parsed as X Y Z. */
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
    if (isComment(lines[i])) continue;
    const fields = splitFields(lines[i]);
    if (fields.length < 3) { skipped.push(i + 1); continue; }
    const x = Number(fields[0]);
    const y = Number(fields[1]);
    const z = Number(fields[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      skipped.push(i + 1);
      continue;
    }
    const code = fields.length >= 4 ? fields[3] : undefined;
    points.push({
      x: x * unitScaleToMm,
      y: y * unitScaleToMm,
      z: z * unitScaleToMm,
      ...(code ? { code } : {}),
    });
  }
  return { points, skipped };
}
