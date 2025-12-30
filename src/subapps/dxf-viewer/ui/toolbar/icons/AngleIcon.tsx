/**
 * Custom Angle Icon - Two lines with arc
 * Εικονίδιο γωνίας με δύο ευθείες και τόξο
 */

import * as React from 'react';
import { AngleIconBase } from './shared/AngleIconBase';

interface AngleIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AngleIcon({ size = 16, color = "currentColor", strokeWidth = 1.5 }: AngleIconProps) {
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