/**
 * @fileoverview **Η ΕΠΩΝΥΜΙΑ ΤΟΥ ΓΡΑΦΕΙΟΥ** — το μόνο πράγμα μιας εταιρείας που επιτρέπεται να φύγει.
 * @related ADR-777 §8.33 · types/public-listing.ts
 * @module services/company/company-public-name.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟΣ ΑΝΑΓΝΩΣΤΗΣ ΓΙΑ **ΕΝΑ** ΠΕΔΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το έγγραφο `companies/{id}` κουβαλά `createdBy` (uid) · `_lastModifiedByName`
 * (**ονοματεπώνυμο ανθρώπου**) · `settings` · `plan`. Τίποτε από αυτά **δεν
 * επιτρέπεται** να πλησιάσει δημόσια επιφάνεια — είναι ακριβώς η κατηγορία διαρροής
 * που γέννησε το `public_listings` (τεκμηρίωση Google: *«you either retrieve the full
 * document, or you retrieve nothing»*).
 *
 * 🔑 **Άρα ο αναγνώστης δεν επιστρέφει «την εταιρεία» — επιστρέφει ΜΙΑ ΣΥΜΒΟΛΟΣΕΙΡΑ.**
 * Ό,τι δεν γυρίζει, δεν μπορεί να διαρρεύσει κατά λάθος από κανέναν καταναλωτή, ούτε
 * αύριο όταν κάποιος κάνει `{...company}` σε ένα JSON απάντησης.
 *
 * ⚠️ **Και είναι επωνυμία ΕΠΙΧΕΙΡΗΣΗΣ, όχι όνομα προσώπου.** Η απόφαση Giorgio
 * (2026-08-20) ήταν ότι η δημόσια αγγελία γραφείου φέρει την **επωνυμία** («ΑΛΦΑ
 * ΜΕΣΙΤΙΚΗ»). Ένα γραφείο **θέλει** να φαίνεται — αυτός είναι ο λόγος που ανεβάζει
 * αγγελίες. Ο **ιδιώτης** δεν φαίνεται ποτέ: το `listingAuthorshipOf` δίνει
 * `owner-declared` και **καμία** επωνυμία δεν υπάρχει να γραφτεί.
 *
 * **Layering**: reader — Admin SDK, μία ανάγνωση εγγράφου κατά ταυτότητα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('company-public-name.reader');

/**
 * **ΤΙ ΜΕΤΡΑΕΙ ΩΣ ΕΠΩΝΥΜΙΑ** — η κρίση, χωριστά από την ανάγνωση.
 *
 * 🔑 **Ζει χωριστά επειδή ο ΔΕΥΤΕΡΟΣ καταναλωτής δεν κάνει ανάγνωση κατά ταυτότητα**: ο
 * αναγνώστης του ρυθμιστή (`organization-capability.reader.ts`) παίρνει τα **ίδια** έγγραφα
 * `companies/{id}` από **ερώτημα**, οπότε δεύτερη ανάγνωση ανά γραμμή θα ήταν N+1 κλήσεις για
 * πληροφορία που **κρατά ήδη στα χέρια του**.
 *
 * ⚠️ Χωρίς αυτή τη συνάρτηση, εκείνος θα αντέγραφε το `typeof … === 'string' && trim() !== ''`
 * — δηλαδή θα γεννιόταν **δεύτερη απάντηση** στο *«τι είναι έγκυρη επωνυμία;»*, και οι δύο
 * θα μπορούσαν να αποκλίνουν σιωπηλά *(π.χ. η μία να δεχτεί κενό, η άλλη όχι)*.
 */
export function companyPublicNameOf(data: unknown): string | null {
  const name = (data as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' && name.trim() !== '' ? name : null;
}

/**
 * **Η επωνυμία, ή `null`.**
 *
 * ⚠️ **`null` σε κάθε αστοχία, ποτέ εξαίρεση και ποτέ κείμενο-μπαλαντέρ.** Οι
 * καταναλωτές είναι μια δημόσια αγγελία και μια οθόνη συγκατάθεσης: και οι δύο έχουν
 * **γραμμένη** εναλλακτική διατύπωση χωρίς όνομα (`introNoAgency`). Ένα «Άγνωστο
 * γραφείο» θα ήταν ωμό κείμενο σε `.ts` (N.11) **και** ισχυρισμός που κανείς δεν
 * έκανε.
 */
export async function readCompanyPublicName(
  adminDb: AdminFirestore,
  companyId: string | null,
): Promise<string | null> {
  if (companyId === null || companyId.trim() === '') return null;

  try {
    const snapshot = await adminDb.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
    return companyPublicNameOf(snapshot.data());
  } catch (error) {
    logger.error('Η επωνυμία του γραφείου δεν διαβάστηκε', {
      data: { companyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
