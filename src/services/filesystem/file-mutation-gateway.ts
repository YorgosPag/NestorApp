'use client';

import { FileFolderService, type CreateFolderInput } from '@/services/file-folder.service';
import { DocumentTemplateService, type CreateTemplateInput } from '@/services/document-template.service';
import { FileCommentService, type CreateCommentInput } from '@/services/file-comment.service';
import { FileApprovalService, type CreateApprovalInput } from '@/services/file-approval.service';
import { FileRecordService } from '@/services/file-record.service';
import type { Iso19650MetadataUpdate } from '@/services/file-record.service';
import { API_ROUTES, type EntityType } from '@/config/domain-constants';
import type { FileClassification } from '@/config/domain-constants';
import type { AuditEntityType } from '@/types/audit-trail';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { auth } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_CUSTODY_PARAM, type FileCustody } from '@/lib/files/file-custody';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

const logger = createModuleLogger('file-mutation-gateway');

interface FileClassificationResponse {
  success?: boolean;
  status?: 'classifying' | 'already_classified';
  error?: string;
  documentType?: string;
  confidence?: number;
  signals?: string[];
}

interface FileUploadAuthContext {
  uid: string;
  hasEmail: boolean;
  tokenLength: number;
}

export interface ArchiveFilesResponse {
  success: boolean;
  processedCount: number;
  errors: string[];
}

// ============================================================================
// 🏢 ADR-292: CANONICAL UPLOAD AUTH VALIDATION (SSoT)
// ============================================================================

/** Result of canonical upload auth validation */
export interface UploadAuthResult {
  uid: string;
  companyId: string;
  globalRole: string | null;
  isSuperAdmin: boolean;
}

/**
 * Canonical upload auth validation — SSoT for all upload hooks (ADR-292).
 *
 * Validates:
 * 1. User is authenticated
 * 2. User has companyId custom claim
 * 3. If expectedCompanyId provided: claim matches (super_admin bypass)
 *
 * Replaces inline validateAuthAndClaims() in useFloorplanUpload.
 */
export async function validateUploadAuth(
  expectedCompanyId?: string,
): Promise<UploadAuthResult> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('UPLOAD_AUTH_REQUIRED');
  }

  const idTokenResult = await currentUser.getIdTokenResult(true);
  const claims = idTokenResult.claims;

  const companyId = typeof claims.companyId === 'string' ? claims.companyId : null;
  const globalRole = typeof claims.globalRole === 'string' ? claims.globalRole : null;
  const isSuperAdmin = globalRole === 'super_admin';

  if (!companyId) {
    logger.error('User missing companyId claim', { uid: currentUser.uid });
    throw new Error('UPLOAD_AUTH_MISSING_COMPANY');
  }

  if (expectedCompanyId && !isSuperAdmin && companyId !== expectedCompanyId) {
    logger.error('Company mismatch in upload auth', {
      claim: companyId,
      expected: expectedCompanyId,
    });
    throw new Error('UPLOAD_AUTH_COMPANY_MISMATCH');
  }

  logger.info('Upload auth validated', {
    uid: currentUser.uid,
    companyId,
    isSuperAdmin,
  });

  return { uid: currentUser.uid, companyId, globalRole, isSuperAdmin };
}

/** Αποτέλεσμα ελέγχου ανεβάσματος **με κάτοχο** — ο συνδεδεμένος και το διαμέρισμα που θα γραφτεί. */
export interface CustodyUploadAuthResult {
  uid: string;
  custody: CustodyKind;
}

/**
 * **Έλεγχος ανεβάσματος για κάτοχο «εταιρεία Ή άνθρωπος»** (ADR-866 §2.6.8 Β3).
 *
 * - **Εταιρεία** ⇒ **καλεί** το {@link validateUploadAuth} — μηδέν δεύτερη λογική claim.
 * - **Άνθρωπος** ⇒ ο κάτοχος **πρέπει** να είναι ο συνδεδεμένος: **κανένα** claim εταιρείας (ο ιδιώτης
 *   δεν έχει και δεν αποκτά — ADR-787 Ε-3 §3) και **καμία** παράκαμψη super admin (ο κανόνας
 *   `files_personal` δεν τη δίνει ούτε αυτός). Ξένο `userId` ⇒ `UPLOAD_AUTH_CUSTODY_MISMATCH`.
 */
