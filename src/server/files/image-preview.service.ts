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
 * 📐 **ΕΝΑ κλειδί ανά ΠΡΑΓΜΑΤΙΚΟ παράγωγο** (ADR-899 §3.7, Π2): ο κωδικοποιητής δεν μεγεθύνει ποτέ, άρα για πρωτότυπο
 * 1.183 px τα `w=1280` και `w=2560` είναι **τα ίδια** bytes. Το πλάτος κανονικοποιείται (`effectivePreviewWidth`)
 * **πριν** από ETag/304/μνήμη/ουρά. Πηγή πλάτους: το custom metadata **της γενιάς** (δωρεάν, με το stat) → μνήμη
 * διαστάσεων ανά (κάδος·μονοπάτι·**γενιά**), που γεμίζει από το πρωτότυπο που κατεβαίνει **ούτως ή άλλως** — ποτέ
 * ξεχωριστή ανάγνωση, ποτέ αποκωδικοποίηση μόνο για να μετρηθεί. Το ETag μένει δεμένο στη γενιά.
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
  effectivePreviewWidth,
  isPreviewableContentType,
} from '@/lib/files/file-preview-ladder';
import type { ImageDimensions } from '@/lib/images/image-dimensions';
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
import { readImageDimensions } from '@/server/images/image-metadata';
import { FRAMING_AS_GIVEN, shelfRecipe } from '@/services/upload/utils/public-shelf-encoding';

const logger = createModuleLogger('IMAGE_PREVIEW');

/** Πόση μνήμη κρατούν τα έτοιμα παράγωγα. ~150 προεπισκοπήσεις 1280 ή χιλιάδες μικρογραφίες. */
export const PREVIEW_CACHE_MAX_BYTES = 64 * 1024 * 1024;
/** Ταυτόχρονες κωδικοποιήσεις — το `sharp` είναι CPU-δεμένο· παραπάνω απλώς στοιβάζει καθυστέρηση. */
export const PREVIEW_ENCODE_CONCURRENCY = 2;
/** Πόσες γενιές θυμάται η μνήμη διαστάσεων — λίγα bytes η καθεμία. */
export const PREVIEW_DIMENSIONS_MEMO_ENTRIES = 4096;
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
  /** Διαστάσεις θεατή από τα bytes του πρωτοτύπου (μόνο κεφαλίδα) — `null` αν δεν διαβάζονται. */
  readonly measure: (original: Buffer) => Promise<ImageDimensions | null>;
  readonly cache: BoundedLru<Buffer>;
  /** Διαστάσεις ανά (κάδος·μονοπάτι·γενιά) — για αντικείμενα χωρίς metadata (πριν τον trigger / τη συμπλήρωση). */
  readonly dimensions: BoundedLru<ImageDimensions>;
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

type StorageObjectFound = Extract<StorageObjectStat, { readonly kind: 'found' }>;

/** Μία παραγωγή: ποιο αίτημα, ποια γενιά, σε ποιο (κανονικοποιημένο) πλάτος. */
interface PreviewJob {
  readonly request: ImagePreviewRequest;
  readonly generation: string;
  /** Το κανονικοποιημένο πλάτος — ή το ζητούμενο, όταν οι διαστάσεις είναι ακόμη άγνωστες. */
  readonly width: number;
  readonly known: boolean;
}

/** Τι παράχθηκε **και** σε ποιο πλάτος — μπορεί να κατέβηκε από το αίτημα, όταν το πρωτότυπο μετρήθηκε μόλις τώρα. */
interface Produced {
  readonly bytes: Buffer;
  readonly width: number;
}

/** Το κλειδί της μνήμης διαστάσεων — η γενιά μέσα: νέα bytes ⇒ νέα μέτρηση. */
function dimensionsKey(request: ImagePreviewRequest, generation: string): string {
  return [request.bucketKey, request.storagePath, generation].join('\n');
}

