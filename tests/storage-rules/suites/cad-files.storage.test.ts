/**
 * Storage Rules — CAD files (DXF/Technical Drawings)
 *
 * Pattern: owner_based
 *
 * Path: /cad/{userId}/{fileId}/{fileName}
 *
 * Rules:
 *   read:   `isOwner(userId) || isSuperAdmin()`
 *   write:  `isOwner(userId) && isValidFileSize()`
 *   delete: `isOwner(userId) || isSuperAdmin()`
 *
 * Key contract verified:
 *   - `same_tenant_user` acts as the FILE OWNER: uid == path userId → allow all
 *   - `super_admin` can READ and DELETE (isSuperAdmin bypass), but NOT WRITE
 *     (isOwner only on write — no super_admin bypass)
 *   - `same_tenant_admin` is authenticated and same-tenant but NOT owner →
 *     denied on all operations (CAD rules do not use companyId)
 *   - `anonymous` → denied on all operations
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
import { OWNER_USER_UID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'cad')!;

/**
 * The path userId MUST match `PERSONA_CLAIMS.same_tenant_user.uid` so that
 * `same_tenant_user` acts as the owner. All other personas are non-owners.
 */
const OWNER_UID = OWNER_USER_UID; // 'persona-same-user'
const CAD_FILE_ID = 'cad-file-test-001';
const FILE_NAME = 'building-plan.dxf';

const TEST_PATH = `cad/${OWNER_UID}/${CAD_FILE_ID}/${FILE_NAME}`;

describe('cad-files.storage — owner_based pattern', () => {
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
        // Seed a file for read/delete tests to ensure permission denies are
        // caused by the rule, not by a missing file (object-not-found).
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
