/**
 * Firestore Rules — συλλογή `first_contact_invitations` (ADR-844)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** περνούν
 * από τον διακομιστή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΤΟ `deny_all` ΤΗΣ ΟΙΚΟΓΕΝΕΙΑΣ, ΤΡΙΤΟΣ ΛΟΓΟΣ — ΚΑΙ ΑΥΤΟΣ ΕΙΝΑΙ **ΜΥΣΤΙΚΟ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στο `mandate_requests` κρύβαμε **το πρόσωπο**. Στο `first_contacts` προστατεύαμε τον
 * **ΕΝΑΝ γραφέα** *(η χωρητικότητα κρίνεται μετρώντας, και κανόνας δεν μετρά)*.
 *
 * Εδώ το έγγραφο κρατά **διαπιστευτήρια**:
 *
 * | Πεδίο | Τι δίνει μια ανάγνωση |
 * |---|---|
 * | `codeHash` | το αποτύπωμα του **εξαψήφιου** κωδικού — ένα εκατομμύριο συνδυασμοί, δοκιμάσιμοι **εκτός** του μετρητή μας |
 * | `nonce` | το μισό του υπογεγραμμένου συνδέσμου |
 * | `declaration.disclosure` | όνομα, email, τηλέφωνο ανθρώπου **που δεν έχει καν λογαριασμό** |
 * | `demandId` | κλειδί προς το **επίπεδο Β** — SPEC-777A §12.7(α) |
 *
 * ⇒ Η διαρροή εδώ δεν είναι «είδε κάποιος κάτι»· είναι **«έστειλε κάποιος μήνυμα στο
 * όνομα άλλου ανθρώπου, με τα δικά του στοιχεία μέσα»**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΙ Η **ΓΡΑΦΗ** ΕΙΝΑΙ ΧΕΙΡΟΤΕΡΗ ΑΠΟ ΤΗΝ ΑΝΑΓΝΩΣΗ, ΚΑΙ ΕΙΝΑΙ ΑΝΤΙ-ΔΙΑΙΣΘΗΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `attempts` είναι ο **μόνος** φρουρός ωμής βίας που είναι **ανά πρόσκληση**. Το rate
 * limit της πόρτας είναι ανά **IP**, και η IP αλλάζει με ένα proxy. Πελάτης που μπορεί
 * να γράψει `attempts: 0` έχει **άπειρες** δοκιμές σε έξι ψηφία.
 *
 * ⚠️ **Ο `denyAllMatrix` ΔΕΝ πιάνει τίποτα από αυτά μόνος του.** Αρνείται σε όλους, άρα
 * κάθε κελί περνά **ούτως ή άλλως** — ακόμη κι αν ο κανόνας χαλαρώσει, αρκεί κανένα
 * σπαρμένο έγγραφο να μην **αφορά** τον δοκιμαζόμενο. Γι' αυτό υπάρχουν οι άγκυρες
 * παρακάτω, και γι' αυτό ο seeder στέλνει τον στόχο σε **persona που υποδυόμαστε**.
 *
 * @since 2026-09-05 (ADR-844 Β6)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import {
  SEED_INVITATION_EMAIL,
  seedFirstContactInvitation,
} from '../_harness/seed-helpers-contact';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'first_contact_invitations',
)!;

describe('first_contact_invitations.rules — το έγγραφο κρατά ΜΥΣΤΙΚΟ, όχι μόνο δεδομένα', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  // ==========================================================================
  // ΑΓΚΥΡΑ 1 — Ο ΠΑΡΑΛΗΠΤΗΣ. «Μα εγώ είμαι αυτός που τον πλησιάζουν.»
  // ==========================================================================

  describe('🔴 ούτε ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ-ΣΤΟΧΟΣ, που κάποιος πλησιάζει αυτή τη στιγμή', () => {
    const INVITATION_ID = 'fcin_anchor_0001';

    it('δεν διαβάζει το έγγραφο — και μαζί του θα έπαιρνε τον `codeHash` ΚΑΙ το `nonce`', async () => {
      await seedFirstContactInvitation(env(), INVITATION_ID);

      const recipient = getContext(env(), 'same_tenant_admin');

      await assertFails(
        recipient.firestore().collection('first_contact_invitations').doc(INVITATION_ID).get(),
      );
    });

    it('🔑 ούτε με ερώτημα στα «εισερχόμενά του» — ΤΟ ΠΙΟ ΛΟΓΙΚΟ ΧΑΛΑΡΩΜΑ, ΚΑΙ ΤΟ ΠΙΟ ΕΠΙΚΙΝΔΥΝΟ', async () => {
      await seedFirstContactInvitation(env(), INVITATION_ID);

      // ⚠️ Ο στόχος του seed είναι ΑΚΡΙΒΩΣ η εταιρεία αυτού του persona. Αν κάποιος
      //    γράψει `allow read: if …agencyCompanyId == getUserCompanyId()`, ΕΔΩ κοκκινίζει.
      //    Χωρίς αυτό το σκέλος, η μετάλλαξη θα περνούσε αθόρυβα.
      const recipient = getContext(env(), 'same_tenant_admin');

      await assertFails(
        recipient
          .firestore()
          .collection('first_contact_invitations')
          .where('declaration.target.agencyCompanyId', '==', SAME_TENANT_COMPANY_ID)
          .get(),
      );
    });

    it('🔴 ούτε ερώτημα ΜΟΝΟ στις ζωντανές — «θα δω μόνο όσες περιμένουν» δεν είναι μετριασμός', async () => {
      await seedFirstContactInvitation(env(), INVITATION_ID);

      // 🔑 Ο επόμενος θα σκεφτεί ότι φιλτράροντας σε `state == 'sent'` βλέπει «λιγότερα».
      //    Βλέπει **ακριβώς** τις προσκλήσεις που μπορούν ακόμη να εξαργυρωθούν — δηλαδή
      //    τις **μόνες** που αξίζει να κλέψει κανείς.
      const recipient = getContext(env(), 'same_tenant_admin');

      await assertFails(
        recipient
          .firestore()
          .collection('first_contact_invitations')
          .where('state', '==', 'sent')
          .get(),
      );
    });
  });

  // ==========================================================================
  // ΑΓΚΥΡΑ 2 — Ο ΙΔΙΟΣ Ο ΑΝΘΡΩΠΟΣ. «Μα είναι η ΔΙΚΗ ΜΟΥ πρόσκληση.»
  // ==========================================================================

  describe('🔴 ούτε ο ΙΔΙΟΣ ο άνθρωπος που την ζήτησε', () => {
    const INVITATION_ID = 'fcin_anchor_0002';

    it('ο υποψήφιος ζητών δεν τη διαβάζει με το κανάλι του', async () => {
      await seedFirstContactInvitation(env(), INVITATION_ID, SEED_INVITATION_EMAIL);

      // 🔑 **Ο πλησιέστερος δρώντας που έχουμε.** Στην πραγματικότητα ο άνθρωπος αυτός
      //    δεν έχει ΚΑΝ λογαριασμό τη στιγμή της πρόσκλησης — γι' αυτό το έγγραφο δεν
      //    έχει `uid`, και γι' αυτό δεν υπάρχει «δική μου» πρόσκληση να επιτραπεί.
      const seeker = getContext(env(), 'external_user');

      await assertFails(
        seeker
          .firestore()
          .collection('first_contact_invitations')
          .where('channelEmail', '==', SEED_INVITATION_EMAIL)
          .get(),
      );
    });

    it('🔴 ούτε ΓΡΑΦΕΙ — και η γραφή είναι χειρότερη από την ανάγνωση (`attempts`)', async () => {
      await seedFirstContactInvitation(env(), INVITATION_ID);

      // 🔴 Ένα `attempts: 0` από πελάτη ακυρώνει τον **μόνο** φρουρό ωμής βίας που είναι
      //    ανά ΣΤΟΧΟ. Το rate limit της πόρτας είναι ανά IP, και η IP αλλάζει.
      const seeker = getContext(env(), 'external_user');

      await assertFails(
        seeker
          .firestore()
          .collection('first_contact_invitations')
          .doc(INVITATION_ID)
          .update({ attempts: 0 }),
      );
    });

    it('🔴 ούτε ΓΕΝΝΑ πρόσκληση — αλλιώς γράφει μόνος του τον κωδικό που θα «επαληθεύσει»', async () => {
      // ⚠️ **Η πιο ύπουλη από τις τρεις γραφές.** Δεν χρειάζεται να διαβάσει τίποτα:
      //    φτιάχνει πρόσκληση με **δικό του** `codeHash` για **ξένο** στόχο, την
      //    εξαργυρώνει, και η πράξη γεννιέται χωρίς να αποδειχθεί **κανένα** κανάλι.
      const stranger = getContext(env(), 'external_user');

      await assertFails(
        stranger.firestore().collection('first_contact_invitations').doc('fcin_anchor_0003').set({
          id: 'fcin_anchor_0003',
          declaration: {
            target: { kind: 'professional', agencyCompanyId: SAME_TENANT_COMPANY_ID },
            demandId: null,
            disclosure: {
              displayName: 'Μαρία Κ.',
              email: SEED_INVITATION_EMAIL,
              phone: null,
              acceptsPlatformMessages: false,
            },
          },
          channelEmail: SEED_INVITATION_EMAIL,
          nonce: 'nonce_forged_0001',
          codeHash: 'b'.repeat(64),
          attempts: 0,
          state: 'sent',
          createdAt: '2026-09-05T11:00:00.000Z',
          expiresAt: '2026-09-12T11:00:00.000Z',
          redeemedAt: null,
        }),
      );
    });

    it('🔑 ούτε ΔΙΑΓΡΑΦΕΙ — η εκκαθάριση είναι δουλειά του σαρωτή λήξης, με Admin SDK', async () => {
      await seedFirstContactInvitation(env(), INVITATION_ID);

      // ⚠️ **Και δεν είναι ασυνέπεια με το «σβήνεται»** (ADR-844 Β6): η πρόσκληση όντως
      //    διαγράφεται — από **περιοδική εργασία** που τρέχει με ταυτότητα
      //    μηχανής→μηχανής. Πελατική διαγραφή θα επέτρεπε σε τρίτον να σβήσει την
      //    πρόσκληση **ξένου** ανθρώπου πριν προλάβει να πατήσει τον σύνδεσμο.
      const stranger = getContext(env(), 'external_user');

      await assertFails(
        stranger.firestore().collection('first_contact_invitations').doc(INVITATION_ID).delete(),
      );
    });
  });
});
