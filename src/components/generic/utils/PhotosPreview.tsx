// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { Camera } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { CompanyLogoCard, RepresentativePhotoCard, IndividualPhotoCard, ServiceLogoCard } from './PhotoPreviewCard';
import {
  PHOTO_LAYOUTS,
  PHOTO_SIZES,
  PHOTO_TEXT_COLORS,
  PHOTO_HEIGHTS,
  PHOTO_TYPOGRAPHY
} from '../config/photo-config';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotosPreviewProps {
  /** Contact type που καθορίζει το layout */
  contactType: 'company' | 'individual' | 'service';

  /** Photos data */
  logoUrl?: string;
  photoUrl?: string;
  multiplePhotoURLs?: string[];

  /** Click handlers */
  onPhotoClick?: (photoUrl: string, photoIndex: number, galleryPhotos?: (string | null)[]) => void;

  /** Custom className */
  className?: string;
}

// ============================================================================
// 🔥 UNIFIED PHOTOS PREVIEW COMPONENT
// ============================================================================

/**
 * UNIFIED Photos Preview Component
 *
 * Single component που handle όλους τους contact types με:
 * - Conditional layouts based on contact type
 * - Unified photo click handlers
 * - Reusable PhotoPreviewCard components
 * - Zero code duplication
 * - Type-safe contact type handling
 *
 * Features:
 * - Company: 2x2 grid (Logo + Representative Photo)
 * - Individual: 3x2 grid (6 photos max)
 * - Service: Single centered logo
 * - Consistent empty states
 * - Gallery integration για preview modals
 */
