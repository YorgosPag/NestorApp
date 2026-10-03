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
import { text } from '@/lib/agency/showcase-read-primitives';
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
      /** Πώς λέγεται το ακίνητο (τίτλος αγγελίας ιδιώτη · όνομα μονάδας γραφείου) — `null` αν λείπει. */
      readonly label: string | null;
      readonly custody: CustodyScope;
      readonly tourRef: DocumentReference;
      /** `null` ⇒ δεν έχει φτιαχτεί ακόμη περιήγηση (ή το έγγραφο δεν διαβάζεται — βλάβη, όχι «δημόσια»). */
      readonly tour: SpatialTour | null;
    }
  /** Η ρίζα δεν υπάρχει (ή δεν διαβάζεται). */
  | { readonly kind: 'absent' }
  /** Εταιρική ρίζα **χωρίς** μισθωτή — δεν έχει χώρο, άρα ούτε περιήγηση. */
  | { readonly kind: 'unscoped' };

/** Η ρίζα, κριμένη, και πώς λέγεται το ακίνητο (τίτλος αγγελίας ιδιώτη · όνομα μονάδας γραφείου) — `null` αν λείπει. */
export interface TourSubjectReading {
  readonly record: TourSubjectRecord;
  readonly label: string | null;
}

/** Πού ζει η ρίζα κάθε είδους — **μία** απάντηση για όποιον τη φορτώνει ή τη σαρώνει. */
export const TOUR_SUBJECT_COLLECTION = {
  'owner-property': COLLECTIONS.OWNER_PROPERTIES,
  'company-property': COLLECTIONS.PROPERTIES,
} as const satisfies Readonly<Record<TourSubject['kind'], string>>;

/**
 * **Έγγραφο ρίζας → ρίζα + τίτλος**, μέσα από το σύνορό της — ποτέ ωμό `data()` για ιδιώτη (CHECK 3.74). Η **μία**
 * ανάγνωση: την καλεί το `locateSpatialTour` (ένα έγγραφο) **και** ο κατάλογος «τα ακίνητά μου» (ερώτημα, ADR-904 Κ7).
 */
export function tourSubjectFromDocument(kind: TourSubject['kind'], data: unknown, id: string): TourSubjectReading | null {
  if (kind === 'owner-property') {
    const property = ownerPropertyFromDocument(data, id);
    return property === null ? null : { record: { kind: 'owner-property', property }, label: text(property.title) };
  }
  if (typeof data !== 'object' || data === null) return null;
  const { companyId, name } = data as { readonly companyId?: unknown; readonly name?: unknown };
  return { record: { kind: 'company-property', property: { companyId } }, label: text(name) };
}

async function readSubjectRecord(db: Firestore, subject: TourSubject): Promise<TourSubjectReading | null> {
  const snap = await db.collection(TOUR_SUBJECT_COLLECTION[subject.kind]).doc(subject.id).get();
  return tourSubjectFromDocument(subject.kind, snap.data(), subject.id);
}

/** **Βρες την περιήγηση μιας αγγελίας** — και τον κάτοχό της, όπως τον λέει η ρίζα **τώρα**. */
export async function locateSpatialTour(db: Firestore, subject: TourSubject): Promise<TourLocation> {
  const subjectRead = await readSubjectRecord(db, subject);
  if (subjectRead === null) return { kind: 'absent' };
  const { record, label } = subjectRead;
  const custody = tourCustodyOf(record);
  if (custody === null) return { kind: 'unscoped' };

  const tourId = enterpriseIdService.generateDeterministicSpatialTourId(subject.kind, subject.id);
  const tourRef = db.collection(COLLECTIONS[SPATIAL_TOUR_COLLECTION[custodyKindOfScope(custody)]]).doc(tourId);
  const snap = await tourRef.get();
  const tour = snap.exists ? spatialTourFromDocument(snap.data(), tourId) : null;
  return { kind: 'found', record, label, custody, tourRef, tour };
}
