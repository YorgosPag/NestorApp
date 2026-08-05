/**
 * Firestore Rules — `title_block_bindings` collection (ADR-745 Φ3β)
 *
 * Pattern: tenant-gated on every operation; approver-bound create; **company-wide**
 * update; super-admin-only delete.
 *
 * Seed doc: companyId=SAME_TENANT_COMPANY_ID, confirmedBy=same_tenant_user.uid.
 *
 * Two deviations from `contact_links` — this suite exists mainly to pin them:
 *   - `same_tenant_admin × update → ALLOW`. A binding is COMPANY knowledge, and the
 *     only update is `status → 'superseded'`, i.e. a colleague correcting someone
 *     else's mis-click. contact_links denies that, and ADR-745 §9.1 records the
 *     creator-check as a documented weakness rather than a pattern to copy.
 *   - `delete` is super_admin only. Provenance is superseded, never erased —
 *     otherwise the database can no longer explain why it once said something else.
 *
 * 🔴 Three shapes of green-but-worthless test are avoided ON PURPOSE, each one
 * already paid for inside this same ADR:
 *   1. The seeder emits EXACTLY what `titleBlockBindingConverter` emits (§9.1(ε):
 *      a seeder writing a field production never writes = coverage of a dead twin).
 *   2. `listFilter` is the PRODUCTION query shape from `listTitleBlockBindings`,
 *      not a convenient one (§9.5.3: a list test must send the same query the app
 *      sends, because rules are not filters).
 *   3. The unfiltered-list test asks for something the FILTER would happily serve
 *      and the RULE must refuse (§9.4 M8: a correctly scoped query proves the
 *      filter, not the guard).
 *
 * @since 2026-08-05 (ADR-745 Φ3β)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedTitleBlockBinding } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'title_block_bindings',
)!;

const docId = 'tbb-test-001';

describe('title-block-bindings.rules — tenant-gated + approver-bound create', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedTitleBlockBinding(env, docId);
        const ctx = getContext(env, cell.persona);

        // `confirmedBy == request.auth.uid` is part of the CREATE gate, so the
        // payload must carry the ACTING persona's uid — otherwise the whole
        // create column would pass or fail for the wrong reason.
        const actingUid = cell.persona !== 'anonymous'
          ? PERSONA_CLAIMS[cell.persona].uid
          : 'anon-uid';

        await assertCell(ctx, cell, {
          collection: 'title_block_bindings',
          docId,
          // The only update the service performs. `confirmedBy` is deliberately
          // absent: it is immutable, and repeating it would hide that.
          data: { status: 'superseded' },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            projectId: 'project-new',
            fileRecordId: 'file-new',
            levelId: 'level-new',
            fieldKey: 'designers',
            slot: 'slot-new',
            status: 'active',
            confirmedBy: actingUid,
            confirmedAt: new Date(),
          },
          // Production shape — `listTitleBlockBindings`: companyId first, then the
          // drawing, then status.
          listFilter: [
            { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
            { field: 'fileRecordId', op: '==', value: `file-${docId}` },
            { field: 'levelId', op: '==', value: `level-${docId}` },
            { field: 'status', op: '==', value: 'active' },
          ],
        });
      });
    });
  }
});

/**
 * Cells the persona × operation matrix cannot express: they vary the PAYLOAD, not
 * the caller. Each pins a clause that would otherwise have no witness.
 */
describe('title-block-bindings.rules — payload-level gates', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const validCreate = (uid: string, companyId: string) => ({
    companyId,
    projectId: 'project-payload',
    fileRecordId: 'file-payload',
    levelId: 'level-payload',
    fieldKey: 'employer',
    slot: 'slot-payload',
    status: 'active',
    confirmedBy: uid,
    confirmedAt: new Date(),
  });

  it('allows an approver to create within their own tenant', async () => {
    // The positive witness. Without it, a deny-everything rule would make every
    // negative test below green for the wrong reason.
    const ctx = getContext(env, 'same_tenant_user');
    await assertSucceeds(
      ctx.firestore().collection('title_block_bindings').doc('tbb-happy').set(
        validCreate(PERSONA_CLAIMS.same_tenant_user.uid, SAME_TENANT_COMPANY_ID),
      ),
    );
  });

  it('denies create with a forged confirmedBy — provenance cannot name someone else', async () => {
    // The whole point of the collection: a binding that misnames its approver is
    // worse than no binding, because it LOOKS like evidence.
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('title_block_bindings').doc('tbb-forged').set(
        validCreate(PERSONA_CLAIMS.same_tenant_admin.uid, SAME_TENANT_COMPANY_ID),
      ),
    );
  });

  it('denies create carrying another tenant companyId', async () => {
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('title_block_bindings').doc('tbb-wrong-tenant').set(
        validCreate(PERSONA_CLAIMS.same_tenant_user.uid, CROSS_TENANT_COMPANY_ID),
      ),
    );
  });

  it('denies rewriting confirmedBy on update — history cannot be reassigned', async () => {
    // This is what REPLACES the creator-check that contact_links puts on update.
    // Dropping the creator-check without this clause would let anyone in the
    // company claim a colleague approved a binding.
    await seedTitleBlockBinding(env, docId);
    const ctx = getContext(env, 'same_tenant_admin');
    await assertFails(
      ctx.firestore().collection('title_block_bindings').doc(docId).update({
        confirmedBy: PERSONA_CLAIMS.same_tenant_admin.uid,
      }),
    );
  });

  it('allows a COLLEAGUE to supersede — the deliberate divergence, pinned', async () => {
    // same_tenant_admin is not the approver. Under the contact_links rule this
    // would be denied and a wrong binding would stay active forever.
    await seedTitleBlockBinding(env, docId);
    const ctx = getContext(env, 'same_tenant_admin');
    await assertSucceeds(
      ctx.firestore().collection('title_block_bindings').doc(docId).update({
        status: 'superseded',
      }),
    );
  });

  it('denies an update that moves the binding to another tenant', async () => {
    await seedTitleBlockBinding(env, docId);
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('title_block_bindings').doc(docId).update({
        companyId: CROSS_TENANT_COMPANY_ID,
      }),
    );
  });

  it('🔑 point read of a NON-EXISTENT id succeeds — the write path depends on it', async () => {
    // ADR-745 §9.4, measured the hard way: the service opens with a point read of
    // the deterministic id it is ABOUT to write. Without the `resource == null`
    // leg that read raises `Null value error` → permission-denied → the collection
    // sits at 0 documents forever while every other test stays green.
    const ctx = getContext(env, 'same_tenant_user');
    await assertSucceeds(
      ctx.firestore().collection('title_block_bindings').doc('tbb-does-not-exist').get(),
    );
  });

  it('🔑 denies a list that does not constrain companyId — the FILTER would have served it', async () => {
    // §9.4 M8 inverted: a query already scoped to company-a proves the filter, not
    // the guard. This one asks for exactly what the rule must refuse.
    await seedTitleBlockBinding(env, docId);
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('title_block_bindings')
        .where('status', '==', 'active')
        .get(),
    );
  });

  it('🔑 denies deleting provenance — superseded, never erased', async () => {
    // The approver themself cannot delete. contact_links allows this; here it is
    // the difference between a record and a rumour.
    await seedTitleBlockBinding(env, docId);
    const ctx = getContext(env, 'same_tenant_user');
    await assertFails(
      ctx.firestore().collection('title_block_bindings').doc(docId).delete(),
    );
  });
});
