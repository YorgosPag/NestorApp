/**
 * Ό,τι ακολουθεί τον κύκλο ζωής ενός **ακινήτου** — η δημόσια αγγελία του.
 *
 * Δύο κανόνες, και οι δύο πρακτική των μεγάλων (Shopify · Zillow · Idealista · Airbnb):
 *   1. ό,τι αποσύρεται (κάδος ή αρχείο) **κατεβαίνει αμέσως** από την αγορά·
 *   2. ό,τι επιστρέφει από το **αρχείο** γυρίζει **εκτός αγοράς** — η δημοσίευση είναι ρητή
 *      πράξη ανθρώπου. Από τον **κάδο** γυρίζει όπως ήταν: εκεί η επαναφορά είναι αναίρεση.
 *
 * Το (1) δεν γράφεται εδώ: το αποφασίζει ο **ένας** κριτής (`offerStateOf` ⇒ `unoffered`
 * για αποσυρμένο) και το εκτελεί ο **ένας** γραφέας (`republishListing` ⇒ διαγραφή προβολής,
 * άδειασμα ραφιών, κλείσιμο διαστήματος τιμής). Εδώ ζει μόνο **η κλήση** που έλειπε.
 *
 * @module services/property/property-lifecycle-effects
 * @enterprise ADR-281 · ADR-329 §3.9 · ADR-777 Α3/Α5
 */

import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import { deriveLegacyStatusFromCommercial } from '@/constants/commercial-statuses';
import { ARCHIVED_STATUS } from '@/lib/firestore/trashed-status';
import type { LifecycleEffects, ReinstatePatch } from '@/lib/firestore/lifecycle-effects';
import { takeOffMarket } from '@/lib/offers/take-off-market';
import { createModuleLogger } from '@/lib/telemetry';
import {
  republishListing,
  type ListingSourceProperty,
} from '@/services/listings/publish-public-listing';

const logger = createModuleLogger('PropertyLifecycleEffects');

/**
 * Ακίνητο που ήταν **ήδη** εκτός αγοράς όταν αρχειοθετήθηκε: τίποτα δεν αλλάζει εμπορικά,
 * αλλά το παλιό `status` οφείλει να επιστρέψει ίσο με το `commercialStatus` — όχι με ό,τι
 * έτυχε να κρατά το `previousStatus`. Χωρίς `commercialStatus` (παλιό έγγραφο) το `status`
 * **είναι** η εμπορική κατάσταση, άρα δεν υπάρχει τι να ευθυγραμμιστεί.
 */
function realignLegacyStatus(
  data: FirebaseFirestore.DocumentData,
  lastLiveStatus: string,
): ReinstatePatch | null {
  if (typeof data.commercialStatus !== 'string') return null;

  const mirrored = deriveLegacyStatusFromCommercial(data.commercialStatus);
  return mirrored === lastLiveStatus
    ? null
    : { fields: {}, changes: [], restoredStatus: mirrored };
}

/**
 * Επιστροφή από το αρχείο ⇒ εκτός αγοράς. Από τον κάδο ⇒ τίποτα (γυρίζει όπως ήταν).
 *
 * Το `status` επιστροφής **παράγεται** από το `commercialStatus` που θα έχει το έγγραφο μετά
 * τη γραφή, με τον έναν καθρέφτη (`deriveLegacyStatusFromCommercial`): τα δύο πεδία δεν
 * αποκλίνουν ποτέ. Αλλιώς το `previousStatus` θα ξανάφερνε το `for-sale` δίπλα σε
 * `commercialStatus: 'unavailable'`.
 */
function offMarketOnUnarchive(
  from: { readonly status: string },
  data: FirebaseFirestore.DocumentData,
  lastLiveStatus: string,
): ReinstatePatch | null {
  if (from.status !== ARCHIVED_STATUS) return null;

  const patch = takeOffMarket(data, lastLiveStatus, Timestamp.now());
  if (patch === null) return realignLegacyStatus(data, lastLiveStatus);

  return {
    fields: patch.fields,
    changes: [
      {
        field: 'commercialStatus',
        oldValue: patch.commercialStatusBefore,
        newValue: patch.commercialStatusAfter,
        label: 'commercialStatus',
      },
    ],
    outcome: 'taken-off-market',
    restoredStatus: deriveLegacyStatusFromCommercial(patch.commercialStatusAfter),
  };
}

/**
 * Ξαναγράφει τη δημόσια προβολή μετά από μετάβαση κύκλου ζωής.
 *
 * Το `republishListing` **δεν πετά ποτέ**· το `'failed'` σημαίνει «γνωστά εκκρεμές», και η
 * επανασύνθεση το διορθώνει.
 */
async function republishAfterLifecycleChange(
  db: FirebaseFirestore.Firestore,
  entityId: string,
  data: FirebaseFirestore.DocumentData,
): Promise<void> {
  // Το `id` δεν ζει μέσα στο έγγραφο — η προβολή το θέλει ως ταυτότητα της αγγελίας.
  const property: ListingSourceProperty = { ...data, id: entityId };
  const outcome = await republishListing(db, entityId, property);
  if (outcome === 'failed') {
    logger.warn('Δημόσια προβολή εκκρεμής μετά από αλλαγή κύκλου ζωής', { entityId });
  }
}

export const propertyLifecycleEffects: LifecycleEffects = {
  reinstatePatch: offMarketOnUnarchive,
  afterLifecycleChange: republishAfterLifecycleChange,
};
