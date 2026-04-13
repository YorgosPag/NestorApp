/**
 * Firestore Rules — `accounting_journal_entries` collection
 *
 * Pattern: role_dual — identical rule shape to `accounting_invoices`.
 * Reads via `canReadAccounting` (super_admin + internal users of same tenant);
 * creates via `canCreateAccounting` (companyId match + createdBy==uid);
 * updates via `canUpdateAccounting` (uid==createdBy OR isCompanyAdminOfCompany,
 * companyId immutable); deletes via `canDeleteAccounting`.
 *
 * Same test design as `accounting-invoices.rules.test.ts`:
 *   - Seed doc: createdBy = PERSONA_CLAIMS.same_tenant_user.uid
 *   - Per-persona createData: companyId fixed to SAME_TENANT_COMPANY_ID,
 *     createdBy = persona's own uid
 *
 * See ADR-298 §4 Phase B.2 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase B.2)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import {
  assertCell,
  type AssertTarget,
} from '../_harness/assertions';
import { seedAccountingJournalEntry } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_journal_entries',
)!;

describe('accounting_journal_entries.rules — role_dual (ΚΦΔ Q3/Q4)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'journal-same-tenant';

        // Seed with same_tenant_user as createdBy so the uid==createdBy update/delete
        // leg is exercised for the same_tenant_user persona.
        await seedAccountingJournalEntry(env, docId);

        const ctx = getContext(env, cell.persona);

        // Per-persona createData: companyId fixed to SAME_TENANT_COMPANY_ID,
        // createdBy = persona's own uid (satisfies `createdBy == request.auth.uid`).
        const personaClaims =
          cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const createData = {
          description: `Journal entry create-${cell.persona}`,
          debit: 200,
          credit: 200,
          companyId: SAME_TENANT_COMPANY_ID,
          createdBy: personaClaims?.uid ?? 'anon-uid',
          createdAt: new Date(),
        };

        const target: AssertTarget = {
          collection: 'accounting_journal_entries',
          docId,
          data: { updatedAt: new Date() },
          createData,
          listFilter: {
            field: 'companyId',
            op: '==',
            value: SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
