'use client';

import { FileFolderService, type CreateFolderInput } from '@/services/file-folder.service';
import { DocumentTemplateService, type CreateTemplateInput } from '@/services/document-template.service';
import { FileCommentService, type CreateCommentInput } from '@/services/file-comment.service';
import { FileApprovalService, type CreateApprovalInput } from '@/services/file-approval.service';
import { FileRecordService } from '@/services/file-record.service';
import { FileShareService, type CreateShareInput } from '@/services/file-share.service';
import type { EntityType } from '@/config/domain-constants';

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
