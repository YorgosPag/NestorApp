/**
 * Delimited text file → `RawTable` (pure, format-agnostic) — ADR-923 §5.5 · ADR-650 M2.
 *
 * Step 1 of the two-step import (see `tabular-types`): turn bytes into a table of untyped
 * cells. It does NOT decide what the columns mean — that belongs to the consumer's mapper.
 *
 * Why we auto-detect instead of asking: every source exports a different separator
 * (Leica `,`, Greek Excel `;`, total-station dumps tab/space) and the user should not
 * have to know. The wizards still show the detection and let it be overridden.
 *
 * Header detection follows the same rule as Civil 3D/Excel: a first row whose leading cells
 * are NOT numbers is a header row (labels), otherwise the file starts straight at data.
 *
 * @module lib/tabular-import/delimited-reader
 */

import type { RawTable } from './tabular-types';
import { parseTabularField } from './tabular-field';

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
 * Share of cells that hold NO other structural delimiter (space excluded — it lives inside descriptions).
 * A cell the field judge reads as a number is pure even with a comma in it: there the comma is a DECIMAL mark.
 *
 * ADR-920 Β4.1α — the Greek-Excel case: `345678,123;4201234,456;125,30` splits into FOUR cells on `,` and
 * three on `;`, so a pure count crowned the comma and the file read as garbage, silently. A delimiter whose
 * cells still contain another candidate did not structure the line (the `csv.Sniffer` intuition).
 */
function cellPurity(rows: readonly (readonly string[])[], delimiter: string): number {
  const others = DELIMITERS.filter((d) => d !== delimiter && d !== ' ');
  const cells = rows.flat();
  if (cells.length === 0) return 0;
  const pure = (cell: string): boolean => parseTabularField(cell) !== null || !others.some((d) => cell.includes(d));
  return cells.filter(pure).length / cells.length;
}

/**
 * Pick the delimiter that splits the sample lines into the most columns, consistently and cleanly.
 * Consistency matters more than count: a stray comma inside one description must not
 * outvote the tab that actually structures the file — and purity ({@link cellPurity}) keeps a
 * decimal comma from outvoting the semicolon of a Greek-locale export.
 */
export function detectDelimiter(sampleLines: readonly string[]): string {
  let best = ' ';
  let bestScore = 0;

  for (const delimiter of DELIMITERS) {
    const rows = sampleLines.map((l) => splitDelimitedLine(l, delimiter));
    const counts = rows.map((cells) => cells.length);
    const min = Math.min(...counts);
    if (min < 2) continue; // did not split anything → not the separator
    const consistent = counts.every((c) => c === counts[0]);
    const score = min * (consistent ? 2 : 1) * cellPurity(rows, delimiter);
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/** A row is DATA when at least its first two cells parse as plain numbers. */
function looksNumeric(cells: readonly string[]): boolean {
  // ADR-920 Β4.1α — ο ΙΔΙΟΣ κριτής πεδίου με τον sniffer (`parseTabularField`): μια γραμμή είναι «δεδομένα» μόνο αν
  // τα πρώτα της κελιά τα διαβάζει και ο αντιστοιχιστής. el-GR «12,34» ⇒ αριθμός· «P1» ⇒ επικεφαλίδα, ποτέ «1».
  // (Ως τότε: `normalizeNumber` του viewer — το lib δεν εισάγει ποτέ από το subapp.)
  const numeric = (c: string): boolean => parseTabularField(c) !== null;
  return cells.length >= 2 && numeric(cells[0]) && numeric(cells[1]);
}

export interface ReadDelimitedOptions {
  /** Force a separator instead of auto-detecting it (wizard override). */
  readonly delimiter?: string;
  /** Leading data lines to drop before the header check (a supplier's title rows above the table). */
  readonly skipRows?: number;
}

/**
 * Parse raw text into a `RawTable`. Comment and blank lines are dropped; the first row is
 * taken as headers only when it does not look like data.
 */
export function readDelimitedText(text: string, opts: ReadDelimitedOptions = {}): RawTable {
  const lines = text.split(/\r?\n/).filter((l) => !isComment(l)).slice(opts.skipRows ?? 0);
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
