/**
 * Storage Rules — canonical enterprise path (with projectId)
 *
 * Pattern: company_scoped_with_project
 *
 * Path: /companies/{companyId}/projects/{projectId}/entities/{entityType}/
 *       {entityId}/domains/{domain}/categories/{category}/files/{fileName}
 *
 * Rule: read requires `isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())`
 *       write requires `(belongsToCompany(companyId) || isSuperAdmin()) && isValidFileSize() && isAllowedContentType()`
 *       delete requires `belongsToCompany(companyId) || isSuperAdmin()`
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
  (c) => c.pathId === 'canonical_with_project',
)!;

/**
 * Concrete file path matching the rule's match pattern.
 * Uses fixed test values for all path segments — only companyId and
 * cross-tenant detection matter for these tests.
 */
const COMPANY_ID = SAME_TENANT_COMPANY_ID;
const PROJECT_ID = 'proj-test-001';
const ENTITY_TYPE = 'property';
const ENTITY_ID = 'ent-test-001';
const DOMAIN = 'documents';
const CATEGORY = 'contracts';
const FILE_NAME = 'test-document.pdf';

const TEST_PATH =
  `companies/${COMPANY_ID}/projects/${PROJECT_ID}` +
  `/entities/${ENTITY_TYPE}/${ENTITY_ID}` +
  `/domains/${DOMAIN}/categories/${CATEGORY}/files/${FILE_NAME}`;

describe('canonical-path-with-project.storage — company_scoped_with_project pattern', () => {
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
        // `getMetadata()` and `delete()` both return `object-not-found`
        // instead of `unauthorized`, making deny tests pass for the wrong reason.
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
