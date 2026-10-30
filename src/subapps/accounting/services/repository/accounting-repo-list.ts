/**
 * @fileoverview Accounting Repository — ΣΕΛΙΔΑ λίστας οθόνης (SSoT των 4 λιστών)
 * @description Ο ένας μηχανισμός πίσω από τις λίστες ημερολογίου / τιμολογίων / τράπεζας / παγίων
 *   (ADR-ACC-010 §2.1.1 Φάση 3β). Η δήλωση κάθε λίστας ζει στο `accounting-list-specs.ts`.
 *
 * Συμβόλαιο:
 *   - **κλειστό σύνολο** συνδυασμών φίλτρων ανά λίστα (`shapes`), ο καθένας με δείκτη (άγκυρα
 *     `accounting-list-index.test.ts`). Συνδυασμός εκτός συνόλου ⇒ `UnsupportedListFilterError` ⇒ 400 —
 *     όχι `FAILED_PRECONDITION` που γινόταν «κενή λίστα» (Google AIP-160: η υπηρεσία δηλώνει τι φιλτράρει)·
 *   - δρομέας keyset μέσω του SSoT `readKeysetPage` (αδιαφανής, δεμένος στα φίλτρα, tie-breaker στο id)·
 *   - **ΚΑΝΕΝΑ** fallback: σφάλμα Firestore = σφάλμα στην οθόνη, ποτέ «μηδέν εγγραφές».
 *
 * ⚠️ Σελίδα ≠ καθολικό: για υπολογισμό υπάρχουν τα `collect*` (`accounting-repo-scan.ts`).
 *
 * @see ADR-ACC-010 §2.1.1
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import {
  decodeKeysetCursor,
  readKeysetPage,
  type KeysetOrder,
  type KeysetScope,
} from '@/lib/admin-keyset-page';
import type { PageRequest, PaginatedResult } from '@/lib/pagination';

import type { TenantContext } from '../../types/common';

import { scanLedger } from './accounting-repo-scan';

/** Τιμή φίλτρου λίστας — μόνο ισότητα. */
export type ListFilterValue = string | number;

/** Φίλτρα λίστας: κάθε κλειδί προαιρετικό, τιμή ισότητας. */
export type ListFilters<F> = { readonly [K in keyof F]?: ListFilterValue };

/** Η δήλωση μιας λίστας οθόνης. */
export interface AccountingListSpec<F extends ListFilters<F>> {
  readonly collection: string;
  readonly order: KeysetOrder;
  /** Κλειδί φίλτρου → πεδίο Firestore. */
  readonly fields: { readonly [K in keyof F]-?: string };
  /** Οι υποστηριζόμενοι συνδυασμοί φίλτρων (πάντα μαζί με `companyId`). Ο καθένας έχει δείκτη. */
  readonly shapes: readonly (readonly (keyof F & string)[])[];
}

/** Ο συνδυασμός φίλτρων δεν υποστηρίζεται (δεν έχει δείκτη) — ο καλών απαντά 400. */
export class UnsupportedListFilterError extends Error {
  constructor(readonly collection: string, readonly shape: readonly string[]) {
    super(`Unsupported filter combination for ${collection}: [${shape.join(', ')}]`);
    this.name = 'UnsupportedListFilterError';
  }
}

