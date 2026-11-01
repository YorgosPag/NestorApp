import 'server-only';

/**
 * =============================================================================
 * Η ΤΙΜΗ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ — «δες την τιμή σαν τον Χ» (ADR-923 §5.11 «3β» αποφάσεις Α + Δ · §12 🔒)
 * =============================================================================
 *
 * 1. Ο **θεατής** χτίζεται από **αποθηκευμένες** εγγραφές του χώρου (`pricing-viewer.server.ts`), ποτέ από ό,τι στέλνει ο
 *    πελάτης.
 * 2. Η **λίστα** επιλέγεται με τον **ίδιο** επιλογέα των συνθηκών (`selectMostSpecific`): ο ειδικότερος κοινός που
 *    καλύπτει τον θεατή νικά (commercetools price selection)· καμία = «ζητήστε προσφορά», ισοπαλία = αδύνατη
 *    (την αρνείται η αποθήκευση) αλλά αναφέρεται ρητά αν ποτέ συμβεί.
 * 3. Έκδοση ως προς ημερομηνία → γραμμή (**απευθείας** ανάγνωση: ντετερμινιστικό id) → συνθήκες → `resolveCatalogPrice`.
 *
 * Όλα σε **μία** συναλλαγή ανάγνωσης ⇒ **συνεπές** στιγμιότυπο: η τιμή δεν μπορεί να βγει από λίστα της στιγμής Α
 * και συνθήκη της στιγμής Β. 🔒 Στη 3β μόνο **εσωτερικά** (προεπισκόπηση του προμηθευτή)· προς άλλο χώρο μόνο με
 * τους κανόνες ορατότητας του §12 (Φάση 6).
 * @module server/catalog/price-quote.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { nowISO, normalizeToMillisOrNull } from '@/lib/date-local';
import { discountCascade } from '@/lib/pricing/discount-rule';
import { selectMostSpecific, type SelectionCandidate } from '@/lib/pricing/select-condition';
import { audienceCovers, audienceSpecificity } from '@/subapps/catalog/pricing/price-audience';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { priceListLineKey } from '@/subapps/catalog/pricing/pricing-keys';
import { resolveCatalogPrice, type PricedRecord } from '@/subapps/catalog/pricing/resolve-catalog-price';
import { versionAt } from '@/subapps/catalog/pricing/version-timeline';
import { judgeVisibility } from '@/subapps/catalog/pricing/visibility';
import type {
  PriceQuoteContext,
  PriceQuoteOutcome,
  PriceQuoteRequest,
  PriceQuoteResult,
} from '@/subapps/catalog/types/price-list-requests';
import type {
  DiscountConditionDefinition,
  PriceAudience,
  PriceListDefinition,
  PricingViewer,
  StoredPriceListLineDefinition,
} from '@/subapps/catalog/types/price-list';
import type { VisibilityVerdict } from '@/subapps/catalog/types/visibility-rule';
import { DEFAULT_CATALOG_VISIBILITY } from '@/subapps/catalog/vocabulary/pricing';
import {
  naturalKeyId,
  readOwned,
  readOwnedOrNull,
  runCatalogTransaction,
  type CatalogReadScope,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { viewerOf } from './pricing-viewer.server';
import { readActivePriceLists, readListVersions, versionRefOf, type StoredPriceList } from './price-version-reads.server';
import { readVisibilityAncestry, readVisibilityRules } from './visibility-reads.server';

/** Το αίτημα χωρίς το «ως ποιον»: ο θεατής έρχεται χτισμένος. */
type QuoteTerms = Omit<PriceQuoteRequest, 'viewAs'>;

type StoredList = StoredPriceList;
type OfferedList = StoredList & { readonly audience: PriceAudience };

const isOffered = (list: StoredList): list is OfferedList => list.audience !== null;

type ListSelection = { readonly trace: PriceQuoteContext['listTrace'] } & (
  | { readonly kind: 'list'; readonly list: StoredList }
  | Extract<PriceQuoteOutcome, { kind: 'noPriceList' | 'ambiguousPriceList' }>
);

/** Η λίστα του θεατή: ρητή, ή του ειδικότερου κοινού που τον καλύπτει (ο ίδιος επιλογέας με τις συνθήκες). */
async function selectList(
  scope: CatalogReadScope,
  request: QuoteTerms,
  viewer: PricingViewer,
  atMs: number,
): Promise<ListSelection> {
  if (request.priceListId !== null) {
    return { kind: 'list', list: await readOwned<PriceListDefinition>(scope, 'priceList', request.priceListId), trace: [] };
  }
  const candidates = (await readActivePriceLists(scope, 'sales')).filter(isOffered).map(
    (list): SelectionCandidate<StoredList, 'audienceMismatch'> => ({
      id: list.id,
      item: list,
      validity: { fromMs: null, untilMs: null },
      mismatch: audienceCovers(list.audience, viewer) ? null : 'audienceMismatch',
      specificity: [audienceSpecificity(list.audience)],
    }),
  );
  const selection = selectMostSpecific(candidates, atMs);
  const { trace } = selection;
  if (selection.kind === 'selected') return { kind: 'list', list: selection.winner, trace };
  if (selection.kind === 'ambiguous') return { kind: 'ambiguousPriceList', tiedPriceListIds: selection.tiedIds, trace };
  return { kind: 'noPriceList', trace };
}