export async function validateCustodyUploadAuth(custody: FileCustody): Promise<CustodyUploadAuthResult> {
  if (custody.userId === undefined) {
    const { uid } = await validateUploadAuth(custody.companyId);
    return { uid, custody: 'company' };
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('UPLOAD_AUTH_REQUIRED');
  }
  if (!custody.userId || custody.userId !== currentUser.uid) {
    logger.error('Personal custody does not belong to the signed-in user', { uid: currentUser.uid });
    throw new Error('UPLOAD_AUTH_CUSTODY_MISMATCH');
  }
  return { uid: currentUser.uid, custody: 'personal' };
}

async function mutateJson<T>(url: string, init: RequestInit): Promise<T> {
  const body = init.body !== undefined && typeof init.body === 'string'
    ? JSON.parse(init.body) as unknown
    : init.body;

  return apiClient.request<T>(url, {
    method: (init.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GET' | undefined) ?? 'GET',
    headers: init.headers as Record<string, string> | undefined,
    body,
  });
}

export async function createFileFolderWithPolicy(input: CreateFolderInput): Promise<string> {
  return FileFolderService.createFolder(input);
}

export async function renameFileFolderWithPolicy(folderId: string, newName: string): Promise<void> {
  return FileFolderService.renameFolder(folderId, newName);
}

export async function deleteFileFolderWithPolicy(folderId: string): Promise<void> {
  return FileFolderService.deleteFolder(folderId);
}

export async function createDocumentTemplateWithPolicy(input: CreateTemplateInput): Promise<string> {
  return DocumentTemplateService.createTemplate(input);
}

export async function deleteDocumentTemplateWithPolicy(templateId: string): Promise<void> {
  return DocumentTemplateService.deleteTemplate(templateId);
}

export async function addFileCommentWithPolicy(input: CreateCommentInput): Promise<string> {
  return FileCommentService.addComment(input);
}

export async function editFileCommentWithPolicy(commentId: string, newText: string): Promise<void> {
  return FileCommentService.editComment(commentId, newText);
}

export async function deleteFileCommentWithPolicy(commentId: string): Promise<void> {
  return FileCommentService.deleteComment(commentId);
}

export async function toggleFileCommentResolveWithPolicy(
  commentId: string,
  resolved: boolean,
  userId: string,
): Promise<void> {
  return FileCommentService.toggleResolve(commentId, resolved, userId);
}

export async function createFileApprovalWithPolicy(input: CreateApprovalInput): Promise<string> {
  return FileApprovalService.createApproval(input);
}

export async function approveFileApprovalWithPolicy(approvalId: string, userId: string): Promise<void> {
  return FileApprovalService.approve(approvalId, userId);
}

export async function rejectFileApprovalWithPolicy(
  approvalId: string,
  userId: string,
  reason: string,
): Promise<void> {
  return FileApprovalService.reject(approvalId, userId, reason);
}

export async function cancelFileApprovalWithPolicy(
  approvalId: string,
  userId: string,
  fileId: string,
): Promise<void> {
  return FileApprovalService.cancel(approvalId, userId, fileId);
}

// 🔑 ADR-866 §2.6.8 Β4 — κάθε πράξη που παίρνει ΜΟΝΟ `fileId` δέχεται **υποχρεωτικό** `custody`
//    (το διαμέρισμα): ο μεταγλωττιστής βρίσκει κάθε καλούντα, και κανείς δεν «δοκιμάζει και τις δύο».

export async function unlinkFileFromEntityWithPolicy(
  fileId: string,
  custody: CustodyKind,
  targetEntityType: EntityType,
  targetEntityId: string,
): Promise<void> {
  return FileRecordService.unlinkFileFromEntity(fileId, custody, targetEntityType, targetEntityId);
}

export async function linkFileToEntityWithPolicy(
  fileId: string,
  custody: CustodyKind,
  targetEntityType: EntityType,
  targetEntityId: string,
): Promise<void> {
  return FileRecordService.linkFileToEntity(fileId, custody, targetEntityType, targetEntityId);
}

export async function updateFileDescriptionWithPolicy(
  fileId: string,
  custody: CustodyKind,
  description: string,
): Promise<void> {
  return FileRecordService.updateDescription(fileId, custody, description);
}

export async function updateIso19650MetadataWithPolicy(
  fileId: string,
  metadata: Iso19650MetadataUpdate,
  userId: string,
): Promise<void> {
  return FileRecordService.updateIso19650Metadata(fileId, metadata, userId);
}

export type { Iso19650MetadataUpdate };


export async function createPendingFileRecordWithPolicy(
  input: Parameters<typeof FileRecordService.createPendingFileRecord>[0],
): Promise<Awaited<ReturnType<typeof FileRecordService.createPendingFileRecord>>> {
  return FileRecordService.createPendingFileRecord(input);
}

export async function finalizeFileRecordWithPolicy(
  input: Parameters<typeof FileRecordService.finalizeFileRecord>[0],
): Promise<void> {
  return FileRecordService.finalizeFileRecord(input);
}

export async function markFileRecordFailedWithPolicy(
  fileId: string,
  custody: CustodyKind,
  errorMessage?: string,
): Promise<void> {
  return FileRecordService.markFileRecordFailed(fileId, custody, errorMessage);
}

export async function renameFileWithPolicy(
  fileId: string,
  custody: CustodyKind,
  newDisplayName: string,
  renamedBy: string,
): Promise<void> {
  return FileRecordService.renameFile(fileId, custody, newDisplayName, renamedBy);
}

export async function moveFileToTrashWithPolicy(
  fileId: string,
  custody: CustodyKind,
  trashedBy: string,
): Promise<void> {
  return FileRecordService.moveToTrash(fileId, custody, trashedBy);
}

export async function restoreFileFromTrashWithPolicy(
  fileId: string,
  custody: CustodyKind,
  restoredBy: string,
): Promise<void> {
  return FileRecordService.restoreFromTrash(fileId, custody, restoredBy);
}

export async function classifyFileWithPolicy(
  fileId: string,
  force = false,
): Promise<FileClassificationResponse> {
  return mutateJson<FileClassificationResponse>(API_ROUTES.FILES.CLASSIFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, force }),
  });
}

