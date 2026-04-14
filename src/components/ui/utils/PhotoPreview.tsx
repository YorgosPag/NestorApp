// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  PHOTO_SIZES,
  PHOTO_TEXT_COLORS,
  PHOTO_COMBINED_EFFECTS,
  PHOTO_COLORS,
  PHOTO_HOVER_EFFECTS
} from '@/components/generic/config/photo-config';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('PhotoPreview');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoPreviewProps {
  /** Preview URL */
  previewUrl: string;
  /** File name */
  fileName?: string;
  /** Compact mode styling */
  compact?: boolean;
  /** Purpose text (e.g., 'logo', 'representative') */
  purpose?: string;
  /** Remove button click handler */
  onRemove?: (e: React.MouseEvent) => void;
  /** Preview click handler */
  onPreviewClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Hide remove button */
  hideRemoveButton?: boolean;
  /** Custom className */
  className?: string;
}

// ============================================================================
// 🔥 EXTRACTED: PHOTO PREVIEW COMPONENT
// ============================================================================

/**
 * Photo Preview Component - Unified για όλα τα preview displays
 *
 * Extracted από EnterprisePhotoUpload για Single Responsibility Principle.
 * Χειρίζεται μόνο την εμφάνιση preview images με consistent styling.
 *
 * Features:
 * - Compact vs Full mode styling
 * - Remove button με proper event handling
 * - Responsive image display
 * - Success state indicators
 * - Click handler για preview interaction
 * - Zero duplication με conditional rendering
 */
export function PhotoPreview({
  previewUrl,
  fileName,
  compact = false,
  purpose = 'photo',
  onRemove,
  onPreviewClick,
  disabled = false,
  hideRemoveButton = false,
  className = ''
}: PhotoPreviewProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const showRemoveButton = !hideRemoveButton && !disabled && onRemove;
  const displayName = purpose === 'logo' ? t('photo.logo') : t('photo.photo');

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove?.(e);
  };

  const handlePreviewClick = () => {
    logger.info('Click triggered', {
      disabled,
      onPreviewClickExists: !!onPreviewClick,
      allowClick: !disabled || !!onPreviewClick
    });

    // ✅ CRITICAL FIX: Allow preview click even in disabled mode if onPreviewClick exists
    if (onPreviewClick && (!disabled || !!onPreviewClick)) {
      logger.info('Executing onPreviewClick');
      onPreviewClick();
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (compact) {
    // 🎯 COMPACT MODE: Φωτογραφία πιάνει όλο το slot, κείμενα κάτω από τη φωτογραφία
    return (
      <div className={`flex flex-col w-full h-full ${className}`}>
        {/* Φωτογραφία πιάνει όλο το διαθέσιμο χώρο */}
        <div
          className={`relative flex-1 w-full ${PHOTO_COLORS.PHOTO_BACKGROUND} rounded overflow-hidden shadow-sm ${PHOTO_COMBINED_EFFECTS.INTERACTIVE_CARD} ${onPreviewClick ? 'cursor-pointer' : ''}`}
          onClick={handlePreviewClick}
        >
          <img
            src={previewUrl}
            alt={t('photo.preview')}
            className="w-full h-full object-contain rounded-lg"
          />

          {/* Remove button για compact mode */}
          {showRemoveButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`absolute top-2 right-2 ${colors.bg.error} ${colors.text.error} rounded-full p-1.5 ${PHOTO_HOVER_EFFECTS.BUTTON} z-10`}
                  onClick={handleRemoveClick}
                >
                  <X className={iconSizes.sm} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('photo.remove', { name: displayName })}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Κείμενα κάτω από τη φωτογραφία - Κρυφά στα contact details */}
      </div>
    );
  }

  // 🎯 FULL MODE: For standard form contexts με flexible layout
  return (
    <div
      className={`flex items-center gap-4 ${className} ${onPreviewClick ? 'cursor-pointer' : ''}`}
      onClick={handlePreviewClick}
    >
      <div className={`${PHOTO_SIZES.THUMBNAIL} ${PHOTO_COLORS.PHOTO_BACKGROUND} rounded-lg overflow-hidden shadow-sm relative`}>
        <img
          src={previewUrl}
          alt={t('photo.preview')}
          className="w-full h-full object-contain"
        />

        {/* Remove button για full mode */}
        {showRemoveButton && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`absolute top-1 right-1 ${colors.bg.error} ${colors.text.error} rounded-full p-1 transition-colors z-10 ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
                onClick={handleRemoveClick}
              >
                <X className={iconSizes.xs} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('photo.remove', { name: displayName })}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="text-left">
        <p className={`text-sm font-medium ${colors.text.success} flex items-center gap-1`}>
          <CheckCircle className={iconSizes.sm} />
          {purpose === 'logo' ? t('photo.logoUploaded') : t('photo.photoUploaded')}
        </p>
        <p className={`text-xs ${colors.text.success}`}>{fileName}</p>
        {onPreviewClick && (
          <p className={`text-xs ${PHOTO_TEXT_COLORS.LIGHT_MUTED} mt-1`}>{t('photo.clickToChange')}</p>
        )}
      </div>
    </div>
  );
}

export default PhotoPreview;
