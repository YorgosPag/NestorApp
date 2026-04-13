/**
 * Firestore Rules — `accounting_audit_log` collection
 *
 * Pattern: role_dual with immutable overrides (Q7 ΚΦΔ compliance).
 *
 * Rule shape (firestore.rules:3099-3107):
 *   - read:   `canReadAccounting(companyId)` = `isSuperAdminOnly() || isInternalUserOfCompany`
 *   - create: `canCreateAccountingSystem()` (companyId match, no createdBy field)
 *             AND `userId is string && userId == request.auth.uid`
 *   - update: `if false`  ← Q7: 100% immutable
 *   - delete: `if false`  ← Q7: 100% immutable
 *
 * Key differences from `accounting_invoices`:
 *   1. Create uses `canCreateAccountingSystem()` — no `createdBy` field required.
 *      Instead the rule validates `userId == request.auth.uid`.
 *      createData uses `userId: persona.uid` (not `createdBy`).
 *   2. Update and delete are `if false` for every persona (immutable override).
 *      The matrix reflects this: all update/delete cells are `deny (immutable)`.
 *
 * Create isolation semantics are identical to `accounting_invoices`:
 *   - companyId always targets SAME_TENANT_COMPANY_ID (cross-tenant isolation test)
 *   - userId set to persona's own uid (satisfies `userId == request.auth.uid`)
 *   - super_admin (company-root) fails companyId check → deny (cross_tenant)
 *   - cross_tenant_admin (company-b) fails companyId check → deny (cross_tenant)
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
import { seedAccountingAuditLog } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_audit_log',
)!;

describe('accounting_audit_log.rules — role_dual + immutable (Q7 ΚΦΔ compliance)', () => {
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
        const docId = 'audit-log-same-tenant';

        // Audit log: createdBy is NOT required by canCreateAccountingSystem.
        // The seed only needs companyId for the read/list/update/delete tests.
        await seedAccountingAuditLog(env, docId);

        const ctx = getContext(env, cell.persona);

        // Per-persona createData: companyId fixed to SAME_TENANT_COMPANY_ID,
        // userId = persona's own uid (satisfies `userId == request.auth.uid`).
        // Note: `createdBy` is NOT included — canCreateAccountingSystem does not
        // require it, and the rule does not validate it on create.
        const personaClaims =
          cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const createData = {
          action: 'created',
          entityType: 'invoice',
          entityId: `inv-create-${cell.persona}`,
          userId: personaClaims?.uid ?? 'anon-uid',
          timestamp: new Date(),
          companyId: SAME_TENANT_COMPANY_ID,
          createdAt: new Date(),
        };

        const target: AssertTarget = {
          collection: 'accounting_audit_log',
          docId,
          // update/delete payloads are irrelevant (rule is `if false`),
          // but a non-empty data object prevents assertCell from using the
          // placeholder fallback.
          data: { touchedAt: new Date() },
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
