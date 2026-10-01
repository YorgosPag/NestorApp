/**
 * =============================================================================
 * 🏢 ENTERPRISE: FileThumbnail Component
 * =============================================================================
 *
 * Universal file thumbnail component that handles:
 * - Images → server-side derivative (`preview` srcset, ADR-899 §4.1) → client `_thumb` → icon
 * - PDFs → auto-generated page 1 preview (via pdfjs-dist)
 * - Other files → semantic file type icon
 *
 * @module components/shared/files/FileThumbnail
 * @enterprise ADR-191 - Enterprise Document Management System
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { fileDisplayUrl } from '@/lib/files/file-display-url';
import { cn } from '@/lib/utils';
import { getFileIconInfo, isImageFile, isPdfFile } from './utils/file-icons';
import { usePdfThumbnail } from './hooks/usePdfThumbnail';
import {
  THUMBNAIL_SIZE_CONFIG,
  thumbnailCandidatesKey,
  thumbnailCandidatesOf,
  type FileThumbnailSubject,
  type ThumbnailCandidate,
  type ThumbnailSize,
} from './file-thumbnail-sources';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface FileThumbnailProps {
  /**
   * Η εγγραφή — **ολόκληρη**, όχι ένα `downloadUrl` (ADR-899 §4.1): η μικρογραφία ρωτά τον ΕΝΑ αναγνώστη
   * (`fileDisplayUrlOf`) και παίρνει παράγωγο του server στο μέγεθος του κουτιού.
   */
  file: FileThumbnailSubject;
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
// COMPONENT
// ============================================================================

export function FileThumbnail({
  file,
  displayName = '',
  size = 'sm',
  className,
  borderRadius = 'rounded-md',
}: FileThumbnailProps) {
  const sizeConfig = THUMBNAIL_SIZE_CONFIG[size];
  const ext = file.ext ?? undefined;
  const contentType = file.contentType ?? undefined;
  const isImage = isImageFile(ext, contentType);
  const isPdf = isPdfFile(ext, contentType);

  const candidates = useMemo(
    () => thumbnailCandidatesOf(file, { isImage }, sizeConfig.px),
    [file, isImage, sizeConfig.px],
  );
  const candidatesKey = thumbnailCandidatesKey(candidates);

  // Κλιμάκωση σφαλμάτων: κάθε `onError` προχωρά στην επόμενη πηγή. Δεμένη στην ταυτότητα της λίστας ⇒
  // νέο αρχείο = ξανά από την αρχή, χωρίς effect.
  const [failure, setFailure] = useState({ key: candidatesKey, index: 0 });
  const index = failure.key === candidatesKey ? failure.index : 0;
  const candidate = candidates[index] ?? null;
  const handleImageError = useCallback(() => {
    setFailure({ key: candidatesKey, index: index + 1 });
  }, [candidatesKey, index]);

  // PDF: σελίδα 1, μόνο όταν εξαντληθούν οι έτοιμες πηγές (π.χ. δεν υπάρχει `_thumb`).
  const { thumbnailUrl: pdfThumbUrl, loading: pdfLoading } = usePdfThumbnail(
    fileDisplayUrl(file) ?? undefined,
    isPdf && !candidate,
  );

  const shown: ThumbnailCandidate | null = candidate ?? (isPdf && pdfThumbUrl ? { src: pdfThumbUrl } : null);

  // Show image/thumbnail preview
  if (shown) {
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
          src={shown.src}
          srcSet={shown.srcSet}
          sizes={shown.sizes}
          alt={displayName}
          loading="lazy"
          decoding="async"
          onError={candidate ? handleImageError : undefined}
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
