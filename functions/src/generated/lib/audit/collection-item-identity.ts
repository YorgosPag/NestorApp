// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/lib/audit/collection-item-identity.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:c14984557f9fe28521a36bd412ce56045c36ee8368f85304aec4c5c4e02bd26c

/**
 * **Η ταυτότητα και η ετικέτα ενός στοιχείου συλλογής στο Ιστορικό** — ADR-195 Φ11 · (η)
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ, ΦΟΡΗΤΟ ΑΡΧΕΙΟ (2026-10-29).** Το Ιστορικό των επαφών το γράφει **ο CDC**
 * (`functions/src/audit/deep-diff.ts`), όχι η υπηρεσία. Το `functions/` είναι άλλο πακέτο npm και
 * δεν μπορεί να εισάγει από το `src/` (CHECK 3.93) — γι' αυτό ο CDC **μάντευε** την ταυτότητα:
 * κλειδί = όλα τα primitives του στοιχείου. Μετρημένο στη MACON: η αλλαγή **ενός** πεδίου
 * (`phones[0].type` mobile → main) άλλαζε το κλειδί και γραφόταν ως «Αφαιρέθηκε» + «Προστέθηκε».
 * Η ταυτότητα ήταν **ήδη δηλωμένη** (`keyBy`) — απλώς δεν έφτανε στον γραφέα που την χρειαζόταν.
 *
 * Τώρα: ο αλγόριθμος ζει **εδώ**, χωρίς εξαρτήσεις πέρα από τα επίσης φορητά `sort-keys-deep` / `type-guards`, και
 * προβάλλεται αυτούσιος στο Cloud Functions (`.functions-projection.json`). Ένας αλγόριθμος, δύο
 * γραφείς (`lib/audit/audit-diff.ts` · CDC) — όπως η Figma κρατά **σταθερό id** ανά κόμβο και η
 * αλλαγή ιδιότητας είναι αλλαγή ιδιότητας, όχι διαγραφή + δημιουργία.
 *
 * ⛔ **ΜΟΝΟ σχετικά imports προβαλλόμενων αρχείων** (κλειστότητα CHECK 3.93) — ποτέ `@/`.
 *
 * @module lib/audit/collection-item-identity
 * @see ../../config/audit-collection-identity.ts — οι δηλώσεις ανά πεδίο
 */

import { sortKeysDeep } from '../sort-keys-deep';
import { isPlainRecord } from '../type-guards';

/**
 * Stable identity for collection items.
 * - `'value'` — the element itself is the key (primitive arrays).
 * - `string` — read this property from each item (e.g. `'id'`).
 * - `readonly string[]` — composite key, joined by `|`.
 */
export type CollectionKeyBy = 'value' | string | readonly string[];

/** Ό,τι χρειάζεται ένας γραφέας για να ταυτίσει και να ονομάσει στοιχεία μιας συλλογής. */
export interface CollectionIdentity {
  readonly keyBy: CollectionKeyBy;
  /** Item fields concatenated to form the human display label. */
  readonly labelFields?: readonly string[];
  /** Separator between `labelFields` (default `' — '`). */
  readonly labelSeparator?: string;
}

/**
 * Derive a stable identity key for one collection item.
 *
 * Priority:
 *   1. `keyBy: 'value'` — primitive element is its own key.
 *   2. `keyBy: string` — read that property.
 *   3. `keyBy: string[]` — composite from all listed properties.
 * When the primary strategy yields no usable value (missing id / all-empty
 * composite), we fall back to a deterministic JSON of the whole item. This
 * keeps "added / removed" semantics correct even for legacy rows without
 * stable ids (at the cost of modifications presenting as remove+add).
 */
export function computeCollectionItemKey(item: unknown, keyBy: CollectionKeyBy): string {
  if (keyBy === 'value') {
    if (item === null || item === undefined) return '__null__';
    if (typeof item === 'string') return `s:${item}`;
    if (typeof item === 'number' || typeof item === 'boolean') return `p:${String(item)}`;
    return `j:${JSON.stringify(sortKeysDeep(item))}`;
  }
  if (typeof item !== 'object' || item === null) {
    return `j:${JSON.stringify(item)}`;
  }
  const rec = item as Record<string, unknown>;
  if (typeof keyBy === 'string') {
    const v = rec[keyBy];
    if (v !== undefined && v !== null && v !== '') return `k:${String(v)}`;
    return `j:${JSON.stringify(sortKeysDeep(rec))}`;
  }
  const parts: string[] = [];
  for (const field of keyBy) {
    const v = rec[field];
    parts.push(v === undefined || v === null ? '' : String(v));
  }
  if (parts.every((p) => p === '')) {
    return `j:${JSON.stringify(sortKeysDeep(rec))}`;
  }
  return `c:${parts.join('|')}`;
}

/**
 * Η ετικέτα ενός στοιχείου που **δεν** είναι αντικείμενο (primitive · κενό)· `undefined` ⇒ είναι αντικείμενο και την
 * αποφασίζει ο καλών (δηλωμένα `labelFields` ή ευρετικό του CDC).
 */
export function scalarItemLabel(item: unknown): string | undefined {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  if (typeof item !== 'object') return '';
  return undefined;
}

/**
 * Δύο στοιχεία που ταυτίστηκαν, ως εγγραφές — `null` όταν κάποιο δεν είναι απλό αντικείμενο (primitive στοιχεία δεν
 * έχουν υπο-πεδία). Ο φρουρός που άνοιγε **και** τη σύγκριση υπο-πεδίων της υπηρεσίας **και** του CDC.
 */
export function itemRecordPair(
  before: unknown,
  after: unknown,
): readonly [Readonly<Record<string, unknown>>, Readonly<Record<string, unknown>>] | null {
  return isPlainRecord(before) && isPlainRecord(after) ? [before, after] : null;
}

/** Η ένωση των ιδιοτήτων δύο στοιχείων, με τη σειρά πρώτης εμφάνισης. */
export function itemFieldUnion(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): readonly string[] {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
}

/**
 * Produce a human display label for a collection item by concatenating
 * `labelFields`. Primitive items return themselves as a string. Falls back
 * to the first non-empty string/number property when `labelFields` is
 * unhelpful.
 */
export function collectionItemLabel(
  item: unknown,
  labelFields: readonly string[] | undefined,
  separator: string | undefined,
): string {
  const scalar = scalarItemLabel(item);
  if (scalar !== undefined) return scalar;
  const rec = item as Record<string, unknown>;
  const sep = separator ?? ' — ';
  if (labelFields && labelFields.length > 0) {
    const parts: string[] = [];
    for (const field of labelFields) {
      const v = rec[field];
      if (v !== undefined && v !== null && v !== '') parts.push(String(v));
    }
    if (parts.length > 0) return parts.join(sep);
  }
  for (const v of Object.values(rec)) {
    if (typeof v === 'string' && v !== '') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}
