/**
 * FILE LIFECYCLE HANDLER — Discard pending/quarantined files
 * Allows the AI agent to permanently delete files the user doesn't want.
 * @module services/ai-pipeline/tools/handlers/file-lifecycle-handler
 * @enterprise ADR-191 Phase 3.2 (Orphan PENDING File Cleanup)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_STATUS } from '@/config/domain-constants';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  logger,
} from '../executor-shared';
import { purgeFileRecord, isFileHeld } from '@/services/file-record/file-purge-helpers';

// ============================================================================
// HANDLER
// ============================================================================

export class FileLifecycleHandler implements ToolHandler {
  readonly toolNames = ['discard_pending_file'] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (toolName !== 'discard_pending_file') {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }
    if (!ctx.isAdmin) {
      return { success: false, error: 'discard_pending_file is admin-only.' };
    }

    const fileRecordId = typeof args.fileRecordId === 'string' ? args.fileRecordId.trim() : '';
    if (!fileRecordId) {
      return { success: false, error: 'fileRecordId is required.' };
    }

    const reason = typeof args.reason === 'string' ? args.reason : null;

    return this.discardFile(fileRecordId, reason, ctx);
  }

  private async discardFile(
    fileRecordId: string,
    reason: string | null,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.FILES).doc(fileRecordId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: `FileRecord ${fileRecordId} not found.` };
    }

    const data = docSnap.data()!;

    // Verify file belongs to same company
    if (data.companyId !== ctx.companyId) {
      return { success: false, error: 'Access denied: file belongs to another company.' };
    }

    // Only discard PENDING or FAILED files
    if (data.status !== FILE_STATUS.PENDING && data.status !== FILE_STATUS.FAILED) {
      return {
        success: false,
        error: `Cannot discard file with status "${data.status}". Only pending/failed files can be discarded.`,
      };
    }

    // Respect holds
    if (isFileHeld(data)) {
      return { success: false, error: 'File has an active hold and cannot be deleted.' };
    }

    const result = await purgeFileRecord({
      fileId: fileRecordId,
      storagePath: data.storagePath as string | undefined,
      performedBy: `ai-agent:${ctx.channel}`,
      purgeReason: 'user_discard',
      metadata: {
        reason: reason ?? 'User requested deletion',
        channel: ctx.channel,
        requestId: ctx.requestId,
      },
    });

    if (!result.success) {
      return { success: false, error: result.error ?? 'Purge failed.' };
    }

    const filename = (data.displayName as string) || fileRecordId;
    logger.info('File discarded by AI agent', { fileRecordId, filename, channel: ctx.channel });

    return {
      success: true,
      data: { fileRecordId, filename, storageDeleted: result.storageDeleted },
    };
  }
}
