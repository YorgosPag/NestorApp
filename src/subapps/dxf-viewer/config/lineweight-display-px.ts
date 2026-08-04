/**
 * 🔴 ADR-510 Φ2G / ADR-756 — **ΠΟΣΟ ΠΑΧΙΑ ΦΑΙΝΕΤΑΙ ΜΙΑ ΓΡΑΜΜΗ ΣΤΗΝ ΟΘΟΝΗ.** Μία απάντηση.
 *
 * Το πάχος μολυβιού είναι **γεωμετρία σε sheet-mm** (ταξιδεύει σε DXF/PDF/ΤΕΚ), αλλά στην
 * οθόνη είναι **μελάνι διεπαφής**: το AutoCAD (`LWDISPLAY`) ζωγραφίζει τα πάχη σε **σταθερά
 * px, ανεξάρτητα από το zoom** — μια γραμμή 0,5 mm δείχνει ίδια στο 1:1 και στο 1:1000.
 * Το ίδιο κάνουν Revit, Illustrator, Figma. Ο λόγος δεν είναι αισθητικός: το πάχος
 * κωδικοποιεί **ιεραρχία** (τομή vs όψη, περίμετρος vs εσωτερικό), και μια ιεραρχία που
 * αλλάζει όταν πλησιάζεις παύει να είναι ιεραρχία.
 *
 * ## 🔴 Το ελάττωμα που γέννησε αυτό το module (Giorgio, 04/08 — μετρημένο)
 * Ο κανόνας υπήρχε **δύο φορές**, με **δύο διαφορετικές απαντήσεις**:
 *
 * ```
 *   κάθε οντότητα σχεδίου  →  lineweightToPx(mm, 96)   σταθερό px      ✅ (ADR-510 Φ2G)
 *   το πλέγμα του πίνακα   →  mm × pxPerMm             × zoom          ❌ (ADR-739 §37)
 * ```
 *
 * Το δεύτερο δεν ήταν επιλογή — ήταν ο **προφανής** τύπος («ο πίνακας ζει σε sheet-mm, άρα
 * πολλαπλασίασε με την κλίμακα φύλλο→οθόνη»), γραμμένος ιδιωτικά μέσα στον ζωγράφο του
 * πίνακα και άρα αόρατος σε όποιον έγραψε τον πρώτο. Το αποτέλεσμα: σε μεγέθυνση οι γραμμές
 * του πίνακα **φούσκωναν σε μαύρες μπάρες** ενώ κάθε γραμμή σχεδίου δίπλα τους έμενε
 * ακίνητη — δηλαδή ο πίνακας ήταν η **μόνη** οντότητα με άλλο νόμο.
 *
 * ⚠️ **ΤΟ `pxPerMm` ΔΕΝ ΕΙΝΑΙ ΠΟΤΕ ΣΩΣΤΟΣ ΠΟΛΛΑΠΛΑΣΙΑΣΤΗΣ ΠΑΧΟΥΣ ΣΤΗΝ ΟΘΟΝΗ.** Είναι η
 * κλίμακα της **γεωμετρίας** (πού πέφτει το κελί), όχι του **μολυβιού** (πόσο παχύ βάφει).
 * Αν το ξαναδείς πολλαπλασιασμένο επί πάχος, είναι το ίδιο ελάττωμα με άλλο όνομα.
 *
 * ## Γιατί το print δεν αλλάζει
 * Στην εκτύπωση η κλίμακα φύλλο→pixel **είναι** `dpi/25.4` — δηλαδή οι δύο τύποι
 * συμπίπτουν αριθμητικά. Γι' αυτό ο πίνακας τύπωνε σωστά επί μήνες ενώ η οθόνη ήταν λάθος:
 * το print pass δεν μπορούσε να δει το ελάττωμα. Το policy περνά αυτούσιο (AutoCAD parity:
 * η εκτύπωση ζωγραφίζει **πάντα** τα πραγματικά πάχη, ό,τι κι αν λέει ο διακόπτης οθόνης).
 *
 * @module subapps/dxf-viewer/config/lineweight-display-px
 * @see config/lineweight-iso-catalog.ts — ο τύπος mm → px (`mmToDisplayPx`)
 * @see rendering/linetype-dash-resolver.ts — ο αδελφός για το **μοτίβο** (mm → `setLineDash`)
 * @see stores/LineweightDisplayStore.ts — ο διακόπτης «ΠΑΧΟΣ» της γραμμής κατάστασης
 * @see docs/centralized-systems/reference/adrs/ADR-756-lineweight-display-ssot.md
 */

