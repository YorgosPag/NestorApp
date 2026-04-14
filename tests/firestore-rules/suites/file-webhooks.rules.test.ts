/**
 * Firestore Rules — `file_webhooks` collection
 *
 * Pattern: deny_all — `allow read, write: if false`.
 * No client access at all — managed exclusively via Firebase Admin SDK.
 *
 * Reuses `denyAllMatrix()` from coverage-matrices-accounting (same shape
 * as `accounting_invoice_counters`).
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.3)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'file_webhooks',
)!;

describe('file_webhooks.rules — deny_all (no client access)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'webhook-doc';
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'file_webhooks',
          docId,
          data: { url: 'https://example.com/webhook' },
          createData: {
            url: 'https://example.com/new-webhook',
            companyId: SAME_TENANT_COMPANY_ID,
            events: ['file.uploaded'],
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
