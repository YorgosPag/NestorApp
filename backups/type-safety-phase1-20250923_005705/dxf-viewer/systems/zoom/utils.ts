/**
 * ZOOM SYSTEM UTILITIES
 * Utility functions for zoom operations and calculations
 */

import type { ZoomConfig, ZoomLimits } from './config';
import { Point2D } from '../../types/shared';

// Point type imported from shared types

// Rectangle type for zoom regions
export interface ZoomRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Viewport dimensions
export interface ViewportDimensions {
  width: number;
  height: number;
}

/**
 * Clamp zoom value within allowed limits
 */
export function clampZoom(zoom: number, config: ZoomConfig): number {
  return Math.max(config.minZoom, Math.min(config.maxZoom, zoom));
}

/**
 * Calculate zoom factor for fitting content to viewport
 */
export function calculateFitZoom(
  contentBounds: ZoomRegion,
  viewport: ViewportDimensions,
  padding: number = 0.1
): number {
  if (contentBounds.width <= 0 || contentBounds.height <= 0) {
    return 1.0;
  }

  const paddingFactor = 1 - padding;
  const scaleX = (viewport.width * paddingFactor) / contentBounds.width;
  const scaleY = (viewport.height * paddingFactor) / contentBounds.height;
  
  return Math.min(scaleX, scaleY);
}

/**
 * Calculate zoom factor for a specific region
 */
export function calculateRegionZoom(
  region: ZoomRegion,
  viewport: ViewportDimensions,
  padding: number = 0.1
): number {
  return calculateFitZoom(region, viewport, padding);
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(
  screenPoint: Point2D,
  zoom: number,
  offset: Point2D
): Point2D {
  return {
    x: (screenPoint.x - offset.x) / zoom,
    y: (screenPoint.y - offset.y) / zoom,
  };
}

/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(
  worldPoint: Point2D,
  zoom: number,
  offset: Point2D
): Point2D {
  return {
    x: worldPoint.x * zoom + offset.x,
    y: worldPoint.y * zoom + offset.y,
  };
}

/**
 * Calculate zoom level from scale
 */
export function scaleToZoomLevel(scale: number): number {
  return Math.log2(scale);
}

/**
 * Calculate scale from zoom level
 */
export function zoomLevelToScale(zoomLevel: number): number {
  return Math.pow(2, zoomLevel);
}

/**
 * Get zoom level category
 */
export function getZoomCategory(
  zoom: number,
  presets: ZoomLimits
): keyof ZoomLimits {
  if (zoom >= presets.veryFine) return 'veryFine';
  if (zoom >= presets.fine) return 'fine';
  if (zoom >= presets.normal) return 'normal';
  if (zoom >= presets.overview) return 'overview';
  return 'farOverview';
}

/**
 * Format zoom as percentage string
 */
export function formatZoomPercentage(zoom: number, precision: number = 0): string {
  const percentage = zoom * 100;
  return `${percentage.toFixed(precision)}%`;
}

/**
 * Format zoom as scale string
 */
export function formatZoomScale(zoom: number, precision: number = 2): string {
  return `${zoom.toFixed(precision)}×`;
}

/**
 * Parse zoom from string input
 */
export function parseZoomInput(input: string): number | null {
  const cleaned = input.trim().replace(/[%×x]$/i, '');
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }
  
  // If input contained %, convert from percentage
  if (input.includes('%')) {
    return parsed / 100;
  }
  
  return parsed;
}

/**
 * Calculate zoom increment for smooth zooming
 */
export function calculateZoomIncrement(
  currentZoom: number,
  targetZoom: number,
  steps: number
): number {
  if (steps <= 1) return targetZoom - currentZoom;
  
  // Use exponential interpolation for smooth zoom
  const ratio = targetZoom / currentZoom;
  const stepRatio = Math.pow(ratio, 1 / steps);
  
  return currentZoom * stepRatio - currentZoom;
}

/**
 * Check if zoom is within reasonable bounds for performance
 */
export function isZoomPerformant(zoom: number): boolean {
  // Very high zoom levels can cause performance issues
  return zoom <= 100 && zoom >= 0.001;
}

/**
 * Calculate optimal zoom step based on current zoom level
 */
export function calculateOptimalZoomStep(currentZoom: number): number {
  if (currentZoom >= 10) return 1.0;      // Large steps for high zoom
  if (currentZoom >= 1) return 0.25;      // Medium steps for normal zoom
  if (currentZoom >= 0.1) return 0.05;    // Small steps for low zoom
  return 0.01;                            // Very small steps for very low zoom
}

/**
 * Validate zoom region dimensions
 */
export function isValidZoomRegion(region: ZoomRegion, minSize: number = 1): boolean {
  return (
    region.width >= minSize &&
    region.height >= minSize &&
    isFinite(region.x) &&
    isFinite(region.y) &&
    isFinite(region.width) &&
    isFinite(region.height)
  );
}

/**
 * Calculate center point of a region
 */
export function getRegionCenter(region: ZoomRegion): Point2D {
  return {
    x: region.x + region.width / 2,
    y: region.y + region.height / 2,
  };
}

/**
 * Create zoom region from two points
 */
export function createZoomRegion(point1: Point2D, point2: Point2D): ZoomRegion {
  const x = Math.min(point1.x, point2.x);
  const y = Math.min(point1.y, point2.y);
  const width = Math.abs(point2.x - point1.x);
  const height = Math.abs(point2.y - point1.y);
  
  return { x, y, width, height };
}

/**
 * Interpolate between two zoom values
 */
export function interpolateZoom(
  startZoom: number,
  endZoom: number,
  progress: number
): number {
  // Clamp progress between 0 and 1
  progress = Math.max(0, Math.min(1, progress));
  
  // Use exponential interpolation for natural zoom feel
  const logStart = Math.log(startZoom);
  const logEnd = Math.log(endZoom);
  const logResult = logStart + (logEnd - logStart) * progress;
  
  return Math.exp(logResult);
}

/**
 * Calculate mouse wheel zoom delta
 */
export function calculateWheelZoom(
  currentZoom: number,
  wheelDelta: number,
  sensitivity: number = 0.2
): number {
  const direction = wheelDelta > 0 ? 1 : -1;
  const factor = 1 + sensitivity * direction;
  
  return currentZoom * factor;
}

/**
 * Get zoom bounds for a set of entities
 */
export function calculateEntityBounds(entities: Array<{ x: number; y: number; width?: number; height?: number }>): ZoomRegion | null {
  if (entities.length === 0) return null;
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  for (const entity of entities) {
    const entityMinX = entity.x;
    const entityMinY = entity.y;
    const entityMaxX = entity.x + (entity.width || 0);
    const entityMaxY = entity.y + (entity.height || 0);
    
    minX = Math.min(minX, entityMinX);
    minY = Math.min(minY, entityMinY);
    maxX = Math.max(maxX, entityMaxX);
    maxY = Math.max(maxY, entityMaxY);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}