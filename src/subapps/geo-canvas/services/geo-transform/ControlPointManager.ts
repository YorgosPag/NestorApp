/**
 * CONTROL POINT MANAGEMENT SERVICE
 * Enterprise-class διαχείριση Ground Control Points για DXF georeferencing
 * Βασισμένο σε photogrammetric και surveying standards
 */

import type {
  GeoControlPoint,
  DxfCoordinate,
  GeoCoordinate,
  GeoreferenceInfo,
  BoundingBox
} from '../../types';

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
    spatialDistribution: 'poor' | 'fair' | 'good' | 'excellent';
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
    const spatialDistribution = this.assessSpatialDistribution(points);
    let geometricDilution = this.calculateGeometricDilution(points);

    if (spatialDistribution === 'poor') {
      warnings.push('Κακή χωρική κατανομή control points - προσθέστε points στις γωνίες');
      recommendations.push('Τοποθετήστε control points στις 4 γωνίες της περιοχής');
    }

    if (geometricDilution > 2.0) {
      warnings.push('Υψηλή γεωμετρική αραίωση - βελτιώστε τη χωρική κατανομή');
    }

    // Clustering detection
    const clusters = this.detectClusters(points);
    if (clusters.length > 0) {
      warnings.push(`Βρέθηκαν ${clusters.length} clusters από κοντινά points - διασκορπίστε τα`);
    }

    // Coverage assessment
    const coverage = this.assessCoverage(points);
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

  /**
   * Assess spatial distribution quality
   */
  private assessSpatialDistribution(points: GeoControlPoint[]): 'poor' | 'fair' | 'good' | 'excellent' {
    if (points.length < 3) return 'poor';

    // Calculate bounding box
    const dxfPoints = points.map(p => p.dxfPoint);
    const bbox = this.calculateBoundingBox(dxfPoints);

    // Check corner coverage
    const corners = this.getCornerRegions(bbox);
    const cornersWithPoints = corners.filter(corner =>
      this.hasPointInRegion(dxfPoints, corner)
    ).length;

    // Check center coverage
    const hasCenterPoint = this.hasPointInRegion(dxfPoints, {
      minX: bbox.minX + (bbox.maxX - bbox.minX) * 0.25,
      maxX: bbox.minX + (bbox.maxX - bbox.minX) * 0.75,
      minY: bbox.minY + (bbox.maxY - bbox.minY) * 0.25,
      maxY: bbox.minY + (bbox.maxY - bbox.minY) * 0.75
    });

    if (cornersWithPoints >= 4 && hasCenterPoint) return 'excellent';
    if (cornersWithPoints >= 4) return 'good';
    if (cornersWithPoints >= 3) return 'fair';
    return 'poor';
  }

  /**
   * Calculate Geometric Dilution of Precision (GDOP)
   */
  private calculateGeometricDilution(points: GeoControlPoint[]): number {
    if (points.length < 3) return Infinity;

    // Simplified GDOP calculation based on point spread
    const dxfPoints = points.map(p => p.dxfPoint);
    const bbox = this.calculateBoundingBox(dxfPoints);

    const area = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
    const perimeter = 2 * ((bbox.maxX - bbox.minX) + (bbox.maxY - bbox.minY));

    if (area === 0) return Infinity;

    // Lower values indicate better geometric distribution
    return perimeter * perimeter / (4 * Math.PI * area);
  }

  /**
   * Detect point clusters
   */
  private detectClusters(points: GeoControlPoint[], threshold: number = 10): GeoControlPoint[][] {
    const clusters: GeoControlPoint[][] = [];
    const processed = new Set<string>();

    for (const point of points) {
      if (processed.has(point.id)) continue;

      const cluster = [point];
      processed.add(point.id);

      for (const other of points) {
        if (processed.has(other.id)) continue;

        const distance = this.calculateDistance(point.dxfPoint, other.dxfPoint);
        if (distance <= threshold) {
          cluster.push(other);
          processed.add(other.id);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Assess overall coverage of the area
   */
  private assessCoverage(points: GeoControlPoint[]): number {
    if (points.length < 3) return 0;

    const dxfPoints = points.map(p => p.dxfPoint);
    const bbox = this.calculateBoundingBox(dxfPoints);

    // Create grid και check coverage
    const gridSize = 10;
    let coveredCells = 0;
    const totalCells = gridSize * gridSize;

    const cellWidth = (bbox.maxX - bbox.minX) / gridSize;
    const cellHeight = (bbox.maxY - bbox.minY) / gridSize;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const cellBounds = {
          minX: bbox.minX + i * cellWidth,
          maxX: bbox.minX + (i + 1) * cellWidth,
          minY: bbox.minY + j * cellHeight,
          maxY: bbox.minY + (j + 1) * cellHeight
        };

        if (this.hasPointInRegion(dxfPoints, cellBounds)) {
          coveredCells++;
        }
      }
    }

    return coveredCells / totalCells;
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
    const bbox = this.calculateBoundingBox(dxfPoints);
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
        this.calculateDistance(p, corner) < 20
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
        this.calculateDistance(p, center) < 30
      );

      if (!hasNearbyCenterPoint) {
        suggestions.push(center);
      }
    }

    return suggestions;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Calculate distance μεταξύ δύο DXF points
   */
  private calculateDistance(p1: DxfCoordinate, p2: DxfCoordinate): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate bounding box για DXF points
   */
  private calculateBoundingBox(points: DxfCoordinate[]): {
    minX: number; maxX: number; minY: number; maxY: number;
  } {
    if (points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Get corner regions για spatial distribution assessment
   */
  private getCornerRegions(bbox: { minX: number; maxX: number; minY: number; maxY: number }) {
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const margin = Math.min(width, height) * 0.2; // 20% margin

    return [
      // Top-left
      { minX: bbox.minX, maxX: bbox.minX + margin, minY: bbox.maxY - margin, maxY: bbox.maxY },
      // Top-right
      { minX: bbox.maxX - margin, maxX: bbox.maxX, minY: bbox.maxY - margin, maxY: bbox.maxY },
      // Bottom-right
      { minX: bbox.maxX - margin, maxX: bbox.maxX, minY: bbox.minY, maxY: bbox.minY + margin },
      // Bottom-left
      { minX: bbox.minX, maxX: bbox.minX + margin, minY: bbox.minY, maxY: bbox.minY + margin }
    ];
  }

  /**
   * Check if region has any points
   */
  private hasPointInRegion(
    points: DxfCoordinate[],
    region: { minX: number; maxX: number; minY: number; maxY: number }
  ): boolean {
    return points.some(p =>
      p.x >= region.minX && p.x <= region.maxX &&
      p.y >= region.minY && p.y <= region.maxY
    );
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
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Load από localStorage
   */
  loadFromLocalStorage(key: string = 'geo-canvas-control-points'): boolean {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return false;

      const data = JSON.parse(stored);
      this.importControlPoints(data.points || []);
      this.nextId = data.nextId || 1;

      return true;
    } catch (error) {
      console.error('Failed to load control points από localStorage:', error);
      return false;
    }
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

/**
 * Global control point manager instance
 */
export const controlPointManager = new ControlPointManager();

export default ControlPointManager;