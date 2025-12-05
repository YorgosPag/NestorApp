'use client';

import React from 'react';
import { Camera, Building2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PHOTO_SIZES, PHOTO_STYLES, PHOTO_TEXT_COLORS, PHOTO_COLORS, PHOTO_HEIGHTS } from '../config/photo-dimensions';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoPreviewCardProps {
  /** Photo URL για εμφάνιση */
  photoUrl?: string;
  /** Title του card (π.χ. "Λογότυπο Εταιρείας") */
  title: string;
  /** Icon type για το header */
  iconType: 'company' | 'user' | 'camera';
  /** Alt text για την εικόνα */
  altText: string;
  /** Text για empty state */
  emptyText: string;
  /** Click handler για photo preview */
  onPhotoClick?: () => void;
  /** Card dimensions */
  height?: string;
  /** Custom className */
  className?: string;
  /** Card header visibility */
  showHeader?: boolean;
}

// ============================================================================
// 🔥 UNIFIED PHOTO PREVIEW CARD COMPONENT
// ============================================================================

/**
 * UNIFIED Photo Preview Card Component
 *
 * Εξαλείφει τα τριπλότυπα από ConfigTabsHelper:
 * - CompanyPhotosPreview (γραμμές 140-201) ❌
 * - IndividualPhotosPreview (γραμμές 258-282) ❌
 * - ServiceLogoPreview (γραμμές 320-345) ❌
 *
 * Unified logic για όλα τα photo preview contexts με:
 * - Conditional styling based on type
 * - Reusable empty states
 * - Consistent hover effects
 * - Type-safe icon resolution
 * - Zero code duplication
 *
 * Features:
 * - Supports company logos, individual photos, service logos
 * - Responsive dimensions
 * - Click handlers για preview modals
 * - Accessible alt texts
 * - Consistent empty state design
 */
export function PhotoPreviewCard({
  photoUrl,
  title,
  iconType,
  altText,
  emptyText,
  onPhotoClick,
  height = PHOTO_SIZES.STANDARD_PREVIEW,
  className = '',
  showHeader = true
}: PhotoPreviewCardProps) {

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const hasPhoto = photoUrl && photoUrl.length > 0;

  // Icon mapping για header
  const getHeaderIcon = () => {
    switch (iconType) {
      case 'company': return Building2;
      case 'user': return User;
      case 'camera': return Camera;
      default: return Camera;
    }
  };

  const HeaderIcon = getHeaderIcon();

  // Icon για empty state
  const getEmptyIcon = () => {
    switch (iconType) {
      case 'company': return Building2;
      case 'user': return User;
      case 'camera': return Camera;
      default: return Camera;
    }
  };

  const EmptyIcon = getEmptyIcon();

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleClick = () => {
    if (hasPhoto && onPhotoClick) {
      onPhotoClick();
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <Card className={className}>
      {/* Header με title και icon */}
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <HeaderIcon className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className={showHeader ? '' : 'p-0'}>
        <div
          className={`relative rounded-lg p-6 ${height} w-full flex flex-col items-center justify-center text-center cursor-pointer transition-colors overflow-hidden border-2 border-dashed`}
          style={{
            backgroundColor: hasPhoto ? undefined : PHOTO_COLORS.EMPTY_STATE_BACKGROUND,
            borderColor: hasPhoto ? '#22c55e' : '#9ca3af'
          }}
          onClick={handleClick}
        >
          {hasPhoto ? (
            /* 🖼️ PHOTO STATE: Ακριβώς όπως στο Modal */
            <img
              src={photoUrl}
              alt={altText}
              className="w-full h-full object-cover rounded cursor-pointer"
              onClick={handleClick}
              title="Κλικ για προεπισκόπηση"
            />
          ) : (
            /* 🚫 EMPTY STATE: Ακριβώς όπως στο Modal */
            <div className="flex flex-col items-center justify-center">
              <EmptyIcon className={`w-12 h-12 ${PHOTO_TEXT_COLORS.MUTED} mb-3`} />
              <span className={`text-sm font-medium ${PHOTO_TEXT_COLORS.LIGHT_MUTED} mb-2`}>{emptyText}</span>
              <span className={`text-xs ${PHOTO_TEXT_COLORS.MUTED}`}>Κλικ ή σύρετε αρχείο</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TYPED VARIANTS για EASIER USE
// ============================================================================

/**
 * Company Logo Card - για company logos
 */
export function CompanyLogoCard(props: Omit<PhotoPreviewCardProps, 'iconType' | 'altText' | 'emptyText'>) {
  return (
    <PhotoPreviewCard
      {...props}
      iconType="company"
      altText="Λογότυπο Εταιρείας"
      emptyText="Δεν υπάρχει λογότυπο"
    />
  );
}

/**
 * Representative Photo Card - για representative photos
 */
export function RepresentativePhotoCard(props: Omit<PhotoPreviewCardProps, 'iconType' | 'altText' | 'emptyText'>) {
  return (
    <PhotoPreviewCard
      {...props}
      iconType="user"
      altText="Φωτογραφία Εκπροσώπου"
      emptyText="Δεν υπάρχει φωτογραφία"
    />
  );
}

/**
 * Individual Photo Card - για individual photos
 */
export function IndividualPhotoCard(props: Omit<PhotoPreviewCardProps, 'iconType' | 'altText' | 'emptyText'> & { photoIndex?: number }) {
  const { photoIndex = 1, ...rest } = props;
  return (
    <PhotoPreviewCard
      {...rest}
      iconType="camera"
      altText={`Φωτογραφία ${photoIndex}`}
      emptyText="Κενή φωτογραφία"
    />
  );
}

/**
 * Service Logo Card - για service logos
 */
export function ServiceLogoCard(props: Omit<PhotoPreviewCardProps, 'iconType' | 'altText' | 'emptyText'>) {
  return (
    <PhotoPreviewCard
      {...props}
      iconType="company"
      altText="Λογότυπο Δημόσιας Υπηρεσίας"
      emptyText="Δεν υπάρχει λογότυπο"
    />
  );
}

export default PhotoPreviewCard;