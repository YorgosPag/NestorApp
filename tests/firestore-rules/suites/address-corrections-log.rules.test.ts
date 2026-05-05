/**
 * Firestore Rules — `address_corrections_log` collection
 *
 * Pattern: admin_write_only — reads are tenant-scoped via `belongsToCompany`
 * (any authenticated user of the correction's company can read their tenant's
 * log). Every client-side create/update/delete denies with `if false`. Writes
 * happen exclusively via Admin SDK in `address-corrections-telemetry.service`
 * (ADR-332 §3.7 Phase 9).
 *
 * Uses `adminWriteOnlyMatrix()` unchanged — same shape as buildings /
 * attendance_qr_tokens. The seeder is inlined below (single-purpose, keeps
 * `seed-helpers.ts` under the 500-line SRP cap per CLAUDE.md N.7.1).
 *
 * @since 2026-05-06 (ADR-332 Phase 9)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'address_corrections_log',
)!;

async function seedAddressCorrectionLog(
  env: RulesTestEnvironment,
  docId: string,
  companyId: string = SAME_TENANT_COMPANY_ID,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('address_corrections_log').doc(docId).set({
      companyId,
      userId: 'persona-same-user',
      contextEntityType: 'contact',
      contextEntityId: 'cont_seed_1',
      timestamp: new Date(),
      userInput: { street: 'Τσιμισκή', city: 'Θεσσαλονίκη' },
      nominatimResolved: { street: 'Τσιμισκή', city: 'Θεσσαλονίκη' },
      confidence: 0.9,
      variantUsed: 1,
      partialMatch: false,
      action: 'accepted-top',
      fieldActions: { street: 'kept' },
      durationFromInputToActionMs: 1000,
      undoOccurred: false,
      finalAddress: { street: 'Τσιμισκή', city: 'Θεσσαλονίκη' },
    });
  });
}

describe('address_corrections_log.rules — admin_write_only (tenant-scoped reads)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'acl_seed_test';
        await seedAddressCorrectionLog(env, docId);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'address_corrections_log',
          docId,
          // Every client write denies regardless of payload (allow write: if false).
          data: {
            companyId: SAME_TENANT_COMPANY_ID,
            confidence: 0.5,
          },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            userId: 'persona-other',
            contextEntityType: 'contact',
            contextEntityId: 'cont_other',
            timestamp: new Date(),
            confidence: 0.7,
            variantUsed: 1,
            partialMatch: false,
            action: 'accepted-top',
            fieldActions: {},
            durationFromInputToActionMs: 0,
            undoOccurred: false,
            userInput: {},
            nominatimResolved: {},
            finalAddress: {},
          },
          listFilter: {
            field: 'companyId',
            op: '==',
            value: SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
