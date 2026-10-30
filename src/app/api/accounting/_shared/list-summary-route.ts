/**
 * @fileoverview Εργοστάσιο `GET …/summary` — οι κάρτες μιας λίστας πάνω σε ΟΛΗ την εμβέλεια των φίλτρων της.
 * @module api/accounting/_shared/list-summary-route
 *
 * Ένα σχήμα για κάθε λίστα της λογιστικής: φίλτρα από το ΙΔΙΟ `…FiltersOf` με τη σελίδα → πλήρης σάρωση με το ΙΔΙΟ
 * spec (`collect…List` → `scanAccountingList`) → καθαρή σύνοψη. Μη υποστηριζόμενος συνδυασμός ⇒ 400 με τον κωδικό της
 * σελίδας (`respondWithListRead`). Γραμμένο ανά route θα ήταν τέσσερις κλώνοι (N.18 · CHECK 3.28).
 *
 * 🏛️ Xero / QuickBooks: τα σύνολα πάνω από μια λίστα είναι άθροισμα του διακομιστή ανά φίλτρο, ανεξάρτητο από τη σελίδα.
 * @see ADR-ACC-010 §2.1.1 («σελίδα ≠ καθολικό» — κάρτες σύνοψης)
 */

import 'server-only';

import { defineRoute } from '@/lib/api/define-route';

import { readListContext, respondWithListRead } from './list-request-context';

type ListRepository = ReturnType<typeof readListContext>['repository'];

export interface ListSummaryRoute<F, R, S> {
  readonly fallbackError: string;
  /** Η ΙΔΙΑ ανάγνωση φίλτρων με τη σελίδα (`_shared/list-filters.ts`). */
  readonly filtersOf: (searchParams: URLSearchParams) => F;
  /** Η πλήρης εμβέλεια — `repository.collect…List(filters)`, ποτέ σελίδα. */
  readonly collect: (repository: ListRepository, filters: F) => Promise<R[]>;
  /** Καθαρή σύνοψη (`services/list-summaries/`). */
  readonly summarize: (rows: readonly R[]) => S;
}

export function listSummaryRoute<F, R, S>(route: ListSummaryRoute<F, R, S>) {
  return defineRoute({
    rateLimit: 'standard',
    fallbackError: route.fallbackError,
    handler: async ({ req, auth }) => {
      const { repository, searchParams } = readListContext(req, auth);
      const filters = route.filtersOf(searchParams);
      return respondWithListRead(async () => route.summarize(await route.collect(repository, filters)));
    },
  });
}
