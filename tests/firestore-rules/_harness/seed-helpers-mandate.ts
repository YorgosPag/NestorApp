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

/**
 * **Η ΠΡΟΕΛΕΥΣΗ ΤΟΥ ΣΗΜΑΤΟΣ** — πού βρίσκεται το πρωτότυπο αρχείο (ADR-841 §7 Α21.12).
 *
 * 🔴 **ΤΟ ΕΓΓΡΑΦΟ ΣΠΕΡΝΕΤΑΙ ΜΕ ΤΟ `companyId` ΤΟΥ ΔΟΚΙΜΑΖΟΜΕΝΟΥ ΜΙΣΘΩΤΗ**, και είναι
 * όλο το νόημα της άγκυρας: ο `denyAllMatrix` αρνείται σε όλους, οπότε το κελί
 * `same_tenant_admin × read` περνά **ούτως ή άλλως**. Χωρίς έγγραφο που ανήκει **στον
 * ίδιο**, η μετάλλαξη
 *
 *     allow read: if companyId == getUserCompanyId();
 *
 * — δηλαδή το «λογικό» χαλάρωμα *«μα είναι το ΔΙΚΟ του σήμα, γιατί να μην το δει;»* —
 * **ΔΕΝ θα κοκκίνιζε**. Πράσινο που σημαίνει «κανείς δεν κοίταξε».
 *
 * ⚠️ Το `privateStoragePath` γράφεται **ρεαλιστικό** *(`companies/…/entities/…`)*: είναι
 * ακριβώς το πράγμα που δεν επιτρέπεται να διαρρεύσει — η **εσωτερική δομή αποθήκευσης**.
 */
export async function seedShowcaseMarkSource(
  env: RulesTestEnvironment,
  companyId: string = SAME_TENANT_COMPANY_ID,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('showcase_mark_sources').doc(companyId).set({
      companyId,
      kind: 'logo',
      privateStoragePath: `companies/${companyId}/entities/file_seed_0001/mark.png`,
      recordedAt: '2026-09-08T08:00:00.000Z',
    });
  });
}

/**
 * **ΤΑ ΚΑΝΑΛΙΑ ΤΗΣ ΚΑΡΤΑΣ** (ADR-841 §7 Α21.16) — σπέρνονται με το `companyId` του
 * **δοκιμαζόμενου** μισθωτή, για τον λόγο ακριβώς από πάνω: χωρίς έγγραφο **του ίδιου**, η
 * μετάλλαξη `allow read: if companyId == getUserCompanyId()` δεν θα κοκκίνιζε.
 */
export async function seedShowcaseCardChannels(
  env: RulesTestEnvironment,
  companyId: string = SAME_TENANT_COMPANY_ID,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('showcase_card_channels').doc(companyId).set({
      locations: {
        sloc_seed_0001: {
          phones: [{ e164: '+302310123456', extension: null }],
          emails: ['office@example.gr'],
        },
      },
    });
  });
}

/**
 * **ΑΙΤΗΜΑ ΕΠΙΒΕΒΑΙΩΣΗΣ EMAIL ΤΗΣ ΚΑΡΤΑΣ** (ADR-841 §7 Α21.18) — του **δοκιμαζόμενου** μισθωτή, για
 * τον ίδιο λόγο: χωρίς έγγραφο του ίδιου, η μετάλλαξη «ο ιδιοκτήτης βλέπει τα αιτήματά του» δεν κοκκινίζει.
 */
export async function seedShowcaseEmailConfirmation(
  env: RulesTestEnvironment,
  companyId: string = SAME_TENANT_COMPANY_ID,
): Promise<string> {
  const id = 'secf_seed_0001';
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('showcase_email_confirmations').doc(id).set({
      id,
      companyId,
      locationId: 'sloc_seed_0001',
      email: 'office@example.gr',
      nonce: 'seed-nonce',
      state: 'sent',
      requestedByUid: 'seed-uid',
      createdAt: '2026-09-14T08:00:00.000Z',
      expiresAt: '2026-09-17T08:00:00.000Z',
      settledAt: null,
    });
  });
  return id;
}

/**
 * **ΕΡΩΤΗΣΗ ΑΡΓΙΩΝ** (ADR-841 §7 Α21.21 Φάση Β) — του **δοκιμαζόμενου** μισθωτή: χωρίς έγγραφο του ίδιου, η
 * μετάλλαξη «ο διαχειριστής βλέπει τις ερωτήσεις του γραφείου του» δεν κοκκινίζει.
 */
export async function seedHolidayHoursQuestion(
  env: RulesTestEnvironment,
  companyId: string = SAME_TENANT_COMPANY_ID,
): Promise<string> {
  const id = 'hhq_seed_0001';
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('holiday_hours_questions').doc(id).set({
      id,
      companyId,
      seasonKey: '2026-12-25',
      lastDate: '2027-01-06',
      items: [{ locationId: 'sloc_seed_0001', date: '2026-12-25', holiday: 'christmas' }],
      nonce: 'seed-nonce',
      state: 'open',
      createdAt: '2026-12-04T08:00:00.000Z',
      askedAt: '2026-12-04T08:00:00.000Z',
      remindedAt: null,
      settledAt: null,
      answers: [],
      answeredByUid: null,
    });
  });
  return id;
}
