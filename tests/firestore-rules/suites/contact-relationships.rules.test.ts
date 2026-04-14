/**
 * Firestore Rules — `contact_relationships` collection
 *
 * Pattern: creator ownership — creator + super_admin update/delete; any
 * authenticated can create (no companyId gate); reads are tenant-scoped.
 *
 * Seed doc: companyId=SAME_TENANT_COMPANY_ID, createdBy=same_tenant_user.uid.
 *   - same_tenant_user × update/delete → allow (createdBy==uid)
 *   - super_admin × update/delete      → allow (isSuperAdminOnly)
 *   - same_tenant_admin × update/delete → deny (not creator, not super_admin)
 *   - same_tenant_*  × read → allow (belongsToCompany companyId)
 *   - cross_tenant   × read → deny (different companyId)
 *   - all authenticated × create → allow (no companyId gate in create rule)
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedContactRelationship } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'contact_relationships',
)!;

describe('contact-relationships.rules — creator ownership + open create', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'contact-rel-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedContactRelationship(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'contact_relationships',
          docId,
          data: { status: 'inactive', updatedAt: new Date() },
          createData: {
            sourceContactId: 'contact-src-new',
            targetContactId: 'contact-tgt-new',
            relationshipType: 'colleague',
            status: 'active',
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        });
      });
    });
  }
});
