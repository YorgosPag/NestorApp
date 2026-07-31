/**
 * ADR-736 §6 — **νέα raster πηγή σε εικόνα**: πόσο μεγάλη μπαίνει, και τι αλλάζει όταν
 * αντικαθίσταται (pure geometry SSoT· μηδέν React/DOM/δίκτυο).
 *
 * Δύο εντολές του κλάδου, **μία** ερώτηση από κάτω — «μπαίνει καινούριο raster σε πλαίσιο, τι
 * διαστάσεις παίρνει»:
 *   · **ΕΙΣΑΓΩΓΗ** (AutoCAD `IMAGEATTACH`, Revit *Insert ▸ Image*, ArchiCAD *Place Picture*)
 *     → {@link imagePlacementSize}: δεν υπάρχει πλαίσιο ακόμη, άρα το φτιάχνουμε.
 *   · **ΑΝΤΙΚΑΤΑΣΤΑΣΗ** (InDesign *Relink*, Figma *Replace image*, AutoCAD *Change Path*)
 *     → {@link buildImageSourceSwapPatch}: το πλαίσιο **υπάρχει και δεν αγγίζεται**.
 * Δύο modules θα κρατούσαν το καθένα δικό του υπολογισμό λόγου πλευρών — ακριβώς το sibling
 * clone που απαγορεύει ο N.18.
 *
 * ## 🔴 Η απόφαση της αντικατάστασης: **Η ΓΕΩΜΕΤΡΙΑ ΜΕΝΕΙ** (Giorgio 2026-07-31)
 *
 * Θέση, πλάτος, ύψος και γωνία **δεν αλλάζουν ποτέ** από μια αντικατάσταση. Δεν είναι
 * προτίμηση στυλ — είναι ορθότητα: σε ένα CAD υπόβαθρο η γεωμετρία είναι **γεωαναφερμένη**
 * (το `47_ergasia.dxf` καρφώνει κάθε σάρωση σε πραγματικές συντεταγμένες), οπότε «προσαρμογή
 * στις νέες διαστάσεις» θα μετακινούσε το υπόβαθρο σε **λάθος θέση στον κόσμο**. Την ίδια
 * στάση κρατούν όλοι: το InDesign κρατά το πλαίσιο, το Figma κρατά το πλαίσιο και κάνει fill,
 * και το AutoCAD *Change Path* δεν αγγίζει καν την οντότητα `IMAGE` — αλλάζει μόνο το
 * `IMAGEDEF`. Ο `ImageRenderer` κάνει ήδη **fill**, άρα η νέα εικόνα γεμίζει το ίδιο πλαίσιο.
 *
 * Ο χρήστης που **θέλει** προσαρμογή την έχει ως ρητή, ξεχωριστή εντολή — «Επαναφορά
 * Διαστάσεων» / «Κλείδωμα Αναλογιών» (`reset-image-dimensions.ts`). Δύο ενέργειες, δύο
 * προθέσεις· καμία δεν γίνεται σιωπηλά μέσα στην άλλη.
 *
 * @see ./reset-image-dimensions.ts — οι δύο ρητές ενέργειες διαστάσεων (ADR-654)
 * @see ../entourage/place-entourage.ts — ο αδελφός builder για catalog entourage
 */

import type { ImageEntity } from '../../types/image';

/** Διαστάσεις σε pixels — ίδιο σχήμα με το `ForeignAssetPixelSize` του `io/shared/`. */
export interface ImagePixelSize {
  readonly x: number;
  readonly y: number;
}

/**
 * Πόσο του **ορατού** πλάτους καταλαμβάνει μια νεοεισαγόμενη εικόνα.
 *
 * Το DXF δεν δηλώνει μέγεθος για μια εικόνα που δεν ήρθε από αυτό, και ο AutoCAD ρωτά τον
 * χρήστη «scale factor» — ερώτηση που κανείς δεν μπορεί να απαντήσει πριν δει το αποτέλεσμα.
 * Το «1 pixel = 1 μονάδα σχεδίου» (το default του AutoCAD) είναι ενεργά επιβλαβές εδώ: μια
 * φωτογραφία αυτοψίας 4000×1800 σε σχέδιο μέτρων γίνεται **4 χιλιόμετρα** πλάτος — αόρατη,
 * γιατί ο χρήστης βρίσκεται μέσα της.
 *
 * Κλάσμα του ορατού πλάτους ⇒ η εικόνα προσγειώνεται **πάντα ορατή και χειρίσιμη**, σε
 * οποιαδήποτε κλίμακα σχεδίου και οποιοδήποτε zoom (μοτίβο Figma/PowerPoint paste). Το `1/3`
 * είναι αρκετά μεγάλο για να φανεί αμέσως και αρκετά μικρό ώστε να μη σκεπάσει το σχέδιο.
 */
export const IMAGE_PLACEMENT_VIEWPORT_FRACTION = 1 / 3;

