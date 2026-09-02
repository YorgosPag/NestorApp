import 'server-only';

/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΗΣ ΕΠΑΓΓΕΛΜΑΤΙΚΗΣ ΑΠΟΔΕΙΞΗΣ** — μία πόρτα, ένα όνομα πεδίου.
 * @related ADR-841 Α9 · ADR-798 §7 · firestore.rules · services/account/tax-identity.service.ts
 * @module services/account/professional-registration
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΟΝΟΜΑ ΤΟΥ ΠΕΔΙΟΥ ΕΙΝΑΙ ΚΛΕΙΔΩΜΕΝΟ — ΚΑΙ ΗΤΑΝ ΠΡΙΝ ΥΠΑΡΞΕΙ ΤΟ ΠΕΔΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `firestore.rules` έβαλε το **`occupationVerification`** στο
 * `serverOwnedUserFields()` **πριν** γραφτεί μία γραμμή κώδικα γι' αυτό, με ρητή
 * προειδοποίηση:
 *
 * > *«Η Φάση 5 οφείλει να χρησιμοποιήσει **αυτό ακριβώς το όνομα**· αν διαλέξει
 * > άλλο, ο φρουρός θα είναι πράσινος και **ανενεργός»***
 *
 * ⇒ Η σταθερά {@link OCCUPATION_VERIFICATION_FIELD} ζει **εδώ και μόνο εδώ**, και
 * κάθε γραφή περνά από αυτήν. Ένα κυριολεκτικό `'occupationVerification'`
 * σκορπισμένο σε καλούντες θα ήταν το δεύτερο βιβλίο ονομάτων (**ADR-749**), και
 * η απόκλιση θα ήταν **αόρατη**: οι κανόνες θα δέχονταν το νέο όνομα σαν
 * αυτο-δηλωμένο πεδίο, δηλαδή *«επαληθευμένο»* θα σήμαινε *«το είπα μόνος μου»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΔΙΑΚΟΜΙΣΤΗΣ ΓΙΑ ΠΕΔΙΟ ΠΟΥ ΔΗΛΩΝΕΙ Ο ΙΔΙΟΣ Ο ΑΝΘΡΩΠΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ίδιο σχήμα με το **ΑΦΜ** *(`tax-identity.service.ts`)*, και ο λόγος είναι ο
 * ίδιος κατά **είδος**: το `profession`/`escoUri`/`iscoCode` μένουν **ελεύθερα**
 * στον πελάτη γιατί *κανείς δεν τα πιστεύει για εξουσιοδότηση* (ADR-798 Α4). Η
 * **επαλήθευσή** τους δεν είναι: αν ο πελάτης μπορεί να γράψει
 * `{state:'verified'}`, η διάκριση **δηλωμένο ≠ επαληθευμένο** πεθαίνει τη
 * στιγμή που γεννιέται — και μαζί της όλο το §7 *(ΤΕΕ · ΔΣΑ · ΟΕΕ · EUDI QEAA)*.
 *
 * ⚠️ **Server-owned ΔΕΝ σημαίνει «ο διακομιστής αποφασίζει ποιο είναι το μητρώο
 * σου»**: σημαίνει *«ο διακομιστής επαληθεύει πριν το γράψει»*. Η **πηγή
 * παραμένει ο άνθρωπος** — και **μόνο** αυτός: το `uid` έρχεται από το σύνορο
 * ταυτότητας, ποτέ από το σώμα, ώστε γραφή σε **ξένο** προφίλ να είναι **δομικά
 * αδύνατη**, όχι απαγορευμένη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΝΕΝΑ `verified` ΑΠΟ ΕΔΩ — ΚΑΙ ΕΙΝΑΙ Ο ΠΥΡΗΝΑΣ ΤΟΥ ΑΡΧΕΙΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αυτή η διαδρομή γράφει **αποκλειστικά** `declared` *(ή σβήνει)*. Το `verified`
 * σημαίνει *«ρωτήθηκε η αρχή»*, και **καμία αρχή δεν ρωτήθηκε**: το ΤΕΕ δίνει
 * δημόσια αναζήτηση **με GDPR opt-out** και **κανένα API**, ο ΔΣΑ γράφει ρητά
 * *«απαγορεύεται η χρήση των στοιχείων για διαφημιστικούς σκοπούς»*.
 *
 * 🔑 **Η ΕΠΑΛΗΘΕΥΣΗ ΤΑΞΙΔΕΥΕΙ ΑΠΟ ΤΟΝ ΑΝΘΡΩΠΟ ΠΡΟΣ ΕΜΑΣ**, ποτέ ανάποδα — αυτό
 * είναι ακριβώς το **EUDI Wallet** *(`OpenID4VP`, holder presents)*, όχι το
 * Checkatrade *(verifier queries)*. Όταν έρθει, το `verified` θα γραφτεί από
 * **επαληθευτή παρουσίασης**, όχι από αυτή τη συνάρτηση.
 *
 * ⛔ **ΜΗΝ προσθέσεις εδώ χειροκίνητη έγκριση διαχειριστή.** Θα ήταν *«κάποιος το
 * κοίταξε»* ντυμένο ως *«η αρχή το βεβαίωσε»* — και η οθόνη λέει το δεύτερο.
 *
 * **Layering**: service — Admin SDK, **μία** γραφή με `merge`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isChapteredRegistry, isRegistryAuthority } from '@/constants/professional-registries';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  ProfessionalAttestation,
  ProfessionalRegistration,
} from '@/types/professional-identity';

