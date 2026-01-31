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

/**
 * Arc Icon Component
 * Renders different arc variants based on AutoCAD arc methods
 */
export const ArcIcon: React.FC<ArcIconProps> = ({
  variant,
  className = PANEL_LAYOUT.ICON.LARGE
}) => {
  const renderVariantContent = () => {
    switch (variant) {
      case '3point':
        // 3-Point Arc: Start, Point on Arc, End
        return (
          <>
            {/* Arc path */}
            <path
              d="M 6 16 Q 12 4 18 16"
              fill="none"
              strokeWidth="2"
            />
            {/* Three points on the arc */}
            <circle cx="6" cy="16" r="1.5" fill="currentColor" />
            <circle cx="12" cy="8" r="1.5" fill="currentColor" />
            <circle cx="18" cy="16" r="1.5" fill="currentColor" />
            {/* Small "3P" label */}
            <text x="12" y="20" fontSize="4" textAnchor="middle" fill="currentColor">3P</text>
          </>
        );

      case 'center-start-end':
        // Center, Start, End Arc
        return (
          <>
            {/* Arc path */}
            <path
              d="M 6 12 A 6 6 0 0 1 18 12"
              fill="none"
              strokeWidth="2"
            />
            {/* Center point (marked with +) */}
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <line x1="10" y1="12" x2="14" y2="12" strokeWidth="1" />
            <line x1="12" y1="10" x2="12" y2="14" strokeWidth="1" />
            {/* Start point */}
            <circle cx="6" cy="12" r="1.5" fill="currentColor" />
            {/* End point */}
            <circle cx="18" cy="12" r="1.5" fill="currentColor" />
            {/* Radius line */}
            <line x1="12" y1="12" x2="6" y2="12" strokeDasharray="2,1" strokeWidth="1" />
          </>
        );

      case 'start-center-end':
        // Start, Center, End Arc
        return (
          <>
            {/* Arc path */}
            <path
              d="M 6 14 A 6 6 0 0 0 18 14"
              fill="none"
              strokeWidth="2"
            />
            {/* Start point (1) */}
            <circle cx="6" cy="14" r="1.5" fill="currentColor" />
            <text x="4" y="11" fontSize="4" fill="currentColor">1</text>
            {/* Center point (2, marked with +) */}
            <circle cx="12" cy="14" r="1" fill="currentColor" />
            <line x1="10" y1="14" x2="14" y2="14" strokeWidth="1" />
            <line x1="12" y1="12" x2="12" y2="16" strokeWidth="1" />
            <text x="12" y="19" fontSize="4" textAnchor="middle" fill="currentColor">2</text>
            {/* End point (3) */}
            <circle cx="18" cy="14" r="1.5" fill="currentColor" />
            <text x="20" y="11" fontSize="4" fill="currentColor">3</text>
          </>
        );

      default:
        // Default: simple arc with center
        return (
          <>
            <path
              d="M 6 16 Q 12 4 18 16"
              fill="none"
              strokeWidth="2"
            />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
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
      strokeWidth="2"
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
