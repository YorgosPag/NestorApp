 
 
/**
 * =============================================================================
 * 🏢 ENTERPRISE: FileManagerPageContent
 * =============================================================================
 *
 * Central File Manager page για εμφάνιση ΟΛΩΝ των αρχείων της εταιρείας.
 * Παρέχει tree view, list view, gallery view, search, και trash view.
 *
 * Enterprise Patterns: Google Drive, Dropbox Business, Procore Documents
 *
 * @module components/file-manager/FileManagerPageContent
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * 🏢 ENTERPRISE UPDATE (2026-01-24):
 * - Full toolbar matching EntityFilesManager (Procore/BIM360 pattern)
 * - Full-width layout
 * - Card/Gallery view support
 * - Dashboard toggle
 * - Advanced filters
 *
 * 🏢 REFACTORED (2026-03-28): Split into SRP modules:
 * - useFileManagerState.ts — state & computed values
 * - file-manager-handlers.ts — event handlers
 * - FileManagerToolbar.tsx — toolbar component
 * - FileManagerErrorView.tsx — error view component
 */

'use client';

import React from 'react';
import {
  FolderTree,
  Files,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoadingState } from '@/core/states';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FileThumbnail } from '@/components/shared/files/FileThumbnail';
import { Badge } from '@/components/ui/badge';
import { formatFileSize } from '@/utils/file-validation';

// 🏢 ENTERPRISE: Error Boundary
import {
  PageErrorBoundary,
  EnterpriseErrorBoundary,
} from '@/components/ui/ErrorBoundary/ErrorBoundary';

// 🏢 ENTERPRISE: Centralized Headers
import { PageHeader } from '@/core/headers';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';

// 🏢 ENTERPRISE: Centralized Dashboard
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';

// 🏢 ENTERPRISE: Centralized Filters
import { AdvancedFiltersPanel, fileFiltersConfig } from '@/components/core/AdvancedFilters';

// Split-panel layout
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { FilePreviewPanel } from './FilePreviewPanel';

// Local components
import { CompanyFileTree } from './CompanyFileTree';
import { FilesList } from '@/components/shared/files/FilesList';
import { TrashView } from '@/components/shared/files/TrashView';
import { InboxView } from '@/components/shared/files/InboxView';
import { BatchActionsBar } from './BatchActionsBar';

// 🏢 SRP Extracted modules
import { useFileManagerState } from './useFileManagerState';
import { useFileManagerHandlers } from './file-manager-handlers';
import { FileManagerToolbar } from './FileManagerToolbar';
import { FileManagerErrorView } from './FileManagerErrorView';

import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// Re-exports for backward compatibility
// ============================================================================

export type { ViewMode, ActiveTab } from './useFileManagerState';

// ============================================================================
// FILE CARD COMPONENT (for gallery view)
// ============================================================================

interface FileCardProps {
  file: FileRecord;
  onClick?: (file: FileRecord) => void;
  onDoubleClick?: (file: FileRecord) => void;
}

