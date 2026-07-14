/**
 * Firestore Rules — `floorplan_topo_surfaces` collection (ADR-650)
 *
 * Pattern: creator-or-admin writes on a company-scoped, per-floor doc.
 *   read   — isSuperAdminOnly() || belongsToCompany(companyId)
 *   create — companyId == claim && createdBy == uid && hasAll(scope keys)
 *   update — (createdBy == uid || isCompanyAdminOfCompany) && immutables preserved
 *   delete — createdBy == uid || isCompanyAdminOfCompany
 *
 * The fixture is owned by `same_tenant_user` (see `seedFloorplanTopoSurface`),
 * which is what separates the owner row from the `external_user` row — same
 * tenant, but not the creator and not an admin.
 *
 * @since 2026-07-14 (ADR-650 — topo persistence)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedFloorplanTopoSurface } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  isAuthenticatedPersona,
  type Persona,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { assertFails } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floorplan_topo_surfaces',
)!;

const DOC_ID = 'topo-same-tenant';
const PROJECT_ID = 'proj-test';
const FLOORPLAN_ID = 'floorplan-test';

/**
 * The create rule demands `createdBy == request.auth.uid`, so the payload has to
 * carry the *calling* persona's uid. A fixed uid would make every non-owner
 * create fail on the ownership leg and mask the companyId leg the cell is
 * actually asserting.
 */
function createdByFor(persona: Persona): string {
  return isAuthenticatedPersona(persona) ? PERSONA_CLAIMS[persona].uid : 'anonymous-uid';
}

describe('floorplan_topo_surfaces.rules — creator-or-admin (ADR-650)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedFloorplanTopoSurface(env, DOC_ID);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'floorplan_topo_surfaces',
          docId: DOC_ID,
          // Update payload — every immutable the rule pins must be echoed back
          // unchanged, otherwise an allowed persona would fail for the wrong reason.
          // `createdAt` is deliberately absent: update() merges, so an untouched
          // field keeps its seeded value and satisfies the equality guard. Sending
          // a fresh Date here would *change* it and deny every allowed persona.
          data: {
            contourInterval: 1.0,
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
            surfaces: [],
            contourInterval: 0.5,
            createdBy: createdByFor(cell.persona),
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

describe('floorplan_topo_surfaces.rules — hardening (ADR-650)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  /** Create as `same_tenant_user` with a payload delta. */
  function tryCreate(overrides: Record<string, unknown>) {
    return getContext(env, 'same_tenant_user')
      .firestore()
      .collection('floorplan_topo_surfaces')
      .doc('topo-hardening')
      .set({
        companyId: SAME_TENANT_COMPANY_ID,
        projectId: PROJECT_ID,
        floorplanId: FLOORPLAN_ID,
        surfaces: [],
        createdBy: PERSONA_CLAIMS.same_tenant_user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
      });
  }

  /** Update the seeded (owned) doc as `same_tenant_user` with a payload delta. */
  async function tryUpdate(overrides: Record<string, unknown>) {
    await seedFloorplanTopoSurface(env, DOC_ID);
    return getContext(env, 'same_tenant_user')
      .firestore()
      .collection('floorplan_topo_surfaces')
      .doc(DOC_ID)
      .update({
        companyId: SAME_TENANT_COMPANY_ID,
        projectId: PROJECT_ID,
        floorplanId: FLOORPLAN_ID,
        createdBy: PERSONA_CLAIMS.same_tenant_user.uid,
        updatedAt: Date.now(),
        ...overrides,
      });
  }

  // ── create: scope keys + no identity forgery ──────────────────────────────

  it('rejects create with the projectId scope key absent', async () => {
    // `hasAll()` tests key *presence*, not value — so the key must be genuinely
    // missing from the payload. Passing `projectId: null` would still satisfy it.
    await assertFails(
      getContext(env, 'same_tenant_user')
        .firestore()
        .collection('floorplan_topo_surfaces')
        .doc('topo-hardening-no-project')
        .set({
          companyId: SAME_TENANT_COMPANY_ID,
          floorplanId: FLOORPLAN_ID,
          surfaces: [],
          createdBy: PERSONA_CLAIMS.same_tenant_user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
    );
  });

  it('rejects create claiming another user as createdBy', async () => {
    await assertFails(tryCreate({ createdBy: PERSONA_CLAIMS.same_tenant_admin.uid }));
  });

  it('rejects create stamped with another tenant companyId', async () => {
    await assertFails(tryCreate({ companyId: 'company-b' }));
  });

  // ── update: immutables ────────────────────────────────────────────────────

  it('rejects update that re-tenants the doc (companyId immutable)', async () => {
    await assertFails(tryUpdate({ companyId: 'company-b' }));
  });

  it('rejects update that moves the doc to another floorplan (floorplanId immutable)', async () => {
    await assertFails(tryUpdate({ floorplanId: 'floorplan-other' }));
  });

  it('rejects update that rewrites ownership (createdBy immutable)', async () => {
    await assertFails(tryUpdate({ createdBy: PERSONA_CLAIMS.external_user.uid }));
  });
});
