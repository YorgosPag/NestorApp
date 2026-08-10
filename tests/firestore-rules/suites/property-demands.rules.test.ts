/**
 * Firestore Rules — συλλογή `property_demands` (ADR-777 Α9)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read/list: `resource.data.authorUserId == request.auth.uid`
 *   - create:    `request.resource.data.authorUserId == request.auth.uid`
 *   - update:    τα δύο παραπάνω **και** `authorUserId` **αμετάβλητο**
 *   - delete:    `if false` — η απόσυρση είναι `lifecycle`, όχι διαγραφή
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΕΝΑΣ ΠΙΝΑΚΑΣ PERSONAS **ΔΕΝ ΜΠΟΡΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πίνακας απαντά «*ποιος περνά;*» με **ένα** φορτίο. Τρία ερωτήματα αυτής της
 * συλλογής χρειάζονται **άλλο φορτίο ανά persona** ή **δεύτερη κίνηση**, άρα είναι
 * δομικά ανέκφραστα εκεί — και είναι ακριβώς τα τρία που, αν σπάσουν, δεν φαίνεται:
 *
 *   **Α1.** Ο **καθένας** μπορεί να γεννήσει τη **δική του** ζήτηση. Ο πίνακας
 *   δηλώνει `create: deny` για κάθε μη-κάτοχο **επειδή το φορτίο φέρει ξένο uid** —
 *   αν κάποιος έσφιγγε τον κανόνα σε «μόνο ένας συγκεκριμένος χρήστης», ο πίνακας θα
 *   έμενε **ολόκληρος πράσινος**, και η εφαρμογή δεν θα δεχόταν καμία νέα ζήτηση.
 *
 *   **Α2.** Το `authorUserId` είναι **αμετάβλητο**. Χωρίς αυτό, ο κάτοχος «χαρίζει»
 *   τη ζήτησή του σε τρίτο με ένα `update` — δηλαδή **γράφει στο επίπεδο Β άλλου**.
 *   Ο πίνακας λέει μόνο «ο κάτοχος ενημερώνει», που είναι **αληθές και ανεπαρκές**.
 *
 *   **Α3.** Η **αφιλτράριστη** λίστα απορρίπτεται **και για τον κάτοχο**. Ο πίνακας
 *   δοκιμάζει τη λίστα **με** φίλτρο, άρα δεν μπορεί να δει την περίπτωση όπου
 *   κάποιος ξεχνά το `where` και το Firestore του δίνει… τίποτα, αλλά για **λάθος**
 *   λόγο. *«Rules are not filters»* — και η απόδειξη πρέπει να είναι ρητή.
 *
 * 🔑 Είναι το ίδιο μάθημα με τη σουίτα του `public_listings`: εκεί ο πίνακας έλεγε
 * «ο ανώνυμος διαβάζει» και **θα ήταν πράσινος πάνω στη διαρροή**· η άμυνα ήταν το
 * **σχήμα**, όχι ο κανόνας. Εδώ η άμυνα είναι το **αμετάβλητο πεδίο**.
 *
 * @since 2026-08-11 (ADR-777 Α9)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import {
  seedPropertyDemand,
  propertyDemandCreatePayload,
} from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { ALL_PERSONAS, PERSONA_CLAIMS, isAuthenticatedPersona } from '../_registry/personas';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'property_demands',
)!;

/** Ο κάτοχος του σπαρμένου εγγράφου σε **κάθε** δοκιμή αυτής της σουίτας. */
const OWNER_UID = PERSONA_CLAIMS.same_tenant_user.uid;

