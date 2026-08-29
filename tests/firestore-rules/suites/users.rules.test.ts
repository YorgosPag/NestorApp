/**
 * Firestore Rules — `users` collection
 *
 * Pattern: ownership — uid==userId || belongsToCompany read; uid==userId || companyAdmin write.
 *
 * Seed doc: docId = PERSONA_CLAIMS.same_tenant_user.uid ('persona-same-user').
 *   - same_tenant_user × read/update → allow (uid == docId)
 *   - same_tenant_admin × read/update → allow (belongsToCompany / isCompanyAdminOfCompany)
 *   - super_admin × read/update → allow (isSuperAdminOnly + isCompanyAdminOfCompany)
 *   - cross_tenant_admin × all → deny (different company, no uid match)
 *
 * Create note: harness uses fresh docId — same_tenant_user cannot create arbitrary
 * docs (not a company admin, uid != fresh docId → deny). super_admin and
 * same_tenant_admin pass via isCompanyAdminOfCompany.
 *
 * Delete: allow delete: if false — user docs are never client-deleted.
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, expectAllow, expectDeny, type AssertTarget } from '../_harness/assertions';
import { seedUser } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'users',
)!;

describe('users.rules — uid-ownership + companyAdmin write (usersMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  // Seed docId = same_tenant_user.uid so uid==userId paths are exercised
  const docId = PERSONA_CLAIMS.same_tenant_user.uid;

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedUser(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'users',
          docId,
          data: { displayName: 'Updated User', updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            displayName: 'New User',
            email: 'new-user@test.com',
            globalRole: 'internal_user',
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }

  // ── Own-profile signup regression ────────────────────────────────────────
  // The create rule has an `uid == userId` leg that the matrix loop cannot
  // exercise (harness always generates a fresh docId). This block verifies
  // same_tenant_user CAN create their own profile doc (docId == their uid).
  describe('own-profile signup regression', () => {
    it('same_tenant_user × create own uid doc → allow', async () => {
      const ctx = getContext(env, 'same_tenant_user');
      const ownDocRef = ctx.firestore()
        .collection('users')
        .doc(PERSONA_CLAIMS.same_tenant_user.uid);
      await expectAllow(ownDocRef.set({
        companyId: SAME_TENANT_COMPANY_ID,
        displayName: 'Own Profile',
        email: 'own@test.com',
        globalRole: 'internal_user',
        createdAt: new Date(),
      }));
    });
  });

  // ── Ο ΚΑΘΡΕΦΤΗΣ ΠΡΕΠΕΙ ΝΑ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΚΑΘΡΕΦΤΗΣ (ADR-787 §5.3) ─────────
  //
  // 🔴 ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ: μέχρι 2026-08-24 ο κανόνας ήταν `uid == userId` **χωρίς
  // allowlist πεδίων** — ο χρήστης έγραφε ΟΤΙΔΗΠΟΤΕ στο δικό του έγγραφο, και
  // **τρία** σημεία του διακομιστή το διάβαζαν ως αλήθεια (δες το σχόλιο στο
  // `firestore.rules`, match /users/{userId}).
  //
  // ⚠️ ΚΑΙ ΤΑ 26 ΥΠΑΡΧΟΝΤΑ TESTS ΗΤΑΝ ΠΡΑΣΙΝΑ ΠΡΙΝ ΚΑΙ ΜΕΤΑ τη διόρθωση:
  // **καμία** άγκυρα δεν ρωτούσε τι γράφεται, μόνο **ποιος** γράφει. Αυτό είναι
  // το σχήμα CHECK 3.36 — *ένα anchor χωρίς gate είναι σχόλιο*, εδώ στην
  // αντίστροφη μορφή του: *ένα gate χωρίς anchor είναι ευχή*.
  //
  // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ (Κ5/Κ6): χωρίς αυτόν, ένας κανόνας που
  // αρνείται **τα πάντα** θα έβγαζε όλες τις αρνήσεις πράσινες — και θα έσπαγε
  // κάθε σύνδεση στην παραγωγή, με τη σουίτα να το επιβεβαιώνει.
  describe('προνομιακά πεδία — ο καθρέφτης πρέπει να αποδεικνύεται', () => {
    const ownUid = PERSONA_CLAIMS.same_tenant_user.uid;

    /** Το έγγραφο του ίδιου του καλούντος, μέσω του context του. */
    function ownDoc() {
      return getContext(env, 'same_tenant_user').firestore().collection('users').doc(ownUid);
    }

    // ── UPDATE: η βλάβη ──────────────────────────────────────────────────
    it('Κ1 — αυτο-ανύψωση globalRole ≠ claim → DENY', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ globalRole: 'company_admin' }));
    });

    it('Κ2 — αυτο-γραμμένο companyId ≠ claim → DENY (παράκαμψη ADR-660)', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ companyId: 'company-θύμα' }));
    });

    it('Κ3 — αυτο-γραμμένο status → DENY (το γράφει ο διακομιστής)', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ status: 'active' }));
    });

    it('Κ4 — αυτο-γραμμένα permissions → DENY', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ permissions: ['admin_access'] }));
    });

    it('Κ4β — αλλοίωση createdAt → DENY', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ createdAt: new Date(0) }));
    });

    // ── ADR-798 §7: δηλωμένο ≠ επαληθευμένο ──────────────────────────────
    //
    // 🔑 ΔΥΟ ΑΓΚΥΡΕΣ, ΚΑΙ Η ΜΙΑ ΧΩΡΙΣ ΤΗΝ ΑΛΛΗ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ ΤΙΠΟΤΑ.
    // Το `Κ13` μόνο του θα ήταν πράσινο και σε έναν κόσμο όπου ΟΛΟ το προφίλ
    // είναι κλειδωμένο· το `Κ14` μόνο του θα ήταν πράσινο και σε έναν κόσμο
    // όπου **τίποτα** δεν είναι κλειδωμένο. Μαζί ονομάζουν τη **γραμμή**.

    it('Κ13 — δήλωση επαγγέλματος από τον ίδιο → ALLOW (αυτο-δηλωμένο, εκ σχεδιασμού)', async () => {
      // Ο παρονομαστής του Κ14. Το επάγγελμα είναι **ιδιότητα**, όχι δικαίωμα
      // (ADR-798 Α4) — κανείς στον διακομιστή δεν το πιστεύει για εξουσιοδότηση,
      // άρα η ελευθερία εγγραφής είναι **σωστή**, όχι παράλειψη φρουρού.
      await seedUser(env, ownUid);
      await expectAllow(ownDoc().update({
        profession: 'Τοπογράφος Μηχανικός',
        escoUri: 'http://data.europa.eu/esco/occupation/δοκιμή',
        escoLabel: 'Τοπογράφος Μηχανικός',
        iscoCode: '2165',
      }));
    });

    it('Κ14 — αυτο-γραμμένο occupationVerification → DENY (αλλιώς «επαληθευμένο» = «το είπα μόνος μου»)', async () => {
      // 🔴 Ο φρουρός κλειδώνει το πεδίο **ΠΡΙΝ ΥΠΑΡΞΕΙ** (ADR-798 Φάση 2,
      // πρότυπο CHECK 3.43 Κ1). Η υποδοχή attestation είναι η Φάση 5· αν το
      // πεδίο γεννιόταν ξεκλείδωτο, η διάκριση *δηλωμένο ≠ επαληθευμένο* θα
      // πέθαινε τη στιγμή που γεννιέται — και μαζί της ΤΕΕ · ΔΣΑ · ΟΕΕ · QEAA.
      //
      // ⚠️ Αν η Φάση 5 διαλέξει **άλλο όνομα** πεδίου, αυτή η άγκυρα θα μείνει
      // πράσινη πάνω σε ξεκλείδωτο σύστημα — αδρανής φρουρός (ADR-749 §5).
      // Το όνομα είναι **συμβόλαιο**, όχι λεπτομέρεια.
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({
        occupationVerification: { status: 'verified', issuer: 'ΤΕΕ' },
      }));
    });

    // ── UPDATE: ο ΠΑΡΟΝΟΜΑΣΤΗΣ ───────────────────────────────────────────
    it('Κ5 — ο ΝΟΜΙΜΟΣ συγχρονισμός claims (τιμή == claim) → ALLOW', async () => {
      // Το έγγραφο ξεκινά **αποκλίνον** από τα claims, αλλιώς η γραμμή δεν
      // αλλάζει και ο κλάδος του καθρέφτη ΔΕΝ ασκείται ποτέ.
      await seedUser(env, ownUid, { overrides: { globalRole: 'external_user' } });
      await expectAllow(ownDoc().update({
        globalRole: PERSONA_CLAIMS.same_tenant_user.globalRole,
      }));
    });

    it('Κ10 — αλλάζει ΜΟΝΟ το companyId (σωστά) ενώ το globalRole αποκλίνει → ALLOW', async () => {
      // 🔴 ΤΟ ΣΕΝΑΡΙΟ ΠΟΥ ΕΣΠΑΣΕ ΤΗΝ ΠΡΩΤΗ ΓΡΑΦΗ: το έγγραφο κουβαλά
      // `globalRole` που ΔΕΝ καθρεφτίστηκε ποτέ στα claims (παλαιό έγγραφο, ή
      // το `'admin'` του `ensureDevUserProfile`). Ο πελάτης γράφει το ΝΕΟ
      // companyId από το claim και **κρατά** το παλιό globalRole
      // (`auth-context-profile.ts:62-64`). Με έλεγχο «και τα δύο μαζί» ο
      // άνθρωπος έμενε κλειδωμένος έξω από το ίδιο του το προφίλ, εξαιτίας
      // πεδίου που **δεν άλλαξε καν**.
      await seedUser(env, ownUid, {
        overrides: { companyId: 'company-παλιά', globalRole: 'admin' },
      });
      await expectAllow(ownDoc().update({
        companyId: PERSONA_CLAIMS.same_tenant_user.companyId,
      }));
    });

    it('Κ10β — αλλάζει ΜΟΝΟ το companyId σε τιμή ≠ claim → DENY (παρονομαστής του Κ10)', async () => {
      await seedUser(env, ownUid, {
        overrides: { companyId: 'company-παλιά', globalRole: 'admin' },
      });
      await expectDeny(ownDoc().update({ companyId: 'company-θύμα' }));
    });

    it('Κ6 — τα ακίνδυνα πεδία του προφίλ → ALLOW', async () => {
      await seedUser(env, ownUid);
      await expectAllow(ownDoc().update({
        displayName: 'Νέο Όνομα',
        photoURL: 'https://example.test/a.png',
        loginCount: 7,
        updatedAt: new Date(),
      }));
    });

    /**
     * 🧾 **Κ15 — ΤΟ ΑΦΜ ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ, ΟΥΤΕ ΑΠΟ ΤΟΝ ΙΔΙΟΚΤΗΤΗ**
     * (ADR-827 §9.20).
     *
     * 🔴 **Η ΔΙΑΦΟΡΑ ΜΕ ΤΟ Κ13 ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ.** Το επάγγελμα είναι επίσης
     * αυτο-δηλωμένο και **επιτρέπεται** ελεύθερα: κανείς στον διακομιστή δεν το
     * πιστεύει για εξουσιοδότηση. Το ΑΦΜ **μπαίνει σε σύμβαση** που ο νόμος
     * απαιτεί να τον περιέχει (άρθρο 200 §2 Ν.4072/2012) — και ο **mod-11
     * ελεγκτής ΔΕΝ εκφράζεται σε κανόνα Firestore** (δεν υπάρχει βρόχος πάνω
     * στα ψηφία). Ελεύθερη πελατική γραφή θα σήμαινε *«κάθε εννιάδα ψηφίων
     * είναι ΑΦΜ»* ⇒ **άκυρο στοιχείο σε σύμβαση, με πράσινη όψη**.
     *
     * ⚠️ Ο περιορισμός είναι στον **δρόμο**, όχι στο πρόσωπο: το γράφει ο ίδιος
     * ο άνθρωπος — μέσω `/api/account/vat-number`, όπου ο επικυρωτής **τρέχει**.
     *
     * 🔑 Αν αυτό γίνει ποτέ ALLOW, ο φρουρός έχει **πεθάνει σιωπηλά**: η οθόνη
     * θα συνέχιζε να δουλεύει και κανείς δεν θα το μάθαινε μέχρι το πρώτο
     * λάθος ΑΦΜ σε υπογεγραμμένη εντολή.
     */
    it('Κ15 — αυτο-γραφή vatNumber από τον πελάτη → DENY (server-owned)', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ vatNumber: '123456789' }));
    });

    it('Κ16 — ακόμη και ΜΑΖΙ με ακίνδυνα πεδία → DENY (δεν «κρύβεται» σε παρτίδα)', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({
        displayName: 'Νέο Όνομα',
        vatNumber: '123456789',
      }));
    });

    // ── CREATE: η ίδια τρύπα, στη γέννηση ────────────────────────────────
    it('Κ17 — γέννηση προφίλ ΜΕ vatNumber → DENY (ίδιος φρουρός, στη γένεση)', async () => {
      // ⚠️ Χωρίς αυτό, ο φρουρός θα ήταν μισός: ο άνθρωπος που **δεν έχει ακόμη**
      //    έγγραφο θα μπορούσε να γεννήσει ένα με ό,τι ΑΦΜ θέλει, και το update
      //    rule δεν θα το έβλεπε ποτέ. Ίδιο σχήμα με τα Κ7-Κ9.
      await expectDeny(ownDoc().set({
        companyId: null,
        globalRole: null,
        email: 'own@test.com',
        vatNumber: '123456789',
      }));
    });

    it('Κ7 — γέννηση με globalRole ≠ claim → DENY', async () => {
      await expectDeny(ownDoc().set({
        companyId: SAME_TENANT_COMPANY_ID,
        globalRole: 'super_admin',
        email: 'own@test.com',
        createdAt: new Date(),
      }));
    });

    it('Κ8 — γέννηση με status που ΔΕΝ παράγεται από το claim → DENY', async () => {
      // Ο καλών **έχει** tenant claim ⇒ το μόνο συνεπές status είναι 'active'.
      await expectDeny(ownDoc().set({
        companyId: SAME_TENANT_COMPANY_ID,
        globalRole: PERSONA_CLAIMS.same_tenant_user.globalRole,
        status: 'pending',
        email: 'own@test.com',
        createdAt: new Date(),
      }));
    });

    it('Κ9 — γέννηση με status ΠΑΡΑΓΟΜΕΝΟ από το claim → ALLOW (παρονομαστής του Κ8)', async () => {
      await expectAllow(ownDoc().set({
        companyId: SAME_TENANT_COMPANY_ID,
        globalRole: PERSONA_CLAIMS.same_tenant_user.globalRole,
        status: 'active',
        email: 'own@test.com',
        createdAt: new Date(),
      }));
    });
  });
});
