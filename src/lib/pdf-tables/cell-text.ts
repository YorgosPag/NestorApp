/**
 * Από λέξεις με θέσεις στο κείμενο ενός κελιού (ADR-923 §5.5.1), και η ανάγνωση κελιού με τις ενώσεις του.
 *
 * 🔑 Τα κομμάτια χωρίς κενό ανάμεσά τους ενώνονται χωρίς κενό: το PDF σπάει το «m³/h» σε τρία, και κενό θα έφτιαχνε άλλη μονάδα.
 * 🔑 Η δεύτερη γραμμή ενός κελιού συνεχίζει την πρώτη όταν αλλάζει γραμμή πάνω σε σύνδεσμο: η Aries τυπώνει «858x596» και κάτω
 * «x250», που είναι μία τιμή. Αλλού οι γραμμές είναι λέξεις.
 * @module lib/pdf-tables/cell-text
 */

import type { PageBox, PageTable, PageTableCell, PageWord } from './page-table-types';

/** Κενό γραμμής ≈ 2 pt: πιο κάτω είναι το ίδιο κείμενο σε χωριστό κομμάτι. */
const SAME_WORD_GAP = 0.003;
const CONTINUES = /^[x×*\-–/]|[x×*\-–/]$/iu;

const centerY = ({ y, height }: PageBox): number => y + height / 2;

function linesOf(words: readonly PageWord[]): PageWord[][] {
  const lines: PageWord[][] = [];
  for (const word of [...words].sort((a, b) => centerY(a) - centerY(b))) {
    const line = lines.find((candidate) => Math.abs(centerY(candidate[0]) - centerY(word)) <= word.height / 2);
    if (line) line.push(word);
    else lines.push([word]);
  }
  return lines;
}

function lineText(line: readonly PageWord[]): string {
  const ordered = [...line].sort((a, b) => a.x - b.x);
  return ordered.reduce((text, word, index) => {
    const before = ordered[index - 1];
    return before && word.x - (before.x + before.width) <= SAME_WORD_GAP ? `${text}${word.text}` : `${text} ${word.text}`;
  }, '').trim();
}

export function cellText(words: readonly PageWord[]): string {
  return linesOf(words).map(lineText).reduce((text, line) => {
    if (text === '') return line;
    return CONTINUES.test(text.slice(-1)) || CONTINUES.test(line.slice(0, 1)) ? `${text}${line}` : `${text} ${line}`;
  }, '');
}

/** Το κελί που καλύπτει αυτή τη θέση του πλέγματος, λαμβάνοντας υπόψη τις ενώσεις. */
export function tableCellAt(table: Pick<PageTable, 'cells'>, row: number, col: number): PageTableCell | null {
  return table.cells.find((cell) => row >= cell.row && row < cell.row + cell.rowSpan && col >= cell.col && col < cell.col + cell.colSpan) ?? null;
}
