import 'server-only';

/**
 * @fileoverview **Η ΤΑΞΙΝΟΜΙΑ, ΔΙΑΒΑΣΜΕΝΗ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** — η ετικέτα δεν έρχεται ποτέ από το σύρμα.
 * @related ADR-841 Φ6-Β · ADR-132 · services/mandate/agency-profile.service.ts
 * @module services/esco/occupation-classification.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΘΕΡΑΠΕΥΕΙ: «ΣΩΣΤΟ ΦΙΛΤΡΟ, ΨΕΥΤΙΚΗ ΚΑΡΤΑ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η δήλωση της βιτρίνας δίνει **μόνο `escoUri`**. Αν έδινε και ετικέτα, ένας
 * πελάτης θα μπορούσε να στείλει το URI **του υδραυλικού** με ετικέτα
 * **«Δικηγόρος»**: το φίλτρο ειδικότητας θα τον έβαζε σωστά στους υδραυλικούς
 * *(δουλεύει πάνω στο URI)*, και η **κάρτα** θα έγραφε «Δικηγόρος». Κάθε
 * έλεγχος πράσινος, η οθόνη ψεύτικη.
 *
 * ⇒ Ο διακομιστής διαβάζει την ταξινομία **μία φορά ανά γραφή** και γράφει
 * **και τις δύο** ετικέτες + το `iscoCode`. Ίδιο ιδίωμα με το
 * `companyId: authority.companyId`: *«από την απόδειξη, ποτέ από όρισμα»*.
 *
 * ⚠️ **Η ΟΙΚΟΝΟΜΙΑ ΕΙΝΑΙ ΔΗΛΩΜΕΝΗ** *(ADR-841 Α1.6)*: μία ανάγνωση ανά
 * **δημοσίευση**, όχι ανά προβολή. Η βιτρίνα κουβαλά το αντίγραφο, με το ρητό
 * ιδίωμα *«αντίγραφο, όχι αυθεντία»* — η αυθεντία μένει το `escoUri`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΕΚΒΑΣΕΙΣ, ΠΟΤΕ `null` (N.12)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Δεν υπάρχει τέτοιο επάγγελμα»* ≠ *«δεν μπόρεσα να ρωτήσω»*. Ισοπεδωμένες,
 * μια βλάβη Firestore θα έλεγε στον άνθρωπο ότι **η ειδικότητά του δεν
 * υπάρχει** — και θα διάλεγε άλλη. Ο γραφέας απαντά `422` στο πρώτο και `503`
 * στο δεύτερο, δηλαδή *«διόρθωσε»* έναντι *«ξαναδοκίμασε»*.
 *
 * **Layering**: reader — Admin SDK, **μία** ανάγνωση κατά ταυτότητα. Καμία κρίση.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { escoDocIdOf } from '@/lib/esco/esco-uri';
import { createModuleLogger } from '@/lib/telemetry';
import type { ClassifiedOccupation } from '@/types/agency-profile';

const logger = createModuleLogger('occupation-classification.reader');

/**
 * Η έκβαση της ανάγνωσης — **διακριτή ένωση**, ώστε ο καλών να μην μπορεί να
 * ξεχάσει τη διαφορά ανάμεσα σε *«δεν υπάρχει»* και *«δεν ρωτήθηκε»*.
 */
export type ClassificationRead =
  | { readonly outcome: 'classified'; readonly occupation: ClassifiedOccupation }
  /** Το URI δεν αναλύεται, ή δεν αντιστοιχεί σε επάγγελμα της ταξινομίας. */
  | { readonly outcome: 'absent' }
  /** 🔴 **Άγνωστο ≠ κενό.** Βλάβη ανάγνωσης, ή έγγραφο με ελλιπή ταξινόμηση. */
  | { readonly outcome: 'unavailable' };

/**
 * **Ποιο επάγγελμα είναι αυτό το URI;** — από τη μνήμη ταξινομίας, με το Admin SDK.
 *
 * @param escoUri Ό,τι δήλωσε ο άνθρωπος. **Η μόνη** είσοδος από το σύρμα.
 */
export async function readOccupationClassification(
  adminDb: AdminFirestore,
  escoUri: string,
): Promise<ClassificationRead> {
  const docId = escoDocIdOf(escoUri);
  // ⚠️ Μη αναλύσιμο URI είναι **απουσία, όχι βλάβη**: ο άνθρωπος έστειλε κάτι
  //    που δεν είναι ESCO URI, και η θεραπεία είναι να ξαναδιαλέξει.
  if (docId === null) return { outcome: 'absent' };

  try {
    const snapshot = await adminDb.collection(COLLECTIONS.ESCO_CACHE).doc(docId).get();
    if (!snapshot.exists) return { outcome: 'absent' };

    const data = snapshot.data() as
      | { uri?: unknown; iscoCode?: unknown; preferredLabel?: { el?: unknown; en?: unknown } }
      | undefined;

    const iscoCode = nonEmpty(data?.iscoCode);
    const el = nonEmpty(data?.preferredLabel?.el);
    const en = nonEmpty(data?.preferredLabel?.en);

    // 🔴 **Ελλιπές έγγραφο ⇒ `unavailable`, ΠΟΤΕ `absent`.** Το επάγγελμα
    //    **υπάρχει** — η μνήμη μας είναι μισή. Ένα «δεν υπάρχει» εδώ θα έστελνε
    //    τον άνθρωπο να αλλάξει σωστή επιλογή για δικό μας λάθος εισαγωγής.
    if (iscoCode === null || el === null || en === null) {
      logger.error('[ESCO] Έγγραφο ταξινομίας με ελλιπή πεδία — η γραφή ΔΕΝ προχωρά', {
        data: { docId, escoUri },
      });
      return { outcome: 'unavailable' };
    }

    return {
      outcome: 'classified',
      // ⚠️ Το `escoUri` γράφεται **κανονικοποιημένο από την ταξινομία** όταν το
      //    έγγραφο το φέρει: δύο γραφές του ίδιου επαγγέλματος με διαφορετικό
      //    κείμενο URI θα ήταν δύο τιμές φίλτρου για ένα επάγγελμα.
      occupation: { escoUri: nonEmpty(data?.uri) ?? escoUri.trim(), iscoCode, label: { el, en } },
    };
  } catch (error) {
    logger.error('[ESCO] Η ανάγνωση της ταξινομίας απέτυχε — άγνωστο, όχι κενό', {
      data: { docId, escoUri },
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unavailable' };
  }
}

/** Μη-κενό κείμενο, ή `null` — το σύνορο δέχεται `unknown`, όχι υποσχέσεις. */
function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
