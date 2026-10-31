import 'server-only';

/**
 * Ο **γραφέας κανόνων ορατότητας** (ADR-923 §12 · §5.12 Δ1): ένας κανόνας ανά (αντικείμενο, κοινό). Η ταυτότητα του
 * εγγράφου **είναι** αυτό το ζεύγος, άρα δεύτερος ίδιος κανόνας = `duplicateCode`, δομικά, και η κρίση δεν βρίσκει ποτέ
 * δύο απαντήσεις για το ίδιο κελί. Αλλαγή απάντησης = ενημέρωση του ίδιου κανόνα· αντικείμενο και κοινό δεν αλλάζουν
 * ποτέ, θα ήταν άλλος κανόνας.
 * @module server/catalog/visibility-rule-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { audienceIdentity } from '@/subapps/catalog/pricing/price-audience';
import { visibilityRuleKey, visibilitySubjectKey } from '@/subapps/catalog/pricing/visibility';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CustomerGroupDefinition } from '@/subapps/catalog/types/price-list';
import type { VisibilityRuleDefinition, VisibilitySubject } from '@/subapps/catalog/types/visibility-rule';
import type { CatalogKind } from './catalog-kinds';
import { readActiveByIds } from './catalog-library-reads.server';
import {
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
import { audiencePartyIssues } from './pricing-party-reads.server';

type StoredRule = StoredCatalogRecord<VisibilityRuleDefinition>;

/** Το είδος και το id του αντικειμένου· `null` για τον κατάλογο, που δεν είναι εγγραφή. */
function subjectRecord(subject: VisibilitySubject): { readonly kind: CatalogKind; readonly id: string } | null {
  switch (subject.kind) {
    case 'catalog':
      return null;
    case 'category':
      return { kind: 'category', id: subject.categoryId };
    case 'productModel':
      return { kind: 'productModel', id: subject.modelId };
    case 'variant':
      return { kind: 'product', id: subject.variantId };
  }
}

async function subjectIssues(scope: CatalogTx, subject: VisibilitySubject): Promise<readonly CatalogIssue[]> {
  const record = subjectRecord(subject);
  if (record === null) return [];
  const found = await readActiveByIds<object>(scope, record.kind, [record.id]);
  return found.has(record.id) ? [] : [{ code: 'unknownReference', path: 'subject' }];
}

async function assertRuleValid(scope: CatalogTx, definition: VisibilityRuleDefinition): Promise<void> {
  const { audience } = definition;
  const groupIds = audience.kind === 'customerGroup' ? [audience.customerGroupId] : [];
  const groups = await readActiveByIds<CustomerGroupDefinition>(scope, 'customerGroup', groupIds);
  const groupIssues: readonly CatalogIssue[] = groups.size === groupIds.length ? [] : [{ code: 'unknownReference', path: 'audience.customerGroupId' }];
  assertNoIssues([...groupIssues, ...(await audiencePartyIssues(scope, audience, 'audience')), ...(await subjectIssues(scope, definition.subject))]);
}

/** Μόνο τα πεδία του ορισμού: ποτέ ό,τι άλλο κουβαλά το σώμα. */
const definitionOf = (definition: VisibilityRuleDefinition): VisibilityRuleDefinition => ({
  subject: definition.subject,
  audience: definition.audience,
  visibility: definition.visibility,
});

const sameCell = (a: VisibilityRuleDefinition, b: VisibilityRuleDefinition): boolean =>
  visibilitySubjectKey(a.subject) === visibilitySubjectKey(b.subject) && audienceIdentity(a.audience) === audienceIdentity(b.audience);

export async function createVisibilityRule(ctx: AuthContext, definition: VisibilityRuleDefinition): Promise<StoredRule> {
  return runCatalogTransaction(ctx, async (scope) => {
    await assertRuleValid(scope, definition);
    const target = await readForCreate(scope, 'visibilityRule', visibilityRuleKey(definition));
    return stageCreate(scope, 'visibilityRule', target, definitionOf(definition));
  });
}

export async function updateVisibilityRule(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: VisibilityRuleDefinition,
): Promise<StoredRule> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<VisibilityRuleDefinition>(scope, 'visibilityRule', id);
    assertRevision(current, expectedRevision);
    if (!sameCell(current, definition)) throw new CatalogWriteError('immutable', [{ code: 'codeImmutable', path: 'subject' }]);
    return stageReplace(scope, 'visibilityRule', current, definitionOf(definition));
  });
}

export async function deleteVisibilityRule(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredRule> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<VisibilityRuleDefinition>(scope, 'visibilityRule', id);
    assertRevision(current, expectedRevision);
    return stageSoftDelete(scope, 'visibilityRule', current);
  });
}
