import 'server-only';

/**
 * @fileoverview **Ο ΨΗΣΤΗΣ ΤΟΥ TILESET** — πρωτότυπο λήψης → πλακίδια στο `tour-tiles/{tourId}/…` → `ready` (ADR-884 Φ2α · §4.9).
 * @related `tour-tileset-render.ts` (ο υπολογισμός) · `tour-tileset-state.ts` (η μετάβαση) · `tour-capture-finalize.ts`
 *   (γεννά τη λήψη `pending`) · `app/api/.../uploads/finalize/route.ts` (το κύριο έναυσμα, `after`) ·
 *   `lib/cron/jobs/tour-tileset-bake.job.ts` (το δίχτυ) · `app/api/.../media/[...path]/route.ts` (ο αναγνώστης)
 * @module server/spatial-tour/tour-tileset-baker
 *
 * 🔑 **Δύο εναύσματα, ένας ψήστης** (belt + suspenders): αμέσως μετά την ολοκλήρωση (`after`) και ένα cron-δίχτυ για ό,τι
 * έμεινε `pending` (επανεκκίνηση διακομιστή στη μέση). Ιδεμπότητο: η διαδρομή φέρει το **hash** — δεύτερο ψήσιμο γράφει
 * τα **ίδια** bytes στα **ίδια** ονόματα, και η μετάβαση γράφεται μόνο από `pending` με το ίδιο hash.
 * 🔑 **Ένα ψήσιμο τη φορά ανά διεργασία**: ένα 8K πανόραμα είναι ~100 MB ωμό· δύο ταυτόχρονα ανεβάσματα δεν διπλασιάζουν
 * τη μνήμη — μπαίνουν σε ουρά.
 * 🔒 **Θόλωμα (Φ2ζ · Α8)**: επαληθεύει τα bytes με το hash του **πρωτοτύπου** (`originalHashOf`) αλλά γράφει στο **κλειδί** του
 * tileset (πρωτότυπο + περιοχές)· σβήνει πρώτα τα αποσυρμένα κλειδιά, και ό,τι έψησε για κλειδί που στο μεταξύ άλλαξε.
 * 🔒 **Σάρωση προσώπων ΠΡΙΝ από κάθε δημοσίευση (Φ2ζ ζ4)**: η αποκωδικοποίηση γίνεται μία φορά· αν η λήψη δεν σαρώθηκε από την
 * τρέχουσα έκδοση του ανιχνευτή, σαρώνεται, ο ΕΝΑΣ γραφέας γράφει τις `auto` περιοχές (νέο κλειδί) και το ψήσιμο γίνεται **στο
 * νέο κλειδί**. Το σκέτο πρωτότυπο δεν ψήνεται ποτέ όταν βρέθηκαν πρόσωπα. Σφάλμα ανιχνευτή ⇒ `deferred` (ποτέ «ψήσε χωρίς
 * σάρωση»)· άλλαξε το κλειδί στο μεταξύ ⇒ `superseded` (το ψήνει το έναυσμα εκείνης της αλλαγής).
 * 🔑 **Αποτυχία ≠ προσωρινό σφάλμα**: ό,τι δεν αποκωδικοποιείται ή δεν ταιριάζει με το hash του ⇒ `failed` (ξαναδοκιμή
 * δεν θα βοηθήσει)· σφάλμα αποθήκευσης/δικτύου ⇒ μένει `pending` και το ξαναπιάνει το δίχτυ.
 */

