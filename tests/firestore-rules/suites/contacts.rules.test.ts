/**
 * Firestore Rules — `contacts` collection
 *
 * Pattern: tenant_direct (companyId on the document).
 * Migrated from `tests/firestore-rules/pr-1a-contacts.test.ts` (2026-01-29).
 * See ADR-298 §3.3.
 *
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedContact } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'contacts',
)!;

describe('contacts.rules — tenant_direct pattern', () => {
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
        const docId = 'contact-same-tenant';
        await seedContact(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'contacts',
          docId,
          data: {
            name: 'Mutated Contact',
            email: 'mutated@example.com',
            phone: '+30 210 9999999',
            companyId: SAME_TENANT_COMPANY_ID,
          },
          // Fresh-doc payload for create — isValidContactData requires
          // companyId (firestore.rules:3210).
          createData: {
            name: 'Created Contact',
            email: 'created@example.com',
            phone: '+30 210 1111111',
            companyId: SAME_TENANT_COMPANY_ID,
          },
          // Always target the seeded bucket — cross-tenant personas are
          // denied by the per-doc read rule, not by an empty query result.
          listFilter: {
            field: 'companyId',
            op: '==',
            value: SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // 🔒 ADR-923 §5.13 Τ5 — το `platformCompanyId` το γράφει ΜΟΝΟ ο διακομιστής. Με αυτό το πεδίο και το ντετερμινιστικό
  //    id, ένας πελάτης θα έφτιαχνε «επαφή πλατφόρμας» για οποιονδήποτε προμηθευτή και θα του έστελνε αιτήματα.
  describe('platformCompanyId — μόνο ο διακομιστής', () => {
    const contacts = () => getContext(env, 'same_tenant_admin').firestore().collection('contacts');
    const fresh = { name: 'C', email: 'c@example.com', phone: '+30 210 1111111', companyId: SAME_TENANT_COMPANY_ID };

    it('create με platformCompanyId ⇒ άρνηση (και για super admin)', async () => {
      await assertFails(contacts().doc('c-new').set({ ...fresh, platformCompanyId: 'comp_victim' }));
      const root = getContext(env, 'super_admin').firestore().collection('contacts');
      await assertFails(root.doc('c-root').set({ ...fresh, platformCompanyId: 'comp_victim' }));
      await assertSucceeds(contacts().doc('c-ok').set(fresh));
    });

    it('update που προσθέτει, αλλάζει ή αφαιρεί το platformCompanyId ⇒ άρνηση· άλλο πεδίο ⇒ επιτρέπεται', async () => {
      await seedContact(env, 'c-plain', { companyId: SAME_TENANT_COMPANY_ID });
      await seedContact(env, 'c-platform', { companyId: SAME_TENANT_COMPANY_ID, overrides: { platformCompanyId: 'comp_aries' } });
      await assertFails(contacts().doc('c-plain').update({ platformCompanyId: 'comp_victim' }));
      await assertFails(contacts().doc('c-platform').update({ platformCompanyId: 'comp_victim' }));
      await assertFails(contacts().doc('c-platform').set({ ...fresh }));
      await assertSucceeds(contacts().doc('c-platform').update({ name: 'Renamed' }));
      await assertSucceeds(contacts().doc('c-plain').update({ name: 'Renamed' }));
    });
  });
});
