/**
 * Firestore Rules — `floorplan_stairs` collection (ADR-657 / ADR-358)
 *
 * ADR-657 PRESENTATION-tier canary for the `kind+params` create variant, plus a
 * hardening block for the G24 soft-lock anti-spoof (ADR-358 §6.8): a client may
 * only stamp `editingBy.userId` with its OWN uid.
 *   read   — canReadBimPresentation(companyId)
 *   create — canCreateBimEntity(['companyId','projectId','floorplanId','kind','params'])
 *   update — canUpdateBimEntity() (isBimWriter + immutables + bimSoftLockValid())
 *   delete — canDeleteBimEntity()
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
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floorplan_stairs',
)!;

const DOC_ID = 'stair-same-tenant';
const PROJECT_ID = 'proj-test';
const FLOORPLAN_ID = 'floorplan-test';

describe('floorplan_stairs.rules — PRESENTATION tier (ADR-657)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedBimEntity(env, 'floorplan_stairs', DOC_ID, {
          overrides: { kind: 'straight', params: {} },
        });
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'floorplan_stairs',
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
            kind: 'straight',
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

describe('floorplan_stairs.rules — G24 soft-lock hardening (ADR-657/358)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  /** Update the owned fixture as `same_tenant_user`, stamping `editingBy.userId`. */
  async function seedAndStampSoftLock(editingByUserId: string) {
    await seedBimEntity(env, 'floorplan_stairs', DOC_ID, {
      overrides: { kind: 'straight', params: {} },
    });
    return getContext(env, 'same_tenant_user')
      .firestore()
      .collection('floorplan_stairs')
      .doc(DOC_ID)
      .update({
        companyId: SAME_TENANT_COMPANY_ID,
        projectId: PROJECT_ID,
        floorplanId: FLOORPLAN_ID,
        createdBy: PERSONA_CLAIMS.same_tenant_user.uid,
        updatedAt: Date.now(),
        editingBy: { userId: editingByUserId },
      });
  }

  it('allows a soft-lock stamped with the caller uid', async () => {
    await assertSucceeds(seedAndStampSoftLock(PERSONA_CLAIMS.same_tenant_user.uid));
  });

  it('rejects a soft-lock spoofing another user (bimSoftLockValid)', async () => {
    await assertFails(seedAndStampSoftLock(PERSONA_CLAIMS.same_tenant_admin.uid));
  });
});
