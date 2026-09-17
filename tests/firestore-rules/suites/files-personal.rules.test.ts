/**
 * Firestore Rules — συλλογή `files_personal` (ADR-866 §5.2 · Φ0 βήμα 2β)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - get/list:  `resource.data.userId == request.auth.uid`
 *   - create:    κάτοχος = αιτών · χωρίς `companyId` · χωρίς πεδίο θεματοφυλακής CDE · `pending`
 *   - update:    κάτοχος · αμετάβλητα `id/userId/createdBy/storagePath` · `pending→ready|failed` ή
 *                `ready→ready` · `cdeCustodyUnchanged()` (η ΚΑΘΟΛΙΚΗ φρουρά, κοινή με `files`)
 *   - delete:    κάτοχος
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ Ο ΠΙΝΑΚΑΣ PERSONAS **ΔΕΝ ΜΠΟΡΕΙ** (άγκυρα ADR-866 §7 Α3)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Π1. Ο ΠΟΛΙΤΗΣ ΧΩΡΙΣ ΕΤΑΙΡΕΙΑ** — κάθε persona κουβαλά claim `companyId`· ο ιδιοκτήτης για
 *   τον οποίο υπάρχει αυτό το διαμέρισμα δεν έχει. Ανεβάζει, διαβάζει, σβήνει τα δικά του.
 *   **Π2. Rules are not filters** — αφιλτράριστη λίστα ⇒ άρνηση ΚΑΙ για τον κάτοχο.
 *   **Π3. ΟΥΤΕ admin εταιρείας ΟΥΤΕ super admin** (Google Drive «Ο Δίσκος μου» · Figma Drafts).
 *   **Π4. Καμία «ψευδο-εταιρεία» και καμία θεματοφυλακή CDE από πελάτη** (ADR-787 Ε-3 §3):
 *   γέννηση με `companyId` ή `cdeState` ⇒ άρνηση· γραφή `supersededByFileId` ⇒ άρνηση.
 *   **Π6. ΜΕΤΑ τη διαδοχή του γραφέα (Admin SDK, εκτός κανόνων)**: ο κάτοχος **εξακολουθεί να
 *   διαβάζει** προκάτοχο και διάδοχο, και το ερώτημα προκατόχων της στοίβας περνά — ενώ ο δεσμός
 *   διαδοχής **δεν ξηλώνεται** από τον πελάτη (ADR-866 βήμα 2β.3β · Ε-Φ0-1).
 *
 * @since 2026-09-17 (ADR-866 Φ0 βήμα 2β)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { personalFilePayload, seedPersonalFile } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import {
  buildFinalizeFileRecordUpdate,
  buildPendingFileRecordData,
} from '@/services/file-record/file-record-core';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const COLLECTION = 'files_personal';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'files_personal')!;

/** Ο κάτοχος του σπαρμένου αρχείου — ίδια σύμβαση με το `entity-audit-trail-personal`. */
const OWNER_UID = PERSONA_CLAIMS.same_tenant_user.uid;
const DOC_ID = 'file-personal-1';

/** Άνθρωπος **χωρίς** claim εταιρείας — ο ιδιώτης ιδιοκτήτης (ADR-864 Ε-1). */
const CITIZEN_UID = 'citizen-without-company';

