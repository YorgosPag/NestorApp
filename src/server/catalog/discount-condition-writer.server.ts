import 'server-only';

/**
 * Ο **γραφέας συνθηκών έκπτωσης** (ADR-923 §5.11 «3β») — ομάδα έκπτωσης (ή `*`) × κοινό × ισχύς × κανόνας.
 * Οι συνθήκες είναι **ανά χώρο** (SAP: η συνθήκη δεν ανήκει σε τιμοκατάλογο) και αφορούν κάθε λίστα `net_list`.
 *
 * - Επικύρωση με την **ίδια** συνάρτηση του πελάτη (`validateDiscountCondition`), με αναφορές **μέσα** στη συναλλαγή.
 * - 🔑 **Ασάφεια = σφάλμα αποθήκευσης**, και μάλιστα **υπό ταυτοχρονισμό**: η υποδοχή `(ομάδα, κοινό)` διαβάζεται
 *   στη συναλλαγή, άρα δύο ταυτόχρονες επικαλυπτόμενες συνθήκες συγκρούονται — η δεύτερη ξανατρέχει, βλέπει
 *   την πρώτη και παίρνει 422 `discountConditionAmbiguous`.
 * - Αλλαγή ομάδας ή κοινού = **μετακόμιση** σε άλλη υποδοχή (αποδέσμευση + δέσμευση στην ίδια συναλλαγή).
 * @module server/catalog/discount-condition-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { conditionSlotKey } from '@/subapps/catalog/pricing/pricing-keys';
import { validateDiscountCondition } from '@/subapps/catalog/schema/validate-pricing';
import type {
  CustomerGroupDefinition,
  DiscountConditionDefinition,
  DiscountGroupDefinition,
} from '@/subapps/catalog/types/price-list';
import { readActiveByIds } from './catalog-library-reads.server';
import {
  assertRevision,
  readForRandomCreate,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues } from './catalog-write-error';
import { audiencePartyIssues } from './pricing-party-reads.server';
import { conditionSlotIssues, readPricingSlot, stageSlotMember, stageSlotRelease } from './pricing-slots.server';

type StoredCondition = StoredCatalogRecord<DiscountConditionDefinition>;

async function assertConditionValid(scope: CatalogTx, definition: DiscountConditionDefinition): Promise<void> {
  const discountGroups = await readActiveByIds<DiscountGroupDefinition>(
    scope,
    'discountGroup',
    definition.discountGroupId === null ? [] : [definition.discountGroupId],
  );
  const customerGroups = await readActiveByIds<CustomerGroupDefinition>(
    scope,
    'customerGroup',
    definition.audience.kind === 'customerGroup' ? [definition.audience.customerGroupId] : [],
  );
  const context = { discountGroupIds: new Set(discountGroups.keys()), customerGroupIds: new Set(customerGroups.keys()) };
  const party = await audiencePartyIssues(scope, definition.audience, 'audience');
  assertNoIssues([...validateDiscountCondition(definition, context), ...party]);
}

const memberOf = (id: string, definition: DiscountConditionDefinition) => ({
  holderId: id,
  validFrom: definition.validFrom,
  validUntil: definition.validUntil,
});

/** Μόνο τα πεδία του ορισμού — ποτέ ό,τι άλλο κουβαλά το σώμα. */
const definitionOf = (definition: DiscountConditionDefinition): DiscountConditionDefinition => ({
  discountGroupId: definition.discountGroupId,
  audience: definition.audience,
  validFrom: definition.validFrom,
  validUntil: definition.validUntil,
  rule: definition.rule,
});

/** `requestedId`: το προ-γεννημένο id του πελάτη (αισιόδοξη οθόνη) — ελέγχεται, ποτέ δεν εμπιστεύεται (Γ5). */
export async function createDiscountCondition(
  ctx: AuthContext,
  definition: DiscountConditionDefinition,
  requestedId: string | null = null,
): Promise<StoredCondition> {
  return runCatalogTransaction(ctx, async (scope) => {
    await assertConditionValid(scope, definition);
    const target = await readForRandomCreate(scope, 'discountCondition', requestedId);
    const slot = await readPricingSlot(scope, conditionSlotKey(definition));
    assertNoIssues(conditionSlotIssues(slot, target.id, definition));
    const stored = stageCreate(scope, 'discountCondition', target, definitionOf(definition));
    stageSlotMember(scope, slot, memberOf(stored.id, definition));
    return stored;
  });
}

export async function updateDiscountCondition(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: DiscountConditionDefinition,
): Promise<StoredCondition> {
  return runCatalogTransaction(ctx, async (scope) => {
    await assertConditionValid(scope, definition);
    const current = await readOwned<DiscountConditionDefinition>(scope, 'discountCondition', id);
    assertRevision(current, expectedRevision);
    const before = await readPricingSlot(scope, conditionSlotKey(current));
    const after = await readPricingSlot(scope, conditionSlotKey(definition));
    assertNoIssues(conditionSlotIssues(after, id, definition));
    const stored = stageReplace(scope, 'discountCondition', current, definitionOf(definition));
    if (before.id !== after.id) stageSlotRelease(scope, before, id);
    stageSlotMember(scope, after, memberOf(id, definition));
    return stored;
  });
}

export async function deleteDiscountCondition(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredCondition> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<DiscountConditionDefinition>(scope, 'discountCondition', id);
    assertRevision(current, expectedRevision);
    const slot = await readPricingSlot(scope, conditionSlotKey(current));
    const stored = stageSoftDelete(scope, 'discountCondition', current);
    stageSlotRelease(scope, slot, id);
    return stored;
  });
}
