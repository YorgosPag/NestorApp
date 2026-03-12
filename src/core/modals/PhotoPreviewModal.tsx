// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React, { useState, useEffect, useRef } from 'react'; // TypeScript refresh
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Download, ZoomIn, ZoomOut, RotateCw, User, Building2, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShareButton } from '@/components/ui/ShareButton';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { BadgeFactory } from '@/core/badges/BadgeFactory';
import { FileNamingService } from '@/services/FileNamingService';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { photoPreviewLayout } from '@/styles/design-tokens';
import {
  PHOTO_COLORS
} from '@/components/generic/config/photo-config';
import { useFocusTrap, announceToScreenReader } from '@/utils/accessibility';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors, type UseSemanticColorsReturn } from '@/ui-adapters/react/useSemanticColors';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import { generatePhotoId as enterpriseGeneratePhotoId } from '@/services/enterprise-id.service';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('PhotoPreviewModal');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoPreviewModalProps {
  /** Κατάσταση εμφάνισης του modal */
  open: boolean;
  /** Handler για κλείσιμο του modal */
  onOpenChange: (open: boolean) => void;
  /** URL της φωτογραφίας προς preview */
  photoUrl: string | null | undefined;
  /** Τίτλος της φωτογραφίας (optional) */
  photoTitle?: string;
  /** Contact data για εμφάνιση πληροφοριών (optional) */
  contact?: Contact;
  /** Τύπος φωτογραφίας για κατάλληλο τίτλο */
  photoType?: 'avatar' | 'logo' | 'representative' | 'profile' | 'gallery';
  /** Index της φωτογραφίας (για gallery) */
  photoIndex?: number;
  /** Array φωτογραφιών για gallery navigation (optional) */
  galleryPhotos?: (string | null)[];
  /** Current index στο gallery array (optional) */
  currentGalleryIndex?: number;
  /** Custom CSS classes */
  className?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Δημιουργεί gallery counter badge με κεντρικοποιημένο badge system
 * 🏢 ENTERPRISE: Accepts colors via dependency injection
 */
function createGalleryCounterBadge(
  currentIndex: number,
  totalPhotos: number,
  colors: UseSemanticColorsReturn
) {
  return BadgeFactory.createCommonBadge('info', colors, {
    customLabel: `${currentIndex + 1}/${totalPhotos}`,
    variant: 'outline',
    size: 'sm',
    className: 'text-muted-foreground'
  });
}

/**
 * Δημιουργεί contact type badge με κεντρικοποιημένο badge system
 * 🏢 ENTERPRISE: i18n-enabled with t function parameter and colors DI
 */
function createContactTypeBadge(
  contactType: Contact['type'],
  t: (key: string) => string,
  colors: UseSemanticColorsReturn
) {
  let label = '';

  switch (contactType) {
    case 'individual':
      label = t('photoPreview.contactType.individual');
      break;
    case 'company':
      label = t('photoPreview.contactType.company');
      break;
    case 'service':
      label = t('photoPreview.contactType.service');
      break;
    default:
      label = t('photoPreview.contactType.unknown');
  }

  return BadgeFactory.createCommonBadge('info', colors, {
    customLabel: label,
    variant: 'secondary',
    size: 'sm'
  });
}

/**
 * Δημιουργεί κατάλληλο τίτλο για τη φωτογραφία βάσει τύπου και επαφής
 * 🏢 ENTERPRISE: i18n-enabled with t function parameter
 */
function generatePhotoTitle(
  contact: Contact | undefined,
  photoType: PhotoPreviewModalProps['photoType'] = 'avatar',
  photoIndex: number | undefined,
  customTitle: string | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  // Αν υπάρχει custom τίτλος, χρησιμοποίησε αυτόν
  if (customTitle) {
    return customTitle;
  }

  // Αν δεν υπάρχει contact, generic τίτλοι
  if (!contact) {
    switch (photoType) {
      case 'avatar':
      case 'profile':
        return t('photoPreview.titles.profile');
      case 'logo':
        return t('photoPreview.titles.logo');
      case 'representative':
        return t('photoPreview.titles.representative');
      case 'gallery':
        return photoIndex !== undefined
          ? t('photoPreview.titles.photoWithIndex', { index: photoIndex + 1 })
          : t('photoPreview.titles.photo');
      default:
        return t('photoPreview.titles.photo');
    }
  }

  // Παίρνουμε το όνομα της επαφής
  const contactName = getContactDisplayName(contact);

  // Επιστρέφουμε μόνο το όνομα - η ετικέτα δεξιά δείχνει τον τύπο/αριθμό
  return contactName;
}

/**
 * Επιστρέφει κατάλληλο icon για τον τύπο φωτογραφίας
 */
function getPhotoTypeIcon(photoType: PhotoPreviewModalProps['photoType'] = 'avatar') {
  switch (photoType) {
    case 'avatar':
    case 'profile':
    case 'representative':
      return User;
    case 'logo':
      return Building2;
    case 'gallery':
      return User;
    default:
      return User;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * 🖼️ Κεντρικοποιημένο Photo Preview Modal Component
 *
 * Εμφανίζει φωτογραφίες σε modal με δυνατότητες:
 * - Full-screen preview
 * - Κατάλληλους τίτλους βάσει contact data
 * - Download functionality
 * - Zoom controls (future enhancement)
 *
 * @example
 * ```tsx
 * // Χρήση στο ContactDetailsHeader
 * <PhotoPreviewModal
 *   open={showPhotoModal}
 *   onOpenChange={setShowPhotoModal}
 *   photoUrl={contact?.photoURL}
 *   contact={contact}
 *   photoType="avatar"
 * />
 *
 * // Χρήση στο ContactListItem
 * <PhotoPreviewModal
 *   open={showPhotoModal}
 *   onOpenChange={setShowPhotoModal}
 *   photoUrl={contact?.photoURL}
 *   contact={contact}
 *   photoType="profile"
 * />
 * ```
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
  currentGalleryIndex,
  className
}: PhotoPreviewModalProps) {
  // ============================================================================
  // ALL HOOKS MUST BE AT TOP LEVEL - BEFORE ANY EARLY RETURNS
  // ============================================================================

  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  // State για zoom functionality (μελλοντική επέκταση)
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // State για gallery navigation
  const [currentIndex, setCurrentIndex] = useState(currentGalleryIndex || 0);

  // 📱 Mobile detection για responsive modal positioning
  const [isMobile, setIsMobile] = useState(false);

  // Refs για keyboard navigation (αποφεύγουν stale closures)
  const currentIndexRef = useRef(currentIndex);
  const isGalleryModeRef = useRef(false);
  const totalPhotosRef = useRef(0);

  // 📱 Pinch-to-zoom και Pan state για mobile (MOVED TO TOP LEVEL)
  const [initialDistance, setInitialDistance] = useState<number | undefined>(undefined);
  const [initialZoom, setInitialZoom] = useState(1);

  // Pan state για image dragging (MOVED TO TOP LEVEL)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [initialPanOffset, setInitialPanOffset] = useState({ x: 0, y: 0 });

  // Image dimensions state για adaptive sizing (MOVED TO TOP LEVEL)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, aspectRatio: 1 });

  // ♿ Focus trap για accessibility με keyboard navigation
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open, {
    autoFocus: true,
    restoreFocus: true,
    escapeDeactivates: true,
    onEscape: () => onOpenChange(false)
  });
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Gallery logic - πάντα χρησιμοποιούμε το current gallery photo αν είμαστε σε gallery mode
  const isGalleryMode = galleryPhotos && galleryPhotos.length > 0;
  const currentPhoto = isGalleryMode ? galleryPhotos[currentIndex] : photoUrl;
  const validPhotos = galleryPhotos?.filter(photo => photo !== null) || [];
  const totalPhotos = validPhotos.length;

  // Update refs when values change
  currentIndexRef.current = currentIndex;
  isGalleryModeRef.current = !!isGalleryMode;
  totalPhotosRef.current = totalPhotos;

  // Update currentIndex when currentGalleryIndex prop changes
  useEffect(() => {
    if (currentGalleryIndex !== undefined) {
      setCurrentIndex(currentGalleryIndex);
    }
  }, [currentGalleryIndex]);

  // Mobile detection effect για responsive modal
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const translateX = Number.isFinite(panOffset.x) ? panOffset.x : 0;
    const translateY = Number.isFinite(panOffset.y) ? panOffset.y : 0;
    const scale = Number.isFinite(zoom) ? zoom : 1;
    const rotate = Number.isFinite(rotation) ? rotation : 0;

    image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotate}deg)`;
    image.style.transformOrigin = 'center center';
    image.style.touchAction = isMobile ? 'none' : 'auto';
  }, [isMobile, panOffset.x, panOffset.y, zoom, rotation, currentPhoto]);

  // Keyboard navigation με refs (χωρίς dependency issues)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Χρησιμοποιούμε refs για fresh values
      const currentGalleryMode = isGalleryModeRef.current;
      const currentTotal = totalPhotosRef.current;

      if (!currentGalleryMode || currentTotal <= 1) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onOpenChange(false);
        }
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          setCurrentIndex(prevIndex => prevIndex > 0 ? prevIndex - 1 : currentTotal - 1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          setCurrentIndex(prevIndex => prevIndex < currentTotal - 1 ? prevIndex + 1 : 0);
          break;
        case 'Escape':
          event.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // ============================================================================
  // EARLY RETURNS AFTER ALL HOOKS
  // ============================================================================

  // Αν δεν υπάρχει φωτογραφία, δεν εμφανίζουμε το modal
  if (!currentPhoto) {
    return null;
  }

  // ============================================================================
  // REGULAR LOGIC AFTER EARLY RETURNS
  // ============================================================================

  // Δημιουργούμε τον τίτλο
  const displayIndex = isGalleryMode ? currentIndex : photoIndex;
  const title = generatePhotoTitle(contact, photoType, displayIndex, photoTitle, t);
  const IconComponent = getPhotoTypeIcon(photoType);

  // Navigation handlers για gallery με accessibility announcements
  const handlePreviousPhoto = () => {
    if (!isGalleryMode || totalPhotos <= 1) return;
    setCurrentIndex(prevIndex => {
      const newIndex = prevIndex > 0 ? prevIndex - 1 : totalPhotos - 1;
      // ♿ Screen reader announcement
      announceToScreenReader(
        `Φωτογραφία ${newIndex + 1} από ${totalPhotos}`,
        'assertive'
      );
      return newIndex;
    });
  };

  const handleNextPhoto = () => {
    if (!isGalleryMode || totalPhotos <= 1) return;
    setCurrentIndex(prevIndex => {
      const newIndex = prevIndex < totalPhotos - 1 ? prevIndex + 1 : 0;
      // ♿ Screen reader announcement
      announceToScreenReader(
        `Φωτογραφία ${newIndex + 1} από ${totalPhotos}`,
        'assertive'
      );
      return newIndex;
    });
  };

  // Handlers
  const handleDownload = () => {
    try {
      // 🏢 ENTERPRISE: Extract extension from Firebase URL
      const url = new URL(currentPhoto);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '.jpg';

      // 🎯 CENTRALIZED: Generate proper filename using FileNamingService
      let downloadFilename = `${title}${extension}`;

      if (contact) {
        try {
          const { formData: contactFormData } = mapContactToFormData(contact);

          // Determine purpose based on photoType
          let purpose: 'logo' | 'photo' | 'representative' = 'photo';
          if (photoType === 'logo') purpose = 'logo';
          else if (photoType === 'representative') purpose = 'representative';

          // Generate professional filename using FileNamingService
          downloadFilename = FileNamingService.generateFilenameFromBase64(
            contactFormData,
            purpose,
            `image/${extension.replace('.', '')}`,
            photoIndex
          );

        } catch (error) {
          logger.warn('FileNamingService generation failed, using fallback', { error });
          downloadFilename = `${title}${extension}`;
        }
      }

      // 🏢 ENTERPRISE DOWNLOAD: Use server-side proxy API
      const downloadApiUrl = `/api/download?` + new URLSearchParams({
        url: currentPhoto,
        filename: downloadFilename
      });

      logger.info('ENTERPRISE DOWNLOAD', {
        originalUrl: currentPhoto,
        filename: downloadFilename,
        apiUrl: downloadApiUrl
      });

      // 🎯 FORCE DOWNLOAD: Direct link to API endpoint
      const link = document.createElement('a');
      link.href = downloadApiUrl;
      link.download = downloadFilename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      logger.error('Download failed', { error });
      // Fallback: Basic download
      const link = document.createElement('a');
      link.href = currentPhoto;
      link.download = `${title}.jpg`;
      link.click();
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 8));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleFitToView = () => {
    setZoom(1); // Reset zoom to 100% για fit to view
    setRotation(0); // Reset rotation για καθαρή εμφάνιση
    setPanOffset({ x: 0, y: 0 }); // Reset pan position για κεντραρισμένη εμφάνιση
  };

  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isMobile) {
      // Pinch-to-zoom με δύο δάχτυλα
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setInitialDistance(distance);
      setInitialZoom(zoom);
      setIsPanning(false); // Disable panning during pinch
    } else if (e.touches.length === 1 && isMobile && zoom > 1) {
      // Pan με ένα δάχτυλο (μόνο αν έχει zoom)
      e.preventDefault();
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX, y: touch.clientY });
      setInitialPanOffset({ ...panOffset });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance !== undefined && isMobile) {
      // Pinch-to-zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance;
      const newZoom = Math.min(Math.max(initialZoom * scale, 0.25), 8);
      setZoom(newZoom);
    } else if (e.touches.length === 1 && isPanning && isMobile && zoom > 1) {
      // Pan/drag
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - panStart.x;
      const deltaY = touch.clientY - panStart.y;

      // Calculate new pan offset with proper boundaries based on container size
      const containerRect = (e.target as HTMLElement).getBoundingClientRect();
      const imageWidth = containerRect.width;
      const imageHeight = containerRect.height;

      // Calculate maximum pan distance based on how much the zoomed image exceeds the container
      const maxPanX = Math.max(0, (imageWidth * (zoom - 1)) / 2);
      const maxPanY = Math.max(0, (imageHeight * (zoom - 1)) / 2);

      const newX = Math.max(-maxPanX, Math.min(maxPanX, initialPanOffset.x + deltaX));
      const newY = Math.max(-maxPanY, Math.min(maxPanY, initialPanOffset.y + deltaY));

      setPanOffset({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setInitialDistance(undefined);
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  };

  // Generate photo share URL pointing to our dedicated sharing page with Open Graph tags
  const generatePhotoShareUrl = () => {
    // Create a unique photo ID for the sharing page
    const photoId = generatePhotoId();

    // Store photo data for the sharing page to access
    const photoShareData = {
      id: photoId,
      url: currentPhoto.replace(/\?alt=media&token=.*$/, '?alt=media'),  // Αφαιρεί το token
      title: title,
      description: contact ? `Φωτογραφία από ${getContactDisplayName(contact)}` : `Φωτογραφία από ${title}`,
      contact: contact ? {
        name: getContactDisplayName(contact),
        type: contact.type
      } : undefined,
      metadata: {
        uploadedAt: new Date().toISOString(),
        photoType: photoType
      }
    };

    // Store in sessionStorage for the sharing page to access
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`photo_share_${photoId}`, JSON.stringify(photoShareData));
    }

    // Always use production URL for social media sharing
    const productionUrl = 'https://nestor-app.vercel.app';
    const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const baseUrl = currentUrl.includes('localhost') ? `${productionUrl}/share/photo/${photoId}` : `${currentUrl}/share/photo/${photoId}`;
    const params = new URLSearchParams({
      utm_source: 'photo_modal',
      utm_medium: 'social_share',
      utm_campaign: 'photo_sharing',
      utm_content: `${photoType}_photo`,
      shared: 'true',
      // Include encoded data as backup
      data: encodeURIComponent(JSON.stringify(photoShareData))
    });

    const finalUrl = `${baseUrl}?${params.toString()}`;
    logger.info('Generated share URL', { url: finalUrl });
    return finalUrl;
  };

  // Generate unique photo ID for sharing — delegates to enterprise-id.service
  const generatePhotoId = () => enterpriseGeneratePhotoId();

  const shareData = {
    title: title,
    text: `${title}${contact ? `\n${getContactDisplayName(contact)}` : ''}\n\nΔείτε τη φωτογραφία στο Nestor Construct!`,
    url: generatePhotoShareUrl(), // Use webpage URL with Open Graph tags for proper social media preview
    // Mark as photo for ShareModal to handle correctly
    isPhoto: true,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={focusTrapRef}
        className={`${isMobile
          ? photoPreviewLayout.dialog.mobile
          : photoPreviewLayout.dialog.desktop
        } flex flex-col ${className} [&>button]:hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-preview-title"
        aria-describedby="photo-preview-description"
      >
        <DialogHeader className="flex flex-col space-y-3 pb-2">
          {/* Πρώτη σειρά: Τίτλος και Badge */}
          <header className="flex items-center justify-between" role="banner">
            <DialogTitle id="photo-preview-title" className="flex items-center gap-2 text-lg">
              <IconComponent className={iconSizes.md} aria-hidden="true" />
              {title}
            </DialogTitle>

            {/* Gallery Counter - δεξιά από το όνομα */}
            {isGalleryMode && totalPhotos > 1 && (() => {
              const galleryBadge = createGalleryCounterBadge(currentIndex, totalPhotos, colors);
              return (
                <Badge
                  variant={galleryBadge.variant}
                  className={galleryBadge.className}
                >
                  {galleryBadge.label}
                </Badge>
              );
            })()}
          </header>

          {/* Δεύτερη σειρά: Κεντραρισμένα buttons με κοντά spacing */}
          <nav className="flex items-center justify-center gap-1" role="toolbar" aria-label={t('photoPreview.toolbar.ariaLabel')}>
            {/* Gallery Navigation */}
            {isGalleryMode && totalPhotos > 1 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePreviousPhoto}
                      aria-label={t('photoPreview.navigation.previousAria', { current: currentIndex, total: totalPhotos })}
                      className="${iconSizes.xl} p-0"
                      disabled={currentIndex === 0}
                    >
                      <ChevronLeft className={`${iconSizes.sm}`} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('photoPreview.navigation.previous')}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextPhoto}
                      aria-label={t('photoPreview.navigation.nextAria', { current: currentIndex + 2, total: totalPhotos })}
                      className="${iconSizes.xl} p-0"
                      disabled={currentIndex === totalPhotos - 1}
                    >
                      <ChevronRight className={`${iconSizes.sm}`} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('photoPreview.navigation.next')}</TooltipContent>
                </Tooltip>

                <div className="w-px h-4 bg-border mx-1" />
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.25}
                  className="${iconSizes.xl} p-0"
                >
                  <ZoomOut className={iconSizes.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('photoPreview.zoom.out')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 8}
                  className="${iconSizes.xl} p-0"
                >
                  <ZoomIn className={iconSizes.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('photoPreview.zoom.in')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRotate}
                  className="${iconSizes.xl} p-0"
                >
                  <RotateCw className={iconSizes.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('photoPreview.actions.rotate')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFitToView}
                  className="${iconSizes.xl} p-0"
                >
                  <Maximize2 className={iconSizes.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('photoPreview.zoom.fit')}</TooltipContent>
            </Tooltip>

            <ShareButton
              shareData={shareData}
              variant="ghost"
              size="sm"
              showLabel={false}
              className="${iconSizes.xl} p-0"
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="${iconSizes.xl} p-0"
                >
                  <Download className={iconSizes.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('photoPreview.actions.download')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="${iconSizes.xl} p-0"
                >
                  <X className={iconSizes.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('photoPreview.actions.close')}</TooltipContent>
            </Tooltip>
          </nav>
        </DialogHeader>

        {/* ♿ Hidden description για screen readers */}
        <div id="photo-preview-description" className="sr-only">
          {isGalleryMode
            ? t('photoPreview.screenReader.gallery', {
                current: currentIndex + 1,
                total: totalPhotos,
                contactInfo: contact ? t('photoPreview.screenReader.photoFrom', { name: getContactDisplayName(contact) }) : ''
              })
            : t('photoPreview.screenReader.single', {
                contactInfo: contact ? t('photoPreview.screenReader.photoFrom', { name: getContactDisplayName(contact) }) : ''
              })
          }
        </div>

        {/* Photo Content */}
        <main className={`flex-1 flex items-center justify-center overflow-hidden ${PHOTO_COLORS.PHOTO_BACKGROUND} rounded-none`} role="main" aria-label={t('photoPreview.aria.displayPhoto')}>
          <figure className="relative w-full h-full flex items-center justify-center">
            <img
              src={currentPhoto}
              alt={isGalleryMode
                ? t('photoPreview.alt.gallery', { title, current: currentIndex + 1, total: totalPhotos })
                : t('photoPreview.alt.single', { title })
              }
              ref={imageRef}
              className={`${photoPreviewLayout.image.base} ${TRANSITION_PRESETS.STANDARD_TRANSFORM}`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                setImageDimensions({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  aspectRatio
                });
                logger.info('Image loaded', {
                  naturalWidth: img.naturalWidth,
                  naturalHeight: img.naturalHeight,
                  aspectRatio: aspectRatio.toFixed(2),
                  orientation: aspectRatio > 1 ? 'landscape' : aspectRatio < 1 ? 'portrait' : 'square'
                });
              }}
              onError={(e) => {
                logger.error('Failed to load image', { photo: currentPhoto });
                // TODO: Show error state
              }}
            />
          </figure>
        </main>

        {/* Footer Info - Contact Type και Zoom */}
        <footer className={`flex items-center justify-between text-sm text-muted-foreground pt-2 border-t ${isMobile ? 'pb-safe pb-8' : 'pb-2'}`} role="contentinfo" aria-label={t('photoPreview.aria.photoInfo')}>
          <section className="flex items-center" role="region" aria-label={t('photoPreview.aria.contactType')}>
            {/* Μόνο η ετικέτα τύπου contact - όχι εικονίδιο και όνομα */}
            {contact?.type && (() => {
              const contactTypeBadge = createContactTypeBadge(contact.type, t, colors);
              return (
                <Badge
                  variant={contactTypeBadge.variant}
                  className={contactTypeBadge.className}
                >
                  {contactTypeBadge.label}
                </Badge>
              );
            })()}
          </section>
          <aside className="text-xs" role="status" aria-label={t('photoPreview.aria.focusInfo')}>
            {t('photoPreview.zoom.label')} {Math.round(zoom * 100)}%
          </aside>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

export default PhotoPreviewModal;