describe('files_personal.rules — το προσωπικό αρχείο το αγγίζει ΜΟΝΟ ο κάτοχος (ADR-866 §5.2)', () => {
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
        await seedPersonalFile(env, DOC_ID, OWNER_UID);

        const target: AssertTarget = {
          collection: COLLECTION,
          docId: DOC_ID,
          data: { displayName: 'Συμβόλαιο αγοράς' },
          createData: personalFilePayload(OWNER_UID, `${DOC_ID}-new`),
          // 🔑 Το φίλτρο ονομάζει το uid ΤΟΥ ΚΑΤΟΧΟΥ: «ξέρω ποιανού ζητάω» δεν αρκεί.
          listFilter: { field: 'userId', op: '==', value: OWNER_UID },
        };

        await assertCell(getContext(env, cell.persona), cell, target);
      });
    });
  }

  describe('🔴 Π1 — ο ΠΟΛΙΤΗΣ χωρίς εταιρεία', () => {
    it('ανεβάζει (pending), οριστικοποιεί, διαβάζει, στέλνει στον κάδο και σβήνει ΤΟ ΔΙΚΟ ΤΟΥ', async () => {
      const db = env.authenticatedContext(CITIZEN_UID, {}).firestore();
      const ref = db.collection(COLLECTION).doc('citizen-file');

      await assertSucceeds(ref.set(personalFilePayload(CITIZEN_UID, 'citizen-file')));
      await assertSucceeds(ref.update({ status: 'ready' }));
      await assertSucceeds(ref.get());
      const snap = await assertSucceeds(db.collection(COLLECTION).where('userId', '==', CITIZEN_UID).get());
      expect(snap.size).toBe(1);
      await assertSucceeds(ref.update({ isDeleted: true }));
      await assertSucceeds(ref.delete());
    });

    it('🔴 δεν γεννά αρχείο στο όνομα ΑΛΛΟΥ', async () => {
      const db = env.authenticatedContext(CITIZEN_UID, {}).firestore();
      await assertFails(db.collection(COLLECTION).doc('forged').set(personalFilePayload('another-citizen', 'forged')));
    });

    it('🔴 ξένος πολίτης δεν διαβάζει, δεν αλλάζει, δεν σβήνει', async () => {
      await seedPersonalFile(env, DOC_ID, CITIZEN_UID);
      const ref = env.authenticatedContext('another-citizen', {}).firestore().collection(COLLECTION).doc(DOC_ID);
      await assertFails(ref.get());
      await assertFails(ref.update({ displayName: 'x' }));
      await assertFails(ref.delete());
    });

    it('🔴 ο κάτοχος δεν μεταβιβάζει το αρχείο αλλάζοντας `userId` ή `storagePath`', async () => {
      await seedPersonalFile(env, DOC_ID, CITIZEN_UID);
      const ref = env.authenticatedContext(CITIZEN_UID, {}).firestore().collection(COLLECTION).doc(DOC_ID);
      await assertFails(ref.update({ userId: 'another-citizen' }));
      await assertFails(ref.update({ storagePath: 'people/another-citizen/x.pdf' }));
    });
  });

  describe('🔴 Π2 — rules are not filters', () => {
    it('αφιλτράριστη λίστα → deny ΚΑΙ για τον κάτοχο', async () => {
      await seedPersonalFile(env, DOC_ID, OWNER_UID);
      await assertFails(getContext(env, 'same_tenant_user').firestore().collection(COLLECTION).get());
    });

    it('🔑 το φιλτραρισμένο ερώτημα του κατόχου ΔΕΝ φέρνει αρχείο τρίτου', async () => {
      await seedPersonalFile(env, DOC_ID, OWNER_UID);
      await seedPersonalFile(env, 'file-of-someone-else', PERSONA_CLAIMS.cross_tenant_user.uid);
      const snap = await assertSucceeds(
        getContext(env, 'same_tenant_user').firestore().collection(COLLECTION).where('userId', '==', OWNER_UID).get(),
      );
      expect(snap.docs.map((d) => d.id)).toEqual([DOC_ID]);
    });
  });

  describe('🔴 Π3 — ΟΥΤΕ ο admin της εταιρείας ΟΥΤΕ ο super admin', () => {
    it('admin της ΙΔΙΑΣ εταιρείας με τον κάτοχο → deny', async () => {
      await seedPersonalFile(env, DOC_ID, OWNER_UID);
      await assertFails(getContext(env, 'same_tenant_admin').firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('super admin → deny σε get ΚΑΙ σε λίστα που ονομάζει τον κάτοχο', async () => {
      await seedPersonalFile(env, DOC_ID, OWNER_UID);
      const db = getContext(env, 'super_admin').firestore();
      await assertFails(db.collection(COLLECTION).doc(DOC_ID).get());
      await assertFails(db.collection(COLLECTION).where('userId', '==', OWNER_UID).get());
    });
  });

  describe('🔴 Π4 — καμία ψευδο-εταιρεία, καμία θεματοφυλακή CDE από πελάτη', () => {
    const citizen = () => env.authenticatedContext(CITIZEN_UID, {}).firestore();

    it('γέννηση με `companyId` → deny', async () => {
      await assertFails(
        citizen().collection(COLLECTION).doc('pseudo').set({ ...personalFilePayload(CITIZEN_UID, 'pseudo'), companyId: 'comp_x' }),
      );
    });

    it('γέννηση με `cdeState` ή `cdeReadReach` → deny', async () => {
      const base = personalFilePayload(CITIZEN_UID, 'cde');
      await assertFails(citizen().collection(COLLECTION).doc('cde-1').set({ ...base, cdeState: 'WIP' }));
      await assertFails(citizen().collection(COLLECTION).doc('cde-2').set({ ...base, cdeReadReach: 'tenant' }));
    });

    it('γέννηση απευθείας `ready` → deny', async () => {
      await assertFails(citizen().collection(COLLECTION).doc('ready').set(personalFilePayload(CITIZEN_UID, 'ready', 'ready')));
    });

    it('🔑 διαδοχή εκδόσεων ΜΟΝΟ από τον γραφέα: ο κάτοχος δεν γράφει `supersededByFileId`', async () => {
      await seedPersonalFile(env, DOC_ID, CITIZEN_UID);
      const ref = citizen().collection(COLLECTION).doc(DOC_ID);
      await assertFails(ref.update({ supersededByFileId: 'file-personal-2' }));
      await assertFails(ref.update({ companyId: 'comp_x' }));
    });

    it('🔑 ό,τι σφράγισε ο γραφέας δεν αφαιρείται από τον πελάτη', async () => {
      await seedPersonalFile(env, DOC_ID, CITIZEN_UID, { supersededByFileId: 'file-personal-2', supersededAt: new Date() });
      const ref = citizen().collection(COLLECTION).doc(DOC_ID);
      await assertSucceeds(ref.update({ displayName: 'παλιά έκδοση' }));
      await assertFails(ref.update({ supersededAt: new Date() }));
    });

    // 🔒 ADR-864 §21 — ΙΔΙΑ λίστα δέσμευσης με το `match /files` (`holdCustodyKeys()`).
    it('🔑 ο κάτοχος δεν αυτο-δεσμεύει: γέννηση ή update με `hold` / `retentionUntil` → deny', async () => {
      await assertFails(citizen().collection(COLLECTION).doc('held').set({ ...personalFilePayload(CITIZEN_UID, 'held'), hold: 'legal' }));
      await seedPersonalFile(env, DOC_ID, CITIZEN_UID);
      const ref = citizen().collection(COLLECTION).doc(DOC_ID);
      await assertFails(ref.update({ retentionUntil: '2999-01-01T00:00:00.000Z' }));
      await assertSucceeds(ref.update({ displayName: 'χωρίς δέσμευση' }));
    });

    it('🔑 Δ21.1 δεσμευμένο από τον διακομιστή: κάδος ✅ · αποδέσμευση ✗ · οριστική διαγραφή ✗', async () => {
      await seedPersonalFile(env, DOC_ID, CITIZEN_UID, { hold: 'legal', holdPlacedBy: 'uid_legal_manager' });
      const ref = citizen().collection(COLLECTION).doc(DOC_ID);
      await assertFails(ref.update({ hold: 'none' }));
      await assertFails(ref.delete());
      await assertSucceeds(ref.update({ isDeleted: true }));
    });
  });

  // ==========================================================================
  // 🔴 Π5 — ΚΩΔΙΚΑΣ ΚΑΙ ΚΑΝΟΝΑΣ ΣΥΜΦΩΝΟΥΝ (ADR-866 §5.2 · βήμα 2β.2)
  // ==========================================================================
  // Τα Π1-Π4 στέλνουν το χειρόγραφο `personalFilePayload`. Εδώ το φορτίο βγαίνει από τον
  // ΠΡΑΓΜΑΤΙΚΟ builder και τη ΠΡΑΓΜΑΤΙΚΗ δήλωση διαμερίσματος (`FILE_COLLECTION`): αν ο κλάδος
  // ανθρώπου αποκτήσει ποτέ `companyId`/`cdeReadReach`, ή αν το διαμέρισμα αλλάξει όνομα, **αυτή**
  // η σουίτα κοκκινίζει — όχι η παραγωγή.
  describe('🔴 Π5 — το φορτίο του ΠΡΑΓΜΑΤΙΚΟΥ builder περνά τον κανόνα', () => {
    const personalCollection = COLLECTIONS[FILE_COLLECTION.personal];

    function birth(userId: string) {
      return buildPendingFileRecordData({
        userId,
        createdBy: userId,
        entityType: 'property',
        entityId: 'prop-1',
        domain: 'legal',
        category: 'contracts',
        originalFilename: 'συμβόλαιο.pdf',
        contentType: 'application/pdf',
      });
    }

    it('γέννηση → οριστικοποίηση → κάδος → επαναφορά, με τα σχήματα του κώδικα', async () => {
      const { fileId, recordBase } = birth(CITIZEN_UID);
      const ref = env.authenticatedContext(CITIZEN_UID, {}).firestore().collection(personalCollection).doc(fileId);

      await assertSucceeds(ref.set({ ...recordBase, createdAt: new Date() }));
      await assertSucceeds(ref.update({
        ...buildFinalizeFileRecordUpdate({ sizeBytes: 2048, downloadUrl: 'https://example.test/x.pdf' }),
        updatedAt: new Date(),
      }));
      await assertSucceeds(ref.update({
        lifecycleState: 'trashed', trashedAt: new Date(), trashedBy: CITIZEN_UID, purgeAt: new Date().toISOString(),
        isDeleted: true, deletedAt: new Date(), deletedBy: CITIZEN_UID, updatedAt: new Date(),
      }));
      await assertSucceeds(ref.update({
        lifecycleState: 'active', isDeleted: false, trashedAt: null, trashedBy: null, purgeAt: null,
        deletedAt: null, deletedBy: null, restoredAt: new Date(), restoredBy: CITIZEN_UID, updatedAt: new Date(),
      }));
    });

    it('🔴 το ίδιο φορτίο στο ΕΤΑΙΡΙΚΟ διαμέρισμα → deny (κανένας κλάδος ανθρώπου στο `files`)', async () => {
      const { fileId, recordBase } = birth(CITIZEN_UID);
      const db = env.authenticatedContext(CITIZEN_UID, {}).firestore();
      await assertFails(db.collection(COLLECTIONS[FILE_COLLECTION.company]).doc(fileId).set({ ...recordBase, createdAt: new Date() }));
    });
  });

  // ==========================================================================
  // 🔴 Π6 — ΜΕΤΑ ΤΗ ΔΙΑΔΟΧΗ: Ο ΚΑΤΟΧΟΣ ΒΛΕΠΕΙ **ΚΑΙ ΤΙΣ ΔΥΟ** ΕΚΔΟΣΕΙΣ
  // ==========================================================================
  // ADR-866 βήμα 2β.3β · Ε-Φ0-1. Ο ΕΝΑΣ γραφέας τρέχει με **Admin SDK**, δηλαδή παρακάμπτει
  // τους κανόνες — άρα ό,τι γράφει είναι ακριβώς αυτό που πρέπει να **επαληθευτεί από τη μεριά
  // του πελάτη**. Η ερώτηση δεν είναι «γράφτηκε;» (το λέει η άγκυρα Α34) αλλά:
  //
  //   🔑 *«μετά την αρχειοθέτηση, ο άνθρωπος εξακολουθεί να ΔΙΑΒΑΖΕΙ την παλιά του έκδοση;»*
  //
  // 🔴 ΓΙΑΤΙ ΕΧΕΙ ΣΗΜΑΣΙΑ: στο εταιρικό διαμέρισμα η αρχειοθέτηση συνοδεύεται από `cdeState:
  // SUPERSEDED` και φράχτη ανάγνωσης. Αν το ίδιο συνέβαινε εδώ, ο κάτοχος θα **έχανε** το
  // ιστορικό του — ακριβώς το σφάλμα που το `versions-only` υπάρχει για να αποτρέψει (UK BIM
  // Part C §6.3 «Continuous Archiving»: το superseded **μένει αναγνώσιμο**).
  describe('🔴 Π6 — μετά τη διαδοχή του γραφέα, ο κάτοχος διαβάζει προκάτοχο ΚΑΙ διάδοχο', () => {
    const PREV = 'file-personal-prev';
    const NEXT = 'file-personal-next';

    /** Ό,τι γράφει ο γραφέας στον προκάτοχο — **μόνο** διαδοχή, κανένα `cde*`. */
    const SUCCESSION = {
      supersededByFileId: NEXT,
      supersededAt: new Date(),
      lifecycleState: 'archived',
      archivedAt: new Date(),
      archivedBy: CITIZEN_UID,
    } as const;

    beforeEach(async () => {
      await seedPersonalFile(env, PREV, CITIZEN_UID, { ...SUCCESSION });
      await seedPersonalFile(env, NEXT, CITIZEN_UID);
    });

    it('✅ διαβάζει **και τα δύο** έγγραφα, και η λίστα του τα φέρνει μαζί', async () => {
      const db = env.authenticatedContext(CITIZEN_UID, {}).firestore();

      await assertSucceeds(db.collection(COLLECTION).doc(PREV).get());
      await assertSucceeds(db.collection(COLLECTION).doc(NEXT).get());
      // Η στοίβα του διακομιστή ρωτά με **αυτό** το φίλτρο (`version-stack.predecessorQuery`):
      // αν ο κανόνας το απέρριπτε, ο κάτοχος δεν θα έβλεπε ΚΑΜΙΑ παλιά έκδοση.
      await assertSucceeds(
        db.collection(COLLECTION)
          .where('userId', '==', CITIZEN_UID)
          .where('supersededByFileId', '==', NEXT)
          .get(),
      );
    });

    it('🔴 ΞΕΝΟΣ δεν διαβάζει καμία από τις δύο', async () => {
      const stranger = env.authenticatedContext('some-other-citizen', {}).firestore();
      await assertFails(stranger.collection(COLLECTION).doc(PREV).get());
      await assertFails(stranger.collection(COLLECTION).doc(NEXT).get());
    });

    it('🔴 ό,τι σφράγισε ο γραφέας ΔΕΝ ξηλώνεται: ο κάτοχος δεν σπάει τον δεσμό διαδοχής', async () => {
      const ref = env.authenticatedContext(CITIZEN_UID, {}).firestore().collection(COLLECTION).doc(PREV);

      await assertFails(ref.update({ supersededByFileId: 'file-personal-other' }));
      await assertFails(ref.update({ supersededByFileId: null }));
      await assertFails(ref.update({ supersededAt: new Date() }));
      // ⚠️ Ό,τι **δεν** είναι θεματοφυλακή μένει δικό του: μετονομασία επιτρέπεται.
      await assertSucceeds(ref.update({ displayName: 'έκδοση 1 (παλιά)' }));
    });
  });
});
