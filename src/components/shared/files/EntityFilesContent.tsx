/**
 * =============================================================================
 * EntityFilesContent — Content area for EntityFilesManager
 * =============================================================================
 *
 * Presentational component for the main content area:
 * - Batch actions bar
 * - Upload zone with entry point selector
 * - Search input
 * - Split-panel layout (file views + preview panel)
 * - Gallery / List / Tree view dispatch
 * - Trash view
 * - Storage footer
 *
 * Extracted from EntityFilesManager for Google SRP compliance.
 *
 * @module components/shared/files/EntityFilesContent
 * @enterprise ADR-031 - Canonical File Storage System
 */

/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React from 'react';
import { ArrowUp, X as XIcon } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { FilePreviewPanel } from '@/components/file-manager/FilePreviewPanel';
import { BatchActionsBar } from '@/components/file-manager/BatchActionsBar';
import { FileThumbnail } from './FileThumbnail';
import { formatFileSize } from '@/utils/file-validation';
import type { EntityType, FileCategory, FileClassification } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import type { FileRecordWithLinkStatus } from './hooks/useEntityFiles';
import type { ContactType } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import type { UploadEntryPoint, FloorInfo } from '@/config/upload-entry-points';
import { getAvailableGroups } from '@/config/upload-entry-points';
import { FilesList } from './FilesList';
import { GroupedFilesList } from './GroupedFilesList';
import { FilePathTree } from './FilePathTree';
import { FileUploadZone } from './FileUploadZone';
import { UploadEntryPointSelector } from './UploadEntryPointSelector';
import { HierarchicalEntryPointSelector } from './HierarchicalEntryPointSelector';
import { TrashView } from './TrashView';
import { MediaGallery } from './media';
import { FloorplanGallery } from './media/FloorplanGallery';

// ============================================================================
// TYPES
// ============================================================================

interface BatchActions {
  selectAll: () => void;
  clearSelection: () => void;
  onBatchDelete: () => Promise<void>;
  onBatchDownload: () => Promise<void>;
  onBatchClassify: (classification: FileClassification) => Promise<void>;
  onAIClassify: () => Promise<void>;
  aiClassifying: boolean;
  onBatchArchive: () => Promise<void>;
}

