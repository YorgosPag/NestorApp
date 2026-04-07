/**
 * =============================================================================
 * EntityFilesManager — Enterprise orchestrator for file management
 * =============================================================================
 *
 * Orchestrates file management for entities by composing:
 * - useEntityFiles (data + CRUD)
 * - useFileUpload (canonical 3-step upload pipeline)
 * - useFileDownload (authenticated backend-proxy download)
 * - useFileAudit (audit trail recording)
 * - useFloorplanAutoProcess (auto-process unprocessed floorplans)
 * - useBatchFileOperations (multi-select + batch operations)
 * - EntityFilesToolbar (toolbar UI)
 * - EntityFilesContent (content area UI)
 *
 * @module components/shared/files/EntityFilesManager
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * @example
 * ```tsx
 * <EntityFilesManager
 *   entityType="contact"
 *   entityId="contact_123"
 *   companyId="company_xyz"
 *   domain="admin"
 *   category="photos"
 *   currentUserId="user_abc"
 * />
 * ```
 */

/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React, { useCallback, useState, useMemo } from 'react';
import { normalizeForSearch } from '@/utils/greek-text';
import { Card } from '@/components/ui/card';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { UPLOAD_LIMITS, DEFAULT_DOCUMENT_ACCEPT } from '@/config/file-upload-config';
import type { FileRecord } from '@/types/file-record';
import type { ContactType } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import type { UploadEntryPoint, FloorInfo } from '@/config/upload-entry-points';
import { FileRecordService } from '@/services/file-record.service';
import { syncPropertyCoverageForRemainingFiles } from '@/services/property/property-file-mutation-gateway';
import {
  buildPropertyFileBatchDeletePreview,
  buildPropertyFileDeletePreview,
  buildPropertyFileUnlinkPreview,
} from '@/services/property/property-file-mutation-preview';
import { unlinkFileFromEntityWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// Hooks
import { useEntityFiles } from './hooks/useEntityFiles';
import { useBatchFileOperations } from './hooks/useBatchFileOperations';
import { useFileAudit } from './hooks/useFileAudit';
import { useFloorplanAutoProcess } from './hooks/useFloorplanAutoProcess';
import { useFileUpload } from './hooks/useFileUpload';
import { useFileDownload } from './hooks/useFileDownload';

// Components
import { EntityFilesToolbar } from './EntityFilesToolbar';
import { EntityFilesContent } from './EntityFilesContent';
import { LinkToBuildingModal } from './LinkToBuildingModal';

// ============================================================================
// TYPES
// ============================================================================

export interface EntityFilesManagerProps {
  entityType: EntityType;
  entityId: string;
  companyId: string;
  domain: FileDomain;
  category: FileCategory;
  currentUserId: string;
  companyName?: string;
  entityLabel?: string;
  projectId?: string;
  purpose?: string;
  maxFileSize?: number;
  acceptedTypes?: string;
  entryPointCategoryFilter?: FileCategory;
  entryPointExcludeCategories?: FileCategory[];
  allowedEntryPointIds?: string[];
  displayStyle?: 'standard' | 'media-gallery' | 'floorplan-gallery';
  contactType?: ContactType;
  activePersonas?: PersonaType[];
  floors?: FloorInfo[];
  enableBuildingLink?: boolean;
  onNavigateToFloors?: () => void;
  navigateToFloorsLabel?: string;
  fetchAllDomains?: boolean;
  /** ADR-236 Phase 3: Filter/tag files by multi-level floor ID */
  levelFloorId?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EntityFilesManager({
  entityType,
  entityId,
  companyId,
  domain,
  category,
  currentUserId,
  companyName,
  entityLabel,
  projectId,
  purpose,
  maxFileSize = UPLOAD_LIMITS.MAX_FILE_SIZE,
  acceptedTypes = DEFAULT_DOCUMENT_ACCEPT,
  entryPointCategoryFilter,
  entryPointExcludeCategories,
  allowedEntryPointIds,
  displayStyle = 'standard',
  contactType,
  activePersonas,
  floors,
  enableBuildingLink = false,
  onNavigateToFloors,
  navigateToFloorsLabel,
  fetchAllDomains,
  levelFloorId,
}: EntityFilesManagerProps) {
  const { t } = useTranslation('files');
  const { activeWorkspace } = useWorkspace();
  const fullscreen = useFullscreen();

  // =========================================================================
  // UI STATE
  // =========================================================================
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree' | 'gallery'>(
    displayStyle === 'standard' ? 'list' : 'gallery',
  );
  const [activeTab, setActiveTab] = useState<'files' | 'trash'>('files');
  const [treeViewMode, setTreeViewMode] = useState<'business' | 'technical'>('business');
  const [selectedEntryPoint, setSelectedEntryPoint] = useState<UploadEntryPoint | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [linkModalFile, setLinkModalFile] = useState<FileRecord | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  // =========================================================================
  // DATA FETCHING
  // =========================================================================
  const {
    files,
    loading,
    error,
    refetch,
    deleteFile,
    renameFile,
    updateDescription,
    totalStorageBytes,
  } = useEntityFiles({
    entityType,
    entityId,
    companyId,
    domain: fetchAllDomains ? undefined : domain,
    category: fetchAllDomains ? undefined : category,
    purpose: fetchAllDomains ? undefined : purpose,
    levelFloorId,
    autoFetch: true,
    realtime: displayStyle === 'floorplan-gallery',
  });

  // =========================================================================
  // FILE FILTERING
  // =========================================================================
  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return files;

    const norm = (s?: string | null) => (s ? normalizeForSearch(s) : '');
    const query = norm(searchTerm.trim());

    return files.filter((file) => {
      const searchableFields = [
        file.displayName, file.originalFilename,
        file.category, file.domain, file.purpose, file.description,
      ].filter(Boolean);
      return searchableFields.some((field) => norm(field).includes(query));
    });
  }, [files, searchTerm]);

  // =========================================================================
  // EXTRACTED HOOKS
  // =========================================================================
  const { recordFileActivity, getFileName } = useFileAudit({
    entityType, entityId, files,
  });

  useFloorplanAutoProcess({
    displayStyle, files: filteredFiles, refetch,
  });

  const { handleUpload, handleCapture, uploading } = useFileUpload({
    companyId, projectId, entityType, entityId,
    domain, category, entityLabel, purpose, levelFloorId, currentUserId,
    selectedEntryPoint, customTitle, refetch, recordFileActivity,
    onUploadComplete: () => {
      setShowUploadZone(false);
      setSelectedEntryPoint(null);
      setCustomTitle('');
    },
  });

  const { handleDownload } = useFileDownload();

  // =========================================================================
  // CRUD HANDLERS (thin wrappers for audit trail)
  // =========================================================================
  const handleDelete = useCallback(async (fileId: string) => {
    const file = files.find((candidate) => candidate.id === fileId);
    if (!file) {
      return;
    }
    const name = getFileName(fileId);
    const remainingFiles = files.filter((file) => file.id !== fileId);
    if (entityType === 'property') {
      const preview = buildPropertyFileDeletePreview({
        category,
        file,
        remainingFiles,
        t,
      });
      if (preview) {
        const confirmed = await confirm(preview);
        if (!confirmed) {
          return;
        }
      }
    }
    await deleteFile(fileId, currentUserId);
    await syncPropertyCoverageForRemainingFiles({
      entityType,
      entityId,
      category,
      remainingFiles,
    });
    recordFileActivity('deleted', 'file_trash', name, null, t('audit.fileTrash'));
  }, [category, confirm, currentUserId, deleteFile, entityId, entityType, files, getFileName, recordFileActivity, t]);

  const handleRename = useCallback((fileId: string, newDisplayName: string) => {
    const oldName = getFileName(fileId);
    renameFile(fileId, newDisplayName, currentUserId);
    recordFileActivity('updated', 'file_rename', oldName, newDisplayName, t('audit.fileRename'));
  }, [renameFile, currentUserId, getFileName, recordFileActivity]);

  const handleDescriptionUpdate = useCallback((fileId: string, description: string) => {
    const name = getFileName(fileId);
    updateDescription(fileId, description);
    recordFileActivity('updated', 'file_description', name, description, t('audit.fileDescriptionUpdate'));
  }, [updateDescription, getFileName, recordFileActivity]);

  const handleLinkClick = useCallback((file: FileRecord) => {
    setLinkModalFile(file);
  }, []);

  const handleUnlink = useCallback(async (fileId: string) => {
    const file = files.find((candidate) => candidate.id === fileId);
    if (!file) {
      return;
    }
    const name = getFileName(fileId);
    if (entityType === 'property') {
      const preview = buildPropertyFileUnlinkPreview({
        category,
        file,
        t,
      });
      if (preview) {
        const confirmed = await confirm(preview);
        if (!confirmed) {
          return;
        }
      }
    }
    await unlinkFileFromEntityWithPolicy(fileId, entityType, entityId);
    recordFileActivity('unlinked', 'file_unlink', name, null, t('audit.fileUnlink'));
    await refetch();
  }, [category, confirm, entityId, entityType, files, getFileName, recordFileActivity, refetch, t]);

  const handleView = useCallback((file: FileRecord) => {
    setSelectedFile(file);
  }, []);

  // =========================================================================
  // BATCH OPERATIONS
  // =========================================================================
  const {
    selectedIds, toggleSelect, selectAll, clearSelection,
    handleBatchDelete: batchDeleteRaw,
    handleBatchDownload,
    handleBatchClassify,
    handleBatchArchive: batchArchiveRaw,
    handleAIClassify, aiClassifying,
  } = useBatchFileOperations({
    files: filteredFiles, currentUserId, refetch,
  });

  const handleBatchDelete = useCallback(async () => {
    const deletedIds = new Set(selectedIds);
    const names = Array.from(selectedIds).map(getFileName);
    const filesToDelete = files.filter((file) => deletedIds.has(file.id));
    const remainingFiles = files.filter((file) => !deletedIds.has(file.id));
    if (entityType === 'property') {
      const preview = buildPropertyFileBatchDeletePreview({
        category,
        filesToDelete,
        remainingFiles,
        t,
      });
      if (preview) {
        const confirmed = await confirm(preview);
        if (!confirmed) {
          return;
        }
      }
    }
    await batchDeleteRaw();
    await syncPropertyCoverageForRemainingFiles({
      entityType,
      entityId,
      category,
      remainingFiles,
    });
    for (const name of names) {
      recordFileActivity('deleted', 'file_trash', name, null, t('audit.fileBatchTrash'));
    }
  }, [batchDeleteRaw, category, confirm, entityId, entityType, files, getFileName, recordFileActivity, selectedIds, t]);

  const handleBatchArchive = useCallback(async () => {
    const names = Array.from(selectedIds).map(getFileName);
    await batchArchiveRaw();
    for (const name of names) {
      recordFileActivity('updated', 'file_archive', name, null, t('audit.fileArchive'));
    }
  }, [batchArchiveRaw, selectedIds, getFileName, recordFileActivity]);

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      fullscreenClassName="rounded-none"
      ariaLabel={t('manager.filesTitle')}
    >
      <Card className={cn('w-full', fullscreen.isFullscreen && 'h-full flex flex-col rounded-none border-0')}>
        <EntityFilesToolbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          treeViewMode={treeViewMode}
          onTreeViewModeChange={setTreeViewMode}
          displayStyle={displayStyle}
          category={category}
          onToggleUploadZone={() => setShowUploadZone(!showUploadZone)}
          onCapture={handleCapture}
          uploading={uploading}
          loading={loading}
          onRefresh={() => refetch()}
          fullscreen={fullscreen}
          fileCount={files.length}
          workspaceName={activeWorkspace?.displayName}
        />

        <EntityFilesContent
          activeTab={activeTab}
          isFullscreen={fullscreen.isFullscreen}
          showUploadZone={showUploadZone}
          onCloseUploadZone={() => setShowUploadZone(false)}
          selectedEntryPoint={selectedEntryPoint}
          onSelectEntryPoint={setSelectedEntryPoint}
          customTitle={customTitle}
          onCustomTitleChange={setCustomTitle}
          entityType={entityType}
          entryPointCategoryFilter={entryPointCategoryFilter}
          entryPointExcludeCategories={entryPointExcludeCategories}
          allowedEntryPointIds={allowedEntryPointIds}
          contactType={contactType}
          activePersonas={activePersonas}
          floors={floors}
          onNavigateToFloors={onNavigateToFloors}
          navigateToFloorsLabel={navigateToFloorsLabel}
          onUpload={handleUpload}
          acceptedTypes={acceptedTypes}
          maxFileSize={maxFileSize}
          uploading={uploading}
          files={files}
          filteredFiles={filteredFiles}
          loading={loading}
          error={error}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          viewMode={viewMode}
          treeViewMode={treeViewMode}
          displayStyle={displayStyle}
          fetchAllDomains={fetchAllDomains}
          companyName={companyName}
          onDelete={handleDelete}
          onRename={handleRename}
          onDescriptionUpdate={handleDescriptionUpdate}
          onView={handleView}
          onDownload={handleDownload}
          onLinkClick={enableBuildingLink ? handleLinkClick : undefined}
          onUnlink={handleUnlink}
          enableBuildingLink={enableBuildingLink}
          currentUserId={currentUserId}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          batchActions={{
            selectAll,
            clearSelection,
            onBatchDelete: handleBatchDelete,
            onBatchDownload: handleBatchDownload,
            onBatchClassify: handleBatchClassify,
            onAIClassify: handleAIClassify,
            aiClassifying,
            onBatchArchive: handleBatchArchive,
          }}
          totalStorageBytes={totalStorageBytes}
          companyId={companyId}
          entityId={entityId}
          onRestore={(fileId: string) => {
            recordFileActivity('updated', 'file_restore', null, fileId, t('audit.fileRestore'));
            refetch();
          }}
        />

        {enableBuildingLink && linkModalFile && entityId && (
          <LinkToBuildingModal
            open={!!linkModalFile}
            onOpenChange={(open) => { if (!open) setLinkModalFile(null); }}
            file={linkModalFile}
            projectId={entityId}
            onSaved={() => {
              setLinkModalFile(null);
              refetch();
            }}
          />
        )}
      </Card>
      <ConfirmDialog {...dialogProps} />
    </FullscreenOverlay>
  );
}
