/**
 * Firestore Rules — `project_floorplans` collection
 *
 * Pattern: tenant_direct (crmDirectMatrix) — companyId tenant isolation,
 * no `isSuperAdminOnly()` on create (→ super_admin denied), full CRUD for
 * same-tenant members via companyId (create) and createdBy match (update/delete).
 *
 * Seed doc: createdBy = same_tenant_user.uid so the `createdBy==uid`
 * update/delete leg is exercised for same_tenant_user.
 *
 * See ADR-298 §4 Phase C.2 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.2)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedProjectFloorplan } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'project_floorplans',
)!;

describe('project_floorplans.rules — tenant_direct (crmDirectMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'floorplan-same-tenant';
        await seedProjectFloorplan(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'project_floorplans',
          docId,
          data: { updatedAt: new Date() },
          createData: {
            name: 'New Project Floorplan',
            projectId: 'project-new',
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
