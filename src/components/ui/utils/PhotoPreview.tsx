'use client';

import React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { PHOTO_SIZES, PHOTO_STYLES, PHOTO_TEXT_COLORS, PHOTO_HOVER_EFFECTS } from '@/components/generic/config/photo-dimensions';

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
  purpose = 'φωτογραφία',
  onRemove,
  onPreviewClick,
  disabled = false,
  hideRemoveButton = false,
  className = ''
}: PhotoPreviewProps) {

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const showRemoveButton = !hideRemoveButton && !disabled && onRemove;
  const displayName = purpose === 'logo' ? 'λογότυπο' : 'φωτογραφία';

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove?.(e);
  };

  const handlePreviewClick = () => {
    if (!disabled && onPreviewClick) {
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
          className={`relative flex-1 w-full ${PHOTO_STYLES.PHOTO_CONTAINER} ${onPreviewClick ? 'cursor-pointer' : ''}`}
          onClick={handlePreviewClick}
        >
          <img
            src={previewUrl}
            alt="Προεπισκόπηση"
            className="w-full h-full object-cover rounded-lg"
          />

          {/* Remove button για compact mode */}
          {showRemoveButton && (
            <button
              type="button"
              className={`absolute top-2 right-2 bg-red-100 text-red-600 rounded-full p-1.5 ${PHOTO_HOVER_EFFECTS.REMOVE_BUTTON} z-10`}
              onClick={handleRemoveClick}
              title={`Αφαίρεση ${displayName}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Κείμενα κάτω από τη φωτογραφία */}
        <div className="mt-2 text-center w-full px-2">
          <p className="text-xs font-medium text-green-700 flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Φωτογραφία φορτώθηκε
          </p>
          <p className="text-xs text-gray-600 mt-1 truncate">Κάντε κλικ για αλλαγή</p>
        </div>
      </div>
    );
  }

  // 🎯 FULL MODE: For standard form contexts με flexible layout
  return (
    <div
      className={`flex items-center gap-4 ${className} ${onPreviewClick ? 'cursor-pointer' : ''}`}
      onClick={handlePreviewClick}
    >
      <div className={`${PHOTO_SIZES.THUMBNAIL} ${PHOTO_STYLES.THUMBNAIL}`}>
        <img
          src={previewUrl}
          alt="Προεπισκόπηση"
          className="w-full h-full object-cover"
        />

        {/* Remove button για full mode */}
        {showRemoveButton && (
          <button
            type="button"
            className="absolute top-1 right-1 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors z-10"
            onClick={handleRemoveClick}
            title={`Αφαίρεση ${displayName}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="text-left">
        <p className="text-sm font-medium text-green-700 flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          {purpose === 'logo' ? 'Λογότυπο' : 'Φωτογραφία'} φορτώθηκε
        </p>
        <p className="text-xs text-green-600">{fileName}</p>
        {onPreviewClick && (
          <p className={`text-xs ${PHOTO_TEXT_COLORS.LIGHT_MUTED} mt-1`}>Κάντε κλικ για αλλαγή</p>
        )}
      </div>
    </div>
  );
}

export default PhotoPreview;