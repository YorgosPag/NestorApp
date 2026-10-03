/**
 * =============================================================================
 * Ο επαγγελματίας ανοίγει ένα τεκμήριο της υπόθεσης (ADR-901 Φ4 §5.4 · §5.9 · άγκυρες Α19-Α20)
 * =============================================================================
 *
 * **Κρίνε → ξαναπαράγαγε → υπόγραψε → κατέγραψε**, με αυτή τη σειρά (πρότυπο `openMandateEvidence`):
 * 1. η δική μου συμμετοχή, κρινόμενη **ανά αίτημα** (`resolveEngagedCase`): ανάκληση = άμεση
 * 2. ο κατάλογος **του ρόλου μου** ξαναπαράγεται στον server. Δεκτό είναι **μόνο** αρχείο που είναι τεκμήριο
 *    **ορατής** γραμμής. Οτιδήποτε άλλο είναι `not-found`, ίδιο με το ανύπαρκτο, ώστε να μη γίνεται μαντείο ύπαρξης (Α19)
 * 3. η διαδρομή έρχεται **από το έγγραφο** (`files/{id}`), ποτέ από το σύρμα· σύνδεσμος 15′ (`signedDownloadUrl`)
 * 4. **ένα** γεγονός `document_accessed` στο βιβλίο **της υπόθεσης** (Α20). Η πρόσβαση την παρέχει η υπόθεση,
 *    άρα εκεί ρωτά ο οικοδεσπότης «ποιος είδε τι» (DocuSign «Viewed» · αίθουσες δεδομένων)
 *
 * @module services/conveyance/conveyance-case-file-access.service
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { CASE_ACCESS_FIELD, CASE_DOCUMENT_FIELD, encodeCaseAccess, type CaseFileMode } from '@/lib/conveyance/case-activity';
import { fileDownloadName } from '@/lib/files/file-download-name';
import { signedDownloadUrl } from '@/lib/storage/signed-download-url';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import type { EngagementVerdict } from '@/types/engagement';
import { engagedChecklistOf, resolveEngagedCase, type EngagedCaseAccess } from './conveyance-engagement-access.service';

const logger = createModuleLogger('conveyance-case-file-access');

export type CaseFileOpening =
  | { readonly ok: true; readonly url: string; readonly expiresAt: number; readonly fileName: string; readonly contentType: string }
  | { readonly ok: false; readonly rejection: 'denied'; readonly verdict: EngagementVerdict }
  | { readonly ok: false; readonly rejection: 'not-found' | 'unknown' | 'failed' };

export interface CaseFileRequest {
  readonly uid: string;
  readonly email: string | null;
  readonly engagementId: string;
  readonly fileId: string;
  readonly mode: CaseFileMode;
  readonly nowMs: number;
}

/** Είναι το αρχείο τεκμήριο γραμμής που **αυτός ο ρόλος** βλέπει τώρα; */
async function visibleToRole(db: Firestore, access: EngagedCaseAccess, fileId: string): Promise<boolean> {
  const checklist = await engagedChecklistOf(db, access);
  return checklist.rows.some((row) => row.files.some((file) => file.fileId === fileId));
}

interface StoredFile {
  readonly storagePath: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly placement: { readonly storagePlacement?: unknown };
}

/** Το έγγραφο του αρχείου — **μόνο** του μισθωτή της υπόθεσης και μόνο αν έχει bytes. */
async function readStoredFile(db: Firestore, companyId: string, fileId: string): Promise<StoredFile | null> {
  const data = (await db.collection(COLLECTIONS.FILES).doc(fileId).get()).data();
  if (!data || data.companyId !== companyId || data.isDeleted === true || typeof data.storagePath !== 'string' || data.storagePath === '') return null;
  return {
    storagePath: data.storagePath,
    fileName: fileDownloadName(data, fileId),
    contentType: typeof data.contentType === 'string' ? data.contentType : 'application/octet-stream',
    placement: { storagePlacement: data.storagePlacement },
  };
}

/** Α20 — ένα άνοιγμα, ένα γεγονός, στο βιβλίο της υπόθεσης (ο οικοδεσπότης το βλέπει στο ίχνος του). */
async function recordCaseDocumentAccess(access: EngagedCaseAccess, request: CaseFileRequest, file: StoredFile): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'conveyance_case',
    entityId: access.record.id,
    entityName: access.context.propertyName,
    action: 'document_accessed',
    changes: [
      { field: CASE_DOCUMENT_FIELD, oldValue: null, newValue: request.fileId, label: file.fileName },
      { field: CASE_ACCESS_FIELD, oldValue: null, newValue: encodeCaseAccess(request.mode, access.engagement.role) },
    ],
    performedBy: request.uid,
    performedByName: request.email,
    companyId: access.record.companyId,
  });
}

/** Ο επαγγελματίας ανοίγει/κατεβάζει ένα τεκμήριο της υπόθεσης. */
export async function openCaseFile(db: Firestore, request: CaseFileRequest): Promise<CaseFileOpening> {
  const resolution = await resolveEngagedCase(db, request.uid, request.engagementId, request.nowMs);
  if (!resolution.ok) return resolution;
  const { access } = resolution;
  if (!(await visibleToRole(db, access, request.fileId))) return { ok: false, rejection: 'not-found' };
  const file = await readStoredFile(db, access.record.companyId, request.fileId);
  if (!file) return { ok: false, rejection: 'not-found' };
  try {
    const signed = await signedDownloadUrl({
      bucket: fileRecordBucket(file.placement),
      storagePath: file.storagePath,
      ...(request.mode === 'download' ? { downloadFileName: file.fileName } : {}),
    });
    if (signed.outcome !== 'signed') return { ok: false, rejection: 'failed' };
    await recordCaseDocumentAccess(access, request, file);
    return { ok: true, url: signed.url, expiresAt: signed.expiresAt, fileName: file.fileName, contentType: file.contentType };
  } catch (error) {
    logger.error('Το τεκμήριο της υπόθεσης δεν υπογράφηκε', {
      data: { engagementId: request.engagementId, fileId: request.fileId },
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, rejection: 'failed' };
  }
}
