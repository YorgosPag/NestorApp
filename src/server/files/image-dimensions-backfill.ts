import 'server-only';

/**
 * @fileoverview 📐 **ΣΥΜΠΛΗΡΩΣΗ ΔΙΑΣΤΑΣΕΩΝ ΚΑΙ ΧΡΩΜΑΤΟΣ ΓΙΑ ΤΙΣ ΥΠΑΡΧΟΥΣΕΣ ΕΙΚΟΝΕΣ** — ό,τι ανέβηκε πριν από τον trigger
 *   (ADR-899 §3.7) ή πριν μετριέται το χρώμα (ADR-923 §5.10.3).
 * @module server/files/image-dimensions-backfill
 * @related app/api/admin/backfill-image-dimensions (HTTP) · functions/storage/image-dimensions-onfinalize
 *          (ίδιος πυρήνας `lib/images/stored-image-dimensions`, ίδια ετυμηγορία — μόνο το I/O διαφέρει)
 *
 * 🔑 **Ιδεμπότητη, μόνο όπου λείπει**: εγγραφή με έγκυρες διαστάσεις δεν διαβάζεται καν. **`storagePlacement`-aware**:
 *   ο κάδος από το `fileRecordBucket` (ADR-895) — άγνωστη θέση ⇒ ονομασμένη παράλειψη, ποτέ μαντεψιά.
 * 🔑 **Πρώτα το metadata του αντικειμένου**: αν ο trigger πρόλαβε να μετρήσει (εγγραφή που γράφτηκε **μετά** το
 *   ανέβασμα), η μέτρηση **δεν** ξαναγίνεται — αντιγράφεται. Το χρώμα **δεν** ζει στο metadata του αντικειμένου: εγγραφή
 *   χωρίς `imageColour` διαβάζει την κεφαλίδα ούτως ή άλλως.
 * ⛔ **Γράφει στην παραγωγή** ⇒ τρέχει μόνο με ρητή εντολή (POST)· το GET μετρά και αναφέρει χωρίς καμία γραφή.
 */

import type { Bucket } from '@google-cloud/storage';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { BATCH_SIZE_READ, processAdminBatch } from '@/lib/admin-batch-utils';
import { getErrorMessage } from '@/lib/error-utils';
import {
  imageDimensionsOf,
  imageDimensionsToMetadata,
  isRasterImageContentType,
} from '@/lib/images/image-dimensions';
import {
  dimensionsRecordVerdict,
  imageFactsRecordUpdate,
  probeImageRaster,
  type DimensionsRecordVerdict,
  type ImageRasterFacts,
} from '@/lib/images/stored-image-dimensions';
import {
  readStorageObjectGeneration,
  statStorageObject,
  writeStorageObjectMetadataIfGeneration,
} from '@/lib/storage/storage-object-stream';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { readImageMetadata } from '@/server/images/image-metadata';

/** Ό,τι διαβάζει η συμπλήρωση από μια εγγραφή — δομικό. */
export interface BackfillCandidate {
  readonly storagePath?: unknown;
  readonly storagePlacement?: unknown;
  readonly contentType?: unknown;
  readonly imageDimensions?: unknown;
  readonly imageColour?: unknown;
}

/** Η έκβαση **ανά εγγραφή** — κλειστό σύνολο, για την αναφορά. */
export type ImageDimensionsBackfillOutcome =
  | DimensionsRecordVerdict
  | 'not-measurable'
  | 'absent'
  | 'unknown-placement'
  | 'generation-changed';

/** Χρειάζεται μέτρηση; raster · με μονοπάτι · χωρίς έγκυρες διαστάσεις **ή** χωρίς χρώμα. */
export function needsImageMeasurement(record: BackfillCandidate): boolean {
  return (
    isRasterImageContentType(record.contentType) &&
    typeof record.storagePath === 'string' &&
    record.storagePath.length > 0 &&
    (imageDimensionsOf(record.imageDimensions) === null || !hasRecordedColour(record))
  );
}

function hasRecordedColour(record: BackfillCandidate): boolean {
  return record.imageColour !== null && typeof record.imageColour === 'object';
}

interface Measured {
  readonly kind: 'measured';
  readonly facts: ImageRasterFacts;
  /** Ήρθε από το metadata της γενιάς (ο trigger πρόλαβε) ⇒ καμία γραφή στο αντικείμενο. */
  readonly fromMetadata: boolean;
  readonly generation: string;
  readonly bucket: Bucket;
}

type Measurement = Measured | { readonly kind: 'absent' | 'not-measurable' | 'unknown-placement' };

/**
 * Η μέτρηση της **τρέχουσας** γενιάς — οι διαστάσεις από το metadata αν υπάρχουν **και** η εγγραφή έχει ήδη χρώμα·
 * αλλιώς από την κεφαλίδα (μία ανάγνωση δίνει και τα δύο).
 */
