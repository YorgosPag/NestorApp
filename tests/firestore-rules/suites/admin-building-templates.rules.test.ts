/**
 * Firestore Rules — `admin_building_templates` collection
 *
 * Pattern: tenant_direct (crmDirectMatrix) — building template library.
 * No `isSuperAdminOnly()` on create → super_admin denied.
 * Legacy read fallback for !companyId docs (creator-only) does not affect
 * the canonical matrix — seed doc always carries companyId.
 *
 * See ADR-298 §4 Phase C.2 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.2)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedAdminBuildingTemplate } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'admin_building_templates',
)!;

describe('admin_building_templates.rules — tenant_direct (crmDirectMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'template-same-tenant';
        await seedAdminBuildingTemplate(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'admin_building_templates',
          docId,
          data: { updatedAt: new Date() },
          createData: {
            name: 'New Building Template',
            type: 'residential',
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