/** Θετικός, πεπερασμένος (φιλτράρει `0`/`NaN`/`Infinity`/undefined) — ίδιος φρουρός με το reset. */
function isPositiveFinite(value: number | undefined | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Ο λόγος πλευρών (πλάτος/ύψος) ενός raster, ή `null` όταν δεν αποκωδικοποιήθηκε.
 *
 * `null` σημαίνει **«δεν ξέρω»**, ποτέ «τετράγωνο»: το `foreignAssetPixelSize` επιστρέφει
 * `null` για μορφή που ο browser δεν διαβάζει (TIFF) ή σε περιβάλλον χωρίς `createImageBitmap`.
 * Ο καλών αποφασίζει τι κάνει με το «δεν ξέρω» — εδώ δεν επινοείται σχήμα.
 */
export function pixelAspect(size: ImagePixelSize | null | undefined): number | null {
  if (!size || !isPositiveFinite(size.x) || !isPositiveFinite(size.y)) return null;
  return size.x / size.y;
}

/**
 * Το μέγεθος **σε μονάδες σχεδίου** μιας εικόνας που μόλις εισάγεται, δεδομένου του ορατού
 * πλάτους της προβολής. Ο λόγος πλευρών τηρείται πιστά· άγνωστος λόγος → τετράγωνο (η μόνη
 * ουδέτερη επιλογή όταν το raster δεν αποκωδικοποιείται, ώστε η εντολή να μην αποτυγχάνει).
 *
 * `null` όταν το ορατό πλάτος δεν είναι χρήσιμος αριθμός — ο καλών ματαιώνει την τοποθέτηση
 * αντί να καρφώσει μια εικόνα μηδενικού ή άπειρου μεγέθους στη σκηνή.
 */
export function imagePlacementSize(
  pixelSize: ImagePixelSize | null | undefined,
  visibleWorldWidth: number,
): { width: number; height: number } | null {
  if (!isPositiveFinite(visibleWorldWidth)) return null;
  const width = visibleWorldWidth * IMAGE_PLACEMENT_VIEWPORT_FRACTION;
  const aspect = pixelAspect(pixelSize) ?? 1;
  return { width, height: width / aspect };
}

/** Ό,τι ξέρουμε για τη νέα πηγή τη στιγμή της αντικατάστασης. */
export interface ImageSourceSwapInput {
  /** Το download URL του **ανεβασμένου** asset (ποτέ bytes — βλ. `types/image.ts`). */
  readonly url: string;
  /** Εγγενές μέγεθος του νέου raster· `null` = δεν αποκωδικοποιήθηκε. */
  readonly pixelSize?: ImagePixelSize | null;
  /** Το όνομα αρχείου που διάλεξε ο χρήστης (γίνεται η ετικέτα της εικόνας). */
  readonly sourceName?: string;
}

/**
 * Το patch μιας αντικατάστασης πηγής, ή `null` όταν δεν αλλάζει τίποτα (idempotent — ο καλών
 * το παραλείπει αντί να γράψει κενό βήμα στο ιστορικό αναίρεσης).
 *
 * **Δεν περιέχει ΚΑΝΕΝΑ γεωμετρικό πεδίο** — αυτό είναι το συμβόλαιο, όχι παράλειψη· βλ. την
 * απόφαση στην κεφαλίδα. Ο τύπος επιστροφής το επιβάλλει: `position`/`width`/`height`/
 * `rotation` δεν ανήκουν καν στο σχήμα, οπότε ένα μελλοντικό «να προσαρμόσουμε και…» δεν
 * γράφεται κατά λάθος — πρέπει να αλλάξει ο τύπος, δηλαδή να ληφθεί απόφαση.
 *
 * Τα `intrinsicWidth`/`intrinsicHeight` **ενημερώνονται**, και αυτό είναι απαραίτητο: είναι το
 * «εργοστασιακό μέγεθος» που διαβάζει η «Επαναφορά Διαστάσεων». Αν έμεναν της **παλιάς**
 * εικόνας, το κουμπί θα επανέφερε στον λόγο πλευρών ενός αρχείου που δεν υπάρχει πια — μια
 * παραμόρφωση που θα εμφανιζόταν πολύ αργότερα και θα ήταν αδύνατο να συνδεθεί με την αιτία της.
 * Κρατάμε το **τρέχον πλάτος** και διορθώνουμε το ύψος στον νέο λόγο: η κλίμακα που διάλεξε ο
 * χρήστης επιβιώνει, αλλάζει μόνο η αναλογία (ίδιο σκεπτικό με το «Κλείδωμα Αναλογιών»).
 * Άγνωστος λόγος πλευρών ⇒ τα intrinsic **δεν** αγγίζονται: το «δεν ξέρω» δεν γίνεται ποτέ
 * αριθμός.
 */
export type ImageSourceSwapPatch = Pick<
  ImageEntity,
  'url' | 'sourceName' | 'intrinsicWidth' | 'intrinsicHeight'
>;

export function buildImageSourceSwapPatch(
  image: Pick<ImageEntity, 'url' | 'width' | 'height' | 'sourceName'>,
  input: ImageSourceSwapInput,
): Partial<ImageSourceSwapPatch> | null {
  const patch: Partial<ImageSourceSwapPatch> = {};
  if (input.url && image.url !== input.url) patch.url = input.url;
  if (input.sourceName && image.sourceName !== input.sourceName) {
    patch.sourceName = input.sourceName;
  }

  const aspect = pixelAspect(input.pixelSize);
  if (aspect != null && isPositiveFinite(image.width)) {
    patch.intrinsicWidth = image.width;
    patch.intrinsicHeight = image.width / aspect;
  }

  return Object.keys(patch).length === 0 ? null : patch;
}
