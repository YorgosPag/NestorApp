/**
 * Firestore Rules — `text_custom_dictionary` collection (ADR-344 Phase 8)
 *
 * Pattern: tenant_admin_write — reads open to any tenant member; writes
 * restricted to company_admin / super_admin. companyId is immutable on
 * update. Defense-in-depth — the canonical writer is the Next.js API route
 * `/api/dxf/custom-dictionary` (Admin SDK + audit + Zod).
 *
 * Same rule shape as `text_templates` (Phase 7.E) and `company_fonts`
 * (Phase 6.F). Matrix reuses `textTemplateMatrix()` from
 * `coverage-matrices-dxf.ts`.
 *
 * @since 2026-05-12 (ADR-344 Phase 8)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedCustomDictionaryEntry } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'text_custom_dictionary',
)!;

describe('text_custom_dictionary.rules — tenant_admin_write (ADR-344 Phase 8)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'dict-same-tenant';
        await seedCustomDictionaryEntry(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'text_custom_dictionary',
          docId,
          data: {
            term: 'updated-term',
            updatedAt: new Date(),
            companyId: SAME_TENANT_COMPANY_ID,
          },
          createData: {
            id: 'dict-create-test',
            term: 'κουφώματα-PVC',
            language: 'el',
            companyId: SAME_TENANT_COMPANY_ID,
            createdBy: uid,
            createdByName: 'Test User',
            updatedBy: uid,
            updatedByName: 'Test User',
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
      const docId = 'dict-immutable-admin';
      await seedCustomDictionaryEntry(env, docId);
      const ctx = getContext(env, 'same_tenant_admin');
      const target: AssertTarget = {
        collection: 'text_custom_dictionary',
        docId,
        data: {
          term: 'updated-term',
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
      const docId = 'dict-immutable-super';
      await seedCustomDictionaryEntry(env, docId);
      const ctx = getContext(env, 'super_admin');
      const target: AssertTarget = {
        collection: 'text_custom_dictionary',
        docId,
        data: {
          term: 'updated-term',
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
