/**
 * DXF GEO-TRANSFORMATION SERVICE
 * Enterprise-class transformation engine για DXF → Geographic coordinates
 * Βασισμένο σε OGC standards και GDAL transformation methods
 */

import type {
  DxfCoordinate,
  GeoCoordinate,
  GeoTransformMatrix,
  GeoreferenceInfo,
  GeoControlPoint
} from '../../types';

// Import existing DXF types
import type { SceneModel, AnySceneEntity } from '../../../dxf-viewer/types/scene';

// ============================================================================
// COORDINATE TRANSFORMATION ENGINE
// ============================================================================

/**
 * Core Transformation Service για DXF georeferencing
 * Υποστηρίζει Affine, Polynomial, και Thin Plate Spline transformations
 */
export class DxfGeoTransformService {
  private georeferenceInfo: GeoreferenceInfo | null = null;
  private isCalibrated = false;

  constructor() {
    // Service initialization
  }

  // ========================================================================
  // CALIBRATION & SETUP
  // ========================================================================

  /**
   * Δημιουργία georeferencing από control points
   */
  async calibrateTransformation(
    controlPoints: GeoControlPoint[],
    method: 'affine' | 'polynomial' | 'tps' = 'affine'
  ): Promise<GeoreferenceInfo> {
    if (controlPoints.length < 3) {
      throw new Error('Χρειάζονται τουλάχιστον 3 control points για georeferencing');
    }

    try {
      let transformMatrix: GeoTransformMatrix;
      let accuracy: number;

      switch (method) {
        case 'affine':
          ({ transformMatrix, accuracy } = this.calculateAffineTransformation(controlPoints));
          break;
        case 'polynomial':
          ({ transformMatrix, accuracy } = this.calculatePolynomialTransformation(controlPoints));
          break;
        case 'tps':
          ({ transformMatrix, accuracy } = this.calculateTPSTransformation(controlPoints));
          break;
        default:
          throw new Error(`Unsupported transformation method: ${method}`);
      }

      this.georeferenceInfo = {
        transformMatrix,
        sourceCRS: 'LOCAL',
        targetCRS: 'EPSG:4326', // WGS84
        controlPoints,
        accuracy,
        method
      };

      this.isCalibrated = true;

      return this.georeferenceInfo;
    } catch (error) {
      throw new Error(`Transformation calibration failed: ${error}`);
    }
  }

  /**
   * Load existing georeferencing από αποθηκευμένα data
   */
  loadGeoreferencing(georefInfo: GeoreferenceInfo): void {
    this.georeferenceInfo = georefInfo;
    this.isCalibrated = true;
  }

  // ========================================================================
  // COORDINATE TRANSFORMATIONS
  // ========================================================================

  /**
   * Transform single DXF coordinate → Geographic (WGS84)
   */
  transformDxfToGeo(dxfPoint: DxfCoordinate): GeoCoordinate {
    if (!this.isCalibrated || !this.georeferenceInfo) {
      throw new Error('Transformation not calibrated. Call calibrateTransformation() first.');
    }

    const matrix = this.georeferenceInfo.transformMatrix;

    // Affine transformation: [x', y'] = [a*x + b*y + e, c*x + d*y + f]
    const lng = matrix.a * dxfPoint.x + matrix.b * dxfPoint.y + matrix.e;
    const lat = matrix.c * dxfPoint.x + matrix.d * dxfPoint.y + matrix.f;

    return {
      lng,
      lat,
      alt: dxfPoint.z // Optional elevation passthrough
    };
  }

  /**
   * Transform Geographic → DXF coordinate (inverse)
   */
  transformGeoToDxf(geoPoint: GeoCoordinate): DxfCoordinate {
    if (!this.isCalibrated || !this.georeferenceInfo) {
      throw new Error('Transformation not calibrated');
    }

    const matrix = this.georeferenceInfo.transformMatrix;

    // Inverse affine transformation
    const det = matrix.a * matrix.d - matrix.b * matrix.c;
    if (Math.abs(det) < 1e-10) {
      throw new Error('Transformation matrix is singular (non-invertible)');
    }

    const x_offset = geoPoint.lng - matrix.e;
    const y_offset = geoPoint.lat - matrix.f;

    const x = (matrix.d * x_offset - matrix.b * y_offset) / det;
    const y = (-matrix.c * x_offset + matrix.a * y_offset) / det;

    return {
      x,
      y,
      z: geoPoint.alt
    };
  }

