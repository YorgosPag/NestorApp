/**
 * CONTROL POINT MANAGEMENT SERVICE
 * Enterprise-class διαχείριση Ground Control Points για DXF georeferencing
 * Βασισμένο σε photogrammetric και surveying standards
 *
 * C.5.41 SRP split: pure geometry + spatial analysis extracted to
 * `./control-point-geometry`. `nowISO()` SSoT replaces
 * `new Date().toISOString()` in `saveToLocalStorage`.
 */

import { safeJsonParse } from '@/lib/json-utils';
import { nowISO } from '@/lib/date-local';
import type {
  GeoControlPoint,
  DxfCoordinate,
  GeoCoordinate
} from '../../types';
import {
  assessSpatialDistribution,
  assessCoverage,
  calculateBoundingBox,
  calculateDistance,
  calculateGeometricDilution,
  detectClusters,
  type SpatialDistribution
} from './control-point-geometry';

// ============================================================================
// CONTROL POINT EVENTS
// ============================================================================

export type ControlPointEvent =
  | { type: 'POINT_ADDED'; point: GeoControlPoint }
  | { type: 'POINT_UPDATED'; point: GeoControlPoint }
  | { type: 'POINT_REMOVED'; pointId: string }
  | { type: 'POINTS_CLEARED' }
  | { type: 'TRANSFORMATION_UPDATED'; accuracy: number };

export type ControlPointEventListener = (event: ControlPointEvent) => void;

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

export interface ControlPointValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  statistics: {
    count: number;
    averageAccuracy: number;
    maxError: number;
    spatialDistribution: SpatialDistribution;
    geometricDilution: number; // Lower is better
  };
}

// ============================================================================
// CONTROL POINT MANAGER
// ============================================================================

/**
 * Service για διαχείριση Ground Control Points
 * Handles creation, validation, optimization, και persistence
 */
export class ControlPointManager {
  private controlPoints: Map<string, GeoControlPoint> = new Map();
  private listeners: ControlPointEventListener[] = [];
  private nextId = 1;

  constructor() {
    // Service initialization
  }

  // ========================================================================
  // CONTROL POINT MANAGEMENT
  // ========================================================================

  /**
   * Add new control point
   */
  addControlPoint(
    dxfPoint: DxfCoordinate,
    geoPoint: GeoCoordinate,
    options: {
      id?: string;
      accuracy?: number;
      description?: string;
    } = {}
  ): GeoControlPoint {
    const id = options.id || `GCP_${this.nextId++}`;

    if (this.controlPoints.has(id)) {
      throw new Error(`Control point with ID '${id}' already exists`);
    }

    const controlPoint: GeoControlPoint = {
      id,
      dxfPoint,
      geoPoint,
      accuracy: options.accuracy || 1.0, // Default 1 meter accuracy
      description: options.description || `Control Point ${id}`
    };

    this.controlPoints.set(id, controlPoint);
    this.notifyListeners({ type: 'POINT_ADDED', point: controlPoint });

    return controlPoint;
  }

  /**
   * Update existing control point
   */
  updateControlPoint(
    id: string,
    updates: Partial<Pick<GeoControlPoint, 'dxfPoint' | 'geoPoint' | 'accuracy' | 'description'>>
  ): GeoControlPoint {
    const existing = this.controlPoints.get(id);
    if (!existing) {
      throw new Error(`Control point '${id}' not found`);
    }

    const updated: GeoControlPoint = {
      ...existing,
      ...updates
    };

    this.controlPoints.set(id, updated);
    this.notifyListeners({ type: 'POINT_UPDATED', point: updated });

    return updated;
  }

  /**
   * Remove control point
   */
  removeControlPoint(id: string): boolean {
    const removed = this.controlPoints.delete(id);
    if (removed) {
      this.notifyListeners({ type: 'POINT_REMOVED', pointId: id });
    }
    return removed;
  }

  /**
   * Clear all control points
   */
  clearControlPoints(): void {
    this.controlPoints.clear();
    this.notifyListeners({ type: 'POINTS_CLEARED' });
  }

  /**
   * Get control point by ID
   */
  getControlPoint(id: string): GeoControlPoint | undefined {
    return this.controlPoints.get(id);
  }

  /**
   * Get all control points
   */
  getAllControlPoints(): GeoControlPoint[] {
    return Array.from(this.controlPoints.values());
  }

  /**
   * Get control points count
   */
  getCount(): number {
    return this.controlPoints.size;
  }

  // ========================================================================
  // VALIDATION & QUALITY ASSESSMENT
  // ========================================================================

