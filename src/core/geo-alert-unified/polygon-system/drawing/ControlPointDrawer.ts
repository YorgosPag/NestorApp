/**
 * 🎯 CONTROL POINT DRAWER
 *
 * Specialized drawer για georeferencing control points
 *
 * @module core/polygon-system/drawing/ControlPointDrawer
 */

import type {
  UniversalPolygon,
  PolygonPoint,
  PolygonStyle
} from '../types';
import { DEFAULT_POLYGON_STYLES } from '../types';
import { SimplePolygonDrawer } from './SimplePolygonDrawer';

/**
 * Extended drawer για georeferencing control points
 */
export class ControlPointDrawer extends SimplePolygonDrawer {
  private geoReferences: Map<string, { lng: number; lat: number }> = new Map();

  constructor(canvas?: HTMLCanvasElement) {
    super(canvas);

    // Override default style για control points
    this.setOptions({
      mode: 'georeferencing',
      style: DEFAULT_POLYGON_STYLES.georeferencing
    });
  }

  /**
   * Add control point with geographic reference
   */
  addControlPoint(
    x: number,
    y: number,
    geoCoords?: { lng: number; lat: number },
    label?: string
  ): PolygonPoint | null {
    const point = this.addPoint(x, y);

    if (point && geoCoords) {
      // Store geographic reference
      this.geoReferences.set(point.id!, geoCoords);

      // Update point label
      if (label) {
        point.label = label;
      } else {
        point.label = `CP${this.getState().currentPolygon?.points.length || 0}`;
      }

      console.log(`🎯 Added control point:`, {
        floor: { x, y },
        geo: geoCoords,
        label: point.label
      });
    }

    return point;
  }

  /**
   * Set geographic coordinates για existing point
   */
  setGeoReference(pointId: string, geoCoords: { lng: number; lat: number }): boolean {
    const currentPolygon = this.getState().currentPolygon;

    if (!currentPolygon) {
      console.warn('⚠️ No active polygon');
      return false;
    }

    const point = currentPolygon.points.find(p => p.id === pointId);
    if (!point) {
      console.warn(`⚠️ Point ${pointId} not found`);
      return false;
    }

    this.geoReferences.set(pointId, geoCoords);

    console.log(`📍 Set geo reference για ${pointId}:`, geoCoords);
    return true;
  }

  /**
   * Get geographic reference για point
   */
  getGeoReference(pointId: string): { lng: number; lat: number } | null {
    return this.geoReferences.get(pointId) || null;
  }

  /**
   * Get all control points with geo references
   */
  getControlPoints(): Array<{
    point: PolygonPoint;
    geoCoords: { lng: number; lat: number } | null;
  }> {
    const currentPolygon = this.getState().currentPolygon;

    if (!currentPolygon) {
      return [];
    }

    return currentPolygon.points.map(point => ({
      point,
      geoCoords: this.getGeoReference(point.id!) || null
    }));
  }

  /**
   * Export control points για transformation calculation
   */
  exportForTransformation(): Array<{
    id: string;
    floor: { x: number; y: number };
    geo: { lng: number; lat: number };
    label?: string;
  }> {
    const controlPoints = this.getControlPoints();

    return controlPoints
      .filter(cp => cp.geoCoords !== null)
      .map(cp => ({
        id: cp.point.id!,
        floor: { x: cp.point.x, y: cp.point.y },
        geo: cp.geoCoords!,
        label: cp.point.label
      }));
  }

