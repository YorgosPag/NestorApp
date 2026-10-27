import 'server-only';

/**
 * Ο **γραφέας τιμοκαταλόγων** (ADR-923 §5.11 «3β» απόφαση Α–Β) — λεπτός πάνω στη μηχανή:
 *
 * - Επικύρωση με την **ίδια** συνάρτηση του πελάτη (`validatePriceList`) + αναφορά ομάδας πελάτη **μέσα** στη συναλλαγή.
 * - **Κοινό** (commercetools price selection): μία λίστα πώλησης ανά κοινό — η υποδοχή ασάφειας την κρατά
 *   **δομικά**, ώστε δύο ταυτόχρονες λίστες για τον «χονδρέμπορο» να συγκρούονται, όχι να συνυπάρχουν.
 * - **Είδος και τύπος τιμής κλειδώνουν** μόλις υπάρξει έκδοση: το `net_list → net_customer` θα έκανε τις ήδη
 *   δημοσιευμένες τιμές να **μην** δέχονται πια εκπτώσεις, χωρίς να αλλάξει γραμμή (`typeLockedInUse`).
 * - Κωδικός αμετάβλητος, CAS, soft delete — όπως κάθε οντότητα του καταλόγου.
 * @module server/catalog/price-list-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { priceListAudienceSlotKey } from '@/subapps/catalog/pricing/pricing-keys';
import { validatePriceList } from '@/subapps/catalog/schema/validate-pricing';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CustomerGroupDefinition, PriceListDefinition } from '@/subapps/catalog/types/price-list';
import { readActiveByIds } from './catalog-library-reads.server';
import {
  assertCodeUnchanged,
  assertRevision,
  readForCreate,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';
import { audienceSlotIssues, readPricingSlot, stageSlotMember, stageSlotRelease, type PricingSlot } from './pricing-slots.server';
import { audiencePartyIssues } from './pricing-party-reads.server';
import { priceListHasVersions } from './pricing-usage-reads.server';

type StoredPriceList = StoredCatalogRecord<PriceListDefinition>;

/** Η υποδοχή κοινού της λίστας — μόνο οι λίστες **πώλησης** με κοινό προσφέρονται (η `cost` δεν έχει κοινό). */
async function readAudienceSlot(scope: CatalogTx, definition: PriceListDefinition): Promise<PricingSlot | null> {
  return definition.kind === 'sales' && definition.audience !== null
    ? readPricingSlot(scope, priceListAudienceSlotKey(definition.audience))
    : null;
}

/** Η σημασιολογική επικύρωση, με τις ομάδες πελάτη **αυτού** του χώρου όπως είναι μέσα στη συναλλαγή. */
async function assertListValid(scope: CatalogTx, definition: PriceListDefinition): Promise<void> {
  const referenced = definition.audience?.kind === 'customerGroup' ? [definition.audience.customerGroupId] : [];
  const groups = await readActiveByIds<CustomerGroupDefinition>(scope, 'customerGroup', referenced);
  const party = await audiencePartyIssues(scope, definition.audience, 'audience');
  assertNoIssues([...validatePriceList(definition, { customerGroupIds: new Set(groups.keys()) }), ...party]);
}

/** Είδος / τύπος τιμής αλλάζουν μόνο όσο η λίστα δεν έχει καμία έκδοση. */
async function assertMeaningUnlocked(scope: CatalogTx, current: StoredPriceList, next: PriceListDefinition): Promise<void> {
  const changed: CatalogIssue[] = [];
  if (current.kind !== next.kind) changed.push({ code: 'typeLockedInUse', path: 'kind' });
  if (current.priceType !== next.priceType) changed.push({ code: 'typeLockedInUse', path: 'priceType' });
  if (changed.length > 0 && (await priceListHasVersions(scope, current.id))) throw new CatalogWriteError('immutable', changed);
}

const openMember = (holderId: string) => ({ holderId, validFrom: null, validUntil: null });

export async function createCatalogPriceList(ctx: AuthContext, definition: PriceListDefinition): Promise<StoredPriceList> {
  return runCatalogTransaction(ctx, async (scope) => {
    await assertListValid(scope, definition);
    const target = await readForCreate(scope, 'priceList', definition.code);
    const slot = await readAudienceSlot(scope, definition);
    if (slot) assertNoIssues(audienceSlotIssues(slot, target.id));
    const stored = stageCreate(scope, 'priceList', target, definition);
    if (slot) stageSlotMember(scope, slot, openMember(stored.id));
    return stored;
  });
}

export async function updateCatalogPriceList(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: PriceListDefinition,
): Promise<StoredPriceList> {
  return runCatalogTransaction(ctx, async (scope) => {
    await assertListValid(scope, definition);
    const current = await readOwned<PriceListDefinition>(scope, 'priceList', id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, definition.code);
    await assertMeaningUnlocked(scope, current, definition);
    const before = await readAudienceSlot(scope, current);
    const after = await readAudienceSlot(scope, definition);
    if (after) assertNoIssues(audienceSlotIssues(after, id));
    const stored = stageReplace(scope, 'priceList', current, definition);
    if (before && before.id !== after?.id) stageSlotRelease(scope, before, id);
    if (after) stageSlotMember(scope, after, openMember(id));
    return stored;
  });
}

export async function deleteCatalogPriceList(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredPriceList> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<PriceListDefinition>(scope, 'priceList', id);
    assertRevision(current, expectedRevision);
    const slot = await readAudienceSlot(scope, current);
    const stored = stageSoftDelete(scope, 'priceList', current);
    if (slot) stageSlotRelease(scope, slot, id);
    return stored;
  });
}
