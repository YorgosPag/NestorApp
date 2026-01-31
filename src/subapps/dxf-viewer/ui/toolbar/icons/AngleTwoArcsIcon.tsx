/**
 * Angle Two Arcs Icon - Δύο τόξα/κύκλοι
 *
 * 🎨 COLOR CODED (2026-01-31): Click sequence visualization
 * 3 STEPS: Point on Arc1 → Intersection → Point on Arc2: 🔴 → 🟠 → 🟢
 */

import * as React from 'react';
// 🏢 ENTERPRISE: Centralized icon sizes - Zero hardcoded values (ADR-002)
import { componentSizes } from '../../../../../styles/design-tokens';

// 🏢 ENTERPRISE: Default icon size from centralized design tokens
const DEFAULT_ICON_SIZE = componentSizes.icon.numeric.sm; // 16px

// 🎨 Color coding for click sequence (consistent with ArcIcon/CircleIcon)
// 3 στάσεις: Κόκκινο → Πορτοκαλί → Πράσινο
const CLICK_COLORS = {
  FIRST: '#ef4444',   // 🔴 Red - 1st click (Point on first arc)
  SECOND: '#f97316',  // 🟠 Orange - 2nd click (Intersection/Vertex)
  THIRD: '#22c55e',   // 🟢 Green - 3rd/last click (Point on second arc)
} as const;

interface AngleTwoArcsIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AngleTwoArcsIcon({ size = DEFAULT_ICON_SIZE, color = "currentColor", strokeWidth = 1.5 }: AngleTwoArcsIconProps) {
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
      {/* Πρώτο τόξο - μεγαλύτερο */}
      <path d="M 3 12 A 5 5 0 0 1 12 3" />

      {/* Δεύτερο τόξο - μεγαλύτερο */}
      <path d="M 12 21 A 5 5 0 0 1 21 12" />

      {/* Τόξο γωνίας στη μέση */}
      <path d="M 7 12 A 3 3 0 0 1 12 7" />

      {/* Color-coded click sequence points */}
      {/* 1st click - Point on first arc (Red) */}
      <circle cx="7" cy="7" r="2.5" fill={CLICK_COLORS.FIRST} stroke="none" />
      {/* 2nd click - Intersection vertex (Orange) */}
      <circle cx="12" cy="12" r="2.5" fill={CLICK_COLORS.SECOND} stroke="none" />
      {/* 3rd/Last click - Point on second arc (Green) */}
      <circle cx="17" cy="17" r="2.5" fill={CLICK_COLORS.THIRD} stroke="none" />
    </svg>
  );
}

export default AngleTwoArcsIcon;