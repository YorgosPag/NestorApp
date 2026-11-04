import 'server-only';

/**
 * **Οι τιμές της δημόσιας βιτρίνας για τις σελίδες και τη νησίδα** (ADR-923 §5.13 Σ6 · Δ2 · §12 🔒).
 *
 * Δύο δρόμοι, που δεν συναντιούνται ποτέ:
 * - **Ανώνυμος** (ISR): μνήμη `unstable_cache` με κλειδί **χωρίς ταυτότητα** και tags εταιρείας · μοντέλου · τιμών. Ο θεατής είναι
 *   πάντα `anonymous`, άρα η καταχώριση είναι ίδια για κάθε επισκέπτη και η σελίδα μένει στατική.
 * - **Αγοραστής** (route `private, no-store`): **καμία** μνήμη. Ο χώρος έρχεται μόνο από το `AuthContext`. Κρίνονται μόνο τα SKU
 *   του δημόσιου εγγράφου, άρα η νησίδα δεν είναι όργανο ανακάλυψης κρυφών SKU.
 *
 * 🔒 **Διακόπτης κλειστός ⇒ καμία ανάγνωση**: ο έλεγχος είναι η πρώτη γραμμή κάθε δρόμου, πριν από βάση ή μνήμη. Η σελίδα παίρνει
 *    `null` και αποδίδει ό,τι απέδιδε πριν το Σ6· η νησίδα παίρνει κενό πίνακα.
 * 🔒 Πύλη πριν από το περιεχόμενο: χωρίς έγκυρη βιτρίνα δεν κρίνεται καμία τιμή (`readPublicSupplier` / `readPublicModel`).
 * 🔑 Μ2: η τιμή είναι **πρόσθετο** της σελίδας. Βλάβη στην κρίση ⇒ `null` + προειδοποίηση, και η σελίδα δείχνει «Κατόπιν
 *    προσφοράς», ποτέ 5xx. Η βλάβη πιάνεται **έξω** από τη μνήμη, ώστε ένα `null` από βλάβη να μη μείνει αποθηκευμένο.
 * 🔑 Μ3: η κάρτα κρίνει μόνο τα SKU του δημόσιου εγγράφου, έως `SHOWCASE_CARD_MAX_SKUS`· πάνω από αυτά μένει «Κατόπιν
 *    προσφοράς». Έτσι το κόστος μιας σελίδας καρτών είναι φραγμένο: ≤ 48 μοντέλα × 24 SKU, παράλληλα, σε μία συναλλαγή.
 *
 * @module services/public-catalog/public-catalog-prices
 */

