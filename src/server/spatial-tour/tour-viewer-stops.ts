import 'server-only';

/**
 * @fileoverview **ΤΙ ΕΧΕΙ ΝΑ ΔΕΙΞΕΙ ΜΙΑ ΠΕΡΙΗΓΗΣΗ** — ο ΕΝΑΣ αναγνώστης και ο ΕΝΑΣ κριτής των στάσεων του θεατή (ADR-884 Κ3β).
 * @related `tour-view-session.ts` (το μανιφέστο) · `tour-presence.ts` (η κάρτα της αγγελίας) ·
 *   `lib/spatial-tour/tour-capture-invariants.ts` (`selectViewerCaptures`)
 * @module server/spatial-tour/tour-viewer-stops
 *
 * 🔴 **Γιατί υπάρχει** (ζωντανή επαλήθευση 2026-09-26): η κάρτα της αγγελίας ρωτούσε «υπάρχει λήψη για το κοινό με
 * έτοιμο tileset;» ενώ το μανιφέστο ρωτούσε «υπάρχει **τοποθετημένη** λήψη, η πιο πρόσφατη του κόμβου της, με έτοιμο
 * tileset;». Με μία ατοποθέτητη λήψη η αγγελία **υποσχόταν** περιήγηση, ο άνθρωπος ζητούσε, εγκρινόταν — και έβλεπε
 * «η περιήγηση ετοιμάζεται». Δύο κριτές για την ίδια ερώτηση ⇒ πλέον **ένας**, και τον ρωτούν και οι δύο.
 * 🔴 **Ξανά, ζωντανά 2026-09-26 (§4.7 Α8)**: η **δημοσίευση** ρωτούσε «υπάρχει λήψη για το κοινό;» (χωρίς tileset/κόμβο)
 * και ο **προσωπικός σύνδεσμος** δεν ρωτούσε τίποτα — προσφερόταν και για αγέννητη περιήγηση ⇒ 403/404. Πλέον τον
 * ΙΔΙΟ κριτή ρωτούν: μανιφέστο · κάρτα · δημοσίευση · δημιουργία συνδέσμου · οθόνη του υπευθύνου (`viewerStopCount`).
 *
 * ⏳ Διαβάζεται την ώρα της ερώτησης επειδή οι γραφείς της ετοιμότητας (ψήστης tileset · τοποθέτηση στον γράφο)
 * είναι Φ2. Όταν υπάρξουν, η απάντηση υλοποιείται **πάνω** στην περιήγηση από αυτούς — με αυτόν τον κριτή.
 */

import type { DocumentReference, Query, QuerySnapshot, Transaction } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { selectViewerCaptures } from '@/lib/spatial-tour/tour-capture-invariants';
import type { TourCapture } from '@/types/spatial-tour';

/** Όσες λήψεις διαβάζονται — ≥ `MAX_TOUR_NODES` ώστε να χωρά η πιο πρόσφατη κάθε κόμβου. */
const CAPTURE_READ_LIMIT = 500;

/** Μία στάση του θεατή — ό,τι χρειάζεται ο θεατής της Φ1 για να ζητήσει πλακίδια. */
export interface TourManifestStop {
  readonly captureId: string;
  readonly nodeId: string;
  readonly capturedAt: string;
  readonly headingRad: number;
  /** Το περιεχόμενο του tileset — μέρος της διεύθυνσης μέσων, ώστε νέα έκδοση = νέο URL (αμετάβλητη cache). */
  readonly tilesetHash: string;
}

/**
 * **Ο κριτής** — καθαρός: λήψεις για το κοινό της αγγελίας, η πιο πρόσφατη ανά **τοποθετημένο** κόμβο, με **έτοιμο**
 * tileset. Κενό ⇒ τίποτα να δειχτεί (η αγγελία δεν δείχνει κάρτα, η θέαση λέει «ετοιμάζεται»).
 */
export function viewerStops(captures: readonly TourCapture[]): TourManifestStop[] {
  return selectViewerCaptures(captures).flatMap((capture): TourManifestStop[] =>
    capture.tileset.state === 'ready' && capture.tileset.contentHash !== null && capture.nodeId !== null
      ? [{
          captureId: capture.id, nodeId: capture.nodeId, capturedAt: capture.capturedAt,
          headingRad: capture.headingRad, tilesetHash: capture.tileset.contentHash,
        }]
      : []);
}

/** Το ερώτημα των υποψήφιων στάσεων — ΕΝΑ, για ανάγνωση **και** για συναλλαγή. */
function viewerCapturesQuery(tourRef: DocumentReference): Query {
  // tenant-scope-exempt: υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση εντοπισμένη από τη ρίζα της (ADR-884 Φ0.9).
  return tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES)
    .where('audience', '==', 'public-listing')
    .limit(CAPTURE_READ_LIMIT);
}

function stopsOfSnapshot(snap: QuerySnapshot): TourManifestStop[] {
  return viewerStops(snap.docs.flatMap((doc) => {
    const capture = tourCaptureFromDocument(doc.data(), doc.id);
    return capture === null ? [] : [capture];
  }));
}

/** **Ο αναγνώστης** — οι στάσεις μιας περιήγησης που **ήδη** εντοπίστηκε από τη ρίζα της. */
export async function readViewerStops(tourRef: DocumentReference): Promise<TourManifestStop[]> {
  return stopsOfSnapshot(await viewerCapturesQuery(tourRef).get());
}

/**
 * Ο **ίδιος** αναγνώστης μέσα σε συναλλαγή — για γραφέα που κρίνει «έχει κάτι να δείξει;» και γράφει **ατομικά**
 * (η δημοσίευση: ADR-884 §4.7 Α8 — ως τότε ρωτούσε δικό της, χαλαρότερο κριτή).
 */
export async function readViewerStopsInTransaction(tx: Transaction, tourRef: DocumentReference): Promise<TourManifestStop[]> {
  return stopsOfSnapshot(await tx.get(viewerCapturesQuery(tourRef)));
}
