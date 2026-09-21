/**
 * Firestore Rules — συλλογή `network_threads` + οι δύο υποσυλλογές της (ADR-867 Β4)
 *
 * Σχήμα κανόνα (`firestore.rules`):
 *   - `get`:    `exists(network_audience/{uid}) && get(...).data.until == null`
 *   - `list`:   `if false` — το ακροατήριο είναι **υποσυλλογή**, δεν φιλτράρεται
 *   - γραφές:   `if false` — **ένας** γραφέας διακομιστή, μέσα σε συναλλαγή
 *   - `network_messages/*` · `network_audience/*`: **ίδια** ερώτηση ανάγνωσης
 *   - `network_audience_private/{uid}` (Ε9): **μόνο** ο ίδιος (`uid == auth.uid`) και μόνο όσο διαβάζει· λίστα ΠΟΤΕ
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ Ο ΠΙΝΑΚΑΣ ΤΩΝ 35 **ΔΕΝ ΜΠΟΡΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Α1. Η ΣΦΡΑΓΙΔΑ.** Ο πίνακας έχει **ένα** σπαρμένο ακροατήριο, άρα ξεχωρίζει μόνο
 *   *«μέσα»* από *«απ' έξω»*. Η **πραγματική** ερώτηση του ADR-834 (ε) είναι τρίτη:
 *   *«ήμουν μέσα, βγήκα — διαβάζω;»*. Ένας κανόνας με σκέτο `exists()` θα ήταν
 *   **πράσινος σε όλα τα 35 κελιά** και θα έδινε πρόσβαση σε **κάθε πρώην μέλος, για
 *   πάντα**. Αυτό το κελί δεν υπάρχει στον πίνακα· υπάρχει εδώ.
 *
 *   **Α2. ΟΙ ΥΠΟΣΥΛΛΟΓΕΣ.** Ο πίνακας μιλά **μόνο** για το γονικό έγγραφο. Τα μηνύματα
 *   είναι το **περιεχόμενο** — ένα νήμα κλειστό με μηνύματα ανοιχτά είναι κλειδωμένη
 *   πόρτα δίπλα σε ανοιχτό παράθυρο.
 *
 *   **Α3. 🔑 Ο ΑΝΤΙΣΥΜΒΑΛΛΟΜΕΝΟΣ ΕΙΝΑΙ `external_user`, ΚΑΙ ΔΙΑΒΑΖΕΙ.** Ο πίνακας τον
 *   δείχνει **μόνο** ως άρνηση (δεν είναι σπαρμένος στο ακροατήριο). Χωρίς αυτή την
 *   άγκυρα, ένας κανόνας που έλεγε `isInternalUser()` θα περνούσε **και τα 35 κελιά** —
 *   και θα είχε κλείσει έξω **τον πελάτη**, δηλαδή τη μισή συνομιλία.
 *
 *   **Α4. ΤΟ ΑΚΡΟΑΤΗΡΙΟ ΕΙΝΑΙ ΟΡΑΤΟ ΣΤΟ ΑΚΡΟΑΤΗΡΙΟ, ΜΕ ΤΟ «ΑΠΟ ΠΟΤΕ».** Είναι
 *   **χαρακτηριστικό** (ADR-834 (ε) 🏆), όχι διαρροή — και κανένα κελί άρνησης δεν μπορεί
 *   να αποδείξει ότι κάτι **φαίνεται**.
 *
 *   **Α5. Η ΑΥΤΟΠΡΟΣΚΛΗΣΗ.** Το `same_tenant_admin × create → deny` του πίνακα αφορά το
 *   **νήμα**. Η επικίνδυνη γραφή είναι στην **υποσυλλογή ακροατηρίου**: μία γραμμή με το
 *   δικό σου uid και ο κανόνας ανάγνωσης σε δέχεται — **σωστά**, γιατί η γραμμή θα ήταν
 *   αληθινή. Η πόρτα δεν είναι το νήμα· είναι το ακροατήριο.
 *
 * @since 2026-09-17 (ADR-867 Β4)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { assertCell, type AssertTarget } from '../_harness/assertions';
import { getContext } from '../_harness/auth-contexts';
import { initEmulator, resetData, teardownEmulator } from '../_harness/emulator';
import {
  NETWORK_THREADS,
  NETWORK_THREAD_AUDIENCE,
  NETWORK_THREAD_AUDIENCE_PRIVATE,
  NETWORK_THREAD_MESSAGES,
  seedNetworkActThread,
} from '../_harness/seed-helpers-network';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'network_threads',
)!;

const THREAD_ID = 'nthr-seed-1';

/** Ο υπάλληλος του γραφείου που **ανέλαβε** την πράξη — το μόνο ζωντανό μέλος του πίνακα. */
const RESPONSIBLE_UID = PERSONA_CLAIMS.same_tenant_user.uid;
/** Ο ιδιοκτήτης στην **άλλη** πλευρά — ιδιώτης, άρα `external_user` (ADR-798). */
const COUNTERPART_UID = PERSONA_CLAIMS.external_user.uid;

