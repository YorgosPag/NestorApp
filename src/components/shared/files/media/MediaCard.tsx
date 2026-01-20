/**
 * =============================================================================
 * 🏢 ENTERPRISE: MediaCard Component
 * =============================================================================
 *
 * Thumbnail card for displaying media files (photos/videos) in gallery.
 * Enterprise-grade with centralized design system integration.
 *
 * @module components/shared/files/media/MediaCard
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Features:
 * - Lazy loading thumbnails
 * - Selection checkbox
 * - Hover effects (INTERACTIVE_PATTERNS)
 * - Video play indicator
 * - File metadata display
 * - Accessibility (ARIA)
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Play, Check, Image as ImageIcon, AlertCircle, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { INTERACTIVE_PATTERNS, HOVER_SHADOWS } from '@/components/ui/effects/hover-effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatFileSize } from '@/utils/file-validation';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

export interface MediaCardProps {
  /** File record to display */
  file: FileRecord;
  /** Whether the card is selected */
  isSelected: boolean;
  /** Selection toggle handler */
  onSelect: (fileId: string) => void;
  /** Click handler for preview */
  onClick: () => void;
  /** Card size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show selection checkbox */
  showCheckbox?: boolean;
  /** Custom className */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CARD_SIZES = {
  sm: {
    container: 'w-full min-h-[140px]',
    image: 'aspect-[4/3]',
    text: 'text-xs',
    icon: 'w-8 h-8',
  },
  md: {
    container: 'w-full min-h-[180px]',
    image: 'aspect-[4/3]',
    text: 'text-sm',
    icon: 'w-10 h-10',
  },
  lg: {
    container: 'w-full min-h-[220px]',
    image: 'aspect-[4/3]',
    text: 'text-sm',
    icon: 'w-12 h-12',
  },
} as const;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if file is a video
 */
function isVideoFile(file: FileRecord): boolean {
  return file.contentType?.startsWith('video/') ?? false;
}

/**
 * Format date for display
 */
function formatDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Media Card Component
 *
 * Displays a media file (photo/video) as a thumbnail card with:
 * - Lazy loaded image
 * - Selection state
 * - Hover effects
 * - Video play indicator
 * - File metadata
 */
export function MediaCard({
  file,
  isSelected,
  onSelect,
  onClick,
  size = 'md',
  showCheckbox = true,
  className,
}: MediaCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const { t } = useTranslation('files');

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const sizeConfig = CARD_SIZES[size];
  const isVideo = isVideoFile(file);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(file.id);
  }, [file.id, onSelect]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }, [onClick]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`${isVideo ? t('media.video') : t('media.photo')}: ${file.displayName}`}
      aria-selected={isSelected}
      className={cn(
        // Base styles
        'relative flex flex-col rounded-lg overflow-hidden cursor-pointer',
        'bg-card border',
        borders.getElementBorder('card', 'default'),
        // Size
        sizeConfig.container,
        // Hover effects (centralized)
        INTERACTIVE_PATTERNS.CARD_STANDARD,
        // Selection state
        isSelected && [
          'ring-2 ring-primary ring-offset-2',
          borders.getStatusBorder('info'),
        ],
        // Focus state
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      {/* Selection Checkbox */}
      {showCheckbox && (
        <div
          role="checkbox"
          aria-checked={isSelected}
          aria-label={t('media.selectFile')}
          onClick={handleCheckboxClick}
          className={cn(
            'absolute top-2 left-2 z-10',
            'w-5 h-5 rounded border-2 flex items-center justify-center',
            'transition-all duration-200',
            isSelected
              ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-background/80 border-muted-foreground/50 hover:border-primary'
          )}
        >
          {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
        </div>
      )}

      {/* Thumbnail Container */}
      <figure className={cn('relative w-full overflow-hidden bg-muted', sizeConfig.image)}>
        {/* Video Placeholder - Videos don't have image thumbnails */}
        {isVideo ? (
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center',
              'bg-gradient-to-br from-slate-700 to-slate-900'
            )}
            aria-label={t('media.video')}
          >
            {/* Video Icon Background */}
            <div
              className={cn(
                'rounded-full bg-white/10 flex items-center justify-center mb-2',
                size === 'sm' ? 'w-10 h-10' : size === 'md' ? 'w-14 h-14' : 'w-16 h-16'
              )}
            >
              <Film
                className={cn(
                  'text-white/70',
                  size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-7 h-7' : 'w-8 h-8'
                )}
              />
            </div>
            {/* Play Button Overlay */}
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center',
                'bg-black/20 hover:bg-black/30 transition-colors duration-200'
              )}
            >
              <div
                className={cn(
                  'rounded-full bg-white/90 flex items-center justify-center shadow-lg',
                  sizeConfig.icon,
                  HOVER_SHADOWS.SUBTLE
                )}
              >
                <Play className="w-1/2 h-1/2 text-primary ml-0.5" fill="currentColor" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Loading Skeleton - Images Only */}
            {!imageLoaded && !imageError && (
              <div
                className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center"
                aria-hidden="true"
              >
                <ImageIcon className={cn(sizeConfig.icon, 'text-muted-foreground/30')} />
              </div>
            )}

            {/* Error State - Images Only */}
            {imageError && (
              <div
                className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-1"
                aria-label={t('media.loadError')}
              >
                <AlertCircle className={cn(iconSizes.lg, 'text-muted-foreground/50')} />
                <span className="text-xs text-muted-foreground">{t('media.loadError')}</span>
              </div>
            )}

            {/* Actual Image - Images Only */}
            {file.downloadUrl && !imageError && (
              <img
                src={file.downloadUrl}
                alt={file.displayName}
                loading="lazy"
                onLoad={handleImageLoad}
                onError={handleImageError}
                className={cn(
                  'w-full h-full object-cover',
                  'transition-opacity duration-300',
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                )}
              />
            )}
          </>
        )}
      </figure>

      {/* Metadata Footer */}
      <footer className="flex-1 p-2 flex flex-col justify-between min-h-0">
        {/* File Name */}
        <h3
          className={cn(
            'font-medium truncate',
            sizeConfig.text,
            colors.text.primary
          )}
          title={file.displayName}
        >
          {file.displayName}
        </h3>

        {/* File Info */}
        <div className={cn('flex items-center justify-between gap-1 mt-1', sizeConfig.text)}>
          <time
            dateTime={String(file.createdAt)}
            className={colors.text.muted}
          >
            {formatDate(file.createdAt)}
          </time>
          {file.sizeBytes && (
            <span className={colors.text.muted}>
              {formatFileSize(file.sizeBytes)}
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}
