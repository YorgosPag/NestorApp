/**
 * Firestore Rules — `accounting_invoices` collection
 *
 * Pattern: role_dual — reads follow standard accounting tenant isolation
 * (`canReadAccounting` = `isSuperAdminOnly() || isInternalUserOfCompany`);
 * writes require `canCreateAccounting()` (companyId match + createdBy==uid)
 * / `canUpdateAccounting()` (uid==createdBy OR isCompanyAdminOfCompany, companyId
 * immutable) / `canDeleteAccounting()` (uid==createdBy OR isCompanyAdminOfCompany).
 *
 * Key property: `canCreateAccounting()` has NO `isSuperAdminOnly()` short-circuit.
 * super_admin's companyId claim is 'company-root' ≠ SAME_TENANT_COMPANY_ID ('company-a'),
 * so super_admin × create is denied (cross_tenant). To exercise the `uid==createdBy`
 * update/delete leg for same_tenant_user, the seed doc carries
 * `createdBy = PERSONA_CLAIMS.same_tenant_user.uid`.
 *
 * `createData` is built per-persona inside the matrix loop:
 *   - `companyId` always targets SAME_TENANT_COMPANY_ID (tests cross-tenant isolation)
 *   - `createdBy` is set to the persona's own uid (satisfies `createdBy==uid` guard)
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
import { seedAccountingInvoice } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_invoices',
)!;

describe('accounting_invoices.rules — role_dual (ΚΦΔ Q3/Q4)', () => {
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
        const docId = 'invoice-same-tenant';

        // Seed with same_tenant_user as createdBy so the uid==createdBy update/delete
        // leg is exercised for the same_tenant_user persona.
        await seedAccountingInvoice(env, docId);

        const ctx = getContext(env, cell.persona);

        // Build persona-aware createData: companyId always targets SAME_TENANT_COMPANY_ID
        // (cross-tenant isolation test), createdBy set to persona's own uid so that
        // same-tenant personas satisfy `createdBy == request.auth.uid`.
        const personaClaims =
          cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const createData = {
          invoiceNumber: `INV-create-${cell.persona}`,
          amount: 500,
          currency: 'EUR',
          status: 'draft',
          companyId: SAME_TENANT_COMPANY_ID,
          createdBy: personaClaims?.uid ?? 'anon-uid',
          createdAt: new Date(),
        };

        const target: AssertTarget = {
          collection: 'accounting_invoices',
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
