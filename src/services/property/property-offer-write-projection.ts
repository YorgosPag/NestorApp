/**
 * =============================================================================
 * ΔΙΑΘΕΣΕΙΣ → παραγόμενα πεδία, στη ΓΡΑΦΗ — ADR-777 Α20
 * =============================================================================
 *
 * **Ο μόνος παραγωγός `commercialStatus` / `offerKinds` στο σύστημα.**
 *
 * ## Γιατί χωριστό αρχείο από το gateway
 *
 * Δύο **διαφορετικές ευθύνες** (N.7.1):
 *   - το `property-mutation-gateway` απαντά *«επιτρέπεται αυτή η μετάλλαξη;»*
 *     (ρόλοι, κλειδωμένα πεδία, cascade μετονομασίας, ιχνηλάτηση)·
 *   - **αυτό** απαντά *«τι σημαίνουν αυτές οι διαθέσεις;»* — καθαρή προβολή.
 *
 * Ο διαχωρισμός δεν είναι αισθητικός: η προβολή είναι **ρητά lossy** (η
 * αντιπαροχή δεν έχει τιμή στο επτάτιμο λεξιλόγιο) και έχει **δικό της** σύνολο
 * σφαλμάτων. Μπλεγμένη μέσα στην πολιτική, το «γιατί έγινε unavailable;» θα
 * διαβαζόταν ως απόφαση **πολιτικής** αντί για δηλωμένο **όριο προβολής**.
 *
 * @module services/property/property-offer-write-projection
 * @enterprise ADR-777 Α20
 */

import { DEFAULT_COMMERCIAL_STATUS } from '@/constants/commercial-statuses';
import type { PropertyOffer } from '@/types/property-offers';
import {
  deriveCommercialStatus,
  deriveOfferKinds,
  hasDuplicateLiveOfferKind,
} from '@/lib/offers/derive-commercial-status';
import { PropertyMutationPolicyError } from './property-mutation-errors';

// =============================================================================
// 1. Η COMPILE-TIME ΑΜΥΝΑ
// =============================================================================

/**
 * **Η compile-time άμυνα των ΔΙΑΘΕΣΕΩΝ.**
 *
 * Οι **νέοι** καλούντες τυποποιούν έτσι το payload τους. Το `?: never` κάνει τα
 * παραγόμενα πεδία **αδύνατα να εκφραστούν**: ένα
 * `{ offers: [...], commercialStatus: 'sold' }` **δεν μεταγλωττίζεται**.
 *
 * 🏆 Το **Revit** επιβάλλει το read-only σε **χρόνο εκτέλεσης** (γράφεις →
 * σφάλμα). Εδώ το λάθος δεν προλαβαίνει να γίνει πρόγραμμα.
 *
 * ⚠️ Το `updates` του `updatePropertyWithPolicy` παραμένει
 * `Record<string, unknown>` για τους **6 υπάρχοντες** καταναλωτές — γι' αυτό η
 * επιβολή είναι **δύο στρώματα**, και το δεύτερο
 * ({@link DerivedFieldWriteError}) **δεν είναι πλεονασμός**.
 */
export type PropertyOffersUpdate = {
  readonly offers: PropertyOffer[];
  readonly commercialStatus?: never;
  readonly offerKinds?: never;
};

// =============================================================================
// 2. ΣΦΑΛΜΑΤΑ
// =============================================================================

/**
 * Ο καλών προσπάθησε να γράψει **παραγόμενο** πεδίο.
 *
 * Είναι το συμβόλαιο του **Revit** για read-only παράμετρο: *«a read-only
 * parameter … cannot be modified»*, γιατί *«some parameters hold values that are
 * driven by other constraints»* ⇒ **αλλάζεις ό,τι την οδηγεί**. Εδώ ό,τι την
 * οδηγεί είναι το `offers`.
 */
export class DerivedFieldWriteError extends PropertyMutationPolicyError {
  constructor(field: string) {
    super(
      `«${field}» is DERIVED from \`offers\` (ADR-777 Α20) and must never be written directly. ` +
      `Write \`offers\` instead — the gateway derives \`commercialStatus\` and \`offerKinds\` from it.`,
    );
    this.name = 'DerivedFieldWriteError';
  }
}

/**
 * Δύο **ζωντανές** διαθέσεις ίδιου είδους = δύο τιμές για ένα πράγμα — ακριβώς
 * το διπλότυπο που η Α20 υπάρχει για να εξαλείψει.
 */
export class ConflictingLiveOffersError extends PropertyMutationPolicyError {
  constructor() {
    super(
      'Conflicting offers: a property may hold at most ONE live offer per kind ' +
      '(sell / leaseOut / exchange). Close or withdraw the existing one first.',
    );
    this.name = 'ConflictingLiveOffersError';
  }
}

// =============================================================================
// 3. Η ΠΡΟΒΟΛΗ
// =============================================================================

/**
 * Παράγει `commercialStatus` + `offerKinds` από τις διαθέσεις του payload.
 *
 * Όταν το payload φέρνει `offers`, τα δύο πεδία **παράγονται** — και ο καλών
 * **δεν επιτρέπεται** να τα στείλει κι ο ίδιος: δύο εγγράψιμα πεδία για το ίδιο
 * γεγονός είναι **δύο αλήθειες** (ADR-749), και εδώ θα ήταν δύο αλήθειες που
 * μπορούν να **διαφωνήσουν**.
 *
 * ⚠️ **ΣΤΑΔΙΑΚΟ, ΕΠΙΤΗΔΕΣ.** Χωρίς `offers` στο payload, το `commercialStatus`
 * γράφεται όπως πάντα. Έτσι κάθε υπάρχων δρόμος (συμπεριλαμβανομένου του
 * `revertPropertySaleWithPolicy`, που γυρίζει `sold → for-sale` **σκόπιμα**)
 * συνεχίζει να δουλεύει αμετάβλητος, ενώ ο **νέος** δρόμος είναι αυστηρός.
 *
 * @param payload — μεταλλάσσεται επιτόπου, όπως και οι υπόλοιποι
 *                  κανονικοποιητές γραφής του gateway
 */
export function applyOfferProjectionsForWrite(
  payload: Record<string, unknown>,
): void {
  // Το `offerKinds` είναι ΠΑΝΤΑ παραγόμενο — ακόμη και χωρίς `offers`.
  if ('offerKinds' in payload) {
    throw new DerivedFieldWriteError('offerKinds');
  }

  if (!('offers' in payload)) return;

  const offers = payload.offers;

  // Ρητή διαγραφή διαθέσεων ⇒ το ακίνητο φεύγει από την αγορά.
  if (offers === null || offers === undefined) {
    payload.commercialStatus = DEFAULT_COMMERCIAL_STATUS;
    payload.offerKinds = [];
    return;
  }

  if (!Array.isArray(offers)) {
    throw new PropertyMutationPolicyError(
      `«offers» must be an array of PropertyOffer, received ${typeof offers}.`,
    );
  }

  const typedOffers = offers as PropertyOffer[];

  if (hasDuplicateLiveOfferKind(typedOffers)) {
    throw new ConflictingLiveOffersError();
  }

  if ('commercialStatus' in payload) {
    throw new DerivedFieldWriteError('commercialStatus');
  }

  payload.commercialStatus = deriveCommercialStatus(typedOffers);
  payload.offerKinds = deriveOfferKinds(typedOffers);
}
