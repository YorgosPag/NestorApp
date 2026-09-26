import 'server-only';

/**
 * @fileoverview **ΟΙ ΛΙΣΤΕΣ ΤΗΣ ΡΟΗΣ ΦΩΤΟΓΡΑΦΟΥ** — τα «εισερχόμενα» λήψεων μιας περιήγησης · «οι λήψεις μου».
 * @related ADR-884 Φ0.5 · Φ0.8 · §4.5 (Κ3α) · `tour-capture-upload.ts` (ο κριτής δράστη)
 * @module server/spatial-tour/tour-capture-list
 *
 * 🔑 **Ποιος βλέπει τι** — κανένας νέος κριτής:
 * - **υπεύθυνος** (`mayManageTour`) ⇒ **όλες** οι λήψεις της περιήγησης·
 * - **φωτογράφος** ⇒ **μόνο** όσες ανέβασε ο ίδιος (`uploadedBy == uid`) — ποτέ του γραφείου ή άλλου φωτογράφου.
 *   Και μόνο εφόσον **έχει** άδεια (ενεργή ή όχι): χωρίς άδεια δεν υπάρχει λόγος να ξέρει ότι η περιήγηση υπάρχει.
 *
 * Χωρίς `orderBy` ⇒ κανένας σύνθετος δείκτης· η οθόνη ταξινομεί στη μνήμη (φραγμένο ρητά, όπως οι λίστες πρόσκλησης).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import {
  spatialTourFromDocument,
  tourCaptureFromDocument,
  tourCaptureGrantFromDocument,
} from '@/lib/spatial-tour/spatial-tour-from-document';
import { mayManageTour, tourGrantStanding, type TourActor, type TourGrantStanding } from '@/lib/spatial-tour/tour-authority';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';
import type { TourCapture, TourCaptureInvitationPreview, TourSubject } from '@/types/spatial-tour';

import { refuseTourAccess, type TourAccessRefused } from './tour-access-shared';
import { locateSpatialTour } from './tour-locate';

const LIST_LIMIT = 200;
/** Όσες άδειες δείχνει «οι λήψεις μου» — ένας φωτογράφος με εκατοντάδες ενεργές δουλειές δεν υπάρχει. */
const MY_GRANTS_LIMIT = 50;

export type TourCaptureListing =
  | { readonly kind: 'listed'; readonly captures: readonly TourCapture[]; readonly asManager: boolean }
  | TourAccessRefused;

/** **Οι λήψεις μιας περιήγησης, όπως τις βλέπει αυτός ο δράστης.** */
export async function listTourCaptures(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly actor: TourActor },
): Promise<TourCaptureListing> {
  const location = await locateSpatialTour(db, input.subject);
  if (location.kind !== 'found' || location.tour === null) return refuseTourAccess('tour-absent');
  if (!isOwnedByCustody(location.tour.custody, location.custody)) return refuseTourAccess('tour-custody-mismatch');

  const asManager = mayManageTour(location.record, input.actor) === 'granted';
  const uid = input.actor.listing.uid;
  if (!asManager) {
    const grant = await location.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS).doc(uid).get();
    if (!grant.exists) return refuseTourAccess('not-manager');
  }
  const captures = location.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES);
  // Υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση, κριμένη πιο πάνω (υπεύθυνος ή φωτογράφος με άδεια) — ο κάτοχος είναι ο γονέας.
  const query = asManager ? captures : captures.where('uploadedBy', '==', uid);
  const snap = await query.limit(LIST_LIMIT).get();
  const listed = snap.docs.flatMap((doc) => {
    const capture = tourCaptureFromDocument(doc.data(), doc.id);
    return capture === null ? [] : [capture];
  });
  return { kind: 'listed', captures: listed, asManager };
}

/** Μια δουλειά του φωτογράφου — **ποιο** ακίνητο, **ως πότε**, **σε ποια κατάσταση** η άδειά του. */
export interface MyTourCaptureGrant {
  readonly subject: TourSubject;
  readonly propertyLabel: TourCaptureInvitationPreview['propertyLabel'];
  readonly reason: string;
  readonly expiresAt: string;
  readonly standing: TourGrantStanding;
}

/**
 * **«Οι λήψεις μου»** — οι άδειες λήψης **αυτού** του ανθρώπου, σε όποιον χώρο κι αν ανήκουν (ο φωτογράφος δεν είναι
 * μέλος κανενός, Φ0.5). Άδεια σε περιήγηση που **άλλαξε κάτοχο** παραλείπεται: δεν ανεβάζει πια εκεί (§4.4).
 */
export async function listMyTourCaptureGrants(db: Firestore, uid: string): Promise<readonly MyTourCaptureGrant[]> {
  // tenant-scope-exempt: οι άδειες ΤΟΥ ΙΔΙΟΥ του αιτούντος (`granteeUid` == uid του συνόρου) — ο φωτογράφος δεν ανήκει
  //   σε κανέναν μισθωτή· ο κάτοχος κάθε περιήγησης ξανακρίνεται από τη ρίζα της παρακάτω.
  const snap = await db.collectionGroup(SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS).where('granteeUid', '==', uid).limit(MY_GRANTS_LIMIT).get();
  const nowMs = Date.now();
  const listed = await Promise.all(snap.docs.map(async (doc): Promise<MyTourCaptureGrant | null> => {
    const grant = tourCaptureGrantFromDocument(doc.data(), uid);
    const tourRef = doc.ref.parent.parent;
    if (grant === null || tourRef === null) return null;
    const tour = spatialTourFromDocument((await tourRef.get()).data(), tourRef.id);
    if (tour === null) return null;
    const location = await locateSpatialTour(db, tour.subject);
    if (location.kind !== 'found' || !isOwnedByCustody(tour.custody, location.custody)) return null;
    return {
      subject: tour.subject, propertyLabel: location.label, reason: grant.reason, expiresAt: grant.expiresAt,
      standing: tourGrantStanding(grant, 'tour:capture:upload', nowMs),
    };
  }));
  return listed.filter((item): item is MyTourCaptureGrant => item !== null);
}
