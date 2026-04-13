/**
 * Firestore Rules — `accounting_invoice_counters` collection
 *
 * Pattern: deny_all (Pattern E — server-only via Admin SDK).
 *
 * Rule: `allow read, write: if false` — no client access whatsoever.
 * Invoice counters contain internal sequencing data (auto-increment counters
 * for invoice number generation). They are read and incremented exclusively
 * by the Admin SDK server-side; no client persona can access them.
 *
 * All (persona × operation) cells produce deny with `server_only` reason.
 * The test verifies that even super_admin is blocked (no `isSuperAdminOnly()`
 * short-circuit exists — the rule is a blanket false).
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_invoice_counters',
)!;

describe('accounting_invoice_counters.rules — deny_all (Pattern E)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'counter-same-tenant';

        // No seeder: even seeding via privileged context is pointless since no
        // reads will succeed. For create cells we just attempt the create.
        // For read/update/delete cells we attempt against a non-existent doc —
        // the `if false` rule fires before the doc existence check matters.
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;

        const target: AssertTarget = {
          collection: 'accounting_invoice_counters',
          docId,
          data: { seq: 1 },
          createData: {
            seq: 1,
            companyId: SAME_TENANT_COMPANY_ID,
            createdBy: personaClaims?.uid ?? 'anon-uid',
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