import { createHash } from 'node:crypto';

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import { tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { TOUR_FACE_DETECTOR_VERSION } from '@/constants/spatial-tour-vocabulary';
import type { RawImage } from '@/lib/spatial-tour/tileset/equirect-to-cube';
import { originalHashOf, redactionsOf } from '@/lib/spatial-tour/tour-redaction-edit';
import { TOUR_TILE_CONTENT_TYPE } from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { tourMediaObjectPath } from '@/lib/spatial-tour/tour-media-path';
import { createModuleLogger } from '@/lib/telemetry';
import { isRecord } from '@/lib/type-guards';
import { custodyKindOfScope, custodyScopeFromData } from '@/lib/workspace/custody-scope';
import type { TourCapture, TourCaptureTileset, TourRedactionRegion } from '@/types/spatial-tour';

import { scanFaces } from './tour-face-scan';
import { recordFaceScan } from './tour-graph-write';
import { decodeEquirect, renderTileset, type TilesetObject } from './tour-tileset-render';
import { transitionTileset, type TilesetTransitionOutcome } from './tour-tileset-state';

const logger = createModuleLogger('tour-tileset-baker');

/** Ταυτόχρονα ανεβάσματα πλακιδίων. */
const UPLOAD_CONCURRENCY = 8;
/** Τα πλακίδια είναι αμετάβλητα (η διαδρομή φέρει hash + έκδοση διάταξης). */
const TILE_CACHE_CONTROL = 'private, max-age=31536000, immutable';

export type TourTilesetBakeOutcome =
  | { readonly kind: 'baked'; readonly faceSize: number; readonly objects: number; readonly transition: TilesetTransitionOutcome }
  | { readonly kind: 'skipped'; readonly reason: 'missing' | 'not-pending' | 'superseded' }
  | { readonly kind: 'failed'; readonly reason: 'original-missing' | 'hash-mismatch' | 'undecodable' }
  | { readonly kind: 'deferred'; readonly error: string };

export class PermanentBakeFailure extends Error {
  constructor(readonly reason: 'original-missing' | 'hash-mismatch' | 'undecodable') {
    super(reason);
  }
}

/** Η διαδρομή αποθήκευσης του πρωτοτύπου — από το `FileRecord` του διαμερίσματος της περιήγησης. */
async function originalStoragePath(db: Firestore, tourRef: DocumentReference, fileId: string): Promise<string> {
  const tourSnap = await tourRef.get();
  const custody = tourSnap.exists ? custodyScopeFromData(tourSnap.data() ?? {}) : null;
  if (custody === null) throw new PermanentBakeFailure('original-missing');
  const fileSnap = await db.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope(custody)]]).doc(fileId).get();
  const record = fileSnap.data();
  if (!isRecord(record) || typeof record.storagePath !== 'string') throw new PermanentBakeFailure('original-missing');
  return record.storagePath;
}

async function readOriginal(storagePath: string, contentHash: string): Promise<Buffer> {
  const object = getAdminBucket().file(storagePath);
  const [exists] = await object.exists();
  if (!exists) throw new PermanentBakeFailure('original-missing');
  const [bytes] = await object.download();
  if (createHash('sha256').update(bytes).digest('hex') !== contentHash) throw new PermanentBakeFailure('hash-mismatch');
  return bytes;
}

async function uploadObject(tourId: string, object: TilesetObject): Promise<void> {
  const path = tourMediaObjectPath(tourId, object.segments);
  if (path === null) throw new Error(`Tileset path rejected: ${object.segments.join('/')}`);
  await getAdminBucket().file(path).save(object.body, {
    contentType: TOUR_TILE_CONTENT_TYPE,
    resumable: false,
    metadata: { cacheControl: TILE_CACHE_CONTROL },
  });
}

/**
 * **Τα bytes του πρωτοτύπου μιας λήψης**, επαληθευμένα με το hash του (`originalHashOf`) — ο ψήστης και το backfill της σάρωσης
 * προσώπων (ζ4) διαβάζουν από τον ΙΔΙΟ δρόμο. Πετά `PermanentBakeFailure` όταν λείπει ή δεν ταιριάζει.
 */
export async function loadCaptureOriginal(db: Firestore, tourRef: DocumentReference, capture: TourCapture): Promise<Buffer> {
  const original = originalHashOf(capture);
  if (original === null) throw new PermanentBakeFailure('original-missing');
  return readOriginal(await originalStoragePath(db, tourRef, capture.originalFileId), original);
}

