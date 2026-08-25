/**
 * Test fixture (NOT a suite — no `.test.` suffix, so jest's `testMatch` skips it):
 * **διαβάζει το κείμενο που ζωγραφίστηκε ως glyph paths.**
 *
 * ## 🔴 Το πρόβλημα που λύνει
 * Ο καταγραφέας ζωγραφικής βλέπει `ctx.fillText(text, …)` και κρατά τη συμβολοσειρά. Μόλις
 * όμως φορτωθεί όψη, ο ζωγράφος περνά σε `paintTextRun` → `ctx.fill(run.path)`, και το
 * `GlyphRun` κρατά **μόνο** `path` + `metrics`. Άρα κάθε ισχυρισμός «τι κείμενο βάφτηκε;»
 * γινόταν τυφλός **ακριβώς στη διαμόρφωση που έχει η παραγωγή** — μετρημένο σε **8** σουίτες.
 *
 * ## Πώς
 * Το `glyph-path-cache` είναι το **μόνο** σημείο που ξέρει ταυτόχρονα διαδρομή **και** κείμενο
 * (το κλειδί του είναι `όνομα ⟂ tracking ⟂ κείμενο`). Ανοίγει ένα test-only `WeakMap`
 * διαδρομή → κείμενο· εδώ το διαβάζουμε πίσω από τις εγγραφές του καταγραφέα.
 *
 * ⚠️ **ΞΕΧΩΡΙΣΤΟ MODULE, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ**: αν αυτό ζούσε μέσα στο `testing/paint-recorder`,
 * κάθε μία από τις **13** σουίτες που τον χρησιμοποιούν θα έσερνε ολόκληρο τον glyph pipeline
 * στο module registry — και ένα πρόωρο φόρτωμα του pipeline είναι **ακριβώς** το ελάττωμα που
 * μόλις διορθώθηκε στο `census-setup.js` (νικούσε τα `jest.mock` τριών σουιτών).
 *
 * @module text-engine/fonts/__tests__/_glyph-paint-text
 */

import { __installGlyphRunIndex, __glyphRunText } from '../glyph-path-cache';
import type { PaintLog } from '../../../testing/paint-recorder';

/**
 * Άνοιξε το ευρετήριο για τη διάρκεια μιας σουίτας. Επιστρέφει καθαριστή για `afterAll`.
 *
 * ⚠️ Άνοιξέ το **πριν** ζωγραφίσει ο κώδικας υπό δοκιμή: το ευρετήριο γεμίζει στο
 * `getGlyphRun`, και μια διαδρομή που χτίστηκε με το ευρετήριο κλειστό **δεν** καταγράφεται
 * τη στιγμή εκείνη (καταγράφεται όμως στο επόμενο cache hit — δες `remember`).
 */
export function installGlyphTextCapture(): () => void {
  __installGlyphRunIndex(true);
  return () => __installGlyphRunIndex(false);
}

/**
 * Το ορατό κείμενο ενός καταγεγραμμένου περάσματος ζωγραφικής — **και από τις δύο** βαθμίδες.
 *
 * 🔑 **Η ΕΝΩΣΗ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ**: χωρίς φορτωμένη όψη το κείμενο ζει στο `log.texts`
 * (`fillText`)· με όψη ζει στο `log.fillPaths` (`fill(path)`). Ένας ισχυρισμός που κοιτάζει
 * **μόνο** το ένα είναι πράσινος στη μία διαμόρφωση και τυφλός στην άλλη — και η
 * **παραγωγή** είναι πάντα η δεύτερη.
 *
 * ⚠️ Τα γεμίσματα που **δεν** είναι glyph runs (φόντα κελιών, επιλογές) δίνουν `undefined`
 * και αγνοούνται — δεν είναι κείμενο.
 */
export function paintedText(log: PaintLog): string[] {
  const fromCss = log.texts.map((t) => t.text);
  const fromGlyphs = log.fillPaths
    .map((f) => __glyphRunText(f.path))
    .filter((t): t is string => typeof t === 'string');
  return [...fromCss, ...fromGlyphs];
}