/** Το πλάτος που θα παραχθεί — από το metadata της γενιάς ή τη μνήμη διαστάσεων· αλλιώς το ζητούμενο. */
function previewJobOf(deps: ImagePreviewDeps, request: ImagePreviewRequest, stat: StorageObjectFound): PreviewJob {
  const dimensions = stat.dimensions ?? deps.dimensions.get(dimensionsKey(request, stat.generation)) ?? null;
  return {
    request,
    generation: stat.generation,
    width: effectivePreviewWidth(request.width, dimensions?.width),
    known: dimensions !== null,
  };
}

/** Γνωστό πλάτος ⇒ ήδη κανονικό · άγνωστο ⇒ μέτρηση των bytes που κατέβηκαν ούτως ή άλλως (+ απομνημόνευση ανά γενιά). */
async function finalWidthOf(deps: ImagePreviewDeps, job: PreviewJob, original: Buffer): Promise<number> {
  if (job.known) return job.width;
  const measured = await deps.measure(original);
  if (measured === null) return job.width;
  deps.dimensions.set(dimensionsKey(job.request, job.generation), measured);
  return effectivePreviewWidth(job.width, measured.width);
}

async function produce(deps: ImagePreviewDeps, job: PreviewJob): Promise<Produced> {
  const original = await deps.read(job.request.bucket, job.request.storagePath, job.generation);
  if (original === null) throw new PreviewProductionError('absent');
  if (original.length > deps.maxOriginalBytes) throw new PreviewProductionError('too-large');
  const width = await finalWidthOf(deps, job, original);
  try {
    return { bytes: await deps.encode(original, width), width };
  } catch (error) {
    logger.warn('Το αρχείο δεν αποκωδικοποιείται — καμία προεπισκόπηση', {
      storagePath: job.request.storagePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new PreviewProductionError('undecodable');
  }
}

async function producedOrNamed(deps: ImagePreviewDeps, job: PreviewJob, etag: string): Promise<ImagePreviewOutcome> {
  try {
    // Μικρότερο πλάτος = πρώτα: οι μικρογραφίες μιας λίστας δεν περιμένουν ένα 2560.
    const produced = await deps.queue.schedule(etag, { priority: job.width, group: 'preview' }, () => produce(deps, job));
    // Το πλάτος ίσως κανονικοποιήθηκε μόλις μετρήθηκε το πρωτότυπο ⇒ τα bytes ανήκουν στο ΚΑΝΟΝΙΚΟ κλειδί, κι αυτό παίρνει
    // ο browser: το επόμενο `If-None-Match` (πλέον κανονικοποιημένο πριν από κάθε κατέβασμα) ταιριάζει.
    const finalEtag = imagePreviewEtag(job.request.bucketKey, job.request.storagePath, job.generation, produced.width);
    deps.cache.set(finalEtag, produced.bytes);
    return { kind: 'image', etag: finalEtag, bytes: produced.bytes, contentType: RASTER_DERIVATIVE_CONTENT_TYPE };
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

    const job = previewJobOf(deps, request, stat);
    const etag = imagePreviewEtag(request.bucketKey, request.storagePath, stat.generation, job.width);
    if (etagMatches(request.ifNoneMatch, etag)) return { kind: 'not-modified', etag };

    const cached = deps.cache.get(etag);
    if (cached !== undefined) return { kind: 'image', etag, bytes: cached, contentType: RASTER_DERIVATIVE_CONTENT_TYPE };

    if (deps.queue.stats().queued >= deps.maxQueued) return { kind: 'busy' };
    return producedOrNamed(deps, job, etag);
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
  measure: readImageDimensions,
  dimensions: createBoundedLru<ImageDimensions>({ maxWeight: PREVIEW_DIMENSIONS_MEMO_ENTRIES, weigh: () => 1 }),
  cache: createBoundedLru<Buffer>({ maxWeight: PREVIEW_CACHE_MAX_BYTES, weigh: (bytes) => bytes.length }),
  queue: createPriorityTaskQueue(PREVIEW_ENCODE_CONCURRENCY),
  maxQueued: PREVIEW_MAX_QUEUED,
  maxOriginalBytes: PREVIEW_MAX_ORIGINAL_BYTES,
});
