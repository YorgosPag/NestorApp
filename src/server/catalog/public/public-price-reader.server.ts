import 'server-only';

/**
 * **Η ΜΑΖΙΚΗ ΚΡΙΣΗ ΤΙΜΗΣ ΤΗΣ ΒΙΤΡΙΝΑΣ** (ADR-923 §5.13 Σ6 · Δ2 · §12 🔒): πολλά SKU, **μία** βάση τιμής, **ένα** στιγμιότυπο.
 *
 * 🔑 Η μία μηχανή (§5.14 Ζ12): λίστα, εκδόσεις και συνθήκες διαβάζονται **μία** φορά (`readQuoteBasis`), οι κανόνες ορατότητας μία
 *    φορά, και κάθε SKU κρίνεται με το `quoteOnBasis`, το ίδιο που απαντά στο «δες την τιμή σαν τον Χ». Η γραμμή κάθε SKU
 *    διαβάζεται με το ντετερμινιστικό της id (`readBasisLine`): ένα μοντέλο έχει λίγα SKU, η έκδοση χιλιάδες γραμμές.
 * 🔒 **Ο θεατής χτίζεται εδώ, μέσα στη συναλλαγή**, ποτέ από τον καλούντα: ο ανώνυμος είναι `anonymous`· ο αγοραστής κρίνεται από
 *    τη **σχέση** του ζεύγους (`viewerOfRelationship`), και χωρίς ενεργή σχέση είναι απλώς «συνδεδεμένος», χωρίς ομάδα και χωρίς
 *    ταυτότητες. Τιμή συνεργάτη χωρίς έγκριση του προμηθευτή δεν υπάρχει (§5.12 Σ2). Η ανάκληση της σχέσης κερδίζει κάθε αγώνα.
 * 🔒 Φεύγει **μόνο** το κλειστό `ShowcasePrice` (`showcasePriceOf`): κανένα id λίστας, συνθήκης ή κοινού.
 * ⛔ Δεν ξέρει τίποτα για μνήμη ή διακόπτη: αυτά τα κρατά ο καλών (`services/public-catalog/public-catalog-prices.ts`). Δηλωμένος
 *    αναγνώστης ξένου καταλόγου (CHECK 3.106).
 *
 * @module server/catalog/public/public-price-reader.server
 */

import { readActiveSupplyRelationshipInTx } from '@/server/supply-relationships/supply-relationship-store.server';
import { judgeVisibility, type StoredVisibilityRule } from '@/subapps/catalog/pricing/visibility';
import {
  SHOWCASE_ON_REQUEST,
  showcasePriceOf,
  type ShowcaseAudience,
  type ShowcaseModelPrices,
  type ShowcasePrice,
} from '@/subapps/catalog/public/showcase-price';
import type { PricingViewer } from '@/subapps/catalog/types/price-list';
import { runForeignCatalogRead, type CatalogReadScope } from '../catalog-store.server';
import { quoteOnBasis, readBasisLine, readQuoteBasis, type QuoteBasis } from '../price-quote.server';
import { viewerOfRelationship } from '../pricing-viewer.server';
import { readVisibilityRules } from '../visibility-reads.server';
import { readPublicVariantPlacements, type PublicVariantPlacements } from './public-model-snapshot.server';

/** Ποιος ρωτά. Ο αγοραστής ονομάζεται **μόνο** με τον χώρο του `AuthContext`, ποτέ με κάτι από το αίτημα. */
export type ShowcaseViewerSource = { readonly kind: 'anonymous' } | { readonly kind: 'buyer'; readonly buyerCompanyId: string };

/** Μία δημοσιεύσιμη ρίζα και τα SKU της που ζητούνται: πάντα τα SKU του **δημόσιου εγγράφου**, ποτέ όλο το δέντρο (Μ3 · Χ5). */
export interface ShowcasePriceRequest {
  readonly rootId: string;
  readonly variantIds: readonly string[];
}