import { isAppFeatureEnabled } from '@/config/feature-flags';
import type { AuthContext } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { publicCatalogCompanyTag, publicCatalogModelTag, publicCatalogPricesTag } from '@/server/catalog/public/public-catalog-cache-tag';
import { readShowcasePrices, type ShowcasePriceRequest, type ShowcasePriceTable } from '@/server/catalog/public/public-price-reader.server';
import type { PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import type { PublicModelCard } from '@/subapps/catalog/public/public-model-card';
import {
  consumerPricesOf,
  showcaseFromPrice,
  type ShowcaseCardPrices,
  type ShowcaseConsumerModelPrices,
  type ShowcaseModelPrices,
} from '@/subapps/catalog/public/showcase-price';
import { cached, readPublicModel, readPublicSupplier } from './public-catalog.reader';

const pricesEnabled = (): boolean => isAppFeatureEnabled('PUBLIC_SHOWCASE_PRICES');

const logger = createModuleLogger('public-catalog-prices');

/** Όριο SKU ανά κάρτα για την τιμή «από» (Μ3). Μοντέλο με περισσότερα μένει «Κατόπιν προσφοράς» στην κάρτα, όχι στη σελίδα του. */
export const SHOWCASE_CARD_MAX_SKUS = 24;

/** Η τιμή δεν ρίχνει ποτέ τη σελίδα (Μ2). Έξω από τη μνήμη: η βλάβη δεν αποθηκεύεται. */
async function orNoPrices<T>(what: string, companyId: string, load: () => Promise<T | null>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    logger.warn('Η τιμή της βιτρίνας απέτυχε· η σελίδα δείχνει «Κατόπιν προσφοράς»', { what, companyId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

const variantIdsOf = (model: PublicCatalogModel): readonly string[] => model.variants.map((variant) => variant.variantId);

/** Οι ανώνυμες τιμές ενός δημόσιου μοντέλου, για το ISR HTML. `null` ⇒ κλειστός διακόπτης ή ανακλημένη βιτρίνα. */
export async function readPublicModelPrices(model: PublicCatalogModel): Promise<ShowcaseConsumerModelPrices | null> {
  if (!pricesEnabled()) return null;
  const { companyId, modelId } = model;
  return orNoPrices('model', companyId, async () => {
    if ((await readPublicSupplier(companyId)) === null) return null;
    const tags = [publicCatalogCompanyTag(companyId), publicCatalogModelTag(modelId), publicCatalogPricesTag(companyId)];
    // Ο τύπος της διαδρομής του ανώνυμου αποκλείει δομικά την τιμή αγοραστή (3ος γύρος)· το `consumerPricesOf` είναι η πόρτα.
    const load = async () => consumerPricesOf((await readShowcasePrices(companyId, { kind: 'anonymous' }, [{ rootId: modelId, variantIds: variantIdsOf(model) }]))[modelId] ?? {});
    return cached(load, ['prices', companyId, modelId], tags);
  });
}

function fromPricesOf(table: ShowcasePriceTable): ShowcaseCardPrices {
  const entries = Object.entries(table).flatMap(([modelId, prices]) => {
    const from = showcaseFromPrice(Object.values(prices));
    return from === null ? [] : [[modelId, from] as const];
  });
  return Object.fromEntries(entries);
}

/** Οι κάρτες που κρίνονται: μόνο με γνωστά δημόσια SKU, έως το όριο (Μ3). */
function cardRequests(cards: readonly PublicModelCard[]): readonly ShowcasePriceRequest[] {
  return cards.flatMap((card) => {
    const variantIds = card.variantIds ?? [];
    return variantIds.length === 0 || variantIds.length > SHOWCASE_CARD_MAX_SKUS ? [] : [{ rootId: card.modelId, variantIds }];
  });
}

/** Οι ανώνυμες τιμές «από» μιας σελίδας καρτών: **μία** συναλλαγή, μία βάση τιμής για όλη τη σελίδα. */
export async function readShowcaseCardPrices(companyId: string, cards: readonly PublicModelCard[]): Promise<ShowcaseCardPrices | null> {
  if (!pricesEnabled()) return null;
  const requests = cardRequests(cards);
  if (requests.length === 0) return null;
  return orNoPrices('cards', companyId, async () => {
    if ((await readPublicSupplier(companyId)) === null) return null;
    const load = async () => fromPricesOf(await readShowcasePrices(companyId, { kind: 'anonymous' }, requests));
    const key = ['card-prices', companyId, ...requests.map((request) => request.rootId)];
    return cached(load, key, [publicCatalogCompanyTag(companyId), publicCatalogPricesTag(companyId)]);
  });
}

/** Ποιο μοντέλο ζητά η νησίδα: ο προμηθευτής και η ρίζα, όπως στη διεύθυνση της σελίδας. */
export interface BuyerShowcasePriceRequest {
  readonly supplierCompanyId: string;
  readonly modelId: string;
}

const NO_BUYER_PRICES: ShowcaseModelPrices = {};

/**
 * Η τιμή **του δικού μου κοινού** για τα SKU ενός δημόσιου μοντέλου (νησίδα αγοραστή). Χωρίς μνήμη.
 * Κλειστός διακόπτης, ο ίδιος ο προμηθευτής, ανύπαρκτο, αδημοσίευτο, ανακλημένο ή ξένο μοντέλο ⇒ η **ίδια** κενή απάντηση.
 */
export async function readBuyerShowcasePrices(ctx: AuthContext, request: BuyerShowcasePriceRequest): Promise<ShowcaseModelPrices> {
  if (!pricesEnabled() || ctx.companyId === request.supplierCompanyId) return NO_BUYER_PRICES;
  const model = await readPublicModel(request.supplierCompanyId, request.modelId);
  if (model === null) return NO_BUYER_PRICES;
  const source = { kind: 'buyer', buyerCompanyId: ctx.companyId } as const;
  const table = await readShowcasePrices(model.companyId, source, [{ rootId: model.modelId, variantIds: variantIdsOf(model) }]);
  return table[model.modelId] ?? NO_BUYER_PRICES;
}
