/**
 * Firestore Rules — `conversations` collection
 *
 * Pattern: tenant_direct (crmDirectMatrix shape).
 * Reads are tenant-scoped via direct companyId field.
 * Create requires isValidConversationData (channel + status enum) and
 * companyId == getUserCompanyId() with no isSuperAdminOnly short-circuit
 * — super_admin denied on create (cross_tenant reason).
 * Update/delete allow for: creator (createdBy==uid), company admin, or
 * super_admin. Update also requires isValidConversationData on merged doc.
 *
 * Update target.data uses { status: 'archived' } — a valid enum change that
 * preserves `channel` from the seed doc in the merged result so that
 * isValidConversationData(request.resource.data) passes for same_tenant_admin
 * and same_tenant_user.
 *
 * See ADR-298 §4 Phase B.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase B.5)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedConversation } from '../_harness/seed-helpers-messaging';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'conversations',
)!;

describe('conversations.rules — tenant_direct (crmDirectMatrix, enum-validated)', () => {
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
        const convId = 'conv-same-tenant';

        await seedConversation(env, convId);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'conversations',
          docId: convId,
          // Update data: valid enum change. Merged doc retains `channel: 'email'`
          // from seed, so isValidConversationData passes on request.resource.data.
          data: {
            status: 'archived',
          },
          // Create data: satisfies isValidConversationData + companyId gate.
          // Same-tenant personas (companyId='company-a') are allowed; super_admin
          // ('company-root') and cross_tenant_admin ('company-b') are denied.
          createData: {
            channel: 'email',
            status: 'active',
            companyId: SAME_TENANT_COMPANY_ID,
          },
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
