import 'server-only';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ TILESET** — ο ΕΝΑΣ γραφέας των μεταβάσεων `pending → ready | failed` (ADR-884 Φ2α · §4.9).
 * @related `tour-tileset-baker.ts` (ο μόνος καλών) · `tour-viewer-stops.ts` (ο κριτής που διαβάζει το `ready`)
 * @module server/spatial-tour/tour-tileset-state
 *
 * 🔑 **Σε συναλλαγή, με φύλακα το hash**: η μετάβαση γράφεται **μόνο** αν η λήψη είναι ακόμη `pending` **με το ίδιο**
 * `contentHash` που ψήθηκε. Δύο ψήστες ταυτόχρονα (το `after` της ολοκλήρωσης + το δίχτυ του cron) ⇒ ο δεύτερος βρίσκει
 * `ready` και δεν γράφει τίποτα· ένα `failed` δεν σβήνει ποτέ ένα `ready`. Ιδεμπότητο από κατασκευή.
 * 🔑 Το `ready` γράφεται **τελευταίο**, αφού ανέβηκε κάθε αντικείμενο — είναι το σήμα ολοκλήρωσης: ο θεατής δεν
 * ζητά ποτέ πλακίδιο που δεν υπάρχει.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import type { TourCaptureTileset } from '@/types/spatial-tour';

type TilesetTransition =
  | { readonly to: 'ready'; readonly faceSize: number }
  | { readonly to: 'failed' };

export type TilesetTransitionOutcome = 'written' | 'not-pending' | 'hash-changed' | 'missing';

/**
 * Η νέα τιμή του tileset — καθαρή. `ready` ⇒ **χωρίς** `retiredKeys` (Φ2ζ): ο ψήστης τα έσβησε **πριν** ψήσει, άρα η λίστα
 * αδειάζει μόνο με την ολοκλήρωση — ποτέ πριν σβηστούν. `failed` ⇒ η λίστα **μένει** (ζ4): λέει «αυτή η λήψη είχε δημοσιευμένα
 * πλακίδια που αντικαταστάθηκαν και τίποτα δεν πήρε τη θέση τους» (`isRebakingAfterRedaction`)· η ξανα-διαγραφή είναι ιδεμπότητη.
 */
function nextTileset(current: TourCaptureTileset, contentHash: string, transition: TilesetTransition): TourCaptureTileset {
  if (transition.to === 'ready') return { state: 'ready', contentHash, faceSize: transition.faceSize };
  return { state: 'failed', contentHash, faceSize: null, ...(current.retiredKeys === undefined ? {} : { retiredKeys: current.retiredKeys }) };
}

/** **Γράψε τη μετάβαση** — μόνο από `pending`, μόνο για το ίδιο περιεχόμενο. */
export async function transitionTileset(
  db: Firestore,
  captureRef: DocumentReference,
  bakedHash: string,
  transition: TilesetTransition,
): Promise<TilesetTransitionOutcome> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(captureRef);
    const capture = snap.exists ? tourCaptureFromDocument(snap.data(), captureRef.id) : null;
    if (capture === null) return 'missing';
    if (capture.tileset.state !== 'pending') return 'not-pending';
    if (capture.tileset.contentHash !== bakedHash) return 'hash-changed';
    tx.update(captureRef, { tileset: nextTileset(capture.tileset, bakedHash, transition) });
    return 'written';
  });
}
