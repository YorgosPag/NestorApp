/**
 * Firestore Rules — `block_library` collection (ADR-652 M2/M3/M4)
 *
 * The 2D DXF block content library (furniture / sanitary ware / …). Metadata
 * lives here; the geometry itself is a blob in Storage.
 *
 * Two properties carry the security weight and are the reason this suite
 * exists — both were *real* holes closed during the milestones, not theory:
 *
 *   1. **`user` scope is private inside the tenant.** Whatever a user imports
 *      from a third-party DXF must not leak to the rest of the company. The
 *      matrix pins that even a `same_tenant_admin` — a colleague with *more*
 *      rights — is denied read/list on someone else's user-scope block, while
 *      still being allowed to update/delete it (tenant governance).
 *   2. **`system` scope is seed-only.** A client may never create one, and
 *      (the M3 hole) may never *self-promote* an existing block into `system`
 *      — that would publish it to **every** tenant, since the read rule lets
 *      any authenticated user read `scope == 'system'`.
 *
 * The matrix loop covers the persona × operation grid on the private fixture;
 * the hardening block below covers the cases that need a *second* document or
 * a *mutated payload* (system/company fixtures, promotion attempts), which the
 * generic `assertCell` target shape cannot express.
 *
 * @since 2026-07-13 (ADR-652 — graduated from FIRESTORE_RULES_PENDING)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import {
  assertCell,
  expectAllow,
  expectDeny,
  type AssertTarget,
} from '../_harness/assertions';
import { seedBlockLibraryItem } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'block_library',
)!;

const COLLECTION = 'block_library';

/** The matrix fixture: a private (`user` scope) block owned by same_tenant_user. */
const PRIVATE_BLOCK_ID = 'blklib-private';
/** Published to the whole company by an admin. */
const COMPANY_BLOCK_ID = 'blklib-company';
/** Seeded (Admin SDK) system content — readable by every authenticated user. */
const SYSTEM_BLOCK_ID = 'blklib-system';

