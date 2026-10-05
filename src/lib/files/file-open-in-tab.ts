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
 * κανείς δεν δείχνει ωμά bytes ως «άνοιγμα». Το θέμα 9 έκρυψε την ενέργεια όπου ο browser δεν αποδίδει τον τύπο·
 * το **θέμα 10** την ξαναδίνει παντού, με τη **διεύθυνση θεατή** του αρχείου ({@link fileOpenInTabTarget}).
 *
 * ⚠️ **Καθαρό module** — κανένα I/O, κανένα React.
 *
 * @module lib/files/file-open-in-tab
 * @see lib/files/file-display-url — ποιο URL (και ποιο αντικείμενο)
 * @see lib/files/file-viewer-route — η διεύθυνση θεατή
 * @see config/file-types/classification-registry — ποιοι τύποι αποδίδονται από τον browser
 */

import { getPreviewType, isBrowserNativePreviewType } from '@/config/file-types/classification-registry';

import { fileCustodyKindOf, type FileOwnerFields } from './file-custody';
import { fileDisplayUrl, type FileDisplayUrlSubject } from './file-display-url';
import { fileViewerHref, type FileViewerHref } from './file-viewer-route';

/** Ό,τι χρειάζεται από μια εγγραφή — **δομικό**, όπως του `fileDisplayUrlOf`. */
export interface FileOpenInTabSubject extends FileDisplayUrlSubject {
  readonly originalFilename?: string | null;
}

/**
 * Το URL των **bytes** που ανοίγει σε γυμνή καρτέλα, ή `null` όταν η καρτέλα **δεν θα έδειχνε** το αρχείο (ή δεν
 * υπάρχει URL). Είναι η απάντηση **μόνο** όπου δεν υπάρχει δικός μας θεατής — δες {@link fileOpenInTabTarget}.
 */
export function fileOpenInTabUrl(record: FileOpenInTabSubject): string | null {
  const previewType = getPreviewType(record.contentType ?? undefined, record.originalFilename ?? undefined);
  return isBrowserNativePreviewType(previewType) ? fileDisplayUrl(record) : null;
}

/** Η εγγραφή όπως τη ρωτά ο {@link fileOpenInTabTarget}: bytes **και** ταυτότητα **και** κάτοχος. */
export interface FileOpenInTabTargetSubject extends FileOpenInTabSubject, FileOwnerFields {
  readonly id?: string | null;
}

/**
 * **Πού οδηγεί το «Άνοιγμα σε νέα καρτέλα». Κλειστό σύνολο.**
 *
 * - `viewer` — η **διεύθυνση θεατή** του αρχείου (`/files?file=<id>`): εσωτερική, περνά από το σύνορο πλοήγησης.
 * - `native` — URL των bytes σε γυμνή καρτέλα, **μόνο** όπου ο browser αποδίδει τον τύπο.
 * - `none` — η ενέργεια **δεν προσφέρεται**· ο καλών την κρύβει, δεν ανοίγει ποτέ κάτι «παρεμφερές».
 */
export type FileOpenInTabTarget =
  | { readonly kind: 'viewer'; readonly href: FileViewerHref }
  | { readonly kind: 'native'; readonly url: string }
  | { readonly kind: 'none' };

/**
 * **Ο ΕΝΑΣ απαντητής του «Άνοιγμα σε νέα καρτέλα»** (ADR-899 §9 θέμα 10).
 *
 * 🏆 Drive / Autodesk Docs / Figma: «άνοιγμα» = **ο θεατής της πλατφόρμας**, για κάθε τύπο. Εταιρικό αρχείο με
 * ταυτότητα παίρνει λοιπόν **πάντα** διεύθυνση θεατή — και DXF, Office, 3D, που γυμνή καρτέλα δεν αποδίδει.
 *
 * ⚠️ **Προσωπικό αρχείο δεν έχει διεύθυνση θεατή**: το `/files` είναι σελίδα **γραφείου** και διαβάζει τη συλλογή
 * του γραφείου (ADR-866). Εκεί μένει η προηγούμενη συμπεριφορά — γυμνή καρτέλα όπου ο browser αποδίδει τον τύπο.
 * Το ίδιο και εγγραφή **χωρίς ακριβώς έναν κάτοχο**: ο απαντητής δεν μαντεύει διαμέρισμα.
 */
export function fileOpenInTabTarget(record: FileOpenInTabTargetSubject): FileOpenInTabTarget {
  if (record.id && fileCustodyKindOf(record) === 'company') {
    return { kind: 'viewer', href: fileViewerHref(record.id) };
  }
  const url = fileOpenInTabUrl(record);
  return url ? { kind: 'native', url } : { kind: 'none' };
}
