/**
 * Firestore Rules — `projects` collection
 *
 * Pattern: tenant_direct (companyId lives on the document).
 * Migrated from `tests/firestore-rules/pr-1a-projects.test.ts` (2026-01-29).
 * Every test cell is driven from `coverage-manifest.ts` — see ADR-298 §3.3.
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
import { seedProject } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

/** SSoT export — CHECK 3.16 matches this against coverage-manifest.ts. */
export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'projects',
)!;

describe('projects.rules — tenant_direct pattern', () => {
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
        const docId = 'project-same-tenant';
        await seedProject(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'projects',
          docId,
          // Update payload — status must be one of the enum values in
          // isValidProjectData (firestore.rules:3169).
          data: {
            name: 'Mutated Project',
            status: 'in_progress',
            company: 'Test Company',
            companyId: SAME_TENANT_COMPANY_ID,
          },
          // Create payload — fresh-doc must satisfy isValidProjectData and
          // carry a matching companyId for same-tenant personas. Super admin
          // bypasses the companyId check via isSuperAdminOnly().
          createData: {
            name: 'Created Project',
            status: 'planning',
            company: 'Test Company',
            companyId: SAME_TENANT_COMPANY_ID,
          },
          // List query always targets the seeded bucket. Cross-tenant personas
          // get denied by the per-document read rule, which causes the list
          // itself to fail — that is the correct deny signal for list ops.
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
