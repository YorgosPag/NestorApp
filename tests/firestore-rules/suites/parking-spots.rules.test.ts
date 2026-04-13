/**
 * Firestore Rules — `parking_spots` collection
 *
 * Pattern: admin_write_only — reads are tenant-scoped via buildingId crossdoc
 * lookup (belongsToBuildingCompany). All client writes deny (Admin SDK only).
 * Parallel category to properties; building → [units | storage | parking].
 * seedDependencies: projects → buildings → parking_spots.
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
import { seedProject, seedBuilding, seedParkingSpot } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'parking_spots',
)!;

describe('parking_spots.rules — admin_write_only pattern (crossdoc via buildingId)', () => {
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
        const projectId = 'project-parking-parent';
        const buildingId = 'building-parking-parent';
        const spotId = 'parking-spot-same-tenant';

        await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedBuilding(env, buildingId, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedParkingSpot(env, spotId, buildingId);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'parking_spots',
          docId: spotId,
          data: {
            name: 'Mutated Parking Spot',
            buildingId,
          },
          createData: {
            name: 'Created Parking Spot',
            buildingId,
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
