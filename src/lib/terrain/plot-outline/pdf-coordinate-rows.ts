/**
 * @fileoverview **PDF page text → the rows of a ΕΓΣΑ'87 vertex coordinate table** (ADR-920 §14.11 Π5 · Ζ1).
 * @related ../../pdf/pdf-page-text (the ONE page model, ADR-949) · ../../geo/greek-grid · ./pdf-coordinate-table
 *
 * A Greek topographic diagram lists the plot's corners as `ΣΗΜΕΙΟ | X | Y | ΜΗΚΟΣ` (ADR-920 §14.11 research). Column
 * headers vary (Χ/Ψ · X/Y · Ε/Ν · «Α/Α»), are often missing from the text layer, and the order is not fixed. So the
 * row is recognised by its NUMBERS, not by a header:
 *
 * 🔑 **A coordinate pair is two consecutive numbers that land inside the ΕΓΣΑ'87 area of use** (EPSG:2100, E ≈ 95–893 km,
 *    N ≈ 3 859–4 631 km). The two ranges do not overlap, so easting and northing are told apart by MAGNITUDE — in
 *    either column order — and no other number on a sheet (a scale, a date, a length, a height) passes for a pair.
 * 🔑 The label is the token right before the pair (Α · Β · Κ1 · 12); the side length, the number right after it, when
 *    that number is not itself the next row's label. Two tables printed side by side on one text line yield two rows.
 * 🔑 Numbers go through `parseStrictDecimal` (the survey-data grammar: «384512,34» and «4.201.234,56» read; «11 μ.»
 *    does not).
 */

import { isWithinGreekGridAreaOfUse } from '@/lib/geo/greek-grid';
import { parseStrictDecimal } from '@/lib/number/locale-number';
import { linesOf, type PdfPositionedPage, type PdfTextLine } from '@/lib/pdf/pdf-page-text';
import { normalizeGreekHomoglyphs } from '@/utils/greek-text';

/** One vertex row as printed. Positions in page units (screen frame of `pdf-page-text`). */
export interface CoordinateRow {
  readonly label: string;
  readonly labelX: number;
  readonly y: number;
  readonly eastingM: number;
  readonly northingM: number;
  /** The length printed on the row, metres (`null` when the row prints none or it cannot be told apart). */
  readonly sideM: number | null;
}

interface Token {
  readonly text: string;
  readonly x: number;
  readonly value: number | null;
}

/** A vertex label in a coordinate table: letters (+ digits) or a short point number. */
const TABLE_LABEL = /^(?:[Α-ΩA-Z]{1,2}\d{0,3}|\d{1,4})$/u;
/** A side length worth reading, metres — a plot side is never zero and never kilometres. */
const MAX_SIDE_M = 10_000;

/** Whitespace-separated tokens of a line, each placed proportionally inside its pdf.js item. */
function tokensOf(line: PdfTextLine): Token[] {
  const tokens: Token[] = [];
  for (const item of line.items) {
    for (const match of item.s.matchAll(/\S+/gu)) {
      const offset = item.s.length > 0 ? (match.index ?? 0) / item.s.length : 0;
      tokens.push({ text: match[0], x: item.x + offset * item.w, value: parseStrictDecimal(match[0]) });
    }
  }
  return tokens;
}

/** `[easting, northing]` when tokens k, k+1 form a ΕΓΣΑ'87 pair in either order, else `null`. */
function gridPairAt(tokens: readonly Token[], k: number): readonly [number, number] | null {
  const a = tokens[k]?.value;
  const b = tokens[k + 1]?.value;
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (isWithinGreekGridAreaOfUse(a, b)) return [a, b];
  return isWithinGreekGridAreaOfUse(b, a) ? [b, a] : null;
}

/** The start index of every grid pair on the line, left to right, never overlapping. */
function pairStarts(tokens: readonly Token[]): number[] {
  const starts: number[] = [];
  for (let k = 0; k + 1 < tokens.length; k++) {
    if (gridPairAt(tokens, k) !== null) { starts.push(k); k++; }
  }
  return starts;
}

function labelAt(tokens: readonly Token[], index: number, taken: number): Token | null {
  if (index < 0 || index <= taken) return null;
  const token = tokens[index];
  return token && TABLE_LABEL.test(normalizeGreekHomoglyphs(token.text).toUpperCase()) ? token : null;
}

function sideAt(tokens: readonly Token[], index: number, nextLabelIndex: number): number | null {
  if (index >= nextLabelIndex) return null;
  const value = tokens[index]?.value;
  return value !== null && value !== undefined && value > 0 && value < MAX_SIDE_M ? value : null;
}

function rowsOfLine(line: PdfTextLine): CoordinateRow[] {
  const tokens = tokensOf(line);
  const starts = pairStarts(tokens);
  const rows: CoordinateRow[] = [];
  starts.forEach((k, i) => {
    const label = labelAt(tokens, k - 1, i > 0 ? starts[i - 1] + 1 : -1);
    const pair = gridPairAt(tokens, k);
    if (label === null || pair === null) return;
    const nextLabelIndex = i + 1 < starts.length ? starts[i + 1] - 1 : tokens.length;
    rows.push({
      label: label.text, labelX: label.x, y: line.y,
      eastingM: pair[0], northingM: pair[1], sideM: sideAt(tokens, k + 2, nextLabelIndex),
    });
  });
  return rows;
}

/** Every coordinate row on a page, top to bottom, left to right. */
export function coordinateRowsOf(page: PdfPositionedPage): CoordinateRow[] {
  return linesOf(page).flatMap(rowsOfLine);
}

/** The page's plain text, line by line — what the area statements are read from. */
export function pageLinesText(page: PdfPositionedPage): string {
  return linesOf(page).map((line) => line.items.map((item) => item.s).join(' ')).join('\n');
}
