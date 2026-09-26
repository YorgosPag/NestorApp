/**
 * Firestore Rules — `system` collection
 *
 * Pattern: system_global (admin variant) — `isAuthenticated() && isCompanyAdmin()`
 * read, `allow write: if false`.
 *
 * Key: `isCompanyAdmin()` is role-only (no tenant gate) — both `same_tenant_admin`
 * AND `cross_tenant_admin` (both have role=company_admin) can read. `same_tenant_user`
 * (role=internal_user) denied (insufficient_role).
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, expectAllow, expectDeny, type AssertTarget } from '../_harness/assertions';
import { seedSystem, seedSystemDoc } from '../_harness/seed-helpers-system';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'system',
)!;

describe('system.rules — system_global admin variant (isCompanyAdmin read, write=false)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'system-settings';
        await seedSystem(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'system',
          docId,
          data: { type: 'updated' },
          createData: { type: 'new-settings' },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});

/**
 * ESCO taxonomy exception (2026-09-26) — `system/esco_cache/{occupations,skills}`
 * is public EU reference data: every authenticated persona reads it, nobody
 * writes it from the client, and the exception does NOT leak to sibling
 * `system/*` subcollections.
 */
describe('system.rules — ESCO taxonomy read exception', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const READERS = ['same_tenant_user', 'external_user', 'cross_tenant_admin'] as const;
  const ESCO_PATHS = ['system/esco_cache/occupations', 'system/esco_cache/skills'] as const;

  for (const path of ESCO_PATHS) {
    for (const persona of READERS) {
      it(`${persona} can read + list ${path}`, async () => {
        await seedSystemDoc(env, `${path}/esco-1`);
        const db = getContext(env, persona).firestore();
        await expectAllow(db.doc(`${path}/esco-1`).get());
        await expectAllow(db.collection(path).get());
      });
    }

    it(`anonymous cannot read ${path}`, async () => {
      await seedSystemDoc(env, `${path}/esco-1`);
      await expectDeny(getContext(env, 'anonymous').firestore().doc(`${path}/esco-1`).get());
    });

    it(`same_tenant_admin cannot write ${path}`, async () => {
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(db.doc(`${path}/esco-2`).set({ label: 'x' }));
    });
  }

  it('same_tenant_user still cannot read other system subcollections', async () => {
    await seedSystemDoc(env, 'system/esco_cache/other/doc-1');
    await seedSystemDoc(env, 'system/routing/occupations/doc-1');
    const db = getContext(env, 'same_tenant_user').firestore();
    await expectDeny(db.doc('system/esco_cache/other/doc-1').get());
    await expectDeny(db.doc('system/routing/occupations/doc-1').get());
  });
});
