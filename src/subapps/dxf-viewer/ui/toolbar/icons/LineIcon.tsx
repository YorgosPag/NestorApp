import * as React from 'react';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
// 🏢 ADR-142: Centralized Icon Click Sequence Colors
import { ICON_CLICK_COLORS } from '../../../config/color-config';

/**
 * 🏢 ENTERPRISE (2026-01-31): Line Tool Icons - ADR-060
 *
 * Icon component for Line drawing tools with variants:
 * - normal: Standard 2-point line
 * - perpendicular: Line perpendicular to reference line
 * - parallel: Line parallel to reference line with offset
 *
 * Color coding for click sequence (consistent with CircleIcon/ArcIcon):
 * - 🔴 Red: 1st click/selection
 * - 🟠 Orange: 2nd click/selection
 * - 🟢 Green: Final click/result
 *
 * @see ADR-142: Icon Click Sequence Colors Centralization
 */

export type LineVariant = 'normal' | 'perpendicular' | 'parallel';

interface LineIconProps {
  variant: LineVariant;
  className?: string;
}

/**
 * Line Icon Component
 * 🔧 OPTIMIZED: Clean visual representation for each line type
 * 🎨 COLOR CODED: Red=1st, Orange=2nd, Green=result, Gray=reference
 */
export const LineIcon: React.FC<LineIconProps> = ({
  variant,
  className = PANEL_LAYOUT.ICON.LARGE
}) => {

  const renderVariantContent = () => {
    switch (variant) {
      case 'normal':
        // 2 STEPS: Start → End: 🔴 → 🟢
        // Simple line from point A to point B
        return (
          <>
            {/* Main line */}
            <line x1="4" y1="18" x2="20" y2="6" strokeWidth="1.5" stroke="currentColor" />
            {/* 1st click - Start point (Red) */}
            <circle cx="4" cy="18" r="2.5" fill={ICON_CLICK_COLORS.FIRST} stroke="none" />
            {/* 2nd/Last click - End point (Green) */}
            <circle cx="20" cy="6" r="2.5" fill={ICON_CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      case 'perpendicular':
        // ENTITY SELECTION MODE: Select reference line → Click point for perpendicular
        // Shows: Reference line (gray) + perpendicular line with 90° symbol
        return (
          <>
            {/* Reference line (gray, horizontal) - to be selected */}
            <line x1="3" y1="14" x2="21" y2="14" strokeWidth="1.5" stroke={ICON_CLICK_COLORS.REFERENCE} />
            {/* Perpendicular line (colored) - the result */}
            <line x1="12" y1="14" x2="12" y2="4" strokeWidth="1.5" stroke="currentColor" />
            {/* 90° angle indicator (small square at intersection) */}
            <rect x="12" y="11" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
            {/* Reference line selection indicator (Orange dot) */}
            <circle cx="6" cy="14" r="2" fill={ICON_CLICK_COLORS.SECOND} stroke="none" />
            {/* Point for perpendicular (Green - the click point) */}
            <circle cx="12" cy="4" r="2.5" fill={ICON_CLICK_COLORS.THIRD} stroke="none" />
            {/* Intersection point */}
            <circle cx="12" cy="14" r="1.5" fill={ICON_CLICK_COLORS.FIRST} stroke="none" />
          </>
        );

      case 'parallel':
        // ENTITY SELECTION MODE: Select reference line → Click to set offset
        // Shows: Two parallel lines with offset arrows
        return (
          <>
            {/* Reference line (gray) - to be selected */}
            <line x1="3" y1="8" x2="21" y2="8" strokeWidth="1.5" stroke={ICON_CLICK_COLORS.REFERENCE} />
            {/* Parallel line (colored) - the result */}
            <line x1="3" y1="16" x2="21" y2="16" strokeWidth="1.5" stroke="currentColor" />
            {/* Offset indicator arrows (vertical) */}
            <line x1="7" y1="9" x2="7" y2="15" strokeWidth="1" stroke="currentColor" strokeDasharray="2,1" />
            {/* Arrow head up */}
            <path d="M 5 10 L 7 8.5 L 9 10" fill="none" stroke="currentColor" strokeWidth="1" />
            {/* Arrow head down */}
            <path d="M 5 14 L 7 15.5 L 9 14" fill="none" stroke="currentColor" strokeWidth="1" />
            {/* Reference line selection indicator (Orange dot) */}
            <circle cx="12" cy="8" r="2" fill={ICON_CLICK_COLORS.SECOND} stroke="none" />
            {/* Click point for offset (Green) */}
            <circle cx="12" cy="16" r="2.5" fill={ICON_CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      default:
        // Fallback to normal line
        return (
          <>
            <line x1="4" y1="18" x2="20" y2="6" strokeWidth="1.5" />
            <circle cx="4" cy="18" r="2" fill="currentColor" stroke="none" />
            <circle cx="20" cy="6" r="2" fill="currentColor" stroke="none" />
          </>
        );
    }
  };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderVariantContent()}
    </svg>
  );
};

// Convenience exports for toolbar usage
export const LineNormalIcon: React.FC<{className?: string}> = (props) =>
  <LineIcon variant="normal" {...props} />;

export const LinePerpendicularIcon: React.FC<{className?: string}> = (props) =>
  <LineIcon variant="perpendicular" {...props} />;

export const LineParallelIcon: React.FC<{className?: string}> = (props) =>
  <LineIcon variant="parallel" {...props} />;
