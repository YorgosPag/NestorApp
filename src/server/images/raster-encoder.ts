import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ κωδικοποιητής raster του διακομιστή** — αποκωδικοποίηση με στροφή, μία
 * φορά· ένα παράγωγο webp ανά κουτί (ADR-899 §3 · ADR-841 Α2.2).
 * @module server/images/raster-encoder
 * @related services/listings/public-shelf-sanitise (δημόσιο ράφι, effort 6) ·
 *          server/files/image-preview.service (προεπισκοπήσεις κατ' απαίτηση, effort 4) ·
 *          services/upload/utils/public-shelf-encoding (ο τύπος της κωδικοποίησης)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΞΑΓΩΓΗ, ΟΧΙ ΔΕΥΤΕΡΟΣ ΚΩΔΙΚΟΠΟΙΗΤΗΣ (N.0.2)
 * ────────────────────────────────────────────────────────────────────────────
 * Ο πυρήνας ζούσε **ιδιωτικά** στο `public-shelf-sanitise.ts`. Όταν οι εσωτερικές
 * προεπισκοπήσεις (ADR-899) χρειάστηκαν **την ίδια** απόφαση — στροφή από EXIF, ποτέ μεγέθυνση,
 * webp με preset — οι δρόμοι ήταν δύο: αντίγραφο ή εξαγωγή. Με αντίγραφο, μια διόρθωση (π.χ.
 * όριο pixel) θα έφτανε **στο ένα** από τα δύο.
 *
 * 🔑 **Ό,τι είναι ΠΟΛΙΤΙΚΗ ζει στον καλούντα** (ποιο κουτί, πόση προσπάθεια)· **ό,τι είναι
 * ΜΗΧΑΝΙΣΜΟΣ ζει εδώ**.
 *
 * ⚠️ **EXIF / GPS**: το `sharp` **δεν** αντιγράφει μεταδεδομένα στην έξοδο αν δεν του ζητηθεί
 * ρητά (`withMetadata`/`keepExif`). Εδώ δεν ζητείται **ποτέ** ⇒ κάθε παράγωγο βγαίνει χωρίς
 * θέση λήψης. Άγκυρα: `__tests__/raster-encoder.test.ts`.
 */

import sharp from 'sharp';

import type { RasterShelfEncoding } from '@/services/upload/utils/public-shelf-encoding';

/** Ο τύπος περιεχομένου **κάθε** παραγώγου αυτού του κωδικοποιητή. */
export const RASTER_DERIVATIVE_CONTENT_TYPE = 'image/webp';

/**
 * **Πόσα pixel δέχεται η αποκωδικοποίηση** — το όριο του libvips, γραμμένο ρητά.
 *
 * 🔑 Η τιμή είναι η προεπιλογή του `sharp` (0x3FFF × 0x3FFF ≈ 268 MP). Γράφεται εδώ για να
 * είναι **απόφαση**, όχι σιωπηλή εξάρτηση από την έκδοση της βιβλιοθήκης: χωράει αισθητήρα
 * κινητού 200 MP, και κόβει μια «βόμβα αποσυμπίεσης» πριν δεσμεύσει μνήμη.
 */
export const RASTER_MAX_INPUT_PIXELS = 0x3fff * 0x3fff;

/** Ένα παράγωγο: τα bytes και οι **πραγματικές** διαστάσεις του. */
export interface RasterDerivative {
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
}

/**
 * **Πού χωράει το παράγωγο.** `max-edge` = καμία πλευρά πάνω από `px` (το ράφι)· `width` = το
 * πλάτος είναι `px` (το `srcset` με περιγραφείς `w` — εκεί το ύψος δεν πρέπει να κόβει).
 */
export type RasterBox =
  | { readonly fit: 'max-edge'; readonly px: number }
  | { readonly fit: 'width'; readonly px: number };

/**
 * **Bytes → αγωγός ΗΔΗ στραμμένος**. Πετά ό,τι πετά το `sharp` (ο καλών ονομάζει την αποτυχία).
 *
 * ⚠️ **Το `.rotate()` μπαίνει ΕΔΩ, μία φορά.** Είναι απόφαση του **πρωτοτύπου** — αν ζούσε στους
 * καλούντες, ένας θα μπορούσε κάποτε να το χάσει και να δείξει φωτογραφίες κινητού **γυρισμένες
 * στο πλάι**.
 */
export function decodeOriented(input: Buffer): sharp.Sharp {
  return sharp(input, { failOn: 'error', limitInputPixels: RASTER_MAX_INPUT_PIXELS }).rotate();
}

function resizeOptions(box: RasterBox): sharp.ResizeOptions {
  return box.fit === 'width'
    ? { width: box.px, withoutEnlargement: true }
    : { width: box.px, height: box.px, fit: 'inside', withoutEnlargement: true };
}

/**
 * **Η κωδικοποίηση, στη γλώσσα του `sharp`** — η **μία** μετάφραση.
 *
 * 🔴 Γιατί το σήμα θέλει `lossless` και όχι απλώς «υψηλότερο q»: το `cwebp` δίνει χωριστά preset
 * για `photo` και `icon` επειδή τα δύο υλικά έχουν αντίθετη στατιστική — συνεχείς βαθμίδες
 * έναντι επίπεδων περιοχών με αιχμηρές ακμές, δηλαδή **μόνο** τις μεταβάσεις που θολώνει η lossy.
 *
 * ⚠️ Καμία ρύθμιση διαφάνειας, **επίτηδες**: το WebP κρατά το alpha και στους δύο τρόπους, άρα
 * ένα διάφανο λογότυπο κάθεται σωστά σε **δύο** θέματα. Το `exact` μένει `false` — τα RGB
 * πλήρως διάφανων pixel δεν διατηρούνται, άρα δεν υπάρχει πού να κρυφτεί δεδομένο.
 */
function webpOptions(encoding: RasterShelfEncoding, effort: number): sharp.WebpOptions {
  const base = { preset: encoding.preset, effort } as const;
  return encoding.quality === 'lossless' ? { ...base, lossless: true } : { ...base, quality: encoding.quality };
}

/**
 * **Ένας αγωγός → ένα παράγωγο webp.** Ποτέ μεγέθυνση: μικρό πρωτότυπο ⇒ το ίδιο μέγεθος.
 *
 * ⚠️ **Δέχεται αγωγό ΗΔΗ στραμμένο** (`decodeOriented`) και δεν ξανακαλεί `.rotate()`· για
 * πολλά παράγωγα από **μία** αποκωδικοποίηση ο καλών περνά `pipeline.clone()`.
 */
export async function encodeRasterDerivative(
  pipeline: sharp.Sharp,
  box: RasterBox,
  encoding: RasterShelfEncoding,
  effort: number,
): Promise<RasterDerivative> {
  const { data, info } = await pipeline
    .resize(resizeOptions(box))
    .webp(webpOptions(encoding, effort))
    .toBuffer({ resolveWithObject: true });

  return { bytes: data, contentType: RASTER_DERIVATIVE_CONTENT_TYPE, width: info.width, height: info.height };
}
