/**
 * **Το σχέδιο ερωτήματος της λίστας προϊόντων** — καθαρό, χωρίς Firestore (ADR-923 §5.10.4 Β2).
 *
 * Το ενιαίο πλέγμα (Akeneo Serenity: μοντέλα **και** απλά προϊόντα στην ίδια λίστα) διαβάζει **δύο** ζωντανά παράθυρα
 * με **την ίδια** ταξινόμηση: ριζικά μοντέλα (`parentId == null`) και απλά SKU (`modelId == null`). Το σχέδιο ζει εδώ,
 * **μία** φορά, ώστε:
 * - ο πελάτης να χτίζει τους περιορισμούς **από αυτό** (κανένα χειρόγραφο `where` αλλού)·
 * - μια άγκυρα να απαριθμεί **κάθε** συνδυασμό και να απαιτεί δείκτη στο `firestore.indexes.json` — το CHECK 3.15 δεν
 *   βλέπει ερωτήματα χτισμένα με συνθήκες, και ο emulator **δεν** επιβάλλει σύνθετους δείκτες (τους φτιάχνει μόνος).
 *
 * Facet μόνο **μέσα σε οικογένεια**: τα facets είναι δεμένα σε ιδιότητες της οικογένειας (`attr=option`).
 *
 * **Επιλογή facets (ADR-923 §5.11 «3η», Akeneo «in list»):** OR μέσα στην ιδιότητα, AND ανάμεσα σε ιδιότητες. Η Firestore
 * δέχεται **ένα** `array-contains-any` ανά ερώτημα, άρα στο ερώτημα μπαίνει μία ομάδα (η στενότερη) και οι υπόλοιπες
 * κρίνονται μέσα στο παράθυρο. Ο δείκτης είναι ο ίδιος με του `array-contains`: καμία νέα εγγραφή στο `firestore.indexes.json`.
 *
 * @module subapps/catalog/list/catalog-list-query
 */

export type CatalogListHolder = 'model' | 'product';
/** «Τελευταία ενημέρωση» (Akeneo «Updated on») · «Ετικέτα» (`derived.sortKey`, φυσική σειρά). */
export type CatalogListSort = 'updated' | 'label';

export const CATALOG_LIST_SORTS: readonly CatalogListSort[] = ['updated', 'label'];

export interface CatalogListQuerySpec {
  readonly familyId: string | null;
  /** Μία ομάδα facets στο ερώτημα (`array-contains-any`)· οι υπόλοιπες κρίνονται μέσα στο παράθυρο (όριο της Firestore). */
  readonly facetKeys: readonly string[] | null;
  readonly sort: CatalogListSort;
}

/** Μία ομάδα ανά ιδιότητα: OR μέσα στην ομάδα, AND ανάμεσα στις ομάδες. */
export type FacetSelection = readonly (readonly string[])[];

/** Όριο τιμών του `array-contains-any` στη Firestore. */
export const ARRAY_CONTAINS_ANY_LIMIT = 30;

/**
 * Η ομάδα που πάει στο ερώτημα: η **στενότερη** που χωρά στο όριο (λιγότερες τιμές = λιγότερα έγγραφα στο παράθυρο).
 * Ταξινομημένη, ώστε η σειρά των κλικ να μην ανοίγει νέα συνδρομή. Καμία δεν χωρά ⇒ `null`, και κρίνονται όλες στο παράθυρο.
 */
export function serverFacetKeys(selection: FacetSelection): readonly string[] | null {
  const fitting = selection.filter((group) => group.length > 0 && group.length <= ARRAY_CONTAINS_ANY_LIMIT);
  if (fitting.length === 0) return null;
  const narrowest = fitting.reduce((best, group) => (group.length < best.length ? group : best));
  return [...narrowest].sort();
}

/** Ικανοποιεί ένα σύνολο κλειδιών την επιλογή; Μία κρίση για φίλτρο και «ταιριάζουν N/M». */
export function keysMatchSelection(keys: readonly string[], selection: FacetSelection): boolean {
  return selection.every((group) => group.some((key) => keys.includes(key)));
}

export type CatalogListEquality = readonly [field: string, value: string | boolean | null];

export interface CatalogListQueryPlan {
  /** Ισότητες με τη σειρά του δείκτη (το `companyId` το προσθέτει η υπηρεσία ερωτημάτων). */
  readonly equalities: readonly CatalogListEquality[];
  readonly arrayContainsAny: readonly [field: string, values: readonly string[]] | null;
  readonly orderBy: readonly [field: string, direction: 'asc' | 'desc'];
}

/** Το πεδίο-«ρίζα» κάθε συλλογής: ριζικό μοντέλο / απλό SKU. */
export const LIST_ROOT_FIELD: Readonly<Record<CatalogListHolder, string>> = { model: 'parentId', product: 'modelId' };

export const LIST_ORDER: Readonly<Record<CatalogListSort, readonly [string, 'asc' | 'desc']>> = {
  updated: ['updatedAt', 'desc'],
  label: ['derived.sortKey', 'asc'],
};

export function catalogListQueryPlan(holder: CatalogListHolder, spec: CatalogListQuerySpec): CatalogListQueryPlan {
  const equalities: CatalogListEquality[] = [['isDeleted', false]];
  if (spec.familyId !== null) equalities.push(['familyId', spec.familyId]);
  equalities.push([LIST_ROOT_FIELD[holder], null]);
  const facets = spec.familyId !== null && spec.facetKeys !== null && spec.facetKeys.length > 0 ? spec.facetKeys : null;
  return {
    equalities,
    arrayContainsAny: facets === null ? null : ['derived.facetKeys', facets],
    orderBy: LIST_ORDER[spec.sort],
  };
}

/** Κάθε σχήμα που μπορεί να ζητήσει η λίστα — για την άγκυρα δεικτών. */
export function everyCatalogListPlan(): readonly { readonly holder: CatalogListHolder; readonly plan: CatalogListQueryPlan }[] {
  const holders: CatalogListHolder[] = ['model', 'product'];
  const families = [null, 'fam'];
  const facets = [null, ['attr=option'], ['attr=a', 'attr=b']];
  return holders.flatMap((holder) => families.flatMap((familyId) => facets.flatMap((facetKeys) =>
    CATALOG_LIST_SORTS.map((sort) => ({ holder, plan: catalogListQueryPlan(holder, { familyId, facetKeys, sort }) })))));
}
