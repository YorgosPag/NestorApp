/**
 * Firestore Rules — `text_templates` collection (ADR-344 Phase 7.B/7.E)
 *
 * Pattern: tenant_admin_write — reads open to any tenant member; writes
 * restricted to company_admin / super_admin. companyId is immutable on update.
 *
 * Graduated from FIRESTORE_RULES_PENDING in Phase 7.E (2026-05-11).
 * Same rule shape as `company_fonts` (Phase 6.E).
 *
 * @since 2026-05-11 (ADR-344 Phase 7.E)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedTextTemplate } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'text_templates',
)!;

describe('text_templates.rules — tenant_admin_write (ADR-344 Phase 7.B)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'tmpl-same-tenant';
        await seedTextTemplate(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'text_templates',
          docId,
          data: {
            name: 'Updated Template',
            updatedAt: new Date(),
            companyId: SAME_TENANT_COMPANY_ID,
          },
          createData: {
            id: 'tmpl-create-test',
            name: 'New Template',
            category: 'label',
            content: 'Hello {{name}}',
            placeholders: [{ key: 'name', label: 'Name', type: 'text' }],
            isDefault: false,
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
      const docId = 'tmpl-immutable-admin';
      await seedTextTemplate(env, docId);
      const ctx = getContext(env, 'same_tenant_admin');
      const target: AssertTarget = {
        collection: 'text_templates',
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
      const docId = 'tmpl-immutable-super';
      await seedTextTemplate(env, docId);
      const ctx = getContext(env, 'super_admin');
      const target: AssertTarget = {
        collection: 'text_templates',
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
