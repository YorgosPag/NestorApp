import 'server-only';

/**
 * @fileoverview **ΣΕ ΠΟΙΟΝ ΚΑΔΟ ΖΟΥΝ ΤΑ BYTES ΑΥΤΟΥ ΤΟΥ ΑΡΧΕΙΟΥ** — ο ΕΝΑΣ επιλογέας (ADR-895 Α2).
 * @related `lib/files/file-storage-placement` (λεξιλόγιο + καθαρός κριτής) · `config/gcs-buckets` (ονόματα) ·
 *          `lib/firebaseAdmin` (accessors) · `server/spatial-tour/tour-media-store` (το ίδιο σχήμα για τα **παράγωγα**)
 * @module server/files/file-record-bucket
 *
 * 🔑 Όποιος αγγίζει bytes `FileRecord` (λήψη, ροή, signed URL, purge, hold, backup, σάρωση) ρωτά **εδώ** με την εγγραφή.
 * ⛔ Κανένα `getAdminBucket()` για bytes `FileRecord` έξω από αυτό το αρχείο (ADR-895 Α10): σήμερα όλοι «μαντεύουν»
 * σωστά μόνο επειδή υπάρχει ένας κάδος — η πρώτη εγγραφή στην ΕΕ θα έκανε κάθε μαντεψιά σιωπηλό 404.
 */

import type { Bucket } from '@google-cloud/storage';

import { GCS_FILES_EU_BUCKET } from '@/config/gcs-buckets';
import {
  FILE_STORAGE_PLACEMENTS,
  fileStoragePlacementOf,
  fileStoragePlacementOfBucketName,
  type FileStorageBucketNames,
  type FileStoragePlacement,
  type FileStoragePlacementSubject,
} from '@/lib/files/file-storage-placement';
import { getAdminBucket, getFilesEuBucket } from '@/lib/firebaseAdmin';

/** Ο κάδος μιας **θέσης** — για όποιον ξέρει ήδη τη θέση (μετάβαση, απαρίθμηση καταλόγου). */
export function fileStorageBucket(placement: FileStoragePlacement): Bucket {
  return placement === 'eu-originals' ? getFilesEuBucket() : getAdminBucket();
}

/** Ο κάδος των bytes **αυτής** της εγγραφής. Άγνωστη θέση ⇒ πετά (ποτέ σιωπηλό «κανονικός»). */
export function fileRecordBucket(record: FileStoragePlacementSubject): Bucket {
  return fileStorageBucket(fileStoragePlacementOf(record));
}

/** Τα ονόματα κάδων ανά θέση — για κριτές που συγκρίνουν **ονόματα** (SSRF, manifest). */
export function fileStorageBucketNames(): FileStorageBucketNames {
  return { 'legacy-default': getAdminBucket().name, 'eu-originals': GCS_FILES_EU_BUCKET };
}

/** Η θέση ενός ονόματος κάδου — `null` ⇒ **ξένος** κάδος (δεν κρατά ποτέ πρωτότυπα). */
export function fileStoragePlacementOfBucket(bucketName: string): FileStoragePlacement | null {
  return fileStoragePlacementOfBucketName(bucketName, fileStorageBucketNames());
}

/**
 * **Ο κατάλογος**: κάθε κάδος που **μπορεί** να κρατά πρωτότυπα (ADR-895 Α6). Backup/restore, σαρώσεις προθέματος
 * και ορφανά **απαριθμούν αυτόν** — ποτέ «τον κάδο».
 */
export function originalStorageBuckets(): ReadonlyArray<OriginalStorageBucket> {
  return FILE_STORAGE_PLACEMENTS.map((placement) => ({ placement, bucket: fileStorageBucket(placement) }));
}

export interface OriginalStorageBucket {
  readonly placement: FileStoragePlacement;
  readonly bucket: Bucket;
}

export interface ProvisionedOriginalBuckets {
  readonly provisioned: readonly OriginalStorageBucket[];
  /** Δηλωμένες θέσεις χωρίς κάδο ακόμη (π.χ. ΕΕ πριν την προμήθεια της Φ1) — **δεν** είναι σφάλμα για σάρωση. */
  readonly notProvisioned: readonly FileStoragePlacement[];
}

/**
 * **Ο κατάλογος, όσος υπάρχει** — για σαρώσεις προθέματος και απαριθμήσεις. Κάδος που δεν έχει προμηθευτεί ⇒
 * `notProvisioned` (τίποτα να σαρωθεί εκεί). ⛔ Αποτυχία του **ίδιου του ελέγχου** ⇒ πετά: ένα «δεν ξέρω» που
 * γίνεται «δεν υπάρχει» θα άφηνε bytes ασάρωτα σε διαγραφή GDPR.
 */
export async function provisionedOriginalStorageBuckets(): Promise<ProvisionedOriginalBuckets> {
  const checked = await Promise.all(
    originalStorageBuckets().map(async (entry) => ({ entry, exists: (await entry.bucket.exists())[0] })),
  );
  return {
    provisioned: checked.filter((c) => c.exists).map((c) => c.entry),
    notProvisioned: checked.filter((c) => !c.exists).map((c) => c.entry.placement),
  };
}
