/**
 * =============================================================================
 * 🏢 ENTERPRISE: MediaGallery Component
 * =============================================================================
 *
 * Complete media gallery for photos and videos with enterprise features.
 * Integrates with centralized systems (PhotoPreviewModal, design tokens).
 *
 * @module components/shared/files/media/MediaGallery
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Features:
 * - Grid/List view modes
 * - Multi-select for bulk operations
 * - Sorting (date/name/size)
 * - Filtering (all/photos/videos)
 * - Photo lightbox (PhotoPreviewModal)
 * - Video player modal
 * - Responsive design
 * - Keyboard navigation
 * - Full accessibility (ARIA)
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import {
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Filter,
  CheckSquare,
  Square,
  Trash2,
  Download,
  Image as ImageIcon,
  Video,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PhotoPreviewModal } from '@/core/modals/PhotoPreviewModal';
import { usePhotoPreviewModal } from '@/core/modals/usePhotoPreviewModal';
import type { FileRecord } from '@/types/file-record';

import { MediaCard } from './MediaCard';
import { VideoPlayer } from './VideoPlayer';
import {
  useMediaGallery,
  type MediaViewMode,
  type MediaSortField,
  type MediaTypeFilter,
} from './hooks/useMediaGallery';

// ============================================================================
// TYPES
// ============================================================================

export interface MediaGalleryProps {
  /** Files to display (will filter to only media files) */
  files: FileRecord[];
  /** Initial view mode */
  initialViewMode?: MediaViewMode;
  /** Show toolbar controls */
  showToolbar?: boolean;
  /** Enable multi-select */
  enableSelection?: boolean;
  /** Card size */
  cardSize?: 'sm' | 'md' | 'lg';
  /** Callback when selection changes */
  onSelectionChange?: (selectedFiles: FileRecord[]) => void;
  /** Callback for delete action */
  onDelete?: (files: FileRecord[]) => void;
  /** Callback for download action */
  onDownload?: (files: FileRecord[]) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom className */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SORT_OPTIONS: Array<{ value: MediaSortField; labelKey: string }> = [
  { value: 'date', labelKey: 'media.sortByDate' },
  { value: 'name', labelKey: 'media.sortByName' },
  { value: 'size', labelKey: 'media.sortBySize' },
];

const FILTER_OPTIONS: Array<{ value: MediaTypeFilter; labelKey: string; icon: React.ElementType }> = [
  { value: 'all', labelKey: 'media.filterAll', icon: Grid3X3 },
  { value: 'photos', labelKey: 'media.filterPhotos', icon: ImageIcon },
  { value: 'videos', labelKey: 'media.filterVideos', icon: Video },
];

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if file is a video
 */
