/**
 * GEO-CANVAS CONFIGURATION
 * Enterprise-class configuration για το Geo-Alert σύστημα
 * Βασισμένο σε ISO standards και industry best practices
 */

import type { MapViewState, GeoServiceConfig } from '../types';

// ============================================================================
// MAP CONFIGURATION
// ============================================================================

/**
 * Default Map Settings (Greece-centered)
 */
export const DEFAULT_MAP_CONFIG: MapViewState = {
  center: {
    lng: 23.7275, // Athens, Greece longitude
    lat: 37.9755,  // Athens, Greece latitude
  },
  zoom: 8,
  bearing: 0,
  pitch: 0,
};

/**
 * Map Style Options για MapLibre GL JS
 */
export const MAP_STYLES = {
  // Open source styles
  OSM_BRIGHT: 'https://tiles.versatiles.org/assets/styles/osm-bright.json',
  OSM_LIBERTY: 'https://tiles.versatiles.org/assets/styles/osm-liberty.json',

  // Local development style
  DEVELOPMENT: {
    version: 8,
    name: 'Development Style',
    sources: {
      'osm': {
        type: 'raster',
        tiles: [
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm-raster',
        type: 'raster',
        source: 'osm'
      }
    ]
  }
} as const;

/**
 * Default map style για development
 */
export const DEFAULT_MAP_STYLE = MAP_STYLES.DEVELOPMENT;

// ============================================================================
// COORDINATE REFERENCE SYSTEMS
// ============================================================================

/**
 * Supported Coordinate Reference Systems
 * Κοινά CRS για την Ελλάδα και διεθνή χρήση
 */
export const SUPPORTED_CRS = {
  // Geographic CRS
  WGS84: 'EPSG:4326',           // World Geodetic System 1984
  WGS84_PSEUDO_MERCATOR: 'EPSG:3857', // Web Mercator (Google Maps)

  // Greek Grid Systems
  GGRS87: 'EPSG:2100',          // Greek Grid Reference System 1987
  HTRS07: 'EPSG:7844',          // Hellenic Terrestrial Reference System 2007

  // UTM Zones για Ελλάδα
  UTM_34N: 'EPSG:32634',        // UTM Zone 34N (Western Greece)
  UTM_35N: 'EPSG:32635',        // UTM Zone 35N (Eastern Greece)

  // Local Grid Systems
  HATT: 'EPSG:2121',            // Hellenic Academic Team Transform
} as const;

/**
 * Default CRS configuration
 */
export const DEFAULT_CRS_CONFIG = {
  source: SUPPORTED_CRS.WGS84,              // DXF files usually in local coordinates
  target: SUPPORTED_CRS.WGS84,              // MapLibre uses WGS84
  display: SUPPORTED_CRS.WGS84_PSEUDO_MERCATOR, // Web Mercator for display
} as const;

// ============================================================================
// TRANSFORMATION SETTINGS
// ============================================================================

/**
 * Transformation Accuracy Thresholds (σε meters)
 */
export const ACCURACY_THRESHOLDS = {
  EXCELLENT: 0.1,    // Survey-grade accuracy
  GOOD: 1.0,         // Engineering accuracy
  ACCEPTABLE: 5.0,   // Planning accuracy
  POOR: 20.0,        // Rough estimation
} as const;

/**
 * Default transformation settings
 */
export const TRANSFORMATION_CONFIG = {
  defaultAccuracy: ACCURACY_THRESHOLDS.GOOD,
  maxControlPoints: 20,
  minControlPoints: 3,

  // Transformation methods
  preferredMethod: 'affine' as const,
  fallbackMethod: 'polynomial' as const,

  // Validation settings
  maxRMSError: ACCURACY_THRESHOLDS.ACCEPTABLE,
  outlierThreshold: 3.0, // Standard deviations
} as const;

// ============================================================================
// ALERT SYSTEM CONFIGURATION
// ============================================================================

/**
 * Alert Engine Performance Settings
 */
export const ALERT_ENGINE_CONFIG = {
  // Processing limits
  maxActiveAlerts: 1000,
  maxRulesPerLayer: 50,
  batchProcessingSize: 100,

  // Spatial indexing
  spatialIndexType: 'rtree' as const,
  indexBucketSize: 16,

  // Real-time processing
  debounceInterval: 500,    // milliseconds
  maxProcessingTime: 5000,  // milliseconds

  // Cleanup settings
  alertRetentionDays: 30,
  maxHistoryRecords: 10000,
} as const;

/**
 * Default Alert Distances (σε meters)
 */
export const ALERT_DISTANCES = {
  IMMEDIATE: 0,      // Direct contact/intersection
  CLOSE: 5,          // Very close proximity
  NEAR: 25,          // Near proximity
  MODERATE: 100,     // Moderate distance
  FAR: 500,          // Far distance
  VERY_FAR: 2000,    // Very far distance
} as const;

// ============================================================================
// PERFORMANCE & OPTIMIZATION
// ============================================================================

/**
 * Viewport-based Loading Configuration
 */
export const VIEWPORT_CONFIG = {
  // Buffer around viewport για pre-loading
  bufferFactor: 1.5,        // Load 1.5x viewport area

  // Zoom-based detail levels
  zoomThresholds: {
    overview: 8,             // Show simplified geometries
    detailed: 12,            // Show full detail
    surveying: 16,           // Show all features + labels
  },

  // Feature limits per zoom level
  maxFeaturesPerTile: {
    overview: 100,
    detailed: 500,
    surveying: 2000,
  },
} as const;

/**
 * Spatial Query Optimization
 */
export const SPATIAL_QUERY_CONFIG = {
  // Index settings
  spatialIndexResolution: 12, // Geohash precision
  clusterThreshold: 100,      // Points to cluster
  simplificationTolerance: {
    overview: 10,             // meters
    detailed: 1,              // meters
    surveying: 0.1,           // meters
  },
} as const;

// ============================================================================
// DEVELOPMENT & DEBUGGING
// ============================================================================

/**
 * Development Configuration
 */
export const DEV_CONFIG = {
  // Logging levels
  logLevel: 'debug' as 'debug' | 'info' | 'warn' | 'error',

  // Debug features
  showBoundingBoxes: false,
  showControlPoints: true,
  showTransformationGrid: false,

  // Performance monitoring
  enablePerformanceMetrics: true,
  logSlowQueries: true,
  slowQueryThreshold: 1000, // milliseconds

  // Mock data για testing
  useMockData: false,
  mockDataDelay: 500,       // milliseconds
} as const;

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

/**
 * Default Service Configuration
 */
export const DEFAULT_SERVICE_CONFIG: GeoServiceConfig = {
  spatialDatabase: {
    host: 'localhost',
    port: 5432,
    database: 'geo_canvas',
    schema: 'public',
  },

  transformationEngine: {
    supportedCRS: Object.values(SUPPORTED_CRS),
    defaultCRS: SUPPORTED_CRS.WGS84,
    accuracyThreshold: ACCURACY_THRESHOLDS.GOOD,
  },

  alertEngine: {
    maxActiveAlerts: ALERT_ENGINE_CONFIG.maxActiveAlerts,
    batchProcessingSize: ALERT_ENGINE_CONFIG.batchProcessingSize,
    spatialIndexType: ALERT_ENGINE_CONFIG.spatialIndexType,
  },
};

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Feature Flags για progressive rollout
 */
export const FEATURE_FLAGS = {
  // Core features
  ENABLE_REAL_TIME_ALERTS: true,
  ENABLE_SPATIAL_INDEXING: true,
  ENABLE_TRANSFORMATION_ENGINE: true,

  // Advanced features
  ENABLE_CUSTOM_PROJECTIONS: false,
  ENABLE_3D_VISUALIZATION: false,
  ENABLE_TEMPORAL_QUERIES: false,

  // Experimental features
  ENABLE_AI_PREDICTIONS: false,
  ENABLE_CLOUD_PROCESSING: false,
  ENABLE_BLOCKCHAIN_AUDIT: false,
} as const;

// ============================================================================
// VALIDATION & CONSTRAINTS
// ============================================================================

/**
 * Data Validation Rules
 */
export const VALIDATION_RULES = {
  // Coordinate bounds για reasonable values
  coordinateBounds: {
    longitude: { min: -180, max: 180 },
    latitude: { min: -90, max: 90 },
    elevation: { min: -1000, max: 10000 }, // meters
  },

  // Entity constraints
  maxEntityNameLength: 255,
  maxEntityProperties: 50,
  maxGeometryComplexity: 10000, // vertices

  // Alert constraints
  maxAlertMessage: 1000,        // characters
  maxRulesPerUser: 100,
  maxNotificationEmails: 10,

  // File size limits
  maxDxfFileSize: 100 * 1024 * 1024, // 100MB
  maxGeoJSONSize: 50 * 1024 * 1024,  // 50MB
} as const;

// ============================================================================
// EXPORT DEFAULT CONFIGURATION
// ============================================================================

/**
 * Complete default configuration object
 */
export const GEO_CANVAS_CONFIG = {
  map: DEFAULT_MAP_CONFIG,
  mapStyle: DEFAULT_MAP_STYLE,
  crs: DEFAULT_CRS_CONFIG,
  transformation: TRANSFORMATION_CONFIG,
  alerts: ALERT_ENGINE_CONFIG,
  viewport: VIEWPORT_CONFIG,
  spatial: SPATIAL_QUERY_CONFIG,
  development: DEV_CONFIG,
  service: DEFAULT_SERVICE_CONFIG,
  features: FEATURE_FLAGS,
  validation: VALIDATION_RULES,
} as const;

export default GEO_CANVAS_CONFIG;