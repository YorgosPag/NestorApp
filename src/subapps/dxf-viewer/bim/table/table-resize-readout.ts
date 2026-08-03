/**
 * 🔴 **Η ΕΝΔΕΙΞΗ ΜΕΓΕΘΟΥΣ ΤΗΣ ΣΥΡΣΗΣ** (Giorgio 2026-08-04) — «Πλάτος: 14,14 (104 pixel)».
 *
 * Το πρότυπο είναι κυριολεκτικά το Excel, που το δείχνει δίπλα στον δείκτη όσο σέρνεις το
 * διαχωριστικό. Δύο αριθμοί, και **κανένας από τους δύο δεν είναι διακοσμητικός**:
 *
 * - **Στη μονάδα του χρήστη** (m / cm / mm / in / ft, από τον επιλογέα της γραμμής
 *   κατάστασης). Είναι το μέγεθος **του σχεδίου**: τι θα τυπωθεί, τι θα μετρήσει ο άλλος.
 * - **Σε pixel οθόνης.** Δεν είναι το ίδιο πράγμα με λιγότερα δεκαδικά: είναι το μόνο
 *   νούμερο που απαντά «*γιατί δεν χωράει το κείμενό μου εδώ;*» — ερώτηση **οθόνης**, όχι
 *   σχεδίου, και η μόνη που δεν μπορεί να απαντηθεί από τη μονάδα σχεδίου, γιατί εξαρτάται
 *   από το zoom της στιγμής.
 *
 * ## 🔴 Γιατί το sheet-mm ΔΕΝ πάει κατευθείαν στον μορφοποιητή
 * Ο πίνακας είναι **annotative** (§4.1): τα πλάτη του ζουν σε **χαρτί**, όχι σε κόσμο. Μια
 * στήλη 40 sheet-mm σε κλίμακα 1:100 **είναι** 4 μέτρα στο σχέδιο, και ο χρήστης που έχει
 * επιλέξει «m» περιμένει να δει `4,00 m`. Το `formatLengthForDisplay(40)` θα έγραφε `0,04 m`
 * — δηλαδή το πλάτος του χαρτιού, νούμερο που δεν σημαίνει τίποτα πάνω στο σχέδιο. Γι' αυτό
 * η μετατροπή περνά **πρώτα** από το `mmToWorld` της ζωντανής κλίμακας και μετά από το
 * `formatSceneLengthForDisplay`, που είναι ο ΕΝΑΣ δρόμος «σκηνή → mm → μονάδα χρήστη».
 *
 * Καθαρό module: μηδέν React, μηδέν store, μηδέν DOM. Παίρνει αριθμούς, δίνει κείμενο.
 *
 * @module subapps/dxf-viewer/bim/table/table-resize-readout
 * @see config/display-length-format.ts — ο ΕΝΑΣ μορφοποιητής μήκους (μονάδα + τοπικός δεκαδικός)
 * @see ui/table-cell-editor/table-axis-resize-drag.ts — η χειρονομία που τη γεννά
 */

import { i18n } from '@/i18n';
import { formatSceneLengthForDisplay } from '../../config/display-length-format';
import type { SceneUnits } from '../../utils/scene-units';
import type { TableResizeAxis } from './table-resize-axis';

const NS = 'dxf-viewer-shell';

/** Ό,τι χρειάζεται η ένδειξη για να γραφτεί — όλα μετρημένα τη στιγμή της κίνησης. */
export interface TableResizeReadoutInput {
  readonly axis: TableResizeAxis;
  /** Το νέο μέγεθος του κελιού σε **sheet-mm** (πλάτος στήλης ή ύψος γραμμής). */
  readonly sizeMm: number;
  /** Px οθόνης ανά sheet-mm, τη στιγμή της κίνησης (`tablePxPerMm`). */
  readonly pxPerMm: number;
  /** Μονάδες σκηνής του σχεδίου· η γέφυρα sheet-mm → κόσμος. */
  readonly mmToWorld: number;
  readonly sceneUnits?: SceneUnits;
}

/**
 * Το κείμενο της ένδειξης, έτοιμο για την οθόνη.
 *
 * ⚠️ Τα pixel **στρογγυλοποιούνται σε ακέραιο**: μισό pixel δεν υπάρχει σε καμία οθόνη, και
 * ένα `104,3 pixel` θα υπονοούσε ακρίβεια που η ίδια η λέξη «pixel» αναιρεί. Το Excel γράφει
 * κι εκείνο ακέραιο.
 *
 * ⚠️ Ποτέ αρνητικό: το φράγμα ελάχιστου μεγέθους έχει ήδη τρέξει πριν φτάσει εδώ, αλλά ένα
 * ενδιάμεσο καρέ σύρσης **μπορεί** να περάσει αρνητικό `sizeMm` (το χέρι πέρασε το όριο). Το
 * `Math.max(0, …)` κρατά την ένδειξη ειλικρινή αντί για «−12 pixel».
 */
export function tableResizeReadoutText(input: TableResizeReadoutInput): string {
  const { axis, sizeMm, pxPerMm, mmToWorld, sceneUnits = 'mm' } = input;
  const safeMm = Math.max(0, sizeMm);

  const label = i18n.t(axis === 'column' ? 'table.resize.width' : 'table.resize.height', { ns: NS });
  const size = formatSceneLengthForDisplay(safeMm * mmToWorld, sceneUnits);
  const px = Math.round(safeMm * pxPerMm);
  const pixels = i18n.t('table.resize.pixels', { ns: NS });

  return `${label}: ${size} (${px} ${pixels})`;
}
