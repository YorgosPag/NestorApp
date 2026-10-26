import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ κωδικοποιητής raster του διακομιστή** — αποκωδικοποίηση με στροφή, μία
 * φορά· ένα παράγωγο webp ανά κουτί (ADR-899 §3.2 · ADR-841 Α2.2)· μία απόδοση JPEG/PNG με απόφαση
 * χρώματος ανά συνταγή (ADR-923 §5.10.3 — αποδόσεις καταλόγου, `catalog-asset-renditions.server`).
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

import { imageColourOf, type ImageColour, type ImageColourModel } from '@/lib/images/image-colour';
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

// =============================================================================
// ΑΠΟΔΟΣΕΙΣ (renditions) — JPEG/PNG με ΑΠΟΦΑΣΗ ΧΡΩΜΑΤΟΣ (ADR-923 §5.10.3)
// =============================================================================
//
// 🔑 Γιατί όχι WebP εδώ: οι αποδόσεις καταλόγου μπαίνουν σε PDF (έκδοση, Φ5) — και οι μηχανές PDF ενσωματώνουν
// JPEG/PNG, όχι WebP. Αδιαφανές ⇒ JPEG · με διαφάνεια ⇒ PNG (φωτογραφία προϊόντος σε διάφανο φόντο).
// ⚠️ ΜΕΤΡΗΜΕΝΟ στο sharp 0.35 (2026-10-26), και γι' αυτό ο μηχανισμός είναι όπως είναι:
// - `keepIccProfile()` μόνο του σε CMYK πηγή ⇒ έξοδος **sRGB**. Το CMYK διατηρείται ΜΟΝΟ με
//   `pipelineColourspace('cmyk')` + `toColourspace('cmyk')` + `keepIccProfile()`.
// - `withMetadata()`/`keepMetadata()` ⇒ είτε ξανά sRGB είτε κρατά EXIF/GPS ⇒ **ποτέ** εδώ. Συνέπεια: η δηλωμένη
//   πυκνότητα (DPI) δεν γράφεται στην απόδοση — η ενεργή ανάλυση κρίνεται από τα pixel στην έκδοση (Δ10).
// - CMYK σε PNG ⇒ sRGB **χωρίς** προφίλ ⇒ το CMYK με διαφάνεια παίρνει ρητή μετατροπή σε sRGB.

/** Τι κάνει η απόδοση στο χρώμα: όλα σε sRGB (web), ή διατήρηση του χώρου της πηγής (εκτύπωση, late binding). */
export type RasterRenditionColour = 'srgb' | 'preserve';

/** Η **πολιτική** μιας απόδοσης — ζει στον καλούντα (η συνταγή του καταλόγου)· ο μηχανισμός ζει εδώ. */
export interface RasterRenditionSpec {
  readonly box: RasterBox;
  readonly colour: RasterRenditionColour;
  readonly jpegQuality: number;
  readonly chromaSubsampling: '4:2:0' | '4:4:4';
}

/** Μια απόδοση: bytes + ό,τι **μετρήθηκε στην έξοδο** (όχι ό,τι ζητήθηκε). */
export interface RasterRendition extends RasterDerivative {
  readonly colour: ImageColour;
  /**
   * Η πηγή δεν είχε προφίλ ⇒ υπόθεση: RGB ⇒ ερμηνεύτηκε ως sRGB (σε κάθε απόδοση) · CMYK ⇒ η μετατροπή σε sRGB (web)
   * έγινε με γενικό CMYK, ενώ η εκτύπωση κρατά τους αριθμούς **χωρίς** προφίλ (late binding, output intent).
   */
  readonly assumedProfile: boolean;
  /** Ο χρωματικός τύπος της πηγής κρατήθηκε (εκτύπωση)· `false` όταν η πηγή δεν μπορούσε να μείνει όπως ήταν. */
  readonly colourPreserved: boolean;
}

type ColourTarget = 'srgb' | 'cmyk' | 'rgb-keep' | 'grey';

