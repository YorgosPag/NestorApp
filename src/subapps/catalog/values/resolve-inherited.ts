/**
 * =============================================================================
 * Η ΣΥΓΧΩΝΕΥΣΗ ΤΩΝ ΠΡΟΓΟΝΩΝ — τιμή ΚΑΙ ιδιοκτήτης (ADR-923 §5.10 Δ1)
 * =============================================================================
 *
 * Μια παραλλαγή «έχει» 14 τιμές, αλλά κατέχει μόνο τις 9 του επιπέδου της· οι άλλες 5 είναι
 * του μοντέλου. Η οθόνη τις δείχνει γκρι με «ορίζεται στο …» (Pimcore display) και ο σύνδεσμος
 * οδηγεί στον **ιδιοκτήτη** — άρα η απάντηση πρέπει να κουβαλά **ποιος**, όχι μόνο **τι**.
 *
 * 🔑 **Αυστηρή κληρονομιά**: κάθε ιδιότητα παίρνεται **μόνο** από το επίπεδο που τη δηλώνει το
 * σχήμα. Μια τιμή σε λάθος επίπεδο (π.χ. παλιό έγγραφο πριν μετακινηθεί η ιδιότητα — εργαλείο
 * 2ζ) **δεν** σκιάζει την αληθινή: αγνοείται **και αναφέρεται** στο `misplaced`. Ποτέ σιωπηλά.
 *
 * Κατηγορίες: **ένωση** κατά μήκος της αλυσίδας (Akeneo — ο απόγονος κληρονομεί και προσθέτει).
 *
 * Ίδια συνάρτηση για οθόνη, πληρότητα, κανόνες, facets και εκδότη.
 *
 * @module subapps/catalog/values/resolve-inherited
 */

import type { VariantScheme } from '../types/family';
import type {
  CatalogValueHolder,
  CatalogValueHolderKind,
  NoValueReason,
  ValueSlots,
} from '../types/product';
import { attributeOwnerDepth } from './attribute-levels';

/** Ένας κρίκος της αλυσίδας, από τη ρίζα προς το φύλλο· το βάθος = η θέση του στην αλυσίδα. */
export interface InheritanceLink {
  readonly id: string;
  readonly kind: CatalogValueHolderKind;
  readonly revision: number;
  readonly holder: CatalogValueHolder;
}

export interface ValueOwner {
  readonly id: string;
  readonly kind: CatalogValueHolderKind;
  readonly depth: number;
}

export interface ResolvedAttribute {
  readonly slots: ValueSlots;
  readonly owner: ValueOwner;
}

export interface ResolvedNoValue {
  readonly reason: NoValueReason;
  readonly owner: ValueOwner;
}

export interface MisplacedValue {
  readonly attributeId: string;
  readonly holderId: string;
  /** Το βάθος όπου **έπρεπε** να ζει. */
  readonly ownerDepth: number;
}

export interface ResolvedValues {
  readonly values: ReadonlyMap<string, ResolvedAttribute>;
  readonly noValueReasons: ReadonlyMap<string, ResolvedNoValue>;
  readonly categoryIds: readonly string[];
  readonly misplaced: readonly MisplacedValue[];
}

interface Accumulator {
  readonly values: Map<string, ResolvedAttribute>;
  readonly reasons: Map<string, ResolvedNoValue>;
  readonly categories: Set<string>;
  readonly misplaced: MisplacedValue[];
}

function collectLink(acc: Accumulator, link: InheritanceLink, depth: number, scheme: VariantScheme | null): void {
  const owner: ValueOwner = { id: link.id, kind: link.kind, depth };
  const placedHere = (attributeId: string): boolean => {
    const ownerDepth = attributeOwnerDepth(scheme, attributeId);
    if (ownerDepth === depth) return true;
    acc.misplaced.push({ attributeId, holderId: link.id, ownerDepth });
    return false;
  };
  for (const [attributeId, slots] of Object.entries(link.holder.values)) {
    if (placedHere(attributeId)) acc.values.set(attributeId, { slots, owner });
  }
  for (const [attributeId, reason] of Object.entries(link.holder.noValueReasons)) {
    if (placedHere(attributeId)) acc.reasons.set(attributeId, { reason, owner });
  }
  link.holder.categoryIds.forEach((categoryId) => acc.categories.add(categoryId));
}

/**
 * Συγχωνεύει την αλυσίδα `[ρίζα, (υπο-μοντέλο), (SKU)]` — ή `[απλό προϊόν]` με `scheme = null`.
 */
export function resolveInheritedValues(
  chain: readonly InheritanceLink[],
  scheme: VariantScheme | null,
): ResolvedValues {
  const acc: Accumulator = { values: new Map(), reasons: new Map(), categories: new Set(), misplaced: [] };
  chain.forEach((link, depth) => collectLink(acc, link, depth, scheme));
  return {
    values: acc.values,
    noValueReasons: acc.reasons,
    categoryIds: [...acc.categories],
    misplaced: acc.misplaced,
  };
}
