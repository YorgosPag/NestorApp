/**
 * @fileoverview **«ΤΙ ΥΛΙΚΟ ΦΕΥΓΕΙ ΓΙΑ ΑΥΤΗ ΤΗΝ ΑΓΓΕΛΙΑ;»** — ο ΕΝΑΣ τόπος, για τον γραφέα **και** για τη συμφιλίωση (ADR-907 §11.7).
 * @related ./agency-media.reader (αρχεία του ακινήτου) · ./floor-plate.reader (κάτοψη του ορόφου) · ./listing-media-fingerprint-stamp
 * @module services/listings/listing-media-sources
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: το αποτύπωμα των μέσων είναι `canonicalJson(πηγές)`. Το γράφει ο {@link republishListing} και το
 * ξαναϋπολογίζει κάθε βράδυ η συμφιλίωση. Αν η κάτοψη ορόφου έμπαινε στις πηγές **μόνο** του γραφέα, τα δύο θα
 * διέφεραν **πάντα** ⇒ κάθε αγγελία με κάτοψη ορόφου θα διαβαζόταν `stale` και θα ξαναψηνόταν κάθε βράδυ, για πάντα.
 * Δύο καλούντες, μία σύνθεση — η διαφωνία γίνεται δομικά αδύνατη.
 *
 * 🔑 **Σύνθεση, όχι τρίτος αναγνώστης**: κάθε αναγνώστης κρατά το δικό του ερώτημα και τους δικούς του φρουρούς. Εδώ
 * ζει μόνο η **σειρά** — τα αρχεία του ακινήτου πρώτα, η κάτοψη του ορόφου τελευταία (δεν τρώει θέση φωτογραφίας και
 * δεν μετρά στο όριο των 24).
 *
 * ⚠️ **Η δήλωση του ακινήτου διαβάζεται ΕΔΩ, από το έγγραφο που ήδη κρατά ο καλών** (ADR-841 Α14.7.2) — καμία δεύτερη
 * ανάγνωση, και καμία περίπτωση να δει άλλη έκδοση του εγγράφου από αυτήν που προβάλλεται.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

import { agencyMediaDeclaration } from './agency-media-publication';
import { createAgencyMediaResolver } from './agency-media.reader';
import { createFloorPlateResolver } from './floor-plate.reader';
import type { ListingSourceProperty } from './publish-public-listing';

/** Οι πηγές ραφιού **μιας** αγγελίας γραφείου, από το έγγραφο του ακινήτου της. */
export type ListingMediaResolver = (
  propertyId: string,
  property: ListingSourceProperty,
) => Promise<readonly PublicShelfSource<ListingMaterial>[]>;

/**
 * **Ο επιλυτής ενός περάσματος.** Οι δύο αναγνώστες είναι ανεξάρτητες ερωτήσεις σε διαφορετικά έγγραφα ⇒ παράλληλα.
 * Κανένας από τους δύο δεν πετά.
 */
export function createListingMediaResolver(adminDb: AdminFirestore): ListingMediaResolver {
  const resolveAgencyMedia = createAgencyMediaResolver(adminDb);
  const resolveFloorPlate = createFloorPlateResolver(adminDb);

  return async (propertyId, property) => {
    const [agencyMedia, floorPlate] = await Promise.all([
      resolveAgencyMedia(propertyId, property.companyId, agencyMediaDeclaration(property)),
      resolveFloorPlate(propertyId, property),
    ]);
    return [...agencyMedia, ...floorPlate];
  };
}
