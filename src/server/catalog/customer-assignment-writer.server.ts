import 'server-only';

/**
 * Ο **γραφέας αναθέσεων ομάδας πελάτη** (ADR-923 §5.11 «3β» · §12) — συμβαλλόμενος → **μία** ομάδα (SAP: μία ομάδα
 * τιμής ανά πελάτη). Η ταυτότητα της ανάθεσης **είναι** ο συμβαλλόμενος (`pricingPartyKey`), άρα δεύτερη ανάθεση του
 * ίδιου = `duplicateCode`, δομικά. Αλλαγή ομάδας = ενημέρωση **της ίδιας** ανάθεσης· ο συμβαλλόμενος δεν αλλάζει
 * ποτέ (θα ήταν άλλη ανάθεση).
 *
 * Από αυτές τις εγγραφές ο διακομιστής **χτίζει** τον θεατή της τιμής (`PricingViewer`) — ποτέ από ό,τι στέλνει ο
 * πελάτης (§12 🔒).
 * @module server/catalog/customer-assignment-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { pricingPartyKey } from '@/subapps/catalog/pricing/price-audience';
import type { CustomerAssignmentDefinition, CustomerGroupDefinition, PricingPartyRef } from '@/subapps/catalog/types/price-list';
import { readActiveByIds } from './catalog-library-reads.server';
import {
  assertRevision,
  readForCreate,
  readForUpsert,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';
import { partyIssues } from './pricing-party-reads.server';

type StoredAssignment = StoredCatalogRecord<CustomerAssignmentDefinition>;

async function assertAssignmentValid(scope: CatalogTx, definition: CustomerAssignmentDefinition): Promise<void> {
  const groups = await readActiveByIds<CustomerGroupDefinition>(scope, 'customerGroup', [definition.customerGroupId]);
  const group = groups.has(definition.customerGroupId) ? [] : [{ code: 'unknownReference' as const, path: 'customerGroupId' }];
  assertNoIssues([...group, ...(await partyIssues(scope, definition.party, 'party'))]);
}

/**
 * **Κατάταξη πελάτη ως μέρος μιας πράξης του προμηθευτή** (ADR-923 §5.12 Σ2 προέγκριση): τις αναγνώσεις τις κάνει εδώ, το
 * `commit()` γράφει μετά από κάθε ανάγνωση του καλούντα. Ο συμβαλλόμενος έχει ήδη κριθεί από τον καλούντα, επειδή στην
 * έγκριση αιτήματος η σχέση ενεργοποιείται στην **ίδια** συναλλαγή. Υπάρχουσα ανάθεση αλλάζει ομάδα, ποτέ δεύτερη ανάθεση.
 */
export async function planCustomerAssignment(scope: CatalogTx, party: PricingPartyRef, customerGroupId: string): Promise<{ commit(): void }> {
  const groups = await readActiveByIds<CustomerGroupDefinition>(scope, 'customerGroup', [customerGroupId]);
  assertNoIssues(groups.has(customerGroupId) ? [] : [{ code: 'unknownReference', path: 'customerGroupId' }]);
  const { target, current } = await readForUpsert<CustomerAssignmentDefinition>(scope, 'customerAssignment', pricingPartyKey(party));
  return {
    commit: () => {
      if (current === null) stageCreate(scope, 'customerAssignment', target, { party, customerGroupId });
      else if (current.customerGroupId !== customerGroupId) stageReplace(scope, 'customerAssignment', current, { party: current.party, customerGroupId });
    },
  };
}

export async function createCustomerAssignment(ctx: AuthContext, definition: CustomerAssignmentDefinition): Promise<StoredAssignment> {
  return runCatalogTransaction(ctx, async (scope) => {
    await assertAssignmentValid(scope, definition);
    const target = await readForCreate(scope, 'customerAssignment', pricingPartyKey(definition.party));
    return stageCreate(scope, 'customerAssignment', target, { party: definition.party, customerGroupId: definition.customerGroupId });
  });
}

export async function updateCustomerAssignment(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: CustomerAssignmentDefinition,
): Promise<StoredAssignment> {
  return runCatalogTransaction(ctx, async (scope) => {
    await assertAssignmentValid(scope, definition);
    const current = await readOwned<CustomerAssignmentDefinition>(scope, 'customerAssignment', id);
    assertRevision(current, expectedRevision);
    if (pricingPartyKey(current.party) !== pricingPartyKey(definition.party)) {
      throw new CatalogWriteError('immutable', [{ code: 'codeImmutable', path: 'party' }]);
    }
    return stageReplace(scope, 'customerAssignment', current, { party: current.party, customerGroupId: definition.customerGroupId });
  });
}

export async function deleteCustomerAssignment(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredAssignment> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CustomerAssignmentDefinition>(scope, 'customerAssignment', id);
    assertRevision(current, expectedRevision);
    return stageSoftDelete(scope, 'customerAssignment', current);
  });
}
