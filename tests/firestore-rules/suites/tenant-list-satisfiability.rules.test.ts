/**
 * Firestore Rules — **ΙΚΑΝΟΠΟΙΗΣΙΜΟΤΗΤΑ** του παραγωγικού ερωτήματος λίστας
 *
 * ## Η ερώτηση που απαντά αυτό το αρχείο
 *
 * > **ΜΠΟΡΕΙ** το ερώτημα που στέλνει ο πελάτης να **αποδείξει** τον κανόνα —
 * > ή είναι δομικά αδύνατο, ό,τι κι αν λένε τα δεδομένα;
 *
 * Το Firestore κρίνει ένα `list` **ΟΧΙ** πάνω στα αποθηκευμένα έγγραφα αλλά πάνω
 * στο **δυνητικό σύνολο αποτελεσμάτων** που ορίζουν οι περιορισμοί του ερωτήματος —
 * κατά λέξη από την τεκμηρίωση: *«Cloud Firestore evaluates a query against its
 * potential result set instead of the actual field values for all of your
 * documents»*. Πεδίο που ο κανόνας διαβάζει και το ερώτημα **δεν περιορίζει**
 * αποτιμάται ως απροσδιόριστο ⇒ **σφάλμα αξιολόγησης** ⇒ άρνηση **ΟΛΟΚΛΗΡΟΥ** του
 * ερωτήματος. *«Rules are not filters.»*
 *
 * ## 🔴 Γιατί γράφτηκε — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (μετρημένο 2026-08-27)
 *
 * Μέχρι σήμερα ο κανόνας `properties` διάβαζε **μόνο** `resource.data.projectId`,
 * ενώ ο πελάτης στέλνει `where('companyId','==',…)` — γιατί το `PROPERTIES` δεν έχει
 * override στο `tenant-config.ts` και παίρνει το προεπιλεγμένο `companyId`. Άρα:
 *
 *     ΕΝΑ υγιές ακίνητο · καθαρή βάση · ΝΟΜΙΜΟΣ company_admin  →  permission-denied
 *     «false for 'list' @ L21, Property projectId is undefined on object.»
 *
 * Η λίστα ακινήτων ήταν **ΠΑΝΤΑ** κλειστή για **κάθε** μη-super-admin. Νεκροί
 * καταναλωτές: `useRealtimeProperties` και `useRealtimePropertiesTrashCount`. Η
 * **σελίδα** επιβίωνε μόνο επειδή περνά από `/api/properties` — **Admin SDK, που
 * παρακάμπτει τους κανόνες**.
 *
 * ⚠️ **ΚΑΙ Η ΠΡΟΗΓΟΥΜΕΝΗ ΣΟΥΙΤΑ ΗΤΑΝ ΠΡΑΣΙΝΗ**: το `properties.rules.test.ts` δηλώνει
 * `listFilter: { field: 'projectId' }` — **το μοναδικό ερώτημα που περνά, και αυτό
 * που η παραγωγή ΔΕΝ στέλνει ΠΟΤΕ**. Κατά λέξη η αστοχία που το
 * `contacts-list-tenant-query.rules.test.ts` γράφτηκε για να καταγγείλει (ADR-745).
 * **Δεύτερη φορά.** Αυτό το αρχείο υπάρχει ώστε να μην υπάρξει τρίτη.
 *
 * ## 🔑 Γιατί ΔΕΝ αντιγράφει το πεδίο μισθωτή
 *
 * Το πεδίο **ζητείται από το ίδιο το SSoT** (`getTenantConfig`, το ίδιο που χτίζει
 * το παραγωγικό ερώτημα στο `firestore-query.service.ts`). Αν αύριο κάποιος αλλάξει
 * το πεδίο μισθωτή μιας συλλογής, η άγκυρα **ξαναρωτά με το νέο πεδίο** και
 * κοκκινίζει αν ο κανόνας δεν μπορεί να αποδειχθεί από αυτό. Ένα αντίγραφο θα
 * έμενε πράσινο πάνω στην απόκλιση — ακριβώς το σχήμα που ελέγχεται εδώ.
 *
 * @module tests/firestore-rules/suites/tenant-list-satisfiability.rules
 * @see ADR-823 — η ανατομία και η μέτρηση
 * @see ADR-745 — η ίδια κλάση στα `contacts`
 * @see ADR-298 §3.3 — συμβόλαιο αρχείου δοκιμών
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { expectAllow, expectDeny } from '../_harness/assertions';
import { SAME_TENANT_COMPANY_ID, CROSS_TENANT_COMPANY_ID, PERSONA_CLAIMS } from '../_registry/personas';
import { getTenantConfig } from '../../../src/services/firestore/tenant-config';
import type { CollectionKey } from '../../../src/config/firestore-collections';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

// ---------------------------------------------------------------------------
// Η ΚΛΑΣΗ — κάθε συλλογή που κρίνει την ανάγνωση διαβάζοντας **ΞΕΝΟ** έγγραφο
// ---------------------------------------------------------------------------

/**
 * Πηγή: `grep -nE "belongsTo(Project|Building)Company\(resource\.data" firestore.rules`
 * — δηλαδή κάθε `allow read` που αποαναφέρει ξένο κλειδί. **Δέκα**, μετρημένες.
 *
 * ⚠️ Αν προστεθεί ενδέκατη και **δεν** μπει εδώ, η άγκυρα δεν θα την κοιτάξει.
 * Ο φρουρός γι' αυτό είναι το `Κ0` παρακάτω, που **ξαναμετρά το ίδιο το αρχείο κανόνων**.
 */
