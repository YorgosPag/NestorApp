/**
 * **Το ευρετήριο αναζήτησης ενός SKU** (ADR-923 §5.12): κωδικός, ετικέτα, όνομα οικογένειας και οι ιδιότητες που ο
 * προμηθευτής δήλωσε αναζητήσιμες.
 *
 * 🔑 Ένα κείμενο για δύο δουλειές: από το `searchText` βγαίνουν τα προθέματα του ερωτήματος **και** κρίνεται ο πλήρης όρος.
 *    Ό,τι βρίσκει το πρόθεμα το δέχεται και η κρίση.
 * 🔑 Παίρνει τις **συγχωνευμένες** τιμές, άρα το όνομα του μοντέλου φτάνει σε κάθε SKU, χωρίς δεύτερη κληρονομιά.
 * 🔑 Όλες οι γλώσσες: ο αγοραστής δεν έχει «γλώσσα καταλόγου». Μόνο η θέση `'*'` καναλιού: το `isSearchableAttribute`
 *    αποκλείει τα scopable, γιατί η αναζήτηση δεν ανήκει σε κανάλι.
 * 🔒 Το κείμενο δεν ταξιδεύει ποτέ προς τον αγοραστή: η γραμμή αποτελέσματος χτίζεται πεδίο προς πεδίο (`foreignSkuRowOf`).
 *
 * Η μπαγιατίλα **αποδεικνύεται** στην ανάγνωση (Δ7): το αποτύπωμα εξαρτάται μόνο από το σχήμα, άρα κρίνεται και για μοντέλα,
 * χωρίς αλυσίδα. Χωριστό από το `completenessHash`, που επίτηδες αγνοεί τις ετικέτες της οικογένειας.
 *
 * @module subapps/catalog/derived/search-index
 */

import { fnv1a64Hex } from '@/lib/hash/fnv1a';
import { isSearchableAttribute, type CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogFamilyDefinition } from '../types/family';
import { ANY_SLOT } from '../types/product';
import type { ResolvedValues } from '../values/resolve-inherited';
import { listSlots } from '../values/value-shape';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';
import { catalogSearchPrefixes, normalizedForSearch } from './search-prefixes';

/** Αλλάζει ⇒ κάθε αποθηκευμένο ευρετήριο κρίνεται μπαγιάτικο. Ανέβασέ το σε κάθε αλλαγή του αλγορίθμου. */
export const SEARCH_INDEX_VERSION = 1;

type AttributeLookup = ReadonlyMap<string, CatalogAttributeDefinition>;

export interface CatalogSearchIndex {
  readonly searchText: string;
  readonly searchPrefixes: readonly string[];
}

/** Οι αναζητήσιμες ιδιότητες της οικογένειας, με τη σειρά της. */
export function searchableAttributeIdsOf(family: CatalogFamilyDefinition, attributes: AttributeLookup): readonly string[] {
  return family.attributes.map((binding) => binding.attributeId).filter((id) => {
    const attribute = attributes.get(id);
    return attribute !== undefined && isSearchableAttribute(attribute);
  });
}

const byLocale = <T>(a: readonly [string, T], b: readonly [string, T]): number => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/** Τα ονόματα της οικογένειας σε κάθε γλώσσα, με σταθερή σειρά. */
const familyLabelsOf = (family: CatalogFamilyDefinition): readonly string[] =>
  Object.entries(family.labels).sort(byLocale).map(([, label]) => label ?? '');

function textValuesOf(resolved: ResolvedValues, attributeId: string): readonly string[] {
  const slots = resolved.values.get(attributeId)?.slots;
  if (!slots) return [];
  const entries = listSlots(slots).flatMap(({ channel, locale, value }) =>
    channel === ANY_SLOT && value.type === 'text' ? [[locale, value.text] as const] : []);
  return [...entries].sort(byLocale).map(([, text]) => text);
}

/** Κόβει σε όριο λέξης: μισή λέξη θα γινόταν πρόθεμα που δεν έγραψε κανείς. */
function clipped(text: string, max: number): string {
  if (text.length <= max) return text;
  const lastSpace = text.slice(0, max + 1).lastIndexOf(' ');
  return lastSpace > 0 ? text.slice(0, lastSpace) : '';
}

/** Γεμίζει τον προϋπολογισμό με τη σειρά των μερών: ό,τι προηγείται δεν το εκτοπίζει ποτέ ό,τι ακολουθεί. */
function withinBudget(parts: readonly string[], max: number): string {
  let text = '';
  for (const part of parts) {
    const room = max - text.length - (text === '' ? 0 : 1);
    const fitted = clipped(part, room);
    if (fitted !== '') text = text === '' ? fitted : `${text} ${fitted}`;
  }
  return text;
}

/** Σειρά προτεραιότητας: κωδικός, ετικέτα, όνομα οικογένειας, ιδιότητες. Μία περιγραφή δεν εκτοπίζει ποτέ τον κωδικό. */
export function catalogSearchIndexOf(
  resolved: ResolvedValues,
  family: CatalogFamilyDefinition,
  attributes: AttributeLookup,
  naming: { readonly label: string | null; readonly identifier: string | null },
): CatalogSearchIndex {
  const declared = [...familyLabelsOf(family), ...searchableAttributeIdsOf(family, attributes).flatMap((id) => textValuesOf(resolved, id))]
    .map((text) => clipped(normalizedForSearch(text), CATALOG_LIMITS.maxSearchValueLength));
  const names = [naming.identifier, naming.label].filter((text): text is string => text !== null).map(normalizedForSearch);
  const searchText = withinBudget([...new Set([...names, ...declared])], CATALOG_LIMITS.maxSearchTextLength);
  return { searchText, searchPrefixes: catalogSearchPrefixes(searchText) };
}

/** Το αποτύπωμα του σχήματος που ορίζει το ευρετήριο: `s<έκδοση>:<16 hex>`. Οι τιμές δεν μπαίνουν: τις ξαναγράφει ο γραφέας. */
export function catalogSearchIndexHash(family: CatalogFamilyDefinition, attributes: AttributeLookup): string {
  const material = JSON.stringify([
    SEARCH_INDEX_VERSION,
    family.labelAttributeId,
    familyLabelsOf(family),
    searchableAttributeIdsOf(family, attributes),
  ]);
  return `s${SEARCH_INDEX_VERSION}:${fnv1a64Hex(material)}`;
}

/** Είναι μπαγιάτικο το αποθηκευμένο ευρετήριο; (`null` = δεν υπολογίστηκε ποτέ ⇒ μπαγιάτικο.) */
export function isSearchIndexStale(storedHash: string | null, family: CatalogFamilyDefinition, attributes: AttributeLookup): boolean {
  return storedHash !== catalogSearchIndexHash(family, attributes);
}
