/**
 * Firestore Rules — `accounting_matching_rules` collection
 *
 * Pattern: role_dual — identical rule shape to `accounting_invoices`.
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedAccountingMatchingRule } from '../_harness/seed-helpers-accounting';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_matching_rules',
)!;

describe('accounting_matching_rules.rules — role_dual', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'matching-rule-same-tenant';
        await seedAccountingMatchingRule(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const target: AssertTarget = {
          collection: 'accounting_matching_rules',
          docId,
          data: { updatedAt: new Date() },
          createData: {
            description: 'Test Rule',
            pattern: 'contains',
            keyword: 'test',
            companyId: SAME_TENANT_COMPANY_ID,
            createdBy: personaClaims?.uid ?? 'anon-uid',
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
