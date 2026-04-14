/**
 * Firestore Rules — `user_2fa_settings` collection
 *
 * Pattern: ownership — `allow read, write: if isOwner(userId)`.
 *
 * Seed doc: docId = PERSONA_CLAIMS.same_tenant_user.uid ('persona-same-user').
 *   - same_tenant_user × get/update/delete → allow (uid == docId)
 *   - all others × all ops → deny (uid mismatch or not authenticated)
 *   - list → deny for all (path-var rule, unrestricted queries denied)
 *   - create → deny for all (harness fresh docId != any uid)
 *
 * Own-uid create regression block verifies the real use case
 * (user creates with their own uid as docId).
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, expectAllow, type AssertTarget } from '../_harness/assertions';
import { seedUser2faSettings } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'user_2fa_settings',
)!;

describe('user_2fa_settings.rules — pure ownership (ownerOnlyMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = PERSONA_CLAIMS.same_tenant_user.uid;

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedUser2faSettings(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'user_2fa_settings',
          docId,
          data: { enabled: true, updatedAt: new Date() },
          createData: {
            enabled: false,
            backupCodes: [],
            createdAt: new Date(),
          },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }

  // ── Own-uid create regression ─────────────────────────────────────────────
  // isOwner(userId) allows `request.auth.uid == userId` for creates when the
  // caller uses their own uid as docId. Harness cannot exercise this via the
  // matrix loop (fresh docId). This block validates the canonical use case.
  describe('own-uid create regression', () => {
    it('same_tenant_user × create own uid doc → allow', async () => {
      const ctx = getContext(env, 'same_tenant_user');
      const ownDocRef = ctx.firestore()
        .collection('user_2fa_settings')
        .doc(PERSONA_CLAIMS.same_tenant_user.uid);
      await expectAllow(ownDocRef.set({
        enabled: false,
        backupCodes: [],
        createdAt: new Date(),
      }));
    });
  });
});
