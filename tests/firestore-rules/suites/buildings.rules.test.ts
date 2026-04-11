/**
 * Firestore Rules — `buildings` collection
 *
 * Pattern: tenant_direct with seedDependency on `projects` — a building
 * carries its own `companyId` but many tests also exercise the legacy
 * fallback path which relies on the parent project for tenant resolution.
 *
 * Migrated from `tests/firestore-rules/pr-1a-buildings.test.ts` (2026-01-29).
 * See ADR-298 §3.3.
 *
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedBuilding, seedProject } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'buildings',
)!;

describe('buildings.rules — tenant_direct pattern (with project seedDependency)', () => {
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
        const projectId = 'project-building-parent';
        const buildingId = 'building-same-tenant';

        await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedBuilding(env, buildingId, projectId, {
          companyId: SAME_TENANT_COMPANY_ID,
        });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'buildings',
          docId: buildingId,
          data: {
            name: 'Mutated Building',
            projectId,
            companyId: SAME_TENANT_COMPANY_ID,
          },
          listFilter: {
            field: 'companyId',
            op: '==',
            value:
              cell.persona.startsWith('cross_tenant')
                ? CROSS_TENANT_COMPANY_ID
                : SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
