/**
 * Firestore Rules — συλλογή `stay_guests` (ADR-835 §23.4, Στάδιο Δ)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν στον διακομιστή.
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΥ του επισκέπτη** — ίδιο μάθημα με το `stay_channels`:
 * ο πειρασμός είναι *«μα είναι η ΔΙΚΗ του κεφαλή»*. Η κεφαλή όμως είναι **μηχανισμός σειριοποίησης**
 * του ορίου ενεργών αιτημάτων: επισκέπτης που την **γράφει** αδειάζει τα `holds` και ξεπερνά το όριο
 * — δηλαδή ξαναφέρνει τον «κλειδώνω όλο το καλοκαίρι» που το όριο έκανε αδύνατο να εκφραστεί. Και
 * δεν χρειάζεται να τη **διαβάσει**: ό,τι πρέπει να ξέρει («έχεις 3 αιτήματα σε αναμονή») του το λέει
 * ο διακομιστής με όνομα (`guest-hold-limit`).
 *
 * ⇒ Γι' αυτό η σουίτα **σπέρνει κεφαλή του ίδιου του δοκιμαζόμενου**: χωρίς αυτό ο `denyAllMatrix`
 * θα περνούσε **και με** μετάλλαξη «ο κάτοχος διαβάζει/γράφει», δηλαδή πράσινο που σημαίνει
 * «κανείς δεν κοίταξε».
 *
 * @since 2026-09-18 (ADR-835 §23)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'stay_guests',
)!;

const GUEST_UID = PERSONA_CLAIMS.same_tenant_user.uid;

async function seedOwnHead(env: ReturnType<typeof useDenyAllEmulator>): Promise<void> {
  await withSeedContext(env(), async (ctx) => {
    await ctx.firestore().collection('stay_guests').doc(GUEST_UID).set({
      userId: GUEST_UID,
      holds: [{ bookingId: 'stay_1', propertyId: 'ownp_seed', expiresAt: '2099-01-01T00:00:00.000Z' }],
      version: 1,
      updatedAt: '2027-01-01T00:00:00.000Z',
    });
  });
}

describe('stay_guests.rules — η κεφαλή του επισκέπτη ανήκει στον διακομιστή, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο επισκέπτης', () => {
    it('δεν διαβάζει τη δική του κεφαλή', async () => {
      await seedOwnHead(env);
      const guest = getContext(env(), 'same_tenant_user');
      await assertFails(guest.firestore().collection('stay_guests').doc(GUEST_UID).get());
    });

    it('🔴 δεν την αδειάζει — θα ξεπερνούσε το όριο ενεργών αιτημάτων', async () => {
      await seedOwnHead(env);
      const guest = getContext(env(), 'same_tenant_user');
      await assertFails(guest.firestore().collection('stay_guests').doc(GUEST_UID).update({ holds: [] }));
    });

    it('δεν τη δημιουργεί ούτε τη σβήνει', async () => {
      const guest = getContext(env(), 'same_tenant_user');
      await assertFails(guest.firestore().collection('stay_guests').doc(GUEST_UID).set({ userId: GUEST_UID, holds: [], version: 0 }));
      await seedOwnHead(env);
      await assertFails(guest.firestore().collection('stay_guests').doc(GUEST_UID).delete());
    });
  });
});
