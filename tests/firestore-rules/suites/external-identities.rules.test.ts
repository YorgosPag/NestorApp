/**
 * Firestore Rules — `external_identities` collection
 *
 * Pattern: tenant_direct (crmDirectMatrix shape).
 * Maps external platform IDs (Telegram chatId, etc.) to internal contacts.
 * Reads are tenant-scoped via direct companyId field.
 * Create requires companyId == getUserCompanyId() + resource == null with no
 * isSuperAdminOnly short-circuit — super_admin denied on create (cross_tenant).
 * Update/delete allow for: creator (createdBy==uid), company admin, or
 * super_admin. No enum validation on update (simpler than conversations).
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
import { seedExternalIdentity } from '../_harness/seed-helpers-messaging';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'external_identities',
)!;

describe('external_identities.rules — tenant_direct (crmDirectMatrix)', () => {
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
        const identityId = 'identity-same-tenant';

        await seedExternalIdentity(env, identityId);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'external_identities',
          docId: identityId,
          data: {
            externalId: 'ext-updated',
          },
          // Create data: companyId gate. Same-tenant personas allowed;
          // super_admin ('company-root') and cross_tenant_admin ('company-b') denied.
          createData: {
            platform: 'telegram',
            externalId: 'ext-new',
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
