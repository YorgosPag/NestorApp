'use client';

/**
 * 🏢 ENTERPRISE ShareButton with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ShareModal, useShareModal } from '@/components/ui/ShareModal';
import { type ShareData } from '@/lib/share-utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-utils';
import '@/lib/design-system';

export interface ShareButtonProps {
  /** Data to share */
  shareData: ShareData;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom className */
  className?: string;
  /** Show text label */
  showLabel?: boolean;
  /** Custom label text */
  label?: string;
  /** Callback when share is successful */
  onShareSuccess?: () => void;
  /** Callback when share fails */
  onShareError?: (error: string) => void;
}

export function ShareButton({
  shareData,
  variant = 'outline',
  size = 'default',
  className,
  showLabel = true,
  label,
  onShareSuccess,
  onShareError,
}: ShareButtonProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const [justCopied, setJustCopied] = useState(false);
  const { isOpen, openModal, closeModal } = useShareModal();

  const handleButtonClick = () => {
    openModal();
  };

  const handleCopySuccess = () => {
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
    onShareSuccess?.();
  };

  const handleShareSuccess = (_platform: string) => {
    onShareSuccess?.();
    // Keep modal open briefly to show success, then close
    setTimeout(() => closeModal(), 1500);
  };

  const handleShareError = (platform: string, error: string) => {
    onShareError?.(t('share.shareError', { platform, error }));
  };

  const buttonLabel = label || t('share.share');
  const icon = justCopied ? Check : Share2;
  
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn(
          'transition-all duration-200',
          justCopied && `${colors.text.success} ${quick.success}`,  // ✅ SEMANTIC: text-green-600 -> success
          className
        )}
        onClick={handleButtonClick}
      >
        {React.createElement(icon, { 
          className: cn(
            'transition-all duration-200',
            iconSizes.sm,
            showLabel && 'mr-2'
          )
        })}
        {showLabel && (
          <span className={cn('transition-all duration-200')}>
            {justCopied ? t('share.copied') : buttonLabel}
          </span>
        )}
      </Button>

      <ShareModal
        isOpen={isOpen}
        onClose={closeModal}
        shareData={shareData}
        onCopySuccess={handleCopySuccess}
        onShareSuccess={handleShareSuccess}
        onShareError={handleShareError}
      />
    </>
  );
}

// Export convenience props for specific use cases
export interface PropertyShareButtonProps extends Omit<ShareButtonProps, 'shareData'> {
  /** Property ID */
  propertyId: string;
  /** Property title */
  propertyTitle: string;
  /** Property description (optional) */
  propertyDescription?: string;
  /** Property price (optional) */
  propertyPrice?: number;
  /** Property area (optional) */
  propertyArea?: number;
  /** Property location (optional) */
  propertyLocation?: string;
  /** Share source for tracking */
  source?: string;
}

/**
 * Pre-configured ShareButton for properties
 */
export function PropertyShareButton({
  propertyId,
  propertyTitle,
  propertyDescription,
  propertyPrice,
  propertyArea,
  propertyLocation,
  source = 'property_details',
  ...buttonProps
}: PropertyShareButtonProps) {
  const propertyData = {
    id: propertyId,
    title: propertyTitle,
    description: propertyDescription,
    price: propertyPrice,
    area: propertyArea,
    location: propertyLocation,
  };

  // Generate share data using utility function
  const shareData: ShareData = {
    title: propertyTitle,
    text: generatePropertyShareText(propertyData),
    url: generatePropertyShareUrl(propertyId, source),
  };

  return <ShareButton shareData={shareData} {...buttonProps} />;
}

// Helper functions for property sharing
function generatePropertyShareText(property: {
  title: string;
  description?: string;
  price?: number;
  area?: number;
  location?: string;
}): string {
  let text = `🏠 ${property.title}`;

  if (property.location) {
    text += `\n📍 ${property.location}`;
  }

  if (property.price) {
    text += `\n💰 ${formatCurrency(property.price)}`;
  }

  if (property.area) {
    text += `\n📐 ${property.area} τ.μ.`;
  }

  if (property.description) {
    text += `\n\n${property.description}`;
  }

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || '';
  if (companyName) {
    text += `\n\n${companyName}`;
  }

  return text;
}

function generatePropertyShareUrl(propertyId: string, source: string): string {
  const baseUrl = `/properties/${propertyId}`;
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: 'social_share',
    utm_campaign: 'property_sharing',
    utm_content: propertyId,
    shared: 'true'
  });
  
  return `${baseUrl}?${params.toString()}`;
}
