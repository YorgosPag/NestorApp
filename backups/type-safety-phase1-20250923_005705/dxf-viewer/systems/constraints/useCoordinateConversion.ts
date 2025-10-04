import { useCallback } from 'react';
import type { Point2D } from '../coordinates/config';
import type { PolarCoordinates, CartesianCoordinates, PolarConstraintSettings } from './config';
import { CoordinateConverter } from './utils';

export interface CoordinateConversionHook {
  toPolar: (point: Point2D, basePoint?: Point2D) => PolarCoordinates;
  toCartesian: (polar: PolarCoordinates, basePoint?: Point2D) => CartesianCoordinates;
}

export function useCoordinateConversion(polarSettings: PolarConstraintSettings): CoordinateConversionHook {
  const toPolar = useCallback((point: Point2D, basePoint?: Point2D): PolarCoordinates => {
    return CoordinateConverter.cartesianToPolar(point, basePoint || polarSettings.basePoint);
  }, [polarSettings.basePoint]);

  const toCartesian = useCallback((polar: PolarCoordinates, basePoint?: Point2D): CartesianCoordinates => {
    return CoordinateConverter.polarToCartesian(polar, basePoint || polarSettings.basePoint);
  }, [polarSettings.basePoint]);

  return {
    toPolar,
    toCartesian
  };
}