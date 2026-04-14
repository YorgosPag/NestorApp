/**
 * Firestore Rules — `contact_links` collection
 *
 * Pattern: creator ownership — same shape as contact_relationships.
 * Creator + super_admin update/delete; any authenticated can create;
 * reads are tenant-scoped via companyId.
 *
 * Seed doc: companyId=SAME_TENANT_COMPANY_ID, createdBy=same_tenant_user.uid.
 *   - same_tenant_user × update/delete → allow (createdBy==uid)
 *   - super_admin × update/delete      → allow (isSuperAdminOnly)
 *   - same_tenant_admin × update/delete → deny (not creator, not super_admin)
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedContactLink } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'contact_links',
)!;

describe('contact-links.rules — creator ownership + open create', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'contact-link-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedContactLink(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'contact_links',
          docId,
          data: { status: 'inactive', updatedAt: new Date() },
          createData: {
            sourceContactId: 'contact-src-new',
            status: 'active',
            createdBy: 'system',
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        });
      });
    });
  }
});
