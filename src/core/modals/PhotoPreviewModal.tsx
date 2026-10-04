/**
 * @fileoverview Centralised Photo Preview Modal Component.
 *
 * Displays photos in a full-screen modal with zoom, rotate, pan, download,
 * share, and gallery navigation. State and helpers are extracted into
 * usePhotoPreviewState and photo-preview-helpers for Google SRP compliance.
 *
 * @module PhotoPreviewModal
 */
'use client';

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ShareButton } from '@/components/ui/ShareButton';
import { getContactDisplayName } from '@/types/contacts';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { photoPreviewLayout } from '@/styles/design-tokens';
import { PHOTO_COLORS } from '@/components/generic/config/photo-config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ViewerToolbarButton } from '@/components/shared/media/viewer/ViewerToolbarButton';
import { ImageViewControls } from '@/components/shared/media/viewer/ImageViewControls';
import { useTranslation } from 'react-i18next';

// Extracted modules — backward-compatible re-exports at bottom
import { usePhotoPreviewState } from '@/core/modals/usePhotoPreviewState';
import { PhotoPreviewImage } from '@/core/modals/PhotoPreviewImage';
import {
  createGalleryCounterBadge,
  createContactTypeBadge,
} from '@/core/modals/photo-preview-helpers';
import type { PhotoPreviewModalProps } from '@/core/modals/photo-preview-helpers';

// Re-export types & helpers for backward compatibility
export type { PhotoPreviewModalProps } from '@/core/modals/photo-preview-helpers';
export {
  createGalleryCounterBadge,
  createContactTypeBadge,
  generatePhotoTitle,
  getPhotoTypeIcon,
} from '@/core/modals/photo-preview-helpers';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Κεντρικοποιημένο Photo Preview Modal Component.
 *
 * Features: full-screen preview, zoom/rotate/pan, download, gallery nav,
 * pinch-to-zoom on mobile, share URL generation, keyboard + screen-reader a11y.
 */
