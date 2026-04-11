/**
 * Firestore Rules — `files` collection
 *
 * Pattern: tenant_direct. Files are the most-hit storage-backed collection;
 * tests exercise full CRUD with companyId-gated list queries.
 *
 * Migrated from `tests/firestore-rules/pr-1a-files.test.ts` (2026-01-29).
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
import { seedFile } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'files',
)!;

describe('files.rules — tenant_direct pattern', () => {
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
        const docId = 'file-same-tenant';
        await seedFile(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'files',
          docId,
          data: {
            fileName: 'mutated.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            status: 'ready',
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
