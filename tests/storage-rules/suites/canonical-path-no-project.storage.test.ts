/**
 * Storage Rules — simplified enterprise path (no projectId)
 *
 * Pattern: company_scoped_no_project
 *
 * Path: /companies/{companyId}/entities/{entityType}/{entityId}/
 *       domains/{domain}/categories/{category}/files/{fileName}
 *
 * Rule: read requires `isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())`
 *       write requires `isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin()) && isValidFileSize()`
 *       delete requires `isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())`
 *
 * Note: write rule here adds an explicit `isAuthenticated()` check at the top
 * that the with-project variant lacks (it is implied by `belongsToCompany`).
 * Both paths deny unauthenticated writes — the explicit check is redundant
 * but not incorrect.
 *
 * See ADR-301 §3.3.
 *
 * @since 2026-04-14 (ADR-301 Phase A)
 */

import {
  initStorageEmulator,
  teardownStorageEmulator,
  resetStorageData,
} from '../_harness/emulator';
import { getStorageContext } from '../_harness/auth-contexts';
import { assertStorageCell, type AssertStorageTarget } from '../_harness/assertions';
import { seedStorageFile } from '../_harness/seed-helpers';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find(
  (c) => c.pathId === 'canonical_no_project',
)!;

/** Concrete path matching the simplified (no-project) match pattern. */
const COMPANY_ID = SAME_TENANT_COMPANY_ID;
const ENTITY_TYPE = 'contact';
const ENTITY_ID = 'ent-test-002';
const DOMAIN = 'profiles';
const CATEGORY = 'avatars';
const FILE_NAME = 'avatar.jpg';

const TEST_PATH =
  `companies/${COMPANY_ID}` +
  `/entities/${ENTITY_TYPE}/${ENTITY_ID}` +
  `/domains/${DOMAIN}/categories/${CATEGORY}/files/${FILE_NAME}`;

describe('canonical-path-no-project.storage — company_scoped_no_project pattern', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initStorageEmulator();
  });

  afterAll(async () => {
    await teardownStorageEmulator(env);
  });

  afterEach(async () => {
    await resetStorageData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // Seed a file for read/delete tests — without a pre-existing file,
        // `getMetadata()` and `delete()` return `object-not-found` instead
        // of `unauthorized`, making deny tests pass for the wrong reason.
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = { path: TEST_PATH };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }
});
