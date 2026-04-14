/**
 * Firestore Rules — `notifications` collection
 *
 * Pattern: userId-owned read+update; create/delete are server-only.
 *
 * Seed doc: userId=same_tenant_user.uid.
 *   - same_tenant_user × read/list → allow (userId==auth.uid)
 *   - all other × read/list → deny (userId mismatch)
 *   - all × create → deny (if false — server-only)
 *   - same_tenant_user × update → allow (userId==auth.uid + isValidNotificationUpdate)
 *   - all other × update → deny (userId mismatch)
 *   - all × delete → deny (if false — server-only)
 *
 * List contract: filter `where('userId', '==', same_tenant_user.uid)`.
 *   Firestore's query-predicate verification passes for owner (auth.uid==filter
 *   value) and fails for all others (their auth.uid ≠ 'persona-same-user').
 *
 * Update contract: must pass isValidNotificationUpdate — only allowed fields:
 *   delivery, seenAt, actedAt, actionId, dismissedAt.
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedNotification } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'notifications',
)!;

describe('notifications.rules — userId-owned read+update, server-only create/delete', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'notification-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedNotification(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'notifications',
          docId,
          // Update: only allowedFields (delivery, seenAt, actedAt, actionId, dismissedAt)
          data: { seenAt: new Date() },
          createData: {
            userId: PERSONA_CLAIMS.same_tenant_user.uid,
            title: 'New notification',
            message: 'New message',
            type: 'info',
          },
          listFilter: {
            field: 'userId',
            op: '==',
            value: PERSONA_CLAIMS.same_tenant_user.uid,
          },
        });
      });
    });
  }
});
