/**
 * 📐 FLOOR PLAN SYSTEM - TYPE DEFINITIONS
 *
 * Centralized type definitions για το Floor Plan System
 *
 * @module floor-plan-system/types
 */

/**
 * Supported floor plan formats
 */
export type FloorPlanFormat =
  | 'DXF'
  | 'DWG'
  | 'PDF'
  | 'PNG'
  | 'JPG'
  | 'TIFF'
  | 'UNKNOWN';

/**
 * GeoJSON FeatureCollection type
 */
export type GeoJSONFeatureCollection = GeoJSON.FeatureCollection;

/**
 * Parser result (base interface)
 */
export interface ParserResult {
  /** Parse success flag */
  success: boolean;

  /** Detected format */
  format: FloorPlanFormat;

  /** GeoJSON data (για vector formats) */
  geoJSON?: GeoJSONFeatureCollection;

  /** Bounding box (local coordinates) */
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };

  /** Layer names (για vector formats) */
  layers?: string[];

  /** Entity count (για vector formats) */
  entities?: number;

  /** Thumbnail preview (data URL) */
  thumbnail?: string;

  /** Parse errors */
  errors?: string[];

  /** Parse warnings */
  warnings?: string[];
}

/**
 * DXF-specific parser result
 */
export interface DxfParserResult extends ParserResult {
  format: 'DXF';
  geoJSON: GeoJSONFeatureCollection;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  layers: string[];
  entities: number;
  thumbnail: string;
}

/**
 * Image-specific parser result
 */
export interface ImageParserResult extends ParserResult {
  format: 'PNG' | 'JPG' | 'TIFF';
  metadata: ImageMetadata;
  imageUrl: string;
  thumbnail: string;
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: FloorPlanFormat;
  mimeType: string;
  size: number;
  aspectRatio: number;
  hasAlpha: boolean;
}

/**
 * Floor plan upload state
 */
export interface FloorPlanUploadState {
  /** Currently uploaded file */
  file: File | null;

  /** Parse result */
  result: ParserResult | null;

  /** Upload status */
  status: 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

  /** Error message */
  error: string | null;

  /** Upload progress (0-100) */
  progress: number;
}

/**
 * Georeferencing control point
 */
export interface ControlPoint {
  /** Point ID */
  id: string;

  /** DXF local coordinates */
  dxfCoordinates: {
    x: number;
    y: number;
  };

  /** GPS WGS84 coordinates */
  geoCoordinates: {
    lat: number;
    lng: number;
  };

  /** Point label */
  label?: string;
}

/**
 * Georeferencing transform state
 */
export interface GeoreferencingState {
  /** Control points */
  controlPoints: ControlPoint[];

  /** Is calibrated (at least 3 points) */
  isCalibrated: boolean;

  /** Transformation matrix (affine 2D) */
  transformMatrix?: number[][];

  /** Transform accuracy (RMSE in meters) */
  accuracy?: number;
}

// ===================================================================
// TRANSFORMATION CONSTANTS & TYPES
// ===================================================================

/**
 * Minimum control points required for transformation
 */
export const MIN_CONTROL_POINTS = 3;

/**
 * Transformation quality thresholds (RMS error in meters)
 */
export const TRANSFORMATION_QUALITY_THRESHOLDS = {
  excellent: 0.5,   // < 0.5m
  good: 2.0,        // < 2.0m
  fair: 5.0,        // < 5.0m
  // poor: >= 5.0m
} as const;

/**
 * Floor plan control point (for transformation)
 */
export interface FloorPlanControlPoint {
  /** Point ID */
  id: string;

  /** Floor plan coordinates */
  floor?: {
    x: number;
    y: number;
  };

  /** Geographic coordinates */
  geo?: {
    lng: number;
    lat: number;
  };

  /** Point label */
  label?: string;
}

/**
 * Affine transformation matrix (2D)
 */
export interface AffineTransformMatrix {
  /** X scale & rotation */
  a: number;
  /** Y skew */
  b: number;
  /** X translation */
  c: number;
  /** X skew */
  d: number;
  /** Y scale & rotation */
  e: number;
  /** Y translation */
  f: number;
}

/**
 * Transformation calculation result
 */
export interface TransformationResult {
  /** Success flag */
  success: boolean;

  /** Transformation matrix (if successful) */
  matrix?: AffineTransformMatrix;

  /** Error message (if failed) */
  error?: string;

  /** RMS error in meters (if successful) */
  rmsError?: number;

  /** Maximum error in meters (if successful) */
  maxError?: number;

  /** Mean error in meters (if successful) */
  meanError?: number;

  /** Quality grade (if successful) */
  quality?: 'excellent' | 'good' | 'fair' | 'poor';

  /** Individual residuals (if successful) */
  residuals?: number[];
}

/**
 * Transformation calculation options
 */
export interface TransformationOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Quality threshold override */
  qualityThresholds?: typeof TRANSFORMATION_QUALITY_THRESHOLDS;
}

/**
 * Coordinate transformer utility
 */
export interface CoordinateTransformer {
  /** Transform floor plan point → geo point */
  transformPoint: (x: number, y: number) => [number, number];

  /** Transform geo point → floor plan point */
  inverseTransformPoint: (lng: number, lat: number) => [number, number];

  /** Get transformation matrix */
  getMatrix: () => AffineTransformMatrix;

  /** Get transformation quality */
  getQuality: () => TransformationResult;
}
