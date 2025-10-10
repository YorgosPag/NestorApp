/**
 * GEO-CANVAS TYPE DEFINITIONS
 * Enterprise-class types για το Geo-Alert σύστημα
 * Βασισμένο σε ISO 19107 (Spatial schema) και OGC standards
 */

// ============================================================================
// COORDINATE SYSTEMS & TRANSFORMATIONS
// ============================================================================

/**
 * DXF Coordinate System (Local Engineering Coordinates)
 * Χρησιμοποιείται από το DXF file format
 */
export interface DxfCoordinate {
  x: number;  // Local X coordinate (meters)
  y: number;  // Local Y coordinate (meters)
  z?: number; // Optional Z coordinate (elevation)
}

/**
 * Geographic Coordinate System (WGS84)
 * Longitude/Latitude για MapLibre GL JS
 */
export interface GeoCoordinate {
  lng: number; // Longitude (decimal degrees)
  lat: number; // Latitude (decimal degrees)
  alt?: number; // Optional altitude (meters above sea level)
}

/**
 * Projected Coordinate System (UTM, State Plane, etc.)
 * Για υψηλή ακρίβεια μετρήσεων
 */
export interface ProjectedCoordinate {
  x: number;    // Easting (meters)
  y: number;    // Northing (meters)
  zone: string; // UTM zone or projection name
  datum: string; // Coordinate datum (e.g., 'WGS84', 'NAD83')
}

// ============================================================================
// TRANSFORMATION MATRICES & GEOREFERENCING
// ============================================================================

/**
 * Affine Transformation Matrix για DXF → Geographic conversion
 * Βασισμένο σε OGC World File format
 */
export interface GeoTransformMatrix {
  a: number; // Scale factor for X direction
  b: number; // Rotation coefficient
  c: number; // Rotation coefficient
  d: number; // Scale factor for Y direction (usually negative)
  e: number; // Translation offset for X
  f: number; // Translation offset for Y
}

/**
 * Georeferencing Information
 * Πληροφορίες σύνδεσης DXF με γεωγραφικό σύστημα
 */
export interface GeoreferenceInfo {
  transformMatrix: GeoTransformMatrix;
  sourceCRS: string;    // Source Coordinate Reference System
  targetCRS: string;    // Target CRS (usually 'EPSG:4326' for WGS84)
  controlPoints: GeoControlPoint[];
  accuracy: number;     // RMS error in meters
  method: 'affine' | 'polynomial' | 'tps'; // Transformation method
}

/**
 * Ground Control Point για georeferencing calibration
 */
export interface GeoControlPoint {
  id: string;
  dxfPoint: DxfCoordinate;    // Point στο DXF coordinate system
  geoPoint: GeoCoordinate;    // Corresponding geographic point
  accuracy: number;           // Point accuracy σε meters
  description?: string;       // Optional description
}

// ============================================================================
// SPATIAL ENTITIES & GEOMETRY
// ============================================================================

/**
 * Spatial Entity Types για geo-processing
 */
export type SpatialEntityType =
  | 'building'
  | 'road'
  | 'utility_line'
  | 'property_boundary'
  | 'survey_point'
  | 'environmental_zone'
  | 'infrastructure';

/**
 * Spatial Entity με geographic properties
 */
