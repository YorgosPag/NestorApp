import 'server-only';

/**
 * @fileoverview **ΠΑΡΑΓΩΓΑ ΕΣΩΤΕΡΙΚΩΝ ΕΙΚΟΝΩΝ ΚΑΤ' ΑΠΑΙΤΗΣΗ** — «δώσε μου αυτό το ιδιωτικό αρχείο σε
 * πλάτος N» (ADR-899).
 * @module server/files/image-preview.service
 * @related app/api/storage/file/[...path]/route (ο ΜΟΝΟΣ καλών, πίσω από `withAuth` + έλεγχο μισθωτή) ·
 *          lib/files/file-preview-ladder (κλίμακα) · server/images/raster-encoder (κωδικοποιητής) ·
 *          lib/storage/storage-object-stream (stat + ανάγνωση καρφωμένης γενιάς)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙΠΟΤΑ ΜΟΝΙΜΟ — Η ΖΩΗ ΤΟΥ ΠΑΡΑΓΩΓΟΥ ΕΙΝΑΙ ΔΕΜΕΝΗ ΜΕ ΤΟ ΠΡΩΤΟΤΥΠΟ, ΑΠΟ ΤΗ ΔΟΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 * Κάθε αίτημα ρωτά **πρώτα** τη γενιά του πρωτοτύπου (μία κλήση μεταδεδομένων), και το κλειδί
 * κάθε cache — μνήμη διεργασίας **και** browser (ETag) — **περιέχει** τη γενιά. Άρα:
 * - διαγραμμένο πρωτότυπο ⇒ 404 **στο επόμενο αίτημα**, χωρίς καμία ακύρωση·
 * - αντικατεστημένο ⇒ νέο κλειδί ⇒ νέο παράγωγο·
 * - κανένα αντικείμενο δεν γράφεται σε κάδο ⇒ μηδέν ορφανά, μηδέν υπόλειμμα GDPR.
 * Το Cloudinary χρειάζεται ακύρωση CDN (ή 30 ημέρες)· εδώ η παλιά απάντηση **δεν μπορεί** να δοθεί.
 *
 * | στρώση | τι κρατά | όριο |
 * |---|---|---|
 * | browser | ETag ⇒ `304` χωρίς κατέβασμα/κωδικοποίηση | `private, no-cache` |
 * | μνήμη διεργασίας | bytes ανά (κάδος·μονοπάτι·γενιά·πλάτος·συνταγή) | {@link PREVIEW_CACHE_MAX_BYTES} (LRU) |
 * | ουρά | μία κωδικοποίηση ανά κλειδί, ≤ {@link PREVIEW_ENCODE_CONCURRENCY} ταυτόχρονα | {@link PREVIEW_MAX_QUEUED} ⇒ `busy` |
 *
 * ⚠️ **Ο έλεγχος «επιτρέπεται;» ΔΕΝ ζει εδώ** — τον κάνει ο route **πριν** καλέσει. Αυτή η υπηρεσία
 * δεν βλέπει ποτέ αίτημα που δεν πέρασε τον μισθωτή, άρα η cache δεν μπορεί να γίνει πλάγια πόρτα.
 */

import { createHash } from 'node:crypto';

import type { Bucket } from '@google-cloud/storage';

import { createBoundedLru, type BoundedLru } from '@/lib/cache/bounded-lru';
import { createPriorityTaskQueue, type PriorityTaskQueue } from '@/lib/async/priority-task-queue';
import {
  FILE_PREVIEW_EFFORT,
  FILE_PREVIEW_ENCODING,
  isPreviewableContentType,
} from '@/lib/files/file-preview-ladder';
import {
  readStorageObjectGeneration,
  statStorageObject,
  type StorageObjectStat,
} from '@/lib/storage/storage-object-stream';
import { createModuleLogger } from '@/lib/telemetry';
import {
  RASTER_DERIVATIVE_CONTENT_TYPE,
  decodeOriented,
  encodeRasterDerivative,
} from '@/server/images/raster-encoder';
import { FRAMING_AS_GIVEN, shelfRecipe } from '@/services/upload/utils/public-shelf-encoding';

