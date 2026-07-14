/**
 * Firestore Rules — `floorplan_grid_guides` collection (ADR-657 / ADR-441)
 *
 * ADR-657 AUTHORING-tier canary for the `'guides'` create-key variant
 * (`hasAll(['companyId','projectId','floorplanId','guides'])`). The construction
 * grid is a drafting aid edited only inside /dxf/viewer, so `external_user` is
 * denied ALL FIVE ops (read/list too — the hole ADR-657 closed).
 *   read   — canReadBimAuthoring(companyId) = isInternalUserOfCompany(companyId)
 *   create — canCreateBimEntity(['companyId','projectId','floorplanId','guides'])
 *   update — canUpdateBimEntity()   delete — canDeleteBimEntity()
 *
 * Graduated from FIRESTORE_RULES_PENDING (ADR-657, 2026-07-15).
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedBimEntity } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floorplan_grid_guides',
)!;

const DOC_ID = 'grid-same-tenant';
const PROJECT_ID = 'proj-test';
const FLOORPLAN_ID = 'floorplan-test';

describe('floorplan_grid_guides.rules — AUTHORING tier (ADR-657)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedBimEntity(env, 'floorplan_grid_guides', DOC_ID, {
          overrides: { guides: [] },
        });
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'floorplan_grid_guides',
          docId: DOC_ID,
          data: {
            updatedAt: Date.now(),
            companyId: SAME_TENANT_COMPANY_ID,
            projectId: PROJECT_ID,
            floorplanId: FLOORPLAN_ID,
            createdBy: PERSONA_CLAIMS.same_tenant_user.uid,
          },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            projectId: PROJECT_ID,
            floorplanId: FLOORPLAN_ID,
            guides: [],
            createdBy: uid,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