export interface EntityFilesContentProps {
  activeTab: 'files' | 'trash';
  isFullscreen: boolean;
  // Upload zone
  showUploadZone: boolean;
  onCloseUploadZone: () => void;
  selectedEntryPoint: UploadEntryPoint | null;
  onSelectEntryPoint: (ep: UploadEntryPoint | null) => void;
  customTitle: string;
  onCustomTitleChange: (title: string) => void;
  // Entry point config
  entityType: EntityType;
  entryPointCategoryFilter?: FileCategory;
  entryPointExcludeCategories?: FileCategory[];
  allowedEntryPointIds?: string[];
  contactType?: ContactType;
  activePersonas?: PersonaType[];
  floors?: FloorInfo[];
  onNavigateToFloors?: () => void;
  navigateToFloorsLabel?: string;
  // Upload
  onUpload: (files: File[]) => Promise<void>;
  acceptedTypes: string;
  maxFileSize: number;
  uploading: boolean;
  // Files data
  files: FileRecordWithLinkStatus[];
  filteredFiles: FileRecordWithLinkStatus[];
  loading: boolean;
  error: Error | null;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  // View state
  viewMode: 'list' | 'tree' | 'gallery';
  treeViewMode: 'business' | 'technical';
  displayStyle: 'standard' | 'media-gallery' | 'floorplan-gallery';
  fetchAllDomains?: boolean;
  companyName?: string;
  // File operations
  onDelete: (fileId: string) => Promise<void>;
  onRename: (fileId: string, newDisplayName: string) => void;
  onDescriptionUpdate: (fileId: string, description: string) => void;
  onView: (file: FileRecord) => void;
  onDownload: (file: { storagePath?: string; downloadUrl?: string; displayName: string }) => Promise<void>;
  onLinkClick?: (file: FileRecord) => void;
  onUnlink: (fileId: string) => Promise<void>;
  enableBuildingLink: boolean;
  currentUserId: string;
  // Selection
  selectedIds: Set<string>;
  toggleSelect: (fileId: string) => void;
  // Preview
  selectedFile: FileRecord | null;
  onSelectFile: (file: FileRecord | null) => void;
  // Batch
  batchActions: BatchActions;
  // Storage
  totalStorageBytes: number;
  // Trash
  companyId: string;
  entityId: string;
  onRestore: (fileId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EntityFilesContent(props: EntityFilesContentProps) {
  const { t } = useTranslation('files');

  return (
    <CardContent className={cn('space-y-2', props.isFullscreen && 'flex-1 min-h-0 overflow-auto')}>
      {/* Upload Pipeline (conditional) - Only show on files tab */}
      {props.activeTab === 'files' && props.showUploadZone && (
        <UploadZoneSection {...props} />
      )}

      {/* Error display */}
      {props.error && (
        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{t('manager.errorLoading')}: {props.error.message}</p>
        </div>
      )}

      {/* Tab content - Files or Trash */}
      {props.activeTab === 'files' ? (
        <FilesTabContent {...props} />
      ) : (
        <TrashView
          companyId={props.companyId}
          currentUserId={props.currentUserId}
          entityType={props.entityType}
          entityId={props.entityId}
          onRestore={props.onRestore}
        />
      )}
    </CardContent>
  );
}

// ============================================================================
// INTERNAL: Upload Zone Section
// ============================================================================

function UploadZoneSection({
  onCloseUploadZone, onSelectEntryPoint, selectedEntryPoint,
  customTitle, onCustomTitleChange, entityType,
  entryPointCategoryFilter, entryPointExcludeCategories, allowedEntryPointIds,
  contactType, activePersonas, floors, onNavigateToFloors, navigateToFloorsLabel,
  onUpload, acceptedTypes, maxFileSize, uploading,
}: EntityFilesContentProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');
  return (
    <div className="relative space-y-2 p-2 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { onCloseUploadZone(); onSelectEntryPoint(null); }}
        className="absolute top-1 right-1 h-7 w-7 p-0"
        aria-label={t('common.close')}
      >
        <XIcon className={iconSizes.sm} />
      </Button>

      {/* Entry Point Selection — flat (contacts) vs hierarchical (projects/buildings) */}
      {getAvailableGroups(entityType).length > 0 ? (
        <HierarchicalEntryPointSelector
          entityType={entityType}
          selectedEntryPointId={selectedEntryPoint?.id}
          onSelect={onSelectEntryPoint}
          customTitle={customTitle}
          onCustomTitleChange={onCustomTitleChange}
          categoryFilter={entryPointCategoryFilter}
          excludeCategories={entryPointExcludeCategories}
          allowedEntryPointIds={allowedEntryPointIds}
          floors={floors}
          onNavigateToFloors={onNavigateToFloors}
          navigateToFloorsLabel={navigateToFloorsLabel}
        />
      ) : (
        <UploadEntryPointSelector
          entityType={entityType}
          selectedEntryPointId={selectedEntryPoint?.id}
          onSelect={onSelectEntryPoint}
          customTitle={customTitle}
          onCustomTitleChange={onCustomTitleChange}
          categoryFilter={entryPointCategoryFilter}
          excludeCategories={entryPointExcludeCategories}
          allowedEntryPointIds={allowedEntryPointIds}
          contactType={contactType}
          activePersonas={activePersonas}
        />
      )}

      {/* File Upload Zone */}
      {selectedEntryPoint && (
        <>
          {(!selectedEntryPoint.requiresCustomTitle || customTitle.trim() !== '') ? (
            <FileUploadZone
              onUpload={onUpload}
              accept={acceptedTypes}
              maxSize={maxFileSize}
              multiple
              disabled={uploading}
              uploading={uploading}
            />
          ) : (
            <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <ArrowUp className={iconSizes.sm} aria-hidden="true" />
              {t('manager.enterTitleToContinue')}
            </div>
          )}
        </>
      )}

      {/* Hint when no entry point selected */}
      {!selectedEntryPoint && (
        <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <ArrowUp className={iconSizes.sm} aria-hidden="true" />
          {t('manager.selectDocumentType')}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INTERNAL: Files Tab Content
// ============================================================================

function FilesTabContent(props: EntityFilesContentProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');

  return (
    <>
      {/* Batch Actions Bar */}
      {props.selectedIds.size > 0 && (
        <div className="pb-2">
          <BatchActionsBar
            selectedCount={props.selectedIds.size}
            totalCount={props.filteredFiles.length}
            onSelectAll={props.batchActions.selectAll}
            onClearSelection={props.batchActions.clearSelection}
            onBatchDelete={props.batchActions.onBatchDelete}
            onBatchDownload={props.batchActions.onBatchDownload}
            onBatchClassify={props.batchActions.onBatchClassify}
            onAIClassify={props.batchActions.onAIClassify}
            aiClassifying={props.batchActions.aiClassifying}
            onBatchArchive={props.batchActions.onBatchArchive}
          />
        </div>
      )}

      {/* File Search (Google Drive/Dropbox/OneDrive pattern) */}
      {props.files.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={props.searchTerm}
              onChange={props.onSearchTermChange}
              placeholder={t('search.placeholder')}
              debounceMs={300}
              showClearButton
            />
          </div>
          {props.searchTerm && (
            <span className="text-sm text-muted-foreground">
              {t('search.results', { count: props.filteredFiles.length, total: props.files.length })}
            </span>
          )}
        </div>
      )}

      {/* Split-panel layout — file list + inline preview */}
      <ResizablePanelGroup orientation="horizontal" className="min-h-[400px] rounded-lg">
        <ResizablePanel defaultSize={props.selectedFile ? 45 : 100} minSize={30}>
          <FileViewDispatch {...props} iconSizes={iconSizes} />
        </ResizablePanel>

        {props.selectedFile && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={55} minSize={30}>
              <FilePreviewPanel
                file={props.selectedFile}
                onClose={() => props.onSelectFile(null)}
                companyId={props.companyId}
                currentUserId={props.currentUserId}
                onRefresh={() => { /* refetch handled by parent */ }}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Storage info */}
      {props.totalStorageBytes > 0 && (
        <footer className="pt-4 border-t text-xs text-muted-foreground">
          {t('manager.totalStorage')}: {(props.totalStorageBytes / 1024 / 1024).toFixed(2)} MB
        </footer>
      )}
    </>
  );
}

// ============================================================================
// INTERNAL: File View Dispatch (gallery / list / tree)
// ============================================================================

function FileViewDispatch(props: EntityFilesContentProps & { iconSizes: ReturnType<typeof useIconSizes> }) {
  if (props.viewMode === 'gallery') {
    return <GalleryView {...props} />;
  }

  if (props.viewMode === 'list') {
    if (getAvailableGroups(props.entityType).length > 0) {
      return (
        <GroupedFilesList
          files={props.filteredFiles}
          loading={props.loading}
          onDelete={props.onDelete}
          onRename={props.onRename}
          onDescriptionUpdate={props.onDescriptionUpdate}
          onView={props.onView}
          onDownload={props.onDownload}
          currentUserId={props.currentUserId}
          onLink={props.enableBuildingLink ? props.onLinkClick : undefined}
          onUnlink={props.onUnlink}
          showLinkAction={props.enableBuildingLink}
          entityType={props.entityType}
          selectedIds={props.selectedIds}
          onToggleSelect={props.toggleSelect}
        />
      );
    }

    return (
      <FilesList
        files={props.filteredFiles}
        loading={props.loading}
        onDelete={props.onDelete}
        onRename={props.onRename}
        onDescriptionUpdate={props.onDescriptionUpdate}
        onView={props.onView}
        onDownload={props.onDownload}
        currentUserId={props.currentUserId}
        onLink={props.enableBuildingLink ? props.onLinkClick : undefined}
        onUnlink={props.onUnlink}
        showLinkAction={props.enableBuildingLink}
        entityType={props.entityType}
        selectedIds={props.selectedIds}
        onToggleSelect={props.toggleSelect}
      />
    );
  }

  // Tree view
  return (
    <FilePathTree
      files={props.filteredFiles}
      onFileSelect={props.onView}
      contextLevel="full"
      companyName={props.companyName}
      viewMode={props.treeViewMode}
      groupByStudyGroup={props.fetchAllDomains && props.treeViewMode === 'business'}
    />
  );
}

// ============================================================================
// INTERNAL: Gallery View
// ============================================================================

function GalleryView(props: EntityFilesContentProps) {
  const { t } = useTranslation('files');
  if (props.displayStyle === 'floorplan-gallery') {
    return (
      <FloorplanGallery
        files={props.filteredFiles}
        onDelete={async (file) => { await props.onDelete(file.id); }}
        onDownload={props.onDownload}
        onRefresh={() => { /* refetch handled by parent */ }}
        emptyMessage={t('floorplan.noFloorplans')}
      />
    );
  }

  if (props.displayStyle === 'media-gallery') {
    return (
      <MediaGallery
        files={props.filteredFiles}
        initialViewMode="grid"
        showToolbar={false}
        enableSelection
        cardSize="md"
        onDelete={async (filesToDelete) => {
          for (const file of filesToDelete) {
            await props.onDelete(file.id);
          }
        }}
        emptyMessage={t('media.noMedia')}
      />
    );
  }

  // Document Card Gallery
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {props.filteredFiles.map((file) => (
        <article
          key={file.id}
          className="cursor-pointer rounded-lg border bg-card hover:bg-accent/50 transition-colors p-4 flex flex-col items-center text-center gap-3"
          onClick={() => props.onView(file)}
        >
          <FileThumbnail
            ext={file.ext}
            contentType={file.contentType}
            thumbnailUrl={file.thumbnailUrl}
            downloadUrl={file.downloadUrl}
            displayName={file.displayName || ''}
            size="md"
          />
          <p className="text-sm font-medium truncate w-full">
            {file.displayName || file.originalFilename}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.sizeBytes || 0)}
          </p>
        </article>
      ))}
      {props.filteredFiles.length === 0 && (
        <p className="col-span-full text-center text-muted-foreground py-8">
          {t('manager.noFiles')}
        </p>
      )}
    </section>
  );
}