describe('property_demands.rules — η ζήτηση ανήκει σε ΑΝΘΡΩΠΟ (ADR-777 Α9)', () => {
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
        const docId = 'demand-owned-1';
        await seedPropertyDemand(env, docId, OWNER_UID);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'property_demands',
          docId,
          data: { affirmedAt: '2026-08-11T12:00:00.000Z' },
          createData: propertyDemandCreatePayload(OWNER_UID),
          // 🔑 Το φίλτρο ονομάζει το uid ΤΟΥ ΚΑΤΟΧΟΥ — επίτηδες. Έτσι το κελί
          // «cross_tenant_admin × list → deny» αποδεικνύει το σκληρό: δεν αρκεί να
          // ΞΕΡΕΙΣ ποιανού ζητάς, ο κανόνας συγκρίνει με το ΔΙΚΟ σου uid.
          listFilter: { field: 'authorUserId', op: '==', value: OWNER_UID },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // ==========================================================================
  // Α1 — Ο ΚΑΘΕΝΑΣ ΓΕΝΝΑ ΤΗ ΔΙΚΗ ΤΟΥ (ο πίνακας δεν μπορεί: άλλο φορτίο ανά persona)
  // ==========================================================================

  describe('🔑 Α1 — κάθε πιστοποιημένος γεννά τη ΔΙΚΗ ΤΟΥ ζήτηση', () => {
    for (const persona of ALL_PERSONAS) {
      if (!isAuthenticatedPersona(persona)) continue;

      it(`${persona}: create με ΤΟ ΔΙΚΟ ΤΟΥ uid → allow`, async () => {
        const uid = PERSONA_CLAIMS[persona].uid;
        const ctx = getContext(env, persona);

        await assertSucceeds(
          ctx
            .firestore()
            .collection('property_demands')
            .doc(`demand-self-${persona}`)
            .set(propertyDemandCreatePayload(uid)),
        );
      });
    }

    it('🔴 ο ανώνυμος ΔΕΝ γεννά ζήτηση — δεν υπάρχει uid να την κατέχει', async () => {
      const anon = env.unauthenticatedContext();

      await assertFails(
        anon
          .firestore()
          .collection('property_demands')
          .doc('demand-anon')
          .set(propertyDemandCreatePayload('whoever')),
      );
    });
  });

  // ==========================================================================
  // Α2 — ΤΟ `authorUserId` ΕΙΝΑΙ ΑΜΕΤΑΒΛΗΤΟ
  // ==========================================================================

  describe('🔴 Α2 — ο κάτοχος δεν μπορεί να «χαρίσει» τη ζήτησή του', () => {
    it('update που αλλάζει το `authorUserId` σε τρίτο → deny', async () => {
      const docId = 'demand-owned-1';
      await seedPropertyDemand(env, docId, OWNER_UID);

      const owner = getContext(env, 'same_tenant_user');

      await assertFails(
        owner
          .firestore()
          .collection('property_demands')
          .doc(docId)
          .update({ authorUserId: PERSONA_CLAIMS.cross_tenant_user.uid }),
      );
    });

    it('update που αφήνει το `authorUserId` ίδιο → allow (η άλλη κατεύθυνση)', async () => {
      const docId = 'demand-owned-1';
      await seedPropertyDemand(env, docId, OWNER_UID);

      const owner = getContext(env, 'same_tenant_user');

      await assertSucceeds(
        owner
          .firestore()
          .collection('property_demands')
          .doc(docId)
          .update({ authorUserId: OWNER_UID, lifecycle: 'withdrawn' }),
      );
    });
  });

  // ==========================================================================
  // Α3 — «RULES ARE NOT FILTERS»
  // ==========================================================================

  describe('🔴 Α3 — η αφιλτράριστη λίστα απορρίπτεται ΚΑΙ για τον κάτοχο', () => {
    it('χωρίς `where(authorUserId)` το ερώτημα του ίδιου του κατόχου → deny', async () => {
      await seedPropertyDemand(env, 'demand-owned-1', OWNER_UID);

      const owner = getContext(env, 'same_tenant_user');

      await assertFails(owner.firestore().collection('property_demands').get());
    });

    it('🔑 και η ζήτηση ΤΡΙΤΟΥ δεν διαρρέει σε φιλτραρισμένο ερώτημα κατόχου', async () => {
      await seedPropertyDemand(env, 'demand-owned-1', OWNER_UID);
      await seedPropertyDemand(
        env,
        'demand-of-someone-else',
        PERSONA_CLAIMS.cross_tenant_user.uid,
      );

      const owner = getContext(env, 'same_tenant_user');
      const snap = await assertSucceeds(
        owner
          .firestore()
          .collection('property_demands')
          .where('authorUserId', '==', OWNER_UID)
          .get(),
      );

      expect(snap.size).toBe(1);
      expect(snap.docs[0].id).toBe('demand-owned-1');
    });
  });

  // ==========================================================================
  // Α4 — Η ΑΠΟΣΥΡΣΗ ΔΕΝ ΕΙΝΑΙ ΔΙΑΓΡΑΦΗ
  // ==========================================================================

  describe('🔴 Α4 — καμία διαγραφή, ούτε από τον κάτοχο', () => {
    it('ο κάτοχος αποσύρει με `lifecycle`, δεν σβήνει', async () => {
      const docId = 'demand-owned-1';
      await seedPropertyDemand(env, docId, OWNER_UID);

      const owner = getContext(env, 'same_tenant_user');
      const ref = owner.firestore().collection('property_demands').doc(docId);

      await assertFails(ref.delete());
      await assertSucceeds(ref.update({ lifecycle: 'withdrawn' }));
    });
  });
});
