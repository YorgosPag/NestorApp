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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { FileRecordService } from '@/services/file-record.service';
import { getFileExtension } from '@/services/upload/utils/storage-path';
import { generateUploadThumbnail, buildThumbnailPath } from '@/components/shared/files/utils/generate-upload-thumbnail';
import { isAIClassifiable } from '@/components/shared/files/hooks/useFileClassification';
import { defaultFileFilters } from '@/components/core/AdvancedFilters';
import { createModuleLogger } from '@/lib/telemetry';
import { API_ROUTES } from '@/config/domain-constants';
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
    showSuccess, showError, t,
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
      await FileRecordService.renameFile(fileId, newDisplayName, user.uid);
      refetch();
    } catch (err) {
      logger.error('Rename failed', { fileId, error: err });
    }
  }, [user?.uid, refetch]);

  const handleDescriptionUpdate = useCallback(async (fileId: string, description: string) => {
    try {
      await FileRecordService.updateDescription(fileId, description);
      refetch();
    } catch (err) {
      logger.error('Description update failed', { fileId, error: err });
    }
  }, [refetch]);

  // Batch operations
  const handleBatchDelete = useCallback(async () => {
    if (!user?.uid) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => FileRecordService.moveToTrash(id, user.uid)));
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, user?.uid, refetch, setSelectedIds]);

  const handleBatchDownload = useCallback(async () => {
    const selected = filteredFiles.filter(f => selectedIds.has(f.id) && f.downloadUrl);
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
  }, [selectedIds, filteredFiles]);

  const handleBatchClassify = useCallback(async (classification: FileClassification) => {
    const ids = Array.from(selectedIds);
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    await Promise.all(ids.map(id =>
      updateDoc(doc(db, 'files', id), { classification })
    ));
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, refetch, setSelectedIds]);

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
  }, [selectedIds, refetch, setSelectedIds]);

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

        const { fileId, storagePath } = await FileRecordService.createPendingFileRecord({
          companyId,
          entityType: 'company',
          entityId: companyId,
          domain: 'admin',
          category: 'documents',
          originalFilename: file.name,
          ext,
          contentType: file.type,
          createdBy: user.uid,
        });

        await new Promise(resolve => setTimeout(resolve, 300));

        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        let thumbnailUrl: string | undefined;
        try {
          const thumbBlob = await generateUploadThumbnail(file, file.type);
          if (thumbBlob) {
            const thumbPath = buildThumbnailPath(storagePath);
            const thumbRef = ref(storage, thumbPath);
            await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' });
            thumbnailUrl = await getDownloadURL(thumbRef);
          }
        } catch {
          // Non-blocking
        }

        await FileRecordService.finalizeFileRecord({
          fileId,
          sizeBytes: file.size,
          downloadUrl,
          thumbnailUrl,
        });

        if (isAIClassifiable(file.type)) {
          fetch(API_ROUTES.FILES.CLASSIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId }),
          }).catch(() => { /* non-blocking */ });
        }

        successCount++;
      } catch (err) {
        failCount++;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Upload failed', { file: file.name, error: msg });
        console.error('[FileManager] Upload error:', err);
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
      .filter(f => selectedIds.has(f.id) && isAIClassifiable(f.contentType))
      .map(f => f.id);

    if (classifiableIds.length === 0) return;
    await classifyBatch(classifiableIds);
    refetch();
  }, [selectedIds, filteredFiles, classifyBatch, refetch]);

  // Dashboard card click handler
  const handleCardClick = useCallback((stat: DashboardStat) => {
    const title = stat.title;
    if (title === t('dashboard.totalFiles')) {
      setFilters(defaultFileFilters);
    } else if (title === t('dashboard.projects')) {
      setFilters(prev => ({ ...prev, entityType: 'project' }));
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
