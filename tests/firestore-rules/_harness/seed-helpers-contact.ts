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
 * Το **κανάλι** της σπαρμένης πρόσκλησης (ADR-844).
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΔΙΑΒΑΣΤΕΙ ΠΡΙΝ ΚΑΠΟΙΟΣ «ΤΟ ΔΙΟΡΘΩΣΕΙ»:** ο πειρασμός
 * είναι να δείχνει στο email του persona, ώστε να κοκκινίζει η μετάλλαξη
 * *«allow read: if resource.data.channelEmail == request.auth.token.email»*. **Δεν
 * γίνεται**: το {@link PersonaClaims} δηλώνει **τρία** πεδία (`uid`, `companyId`,
 * `globalRole`) και **κανένα email** — άρα κανένας δοκιμαζόμενος δεν έχει
 * `token.email`, και μια τέτοια άγκυρα θα ήταν **πράσινη επειδή δεν μπορεί να τρέξει**.
 *
 * 🔑 **Και η απειλή δεν χάνεται, γιατί ο άξονας email ΔΕΝ είναι ο επικίνδυνος εδώ.** Η
 * πρόσκληση **δεν έχει `uid`** —ο άνθρωπος δεν έχει ακόμη λογαριασμό— οπότε το μόνο
 * «λογικό» χαλάρωμα που μπορεί να γράψει ο επόμενος είναι το **εταιρικό**:
 * *«μα ο επαγγελματίας πρέπει να δει ποιος τον πλησιάζει!»*. **Αυτό** το εκτελεί η
 * άγκυρα του παραλήπτη, με στόχο `professional` προς `company-a`.
 */
export const SEED_INVITATION_EMAIL = 'maria.seed@example.gr';

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

/**
 * ADR-844 — μια **πρόσκληση πρώτης επαφής** (`first_contact_invitations`).
 *
 * 🔴 **ΤΟ SEED ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ, ΚΑΙ ΕΔΩ ΤΟ ΣΥΜΒΟΛΑΙΟ ΕΙΝΑΙ Η ΑΠΕΙΛΗ.** Τα τρία
 * πεδία που κάνουν τον κανόνα `deny_all` **αναγκαίο** —και όχι απλώς συνετό— υπάρχουν
 * επίτηδες, γιατί το Firestore **δεν φιλτράρει πεδία**: όποιος διαβάσει το έγγραφο, τα
 * παίρνει **όλα**.
 *
 * | Πεδίο | Τι δίνει σε όποιον το διαβάσει |
 * |---|---|
 * | `codeHash` + `nonce` | το υλικό για να εξαργυρώσει **ΞΕΝΗ** πρόσκληση |
 * | `attempts` | ο μόνος φρουρός ωμής βίας που **δεν** παρακάμπτεται με αλλαγή IP |
 * | `declaration.disclosure` | όνομα, email, τηλέφωνο ανθρώπου **χωρίς λογαριασμό** |
 *
 * 🔑 **Ο στόχος είναι `professional` προς `company-a`, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΑΥΘΑΙΡΕΤΟΣ** — ίδιο
 * σκεπτικό με το {@link SEED_SEEKER_UID} του {@link seedFirstContact}: είναι ο
 * `SAME_TENANT_COMPANY_ID`, δηλαδή η εταιρεία που οι σουίτες **μπορούν να υποδυθούν**.
 * Χωρίς αυτή τη σύμπτωση, το πιο λογικό χαλάρωμα που θα σκεφτόταν ο επόμενος
 *
 *     allow read: if resource.data.declaration.target.agencyCompanyId == getUserCompanyId();
 *
 * *(«μα ο επαγγελματίας πρέπει να δει ποιος τον πλησιάζει!»)* **ΔΕΝ θα κοκκίνιζε ποτέ**:
 * ο `denyAllMatrix` αρνείται σε όλους, οπότε κάθε κελί περνά **ούτως ή άλλως** όταν
 * κανένα σπαρμένο έγγραφο δεν **αφορά** τον δοκιμαζόμενο. Πράσινο που σημαίνει «κανείς
 * δεν κοίταξε».
 *
 * ⚠️ Ο άξονας του **email** δεν είναι εκτελέσιμος εδώ — δες {@link SEED_INVITATION_EMAIL}.
 */
export async function seedFirstContactInvitation(
  env: RulesTestEnvironment,
  invitationId: string,
  channelEmail: string = SEED_INVITATION_EMAIL,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('first_contact_invitations').doc(invitationId).set({
      id: invitationId,
      declaration: {
        target: { kind: 'professional', agencyCompanyId: SAME_TENANT_COMPANY_ID },
        demandId: 'dmnd_seed_0001',
        disclosure: {
          displayName: 'Μαρία Κ.',
          email: channelEmail,
          phone: '6912345678',
          acceptsPlatformMessages: false,
        },
      },
      channelEmail,
      nonce: 'nonce_seed_0001',
      codeHash: 'a'.repeat(64),
      attempts: 0,
      state: 'sent',
      createdAt: '2026-09-05T10:00:00.000Z',
      expiresAt: '2026-09-12T10:00:00.000Z',
      redeemedAt: null,
    });
  });
}
