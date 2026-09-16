/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Manager Handlers
 * =============================================================================
 *
 * Event handlers for FileManagerPageContent extracted as a custom hook.
 * Follows Google SRP: one module = one responsibility (event handling).
 *
 * @module components/file-manager/file-manager-handlers
 * @enterprise ADR-031 - Canonical File Storage System
 */

import { useCallback } from 'react';
import {
  archiveFilesWithPolicy,
  classifyFileWithPolicy,
  renameFileWithPolicy,
  updateFileDescriptionWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { uploadFileWithPolicy } from '@/services/filesystem/upload-orchestrator-gateway';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { getFileExtension } from '@/services/upload/utils/storage-path';
import { isAIClassifiable } from '@/components/shared/files/hooks/useFileClassification';
import {
  classifyFilesInBatch,
  downloadFilesAsZip,
  showArchiveResultFeedback,
  trashFilesInBatch,
} from '@/components/shared/files/hooks/useBatchFileOperations';
import { defaultFileFilters } from '@/components/core/AdvancedFilters';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';
import type { FileClassification } from '@/config/domain-constants';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { useFileManagerState } from './useFileManagerState';

const logger = createModuleLogger('FileManagerHandlers');

// ============================================================================
// TYPES
// ============================================================================

type StateReturn = ReturnType<typeof useFileManagerState>;

interface HandlerDeps {
  state: StateReturn;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFileManagerHandlers({ state }: HandlerDeps) {
  const {
    user, companyId,
    setSelectedFile, setSelectedIds, setFilters, setUploading,
    filteredFiles, selectedIds, fileInputRef,
    classifyBatch, refetch,
    showSuccess, showError, showWarning, t,
  } = state;

  const handleFileClick = useCallback((file: FileRecord) => {
    setSelectedFile(file);
  }, [setSelectedFile]);

  const handleFileDoubleClick = useCallback((file: FileRecord) => {
    if (file.downloadUrl) {
      window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleRename = useCallback(async (fileId: string, newDisplayName: string) => {
    if (!user?.uid) return;
    try {
      await renameFileWithPolicy(fileId, newDisplayName, user.uid);
      refetch();
    } catch (err) {
      logger.error('Rename failed', { fileId, error: err });
    }
  }, [user?.uid, refetch]);

  const handleDescriptionUpdate = useCallback(async (fileId: string, description: string) => {
    try {
      await updateFileDescriptionWithPolicy(fileId, description);
      refetch();
    } catch (err) {
      logger.error('Description update failed', { fileId, error: err });
    }
  }, [refetch]);

  // Batch operations
  const handleBatchDelete = useCallback(async () => {
    if (!user?.uid) return;
    await trashFilesInBatch(Array.from(selectedIds), user.uid);
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, user?.uid, refetch, setSelectedIds]);

  const handleBatchDownload = useCallback(async () => {
    // ⚠️ Το φίλτρο `f.downloadUrl` **έφυγε** (ADR-862 Φ0 Β8): η διαδρομή δεν δέχεται
    //    πια URL, και αρχείο χωρίς μόνιμο tokenized URL είναι **κατεβάσιμο** — απλώς
    //    περνά από τον proxy. Το παλιό φίλτρο θα έκρυβε ακριβώς τα νεότερα αρχεία.
    await downloadFilesAsZip(filteredFiles.filter(f => selectedIds.has(f.id)).map(f => f.id));
  }, [selectedIds, filteredFiles]);

  const handleBatchClassify = useCallback(async (classification: FileClassification) => {
    await classifyFilesInBatch(Array.from(selectedIds), classification);
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, refetch, setSelectedIds]);

  const handleBatchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const result = await archiveFilesWithPolicy(ids);
      const notify = { success: showSuccess, warning: showWarning, error: showError };
      const succeeded = showArchiveResultFeedback(result, ids.length, notify, t);
      if (succeeded) {
        setSelectedIds(new Set());
        await refetch();
      }
    } catch (error) {
      logger.error('Batch archive failed', { error });
      showError(t('batch.archiveError'));
    }
  }, [selectedIds, refetch, setSelectedIds, showError, showSuccess, showWarning, t]);

  // Direct file upload (ADR-031 canonical pipeline)
  const handleFileUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !companyId || !user?.uid) return;
    setUploading(true);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const ext = getFileExtension(file.name);

        // ADR-292: Canonical 4-step upload via orchestrator (auth + create + upload + finalize)
        const result = await uploadFileWithPolicy(file, {
          companyId,
          entityType: ENTITY_TYPES.COMPANY,
          entityId: companyId,
          domain: 'admin' as FileDomain,
          category: 'documents' as FileCategory,
          originalFilename: file.name,
          ext,
          contentType: file.type,
          createdBy: user.uid,
          generateThumbnail: true,
        });

        if (isAIClassifiable(file.type, file.name)) {
          classifyFileWithPolicy(result.fileId).catch(() => { /* non-blocking */ });
        }

        successCount++;
      } catch (err) {
        failCount++;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Upload failed', { file: file.name, error: msg });
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (successCount > 0) {
      showSuccess(`${successCount} αρχεί${successCount === 1 ? 'ο' : 'α'} ανέβηκ${successCount === 1 ? 'ε' : 'αν'}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      await refetch();
    }
    if (failCount > 0) {
      showError(`${failCount} αρχεί${failCount === 1 ? 'ο' : 'α'} απέτυχ${failCount === 1 ? 'ε' : 'αν'}`);
    }
  }, [companyId, user?.uid, refetch, showSuccess, showError, setUploading, fileInputRef]);

  // AI auto-classification (ADR-191 Phase 2.2)
  const handleAIClassify = useCallback(async () => {
    const classifiableIds = filteredFiles
      .filter(f => selectedIds.has(f.id) && isAIClassifiable(f.contentType, f.originalFilename, f.ext, f.displayName))
      .map(f => f.id);

    if (classifiableIds.length === 0) {
      showWarning(t('batch.noAIClassifiableFiles'));
      return;
    }
    await classifyBatch(classifiableIds, true);
    refetch();
  }, [selectedIds, filteredFiles, classifyBatch, refetch, showWarning, t]);

  // Dashboard card click handler
  const handleCardClick = useCallback((stat: DashboardStat) => {
    const title = stat.title;
    if (title === t('dashboard.totalFiles')) {
      setFilters(defaultFileFilters);
    } else if (title === t('dashboard.projects')) {
      setFilters(prev => ({ ...prev, entityType: ENTITY_TYPES.PROJECT }));
    }
  }, [t, setFilters]);

  return {
    handleFileClick,
    handleFileDoubleClick,
    handleRename,
    handleDescriptionUpdate,
    handleBatchDelete,
    handleBatchDownload,
    handleBatchClassify,
    handleBatchArchive,
    handleFileUpload,
    handleAIClassify,
    handleCardClick,
  };
}
