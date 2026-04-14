/**
 * Storage Rules — Temporary uploads
 *
 * Pattern: owner_based_no_superadmin
 *
 * Path: /temp/{userId}/{fileName}
 *
 * Rules:
 *   read, write: `isOwner(userId) && isValidFileSize()`
 *   delete:      `isOwner(userId)`
 *
 * Key contracts verified:
 *   - `same_tenant_user` is the FILE OWNER (uid == path userId) → allow all
 *   - `super_admin` → deny all (NO isSuperAdmin bypass — isOwner uid mismatch)
 *   - `same_tenant_admin` → deny all (not owner)
 *   - `anonymous` → deny all
 *
 * CAVEAT — `isValidFileSize()` on read operations:
 *   The rule `allow read, write: if isOwner(userId) && isValidFileSize()`
 *   combines read and write in a single condition that includes
 *   `isValidFileSize()`, which accesses `request.resource.size`. For read
 *   operations in Firebase Storage Rules, `request.resource` is null —
 *   accessing `.size` on null may cause a rule evaluation error → deny.
 *   If `same_tenant_user × read` fails in the emulator, this indicates a
 *   latent bug in storage.rules line 261. Update the matrix cell outcome to
 *   `deny` with reason `missing_claim` (rule bug) and file a fix to split the
 *   combined `allow read, write` into separate rules.
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

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'temp')!;

/**
 * The path userId MUST match `PERSONA_CLAIMS.same_tenant_user.uid` so that
 * `same_tenant_user` acts as the owner in these tests.
 */
const OWNER_UID = OWNER_USER_UID; // 'persona-same-user'
const FILE_NAME = 'temp-upload.bin';

const TEST_PATH = `temp/${OWNER_UID}/${FILE_NAME}`;

describe('temp-uploads.storage — owner_based_no_superadmin pattern', () => {
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
        // Seed a file for read/delete tests to distinguish permission denies
        // from object-not-found errors.
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