export function PhotoPreviewModal({
  open,
  onOpenChange,
  photoUrl,
  photoTitle,
  contact,
  photoType = 'avatar',
  photoIndex,
  galleryPhotos,
  galleryPreviews,
  currentGalleryIndex,
  className
}: PhotoPreviewModalProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);

  const state = usePhotoPreviewState({
    open, onOpenChange, photoUrl, photoTitle, contact,
    photoType, photoIndex, galleryPhotos, galleryPreviews, currentGalleryIndex, t
  });

  // Early return — no photo AND dialog closed
  if (!state.currentPhoto && !open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={state.focusTrapRef}
        className={`${state.isMobile
          ? photoPreviewLayout.dialog.mobile
          : photoPreviewLayout.dialog.desktop
        } flex flex-col ${className} [&>button]:hidden`}
      >
        <DialogHeader className="flex flex-col space-y-3 pb-2">
          {/* Row 1: Title + Badge */}
          <header className="flex items-center justify-between" role="banner">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <state.IconComponent className={iconSizes.md} aria-hidden="true" />
              {state.title}
            </DialogTitle>

            {state.isGalleryMode && state.totalPhotos > 1 && (() => {
              const galleryBadge = createGalleryCounterBadge(state.currentIndex, state.totalPhotos, colors);
              return (
                <Badge variant={galleryBadge.variant} className={galleryBadge.className}>
                  {galleryBadge.label}
                </Badge>
              );
            })()}
          </header>

          {/* Row 2: Toolbar */}
          <ToolbarRow state={state} iconSizes={iconSizes} t={t} onClose={() => onOpenChange(false)} />
        </DialogHeader>

        {/* Screen-reader description — Radix DialogDescription for proper aria binding */}
        <DialogDescription className="sr-only">
          {state.isGalleryMode
            ? t('photoPreview.screenReader.gallery', {
                current: state.currentIndex + 1,
                total: state.totalPhotos,
                contactInfo: contact ? t('photoPreview.screenReader.photoFrom', { name: getContactDisplayName(contact) }) : ''
              })
            : t('photoPreview.screenReader.single', {
                contactInfo: contact ? t('photoPreview.screenReader.photoFrom', { name: getContactDisplayName(contact) }) : ''
              })
          }
        </DialogDescription>

        {/* Photo Content */}
        <main
          ref={state.view.containerRef}
          {...state.view.handlers}
          className={`flex-1 flex items-center justify-center overflow-hidden touch-none ${PHOTO_COLORS.PHOTO_BACKGROUND} rounded-none ${state.view.cursorClass}`}
          role="main"
          aria-label={t('photoPreview.aria.displayPhoto')}
        >
          <PhotoPreviewImage
            url={state.currentPhoto ?? null}
            preview={state.isGalleryMode ? galleryPreviews?.[state.currentIndex] ?? null : null}
            zoom={state.view.scale}
            alt={state.isGalleryMode
              ? t('photoPreview.alt.gallery', { title: state.title, current: state.currentIndex + 1, total: state.totalPhotos })
              : t('photoPreview.alt.single', { title: state.title })
            }
            imageRef={state.view.contentRef}
            className={`${photoPreviewLayout.image.base} ${TRANSITION_PRESETS.STANDARD_TRANSFORM}`}
            onLoad={state.handleImageLoad}
            onError={state.handleImageError}
          />
        </main>

        {/* Footer */}
        <footer
          className={`flex items-center justify-between text-sm ${colors.text.muted} pt-2 border-t ${state.isMobile ? 'pb-safe pb-8' : 'pb-2'}`}
          role="contentinfo"
          aria-label={t('photoPreview.aria.photoInfo')}
        >
          <section className="flex items-center" role="region" aria-label={t('photoPreview.aria.contactType')}>
            {contact?.type && (() => {
              const contactTypeBadge = createContactTypeBadge(contact.type, t, colors);
              return (
                <Badge variant={contactTypeBadge.variant} className={contactTypeBadge.className}>
                  {contactTypeBadge.label}
                </Badge>
              );
            })()}
          </section>
          <aside className="text-xs" role="status" aria-label={t('photoPreview.aria.focusInfo')}>
            {t('photoPreview.zoom.label')} {Math.round(state.view.zoom * 100)}%
          </aside>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// TOOLBAR SUB-COMPONENT (extracted for readability)
// ============================================================================

interface ToolbarRowProps {
  state: ReturnType<typeof usePhotoPreviewState>;
  iconSizes: ReturnType<typeof useIconSizes>;
  t: (key: string) => string;
  onClose: () => void;
}

/** Toolbar with gallery nav, zoom, rotate, share, download, and close buttons. */
function ToolbarRow({ state, iconSizes, t, onClose }: ToolbarRowProps) {
  return (
    <nav className="flex items-center justify-center gap-1" role="toolbar" aria-label={t('photoPreview.toolbar.ariaLabel')}>
      {/* Gallery Navigation */}
      {state.isGalleryMode && state.totalPhotos > 1 && (
        <>
          <ViewerToolbarButton label={t('photoPreview.navigation.previous')} icon={ChevronLeft}
            onClick={state.handlePreviousPhoto} disabled={state.currentIndex === 0} />
          <ViewerToolbarButton label={t('photoPreview.navigation.next')} icon={ChevronRight}
            onClick={state.handleNextPhoto} disabled={state.currentIndex === state.totalPhotos - 1} />
          <div className="w-px h-4 bg-border mx-1" />
        </>
      )}

      <ImageViewControls view={state.view} />

      <ShareButton
        shareData={state.shareData}
        variant="ghost"
        size="sm"
        showLabel={false}
        className={`${iconSizes.xl} p-0`}
      />

      <ViewerToolbarButton label={t('photoPreview.actions.download')} icon={Download} onClick={state.handleDownload} />
      <ViewerToolbarButton label={t('photoPreview.actions.close')} icon={X} onClick={onClose} />
    </nav>
  );
}

export default PhotoPreviewModal;
