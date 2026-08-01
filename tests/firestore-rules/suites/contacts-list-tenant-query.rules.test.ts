/**
 * Firestore Rules — `contacts` LIST: το query που στέλνει **όντως** ο client
 *
 * ## Γιατί υπάρχει αυτό το αρχείο δίπλα στο `contacts.rules.test.ts`
 *
 * Το `assertions.ts` (γρ. 41-48) γράφει ρητά το συμβόλαιο:
 *
 * > *a list test must send the **same** query the production client sends*
 *
 * Το `contacts.rules.test.ts` **δεν** το τηρεί: δηλώνει
 * `listFilter: { field: 'companyId', op: '==', … }` και έτσι **προσθέτει μόνο του**
 * το tenant φίλτρο πριν ρωτήσει. Ο παραγωγικός client όμως
 * (`buildContactsQuery` στο `src/services/contacts-query.service.ts`) στέλνει
 * `collection('contacts').orderBy('updatedAt','desc').limit(N)` — **χωρίς κανένα
 * `where('companyId', …)`**. Το πράσινο test επικυρώνει λοιπόν ένα query που η
 * εφαρμογή **δεν κάνει ποτέ**.
 *
 * Ο κανόνας READ (`firestore.rules:1579-1589`) αποφασίζει με `resource.data.companyId`
 * για κάθε μη-super-admin. Σε **list**, ό,τι διαβάζει ο κανόνας και δεν το περιορίζει
 * το query είναι `undefined` ⇒ απόρριψη· «rules are not filters».
 *
 * ## Τι κλειδώνει αυτό το suite
 *
 * 1. Το ανφίλτραρο query **απορρίπτεται** για `company_admin` — δηλαδή για **κάθε
 *    πραγματικό πελάτη**. Αυτό είναι το «Σφάλμα κατά την αναζήτηση επαφών».
 * 2. Το ίδιο query **με** το tenant φίλτρο **επιτρέπεται** — άρα το φίλτρο είναι
 *    η διόρθωση, όχι χαλάρωση του κανόνα.
 * 3. Το ανφίλτραρο query **επιτρέπεται** για `super_admin` — και αυτό είναι
 *    **η αιτία που το σφάλμα έμεινε αόρατο**: ο `isSuperAdminOnly()` όρος
 *    αποδεικνύεται χωρίς `resource`, οπότε ο μοναδικός λογαριασμός που
 *    χρησιμοποιείται στην ανάπτυξη δεν το συναντά ποτέ.
 *
 * @module tests/firestore-rules/suites/contacts-list-tenant-query.rules
 * @see ADR-745 — η επίδειξη άκρη-σε-άκρη που το αποκάλυψε
 * @see ADR-298 §3.3 — συμβόλαιο αρχείου δοκιμών
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { expectAllow, expectDeny } from '../_harness/assertions';
import { seedContact } from '../_harness/seed-helpers';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

/** Το όριο που περνά το πάνελ «Προσθήκη Εργαζομένου» (`autoLoadContacts`). */
const PRODUCTION_LIMIT = 100;

describe('contacts.rules — LIST ⇄ ταύτιση με το παραγωγικό query', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  beforeEach(async () => {
    // `updatedAt` στο seed γιατί το παραγωγικό query ταξινομεί με αυτό:
    // χωρίς το πεδίο το έγγραφο δεν θα επέστρεφε καν, και το «allow»
    // σκέλος θα περνούσε για λάθος λόγο (κενό αποτέλεσμα ≠ επιτρεπτό query).
    await seedContact(env, 'contact-same-tenant', {
      companyId: SAME_TENANT_COMPANY_ID,
      overrides: { updatedAt: new Date() },
    });
  });

  afterEach(async () => {
    await resetData(env);
  });

  it('απορρίπτει το ΣΗΜΕΡΙΝΟ παραγωγικό query (χωρίς tenant φίλτρο) για company_admin', async () => {
    const db = getContext(env, 'same_tenant_admin').firestore();

    // Ακριβώς ό,τι χτίζει το `buildContactsQuery` σήμερα.
    const productionQuery = db
      .collection('contacts')
      .orderBy('updatedAt', 'desc')
      .limit(PRODUCTION_LIMIT);

    await expectDeny(productionQuery.get());
  });

  it('επιτρέπει το ΙΔΙΟ query όταν φέρει το tenant φίλτρο', async () => {
    const db = getContext(env, 'same_tenant_admin').firestore();

    const scopedQuery = db
      .collection('contacts')
      .where('companyId', '==', SAME_TENANT_COMPANY_ID)
      .orderBy('updatedAt', 'desc')
      .limit(PRODUCTION_LIMIT);

    await expectAllow(scopedQuery.get());
  });

  it('επιστρέφει όντως το έγγραφο του μισθωτή με το φίλτρο (όχι κενό σύνολο)', async () => {
    const db = getContext(env, 'same_tenant_admin').firestore();

    const snapshot = await db
      .collection('contacts')
      .where('companyId', '==', SAME_TENANT_COMPANY_ID)
      .orderBy('updatedAt', 'desc')
      .limit(PRODUCTION_LIMIT)
      .get();

    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs.map((d) => d.id)).toContain('contact-same-tenant');
  });

  it('ΓΙΑΤΙ ΕΜΕΙΝΕ ΑΟΡΑΤΟ: ο super_admin περνά και χωρίς φίλτρο', async () => {
    const db = getContext(env, 'super_admin').firestore();

    const productionQuery = db
      .collection('contacts')
      .orderBy('updatedAt', 'desc')
      .limit(PRODUCTION_LIMIT);

    // `isSuperAdminOnly()` κρίνεται μόνο από το claim — καμία αναφορά σε
    // `resource`, άρα ο evaluator το αποδεικνύει χωρίς περιορισμό στο query.
    await expectAllow(productionQuery.get());
  });
});