/** Οι ενεργές συνθήκες με την αναθεώρησή τους — ο εκδότης τη βάζει στο κλειδί ιδεμποτίας (§5.6). */
export async function readActiveConditionRecords(scope: CatalogReadScope): Promise<{ readonly record: PricedRecord<DiscountConditionDefinition>; readonly revision: number }[]> {
  const snap = await scope.tx.get(
    scope.db
      .collection(COLLECTIONS.CATALOG_DISCOUNT_CONDITIONS)
      .where('companyId', '==', scope.ctx.companyId)
      .where('isDeleted', '==', false),
  );
  return snap.docs.map((doc) => {
    const record = doc.data() as StoredCatalogRecord<DiscountConditionDefinition>;
    const { id, discountGroupId, audience, validFrom, validUntil, rule } = record;
    return { record: { id, definition: { discountGroupId, audience, validFrom, validUntil, rule } }, revision: record.revision };
  });
}

async function readActiveConditions(scope: CatalogReadScope): Promise<PricedRecord<DiscountConditionDefinition>[]> {
  return (await readActiveConditionRecords(scope)).map(({ record }) => record);
}

/** Η μία κρίση ορατότητας, στην ίδια συναλλαγή με την τιμή (§5.12 Δ4). Μόνο τα SKU έχουν ορατότητα· οι εργασίες ΑΤΟΕ όχι. */
async function visibilityOf(scope: CatalogReadScope, request: QuoteTerms, viewer: PricingViewer, atMs: number): Promise<VisibilityVerdict | null> {
  if (request.subject.kind !== 'variant') return null;
  const ancestry = await readVisibilityAncestry(scope, request.subject.variantId);
  if (ancestry === null) return { visibility: DEFAULT_CATALOG_VISIBILITY, ruleId: null, tied: false, trace: [] };
  return judgeVisibility(await readVisibilityRules(scope), ancestry, viewer, atMs);
}

/** Η τιμή για έναν θεατή (εσωτερική προεπισκόπηση): η ετυμηγορία ταξιδεύει δίπλα στο ποσό, που ανήκει στον ίδιο τον προμηθευτή. */
export function quoteCatalogPrice(ctx: AuthContext, request: PriceQuoteRequest): Promise<PriceQuoteResult> {
  return runCatalogTransaction(ctx, async (scope) => quoteWithin(scope, request, await viewerOf(scope, request.viewAs)));
}

/**
 * **Η ΜΙΑ κρίση τιμής**, για γνωστό θεατή, μέσα σε συναλλαγή του καλούντα: η εσωτερική προεπισκόπηση και η ξένη ανάγνωση (§5.12
 * Δ4) ρωτούν το ίδιο πράγμα, ώστε το «δες σαν τον Χ» να λέει ό,τι θα δει ο Χ.
 */
export async function quoteWithin(scope: CatalogReadScope, request: QuoteTerms, viewer: PricingViewer): Promise<PriceQuoteResult> {
  const atMs = normalizeToMillisOrNull(request.at ?? nowISO()) ?? Date.now();
  const selected = await selectList(scope, request, viewer, atMs);
  const visibility = await visibilityOf(scope, request, viewer, atMs);
  const context: PriceQuoteContext = { viewer, at: new Date(atMs).toISOString(), listTrace: selected.trace, visibility };
  if (selected.kind === 'noPriceList') return { kind: selected.kind, ...context };
  if (selected.kind === 'ambiguousPriceList') return { kind: selected.kind, tiedPriceListIds: selected.tiedPriceListIds, ...context };
  return { ...(await quoteFromList(scope, request, viewer, selected.list, atMs)), ...context };
}

async function quoteFromList(
  scope: CatalogReadScope,
  request: QuoteTerms,
  viewer: PricingViewer,
  list: StoredList,
  atMs: number,
): Promise<PriceQuoteOutcome> {
  const versions = (await readListVersions(scope, list.id)).map(versionRefOf);
  const version = versionAt(versions, atMs);
  const subjectKey = priceLineSubjectKey(request.subject);
  const lineId = version === null ? null : naturalKeyId(scope, 'priceListLine', priceListLineKey(version.id, subjectKey));
  const line = lineId === null ? null : await readOwnedOrNull<StoredPriceListLineDefinition>(scope, 'priceListLine', lineId);
  const conditions = await readActiveConditions(scope);
  const resolution = resolveCatalogPrice({
    priceList: { id: list.id, definition: list },
    versions,
    lineFor: (versionId, key) =>
      line !== null && line.versionId === versionId && key === subjectKey ? { id: line.id, definition: line } : null,
    conditions,
    viewer,
    subject: request.subject,
    quantity: request.quantity,
    atMs,
  });
  switch (resolution.kind) {
    case 'priced': {
      const { quote } = resolution;
      return { kind: 'priced', quote, priceListAudience: list.audience, cascade: discountCascade(quote.listAmount, quote.discountSteps) };
    }
    case 'noVersion':
      return { kind: 'noVersion', priceListId: list.id };
    case 'noLine':
      return { kind: 'noLine', priceListId: list.id, priceListVersionId: resolution.priceListVersionId };
    case 'ambiguousDiscount':
      return { ...resolution, priceListId: list.id };
    case 'invalidQuantity':
      return { kind: 'invalidQuantity' };
  }
}
