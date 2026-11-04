/**
 * **Η τιμή της δημόσιας βιτρίνας** (ADR-923 §5.13 Σ6 · Ε3 · Δ2 · §12 🔒): καθαρή προβολή της ΜΙΑΣ κρίσης τιμής (`quoteOnBasis`).
 *
 * Ο επιλυτής απαντά πλούσια (λίστα, έκδοση, συνθήκη, καταρράκτης, ίχνος, κοινό), γιατί μιλά στον ιδιοκτήτη. Προς τη βιτρίνα φεύγει
 * **μόνο** αυτό το κλειστό σχήμα, χτισμένο πεδίο προς πεδίο, όπως το `foreignOutcomeOf`: ό,τι δεν γράφεται εδώ δεν ταξιδεύει.
 * Κανένα id λίστας, συνθήκης ή ομάδας: η απάντηση δεν μαρτυρά **ποιο** κοινό νίκησε ούτε ότι υπάρχουν άλλα.
 *
 * | Ορατότητα για τον θεατή | Κρίση | ΦΠΑ | Απάντηση |
 * |---|---|---|---|
 * | `hidden` · `visibleNoPrice` | οποιαδήποτε | — | `onRequest` (ίδιο με «χωρίς τιμή»: καμία διάκριση) |
 * | `visible` | όχι `priced` | — | `onRequest` |
 * | `visible` | `priced` | αδήλωτος ή αμφίσημος | ανώνυμος ⇒ `onRequest` · αγοραστής ⇒ `priced` χωρίς τελική |
 * | `visible` | `priced` | δηλωμένος | `priced` με καθαρή και τελική τιμή |
 *
 * 🔑 **Ανώνυμος = καταναλωτής**: Οδηγία 98/6/ΕΚ άρθ. 2(α), η τιμή προς καταναλωτή είναι η **τελική**, με ΦΠΑ. Χωρίς γνωστό
 *    συντελεστή δεν υπάρχει τελική τιμή, άρα δεν δείχνεται καμία (ποτέ μαντεμένος 24%).
 * 🔑 **Τιμή μονάδας** (άρθ. 3): όταν η τιμή αφορά `priceQuantity ≠ 1` (π.χ. «ανά 100 m»), βγαίνει και η τιμή για **μία** μονάδα.
 *    Με `priceQuantity = 1` η τιμή μονάδας είναι η ίδια η τιμή πώλησης, και η οδηγία δεν τη ζητά δεύτερη φορά.
 * 🔑 **Καμία «έκπτωση»** προς τον ανώνυμο: δείχνεται μόνο η τελική τιμή, ποτέ διαγραμμένη τιμή ή ποσοστό. Η Οδηγία 98/6 άρθ. 6α
 *    (Omnibus 2019/2161) ζητά την προηγούμενη χαμηλότερη τιμή 30 ημερών **μόνο όταν ανακοινώνεται μείωση**· δεν ανακοινώνουμε.
 *
 * **Layering**: καθαρό, χωρίς I/O.
 * @module subapps/catalog/public/showcase-price
 */