function FileCard({ file, onClick, onDoubleClick }: FileCardProps) {
  const { t } = useTranslation('files');
  const colors = useSemanticColors();

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onClick?.(file)}
      onDoubleClick={() => onDoubleClick?.(file)}
    >
      <CardContent className="p-4">
        <article className="flex flex-col items-center text-center gap-3">
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
          <p className={cn('text-xs', colors.text.muted)}>
            {formatFileSize(file.sizeBytes || 0)}
          </p>
          <Badge variant="secondary" className="text-xs">
            {t(`categories.${file.category}`) || file.category}
          </Badge>
        </article>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FileManagerPageContent() {
  const colors = useSemanticColors();
  const state = useFileManagerState();
  const handlers = useFileManagerHandlers({ state });

  const {
    t, user, activeWorkspace, companyId,
    viewMode, setViewMode, treeViewMode, setTreeViewMode,
    activeTab, setActiveTab, selectedFile, setSelectedFile,
    searchTerm, setSearchTerm,
    selectedIds, setSelectedIds, toggleSelect,
    fileInputRef, uploading,
    classifyingIds,
    showDashboard, setShowDashboard,
    filters, setFilters, showFilters, setShowFilters,
    files, trashedFiles: _trashedFiles, filteredFiles,
    loading, error, refetch,
    dashboardStats,
    triggerError, setTriggerError,
  } = state;

  const {
    handleFileClick, handleFileDoubleClick,
    handleRename, handleDescriptionUpdate,
    handleBatchDelete, handleBatchDownload,
    handleBatchClassify, handleBatchArchive,
    handleFileUpload, handleAIClassify, handleCardClick,
  } = handlers;

  const headerTitle = t('header.title');

  // Loading state — no company
  if (!companyId) {
    return (
      <main className="flex items-center justify-center min-h-[400px]">
        <section className="text-center">
          <Files className={cn('h-12 w-12 mx-auto mb-4 opacity-50', colors.text.muted)} />
          <p className={colors.text.muted}>{t('manager.noCompany')}</p>
        </section>
      </main>
    );
  }

  // ADR-229 Phase 2: Data-level loading guard
  if (loading) {
    return <PageLoadingState icon={Files} message={t('manager.loading')} layout="contained" />;
  }

  if (error) {
    return <FileManagerErrorView error={error} onRetry={() => refetch()} t={t} />;
  }

  // Debug: Trigger test error (caught by ErrorBoundary)
  if (triggerError) {
    throw new Error('[ΔΟΚΙΜΗ] Αυτό είναι δοκιμαστικό σφάλμα για testing του Error Reporting System.');
  }

  return (
    <>
      <main className="flex flex-col h-full w-full bg-background">
        {/* Centralized PageHeader */}
        <PageHeader
          variant="sticky-rounded"
          layout="compact"
          spacing="compact"
          title={{
            icon: FolderTree,
            title: headerTitle,
            subtitle: activeWorkspace?.displayName || t('header.subtitle'),
          }}
          breadcrumb={<NavigationBreadcrumb />}
          actions={{
            showDashboard,
            onDashboardToggle: () => setShowDashboard(!showDashboard),
            viewMode: 'list',
            onViewModeChange: () => {},
            viewModes: ['list'],
            addButton: { label: t('manager.refresh'), onClick: () => refetch() },
          }}
        />

        {/* Collapsible Dashboard */}
        {showDashboard && (
          <section role="region" aria-label={t('dashboard.label')} className="px-4">
            <UnifiedDashboard stats={dashboardStats} columns={5} onCardClick={handleCardClick} />
          </section>
        )}

        {/* Advanced Filters Panel */}
        <aside className="hidden md:block px-4" role="complementary" aria-label={t('filters.desktop')}>
          <AdvancedFiltersPanel config={fileFiltersConfig} filters={filters} onFiltersChange={setFilters} />
        </aside>

        {/* Mobile Filters */}
        {showFilters && (
          <aside className="md:hidden px-4" role="complementary" aria-label={t('filters.mobile')}>
            <AdvancedFiltersPanel config={fileFiltersConfig} filters={filters} onFiltersChange={setFilters} defaultOpen />
          </aside>
        )}

        {/* Main Content Card */}
        <section className="flex-1 px-4 pb-4 overflow-hidden">
          <Card className="h-full flex flex-col">
            {/* Toolbar */}
            <FileManagerToolbar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              treeViewMode={treeViewMode}
              onTreeViewModeChange={setTreeViewMode}
              filteredCount={filteredFiles.length}
              filesCount={files.length}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              uploading={uploading}
              loading={loading}
              showFilters={showFilters}
              onUploadClick={() => fileInputRef.current?.click()}
              onRefresh={() => refetch()}
              onFilterToggle={() => setShowFilters(!showFilters)}
              onTriggerError={() => setTriggerError(true)}
              t={t}
            />

            {/* Batch actions bar */}
            {selectedIds.size > 0 && activeTab === 'files' && (
              <div className="px-4 pb-2">
                <BatchActionsBar
                  selectedCount={selectedIds.size}
                  totalCount={filteredFiles.length}
                  onSelectAll={() => setSelectedIds(new Set(filteredFiles.map(f => f.id)))}
                  onClearSelection={() => setSelectedIds(new Set())}
                  onBatchDelete={handleBatchDelete}
                  onBatchDownload={handleBatchDownload}
                  onBatchClassify={handleBatchClassify}
                  onAIClassify={handleAIClassify}
                  aiClassifying={classifyingIds.size > 0}
                  onBatchArchive={handleBatchArchive}
                />
              </div>
            )}

            {/* Content — Split panel: file list + preview */}
            <CardContent className="flex-1 overflow-hidden p-0">
              {activeTab === 'files' ? (
                <ResizablePanelGroup orientation="horizontal" className="h-full min-h-[500px]">
                  {/* File browser panel */}
                  <ResizablePanel defaultSize={40} minSize={15} className="overflow-auto">
                    {filteredFiles.length === 0 ? (
                      <section className="flex flex-col items-center justify-center h-full min-h-[300px] p-8">
                        <Files className={cn('h-12 w-12 opacity-50 mb-4', colors.text.muted)} />
                        <p className={cn('text-center', colors.text.muted)}>
                          {searchTerm || filters.category !== 'all' || filters.entityType !== 'all'
                            ? t('manager.noSearchResults')
                            : t('manager.noFiles')}
                        </p>
                      </section>
                    ) : viewMode === 'gallery' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
                        {filteredFiles.map((file) => (
                          <FileCard
                            key={file.id}
                            file={file}
                            onClick={handleFileClick}
                            onDoubleClick={handleFileDoubleClick}
                          />
                        ))}
                      </div>
                    ) : viewMode === 'tree' ? (
                      <CompanyFileTree
                        files={filteredFiles}
                        companyName={activeWorkspace?.displayName || 'Company'}
                        groupingMode="entity"
                        viewMode={treeViewMode}
                        onFileClick={handleFileClick}
                        onFileDoubleClick={handleFileDoubleClick}
                        onRename={handleRename}
                        className="h-full"
                      />
                    ) : (
                      <FilesList
                        files={filteredFiles}
                        onView={handleFileClick}
                        onRename={handleRename}
                        onDescriptionUpdate={handleDescriptionUpdate}
                        currentUserId={user?.uid}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                      />
                    )}
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* Right panel: preview */}
                  <ResizablePanel defaultSize={60} minSize={25} className="overflow-hidden">
                    <FilePreviewPanel
                      file={selectedFile}
                      onClose={() => setSelectedFile(null)}
                      companyId={companyId}
                      currentUserId={user?.uid}
                      currentUserName={user?.displayName || undefined}
                      onRefresh={refetch}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : activeTab === 'inbox' ? (
                <EnterpriseErrorBoundary componentName="Inbox View" enableRetry enableReporting>
                  <InboxView companyId={companyId} currentUserId={user?.uid || ''} onRefresh={() => refetch()} />
                </EnterpriseErrorBoundary>
              ) : (
                <EnterpriseErrorBoundary componentName="Trash View" enableRetry enableReporting>
                  <TrashView companyId={companyId} currentUserId={user?.uid || ''} onRestore={() => refetch()} />
                </EnterpriseErrorBoundary>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Hidden file input for direct upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.dwg,.dxf"
      />
    </>
  );
}

// 🏢 ENTERPRISE: Wrapped with PageErrorBoundary for automatic error reporting
export default function FileManagerPage() {
  return (
    <PageErrorBoundary enableRetry maxRetries={3} enableReporting>
      <FileManagerPageContent />
    </PageErrorBoundary>
  );
}
