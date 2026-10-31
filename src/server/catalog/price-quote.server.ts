import 'server-only';

/**
 * =============================================================================
 * Η ΤΙΜΗ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ — «δες την τιμή σαν τον Χ» (ADR-923 §5.11 «3β» αποφάσεις Α + Δ · §12 🔒)
 * =============================================================================
 *
 * 1. Ο **θεατής** χτίζεται από **αποθηκευμένες** εγγραφές του χώρου, ποτέ από ό,τι στέλνει ο πελάτης: ομάδα πελάτη που
 *    υπάρχει · συμβαλλόμενος που υπάρχει + η ανάθεσή του (ή καμία). Ο πελάτης λέει «σαν τον Χ», ο διακομιστής ξέρει
 *    **ποιος** είναι ο Χ.
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
import { audienceCovers, audienceSpecificity, pricingPartyKey } from '@/subapps/catalog/pricing/price-audience';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { priceListLineKey } from '@/subapps/catalog/pricing/pricing-keys';
import { resolveCatalogPrice, type PricedRecord } from '@/subapps/catalog/pricing/resolve-catalog-price';
import { versionAt } from '@/subapps/catalog/pricing/version-timeline';
import type {
  PriceQuoteContext,
  PriceQuoteOutcome,
  PriceQuoteRequest,
  PriceQuoteResult,
  PriceQuoteViewAs,
} from '@/subapps/catalog/types/price-list-requests';
import type {
  CustomerAssignmentDefinition,
  CustomerGroupDefinition,
  DiscountConditionDefinition,
  PriceAudience,
  PriceListDefinition,
  PricingViewer,
  StoredPriceListLineDefinition,
} from '@/subapps/catalog/types/price-list';
import { readActiveByIds } from './catalog-library-reads.server';
import {
  naturalKeyId,
  readForUpsert,
  readOwned,
  readOwnedOrNull,
  runCatalogTransaction,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues } from './catalog-write-error';
import { partyIssues } from './pricing-party-reads.server';
import { readActivePriceLists, readListVersions, versionRefOf, type StoredPriceList } from './price-version-reads.server';

type StoredList = StoredPriceList;
type OfferedList = StoredList & { readonly audience: PriceAudience };

const isOffered = (list: StoredList): list is OfferedList => list.audience !== null;

/** Ο θεατής, χτισμένος από ό,τι **υπάρχει** στον χώρο. */
async function viewerOf(scope: CatalogTx, viewAs: PriceQuoteViewAs): Promise<PricingViewer> {
  switch (viewAs.kind) {
    case 'anonymous':
      return { kind: 'anonymous' };
    case 'signedIn':
      return { kind: 'signedIn', customerGroupId: null, party: null };
    case 'customerGroup': {
      const groups = await readActiveByIds<CustomerGroupDefinition>(scope, 'customerGroup', [viewAs.customerGroupId]);
      assertNoIssues(groups.size === 1 ? [] : [{ code: 'unknownReference', path: 'viewAs.customerGroupId' }]);
      return { kind: 'signedIn', customerGroupId: viewAs.customerGroupId, party: null };
    }
    case 'partner': {
      assertNoIssues(await partyIssues(scope, viewAs.party, 'viewAs.party'));
      const assignment = await readForUpsert<CustomerAssignmentDefinition>(scope, 'customerAssignment', pricingPartyKey(viewAs.party));
      const current = assignment.current;
      return { kind: 'signedIn', customerGroupId: current?.customerGroupId ?? null, party: viewAs.party };
    }
  }
}

type ListSelection = { readonly trace: PriceQuoteContext['listTrace'] } & (
  | { readonly kind: 'list'; readonly list: StoredList }
  | Extract<PriceQuoteOutcome, { kind: 'noPriceList' | 'ambiguousPriceList' }>
);

/** Η λίστα του θεατή: ρητή, ή του ειδικότερου κοινού που τον καλύπτει (ο ίδιος επιλογέας με τις συνθήκες). */
async function selectList(
  scope: CatalogTx,
  request: PriceQuoteRequest,
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

async function readActiveConditions(scope: CatalogTx): Promise<PricedRecord<DiscountConditionDefinition>[]> {
  const snap = await scope.tx.get(
    scope.db
      .collection(COLLECTIONS.CATALOG_DISCOUNT_CONDITIONS)
      .where('companyId', '==', scope.ctx.companyId)
      .where('isDeleted', '==', false),
  );
  return snap.docs.map((doc) => {
    const record = doc.data() as StoredCatalogRecord<DiscountConditionDefinition>;
    const { id, discountGroupId, audience, validFrom, validUntil, rule } = record;
    return { id, definition: { discountGroupId, audience, validFrom, validUntil, rule } };
  });
}

/** Η τιμή για έναν θεατή (εσωτερική προεπισκόπηση). */
export async function quoteCatalogPrice(ctx: AuthContext, request: PriceQuoteRequest): Promise<PriceQuoteResult> {
  return runCatalogTransaction(ctx, async (scope) => {
    const atMs = normalizeToMillisOrNull(request.at ?? nowISO()) ?? Date.now();
    const viewer = await viewerOf(scope, request.viewAs);
    const selected = await selectList(scope, request, viewer, atMs);
    const context: PriceQuoteContext = { viewer, at: new Date(atMs).toISOString(), listTrace: selected.trace };
    if (selected.kind === 'noPriceList') return { kind: selected.kind, ...context };
    if (selected.kind === 'ambiguousPriceList') return { kind: selected.kind, tiedPriceListIds: selected.tiedPriceListIds, ...context };
    return { ...(await quoteFromList(scope, request, viewer, selected.list, atMs)), ...context };
  });
}

async function quoteFromList(
  scope: CatalogTx,
  request: PriceQuoteRequest,
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
