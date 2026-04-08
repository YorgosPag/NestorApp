/**
 * @fileoverview Custom hook encapsulating ALL state and handlers for PhotoPreviewModal.
 *
 * Extracted from PhotoPreviewModal.tsx to comply with Google SRP standards
 * (max 500 lines per file). Contains: zoom/rotation state, gallery navigation,
 * mobile detection, pinch-to-zoom, pan/drag, image dimensions, focus trap,
 * keyboard navigation, touch handlers, download handler, and share URL generation.
 *
 * @module usePhotoPreviewState
 */

import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { useFocusTrap, announceToScreenReader } from '@/utils/accessibility';
import { FileNamingService } from '@/services/FileNamingService';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { API_ROUTES } from '@/config/domain-constants';
import { generatePhotoId as enterpriseGeneratePhotoId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { PhotoPreviewModalProps } from '@/core/modals/photo-preview-helpers';
import { generatePhotoTitle, getPhotoTypeIcon } from '@/core/modals/photo-preview-helpers';

const logger = createModuleLogger('usePhotoPreviewState');

// ============================================================================
// TYPES
// ============================================================================

interface UsePhotoPreviewStateParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null | undefined;
  photoTitle?: string;
  contact?: Contact;
  photoType: NonNullable<PhotoPreviewModalProps['photoType']>;
  photoIndex?: number;
  galleryPhotos?: (string | null)[];
  currentGalleryIndex?: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}

// ============================================================================
// TOUCH HELPER
// ============================================================================

function getTouchDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// HOOK
// ============================================================================

