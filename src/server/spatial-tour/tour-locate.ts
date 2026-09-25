import 'server-only';

/**
 * @fileoverview **ΠΟΥ ΖΕΙ Η ΠΕΡΙΗΓΗΣΗ ΑΥΤΗΣ ΤΗΣ ΑΓΓΕΛΙΑΣ** — ρίζα → κάτοχος → έγγραφο.
 * @related ADR-884 Φ0.1 · Φ0.2 · Φ0.7
 * @module server/spatial-tour/tour-locate
 *
 * 🔑 **Κανένα `tourId` από τον πελάτη.** Η περιήγηση βρίσκεται από τη **ρίζα** (`TourSubject`): το id είναι
 * ντετερμινιστικό ανά (είδος, ρίζα) και το διαμέρισμα **παράγεται** από τον κάτοχο της αγγελίας
 * (`tourCustodyOf`). Άρα κανείς δεν μπορεί να στείλει id περιήγησης άλλου κατόχου, και μια αγγελία που
 * άλλαξε χώρο βρίσκει την περιήγηση εκεί που **πρέπει** να είναι — όχι εκεί που ήταν.
 *
 * ⚠️ Οι αναγνώσεις είναι `.doc(id).get()` — καμία πύλη ερωτήματος (3.35) δεν τις βλέπει· ο κάτοχος
 * κρίνεται **εδώ**, από τη ρίζα.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { spatialTourFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { SPATIAL_TOUR_COLLECTION } from '@/lib/spatial-tour/spatial-tour-custody';
import { tourCustodyOf, type TourSubjectRecord } from '@/lib/spatial-tour/tour-authority';
import { custodyKindOfScope, type CustodyScope } from '@/lib/workspace/custody-scope';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { SpatialTour, TourSubject } from '@/types/spatial-tour';

export type TourLocation =
  | {
      readonly kind: 'found';
      readonly record: TourSubjectRecord;
      readonly custody: CustodyScope;
      readonly tourRef: DocumentReference;
      /** `null` ⇒ δεν έχει φτιαχτεί ακόμη περιήγηση (ή το έγγραφο δεν διαβάζεται — βλάβη, όχι «δημόσια»). */
      readonly tour: SpatialTour | null;
    }
  /** Η ρίζα δεν υπάρχει (ή δεν διαβάζεται). */
  | { readonly kind: 'absent' }
  /** Εταιρική ρίζα **χωρίς** μισθωτή — δεν έχει χώρο, άρα ούτε περιήγηση. */
  | { readonly kind: 'unscoped' };

/** Η ρίζα, φορτωμένη **μέσα από το σύνορό της** — ποτέ ωμό `data()` για ιδιώτη (CHECK 3.74). */
async function readSubjectRecord(db: Firestore, subject: TourSubject): Promise<TourSubjectRecord | null> {
  if (subject.kind === 'owner-property') {
    const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(subject.id).get();
    const property = ownerPropertyFromDocument(snap.data(), subject.id);
    return property === null ? null : { kind: 'owner-property', property };
  }
  const snap = await db.collection(COLLECTIONS.PROPERTIES).doc(subject.id).get();
  const data = snap.data();
  return data === undefined ? null : { kind: 'company-property', property: { companyId: data.companyId } };
}

/** **Βρες την περιήγηση μιας αγγελίας** — και τον κάτοχό της, όπως τον λέει η ρίζα **τώρα**. */
export async function locateSpatialTour(db: Firestore, subject: TourSubject): Promise<TourLocation> {
  const record = await readSubjectRecord(db, subject);
  if (record === null) return { kind: 'absent' };
  const custody = tourCustodyOf(record);
  if (custody === null) return { kind: 'unscoped' };

  const tourId = enterpriseIdService.generateDeterministicSpatialTourId(subject.kind, subject.id);
  const tourRef = db.collection(COLLECTIONS[SPATIAL_TOUR_COLLECTION[custodyKindOfScope(custody)]]).doc(tourId);
  const snap = await tourRef.get();
  const tour = snap.exists ? spatialTourFromDocument(snap.data(), tourId) : null;
  return { kind: 'found', record, custody, tourRef, tour };
}
