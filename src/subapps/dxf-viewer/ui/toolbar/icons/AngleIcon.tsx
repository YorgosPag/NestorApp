/**
 * Custom Angle Icon - Two lines with arc
 * Εικονίδιο γωνίας με δύο ευθείες και τόξο
 */

import * as React from 'react';
import { AngleIconBase } from './shared/AngleIconBase';
// 🏢 ENTERPRISE: Centralized icon sizes - Zero hardcoded values (ADR-002)
import { componentSizes } from '../../../../../styles/design-tokens';

// 🏢 ENTERPRISE: Default icon size from centralized design tokens
const DEFAULT_ICON_SIZE = componentSizes.icon.numeric.sm; // 16px

interface AngleIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AngleIcon({ size = DEFAULT_ICON_SIZE, color = "currentColor", strokeWidth = 1.5 }: AngleIconProps) {
  return (
    <AngleIconBase
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      showMeasurementSymbol={false}
    />
  );
}

export default AngleIcon;