const logger = createModuleLogger('IMAGE_PREVIEW');

/** Πόση μνήμη κρατούν τα έτοιμα παράγωγα. ~150 προεπισκοπήσεις 1280 ή χιλιάδες μικρογραφίες. */
export const PREVIEW_CACHE_MAX_BYTES = 64 * 1024 * 1024;
/** Ταυτόχρονες κωδικοποιήσεις — το `sharp` είναι CPU-δεμένο· παραπάνω απλώς στοιβάζει καθυστέρηση. */
export const PREVIEW_ENCODE_CONCURRENCY = 2;
/** Πάνω από τόσες σε αναμονή ⇒ `busy` (503) αντί για ουρά χωρίς όριο. */
export const PREVIEW_MAX_QUEUED = 64;
/** Πρωτότυπο μεγαλύτερο από αυτό δεν κατεβαίνει στη μνήμη για προεπισκόπηση. */
export const PREVIEW_MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;

/**
 * **Η συνταγή** — ό,τι αλλάζει τα bytes και τίποτα άλλο. Παράγεται από τις σταθερές, ποτέ χειρόγραφη
 * (ADR-841 Α2.3): αλλαγή ποιότητας/effort/κουτιού ακυρώνει αυτόματα κάθε ETag. `fitw` = το πλάτος
 * είναι το όριο (περιγραφείς `w` στο `srcset`), όχι η μέγιστη πλευρά όπως στο ράφι.
 */
export const FILE_PREVIEW_RECIPE = `${shelfRecipe(FILE_PREVIEW_ENCODING, FRAMING_AS_GIVEN)}:fitw:e${FILE_PREVIEW_EFFORT}`;

export interface ImagePreviewRequest {
  readonly bucket: Bucket;
  /** Σταθερό όνομα του κάδου (η θέση) — μέρος του κλειδιού: ίδιο μονοπάτι σε δύο κάδους ≠ ίδιο αρχείο. */
  readonly bucketKey: string;
  readonly storagePath: string;
  /** Ήδη επικυρωμένο ως πλάτος της κλίμακας από τον καλούντα. */
  readonly width: number;
  readonly ifNoneMatch: string | null;
}

export type ImagePreviewOutcome =
  | { readonly kind: 'not-modified'; readonly etag: string }
  | { readonly kind: 'image'; readonly etag: string; readonly bytes: Buffer; readonly contentType: string }
  | { readonly kind: 'absent' }
  | { readonly kind: 'not-previewable' }
  | { readonly kind: 'too-large' }
  | { readonly kind: 'undecodable' }
  | { readonly kind: 'busy' };

/** Οι εξαρτήσεις — εγχεόμενες ώστε κάθε στρώση να ελέγχεται χωρίς κάδο ή `sharp`. */
export interface ImagePreviewDeps {
  readonly stat: (bucket: Bucket, path: string) => Promise<StorageObjectStat>;
  readonly read: (bucket: Bucket, path: string, generation: string) => Promise<Buffer | null>;
  readonly encode: (original: Buffer, width: number) => Promise<Buffer>;
  readonly cache: BoundedLru<Buffer>;
  readonly queue: PriorityTaskQueue;
  readonly maxQueued: number;
  readonly maxOriginalBytes: number;
}

/** Αποτυχία με όνομα μέσα στην ουρά — ο καλών τη μεταφράζει σε έκβαση. */
class PreviewProductionError extends Error {
  constructor(readonly outcome: 'absent' | 'too-large' | 'undecodable') {
    super(outcome);
    this.name = 'PreviewProductionError';
  }
}

/** Το ETag **είναι** και το κλειδί της μνήμης: ένα αποτύπωμα, μία αλήθεια. */
export function imagePreviewEtag(bucketKey: string, path: string, generation: string, width: number): string {
  const digest = createHash('sha256')
    .update([bucketKey, path, generation, String(width), FILE_PREVIEW_RECIPE].join('\n'))
    .digest('base64url');
  return `"${digest.slice(0, 32)}"`;
}

