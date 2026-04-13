/**
 * Firestore Rules — `bot_configs` collection
 *
 * Pattern: system_global — `isAuthenticated()` read, `allow write: if false`.
 * Bot configuration (Telegram tokens etc.) — any authed user may read,
 * writes are Admin SDK only to protect sensitive bot tokens.
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedBotConfig } from '../_harness/seed-helpers-system';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'bot_configs',
)!;

describe('bot_configs.rules — system_global (isAuthenticated read, write=false)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'bot-telegram';
        await seedBotConfig(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'bot_configs',
          docId,
          data: { active: false },
          createData: { botType: 'slack', active: true },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
