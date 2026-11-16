import 'server-only';

/**
 * @fileoverview Ο ΕΝΑΣ πυρήνας «άνοιγμα αρχείου μέσω συμμετοχής»: **υπόγραψε → κατέγραψε** (ADR-942 Φ2 · ADR-901 Φ4).
 * @related engaged-file-openers.ts (ποιος κρίνει ΤΙ ανοίγει, ανά είδος υπόθεσης) · conveyance-case-file-access.service.ts
 * @module server/engagement-files/engaged-file-opening.server
 *
 * 🔑 Ο πυρήνας **δεν** κρίνει πρόσβαση. Τη δίνει ο προσαρμογέας του είδους (μεταβίβαση: ο κατάλογος του θεατή · έκδοση: τα
 *    δοσμένα αρχεία). Εδώ ζουν μόνο τα κοινά: ποια πεδία του `FileRecord` χρειάζονται, ο σύνδεσμος 15′ από τον σωστό κάδο,
 *    και ότι **κανένα** άνοιγμα δεν δίνεται χωρίς ίχνος (το ίχνος γράφεται **πριν** επιστραφεί ο σύνδεσμος).
 * 🔑 Η διαδρομή έρχεται **από το έγγραφο**, ποτέ από το σύρμα.
 */

import type { DocumentData } from 'firebase-admin/firestore';

import type { CaseFileMode } from '@/lib/conveyance/case-activity';
import { fileDownloadName } from '@/lib/files/file-download-name';
import { signedDownloadUrl } from '@/lib/storage/signed-download-url';
import { createModuleLogger } from '@/lib/telemetry';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import type { EngagementVerdict } from '@/types/engagement';

const logger = createModuleLogger('engaged-file-opening');

/** Ό,τι απαντά κάθε πόρτα ανοίγματος — ένα λεξιλόγιο, μία μετάφραση σε HTTP (`case-file-response.ts`). */
export type EngagedFileOpening =
  | { readonly ok: true; readonly url: string; readonly expiresAt: number; readonly fileName: string; readonly contentType: string }
  | { readonly ok: false; readonly rejection: 'denied'; readonly verdict: EngagementVerdict }
  | { readonly ok: false; readonly rejection: 'not-found' | 'unknown' | 'failed' };

/** Ποιος ανοίγει τι, μέσω ποιας συμμετοχής — ίδιο αίτημα για κάθε είδος υπόθεσης. */
export interface EngagedFileRequest {
  readonly uid: string;
  readonly email: string | null;
  readonly engagementId: string;
  readonly fileId: string;
  readonly mode: CaseFileMode;
  readonly nowMs: number;
}

/** Τα πεδία του αρχείου που χρειάζεται το άνοιγμα — διαβασμένα από το έγγραφο. */
export interface OpenableFile {
  readonly storagePath: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly placement: { readonly storagePlacement?: unknown };
}

/** Το αρχείο ως ανοίξιμο — ή `null` αν λείπει, είναι στον κάδο ή δεν έχει διαδρομή αποθήκευσης. */
export function openableFileOf(data: DocumentData | undefined, fileId: string): OpenableFile | null {
  if (!data || data.isDeleted === true || typeof data.storagePath !== 'string' || data.storagePath === '') return null;
  return {
    storagePath: data.storagePath,
    fileName: fileDownloadName(data, fileId),
    contentType: typeof data.contentType === 'string' ? data.contentType : 'application/octet-stream',
    placement: { storagePlacement: data.storagePlacement },
  };
}

export interface FileOpeningStep {
  /** Το αρχείο που **ήδη** κρίθηκε ορατό σε αυτόν τον θεατή — `null` ⇒ `not-found` (ίδιο με ανύπαρκτο). */
  readonly file: OpenableFile | null;
  readonly mode: CaseFileMode;
  /** Το ίχνος του ανοίγματος, στο βιβλίο που ορίζει το είδος της υπόθεσης. */
  readonly record: (file: OpenableFile) => Promise<void>;
  /** Μόνο για το αρχείο καταγραφής, ποτέ ο σύνδεσμος. */
  readonly logData: Readonly<Record<string, string>>;
}

/** Υπόγραψε σύνδεσμο 15′ και κατέγραψε το άνοιγμα. Αποτυχία οποιουδήποτε από τα δύο ⇒ `failed`, κανένας σύνδεσμος. */
export async function signAndRecordOpening(step: FileOpeningStep): Promise<EngagedFileOpening> {
  const { file } = step;
  if (!file) return { ok: false, rejection: 'not-found' };
  try {
    const signed = await signedDownloadUrl({
      bucket: fileRecordBucket(file.placement),
      storagePath: file.storagePath,
      ...(step.mode === 'download' ? { downloadFileName: file.fileName } : {}),
    });
    if (signed.outcome !== 'signed') return { ok: false, rejection: 'failed' };
    await step.record(file);
    return { ok: true, url: signed.url, expiresAt: signed.expiresAt, fileName: file.fileName, contentType: file.contentType };
  } catch (error) {
    logger.error('Το αρχείο της συμμετοχής δεν υπογράφηκε', {
      data: step.logData,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, rejection: 'failed' };
  }
}
