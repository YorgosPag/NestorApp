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
 * @module subapps/catalog/list/catalog-list-query
 */

export type CatalogListHolder = 'model' | 'product';
/** «Τελευταία ενημέρωση» (Akeneo «Updated on») · «Ετικέτα» (`derived.sortKey`, φυσική σειρά). */
export type CatalogListSort = 'updated' | 'label';

export const CATALOG_LIST_SORTS: readonly CatalogListSort[] = ['updated', 'label'];

export interface CatalogListQuerySpec {
  readonly familyId: string | null;
  /** Ένα facet στο ερώτημα (`array-contains`)· τα υπόλοιπα φιλτράρονται μέσα στο παράθυρο (όριο της Firestore). */
  readonly facetKey: string | null;
  readonly sort: CatalogListSort;
}

export type CatalogListEquality = readonly [field: string, value: string | boolean | null];

export interface CatalogListQueryPlan {
  /** Ισότητες με τη σειρά του δείκτη (το `companyId` το προσθέτει η υπηρεσία ερωτημάτων). */
  readonly equalities: readonly CatalogListEquality[];
  readonly arrayContains: readonly [field: string, value: string] | null;
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
  const facet = spec.familyId !== null && spec.facetKey !== null ? spec.facetKey : null;
  return {
    equalities,
    arrayContains: facet === null ? null : ['derived.facetKeys', facet],
    orderBy: LIST_ORDER[spec.sort],
  };
}

/** Κάθε σχήμα που μπορεί να ζητήσει η λίστα — για την άγκυρα δεικτών. */
export function everyCatalogListPlan(): readonly { readonly holder: CatalogListHolder; readonly plan: CatalogListQueryPlan }[] {
  const holders: CatalogListHolder[] = ['model', 'product'];
  const families = [null, 'fam'];
  const facets = [null, 'attr=option'];
  return holders.flatMap((holder) => families.flatMap((familyId) => facets.flatMap((facetKey) =>
    CATALOG_LIST_SORTS.map((sort) => ({ holder, plan: catalogListQueryPlan(holder, { familyId, facetKey, sort }) })))));
}
