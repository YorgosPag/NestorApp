import 'server-only';

/**
 * @fileoverview **Η ΓΕΝΝΗΣΗ ΜΙΑΣ ΠΕΡΙΗΓΗΣΗΣ** — η πόρτα του υπευθύνου που **εξασφαλίζει** ότι η περιήγηση υπάρχει.
 * @related ADR-884 §4.5 (Κ3α) · Φ0.1 · Φ0.3 · §12 Δ3 · `tour-access-shared.ts` (`locateManagedTour`)
 * @module server/spatial-tour/tour-genesis
 *
 * 🔑 **Πρότυπο Matterport/Zillow**: ο «χώρος» γεννιέται με την **πρώτη πράξη** του δημιουργού (πρόσκληση
 * φωτογράφου · ανέβασμα λήψης), όχι με ξεχωριστό κουμπί «Δημιουργία» που κανείς δεν θυμάται να πατήσει.
 *
 * - **Ιδεμπότητη**: id ντετερμινιστικό ανά ρίζα + create-if-absent **σε συναλλαγή** ⇒ δύο ταυτόχρονες πρώτες
 *   πράξεις γεννούν **μία** περιήγηση.
 * - **Μόνο υπεύθυνος**: περνά από `mayManageTour`. Ο φωτογράφος **δεν** γεννά ποτέ περιήγηση — ανεβάζει σε
 *   περιήγηση που υπάρχει ήδη, αφού η πρόσκλησή του τη γέννησε.
 * - **Γεννιέται `draft`**: τίποτα δεν φτάνει στο κοινό χωρίς ρητή δημοσίευση (αναλλοίωτο #3). Η ορατότητα
 *   ξεκινά `public` — η προεπιλογή «Όλοι» του §12 Δ3 — και **δεν** έχει αποτέλεσμα όσο είναι `draft`.
 *
 * 🔴 **Ποτέ υιοθεσία**: μετά από μεταβίβαση εταιρεία → εταιρεία η παλιά περιήγηση ζει στην **ίδια** διαδρομή
 * (§4.4). Ο κάτοχός της κρίνεται με `isOwnedByCustody`· αν διαφέρει ⇒ `tour-custody-mismatch`.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { spatialTourFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { mayManageTour, type TourActor } from '@/lib/spatial-tour/tour-authority';
import { createModuleLogger } from '@/lib/telemetry';
import { custodyOnly, isOwnedByCustody, type CustodyScope } from '@/lib/workspace/custody-scope';
import type { SpatialTour, TourSubject } from '@/types/spatial-tour';

import { refuseTourAccess, type TourAccessRefused } from './tour-access-shared';
import { locateSpatialTour } from './tour-locate';

const logger = createModuleLogger('tour-genesis');

export type EnsuredTour = {
  readonly kind: 'managed';
  readonly tour: SpatialTour;
  readonly tourRef: DocumentReference;
  readonly custody: CustodyScope;
  /** `true` ⇒ **αυτή** η κλήση τη γέννησε (για το ίχνος). */
  readonly created: boolean;
};

/** Το έγγραφο μιας νέας περιήγησης — κενός γράφος, `draft`, ο κάτοχος **παράγεται** από τη ρίζα (Φ0.1). */
function newTourDocument(input: {
  readonly custody: CustodyScope;
  readonly subject: TourSubject;
  readonly actorUid: string;
  readonly at: string;
}) {
  return {
    ...custodyOnly(input.custody),
    subject: { kind: input.subject.kind, id: input.subject.id },
    visibility: 'public',
    lifecycle: 'draft',
    levels: [],
    nodes: [],
    revision: 0,
    createdAt: input.at,
    createdBy: input.actorUid,
    updatedAt: input.at,
    updatedBy: input.actorUid,
  } as const;
}

/**
 * **Η περιήγηση της αγγελίας — υπάρχουσα ή νεογέννητη.** Ό,τι δεν είναι υπεύθυνος ⇒ `not-manager` **πριν**
 * από κάθε γραφή· ρίζα που δεν υπάρχει ⇒ `tour-absent` (δεν υπάρχει αγγελία να έχει περιήγηση).
 */
export async function ensureManagedTour(
  db: Firestore,
  subject: TourSubject,
  actor: TourActor,
): Promise<EnsuredTour | TourAccessRefused> {
  const location = await locateSpatialTour(db, subject);
  if (location.kind !== 'found') return refuseTourAccess('tour-absent');
  if (mayManageTour(location.record, actor) !== 'granted') return refuseTourAccess('not-manager');
  const { tourRef, custody } = location;
  const at = nowISO();

  const outcome = await db.runTransaction<EnsuredTour | TourAccessRefused>(async (tx) => {
    const snap = await tx.get(tourRef);
    if (!snap.exists) {
      const doc = newTourDocument({ custody, subject, actorUid: actor.listing.uid, at });
      tx.create(tourRef, doc);
      const tour = spatialTourFromDocument(doc, tourRef.id);
      // Αδύνατο — το έγγραφο το φτιάξαμε μόλις. Αν ποτέ συμβεί, είναι βλάβη του γραφέα, όχι «δεν υπάρχει».
      if (tour === null) throw new Error(`Newborn spatial tour is unreadable: ${tourRef.path}`);
      return { kind: 'managed', tour, tourRef, custody, created: true };
    }
    const data = snap.data();
    if (!isOwnedByCustody(data, custody)) return refuseTourAccess('tour-custody-mismatch');
    const tour = spatialTourFromDocument(data, tourRef.id);
    if (tour === null) return refuseTourAccess('tour-unreadable');
    return { kind: 'managed', tour, tourRef, custody, created: false };
  });

  if (outcome.kind === 'managed' && outcome.created) {
    logger.info('Γεννήθηκε περιήγηση', { tourId: tourRef.id, subjectKind: subject.kind });
  }
  return outcome;
}