/** Encapsulates all PhotoPreviewModal state, refs, effects, and handlers. */
export function usePhotoPreviewState(params: UsePhotoPreviewStateParams) {
  const {
    open, onOpenChange, photoUrl, photoTitle, contact,
    photoType, photoIndex, galleryPhotos, currentGalleryIndex, t
  } = params;

  // --- Zoom / rotation ---
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // --- Gallery navigation ---
  const [currentIndex, setCurrentIndex] = useState(currentGalleryIndex ?? 0);

  // --- Mobile detection ---
  const [isMobile, setIsMobile] = useState(false);

  // --- Refs for keyboard nav (avoid stale closures) ---
  const currentIndexRef = useRef(currentIndex);
  const isGalleryModeRef = useRef(false);
  const totalPhotosRef = useRef(0);

  // --- Pinch-to-zoom ---
  const [initialDistance, setInitialDistance] = useState<number | undefined>(undefined);
  const [initialZoom, setInitialZoom] = useState(1);

  // --- Pan / drag ---
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [initialPanOffset, setInitialPanOffset] = useState({ x: 0, y: 0 });

  // --- Image dimensions ---
  const [, setImageDimensions] = useState({ width: 0, height: 0, aspectRatio: 1 });

  // --- Focus trap ---
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open, {
    autoFocus: true,
    restoreFocus: true,
    escapeDeactivates: true,
    onEscape: () => onOpenChange(false)
  });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  const panOffsetRef = useRef(panOffset);
  zoomRef.current = zoom;
  panOffsetRef.current = panOffset;

  // --- Derived gallery values ---
  const isGalleryMode = galleryPhotos && galleryPhotos.length > 0;
  const currentPhoto = isGalleryMode ? galleryPhotos[currentIndex] : photoUrl;
  const validPhotos = galleryPhotos?.filter(photo => photo !== null) ?? [];
  const totalPhotos = validPhotos.length;

  // --- Keep refs in sync ---
  currentIndexRef.current = currentIndex;
  isGalleryModeRef.current = !!isGalleryMode;
  totalPhotosRef.current = totalPhotos;

  // --- Effects ---

  useEffect(() => {
    if (currentGalleryIndex !== undefined) {
      setCurrentIndex(currentGalleryIndex);
    }
  }, [currentGalleryIndex]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
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

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
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
          setCurrentIndex(prev => prev > 0 ? prev - 1 : currentTotal - 1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          setCurrentIndex(prev => prev < currentTotal - 1 ? prev + 1 : 0);
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

  // --- Wheel zoom-to-cursor (desktop, Google Photos pattern) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !open) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;

      const cur = zoomRef.current;
      const pan = panOffsetRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.min(Math.max(cur * factor, 0.25), 8);
      const ratio = next / cur;

      setZoom(next);
      setPanOffset({
        x: cx - (cx - pan.x) * ratio,
        y: cy - (cy - pan.y) * ratio,
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [open]);

  // --- Mouse drag pan (desktop) ---
  useEffect(() => {
    if (!isPanning || isMobile) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const img = imageRef.current;
      if (!img) return;

      const curZoom = zoomRef.current;
      const maxX = Math.max(0, (img.offsetWidth * (curZoom - 1)) / 2);
      const maxY = Math.max(0, (img.offsetHeight * (curZoom - 1)) / 2);

      setPanOffset({
        x: Math.max(-maxX, Math.min(maxX, initialPanOffset.x + dx)),
        y: Math.max(-maxY, Math.min(maxY, initialPanOffset.y + dy)),
      });
    };

    const onUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning, isMobile, panStart, initialPanOffset]);

  // --- Derived display values ---
  const displayIndex = isGalleryMode ? currentIndex : photoIndex;
  const title = generatePhotoTitle(contact, photoType, displayIndex, photoTitle, t);
  const IconComponent = getPhotoTypeIcon(photoType);

  // --- Gallery navigation handlers ---

  const handlePreviousPhoto = () => {
    if (!isGalleryMode || totalPhotos <= 1) return;
    setCurrentIndex(prev => {
      const newIndex = prev > 0 ? prev - 1 : totalPhotos - 1;
      announceToScreenReader(`Φωτογραφία ${newIndex + 1} από ${totalPhotos}`, 'assertive');
      return newIndex;
    });
  };

  const handleNextPhoto = () => {
    if (!isGalleryMode || totalPhotos <= 1) return;
    setCurrentIndex(prev => {
      const newIndex = prev < totalPhotos - 1 ? prev + 1 : 0;
      announceToScreenReader(`Φωτογραφία ${newIndex + 1} από ${totalPhotos}`, 'assertive');
      return newIndex;
    });
  };

  // --- Download handler ---

  const handleDownload = () => {
    if (!currentPhoto) return;

    try {
      const url = new URL(currentPhoto);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '.jpg';

      let downloadFilename = `${title}${extension}`;

      if (contact) {
        try {
          const { formData: contactFormData } = mapContactToFormData(contact);
          let purpose: 'logo' | 'photo' | 'representative' = 'photo';
          if (photoType === 'logo') purpose = 'logo';
          else if (photoType === 'representative') purpose = 'representative';

          downloadFilename = FileNamingService.generateFilenameFromBase64(
            contactFormData, purpose, `image/${extension.replace('.', '')}`, photoIndex
          );
        } catch (error) {
          logger.warn('FileNamingService generation failed, using fallback', { error });
          downloadFilename = `${title}${extension}`;
        }
      }

      const downloadApiUrl = `${API_ROUTES.DOWNLOAD}?` + new URLSearchParams({
        url: currentPhoto,
        filename: downloadFilename
      });

      logger.info('ENTERPRISE DOWNLOAD', { originalUrl: currentPhoto, filename: downloadFilename, apiUrl: downloadApiUrl });

      const link = document.createElement('a');
      link.href = downloadApiUrl;
      link.download = downloadFilename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      logger.error('Download failed', { error });
      if (!currentPhoto) return;
      const link = document.createElement('a');
      link.href = currentPhoto;
      link.download = `${title}.jpg`;
      link.click();
    }
  };

  // --- Zoom / rotate handlers ---

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 8));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleFitToView = () => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
  };

  // --- Mouse down for desktop drag (only when zoomed) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile || zoom <= 1 || e.button !== 0) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setInitialPanOffset({ ...panOffsetRef.current });
  };

  // --- Double-click to reset zoom & pan ---
  const handleDoubleClick = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // --- Touch handlers ---

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isMobile) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setInitialDistance(distance);
      setInitialZoom(zoom);
      setIsPanning(false);
    } else if (e.touches.length === 1 && isMobile && zoom > 1) {
      e.preventDefault();
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX, y: touch.clientY });
      setInitialPanOffset({ ...panOffset });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance !== undefined && isMobile) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance;
      const newZoom = Math.min(Math.max(initialZoom * scale, 0.25), 8);
      setZoom(newZoom);
    } else if (e.touches.length === 1 && isPanning && isMobile && zoom > 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - panStart.x;
      const deltaY = touch.clientY - panStart.y;

      const containerRect = (e.target as HTMLElement).getBoundingClientRect();
      const imageWidth = containerRect.width;
      const imageHeight = containerRect.height;

      const maxPanX = Math.max(0, (imageWidth * (zoom - 1)) / 2);
      const maxPanY = Math.max(0, (imageHeight * (zoom - 1)) / 2);

      const newX = Math.max(-maxPanX, Math.min(maxPanX, initialPanOffset.x + deltaX));
      const newY = Math.max(-maxPanY, Math.min(maxPanY, initialPanOffset.y + deltaY));

      setPanOffset({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) setInitialDistance(undefined);
    if (e.touches.length === 0) setIsPanning(false);
  };

  // --- Share URL generation ---

  const generatePhotoShareUrl = (): string => {
    if (!currentPhoto) return '';

    const photoId = enterpriseGeneratePhotoId();

    const photoShareData = {
      id: photoId,
      url: currentPhoto.replace(/\?alt=media&token=.*$/, '?alt=media'),
      title,
      description: contact
        ? `Φωτογραφία από ${getContactDisplayName(contact)}`
        : `Φωτογραφία από ${title}`,
      contact: contact ? { name: getContactDisplayName(contact), type: contact.type } : undefined,
      metadata: { uploadedAt: new Date().toISOString(), photoType }
    };

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`photo_share_${photoId}`, JSON.stringify(photoShareData));
    }

    const productionUrl = 'https://nestor-app.vercel.app';
    const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const baseUrl = currentUrl.includes('localhost')
      ? `${productionUrl}/share/photo/${photoId}`
      : `${currentUrl}/share/photo/${photoId}`;

    const urlParams = new URLSearchParams({
      utm_source: 'photo_modal',
      utm_medium: 'social_share',
      utm_campaign: 'photo_sharing',
      utm_content: `${photoType}_photo`,
      shared: 'true',
      data: encodeURIComponent(JSON.stringify(photoShareData))
    });

    const finalUrl = `${baseUrl}?${urlParams.toString()}`;
    logger.info('Generated share URL', { url: finalUrl });
    return finalUrl;
  };

  // --- Image onLoad handler ---

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
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
  };

  const handleImageError = () => {
    logger.error('Failed to load image', { photo: currentPhoto });
  };

  // --- Share data ---

  const shareData = {
    title,
    text: `${title}${contact ? `\n${getContactDisplayName(contact)}` : ''}\n\nΔείτε τη φωτογραφία στο Nestor Construct!`,
    url: generatePhotoShareUrl(),
    isPhoto: true,
  };

  return {
    // Refs
    focusTrapRef,
    imageRef,
    containerRef,
    // Derived
    isMobile,
    isPanning,
    isGalleryMode,
    currentPhoto,
    totalPhotos,
    currentIndex,
    zoom,
    title,
    IconComponent,
    shareData,
    // Handlers
    handlePreviousPhoto,
    handleNextPhoto,
    handleZoomIn,
    handleZoomOut,
    handleRotate,
    handleFitToView,
    handleDownload,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleImageLoad,
    handleImageError,
    handleMouseDown,
    handleDoubleClick,
  };
}