  /**
   * Batch transformation για multiple points
   */
  transformDxfBatch(dxfPoints: DxfCoordinate[]): GeoCoordinate[] {
    return dxfPoints.map(point => this.transformDxfToGeo(point));
  }

  // ========================================================================
  // DXF SCENE TRANSFORMATION
  // ========================================================================

  /**
   * Transform ολόκληρο DXF scene σε GeoJSON-compatible format
   */
  async transformSceneToGeoJSON(
    scene: SceneModel,
    options: {
      includeInvisible?: boolean;
      layerFilter?: string[];
      entityTypeFilter?: string[];
    } = {}
  ): Promise<GeoJSON.FeatureCollection> {
    if (!this.isCalibrated) {
      throw new Error('Cannot transform scene: transformation not calibrated');
    }

    const features: GeoJSON.Feature[] = [];

    for (const entity of scene.entities) {
      // Apply filters
      if (!options.includeInvisible && !entity.visible) continue;
      if (options.layerFilter && (!entity.layer || !options.layerFilter.includes(entity.layer))) continue;
      if (options.entityTypeFilter && !options.entityTypeFilter.includes(entity.type)) continue;

      try {
        const geoFeature = this.transformEntityToGeoJSON(entity);
        if (geoFeature) {
          features.push(geoFeature);
        }
      } catch (error) {
        console.warn(`Failed to transform entity ${entity.id}:`, error);
      }
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Transform individual DXF entity → GeoJSON feature
   */
  private transformEntityToGeoJSON(entity: AnySceneEntity): GeoJSON.Feature | null {
    const properties = {
      id: entity.id,
      type: entity.type,
      layer: entity.layer,
      color: entity.color,
      lineweight: entity.lineweight,
      visible: entity.visible,
      name: entity.name
    };

    switch (entity.type) {
      case 'line': {
        const startGeo = this.transformDxfToGeo(entity.start);
        const endGeo = this.transformDxfToGeo(entity.end);

        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [startGeo.lng, startGeo.lat],
              [endGeo.lng, endGeo.lat]
            ]
          },
          properties
        };
      }

      case 'polyline': {
        const geoVertices = entity.vertices.map(vertex => {
          const geo = this.transformDxfToGeo(vertex);
          return [geo.lng, geo.lat];
        });

        if (entity.closed && geoVertices.length > 2) {
          // Close the polygon
          geoVertices.push(geoVertices[0]);
          return {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [geoVertices]
            },
            properties
          };
        } else {
          return {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: geoVertices
            },
            properties
          };
        }
      }

      case 'circle': {
        const centerGeo = this.transformDxfToGeo(entity.center);

        // Create circle approximation με polygon (32 vertices)
        const vertices: number[][] = [];
        const numVertices = 32;

        for (let i = 0; i <= numVertices; i++) {
          const angle = (i / numVertices) * 2 * Math.PI;
          const x = entity.center.x + entity.radius * Math.cos(angle);
          const y = entity.center.y + entity.radius * Math.sin(angle);

          const geo = this.transformDxfToGeo({ x, y });
          vertices.push([geo.lng, geo.lat]);
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [vertices]
          },
          properties: {
            ...properties,
            centerLng: centerGeo.lng,
            centerLat: centerGeo.lat,
            radius: entity.radius
          }
        };
      }

      case 'text': {
        const positionGeo = this.transformDxfToGeo(entity.position);

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [positionGeo.lng, positionGeo.lat]
          },
          properties: {
            ...properties,
            text: entity.text,
            height: entity.height,
            rotation: entity.rotation
          }
        };
      }

      default:
        console.warn(`Unsupported entity type for GeoJSON conversion: ${entity.type}`);
        return null;
    }
  }

  // ========================================================================
  // TRANSFORMATION ALGORITHMS
  // ========================================================================

  /**
   * Calculate Affine Transformation Matrix από control points
   * Χρησιμοποιεί least squares method για best fit
   */
  private calculateAffineTransformation(
    controlPoints: GeoControlPoint[]
  ): { transformMatrix: GeoTransformMatrix; accuracy: number } {
    if (controlPoints.length < 3) {
      throw new Error('Affine transformation requires at least 3 control points');
    }

    // Setup matrices για least squares solution
    // [x'] = [a b e] [x]
    // [y']   [c d f] [y]
    //                 [1]

    const n = controlPoints.length;
    const A: number[][] = [];
    const BX: number[] = [];
    const BY: number[] = [];

    for (const cp of controlPoints) {
      A.push([cp.dxfPoint.x, cp.dxfPoint.y, 1]);
      BX.push(cp.geoPoint.lng);
      BY.push(cp.geoPoint.lat);
    }

    // Solve Ax = Bx και Ay = By
    const [a, b, e] = this.solveLeastSquares(A, BX);
    const [c, d, f] = this.solveLeastSquares(A, BY);

    const transformMatrix: GeoTransformMatrix = { a, b, c, d, e, f };

    // Calculate RMS error για accuracy assessment
    const accuracy = this.calculateRMSError(controlPoints, transformMatrix);

    return { transformMatrix, accuracy };
  }

  /**
   * Polynomial transformation (2nd order) - για complex distortions
   */
  private calculatePolynomialTransformation(
    controlPoints: GeoControlPoint[]
  ): { transformMatrix: GeoTransformMatrix; accuracy: number } {
    if (controlPoints.length < 6) {
      throw new Error('Polynomial transformation requires at least 6 control points');
    }

    // For now, fallback to affine
    // TODO: Implement full polynomial transformation
    return this.calculateAffineTransformation(controlPoints);
  }

  /**
   * Thin Plate Spline transformation - για local deformations
   */
  private calculateTPSTransformation(
    controlPoints: GeoControlPoint[]
  ): { transformMatrix: GeoTransformMatrix; accuracy: number } {
    if (controlPoints.length < 4) {
      throw new Error('TPS transformation requires at least 4 control points');
    }

    // For now, fallback to affine
    // TODO: Implement full TPS transformation
    return this.calculateAffineTransformation(controlPoints);
  }

  /**
   * Solve least squares: min ||Ax - b||²
   * Returns x = (A^T * A)^(-1) * A^T * b
   */
  private solveLeastSquares(A: number[][], b: number[]): number[] {
    const n = A.length; // rows
    const m = A[0].length; // columns

    // Calculate A^T * A
    const AtA: number[][] = Array(m).fill(0).map(() => Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        for (let k = 0; k < n; k++) {
          AtA[i][j] += A[k][i] * A[k][j];
        }
      }
    }

    // Calculate A^T * b
    const Atb: number[] = Array(m).fill(0);
    for (let i = 0; i < m; i++) {
      for (let k = 0; k < n; k++) {
        Atb[i] += A[k][i] * b[k];
      }
    }

    // Solve AtA * x = Atb (using Gaussian elimination)
    return this.gaussianElimination(AtA, Atb);
  }

  /**
   * Gaussian elimination για solving linear system
   */
  private gaussianElimination(A: number[][], b: number[]): number[] {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    // Back substitution
    const x: number[] = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }

    return x;
  }

  /**
   * Calculate Root Mean Square Error για accuracy validation
   */
  private calculateRMSError(
    controlPoints: GeoControlPoint[],
    matrix: GeoTransformMatrix
  ): number {
    let sumSquaredErrors = 0;

    for (const cp of controlPoints) {
      // Transform DXF point using calculated matrix
      const transformedLng = matrix.a * cp.dxfPoint.x + matrix.b * cp.dxfPoint.y + matrix.e;
      const transformedLat = matrix.c * cp.dxfPoint.x + matrix.d * cp.dxfPoint.y + matrix.f;

      // Calculate error
      const errorLng = transformedLng - cp.geoPoint.lng;
      const errorLat = transformedLat - cp.geoPoint.lat;

      sumSquaredErrors += errorLng * errorLng + errorLat * errorLat;
    }

    return Math.sqrt(sumSquaredErrors / controlPoints.length);
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get current transformation status
   */
  getTransformationStatus() {
    return {
      isCalibrated: this.isCalibrated,
      method: this.georeferenceInfo?.method,
      accuracy: this.georeferenceInfo?.accuracy,
      controlPointCount: this.georeferenceInfo?.controlPoints.length || 0,
      sourceCRS: this.georeferenceInfo?.sourceCRS,
      targetCRS: this.georeferenceInfo?.targetCRS
    };
  }

  /**
   * Validate transformation accuracy
   */
  validateAccuracy(threshold: number = 5.0): boolean {
    if (!this.georeferenceInfo) return false;
    return this.georeferenceInfo.accuracy <= threshold;
  }

  /**
   * Export georeferencing για persistence
   */
  exportGeoreferencing(): GeoreferenceInfo | null {
    return this.georeferenceInfo;
  }

  /**
   * Reset transformation
   */
  reset(): void {
    this.georeferenceInfo = null;
    this.isCalibrated = false;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global transformation service instance
 */
export const dxfGeoTransformService = new DxfGeoTransformService();

export default DxfGeoTransformService;
