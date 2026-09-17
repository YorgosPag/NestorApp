/**
 * Firestore Rules — `companies` collection
 *
 * Pattern: ownership — read: isSuperAdminOnly() || getUserCompanyId() == companyId (path var).
 * Write: if false — Admin SDK only.
 *
 * Seed doc: docId = SAME_TENANT_COMPANY_ID ('company-a').
 *   - same_tenant × get → allow (getUserCompanyId() matches docId)
 *   - same_tenant × list → deny (path-var rule, unrestricted query denied)
 *   - super_admin × list → allow (isSuperAdminOnly() unconditional)
 *   - all writes → deny (server_only / cross_tenant)
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import { assertCell, expectDeny, type AssertTarget } from '../_harness/assertions';
import { seedCompany } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'companies',
)!;

describe('companies.rules — own-company read + server-only write (companiesMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // docId = SAME_TENANT_COMPANY_ID so getUserCompanyId() == companyId (path var)
        const docId = SAME_TENANT_COMPANY_ID;
        await seedCompany(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'companies',
          docId,
          data: { name: 'Updated Company', updatedAt: new Date() },
          createData: {
            name: 'New Company',
            createdAt: new Date(),
          },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});

/**
 * ADR-862 Φ0 Β14 — `companies/{W}/projects/{P}/members/{mbr_…}` είναι ΜΟΝΟ διακομιστή.
 *
 * 🔴 Το έγγραφο αποφασίζει ποιος βλέπει αρχεία CDE. Εγγραφή από πελάτη = αυτο-ένταξη σε
 * υπόθεση· ανάγνωση = απαρίθμηση ομάδας. Ούτε ο διαχειριστής του ΙΔΙΟΥ γραφείου, ούτε ο
 * super admin — ο γραφέας είναι το Admin SDK (`lib/auth/project-member-write.ts`).
 */
describe('companies.rules — projects/{P}/members: server-only (ADR-862 Φ0 Β14)', () => {
  let env: RulesTestEnvironment;
  const membersPath = `companies/${SAME_TENANT_COMPANY_ID}/projects/proj-1/members`;
  const personas = ['super_admin', 'same_tenant_admin', 'same_tenant_user'] as const;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  beforeEach(async () => {
    await withSeedContext(env, async (ctx) => {
      await ctx.firestore().doc(`${membersPath}/mbr_seed`).set({ uid: 'u-1', cdeAudience: 'design' });
    });
  });
  afterEach(async () => { await resetData(env); });

  for (const persona of personas) {
    it(`${persona} × get → deny`, async () => {
      await expectDeny(getContext(env, persona).firestore().doc(`${membersPath}/mbr_seed`).get());
    });
    it(`${persona} × list → deny`, async () => {
      await expectDeny(getContext(env, persona).firestore().collection(membersPath).get());
    });
    it(`${persona} × create (self-enrolment) → deny`, async () => {
      const ctx = getContext(env, persona);
      await expectDeny(ctx.firestore().doc(`${membersPath}/mbr_self`).set({ uid: 'u-self', cdeAudience: 'design' }));
    });
    it(`${persona} × update → deny`, async () => {
      const ctx = getContext(env, persona);
      await expectDeny(ctx.firestore().doc(`${membersPath}/mbr_seed`).update({ cdeAudience: 'client' }));
    });
    it(`${persona} × delete → deny`, async () => {
      await expectDeny(getContext(env, persona).firestore().doc(`${membersPath}/mbr_seed`).delete());
    });
  }
});