import { MONEY_CURRENCY, type MinorAmount } from '@/lib/money/money';
import { divideHalfUp, scaledInteger } from '@/lib/pricing/exact-arithmetic';
import { vatInclusiveAmount } from '@/lib/pricing/vat-inclusive';
import type { GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import { showsPrice, showsProduct } from '../pricing/visibility';
import { categoryVatSource, type CategoryVatHolder } from '../schema/category-vat';
import type { PriceQuoteResult } from '../types/price-list-requests';
import { DEFAULT_CATALOG_VISIBILITY } from '../vocabulary/pricing';
import type { PublicCatalogModel } from './public-catalog-schema';

/** Ποιος ρωτά: ο ανώνυμος (καταναλωτής, ISR) ή ο συνδεδεμένος αγοραστής (νησίδα `no-store`). */
export type ShowcaseAudience = 'anonymous' | 'buyer';

interface ShowcasePricedCommon {
  readonly kind: 'priced';
  readonly currency: typeof MONEY_CURRENCY;
  /** Η μονάδα της γραμμής τιμής, όπως αποθηκεύτηκε (μορφοποιείται με το `formatUom`). */
  readonly unitCode: string;
  /** Πόσες μονάδες αφορά η τιμή (BMEcat `PRICE_QUANTITY`). */
  readonly priceQuantity: number;
  /** Τελική αξία **μίας** μονάδας, μόνο όταν `priceQuantity ≠ 1` (Οδηγία 98/6 άρθ. 3). */
  readonly unitGross: MinorAmount | null;
}

/**
 * Ο **ανώνυμος** (καταναλωτής: ISR HTML, RSC payload, JSON-LD): **μόνο** τελική τιμή. Η καθαρή αξία είναι **δομικά** `null`
 * (ανασκόπηση Μ-5): ό,τι μπαίνει στο αποθηκευμένο HTML δεν φέρει τίποτα χωρίς ΦΠΑ, ούτε σε πεδίο που η οθόνη δεν δείχνει.
 */
export interface ShowcaseConsumerPrice extends ShowcasePricedCommon {
  readonly audience: 'anonymous';
  readonly net: null;
  readonly unitNet: null;
  readonly gross: MinorAmount;
  readonly vatRate: GreekVatRatePercent;
}

/** Ο **συνδεδεμένος αγοραστής** (νησίδα `no-store`): η καθαρή αξία πρώτη· η τελική μόνο με δηλωμένο συντελεστή. */
export interface ShowcaseBuyerPrice extends ShowcasePricedCommon {
  readonly audience: 'buyer';
  /** Καθαρή αξία για `priceQuantity` μονάδες, χωρίς ΦΠΑ, σε λεπτά. */
  readonly net: MinorAmount;
  /** Καθαρή αξία **μίας** μονάδας, μόνο όταν `priceQuantity ≠ 1`. */
  readonly unitNet: MinorAmount | null;
  readonly gross: MinorAmount | null;
  readonly vatRate: GreekVatRatePercent | null;
}

export type ShowcasePricedAmounts = ShowcaseConsumerPrice | ShowcaseBuyerPrice;

export type ShowcasePrice = { readonly kind: 'onRequest' } | ShowcasePricedAmounts;

/** Οι τιμές ενός μοντέλου, ανά SKU (`variantId`). SKU που λείπει ⇒ «Κατόπιν προσφοράς». */
export type ShowcaseModelPrices = Readonly<Record<string, ShowcasePrice>>;

/** Ό,τι μπορεί να δει ο ανώνυμος για ένα SKU: «Κατόπιν προσφοράς» ή τιμή καταναλωτή. Ποτέ τιμή αγοραστή. */
export type ShowcaseConsumerOutcome = { readonly kind: 'onRequest' } | ShowcaseConsumerPrice;

/** Οι τιμές της διαδρομής του **ανώνυμου** (ISR HTML, JSON-LD): ο τύπος αποκλείει δομικά την τιμή αγοραστή (3ος γύρος). */
export type ShowcaseConsumerModelPrices = Readonly<Record<string, ShowcaseConsumerOutcome>>;

/** Η τιμή «από» ανά κάρτα (`modelId`). Μόνο κάρτες με συγκρίσιμη τελική τιμή μπαίνουν (`showcaseFromPrice`). */
export type ShowcaseCardPrices = Readonly<Record<string, ShowcaseConsumerPrice>>;

export const SHOWCASE_ON_REQUEST: { readonly kind: 'onRequest' } = { kind: 'onRequest' };

/** Τα δεκαδικά που δέχεται η ποσότητα τιμής για την τιμή μονάδας (π.χ. «ανά 0,5 m²»). */
const PRICE_QUANTITY_DECIMALS = 6;

/**
 * Η αξία **μίας** μονάδας, όταν η τιμή αφορά άλλη ποσότητα (Οδηγία 98/6 άρθ. 3). Δέχεται και δεκαδική ποσότητα: μετατροπή σε
 * ακέραιο με την ελάχιστη κλίμακα που την αναπαριστά ακριβώς (`scaledInteger`) και **μία** στρογγύλευση (`divideHalfUp`), η
 * αριθμητική της μηχανής. `null` μόνο αν η ποσότητα δεν αναπαρίσταται (ή ισούται με 1, οπότε η τιμή μονάδας είναι η ίδια η τιμή).
 */
export function perUnitAmount(amount: MinorAmount | null, priceQuantity: number): MinorAmount | null {
  if (amount === null || priceQuantity === 1) return null;
  for (let decimals = 0; decimals <= PRICE_QUANTITY_DECIMALS; decimals += 1) {
    const scale = 10 ** decimals;
    const scaled = scaledInteger(priceQuantity, scale);
    if (scaled === null || scaled <= 0) continue;
    const unit = divideHalfUp(BigInt(amount) * BigInt(scale), BigInt(scaled));
    return unit <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(unit) : null;
  }
  return null;
}

type QuotedLine = Extract<PriceQuoteResult, { readonly kind: 'priced' }>['quote'];

/** Προς τον καταναλωτή: μόνο τελική. Χωρίς συντελεστή, ή χωρίς τιμή μονάδας εκεί που χρειάζεται ⇒ «Κατόπιν προσφοράς». */
function consumerPriceOf({ netAmount, priceQuantity, unitCode }: QuotedLine, vatRate: GreekVatRatePercent | null): ShowcaseConsumerOutcome {
  if (vatRate === null) return SHOWCASE_ON_REQUEST;
  const gross = vatInclusiveAmount(netAmount, vatRate);
  const unitGross = perUnitAmount(gross, priceQuantity);
  // Χ3: τιμή προς καταναλωτή για άλλη ποσότητα χωρίς τιμή μονάδας δεν δείχνεται· ποτέ σιωπηλή απώλεια της ένδειξης.
  if (priceQuantity !== 1 && unitGross === null) return SHOWCASE_ON_REQUEST;
  return { kind: 'priced', audience: 'anonymous', currency: MONEY_CURRENCY, unitCode, priceQuantity, net: null, unitNet: null, gross, vatRate, unitGross };
}

/** Προς τον αγοραστή: η καθαρή πάντα, η τελική μόνο με γνωστό συντελεστή. */
function buyerPriceOf({ netAmount, priceQuantity, unitCode }: QuotedLine, vatRate: GreekVatRatePercent | null): ShowcaseBuyerPrice {
  const gross = vatRate === null ? null : vatInclusiveAmount(netAmount, vatRate);
  return {
    kind: 'priced',
    audience: 'buyer',
    currency: MONEY_CURRENCY,
    unitCode,
    priceQuantity,
    net: netAmount,
    unitNet: perUnitAmount(netAmount, priceQuantity),
    gross,
    vatRate,
    unitGross: perUnitAmount(gross, priceQuantity),
  };
}

/** Η κρίση για τη βιτρίνα. `vatRate`: ο συντελεστής της αλυσίδας του SKU (`showcaseVatRateOf`), ή `null` αν δεν είναι γνωστός. */
export function showcasePriceOf(result: PriceQuoteResult, vatRate: GreekVatRatePercent | null, audience: ShowcaseAudience): ShowcasePrice {
  const visibility = result.visibility?.visibility ?? DEFAULT_CATALOG_VISIBILITY;
  if (!showsProduct(visibility) || !showsPrice(visibility) || result.kind !== 'priced') return SHOWCASE_ON_REQUEST;
  return audience === 'anonymous' ? consumerPriceOf(result.quote, vatRate) : buyerPriceOf(result.quote, vatRate);
}

/**
 * Ο συντελεστής ΦΠΑ ενός SKU (ADR-923 §5.13 Ε3, ανασκόπηση Χ2). **Κάθε κλάδος κρίνεται χωριστά**: για κάθε κατηγορία όπου ανήκει
 * το SKU (ή ο φορέας του), ο συντελεστής του κλάδου είναι ο δικός της, αλλιώς του πλησιέστερου προγόνου (`categoryVatSource`, ο
 * ίδιος κανόνας με την οθόνη κατηγορίας). Διαφορετικοί συντελεστές σε διαφορετικούς κλάδους ⇒ `null`, **ό,τι κι αν είναι το
 * βάθος τους**: προς τον καταναλωτή καλύτερα «Κατόπιν προσφοράς» παρά λάθος τελική τιμή. Κλάδος χωρίς κανέναν δεν αντιφάσκει.
 *
 * @param categoryIds οι κατηγορίες όπου ανήκει άμεσα το SKU και οι φορείς της αλυσίδας του.
 * @param byId οι κατηγορίες αυτές **και** οι πρόγονοί τους· ό,τι λείπει (διαγραμμένο) δεν δηλώνει τίποτα.
 */
export function showcaseVatRateOf(categoryIds: readonly string[], byId: ReadonlyMap<string, CategoryVatHolder>): GreekVatRatePercent | null {
  const rates = new Set<GreekVatRatePercent>();
  for (const categoryId of new Set(categoryIds)) {
    const category = byId.get(categoryId);
    if (category === undefined) continue;
    const source = categoryVatSource(category.vatRate ?? null, category.ancestorIds, byId);
    if (source.kind !== 'none') rates.add(source.rate);
  }
  const [only, ...others] = [...rates];
  return only !== undefined && others.length === 0 ? only : null;
}

const isConsumerPriced = (price: ShowcasePrice): price is ShowcaseConsumerPrice => price.kind === 'priced' && price.audience === 'anonymous';

/**
 * Η πόρτα από τον γενικό πίνακα της μηχανής προς τη διαδρομή του ανώνυμου: ό,τι δεν είναι τιμή καταναλωτή γίνεται «Κατόπιν
 * προσφοράς». Ο τύπος εγγυάται ότι καμία τιμή αγοραστή δεν φτάνει στο ISR· η μετατροπή είναι το δίχτυ αν η μηχανή κληθεί λάθος.
 */
export function consumerPricesOf(prices: ShowcaseModelPrices): ShowcaseConsumerModelPrices {
  return Object.fromEntries(Object.entries(prices).map(([variantId, price]) => [variantId, isConsumerPriced(price) ? price : SHOWCASE_ON_REQUEST]));
}

/**
 * Η τιμή «από» της κάρτας: η χαμηλότερη **τελική** τιμή ανάμεσα στα SKU με τιμή, μόνο αν όλα μετρούν στην **ίδια** μονάδα και
 * ποσότητα. Αλλιώς `null`: «από 4 €» δίπλα σε «500 € ανά παλέτα» θα ήταν παραπλανητική σύγκριση. Η κάρτα είναι ανώνυμη (ISR):
 * μετρούν μόνο τιμές καταναλωτή, ποτέ τιμή αγοραστή.
 */
export function showcaseFromPrice(prices: readonly ShowcasePrice[]): ShowcaseConsumerPrice | null {
  const priced = prices.filter(isConsumerPriced);
  const [first] = priced;
  if (first === undefined) return null;
  const comparable = priced.every((price) => price.unitCode === first.unitCode && price.priceQuantity === first.priceQuantity);
  if (!comparable) return null;
  return priced.reduce((lowest, price) => (price.gross < lowest.gross ? price : lowest));
}

/**
 * Οι τρεις τρόποι της μίας επιφάνειας τιμής (`ShowcasePriceSurface`). Ζει εδώ και όχι δίπλα στην επιφάνεια: το μητρώο
 * επιφανειών (στατική κλειστότητα των σελίδων) δεν πρέπει να εισάγει **τίποτα** από το chunk, ούτε τύπο.
 */
export type ShowcasePriceSurfaceProps =
  | { readonly mode: 'public'; readonly price: ShowcaseConsumerPrice }
  | { readonly mode: 'from'; readonly price: ShowcaseConsumerPrice }
  | { readonly mode: 'buyer'; readonly model: PublicCatalogModel };

/** Η τιμή ενός SKU από τον πίνακα, με «Κατόπιν προσφοράς» για ό,τι λείπει. Κρατά τον τύπο του πίνακα (ανώνυμος ⇒ μόνο καταναλωτή). */
export function showcasePriceIn<TPrice extends ShowcasePrice>(
  prices: Readonly<Record<string, TPrice>> | null,
  variantId: string,
): TPrice | typeof SHOWCASE_ON_REQUEST {
  return prices?.[variantId] ?? SHOWCASE_ON_REQUEST;
}
