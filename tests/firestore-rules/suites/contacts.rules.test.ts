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
});

/**
 * ADR-923 §5.13 Τ5 (ανασκόπηση ασφαλείας Ε3): το `platformCompanyId` το γράφει μόνο ο διακομιστής. Ένα πλαστό πεδίο από τον
 * client θα άνοιγε (χωρίς τη δεύτερη ζώνη `platformCompanyOfContact`) κανάλι email προς το `quoteIntake` ξένου χώρου.
 */
describe('contacts.rules — platformCompanyId μόνο από τον διακομιστή', () => {
  let env: RulesTestEnvironment;
  const contacts = () => getContext(env, 'same_tenant_admin').firestore().collection('contacts');

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('create με platformCompanyId ⇒ άρνηση', async () => {
    await assertFails(contacts().doc('c_new').set({ companyId: SAME_TENANT_COMPANY_ID, type: 'company', platformCompanyId: 'comp_victim' }));
  });

  it('create χωρίς platformCompanyId ⇒ επιτρέπεται (η κανονική ροή δεν άλλαξε)', async () => {
    await assertSucceeds(contacts().doc('c_new').set({ companyId: SAME_TENANT_COMPANY_ID, type: 'company' }));
  });

  it('update που ΠΡΟΣΘΕΤΕΙ platformCompanyId ⇒ άρνηση', async () => {
    await seedContact(env, 'c_1', { companyId: SAME_TENANT_COMPANY_ID });
    await assertFails(contacts().doc('c_1').update({ platformCompanyId: 'comp_victim' }));
  });

  it('update που ΑΛΛΑΖΕΙ ή ΣΒΗΝΕΙ το platformCompanyId ⇒ άρνηση', async () => {
    await seedContact(env, 'c_1', { companyId: SAME_TENANT_COMPANY_ID, overrides: { platformCompanyId: 'comp_aries' } });
    await assertFails(contacts().doc('c_1').update({ platformCompanyId: 'comp_victim' }));
    await assertFails(contacts().doc('c_1').update({ platformCompanyId: null }));
  });

  it('update άλλων πεδίων σε επαφή πλατφόρμας ⇒ επιτρέπεται (το πεδίο μένει ως έχει)', async () => {
    await seedContact(env, 'c_1', { companyId: SAME_TENANT_COMPANY_ID, overrides: { platformCompanyId: 'comp_aries' } });
    await assertSucceeds(contacts().doc('c_1').update({ name: 'Νέο όνομα' }));
  });
});
