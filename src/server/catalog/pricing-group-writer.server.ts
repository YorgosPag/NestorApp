import 'server-only';

/**
 * Ο **γραφέας ομάδων τιμολόγησης** (ADR-923 §5.11 «3β») — ομάδα έκπτωσης SKU («TOSH-CARR», DATANORM
 * Rabattgruppe) **και** ομάδα πελάτη («χονδρέμπορος», SAP ομάδα τιμής πελάτη). Ίδιο σχήμα (`code` + `labels`),
 * ίδιοι κανόνες ⇒ **ένας** γραφέας με το είδος ως παράμετρο, όχι δύο δίδυμοι (CHECK 3.28).
 *
 * Διαφέρουν **μόνο** στο «ποιος τη χρησιμοποιεί;» — η διαγραφή αρνείται (`inUse`) όσο κάτι δείχνει σε αυτή:
 *   - ομάδα έκπτωσης ← γραμμές (οποιασδήποτε έκδοσης) · συνθήκες·
 *   - ομάδα πελάτη ← αναθέσεις · κοινό συνθήκης · κοινό λίστας.
 * @module server/catalog/pricing-group-writer.server
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import type { AuthContext } from '@/lib/auth';
import type { CustomerGroupDefinition, DiscountGroupDefinition } from '@/subapps/catalog/types/price-list';
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
import { customerGroupInUse, discountGroupInUse } from './pricing-usage-reads.server';

/** Τα δύο είδη ομάδας — κλειστό σύνολο· νέο είδος χωρίς ερώτηση χρήσης σπάει τη μεταγλώττιση. */
export type PricingGroupKind = 'discountGroup' | 'customerGroup';

/** Το κοινό σχήμα — ο τύπος κάθε είδους είναι **ταυτόσημος** (επιβεβαιώνεται εδώ, στη μεταγλώττιση). */
type PricingGroupDefinition = DiscountGroupDefinition & CustomerGroupDefinition;

const IN_USE: Readonly<Record<PricingGroupKind, (scope: CatalogTx, id: string) => Promise<boolean>>> = {
  discountGroup: discountGroupInUse,
  customerGroup: customerGroupInUse,
};

type StoredGroup = StoredCatalogRecord<PricingGroupDefinition>;

function assertLabelled(definition: PricingGroupDefinition): void {
  assertNoIssues(hasAnyLocalizedText(definition.labels) ? [] : [{ code: 'labelRequired', path: 'labels' }]);
}

export async function createPricingGroup(ctx: AuthContext, kind: PricingGroupKind, definition: PricingGroupDefinition): Promise<StoredGroup> {
  assertLabelled(definition);
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, kind, definition.code);
    return stageCreate(scope, kind, target, { code: definition.code, labels: definition.labels });
  });
}

export async function updatePricingGroup(
  ctx: AuthContext,
  kind: PricingGroupKind,
  id: string,
  expectedRevision: number,
  definition: PricingGroupDefinition,
): Promise<StoredGroup> {
  assertLabelled(definition);
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<PricingGroupDefinition>(scope, kind, id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, definition.code);
    return stageReplace(scope, kind, current, { code: definition.code, labels: definition.labels });
  });
}

export async function deletePricingGroup(ctx: AuthContext, kind: PricingGroupKind, id: string, expectedRevision: number): Promise<StoredGroup> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<PricingGroupDefinition>(scope, kind, id);
    assertRevision(current, expectedRevision);
    if (await IN_USE[kind](scope, id)) throw new CatalogWriteError('inUse');
    return stageSoftDelete(scope, kind, current);
  });
}
