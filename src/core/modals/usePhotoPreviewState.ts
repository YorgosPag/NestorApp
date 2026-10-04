/**
 * @fileoverview State & handlers for PhotoPreviewModal.
 * @module usePhotoPreviewState
 */

import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { useZoomPan } from '@/hooks/useZoomPan';
import { PHOTO_VIEW_ZOOM } from '@/components/shared/media/viewer/photo-view-zoom';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { publicOrigin } from '@/lib/http/public-origin';
import { announceToScreenReader } from '@/utils/accessibility';
import { indexWithin } from '@/lib/array-utils';
import { FileNamingService } from '@/services/FileNamingService';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { generatePhotoId as enterpriseGeneratePhotoId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { useFileDownload } from '@/components/shared/files/hooks/useFileDownload';
import type { PhotoPreviewModalProps } from '@/core/modals/photo-preview-helpers';
import { generatePhotoTitle, getPhotoTypeIcon, buildPhotoShareText } from '@/core/modals/photo-preview-helpers';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('usePhotoPreviewState');

interface UsePhotoPreviewStateParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null | undefined;
  photoTitle?: string;
  contact?: Contact;
  photoType: NonNullable<PhotoPreviewModalProps['photoType']>;
  photoIndex?: number;
  galleryPhotos?: (string | null)[];
  /** Τα παράγωγα ανά φωτογραφία — από εδώ οι **διαστάσεις** για το «ξαναχωρά μετά τη στροφή» (ADR-899 §9 θέμα 5β). */
  galleryPreviews?: PhotoPreviewModalProps['galleryPreviews'];
  currentGalleryIndex?: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function usePhotoPreviewState(params: UsePhotoPreviewStateParams) {
  const {
    open, onOpenChange, photoUrl, photoTitle, contact,
    photoType, photoIndex, galleryPhotos, galleryPreviews, currentGalleryIndex, t
  } = params;

  // --- Gallery navigation ---
  const [currentIndex, setCurrentIndex] = useState(currentGalleryIndex ?? 0);

  // --- Zoom / pan / στροφή: το ΕΝΑ useZoomPan (ADR-899 §9 θέμα 3 — εδώ ζούσε χειρόγραφο αντίγραφο ~150 γραμμών) ---
  const view = useZoomPan({ ...PHOTO_VIEW_ZOOM, contentDimensions: galleryPreviews?.[currentIndex]?.dimensions ?? null });
  const { resetAll: resetView } = view;

  // --- Mobile detection ---
  const [isMobile, setIsMobile] = useState(false);

  // --- Centralized file download (Domain A SSoT, ADR-294) ---
  const { handleDownload: proxyDownloadFile } = useFileDownload();

  // --- Refs for keyboard nav (avoid stale closures) ---
  const currentIndexRef = useRef(currentIndex);
  const isGalleryModeRef = useRef(false);
  const totalPhotosRef = useRef(0);

  // --- Focus trap ---
  // Radix Dialog provides built-in focus trap + escape handling.
  // A custom useFocusTrap on top conflicts when a nested Dialog (ShareModal) opens,
  // causing infinite focus recursion (Maximum call stack size exceeded).
  const focusTrapRef = useRef<HTMLDivElement>(null);

  // --- Derived gallery values ---
  const isGalleryMode = galleryPhotos && galleryPhotos.length > 0;
  const currentPhoto = isGalleryMode ? galleryPhotos[currentIndex] : photoUrl;
  const validPhotos = galleryPhotos?.filter(photo => photo !== null) ?? [];
  const totalPhotos = validPhotos.length;

  // --- Keep refs in sync ---
  currentIndexRef.current = currentIndex;
  isGalleryModeRef.current = !!isGalleryMode;
  totalPhotosRef.current = totalPhotos;

  /**
   * 🔑 ΕΝΑ βήμα για κουμπιά ΚΑΙ πληκτρολόγιο (ADR-899 §9). Ήταν δύο: τα κουμπιά σταματούσαν
   * στο άκρο (disabled) ενώ το → έκανε λούπα — μετρημένο 4/4 → 1/4. Στάση στο άκρο, όπως το
   * Google Photos και το δικό μας `PhotoLightbox`· η πολιτική ζει στο `indexWithin`.
   */
  const stepPhoto = (delta: -1 | 1) => {
    if (!isGalleryModeRef.current || totalPhotosRef.current <= 1) return;
    setCurrentIndex(prev => indexWithin(prev + delta, totalPhotosRef.current, 'clamp'));
  };
  const stepPhotoRef = useRef(stepPhoto);
  stepPhotoRef.current = stepPhoto;

  /** ♿ Η θέση ανακοινώνεται από ΕΝΑ σημείο, για κάθε κανάλι — όχι στο πρώτο άνοιγμα (το λέει ήδη η περιγραφή). */
  const announcedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open || !isGalleryMode) {
      announcedIndexRef.current = null;
      return;
    }
    if (announcedIndexRef.current !== null && announcedIndexRef.current !== currentIndex) {
      announceToScreenReader(t('photoPreview.navigation.slide', { current: currentIndex + 1, total: totalPhotos }));
    }
    announcedIndexRef.current = currentIndex;
  }, [open, isGalleryMode, currentIndex, totalPhotos, t]);

  // --- Effects ---

  useEffect(() => {
    if (currentGalleryIndex !== undefined) {
      setCurrentIndex(currentGalleryIndex);
    }
  }, [currentGalleryIndex]);

  // Νέα φωτογραφία ή νέο άνοιγμα ⇒ «χωρά», χωρίς στροφή (Google Photos: η όψη δεν κληρονομείται).
  useEffect(() => {
    resetView();
  }, [open, currentIndex, resetView]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
          stepPhotoRef.current(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          stepPhotoRef.current(1);
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

  // --- Derived display values ---
  const displayIndex = isGalleryMode ? currentIndex : photoIndex;
  const title = generatePhotoTitle(contact, photoType, displayIndex, photoTitle, t);
  const IconComponent = getPhotoTypeIcon(photoType);

  // --- Gallery navigation handlers ---

  const handlePreviousPhoto = () => stepPhoto(-1);
  const handleNextPhoto = () => stepPhoto(1);

  // --- Download handler ---

  const handleDownload = async () => {
    if (!currentPhoto) return;

    // Derive extension from URL path (Firebase Storage URLs embed original filename).
    let extension = '.jpg';
    try {
      const url = new URL(currentPhoto);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      if (fileName.includes('.')) {
        extension = '.' + fileName.split('.').pop();
      }
    } catch (error) {
      logger.warn('Failed to parse photo URL for extension, defaulting to .jpg', { error });
    }

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

    // SSoT Domain A (ADR-294): delegate to useFileDownload → backend proxy.
    // displayName already carries the extension, so the hook preserves it as-is.
    logger.info('ENTERPRISE DOWNLOAD', { originalUrl: currentPhoto, filename: downloadFilename });
    await proxyDownloadFile({ downloadUrl: currentPhoto, displayName: downloadFilename });
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
      metadata: { uploadedAt: nowISO(), photoType }
    };

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`photo_share_${photoId}`, JSON.stringify(photoShareData));
    }

    // ADR-853 §19 Θ6 — ήταν καρφωμένο `https://nestor-app.vercel.app` για κάθε localhost:
    // δηλαδή κάθε κοινοποίηση από dev έδειχνε σε **νεκρό** domain. Τώρα η δημόσια διεύθυνση
    // από το ΕΝΑ SSoT, με **τίμια** εφεδρεία την προέλευση όπου όντως τρέχουμε.
    const origin = publicOrigin() ?? (typeof window !== 'undefined' ? window.location.origin : '');
    const baseUrl = `${origin}/share/photo/${photoId}`;

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
    text: buildPhotoShareText(photoType, contact, t),
    url: generatePhotoShareUrl(),
    isPhoto: true,
    photoUrl: currentPhoto ?? undefined,
    galleryPhotos: validPhotos.length > 1 ? (validPhotos as string[]) : undefined,
  };

  return {
    // Refs
    focusTrapRef,
    // Zoom / pan / στροφή (useZoomPan)
    view,
    // Derived
    isMobile,
    isGalleryMode,
    currentPhoto,
    totalPhotos,
    currentIndex,
    title,
    IconComponent,
    shareData,
    // Handlers
    handlePreviousPhoto,
    handleNextPhoto,
    handleDownload,
    handleImageLoad,
    handleImageError,
  };
}