/** Τα φίλτρα που έχουν τιμή, σε κανονική (ταξινομημένη) σειρά. */
function activeFilters<F extends ListFilters<F>>(filters: F): [keyof F & string, ListFilterValue][] {
  return (Object.entries(filters) as [keyof F & string, ListFilterValue | undefined][])
    .filter((entry): entry is [keyof F & string, ListFilterValue] => entry[1] !== undefined && entry[1] !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Ταυτότητα συνδυασμού — ανεξάρτητη από τη σειρά των κλειδιών. */
export function listShapeKey(keys: readonly string[]): string {
  return [...keys].sort().join('|');
}

/** Τα ενεργά φίλτρα, αφού ελεγχθεί ότι ο συνδυασμός τους είναι δηλωμένος — αλλιώς `UnsupportedListFilterError`. */
function supportedFilters<F extends ListFilters<F>>(
  spec: AccountingListSpec<F>,
  filters: F,
): [keyof F & string, ListFilterValue][] {
  const active = activeFilters(filters);
  const shape = active.map(([key]) => key);
  const wanted = listShapeKey(shape);
  if (!spec.shapes.some((declared) => listShapeKey(declared) === wanted)) {
    throw new UnsupportedListFilterError(spec.collection, shape);
  }
  return active;
}

/**
 * Το φιλτραρισμένο ερώτημα — **χωρίς** ταξινόμηση (τη βάζει ο αναγνώστης keyset). Δέχεται τη ρίζα ως `Query`
 * ώστε η άγκυρα δεικτών να εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κατασκευαστή πάνω σε καταγραφέα.
 */
export function buildListQuery<F extends ListFilters<F>>(
  root: Query,
  companyId: string,
  spec: AccountingListSpec<F>,
  filters: F,
): Query {
  return supportedFilters(spec, filters).reduce<Query>(
    (query, [key, value]) => query.where(spec.fields[key], '==', value),
    root.where('companyId', '==', companyId),
  );
}

/** Μία σελίδα μιας λίστας οθόνης. Πετά σε σφάλμα· ποτέ μερικό, ποτέ «κενό» αντί για σφάλμα. */
export async function readAccountingListPage<F extends ListFilters<F>, T>(
  tenant: TenantContext,
  spec: AccountingListSpec<F>,
  filters: F,
  page: PageRequest,
  map: (data: DocumentData) => T,
): Promise<PaginatedResult<T>> {
  // Οι αρνήσεις του πελάτη (φίλτρα / δρομέας) κρίνονται ΠΡΙΝ από τη βάση — δεν είναι βλάβη της.
  const scope: KeysetScope = Object.fromEntries(supportedFilters(spec, filters));
  const after = decodeKeysetCursor(page.cursor, spec.order, scope);
  // Χωρίς fallback: το safeFirestoreOperation ξαναρίχνει το σφάλμα αντί να επιστρέψει «κενό».
  return safeFirestoreOperation((db: Firestore) =>
    readKeysetPage({
      base: buildListQuery(db.collection(spec.collection), tenant.companyId, spec, filters),
      order: spec.order,
      scope,
      pageSize: page.pageSize,
      after,
      map,
    }),
  );
}

/**
 * **ΟΛΗ η εμβέλεια μιας λίστας** — για τα σύνολα της οθόνης (ADR-ACC-010 §2.1.1 «κάρτες σύνοψης»).
 *
 * 🔑 Ίδιο spec, ίδια φίλτρα, ίδια ταξινόμηση με τη {@link readAccountingListPage} ⇒ **ίδιοι δείκτες** και ίδιο σύνολο
 *    εγγράφων: η κάρτα «Σύνολο» δεν μπορεί να μετρά άλλα έγγραφα από όσα δείχνει η λίστα όταν ξετυλιχτεί ως το τέλος.
 *    Ο μηχανισμός (cursor, χωρίς fallback, όριο που πετά) είναι το SSoT `scanLedger`.
 */
export function scanAccountingList<F extends ListFilters<F>, T>(
  tenant: TenantContext,
  spec: AccountingListSpec<F>,
  filters: F,
  map: (data: DocumentData) => T,
): Promise<T[]> {
  // Η άρνηση του πελάτη (φίλτρα) κρίνεται ΠΡΙΝ από τη βάση — ίδια με τη σελίδα.
  const scope = Object.fromEntries(supportedFilters(spec, filters));
  return scanLedger({
    ledger: `${spec.collection} list`,
    scope,
    build: (db) =>
      buildListQuery(db.collection(spec.collection), tenant.companyId, spec, filters)
        .orderBy(spec.order.field, spec.order.direction),
    map,
  });
}
