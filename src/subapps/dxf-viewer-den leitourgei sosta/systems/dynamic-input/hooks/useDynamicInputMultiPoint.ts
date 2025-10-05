'use client';

import { useMemo } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
import { calculateDistance } from '../../../rendering/entities/shared/geometry-rendering-utils';

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
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      
      if (mag1 > 0.001 && mag2 > 0.001) { // Αποφυγή division by zero
        const cosAngle = dot / (mag1 * mag2);
        const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp για ακρίβεια
        segmentAngle = (angleRad * 180) / Math.PI;
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
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 < 0.001 || mag2 < 0.001) {
    return { angle: 0, vertex, isValid: false };
  }
  
  const cosAngle = dot / (mag1 * mag2);
  const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  const angleDeg = (angleRad * 180) / Math.PI;
  
  return { angle: angleDeg, vertex, isValid: true };
}

/**
 * Utility function για formatting αποστάσεων
 */
export function formatDistance(distance: number): string {
  if (distance < 0.001) return '0.000';
  return distance.toFixed(3);
}

/**
 * Utility function για formatting γωνιών
 */
export function formatAngle(angle: number): string {
  if (Math.abs(angle) < 0.01) return '0.0°';
  return `${angle.toFixed(1)}°`;
}