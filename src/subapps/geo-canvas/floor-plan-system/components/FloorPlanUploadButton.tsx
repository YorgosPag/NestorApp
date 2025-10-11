/**
 * 📁 FLOOR PLAN UPLOAD BUTTON
 *
 * Top Bar button για floor plan upload workflow
 *
 * Features:
 * - Click to open upload modal
 * - i18n support (EN/EL)
 * - Loading state
 * - Disabled state
 * - Matches Geo-Canvas design system
 *
 * @module floor-plan-system/components
 */

import React from 'react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';

export interface FloorPlanUploadButtonProps {
  /**
   * Click handler - opens upload modal
   */
  onClick: () => void;

  /**
   * Disabled state (optional)
   * @default false
   */
  disabled?: boolean;

  /**
   * Loading state (optional)
   * @default false
   */
  loading?: boolean;

  /**
   * Custom className (optional)
   */
  className?: string;
}

/**
 * FloorPlanUploadButton Component
 *
 * Usage:
 * ```tsx
 * <FloorPlanUploadButton
 *   onClick={() => setModalOpen(true)}
 *   disabled={false}
 *   loading={false}
 * />
 * ```
 */
export function FloorPlanUploadButton({
  onClick,
  disabled = false,
  loading = false,
  className = ''
}: FloorPlanUploadButtonProps) {
  const { t } = useTranslationLazy('geo-canvas');

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        px-4 py-2
        bg-blue-600 hover:bg-blue-700
        text-white font-medium text-sm
        rounded-lg
        transition-all duration-200
        transform active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center gap-2
        shadow-lg hover:shadow-blue-500/30
        ${className}
      `}
      title={t('floorPlan.uploadButton.tooltip')}
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>{t('floorPlan.uploadButton.loading')}</span>
        </>
      ) : (
        <>
          <span className="text-lg">🏗️</span>
          <span>{t('floorPlan.uploadButton.text')}</span>
        </>
      )}
    </button>
  );
}

export default FloorPlanUploadButton;