function isVideoFile(file: FileRecord): boolean {
  return file.contentType?.startsWith('video/') ?? false;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Media Gallery Component
 *
 * Full-featured gallery for displaying photos and videos with:
 * - Grid/List view toggle
 * - Multi-select support
 * - Sorting and filtering
 * - Photo lightbox (uses existing PhotoPreviewModal)
 * - Video player modal
 * - Bulk actions (delete, download)
 */
export function MediaGallery({
  files,
  initialViewMode = 'grid',
  showToolbar = true,
  enableSelection = true,
  cardSize = 'md',
  onSelectionChange,
  onDelete,
  onDownload,
  emptyMessage,
  className,
}: MediaGalleryProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');

  // Photo preview modal (existing centralized system)
  const photoModal = usePhotoPreviewModal();

  // Video preview state
  const [videoPreviewFile, setVideoPreviewFile] = React.useState<FileRecord | null>(null);

  // Media gallery state management
  const gallery = useMediaGallery(files, initialViewMode);

  // Notify parent of selection changes
  React.useEffect(() => {
    onSelectionChange?.(gallery.selectedFiles);
  }, [gallery.selectedFiles, onSelectionChange]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleCardClick = useCallback((file: FileRecord, index: number) => {
    if (isVideoFile(file)) {
      setVideoPreviewFile(file);
    } else {
      // Open photo in lightbox using existing PhotoPreviewModal
      const photoUrls = gallery.sortedFiles
        .filter(f => !isVideoFile(f))
        .map(f => f.downloadUrl ?? null);

      const photoIndex = photoUrls.findIndex(url => url === file.downloadUrl);

      photoModal.openModal({
        photoUrl: file.downloadUrl,
        photoType: 'gallery',
        photoTitle: file.displayName,
        photoIndex: photoIndex >= 0 ? photoIndex : 0,
        galleryPhotos: photoUrls,
        currentGalleryIndex: photoIndex >= 0 ? photoIndex : 0,
      });
    }
  }, [gallery.sortedFiles, photoModal]);

  const handleDeleteSelected = useCallback(() => {
    if (gallery.selectedFiles.length > 0) {
      onDelete?.(gallery.selectedFiles);
      gallery.clearSelection();
    }
  }, [gallery, onDelete]);

  const handleDownloadSelected = useCallback(() => {
    if (gallery.selectedFiles.length > 0) {
      onDownload?.(gallery.selectedFiles);
    }
  }, [gallery.selectedFiles, onDownload]);

  const handleCloseVideoPreview = useCallback(() => {
    setVideoPreviewFile(null);
  }, []);

  // =========================================================================
  // COMPUTED
  // =========================================================================

  const currentFilterIcon = useMemo(() => {
    const option = FILTER_OPTIONS.find(o => o.value === gallery.state.typeFilter);
    return option?.icon ?? Grid3X3;
  }, [gallery.state.typeFilter]);

  // =========================================================================
  // RENDER
  // =========================================================================

  // Empty state
  if (gallery.sortedFiles.length === 0) {
    return (
      <section
        className={cn(
          'flex flex-col items-center justify-center py-16',
          className
        )}
        aria-label={t('media.emptyGallery')}
      >
        <ImageIcon className={cn(iconSizes.xl, 'text-muted-foreground/30 mb-4')} />
        <p className={cn('text-sm', colors.text.muted)}>
          {emptyMessage ?? t('media.noMedia')}
        </p>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col gap-4', className)} aria-label={t('media.gallery')}>
      {/* Toolbar */}
      {showToolbar && (
        <header className="flex flex-wrap items-center gap-2 pb-2 border-b">
          {/* View Mode Toggle */}
          <nav className="flex items-center gap-1" role="group" aria-label={t('media.viewMode')}>
            <Button
              variant={gallery.state.viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => gallery.setViewMode('grid')}
              aria-pressed={gallery.state.viewMode === 'grid'}
              aria-label={t('media.gridView')}
            >
              <Grid3X3 className={iconSizes.sm} />
            </Button>
            <Button
              variant={gallery.state.viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => gallery.setViewMode('list')}
              aria-pressed={gallery.state.viewMode === 'list'}
              aria-label={t('media.listView')}
            >
              <List className={iconSizes.sm} />
            </Button>
          </nav>

          {/* Separator */}
          <div className="w-px h-6 bg-border" aria-hidden="true" />

          {/* Sort */}
          <div className="flex items-center gap-1">
            <Select
              value={gallery.state.sortField}
              onValueChange={(value: MediaSortField) => gallery.setSortField(value)}
            >
              <SelectTrigger className="w-[120px] h-8" aria-label={t('media.sortBy')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={gallery.toggleSortDirection}
              aria-label={gallery.state.sortDirection === 'asc' ? t('media.sortAsc') : t('media.sortDesc')}
            >
              {gallery.state.sortDirection === 'asc' ? (
                <SortAsc className={iconSizes.sm} />
              ) : (
                <SortDesc className={iconSizes.sm} />
              )}
            </Button>
          </div>

          {/* Filter */}
          <Select
            value={gallery.state.typeFilter}
            onValueChange={(value: MediaTypeFilter) => gallery.setTypeFilter(value)}
          >
            <SelectTrigger className="w-[130px] h-8" aria-label={t('media.filterBy')}>
              <Filter className={cn(iconSizes.xs, 'mr-1')} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <Icon className={iconSizes.xs} />
                      {t(option.labelKey)}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Selection Controls */}
          {enableSelection && (
            <nav className="flex items-center gap-2" role="group" aria-label={t('media.selectionControls')}>
              {gallery.hasSelection ? (
                <>
                  <span className={cn('text-sm', colors.text.muted)}>
                    {t('media.selectedCount', { count: gallery.selectionCount })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={gallery.clearSelection}
                    aria-label={t('media.clearSelection')}
                  >
                    <X className={iconSizes.sm} />
                  </Button>
                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadSelected}
                      aria-label={t('media.downloadSelected')}
                    >
                      <Download className={iconSizes.sm} />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteSelected}
                      className="text-destructive hover:text-destructive"
                      aria-label={t('media.deleteSelected')}
                    >
                      <Trash2 className={iconSizes.sm} />
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={gallery.selectAll}
                  aria-label={t('media.selectAll')}
                >
                  <Square className={iconSizes.sm} />
                  <span className="ml-1 hidden sm:inline">{t('media.selectAll')}</span>
                </Button>
              )}
            </nav>
          )}
        </header>
      )}

      {/* Gallery Grid/List */}
      <main
        role="grid"
        aria-label={t('media.mediaItems')}
        className={cn(
          gallery.state.viewMode === 'grid'
            ? 'grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
            : 'flex flex-col gap-2'
        )}
      >
        {gallery.sortedFiles.map((file, index) => (
          <MediaCard
            key={file.id}
            file={file}
            isSelected={gallery.isSelected(file.id)}
            onSelect={gallery.toggleSelect}
            onClick={() => handleCardClick(file, index)}
            size={gallery.state.viewMode === 'list' ? 'sm' : cardSize}
            showCheckbox={enableSelection}
            className={gallery.state.viewMode === 'list' ? 'w-full flex-row h-16' : undefined}
          />
        ))}
      </main>

      {/* Photo Preview Modal (existing centralized system) */}
      <PhotoPreviewModal {...photoModal.modalProps} />

      {/* Video Preview Modal */}
      <Dialog open={!!videoPreviewFile} onOpenChange={(open) => !open && handleCloseVideoPreview()}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {videoPreviewFile && (
            <article className="flex flex-col">
              <header className="p-4 border-b">
                <h2 className="text-lg font-semibold truncate">{videoPreviewFile.displayName}</h2>
              </header>
              <VideoPlayer
                file={videoPreviewFile}
                onEnded={handleCloseVideoPreview}
                className="aspect-video"
              />
            </article>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default MediaGallery;
