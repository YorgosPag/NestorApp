/**
 * Angle Constraint Icon - Παραμετρικό Angle Constraint
 */

import * as React from 'react';
import { AngleIconBase } from './shared/AngleIconBase';
// 🏢 ENTERPRISE: Centralized icon sizes - Zero hardcoded values (ADR-002)
import { componentSizes } from '../../../../../styles/design-tokens';

// 🏢 ENTERPRISE: Default icon size from centralized design tokens
const DEFAULT_ICON_SIZE = componentSizes.icon.numeric.sm; // 16px

interface AngleConstraintIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AngleConstraintIcon({ size = DEFAULT_ICON_SIZE, color = "currentColor", strokeWidth = 1.5 }: AngleConstraintIconProps) {
  return (
    <AngleIconBase
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      showMeasurementSymbol={false}
    >
      {/* Constraint σύμβολα (κλειδαριές/σύνδεσμοι) */}
      <rect x="16" y="8" width="3" height="2" rx="0.5" />
      <line x1="17.5" y1="8" x2="17.5" y2="6" />
      <path d="M 17 6 A 1 1 0 0 0 18 6" />
      
      {/* Παραμετρικό σύμβολο (P) */}
      <text x="14" y="16" fontSize="6" fontFamily="monospace" fill={color}>P</text>
    </AngleIconBase>
  );
}

export default AngleConstraintIcon;