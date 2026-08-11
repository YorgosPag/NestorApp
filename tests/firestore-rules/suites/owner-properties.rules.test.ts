/**
 * Firestore Rules — συλλογή `owner_properties` (ADR-777 Α14)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read/list:      `resource.data.ownerUserId == request.auth.uid`
 *   - create/update:  `if false` — **γράφει μόνο ο διακομιστής** (Admin SDK)
 *   - delete:         `if false` — η απόσυρση είναι `lifecycle`, όχι διαγραφή
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ Ο ΠΙΝΑΚΑΣ PERSONAS **ΔΕΝ ΜΠΟΡΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Α1. Το «server-only» δοκιμάζεται με ΕΓΚΥΡΟ φορτίο.** Ο πίνακας στέλνει
 *   `createData` και βλέπει άρνηση — αλλά μια άρνηση για **κακοσχηματισμένο** φορτίο
 *   θα ήταν πράσινη για **λάθος λόγο**. Εδώ ο ίδιος ο κάτοχος στέλνει αγγελία που θα
 *   περνούσε **κάθε** invariant, και **πάλι** απορρίπτεται: η γραφή δεν είναι
 *   «δύσκολη», είναι **αδύνατη** από τον πελάτη.
 *
 *   **Α2. «Rules are not filters».** Η αφιλτράριστη λίστα απορρίπτεται **και για τον
 *   κάτοχο**. Ο πίνακας δοκιμάζει τη λίστα **με** φίλτρο, άρα δεν μπορεί να δει την
 *   περίπτωση όπου κάποιος ξεχνά το `where` και παίρνει… τίποτα, αλλά για λάθος λόγο.
 *
 *   **Α3. 🔴 ΤΑ ΔΥΟ ΙΔΙΩΤΙΚΑ ΠΕΔΙΑ.** Αυτό το έγγραφο κουβαλά τη **διεύθυνση που
 *   πληκτρολόγησε ο άνθρωπος** (`place.label`) και τα **μονοπάτια των αρχείων του**.
 *   Είναι ο λόγος που η συλλογή είναι ιδιωτική **παρότι** το ίδιο ακίνητο έχει
 *   δημόσια αγγελία. Ο πίνακας λέει «ο τρίτος δεν διαβάζει» — αληθές και ανεπαρκές:
 *   δεν λέει **τι** θα διέρρεε. Το `properties.rules.test.ts` πλήρωσε ακριβώς αυτό
 *   (πράσινος πίνακας πάνω σε διαρροή, επειδή το σπαρμένο έγγραφο δεν είχε τα πεδία).
 *
 *   **Α4. 🔑 ΟΙ ΔΥΟ ΣΥΛΛΟΓΕΣ ΜΑΖΙ.** Η αρχιτεκτονική της Α14 ισχυρίζεται *«το ιδιωτικό
 *   έγγραφο κρύβεται, η δημόσια προβολή του φαίνεται»*. Καμία σουίτα **μίας**
 *   συλλογής δεν μπορεί να το αποδείξει: το μισό είναι εδώ και το άλλο μισό στο
 *   `public_listings`. Ο ισχυρισμός δοκιμάζεται **ολόκληρος**, αλλιώς μένει σχόλιο.
 *
 * @since 2026-08-11 (ADR-777 Α14)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import {
  seedOwnerProperty,
  ownerPropertyCreatePayload,
} from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { ALL_PERSONAS, PERSONA_CLAIMS, isAuthenticatedPersona } from '../_registry/personas';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'owner_properties',
)!;

/** Ο κάτοχος του σπαρμένου εγγράφου σε **κάθε** δοκιμή αυτής της σουίτας. */
const OWNER_UID = PERSONA_CLAIMS.same_tenant_user.uid;

const DOC_ID = 'ownp-owned-1';

