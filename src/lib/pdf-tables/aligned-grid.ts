/**
 * Πίνακες **χωρίς γραμμές** (ADR-923 §5.5.1): η οικογένεια Stream του Camelot και της στρατηγικής `text` του pdfplumber. Τρέχει
 * μόνο πάνω σε λέξεις που δεν ανήκουν σε χαραγμένο πίνακα.
 *
 * Γραμμή πίνακα = γραμμή κειμένου με τουλάχιστον τρία χωριστά κομμάτια. Πίνακας = τουλάχιστον τρεις τέτοιες γραμμές στη σειρά, ώστε
 * μια πρόταση με διάστιχο να μη γίνεται πίνακας. Οι στήλες βγαίνουν από τα κέντρα των κομματιών.
 * @module lib/pdf-tables/aligned-grid
 */

import { cellText } from './cell-text';
import type { PageBox, PageTableCell, PageWord } from './page-table-types';
import type { RulingTable } from './ruled-grid';

/** Κενό που χωρίζει κελιά, όχι λέξεις. */
const CELL_GAP = 0.012;
const COLUMN_TOLERANCE = 0.02;
const MIN_SEGMENTS = 3;
const MIN_ROWS = 3;
/** Στήλη με λιγότερα από τόσα κομμάτια είναι τυχαία στοίχιση (το `min_words_vertical` του pdfplumber). */
const MIN_COLUMN_SEGMENTS = 3;

type Segment = readonly PageWord[];

interface TextLine {
  readonly y: number;
  readonly words: readonly PageWord[];
}

function textLines(words: readonly PageWord[]): TextLine[] {
  const lines: { y: number; words: PageWord[] }[] = [];
  for (const word of [...words].sort((a, b) => a.y - b.y)) {
    const open = lines[lines.length - 1];
    if (open && Math.abs(open.y - word.y) <= word.height / 2) open.words.push(word);
    else lines.push({ y: word.y, words: [word] });
  }
  return lines;
}

function segmentsOf(line: TextLine): Segment[] {
  const segments: PageWord[][] = [];
  for (const word of [...line.words].sort((a, b) => a.x - b.x)) {
    const open = segments[segments.length - 1];
    const last = open?.[open.length - 1];
    if (last && word.x - (last.x + last.width) < CELL_GAP) open.push(word);
    else segments.push([word]);
  }
  return segments;
}

const centerX = (segment: Segment): number => (segment[0].x + segment[segment.length - 1].x + segment[segment.length - 1].width) / 2;

function columnCenters(rows: readonly (readonly Segment[])[]): number[] {
  const clusters: { sum: number; count: number }[] = [];
  for (const center of rows.flat().map(centerX).sort((a, b) => a - b)) {
    const open = clusters[clusters.length - 1];
    if (open && center - open.sum / open.count <= COLUMN_TOLERANCE) Object.assign(open, { sum: open.sum + center, count: open.count + 1 });
    else clusters.push({ sum: center, count: 1 });
  }
  return clusters.filter(({ count }) => count >= MIN_COLUMN_SEGMENTS).map(({ sum, count }) => sum / count);
}

const boxOf = (words: readonly PageWord[]): PageBox => {
  const left = Math.min(...words.map((word) => word.x));
  const top = Math.min(...words.map((word) => word.y));
  return { x: left, y: top, width: Math.max(...words.map((word) => word.x + word.width)) - left, height: Math.max(...words.map((word) => word.y + word.height)) - top };
};

const nearestColumn = (columns: readonly number[], center: number): number =>
  columns.reduce((best, column, index) => (Math.abs(column - center) < Math.abs(columns[best] - center) ? index : best), 0);

function alignedTable(rows: readonly (readonly Segment[])[]): RulingTable | null {
  const columns = columnCenters(rows);
  if (columns.length < MIN_SEGMENTS) return null;
  const cells: PageTableCell[] = rows.flatMap((segments, row) => segments.map((segment) => ({
    row,
    col: nearestColumn(columns, centerX(segment)),
    rowSpan: 1,
    colSpan: 1,
    text: cellText(segment),
    wordIds: segment.map((word) => word.id),
    box: boxOf(segment),
  })));
  return { source: 'aligned', rowCount: rows.length, colCount: columns.length, cells };
}

/** Οι αχάρακτοι πίνακες από τις λέξεις που περίσσεψαν. */
export function alignedTables(words: readonly PageWord[]): RulingTable[] {
  const tables: RulingTable[] = [];
  let run: Segment[][] = [];
  const close = (): void => {
    if (run.length >= MIN_ROWS) tables.push(...[alignedTable(run)].flatMap((table) => table ?? []));
    run = [];
  };
  for (const line of textLines(words)) {
    const segments = segmentsOf(line);
    if (segments.length >= MIN_SEGMENTS) run.push(segments);
    else close();
  }
  close();
  return tables;
}