export function PhotosPreview({
  contactType,
  logoUrl,
  photoUrl,
  multiplePhotoURLs = [],
  onPhotoClick,
  className = ''
}: PhotosPreviewProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('common');

  // ========================================================================
  // COMPANY PHOTOS LAYOUT
  // ========================================================================

  if (contactType === 'company') {
    const hasLogo = logoUrl && logoUrl.length > 0;
    const hasPhoto = photoUrl && photoUrl.length > 0;

    // Gallery array για company (logo + representative photo)
    const galleryPhotos: (string | null)[] = [
      hasLogo ? logoUrl! : null,    // Index 0: Λογότυπο
      hasPhoto ? photoUrl! : null   // Index 1: Φωτογραφία εκπροσώπου
    ];

    const handlePhotoClick = (photoUrl: string, photoIndex: number) => {
      if (onPhotoClick) {
        onPhotoClick(photoUrl, photoIndex, galleryPhotos);
      }
    };

    // Empty state για company
    if (!hasLogo && !hasPhoto) {
      return (
        <div className={`text-center text-muted-foreground p-8 ${className}`}>
          <Camera className={`${iconSizes.xl2} mx-auto mb-4 ${PHOTO_TEXT_COLORS.MUTED}`} />
          <p>{t('photoPreview.empty.noPhotos')}</p>
        </div>
      );
    }

    // Company grid layout - ΠΑΝΟΜΟΙΟΤΗΤΑ με individual
    return (
      <div className={`mt-4 ${className}`}>
        {/* Header ακριβώς όπως στο individual */}
        <div className="flex items-center justify-between mb-6">
          <h4 className={`${PHOTO_TYPOGRAPHY.HEADER} flex items-center gap-2`}>
            <Camera className={iconSizes.sm} />
            {t('photoPreview.headers.companyPhotos', { count: 2 })}
          </h4>
        </div>

        {/* Company Grid - 2x1 Layout με centralized dimensions */}
        <div className={PHOTO_LAYOUTS.COMPANY_GRID.container}>
          <div className={PHOTO_LAYOUTS.COMPANY_GRID.itemWrapper}>
            <CompanyLogoCard
              photoUrl={logoUrl}
              title={t('photoPreview.alt.companyLogo')}
              height={PHOTO_SIZES.STANDARD_PREVIEW}
              onPhotoClick={hasLogo ? () => handlePhotoClick(logoUrl!, 0) : undefined}
            />
          </div>

          <div className={PHOTO_LAYOUTS.COMPANY_GRID.itemWrapper}>
            <RepresentativePhotoCard
              photoUrl={photoUrl}
              title={t('photoPreview.alt.representativePhoto')}
              height={PHOTO_SIZES.STANDARD_PREVIEW}
              onPhotoClick={hasPhoto ? () => handlePhotoClick(photoUrl!, 1) : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // INDIVIDUAL PHOTOS LAYOUT (3x2 Grid)
  // ========================================================================

  if (contactType === 'individual') {
    // Δημιουργούμε array 6 φωτογραφιών (όπως στο modal)
    const allPhotos = React.useMemo(() => {
      const result = [];

      // Για φυσικά πρόσωπα, χρησιμοποιούμε μόνο τα multiplePhotoURLs
      if (multiplePhotoURLs.length > 0) {
        result.push(...multiplePhotoURLs);
      } else if (photoUrl && !multiplePhotoURLs.length) {
        // Fallback για backward compatibility
        result.push(photoUrl);
      }

      // Συμπληρώνουμε με άδεια slots μέχρι τα 6
      while (result.length < 6) {
        result.push(null);
      }

      return result.slice(0, 6);
    }, [photoUrl, multiplePhotoURLs]);

    const totalPhotos = allPhotos.filter(photo => photo).length;
    const mainPhoto = allPhotos[0]; // Κύρια φωτογραφία προφίλ

    const handlePhotoClick = (photoUrl: string, photoIndex: number) => {
      if (onPhotoClick) {
        onPhotoClick(photoUrl, photoIndex);
      }
    };

    // 🎯 ΠΑΝΟΜΟΙΟΤΥΠΟ LAYOUT ΜΕ ΤΟ MODAL: 6 slots, ίδια πλαίσια, ίδια χρώματα
    return (
      <div className={`mt-4 ${className}`}>
        {/* Header ακριβώς όπως στο modal */}
        <div className="flex items-center justify-between mb-6">
          <h4 className={`${PHOTO_TYPOGRAPHY.HEADER} flex items-center gap-2`}>
            <Camera className={iconSizes.sm} />
            {t('photoPreview.headers.individualPhotos', { count: totalPhotos, max: 6 })}
          </h4>
        </div>

        {/* Photo Grid - 3x2 Layout με centralized dimensions */}
        <div className={PHOTO_LAYOUTS.INDIVIDUAL_GRID.container}>
          {allPhotos.map((photo, index) => (
            <div key={index} className={PHOTO_LAYOUTS.INDIVIDUAL_GRID.itemWrapper}>
              <IndividualPhotoCard
                photoUrl={photo || undefined}
                photoIndex={index + 1}
                title="" // No header για grid layout
                showHeader={false}
                height={PHOTO_SIZES.STANDARD_PREVIEW}
                onPhotoClick={photo ? () => handlePhotoClick(photo, index) : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ========================================================================
  // SERVICE LOGO LAYOUT (Single Centered)
  // ========================================================================

  if (contactType === 'service') {
    const hasLogo = logoUrl && logoUrl.length > 0;

    // Gallery array για service (λογότυπο μόνο)
    const galleryPhotos: (string | null)[] = [
      hasLogo ? logoUrl! : null    // Index 0: Λογότυπο υπηρεσίας
    ];

    const handlePhotoClick = () => {
      if (onPhotoClick && hasLogo) {
        onPhotoClick(logoUrl!, 0, galleryPhotos);
      }
    };

    return (
      <div className={`mt-4 ${className}`}>
        {/* Header ακριβώς όπως στα άλλα contact types */}
        <div className="flex items-center justify-between mb-6">
          <h4 className={`${PHOTO_TYPOGRAPHY.HEADER} flex items-center gap-2`}>
            <Camera className={iconSizes.sm} />
            {t('photoPreview.headers.serviceLogo')}
          </h4>
        </div>

        {/* Service Logo - Centered με centralized dimensions */}
        <div className={PHOTO_LAYOUTS.SERVICE_CENTER.container}>
          <div className={PHOTO_LAYOUTS.SERVICE_CENTER.itemWrapper}>
            <ServiceLogoCard
              photoUrl={logoUrl}
              title="" // No header για centered layout
              showHeader={false}
              height={PHOTO_SIZES.STANDARD_PREVIEW}
              onPhotoClick={hasLogo ? handlePhotoClick : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // FALLBACK (should never reach here)
  // ========================================================================

  return (
    <div className={`text-center text-muted-foreground p-8 ${className}`}>
      <Camera className={`${iconSizes.xl4} mx-auto mb-4 ${PHOTO_TEXT_COLORS.MUTED}`} />
      <p>{t('photoPreview.unsupportedType', { type: contactType })}</p>
    </div>
  );
}

// ============================================================================
// TYPED VARIANTS για EASIER USE
// ============================================================================

/**
 * Company Photos Preview - για company contacts
 */
export function CompanyPhotosPreview(props: Omit<PhotosPreviewProps, 'contactType'>) {
  return <PhotosPreview {...props} contactType="company" />;
}

/**
 * Individual Photos Preview - για individual contacts
 */
export function IndividualPhotosPreview(props: Omit<PhotosPreviewProps, 'contactType'>) {
  return <PhotosPreview {...props} contactType="individual" />;
}

/**
 * Service Logo Preview - για service contacts
 */
export function ServiceLogoPreview(props: Omit<PhotosPreviewProps, 'contactType'>) {
  return <PhotosPreview {...props} contactType="service" />;
}

export default PhotosPreview;