/** Ανεβάζει τη ροή σε δέσμες — ο υπολογισμός της επόμενης δέσμης περιμένει την προηγούμενη (φραγμένη μνήμη). */
async function uploadAll(tourId: string, objects: AsyncIterable<TilesetObject>): Promise<number> {
  let count = 0;
  let batch: TilesetObject[] = [];
  for await (const object of objects) {
    batch.push(object);
    if (batch.length === UPLOAD_CONCURRENCY) {
      await Promise.all(batch.map((o) => uploadObject(tourId, o)));
      count += batch.length;
      batch = [];
    }
  }
  await Promise.all(batch.map((o) => uploadObject(tourId, o)));
  return count + batch.length;
}

/** Ό,τι δεν αποκωδικοποιείται (ή δεν αποδίδεται) δεν θα γίνει ποτέ πλακίδια ⇒ `failed`, όχι ξαναδοκιμή. */
async function undecodableOnError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch {
    throw new PermanentBakeFailure('undecodable');
  }
}

/** Σε ποιο κλειδί, με ποιες περιοχές, ψήνεται η λήψη — μετά τη σάρωση προσώπων. `null` ⇒ άλλαξε στο μεταξύ (`superseded`). */
interface BakeTarget {
  readonly key: string;
  readonly regions: readonly TourRedactionRegion[];
}

/**
 * **Σάρωσε πριν ψήσεις** (ζ4) — εκτός αν η λήψη σαρώθηκε ήδη από αυτή την έκδοση (ό,τι έσβησε μετά ο άνθρωπος μένει σβησμένο).
 * Σφάλμα του ανιχνευτή **πετά** ⇒ `deferred`: το δίχτυ ξαναδοκιμάζει, το σημείο μένει κρυφό.
 */
async function scannedTarget(db: Firestore, captureRef: DocumentReference, capture: TourCapture, key: string, decoded: RawImage): Promise<BakeTarget | null> {
  if (capture.faceScan?.version === TOUR_FACE_DETECTOR_VERSION) return { key, regions: redactionsOf(capture) };
  const faces = await scanFaces(decoded).catch((error: unknown) => {
    logger.error('Σάρωση προσώπων απέτυχε — το ψήσιμο αναβάλλεται (fail-closed)', { captureId: captureRef.id, error: getErrorMessage(error) });
    throw error;
  });
  const outcome = await recordFaceScan(db, captureRef, { expectedKey: key, faces });
  if (outcome.kind === 'superseded') return null;
  const { scan } = outcome;
  if (scan.saturated) logger.warn('Σάρωση προσώπων: δεν χώρεσαν όλα τα πρόσωπα — χρειάζεται ματιά', { captureId: captureRef.id, faces: scan.faces });
  logger.info('Σάρωση προσώπων', { captureId: captureRef.id, faces: scan.faces, added: scan.added, rekeyed: outcome.key !== key });
  return { key: outcome.key, regions: outcome.redactions };
}

/** **Σβήσε όλα τα πλακίδια ενός κλειδιού** — ιδεμπότητο (ανύπαρκτο πρόθεμα = τίποτα). */
async function deleteTilesetKey(tourId: string, key: string): Promise<void> {
  const prefix = tourMediaObjectPath(tourId, [key]);
  if (prefix === null) throw new Error(`Tileset key rejected: ${key}`);
  await getAdminBucket().deleteFiles({ prefix: `${prefix}/` });
}

/**
 * **Τα αποσυρμένα κλειδιά φεύγουν ΠΡΙΝ ψηθεί το νέο** (Φ2ζ): δείχνουν ό,τι ζητήθηκε να κρυφτεί. Σφάλμα εδώ ⇒ `deferred` — η
 * λήψη μένει `pending` με τη λίστα, και το δίχτυ ξαναδοκιμάζει· η λίστα αδειάζει **μόνο** με τη μετάβαση σε `ready`.
 */
