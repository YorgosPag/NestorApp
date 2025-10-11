/**
 * 📊 FLOOR PLAN SYSTEM - TYPE DEFINITIONS
 *
 * Enterprise TypeScript types για Floor Plan System
 *
 * @module floor-plan-system/types
 */

// ============================================================================
// 📍 CONTROL POINTS (STEP 2.2)
// ============================================================================

export type {
  FloorPlanCoordinate,
  FloorPlanControlPoint,
  ControlPointPickingState,
  ControlPointPickingMode
} from './control-points';
export type { GeoCoordinate } from './control-points';

// ============================================================================
// 🔄 TRANSFORMATION (STEP 2.3)
// ============================================================================

export type {
  AffineTransformMatrix,
  TransformationResult,
  TransformationMethod,
  TransformationOptions,
  CoordinateTransformer
} from './transformation';
export { TRANSFORMATION_QUALITY_THRESHOLDS, MIN_CONTROL_POINTS } from './transformation';

// ============================================================================
// 🗺️ GEOGRAPHIC TYPES (Re-export από core)
// ============================================================================

/**
 * Geographic coordinate (WGS84)
 */
export interface GeoCoordinate {
  lng: number; // Longitude (-180 to 180)
  lat: number; // Latitude (-90 to 90)
  elevation?: number; // Elevation in meters
}

/**
 * DXF/CAD coordinate (local coordinate system)
 */
export interface DxfCoordinate {
  x: number;
  y: number;
  z?: number;
}

// ============================================================================
// 🏗️ FLOOR PLAN TYPES
// ============================================================================

/**
 * Supported floor plan file formats
 */
export type FloorPlanFormat = 'DXF' | 'PDF' | 'DWG' | 'PNG' | 'JPG' | 'TIFF';

/**
 * Floor plan file metadata
 */
export interface FloorPlanFile {
  id: string;
  name: string;
  format: FloorPlanFormat;
  size: number; // bytes
  uploadedAt: Date;
  file: File;
}

/**
 * Floor plan layer data
 */
export interface FloorPlan {
  id: string;
  file: FloorPlanFile;

  // Georeferencing data
  isGeoreferenced: boolean;
  controlPoints: GeoControlPoint[];
  transformMatrix?: GeoTransformMatrix;
  bounds?: GeographicBounds;

  // Rendering data
  imageUrl?: string; // For raster rendering
  geoJSON?: GeoJSON.FeatureCollection; // For vector rendering

  // Layer settings
  opacity: number; // 0-1
  visible: boolean;
  zIndex: number;

  // Metadata
  floor?: number; // Floor number
  building?: string; // Building name
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Geographic bounds (bounding box)
 */
export interface GeographicBounds {
  north: number; // Top latitude
  south: number; // Bottom latitude
  east: number; // Right longitude
  west: number; // Left longitude

  // Alternative: Corner coordinates για MapLibre Image Layer
  corners?: [
    [number, number], // Top-left [lng, lat]
    [number, number], // Top-right [lng, lat]
    [number, number], // Bottom-right [lng, lat]
    [number, number]  // Bottom-left [lng, lat]
  ];
}

// ============================================================================
// 🎯 GEOREFERENCING TYPES
// ============================================================================

/**
 * Control point για georeferencing
 */
export interface GeoControlPoint {
  id: string;

  // Coordinate pairs
  dxfCoordinate: DxfCoordinate; // Point στο DXF
  geoCoordinate: GeoCoordinate; // Corresponding GPS point

  // Quality metrics
  accuracy: number; // Estimated accuracy in meters
  confidence: number; // 0-1 confidence score

  // Metadata
  source: 'manual' | 'gps' | 'survey' | 'automatic';
  description?: string;
  timestamp: Date;
}

/**
 * Transformation matrix (affine transformation)
 */
export interface GeoTransformMatrix {
  // 2D Affine transformation: [x', y'] = [a*x + b*y + c, d*x + e*y + f]
  a: number; // X scale
  b: number; // Y skew
  c: number; // X translation
  d: number; // X rotation
  e: number; // Y scale
  f: number; // Y translation

