/**
 * @fileoverview **Η ΔΙΕΥΘΥΝΣΗ ΕΝΟΣ ΕΠΙΠΕΔΟΥ ΣΤΟΝ DXF VIEWER** — η ΜΙΑ δήλωση (ADR-400).
 * @related subapps/dxf-viewer/services/viewport-persistence (ο αναγνώστης του ίδιου κλειδιού) · lib/files/file-viewer-route (το πρότυπο)
 * @module lib/dxf-viewer/dxf-viewer-routes
 *
 * 🔑 Ο viewer **ήδη** ανοίγει σε συγκεκριμένο επίπεδο όταν η διεύθυνση κουβαλά `?lvl=<id>` (`LevelsSystem`, one-shot
 * restore). Αυτό το module δίνει στον **υπόλοιπο** κόσμο τον τρόπο να γράψει αυτή τη διεύθυνση — ώστε ένα κουμπί
 * «Άνοιγμα στο DXF» να μη χρειάζεται να ξέρει πώς λέγεται το κλειδί.
 *
 * ⚠️ **Καθαρό module** — κανένα I/O, κανένα React. Το πρόθεμα χώρου το βάζει το **σύνορο πλοήγησης**.
 *
 * ⛔ **ΜΗΝ γράψεις `?lvl=` με το χέρι αλλού.** Το κλειδί ζει **εδώ** και το `viewport-persistence` το **εισάγει**:
 * γραφέας και αναγνώστης της ίδιας διεύθυνσης δεν επιτρέπεται να έχουν δύο δηλώσεις.
 */

import { withQuery } from '@/lib/workspace/route-worlds';

/** Το κλειδί του query string που ονομάζει το ενεργό επίπεδο του viewer. Κοντό, ώστε οι σύνδεσμοι να μένουν συμπαγείς. */
export const DXF_VIEWER_LEVEL_PARAM = 'lvl';

/** Η διεύθυνση του viewer **ανοιγμένου σε ένα επίπεδο** — χωρίς πρόθεμα χώρου (το βάζει το σύνορο). */
export function dxfViewerLevelHref(levelId: string) {
  return withQuery('/dxf/viewer', `${DXF_VIEWER_LEVEL_PARAM}=${encodeURIComponent(levelId)}`);
}