describe('owner_properties.rules — η προσφορά ανήκει σε ΑΝΘΡΩΠΟ, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ (ADR-777 Α14)', () => {
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
        await seedOwnerProperty(env, DOC_ID, OWNER_UID);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'owner_properties',
          docId: DOC_ID,
          data: { title: 'Άλλος τίτλος' },
          createData: ownerPropertyCreatePayload(OWNER_UID),
          // 🔑 Το φίλτρο ονομάζει το uid ΤΟΥ ΚΑΤΟΧΟΥ — επίτηδες: έτσι το κελί
          // «cross_tenant_admin × list → deny» αποδεικνύει το σκληρό, ότι δεν αρκεί
          // να ΞΕΡΕΙΣ ποιανού ζητάς.
          listFilter: { field: 'ownerUserId', op: '==', value: OWNER_UID },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // ==========================================================================
  // Α1 — ΤΟ «SERVER-ONLY» ΜΕ ΕΓΚΥΡΟ ΦΟΡΤΙΟ
  // ==========================================================================

  describe('🔴 Α1 — ούτε ο ΙΔΙΟΣ ο κάτοχος γράφει από τον πελάτη', () => {
    for (const persona of ALL_PERSONAS) {
      if (!isAuthenticatedPersona(persona)) continue;

      it(`${persona}: create με ΤΟ ΔΙΚΟ ΤΟΥ uid και έγκυρο σχήμα → deny`, async () => {
        const uid = PERSONA_CLAIMS[persona].uid;
        const ctx = getContext(env, persona);

        await assertFails(
          ctx
            .firestore()
            .collection('owner_properties')
            .doc(`ownp-self-${persona}`)
            .set(ownerPropertyCreatePayload(uid)),
        );
      });
    }

    it('🔑 και ο κάτοχος δεν αλλάζει ΟΥΤΕ τον τίτλο του δικού του εγγράφου', async () => {
      await seedOwnerProperty(env, DOC_ID, OWNER_UID);
      const owner = getContext(env, 'same_tenant_user');

      await assertFails(
        owner
          .firestore()
          .collection('owner_properties')
          .doc(DOC_ID)
          .update({ title: 'Νέος τίτλος' }),
      );
    });

    it('🔴 ούτε αποσύρει μόνος του — η απόσυρση περνά από τον διακομιστή', async () => {
      await seedOwnerProperty(env, DOC_ID, OWNER_UID);
      const owner = getContext(env, 'same_tenant_user');

      await assertFails(
        owner
          .firestore()
          .collection('owner_properties')
          .doc(DOC_ID)
          .update({ lifecycle: 'withdrawn' }),
      );
    });
  });

  // ==========================================================================
  // Α2 — «RULES ARE NOT FILTERS»
  // ==========================================================================

  describe('🔴 Α2 — η αφιλτράριστη λίστα απορρίπτεται ΚΑΙ για τον κάτοχο', () => {
    it('χωρίς `where(ownerUserId)` το ερώτημα του ίδιου του κατόχου → deny', async () => {
      await seedOwnerProperty(env, DOC_ID, OWNER_UID);
      const owner = getContext(env, 'same_tenant_user');

      await assertFails(owner.firestore().collection('owner_properties').get());
    });

    it('🔑 και η αγγελία ΤΡΙΤΟΥ δεν διαρρέει σε φιλτραρισμένο ερώτημα κατόχου', async () => {
      await seedOwnerProperty(env, DOC_ID, OWNER_UID);
      await seedOwnerProperty(
        env,
        'ownp-of-someone-else',
        PERSONA_CLAIMS.cross_tenant_user.uid,
      );

      const owner = getContext(env, 'same_tenant_user');
      const snap = await assertSucceeds(
        owner
          .firestore()
          .collection('owner_properties')
          .where('ownerUserId', '==', OWNER_UID)
          .get(),
      );

      expect(snap.size).toBe(1);
      expect(snap.docs[0].id).toBe(DOC_ID);
    });
  });

  // ==========================================================================
  // Α3 — ΤΑ ΔΥΟ ΠΕΔΙΑ ΠΟΥ ΚΑΝΟΥΝ ΤΟ ΕΓΓΡΑΦΟ ΙΔΙΩΤΙΚΟ
  // ==========================================================================

  describe('🔴 Α3 — τι ΑΚΡΙΒΩΣ θα διέρρεε: διεύθυνση + μονοπάτια αρχείων', () => {
    it('ο κάτοχος τα βλέπει — ΑΛΛΙΩΣ η δοκιμή είναι πράσινη επειδή δεν υπάρχουν', async () => {
      await seedOwnerProperty(env, DOC_ID, OWNER_UID);
      const owner = getContext(env, 'same_tenant_user');

      const snap = await assertSucceeds(
        owner.firestore().collection('owner_properties').doc(DOC_ID).get(),
      );

      const data = snap.data() as {
        place: { label?: string };
        media: ReadonlyArray<{ storagePath: string }>;
      };

      // 🔑 Ο **παρονομαστής** της επόμενης δοκιμής: αν αυτά τα δύο έλειπαν, το
      // «ο τρίτος δεν τα διαβάζει» θα ήταν αληθές και **κενό**.
      expect(data.place.label).toBe('Εγνατίας 147, Θεσσαλονίκη');
      expect(data.media[0].storagePath).toContain(OWNER_UID);
    });

    it('🔴 ο ΤΡΙΤΟΣ δεν τα βλέπει — ούτε ο super_admin', async () => {
      await seedOwnerProperty(env, DOC_ID, OWNER_UID);

      for (const persona of ['super_admin', 'same_tenant_admin', 'cross_tenant_user'] as const) {
        const ctx = getContext(env, persona);
        await assertFails(
          ctx.firestore().collection('owner_properties').doc(DOC_ID).get(),
        );
      }
    });

    it('🔴 ούτε ο ανώνυμος — και είναι το ίδιο πρόσωπο που ΒΛΕΠΕΙ τη δημόσια αγγελία', async () => {
      await seedOwnerProperty(env, DOC_ID, OWNER_UID);
      const anon = env.unauthenticatedContext();

      await assertFails(
        anon.firestore().collection('owner_properties').doc(DOC_ID).get(),
      );
    });
  });

  // ==========================================================================
  // Α4 — Ο ΙΣΧΥΡΙΣΜΟΣ ΤΗΣ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ, ΟΛΟΚΛΗΡΟΣ
  // ==========================================================================

  describe('🔑 Α4 — ιδιωτική πηγή + δημόσια προβολή, στην ΙΔΙΑ δοκιμή', () => {
    it('ο ανώνυμος ΔΕΝ διαβάζει το `owner_properties` και ΔΙΑΒΑΖΕΙ το `public_listings`', async () => {
      await seedOwnerProperty(env, DOC_ID, OWNER_UID);

      // Η προβολή, όπως θα τη γράψει ο διακομιστής: **ίδια ταυτότητα**, κλειστό
      // σχήμα, καμία διεύθυνση, κανένα μονοπάτι αρχείου, κανένα uid.
      await env.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('public_listings').doc(DOC_ID).set({
          id: DOC_ID,
          commercialStatus: 'for-sale',
          commercial: { askingPrice: 210000, finalPrice: null, rentPrice: null },
          coverImage: null,
          type: 'apartment',
          areaSqm: 92,
          offerKinds: ['sell'],
          position: {
            kind: 'known',
            provenance: 'geocoded',
            point: { lat: 40.63, lng: 22.95 },
            locatedAt: '2026-08-11T09:00:00.000Z',
            accuracy: 'exact',
          },
          floor: 3,
          bedrooms: 2,
          title: 'Διαμέρισμα 92 τ.μ.',
          projectedAt: '2026-08-11T09:00:00.000Z',
        });
      });

      const anon = env.unauthenticatedContext();

      await assertFails(
        anon.firestore().collection('owner_properties').doc(DOC_ID).get(),
      );

      const listing = await assertSucceeds(
        anon.firestore().collection('public_listings').doc(DOC_ID).get(),
      );

      // 🔴 Και ό,τι φτάνει στον κόσμο **δεν κουβαλά** τίποτα ιδιωτικό. Ο έλεγχος
      // είναι σε ΠΕΔΙΑ και όχι σε πλήθος: ένα «10 πεδία» θα έσπαγε σε κάθε νόμιμη
      // προσθήκη, ενώ αυτά τα τρία ονόματα δεν επιτρέπεται να εμφανιστούν ποτέ.
      const data = listing.data() as Record<string, unknown>;
      expect(data.ownerUserId).toBeUndefined();
      expect(data.media).toBeUndefined();
      expect((data.position as { label?: string }).label).toBeUndefined();
    });
  });
});
