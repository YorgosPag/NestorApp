/**
 * Angle MeasureGeom Icon - Μετρητής MEASUREGEOM (χωρίς διάσταση)
 */

import * as React from 'react';
import { AngleIconBase } from './shared/AngleIconBase';

interface AngleMeasureGeomIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AngleMeasureGeomIcon({ size = 16, color = "currentColor", strokeWidth = 1.5 }: AngleMeasureGeomIconProps) {
  return (
    <AngleIconBase
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      showMeasurementSymbol={true}
    />
  );
}

export default AngleMeasureGeomIcon;