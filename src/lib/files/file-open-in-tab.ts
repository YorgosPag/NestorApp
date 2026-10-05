/**
 * =============================================================================
 * ΤΙ ΑΝΟΙΓΕΙ ΤΟ «ΑΝΟΙΓΜΑ ΣΕ ΝΕΑ ΚΑΡΤΕΛΑ» ΓΙΑ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ; — ο ΕΝΑΣ απαντητής
 * =============================================================================
 *
 * **Το ερώτημα**: *«Αν δώσω αυτό το αρχείο σε μια γυμνή καρτέλα του browser, θα το **δει** ο άνθρωπος;»*
 *
 * 🔴 **Μετρημένο 2026-10-05 (ADR-899 §9 θέμα 9)**: το κουμπί του πάνελ `/files` άνοιγε για κάθε DXF το
 * `….scene.json` — το JSON της σκηνής. Η ρίζα (το `downloadUrl` ονόμαζε το συνοδευτικό) θεραπεύτηκε στον
 * `fileDisplayUrlOf`· αλλά και με το **σωστό** αντικείμενο, ένα `.dxf` σε γυμνή καρτέλα είναι λήψη ή ωμό κείμενο.
 *
 * 🏆 **Πρακτική Google Drive / Autodesk Docs / Figma**: «άνοιγμα» σημαίνει **προβολή**, «λήψη» σημαίνει **bytes**·
 * κανείς δεν δείχνει ωμά bytes ως «άνοιγμα». Όπου ο browser δεν αποδίδει τον τύπο, η ενέργεια **δεν προσφέρεται**:
 * η προβολή ζει στο πάνελ (ο δικός μας θεατής) και το πρωτότυπο το δίνει η «Λήψη».
 *
 * ⚠️ **Καθαρό module** — κανένα I/O, κανένα React.
 *
 * @module lib/files/file-open-in-tab
 * @see lib/files/file-display-url — ποιο URL (και ποιο αντικείμενο)
 * @see config/file-types/classification-registry — ποιοι τύποι αποδίδονται από τον browser
 */

import { getPreviewType, isBrowserNativePreviewType } from '@/config/file-types/classification-registry';

import { fileDisplayUrl, type FileDisplayUrlSubject } from './file-display-url';

/** Ό,τι χρειάζεται από μια εγγραφή — **δομικό**, όπως του `fileDisplayUrlOf`. */
export interface FileOpenInTabSubject extends FileDisplayUrlSubject {
  readonly originalFilename?: string | null;
}

/**
 * Το URL που ανοίγει σε νέα καρτέλα, ή `null` όταν η καρτέλα **δεν θα έδειχνε** το αρχείο (ή δεν υπάρχει URL).
 * `null` ⇒ ο καλών **κρύβει / απενεργοποιεί** την ενέργεια· δεν ανοίγει ποτέ κάτι «παρεμφερές».
 */
export function fileOpenInTabUrl(record: FileOpenInTabSubject): string | null {
  const previewType = getPreviewType(record.contentType ?? undefined, record.originalFilename ?? undefined);
  return isBrowserNativePreviewType(previewType) ? fileDisplayUrl(record) : null;
}
