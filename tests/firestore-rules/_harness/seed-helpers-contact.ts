/**
 * Seeders της **ΦΑΣΗΣ Β του ADR-843** — η πράξη της πρώτης επαφής.
 *
 * 🔑 **Χωριστό αρχείο, όχι επέκταση του `seed-helpers-mandate.ts`** — ίδιο σκεπτικό με
 * εκείνο απέναντι στο `seed-helpers.ts`: **split, όχι trim**. Και εδώ υπάρχει δεύτερος
 * λόγος, σημασιολογικός: το `mreq` και το `fcon` έχουν **αντίθετο** συμβόλαιο
 * ιδιωτικότητας *(εκεί κρύβεται το πρόσωπο, εδώ αποκαλύπτεται)*, και δύο αντίθετα
 * δόγματα σε ένα αρχείο σημαίνει ότι το επόμενο seed διαλέγει το δικό του **σιωπηλά**.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-contact
 * @see docs/centralized-systems/reference/adrs/ADR-843-first-contact-act.md
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';

/**
 * Ο **ζητών** του seed — και **δεν** είναι αυθαίρετος.
 *
 * 🔴 Είναι το `uid` του persona `external_user`, δηλαδή ενός δρώντα που οι σουίτες
 * **μπορούν να υποδυθούν**. Χωρίς αυτή τη σύμπτωση, η μετάλλαξη
 *
 *     allow read: if resource.data.seekerUserId == request.auth.uid;
 *
 * — το πιο **λογικό** χαλάρωμα που θα σκεφτόταν ο επόμενος, *«μα είναι η δική του
 * πράξη, γιατί να μην τη διαβάσει;»* — **ΔΕΝ θα κοκκίνιζε ποτέ**, γιατί κανένας
 * δοκιμαζόμενος δεν θα ήταν ο συγγραφέας. Πράσινο που σημαίνει «κανείς δεν κοίταξε».
 */
export const SEED_SEEKER_UID = PERSONA_CLAIMS.external_user.uid;

/**
 * ADR-843 — μια **πράξη πρώτης επαφής** (`first_contacts`).
 *
 * 🔴 **Υπάρχει παρότι ο κανόνας είναι `read: false` + `write: false`**, δηλαδή
 * αποφασίζει **πριν** κοιτάξει έγγραφο. Ο λόγος είναι ότι ο `denyAllMatrix` περνά
 * **ούτως ή άλλως**: χωρίς σπαρμένο έγγραφο που **αφορά** τους δοκιμαζόμενους, οι δύο
 * επικίνδυνες μεταλλάξεις είναι **αόρατες**.
 *
 * | Μετάλλαξη που ακούγεται σωστή | Ποιος την κάνει ορατή |
 * |---|---|
 * | `seekerUserId == request.auth.uid` *(«δική του πράξη»)* | το {@link SEED_SEEKER_UID} |
 * | `target.agencyCompanyId == getUserCompanyId()` *(«τα εισερχόμενά μου»)* | ο στόχος `professional` προς `company-a` |
 *
 * ⚠️ **Το seed είναι ΤΟ ΣΥΜΒΟΛΑΙΟ, όχι δείγμα**: είναι το **πλήρες** σχήμα του
 * `FirstContact` και **τίποτα άλλο**. Ειδικά το `demandId` και το `matchReason`
 * υπάρχουν επίτηδες — είναι **ακριβώς** τα πεδία που ο παραλήπτης δεν επιτρέπεται να
 * δει ωμά *(κλειδί προς το επίπεδο Β)*, και το Firestore **δεν φιλτράρει πεδία**.
 */
export async function seedFirstContact(
  env: RulesTestEnvironment,
  contactId: string,
  target:
    | { kind: 'professional'; agencyCompanyId?: string }
    | { kind: 'listing'; listingId?: string } = { kind: 'professional' },
): Promise<void> {
  const resolvedTarget = target.kind === 'professional'
    ? {
        kind: 'professional' as const,
        agencyCompanyId: target.agencyCompanyId ?? SAME_TENANT_COMPANY_ID,
      }
    : { kind: 'listing' as const, listingId: target.listingId ?? 'ownp_seed_0001' };

  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('first_contacts').doc(contactId).set({
      id: contactId,
      seekerUserId: SEED_SEEKER_UID,
      target: resolvedTarget,
      demandId: 'dmnd_seed_0001',
      disclosure: {
        displayName: 'Ελένη Π.',
        email: 'eleni.seed@example.gr',
        phone: null,
        acceptsPlatformMessages: false,
      },
      matchReason: { unmetAxes: ['price-above'], declaredAxes: 5 },
      lifecycle: 'open',
      createdAt: '2026-09-03T10:00:00.000Z',
      withdrawnAt: null,
      seenAt: null,
    });
  });
}
