/**
 * 🔷 UNIVERSAL POLYGON TYPES
 *
 * Κεντρικές type definitions για όλα τα polygon συστήματα
 *
 * @module core/polygon-system/types
 */

/**
 * Universal point (works for both floor plan & geo coordinates)
 */
export interface PolygonPoint {
  /** X coordinate (or longitude) */
  x: number;

  /** Y coordinate (or latitude) */
  y: number;

  /** Point ID για tracking */
  id?: string;

  /** Point label */
  label?: string;
}

/**
 * Polygon types
 */
export type PolygonType =
  | 'simple'         // Απλό σχέδιο
  | 'georeferencing' // Control points για georeferencing
  | 'alert-zone'     // Alert zone definitions
  | 'real-estate'    // Real estate monitoring zones (Phase 2.5.2)
  | 'measurement'    // Μετρήσεις
  | 'annotation';    // Σχόλια

/**
 * Polygon styling
 */
export interface PolygonStyle {
  /** Stroke color */
  strokeColor: string;

  /** Fill color */
  fillColor: string;

  /** Stroke width */
  strokeWidth: number;

  /** Fill opacity (0-1) */
  fillOpacity: number;

  /** Stroke opacity (0-1) */
  strokeOpacity: number;

  /** Line dash pattern */
  strokeDash?: number[];

  /** Point radius (for vertices) */
  pointRadius?: number;

  /** Point color */
  pointColor?: string;
}

/**
 * Universal polygon interface
 */
export interface UniversalPolygon {
  /** Polygon ID */
  id: string;

  /** Polygon type */
  type: PolygonType;

  /** Points array */
  points: PolygonPoint[];

  /** Is polygon closed? */
  isClosed: boolean;

  /** Styling */
  style: PolygonStyle;

  /** Metadata */
  metadata?: {
    /** Creation timestamp */
    createdAt: Date;

    /** Last modified */
    modifiedAt: Date;

    /** Creator */
    createdBy?: string;

    /** Description */
    description?: string;

    /** Area (calculated) */
    area?: number;

    /** Perimeter (calculated) */
    perimeter?: number;

    /** Custom properties */
    properties?: Record<string, any>;
  };
}

/**
 * Polygon drawing state
 */
export interface PolygonDrawingState {
  /** Currently drawing? */
  isDrawing: boolean;

  /** Current polygon being drawn */
  currentPolygon: UniversalPolygon | null;

  /** Drawing mode */
  mode: PolygonType;

  /** Drawing style */
  style: PolygonStyle;

  /** Snap to grid? */
  snapToGrid: boolean;

  /** Snap tolerance */
  snapTolerance: number;
}

/**
 * Default styles για διαφορετικούς τύπους
 */
export const DEFAULT_POLYGON_STYLES: Record<PolygonType, PolygonStyle> = {
  simple: {
    strokeColor: '#3b82f6',
    fillColor: '#3b82f6',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#1d4ed8'
  },
  georeferencing: {
    strokeColor: '#f59e0b',
    fillColor: '#f59e0b',
    strokeWidth: 2,
    fillOpacity: 0.1,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#d97706'
  },
  'alert-zone': {
    strokeColor: '#ef4444',
    fillColor: '#ef4444',
    strokeWidth: 3,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#dc2626'
  },
  'real-estate': {
    strokeColor: '#06b6d4',
    fillColor: '#06b6d4',
    strokeWidth: 2,
    fillOpacity: 0.12,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#0891b2'
  },
  measurement: {
    strokeColor: '#10b981',
    fillColor: '#10b981',
    strokeWidth: 2,
    fillOpacity: 0.1,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#059669'
  },
  annotation: {
    strokeColor: '#8b5cf6',
    fillColor: '#8b5cf6',
    strokeWidth: 2,
    fillOpacity: 0.1,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#7c3aed'
  }
};

/**
 * Polygon validation result
 */
export interface PolygonValidationResult {
  /** Is valid? */
  isValid: boolean;

  /** Validation errors */
  errors: string[];

  /** Warnings */
  warnings: string[];

  /** Suggested fixes */
  suggestions: string[];
}

/**
 * Polygon export options
 */
export interface PolygonExportOptions {
  /** Export format */
  format: 'geojson' | 'svg' | 'dxf' | 'csv';

  /** Include metadata? */
  includeMetadata: boolean;

  /** Coordinate precision */
  precision: number;

  /** Custom properties to include */
  properties?: string[];
}

/**
 * Polygon import result
 */
export interface PolygonImportResult {
  /** Success flag */
  success: boolean;

  /** Imported polygons */
  polygons: UniversalPolygon[];

  /** Import errors */
  errors: string[];

  /** Import warnings */
  warnings: string[];

  /** Skipped items */
  skipped: number;
}

// ============================================================================
// REAL ESTATE MONITORING TYPES (Phase 2.5.2)
// ============================================================================

/**
 * Real estate polygon with alert settings
 */
export interface RealEstatePolygon extends UniversalPolygon {
  type: 'real-estate';
  alertSettings: {
    enabled: boolean;
    priceRange?: { min?: number; max?: number };
    propertyTypes?: string[];
    minSize?: number;
    maxSize?: number;
    priority: 1 | 2 | 3 | 4 | 5;
    includeExclude: 'include' | 'exclude';
  };
}

/**
 * Property location from real estate platforms
 */
export interface PropertyLocation {
  id: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  address: string;
  price?: number;
  size?: number;
  type?: string;
  url?: string;
  source: 'spitogatos' | 'xe' | 'remax' | 'other';
  scrapedAt: Date;
}

/**
 * Property match result
 */
export interface PropertyMatchResult {
  property: PropertyLocation;
  matchedPolygons: {
    polygon: RealEstatePolygon;
    confidence: number;
    distance: number;
  }[];
  shouldAlert: boolean;
  alertReason?: string;
}