const FOREIGN_KEY_COLLECTIONS = [
  { key: 'ATTENDANCE_EVENTS', collection: 'attendance_events', fk: 'projectId', parent: 'projects' },
  { key: 'ATTENDANCE_QR_TOKENS', collection: 'attendance_qr_tokens', fk: 'projectId', parent: 'projects' },
  { key: 'EMPLOYMENT_RECORDS', collection: 'employment_records', fk: 'projectId', parent: 'projects' },
  { key: 'BUILDINGS', collection: 'buildings', fk: 'projectId', parent: 'projects' },
  { key: 'FLOORS', collection: 'floors', fk: 'buildingId', parent: 'buildings' },
  { key: 'PROPERTIES', collection: 'properties', fk: 'projectId', parent: 'projects' },
  { key: 'STORAGE_UNITS', collection: 'storage_units', fk: 'buildingId', parent: 'buildings' },
  { key: 'PARKING_SPOTS', collection: 'parking_spots', fk: 'buildingId', parent: 'buildings' },
  { key: 'PROJECT_FLOORPLANS', collection: 'project_floorplans', fk: 'projectId', parent: 'projects' },
  { key: 'OBLIGATIONS', collection: 'obligations', fk: 'projectId', parent: 'projects' },
] as const satisfies readonly {
  key: CollectionKey;
  collection: string;
  fk: string;
  parent: 'projects' | 'buildings';
}[];

/** Ο γονέας που **υπάρχει**, και ο γονέας-φάντασμα που **δεν υπάρχει**. */
const PARENT_OK = 'parent-that-exists';
const PARENT_GHOST = 'parent-that-was-deleted';

const SAME_ADMIN_UID = PERSONA_CLAIMS.same_tenant_admin.uid;

/**
 * Το πεδίο με το οποίο **όντως** φιλτράρει ο παραγωγικός πελάτης.
 * `null` σημαίνει «η συλλογή δηλώνει ΚΑΝΕΝΑ φίλτρο μισθωτή» (`mode: 'none'`).
 */
function productionTenantField(key: CollectionKey): string | null {
  const config = getTenantConfig(key);
  return config.mode === 'none' ? null : config.fieldName;
}

jest.setTimeout(120000);

