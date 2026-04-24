'use client';

import { FileFolderService, type CreateFolderInput } from '@/services/file-folder.service';
import { DocumentTemplateService, type CreateTemplateInput } from '@/services/document-template.service';
import { FileCommentService, type CreateCommentInput } from '@/services/file-comment.service';
import { FileApprovalService, type CreateApprovalInput } from '@/services/file-approval.service';
import { FileRecordService } from '@/services/file-record.service';
import { FileShareService, type CreateShareInput } from '@/services/file-share.service';
import { API_ROUTES, type EntityType } from '@/config/domain-constants';
import type { FileClassification } from '@/config/domain-constants';
import type { AuditEntityType } from '@/types/audit-trail';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { auth } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('file-mutation-gateway');

interface BatchDownloadFileInput {
  url: string;
  filename: string;
}

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

export async function unlinkFileFromEntityWithPolicy(
  fileId: string,
  targetEntityType: EntityType,
  targetEntityId: string,
): Promise<void> {
  return FileRecordService.unlinkFileFromEntity(fileId, targetEntityType, targetEntityId);
}

export async function linkFileToEntityWithPolicy(
  fileId: string,
  targetEntityType: EntityType,
  targetEntityId: string,
): Promise<void> {
  return FileRecordService.linkFileToEntity(fileId, targetEntityType, targetEntityId);
}

export async function updateFileDescriptionWithPolicy(
  fileId: string,
  description: string,
): Promise<void> {
  return FileRecordService.updateDescription(fileId, description);
}

export async function createFileShareWithPolicy(input: CreateShareInput): Promise<string> {
  return FileShareService.createShare(input);
}


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
  errorMessage?: string,
): Promise<void> {
  return FileRecordService.markFileRecordFailed(fileId, errorMessage);
}

export async function renameFileWithPolicy(
  fileId: string,
  newDisplayName: string,
  renamedBy: string,
): Promise<void> {
  return FileRecordService.renameFile(fileId, newDisplayName, renamedBy);
}

export async function moveFileToTrashWithPolicy(
  fileId: string,
  trashedBy: string,
): Promise<void> {
  return FileRecordService.moveToTrash(fileId, trashedBy);
}

export async function restoreFileFromTrashWithPolicy(
  fileId: string,
  restoredBy: string,
): Promise<void> {
  return FileRecordService.restoreFromTrash(fileId, restoredBy);
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

export async function batchDownloadFilesWithPolicy(
  files: BatchDownloadFileInput[],
): Promise<Blob> {
  return apiClient.post<Blob>(
    API_ROUTES.FILES.BATCH_DOWNLOAD,
    { files },
    { responseType: 'blob' },
  );
}

export async function downloadFileFromProxyWithPolicy(
  downloadUrl: string,
  filename: string,
): Promise<Blob> {
  return apiClient.get<Blob>(API_ROUTES.DOWNLOAD, {
    params: {
      url: downloadUrl,
      filename,
    },
    responseType: 'blob',
  });
}

export async function archiveFilesWithPolicy(
  fileIds: string[],
): Promise<ArchiveFilesResponse> {
  return mutateJson<ArchiveFilesResponse>(API_ROUTES.FILES.ARCHIVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, action: 'archive' }),
  });
}

export async function unarchiveFilesWithPolicy(
  fileIds: string[],
): Promise<ArchiveFilesResponse> {
  return mutateJson<ArchiveFilesResponse>(API_ROUTES.FILES.ARCHIVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, action: 'unarchive' }),
  });
}

export async function updateFileClassificationWithPolicy(
  fileId: string,
  classification: FileClassification,
): Promise<void> {
  const { doc, updateDoc } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');
  await updateDoc(doc(db, 'files', fileId), { classification });
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
