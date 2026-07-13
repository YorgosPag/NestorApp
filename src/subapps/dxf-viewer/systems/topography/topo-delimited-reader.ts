/**
 * ADR-650 Milestone 2 — Delimited survey file → `RawTable` (pure, format-agnostic).
 *
 * Step 1 of the two-step import (see `topo-import-types`): turn bytes into a table of
 * untyped cells. It does NOT decide what the columns mean — that is `topo-column-mapping`.
 *
 * Why we auto-detect instead of asking: every instrument exports a different separator
 * (Leica `,`, Greek Excel `;`, total-station dumps tab/space) and the surveyor should not
 * have to know. The wizard still shows the detection and lets it be overridden.
 *
 * Header detection follows the same rule as Civil 3D/Excel: a first row whose leading cells
 * are NOT numbers is a header row (labels), otherwise the file starts straight at data.
 */

import type { RawTable } from './topo-import-types';
import { normalizeNumber } from '../dynamic-input/utils/number';

/** Candidate separators, most specific first (space is the fallback of last resort). */
const DELIMITERS = [',', ';', '\t', ' '] as const;

/** `#` and `//` lead-ins are the universal comment markers in survey exports. */
function isComment(line: string): boolean {
  const t = line.trim();
  return t.length === 0 || t.startsWith('#') || t.startsWith('//');
}

/**
 * Split one line, honouring double quotes so a quoted description containing the
 * delimiter (`"WALL, north side"`) survives as a single cell.
 */
export function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else current += ch;
  }
  cells.push(current.trim());

  // Runs of spaces act as ONE separator in column-aligned dumps ("384512.3   4201233.1").
  // Tabs do NOT collapse: an empty tab-separated cell is a real (unfilled) column, and
  // dropping it would silently shift every following column by one (Excel path relies on this).
  return delimiter === ' ' ? cells.filter((c) => c.length > 0) : cells;
}

/**
 * Pick the delimiter that splits the sample lines into the most columns, consistently.
 * Consistency matters more than count: a stray comma inside one description must not
 * outvote the tab that actually structures the file.
 */
export function detectDelimiter(sampleLines: readonly string[]): string {
  let best = ' ';
  let bestScore = 0;

  for (const delimiter of DELIMITERS) {
    const counts = sampleLines.map((l) => splitDelimitedLine(l, delimiter).length);
    const min = Math.min(...counts);
    if (min < 2) continue; // did not split anything → not the separator
    const consistent = counts.every((c) => c === counts[0]);
    const score = min * (consistent ? 2 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/** A row is DATA when at least its first two cells parse as plain numbers. */
function looksNumeric(cells: readonly string[]): boolean {
  // SSoT `normalizeNumber` (comma-normalize ratchet) — el-GR αρχεία γράφουν «12,34».
  const numeric = (c: string): boolean => c.length > 0 && Number.isFinite(Number(normalizeNumber(c)));
  return cells.length >= 2 && numeric(cells[0]) && numeric(cells[1]);
}

export interface ReadDelimitedOptions {
  /** Force a separator instead of auto-detecting it (wizard override). */
  readonly delimiter?: string;
}

/**
 * Parse raw text into a `RawTable`. Comment and blank lines are dropped; the first row is
 * taken as headers only when it does not look like data.
 */
export function readDelimitedText(text: string, opts: ReadDelimitedOptions = {}): RawTable {
  const lines = text.split(/\r?\n/).filter((l) => !isComment(l));
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = opts.delimiter ?? detectDelimiter(lines.slice(0, 20));
  const all = lines.map((l) => splitDelimitedLine(l, delimiter));

  const first = all[0];
  const hasHeader = first !== undefined && !looksNumeric(first);

  return {
    headers: hasHeader ? first.map((h) => h.replace(/"/g, '')) : [],
    rows: hasHeader ? all.slice(1) : all,
    delimiter,
  };
}
