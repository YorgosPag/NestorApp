/**
 * Firestore Rules — `users` collection
 *
 * Pattern: ownership — uid==userId || belongsToCompany read; uid==userId || companyAdmin write.
 *
 * Seed doc: docId = PERSONA_CLAIMS.same_tenant_user.uid ('persona-same-user').
 *   - same_tenant_user × read/update → allow (uid == docId)
 *   - same_tenant_admin × read/update → allow (belongsToCompany / isCompanyAdminOfCompany)
 *   - super_admin × read/update → allow (isSuperAdminOnly + isCompanyAdminOfCompany)
 *   - cross_tenant_admin × all → deny (different company, no uid match)
 *
 * Create note: harness uses fresh docId — same_tenant_user cannot create arbitrary
 * docs (not a company admin, uid != fresh docId → deny). super_admin and
 * same_tenant_admin pass via isCompanyAdminOfCompany.
 *
 * Delete: allow delete: if false — user docs are never client-deleted.
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, expectAllow, type AssertTarget } from '../_harness/assertions';
import { seedUser } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'users',
)!;

describe('users.rules — uid-ownership + companyAdmin write (usersMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  // Seed docId = same_tenant_user.uid so uid==userId paths are exercised
  const docId = PERSONA_CLAIMS.same_tenant_user.uid;

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedUser(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'users',
          docId,
          data: { displayName: 'Updated User', updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            displayName: 'New User',
            email: 'new-user@test.com',
            globalRole: 'internal_user',
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }

  // ── Own-profile signup regression ────────────────────────────────────────
  // The create rule has an `uid == userId` leg that the matrix loop cannot
  // exercise (harness always generates a fresh docId). This block verifies
  // same_tenant_user CAN create their own profile doc (docId == their uid).
  describe('own-profile signup regression', () => {
    it('same_tenant_user × create own uid doc → allow', async () => {
      const ctx = getContext(env, 'same_tenant_user');
      const ownDocRef = ctx.firestore()
        .collection('users')
        .doc(PERSONA_CLAIMS.same_tenant_user.uid);
      await expectAllow(ownDocRef.set({
        companyId: SAME_TENANT_COMPANY_ID,
        displayName: 'Own Profile',
        email: 'own@test.com',
        globalRole: 'internal_user',
        createdAt: new Date(),
      }));
    });
  });
});
