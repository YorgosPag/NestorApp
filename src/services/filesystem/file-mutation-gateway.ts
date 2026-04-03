'use client';

import { FileFolderService, type CreateFolderInput } from '@/services/file-folder.service';
import { DocumentTemplateService, type CreateTemplateInput } from '@/services/document-template.service';
import { FileCommentService, type CreateCommentInput } from '@/services/file-comment.service';
import { FileApprovalService, type CreateApprovalInput } from '@/services/file-approval.service';
import { FileRecordService } from '@/services/file-record.service';
import { FileShareService, type CreateShareInput } from '@/services/file-share.service';
import { API_ROUTES, type EntityType } from '@/config/domain-constants';
import type { FileClassification } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { auth } from '@/lib/firebase';

interface BatchDownloadFileInput {
  url: string;
  filename: string;
}

interface FileClassificationResponse {
  success?: boolean;
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

export async function verifyFileUploadAuthWithPolicy(): Promise<FileUploadAuthContext> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('FILE_UPLOAD_AUTH_REQUIRED');
  }

  const idToken = await currentUser.getIdToken(true);

  return {
    uid: currentUser.uid,
    hasEmail: typeof currentUser.email === 'string' && currentUser.email.length > 0,
    tokenLength: idToken.length,
  };
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
): Promise<FileClassificationResponse> {
  return mutateJson<FileClassificationResponse>(API_ROUTES.FILES.CLASSIFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId }),
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
): Promise<{ success?: boolean; er