/**
 * =============================================================================
 * Η ΔΙΕΥΘΥΝΣΗ ΘΕΑΤΗ ΕΝΟΣ ΑΡΧΕΙΟΥ — η ΜΙΑ δήλωση (ADR-899 §9 θέμα 10)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποια διεύθυνση ΔΕΙΧΝΕΙ αυτό το αρχείο στον δικό μας θεατή;»*
 *
 * 🏆 **Πρακτική Google Drive (`/file/d/<id>/view`) · Autodesk Docs (item URL) · Figma (file URL)**: κάθε αρχείο
 * έχει **δική του διεύθυνση**, και «άνοιγμα σε νέα καρτέλα» είναι **η ίδια διεύθυνση** σε άλλη καρτέλα — για κάθε
 * τύπο, γιατί τον θεατή τον φέρνει η πλατφόρμα, όχι ο browser.
 *
 * 🔑 Η επιλογή του `/files` **ζει στο query string** (`?file=<id>`), με το υπάρχον SSoT
 * `useSelectedEntityUrlState` — ίδιο μοτίβο με το `?contactId=` των Επαφών (ADR-332 D21). Η μορφή διαδρομής
 * `/files/<id>` (που γράφει το ευρετήριο αναζήτησης) **ανακατευθύνει** εδώ, όπως το `contacts/[id]`.
 *
 * ⚠️ **Καθαρό module** — κανένα I/O, κανένα React. Το πρόθεμα χώρου το βάζει το **σύνορο πλοήγησης**
 * (`@/lib/workspace/navigation` ή `server-navigation`), ποτέ αυτό το αρχείο.
 *
 * ⛔ **ΜΗΝ γράψεις `?file=` με το χέρι αλλού.** Δύο γραφές της ίδιας διεύθυνσης αποκλίνουν σιωπηλά.
 *
 * @module lib/files/file-viewer-route
 * @see lib/files/file-open-in-tab — ποιος παίρνει διεύθυνση θεατή και ποιος όχι
 * @see lib/files/file-viewer-outcome — τι δείχνει ο θεατής για μια ζητούμενη ταυτότητα
 */

import { withQuery } from '@/lib/workspace/route-worlds';

/** Το κλειδί του query string που ονομάζει το ανοιχτό αρχείο του `/files`. */
export const FILE_VIEWER_PARAM = 'file';

/** Η διεύθυνση θεατή ενός αρχείου — **χωρίς** πρόθεμα χώρου (το βάζει το σύνορο). */
export function fileViewerHref(fileId: string) {
  return withQuery('/files', `${FILE_VIEWER_PARAM}=${encodeURIComponent(fileId)}`);
}

/** Ο τύπος της διεύθυνσης θεατή, όπως τον δέχεται το σύνορο πλοήγησης. */
export type FileViewerHref = ReturnType<typeof fileViewerHref>;
