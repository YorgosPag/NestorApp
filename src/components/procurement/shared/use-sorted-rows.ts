'use client';

/**
 * =============================================================================
 * PROCUREMENT — Η ταξινόμηση μιας λεπτής λίστας, **μία φορά** (ADR-784 §10.4 · CHECK 3.28)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ:** τρεις λίστες έγραφαν το **ίδιο** σώμα ταξινόμησης — «φορά από το
 * `sortOrder` · αντίγραφο του πίνακα · `switch` πάνω στο `sortBy` · πολλαπλασιασμός επί τη φορά»
 * — και **μόνο** οι συγκρίσεις διέφεραν. Το ονόμασε το **CHECK 3.28** (jscpd, ADR-584).
 *
 * 🔑 **Ο τύπος έγινε αυστηρότερος από τον κώδικα που αντικατέστησε.** Το `Record<TSortKey, …>`
 * απαιτεί σύγκριση για **κάθε** κλειδί του λεξιλογίου· το παλιό `switch` είχε `default`, οπότε
 * ένα ξεχασμένο κλειδί έπεφτε σιωπηλά στην ταξινόμηση κατά όνομα — **λάθος σειρά χωρίς κανένα
 * σφάλμα**. Πλέον το λέει ο μεταγλωττιστής.
 *
 * ⚠️ **Η φορά εφαρμόζεται ΕΔΩ, μία φορά.** Οι συγκρίσεις γράφονται πάντα σε **αύξουσα** μορφή —
 * μια σύγκριση που κουβαλά μόνη της το `dir` θα το εφάρμοζε δύο φορές.
 *
 * @module components/procurement/shared/use-sorted-rows
 */

import { useMemo, useRef } from 'react';

export type RowComparator<TItem> = (a: TItem, b: TItem) => number;

/**
 * @param comparators — **αύξουσα** σύγκριση ανά κλειδί ταξινόμησης.
 */
export function useSortedRows<TItem, TSortKey extends string>(
  items: readonly TItem[],
  sortBy: TSortKey,
  sortOrder: 'asc' | 'desc',
  comparators: Record<TSortKey, RowComparator<TItem>>,
): TItem[] {
  /**
   * ⚠️ Οι συγκρίσεις έρχονται ως **κυριολεκτικό αντικείμενο** από τον καλούντα, δηλαδή νέα
   * ταυτότητα σε κάθε απόδοση. Στη λίστα εξαρτήσεων θα ακύρωναν το `useMemo` **πάντα** — και το
   * `useMemo` είναι ακριβώς ο λόγος που υπάρχει αυτό το hook. Η αναφορά κρατά την τελευταία
   * εκδοχή χωρίς να συμμετέχει στις εξαρτήσεις.
   */
  const comparatorsRef = useRef(comparators);
  comparatorsRef.current = comparators;

  return useMemo(() => {
    const direction = sortOrder === 'asc' ? 1 : -1;
    const compare = comparatorsRef.current[sortBy];
    return [...items].sort((a, b) => compare(a, b) * direction);
  }, [items, sortBy, sortOrder]);
}