/** `If-None-Match: W/"a", "b"` ή `*` — RFC 9110 §13.1.2 (ασθενής σύγκριση). */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (ifNoneMatch === null) return false;
  return ifNoneMatch.split(',').some((raw) => {
    const candidate = raw.trim().replace(/^W\//, '');
    return candidate === '*' || candidate === etag;
  });
}

async function produce(deps: ImagePreviewDeps, request: ImagePreviewRequest, generation: string): Promise<Buffer> {
  const original = await deps.read(request.bucket, request.storagePath, generation);
  if (original === null) throw new PreviewProductionError('absent');
  if (original.length > deps.maxOriginalBytes) throw new PreviewProductionError('too-large');
  try {
    return await deps.encode(original, request.width);
  } catch (error) {
    logger.warn('Το αρχείο δεν αποκωδικοποιείται — καμία προεπισκόπηση', {
      storagePath: request.storagePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new PreviewProductionError('undecodable');
  }
}

async function producedOrNamed(
  deps: ImagePreviewDeps,
  request: ImagePreviewRequest,
  generation: string,
  etag: string,
): Promise<ImagePreviewOutcome> {
  try {
    // Μικρότερο πλάτος = πρώτα: οι μικρογραφίες μιας λίστας δεν περιμένουν ένα 2560.
    const bytes = await deps.queue.schedule(etag, { priority: request.width, group: 'preview' }, () =>
      produce(deps, request, generation),
    );
    deps.cache.set(etag, bytes);
    return { kind: 'image', etag, bytes, contentType: RASTER_DERIVATIVE_CONTENT_TYPE };
  } catch (error) {
    if (error instanceof PreviewProductionError) return { kind: error.outcome };
    throw error;
  }
}

/** Φτιάχνει την υπηρεσία πάνω σε δοσμένες εξαρτήσεις (tests) — η παραγωγή χρησιμοποιεί {@link serveImagePreview}. */
export function createImagePreviewService(deps: ImagePreviewDeps) {
  return async function serve(request: ImagePreviewRequest): Promise<ImagePreviewOutcome> {
    const stat = await deps.stat(request.bucket, request.storagePath);
    if (stat.kind === 'absent') return { kind: 'absent' };
    if (!isPreviewableContentType(stat.contentType)) return { kind: 'not-previewable' };
    if (stat.size !== null && stat.size > deps.maxOriginalBytes) return { kind: 'too-large' };

    const etag = imagePreviewEtag(request.bucketKey, request.storagePath, stat.generation, request.width);
    if (etagMatches(request.ifNoneMatch, etag)) return { kind: 'not-modified', etag };

    const cached = deps.cache.get(etag);
    if (cached !== undefined) return { kind: 'image', etag, bytes: cached, contentType: RASTER_DERIVATIVE_CONTENT_TYPE };

    if (deps.queue.stats().queued >= deps.maxQueued) return { kind: 'busy' };
    return producedOrNamed(deps, request, stat.generation, etag);
  };
}

async function encodePreview(original: Buffer, width: number): Promise<Buffer> {
  const derivative = await encodeRasterDerivative(
    decodeOriented(original),
    { fit: 'width', px: width },
    FILE_PREVIEW_ENCODING,
    FILE_PREVIEW_EFFORT,
  );
  return derivative.bytes;
}

/** Η υπηρεσία της διεργασίας — **μία** μνήμη και **μία** ουρά ανά διεργασία Node. */
export const serveImagePreview = createImagePreviewService({
  stat: (bucket, path) => statStorageObject(path, { bucket }),
  read: (bucket, path, generation) => readStorageObjectGeneration(path, generation, { bucket }),
  encode: encodePreview,
  cache: createBoundedLru<Buffer>({ maxWeight: PREVIEW_CACHE_MAX_BYTES, weigh: (bytes) => bytes.length }),
  queue: createPriorityTaskQueue(PREVIEW_ENCODE_CONCURRENCY),
  maxQueued: PREVIEW_MAX_QUEUED,
  maxOriginalBytes: PREVIEW_MAX_ORIGINAL_BYTES,
});
