/**
 * Firestore Rules — `boq_categories` collection
 *
 * Pattern: read-only (boqCategoriesMatrix) — writes denied for all personas via
 * `allow create, update, delete: if false`. Reads are tenant-scoped; system-default
 * categories without a `companyId` field are readable by all authenticated users.
 *
 * Seeded doc carries companyId = SAME_TENANT_COMPANY_ID so the cross-tenant read
 * denial path is exercised.
 *
 * See ADR-298 §4 Phase C.4 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.4)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedBoqCategory } from '../_harness/seed-helpers-boq';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'boq_categories',
)!;

describe('boq_categories.rules — read-only (boqCategoriesMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'boq-cat-same-tenant';
        await seedBoqCategory(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'boq_categories',
          docId,
          data: { name: 'Updated Category', updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            categoryCode: 'CAT-NEW',
            name: 'New Category',
            createdBy: uid,
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
