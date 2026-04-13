/**
 * Firestore Rules — `country_security_policies` collection
 *
 * Pattern: system_global — `isAuthenticated()` read, `allow write: if false`.
 * Country-level security restrictions — any authed user may read.
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedCountrySecurityPolicy } from '../_harness/seed-helpers-system';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'country_security_policies',
)!;

describe('country_security_policies.rules — system_global (isAuthenticated read, write=false)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'country-policy-gr';
        await seedCountrySecurityPolicy(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'country_security_policies',
          docId,
          data: { riskLevel: 'medium' },
          createData: { countryCode: 'DE', riskLevel: 'low', allowSignup: true },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