async function deleteRetired(tourId: string, tileset: TourCaptureTileset): Promise<void> {
  const retired = (tileset.retiredKeys ?? []).filter((key) => key !== tileset.contentHash);
  await Promise.all(retired.map((key) => deleteTilesetKey(tourId, key)));
}

/**
 * Ψήθηκε κλειδί που **δεν είναι πια** το τρέχον (άλλαξε το θόλωμα ενώ έψηνε) ⇒ τα πλακίδια που μόλις ανέβηκαν είναι ορφανά και
 * ίσως δείχνουν ό,τι κρύφτηκε μετά ⇒ σβήνονται εδώ, όχι «κάποτε».
 */
async function discardIfSuperseded(tourId: string, key: string, transition: TilesetTransitionOutcome): Promise<void> {
  if (transition === 'hash-changed') await deleteTilesetKey(tourId, key);
}

async function bakeNow(db: Firestore, captureRef: DocumentReference): Promise<TourTilesetBakeOutcome> {
  const snap = await captureRef.get();
  const capture = snap.exists ? tourCaptureFromDocument(snap.data(), captureRef.id) : null;
  if (capture === null) return { kind: 'skipped', reason: 'missing' };
  const hash = capture.tileset.contentHash;
  if (capture.tileset.state !== 'pending' || hash === null || originalHashOf(capture) === null) return { kind: 'skipped', reason: 'not-pending' };
  const tourRef = captureRef.parent.parent;
  if (tourRef === null) return { kind: 'skipped', reason: 'missing' };
  let key = hash;
  try {
    await deleteRetired(tourRef.id, capture.tileset);
    const bytes = await loadCaptureOriginal(db, tourRef, capture);
    const decoded = await undecodableOnError(() => decodeEquirect(bytes));
    const target = await scannedTarget(db, captureRef, capture, hash, decoded);
    if (target === null) return { kind: 'skipped', reason: 'superseded' };
    key = target.key;
    const rendered = await undecodableOnError(() => renderTileset(decoded, target.key, target.regions));
    const objects = await uploadAll(tourRef.id, rendered.objects);
    const transition = await transitionTileset(db, captureRef, key, { to: 'ready', faceSize: rendered.faceSize });
    await discardIfSuperseded(tourRef.id, key, transition);
    logger.info('Tileset ψήθηκε', { captureId: captureRef.id, faceSize: rendered.faceSize, objects, transition });
    return { kind: 'baked', faceSize: rendered.faceSize, objects, transition };
  } catch (error: unknown) {
    if (!(error instanceof PermanentBakeFailure)) {
      logger.warn('Ψήσιμο αναβλήθηκε — θα το ξαναπιάσει το δίχτυ', { captureId: captureRef.id, error: getErrorMessage(error) });
      return { kind: 'deferred', error: getErrorMessage(error) };
    }
    await transitionTileset(db, captureRef, key, { to: 'failed' });
    logger.error('Tileset απέτυχε', { captureId: captureRef.id, reason: error.reason });
    return { kind: 'failed', reason: error.reason };
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** **Ψήσε μια λήψη** — σε σειρά με κάθε άλλο ψήσιμο αυτής της διεργασίας. Δεν πετά ποτέ. */
export function bakeTourTileset(db: Firestore, captureRef: DocumentReference): Promise<TourTilesetBakeOutcome> {
  const run = queue.then(() => bakeNow(db, captureRef)).catch((error: unknown): TourTilesetBakeOutcome => {
    logger.error('Ψήσιμο: απρόσμενο σφάλμα', { captureId: captureRef.id, error: getErrorMessage(error) });
    return { kind: 'deferred', error: getErrorMessage(error) };
  });
  queue = run;
  return run;
}
