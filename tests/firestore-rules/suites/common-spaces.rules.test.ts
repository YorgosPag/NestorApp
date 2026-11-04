/**
 * Firestore Rules — `common_spaces` collection (ADR-931)
 *
 * Pattern: admin_write_only — reads are tenant-scoped via the document's own `companyId`
 * (no crossdoc, no legacy creator fallback). All client writes deny (Admin SDK only —
 * `POST /api/common-spaces` + the space-entity route SSoT, ADR-696).
 * seedDependencies: projects → buildings → common_spaces.
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedProject, seedBuilding, seedCommonSpace } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'common_spaces',
)!;

describe('common_spaces.rules — admin_write_only pattern (companyId)', () => {
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
        const projectId = 'project-common-space-parent';
        const buildingId = 'building-common-space-parent';
        const commonSpaceId = 'common-space-same-tenant';

        await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedBuilding(env, buildingId, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedCommonSpace(env, commonSpaceId, buildingId, SAME_TENANT_COMPANY_ID);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'common_spaces',
          docId: commonSpaceId,
          data: { name: 'Mutated Common Space', buildingId },
          createData: { name: 'Created Common Space', buildingId, companyId: SAME_TENANT_COMPANY_ID },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