describe('block_library.rules — tenant_direct (blockLibraryMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedBlockLibraryItem(env, PRIVATE_BLOCK_ID);

        const ctx = getContext(env, cell.persona);
        const claims =
          cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;

        const target: AssertTarget = {
          collection: COLLECTION,
          docId: PRIVATE_BLOCK_ID,
          // Rename — the only thing `updateBlock()` touches. companyId/scope/id
          // stay as seeded, which is exactly what the rule demands.
          data: { name: 'Renamed block', updatedAt: new Date() },
          createData: {
            name: `Created block ${cell.persona}`,
            scope: 'user',
            category: 'furniture',
            builtin: false,
            companyId: SAME_TENANT_COMPANY_ID,
            projectId: null,
            createdBy: claims?.uid ?? 'anon-uid',
            geometryUrl: 'https://storage.example/block-library/new.json',
            license: { type: 'unknown', redistributable: false },
            createdAt: new Date(),
          },
          // The real client list query is a scope bucket of ScopedLibraryService:
          // the user bucket — scope=='user' && createdBy==<caller> && companyId==tenant.
          // A list rule is checked against the query, so it must carry every
          // field the rule reads (see AssertTarget.listFilter docblock).
          listFilter: [
            { field: 'scope', op: '==', value: 'user' },
            { field: 'createdBy', op: '==', value: claims?.uid ?? 'anon-uid' },
            { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
          ],
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});

describe('block_library.rules — scope hardening (ADR-652 M3)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  // -------------------------------------------------------------------------
  // user-scope privacy at the LIST level ("rules are not filters")
  //
  // The matrix proves the owner's own bucket lists fine. These attack tests
  // prove the rule does NOT let a colleague widen the query to reach another
  // user's private blocks — the case that actually leaks data.
  // -------------------------------------------------------------------------

  describe('user-scope list privacy', () => {
    beforeEach(async () => {
      // A block privately owned by same_tenant_user.
      await seedBlockLibraryItem(env, PRIVATE_BLOCK_ID);
    });

    it("DENIES a colleague listing the tenant's user blocks without the createdBy constraint", async () => {
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db
          .collection(COLLECTION)
          .where('scope', '==', 'user')
          .where('companyId', '==', SAME_TENANT_COMPANY_ID)
          .get(),
      );
    });

    it("DENIES a colleague listing ANOTHER user's bucket (createdBy != caller)", async () => {
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db
          .collection(COLLECTION)
          .where('scope', '==', 'user')
          .where('createdBy', '==', PERSONA_CLAIMS.same_tenant_user.uid)
          .where('companyId', '==', SAME_TENANT_COMPANY_ID)
          .get(),
      );
    });

    it('DENIES an unconstrained collection scan', async () => {
      const db = getContext(env, 'same_tenant_user').firestore();
      await expectDeny(db.collection(COLLECTION).get());
    });
  });

  // -------------------------------------------------------------------------
  // `system` scope — seed-only, world-readable
  // -------------------------------------------------------------------------

  describe('system scope', () => {
    beforeEach(async () => {
      await seedBlockLibraryItem(env, SYSTEM_BLOCK_ID, {
        overrides: { scope: 'system', builtin: true, companyId: null },
      });
    });

    it('is readable by any authenticated user of the tenant', async () => {
      const db = getContext(env, 'same_tenant_user').firestore();
      await expectAllow(db.collection(COLLECTION).doc(SYSTEM_BLOCK_ID).get());
    });

    it('is readable across tenants — that is the point of shipped content', async () => {
      const db = getContext(env, 'cross_tenant_user').firestore();
      await expectAllow(db.collection(COLLECTION).doc(SYSTEM_BLOCK_ID).get());
    });

    it('is NOT readable without authentication', async () => {
      const db = getContext(env, 'anonymous').firestore();
      await expectDeny(db.collection(COLLECTION).doc(SYSTEM_BLOCK_ID).get());
    });

    it('cannot be updated by a company admin (builtin content is immutable)', async () => {
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db.collection(COLLECTION).doc(SYSTEM_BLOCK_ID).update({ name: 'Hijacked' }),
      );
    });

    it('cannot be deleted by a company admin', async () => {
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(db.collection(COLLECTION).doc(SYSTEM_BLOCK_ID).delete());
    });

    it('cannot be CREATED by a client — not even a company admin', async () => {
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db.collection(COLLECTION).doc('blklib-fake-system').set({
          name: 'Fake system block',
          scope: 'system',
          category: 'furniture',
          builtin: true,
          companyId: SAME_TENANT_COMPANY_ID,
          createdBy: PERSONA_CLAIMS.same_tenant_admin.uid,
          license: { type: 'cc0', redistributable: true },
          createdAt: new Date(),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Publication (promote) — user → company is legal, user → system is NOT
  // -------------------------------------------------------------------------

  describe('publication', () => {
    beforeEach(async () => {
      await seedBlockLibraryItem(env, PRIVATE_BLOCK_ID);
    });

    it('lets the owner publish their block to the company (user → company)', async () => {
      const db = getContext(env, 'same_tenant_user').firestore();
      await expectAllow(
        db.collection(COLLECTION).doc(PRIVATE_BLOCK_ID).update({
          scope: 'company',
          license: { type: 'cc0', redistributable: true },
        }),
      );
    });

    it('BLOCKS self-promotion to system by the owner (would publish to every tenant)', async () => {
      const db = getContext(env, 'same_tenant_user').firestore();
      await expectDeny(
        db.collection(COLLECTION).doc(PRIVATE_BLOCK_ID).update({
          scope: 'system',
          license: { type: 'cc0', redistributable: true },
        }),
      );
    });

    it('BLOCKS self-promotion to system by a company admin too', async () => {
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db.collection(COLLECTION).doc(PRIVATE_BLOCK_ID).update({ scope: 'system' }),
      );
    });

    it('BLOCKS moving a block into another tenant (companyId is immutable)', async () => {
      const db = getContext(env, 'same_tenant_user').firestore();
      await expectDeny(
        db.collection(COLLECTION).doc(PRIVATE_BLOCK_ID).update({ companyId: 'company-b' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // `company` scope — shared inside the tenant, invisible outside it
  // -------------------------------------------------------------------------

  describe('company scope', () => {
    beforeEach(async () => {
      await seedBlockLibraryItem(env, COMPANY_BLOCK_ID, {
        createdBy: PERSONA_CLAIMS.same_tenant_admin.uid,
        overrides: { scope: 'company', license: { type: 'cc0', redistributable: true } },
      });
    });

    it('is readable by a colleague who did NOT create it', async () => {
      const db = getContext(env, 'same_tenant_user').firestore();
      await expectAllow(db.collection(COLLECTION).doc(COMPANY_BLOCK_ID).get());
    });

    it('is NOT readable by another tenant', async () => {
      const db = getContext(env, 'cross_tenant_user').firestore();
      await expectDeny(db.collection(COLLECTION).doc(COMPANY_BLOCK_ID).get());
    });

    it('is NOT deletable by a colleague who did not create it and is not an admin', async () => {
      const db = getContext(env, 'same_tenant_user').firestore();
      await expectDeny(db.collection(COLLECTION).doc(COMPANY_BLOCK_ID).delete());
    });
  });
});
