/**
 * Firestore Rules — `voice_commands` collection
 *
 * Pattern: voiceCommandsMatrix — userId-owned read-only; all writes server-only.
 *
 * Seed doc: userId=same_tenant_user.uid.
 *   - same_tenant_user × read/list → allow (userId==auth.uid)
 *   - all other × read/list       → deny (userId mismatch or not authenticated)
 *   - all × write                 → deny (if false — Admin SDK only)
 *
 * This differs from notificationsMatrix in that even the OWNER cannot
 * update or delete — the voice command lifecycle is fully server-managed
 * (create via API route, status updates via pipeline dispatcher).
 *
 * List contract: filter `where('userId', '==', same_tenant_user.uid)`.
 *   Same-tenant-user's auth.uid == filter value → allow.
 *   All others: auth.uid ≠ filter value → deny.
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedVoiceCommand } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'voice_commands',
)!;

describe('voice-commands.rules — userId-owned read-only, all writes server-only', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'voice-cmd-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedVoiceCommand(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'voice_commands',
          docId,
          data: { status: 'completed' },
          createData: {
            userId: PERSONA_CLAIMS.same_tenant_user.uid,
            transcript: 'New voice command',
            status: 'processing',
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
