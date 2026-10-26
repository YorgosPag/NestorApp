/**
 * =============================================================================
 * ΤΑ ΠΑΡΑΓΩΓΑ ΕΝΟΣ ΦΟΡΕΑ ΤΙΜΩΝ — μία καθαρή συνάρτηση ανά ερώτηση (ADR-923 §5.10 Δ4 · Δ9 · Δ11)
 * =============================================================================
 *
 * Τα καλούν ο γραφέας (κάθε εγγραφή), η εργασία επανυπολογισμού και (Φ5) ο εκδότης — **ποτέ** δεύτερη
 * υλοποίηση. Καθαρά, ντετερμινιστικά, χωρίς I/O: ίδιες είσοδοι ⇒ ίδιο αποτέλεσμα, άρα ο επανυπολογισμός είναι
 * ιδεμπότητος και ένα test τα δοκιμάζει χωρίς Firestore.
 *
 * 🔑 Η **σειρά** κάθε λίστας είναι σταθερή (ταξινομημένη ή σειρά της οικογένειας): ένα παράγωγο που αλλάζει
 * σειρά χωρίς να αλλάξει περιεχόμενο θα έγραφε το έγγραφο χωρίς λόγο.
 *
 * @module subapps/catalog/derived/holder-derived
 */

import { DEFAULT_LANGUAGE, isHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogIssue } from '../schema/catalog-issues';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogFamilyDefinition } from '../types/family';
import { ANY_SLOT, type CatalogValueHolder } from '../types/product';
import type { CatalogHolderDerived } from '../types/product-derived';
import { uniqueValueKey } from '../values/normalize-unique';
import type { ResolvedValues } from '../values/resolve-inherited';
import { standardAmountOf } from '../values/standard-amount';
import { listSlots, readUnscopedSlot } from '../values/value-shape';

type AttributeLookup = ReadonlyMap<string, CatalogAttributeDefinition>;

const sortedUnique = <T extends string>(items: Iterable<T>): T[] => [...new Set(items)].sort();

function valueLocalesOf(holder: CatalogValueHolder): HumanLanguage[] {
  const locales = new Set<HumanLanguage>();
  for (const slots of Object.values(holder.values)) {
    for (const { locale } of listSlots(slots)) if (locale !== ANY_SLOT && isHumanLanguage(locale)) locales.add(locale);
  }
  return [...locales].sort();
}

/** Τα μέσα που αναφέρει ο φορέας, με τη σειρά πρώτης εμφάνισης (η σειρά προβολής του προμηθευτή). */
export function assetIdsOf(holder: CatalogValueHolder): string[] {
  const ids = new Set<string>();
  for (const slots of Object.values(holder.values)) {
    for (const { value } of listSlots(slots)) if (value.type === 'asset') value.assetIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

/** id ιδιότητας `unique` → κλειδί κράτησης. Μόνο η θέση `'*'/'*'` (το `unique` δεν είναι ποτέ localizable/scopable). */
export function uniqueKeysOf(holder: CatalogValueHolder, attributes: AttributeLookup): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const [attributeId, slots] of Object.entries(holder.values)) {
    if (!attributes.get(attributeId)?.unique) continue;
    const value = readUnscopedSlot(slots);
    const key = value ? uniqueValueKey(value) : null;
    if (key !== null) keys[attributeId] = key;
  }
  return keys;
}

function standardAmountsOf(holder: CatalogValueHolder, attributes: AttributeLookup, registry: MeasurementRegistry): Record<string, number> {
  const amounts: Record<string, number> = {};
  for (const [attributeId, slots] of Object.entries(holder.values)) {
    const attribute = attributes.get(attributeId);
    const standard = attribute ? standardAmountOf(attribute, readUnscopedSlot(slots), registry) : null;
    if (standard !== null) amounts[attributeId] = standard;
  }
  return amounts;
}

