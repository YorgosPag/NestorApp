/**
 * Firestore Rules — `properties` collection
 *
 * Pattern: admin_write_only with admin-update delta.
 * Reads are tenant-scoped via `project` crossdoc (belongsToProjectCompany).
 * Create/delete deny for all clients (Admin SDK only).
 * Update is allowed for super_admin (isSuperAdminOnly bypass) and for company
 * admins of the project's company (isCompanyAdminOfProject + isAllowedPropertyFieldUpdate
 * + propertyStructuralFieldsUnchanged). Regular users cannot update.
 *
 * seedDependencies: projects → properties.
 * Update test data uses only allowed fields (description, updatedAt) so that
 * same_tenant_admin can satisfy isAllowedPropertyFieldUpdate. The seed doc
 * carries `id: propId` so that propertyStructuralFieldsUnchanged can verify
 * the invariant is preserved in the merged document.
 *
 * See ADR-298 §4 Phase B.4 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase B.4)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedProject, seedProperty } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'properties',
)!;

describe('properties.rules — admin_write_only + admin-update (crossdoc via project)', () => {
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
        const projectId = 'project-property-parent';
        const propertyId = 'property-same-tenant';

        await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedProperty(env, propertyId, projectId);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'properties',
          docId: propertyId,
          // Update data: only allowed fields (isAllowedPropertyFieldUpdate allowlist).
          // Firestore partial update preserves `project` and `id` from the seed doc
          // so propertyStructuralFieldsUnchanged passes for same_tenant_admin.
          data: {
            description: 'Updated property description',
          },
          createData: {
            project: projectId,
            name: 'Created Property',
          },
          listFilter: {
            field: 'project',
            op: '==',
            value: projectId,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
