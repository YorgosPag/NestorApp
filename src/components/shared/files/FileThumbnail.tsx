/**
 * =============================================================================
 * 🏢 ENTERPRISE: FileThumbnail Component
 * =============================================================================
 *
 * Universal file thumbnail component that handles:
 * - Images → direct preview from downloadUrl
 * - PDFs → auto-generated page 1 preview (via pdfjs-dist)
 * - Other files → semantic file type icon
 *
 * @module components/shared/files/FileThumbnail
 * @enterprise ADR-191 - Enterprise Document Management System
 */

'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getFileIconInfo, isImageFile, isPdfFile } from './utils/file-icons';
import { usePdfThumbnail } from './hooks/usePdfThumbnail';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

type ThumbnailSize = 'xs' | 'sm' | 'md' | 'lg';

interface FileThumbnailProps {
  /** File extension (e.g., 'pdf', 'jpg') */
  ext?: string;
  /** MIME content type */
  contentType?: string;
  /** Pre-existing thumbnail URL (e.g., from upload-time generation) */
  thumbnailUrl?: string;
  /** File download URL (for images: shown directly, for PDFs: used for generation) */
  downloadUrl?: string;
  /** Display name for alt text */
  displayName?: string;
  /** Size variant */
  size?: ThumbnailSize;
  /** Additional className */
  className?: string;
  /** Border radius class override */
  borderRadius?: string;
}

// ============================================================================
// SIZE CONFIG
// ============================================================================

const SIZE_CONFIG: Record<ThumbnailSize, { container: string; iconSize: string }> = {
  xs: { container: 'w-8 h-8', iconSize: 'h-4 w-4' },
  sm: { container: 'w-10 h-10', iconSize: 'h-5 w-5' },
  md: { container: 'w-16 h-16', iconSize: 'h-8 w-8' },
  lg: { container: 'w-24 h-24', iconSize: 'h-12 w-12' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function FileThumbnail({
  ext,
  contentType,
  thumbnailUrl,
  downloadUrl,
  displayName = '',
  size = 'sm',
  className,
  borderRadius = 'rounded-md',
}: FileThumbnailProps) {
  const sizeConfig = SIZE_CONFIG[size];
  const isImage = isImageFile(ext, contentType);
  const isPdf = isPdfFile(ext, contentType);

  // Pre-existing thumbnail takes priority
  const hasPreExistingThumb = !!thumbnailUrl;

  // PDF thumbnail generation (only when no pre-existing thumb and file is PDF)
  const { thumbnailUrl: pdfThumbUrl, loading: pdfLoading } = usePdfThumbnail(
    downloadUrl,
    isPdf && !hasPreExistingThumb,
  );

  // Image error state (for broken download URLs)
  const [imageError, setImageError] = useState(false);
  const handleImageError = useCallback(() => setImageError(true), []);

  // Determine what to show
  const effectiveThumbUrl = hasPreExistingThumb
    ? thumbnailUrl
    : isPdf
      ? pdfThumbUrl
      : isImage && !imageError
        ? downloadUrl
        : null;

  // Show image/thumbnail preview
  if (effectiveThumbUrl) {
    return (
      <figure
        className={cn(
          'flex-shrink-0 overflow-hidden bg-muted',
          sizeConfig.container,
          borderRadius,
          className,
        )}
      >
        <img
          src={effectiveThumbUrl}
          alt={displayName}
          loading="lazy"
          onError={handleImageError}
          className="w-full h-full object-cover"
        />
      </figure>
    );
  }

  // PDF loading state
  if (isPdf && pdfLoading) {
    return (
      <figure
        className={cn(
          'flex-shrink-0 flex items-center justify-center bg-muted animate-pulse',
          sizeConfig.container,
          borderRadius,
          className,
        )}
        aria-label="Loading PDF preview..."
      >
        <div className={cn('bg-muted-foreground/20 rounded', size === 'xs' ? 'w-4 h-5' : 'w-6 h-8')} />
      </figure>
    );
  }

  // Fallback: file type icon
  const { icon: IconComponent, colorClass } = getFileIconInfo(ext, contentType);

  return (
    <figure
      className={cn(
        'flex-shrink-0 flex items-center justify-center bg-primary/10',
        sizeConfig.container,
        borderRadius,
        className,
      )}
      aria-hidden="true"
    >
      <IconComponent className={cn(sizeConfig.iconSize, colorClass)} />
    </figure>
  );
}
