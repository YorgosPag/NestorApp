import * as React from 'react';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

/**
 * 🏢 ENTERPRISE: Arc Icon Variants
 * Pattern: AutoCAD Arc command modes
 *
 * @see ADR-059: Arc Drawing Tool Implementation
 */
export type ArcVariant =
  | '3point'           // Arc through 3 points (Start, Point on Arc, End)
  | 'center-start-end' // Center → Start → End
  | 'start-center-end';// Start → Center → End

interface ArcIconProps {
  variant: ArcVariant;
  className?: string;
}

// 🎨 Color coding for click sequence (consistent across all variants)
// 2 στάσεις: Κόκκινο → Πράσινο
// 3 στάσεις: Κόκκινο → Πορτοκαλί → Πράσινο
const CLICK_COLORS = {
  FIRST: '#ef4444',   // 🔴 Red - 1st click (always)
  SECOND: '#f97316',  // 🟠 Orange - 2nd click (only for 3-step)
  THIRD: '#22c55e',   // 🟢 Green - last click (always)
} as const;

/**
 * Arc Icon Component
 * Renders different arc variants based on AutoCAD arc methods
 *
 * 🔧 OPTIMIZED (2026-01-31): Λεπτότερες γραμμές, μεγαλύτερα σχήματα
 * 🎨 COLOR CODED: Κόκκινο=1η στάση, Πορτοκαλί=2η στάση, Πράσινο=3η στάση
 */
export const ArcIcon: React.FC<ArcIconProps> = ({
  variant,
  className = PANEL_LAYOUT.ICON.LARGE
}) => {
  const renderVariantContent = () => {
    switch (variant) {
      case '3point':
        // 3 STEPS: Start → Point on Arc → End: 🔴 → 🟠 → 🟢
        return (
          <>
            {/* Arc path - μεγαλύτερο */}
            <path
              d="M 3 19 Q 12 1 21 19"
              fill="none"
              strokeWidth="1.5"
            />
            {/* 1st click - Start (Red) */}
            <circle cx="3" cy="19" r="3" fill={CLICK_COLORS.FIRST} stroke="none" />
            {/* 2nd click - Point on Arc (Orange) */}
            <circle cx="12" cy="5" r="3" fill={CLICK_COLORS.SECOND} stroke="none" />
            {/* 3rd/Last click - End (Green) */}
            <circle cx="21" cy="19" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      case 'center-start-end':
        // 3 STEPS: Center → Start → End: 🔴 → 🟠 → 🟢
        return (
          <>
            {/* Arc path - μεγαλύτερο */}
            <path
              d="M 3 12 A 9 9 0 0 1 21 12"
              fill="none"
              strokeWidth="1.5"
            />
            {/* 1st click - Center (Red, marked with +) */}
            <circle cx="12" cy="12" r="2.5" fill={CLICK_COLORS.FIRST} stroke="none" />
            <line x1="9" y1="12" x2="15" y2="12" strokeWidth="1" stroke="white" />
            <line x1="12" y1="9" x2="12" y2="15" strokeWidth="1" stroke="white" />
            {/* 2nd click - Start (Orange) */}
            <circle cx="3" cy="12" r="3" fill={CLICK_COLORS.SECOND} stroke="none" />
            {/* 3rd/Last click - End (Green) */}
            <circle cx="21" cy="12" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
            {/* Radius line */}
            <line x1="12" y1="12" x2="3" y2="12" strokeDasharray="2,1.5" strokeWidth="0.75" opacity="0.5" />
          </>
        );

      case 'start-center-end':
        // 3 STEPS: Start → Center → End: 🔴 → 🟠 → 🟢
        return (
          <>
            {/* Arc path - κάτω κυρτό, μεγαλύτερο */}
            <path
              d="M 3 10 A 9 9 0 0 0 21 10"
              fill="none"
              strokeWidth="1.5"
            />
            {/* 1st click - Start (Red) */}
            <circle cx="3" cy="10" r="3" fill={CLICK_COLORS.FIRST} stroke="none" />
            {/* 2nd click - Center (Orange, marked with +) */}
            <circle cx="12" cy="10" r="2.5" fill={CLICK_COLORS.SECOND} stroke="none" />
            <line x1="9" y1="10" x2="15" y2="10" strokeWidth="1" stroke="white" />
            <line x1="12" y1="7" x2="12" y2="13" strokeWidth="1" stroke="white" />
            {/* 3rd/Last click - End (Green) */}
            <circle cx="21" cy="10" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      default:
        // Default: simple arc with 2-step colors (🔴 → 🟢)
        return (
          <>
            <path
              d="M 3 19 Q 12 1 21 19"
              fill="none"
              strokeWidth="1.5"
            />
            <circle cx="3" cy="19" r="3" fill={CLICK_COLORS.FIRST} stroke="none" />
            <circle cx="21" cy="19" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
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

// ============================================================================
// 🏢 CONVENIENCE EXPORTS (Backward Compatibility Pattern)
// ============================================================================

/**
 * 3-Point Arc Icon
 * User clicks: Start → Point on Arc → End
 */
export const Arc3PIcon: React.FC<{className?: string}> = (props) =>
  <ArcIcon variant="3point" {...props} />;

/**
 * Center-Start-End Arc Icon
 * User clicks: Center → Start → End
 */
export const ArcCSEIcon: React.FC<{className?: string}> = (props) =>
  <ArcIcon variant="center-start-end" {...props} />;

/**
 * Start-Center-End Arc Icon
 * User clicks: Start → Center → End
 */
export const ArcSCEIcon: React.FC<{className?: string}> = (props) =>
  <ArcIcon variant="start-center-end" {...props} />;