/** Τα παράγωγα από τις **δικές** τιμές ενός φορέα. */
export function ownHolderDerived(
  holder: CatalogValueHolder,
  attributes: AttributeLookup,
  registry: MeasurementRegistry,
  warnings: readonly CatalogIssue[] = [],
): CatalogHolderDerived {
  return {
    valueAttributeIds: sortedUnique([...Object.keys(holder.values), ...Object.keys(holder.noValueReasons)]),
    valueLocales: valueLocalesOf(holder),
    assetIds: assetIdsOf(holder),
    uniqueKeys: uniqueKeysOf(holder, attributes),
    standardAmounts: standardAmountsOf(holder, attributes, registry),
    warnings,
  };
}

/** Το κλειδί φίλτρου μιας επιλογής — **ένα** σχήμα για γραφέα και (2δ) φίλτρα της λίστας. */
export const optionFacetKey = (attributeId: string, optionCode: string): string => `${attributeId}=${optionCode}`;
export const booleanFacetKey = (attributeId: string, value: boolean): string => `${attributeId}:${String(value)}`;

/** Τα κλειδιά φίλτρων πάνω στις **συγχωνευμένες** τιμές (Δ11): επιλογές, πολλαπλές επιλογές, ναι/όχι. */
export function facetKeysOf(resolved: ResolvedValues): string[] {
  const keys: string[] = [];
  for (const [attributeId, { slots }] of resolved.values) {
    const value = readUnscopedSlot(slots);
    if (value?.type === 'select') keys.push(optionFacetKey(attributeId, value.optionCode));
    else if (value?.type === 'multiSelect') value.optionCodes.forEach((code) => keys.push(optionFacetKey(attributeId, code)));
    else if (value?.type === 'boolean') keys.push(booleanFacetKey(attributeId, value.value));
  }
  return sortedUnique(keys);
}

/**
 * Η ετικέτα από την ιδιότητα-ετικέτα της οικογένειας (Akeneo attribute_as_label): κείμενο της θέσης `'*'`, ή —
 * αν η ιδιότητα είναι localizable — της γλώσσας της πλατφόρμας. Οτιδήποτε άλλο ⇒ `null` (η οθόνη δείχνει id).
 */
export function productLabelOf(resolved: ResolvedValues, family: CatalogFamilyDefinition): string | null {
  if (family.labelAttributeId === null) return null;
  const slots = resolved.values.get(family.labelAttributeId)?.slots;
  const value = readUnscopedSlot(slots) ?? slots?.[ANY_SLOT]?.[DEFAULT_LANGUAGE];
  if (value?.type !== 'text') return null;
  const text = value.text.trim();
  return text === '' ? null : text;
}

/**
 * **Το αναγνωριστικό** ενός SKU (ADR-923 §5.10.4 Β2): η τιμή της **πρώτης** ιδιότητας `unique` της οικογένειας (σειρά
 * δήλωσης) που έχει τιμή — ο κωδικός προμηθευτή, π.χ. «016-15-001». Το Akeneo έχει **μία** ιδιότητα-αναγνωριστικό·
 * εδώ η μοναδικότητα είναι ιδιότητα ανά πεδίο (Δ3), οπότε «αναγνωριστικό» = η πρώτη δηλωμένη. Μόνο κείμενο/αριθμός
 * (οι μόνοι τύποι που δέχονται `unique`, `UNIQUE_CAPABLE_ATTRIBUTE_TYPES`).
 */
export function productIdentifierOf(
  resolved: ResolvedValues,
  family: CatalogFamilyDefinition,
  attributes: AttributeLookup,
): string | null {
  for (const binding of family.attributes) {
    if (!attributes.get(binding.attributeId)?.unique) continue;
    const value = readUnscopedSlot(resolved.values.get(binding.attributeId)?.slots);
    const text = value?.type === 'text' ? value.text.trim() : value?.type === 'number' ? value.amount : '';
    if (text) return text;
  }
  return null;
}