  /**
   * Validate control points for transformation quality
   */
  validateControlPoints(): ControlPointValidation {
    const points = this.getAllControlPoints();
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Basic count validation
    if (points.length < 3) {
      errors.push('Χρειάζονται τουλάχιστον 3 control points για transformation');
    }

    if (points.length < 4) {
      warnings.push('Προτείνονται τουλάχιστον 4 control points για καλύτερη ακρίβεια');
    }

    // Accuracy validation
    const accuracies = points.map(p => p.accuracy);
    const averageAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const maxError = Math.max(...accuracies);

    if (maxError > 20) {
      errors.push(`Μεγάλο σφάλμα ακρίβειας: ${maxError.toFixed(2)}m (max recommended: 20m)`);
    }

    if (averageAccuracy > 5) {
      warnings.push(`Μέση ακρίβεια: ${averageAccuracy.toFixed(2)}m (recommended: <5m)`);
    }

    // Spatial distribution validation
    const spatialDistribution = assessSpatialDistribution(points);
    const geometricDilution = calculateGeometricDilution(points);

    if (spatialDistribution === 'poor') {
      warnings.push('Κακή χωρική κατανομή control points - προσθέστε points στις γωνίες');
      recommendations.push('Τοποθετήστε control points στις 4 γωνίες της περιοχής');
    }

    if (geometricDilution > 2.0) {
      warnings.push('Υψηλή γεωμετρική αραίωση - βελτιώστε τη χωρική κατανομή');
    }

    // Clustering detection
    const clusters = detectClusters(points);
    if (clusters.length > 0) {
      warnings.push(`Βρέθηκαν ${clusters.length} clusters από κοντινά points - διασκορπίστε τα`);
    }

    // Coverage assessment
    const coverage = assessCoverage(points);
    if (coverage < 0.6) {
      recommendations.push('Αυξήστε την κάλυψη της περιοχής με περισσότερα control points');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
      statistics: {
        count: points.length,
        averageAccuracy,
        maxError,
        spatialDistribution,
        geometricDilution
      }
    };
  }

  // ========================================================================
  // OPTIMIZATION & RECOMMENDATIONS
  // ========================================================================

  /**
   * Suggest optimal positions για additional control points
   */
  suggestOptimalPoints(targetCount: number = 6): DxfCoordinate[] {
    const existing = this.getAllControlPoints();
    if (existing.length === 0) {
      throw new Error('Cannot suggest points without existing control points');
    }

    const dxfPoints = existing.map(p => p.dxfPoint);
    const bbox = calculateBoundingBox(dxfPoints);
    const suggestions: DxfCoordinate[] = [];

    // Suggest corner points if missing
    const corners = [
      { x: bbox.minX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.maxY },
      { x: bbox.minX, y: bbox.maxY }
    ];

    for (const corner of corners) {
      if (suggestions.length >= targetCount - existing.length) break;

      const hasNearbyPoint = dxfPoints.some(p =>
        calculateDistance(p, corner) < 20
      );

      if (!hasNearbyPoint) {
        suggestions.push(corner);
      }
    }

    // Suggest center point if space
    if (suggestions.length < targetCount - existing.length) {
      const center = {
        x: (bbox.minX + bbox.maxX) / 2,
        y: (bbox.minY + bbox.maxY) / 2
      };

      const hasNearbyCenterPoint = dxfPoints.some(p =>
        calculateDistance(p, center) < 30
      );

      if (!hasNearbyCenterPoint) {
        suggestions.push(center);
      }
    }

    return suggestions;
  }

  // ========================================================================
  // PERSISTENCE & IMPORT/EXPORT
  // ========================================================================

  /**
   * Export control points για persistence
   */
  exportControlPoints(): GeoControlPoint[] {
    return this.getAllControlPoints();
  }

  /**
   * Import control points από saved data
   */
  importControlPoints(points: GeoControlPoint[]): void {
    this.clearControlPoints();

    for (const point of points) {
      this.controlPoints.set(point.id, point);
    }

    // Update next ID to avoid conflicts
    const maxId = Math.max(
      ...points
        .map(p => p.id)
        .filter(id => id.startsWith('GCP_'))
        .map(id => parseInt(id.substring(4)))
        .filter(num => !isNaN(num)),
      0
    );
    this.nextId = maxId + 1;
  }

  /**
   * Save to localStorage
   */
  saveToLocalStorage(key: string = 'geo-canvas-control-points'): void {
    const data = {
      points: this.exportControlPoints(),
      nextId: this.nextId,
      timestamp: nowISO()
    };

    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Load from localStorage
   */
  loadFromLocalStorage(key: string = 'geo-canvas-control-points'): boolean {
    const stored = localStorage.getItem(key);
    if (!stored) return false;

    const data = safeJsonParse<{ points?: GeoControlPoint[]; nextId?: number }>(stored, null as unknown as { points?: GeoControlPoint[]; nextId?: number });
    if (data === null) {
      console.error('Failed to load control points from localStorage: invalid JSON');
      return false;
    }
    this.importControlPoints(data.points || []);
    this.nextId = data.nextId || 1;
    return true;
  }

  // ========================================================================
  // EVENT SYSTEM
  // ========================================================================

  /**
   * Add event listener
   */
  addEventListener(listener: ControlPointEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: ControlPointEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(event: ControlPointEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in control point event listener:', error);
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export default ControlPointManager;
