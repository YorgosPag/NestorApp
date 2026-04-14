/**
 * Firestore Rules — `cad_files` collection
 *
 * Pattern: custom (cadFilesMatrix) — permissive authenticated writes with
 * tenant-scoped reads and deletes.
 *
 * Key behavior:
 *   - create/update: `isAuthenticated() + fileName` — NO companyId gate.
 *     Any authenticated user (including cross_tenant_admin) can write.
 *   - read/list/delete: `isSuperAdminOnly || (companyId && belongsToCompany)
 *     || (!companyId && createdBy==uid)` — tenant-scoped.
 *
 * Seed doc: companyId = SAME_TENANT_COMPANY_ID + fileName present.
 * createData: includes fileName (required field) + companyId for cross_tenant
 * verification of the no-gate write rule.
 *
 * See ADR-298 §4 Phase C.2 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.2)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedCadFile } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'cad_files',
)!;

describe('cad_files.rules — custom (cadFilesMatrix, permissive authenticated write)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'cad-same-tenant';
        await seedCadFile(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'cad_files',
          docId,
          // update: change a metadata field (not fileName — must still be present via merge)
          data: { updatedAt: new Date() },
          // create: only fileName required — companyId advisory
          createData: {
            fileName: 'new-scene.dxf',
            fileSize: 2048,
            companyId: SAME_TENANT_COMPANY_ID,
            createdBy: uid,
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
