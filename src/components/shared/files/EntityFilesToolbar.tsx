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
import {
  FileText, RefreshCw, List, Network, Eye, Code,
  Grid3X3, Image as ImageIcon, Maximize2, Minimize2, Trash2, Archive,
} from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FileCategory } from '@/config/domain-constants';
import type { CaptureMetadata } from '@/config/upload-entry-points';
import { AddCaptureMenu } from './AddCaptureMenu';

// ============================================================================
// TYPES
// ============================================================================

export interface EntityFilesToolbarProps {
  activeTab: 'files' | 'archived' | 'trash';
  onTabChange: (tab: 'files' | 'archived' | 'trash') => void;
  viewMode: 'list' | 'tree' | 'gallery';
  onViewModeChange: (mode: 'list' | 'tree' | 'gallery') => void;
  treeViewMode: 'business' | 'technical';
  onTreeViewModeChange: (mode: 'business' | 'technical') => void;
  displayStyle: 'standard' | 'media-gallery' | 'floorplan-gallery';
  category: FileCategory;
  /**
   * «Ανέβασμα αρχείου» **ανοίγει** τη ζώνη — ποτέ εναλλαγή (ADR-866 §2.10.8 Π4): ήταν `!showUploadZone`, οπότε η ίδια
   * εντολή μενού έκλεινε σιωπηλά μια ήδη ανοιχτή ζώνη. Το κλείσιμο ανήκει στο ✕ της ζώνης.
   */
  onOpenUploadZone: () => void;
  onCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
  uploading: boolean;
  loading: boolean;
  onRefresh: () => void;
  fullscreen: { isFullscreen: boolean; toggle: () => void };
  fileCount: number;
  /**
   * Δείξε «Ανήκει σε: <χώρος>» — **μόνο** για εταιρική θεματοφυλακή (ADR-866 Φ1.2, §2.9.3 Κ2).
   * ⚠️ Σημαία και όχι έτοιμο όνομα: το όνομα το διαβάζει το {@link ActiveWorkspaceLabel}, ώστε το `useWorkspace`
   * (που **πετά** έξω από `WorkspaceProvider`, δηλαδή σε κάθε κόσμο πλην του `(app)`) να **μην** καλείται ποτέ
   * για προσωπικά αρχεία.
   */
  showWorkspace: boolean;
}

/**
 * «Ανήκει σε: <χώρος>» — ο **μόνος** αναγνώστης του `WorkspaceContext` στο δέντρο αρχείων.
 *
 * 🔴 Ζούσε ως `useWorkspace()` στο σώμα του `EntityFilesManager` ⇒ ο διαχειριστής αρχείων **έπεφτε** σε κάθε
 * σελίδα χωρίς `WorkspaceProvider` — δηλαδή σε **όλο** τον προσωπικό χώρο `(me)`. Απομονωμένος εδώ, καλείται
 * μόνο όταν η θεματοφυλακή είναι εταιρική (που ζει πάντα μέσα στο `(app)`).
 */
function ActiveWorkspaceLabel(): React.ReactElement | null {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const { activeWorkspace } = useWorkspace();
  if (!activeWorkspace?.displayName) return null;
  return (
    <div className={cn("flex items-center gap-2 text-xs", colors.text.muted)}>
      <span>{t('manager.belongsTo')}:</span>
      <span className="font-medium text-foreground">{activeWorkspace.displayName}</span>
    </div>
  );
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
  onOpenUploadZone,
  onCapture,
  uploading,
  loading,
  onRefresh,
  fullscreen,
  fileCount,
  showWorkspace,
}: EntityFilesToolbarProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();

  return (
    <CardHeader>
      <nav className="flex flex-wrap items-center justify-between gap-2" role="toolbar" aria-label={t('manager.fileManagementTools')}>
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <FileText className={iconSizes.md} aria-hidden="true" />
            {t('manager.filesTitle')}
            {fileCount > 0 && (
              <span className={cn("text-sm font-normal", colors.text.muted)}>
                ({fileCount})
              </span>
            )}
          </CardTitle>

          {showWorkspace && <ActiveWorkspaceLabel />}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Tab switcher (Procore/BIM360 pattern) */}
          <div className="flex gap-1 border rounded-md p-1" role="tablist" aria-label={t('manager.filesTitle')}>
            <ToggleButton
              pressed={activeTab === 'files'}
              variant="ghost"
              semantics="selected"
              size="sm"
              onClick={() => onTabChange('files')}
              role="tab"
              aria-controls="files-panel"
              className="px-2"
            >
              <FileText className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
              {t('manager.filesTitle')}
            </ToggleButton>
            <ToggleButton
              pressed={activeTab === 'archived'}
              variant="ghost"
              semantics="selected"
              size="sm"
              onClick={() => onTabChange('archived')}
              role="tab"
              aria-controls="archived-panel"
              className="px-2"
            >
              <Archive className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
              {t('archived.title')}
            </ToggleButton>
            <ToggleButton
              pressed={activeTab === 'trash'}
              variant="ghost"
              semantics="selected"
              size="sm"
              onClick={() => onTabChange('trash')}
              role="tab"
              aria-controls="trash-panel"
              className="px-2"
            >
              <Trash2 className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
              {t('trash.title')}
            </ToggleButton>
          </div>

          {/* View toggle buttons - Only show when on files tab */}
          {activeTab === 'files' && (
            <>
              <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="View mode">
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
                      {displayStyle === 'floorplan-gallery'
                        ? <ImageIcon className={iconSizes.sm} aria-hidden="true" />
                        : <Grid3X3 className={iconSizes.sm} aria-hidden="true" />
                      }
                    </ToggleButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.viewGalleryTooltip')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleButton
                      pressed={viewMode === 'list'}
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewModeChange('list')}
                      aria-label={t('manager.viewList')}
                      className="px-2"
                    >
                      <List className={iconSizes.sm} aria-hidden="true" />
                    </ToggleButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.viewList')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleButton
                      pressed={viewMode === 'tree'}
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewModeChange('tree')}
                      aria-label={t('manager.viewTree')}
                      className="px-2"
                    >
                      <Network className={iconSizes.sm} aria-hidden="true" />
                    </ToggleButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('manager.viewTree')}</TooltipContent>
                </Tooltip>
              </div>

              {/* Tree view mode toggle (Business vs Technical) */}
              {viewMode === 'tree' && (
                <div className="flex gap-1 border rounded-md p-1" role="group" aria-label="Tree view mode">
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
                        <Eye className={iconSizes.sm} aria-hidden="true" />
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
                        <Code className={iconSizes.sm} aria-hidden="true" />
                      </ToggleButton>
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
                onUploadClick={onOpenUploadZone}
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
