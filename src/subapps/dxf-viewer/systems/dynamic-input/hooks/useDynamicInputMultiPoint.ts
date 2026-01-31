'use client';

import { useMemo } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
// 🏢 ADR-065: Centralized Distance Calculation
// 🏢 ADR-070: Centralized Vector Magnitude
// 🏢 ADR-072: Centralized Dot Product
import { calculateDistance, vectorMagnitude, dotProduct } from '../../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { radToDeg } from '../../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-069: Centralized Number Formatting
import {
  formatDistance as centralizedFormatDistance,
  formatAngle as centralizedFormatAngle
} from '../../../rendering/entities/shared/distance-label-utils';
// 🏢 ADR-079: Centralized Vector Precision Constants
import { VECTOR_PRECISION } from '../../../config/tolerance-config';

interface SegmentInfo {
  startPoint: Point2D;
  endPoint: Point2D;
  distance: number;
  midPoint: Point2D;
}

interface AngleInfo {
  angle: number; // σε degrees
  vertex: Point2D;
  isValid: boolean;
}

interface UseDynamicInputMultiPointArgs {
  tempPoints: Point2D[];
  mouseWorldPosition: Point2D | null;
  activeTool: string;
  showInput: boolean;
}

interface MultiPointInfo {
  segments: SegmentInfo[];
  lastPointDistance: number | null;
  segmentAngle: number | null;
  totalDistance: number;
  shouldShowMultiPoint: boolean;
}

/**
 * Hook για υπολογισμό multi-point information για polyline/polygon tools
 * Υπολογίζει αποστάσεις, γωνίες και segment information
 */
export function useDynamicInputMultiPoint({
  tempPoints,
  mouseWorldPosition,
  activeTool,
  showInput
}: UseDynamicInputMultiPointArgs): MultiPointInfo {

  const multiPointInfo = useMemo(() => {
    // Εργαλεία που χρησιμοποιούν multi-point logic
    const multiPointTools = ['polyline', 'measure-angle', 'polygon', 'measure-area'];
    const shouldShow = multiPointTools.includes(activeTool) && showInput;

    if (!shouldShow || !tempPoints || tempPoints.length === 0) {
      return {
        segments: [],
        lastPointDistance: null,
        segmentAngle: null,
        totalDistance: 0,
        shouldShowMultiPoint: false
      };
    }

    // Υπολογισμός όλων των segments
    const segments: SegmentInfo[] = [];
    let totalDistance = 0;

    // Δημιουργία segments από τα υπάρχοντα tempPoints
    for (let i = 0; i < tempPoints.length - 1; i++) {
      const startPoint = tempPoints[i];
      const endPoint = tempPoints[i + 1];

      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const distance = calculateDistance(startPoint, endPoint);

      const midPoint = {
        x: startPoint.x + dx / 2,
        y: startPoint.y + dy / 2
      };

      segments.push({
        startPoint,
        endPoint,
        distance,
        midPoint
      });

      totalDistance += distance;
    }

    // Υπολογισμός απόστασης από τελευταίο σημείο στον κέρσορα
    let lastPointDistance: number | null = null;
    if (mouseWorldPosition && tempPoints.length > 0) {
      const lastPoint = tempPoints[tempPoints.length - 1];
      lastPointDistance = calculateDistance(mouseWorldPosition, lastPoint);
    }

    // Υπολογισμός γωνίας για το τρέχον segment
    let segmentAngle: number | null = null;
    if (mouseWorldPosition && tempPoints.length >= 2) {
      const lastPoint = tempPoints[tempPoints.length - 1];
      const secondLastPoint = tempPoints[tempPoints.length - 2];
      
      // Διάνυσμα από second-last στο last point
      const v1 = {
        x: lastPoint.x - secondLastPoint.x,
        y: lastPoint.y - secondLastPoint.y
      };
      
      // Διάνυσμα από last point στον κέρσορα
      const v2 = {
        x: mouseWorldPosition.x - lastPoint.x,
        y: mouseWorldPosition.y - lastPoint.y
      };
      
      // Υπολογισμός γωνίας μεταξύ των διανυσμάτων
      // 🏢 ADR-072: Use centralized dot product
      const dot = dotProduct(v1, v2);
      // 🏢 ADR-070: Use centralized vector magnitude
      const mag1 = vectorMagnitude(v1);
      const mag2 = vectorMagnitude(v2);

      // 🏢 ADR-079: Use centralized vector magnitude threshold
      if (mag1 > VECTOR_PRECISION.MIN_MAGNITUDE && mag2 > VECTOR_PRECISION.MIN_MAGNITUDE) { // Αποφυγή division by zero
        const cosAngle = dot / (mag1 * mag2);
        const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp για ακρίβεια
        // 🏢 ADR-067: Use centralized angle conversion
        segmentAngle = radToDeg(angleRad);
      }
    }

    return {
      segments,
      lastPointDistance,
      segmentAngle,
      totalDistance,
      shouldShowMultiPoint: true
    };

  }, [tempPoints, mouseWorldPosition, activeTool, showInput]);

  return multiPointInfo;
}

/**
 * Utility function για υπολογισμό γωνίας μεταξύ τριών σημείων
 */
export function calculateAngleBetweenPoints(
  p1: Point2D,
  vertex: Point2D,
  p3: Point2D
): AngleInfo {
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
  const v2 = { x: p3.x - vertex.x, y: p3.y - vertex.y };

  // 🏢 ADR-072: Use centralized dot product
  const dot = dotProduct(v1, v2);
  // 🏢 ADR-070: Use centralized vector magnitude
  const mag1 = vectorMagnitude(v1);
  const mag2 = vectorMagnitude(v2);

  // 🏢 ADR-079: Use centralized vector magnitude threshold
  if (mag1 < VECTOR_PRECISION.MIN_MAGNITUDE || mag2 < VECTOR_PRECISION.MIN_MAGNITUDE) {
    return { angle: 0, vertex, isValid: false };
  }

  const cosAngle = dot / (mag1 * mag2);
  const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  // 🏢 ADR-067: Use centralized angle conversion
  const angleDeg = radToDeg(angleRad);

  return { angle: angleDeg, vertex, isValid: true };
}

// ============================================================================
// 🏢 ADR-069: Centralized Number Formatting - Re-exports for backward compatibility
// ============================================================================

/**
 * 🏢 ENTERPRISE: Format distance value for display
 * Re-exports centralized implementation with 3 decimals (original behavior)
 *
 * @deprecated Prefer importing directly from 'distance-label-utils.ts'
 */
export function formatDistance(distance: number): string {
  return centralizedFormatDistance(distance, 3);
}

/**
 * 🏢 ENTERPRISE: Format angle value for display
 * Re-exports centralized implementation with 1 decimal (original behavior)
 *
 * @deprecated Prefer importing directly from 'distance-label-utils.ts'
 */
export function formatAngle(angle: number): string {
  return centralizedFormatAngle(angle, 1);
}