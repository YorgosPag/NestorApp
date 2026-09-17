/**
 * Firestore Rules — συλλογή `stay_channels` (ADR-835 §22, Στάδιο Γ)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν
 * αποκλειστικά στον διακομιστή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ΕΙΝΑΙ ΤΟΥ **ΣΥΝΤΑΚΤΗ** — ΚΑΙ Ο ΠΙΝΑΚΑΣ ΔΕΝ ΤΟ ΛΕΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι **τέσσερις** αδελφές συλλογές του ημερολογίου (`stay_calendars` · `stay_blocks` ·
 * `stay_bookings` · `stay_calendar_months`) επιτρέπουν **ανάγνωση στον συντάκτη**. Άρα
 * η «λογική» μετάλλαξη που θα σκεφτόταν ο επόμενος είναι **ακριβώς** η ευθυγράμμιση:
 *
 *     allow read: if isAuthenticated() && resource.data.authorUserId == request.auth.uid;
 *
 * *«Μα είναι ο ΔΙΚΟΣ του σύνδεσμος — γιατί να μη δει την κατάστασή του;»*
 *
 * 🔴 Γιατί το `url` του feed **ΕΙΝΑΙ διαπιστευτήριο**: ο σύνδεσμος `.ics` της Airbnb
 * δίνει σε όποιον τον έχει **ολόκληρο** το ημερολόγιο του οικοδεσπότη εκεί. Και το
 * Firestore **δεν φιλτράρει πεδία** σε ανάγνωση εγγράφου (τεκμηρίωση Google: *«You
 * either retrieve the full document, or you retrieve nothing»*). Άρα «να δει την
 * κατάστασή του» **δεν μπορεί** να σημαίνει «να διαβάσει το έγγραφο»: σημαίνει
 * **προβολή** από τον διακομιστή (`readStayChannelsView` — host + βαθμίδα, ποτέ URL).
 *
 * ⇒ Γι' αυτό η σουίτα **σπέρνει έγγραφο του ίδιου συντάκτη** και βάζει ρητή άγκυρα:
 * χωρίς αυτό, ο `denyAllMatrix` θα περνούσε **και με** τη μετάλλαξη, δηλαδή πράσινο που
 * σημαίνει «κανείς δεν κοίταξε».
 *
 * 🔴 **Γιατί ούτε ΓΡΑΦΕΙ ο συντάκτης**: το `nextPollAt` **ορίζει πότε** μας βάζει το
 * κανάλι να χτυπήσουμε εξωτερικό διακομιστή, και το `exportGeneration` **ακυρώνει**
 * συνδέσμους. Πελάτης που τα γράφει μπορεί (α) να κάνει τον διακομιστή μας αντλία
 * αιτημάτων προς οποιοδήποτε URL, (β) να αναστήσει **ανακλημένο** σύνδεσμο γυρίζοντας
 * τη γενιά πίσω. Και τα δύο είναι εκτός εμβέλειας κάθε ελέγχου ρυθμού.
 *
 * @since 2026-09-17 (ADR-835 §22)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'stay_channels',
)!;

const PROPERTY_ID = 'ownp_seed_channels';

/** Έγγραφο καναλιών **του δοκιμαζόμενου συντάκτη** — δες την κεφαλίδα για το γιατί. */
async function seedStayChannels(env: ReturnType<typeof useDenyAllEmulator>): Promise<string> {
  const authorUserId = PERSONA_CLAIMS.same_tenant_admin.uid;
  await withSeedContext(env(), async (ctx) => {
    await ctx.firestore().collection('stay_channels').doc(PROPERTY_ID).set({
      propertyId: PROPERTY_ID,
      authorUserId,
      exportGeneration: 2,
      feeds: [{
        id: 'schf_seed',
        label: 'Airbnb',
        // 🔴 Το μυστικό που δεν επιτρέπεται να κατεβεί ΠΟΤΕ στον πελάτη.
        url: 'https://www.airbnb.com/calendar/ical/1234.ics?s=SECRET_TOKEN',
        channel: 'airbnb',
        status: {
          lastAttemptAt: '2027-01-01T10:00:00.000Z',
          lastSuccessAt: '2027-01-01T10:00:00.000Z',
          lastFailure: null,
          consecutiveFailures: 0,
          eventCount: 3,
          etag: null,
          lastModified: null,
          nextPollAt: '2027-01-01T10:30:00.000Z',
        },
        pendingRemovals: {},
        createdAt: '2027-01-01T09:00:00.000Z',
        createdBy: authorUserId,
      }],
      nextPollAt: '2027-01-01T10:30:00.000Z',
      createdAt: '2027-01-01T09:00:00.000Z',
      updatedAt: '2027-01-01T10:00:00.000Z',
    });
  });
  return authorUserId;
}

describe('stay_channels.rules — ο σύνδεσμος του καναλιού ανήκει στον διακομιστή, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο συντάκτης — το URL του feed είναι διαπιστευτήριο', () => {
    it('ο συντάκτης (authorUserId === uid) ΔΕΝ διαβάζει το έγγραφο των καναλιών του', async () => {
      await seedStayChannels(env);
      const author = getContext(env(), 'same_tenant_admin');

      await assertFails(author.firestore().collection('stay_channels').doc(PROPERTY_ID).get());
    });

    it('🔑 ούτε με ερώτημα φιλτραρισμένο στο δικό του — η λίστα είναι η ίδια διαρροή', async () => {
      const authorUserId = await seedStayChannels(env);
      const author = getContext(env(), 'same_tenant_admin');

      await assertFails(
        author.firestore().collection('stay_channels').where('authorUserId', '==', authorUserId).get(),
      );
    });

    it('🔴 ούτε γράφει: το `nextPollAt` μας βάζει να χτυπάμε ξένο διακομιστή', async () => {
      await seedStayChannels(env);
      const author = getContext(env(), 'same_tenant_admin');

      await assertFails(
        author.firestore().collection('stay_channels').doc(PROPERTY_ID).update({
          nextPollAt: '1970-01-01T00:00:00.000Z',
        }),
      );
    });

    it('🔴 ούτε γυρίζει πίσω τη γενιά: θα ανάσταινε ΑΝΑΚΛΗΜΕΝΟ σύνδεσμο', async () => {
      await seedStayChannels(env);
      const author = getContext(env(), 'same_tenant_admin');

      await assertFails(
        author.firestore().collection('stay_channels').doc(PROPERTY_ID).update({ exportGeneration: 1 }),
      );
    });
  });
});
