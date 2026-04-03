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
import {
  archiveFilesWithPolicy,
  batchDownloadFilesWithPolicy,
  moveFileToTrashWithPolicy,
  updateFileClassificationWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { useFileClassification, isAIClassifiable } from './useFileClassification';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';
import type { FileClassification } from '@/config/domain-constants';

const logger = createModuleLogger('useBatchFileOperations');

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
      link.download = `files_${new Date().toISOString().slice(0, 10)}.zip`;
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
      await archiveFilesWithPolicy(ids);
    } catch (error) {
      logger.error('Batch archive failed', { error });
      return;
    }

    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, refetch]);

  // ---- AI Auto-Classify ----

  const handleAIClassify = useCallback(async () => {
    const classifiableIds = files
      .filter(f => selectedIds.has(f.id) && isAIClassifiable(f.contentType))
      .map(f => f.id);

    if (classifiableIds.length === 0) return;

    await classifyBatch(classifiableIds);
    refetch();
  }, [selectedIds, files, classifyBatch, refetch]);

  return {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    handleBatchDelete,
    handleBatchDownload,
    handleBatchClassify,
    handleBatchArchive,
    handleAIClassify,
    aiClassifying: classifyingIds.size > 0,
  };
}
