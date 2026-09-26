import 'server-only';

/**
 * @fileoverview **ΕΧΕΙ ΑΥΤΗ Η ΑΓΓΕΛΙΑ ΠΕΡΙΗΓΗΣΗ ΠΟΥ ΦΑΙΝΕΤΑΙ;** — η μόνη ερώτηση της δημόσιας σελίδας (ADR-884 Κ3β).
 * @related `lib/spatial-tour/tour-view-policy.ts` (`isTourListed`) · `app/api/spatial-tours/listings/[listingId]/presence`
 * @module server/spatial-tour/tour-presence
 *
 * 🔑 **Αυτοενεργοποίηση χωρίς σημαία**: η κάρτα εμφανίζεται μόνο όταν η περιήγηση είναι δημοσιευμένη, **όχι**
 * `link-only` (αόρατη στην αγγελία, Δ3), **και** έχει κάτι να δείξει (έτοιμο tileset). Μέχρι να παραδώσει ο ψήστης
 * της Φ2 το πρώτο tileset, η κάρτα μένει κρυφή **από μόνη της** — κανείς δεν «ανάβει διακόπτη».
 *
 * 🔒 **Ελάχιστη αποκάλυψη**: απαντά μόνο `visibility` — ποτέ ποιος τη διαχειρίζεται, πόσοι ζήτησαν, ή αν υπάρχει
 * περιήγηση `link-only`/πρόχειρη (και τα δύο απαντούν «καμία»).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { SpatialTourVisibility } from '@/constants/spatial-tour-vocabulary';
import { tourSubjectOfListing } from '@/lib/spatial-tour/tour-subject-of-listing';
import { isTourListed } from '@/lib/spatial-tour/tour-view-policy';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';
import type { TourSubject } from '@/types/spatial-tour';

import { locateSpatialTour } from './tour-locate';

export interface TourPresence {
  readonly subject: TourSubject;
  readonly visibility: Exclude<SpatialTourVisibility, 'link-only'>;
}

/** **Η περιήγηση της αγγελίας, όπως τη βλέπει ο κόσμος** — `null` ⇒ καμία κάρτα. */
export async function readTourPresence(db: Firestore, listingId: string): Promise<TourPresence | null> {
  const subject = tourSubjectOfListing(listingId);
  if (subject === null) return null;
  const location = await locateSpatialTour(db, subject);
  if (location.kind !== 'found' || location.tour === null) return null;
  const { tour, tourRef } = location;
  if (!isOwnedByCustody(tour.custody, location.custody) || tour.visibility === 'link-only') return null;
  if (tour.lifecycle !== 'published') return null;
  // tenant-scope-exempt: υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση δημοσιευμένη, εντοπισμένη από τη ρίζα της (ADR-884 Φ0.9).
  const ready = await tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES)
    .where('audience', '==', 'public-listing')
    .where('tileset.state', '==', 'ready')
    .limit(1)
    .get();
  return isTourListed(tour, !ready.empty) ? { subject, visibility: tour.visibility } : null;
}
