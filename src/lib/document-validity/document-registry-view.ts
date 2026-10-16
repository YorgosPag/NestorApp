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
  type RegistryFilter,
  type RegistryRow,
  type RegistryRowState,
} from '@/lib/document-validity/document-registry';

/** Η προβολή χωρίς φίλτρο — δείχνει **και** τις αντικατεστημένες γραμμές, υποβαθμισμένες. */
export const REGISTRY_VIEW_ALL = 'all' as const;

/** Οι προβολές του επιλογέα (τα «τσιπ»), στη σειρά εμφάνισης. Κλειστό σύνολο. */
export const REGISTRY_PICKER_VIEWS = [REGISTRY_VIEW_ALL, ...REGISTRY_FILTERS] as const;
export type RegistryPickerView = (typeof REGISTRY_PICKER_VIEWS)[number];

/**
 * Προβολές **κατάστασης** — ό,τι ανοίγει μια κάρτα σύνοψης. Η `missing` και η `expiry-unknown` είναι **ήδη** φίλτρα με
 * ταυτόσημη σημασία (κενό · `state === 'expiry-unknown'`), άρα εδώ μένουν μόνο οι υπόλοιπες. Έτσι **κάθε**
 * `RegistryRowState` είναι `RegistryView` — η κάρτα λέει το όνομά της, χωρίς χάρτη μετάφρασης.
 */
export const REGISTRY_STATE_VIEWS = ['expired', 'expiring', 'valid', 'superseded'] as const satisfies
  readonly Exclude<RegistryRowState, RegistryFilter>[];
type RegistryStateView = (typeof REGISTRY_STATE_VIEWS)[number];

/** Όλες οι προβολές που δέχεται η διεύθυνση. Κλειστό σύνολο. */
export const REGISTRY_VIEWS = [...REGISTRY_PICKER_VIEWS, ...REGISTRY_STATE_VIEWS] as const;
export type RegistryView = (typeof REGISTRY_VIEWS)[number];

const FILTER_SET: ReadonlySet<string> = new Set(REGISTRY_FILTERS);

function isRegistryFilter(view: RegistryView): view is RegistryFilter {
  return FILTER_SET.has(view);
}

/**
 * Η κάρτα μιας κατάστασης ανοίγει την προβολή **με το ίδιο όνομα** (βλ. {@link REGISTRY_STATE_VIEWS})· πατημένη
 * κάρτα ξαναπατιέται ⇒ «Όλα» (εναλλαγή, όπως στο ταμπλό των ακινήτων — ADR-840 §7.8).
 */
export function toggledRegistryView(current: RegistryView, state: RegistryRowState): RegistryView {
  return current === state ? REGISTRY_VIEW_ALL : state;
}

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

/**
 * Ταιριάζει η γραμμή στην προβολή; Το «Όλα» δέχεται τα πάντα· κάθε φίλτρο ρωτά τον ΕΝΑ ταξινομητή· η προβολή
 * κατάστασης διαβάζει την κατάσταση **του διακομιστή** — ίδια πηγή με τον αριθμό της κάρτας.
 */
export function matchesRegistryView(row: RegistryRow, view: RegistryView, asOf: string): boolean {
  if (view === REGISTRY_VIEW_ALL) return true;
  if (isRegistryFilter(view)) return matchesRegistryFilter(row, view, asOf);
  return row.state === (view satisfies RegistryStateView);
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
