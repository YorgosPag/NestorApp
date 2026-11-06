/**
 * Τιμές xChange ⇒ `ExtractedGroup[]` της ροής «μόνο τιμές» (ADR-923 §5.5 · §23.2 K4γ). Ο προσαρμογέας λέει **μόνο** ποια εγγραφή
 * `Pricing` και ποια νούμερά της· από εκεί ο ίδιος δρόμος με το αρχείο: `buildPriceRows` ⇒ σύγκριση τριών σημείων ⇒ `applyPrices`.
 *
 * 🔑 **Ποιο ποσό** (ETIM xChange Guideline V2.0, EX000207/208): το λέει ο τύπος της λίστας. `net_list` ⇒ `GrossListPrice`,
 *    `net_customer` ⇒ `NetPrice`: το αντίστροφο του `tradePriceOf` (`xchange-pricing.ts`). Το άλλο ποσό **ποτέ** στη θέση του.
 * 🔑 **Ποια εγγραφή**: οι εγγραφές ξεχωρίζουν με περίοδο ισχύος (EX000211/212). Μετρά όποια καλύπτει την έναρξη ισχύος της
 *    έκδοσης-στόχου· αν καλύπτουν πολλές, η νεότερη έναρξη (SAP condition records: η νεότερη εγγραφή υπερισχύει). Έκδοση
 *    χωρίς έναρξη (πρόχειρη) ⇒ μόνο η μοναδική εγγραφή· με περισσότερες η επιλογή θα ήταν μαντεψιά, άρα μετριέται.
 * 🔑 **Ακρίβεια**: το xChange δέχεται 4 δεκαδικά, το νόμισμα 2. Η τιμή μεταφέρεται **ακριβώς** σε μεγαλύτερη μονάδα τιμής
 *    (0,0125 / 1 ⇒ 1,25 / 100, η pricing unit του SAP). Όταν δεν χωρά, περνά ως έχει και το εύρημα `priceAmountPrecision` το κρατά.
 * 🔑 **Τίποτα σιωπηλά**: κάθε προϊόν που δεν δίνει γραμμή μετριέται στην {@link XChangePriceImportReport}.
 * @module subapps/catalog/interop/etim/xchange-pricing-to-groups
 */

import { MONEY_MINOR_DECIMALS } from '@/lib/money/money';
import { priceGroupsOf } from '../../import/apply-column-rules';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportTarget } from '../../types/catalog-import';
import { parseEnteredAmount, shiftCanonicalAmount, significantDecimals } from '../../values/decimal-amount';
import type { ImportPriceField } from '../../vocabulary/catalog-import';
import { isPriceQuantity, PRICE_QUANTITIES, type PriceType } from '../../vocabulary/pricing';
import type { XChangePricingEntry, XChangeProduct } from './xchange-document';
import { uneceOfXChangeUnit } from './xchange-pricing';
import type { XChangePriceImportReport } from './xchange-report';
import { identifierOf } from './xchange-to-groups';

export interface XChangePriceImportContext {
  /** Ο τύπος τιμής της λίστας της έκδοσης-στόχου. */
  readonly priceType: PriceType;
  /** Η έναρξη ισχύος της έκδοσης-στόχου (ISO)· `null` σε πρόχειρη χωρίς ημερομηνία. */
  readonly validFrom: string | null;
  /** Το αρχείο δεν δήλωσε νόμισμα· το νόμισμα το έλεγξε ο καλών πριν φτάσει εδώ. */
  readonly currencyAssumed: boolean;
}

type Selection = { readonly kind: 'entry'; readonly entry: XChangePricingEntry } | { readonly kind: 'uncovered' } | { readonly kind: 'ambiguous' };

/** Ημερομηνίες ISO συγκρίνονται ως κείμενο στο τμήμα της ημέρας (`YYYY-MM-DD`): ίδια σειρά με τη χρονολογική. */
const dayOf = (iso: string): string => iso.slice(0, 10);

function covers(entry: XChangePricingEntry, day: string): boolean {
  const start = entry.PriceValidityDate === undefined ? null : dayOf(entry.PriceValidityDate);
  const end = entry.PriceExpiryDate === undefined ? null : dayOf(entry.PriceExpiryDate);
  return (start === null || start <= day) && (end === null || end >= day);
}

const startOf = (entry: XChangePricingEntry): string => (entry.PriceValidityDate === undefined ? '' : dayOf(entry.PriceValidityDate));

function selectEntry(entries: readonly XChangePricingEntry[], validFrom: string | null): Selection {
  if (validFrom === null) {
    const [only] = entries;
    return entries.length === 1 && only ? { kind: 'entry', entry: only } : { kind: entries.length === 0 ? 'uncovered' : 'ambiguous' };
  }
  const day = dayOf(validFrom);
  const covering = entries.filter((entry) => covers(entry, day));
  const latest = covering.reduce<XChangePricingEntry | null>((best, entry) => (best === null || startOf(entry) > startOf(best) ? entry : best), null);
  return latest ? { kind: 'entry', entry: latest } : { kind: 'uncovered' };
}

