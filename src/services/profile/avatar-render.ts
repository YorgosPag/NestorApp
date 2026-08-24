'use client';

/**
 * =============================================================================
 * 🖼️ ΦΩΤΟΓΡΑΦΙΑ ΠΡΟΦΙΛ — ΑΠΟΚΩΔΙΚΟΠΟΙΗΣΗ & ΕΠΑΝΑΚΩΔΙΚΟΠΟΙΗΣΗ (ADR-798 §16)
 * =============================================================================
 *
 * Ό,τι χρειάζεται **DOM** ζει εδώ· τα μαθηματικά και οι έλεγχοι ζουν στο
 * {@link module:services/profile/avatar-image}, που δοκιμάζεται χωρίς browser.
 *
 * ⚠️ **Ο ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ EXIF ΕΙΝΑΙ ΤΟ ΑΝΤΙΘΕΤΟ ΤΟΥ EXIF-ΩΣ-ΔΙΑΡΡΟΗ.** Τα
 * μεταδεδομένα τοποθεσίας πρέπει να **χαθούν**· η ετικέτα *Orientation* πρέπει να
 * **εφαρμοστεί**. Αν αγνοηθεί, η φωτογραφία κινητού βγαίνει **γυρισμένη 90°** —
 * το κλασικό «γιατί είναι πλάγιο το προφίλ μου». Το `createImageBitmap` με
 * `imageOrientation: 'from-image'` το εφαρμόζει **πριν** φτάσουμε στο canvas,
 * οπότε στο canvas δεν υπάρχει πια ούτε ετικέτα ούτε στροφή να θυμηθεί κανείς.
 *
 * @module services/profile/avatar-render
 */

import {
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_OUTPUT_QUALITY,
  AVATAR_OUTPUT_SIZE,
  AvatarImageError,
  computeSourceRect,
  sniffImageFormat,
  type CropRequest,
  type SourceSize,
} from './avatar-image';

/** Η αποκωδικοποιημένη πηγή, με ρητό `release()` — τα bitmaps δεν τα μαζεύει ο GC έγκαιρα. */
export interface AvatarSource extends SourceSize {
  readonly image: CanvasImageSource;
  release(): void;
}

/** Τα πρώτα bytes, για το {@link sniffImageFormat}. 16 αρκούν για κάθε υπογραφή που δεχόμαστε. */
async function readHead(file: Blob, count = 16): Promise<Uint8Array> {
  const buffer = await file.slice(0, count).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Αποκωδικοποιεί ένα αρχείο που διάλεξε άνθρωπος.
 *
 * Η σειρά είναι σκόπιμη: **μέγεθος → υπογραφή → αποκωδικοποίηση**. Τα δύο πρώτα
 * είναι φθηνά και δίνουν *κατανοητό* μήνυμα· η αποκωδικοποίηση είναι το ακριβό
 * βήμα και το μόνο που μπορεί να αποφανθεί οριστικά.
 */
export async function decodeAvatarSource(file: File): Promise<AvatarSource> {
  if (file.size > AVATAR_MAX_INPUT_BYTES) throw new AvatarImageError('size');
  if (sniffImageFormat(await readHead(file)) === null) throw new AvatarImageError('format');

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      /* πέφτουμε στο <img>: παλαιότερα Safari δεν δέχονται το imageOrientation */
    }
  }
  return decodeViaImageElement(file);
}

/** Εφεδρική διαδρομή. Ο browser εφαρμόζει τον προσανατολισμό EXIF από μόνος του σε `<img>`. */
function decodeViaImageElement(file: File): Promise<AvatarSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarImageError('decode'));
    };
    img.src = url;
  });
}

/** Το αποτέλεσμα: **δικά μας** bytes, σε μορφή που ξέρουμε. */
export interface RenderedAvatar {
  readonly blob: Blob;
  readonly ext: 'webp' | 'png';
}

/**
 * Ζωγραφίζει το επιλεγμένο τετράγωνο σε καμβά {@link AVATAR_OUTPUT_SIZE}² και το
 * **επανακωδικοποιεί**. Εδώ ακριβώς χάνονται EXIF/GPS και κάθε ενσωματωμένο
 * ωφέλιμο φορτίο: από αυτό το σημείο και πέρα δεν υπάρχει byte του χρήστη.
 */
export async function renderAvatar(source: AvatarSource, crop: Omit<CropRequest, 'source'>): Promise<RenderedAvatar> {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AvatarImageError('encode');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const rect = computeSourceRect({ ...crop, source });
  ctx.drawImage(
    source.image,
    rect.sx, rect.sy, rect.size, rect.size,
    0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE,
  );

  const webp = await toBlob(canvas, 'image/webp');
  if (webp) return { blob: webp, ext: 'webp' };
  // Οι `storage.rules` δέχονται `image/.*`, οπότε το PNG είναι νόμιμη έξοδος —
  // απλώς μεγαλύτερη. Καλύτερα μεγαλύτερο αρχείο από αποτυχία σε παλιό browser.
  const png = await toBlob(canvas, 'image/png');
  if (png) return { blob: png, ext: 'png' };
  throw new AvatarImageError('encode');
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob && blob.type === type ? blob : null), type, AVATAR_OUTPUT_QUALITY);
  });
}