/**
 * **Ο πελάτης λέει ΠΟΙΑ, ο διακομιστής λέει ΠΟΥ** (ADR-862 Φ0 Β8).
 *
 * 🔴 Μέχρι σήμερα έστελνε `{ url, filename }` ανά αρχείο — δηλαδή **τοποθεσία και
 * όνομα από τον πελάτη**, που ο διακομιστής κατέβαζε με `fetch()` χωρίς να ρωτήσει
 * ποιανού είναι. Ο τύπος στενεύει σε `string[]` ώστε ο **μεταγλωττιστής** να βρει
 * κάθε καλούντα: μια σιωπηλή αλλαγή σχήματος θα άφηνε τον παλιό να στέλνει URLs σε
 * διαδρομή που πια δεν τα δέχεται, και η βλάβη θα φαινόταν μόνο σε χρόνο εκτέλεσης.
 *
 * 🔑 ADR-866 §2.6.9 — **υποχρεωτικό** διαμέρισμα (ένα αίτημα = ένα διαμέρισμα): ταξιδεύει **μόνο το
 * είδος** ως `?custody=`, ποτέ ο κάτοχος. Υποχρεωτικό ώστε ο μεταγλωττιστής να βρει κάθε καλούντα.
 */
export async function batchDownloadFilesWithPolicy(fileIds: string[], custody: CustodyKind): Promise<Blob> {
  return apiClient.post<Blob>(
    API_ROUTES.FILES.BATCH_DOWNLOAD,
    { fileIds },
    { params: { [FILE_CUSTODY_PARAM]: custody }, responseType: 'blob' },
  );
}

