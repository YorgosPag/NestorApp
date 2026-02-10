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
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  FolderTree,
  List,
  Grid3X3,
  Eye,
  Code,
  Trash2,
  Files,
  RefreshCw,
  Network,
  Layers,
  HardDrive,
  Filter,
  Image,
  FileText,
  Video,
  Upload,
  Inbox,
} from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { SearchInput } from '@/components/ui/search';

// 🏢 ENTERPRISE: Error Boundary with Admin Notification
import {
  PageErrorBoundary,
  EnterpriseErrorBoundary,
  useErrorReporting,
  openEmailCompose,
  EMAIL_PROVIDERS,
  type EmailProvider
} from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { AlertTriangle, Mail } from 'lucide-react';
import { notificationConfig } from '@/config/error-reporting';

// 🏢 ENTERPRISE: Centralized Headers
import { PageHeader } from '@/core/headers';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';

// 🏢 ENTERPRISE: Centralized Dashboard
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';

// 🏢 ENTERPRISE: Centralized Filters
import {
  AdvancedFiltersPanel,
  fileFiltersConfig,
  defaultFileFilters,
  type FileFilterState
} from '@/components/core/AdvancedFilters';

// Local components
import { useAllCompanyFiles } from './hooks/useAllCompanyFiles';
import { CompanyFileTree, type GroupingMode, type ViewMode as TreeViewMode } from './CompanyFileTree';
import { FilesList } from '@/components/shared/files/FilesList';
import { TrashView } from '@/components/shared/files/TrashView';
import { InboxView } from '@/components/shared/files/InboxView';
import { formatFileSize } from '@/utils/file-validation';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'list' | 'tree' | 'gallery';
type ActiveTab = 'files' | 'trash' | 'inbox';

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

  // 🏢 ENTERPRISE: Type assertion for optional thumbnailUrl (not in base FileRecord)
  const fileWithThumbnail = file as FileRecord & { thumbnailUrl?: string };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'photos': return <Image className="h-8 w-8 text-blue-500" />;
      case 'videos': return <Video className="h-8 w-8 text-purple-500" />;
      case 'floorplans': return <Network className="h-8 w-8 text-orange-500" />;
      case 'contracts': return <FileText className="h-8 w-8 text-green-500" />;
      default: return <Files className="h-8 w-8 text-gray-500" />;
    }
  };

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onClick?.(file)}
      onDoubleClick={() => onDoubleClick?.(file)}
    >
      <CardContent className="p-4">
        <article className="flex flex-col items-center text-center gap-3">
          {/* Thumbnail or Icon */}
          {fileWithThumbnail.thumbnailUrl ? (
            <img
              src={fileWithThumbnail.thumbnailUrl}
              alt={file.displayName || ''}
              className="h-16 w-16 object-cover rounded"
            />
          ) : (
            <figure className="h-16 w-16 flex items-center justify-center bg-muted rounded">
              {getCategoryIcon(file.category || 'documents')}
            </figure>
          )}

          {/* File name */}
          <p className="text-sm font-medium truncate w-full">
            {file.displayName || file.originalFilename}
          </p>

          {/* Size */}
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.sizeBytes || 0)}
          </p>

          {/* Category badge */}
          <Badge variant="secondary" className="text-xs">
            {t(`categories.${file.category}`) || file.category}
          </Badge>
        </article>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ERROR VIEW COMPONENT (Enterprise Error Reporting)
// ============================================================================

interface FileManagerErrorViewProps {
  error: Error;
  onRetry: () => void;
  t: (key: string) => string;
}

