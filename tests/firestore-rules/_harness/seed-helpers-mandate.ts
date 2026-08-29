/**
 * Seeders της **ΦΑΣΗΣ Β του ADR-827** — η βιτρίνα του γραφείου και το αίτημα ανάθεσης.
 *
 * 🔑 **Χωριστό αρχείο, όχι επέκταση του `seed-helpers.ts`** — και δεν είναι προτίμηση:
 * εκείνο μετρά **750 γραμμές**, δηλαδή έχει ήδη περάσει το ταβάνι του **N.7.1**. Η
 * κίνηση είναι η ίδια που παρήγαγε το `enterprise-id-bim-generators.ts`: **split, όχι
 * trim** — μια συνεκτική ομάδα φεύγει ολόκληρη αντί να ξυριστεί γραμμή-γραμμή.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-mandate
 * @see docs/centralized-systems/reference/adrs/ADR-827-listing-mandate-assignment.md §8.7 · §9
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';

/**
 * ADR-827 §9 — η **δημοσιευμένη βιτρίνα** ενός γραφείου (`agency_profiles`).
 *
 * 🔴 **Το seed είναι ΤΟ ΣΥΜΒΟΛΑΙΟ, όχι δείγμα** *(ίδιο δόγμα με το
 * `seedPublicListing`)*: είναι το **πλήρες** σχήμα του `AgencyProfile` και **τίποτα
 * άλλο**. Ένα seed που «τυχαίνει» να έχει τηλέφωνο ή προμήθεια θα δοκίμαζε τους
 * κανόνες πάνω σε έγγραφο που η παραγωγή **δεν γράφει ποτέ** — δηλαδή θα έβαφε πράσινο
 * κάτι που δεν ελέγχθηκε.
 *
 * ⚠️ Το κλειδί εγγράφου **είναι** το `companyId` (§9.6): έτσι η σημειακή ανάγνωση μετά
 * το `resolveAlias` δεν χρειάζεται δεύτερο ευρετήριο.
 */
export async function seedAgencyProfile(
  env: RulesTestEnvironment,
  companyId: string = SAME_TENANT_COMPANY_ID,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('agency_profiles').doc(companyId).set({
      companyId,
      alias: 'mesitiko-pagoni',
      displayName: 'ΜΕΣΙΤΙΚΟ ΓΡΑΦΕΙΟ ΠΑΓΩΝΗ Ι.Κ.Ε.',
      gemiNumber: '123456789000',
      place: null,
      publishedAt: '2026-08-29T10:00:00.000Z',
      // NOTE: καμία αμοιβή, καμία κατάταξη/βαθμολογία, κανένα τηλέφωνο/email,
      //       κανένα όνομα φυσικού προσώπου — **αυτό ΕΙΝΑΙ η άμυνα** (§9.9).
    });
  });
}

/**
 * ADR-827 §8.7 — ένα **αίτημα ανάθεσης** (`mandate_requests`).
 *
 * 🔴 **Υπάρχει παρότι ο κανόνας είναι `read: false` + `write: false`**, δηλαδή
 * αποφασίζει **πριν** κοιτάξει έγγραφο. Ο λόγος είναι μία και μόνη άγκυρα: να
 * αποδειχθεί ότι **ούτε ο ΠΑΡΑΛΗΠΤΗΣ** διαβάζει. Χωρίς σπαρμένο έγγραφο **που
 * απευθύνεται στο `company-a`**, η άρνηση για τον `same_tenant_admin` θα ήταν πράσινη
 * για **λάθος λόγο** — και η μετάλλαξη που προσθέτει
 * `allow read: if resource.data.agencyCompanyId == getUserCompanyId()` **δεν θα
 * κοκκίνιζε**.
 *
 * ⚠️ Το `requestedByUserId` υπάρχει επίτηδες: είναι **ακριβώς** το πεδίο που το
 * γραφείο δεν επιτρέπεται να δει (§8.2), και το Firestore **δεν φιλτράρει πεδία**.
 */
export async function seedMandateRequest(
  env: RulesTestEnvironment,
  requestId: string,
  agencyCompanyId: string = SAME_TENANT_COMPANY_ID,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('mandate_requests').doc(requestId).set({
      id: requestId,
      ownerPropertyId: 'ownp_seed_0001',
      requestedByUserId: 'user-idiotis-seed',
      agencyCompanyId,
      initiatedBy: 'owner',
      status: 'pending',
      terms: {
        agreement: 'exclusive-agency',
        compensation: { type: 'percentage', percentage: 2, vatIncluded: false },
        expiresAt: '2027-04-29T10:00:00.000Z',
      },
      requestedAt: '2026-08-29T10:00:00.000Z',
      seenAt: null,
      decidedAt: null,
      clientContactId: null,
    });
  });
}
