/**
 * **Τα SKU της εξαγωγής xChange** (ADR-923 §5.14 · κενό α): από τα διαβασμένα δεδομένα του καταλόγου στις πηγές του
 * {@link buildXChangeDocument}, με την κρίση τιμής και ορατότητας ως είσοδο. Καθαρό.
 *
 * 🔑 Το xChange δεν έχει μοντέλο: κάθε SKU βγαίνει με τις τιμές **της αλυσίδας του** λυμένες (`resolveInheritedValues`, ο ίδιος
 *    δρόμος με τη δημόσια προβολή και τον εκδότη).
 * 🔒 Κρυφό για το κοινό ⇒ **δεν** γράφεται, μετριέται (απόφαση Ε2). SKU χωρίς κωδικό, ή με κωδικό μακρύτερο από όσο δέχεται το
 *    σχήμα, δεν γράφεται ⇒ μετριέται χωριστά, ποτέ με επινοημένο ή κομμένο κωδικό.
 * 🔑 Σειρά: το κλειδί ταξινόμησης του καταλόγου και μετά το id, ώστε ίδια δεδομένα να δίνουν ίδιο αρχείο.
 * @module subapps/catalog/interop/etim/xchange-export-assembly
 */

import { chainOf, type StoredFamily, type StoredModel, type StoredProduct } from '../../publishing/publication-chapters';
import type { CatalogIssue } from '../../schema/catalog-issues';
import type { NoValueReason, ValueSlots } from '../../types/product';
import { findVariantScheme } from '../../values/attribute-levels';
import { resolveInheritedValues, type InheritanceLink } from '../../values/resolve-inherited';
import { ETIM_ITEM_NUMBER_MAX, type XChangeEmptyCause, type XChangeOnRequestReason } from '../../vocabulary/etim';
import type { XChangeProductSource } from './catalog-to-xchange';
import type { XChangeSkuPricing } from './xchange-pricing';

export interface XChangeAssemblyInput {
  readonly families: ReadonlyMap<string, StoredFamily>;
  readonly models: ReadonlyMap<string, StoredModel>;
  readonly products: readonly StoredProduct[];
  /** Η κρίση του κοινού για ένα SKU, με την αλυσίδα του (η ορατότητα κληρονομείται από τα μοντέλα). */
  readonly pricingOf: (product: StoredProduct, chain: readonly InheritanceLink[]) => XChangeSkuPricing;
}

export interface XChangeAssembly {
  readonly sources: readonly XChangeProductSource[];
  readonly hidden: number;
  readonly unfitIdentifier: number;
  readonly onRequest: Readonly<Partial<Record<XChangeOnRequestReason, number>>>;
}

/** Το σχήμα παραλλαγών της ρίζας του SKU· `null` για απλό προϊόν ή άγνωστο σχήμα. */
function schemeOf(product: StoredProduct, input: XChangeAssemblyInput) {
  const direct = product.modelId ? input.models.get(product.modelId) : undefined;
  const root = direct?.parentId ? input.models.get(direct.parentId) : direct;
  if (!root) return null;
  const family = input.families.get(product.familyId);
  return family && root.variantSchemeCode ? findVariantScheme(family.variantSchemes, root.variantSchemeCode) ?? null : null;
}

function sourceOf(product: StoredProduct, identifier: string, chain: readonly InheritanceLink[], input: XChangeAssemblyInput, price: XChangeProductSource['price']): XChangeProductSource {
  const resolved = resolveInheritedValues(chain, schemeOf(product, input));
  return {
    identifier,
    label: product.derived.label ?? identifier,
    familyId: product.familyId,
    values: new Map<string, ValueSlots>([...resolved.values].map(([id, value]) => [id, value.slots])),
    noValueReasons: new Map<string, NoValueReason>([...resolved.noValueReasons].map(([id, value]) => [id, value.reason])),
    price,
  };
}

const bySortKey = (a: StoredProduct, b: StoredProduct): number => a.derived.sortKey.localeCompare(b.derived.sortKey) || a.id.localeCompare(b.id);

export function assembleXChangeProducts(input: XChangeAssemblyInput): XChangeAssembly {
  const sources: XChangeProductSource[] = [];
  const onRequest: Partial<Record<XChangeOnRequestReason, number>> = {};
  let hidden = 0;
  let unfitIdentifier = 0;
  for (const product of [...input.products].sort(bySortKey)) {
    const chain = chainOf(product, input.models);
    const pricing = input.pricingOf(product, chain);
    if (pricing.kind === 'hidden') {
      hidden += 1;
      continue;
    }
    const identifier = product.derived.identifier;
    if (!identifier || identifier.length > ETIM_ITEM_NUMBER_MAX) {
      unfitIdentifier += 1;
      continue;
    }
    if (pricing.kind === 'onRequest') onRequest[pricing.reason] = (onRequest[pricing.reason] ?? 0) + 1;
    sources.push(sourceOf(product, identifier, chain, input, pricing.kind === 'priced' ? pricing.price : null));
  }
  return { sources, hidden, unfitIdentifier, onRequest };
}

/** Τα στοιχεία της διάγνωσης πέρα από τη συναρμολόγηση: πόσα SKU διαβάστηκαν και πόσοι κανόνες ορατότητας υπάρχουν στον χώρο. */
export interface XChangeEmptyFacts {
  readonly productCount: number;
  readonly visibilityRuleCount: number;
}

/**
 * Γιατί η συναρμολόγηση **δεν έχει κανένα προϊόν** (ADR-923 §5.14.1 · Ε3)· `null` όταν έχει. Βγαίνει από την **ίδια**
 * συναρμολόγηση με το αρχείο, άρα ο προέλεγχος και η εξαγωγή δεν μπορούν να διαφωνήσουν. Μία αιτία, η πρώτη που
 * εξηγεί το κενό: ό,τι λείπει νωρίτερα στη σειρά κρύβει τα επόμενα.
 */
export function xchangeEmptyCause(assembly: XChangeAssembly, facts: XChangeEmptyFacts): XChangeEmptyCause | null {
  if (assembly.sources.length > 0) return null;
  if (facts.productCount === 0) return 'catalogEmpty';
  if (assembly.hidden < facts.productCount) return 'noUsableIdentifier';
  return facts.visibilityRuleCount === 0 ? 'noVisibilityRules' : 'hiddenForAudience';
}

/** Το **ένα** εύρημα της άρνησης: το ρίχνει ο διακομιστής, το δείχνει ο προέλεγχος, ίδια φράση στα δύο. */
export function xchangeNothingToExportIssue(cause: XChangeEmptyCause): CatalogIssue {
  return { code: 'xchangeNothingToExport', path: 'audience', params: { cause, max: ETIM_ITEM_NUMBER_MAX } };
}
