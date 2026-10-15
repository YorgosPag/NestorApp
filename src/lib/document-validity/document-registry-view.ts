/**
 * =============================================================================
 * Μητρώο λήξεων — οι ΠΡΟΒΟΛΕΣ της οθόνης (ADR-915 Φ4γ)
 * =============================================================================
 *
 * Η οθόνη δείχνει «Όλα» ή ένα από τα φίλτρα της Ε3. Εδώ ζουν: το κλειστό σύνολο προβολών, ο ανεκτικός αναγνώστης
 * της παραμέτρου διεύθυνσης (`?view=`), οι γραμμές μιας προβολής και ο μετρητής κάθε προβολής.
 *
 * 🔑 **Κανένας δεύτερος ταξινομητής**: κάθε απόφαση «ανήκει η γραμμή στην προβολή;» περνά από τον
 *    {@link matchesRegistryFilter} με το `asOf` **της απόκρισης** — ποτέ ρολόι πελάτη. Αν η οθόνη έκρινε μόνη της, το
 *    «μπλοκάρει» θα μπορούσε να λέει άλλο από τον διακομιστή την πρώτη φορά που αλλάζει ο κανόνας.
 *
 * 🏆 **Η προβολή ζει στη διεύθυνση** (Ironclad «saved views» · Zillow): ο σύνδεσμος μοιράζεται, το «πίσω» δουλεύει, και
 *    οι ειδοποιήσεις της Φ5 οδηγούν **κατευθείαν** στο «μπλοκάρει».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 *
 * @module lib/document-validity/document-registry-view
 */

import { withQuery } from '@/lib/workspace/route-worlds';
import { DOCUMENT_EXPIRY_ROUTE } from '@/lib/document-validity/document-registry-routes';
import {
  matchesRegistryFilter,
  REGISTRY_FILTERS,
  type RegistryRow,
} from '@/lib/document-validity/document-registry';

/** Η προβολή χωρίς φίλτρο — δείχνει **και** τις αντικατεστημένες γραμμές, υποβαθμισμένες. */
export const REGISTRY_VIEW_ALL = 'all' as const;

/** Οι προβολές της οθόνης, στη σειρά εμφάνισης. Κλειστό σύνολο. */
export const REGISTRY_VIEWS = [REGISTRY_VIEW_ALL, ...REGISTRY_FILTERS] as const;
export type RegistryView = (typeof REGISTRY_VIEWS)[number];

/** Η παράμετρος της διεύθυνσης — ΕΝΑ όνομα. */
export const REGISTRY_VIEW_PARAM = 'view' as const;

const VIEW_SET: ReadonlySet<string> = new Set(REGISTRY_VIEWS);

export function isRegistryView(value: unknown): value is RegistryView {
  return typeof value === 'string' && VIEW_SET.has(value);
}

/** Ανεκτικός αναγνώστης: άγνωστη ή κενή τιμή ⇒ «Όλα» (ένας παλιός σύνδεσμος δεν σπάει τη σελίδα). */
export function registryViewOf(param: string | null | undefined): RegistryView {
  return isRegistryView(param) ? param : REGISTRY_VIEW_ALL;
}

/** Η διεύθυνση μιας προβολής. Το «Όλα» **δεν** γράφει παράμετρο: μία διεύθυνση ανά περιεχόμενο. */
export function documentExpiryHref(view: RegistryView = REGISTRY_VIEW_ALL): string {
  return view === REGISTRY_VIEW_ALL
    ? DOCUMENT_EXPIRY_ROUTE
    : withQuery(DOCUMENT_EXPIRY_ROUTE, `${REGISTRY_VIEW_PARAM}=${encodeURIComponent(view)}`);
}

/** Ταιριάζει η γραμμή στην προβολή; Το «Όλα» δέχεται τα πάντα· κάθε φίλτρο ρωτά τον ΕΝΑ ταξινομητή. */
export function matchesRegistryView(row: RegistryRow, view: RegistryView, asOf: string): boolean {
  return view === REGISTRY_VIEW_ALL || matchesRegistryFilter(row, view, asOf);
}

/** Οι γραμμές μιας προβολής, **στη σειρά του διακομιστή** (επείγον πρώτα). */
export function rowsOfRegistryView(rows: readonly RegistryRow[], view: RegistryView, asOf: string): readonly RegistryRow[] {
  return rows.filter((row) => matchesRegistryView(row, view, asOf));
}

/** Πόσες γραμμές σε κάθε προβολή — **όλες, και οι μηδενικές** («κοίταξα, 0» ≠ «δεν υπάρχει φίλτρο»). */
export function registryViewTally(rows: readonly RegistryRow[], asOf: string): Readonly<Record<RegistryView, number>> {
  const tally = Object.fromEntries(REGISTRY_VIEWS.map((view) => [view, 0])) as Record<RegistryView, number>;
  for (const row of rows) {
    for (const view of REGISTRY_VIEWS) if (matchesRegistryView(row, view, asOf)) tally[view] += 1;
  }
  return tally;
}
