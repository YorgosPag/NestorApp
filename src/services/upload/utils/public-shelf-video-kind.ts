/**
 * @fileoverview 🎬 **ΜΙΑ ΓΡΑΜΜΗ ΠΟΥ ΔΗΜΟΣΙΕΥΕΙ ΒΙΝΤΕΟ** — ο τύπος και ο φρουρός του (ADR-907 §10).
 * @related ADR-907 §10 · ADR-845 Φ4.2 · services/upload/utils/public-shelf-kinds
 * @module services/upload/utils/public-shelf-video-kind
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — ΕΞΑΓΩΓΗ, ΟΧΙ ΤΡΙΜΜΑ**: το `public-shelf-kinds.ts` μετρούσε **466** γραμμές· τύπος,
 * φρουρός και σκεπτικό θα το περνούσαν από το όριο των 500 (N.7.1) — τέταρτη φορά που το όριο **αποκαλύπτει** ευθύνη.
 *
 * ⚠️ **Η ΙΔΙΑ Η ΓΡΑΜΜΗ (`LISTING_VIDEO_SHELF`) ΜΕΝΕΙ ΣΤΟ `public-shelf-kinds`, ΚΑΙ ΕΙΝΑΙ ΑΝΑΓΚΗ**: μοιράζεται ρίζα και
 * φρουρό ταυτότητας με τις φωτογραφίες, δηλαδή χρειάζεται **τιμές** εκείνου του αρχείου. Αν ζούσε εδώ, τα δύο αρχεία
 * θα εισήγαν τιμές το ένα από το άλλο — κύκλος αρχικοποίησης (CHECK 3.80). Εδώ εισάγονται **μόνο τύποι**.
 */

import type { VideoShelfEncoding } from './public-shelf-encoding';
import type { PublicShelfKind } from './public-shelf-kinds';

/**
 * **Η ΑΠΟΥΣΙΑ ΕΙΝΑΙ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ**, όπως στο `ModelShelfKind`: ούτε `framingOf`, ούτε πλάτη, ούτε σημείο εστίασης.
 * Ένα βίντεο δημοσιεύεται ως **ένα** αρχείο· ο περιηγητής διαλέγει τι θα κατεβάσει με αιτήματα εύρους, όχι με `srcset`.
 */
export interface VideoShelfKind<M> extends PublicShelfKind<M> {
  readonly encoding: VideoShelfEncoding;
}

/**
 * **Δημοσιεύει αυτή η γραμμή βίντεο;** — τρίτο **καταφατικό** κατηγόρημα, ποτέ άρνηση των δύο άλλων: η Φ4.1 μέτρησε
 * ότι άρνηση πάνω σε λεξιλόγιο που μεγαλώνει γίνεται σιωπηλά ψευδής κάθε φορά που προστίθεται τιμή.
 */
export function isVideoShelfKind<M>(kind: PublicShelfKind<M>): kind is VideoShelfKind<M> {
  return kind.encoding.kind === 'video';
}
