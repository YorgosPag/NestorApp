// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { Camera, Building2, User } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PHOTO_SIZES,
  PHOTO_TEXT_COLORS
} from '../config/photo-config';
import { usePhotoPreviewStyles } from '@/components/ui/enterprise-portal';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import '@/lib/design-system';

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
 * Reusable photo card component που χρησιμοποιείται από το PhotosPreview:
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
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const { t } = useTranslation('common');

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  // 🏢 ENTERPRISE: Explicit boolean for type safety
  const hasPhoto: boolean = !!(photoUrl && photoUrl.length > 0);

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
            <HeaderIcon className={iconSizes.sm} />
            {title}
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className={showHeader ? '' : 'p-0'}>
        <div
          className={`relative rounded-lg p-6 ${height} w-full flex flex-col items-center justify-center text-center cursor-pointer transition-colors overflow-hidden ${getStatusBorder('muted')} border-dashed`}
          style={usePhotoPreviewStyles(hasPhoto).dynamicColors as React.CSSProperties} // 🏢 ENTERPRISE: Type assertion for style object
          onClick={handleClick}
        >
          {hasPhoto ? (
            /* 🖼️ PHOTO STATE: Ακριβώς όπως στο Modal */
            <Tooltip>
              <TooltipTrigger asChild>
                <img
                  src={photoUrl}
                  alt={altText}
                  className="w-full h-full object-cover rounded cursor-pointer"
                  onClick={handleClick}
                />
              </TooltipTrigger>
              <TooltipContent>{t('photoPreview.clickToPreview')}</TooltipContent>
            </Tooltip>
          ) : (
            /* 🚫 EMPTY STATE: Ακριβώς όπως στο Modal */
            <div className="flex flex-col items-center justify-center">
              <EmptyIcon className={`${iconSizes.xl} ${PHOTO_TEXT_COLORS.MUTED} mb-3`} />
              <span className={`text-sm font-medium ${PHOTO_TEXT_COLORS.LIGHT_MUTED} mb-2`}>{emptyText}</span>
              <span className={`text-xs ${PHOTO_TEXT_COLORS.MUTED}`}>{t('photoPreview.dragOrClick')}</span>
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
 * 🏢 ENTERPRISE: i18n-enabled variant
 */
export function CompanyLogoCard(props: Omit<PhotoPreviewCardProps, 'iconType' | 'altText' | 'emptyText'>) {
  const { t } = useTranslation('common');
  return (
    <PhotoPreviewCard
      {...props}
      iconType="company"
      altText={t('photoPreview.alt.companyLogo')}
      emptyText={t('photoPreview.empty.logo')}
    />
  );
}

/**
 * Representative Photo Card - για representative photos
 * 🏢 ENTERPRISE: i18n-enabled variant
 */
export function RepresentativePhotoCard(props: Omit<PhotoPreviewCardProps, 'iconType' | 'altText' | 'emptyText'>) {
  const { t } = useTranslation('common');
  return (
    <PhotoPreviewCard
      {...props}
      iconType="user"
      altText={t('photoPreview.alt.representativePhoto')}
      emptyText={t('photoPreview.empty.photo')}
    />
  );
}

/**
 * Individual Photo Card - για individual photos
 * 🏢 ENTERPRISE: i18n-enabled variant with interpolation
 */
export function IndividualPhotoCard(props: Omit<PhotoPreviewCardProps, 'iconType' | 'altText' | 'emptyText'> & { photoIndex?: number }) {
  const { t } = useTranslation('common');
  const { photoIndex = 1, ...rest } = props;
  return (
    <PhotoPreviewCard
      {...rest}
      iconType="camera"
      altText={t('photoPreview.alt.photoWithIndex', { index: photoIndex })}
      emptyText={t('photoPreview.empty.generic')}
    />
  );
}

/**
 * Service Logo Card - για service logos
 * 🏢 ENTERPRISE: i18n-enabled variant
 */
export function ServiceLogoCard(props: Omit<PhotoPreviewCardProps, 'iconType' | 'altText' | 'emptyText'>) {
  const { t } = useTranslation('common');
  return (
    <PhotoPreviewCard
      {...props}
      iconType="company"
      altText={t('photoPreview.alt.serviceLogo')}
      emptyText={t('photoPreview.empty.logo')}
    />
  );
}

export default PhotoPreviewCard;