/** Ο χρωματικός στόχος — καθαρή απόφαση από το χρώμα της πηγής και την πολιτική. */
function colourTargetFor(source: ImageColour, colour: RasterRenditionColour): ColourTarget {
  if (colour === 'srgb') return 'srgb';
  if (source.model === 'cmyk' && !source.hasAlpha) return 'cmyk';
  if (source.model === 'rgb') return 'rgb-keep';
  if (source.model === 'grey') return 'grey';
  // CMYK με διαφάνεια (το PNG δεν έχει CMYK) · Lab · άγνωστος χώρος ⇒ sRGB, δηλωμένα.
  return 'srgb';
}

/** Ο **μηχανισμός** του στόχου, στη γλώσσα του `sharp` — οι συνδυασμοί που μετρήθηκαν ότι κρατούν. */
function applyColourTarget(pipeline: sharp.Sharp, target: ColourTarget, hasProfile: boolean): sharp.Sharp {
  switch (target) {
    case 'srgb':
      return pipeline.toColourspace('srgb').withIccProfile('srgb');
    case 'cmyk': {
      // 🔴 ADR-923 §5.10.4 — CMYK **χωρίς** προφίλ μένει **χωρίς** προφίλ, με τους ίδιους αριθμούς. Για CMYK δεν
      //    υπάρχει καθολική προεπιλογή (όπως το sRGB για το RGB): κατά PDF/X το ατεκμηρίωτο CMYK σημαίνει «στη συνθήκη
      //    του output intent» — Photoshop «Don't color manage». Μέχρι 2026-10-26 εδώ ενσωματωνόταν το εσωτερικό προφίλ
      //    του sharp («Chemical proof») ⇒ ΜΕΤΡΗΜΕΝΗ μετατόπιση (μέση απόκλιση pixel 12,35 έναντι 0,13) και μια **ψευδής**
      //    δήλωση στο αρχείο: προφίλ που δεν έδωσε ποτέ κανείς. Η υπόθεση δηλώνεται στο `assumedProfile`, όχι στα bytes.
      const cmyk = pipeline.pipelineColourspace('cmyk').toColourspace('cmyk');
      return hasProfile ? cmyk.keepIccProfile() : cmyk;
    }
    case 'rgb-keep':
      return hasProfile ? pipeline.keepIccProfile() : pipeline.withIccProfile('srgb');
    case 'grey': {
      const grey = pipeline.toColourspace('b-w');
      return hasProfile ? grey.keepIccProfile() : grey;
    }
  }
}

const TARGET_MODEL: Readonly<Record<ColourTarget, ImageColourModel>> = {
  srgb: 'rgb',
  cmyk: 'cmyk',
  'rgb-keep': 'rgb',
  grey: 'grey',
};

/**
 * **Ένας αγωγός → μία απόδοση JPEG/PNG** με απόφαση χρώματος. Ποτέ μεγέθυνση· ποτέ EXIF/GPS στην έξοδο.
 *
 * ⚠️ Δέχεται αγωγό **ΗΔΗ στραμμένο** (`decodeOriented`)· για πολλές αποδόσεις από μία αποκωδικοποίηση ο καλών περνά
 * `pipeline.clone()`. Το `source` είναι το χρώμα της **πηγής** (από τον κοινό αναγνώστη `imageRasterFactsIn`).
 */
export async function encodeRasterRendition(
  pipeline: sharp.Sharp,
  source: ImageColour,
  spec: RasterRenditionSpec,
): Promise<RasterRendition> {
  const target = colourTargetFor(source, spec.colour);
  const hasProfile = source.profile !== null;
  const coloured = applyColourTarget(pipeline.resize(resizeOptions(spec.box)), target, hasProfile);
  const encoded = source.hasAlpha
    ? coloured.png({ compressionLevel: 9 })
    : coloured.jpeg({ quality: spec.jpegQuality, chromaSubsampling: spec.chromaSubsampling, mozjpeg: true });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  const measured = imageColourOf(await sharp(data).metadata());
  if (measured === null) throw new Error('rendition output has no readable colour metadata');
  return {
    bytes: data,
    contentType: source.hasAlpha ? 'image/png' : 'image/jpeg',
    width: info.width,
    height: info.height,
    colour: measured,
    assumedProfile: !hasProfile && (source.model === 'rgb' || source.model === 'cmyk'),
    colourPreserved: spec.colour === 'preserve' && TARGET_MODEL[target] === source.model,
  };
}