/** Οι τιμές ανά ρίζα, ανά SKU. Σχήμα JSON, ώστε να περνά από το `unstable_cache`. */
export type ShowcasePriceTable = Readonly<Record<string, ShowcaseModelPrices>>;

/** Όριο ριζών ανά συναλλαγή: μία σελίδα καρτών (48) με περιθώριο. Μεγαλύτερο αίτημα είναι λάθος του καλούντα. */
export const SHOWCASE_PRICE_MAX_MODELS = 60;

const SIGNED_IN_WITHOUT_RELATIONSHIP: PricingViewer = { kind: 'signedIn', customerGroupId: null, parties: [] };

async function showcaseViewerOf(scope: CatalogReadScope, source: ShowcaseViewerSource): Promise<PricingViewer> {
  if (source.kind === 'anonymous') return { kind: 'anonymous' };
  const ends = { supplierCompanyId: scope.ctx.companyId, buyerCompanyId: source.buyerCompanyId };
  const relationship = await readActiveSupplyRelationshipInTx(scope.tx, scope.db, ends);
  return relationship === null ? SIGNED_IN_WITHOUT_RELATIONSHIP : viewerOfRelationship(scope, relationship);
}

interface Judge {
  readonly scope: CatalogReadScope;
  readonly basis: QuoteBasis;
  readonly rules: readonly StoredVisibilityRule[];
  readonly audience: ShowcaseAudience;
}

async function priceOfVariant(judge: Judge, placements: PublicVariantPlacements, variantId: string): Promise<ShowcasePrice> {
  const ancestry = placements.ancestries.get(variantId);
  if (ancestry === undefined) return SHOWCASE_ON_REQUEST;
  const { scope, basis, rules, audience } = judge;
  const subject = { kind: 'variant' as const, variantId };
  const line = await readBasisLine(scope, basis, subject);
  const visibility = judgeVisibility(rules, ancestry, basis.viewer, basis.atMs);
  const result = quoteOnBasis(basis, { subject, quantity: line?.priceQuantity ?? 1 }, line, visibility);
  return showcasePriceOf(result, placements.vatRates.get(variantId) ?? null, audience);
}

async function pricesOfModel(judge: Judge, request: ShowcasePriceRequest): Promise<ShowcaseModelPrices> {
  const placements = await readPublicVariantPlacements(judge.scope, request.rootId);
  if (placements === null) return {};
  const { variantIds } = request;
  const prices = await Promise.all(variantIds.map((variantId) => priceOfVariant(judge, placements, variantId)));
  return Object.fromEntries(variantIds.map((variantId, index) => [variantId, prices[index]]));
}

/**
 * Οι τιμές της βιτρίνας για έναν θεατή, σε **μία** συναλλαγή μόνο ανάγνωσης πάνω στον κατάλογο του προμηθευτή.
 * Ρίζα που δεν είναι (πια) δημοσιεύσιμη δίνει κενό πίνακα: για τη σελίδα αυτό σημαίνει «Κατόπιν προσφοράς».
 */
export function readShowcasePrices(supplierCompanyId: string, source: ShowcaseViewerSource, requests: readonly ShowcasePriceRequest[]): Promise<ShowcasePriceTable> {
  if (requests.length > SHOWCASE_PRICE_MAX_MODELS) throw new Error('showcase-price-request-too-large');
  return runForeignCatalogRead(supplierCompanyId, async (scope) => {
    const viewer = await showcaseViewerOf(scope, source);
    const basis = await readQuoteBasis(scope, { priceListId: null, at: scope.now }, viewer);
    const judge: Judge = { scope, basis, rules: await readVisibilityRules(scope), audience: source.kind === 'anonymous' ? 'anonymous' : 'buyer' };
    // Μ3: τα μοντέλα κρίνονται παράλληλα· το πλήθος τους (≤ `SHOWCASE_PRICE_MAX_MODELS`) και των SKU τους το φράζει ο καλών.
    const prices = await Promise.all(requests.map((request) => pricesOfModel(judge, request)));
    return Object.fromEntries(requests.map((request, index) => [request.rootId, prices[index]]));
  });
}
