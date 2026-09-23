/**
 * =============================================================================
 * 🏢 ENTERPRISE: FileManagerToolbar
 * =============================================================================
 *
 * Toolbar component for the File Manager with tabs, view mode toggles,
 * upload button, refresh, filter toggle, and search input.
 * Follows Procore/BIM360 toolbar pattern.
 *
 * @module components/file-manager/FileManagerToolbar
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import '@/styles/design-tokens';
import React from 'react';
import {
  List,
  Grid3X3,
  Eye,
  Code,
  Trash2,
  Files,
  RefreshCw,
  Network,
  Filter,
  FileText,
  Upload,
  Inbox,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { SearchInput } from '@/components/ui/search';
import type { ViewMode, ActiveTab } from './useFileManagerState';
import type { ViewMode as TreeViewMode } from './CompanyFileTree';

// ============================================================================
// TYPES
// ============================================================================

interface FileManagerToolbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  treeViewMode: TreeViewMode;
  onTreeViewModeChange: (mode: TreeViewMode) => void;
  filteredCount: number;
  filesCount: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  uploading: boolean;
  loading: boolean;
  showFilters: boolean;
  onUploadClick: () => void;
  onRefresh: () => void;
  onFilterToggle: () => void;
  onTriggerError: () => void;
  t: (key: string) => string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FileManagerToolbar({
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  treeViewMode,
  onTreeViewModeChange,
  filteredCount,
  filesCount,
  searchTerm,
  onSearchChange,
  uploading,
  loading,
  showFilters: _showFilters,
  onUploadClick,
  onRefresh,
  onFilterToggle,
  onTriggerError,
  t,
}: FileManagerToolbarProps) {
  const iconSizes = useIconSizes();

  return (
    <CardHeader className="flex-shrink-0 pb-2">
      <nav className="flex flex-wrap items-center justify-between gap-4" role="toolbar" aria-label={t('manager.fileManagementTools')}>
        <header className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Files className={iconSizes.md} />
            <span>{t('manager.filesTitle')}</span>
            <Badge variant="secondary">{filteredCount}</Badge>
          </CardTitle>
        </header>

        <menu className="flex flex-wrap gap-2">
          {/* Tab switcher (Files/Inbox/Trash) */}
          <li className="flex gap-1 border rounded-md p-1" role="tablist" aria-label={t('manager.filesTitle')}>
            <ToggleButton
              pressed={activeTab === 'files'}
              variant="ghost"
              semantics="selected"
              size="sm"
              onClick={() => onTabChange('files')}
              role="tab"
              className="px-3"
            >
              <FileText className={`${iconSizes.sm} mr-1`} />
              {t('manager.filesTitle')}
            </ToggleButton>
            <ToggleButton
              pressed={activeTab === 'inbox'}
              variant="ghost"
              semantics="selected"
              size="sm"
              onClick={() => onTabChange('inbox')}
              role="tab"
              className="px-3"
            >
              <Inbox className={`${iconSizes.sm} mr-1`} />
              {t('domains.ingestion')}
            </ToggleButton>
            <ToggleButton
              pressed={activeTab === 'trash'}
              variant="ghost"
              semantics="selected"
              size="sm"
              onClick={() => onTabChange('trash')}
              role="tab"
              className="px-3"
            >
              <Trash2 className={`${iconSizes.sm} mr-1`} />
              {t('trash.title')}
            </ToggleButton>
          </li>

          {/* View mode toggles - Only on files tab */}
          {activeTab === 'files' && (
            <>
              <li className="flex gap-1 border rounded-md p-1" role="group" aria-label="View mode">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleButton
                      pressed={viewMode === 'gallery'}
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewModeChange('gallery')}
                      aria-label={t('manager.viewGallery')}
                      className="px-2"
                    >
                      <Grid3X3 className={iconSizes.sm} />
                    </ToggleButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.viewGallery')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleButton
                      pressed={viewMode === 'list'}
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewModeChange('list')}
                      aria-label={t('manager.listView')}
                      className="px-2"
                    >
                      <List className={iconSizes.sm} />
                    </ToggleButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.listView')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleButton
                      pressed={viewMode === 'tree'}
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewModeChange('tree')}
                      aria-label={t('manager.treeView')}
                      className="px-2"
                    >
                      <Network className={iconSizes.sm} />
                    </ToggleButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.treeView')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleButton
                      pressed={viewMode === 'iso19650-tree'}
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewModeChange('iso19650-tree')}
                      aria-label={t('iso19650:virtualFolders.viewLabel')}
                      className="px-2"
                    >
                      <Layers className={iconSizes.sm} />
                    </ToggleButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('iso19650:virtualFolders.viewTooltip')}</TooltipContent>
                </Tooltip>
              </li>

              {/* Tree view mode toggle (Business vs Technical) */}
              {viewMode === 'tree' && (
                <li className="flex gap-1 border rounded-md p-1" role="group" aria-label="Tree view mode">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleButton
                        pressed={treeViewMode === 'business'}
                        variant="ghost"
                        size="sm"
                        onClick={() => onTreeViewModeChange('business')}
                        aria-label={t('manager.businessView')}
                        className="px-2"
                      >
                        <Eye className={iconSizes.sm} />
                      </ToggleButton>
                    </TooltipTrigger>
                    <TooltipContent>{t('manager.businessViewTooltip')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleButton
                        pressed={treeViewMode === 'technical'}
                        variant="ghost"
                        size="sm"
                        onClick={() => onTreeViewModeChange('technical')}
                        aria-label={t('manager.technicalView')}
                        className="px-2"
                      >
                        <Code className={iconSizes.sm} />
                      </ToggleButton>
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
                      onClick={onUploadClick}
                      disabled={uploading}
                      aria-label={t('manager.addFiles')}
                    >
                      <Upload className={`${iconSizes.sm} mr-2`} />
                      {uploading ? 'Ανέβασμα...' : t('manager.addFiles')}
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
                      onClick={onRefresh}
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
              onClick={onFilterToggle}
              className="md:hidden"
              aria-label={t('filters.toggleFilters')}
            >
              <Filter className={iconSizes.sm} />
            </Button>
          </li>

          {/* Debug: Test Error Button (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <li>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onTriggerError}
                    aria-label="Test Error (Dev Only)"
                  >
                    <AlertTriangle className={iconSizes.sm} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('manager.testError')}</TooltipContent>
              </Tooltip>
            </li>
          )}
        </menu>
      </nav>

      {/* Search input - Only on files tab */}
      {activeTab === 'files' && filesCount > 0 && (
        <div className="mt-4">
          <SearchInput
            value={searchTerm}
            onChange={onSearchChange}
            placeholder={t('manager.searchPlaceholder')}
            className="max-w-md"
          />
        </div>
      )}
    </CardHeader>
  );
}
