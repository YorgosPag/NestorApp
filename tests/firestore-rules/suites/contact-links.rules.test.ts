/**
 * Firestore Rules — `contact_links` collection
 *
 * Pattern: tenant-gated on every operation; creator-bound create.
 *
 * Seed doc: companyId=SAME_TENANT_COMPANY_ID, createdBy=same_tenant_user.uid.
 *   - same_tenant_admin × read/list  → allow (companyId ONLY — not the creator,
 *     which is exactly what proves the old `createdBy` fallback is gone)
 *   - cross_tenant_admin × create    → deny (was ALLOW before ADR-745)
 *   - same_tenant_user × update/del  → allow (creator + same tenant)
 *
 * 🔴 What this suite got wrong before 2026-08-01 (ADR-745 Q2), kept here because
 * the shape of the mistake is more useful than the fix:
 *   1. The seeder wrote `companyId`; production never did. Every read/list cell
 *      passed through a rule leg no real document could reach.
 *   2. `listFilter` was a bare `where('companyId','==',…)` — a query shape that
 *      exists nowhere in the app. Production filters by companyId + target/source
 *      + status (see `contact-link.service.ts:listContactLinks`), and per the
 *      harness contract (assertions.ts) a list test must send the SAME query the
 *      production client sends, because rules are not filters.
 *   3. The matrix asserted `cross_tenant_admin × create → allow` with the comment
 *      "no companyId check" — encoding the hole as expected behaviour. A green
 *      test can lock a gap open just as easily as it can catch one.
 *
 * See ADR-745 §4 G6/G7 · ADR-298 §4 Phase C.7 (original suite, 2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 * @updated 2026-08-01 (ADR-745 — real tenant isolation)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedContactLink } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'contact_links',
)!;

const docId = 'contact-link-test-001';

describe('contact-links.rules — tenant-gated + creator-bound create', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedContactLink(env, docId);
        const ctx = getContext(env, cell.persona);

        // `createdBy == request.auth.uid` is part of the CREATE gate, so the
        // payload has to carry the ACTING persona's uid. A single shared
        // `createdBy` would deny the personas that must be allowed and would
        // make the whole create column pass or fail for the wrong reason.
        const actingUid = cell.persona !== 'anonymous'
          ? PERSONA_CLAIMS[cell.persona].uid
          : 'anon-uid';

        await assertCell(ctx, cell, {
          collection: 'contact_links',
          docId,
          data: { status: 'inactive', updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            sourceContactId: 'contact-src-new',
            targetEntityType: 'project',
            targetEntityId: 'project-new',
            status: 'active',
            createdBy: actingUid,
            createdAt: new Date(),
          },
          // The production query shape — companyId + target + status.
          listFilter: [
            { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
            { field: 'targetEntityType', op: '==', value: 'project' },
            { field: 'targetEntityId', op: '==', value: `project-${docId}` },
            { field: 'status', op: '==', value: 'active' },
          ],
        });
      });
    });
  }
});

/**
 * Cells the persona × operation matrix cannot express: they vary the PAYLOAD,
 * not the caller. Each one pins a specific clause of the rule that would
 * otherwise have no witness.
 */
describe('contact-links.rules — payload-level gates', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const validCreate = (uid: string, companyId: string) => ({
    companyId,
    sourceContactId: 'contact-src-payload',
    targetEntityType: 'project',
    targetEntityId: 'project-payload',
    status: 'active',
    createdBy: uid,
    createdAt: new Date(),
  });

  it('denies create with a forged createdBy (no impersonation)', async () => {
    // Pins `createdBy == request.auth.uid`. Without it a user could plant a link
    // attributed to someone else — and `contact_links` feeds RBAC.
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('contact_links').doc('cl-forged').set(
        validCreate(PERSONA_CLAIMS.same_tenant_admin.uid, SAME_TENANT_COMPANY_ID),
      ),
    );
  });

  it('denies create carrying another tenant companyId', async () => {
    // Pins `companyId == getUserCompanyId()`.
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('contact_links').doc('cl-wrong-tenant').set(
        validCreate(PERSONA_CLAIMS.same_tenant_user.uid, CROSS_TENANT_COMPANY_ID),
      ),
    );
  });

  it('allows the creator to create within their own tenant', async () => {
    // Guards against a rule so tight nothing passes — a deny-everything rule
    // would make every negative test above green for the wrong reason.
    const ctx = getContext(env, 'same_tenant_user');
    await assertSucceeds(
      ctx.firestore().collection('contact_links').doc('cl-happy').set(
        validCreate(PERSONA_CLAIMS.same_tenant_user.uid, SAME_TENANT_COMPANY_ID),
      ),
    );
  });

  it('denies an update that moves the link to another tenant', async () => {
    // Pins companyId immutability on update.
    await seedContactLink(env, docId);
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('contact_links').doc(docId).update({
        companyId: CROSS_TENANT_COMPANY_ID,
      }),
    );
  });

  it('denies a list query that does not constrain companyId', async () => {
    // Rules are not filters: the production client MUST pin the tenant down.
    // This is the regression witness for anyone tempted to drop the filter
    // from `listContactLinks` because "the rule already checks it".
    await seedContactLink(env, docId);
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('contact_links')
        .where('status', '==', 'active')
        .get(),
    );
  });
});