async function measure(path: string, record: BackfillCandidate): Promise<Measurement> {
  let bucket: Bucket;
  try {
    bucket = fileRecordBucket(record);
  } catch {
    return { kind: 'unknown-placement' };
  }
  const stat = await statStorageObject(path, { bucket });
  if (stat.kind === 'absent') return { kind: 'absent' };
  const fromMetadata = stat.dimensions !== null;
  if (stat.dimensions !== null && hasRecordedColour(record)) {
    return { kind: 'measured', facts: { dimensions: stat.dimensions, colour: null }, fromMetadata, generation: stat.generation, bucket };
  }
  const facts = await probeImageRaster(
    {
      size: stat.size,
      readHeader: (byteCount) => readStorageObjectGeneration(path, stat.generation, { bucket, range: { start: 0, end: byteCount - 1 } }),
      readWhole: () => readStorageObjectGeneration(path, stat.generation, { bucket }),
    },
    readImageMetadata,
  );
  return facts === null
    ? { kind: 'not-measurable' }
    : { kind: 'measured', facts, fromMetadata, generation: stat.generation, bucket };
}

/** Η εγγραφή — transaction, η ΙΔΙΑ ετυμηγορία με τον trigger (δείχνει ακόμη αυτό το αντικείμενο;). */
async function recordDimensions(db: Firestore, ref: DocumentReference, path: string, facts: ImageRasterFacts): Promise<DimensionsRecordVerdict> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const verdict = dimensionsRecordVerdict(snap.exists ? (snap.data() ?? {}) : null, path, facts);
    if (verdict === 'write') tx.update(ref, imageFactsRecordUpdate(facts));
    return verdict;
  });
}

/**
 * **Μία εγγραφή.** `dryRun` ⇒ μέτρηση και ετυμηγορία, **καμία** γραφή (ούτε στο αντικείμενο). Ποτέ δεν πετά για «κακό
 * αρχείο» — μόνο για βλάβη υποδομής, που ο καλών καταγράφει ανά εγγραφή.
 */
export async function backfillImageDimensions(
  db: Firestore,
  ref: DocumentReference,
  record: BackfillCandidate,
  dryRun: boolean,
): Promise<ImageDimensionsBackfillOutcome> {
  const path = record.storagePath as string;
  const measured = await measure(path, record);
  if (measured.kind !== 'measured') return measured.kind;
  if (dryRun) return 'write';
  if (!measured.fromMetadata) {
    const write = await writeStorageObjectMetadataIfGeneration(path, measured.generation, imageDimensionsToMetadata(measured.facts.dimensions), {
      bucket: measured.bucket,
    });
    if (write === 'generation-changed') return 'generation-changed';
  }
  return recordDimensions(db, ref, path, measured.facts);
}

/** Πόσα σφάλματα κρατά η αναφορά — τα υπόλοιπα μετριούνται μόνο. */
const MAX_REPORTED_ERRORS = 50;

/** Η αναφορά ανά συλλογή. */
export interface ImageDimensionsBackfillTally {
  readonly collection: string;
  scanned: number;
  candidates: number;
  readonly outcomes: Partial<Record<ImageDimensionsBackfillOutcome, number>>;
  failed: number;
  readonly errors: string[];
}

async function backfillCollection(db: Firestore, collection: string, dryRun: boolean): Promise<ImageDimensionsBackfillTally> {
  const tally: ImageDimensionsBackfillTally = { collection, scanned: 0, candidates: 0, outcomes: {}, failed: 0, errors: [] };
  await processAdminBatch(db.collection(collection).orderBy('__name__'), BATCH_SIZE_READ, async (docs) => {
    tally.scanned += docs.length;
    // Σειριακά: λίγες δεκάδες εικόνες, και κάθε μία = 1 stat + 128 KiB — καμία πίεση στον κάδο ή στη μνήμη.
    for (const doc of docs) {
      const record = doc.data();
      if (!needsImageMeasurement(record)) continue;
      tally.candidates += 1;
      try {
        const outcome = await backfillImageDimensions(db, doc.ref, record, dryRun);
        tally.outcomes[outcome] = (tally.outcomes[outcome] ?? 0) + 1;
      } catch (error) {
        tally.failed += 1;
        if (tally.errors.length < MAX_REPORTED_ERRORS) tally.errors.push(`${doc.id}: ${getErrorMessage(error)}`);
      }
    }
  });
  return tally;
}

/**
 * **Όλη η συμπλήρωση** — τα δύο διαμερίσματα αρχείων (ADR-866 §5.2), ίδια λογική, ίδια ετυμηγορία. Ο ΕΝΑΣ βρόχος: τον
 * καλούν το admin route (HTTP, super_admin) και ο τοπικός runner με Admin SDK — κανένα αντίγραφο.
 */
export async function runImageDimensionsBackfill(db: Firestore, dryRun: boolean): Promise<ImageDimensionsBackfillTally[]> {
  return [
    await backfillCollection(db, COLLECTIONS.FILES, dryRun),
    await backfillCollection(db, COLLECTIONS.FILES_PERSONAL, dryRun),
  ];
}