/** Το ακροατήριο του πίνακα: **μόνο** ο υπεύθυνος. */
const MATRIX_AUDIENCE = [
  { uid: RESPONSIBLE_UID, side: 'host', role: 'responsible', until: null },
] as const;

describe('network_threads.rules — διαβάζει ΟΠΟΙΟΣ ΕΧΕΙ ΖΩΝΤΑΝΗ ΓΡΑΜΜΗ ΑΚΡΟΑΤΗΡΙΟΥ (ADR-867 §4.2)', () => {
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
        await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, MATRIX_AUDIENCE);

        const target: AssertTarget = {
          collection: NETWORK_THREADS,
          docId: THREAD_ID,
          data: { lastMessageAt: '2026-09-17T10:00:00.000Z' },
          createData: {
            id: 'nthr-forged',
            topic: { kind: 'act', actKind: 'mandate', actSeed: 'x:y', hostCompanyId: 'company-a', counterpartUid: COUNTERPART_UID },
            state: 'open',
            createdAt: '2026-09-17T10:00:00.000Z',
            lastMessageAt: null,
          },
          // ⚠️ **Κανένα φίλτρο, επίτηδες**: δεν υπάρχει πεδίο να φιλτράρει κανείς — η
          //    άδεια ζει σε **υποσυλλογή**. Η αφιλτράριστη λίστα είναι ο **μόνος**
          //    τρόπος που θα το ζητούσε πελάτης, και απορρίπτεται για όλους.
        };

        await assertCell(getContext(env, cell.persona), cell, target);
      });
    });
  }

  // ==========================================================================
  // Α1 — Η ΣΦΡΑΓΙΔΑ: «ήμουν μέσα, βγήκα»
  // ==========================================================================

  describe('🔴 Α1 — σφραγισμένη γραμμή (`until != null`) ⇒ ΚΑΜΙΑ ανάγνωση', () => {
    const SEALED_AUDIENCE = [
      { uid: RESPONSIBLE_UID, side: 'host', role: 'responsible', until: null },
      { uid: PERSONA_CLAIMS.same_tenant_admin.uid, side: 'host', role: 'collaborator', until: '2026-09-16T12:00:00.000Z' },
    ] as const;

    it('ο ΠΡΩΗΝ συνεργάτης δεν διαβάζει το νήμα — παρότι η γραμμή του ΥΠΑΡΧΕΙ', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, SEALED_AUDIENCE);
      const former = getContext(env, 'same_tenant_admin');

      await assertFails(former.firestore().collection(NETWORK_THREADS).doc(THREAD_ID).get());
    });

    it('🔑 ούτε τα ΜΗΝΥΜΑΤΑ — αλλιώς η σφραγίδα θα ήταν διακοσμητική', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, SEALED_AUDIENCE);
      const former = getContext(env, 'same_tenant_admin');

      await assertFails(
        former
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_MESSAGES)
          .get(),
      );
    });

    it('ο ΖΩΝΤΑΝΟΣ υπεύθυνος στο ΙΔΙΟ σπαρμένο νήμα διαβάζει — ο παρονομαστής της άγκυρας', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, SEALED_AUDIENCE);
      const live = getContext(env, 'same_tenant_user');

      await assertSucceeds(live.firestore().collection(NETWORK_THREADS).doc(THREAD_ID).get());
    });
  });

  // ==========================================================================
  // Α2 + Α3 — ΟΙ ΥΠΟΣΥΛΛΟΓΕΣ, ΚΑΙ Ο ΠΕΛΑΤΗΣ ΠΟΥ ΔΙΑΒΑΖΕΙ
  // ==========================================================================

  describe('🔴 Α2/Α3 — τα μηνύματα ακολουθούν το νήμα, ΚΑΙ ΣΤΙΣ ΔΥΟ κατευθύνσεις', () => {
    const BOTH_SIDES = [
      { uid: RESPONSIBLE_UID, side: 'host', role: 'responsible', until: null },
      { uid: COUNTERPART_UID, side: 'counterpart', role: 'counterpart', until: null },
    ] as const;

    it('🔑 ο ΙΔΙΟΚΤΗΤΗΣ (`external_user`, ΑΛΛΟΣ χώρος) διαβάζει νήμα ΚΑΙ μηνύματα', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, BOTH_SIDES);
      const owner = getContext(env, 'external_user');

      await assertSucceeds(owner.firestore().collection(NETWORK_THREADS).doc(THREAD_ID).get());

      const messages = await assertSucceeds(
        owner
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_MESSAGES)
          .get(),
      );
      expect(messages.size).toBe(1);
    });

    it('🔴 ο διαχειριστής ΤΟΥ ΙΔΙΟΥ γραφείου, εκτός ομάδας, δεν διαβάζει μήνυμα', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, BOTH_SIDES);

      for (const persona of ['same_tenant_admin', 'super_admin', 'cross_tenant_user'] as const) {
        const ctx = getContext(env, persona);
        await assertFails(
          ctx
            .firestore()
            .collection(NETWORK_THREADS)
            .doc(THREAD_ID)
            .collection(NETWORK_THREAD_MESSAGES)
            .doc('nmsg-seed-1')
            .get(),
        );
      }
    });

    it('🔴 ούτε ο ανώνυμος — και είναι το ίδιο πρόσωπο που βλέπει τη ΔΗΜΟΣΙΑ αγγελία', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, BOTH_SIDES);
      const anon = env.unauthenticatedContext();

      await assertFails(anon.firestore().collection(NETWORK_THREADS).doc(THREAD_ID).get());
    });
  });

  // ==========================================================================
  // Α4 — «ΠΟΙΟΙ ΔΙΑΒΑΖΟΥΝ», ΚΑΙ ΑΠΟ ΠΟΤΕ
  // ==========================================================================

  describe('🏆 Α4 — η λίστα ακροατηρίου είναι ΟΡΑΤΗ στο ακροατήριο, με το «από πότε»', () => {
    const BOTH_SIDES = [
      { uid: RESPONSIBLE_UID, side: 'host', role: 'responsible', until: null },
      { uid: COUNTERPART_UID, side: 'counterpart', role: 'counterpart', until: null },
    ] as const;

    it('ο ιδιοκτήτης βλέπει ΠΟΙΟΙ του απαντούν και ΑΠΟ ΠΟΤΕ', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, BOTH_SIDES);
      const owner = getContext(env, 'external_user');

      const audience = await assertSucceeds(
        owner
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_AUDIENCE)
          .get(),
      );

      expect(audience.size).toBe(2);
      const host = audience.docs.find((d) => d.id === RESPONSIBLE_UID);
      // 🔑 Το `since` είναι Ο ΛΟΓΟΣ που η λίστα είναι ορατή. Χωρίς αυτόν τον ισχυρισμό,
      //    η δοκιμή θα ήταν πράσινη και για λίστα που δεν λέει **τίποτα**.
      expect(host?.data().since).toBe('2026-09-17T09:00:00.000Z');
      expect(host?.data().until).toBeNull();
    });

    it('🔴 ο τρίτος ΔΕΝ βλέπει ποιοι διαβάζουν — η διαφάνεια είναι προς τα ΜΕΣΑ', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, BOTH_SIDES);
      const stranger = getContext(env, 'cross_tenant_admin');

      await assertFails(
        stranger
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_AUDIENCE)
          .get(),
      );
    });
  });

  // ==========================================================================
  // Α5 — Η ΑΥΤΟΠΡΟΣΚΛΗΣΗ: Η ΜΙΑ ΠΙΣΩ ΠΟΡΤΑ
  // ==========================================================================

  describe('🔴 Α5 — κανείς δεν γράφει γραμμή ακροατηρίου, ΟΥΤΕ ΓΙΑ ΤΟΝ ΕΑΥΤΟ ΤΟΥ', () => {
    it('τρίτος που γράφει τη ΔΙΚΗ του γραμμή → deny (αλλιώς μπαίνει σε ξένη συνομιλία)', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, MATRIX_AUDIENCE);
      const intruder = getContext(env, 'same_tenant_admin');
      const uid = PERSONA_CLAIMS.same_tenant_admin.uid;

      await assertFails(
        intruder
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_AUDIENCE)
          .doc(uid)
          .set({
            uid,
            side: 'host',
            role: 'collaborator',
            reason: 'admin-self',
            addedBy: uid,
            since: '2026-09-17T11:00:00.000Z',
            until: null,
            lastReadAt: null,
            muted: false,
            following: false,
          }),
      );
    });

    it('🔑 ούτε ΤΟ ΙΔΙΟ ΤΟ ΜΕΛΟΣ αγγίζει τη γραμμή του — το `lastReadAt` περνά από τον διακομιστή', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, MATRIX_AUDIENCE);
      const member = getContext(env, 'same_tenant_user');

      await assertFails(
        member
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_AUDIENCE)
          .doc(RESPONSIBLE_UID)
          .update({ lastReadAt: '2026-09-17T11:00:00.000Z' }),
      );
    });

    it('🔴 ούτε μήνυμα γράφει το μέλος — η αποστολή είναι ΣΥΝΑΛΛΑΓΗ διακομιστή', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, MATRIX_AUDIENCE);
      const member = getContext(env, 'same_tenant_user');

      await assertFails(
        member
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_MESSAGES)
          .doc('nmsg-forged')
          .set({
            id: 'nmsg-forged',
            senderUid: RESPONSIBLE_UID,
            text: 'γραμμένο από τον πελάτη',
            createdAt: '2026-09-17T11:00:00.000Z',
            editedAt: null,
            retractedAt: null,
          }),
      );
    });

    it('🔴 ούτε σβήνει μήνυμα — η ανάκληση είναι ταφόπλακα του διακομιστή, ποτέ διαγραφή', async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, MATRIX_AUDIENCE);
      const member = getContext(env, 'same_tenant_user');

      await assertFails(
        member
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_MESSAGES)
          .doc('nmsg-seed-1')
          .delete(),
      );
    });
  });

  // ==========================================================================
  // Α8 — 🔒 Ε9: Η ΙΔΙΩΤΙΚΗ ΠΛΕΥΡΑ ΤΗΣ ΘΕΣΗΣ — ΜΟΝΟ Ο ΙΔΙΟΣ
  // ==========================================================================

  describe('🔒 Α8 — σίγαση · follow · «διαβάστηκε»: τα βλέπει ΜΟΝΟ ο ίδιος (ADR-867 Ε9)', () => {
    const WITH_SEALED = [
      { uid: RESPONSIBLE_UID, side: 'host', role: 'responsible', until: null },
      { uid: COUNTERPART_UID, side: 'counterpart', role: 'counterpart', until: null },
      { uid: PERSONA_CLAIMS.same_tenant_admin.uid, side: 'host', role: 'collaborator', until: '2026-09-17T09:30:00.000Z' },
    ] as const;

    const privateDoc = (persona: Parameters<typeof getContext>[1], uid: string) =>
      getContext(env, persona)
        .firestore()
        .collection(NETWORK_THREADS)
        .doc(THREAD_ID)
        .collection(NETWORK_THREAD_AUDIENCE_PRIVATE)
        .doc(uid);

    beforeEach(async () => {
      await seedNetworkActThread(env, THREAD_ID, COUNTERPART_UID, WITH_SEALED);
    });

    it('ο ίδιος διαβάζει τη ΔΙΚΗ του πλευρά (αλλιώς το «ιδιωτικό» θα ήταν «χαμένο»)', async () => {
      const mine = await assertSucceeds(privateDoc('external_user', COUNTERPART_UID).get());
      expect(mine.data()?.muted).toBe(true);
      await assertSucceeds(privateDoc('same_tenant_user', RESPONSIBLE_UID).get());
    });

    it('🔴 Η ΑΛΛΗ ΠΛΕΥΡΑ δεν διαβάζει τη σίγαση/το follow/την ανάγνωση — ΚΑΙ ΣΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ (το Ε9)', async () => {
      await assertFails(privateDoc('external_user', RESPONSIBLE_UID).get());
      await assertFails(privateDoc('same_tenant_user', COUNTERPART_UID).get());
    });

    it('🔴 ΚΑΜΙΑ λίστα — ούτε από μέλος που διαβάζει (θα ρωτούσε τα ιδιωτικά ΟΛΩΝ)', async () => {
      await assertFails(
        getContext(env, 'external_user')
          .firestore()
          .collection(NETWORK_THREADS)
          .doc(THREAD_ID)
          .collection(NETWORK_THREAD_AUDIENCE_PRIVATE)
          .get(),
      );
    });

    it('🔴 ο ΣΦΡΑΓΙΣΜΕΝΟΣ δεν διαβάζει ούτε τη δική του — μόνο όποιος διαβάζει ΤΩΡΑ', async () => {
      await assertFails(privateDoc('same_tenant_admin', PERSONA_CLAIMS.same_tenant_admin.uid).get());
    });

    it('🔴 ο τρίτος και ο super_admin: άρνηση', async () => {
      await assertFails(privateDoc('cross_tenant_admin', RESPONSIBLE_UID).get());
      await assertFails(privateDoc('super_admin', RESPONSIBLE_UID).get());
    });

    it('🔴 καμία γραφή — ούτε ο ίδιος στη δική του (η σίγαση περνά από τον διακομιστή)', async () => {
      await assertFails(privateDoc('external_user', COUNTERPART_UID).set({ muted: false }, { merge: true }));
      await assertFails(privateDoc('external_user', COUNTERPART_UID).delete());
    });
  });
});