function FileManagerErrorView({ error, onRetry, t }: FileManagerErrorViewProps) {
  const [showEmailOptions, setShowEmailOptions] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { reportError } = useErrorReporting();

  // Prepare email data
  const errorId = reportError(error, {
    component: 'FileManager',
    action: 'Data Loading Error',
    url: window.location.href
  });

  const emailData = {
    to: notificationConfig.channels.adminEmail,
    subject: `🚨 File Manager Error - ${new Date().toISOString()}`,
    body: `
📋 ERROR REPORT - File Manager
================================

📍 Error Message: ${error.message}

📌 Error ID: ${errorId}

⏰ Timestamp: ${new Date().toISOString()}

🌐 URL: ${window.location.href}

📚 Stack Trace:
${error.stack || 'Not available'}

---
Αυτό το email δημιουργήθηκε αυτόματα από το File Manager.
    `.trim()
  };

  const handleEmailProviderSelect = (provider: EmailProvider) => {
    openEmailCompose(provider, emailData);
    setEmailSent(true);
    setShowEmailOptions(false);
  };

  return (
    <main className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6">
          <section className="text-center" role="alert">
            {/* Error Icon */}
            <figure className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </figure>

            {/* Error Title */}
            <h2 className="text-xl font-semibold text-destructive mb-2">
              {t('manager.errorLoading')}
            </h2>

            {/* Error Message */}
            <p className="text-muted-foreground mb-6">
              {error.message}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {/* Retry Button */}
              <Button onClick={onRetry} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('manager.retry')}
              </Button>

              {/* Send to Admin Button */}
              <Button
                onClick={() => setShowEmailOptions(true)}
                variant="outline"
                disabled={emailSent || showEmailOptions}
              >
                {emailSent ? (
                  <>
                    <Mail className="h-4 w-4 mr-2 text-green-600" />
                    {t('errorReporting.sent')}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    {t('errorReporting.notifyAdmin')}
                  </>
                )}
              </Button>
            </div>

            {/* 🏢 ENTERPRISE: Email Provider Selection - Centralized Styles */}
            {showEmailOptions && (
              <div className="mt-4 p-4 bg-muted border border-border rounded-md text-left">
                <p className="font-medium text-foreground mb-3 text-center flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>Επιλέξτε τον πάροχο email σας:</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {EMAIL_PROVIDERS.map((provider) => {
                    const IconComponent = provider.Icon;
                    return (
                      <Button
                        key={provider.id}
                        onClick={() => handleEmailProviderSelect(provider.id)}
                        variant="outline"
                        size="sm"
                        className="flex items-center justify-start gap-2"
                      >
                        <IconComponent className="h-4 w-4" />
                        <span>{provider.labelEl}</span>
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Θα ανοίξει νέα καρτέλα με το email έτοιμο προς αποστολή
                </p>
              </div>
            )}

            {/* Admin Email Info */}
            <p className="text-xs text-muted-foreground mt-4">
              {t('errorReporting.emailLabel')}: {notificationConfig.channels.adminEmail}
            </p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FileManagerPageContent() {
  const { t } = useTranslation('files');
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const iconSizes = useIconSizes();

  // 🐛 DEBUG: State for triggering test error (Development Only)
  const [triggerError, setTriggerError] = useState(false);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [treeViewMode, setTreeViewMode] = useState<TreeViewMode>('business');
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('entity');
  const [activeTab, setActiveTab] = useState<ActiveTab>('files');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 🏢 ENTERPRISE: Dashboard toggle state
  const [showDashboard, setShowDashboard] = useState(true);

  // 🏢 ENTERPRISE: Filters state
  const [filters, setFilters] = useState<FileFilterState>(defaultFileFilters);
  const [showFilters, setShowFilters] = useState(false);

  // Get companyId from workspace or user
  const companyId = activeWorkspace?.companyId || user?.companyId || '';

  // Data fetching
  const {
    files,
    trashedFiles,
    loading,
    error,
    refetch,
    stats,
  } = useAllCompanyFiles({
    companyId,
    autoFetch: !!companyId,
  });

  // 🏢 ENTERPRISE: Filtered files based on search and filters
  const filteredFiles = useMemo(() => {
    let result = files;

    // Search term filter (from toolbar search)
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      result = result.filter(file =>
        file.displayName?.toLowerCase().includes(query) ||
        file.originalFilename?.toLowerCase().includes(query) ||
        (file as { entityLabel?: string }).entityLabel?.toLowerCase().includes(query) ||
        file.category?.toLowerCase().includes(query)
      );
    }

    // Advanced filters - search term
    if (filters.searchTerm?.trim()) {
      const query = filters.searchTerm.toLowerCase();
      result = result.filter(file =>
        file.displayName?.toLowerCase().includes(query) ||
        file.originalFilename?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      result = result.filter(file => file.category === filters.category);
    }

    // Entity type filter
    if (filters.entityType && filters.entityType !== 'all') {
      result = result.filter(file => file.entityType === filters.entityType);
    }

    return result;
  }, [files, searchTerm, filters]);

  // 🏢 ENTERPRISE: Dashboard stats
  const dashboardStats: DashboardStat[] = useMemo(() => [
    {
      title: t('dashboard.totalFiles'),
      value: stats.totalFiles,
      icon: Files,
      color: 'blue'
    },
    {
      title: t('dashboard.totalSize'),
      value: formatFileSize(stats.totalSizeBytes),
      icon: HardDrive,
      color: 'green'
    },
    {
      title: t('dashboard.inTrash'),
      value: trashedFiles.length,
      icon: Trash2,
      color: 'orange'
    },
    {
      title: t('dashboard.categories'),
      value: Object.values(stats.byCategory).filter(v => v > 0).length,
      icon: Layers,
      color: 'purple'
    },
    {
      title: t('dashboard.projects'),
      value: stats.byEntityType.project || 0,
      icon: FolderTree,
      color: 'cyan'
    }
  ], [t, stats, trashedFiles.length]);

  // Handlers
  const handleFileClick = useCallback((file: FileRecord) => {
    setSelectedFile(file);
  }, []);

  const handleFileDoubleClick = useCallback((file: FileRecord) => {
    if (file.downloadUrl) {
      window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // 🏢 ENTERPRISE: Dashboard card click handler
  const handleCardClick = useCallback((stat: DashboardStat) => {
    const title = stat.title;
    if (title === t('dashboard.totalFiles')) {
      setFilters(defaultFileFilters);
    } else if (title === t('dashboard.projects')) {
      setFilters(prev => ({ ...prev, entityType: 'project' }));
    }
  }, [t]);

  // Dynamic header title with count
  const headerTitle = `${t('header.title')} (${filteredFiles.length})`;

  // Loading state
  if (!companyId) {
    return (
      <main className="flex items-center justify-center min-h-[400px]">
        <section className="text-center">
          <Files className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            {t('manager.noCompany')}
          </p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[400px]" role="status">
        <section className="text-center">
          <Spinner size="large" className="mx-auto mb-4" />
          <p className="text-muted-foreground">
            {t('manager.loading')}
          </p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <FileManagerErrorView
        error={error}
        onRetry={() => refetch()}
        t={t}
      />
    );
  }

  // 🐛 DEBUG: Trigger test error during render (caught by ErrorBoundary)
  if (triggerError) {
    throw new Error('[ΔΟΚΙΜΗ] Αυτό είναι δοκιμαστικό σφάλμα για testing του Error Reporting System. Κάνε κλικ στο "Ειδοποίηση Admin" για να στείλεις email στο georgios.pagonis@gmail.com');
  }

  return (
    <TooltipProvider>
      {/* 🏢 ENTERPRISE: Full-width layout */}
      <main className="flex flex-col h-full w-full bg-background">
        {/* 🏢 ENTERPRISE: Centralized PageHeader with dashboard toggle */}
        <PageHeader
          variant="sticky-rounded"
          layout="compact"
          spacing="compact"
          title={{
            icon: FolderTree,
            title: headerTitle,
            subtitle: activeWorkspace?.displayName || t('header.subtitle')
          }}
          breadcrumb={<NavigationBreadcrumb />}
          actions={{
            showDashboard,
            onDashboardToggle: () => setShowDashboard(!showDashboard),
            viewMode: 'list',
            onViewModeChange: () => {},
            viewModes: ['list'],
            addButton: {
              label: t('manager.refresh'),
              onClick: () => refetch()
            }
          }}
        />

        {/* 🏢 ENTERPRISE: Collapsible Dashboard */}
        {showDashboard && (
          <section role="region" aria-label={t('dashboard.label')} className="px-4">
            <UnifiedDashboard
              stats={dashboardStats}
              columns={5}
              onCardClick={handleCardClick}
            />
          </section>
        )}

        {/* 🏢 ENTERPRISE: Advanced Filters Panel */}
        <aside className="hidden md:block px-4" role="complementary" aria-label={t('filters.desktop')}>
          <AdvancedFiltersPanel
            config={fileFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Mobile Filters */}
        {showFilters && (
          <aside className="md:hidden px-4" role="complementary" aria-label={t('filters.mobile')}>
            <AdvancedFiltersPanel
              config={fileFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}

        {/* 🏢 ENTERPRISE: Main Content Card with Toolbar */}
        <section className="flex-1 px-4 pb-4 overflow-hidden">
          <Card className="h-full flex flex-col">
            {/* 🏢 ENTERPRISE: Toolbar - Matching EntityFilesManager (Procore/BIM360 pattern) */}
            <CardHeader className="flex-shrink-0 pb-2">
              <nav className="flex flex-wrap items-center justify-between gap-4" role="toolbar" aria-label={t('manager.fileManagementTools')}>
                <header className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Files className={iconSizes.md} />
                    <span>{t('manager.filesTitle')}</span>
                    <Badge variant="secondary">{filteredFiles.length}</Badge>
                  </CardTitle>
                </header>

                <menu className="flex flex-wrap gap-2">
                  {/* 🗑️ ENTERPRISE: Tab switcher (Files/Inbox/Trash) - Procore/BIM360 pattern */}
                  <li className="flex gap-1 border rounded-md p-1" role="tablist" aria-label={t('manager.filesTitle')}>
                    <Button
                      variant={activeTab === 'files' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('files')}
                      role="tab"
                      aria-selected={activeTab === 'files'}
                      className={cn('px-3', activeTab === 'files' && 'bg-primary text-primary-foreground')}
                    >
                      <FileText className={`${iconSizes.sm} mr-1`} />
                      {t('manager.filesTitle')}
                    </Button>
                    {/* 📥 ENTERPRISE: Inbox tab - ADR-055 Attachment Ingestion */}
                    <Button
                      variant={activeTab === 'inbox' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('inbox')}
                      role="tab"
                      aria-selected={activeTab === 'inbox'}
                      className={cn('px-3', activeTab === 'inbox' && 'bg-blue-500 text-white hover:bg-blue-600')}
                    >
                      <Inbox className={`${iconSizes.sm} mr-1`} />
                      {t('domains.ingestion')}
                    </Button>
                    <Button
                      variant={activeTab === 'trash' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('trash')}
                      role="tab"
                      aria-selected={activeTab === 'trash'}
                      className={cn('px-3', activeTab === 'trash' && 'bg-red-500 text-white hover:bg-red-600')}
                    >
                      <Trash2 className={`${iconSizes.sm} mr-1`} />
                      {t('trash.title')}
                    </Button>
                  </li>

                  {/* View mode toggles - Only show on files tab */}
                  {activeTab === 'files' && (
                    <>
                      <li className="flex gap-1 border rounded-md p-1" role="group" aria-label="View mode">
                        {/* Gallery View */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={viewMode === 'gallery' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setViewMode('gallery')}
                              aria-label={t('manager.viewGallery')}
                              aria-pressed={viewMode === 'gallery'}
                              className={cn('px-2', viewMode === 'gallery' && 'bg-primary text-primary-foreground')}
                            >
                              <Grid3X3 className={iconSizes.sm} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('manager.viewGallery')}</TooltipContent>
                        </Tooltip>

                        {/* List View */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={viewMode === 'list' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setViewMode('list')}
                              aria-label={t('manager.listView')}
                              aria-pressed={viewMode === 'list'}
                              className={cn('px-2', viewMode === 'list' && 'bg-primary text-primary-foreground')}
                            >
                              <List className={iconSizes.sm} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('manager.listView')}</TooltipContent>
                        </Tooltip>

                        {/* Tree View */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={viewMode === 'tree' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setViewMode('tree')}
                              aria-label={t('manager.treeView')}
                              aria-pressed={viewMode === 'tree'}
                              className={cn('px-2', viewMode === 'tree' && 'bg-primary text-primary-foreground')}
                            >
                              <Network className={iconSizes.sm} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('manager.treeView')}</TooltipContent>
                        </Tooltip>
                      </li>

                      {/* Tree view mode toggle (Business vs Technical) - Only when tree view */}
                      {viewMode === 'tree' && (
                        <li className="flex gap-1 border rounded-md p-1" role="group" aria-label="Tree view mode">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={treeViewMode === 'business' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setTreeViewMode('business')}
                                aria-label={t('manager.businessView')}
                                aria-pressed={treeViewMode === 'business'}
                                className={cn('px-2', treeViewMode === 'business' && 'bg-primary text-primary-foreground')}
                              >
                                <Eye className={iconSizes.sm} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('manager.businessViewTooltip')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={treeViewMode === 'technical' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setTreeViewMode('technical')}
                                aria-label={t('manager.technicalView')}
                                aria-pressed={treeViewMode === 'technical'}
                                className={cn('px-2', treeViewMode === 'technical' && 'bg-primary text-primary-foreground')}
                              >
                                <Code className={iconSizes.sm} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('manager.technicalViewTooltip')}</TooltipContent>
                          </Tooltip>
                        </li>
                      )}
                    </>
                  )}

                  {/* Upload button - Only on files tab */}
                  {activeTab === 'files' && (
                    <>
                      <li>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => console.log('Upload files - TODO')}
                              aria-label={t('manager.addFiles')}
                            >
                              <Upload className={`${iconSizes.sm} mr-2`} />
                              {t('manager.addFiles')}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('manager.addFilesTooltip')}</TooltipContent>
                        </Tooltip>
                      </li>

                      {/* Refresh button */}
                      <li>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => refetch()}
                              disabled={loading}
                              aria-label={t('manager.refresh')}
                            >
                              <RefreshCw className={`${iconSizes.sm} ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('manager.refreshTooltip')}</TooltipContent>
                        </Tooltip>
                      </li>
                    </>
                  )}

                  {/* Mobile filter toggle */}
                  <li>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="md:hidden"
                      aria-label={t('filters.toggleFilters')}
                    >
                      <Filter className={iconSizes.sm} />
                    </Button>
                  </li>

                  {/* 🐛 DEBUG: Test Error Button (Development Only) */}
                  {process.env.NODE_ENV === 'development' && (
                    <li>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setTriggerError(true)}
                            aria-label="Test Error (Dev Only)"
                          >
                            <AlertTriangle className={iconSizes.sm} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>🐛 Test Error (Dev Only)</TooltipContent>
                      </Tooltip>
                    </li>
                  )}
                </menu>
              </nav>

              {/* 🔍 Search input - Only on files tab */}
              {activeTab === 'files' && files.length > 0 && (
                <div className="mt-4">
                  <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={t('manager.searchPlaceholder')}
                    className="max-w-md"
                  />
                </div>
              )}
            </CardHeader>

            {/* Content */}
            <CardContent className="flex-1 overflow-auto p-0">
              {activeTab === 'files' ? (
                <>
                  {filteredFiles.length === 0 ? (
                    <section className="flex flex-col items-center justify-center h-full min-h-[300px] p-8">
                      <Files className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                      <p className="text-muted-foreground text-center">
                        {searchTerm || filters.category !== 'all' || filters.entityType !== 'all'
                          ? t('manager.noSearchResults')
                          : t('manager.noFiles')}
                      </p>
                    </section>
                  ) : viewMode === 'gallery' ? (
                    /* 🏢 ENTERPRISE: Card/Gallery View */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
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
                    /* Tree View */
                    <CompanyFileTree
                      files={filteredFiles}
                      companyName={activeWorkspace?.displayName || 'Company'}
                      groupingMode={groupingMode}
                      viewMode={treeViewMode}
                      onFileClick={handleFileClick}
                      onFileDoubleClick={handleFileDoubleClick}
                      className="h-full"
                    />
                  ) : (
                    /* List View */
                    <FilesList
                      files={filteredFiles}
                      onView={handleFileClick}
                      currentUserId={user?.uid}
                    />
                  )}
                </>
              ) : activeTab === 'inbox' ? (
                /* 📥 ENTERPRISE: Inbox View - ADR-055 Attachment Ingestion */
                /* 🏢 Wrapped in EnterpriseErrorBoundary for FULL error UI (Email, Admin, Tour) */
                <EnterpriseErrorBoundary
                  componentName="Inbox View"
                  enableRetry
                  enableReporting
                >
                  <InboxView
                    companyId={companyId}
                    currentUserId={user?.uid || ''}
                    onRefresh={() => refetch()}
                  />
                </EnterpriseErrorBoundary>
              ) : (
                /* Trash View */
                /* 🏢 Wrapped in EnterpriseErrorBoundary for FULL error UI (Email, Admin, Tour) */
                <EnterpriseErrorBoundary
                  componentName="Trash View"
                  enableRetry
                  enableReporting
                >
                  <TrashView
                    companyId={companyId}
                    currentUserId={user?.uid || ''}
                    onRestore={() => refetch()}
                  />
                </EnterpriseErrorBoundary>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </TooltipProvider>
  );
}

// 🏢 ENTERPRISE: Wrapped with PageErrorBoundary for automatic error reporting
export default function FileManagerPage() {
  return (
    <PageErrorBoundary
      enableRetry
      maxRetries={3}
      enableReporting
    >
      <FileManagerPageContent />
    </PageErrorBoundary>
  );
}
