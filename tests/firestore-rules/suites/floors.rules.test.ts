/**
 * Firestore Rules — `floors` collection
 *
 * Pattern: admin_write_only — reads are tenant-scoped via buildingId crossdoc
 * lookup (belongsToBuildingCompany). All client writes deny (Admin SDK only).
 * seedDependencies: projects → buildings → floors.
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
import { seedProject, seedBuilding, seedFloor } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floors',
)!;

describe('floors.rules — admin_write_only pattern (crossdoc via buildingId)', () => {
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
        const projectId = 'project-floor-parent';
        const buildingId = 'building-floor-parent';
        const floorId = 'floor-same-tenant';

        await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedBuilding(env, buildingId, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedFloor(env, floorId, buildingId);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'floors',
          docId: floorId,
          data: {
            name: 'Mutated Floor',
            buildingId,
          },
          createData: {
            name: 'Created Floor',
            buildingId,
            level: 1,
          },
          listFilter: {
            field: 'buildingId',
            op: '==',
            value: buildingId,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
