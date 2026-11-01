/**
 * Οι **ετικέτες δομής ως δεύτερος μάρτυρας** (ADR-923 §5.5.1). Μόνο το 63 % των Tagged PDF 1.7 τηρεί τους κανόνες (PDF Association,
 * «Tagged PDF in the Wild»), και το pdf.js δεν δίνει ενώσεις κελιών, άρα οι ετικέτες δεν είναι αυθεντία. Όταν όμως υπάρχουν, είναι
 * ανεξάρτητη πηγή από τη γεωμετρία: όταν δύο ανεξάρτητοι μάρτυρες λένε τα ίδια κελιά, η ανασύνθεση αξίζει εμπιστοσύνη.
 * @module lib/pdf-tables/tag-witness
 */

import type { PageTable, PageTableWitness, PageTagTable } from './page-table-types';

/** Τα κενά δεν είναι μαρτυρία: οι ετικέτες κολλούν τις γραμμές ενός κελιού. */
const cellForm = (text: string): string => text.replace(/\s+/gu, '');

function counts(texts: readonly string[]): Map<string, number> {
  const tally = new Map<string, number>();
  for (const text of texts.map(cellForm).filter((form) => form !== '')) tally.set(text, (tally.get(text) ?? 0) + 1);
  return tally;
}

function sameCounts(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): boolean {
  return left.size === right.size && [...left].every(([text, count]) => right.get(text) === count);
}

const overlap = (left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): number =>
  [...left.keys()].filter((text) => right.has(text)).length;

/** Τι λέει ο πίνακας με τις ετικέτες που του μοιάζουν περισσότερο. Κανένας κοινός τόπος ⇒ δεν υπάρχει μάρτυρας γι' αυτόν. */
export function witnessOf(table: Pick<PageTable, 'cells'>, tagTables: readonly PageTagTable[]): PageTableWitness {
  const built = counts(table.cells.map((cell) => cell.text));
  const candidates = tagTables.map((tag) => counts(tag.rows.flat()));
  const best = candidates.reduce<{ tally: ReadonlyMap<string, number> | null; score: number }>(
    (leader, tally) => {
      const score = overlap(built, tally);
      return score > leader.score ? { tally, score } : leader;
    },
    { tally: null, score: 0 },
  );
  if (best.tally === null) return 'absent';
  return sameCounts(built, best.tally) ? 'agrees' : 'disputed';
}
