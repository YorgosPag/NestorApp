/**
 * =============================================================================
 * 🏢 ENTERPRISE: useBatchFileOperations Hook
 * =============================================================================
 *
 * Shared hook for batch file operations (select, delete, download ZIP,
 * classify, AI classify, archive). Used by both FileManagerPageContent
 * and EntityFilesManager.
 *
 * @module components/shared/files/hooks/useBatchFileOperations
 * @enterprise ADR-031 - Canonical File Storage System
 */

import { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  archiveFilesWithPolicy,
  unarchiveFilesWithPolicy,
  batchDownloadFilesWithPolicy,
  moveFileToTrashWithPolicy,
  updateFileClassificationWithPolicy,
  type ArchiveFilesResponse,
} from '@/services/filesystem/file-mutation-gateway';
import { useNotifications } from '@/providers/NotificationProvider';
import { useFilesNotifications } from '@/hooks/notifications/useFilesNotifications';
import { useFileClassification, isAIClassifiable } from './useFileClassification';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';
import type { FileClassification } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('useBatchFileOperations');

// ============================================================================
// SSoT: Archive result feedback (used by entity + central file manager)
// ============================================================================

interface ArchiveFeedbackCallbacks {
  success: (msg: string) => void;
  warning: (msg: string) => void;
  error: (msg: string) => void;
}

/**
 * Handles archive API result and shows appropriate toast notification.
 * Returns true if the operation succeeded (caller should clear selection + refetch).
 */
export function showArchiveResultFeedback(
  result: ArchiveFilesResponse,
  totalCount: number,
  notify: ArchiveFeedbackCallbacks,
  t: (key: string, options?: Record<string, unknown>) => string,
): boolean {
  if (!result.success) {
    notify.error(result.errors[0] || t('batch.archiveError'));
    return false;
  }
  if (result.processedCount === 0) {
    notify.warning(t('batch.archiveNoChanges'));
    return true;
  }
  if (result.errors.length > 0) {
    notify.warning(t('batch.archivePartialSuccess', {
      processed: result.processedCount,
      failed: result.errors.length,
      total: totalCount,
    }));
    return true;
  }
  notify.success(t('batch.archiveSuccess', { count: result.processedCount }));
  return true;
}

// ============================================================================
// TYPES
// ============================================================================

interface UseBatchFileOperationsParams {
  /** Current file list (filtered) */
  files: FileRecord[];
  /** Current authenticated user ID */
  currentUserId: string;
  /** Refetch files callback */
  refetch: () => void | Promise<void>;
}

interface UseBatchFileOperationsReturn {
  /** Set of selected file IDs */
  selectedIds: Set<string>;
  /** Toggle selection of a single file */
  toggleSelect: (fileId: string) => void;
  /** Select all visible files */
  selectAll: () => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Batch delete (move to trash) */
  handleBatchDelete: () => Promise<void>;
  /** Batch download as ZIP */
  handleBatchDownload: () => Promise<void>;
  /** Batch classify (manual data classification) */
  handleBatchClassify: (classification: FileClassification) => Promise<void>;
  /** Batch archive */
  handleBatchArchive: () => Promise<void>;
  /** Batch unarchive (restore from archive) */
  handleBatchUnarchive: () => Promise<void>;
  /** AI auto-classify selected files */
  handleAIClassify: () => Promise<void>;
  /** Whether AI classification is in progress */
  aiClassifying: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBatchFileOperations({
  files,
  currentUserId,
  refetch,
}: UseBatchFileOperationsParams): UseBatchFileOperationsReturn {
  const { t } = useTranslation(['files', 'files-media']);
  // useNotifications kept only for showArchiveResultFeedback (needs raw callbacks + t)
  const { success, error, warning } = useNotifications();
  const fileNotifications = useFilesNotifications();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { classifyBatch, classifyingIds } = useFileClassification();

  // ---- Selection ----

  const toggleSelect = useCallback((fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(files.map(f => f.id)));
  }, [files]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ---- Batch Delete ----

  const handleBatchDelete = useCallback(async () => {
    if (!currentUserId) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => moveFileToTrashWithPolicy(id, currentUserId)));
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, currentUserId, refetch]);

  // ---- Batch Download (ZIP) ----

  const handleBatchDownload = useCallback(async () => {
    const selected = files.filter(f => selectedIds.has(f.id) && f.downloadUrl);
    if (selected.length === 0) return;

    try {
      const blob = await batchDownloadFilesWithPolicy(
        selected.map(f => ({
          url: f.downloadUrl as string,
          filename: `${f.displayName || f.originalFilename}.${f.ext}`,
        })),
      );
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `files_${nowISO().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      logger.error('Batch download failed', { error });
    }
  }, [selectedIds, files]);

  // ---- Batch Classify ----

  const handleBatchClassify = useCallback(async (classification: FileClassification) => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => updateFileClassificationWithPolicy(id, classification)));
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, refetch]);

  // ---- Batch Archive ----

  const handleBatchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const result = await archiveFilesWithPolicy(ids);
      const succeeded = showArchiveResultFeedback(result, ids.length, { success, warning, error }, t);
      if (succeeded) {
        setSelectedIds(new Set());
        await refetch();
      }
    } catch (archiveError) {
      logger.error('Batch archive failed', { error: archiveError });
      fileNotifications.batch.archiveError();
    }
  }, [selectedIds, refetch, success, warning, error, t, fileNotifications]);

  // ---- Batch Unarchive ----

  const handleBatchUnarchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const result = await unarchiveFilesWithPolicy(ids);
      if (!result.success) {
        fileNotifications.batch.unarchiveError(result.errors[0]);
        return;
      }
      fileNotifications.batch.unarchiveSuccess(result.processedCount);
      setSelectedIds(new Set());
      await refetch();
    } catch (unarchiveError) {
      logger.error('Batch unarchive failed', { error: unarchiveError });
      fileNotifications.batch.unarchiveError();
    }
  }, [selectedIds, refetch, fileNotifications]);

  // ---- AI Auto-Classify ----

  const handleAIClassify = useCallback(async () => {
    const classifiableIds = files
      .filter(f => selectedIds.has(f.id) && isAIClassifiable(f.contentType, f.originalFilename, f.ext, f.displayName))
      .map(f => f.id);

    if (classifiableIds.length === 0) {
      fileNotifications.batch.noAIClassifiableFiles();
      return;
    }

    await classifyBatch(classifiableIds, true);
    refetch();
  }, [selectedIds, files, classifyBatch, refetch, fileNotifications]);

  return {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    handleBatchDelete,
    handleBatchDownload,
    handleBatchClassify,
    handleBatchArchive,
    handleBatchUnarchive,
    handleAIClassify,
    aiClassifying: classifyingIds.size > 0,
  };
}
