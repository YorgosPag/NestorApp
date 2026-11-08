/**
 * =============================================================================
 * ΤΑ ΚΛΕΙΔΙΑ ΤΑΥΤΟΤΗΤΑΣ ΕΜΠΟΡΙΟΥ ΕΝΟΣ SKU — μία καθαρή συνάρτηση ανά ερώτηση (ADR-934 §5.1.2–§5.1.3 · Σ1β)
 * =============================================================================
 *
 * Από τον ορισμό του SKU **και** τη μάρκα της ρίζας: GTIN-14 (κράτηση + ταύτιση), κλειδί μάρκας, κλειδί MPN, και το σκαλί
 * της κλίμακας ταύτισης (Α5). Καθαρά, ντετερμινιστικά, χωρίς I/O — τα καλούν ο γραφέας (κάθε εγγραφή), ο επανυπολογισμός
 * και η μηχανή ταύτισης του Σ1δ· **ποτέ** δεύτερη υλοποίηση.
 *
 * 🔑 Κάθε κλειδί βγαίνει από τον **υπάρχοντα** κανόνα του: `parseGtin` (ο ένας αναλυτής GTIN) · `brandKeyOf` (το ίδιο κλειδί
 *    με την κατοχή μάρκας, §16) · `normalizeUniqueText` (ο ίδιος κανόνας με τους κωδικούς προμηθευτή).
 * 🔑 **`@gtin`**: το «id ιδιότητας» της κράτησης μοναδικότητας του GTIN (`catalog_unique_values`). Σύγκρουση με ιδιότητα
 *    αδύνατη δομικά: στο `derived.uniqueKeys` μπαίνουν μόνο ids ιδιοτήτων της βιβλιοθήκης (`cattr_…`), ποτέ κλειδί με `@`.
 *
 * @module subapps/catalog/derived/trade-keys
 */

import { isMatchableGtin, parseGtin, type ValidGtin } from '@/lib/validation/gtin';
import { brandKeyOf } from '../public/supplier-brand-claim-rules';
import type { CatalogIssue } from '../schema/catalog-issues';
import type { CatalogTradeIdentity } from '../types/product';
import type { CatalogTradeKeys, TradeIdentifierBasis } from '../types/product-derived';
import { normalizeUniqueText } from '../values/normalize-unique';
import { brandOfChain, tradeIdentityOf } from '../values/trade-identity';
import type { InheritanceLink } from '../values/resolve-inherited';

/** Το δεσμευμένο «id ιδιότητας» της κράτησης του GTIN μέσα στον χώρο. */
export const GTIN_RESERVATION_KEY = '@gtin';

/** Είναι κλειδί κράτησης **πλατφόρμας** (όχι ιδιότητας); — π.χ. για να παραλειφθεί η ομοιότητα σκελετού. */
export const isPlatformReservationKey = (key: string): boolean => key.startsWith('@');

/** Το GTIN του SKU, **μόνο** αν είναι έγκυρο. */
function validGtinOf(holder: Partial<CatalogTradeIdentity>): ValidGtin | null {
  const { gtin } = tradeIdentityOf(holder);
  if (gtin === null) return null;
  const parsed = parseGtin(gtin);
  return parsed.kind === 'valid' ? parsed : null;
}

/** Η κλίμακα ταύτισης (Α5) σε **ένα** σημείο: ταυτίσιμο GTIN → μάρκα + MPN → τίποτα. */
export function tradeIdentifierBasis(keys: Pick<CatalogTradeKeys, 'gtin14' | 'gtinMatchable' | 'brandKey' | 'mpnKey'>): TradeIdentifierBasis {
  if (keys.gtin14 !== null && keys.gtinMatchable) return 'gtin';
  if (keys.brandKey !== null && keys.mpnKey !== null) return 'brand-mpn';
  return 'none';
}

/** Κενό κλειδί ⇒ `null` (ένα κλειδί από μόνο κενά δεν ταυτίζει τίποτα). */
const keyOrNull = (key: string): string | null => (key === '' ? null : key);

/** Τα κλειδιά ενός SKU. `chain` = ρίζα → (υπο-μοντέλο) → το ίδιο το SKU· η μάρκα από τον κάτοχό της (βάθος 0). */
export function tradeKeysOf(chain: readonly InheritanceLink[], product: Partial<CatalogTradeIdentity>): CatalogTradeKeys {
  const gtin = validGtinOf(product);
  const brand = brandOfChain(chain);
  const { mpn } = tradeIdentityOf(product);
  const partial = {
    gtin14: gtin?.gtin14 ?? null,
    gtinMatchable: gtin !== null && isMatchableGtin(gtin),
    gtinPrefixClass: gtin?.prefixClass ?? null,
    gtinIndicator: gtin?.indicator.kind ?? null,
    brandKey: brand === null ? null : keyOrNull(brandKeyOf(brand)),
    mpnKey: mpn === null ? null : keyOrNull(normalizeUniqueText(mpn)),
  };
  return { ...partial, identifierBasis: tradeIdentifierBasis(partial) };
}

/** Το κλειδί της κράτησης `@gtin` ενός φορέα — κάθε **έγκυρο** GTIN (και το μη ταυτίσιμο: διπλός εσωτερικός κωδικός είναι λάθος). */
export function gtinReservationKeysOf(holder: Partial<CatalogTradeIdentity>): Readonly<Record<string, string>> {
  const gtin = validGtinOf(holder);
  return gtin ? { [GTIN_RESERVATION_KEY]: gtin.gtin14 } : {};
}

/** Τα κλειδιά κράτησης όπως **γράφτηκαν** (από τα αποθηκευμένα παράγωγα) — `{}` για έγγραφα πριν από το Σ1β. */
export function storedGtinReservationKeysOf(tradeKeys: Pick<CatalogTradeKeys, 'gtin14'> | undefined): Readonly<Record<string, string>> {
  return tradeKeys?.gtin14 ? { [GTIN_RESERVATION_KEY]: tradeKeys.gtin14 } : {};
}

/** Οι προειδοποιήσεις του GTIN (δεν μπλοκάρουν): μη ταυτίσιμος κωδικός · άλλο επίπεδο συσκευασίας. */
export function tradeWarningsOf(holder: Partial<CatalogTradeIdentity>): CatalogIssue[] {
  const gtin = validGtinOf(holder);
  if (gtin === null) return [];
  const warnings: CatalogIssue[] = [];
  if (!isMatchableGtin(gtin)) warnings.push({ code: 'gtinNotMatchable', path: 'gtin', params: { prefixClass: gtin.prefixClass } });
  if (gtin.indicator.kind === 'packaging') warnings.push({ code: 'gtinPackagingLevel', path: 'gtin', params: { indicator: 'packaging' } });
  if (gtin.indicator.kind === 'variable-measure') warnings.push({ code: 'gtinPackagingLevel', path: 'gtin', params: { indicator: 'variableMeasure' } });
  return warnings;
}

/** Οι κωδικοί που παράγει **αυτό** το module — ξαναϋπολογίζονται πάντα, ποτέ δεν «κρατιούνται» από τα αποθηκευμένα. */
export const TRADE_WARNING_CODES: ReadonlySet<CatalogIssue['code']> = new Set<CatalogIssue['code']>(['gtinNotMatchable', 'gtinPackagingLevel']);
