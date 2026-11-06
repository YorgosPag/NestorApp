/**
 * **Η προτίμηση ζουμ της σελίδας εγγράφου** (ADR-928 §5.25) — ανά **χρήστη και συσκευή**.
 *
 * 🏆 Όπως οι μεγάλοι: το Word ανοίγει κάθε έγγραφο στο **τελευταίο** ζουμ (δεν το γράφει στο αρχείο), το Acrobat κρατά
 *    προεπιλογή «Fit Width» στις προτιμήσεις της εγκατάστασης, το Google Docs ακολουθεί το ζουμ του browser. Κανείς δεν
 *    το συγχρονίζει στον λογαριασμό: το σωστό ζουμ είναι ιδιότητα της **οθόνης** (150 % σε laptop ≠ 150 % σε 4K).
 * 🚀 Πάνω από το Word: αποθηκεύεται ο **τρόπος**. «Προσαρμογή» μένει προσαρμογή σε κάθε πλάτος/παράθυρο· μόνο το
 *    χειροκίνητο κρατά ποσοστό.
 * 🔑 Η αποθηκευμένη τιμή είναι ιστορικό, όχι αλήθεια: αλλοιωμένη ⇒ «Προσαρμογή», ποτέ σφάλμα· ποσοστό ⇒ κόβεται στα όρια.
 * 🔑 Ανά uid (`DOCUMENT_ZOOM_PREFIX` + uid): σε κοινό μηχάνημα το ζουμ του ενός δεν γίνεται του επόμενου.
 */

import { clampZoom } from '@/lib/geometry/zoom-pan-math';
import { STORAGE_KEYS, safeGetItem, safeSetItem } from '@/lib/storage';

import { PAPER_ZOOM_FIT, PAPER_ZOOM_LIMITS, type PaperZoomMode } from './paper-fit';

function keyOf(uid: string): string {
  return `${STORAGE_KEYS.DOCUMENT_ZOOM_PREFIX}${uid}`;
}

/** Ό,τι κι αν βρεθεί στην αποθήκευση ⇒ έγκυρος τρόπος ζουμ. */
export function parsePaperZoomMode(raw: unknown): PaperZoomMode {
  if (typeof raw !== 'object' || raw === null) return PAPER_ZOOM_FIT;
  const { mode, zoom } = raw as { readonly mode?: unknown; readonly zoom?: unknown };
  if (mode === 'manual' && typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0) {
    return { mode: 'manual', zoom: clampZoom(zoom, PAPER_ZOOM_LIMITS) };
  }
  return PAPER_ZOOM_FIT;
}

/** Χωρίς χρήστη (δεν έχει φορτώσει ακόμη) ⇒ η προεπιλογή, χωρίς ανάγνωση. */
export function readPaperZoomMode(uid: string | null): PaperZoomMode {
  return uid ? parsePaperZoomMode(safeGetItem<unknown>(keyOf(uid), null)) : PAPER_ZOOM_FIT;
}

export function writePaperZoomMode(uid: string | null, zoomMode: PaperZoomMode): void {
  if (uid) safeSetItem(keyOf(uid), zoomMode);
}
