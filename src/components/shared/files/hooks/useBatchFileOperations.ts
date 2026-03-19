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
import { FileRecordService } from '@/services/file-record.service';
import { useFileClassification, isAIClassifiable } from './useFileClassification';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';
import type { FileClassification } from '@/config/domain-constants';
import { API_ROUTES } from '@/config/domain-constants';

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
    await Promise.all(ids.map(id => FileRecordService.moveToTrash(id, currentUserId)));
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, currentUserId, refetch]);

  // ---- Batch Download (ZIP) ----

  const handleBatchDownload = useCallback(async () => {
    const selected = files.filter(f => selectedIds.has(f.id) && f.downloadUrl);
    if (selected.length === 0) return;

    const response = await fetch(API_ROUTES.FILES.BATCH_DOWNLOAD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: selected.map(f => ({
          url: f.downloadUrl,
          filename: `${f.displayName || f.originalFilename}.${f.ext}`,
        })),
      }),
    });

    if (!response.ok) {
      logger.error('Batch download failed', { status: response.status });
      return;
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `files_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, [selectedIds, files]);

  // ---- Batch Classify ----

  const handleBatchClassify = useCallback(async (classification: FileClassification) => {
    const ids = Array.from(selectedIds);
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    await Promise.all(ids.map(id =>
      updateDoc(doc(db, 'files', id), { classification })
    ));
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, refetch]);

  // ---- Batch Archive ----

  const handleBatchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const response = await fetch(API_ROUTES.FILES.ARCHIVE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: ids, action: 'archive' }),
    });

    if (!response.ok) {
      logger.error('Batch archive failed', { status: response.status });
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
