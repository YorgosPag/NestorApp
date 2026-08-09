/**
 * Firestore Rules — συλλογή `public_listings` (ADR-777 Α3/Α5/Α20)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read:  `if true`   ← δημοσιευμένη αγγελία, ορατή ΚΑΙ σε ανώνυμο
 *   - write: `if false`  ← γράφει ΜΟΝΟ ο διακομιστής (Admin SDK, παρακάμπτει κανόνες)
 *
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΔΕΝ ΦΡΟΥΡΟΥΣΕ ΤΙΠΟΤΑ ΜΕΧΡΙ ΣΗΜΕΡΑ:
 *
 * Η δημόσια ανάγνωση αγγελιών γινόταν απευθείας στο `properties`, με σχόλιο που
 * δήλωνε «*no companyId leak*». Το Firestore **δεν έχει** έλεγχο ανάγνωσης σε επίπεδο
 * πεδίου («*you either retrieve the full document, or you retrieve nothing*» —
 * τεκμηρίωση Google), άρα η εγγύηση **δεν είχε μηχανισμό**. Μετρήθηκε στη ζωντανή βάση
 * (2026-08-10) ότι κάθε δημοσιευμένο έγγραφο κουβαλά `companyId` · `createdBy` (uid) ·
 * `_lastModifiedByName` (**ονοματεπώνυμο**) · `projectId` · `buildingId` · `code`.
 *
 * ⚠️ **Η άμυνα ΔΕΝ είναι ο κανόνας — είναι το ΣΧΗΜΑ.** Γι' αυτό η σουίτα δεν αρκείται
 * στον πίνακα personas: προσθέτει ρητή άγκυρα ότι το έγγραφο που **διαβάζει ο
 * ανώνυμος** δεν περιέχει κανένα από τα διαρρέοντα πεδία. Ένας πίνακας που λέει μόνο
 * «ο ανώνυμος μπορεί να διαβάσει» θα ήταν **πράσινος πάνω στη διαρροή**.
 *
 * @since 2026-08-10 (ADR-777 Β2α)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedPublicListing } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'public_listings',
)!;

/** Τα πεδία που **διαρρέουν σήμερα** από το δημόσιο σκέλος του `properties`. */
const LEAKING_FIELDS = [
  'companyId',
  'linkedCompanyId',
  'createdBy',
  '_lastModifiedBy',
  '_lastModifiedByName',
  'projectId',
  'buildingId',
  'floorId',
  'code',
  'levelData',
] as const;

describe('public_listings.rules — δημοσιευμένη προβολή (ADR-777 Α3/Α5)', () => {
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
        const docId = 'listing-public-1';
        await seedPublicListing(env, docId);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'public_listings',
          docId,
          data: { title: 'ΔΟΚΙΜΗ ΕΓΓΡΑΦΗΣ' },
          createData: {
            id: 'listing-public-2',
            commercialStatus: 'for-sale',
            commercial: { askingPrice: 1, finalPrice: null, rentPrice: null },
            coverImage: null,
            type: 'apartment',
            areaSqm: null,
            offerKinds: ['sell'],
            position: { kind: 'unknown', reason: 'never-asked' },
            floor: null,
            bedrooms: null,
            title: 'ΔΟΚΙΜΗ',
            projectedAt: '2026-08-10T10:00:00.000Z',
          },
          // ⚠️ ΚΑΝΕΝΑ listFilter: δεν υπάρχει `companyId` να φιλτράρει — και η
          // αφιλτράριστη λίστα είναι εδώ ακριβώς αυτό που πρέπει να επιτρέπεται,
          // γιατί ΕΙΝΑΙ το ερώτημα που στέλνει η οθόνη 2.
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // ==========================================================================
  // Η ΑΓΚΥΡΑ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΙΝΑΚΑΣ PERSONAS
  // ==========================================================================

  describe('🔴 το έγγραφο που φτάνει στον ΑΝΩΝΥΜΟ δεν κουβαλά ταυτότητα πελάτη', () => {
    it('κανένα από τα πεδία που διαρρέουν από το `properties` δεν υπάρχει εδώ', async () => {
      const docId = 'listing-public-1';
      await seedPublicListing(env, docId);

      const anon = env.unauthenticatedContext();
      const snap = await assertSucceeds(
        anon.firestore().collection('public_listings').doc(docId).get()
      );

      const data = snap.data() ?? {};
      for (const field of LEAKING_FIELDS) {
        expect(Object.keys(data)).not.toContain(field);
      }
    });

    it('🔑 και η ΛΙΣΤΑ επίσης — η διαρροή σε ερώτημα είναι η ίδια διαρροή', async () => {
      await seedPublicListing(env, 'listing-public-1');
      await seedPublicListing(env, 'listing-public-2');

      const anon = env.unauthenticatedContext();
      const snap = await assertSucceeds(
        anon.firestore().collection('public_listings').get()
      );

      expect(snap.size).toBe(2);
      for (const doc of snap.docs) {
        const serialized = JSON.stringify(doc.data());
        for (const field of LEAKING_FIELDS) {
          expect(serialized).not.toContain(field);
        }
      }
    });
  });
});
