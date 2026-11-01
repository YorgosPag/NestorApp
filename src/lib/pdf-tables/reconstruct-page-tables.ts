/**
 * Η **ανασύνθεση των πινάκων μιας σελίδας PDF** (ADR-923 §5.5.1): χωρίς μοντέλο, μόνο από όσα περιέχει το αρχείο. Χαραγμένοι πίνακες
 * πρώτα· ό,τι περισσεύει περνά από στοίχιση· οι ετικέτες κρίνουν το αποτέλεσμα. Το TableFormer κάνει το ίδιο βήμα με μοντέλο όρασης
 * και μετά τραβά το κείμενο από το PDF· εδώ το PDF δίνει και τη δομή, όταν την έχει.
 * @module lib/pdf-tables/reconstruct-page-tables
 */

import { alignedTables } from './aligned-grid';
import type { PageRule, PageTable, PageTagTable, PageWord } from './page-table-types';
import { ruledTables, type RulingTable } from './ruled-grid';
import { witnessOf } from './tag-witness';

export interface PageTableInput {
  readonly words: readonly PageWord[];
  readonly rules: readonly PageRule[];
  readonly tagTables: readonly PageTagTable[];
}

export function reconstructPageTables({ words, rules, tagTables }: PageTableInput): PageTable[] {
  const ruled = ruledTables(rules, words);
  const placed = new Set(ruled.flatMap((table) => table.cells.flatMap((cell) => cell.wordIds)));
  const aligned = alignedTables(words.filter((word) => !placed.has(word.id)));
  const byPosition = [...ruled, ...aligned].sort((a: RulingTable, b: RulingTable) => a.cells[0].box.y - b.cells[0].box.y);
  return byPosition.map((table, index) => ({ ...table, key: `t${index}`, witness: witnessOf(table, tagTables) }));
}