  // Additional transformation data
  rotation: number; // Rotation angle in radians
  scale: { x: number; y: number }; // Scale factors
  translation: { x: number; y: number }; // Translation vector
}

/**
 * Transformation method
 */
export type TransformationMethod = 'affine' | 'polynomial' | 'tps';

/**
 * Georeferencing accuracy assessment
 */
export interface GeoreferencingAccuracy {
  rmsError: number; // Root Mean Square error (meters)
  maxError: number; // Maximum error (meters)
  minError: number; // Minimum error (meters)
  averageError: number; // Average error (meters)
  standardDeviation: number;
  confidence: number; // 0-1 overall confidence
  grade: 'A' | 'B' | 'C' | 'D' | 'F'; // Quality grade
}

// ============================================================================
// 🏠 PROPERTY TYPES
// ============================================================================

/**
 * Property type (apartment, studio, etc.)
 */
export type PropertyType =
  | 'studio'
  | 'apartment_1br'
  | 'apartment_2br'
  | 'apartment_3br'
  | 'apartment_4br'
  | 'penthouse'
  | 'maisonette'
  | 'loft'
  | 'office'
  | 'commercial'
  | 'storage'
  | 'parking'
  | 'common_area'
  | 'other';

/**
 * Property polygon data
 */
export interface PropertyPolygon {
  id: string;
  floorPlanId: string; // Reference to parent floor plan

  // Geometry
  polygon: GeoJSON.Polygon; // Geographic polygon
  area: number; // Area in square meters (calculated)
  perimeter: number; // Perimeter in meters

  // Property metadata
  propertyType: PropertyType;
  floor: number;
  unitNumber?: string; // e.g., "A101", "B205"

  // Ownership & Business data
  owner?: string;
  tenant?: string;
  price?: number; // Sale/rent price
  currency?: string; // EUR, USD, etc.
  status?: 'available' | 'sold' | 'rented' | 'reserved';

  // Additional metadata
  description?: string;
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 🎨 LAYER RENDERING TYPES
// ============================================================================

/**
 * Layer rendering mode
 */
export type LayerRenderMode = 'raster' | 'vector' | 'hybrid';

/**
 * Layer configuration
 */
export interface LayerConfig {
  id: string;
  type: LayerRenderMode;

  // Visibility & opacity
  visible: boolean;
  opacity: number; // 0-1
  zIndex: number;

  // Raster-specific
  imageUrl?: string;
  imageQuality?: 'low' | 'medium' | 'high';

  // Vector-specific
  geoJSON?: GeoJSON.FeatureCollection;
  styleFunction?: (feature: GeoJSON.Feature) => Record<string, any>;

  // Performance
  cacheEnabled?: boolean;
  simplificationTolerance?: number; // For vector simplification
}

// ============================================================================
// 📦 PARSER TYPES
// ============================================================================

/**
 * Parser result
 */
export interface ParserResult {
  success: boolean;
  format: FloorPlanFormat;

  // Parsed data
  imageUrl?: string; // For raster formats
  geoJSON?: GeoJSON.FeatureCollection; // For vector formats

  // Metadata
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  layers?: string[]; // DXF layer names
  entities?: number; // Number of entities parsed

  // Errors
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// 🔧 CONFIGURATION TYPES
// ============================================================================

/**
 * Floor Plan System configuration
 */
export interface FloorPlanSystemConfig {
  // Upload settings
  maxFileSize: number; // bytes
  supportedFormats: FloorPlanFormat[];

  // Georeferencing settings
  georeferencing: {
    minControlPoints: number;
    maxControlPoints: number;
    defaultMethod: TransformationMethod;
    accuracyThreshold: number; // meters
  };

  // Rendering settings
  rendering: {
    defaultOpacity: number;
    defaultZIndex: number;
    imageQuality: 'low' | 'medium' | 'high';
    vectorSimplification: boolean;
    cacheEnabled: boolean;
  };

  // Performance settings
  performance: {
    lazyLoading: boolean;
    maxConcurrentUploads: number;
    compressionEnabled: boolean;
  };
}

// ============================================================================
// 🎯 WORKFLOW TYPES
// ============================================================================

/**
 * Georeferencing workflow state
 */
export interface GeoreferencingWorkflowState {
  currentStep: number;
  totalSteps: number;

  // Control points collection
  controlPoints: GeoControlPoint[];
  minPointsReached: boolean;

  // Temporary state
  pendingDxfPoint?: DxfCoordinate;
  pendingGeoPoint?: GeoCoordinate;

  // Results
  isComplete: boolean;
  transformMatrix?: GeoTransformMatrix;
  accuracy?: GeoreferencingAccuracy;
}

/**
 * Floor plan upload workflow state
 */
export interface UploadWorkflowState {
  status: 'idle' | 'uploading' | 'parsing' | 'success' | 'error';
  progress: number; // 0-100
  file?: FloorPlanFile;
  error?: string;
}
