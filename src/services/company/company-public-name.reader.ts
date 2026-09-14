/**
 * @fileoverview **Η ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΓΡΑΦΕΙΟΥ** — το μόνο πράγμα μιας εταιρείας που επιτρέπεται να φύγει.
 * @related ADR-777 §8.33 · ADR-841 §7 (Α1) · types/public-listing.ts
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
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import { NO_AGENCY_IDENTITY, type PublicAgencyIdentity } from '@/types/public-listing';

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

// ============================================================================
// Η ΤΑΥΤΟΤΗΤΑ — όνομα ΚΑΙ αναγνωριστικό, από ΜΙΑ ανάγνωση (ADR-841 Α1.6)
// ============================================================================

/**
 * **Η βιτρίνα ΔΕΝ διαβάστηκε — άρα δεν ξέρουμε ΠΟΙΟ όνομα ισχύει.** (ADR-841 §7 Α22)
 *
 * 🔴 **ΠΕΤΑ, ΔΕΝ ΙΣΟΠΕΔΩΝΕΤΑΙ.** Το εύκολο θα ήταν *«δεν διαβάστηκε ⇒ πάρε την επωνυμία
 * της εταιρείας»* — και θα ήταν **ακριβώς η βλάβη που κλείνει η Α22**: σε μια στιγμιαία
 * αστοχία, η αγγελία θα ξαναγραφόταν με **άλλο** όνομα από τη σελίδα όπου οδηγεί. *Άγνωστο
 * ≠ κενό* (N.12). Οι γραφείς το μετρούν ως `failed`, οπότε η **προηγούμενη** προβολή μένει
 * άθικτη — μπαγιάτικη ίσως, αλλά **συνεπής** — και η επανασύνθεση την επισκευάζει.
 */
export class AgencyIdentityUnavailableError extends Error {
  constructor(readonly companyId: string) {
    super(`AGENCY_IDENTITY_UNAVAILABLE: ${companyId}`);
    this.name = 'AgencyIdentityUnavailableError';
  }
}

/**
 * **Η ταυτότητα του γραφείου για δημόσια προβολή.**
 *
 * 🔑 **Δεν είναι «η επωνυμία + ένα ακόμη πεδίο».** Το {@link PublicAgencyIdentity}
 * υπάρχει ώστε το όνομα να μην μπορεί **δομικά** να ταξιδέψει με ξένη ταυτότητα· αυτή
 * η συνάρτηση είναι το **μόνο** σημείο που το ζεύγος γεννιέται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΙΟ ΟΝΟΜΑ — ΜΙΑ ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ, ΓΡΑΜΜΕΝΗ ΣΕ ΕΝΑ ΣΗΜΕΙΟ (ADR-841 §7 Α22)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Βιτρίνα | Όνομα στην αγγελία |
 * |---|---|
 * | δημοσιευμένη | **το `displayName` της** — ό,τι λέει και η σελίδα όπου οδηγεί η κάρτα |
 * | όχι | η επωνυμία `companies/{id}.name` *(συμπεριφορά Α1, αμετάβλητη)* |
 * | δεν διαβάστηκε | {@link AgencyIdentityUnavailableError} — **ποτέ** μαντεψιά |
 *
 * 🔴 **Γιατί η βιτρίνα πρώτη**: η κάρτα είναι **σύνδεσμος** προς τη βιτρίνα *(ADR-777
 * §8.58)*. Με δύο πηγές, ο επισκέπτης πατούσε *«ΠΑΓΩΝΗΣ Α.Ε.»* και έβρισκε *«Δοκιμαστικό
 * Γραφείο»* — μετρημένο στη ζωντανή βάση 2026-09-14. Rightmove/Zoopla/RESO κάνουν το ίδιο:
 * το όνομα της αγγελίας είναι το **display name του γραφείου**, όχι του μητρώου.
 *
 * ⚠️ **Σειριακά, όχι `Promise.all`**: η επωνυμία της εταιρείας χρειάζεται **μόνο** όταν
 * λείπει βιτρίνα. Παράλληλα θα πλήρωνε **δύο** αναγνώσεις ανά γραφείο για να πετάξει τη μία.
 *
 * ⛔ **Η εντολή και η συγκατάθεση ΔΕΝ περνούν από εδώ, επίτηδες**: εκεί το όνομα είναι
 * **συμβαλλόμενο μέρος** *(στιγμιότυπο, Α1.6)* και διαβάζεται με {@link readCompanyPublicName}.
 *
 * ⚠️ **Το `id` επιστρέφεται ΑΚΟΜΗ ΚΑΙ ΟΤΑΝ Η ΕΠΩΝΥΜΙΑ ΛΕΙΠΕΙ**, και είναι απόφαση:
 * *«γραφείο χωρίς επωνυμία»* είναι υπαρκτή κατάσταση που η οθόνη ονομάζει ήδη
 * (`agencyAnonymous`), και η ταυτότητα είναι ακριβώς αυτό που επιτρέπει την
 * **επισκευή** της αργότερα. Ένα `null` id εδώ θα έσβηνε τη μόνη ένδειξη ποιον να
 * ξαναρωτήσουμε.
 *
 * ⛔ **ΔΕΝ επιστρέφει το έγγραφο** — ίδιο συμβόλαιο με τον {@link readCompanyPublicName}
 * και για τον ίδιο λόγο: ό,τι δεν γυρίζει, δεν διαρρέει.
 */