/**
 * **Η ΠΡΟΤΙΜΩΜΕΝΗ λήψη** — ο πελάτης λέει **ποιο**, ο διακομιστής λέει **πού**
 * (ADR-862 Φ0 Β8).
 *
 * 🔑 Το όνομα του αρχείου **δεν** ταξιδεύει: το παράγει ο διακομιστής από το
 * `FileRecord`. Όνομα που στέλνει ο πελάτης είναι όνομα που **διαλέγει** για bytes
 * που **δεν διάλεξε** — και μπαίνει αυτούσιο σε κεφαλίδα `Content-Disposition`.
 *
 * ⇒ Η διαδρομή φυλάει **μισθωτή ΚΑΙ δοχείο** (τον κριτή του Β5), γιατί υπάρχει
 * `FileRecord` να ρωτηθεί.
 */
/**
 * Ο **ΕΝΑΣ** καλών του proxy λήψης — οι δύο δημόσιες μορφές διαφέρουν **μόνο στα
 * params**, που είναι και η αληθινή διαφορά τους.
 *
 * ⚠️ Γράφτηκε επειδή το **CHECK 3.28 το μέτρησε**: οι δύο συναρτήσεις γεννήθηκαν
 * στο ίδιο commit ως δίδυμα 7 γραμμών / 50 tokens — ο N.18 στην κλασική του μορφή
 * (*«κεντρικοποιείς το Α και γράφεις Β ως δίδυμο»*). Η πύλη το έπιασε **πριν** το
 * commit, όχι μετά.
 */
function downloadBlobFromProxy(params: Record<string, string>): Promise<Blob> {
  return apiClient.get<Blob>(API_ROUTES.DOWNLOAD, { params, responseType: 'blob' });
}

export async function downloadFileByIdWithPolicy(fileId: string, custody: CustodyKind): Promise<Blob> {
  return downloadBlobFromProxy({ fileId, [FILE_CUSTODY_PARAM]: custody });
}

/**
 * ⚠️ **Η ΚΛΗΡΟΝΟΜΙΑ — και είναι ΔΗΛΩΜΕΝΟ ΟΡΙΟ, όχι παράλειψη.**
 *
 * Μένει **μόνο** για τους καλούντες που **δεν έχουν** `fileId`: μετρημένο
 * 2026-09-16, ο μόνος τέτοιος είναι οι φωτογραφίες **επαφών**
 * (`usePhotoPreviewState`), που **δεν είναι `FileRecord`**. Fail-closed εκεί θα
 * έσπαγε λειτουργία· fail-open θα ήταν θέατρο.
 *
 * 🔒 Η διαδρομή πίσω της **δεν** είναι πια αφύλακτη: απέκτησε `validateFetchUrl`
 * (SSRF) + `storageObjectFromUrl` + `judgeStorageCustody`, και κατεβάζει με Admin
 * SDK αντί για `fetch(url)`. Φυλάει **μισθωτή**, όχι **δοχείο** — δεν υπάρχει
 * `FileRecord` για να ρωτηθεί ο κριτής του Β5.
 *
 * ⛔ **ΜΗΝ τη χρησιμοποιήσεις για νέο σημείο κλήσης.** Ο ratchet είναι να
 * μηδενιστούν οι καλούντες της, όχι να μεγαλώσουν.
 */
export async function downloadFileFromProxyWithPolicy(
  downloadUrl: string,
  filename: string,
): Promise<Blob> {
  return downloadBlobFromProxy({ url: downloadUrl, filename });
}

