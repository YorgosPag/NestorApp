/**
 * SSoT — **οι δύο αποθήκες αποκωδικοποιημένων εικόνων του σχεδίου**, και το «ποια εικόνα ζητώ» (ADR-909 Β2.6).
 *
 * ## Γιατί ΜΙΑ ανά είδος και όχι μία ανά αποδότη
 * Κάθε `HatchRenderer` / `ImageRenderer` κρατούσε **δική του** `HatchImageCache`. Στην οθόνη αυτό ήταν
 * απλώς σπατάλη (κάθε καμβάς αποκωδικοποιούσε ξανά το ίδιο αρχείο). Στη **λήψη εκτός οθόνης** ήταν ελάττωμα:
 * η εκτύπωση και η δημόσια κάτοψη φτιάχνουν **νέο** `DxfRenderer` ⇒ νέα, **άδεια** αποθήκη ⇒ η εικόνα που
 * ο άνθρωπος βλέπει ήδη στον καμβά του «δεν είχε φορτώσει ποτέ», και ζωγραφιζόταν επίπεδο γκρι.
 *
 * Μετρημένο ζωντανά (2026-10-09, «95 τ.μ.»): `cobblestone/albedo.jpg` και `tile/albedo.jpg` ζητήθηκαν τη
 * στιγμή της λήψης και αποκωδικοποιήθηκαν 55 και 30 ms **μετά** τη ζωγραφική.
 *
 * Με κοινή αποθήκη, ό,τι προφορτώσει η λήψη (`print/capture/preload-scene-images`) το βρίσκει **έτοιμο**
 * ο αποδότης που θα φτιαχτεί αμέσως μετά — και ό,τι έχει ήδη δει η οθόνη δεν ξαναφορτώνεται.
 *
 * ## Γιατί το «ποια εικόνα» ζει εδώ
 * Ο αποδότης και η προφόρτωση οφείλουν να ζητούν **το ίδιο κλειδί**. Αν το έφτιαχνε ο καθένας μόνος του,
 * η προφόρτωση θα ζέσταινε μια εγγραφή και ο αποδότης θα ρωτούσε άλλη — πράσινα tests, γκρι εικόνα.
 *
 * @see ./hatch-image-cache.ts — η μηχανή (`resolve` σύγχρονο · `preload` ασύγχρονο)
 * @see ../../../print/capture/preload-scene-images.ts — ο μόνος που περιμένει
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md
 */

import type { HatchImageFill } from '../../../types/entities';
import { plotStyleGreysImages, type PrintPlotStyle } from '../../../config/print-color-policy';
// ADR-040 — async asset load «σπρώχνει» ένα dirty-frame (κανένας αποδότης δεν subscribe-άρει).
import { markAllCanvasDirty } from '../../core/frame-scheduler-api';
import { HatchImageCache, type ImageResolveSpec } from './hatch-image-cache';
import { imageFillVariantKey } from './hatch-image-variant-key';

/** Εικόνες **υλικού** γραμμοσκίασης (`assetId` → κατάλογος υλικών / βιβλιοθήκη χρήστη). */
export const hatchFillImageCache = new HatchImageCache(markAllCanvasDirty);

/**
 * «Γυμνές» εικόνες (`ImageEntity`): το `url` **είναι** ήδη το src, και φορτώνεται με CORS ώστε ένα remote
 * αρχείο να μη «μολύνει» τον καμβά (αλλιώς σπάει το `toBlob`/`toDataURL` της λήψης — ADR-651 Φάση Ε).
 */
export const imageEntityImageCache = new HatchImageCache(markAllCanvasDirty, async (url) => url, 'anonymous');

/** Η γκρι εκδοχή είναι **άλλη εικόνα** από την έγχρωμη ⇒ άλλη εγγραφή. */
const GREY_KEY_SUFFIX = '|plot:grey';

function toneKey(key: string, grey: boolean): string {
  return grey ? `${key}${GREY_KEY_SUFFIX}` : key;
}

/**
 * **Ποια εικόνα υλικού ζητά αυτό το γέμισμα** υπό το δοσμένο στυλ εκτύπωσης (`null` = ζωντανή οθόνη).
 *
 * ⚠️ Χωρίς στυλ το κλειδί είναι **ακριβώς** το `imageFillVariantKey` — η οθόνη δεν αλλάζει ούτε κατά ένα
 * χαρακτήρα (καμία ακύρωση αποθήκης σε υπάρχοντα σχέδια).
 */
export function imageFillResolveSpec(fill: HatchImageFill, plotStyle: PrintPlotStyle | null): ImageResolveSpec {
  const grey = plotStyle !== null && plotStyleGreysImages(plotStyle);
  return {
    key: toneKey(imageFillVariantKey(fill), grey),
    assetId: fill.assetId,
    tint: fill.tint,
    procedural: fill.procedural,
    tileWidthMm: fill.tileWidth,
    tileHeightMm: fill.tileHeight,
    ...(grey ? { grayscale: true } : {}),
  };
}

/** **Ποια «γυμνή» εικόνα ζητά αυτό το `url`** υπό το δοσμένο στυλ εκτύπωσης (`null` = ζωντανή οθόνη). */
export function imageEntityResolveSpec(url: string, plotStyle: PrintPlotStyle | null): ImageResolveSpec {
  const grey = plotStyle !== null && plotStyleGreysImages(plotStyle);
  return { key: toneKey(url, grey), assetId: url, ...(grey ? { grayscale: true } : {}) };
}
