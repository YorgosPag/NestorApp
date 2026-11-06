/**
 * Η **τιμή ενός SKU στο xChange** (ADR-923 §5.14 · Ζ9 · αποφάσεις Ε1 + Ε2): από την ετυμηγορία της **μίας** μηχανής τιμής
 * (`quoteOnBasis`) στο τμήμα `Pricing` του εμπορεύσιμου είδους. Καθαρό.
 *
 * 🔒 **Ορατότητα πρώτα** (Ε2): κρυφό για το κοινό ⇒ δεν εξάγεται. Ορατό χωρίς τιμή ⇒ `PriceOnRequest`. Η απουσία ετυμηγορίας
 *    κρίνεται με την προεπιλογή της πλατφόρμας (`hidden`), ποτέ ως «ορατό».
 * 🔑 **Ποιο πεδίο τιμής**: ο τύπος τιμής της λίστας (BMEcat) το λέει. `net_list` ⇒ `GrossListPrice` = ποσό λίστας, και
 *    `NetPrice` μόνο όταν το κοινό έχει έκπτωση. `net_customer` ⇒ μόνο `NetPrice`. Επαληθευμένο στην ETIM xChange Guideline
 *    V2.0 (EX000207/208): «gross» = **πριν την έκπτωση**, και τα δύο **χωρίς ΦΠΑ**· τιμή με ΦΠΑ (`RecommendedRetailPrice`) δεν γράφεται.
 * 🔑 **Μονάδα από τη γραμμή τιμής**, ποτέ «τεμάχιο» από προεπιλογή: τιμή ανά μέτρο γραμμένη ανά τεμάχιο θα ήταν λάθος τιμή.
 *    Μονάδα χωρίς κωδικό του σχήματος ⇒ `PriceOnRequest`, μετρημένο.
 * @module subapps/catalog/interop/etim/xchange-pricing
 */

import { majorFromMinor, type MinorAmount } from '@/lib/money/money';
import { uneceCodeOf } from '@/lib/uom/uom-registry';
import { toFixedDecimal } from '../../measurement/conversion';
import { showsPrice, showsProduct } from '../../pricing/visibility';
import type { PriceQuoteResult } from '../../types/price-list-requests';
import { DEFAULT_CATALOG_VISIBILITY, type PriceType } from '../../vocabulary/pricing';
import { ETIM_UNECE_EQUIVALENTS, ETIM_XCHANGE_UNITS, type EtimXChangeUnit, type XChangeOnRequestReason } from '../../vocabulary/etim';

/** Μια τιμή όπως τη γράφει το xChange: ποσά σε μηχανική μορφή (`"120.50"`), χωρίς ΦΠΑ. Τουλάχιστον ένα ποσό υπάρχει. */
export interface XChangeTradePrice {
  readonly unit: EtimXChangeUnit;
  readonly quantity: number;
  readonly grossList: string | null;
  readonly net: string | null;
}

export type XChangeSkuPricing =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'onRequest'; readonly reason: XChangeOnRequestReason }
  | { readonly kind: 'priced'; readonly price: XChangeTradePrice };

const XCHANGE_UNITS: ReadonlySet<string> = new Set(ETIM_XCHANGE_UNITS);
const isXChangeUnit = (code: string): code is EtimXChangeUnit => XCHANGE_UNITS.has(code);

/** Ο κωδικός του σχήματος για μονάδα του μητρώου μας· `null` όταν δεν υπάρχει βέβαιη αντιστοίχιση. */
export function xchangeUnitOf(uomCode: string): EtimXChangeUnit | null {
  const unece = uneceCodeOf(uomCode);
  if (unece === null) return null;
  return isXChangeUnit(unece) ? unece : ETIM_UNECE_EQUIVALENTS[unece] ?? null;
}

/** Το αντίστροφο του {@link ETIM_UNECE_EQUIVALENTS}, **παραγόμενο** από το ίδιο αντικείμενο: μία δήλωση, δύο κατευθύνσεις. */
const UNECE_OF_XCHANGE: ReadonlyMap<string, string> = new Map(Object.entries(ETIM_UNECE_EQUIVALENTS).map(([unece, xchange]) => [xchange, unece]));

/**
 * Ο κωδικός UNECE του **μητρώου μας** για μονάδα γραμμένη στη διάλεκτο του xChange (`C62` ⇒ `H87`). Όσοι κωδικοί δεν διαφέρουν
 * περνούν αυτούσιοι· αν τους ξέρει το μητρώο το κρίνει ο parser της γραμμής τιμής (`priceUnitUnknown`), όχι εδώ.
 */
export const uneceOfXChangeUnit = (code: string): string => UNECE_OF_XCHANGE.get(code) ?? code;

const decimalOf = (minor: MinorAmount): string => toFixedDecimal(majorFromMinor(minor), 2);

type Priced = Extract<PriceQuoteResult, { kind: 'priced' }>;

function tradePriceOf({ quote }: Priced, priceType: PriceType, unit: EtimXChangeUnit): XChangeTradePrice {
  const net = decimalOf(quote.netAmount);
  if (priceType === 'net_customer') return { unit, quantity: quote.priceQuantity, grossList: null, net };
  const discounted = quote.netAmount !== quote.listAmount;
  return { unit, quantity: quote.priceQuantity, grossList: decimalOf(quote.listAmount), net: discounted ? net : null };
}

const onRequest = (reason: XChangeOnRequestReason): XChangeSkuPricing => ({ kind: 'onRequest', reason });

/** Η κρίση ενός SKU για το κοινό του αρχείου. `priceTypeOf`: ο τύπος τιμής της λίστας που διάλεξε η μηχανή. */
export function xchangeSkuPricing(result: PriceQuoteResult, priceTypeOf: (priceListId: string) => PriceType): XChangeSkuPricing {
  const visibility = result.visibility?.visibility ?? DEFAULT_CATALOG_VISIBILITY;
  if (!showsProduct(visibility)) return { kind: 'hidden' };
  if (!showsPrice(visibility)) return onRequest('visibleNoPrice');
  if (result.kind !== 'priced') return onRequest(result.kind);
  const unit = xchangeUnitOf(result.quote.unitCode);
  if (unit === null) return onRequest('unitUnmapped');
  return { kind: 'priced', price: tradePriceOf(result, priceTypeOf(result.quote.priceListId), unit) };
}