describe('ΙΚΑΝΟΠΟΙΗΣΙΜΟΤΗΤΑ παραγωγικού ερωτήματος — οι 10 συλλογές με ΞΕΝΟ κλειδί', () => {
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

  /**
   * Σπέρνει τον κόσμο **παρακάμπτοντας τους κανόνες** — ακριβώς όπως γράφει το
   * Admin SDK στην παραγωγή, που είναι ο **μόνος** γραφέας αυτών των συλλογών
   * (`allow create: if false`). Γι' αυτό ακριβώς οι κανόνες **δεν μπορούν** να
   * εγγυηθούν την παρουσία του ξένου κλειδιού: ο γραφέας δεν περνά από αυτούς.
   */
  async function seedWorld(
    target: (typeof FOREIGN_KEY_COLLECTIONS)[number],
    docs: readonly { id: string; fk?: string; companyId?: string }[],
  ): Promise<void> {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('projects').doc(PARENT_OK).set({ name: 'P', companyId: SAME_TENANT_COMPANY_ID });
      await db.collection('projects').doc('project-of-building').set({ name: 'P', companyId: SAME_TENANT_COMPANY_ID });
      if (target.parent === 'buildings') {
        await db
          .collection('buildings')
          .doc(PARENT_OK)
          .set({ companyId: SAME_TENANT_COMPANY_ID, projectId: 'project-of-building' });
      }
      for (const doc of docs) {
        await db
          .collection(target.collection)
          .doc(doc.id)
          .set({
            id: doc.id,
            ...(doc.companyId === undefined ? {} : { companyId: doc.companyId }),
            ...(doc.fk === undefined ? {} : { [target.fk]: doc.fk }),
            createdBy: SAME_ADMIN_UID,
            status: 'active',
            name: doc.id,
          });
      }
    });
  }

  /** Το ερώτημα που στέλνει **όντως** ο πελάτης: φίλτρο μισθωτή και τίποτε άλλο. */
  function productionQuery(
    persona: 'same_tenant_admin' | 'same_tenant_user' | 'cross_tenant_admin',
    target: (typeof FOREIGN_KEY_COLLECTIONS)[number],
    tenantField: string,
    companyId: string,
  ) {
    return getContext(env, persona)
      .firestore()
      .collection(target.collection)
      .where(tenantField, '==', companyId)
      .get();
  }

  // =========================================================================
  // Κ0 — Ο ΠΙΝΑΚΑΣ ΠΑΡΑΠΑΝΩ ΕΙΝΑΙ ΠΛΗΡΗΣ; (ξαναμετράει το ΙΔΙΟ το αρχείο κανόνων)
  // =========================================================================
  it('Κ0: καμία ΕΝΔΕΚΑΤΗ συλλογή δεν μπήκε στην κλάση χωρίς γραμμή εδώ', () => {
    const rules = readFileSync(
      resolve(__dirname, '..', '..', '..', 'firestore.rules'),
      'utf8',
    );

    // Κάθε γραμμή που αποαναφέρει ΞΕΝΟ κλειδί του ίδιου του εγγράφου.
    const occurrences = rules
      .split('\n')
      .filter((line) => /belongsTo(Project|Building)Company\(resource\.data/.test(line));

    expect(occurrences).toHaveLength(FOREIGN_KEY_COLLECTIONS.length);
  });

  // =========================================================================
  // Κ1 — Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ: μπορεί το παραγωγικό ερώτημα να πετύχει;
  // =========================================================================
  describe('Κ1 — ΥΓΙΗΣ κόσμος: το ερώτημα του πελάτη ΠΡΕΠΕΙ να περνά', () => {
    for (const target of FOREIGN_KEY_COLLECTIONS) {
      const tenantField = productionTenantField(target.key);

      if (tenantField === null) {
        // 🔶 ΜΕΤΡΗΜΕΝΟ ΟΡΙΟ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ: η συλλογή δηλώνει `mode: 'none'` στο
        // `tenant-config.ts`, άρα ο πελάτης στέλνει **αφιλτράριστο** ερώτημα — που
        // **κανένας** περιορισμός δεν αποδεικνύει ⇒ απορρίπτεται, και θα
        // απορριπτόταν **και πριν ΚΑΙ μετά** από κάθε αλλαγή αυτού του κανόνα.
        // Το κλειδώνουμε ως **γεγονός**, όχι ως επιθυμία: αν κάποτε αποκτήσει
        // φίλτρο μισθωτή, αυτό το test **αλλάζει κλάδο μόνο του** και μπαίνει στο Κ1.
        it(`${target.collection}: δηλώνει mode 'none' ⇒ ΑΦΙΛΤΡΑΡΟ ερώτημα ⇒ ΑΡΝΗΣΗ (μετρημένο όριο)`, async () => {
          await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
          await expectDeny(
            getContext(env, 'same_tenant_admin').firestore().collection(target.collection).get(),
          );
        });
        continue;
      }

      it(`${target.collection}: where('${tenantField}') ΠΕΡΝΑ για company_admin`, async () => {
        await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
        await expectAllow(
          productionQuery('same_tenant_admin', target, tenantField, SAME_TENANT_COMPANY_ID),
        );
      });

      it(`${target.collection}: where('${tenantField}') ΠΕΡΝΑ και για απλό internal_user`, async () => {
        await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
        await expectAllow(
          productionQuery('same_tenant_user', target, tenantField, SAME_TENANT_COMPANY_ID),
        );
      });

      it(`${target.collection}: και ΕΠΙΣΤΡΕΦΕΙ το έγγραφο — όχι κενό σύνολο`, async () => {
        // ⚠️ Χωρίς αυτό, ένα ερώτημα που γυρίζει **τίποτα** θα περνούσε το Κ1 για
        // λάθος λόγο: κενό αποτέλεσμα ≠ επιτρεπτό ερώτημα.
        await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
        const snapshot = await getContext(env, 'same_tenant_admin')
          .firestore()
          .collection(target.collection)
          .where(tenantField, '==', SAME_TENANT_COMPANY_ID)
          .get();
        expect(snapshot.docs.map((d) => d.id)).toContain('doc-good');
      });
    }
  });

  // =========================================================================
  // Κ2 — ΕΝΑ ΧΑΛΑΣΜΕΝΟ ΒΙΒΛΙΟ ΔΕΝ ΚΛΕΙΔΩΝΕΙ ΤΗ ΒΙΒΛΙΟΘΗΚΗ
  // =========================================================================
  describe('Κ2 — ΧΑΛΑΣΜΕΝΟ έγγραφο δίπλα σε υγιή: η λίστα ΕΠΙΒΙΩΝΕΙ', () => {
    for (const target of FOREIGN_KEY_COLLECTIONS) {
      const tenantField = productionTenantField(target.key);
      if (tenantField === null) continue;

      it(`${target.collection}: ΚΡΕΜΑΜΕΝΟ ${target.fk} (γονέας διαγραμμένος) δεν ρίχνει τη λίστα`, async () => {
        await seedWorld(target, [
          { id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID },
          { id: 'doc-dangling', fk: PARENT_GHOST, companyId: SAME_TENANT_COMPANY_ID },
        ]);
        await expectAllow(
          productionQuery('same_tenant_admin', target, tenantField, SAME_TENANT_COMPANY_ID),
        );
      });

      it(`${target.collection}: ΛΕΙΠΟΝ ${target.fk} δεν ρίχνει τη λίστα`, async () => {
        await seedWorld(target, [
          { id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID },
          { id: 'doc-nokey', companyId: SAME_TENANT_COMPANY_ID },
        ]);
        await expectAllow(
          productionQuery('same_tenant_admin', target, tenantField, SAME_TENANT_COMPANY_ID),
        );
      });

      it(`${target.collection}: το ΥΓΙΕΣ έγγραφο εξακολουθεί να επιστρέφεται`, async () => {
        await seedWorld(target, [
          { id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID },
          { id: 'doc-dangling', fk: PARENT_GHOST, companyId: SAME_TENANT_COMPANY_ID },
        ]);
        const snapshot = await getContext(env, 'same_tenant_admin')
          .firestore()
          .collection(target.collection)
          .where(tenantField, '==', SAME_TENANT_COMPANY_ID)
          .get();
        expect(snapshot.docs.map((d) => d.id)).toContain('doc-good');
      });
    }
  });

  // =========================================================================
  // Κ3 — ΚΑΜΙΑ ΧΑΛΑΡΩΣΗ: ό,τι ήταν κλειστό, μένει κλειστό
  // =========================================================================
  describe('Κ3 — καμία διαρροή μισθωτή', () => {
    for (const target of FOREIGN_KEY_COLLECTIONS) {
      const tenantField = productionTenantField(target.key);
      if (tenantField === null) continue;

      it(`${target.collection}: ΞΕΝΟΣ μισθωτής ζητά ρητά τον ΔΙΚΟ ΜΑΣ ${tenantField} → ΑΡΝΗΣΗ`, async () => {
        await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
        await expectDeny(
          productionQuery('cross_tenant_admin', target, tenantField, SAME_TENANT_COMPANY_ID),
        );
      });

      it(`${target.collection}: ΞΕΝΟΣ μισθωτής δεν ΒΛΕΠΕΙ το έγγραφο ούτε σημειακά`, async () => {
        await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
        await expectDeny(
          getContext(env, 'cross_tenant_admin')
            .firestore()
            .collection(target.collection)
            .doc('doc-good')
            .get(),
        );
      });

      it(`${target.collection}: ΞΕΝΟΣ με το ΔΙΚΟ ΤΟΥ ${tenantField} παίρνει ΚΕΝΟ, όχι ξένα`, async () => {
        await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
        const snapshot = await getContext(env, 'cross_tenant_admin')
          .firestore()
          .collection(target.collection)
          .where(tenantField, '==', CROSS_TENANT_COMPANY_ID)
          .get();
        expect(snapshot.empty).toBe(true);
      });

      it(`${target.collection}: ΑΝΩΝΥΜΟΣ → ΑΡΝΗΣΗ`, async () => {
        await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
        await expectDeny(
          env
            .unauthenticatedContext()
            .firestore()
            .collection(target.collection)
            .where(tenantField, '==', SAME_TENANT_COMPANY_ID)
            .get(),
        );
      });

      it(`${target.collection}: ΑΦΙΛΤΡΑΡΟ ερώτημα → ΑΡΝΗΣΗ ακόμη και για νόμιμο`, async () => {
        // «Rules are not filters»: χωρίς περιορισμό μισθωτή, τίποτα δεν αποδεικνύεται.
        await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
        await expectDeny(
          getContext(env, 'same_tenant_admin').firestore().collection(target.collection).get(),
        );
      });
    }
  });

  // =========================================================================
  // Κ4 — ΤΟ ΤΥΦΛΟ ΣΗΜΕΙΟ: γιατί έμεινε αόρατο επί μήνες
  // =========================================================================
  it('Κ4: ο super_admin περνά ΑΦΙΛΤΡΑΡΑ — γι\' αυτό κανείς δεν το είδε', async () => {
    // Ο `isSuperAdminOnly()` κρίνεται **μόνο** από το claim: καμία αναφορά σε
    // `resource`, άρα ο evaluator τον αποδεικνύει **χωρίς** περιορισμό ερωτήματος.
    // Ο μοναδικός λογαριασμός που χρησιμοποιείται στην ανάπτυξη δεν συναντά ποτέ
    // το σφάλμα — ταυτόσημο με ADR-745 §«ΓΙΑΤΙ ΕΜΕΙΝΕ ΑΟΡΑΤΟ».
    const target = FOREIGN_KEY_COLLECTIONS.find((t) => t.collection === 'properties')!;
    await seedWorld(target, [{ id: 'doc-good', fk: PARENT_OK, companyId: SAME_TENANT_COMPANY_ID }]);
    await expectAllow(getContext(env, 'super_admin').firestore().collection('properties').get());
  });

  // =========================================================================
  // Κ5 — ΤΟ ΜΕΤΡΗΜΕΝΟ ΥΠΟΛΟΙΠΟ, ΓΡΑΜΜΕΝΟ ΩΣ ΓΕΓΟΝΟΣ
  // =========================================================================
  describe('Κ5 — ό,τι ΔΕΝ θεραπεύει αυτή η αλλαγή (μετρημένο, όχι εικαζόμενο)', () => {
    for (const target of FOREIGN_KEY_COLLECTIONS) {
      it(`${target.collection}: ερώτημα ΚΑΤΑ ΤΟ ΞΕΝΟ ΚΛΕΙΔΙ πάνω σε κρεμάμενο ⇒ ακόμη ΑΡΝΗΣΗ`, async () => {
        // 🔑 Εδώ το `where` **επιλέγει** τα κρεμάμενα, οπότε το εφεδρικό σκέλος
        // πυροδοτείται αναγκαστικά και το `exists()` γυρίζει `null` ⇒ `false` ⇒ ο
        // κανόνας δεν αποδεικνύεται για το δυνητικό σύνολο ⇒ άρνηση.
        //
        // ⚠️ **ΔΕΝ είναι η ίδια αστοχία**: εδώ ο πελάτης ζητά **ρητά** τα παιδιά ενός
        // γονέα που **δεν υπάρχει**. Η άρνηση είναι σωστή· η θεραπεία είναι
        // **καθαρισμός δεδομένων**, όχι χαλάρωση κανόνα.
        // Ο μετρητής: `npm run audit:dangling-fk`.
        await seedWorld(target, [{ id: 'doc-dangling', fk: PARENT_GHOST, companyId: SAME_TENANT_COMPANY_ID }]);
        await expectDeny(
          getContext(env, 'same_tenant_admin')
            .firestore()
            .collection(target.collection)
            .where(target.fk, '==', PARENT_GHOST)
            .get(),
        );
      });
    }
  });
});