/** Τιμή και ποσότητα τιμής, με την ακριβή μεταφορά σε μεγαλύτερη μονάδα τιμής όταν το ποσό έχει δεκαδικά πέρα από το νόμισμα. */
export function exactPriceUnit(amountText: string, quantityText: string): { readonly amount: string; readonly quantity: string } {
  const amount = parseEnteredAmount(amountText);
  const quantity = Number(quantityText.trim());
  if (!amount || !isPriceQuantity(quantity) || significantDecimals(amount.amount) <= MONEY_MINOR_DECIMALS) return { amount: amountText, quantity: quantityText };
  for (const larger of PRICE_QUANTITIES.filter((candidate) => candidate > quantity)) {
    // Οι ποσότητες τιμής είναι δυνάμεις του 10: ο λόγος τους είναι «1» και μηδενικά, άρα οι θέσεις = πλήθος μηδενικών (χωρίς log10 σε double).
    const shifted = shiftCanonicalAmount(amount.amount, String(larger / quantity).length - 1);
    if (shifted !== null && significantDecimals(shifted) <= MONEY_MINOR_DECIMALS) return { amount: shifted, quantity: String(larger) };
  }
  return { amount: amountText, quantity: quantityText };
}

const cellOf = (target: ImportTarget, text: string): ExtractedCell => ({ target, text, confidence: 1, anchor: null, unitCode: null, flags: [] });

const priceCell = (field: ImportPriceField, text: string): ExtractedCell => cellOf({ kind: 'price', field }, text);

class PriceReportBuilder {
  imported = 0;
  onRequest = 0;
  amountMissing = 0;
  entryIncomplete = 0;
  allowanceSurcharges = 0;
  extraTradeItems = 0;
  readonly uncovered: string[] = [];
  readonly ambiguous: string[] = [];

  build(products: number, currencyAssumed: boolean): XChangePriceImportReport {
    const { imported, onRequest, amountMissing, entryIncomplete, allowanceSurcharges, extraTradeItems } = this;
    const validityUncovered = [...this.uncovered].sort();
    const validityAmbiguous = [...this.ambiguous].sort();
    return { purpose: 'priceLines', products, imported, onRequest, amountMissing, entryIncomplete, validityUncovered, validityAmbiguous, currencyAssumed, allowanceSurcharges, extraTradeItems };
  }
}

/** Οι κρίσεις πάνω στην επιλεγμένη εγγραφή: `null` = καμία γραμμή, και ο λόγος έχει ήδη μετρηθεί. */
function priceCellsOf(entry: XChangePricingEntry, priceType: PriceType, report: PriceReportBuilder): ExtractedCell[] | null {
  if (entry.AllowanceSurcharge.length > 0) report.allowanceSurcharges += 1;
  if (entry.PriceOnRequest === true) {
    report.onRequest += 1;
    return null;
  }
  const amountText = priceType === 'net_customer' ? entry.NetPrice : entry.GrossListPrice;
  if (amountText === undefined) {
    report.amountMissing += 1;
    return null;
  }
  if (entry.PriceUnit === undefined || entry.PriceQuantity === undefined) {
    report.entryIncomplete += 1;
    return null;
  }
  const { amount, quantity } = exactPriceUnit(amountText, entry.PriceQuantity);
  return [priceCell('netPrice', amount), priceCell('priceQuantity', quantity), priceCell('unitCode', uneceOfXChangeUnit(entry.PriceUnit))];
}

function rowOf(product: XChangeProduct, index: number, context: XChangePriceImportContext, report: PriceReportBuilder): ExtractedRow | null {
  const identifier = identifierOf(product);
  const [tradeItem] = product.TradeItem;
  if (product.TradeItem.length > 1) report.extraTradeItems += 1;
  const selection = selectEntry(tradeItem?.Pricing ?? [], context.validFrom);
  if (selection.kind !== 'entry') {
    (selection.kind === 'uncovered' ? report.uncovered : report.ambiguous).push(identifier);
    return null;
  }
  const cells = priceCellsOf(selection.entry, context.priceType, report);
  if (cells === null) return null;
  report.imported += 1;
  return { rowKey: `p${index + 1}`, cells: [cellOf({ kind: 'skuIdentifier' }, identifier), ...cells] };
}

export function extractPriceGroupsFromXChange(products: readonly XChangeProduct[], context: XChangePriceImportContext): { readonly groups: readonly ExtractedGroup[]; readonly report: XChangePriceImportReport } {
  const report = new PriceReportBuilder();
  const rows = products.flatMap((product, index) => rowOf(product, index, context, report) ?? []);
  return { groups: priceGroupsOf(rows), report: report.build(products.length, context.currencyAssumed) };
}
