/**
 * Firestore Rules — `floorplan_symbols` collection (ADR-657 / ADR-415)
 *
 * ADR-657 AUTHORING-tier canary for the `'category+kind+params'` create-key
 * variant — the 2D floorplan symbol library is category-driven, so its
 * `hasAll()` carries an extra `category` key. Symbols are drafting content
 * edited inside /dxf/viewer, so `external_user` is denied ALL FIVE ops.
 *   read   — canReadBimAuthoring(companyId) = isInternalUserOfCompany(companyId)
 *   create — canCreateBimEntity(['companyId','projectId','floorplanId','category','kind','params'])
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
  (c) => c.collection === 'floorplan_symbols',
)!;

const DOC_ID = 'symbol-same-tenant';
const PROJECT_ID = 'proj-test';
const FLOORPLAN_ID = 'floorplan-test';

describe('floorplan_symbols.rules — AUTHORING tier (ADR-657)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedBimEntity(env, 'floorplan_symbols', DOC_ID, {
          overrides: { category: 'furniture', kind: 'chair', params: {} },
        });
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'floorplan_symbols',
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
            category: 'furniture',
            kind: 'chair',
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
