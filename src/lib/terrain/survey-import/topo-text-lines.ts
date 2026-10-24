/**
 * ADR-650 M8β/Δ — ASCII survey-text LEXING (the one place a line becomes fields).
 *
 * Three roads read the same kind of surveyor text — the zero-config parser (`parse-topo-points`),
 * the bulk cloud reader (`pointcloud/ascii-xyz-reader`) and the column sniffer
 * (`topo-column-sniffer`) — and all three had (or would have had) their own private copy of
 * «what is a comment» and «how does a line split into fields». That is the sibling-clone trap the
 * jscpd ratchet exists to catch (N.18 / ADR-584), and worse than the duplication is the DIVERGENCE:
 * the same file dropped down two roads must never be split into two different column layouts.
 *
 * ⚠️ WHAT THIS FILE IS NOT: it is not a parser. The readers stay separate on purpose —
 * `parse-topo-points` yields `TopoPoint[]` objects, `ascii-xyz-reader` yields SoA `Float32Array`s
 * for millions of points (30M objects ≈ 3 GB heap → dead tab). They share the LEXING, never the
 * parse strategy. See the header of `ascii-xyz-reader.ts`.
 */

import { parseLocaleNumber } from '@/lib/number/locale-number';

/** Any run of whitespace / comma / semicolon / tab separates two fields (the lenient default). */
const FIELD_SPLIT = /[\s,;]+/;

/** A field must LOOK numeric before we spend `parseLocaleNumber` on it — `TREE1` is not a number. */
const NUMERIC_FIELD = /^[+-]?[\d.,]+$/;

/**
 * ⚠️ THE COMMA IS AMBIGUOUS, and it bites exactly where it hurts: in the lenient default above a
 * comma SEPARATES fields, so a Greek-locale export (`1;345678,123;4201234,456;125,30;EDGE`) is torn
 * into eight fields instead of five — and once the fields have shifted, a declared column mapping
 * points at the wrong ones and the file reads as garbage. Silently.
 *
 * So when the caller KNOWS the file's delimiter (the wizard detects it with the M2 `detectDelimiter`
 * SSoT before it proposes a mapping), it asks for a splitter that honours it: with `;`, a tab or a
 * space as the delimiter, the comma stays a DECIMAL point and `parseTopoField` resolves it through
 * `parseLocaleNumber`. Only a genuinely comma-delimited file splits on commas.
 *
 * No delimiter → the historical lenient split, unchanged.
 */
export function fieldSplitterFor(delimiter?: string): (line: string) => string[] {
  if (delimiter === undefined) return splitTopoFields;
  const pattern = delimiter === ',' ? /[\s,]+/ : delimiter === ';' ? /[\s;]+/ : /\s+/;
  return (line) => line.trim().split(pattern).filter((f) => f.length > 0);
}

/** Blank, `#` and `//` lines carry no point — every road drops them identically. */
export function isTopoCommentLine(line: string): boolean {
  const t = line.trim();
  return t.length === 0 || t.startsWith('#') || t.startsWith('//');
}

/** One line → its fields, lenient (whitespace / comma / semicolon / tab all separate). */
export function splitTopoFields(line: string): string[] {
  return line.trim().split(FIELD_SPLIT).filter((f) => f.length > 0);
}

/** True when the field could be a number at all (cheap gate before the locale parse). */
export function looksNumericField(field: string): boolean {
  return NUMERIC_FIELD.test(field);
}

/**
 * One field → number, or `null`. The fast path is `Number()` (the overwhelming majority of survey
 * lines are plain dot-decimals); anything it rejects but that still looks numeric falls back to the
 * `parseLocaleNumber` SSoT, so a Greek-locale export (`384512,345`) parses identically everywhere.
 */
export function parseTopoField(field: string): number | null {
  if (!looksNumericField(field)) return null;
  const fast = Number(field);
  if (Number.isFinite(fast)) return fast;
  return parseLocaleNumber(field);
}

/**
 * Walk the text line by line WITHOUT materialising a `string[]`: `text.split()` on a 30M-line
 * file allocates 30M string objects on top of the (already huge) source string. `indexOf('\n')`
 * costs nothing and lets a reader stream. `ratio` is 0..1 progress through the text.
 */
export function forEachTopoLine(
  text: string,
  visit: (line: string, index: number, ratio: number) => void,
): void {
  const len = text.length;
  let start = 0;
  let index = 0;
  while (start < len) {
    let nl = text.indexOf('\n', start);
    if (nl === -1) nl = len;
    let end = nl;
    if (end > start && text.charCodeAt(end - 1) === 13) end--; // strip the CR of a CRLF file
    visit(text.slice(start, end), index++, start / len);
    start = nl + 1;
  }
}

/**
 * The first `maxLines` DATA lines, raw. Stops as soon as it has enough, so sniffing the head of a
 * 250 MB cloud costs the same as sniffing a 5 KB one.
 */
export function sampleTopoLines(text: string, maxLines: number): string[] {
  const lines: string[] = [];
  if (maxLines <= 0) return lines;

  const len = text.length;
  let start = 0;
  while (start < len && lines.length < maxLines) {
    let nl = text.indexOf('\n', start);
    if (nl === -1) nl = len;
    let end = nl;
    if (end > start && text.charCodeAt(end - 1) === 13) end--;
    const line = text.slice(start, end);
    if (!isTopoCommentLine(line)) lines.push(line);
    start = nl + 1;
  }
  return lines;
}

/**
 * The first `maxRows` DATA lines, split into fields — what the sniffer reasons over and what the
 * wizard shows as a preview grid. Pass the file's `delimiter` so the grid the engineer certifies is
 * split EXACTLY as the reader will split it; without it, the lenient default applies.
 */
export function sampleTopoRows(text: string, maxRows: number, delimiter?: string): string[][] {
  const split = fieldSplitterFor(delimiter);
  return sampleTopoLines(text, maxRows).map(split);
}
