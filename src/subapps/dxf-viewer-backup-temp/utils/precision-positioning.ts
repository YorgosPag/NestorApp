// src/subapps/dxf-viewer/utils/precision-positioning.ts
// 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ PRECISION POSITIONING SYSTEM
// Ενιαία λογική για ακριβή τοποθέτηση draggable components

import React from 'react';

export type Point2D = {
  x: number;
  y: number;
};

export type PositionAlignment = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';

export interface PrecisionPositionConfig {
  targetPoint: Point2D;
  alignment: PositionAlignment;
  dependencies?: any[];
}

/**
 * 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟΣ HOOK ΓΙΑ PRECISION POSITIONING
 *
 * Υπολογίζει την ακριβή θέση ενός component βάσει:
 * - Στόχου σημείου (target point)
 * - Alignment (πού να "κολλήσει" το component στο target point)
 * - Πραγματικών διαστάσεων του component
 */
export const usePrecisionPositioning = (
  elementRef: React.RefObject<HTMLElement>,
  config: PrecisionPositionConfig
) => {
  const [position, setPosition] = React.useState<Point2D>({ x: 0, y: 0 });
  const [hasInitialized, setHasInitialized] = React.useState(false);

  const calculatePosition = React.useCallback(() => {
    if (!elementRef.current) return { x: 0, y: 0 };

    const rect = elementRef.current.getBoundingClientRect();
    const { targetPoint, alignment } = config;

    let calculatedX: number;
    let calculatedY: number;

    // Υπολογισμός X coordinate βάσει alignment
    switch (alignment) {
      case 'bottom-right':
      case 'top-right':
        calculatedX = targetPoint.x - rect.width;
        break;
      case 'bottom-left':
      case 'top-left':
        calculatedX = targetPoint.x;
        break;
      case 'center':
        calculatedX = targetPoint.x - rect.width / 2;
        break;
      default:
        calculatedX = targetPoint.x - rect.width;
    }

    // Υπολογισμός Y coordinate βάσει alignment
    switch (alignment) {
      case 'bottom-right':
      case 'bottom-left':
        calculatedY = targetPoint.y - rect.height;
        break;
      case 'top-right':
      case 'top-left':
        calculatedY = targetPoint.y;
        break;
      case 'center':
        calculatedY = targetPoint.y - rect.height / 2;
        break;
      default:
        calculatedY = targetPoint.y - rect.height;
    }

    return { x: calculatedX, y: calculatedY };
  }, [config, elementRef]);

  React.useEffect(() => {
    if (!hasInitialized && elementRef.current) {
      const calculatedPosition = calculatePosition();

      console.log('🎯 PRECISION POSITIONING CALCULATION:', {
        targetPoint: config.targetPoint,
        alignment: config.alignment,
        elementSize: elementRef.current ? {
          width: elementRef.current.getBoundingClientRect().width,
          height: elementRef.current.getBoundingClientRect().height
        } : null,
        calculatedPosition,
        resultingTargetPoint: elementRef.current ? {
          x: calculatedPosition.x + (config.alignment.includes('right') ? elementRef.current.getBoundingClientRect().width : 0),
          y: calculatedPosition.y + (config.alignment.includes('bottom') ? elementRef.current.getBoundingClientRect().height : 0)
        } : null
      });

      setPosition(calculatedPosition);
      setHasInitialized(true);
    }
  }, [hasInitialized, calculatePosition, config.dependencies]);

  return {
    position,
    hasInitialized,
    recalculate: () => {
      if (elementRef.current) {
        const newPosition = calculatePosition();
        setPosition(newPosition);
      }
    }
  };
};

/**
 * 🎯 ΒΟΗΘΗΤΙΚΗ FUNCTION ΓΙΑ ΜΟΝΟ-ΧΡΗΣΗ CALCULATIONS
 * Για περιπτώσεις που δεν χρειάζεται full hook
 */
export const calculatePrecisePosition = (
  elementRect: DOMRect,
  targetPoint: Point2D,
  alignment: PositionAlignment
): Point2D => {
  let x: number;
  let y: number;

  // X calculation
  switch (alignment) {
    case 'bottom-right':
    case 'top-right':
      x = targetPoint.x - elementRect.width;
      break;
    case 'bottom-left':
    case 'top-left':
      x = targetPoint.x;
      break;
    case 'center':
      x = targetPoint.x - elementRect.width / 2;
      break;
    default:
      x = targetPoint.x - elementRect.width;
  }

  // Y calculation
  switch (alignment) {
    case 'bottom-right':
    case 'bottom-left':
      y = targetPoint.y - elementRect.height;
      break;
    case 'top-right':
    case 'top-left':
      y = targetPoint.y;
      break;
    case 'center':
      y = targetPoint.y - elementRect.height / 2;
      break;
    default:
      y = targetPoint.y - elementRect.height;
  }

  return { x, y };
};