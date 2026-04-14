/**
 * Firestore Rules — `photo_shares` collection
 *
 * Pattern: custom (photoSharesMatrix) — CRM contact photo share history.
 *
 * Key behaviors:
 *   - read: `isAuthenticated() && (isSuperAdminOnly || belongsToCompany)`
 *   - create: `isAuthenticated() && hasAll(['companyId', 'createdBy', 'contactId'])
 *     && (isSuperAdminOnly || companyId==getUserCompanyId())`
 *   - update: `if false` — immutable records
 *   - delete: `isSuperAdminOnly()` — super admin only
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.3)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedPhotoShare } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'photo_shares',
)!;

describe('photo_shares.rules — custom (photoSharesMatrix, super-only delete)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'photo-same-tenant';
        await seedPhotoShare(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'photo_shares',
          docId,
          data: { viewedAt: new Date() },  // will be denied (update: if false)
          createData: {
            photoUrl: `https://example.com/photo-new.jpg`,
            contactId: 'contact-new',
            companyId: SAME_TENANT_COMPANY_ID,
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