export interface SpatialEntity {
  id: string;
  type: SpatialEntityType;
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
  bbox?: BoundingBox;
  metadata: {
    source: 'dxf' | 'external' | 'user_input';
    layerName?: string;
    originalId?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Spatial Bounding Box για viewport optimization
 */
export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// ============================================================================
// GEO-ALERT SYSTEM TYPES
// ============================================================================

/**
 * Alert Configuration Types
 */
export type AlertType =
  | 'proximity'      // Distance-based alerts
  | 'intersection'   // Geometric intersection alerts
  | 'contains'       // Containment alerts
  | 'buffer_zone'    // Buffer zone violation alerts
  | 'attribute'      // Attribute-based alerts
  | 'custom';        // Custom rule-based alerts

/**
 * Alert Priority Levels
 */
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Alert Status για tracking
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

/**
 * Geo-Alert Rule Definition
 */
export interface GeoAlertRule {
  id: string;
  name: string;
  description: string;
  type: AlertType;
  priority: AlertPriority;
  enabled: boolean;

  // Rule conditions
  conditions: {
    sourceLayer?: string;
    targetLayer?: string;
    distance?: number;           // For proximity alerts (meters)
    bufferDistance?: number;     // For buffer zone alerts (meters)
    attributeFilter?: string;    // SQL-like attribute filter
    customScript?: string;       // Custom JavaScript for complex rules
  };

  // Actions to take when alert triggers
  actions: {
    notification: boolean;
    highlight: boolean;
    log: boolean;
    webhook?: string;           // External webhook URL
    email?: string[];          // Email notification list
  };

  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    lastTriggered?: Date;
    triggerCount: number;
  };
}

/**
 * Active Alert Instance
 */
export interface GeoAlert {
  id: string;
  ruleId: string;
  status: AlertStatus;
  priority: AlertPriority;
  message: string;

  // Spatial context
  location: GeoCoordinate;
  affectedEntities: string[];  // Entity IDs
  triggerGeometry?: GeoJSONGeometry;

  // Metadata
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;

  // Additional context
  context: {
    distance?: number;          // For proximity alerts
    intersectionArea?: number;  // For intersection alerts
    attributeValues?: Record<string, any>;
  };
}

// ============================================================================
// MAP & VISUALIZATION TYPES
// ============================================================================

/**
 * Map Layer Configuration για MapLibre GL JS
 */
export interface GeoMapLayer {
  id: string;
  name: string;
  type: 'vector' | 'raster' | 'geojson';
  source: string;
  visible: boolean;
  opacity: number;
  minZoom: number;
  maxZoom: number;

  // Styling
  paint?: Record<string, any>;
  layout?: Record<string, any>;

  // Data source
  sourceData?: {
    type: 'geojson';
    data: GeoJSON.FeatureCollection;
  } | {
    type: 'vector';
    url: string;
    layers?: string[];
  };
}

/**
 * Map View State
 */
export interface MapViewState {
  center: GeoCoordinate;
  zoom: number;
  bearing: number;  // Map rotation in degrees
  pitch: number;    // Map tilt in degrees
  bounds?: BoundingBox;
}

// ============================================================================
// SERVICE & API TYPES
// ============================================================================

/**
 * Geo-Processing Service Configuration
 */
export interface GeoServiceConfig {
  spatialDatabase: {
    host: string;
    port: number;
    database: string;
    schema: string;
  };

  transformationEngine: {
    supportedCRS: string[];
    defaultCRS: string;
    accuracyThreshold: number; // meters
  };

  alertEngine: {
    maxActiveAlerts: number;
    batchProcessingSize: number;
    spatialIndexType: 'rtree' | 'quadtree' | 'geohash';
  };
}

/**
 * API Response Types
 */
export interface GeoApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    processingTime: number;
    recordCount?: number;
  };
}

// ============================================================================
// EXPORT COMMON GEOJSON TYPES
// ============================================================================

export type GeoJSONGeometry =
  | GeoJSON.Point
  | GeoJSON.LineString
  | GeoJSON.Polygon
  | GeoJSON.MultiPoint
  | GeoJSON.MultiLineString
  | GeoJSON.MultiPolygon
  | GeoJSON.GeometryCollection;

export type GeoJSONFeature = GeoJSON.Feature<GeoJSONGeometry>;
export type GeoJSONFeatureCollection = GeoJSON.FeatureCollection<GeoJSONGeometry>;

// ============================================================================
// RE-EXPORT COMPONENT TYPES
// ============================================================================

export * from './components';