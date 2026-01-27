/**
 * Angle Two Arcs Icon - Δύο τόξα/κύκλοι
 */

import * as React from 'react';
// 🏢 ENTERPRISE: Centralized icon sizes - Zero hardcoded values (ADR-002)
import { componentSizes } from '../../../../../styles/design-tokens';

// 🏢 ENTERPRISE: Default icon size from centralized design tokens
const DEFAULT_ICON_SIZE = componentSizes.icon.numeric.sm; // 16px

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
      {/* Πρώτο τόξο */}
      <path d="M 4 12 A 4 4 0 0 1 12 4" />
      
      {/* Δεύτερο τόξο */}
      <path d="M 12 20 A 4 4 0 0 1 20 12" />
      
      {/* Τόξο γωνίας στη μέση */}
      <path d="M 8 12 A 2 2 0 0 1 12 8" />
      
      {/* Σημεία τομής */}
      <circle cx="8" cy="8" r="1" fill={color} />
      <circle cx="16" cy="16" r="1" fill={color} />
      <circle cx="12" cy="12" r="1" fill={color} />
    </svg>
  );
}

export default AngleTwoArcsIcon;