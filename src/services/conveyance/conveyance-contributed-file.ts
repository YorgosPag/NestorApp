/**
 * =============================================================================
 * «Μπορεί ΑΥΤΟ το αρχείο να σταλεί σε ΑΥΤΗ τη γραμμή;» — η ΜΙΑ κρίση (ADR-901 Φ4.4 · Φ4.5)
 * =============================================================================
 *
 * Τη ρωτούν **δύο**: ο γραφέας του transmittal (πριν γράψει) και ο συλλέκτης τεκμηρίων (πριν δείξει στον συντάκτη
 * «Στείλε τη νέα έκδοση», Α28). Αν ρωτούσαν δύο διαφορετικές κρίσεις, το κουμπί θα εμφανιζόταν για έκδοση που ο
 * γραφέας μετά αρνείται — κουμπί που ψεύδεται.
 *
 * Δικό μου · όχι στον κάδο · έτοιμο · αυτής της υπόθεσης · του σκοπού της γραμμής · με bytes. Οτιδήποτε άλλο ⇒ `null`
 * (ίδιο με το ανύπαρκτο — κανένα μαντείο ύπαρξης).
 *
 * **Layering**: καθαρό — δέχεται είτε ωμό έγγραφο Firestore είτε κανονικοποιημένο `FileRecord` (ίδια ονόματα πεδίων).
 *
 * @module services/conveyance/conveyance-contributed-file
 */

import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import { fileFingerprint } from '@/lib/conveyance/evidence-match';
import { normalizeToISO } from '@/lib/date-local';
import type { ContributionFile } from '@/types/conveyance-contribution';

/** Τα πεδία που κρίνονται — `unknown`, γιατί έρχονται από τον δίσκο και ελέγχονται εδώ. */
export interface SendableFileFields {
  readonly userId?: unknown;
  readonly isDeleted?: unknown;
  readonly status?: unknown;
  readonly entityType?: unknown;
  readonly entityId?: unknown;
  readonly purpose?: unknown;
  readonly storagePath?: unknown;
  readonly revision?: unknown;
  readonly updatedAt?: unknown;
  readonly displayName?: unknown;
  readonly contentType?: unknown;
}

export interface SendableTarget {
  readonly uid: string;
  readonly caseId: string;
  readonly purpose: string;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isSendable(data: SendableFileFields, target: SendableTarget): boolean {
  if (data.userId !== target.uid || data.isDeleted === true || data.status !== FILE_STATUS.READY) return false;
  if (data.entityType !== ENTITY_TYPES.CONVEYANCE_CASE || data.entityId !== target.caseId || data.purpose !== target.purpose) return false;
  return nonEmpty(data.storagePath);
}

/** Η έκδοση που στέλνεται, κρινόμενη στον server — ή `null`. */
export function contributedFileOf(data: SendableFileFields | undefined, fileId: string, target: SendableTarget): ContributionFile | null {
  if (!data || !isSendable(data, target)) return null;
  const revision = typeof data.revision === 'number' ? data.revision : null;
  return {
    fileId,
    fingerprint: fileFingerprint(fileId, revision, normalizeToISO(data.updatedAt)),
    displayName: nonEmpty(data.displayName) ? data.displayName : fileId,
    contentType: nonEmpty(data.contentType) ? data.contentType : 'application/octet-stream',
  };
}
