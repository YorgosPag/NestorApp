/**
 * Firestore Rules — `company_fonts` collection (ADR-344 Phase 6 / Phase 6.F)
 *
 * Pattern: tenant_admin_write — identical rule shape to `text_templates`.
 * Reads open to any tenant member; writes restricted to company_admin /
 * super_admin. companyId is immutable on update.
 *
 * Graduated from FIRESTORE_RULES_PENDING in Phase 6.F (2026-05-11).
 * Matrix reuses `textTemplateMatrix()` from coverage-matrices-dxf.ts.
 *
 * @since 2026-05-11 (ADR-344 Phase 6.F)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedCompanyFont } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'company_fonts',
)!;

describe('company_fonts.rules — tenant_admin_write (ADR-344 Phase 6)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'font-same-tenant';
        await seedCompanyFont(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'company_fonts',
          docId,
          data: {
            name: 'Updated Font',
            updatedAt: new Date(),
            companyId: SAME_TENANT_COMPANY_ID,
          },
          createData: {
            id: 'font-create-test',
            name: 'New Font',
            fileName: 'new-font.ttf',
            fileSize: 204800,
            mimeType: 'font/ttf',
            storageUrl: 'gs://bucket/company_fonts/new-font.ttf',
            companyId: SAME_TENANT_COMPANY_ID,
            createdBy: uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }

  describe('companyId immutability', () => {
    it('company_admin: update with changed companyId → deny', async () => {
      const docId = 'font-immutable-admin';
      await seedCompanyFont(env, docId);
      const ctx = getContext(env, 'same_tenant_admin');
      const target: AssertTarget = {
        collection: 'company_fonts',
        docId,
        data: {
          name: 'Updated',
          updatedAt: new Date(),
          companyId: 'company-b',
        },
        listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
      };
      await assertCell(
        ctx,
        { persona: 'same_tenant_admin', operation: 'update', outcome: 'deny', reason: 'immutable' },
        target,
      );
    });

    it('super_admin: update with changed companyId → deny', async () => {
      const docId = 'font-immutable-super';
      await seedCompanyFont(env, docId);
      const ctx = getContext(env, 'super_admin');
      const target: AssertTarget = {
        collection: 'company_fonts',
        docId,
        data: {
          name: 'Updated',
          updatedAt: new Date(),
          companyId: 'company-different',
        },
        listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
      };
      await assertCell(
        ctx,
        { persona: 'super_admin', operation: 'update', outcome: 'deny', reason: 'immutable' },
        target,
      );
    });
  });
});