import { mmToDisplayPx, SCREEN_DPI } from './lineweight-iso-catalog';
import { getPrintColorPolicy } from './print-color-policy';
import { getShowLineweight } from '../stores/LineweightDisplayStore';

/**
 * Το **δάπεδο**: μια γραμμή δεν εξαφανίζεται ποτέ, και είναι επίσης ό,τι μένει όταν ο
 * χρήστης σβήσει τον διακόπτη «ΠΑΧΟΣ» (AutoCAD LWT off = όλα hairline).
 *
 * ⚠️ Ένα ολόκληρο pixel, όχι μισό. Ο καμβάς ζωγραφίζει το `lineWidth = 0.5` ως **ημιδιαφανή**
 * γραμμή· σε πυκνό πλέγμα αυτό διαβάζεται ως «ξεθωριασμένος πίνακας», όχι ως «λεπτή πένα».
 */
export const HAIRLINE_DISPLAY_PX = 1;

/** Πόσα px ανά mm βάφει το μελάνι **αυτή τη στιγμή**, και αν τα πάχη φαίνονται καθόλου. */
export interface LineweightDisplayState {
  /** Το DPI της μετατροπής — οθόνη ή, σε ενεργό print pass, το πραγματικό DPI εκτύπωσης. */
  readonly dpi: number;
  /** `false` μόνο όταν ο χρήστης έσβησε τον διακόπτη «ΠΑΧΟΣ» σε **ζωντανή** οθόνη. */
  readonly show: boolean;
}

/**
 * Η ζωντανή κατάσταση, σε **μία** ανάγνωση.
 *
 * Εξάγεται χωριστά από το {@link lineweightDisplayPx} για τον έναν καταναλωτή που έχει
 * επιπλέον δικό του fallback πάνω στο ίδιο gate (ο `dxf-renderer-style-resolve`, όπου ένα
 * legacy `entity.lineWidth` σε px περνά από τον ίδιο διακόπτη). Χωρίς αυτό, εκείνος θα
 * κρατούσε **δεύτερο αντίγραφο** των δύο γραμμών — και θα ήταν το αντίγραφο που αποκλίνει.
 */
export function lineweightDisplayState(): LineweightDisplayState {
  // ADR-454 — ενεργό μόνο κατά το offscreen print render (`null` αλλιώς).
  const printPolicy = getPrintColorPolicy();
  return {
    dpi: printPolicy ? printPolicy.dpi : SCREEN_DPI,
    show: printPolicy !== null || getShowLineweight(),
  };
}

/**
 * **Πάχος σε sheet-mm → px οθόνης**, με το δάπεδο και τον διακόπτη «ΠΑΧΟΣ» εφαρμοσμένα.
 *
 * @param widthMm το πάχος του μολυβιού σε **sheet-mm** (γεωμετρία σχεδίου). Μη πεπερασμένο
 *   ή μη θετικό ⇒ το δάπεδο: «καμία πένα» δεν είναι «αόρατη γραμμή» — ένα `NaN` στο
 *   `ctx.lineWidth` κάνει τον καμβά να **αγνοήσει σιωπηλά ολόκληρη τη διαδρομή**.
 */
export function lineweightDisplayPx(widthMm: number): number {
  const { dpi, show } = lineweightDisplayState();
  if (!show || !Number.isFinite(widthMm) || widthMm <= 0) return HAIRLINE_DISPLAY_PX;
  return Math.max(HAIRLINE_DISPLAY_PX, mmToDisplayPx(widthMm, dpi));
}
