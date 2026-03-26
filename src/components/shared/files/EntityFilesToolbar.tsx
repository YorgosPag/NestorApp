/**
 * =============================================================================
 * EntityFilesToolbar — Toolbar for file management (tabs, views, actions)
 * =============================================================================
 *
 * Presentational component for the EntityFilesManager toolbar.
 * Contains: Files/Trash tabs, view mode toggles, tree view mode toggle,
 * AddCaptureMenu, refresh button, fullscreen toggle.
 *
 * Extracted from EntityFilesManager for Google SRP compliance.
 *
 * @module components/shared/files/EntityFilesToolbar
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { getStatusColor } from '@/lib/design-system';
import {
  FileText, RefreshCw, List, Network, Eye, Code,
  Grid3X3, Image as ImageIcon, Maximize2, Minimize2, Trash2,
} from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { FileCategory } from '@/config/domain-constants';
import type { CaptureMetadata } from '@/config/upload-entry-points';
import { AddCaptureMenu } from './AddCaptureMenu';

// ============================================================================
// TYPES
// ============================================================================

export interface EntityFilesToolbarProps {
  activeTab: 'files' | 'trash';
  onTabChange: (tab: 'files' | 'trash') => void;
  viewMode: 'list' | 'tree' | 'gallery';
  onViewModeChange: (mode: 'list' | 'tree' | 'gallery') => void;
  treeViewMode: 'business' | 'technical';
  onTreeViewModeChange: (mode: 'business' | 'technical') => void;
  displayStyle: 'standard' | 'media-gallery' | 'floorplan-gallery';
  category: FileCategory;
  onToggleUploadZone: () => void;
  onCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
  uploading: boolean;
  loading: boolean;
  onRefresh: () => void;
  fullscreen: { isFullscreen: boolean; toggle: () => void };
  fileCount: number;
  workspaceName?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EntityFilesToolbar({
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  treeViewMode,
  onTreeViewModeChange,
  displayStyle,
  category,
  onToggleUploadZone,
  onCapture,
  uploading,
  loading,
  onRefresh,
  fullscreen,
  fileCount,
  workspaceName,
}: EntityFilesToolbarProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');

  return (
    <CardHeader>
      <nav className="flex flex-wrap items-center justify-between gap-2" role="toolbar" aria-label={t('manager.fileManagementTools')}>
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <FileText className={iconSizes.md} aria-hidden="true" />
            {t('manager.filesTitle')}
            {fileCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({fileCount})
              </span>
            )}
          </CardTitle>

          {workspaceName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t('manager.belongsTo')}:</span>
              <span className="font-medium text-foreground">{workspaceName}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Tab switcher (Procore/BIM360 pattern) */}
          <div className="flex gap-1 border rounded-md p-1" role="tablist" aria-label={t('manager.filesTitle')}>
            <Button
              variant={activeTab === 'files' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onTabChange('files')}
              role="tab"
              aria-selected={activeTab === 'files'}
              aria-controls="files-panel"
              className={cn('px-2', activeTab === 'files' && 'bg-primary text-primary-foreground')}
            >
              <FileText className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
              {t('manager.filesTitle')}
            </Button>
            <Button
              variant={activeTab === 'trash' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onTabChange('trash')}
              role="tab"
              aria-selected={activeTab === 'trash'}
              aria-controls="trash-panel"
              className={cn('px-2', activeTab === 'trash' && `${getStatusColor('error', 'bg')} text-white hover:opacity-90`)}
            >
              <Trash2 className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
              {t('trash.title')}
            </Button>
          </div>

          {/* View toggle buttons - Only show when on files tab */}
          {activeTab === 'files' && (
            <>
              <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="View mode">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'gallery' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => onViewModeChange('gallery')}
                      aria-label={t('manager.viewGallery')}
                      aria-pressed={viewMode === 'gallery'}
                      className={cn('px-2', viewMode === 'gallery' && 'bg-primary text-primary-foreground')}
                    >
                      {displayStyle === 'floorplan-gallery'
                        ? <ImageIcon className={iconSizes.sm} aria-hidden="true" />
                        : <Grid3X3 className={iconSizes.sm} aria-hidden="true" />
                      }
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.viewGalleryTooltip')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => onViewModeChange('list')}
                      aria-label={t('manager.viewList')}
                      aria-pressed={viewMode === 'list'}
                      className={cn('px-2', viewMode === 'list' && 'bg-primary text-primary-foreground')}
                    >
                      <List className={iconSizes.sm} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.viewList')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'tree' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => onViewModeChange('tree')}
                      aria-label={t('manager.viewTree')}
                      aria-pressed={viewMode === 'tree'}
                      className={cn('px-2', viewMode === 'tree' && 'bg-primary text-primary-foreground')}
                    >
                      <Network className={iconSizes.sm} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.viewTree')}</TooltipContent>
                </Tooltip>
              </div>

              {/* Tree view mode toggle (Business vs Technical) */}
              {viewMode === 'tree' && (
                <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="Tree view mode">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={treeViewMode === 'business' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onTreeViewModeChange('business')}
                        aria-label={t('manager.businessView')}
                        aria-pressed={treeViewMode === 'business'}
                        className={cn('px-2', treeViewMode === 'business' && 'bg-primary text-primary-foreground')}
                      >
                        <Eye className={iconSizes.sm} aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('manager.businessViewTooltip')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={treeViewMode === 'technical' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onTreeViewModeChange('technical')}
                        aria-label={t('manager.technicalView')}
                        aria-pressed={treeViewMode === 'technical'}
                        className={cn('px-2', treeViewMode === 'technical' && 'bg-primary text-primary-foreground')}
                      >
                        <Code className={iconSizes.sm} aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('manager.technicalViewTooltip')}</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </>
          )}

          {/* Add/Capture Menu + Refresh - Only on files tab */}
          {activeTab === 'files' && (
            <>
              <AddCaptureMenu
                category={category}
                onUploadClick={onToggleUploadZone}
                onCapture={onCapture}
                disabled={uploading}
                loading={uploading}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={loading || uploading}
                    aria-label={t('manager.refresh')}
                  >
                    <RefreshCw className={`${iconSizes.sm} ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('manager.refreshTooltip')}</TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Fullscreen toggle (ADR-241) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={fullscreen.toggle}
                aria-label={fullscreen.isFullscreen ? t('manager.exitFullscreen') : t('manager.fullscreen')}
                aria-pressed={fullscreen.isFullscreen}
              >
                {fullscreen.isFullscreen
                  ? <Minimize2 className={iconSizes.sm} aria-hidden="true" />
                  : <Maximize2 className={iconSizes.sm} aria-hidden="true" />
                }
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {fullscreen.isFullscreen ? t('manager.exitFullscreenTooltip') : t('manager.fullscreenTooltip')}
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </CardHeader>
  );
}
