/**
 * Firestore Rules — `counters` collection
 *
 * Pattern: counters — `allow read, write: if isAuthenticated()`. Any authenticated
 * user (including cross_tenant) can read and write auto-increment counter documents.
 * No tenant isolation — counters are shared sequence generators (project codes, etc.).
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedCounter } from '../_harness/seed-helpers-system';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'counters',
)!;

describe('counters.rules — counters (isAuthenticated read+write)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'counter-projects';
        await seedCounter(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'counters',
          docId,
          data: { count: 1 },
          createData: { count: 0, prefix: 'NEW' },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