export async function readPublicAgencyIdentity(
  adminDb: AdminFirestore,
  companyId: string | null | undefined,
): Promise<PublicAgencyIdentity> {
  const id = typeof companyId === 'string' && companyId.trim() !== '' ? companyId : null;
  if (id === null) return NO_AGENCY_IDENTITY;

  const showcase = await lookupAgencyProfile(adminDb, id);
  switch (showcase.outcome) {
    case 'found':
      return { id, name: showcase.showcase.displayName };
    case 'not-published':
      return { id, name: await readCompanyPublicName(adminDb, id) };
    case 'unavailable':
      throw new AgencyIdentityUnavailableError(id);
  }
}

/** Ο επιλυτής ταυτότητας **ενός περάσματος**. Δες {@link createAgencyIdentityResolver}. */
export type AgencyIdentityResolver = (
  companyId: string | null | undefined,
) => Promise<PublicAgencyIdentity>;

/**
 * **Ο επιλυτής ενός περάσματος — μία ανάγνωση ανά ΕΤΑΙΡΕΙΑ, ποτέ ανά ακίνητο.**
 *
 * 🔴 **Υπάρχει επειδή οι δύο βρόχοι επανασύνθεσης έχουν ΑΝΤΙΘΕΤΑ σχήματα κόστους, και
 * μία λύση πρέπει να καλύπτει και τα δύο:**
 *
 * | Βρόχος | Πόσες εταιρείες | Χωρίς μνήμη |
 * |---|---|---|
 * | `republishListingsForProject` | **ακριβώς μία** *(ένα έργο ανήκει σε μία εταιρεία)* | N ταυτόσημες αναγνώσεις |
 * | `rebuildAllPublicListings` | **πολλές** | N αναγνώσεις, με επαναλήψεις |
 *
 * ⚠️ **Απομνημονεύεται και το `null`** *(η αποτυχία ανάγνωσης, ο ιδιώτης, η εταιρεία
 * χωρίς επωνυμία)*. Αλλιώς ακριβώς οι περιπτώσεις που **δεν** έχουν απάντηση θα ήταν οι
 * μόνες που πλήρωναν σε **κάθε** επανάληψη.
 *
 * 🔑 **Απομνημονεύεται η ΥΠΟΣΧΕΣΗ, όχι η τιμή**: δύο ακίνητα της ίδιας εταιρείας που
 * ρωτούν **ταυτόχρονα** μοιράζονται την **ίδια** πτήση, αντί να ξεκινήσουν δύο.
 *
 * ⚠️ **ΕΝΟΣ ΠΕΡΑΣΜΑΤΟΣ, ΠΟΤΕ ΚΑΘΟΛΙΚΟΣ.** Ένα module-level cache θα ήταν **σιωπηλό
 * TTL άπειρης διάρκειας**: μετά από μετονομασία, η επανασύνθεση που υπάρχει **για να
 * τη διορθώσει** θα ξανάγραφε το **παλιό** όνομα — δηλαδή το εργαλείο επισκευής θα
 * ήταν η αιτία της βλάβης. Η ζωή του είναι το πέρασμα, και τελειώνει μαζί του.
 */
export function createAgencyIdentityResolver(adminDb: AdminFirestore): AgencyIdentityResolver {
  const inFlight = new Map<string, Promise<PublicAgencyIdentity>>();

  return (companyId) => {
    const id = typeof companyId === 'string' && companyId.trim() !== '' ? companyId : null;
    if (id === null) return Promise.resolve(NO_AGENCY_IDENTITY);

    const known = inFlight.get(id);
    if (known !== undefined) return known;

    const pending = readPublicAgencyIdentity(adminDb, id);
    inFlight.set(id, pending);
    return pending;
  };
}
