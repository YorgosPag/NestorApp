import 'server-only';

/**
 * @fileoverview **ΠΟΥ ΕΙΝΑΙ ΑΥΤΟΣ Ο ΤΟΠΟΣ** — η γεωμετρία, από τον διακομιστή.
 * @related ADR-841 Φ6-Β4 · services/places/public-place-read.service.ts
 * @module services/places/place-position.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΘΕΣΗ ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΣΥΡΜΑ — Η ΙΔΙΑ ΚΛΑΣΗ ΜΕ ΤΗΝ ΕΤΙΚΕΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η βιτρίνα κουβαλά **αποκανονικοποιημένο** σημείο, ώστε το φίλτρο *«κοντά
 * μου»* να συγκρίνει **γεωμετρία με γεωμετρία** χωρίς δεύτερη ανάγνωση ανά
 * κάρτα. Το ερώτημα ήταν *ποιος το γράφει*.
 *
 * ⛔ **Όχι ο πελάτης.** Ένα `position` από το σώμα επιτρέπει βιτρίνα με `place`
 * στη **Θεσσαλονίκη** και σημείο στην **Αθήνα**: το φίλτρο θα τη βρίσκει στην
 * Αθήνα και η κάρτα θα δείχνει Θεσσαλονίκη. Είναι **ακριβώς** η βλάβη *«σωστό
 * φίλτρο, ψεύτικη κάρτα»* που ο ίδιος φάκελος κλείνει για την **ετικέτα** του
 * επαγγέλματος — και θα ήταν χειρότερη, γιατί δίνει **προβολή σε αγορά που δεν
 * υπηρετείς**.
 *
 * 🔑 **Και υπάρχει ήδη προηγούμενο, μετρημένο**: η δημόσια αγγελία παίρνει το
 * `position` της από τον `resolveListingPosition` — **στον διακομιστή**, από τη
 * γνώση του τόπου, ποτέ από τη φόρμα. Δεύτερο δόγμα για το ίδιο πεδίο θα ήταν
 * ADR-749 σε δύο συλλογές απόσταση.
 *
 * ⚠️ **Η γη κρατά τη θέση**, όχι το κτίριο *(Α1)*: το `PlaceRef.buildingId`
 * είναι **προαιρετικό** και μπορεί να λείπει, ενώ το `landId` ποτέ. Ρωτάμε
 * πάντα τη γη, ώστε η απάντηση να μη γίνεται **λιγότερο** γνωστή όταν ο
 * άνθρωπος δηλώνει **περισσότερα**.
 *
 * **Layering**: reader — Admin SDK, **μία** ανάγνωση κατά ταυτότητα.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlacePosition } from '@/types/geo/public-place';

const logger = createModuleLogger('place-position.reader');

/**
 * **Το αντιπροσωπευτικό σημείο μιας γης**, ή `null`.
 *
 * ⚠️ **Το `null` εδώ ΔΕΝ ισοπεδώνει τρία πράγματα κατά λάθος** — τα ισοπεδώνει
 * **σκόπιμα**, και η διαφορά είναι ότι κανένα από τα τρία δεν αλλάζει τη
 * θεραπεία: *«η γη δεν έχει θέση»*, *«η γη δεν υπάρχει»* και *«δεν μπόρεσα να
 * ρωτήσω»* καταλήγουν όλα σε βιτρίνα **χωρίς σημείο**, δηλαδή σε κάποιον που
 * απλώς δεν εμφανίζεται στο φίλτρο απόστασης.
 *
 * 🔴 **Η ΥΠΑΡΞΗ ΤΟΥ ΤΟΠΟΥ ΚΡΙΝΕΤΑΙ ΑΛΛΟΥ** — από τον `verifyPlaceRef`, που
 * ξέρει να πει *«άλλαξέ τον»* από *«ξαναδοκίμασε»*. Αν αυτή η συνάρτηση
 * προσπαθούσε να απαντήσει **και** εκείνο το ερώτημα, θα ήταν δεύτερος κριτής
 * της ίδιας ερώτησης με λιγότερες λέξεις.
 */
export async function readLandPosition(
  adminDb: AdminFirestore,
  landId: string,
): Promise<GeoPoint | null> {
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.PUBLIC_LANDS).doc(landId).get();
    if (!snapshot.exists) return null;

    const position = (snapshot.data() as { position?: PlacePosition } | undefined)?.position;
    // ⚠️ `kind: 'unknown'` είναι **ρητή** δήλωση άγνοιας του επιπέδου Α — όχι
    //    κενό πεδίο. Την τιμούμε: καμία εικασία σημείου.
    return position !== undefined && position.kind === 'known' ? position.point : null;
  } catch (error) {
    logger.error('[PLACE-POSITION] Η θέση της γης δεν διαβάστηκε — η βιτρίνα μένει χωρίς σημείο', {
      data: { landId },
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
