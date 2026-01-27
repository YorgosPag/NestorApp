/**
 * Angle Line + Arc Icon - Γραμμή + τόξο/κύκλο
 * Refactored to use AngleIconBase to eliminate duplication
 */

import * as React from 'react';
import { AngleIconBase } from './shared/AngleIconBase';
// 🏢 ENTERPRISE: Centralized icon sizes - Zero hardcoded values (ADR-002)
import { componentSizes } from '../../../../../styles/design-tokens';

// 🏢 ENTERPRISE: Default icon size from centralized design tokens
const DEFAULT_ICON_SIZE = componentSizes.icon.numeric.sm; // 16px

interface AngleLineArcIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AngleLineArcIcon({ size = DEFAULT_ICON_SIZE, color = "currentColor", strokeWidth = 1.5 }: AngleLineArcIconProps) {
  return (
    <AngleIconBase 
      size={size} 
      color={color} 
      strokeWidth={strokeWidth}
      showDiagonalLine={false}
    >
      {/* Κύκλος/τόξο - custom για αυτό το icon */}
      <circle cx="14" cy="10" r="4" />
    </AngleIconBase>
  );
}

export default AngleLineArcIcon;