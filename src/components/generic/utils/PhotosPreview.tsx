'use client';

import React from 'react';
import { Camera } from 'lucide-react';
import { CompanyLogoCard, RepresentativePhotoCard, IndividualPhotoCard, ServiceLogoCard } from './PhotoPreviewCard';

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
 * Εξαλείφει τα τριπλότυπα από ConfigTabsHelper:
 * - CompanyPhotosPreview (γραμμές 111-205) ❌ → PhotosPreview ✅
 * - IndividualPhotosPreview (γραμμές 221-287) ❌ → PhotosPreview ✅
 * - ServiceLogoPreview (γραμμές 302-347) ❌ → PhotosPreview ✅
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
          <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p>Δεν υπάρχουν αποθηκευμένες φωτογραφίες</p>
        </div>
      );
    }

    // Company grid layout - ΠΑΝΟΜΟΙΟΤΗΤΑ με individual
    return (
      <div className={`mt-4 ${className}`}>
        {/* Header ακριβώς όπως στο individual */}
        <div className="flex items-center justify-between mb-6">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Φωτογραφίες Εταιρείας (2)
          </h4>
        </div>

        {/* Company Grid - 2x1 Layout με compact style όπως στο modal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
          <div className="h-[300px] w-full">
            <CompanyLogoCard
              photoUrl={logoUrl}
              title="Λογότυπο Εταιρείας"
              height="h-[300px]" // ΑΚΡΙΒΕΣ ΔΙΑΣΤΑΣΕΙΣ όπως στο modal
              onPhotoClick={hasLogo ? () => handlePhotoClick(logoUrl!, 0) : undefined}
            />
          </div>

          <div className="h-[300px] w-full">
            <RepresentativePhotoCard
              photoUrl={photoUrl}
              title="Φωτογραφία Εκπροσώπου"
              height="h-[300px]" // ΑΚΡΙΒΕΣ ΔΙΑΣΤΑΣΕΙΣ όπως στο modal
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
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Φωτογραφίες ({totalPhotos}/6)
          </h4>
        </div>

        {/* Photo Grid - ΑΚΡΙΒΩΣ 3x2 Layout όπως στο modal */}
        <div className="grid grid-cols-3 gap-8 p-6">
          {allPhotos.map((photo, index) => (
            <div key={index} className="h-[300px] w-full">
              <IndividualPhotoCard
                photoUrl={photo || undefined}
                photoIndex={index + 1}
                title="" // No header για grid layout
                showHeader={false}
                height="h-[300px]" // ΑΚΡΙΒΕΣ ΔΙΑΣΤΑΣΕΙΣ όπως στο modal
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
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Λογότυπο Δημόσιας Υπηρεσίας
          </h4>
        </div>

        {/* Service Logo - Centered με compact style όπως στο modal */}
        <div className="flex justify-center p-2">
          <div className="w-[400px] h-[300px]">
            <ServiceLogoCard
              photoUrl={logoUrl}
              title="" // No header για centered layout
              showHeader={false}
              height="h-[300px]" // ΑΚΡΙΒΕΣ ΔΙΑΣΤΑΣΕΙΣ όπως στο modal
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
      <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
      <p>Μη υποστηριζόμενος τύπος επαφής: {contactType}</p>
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