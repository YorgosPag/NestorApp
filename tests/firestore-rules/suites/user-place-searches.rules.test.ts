/**
 * Firestore Rules — `user_place_searches` collection (ADR-882 Φάση 2)
 *
 * Pattern: prefixed ownership — docId == 'uplsrch_' + auth.uid — plus shape validation
 * (`isValidUserPlaceSearches`: hasOnly · userId == uid · schemaVersion int · bounded maps).
 *
 * Seed doc: docId = 'uplsrch_' + PERSONA_CLAIMS.same_tenant_user.uid.
 *   - same_tenant_user × get/update/delete → allow
 *   - all others × all ops → deny (docId mismatch or not authenticated)
 *   - list → deny for all (path-var rule, unrestricted queries denied)
 *   - create → deny for all (harness fresh docId != any uplsrch_<uid>)
 *
 * The regression block exercises what the matrix cannot: the real first write
 * (a `merge` set on the owner's own doc id) and the shape refusals.
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, expectAllow, expectDeny, type AssertTarget } from '../_harness/assertions';
import { seedUserPlaceSearches } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'user_place_searches',
)!;

const OWNER_UID = PERSONA_CLAIMS.same_tenant_user.uid;
const OWN_DOC_ID = `uplsrch_${OWNER_UID}`;
const THESSALONIKI = { label: 'Θεσσαλονίκη', center: { lat: 40.64, lng: 22.94 }, savedAt: 2 };

function manyEntries(count: number): Record<string, typeof THESSALONIKI> {
  const entries: Record<string, typeof THESSALONIKI> = {};
  for (let i = 0; i < count; i += 1) entries[`τοπος ${i}`] = { ...THESSALONIKI, label: `Τόπος ${i}` };
  return entries;
}

describe('user_place_searches.rules — prefixed ownership (ownerOnlyMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedUserPlaceSearches(env, OWN_DOC_ID, OWNER_UID);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'user_place_searches',
          docId: OWN_DOC_ID,
          data: { 'entries.θεσσαλονικη': THESSALONIKI, updatedAt: new Date() },
          createData: { userId: OWNER_UID, schemaVersion: 1, entries: {} },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }

  describe('own-doc regression (the real client path)', () => {
    function ownRef() {
      return getContext(env, 'same_tenant_user').firestore()
        .collection('user_place_searches').doc(OWN_DOC_ID);
    }

    it('first write = merge set on uplsrch_<own uid> → allow', async () => {
      await expectAllow(ownRef().set(
        { userId: OWNER_UID, schemaVersion: 1, entries: { 'θεσσαλονικη': THESSALONIKI } },
        { merge: true },
      ));
    });

    it('raw uid as doc id (no prefix) → deny', async () => {
      const rawRef = getContext(env, 'same_tenant_user').firestore()
        .collection('user_place_searches').doc(OWNER_UID);
      await expectDeny(rawRef.set({ userId: OWNER_UID, schemaVersion: 1 }));
    });

    it('userId of another person → deny', async () => {
      await expectDeny(ownRef().set({ userId: 'someone-else', schemaVersion: 1 }));
    });

    it('unknown top-level field → deny', async () => {
      await expectDeny(ownRef().set({ userId: OWNER_UID, schemaVersion: 1, gps: { lat: 1, lng: 2 } }));
    });

    it('entries beyond the 24 bound → deny', async () => {
      await expectDeny(ownRef().set({ userId: OWNER_UID, schemaVersion: 1, entries: manyEntries(25) }));
    });

    it('clear (entries removed, clearedAt set) on the seeded doc → allow', async () => {
      await seedUserPlaceSearches(env, OWN_DOC_ID, OWNER_UID);
      await expectAllow(ownRef().set(
        { userId: OWNER_UID, schemaVersion: 1, clearedAt: 5 },
      ));
    });
  });
});