const logger = createModuleLogger('professional-registration.service');

/**
 * 🔴 **ΤΟ ΟΝΟΜΑ ΠΟΥ ΚΛΕΙΔΩΣΑΝ ΟΙ ΚΑΝΟΝΕΣ.** Δες την κεφαλή του αρχείου.
 *
 * ⛔ **ΜΗΝ το αλλάξεις** χωρίς να αλλάξεις **ταυτόχρονα** το
 * `serverOwnedUserFields()` στο `firestore.rules`: ένα από τα δύο μόνο του
 * αφήνει φρουρό **πράσινο και ανενεργό**.
 */
export const OCCUPATION_VERIFICATION_FIELD = 'occupationVerification' as const;

/**
 * **Κλειστό σύνολο αρνήσεων** — ποτέ `boolean`, ποτέ ελεύθερο μήνυμα.
 *
 * 🔑 Κάθε τιμή γίνεται **κλειδί i18n**, άρα ο άνθρωπος μαθαίνει *τι* φταίει.
 */
export const PROFESSIONAL_REGISTRATION_REJECTIONS = [
  /** Η αρχή δεν ανήκει στο λεξιλόγιο των **έξι** — δες `professional-registries.ts`. */
  'registration-authority-unknown',
  /** Κενός αριθμός με δηλωμένη αρχή: *«εγγεγραμμένος σε…»* χωρίς το «τι». */
  'registration-number-missing',
  /** Αρχή με **πολλούς** εκδότες, χωρίς εκδότη — «1234» χωρίς «ΔΣΘ» (Α9.1). */
  'registration-chapter-missing',
] as const;

export type ProfessionalRegistrationRejection =
  (typeof PROFESSIONAL_REGISTRATION_REJECTIONS)[number];

/** Διακριτική ένωση — πέμπτη κατάσταση **δεν μεταγλωττίζεται** χωρίς απόφαση. */
export type ProfessionalRegistrationWriteResult =
  | { readonly kind: 'saved'; readonly attestation: ProfessionalAttestation }
  /** Ο άνθρωπος **ανακάλεσε** τη δήλωσή του. */
  | { readonly kind: 'cleared' }
  | { readonly kind: 'rejected'; readonly reason: ProfessionalRegistrationRejection }
  | { readonly kind: 'failed' };

/**
 * **Ό,τι πληκτρολογεί ο άνθρωπος**, ωμό. Η κρίση γίνεται στο {@link judgeRegistration}.
 *
 * ⚠️ **Κανένα `state` εδώ**: η κατάσταση δεν είναι είσοδος — δες την κεφαλή.
 */
export interface ProfessionalRegistrationInput {
  readonly authority: string;
  readonly number: string;
  readonly chapter: string;
}

