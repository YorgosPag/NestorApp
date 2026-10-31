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
 * - 🔑 **Διαδοχή περιόδων (Σ7, SAP VK11)**: νέα περίοδος που αρχίζει μέσα σε προηγούμενη την **οριοθετεί** στην ίδια
 *   συναλλαγή (`planConditionSupersession` — το σχέδιο που ο πελάτης ήδη έδειξε)· ό,τι θα ήθελε σβήσιμο ή σπάσιμο μένει 422.
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
import {
  conditionSlotPlan,
  readPricingSlot,
  stageSlotMember,
  stageSlotRelease,
  withDelimitedMembers,
  type PricingSlot,
} from './pricing-slots.server';

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

interface DelimitedCondition {
  readonly current: StoredCondition;
  readonly validUntil: string;
}

/**
 * Σ7: το σχέδιο διαδοχής της υποδοχής — ασάφεια ⇒ 422· οι οριοθετούμενες διαβάζονται **εδώ**, πριν από κάθε εγγραφή
 * (Firestore: όλες οι αναγνώσεις πρώτα) και **μέσα** στη συναλλαγή, άρα ταυτόχρονη αλλαγή τους ξανατρέχει τη συναλλαγή.
 */
async function planSlot(scope: CatalogTx, slot: PricingSlot, holderId: string, definition: DiscountConditionDefinition) {
  const plan = conditionSlotPlan(slot, holderId, definition);
  assertNoIssues(plan.issues);
  const delimited: DelimitedCondition[] = [];
  for (const { id, validUntil } of plan.delimitations) {
    delimited.push({ current: await readOwned<DiscountConditionDefinition>(scope, 'discountCondition', id), validUntil });
  }
  return { delimited, slot: withDelimitedMembers(slot, plan.delimitations) };
}

/** Η προηγούμενη περίοδος λήγει εκεί που αρχίζει η νέα — νέα αναθεώρηση της ΙΔΙΑΣ εγγραφής, με το ίχνος της. */
function stageDelimitations(scope: CatalogTx, delimited: readonly DelimitedCondition[]): void {
  for (const { current, validUntil } of delimited) {
    stageReplace(scope, 'discountCondition', current, { ...definitionOf(current), validUntil });
  }
}

/** `requestedId`: το προ-γεννημένο id του πελάτη (αισιόδοξη οθόνη) — ελέγχεται, ποτέ δεν εμπιστεύεται (Γ5). */
export async function createDiscountCondition(
  ctx: AuthContext,
  definition: DiscountConditionDefinition,
  requestedId: string | null = null,
): Promise<StoredCondition> {
  return runCatalogTransaction(ctx, async (scope) => {
    await assertConditionValid(scope, definition);
    const target = await readForRandomCreate(scope, 'discountCondition', requestedId);
    const planned = await planSlot(scope, await readPricingSlot(scope, conditionSlotKey(definition)), target.id, definition);
    const stored = stageCreate(scope, 'discountCondition', target, definitionOf(definition));
    stageDelimitations(scope, planned.delimited);
    stageSlotMember(scope, planned.slot, memberOf(stored.id, definition));
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
    const after = await planSlot(scope, await readPricingSlot(scope, conditionSlotKey(definition)), id, definition);
    const stored = stageReplace(scope, 'discountCondition', current, definitionOf(definition));
    stageDelimitations(scope, after.delimited);
    if (before.id !== after.slot.id) stageSlotRelease(scope, before, id);
    stageSlotMember(scope, after.slot, memberOf(id, definition));
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
