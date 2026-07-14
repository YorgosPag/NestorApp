/**
 * Firestore Rules — `floorplan_walls` collection (ADR-657)
 *
 * ADR-657 PRESENTATION-tier canary. Walls are read client-side on /properties
 * (ADR-370) via `useFloorplanBimEntities`, so the crucial assertion is
 * `external_user × read = ALLOW` — the client's default self-registration role
 * must keep rendering the published plan. Writes stay internal-user-only.
 *   read   — canReadBimPresentation(companyId) = isSuperAdminOnly() || belongsToCompany
 *   create — canCreateBimEntity(['companyId','projectId','floorplanId','kind','params'])
 *   update — canUpdateBimEntity()   delete — canDeleteBimEntity()
 *
 * @since 2026-07-15 (ADR-657)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedBimEntity } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floorplan_walls',
)!;

const DOC_ID = 'wall-same-tenant';
const PROJECT_ID = 'proj-test';
const FLOORPLAN_ID = 'floorplan-test';

describe('floorplan_walls.rules — PRESENTATION tier (ADR-657)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedBimEntity(env, 'floorplan_walls', DOC_ID, {
          overrides: { kind: 'wall', params: {} },
        });
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'floorplan_walls',
          docId: DOC_ID,
          // Update echoes every immutable bimImmutablesUnchanged() pins; createdAt
          // is omitted so the merge keeps the seeded value (a fresh Date would
          // change it and deny every allowed writer).
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
            kind: 'wall',
            params: {},
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