/**
 * Κρίνει **χωρίς να γράφει** — καθαρή, άρα δοκιμάσιμη στα άκρα.
 *
 * ⚠️ **Καμία επικύρωση ΜΟΡΦΗΣ του αριθμού**, και είναι απόφαση της Α9.1: τα
 * μητρώα **δεν** συμφωνούν σε μορφή *(ΤΕΕ καθαρά ψηφία · ΓΕΜΗ δωδεκαψήφιο ·
 * σύλλογοι κατά περίπτωση)*. Ένα `/^\d+$/` θα απέκλειε **υπαρκτό**
 * επαγγελματία επειδή ο δικός μας κανόνας είναι στενότερος από της αρχής —
 * μαντεψιά με πρόσωπο βεβαιότητας.
 */
export function judgeRegistration(
  input: ProfessionalRegistrationInput,
):
  | { readonly ok: true; readonly registration: ProfessionalRegistration }
  | { readonly ok: false; readonly reason: ProfessionalRegistrationRejection } {
  const authority = input.authority.trim();
  const number = input.number.trim();

  if (!isRegistryAuthority(authority)) {
    return { ok: false, reason: 'registration-authority-unknown' };
  }
  // ⚠️ Η σειρά μετράει: *«λείπει ο εκδότης»* σε δήλωση **χωρίς αριθμό** θα
  //    έστελνε τον άνθρωπο να συμπληρώσει το λάθος πεδίο.
  if (number === '') return { ok: false, reason: 'registration-number-missing' };

  if (isChapteredRegistry(authority)) {
    const chapter = input.chapter.trim();
    if (chapter === '') return { ok: false, reason: 'registration-chapter-missing' };
    return { ok: true, registration: { authorityKind: 'chapter', authority, chapter, number } };
  }

  return { ok: true, registration: { authorityKind: 'national', authority, number } };
}

/**
 * **Ο ΜΟΝΑΔΙΚΟΣ ΓΡΑΦΕΑΣ** του `users/{uid}.occupationVerification`.
 *
 * @param uid Έρχεται από το **σύνορο ταυτότητας** — ποτέ από το σώμα.
 * @param input Κενή **αρχή** ⇒ **ανάκληση** *(GDPR 5§1ε: δεδομένο χωρίς σκοπό
 *   δεν κρατιέται· ο άνθρωπος που άλλαξε επάγγελμα έχει δικαίωμα να το σβήσει)*.
 */
export async function setOwnProfessionalRegistration(
  adminDb: AdminFirestore,
  uid: string,
  input: ProfessionalRegistrationInput,
): Promise<ProfessionalRegistrationWriteResult> {
  try {
    if (input.authority.trim() === '' && input.number.trim() === '') {
      await adminDb
        .collection(COLLECTIONS.USERS)
        .doc(uid)
        .set({ [OCCUPATION_VERIFICATION_FIELD]: null, updatedAt: new Date() }, { merge: true });
      logger.info('[ProfessionalRegistration] Η δήλωση ανακλήθηκε', { uid });
      return { kind: 'cleared' };
    }

    const verdict = judgeRegistration(input);
    if (!verdict.ok) return { kind: 'rejected', reason: verdict.reason };

    // 🔴 **`declared`, ΠΟΤΕ `verified`** — δες την κεφαλή του αρχείου.
    const attestation: ProfessionalAttestation = {
      state: 'declared',
      registration: verdict.registration,
    };

    await adminDb
      .collection(COLLECTIONS.USERS)
      .doc(uid)
      .set({ [OCCUPATION_VERIFICATION_FIELD]: attestation, updatedAt: new Date() }, { merge: true });

    // ⚠️ **Ποτέ ο ίδιος ο αριθμός στα logs** — είναι αναγνωριστικό μητρώου.
    logger.info('[ProfessionalRegistration] Η δήλωση αποθηκεύτηκε', {
      uid,
      authority: verdict.registration.authority,
    });
    return { kind: 'saved', attestation };
  } catch (error) {
    logger.error('[ProfessionalRegistration] Η γραφή απέτυχε', { uid, error });
    // 🔴 **Η βλάβη ΔΕΝ είναι άρνηση** (N.12): *«δεν μπόρεσα να γράψω»* ≠ *«ο
    //    αριθμός μητρώου σου είναι λάθος»*. Ο άνθρωπος που θα διάβαζε το δεύτερο
    //    θα άλλαζε έναν **σωστό** αριθμό.
    return { kind: 'failed' };
  }
}