/**
 * Η **αρχειοθέτηση είναι ΜΙΑ διαδρομή με δύο κατευθύνσεις** — ποτέ δύο σώματα.
 *
 * ⚠️ **ΠΡΟΫΠΑΡΧΟΝ ΧΡΕΟΣ, θεραπευμένο επιτόπου (N.0.2)**: οι δύο συναρτήσεις ήταν
 * δίδυμα **7 γραμμών** που διέφεραν σε **ένα literal** — το σχήμα που ο N.18
 * ονομάζει, και που το **CHECK 3.28** μέτρησε (50 tokens) μόλις το αρχείο μπήκε σε
 * diff. Δεν γεννήθηκε εδώ· φάνηκε εδώ.
 *
 * 🔑 Τα **δύο δημόσια ονόματα μένουν**: η κατεύθυνση είναι μέρος του λεξιλογίου του
 * καλούντος (*«αρχειοθέτησε»* / *«επανάφερε»*), και μια σκέτη `boolean` παράμετρος
 * στο σημείο κλήσης θα ήταν χειρότερη από τον κλώνο.
 */
type FileArchiveDirection = 'archive' | 'unarchive';

function setFilesArchivedWithPolicy(
  fileIds: string[],
  action: FileArchiveDirection,
): Promise<ArchiveFilesResponse> {
  return mutateJson<ArchiveFilesResponse>(API_ROUTES.FILES.ARCHIVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, action }),
  });
}

export async function archiveFilesWithPolicy(
  fileIds: string[],
): Promise<ArchiveFilesResponse> {
  return setFilesArchivedWithPolicy(fileIds, 'archive');
}

export async function unarchiveFilesWithPolicy(
  fileIds: string[],
): Promise<ArchiveFilesResponse> {
  return setFilesArchivedWithPolicy(fileIds, 'unarchive');
}

export async function updateFileClassificationWithPolicy(
  fileId: string,
  classification: FileClassification,
): Promise<void> {
  // 🧹 ADR-866 §2.6.8 Β11 — ήταν ωμό `'files'`. Η δημοσιοποίηση (ADR-845) είναι πράξη ΓΡΑΦΕΙΟΥ:
  //    μόνο εταιρικό διαμέρισμα, και το UI την κρύβει για προσωπικό κάτοχο.
  const { doc, updateDoc } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');
  await updateDoc(doc(db, COLLECTIONS.FILES, fileId), { classification });
}

// ============================================================================
// 🏢 ADR-293 Phase 8: ENTITY DISPLAY NAME CASCADE
// ============================================================================

export interface PropagateEntityRenameInput {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly newEntityLabel: string;
}

export interface PropagatedFileUpdate {
  readonly fileId: string;
  readonly newDisplayName: string;
}

export interface PropagateEntityRenameResponse {
  readonly success: boolean;
  readonly updatedCount?: number;
  readonly skippedCount?: number;
  readonly updatedFiles?: readonly PropagatedFileUpdate[];
  readonly error?: string;
}

/**
 * Propagates an entity rename to every related FileRecord.displayName.
 *
 * On success, dispatches a `FILE_UPDATED` event per renamed file through the
 * centralized RealtimeService (ADR-228) so listeners such as `useEntityFiles`
 * update their state instantly — no manual refetch, no Firestore round-trip
 * required for the optimistic UI refresh.
 */
export async function propagateEntityLabelRenameWithPolicy(
  input: PropagateEntityRenameInput,
): Promise<PropagateEntityRenameResponse> {
  const response = await mutateJson<PropagateEntityRenameResponse>(
    API_ROUTES.FILES.PROPAGATE_ENTITY_RENAME,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );

  if (response.success && response.updatedFiles && response.updatedFiles.length > 0) {
    const { RealtimeService } = await import('@/services/realtime');
    const now = Date.now();
    for (const update of response.updatedFiles) {
      RealtimeService.dispatch('FILE_UPDATED', {
        fileId: update.fileId,
        updates: { displayName: update.newDisplayName },
        timestamp: now,
      });
    }
  }

  return response;
}
