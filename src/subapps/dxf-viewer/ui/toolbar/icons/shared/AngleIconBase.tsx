/**
 * Shared Angle Icon Base - Common SVG structure for angle icons
 * Eliminates 158-token duplication between AngleIcon and AngleMeasureGeomIcon
 *
 * 🎨 COLOR CODED (2026-01-31): Click sequence visualization
 * 3 STEPS: Point1 → Vertex → Point2: 🔴 → 🟠 → 🟢
 *
 * @see ADR-142: Icon Click Sequence Colors Centralization
 */

import * as React from 'react';
// 🏢 ENTERPRISE: Centralized icon sizes - Zero hardcoded values (ADR-002)
import { componentSizes } from '../../../../../../styles/design-tokens';
// 🏢 ADR-142: Centralized Icon Click Sequence Colors
import { ICON_CLICK_COLORS } from '../../../../config/color-config';

// 🏢 ENTERPRISE: Default icon size from centralized design tokens
const DEFAULT_ICON_SIZE = componentSizes.icon.numeric.sm; // 16px

interface AngleIconBaseProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  showMeasurementSymbol?: boolean;
  showDiagonalLine?: boolean;
  /** Enable color-coded click sequence points */
  showClickSequence?: boolean;
  children?: React.ReactNode;
}

export function AngleIconBase({
  size = DEFAULT_ICON_SIZE,
  color = "currentColor",
  strokeWidth = 1.5,
  showMeasurementSymbol = false,
  showDiagonalLine = true,
  showClickSequence = true,
  children
}: AngleIconBaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Κάθετη γραμμή (1η ακτίνα) */}
      <line x1="5" y1="19" x2="5" y2="4" />

      {/* Διαγώνια γραμμή (2η ακτίνα) - conditionally rendered */}
      {showDiagonalLine && <line x1="5" y1="19" x2="20" y2="4" />}

      {/* Τόξο γωνίας - μεγαλύτερο */}
      <path d="M 5 14 A 5 5 0 0 1 10 11" />

      {/* Μετρητής/calculator σύμβολο - conditionally rendered */}
      {showMeasurementSymbol && (
        <>
          <rect x="14" y="14" width="6" height="4" rx="1" />
          <line x1="16" y1="15" x2="18" y2="15" />
          <line x1="16" y1="17" x2="18" y2="17" />
        </>
      )}

      {/* Σημεία στα άκρα των γραμμών - Color coded click sequence */}
      {showClickSequence ? (
        <>
          {/* 1st click - Point on first ray (Red) */}
          <circle cx="5" cy="4" r="2.5" fill={ICON_CLICK_COLORS.FIRST} stroke="none" />
          {/* 2nd click - Vertex (Orange) */}
          <circle cx="5" cy="19" r="2.5" fill={ICON_CLICK_COLORS.SECOND} stroke="none" />
          {/* 3rd/Last click - Point on second ray (Green) */}
          <circle cx="20" cy="4" r="2.5" fill={ICON_CLICK_COLORS.THIRD} stroke="none" />
        </>
      ) : (
        <>
          {/* Original monochrome points */}
          <circle cx="5" cy="4" r="1.5" fill={color} stroke="none" />
          <circle cx="20" cy="4" r="1.5" fill={color} stroke="none" />
          <circle cx="5" cy="19" r="1.5" fill={color} stroke="none" />
        </>
      )}

      {/* Additional children for customization */}
      {children}
    </svg>
  );
}

export default AngleIconBase;