  /**
   * Validate control points για transformation
   */
  validateForTransformation(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    controlPointCount: number;
    geoReferencedCount: number;
  } {
    const controlPoints = this.getControlPoints();
    const geoReferencedPoints = controlPoints.filter(cp => cp.geoCoords !== null);

    const errors: string[] = [];
    const warnings: string[] = [];

    // Minimum 3 points για affine transformation
    if (geoReferencedPoints.length < 3) {
      errors.push(`Need at least 3 georeferenced points, have ${geoReferencedPoints.length}`);
    }

    // Check for duplicate floor coordinates
    const floorCoords = new Set<string>();
    for (const cp of geoReferencedPoints) {
      const coordKey = `${cp.point.x.toFixed(3)},${cp.point.y.toFixed(3)}`;
      if (floorCoords.has(coordKey)) {
        warnings.push(`Duplicate floor coordinates at (${cp.point.x}, ${cp.point.y})`);
      }
      floorCoords.add(coordKey);
    }

    // Check for duplicate geo coordinates
    const geoCoords = new Set<string>();
    for (const cp of geoReferencedPoints) {
      if (cp.geoCoords) {
        const coordKey = `${cp.geoCoords.lng.toFixed(6)},${cp.geoCoords.lat.toFixed(6)}`;
        if (geoCoords.has(coordKey)) {
          warnings.push(`Duplicate geo coordinates at (${cp.geoCoords.lng}, ${cp.geoCoords.lat})`);
        }
        geoCoords.add(coordKey);
      }
    }

    // Check for collinear points (basic check)
    if (geoReferencedPoints.length >= 3) {
      const isCollinear = this.checkCollinearity(geoReferencedPoints);
      if (isCollinear) {
        warnings.push('Control points may be collinear, which can affect transformation accuracy');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      controlPointCount: controlPoints.length,
      geoReferencedCount: geoReferencedPoints.length
    };
  }

  /**
   * Check if points are approximately collinear
   */
  private checkCollinearity(controlPoints: Array<{
    point: PolygonPoint;
    geoCoords: { lng: number; lat: number } | null;
  }>): boolean {
    if (controlPoints.length < 3) {
      return false;
    }

    // Take first 3 points for collinearity check
    const p1 = controlPoints[0].point;
    const p2 = controlPoints[1].point;
    const p3 = controlPoints[2].point;

    // Calculate area of triangle formed by 3 points
    const area = Math.abs(
      (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2
    );

    // If area is very small, points are approximately collinear
    return area < 1.0; // Threshold για collinearity
  }

  /**
   * Override render to show geo references
   */
  render(): void {
    // Call parent render
    super.render();

    // Add geo reference indicators
    this.renderGeoReferences();
  }

  /**
   * Render geo reference indicators
   */
  private renderGeoReferences(): void {
    if (!this.context || !this.canvas) {
      return;
    }

    const currentPolygon = this.getState().currentPolygon;
    if (!currentPolygon) {
      return;
    }

    this.context.save();

    // Render geo reference indicators
    for (const point of currentPolygon.points) {
      const geoRef = this.getGeoReference(point.id!);

      if (geoRef) {
        // Draw green indicator για georeferenced points
        this.context.fillStyle = '#10b981';
        this.context.strokeStyle = '#065f46';
        this.context.lineWidth = 2;

        // Outer ring
        this.context.beginPath();
        this.context.arc(point.x, point.y, 8, 0, 2 * Math.PI);
        this.context.stroke();

        // Inner fill
        this.context.beginPath();
        this.context.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        this.context.fill();

        // Show coordinates as text
        this.context.fillStyle = '#374151';
        this.context.font = '10px Arial';
        this.context.textAlign = 'center';
        this.context.fillText(
          `${geoRef.lng.toFixed(4)}, ${geoRef.lat.toFixed(4)}`,
          point.x,
          point.y - 12
        );

        // Show label
        if (point.label) {
          this.context.fillText(point.label, point.x, point.y + 20);
        }
      } else {
        // Draw red indicator για non-georeferenced points
        this.context.fillStyle = '#ef4444';
        this.context.strokeStyle = '#991b1b';
        this.context.lineWidth = 2;

        this.context.beginPath();
        this.context.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        this.context.stroke();

        // Show "needs geo ref" indicator
        this.context.fillStyle = '#dc2626';
        this.context.font = '12px Arial';
        this.context.textAlign = 'center';
        this.context.fillText('?', point.x, point.y + 4);
      }
    }

    this.context.restore();
  }

  /**
   * Clear all geo references
   */
  clearGeoReferences(): void {
    this.geoReferences.clear();
    console.log('🗑️ Cleared all geo references');
  }

  /**
   * Import geo references from data
   */
  importGeoReferences(data: Record<string, { lng: number; lat: number }>): void {
    this.geoReferences.clear();

    for (const [pointId, coords] of Object.entries(data)) {
      this.geoReferences.set(pointId, coords);
    }

    console.log(`📥 Imported ${Object.keys(data).length} geo references`);
  }

  /**
   * Export geo references
   */
  exportGeoReferences(): Record<string, { lng: number; lat: number }> {
    const exported: Record<string, { lng: number; lat: number }> = {};

    for (const [pointId, coords] of Array.from(this.geoReferences.entries())) {
      exported[pointId] = { ...coords };
    }

    return exported;
  }
}