/**
 * =============================================================================
 * FINALIZED OBJECT — ο ΕΝΑΣ προσαρμογέας γεγονότος «νέο αντικείμενο» (ADR-895 Α7 · Φ2)
 * =============================================================================
 *
 * Το gen1 δίνει `ObjectMetadata` (`size: string`), το gen2 `StorageObjectData` (`size: number`). Τα σώματα
 * των handlers δεν ξέρουν γενιά: παίρνουν **αυτό** το ουδέτερο σχήμα, που επιπλέον φέρει τη **θέση** του κάδου.
 *
 * ⛔ **Άγνωστος κάδος ⇒ `null`** (fail-closed, ίδια αρχή με το `fileStoragePlacementOf`). Ένα γεγονός από κάδο
 * που δεν είναι στον κατάλογο θέσεων σημαίνει ότι το binding και ο κατάλογος διαφωνούν (π.χ. `GCS_FILES_EU_BUCKET`
 * στο runtime ≠ όνομα που επιλύθηκε στο deploy). Καμία δουλειά τότε — σφάλμα στα logs, ποτέ μαντεψιά.
 *
 * @module functions/storage/finalized-object
 */

import { logger } from 'firebase-functions/logger';

import {
  fileStoragePlacementOfBucketName,
  type FileStorageBucketNames,
  type FileStoragePlacement,
} from '../generated/lib/files/file-storage-placement';

/** Ό,τι κοινό έχουν τα δύο σχήματα γεγονότος — δομικά, ώστε να δέχεται και τα δύο αυτούσια. */
export interface RawFinalizedObject {
  readonly bucket: string;
  readonly name?: string;
  readonly contentType?: string;
  readonly size?: string | number;
  /** Η γενιά GCS — το gen1 τη δίνει string, το gen2 επίσης· κρατιέται **string** (19ψήφιες γενιές > 2^53). */
  readonly generation?: string | number;
  /** Custom metadata του αντικειμένου (π.χ. οι διαστάσεις του ADR-899 §3.7). */
  readonly metadata?: Readonly<Record<string, string>> | null;
}

export interface FinalizedObject {
  readonly bucket: string;
  readonly placement: FileStoragePlacement;
  readonly name: string | null;
  readonly contentType: string | null;
  /** Bytes, αριθμός — ένα σχήμα στη βάση ανεξάρτητα από γενιά. */
  readonly size: number | null;
  /** Η γενιά που **αυτό** το γεγονός περιγράφει — κάθε ανάγνωση/γραφή που αφορά τα bytes καρφώνεται σε αυτήν. */
  readonly generation: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

function sizeOf(raw: string | number | undefined): number | null {
  if (raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function finalizedObjectOf(raw: RawFinalizedObject, names: FileStorageBucketNames): FinalizedObject | null {
  const placement = fileStoragePlacementOfBucketName(raw.bucket, names);
  if (placement === null) {
    logger.error('Storage finalize: event from an undeclared bucket — ignored (ADR-895 Α7)', {
      bucket: raw.bucket,
      name: raw.name,
    });
    return null;
  }
  return {
    bucket: raw.bucket,
    placement,
    name: raw.name ?? null,
    contentType: raw.contentType ?? null,
    size: sizeOf(raw.size),
    generation: raw.generation === undefined ? null : String(raw.generation),
    metadata: raw.metadata ?? {},
  };
}
