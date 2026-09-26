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
 *
 * ⏳ Διαβάζεται την ώρα της ερώτησης επειδή οι γραφείς της ετοιμότητας (ψήστης tileset · τοποθέτηση στον γράφο)
 * είναι Φ2. Όταν υπάρξουν, η απάντηση υλοποιείται **πάνω** στην περιήγηση από αυτούς — με αυτόν τον κριτή.
 */

import type { DocumentReference } from 'firebase-admin/firestore';

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

/** **Ο αναγνώστης** — οι στάσεις μιας περιήγησης που **ήδη** εντοπίστηκε από τη ρίζα της. */
export async function readViewerStops(tourRef: DocumentReference): Promise<TourManifestStop[]> {
  // tenant-scope-exempt: υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση εντοπισμένη από τη ρίζα της (ADR-884 Φ0.9).
  const snap = await tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES)
    .where('audience', '==', 'public-listing')
    .limit(CAPTURE_READ_LIMIT)
    .get();
  return viewerStops(snap.docs.flatMap((doc) => {
    const capture = tourCaptureFromDocument(doc.data(), doc.id);
    return capture === null ? [] : [capture];
  }));
}
