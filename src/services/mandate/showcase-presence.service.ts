/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΑΠΟΔΕΔΕΙΓΜΕΝΗΣ ΠΑΡΟΥΣΙΑΣ** *(ADR-846 §8.8.15, Φ5δ)*.
 * @related lib/agency/showcase-presence.ts (η κρίση) · services/listings/publish-public-listing
 * @module services/mandate/showcase-presence.service
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΠΟΘΗΚΕΥΜΕΝΟ ΠΕΔΙΟ, ΕΝΩ ΤΟ §8.8.7 ΤΟ ΑΠΑΓΟΡΕΥΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το ADR-846 §8.8.7 απορρίπτει ρητά *«αποθήκευση του `EvidencedCoverage` ως αλήθεια»*.
 * Αυτό εδώ **δεν** είναι εξαίρεση — είναι ο **όρος** υπό τον οποίο επιτρέπεται:
 *
 * 1. **Παράγωγο**, ξαναχτίσιμο από το μηδέν από τις ζωντανές αγγελίες.
 * 2. **ΕΝΑΣ** γραφέας — αυτό το αρχείο. Καμία άλλη διαδρομή δεν γράφει το πεδίο.
 * 3. **Ποτέ πηγή**: οι Φ5α/5β/5γ ρωτούν **πάντα** τις ίδιες τις αγγελίες, ποτέ αυτό.
 *
 * ⚠️ **Και υπάρχει επειδή ο κατάλογος ΔΕΝ ΜΠΟΡΕΙ να ρωτήσει τις αγγελίες**: το
 * `usePublicAgencies` κάνει ωμό `onSnapshot(collection(…))` σε **κάθε ανώνυμο επισκέπτη**
 * *(§4.2)*, και ανάγνωση αγγελιών από πάνω πολλαπλασιάζει **ακριβώς** αυτό που το §4.2
 * απέρριψε. Το κόστος πληρώνεται **μία φορά, στον διακομιστή, όταν αλλάζει η προσφορά**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 Ο ΚΥΚΛΟΣ ΖΩΗΣ ΕΙΝΑΙ ΡΗΤΟΣ (N.7.2 #7) — ΚΑΙ ΕΧΕΙ **ΜΙΑ** ΠΛΕΥΡΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * | Πότε | Ποιος καλεί | Γιατί |
 * |---|---|---|
 * | Δημοσίευση **ή απόσυρση** αγγελίας | `writeListingProjection` | Είναι ο **μοναδικός** γραφέας του `public_listings` **και για τις δύο** κατευθύνσεις — ένα σημείο, καμία διαδρομή να ξεχαστεί |
 * | Μαζική επανασύνθεση | `rebuild-public-listings.service` | Το **δίχτυ ασφαλείας** *(N.7.2 #4)*: ξαναχτίζει από το μηδέν |
 * | Δημοσίευση **βιτρίνας** | — | ⛔ **ΔΕΝ καλεί.** Η δήλωση δεν αλλάζει την προσφορά· το `publishShowcase` **μεταφέρει** το πεδίο μέσα στη συναλλαγή του, όπως το `mark` |
 *
 * **Layering**: service — Admin SDK μόνο. Η **κρίση** ζει στο `lib/agency/showcase-presence`.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { presenceFromListings } from '@/lib/agency/showcase-presence';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { MAX_PRESENCE_AREAS } from '@/types/agency-profile';
import type { PublicListing } from '@/types/public-listing';

const logger = createModuleLogger('mandate/showcase-presence');

/**
 * **Ξαναχτίζει το `presence` ΕΝΟΣ γραφείου από τις ζωντανές αγγελίες του.**
 *
 * 🔑 **Ιδεμποτής** *(N.7.2 #3)*: ίδιες αγγελίες ⇒ ίδιο σύνολο ⇒ ίδια γραφή. Δύο κλήσεις
 * στη σειρά δεν παράγουν τίποτα διαφορετικό από μία.
 *
 * ⚠️ **`update`, ΟΧΙ `set`** — και είναι απόφαση: το έγγραφο της βιτρίνας ανήκει στον
 * **άνθρωπο** *(`publishShowcase`)*, και αυτή η πράξη αγγίζει **ένα** παράγωγο πεδίο του.
 * Ένα `set` εδώ θα διεκδικούσε ολόκληρο το έγγραφο, δηλαδή θα γινόταν **δεύτερος γραφέας
 * της βιτρίνας** — ακριβώς αυτό που η επικεφαλίδα αποκλείει.
 *
 * ⚠️ **Βιτρίνα που δεν υπάρχει ⇒ ΣΙΩΠΗ, όχι σφάλμα.** Ο επαγγελματίας μπορεί να έχει
 * αγγελίες **χωρίς** να έχει δημοσιεύσει βιτρίνα — απολύτως νόμιμο *(η βιτρίνα είναι
 * opt-in, §4.2)*. Το `update` σε ανύπαρκτο έγγραφο πετά· γι' αυτό η αποτυχία
 * **καταγράφεται και καταπίνεται**: η δημοσίευση της **αγγελίας** δεν επιτρέπεται να
 * αποτύχει επειδή δεν υπάρχει βιτρίνα να ενημερωθεί.
 *
 * 🔴 **ΑΝΑΜΕΝΕΤΑΙ (`await`), ΚΑΙ Η ΑΠΟΜΟΝΩΣΗ ΤΟΥ ΣΦΑΛΜΑΤΟΣ ΖΕΙ ΕΔΩ ΜΕΣΑ** *(N.7.2 #6)*.
 *
 * Το `presence` είναι **μάρκετινγκ**· η αγγελία είναι **δέσμευση προς τον ιδιοκτήτη**
 * *(θεματοφυλακή, CHECK 3.56)*. Άρα μια αποτυχία εδώ **δεν** επιτρέπεται να ακυρώσει τη
 * δημοσίευση εκείνης — και γι' αυτό **δεν πετά ποτέ**.
 *
 * ⛔ **ΚΑΙ ΔΕΝ ΓΙΝΕΤΑΙ fire-and-forget στον καλούντα**, που θα ήταν ο προφανής τρόπος να
 * ειπωθεί το ίδιο: σε **serverless** διαδρομή η εκτέλεση τερματίζει με την απόκριση, και
 * ένα ξεκρέμαστο `Promise` θα **σκοτωνόταν στη μέση** — δηλαδή το πεδίο θα έμενε
 * μπαγιάτικο **τυχαία**, χωρίς κανένα ίχνος. Η σωστή διατύπωση του *«δεν μπλοκάρει»* είναι
 * **συνάρτηση που δεν αποτυγχάνει**, όχι κλήση που δεν αναμένεται.
 *
 * @param companyId Η ταυτότητα του γραφείου — **και το κλειδί του εγγράφου βιτρίνας**.
 */
export async function refreshShowcasePresence(
  adminDb: AdminFirestore,
  companyId: string
): Promise<void> {
  if (companyId.trim() === '') return;

  try {
    // tenant-scope-exempt: το `public_listings` είναι δημοσιευμένη προβολή
    // (`unscopedCategory: 'published-projection'`), και το `agencyId` **δεν είναι
    // ταυτότητα πελάτη**: είναι το κλειδί εγγράφου του `agency_profiles/{companyId}`,
    // που ο κανόνας δίνει σε **ανώνυμο** (ADR-841 §7 Α1). Το φίλτρο είναι **στενότερο**
    // από το αφιλτράριστο ερώτημα που ο ίδιος κανόνας ήδη επιτρέπει.
    const snapshot = await adminDb
      .collection(COLLECTIONS.PUBLIC_LISTINGS)
      .where('agencyId', '==', companyId)
      .get();

    const listings: PublicListing[] = [];
    for (const doc of snapshot.docs) {
      // 🔴 CHECK 3.74 — ο μοναδικός επιτρεπόμενος ισχυρισμός `PublicListing` ζει ΜΕΣΑ
      //    στο `publicListingFromDocument`, ποτέ εδώ.
      const listing = publicListingFromDocument(doc.data(), doc.id);
      if (listing !== null) listings.push(listing);
    }

    const presence = presenceFromListings(listings);

    // ⚠️ **Η υπέρβαση του ταβανιού λέγεται.** Η συνέπεια είναι **ψευδώς αρνητικό** — το
    //    γραφείο δεν εμφανίζεται κάπου όπου δουλεύει — και είναι το είδος της σιωπηλής
    //    απώλειας που **κανείς δεν ανακαλύπτει από την οθόνη**.
    if (presence.length >= MAX_PRESENCE_AREAS) {
      logger.warn('Η αποδεδειγμένη παρουσία άγγιξε το ταβάνι — κάποιες περιοχές δεν γράφτηκαν', {
        companyId,
        scannedListings: listings.length,
        cap: MAX_PRESENCE_AREAS,
      });
    }

    await adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId).update({ presence });
  } catch (error) {
    logger.warn('Η αποδεδειγμένη παρουσία δεν ενημερώθηκε — η βιτρίνα μένει ΜΠΑΓΙΑΤΙΚΗ', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
