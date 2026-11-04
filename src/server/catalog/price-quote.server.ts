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
import { versionAt, type PriceVersionRef } from '@/subapps/catalog/pricing/version-timeline';
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
  PriceListLineDefinition,
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

export type ListSelection = { readonly trace: PriceQuoteContext['listTrace'] } & (
  | { readonly kind: 'list'; readonly list: StoredList }
  | Extract<PriceQuoteOutcome, { kind: 'noPriceList' | 'ambiguousPriceList' }>
);

/** Η λίστα του θεατή: ρητή, ή του ειδικότερου κοινού που τον καλύπτει (ο ίδιος επιλογέας με τις συνθήκες). */
async function selectList(
  scope: CatalogReadScope,
  request: Pick<QuoteTerms, 'priceListId'>,
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
  const basis = await readQuoteBasis(scope, request, viewer);
  const visibility = await visibilityOf(scope, request, viewer, basis.atMs);
  return quoteOnBasis(basis, request, await readBasisLine(scope, basis, request.subject), visibility);
}

/**
 * Ό,τι είναι **κοινό σε κάθε υποκείμενο** ενός θεατή: η στιγμή, η λίστα, οι εκδόσεις της, οι συνθήκες. Η μαζική ανάγνωση (εξαγωγή
 * xChange, §5.14) το διαβάζει **μία** φορά και κρίνει κάθε SKU με το {@link quoteOnBasis}, ώστε να μη γραφτεί δεύτερη μηχανή.
 */
export interface QuoteBasis {
  readonly viewer: PricingViewer;
  readonly atMs: number;
  readonly selected: ListSelection;
  readonly versions: readonly PriceVersionRef[];
  readonly conditions: readonly PricedRecord<DiscountConditionDefinition>[];
}

/** Η γραμμή τιμής όπως τη ζητά η κρίση: ορισμός με id. */
export type QuoteLine = PriceListLineDefinition & { readonly id: string };

export async function readQuoteBasis(scope: CatalogReadScope, terms: Pick<QuoteTerms, 'priceListId' | 'at'>, viewer: PricingViewer): Promise<QuoteBasis> {
  const atMs = normalizeToMillisOrNull(terms.at ?? nowISO()) ?? Date.now();
  const selected = await selectList(scope, terms, viewer, atMs);
  if (selected.kind !== 'list') return { viewer, atMs, selected, versions: [], conditions: [] };
  const versions = (await readListVersions(scope, selected.list.id)).map(versionRefOf);
  return { viewer, atMs, selected, versions, conditions: await readActiveConditions(scope) };
}

/** Η έκδοση της βάσης που ισχύει στη στιγμή της· `null` χωρίς λίστα ή πριν από την πρώτη δημοσίευση. */
export function basisVersion(basis: QuoteBasis): PriceVersionRef | null {
  return basis.selected.kind === 'list' ? versionAt(basis.versions, basis.atMs) : null;
}

/**
 * Μία γραμμή, με ντετερμινιστικό id: η ανάγνωση της μεμονωμένης κρίσης. Τη ζητά και η βιτρίνα (§5.13 Σ6), που κρίνει λίγα SKU
 * ενός μοντέλου πάνω σε μία βάση και δεν χρειάζεται όλες τις γραμμές της έκδοσης.
 */
export async function readBasisLine(scope: CatalogReadScope, basis: QuoteBasis, subject: QuoteTerms['subject']): Promise<QuoteLine | null> {
  const version = basisVersion(basis);
  if (version === null) return null;
  const lineId = naturalKeyId(scope, 'priceListLine', priceListLineKey(version.id, priceLineSubjectKey(subject)));
  return readOwnedOrNull<StoredPriceListLineDefinition>(scope, 'priceListLine', lineId);
}

/** **Η κρίση πάνω σε διαβασμένη βάση**: καθαρή, ίδια για τη μία τιμή και για τη μαζική ανάγνωση. */
export function quoteOnBasis(basis: QuoteBasis, request: Pick<QuoteTerms, 'subject' | 'quantity'>, line: QuoteLine | null, visibility: VisibilityVerdict | null): PriceQuoteResult {
  const { selected } = basis;
  const context: PriceQuoteContext = { viewer: basis.viewer, at: new Date(basis.atMs).toISOString(), listTrace: selected.trace, visibility };
  if (selected.kind === 'noPriceList') return { kind: selected.kind, ...context };
  if (selected.kind === 'ambiguousPriceList') return { kind: selected.kind, tiedPriceListIds: selected.tiedPriceListIds, ...context };
  return { ...quoteFromList(basis, selected.list, request, line), ...context };
}

function quoteFromList(basis: QuoteBasis, list: StoredList, request: Pick<QuoteTerms, 'subject' | 'quantity'>, line: QuoteLine | null): PriceQuoteOutcome {
  const subjectKey = priceLineSubjectKey(request.subject);
  const resolution = resolveCatalogPrice({
    priceList: { id: list.id, definition: list },
    versions: basis.versions,
    lineFor: (versionId, key) =>
      line !== null && line.versionId === versionId && key === subjectKey ? { id: line.id, definition: line } : null,
    conditions: basis.conditions,
    viewer: basis.viewer,
    subject: request.subject,
    quantity: request.quantity,
    atMs: basis.atMs,
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
