'use client';

import React, { useState } from 'react';
import { Share2, Copy, Check, Home, MapPin, Euro, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShareModal, useShareModal } from '@/components/ui/ShareModal';
import { type ShareData } from '@/lib/share-utils';

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

  const handleShareSuccess = (platform: string) => {
    console.log(`Successfully shared via ${platform}`);
    onShareSuccess?.();
    // Keep modal open briefly to show success, then close
    setTimeout(() => closeModal(), 1500);
  };

  const handleShareError = (platform: string, error: string) => {
    console.error(`Failed to share via ${platform}:`, error);
    onShareError?.(`Αποτυχία κοινοποίησης μέσω ${platform}: ${error}`);
  };

  const buttonLabel = label || 'Κοινοποίηση';
  const icon = justCopied ? Check : Share2;
  
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn(
          'transition-all duration-200',
          justCopied && 'text-green-600 border-green-300',
          className
        )}
        onClick={handleButtonClick}
      >
        {React.createElement(icon, { 
          className: cn(
            'transition-all duration-200',
            size === 'icon' ? 'h-4 w-4' : 'h-4 w-4',
            showLabel && 'mr-2'
          )
        })}
        {showLabel && (
          <span className={cn('transition-all duration-200')}>
            {justCopied ? 'Αντιγράφηκε!' : buttonLabel}
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
    text += `\n💰 €${property.price.toLocaleString()}`;
  }

  if (property.area) {
    text += `\n📐 ${property.area} τ.μ.`;
  }

  if (property.description) {
    text += `\n\n${property.description}`;
  }

  text += '\n\nΔείτε περισσότερα στο Nestor Construct!';

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
