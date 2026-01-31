import * as React from 'react';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

// 🎨 Color coding for click sequence (consistent with ArcIcon)
// 2 στάσεις: Κόκκινο → Πράσινο
// 3 στάσεις: Κόκκινο → Πορτοκαλί → Πράσινο
const CLICK_COLORS = {
  FIRST: '#ef4444',   // 🔴 Red - 1st click (always)
  SECOND: '#f97316',  // 🟠 Orange - 2nd click (only for 3-step)
  THIRD: '#22c55e',   // 🟢 Green - last click (always)
} as const;

export type CircleVariant =
  | 'radius'
  | 'diameter'
  | '3point'
  | '2point-radius'
  | '2point-diameter'
  | 'best-fit'
  | 'chord-sagitta';

interface CircleIconProps {
  variant: CircleVariant;
  className?: string;
}

/**
 * Circle Icon Component
 * 🔧 OPTIMIZED (2026-01-31): Λεπτότερες γραμμές, μεγαλύτερα σχήματα
 * 🎨 COLOR CODED: Κόκκινο=1η στάση, Πορτοκαλί=2η στάση, Πράσινο=3η στάση
 */
export const CircleIcon: React.FC<CircleIconProps> = ({
  variant,
  className = PANEL_LAYOUT.ICON.LARGE
}) => {
  // Center point with + marker (for center-based methods)
  const renderCenterDot = (color: string = 'currentColor') => (
    <>
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
      {color !== 'currentColor' && (
        <>
          <line x1="10" y1="12" x2="14" y2="12" strokeWidth="0.75" stroke="white" />
          <line x1="12" y1="10" x2="12" y2="14" strokeWidth="0.75" stroke="white" />
        </>
      )}
    </>
  );

  const renderVariantContent = () => {
    switch (variant) {
      case 'radius':
        // 2 STEPS: Center → Edge: 🔴 → 🟢
        return (
          <>
            {/* Radius line from center to edge */}
            <line x1="12" y1="12" x2="20" y2="12" strokeWidth="1.5" />
            {/* 1st click - Center (Red) */}
            {renderCenterDot(CLICK_COLORS.FIRST)}
            {/* 2nd/Last click - Edge point (Green) */}
            <circle cx="20" cy="12" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      case 'diameter':
        // 2 STEPS: Center → Edge: 🔴 → 🟢
        return (
          <>
            {/* Diameter line from edge to edge through center */}
            <line x1="4" y1="12" x2="20" y2="12" strokeWidth="1.5" />
            {/* 1st click - Center (Red) */}
            {renderCenterDot(CLICK_COLORS.FIRST)}
            {/* 2nd/Last click - Edge point (Green) */}
            <circle cx="20" cy="12" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      case '3point':
        // 3 STEPS: P1 → P2 → P3: 🔴 → 🟠 → 🟢
        return (
          <>
            {/* 1st click - Point 1 (Red) */}
            <circle cx="12" cy="3" r="3" fill={CLICK_COLORS.FIRST} stroke="none" />
            {/* 2nd click - Point 2 (Orange) */}
            <circle cx="20" cy="16" r="3" fill={CLICK_COLORS.SECOND} stroke="none" />
            {/* 3rd/Last click - Point 3 (Green) */}
            <circle cx="4" cy="16" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      case '2point-radius':
        // 2 STEPS: P1 → P2: 🔴 → 🟢
        return (
          <>
            {/* Radius line */}
            <line x1="12" y1="12" x2="20" y2="12" strokeWidth="1" strokeDasharray="2,1.5" opacity="0.5" />
            {/* 1st click - Point 1 (Red) */}
            <circle cx="6" cy="12" r="3" fill={CLICK_COLORS.FIRST} stroke="none" />
            {/* 2nd/Last click - Point 2 (Green) */}
            <circle cx="18" cy="12" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
            {/* Center dot */}
            {renderCenterDot()}
          </>
        );

      case '2point-diameter':
        // 2 STEPS: P1 → P2 as Diameter: 🔴 → 🟢
        return (
          <>
            {/* Diameter line */}
            <line x1="4" y1="12" x2="20" y2="12" strokeWidth="1.5" />
            {/* 1st click - Point 1 (Red) */}
            <circle cx="4" cy="12" r="3" fill={CLICK_COLORS.FIRST} stroke="none" />
            {/* 2nd/Last click - Point 2 (Green) */}
            <circle cx="20" cy="12" r="3" fill={CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      case 'best-fit':
        // Multiple points - sequence colors
        return (
          <>
            {/* Points in sequence */}
            <circle cx="12" cy="3" r="2" fill={CLICK_COLORS.FIRST} stroke="none" />
            <circle cx="20" cy="8" r="2" fill={CLICK_COLORS.SECOND} stroke="none" />
            <circle cx="20" cy="16" r="2" fill={CLICK_COLORS.THIRD} stroke="none" />
            <circle cx="12" cy="21" r="2" fill={CLICK_COLORS.FIRST} stroke="none" />
            <circle cx="4" cy="16" r="2" fill={CLICK_COLORS.SECOND} stroke="none" />
            <circle cx="4" cy="8" r="2" fill={CLICK_COLORS.THIRD} stroke="none" />
            {/* Center remains neutral */}
            {renderCenterDot()}
          </>
        );

      case 'chord-sagitta':
        // 3 STEPS: Chord Start → Chord End → Sagitta: 🔴 → 🟠 → 🟢
        return (
          <>
            {/* Chord line */}
            <line x1="6" y1="16" x2="18" y2="16" strokeWidth="1.5" />
            {/* Sagitta (perpendicular from chord to arc) */}
            <line x1="12" y1="16" x2="12" y2="5" strokeWidth="1" strokeDasharray="2,1" opacity="0.6" />
            {/* Arrow on sagitta */}
            <path d="M 10 7 L 12 5 L 14 7" fill="none" stroke="currentColor" strokeWidth="1" />
            {/* 1st click - Chord start (Red) */}
            <circle cx="6" cy="16" r="2.5" fill={CLICK_COLORS.FIRST} stroke="none" />
            {/* 2nd click - Chord end (Orange) */}
            <circle cx="18" cy="16" r="2.5" fill={CLICK_COLORS.SECOND} stroke="none" />
            {/* 3rd/Last click - Sagitta point (Green) */}
            <circle cx="12" cy="5" r="2.5" fill={CLICK_COLORS.THIRD} stroke="none" />
          </>
        );

      default:
        return renderCenterDot();
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
      {/* Main circle - common to all variants */}
      <circle cx="12" cy="12" r="8" />
      {/* Variant-specific content */}
      {renderVariantContent()}
    </svg>
  );
};

// Convenience exports for backward compatibility
export const CircleRadiusIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="radius" {...props} />;

export const CircleDiameterIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="diameter" {...props} />;

export const Circle3PIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="3point" {...props} />;

export const Circle2PRadiusIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="2point-radius" {...props} />;

export const Circle2PDiameterIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="2point-diameter" {...props} />;

export const CircleBestFitIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="best-fit" {...props} />;

export const CircleChordSagittaIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="chord-sagitta" {...props} />;