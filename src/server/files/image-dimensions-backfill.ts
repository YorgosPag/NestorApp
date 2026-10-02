import 'server-only';

/**
 * @fileoverview 📐 **ΣΥΜΠΛΗΡΩΣΗ ΔΙΑΣΤΑΣΕΩΝ ΓΙΑ ΤΙΣ ΥΠΑΡΧΟΥΣΕΣ ΕΙΚΟΝΕΣ** — ό,τι ανέβηκε πριν από τον trigger (ADR-899 §3.7).
 * @module server/files/image-dimensions-backfill
 * @related app/api/admin/backfill-image-dimensions (ο ΜΟΝΟΣ καλών) · functions/storage/image-dimensions-onfinalize
 *          (ίδιος πυρήνας `lib/images/stored-image-dimensions`, ίδια ετυμηγορία — μόνο το I/O διαφέρει)
 *
 * 🔑 **Ιδεμπότητη, μόνο όπου λείπει**: εγγραφή με έγκυρες διαστάσεις δεν διαβάζεται καν. **`storagePlacement`-aware**:
 *   ο κάδος από το `fileRecordBucket` (ADR-895) — άγνωστη θέση ⇒ ονομασμένη παράλειψη, ποτέ μαντεψιά.
 * 🔑 **Πρώτα το metadata του αντικειμένου**: αν ο trigger πρόλαβε να μετρήσει (εγγραφή που γράφτηκε **μετά** το
 *   ανέβασμα), η μέτρηση **δεν** ξαναγίνεται — αντιγράφεται.
 * ⛔ **Γράφει στην παραγωγή** ⇒ τρέχει μόνο με ρητή εντολή (POST)· το GET μετρά και αναφέρει χωρίς καμία γραφή.
 */

import type { Bucket } from '@google-cloud/storage';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import {
  imageDimensionsOf,
  imageDimensionsToMetadata,
  isRasterImageContentType,
  type ImageDimensions,
} from '@/lib/images/image-dimensions';
import { dimensionsRecordVerdict, probeImageDimensions, type DimensionsRecordVerdict } from '@/lib/images/stored-image-dimensions';
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
}

/** Η έκβαση **ανά εγγραφή** — κλειστό σύνολο, για την αναφορά. */
export type ImageDimensionsBackfillOutcome =
  | DimensionsRecordVerdict
  | 'not-measurable'
  | 'absent'
  | 'unknown-placement'
  | 'generation-changed';

/** Χρειάζεται μέτρηση; raster · με μονοπάτι · χωρίς έγκυρες διαστάσεις. */
export function needsImageDimensions(record: BackfillCandidate): boolean {
  return (
    isRasterImageContentType(record.contentType) &&
    typeof record.storagePath === 'string' &&
    record.storagePath.length > 0 &&
    imageDimensionsOf(record.imageDimensions) === null
  );
}

interface Measured {
  readonly kind: 'measured';
  readonly dimensions: ImageDimensions;
  /** Ήρθε από το metadata της γενιάς (ο trigger πρόλαβε) ⇒ καμία γραφή στο αντικείμενο. */
  readonly fromMetadata: boolean;
  readonly generation: string;
  readonly bucket: Bucket;
}

type Measurement = Measured | { readonly kind: 'absent' | 'not-measurable' | 'unknown-placement' };

/** Οι διαστάσεις της **τρέχουσας** γενιάς — από το metadata αν υπάρχουν, αλλιώς από την κεφαλίδα. */
async function measure(path: string, record: BackfillCandidate): Promise<Measurement> {
  let bucket: Bucket;
  try {
    bucket = fileRecordBucket(record);
  } catch {
    return { kind: 'unknown-placement' };
  }
  const stat = await statStorageObject(path, { bucket });
  if (stat.kind === 'absent') return { kind: 'absent' };
  if (stat.dimensions !== null) return { kind: 'measured', dimensions: stat.dimensions, fromMetadata: true, generation: stat.generation, bucket };
  const dimensions = await probeImageDimensions(
    {
      size: stat.size,
      readHeader: (byteCount) => readStorageObjectGeneration(path, stat.generation, { bucket, range: { start: 0, end: byteCount - 1 } }),
      readWhole: () => readStorageObjectGeneration(path, stat.generation, { bucket }),
    },
    readImageMetadata,
  );
  return dimensions === null
    ? { kind: 'not-measurable' }
    : { kind: 'measured', dimensions, fromMetadata: false, generation: stat.generation, bucket };
}

/** Η εγγραφή — transaction, η ΙΔΙΑ ετυμηγορία με τον trigger (δείχνει ακόμη αυτό το αντικείμενο;). */
async function recordDimensions(db: Firestore, ref: DocumentReference, path: string, dimensions: ImageDimensions): Promise<DimensionsRecordVerdict> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const verdict = dimensionsRecordVerdict(snap.exists ? (snap.data() ?? {}) : null, path, dimensions);
    if (verdict === 'write') tx.update(ref, { imageDimensions: dimensions });
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
    const write = await writeStorageObjectMetadataIfGeneration(path, measured.generation, imageDimensionsToMetadata(measured.dimensions), {
      bucket: measured.bucket,
    });
    if (write === 'generation-changed') return 'generation-changed';
  }
  return recordDimensions(db, ref, path, measured.dimensions);
}
