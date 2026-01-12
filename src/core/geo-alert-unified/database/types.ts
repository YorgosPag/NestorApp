/**
 * 🗄️ UNIFIED GEO-ALERT DATABASE TYPES
 *
 * TypeScript types extracted και unified από geo-canvas system
 * Optimized για Universal Polygon System integration
 *
 * @module core/geo-alert-unified/database/types
 */

// ============================================================================
// CORE GEOMETRY TYPES
// ============================================================================

export interface GeoPoint {
  lng: number;
  lat: number;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // GeoJSON format
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ============================================================================
// PROJECT MANAGEMENT
// ============================================================================

export interface GeoProject {
  // Primary identifiers
  id: string;
  name: string;
  description?: string;

  // DXF file metadata
  dxfFilename?: string;
  dxfFileHash?: string;
  dxfFileSize?: number;

  // Coordinate reference systems
  sourceCrs: string; // Default: 'LOCAL'
  targetCrs: string; // Default: 'EPSG:4326'

  // Transformation parameters (6-parameter affine)
  transformA: number; // Scale X
  transformB: number; // Skew X
  transformC: number; // Translate X
  transformD: number; // Skew Y
  transformE: number; // Scale Y
  transformF: number; // Translate Y

  // Quality metrics
  rmsError?: number;
  maxError?: number;
  confidenceScore?: number; // 0-1

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  version: number;
}

export interface CreateGeoProjectRequest {
  name: string;
  description?: string;
  dxfFilename?: string;
  sourceCrs?: string;
  targetCrs?: string;
  createdBy?: string;
}

// ============================================================================
// UNIVERSAL POLYGONS INTEGRATION
// ============================================================================

export interface UniversalPolygonRecord {
  // Primary identifiers
  id: string;
  projectId?: string;

  // Universal Polygon System fields
  polygonType: 'simple' | 'georeferencing' | 'alert-zone' | 'measurement' | 'annotation';
  name: string;
  description?: string;

  // Geometry
  geometry: GeoPolygon; // WGS84 coordinates
  dxfGeometry?: GeoPolygon; // Local DXF coordinates

  // Style information (από Universal Polygon System)
  strokeColor: string; // Hex color
  fillColor: string; // Hex color
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
  strokeDash?: number[]; // Dash pattern

  // Metadata
  isClosed: boolean;
  pointCount: number;
  areaSqm?: number; // Calculated area in square meters
  perimeterM?: number; // Calculated perimeter in meters

  // Quality metrics (από Universal System validation)
  qualityScore?: number; // 0-1 quality score
  validationErrors?: string[]; // Validation errors

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  version: number;
}

export interface CreateUniversalPolygonRequest {
  projectId?: string;
  polygonType: UniversalPolygonRecord['polygonType'];
  name: string;
  description?: string;
  geometry: GeoPolygon;
  dxfGeometry?: GeoPolygon;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeDash?: number[];
  createdBy?: string;
}

// ============================================================================
// POLYGON POINTS
// ============================================================================

export interface PolygonPointRecord {
  // Primary identifiers
  id: string;
  polygonId: string;

  // Point position και ordering
  pointOrder: number; // 0-based ordering

  // Coordinates
  geoPoint: GeoPoint; // WGS84 coordinates
  dxfPoint?: { x: number; y: number }; // Original DXF coordinates

  // Universal Polygon System fields
  pointId: string; // από Universal System
  label?: string; // Human readable label

  // Control point specific (για georeferencing)
  isControlPoint: boolean;
  geoAccuracy?: number; // ±meters accuracy
  sourceType?: 'manual' | 'gps' | 'survey';

  // Audit fields
  createdAt: Date;
  createdBy?: string;
}

export interface CreatePolygonPointRequest {
  polygonId: string;
  pointOrder: number;
  geoPoint: GeoPoint;
  dxfPoint?: { x: number; y: number };
  pointId: string;
  label?: string;
  isControlPoint?: boolean;
  geoAccuracy?: number;
  sourceType?: 'manual' | 'gps' | 'survey';
  createdBy?: string;
}

// ============================================================================
// ALERT ZONES
// ============================================================================

export interface AlertZone {
  // Primary identifiers
  id: string;
  polygonId: string;
  userId: string;

  // Alert configuration
  zoneName: string;
  alertType: string; // 'property_alert', 'construction_alert', etc.
  isActive: boolean;

  // Alert rules (simplified JSON for now)
  alertRules: AlertRules; // Alert conditions

  // Notification preferences
  notificationChannels: NotificationChannel[];
  notificationFrequency: 'immediate' | 'daily' | 'weekly';

  // Statistics
  alertsTriggered: number;
  lastAlertAt?: Date;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface AlertRules {
  // Basic alert conditions
  triggers: AlertTrigger[];
  conditions: AlertCondition[];
  filters?: AlertFilter[];
}

// 🏢 ENTERPRISE: Type-safe configuration value types
export type ConfigValue = string | number | boolean | null | ConfigValue[] | { [key: string]: ConfigValue };
export type AlertConfigRecord = Record<string, ConfigValue>;

// 🏢 ENTERPRISE: Type-safe condition value types
export type ConditionValue = string | number | boolean | Date | string[] | number[] | { min: number; max: number };

export interface AlertTrigger {
  type: 'point_entry' | 'polygon_overlap' | 'proximity' | 'custom';
  config: AlertConfigRecord;
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: ConditionValue;
  logicalOperator?: 'AND' | 'OR';
}

export interface AlertFilter {
  type: 'time_range' | 'user_type' | 'data_source' | 'custom';
  config: AlertConfigRecord;
}

export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook';

export interface CreateAlertZoneRequest {
  polygonId: string;
  userId: string;
  zoneName: string;
  alertType: string;
  alertRules: AlertRules;
  notificationChannels?: NotificationChannel[];
  notificationFrequency?: 'immediate' | 'daily' | 'weekly';
  createdBy?: string;
}

// ============================================================================
// ALERT EVENTS
// ============================================================================

// 🏢 ENTERPRISE: Type-safe event data
export type EventDataValue = string | number | boolean | null | EventDataValue[] | { [key: string]: EventDataValue };
export type EventDataRecord = Record<string, EventDataValue>;

export interface AlertEvent {
  // Primary identifiers
  id: string;
  alertZoneId: string;

  // Event details
  eventType: string;
  eventData: EventDataRecord; // Event specific data

  // Geographic context
  triggerLocation?: GeoPoint; // Where the alert was triggered
  triggerPolygon?: GeoPolygon; // Related polygon if applicable

  // Alert processing
  alertStatus: 'pending' | 'sent' | 'failed' | 'dismissed';
  processingStartedAt?: Date;
  processingCompletedAt?: Date;

  // Delivery tracking
  notificationResults?: NotificationResult[];

  // Audit fields
  createdAt: Date;
  createdBy?: string;
}

export interface NotificationResult {
  channel: NotificationChannel;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  errorMessage?: string;
  externalId?: string; // Provider-specific ID
}

export interface CreateAlertEventRequest {
  alertZoneId: string;
  eventType: string;
  eventData: EventDataRecord;
  triggerLocation?: GeoPoint;
  triggerPolygon?: GeoPolygon;
  createdBy?: string;
}

// ============================================================================
// DATABASE QUERY RESULTS
// ============================================================================

export interface PolygonWithPoints extends UniversalPolygonRecord {
  points: PolygonPointRecord[];
}

export interface ActiveAlertZone extends AlertZone {
  polygonName: string;
  polygonType: UniversalPolygonRecord['polygonType'];
  zoneGeometry: GeoPolygon;
  recentEventsCount: number;
}

export interface PointInZoneResult {
  zoneId: string;
  zoneName: string;
  alertType: string;
  distanceM: number;
}

export interface MultiplePointsInZonesResult {
  pointIndex: number;
  zoneId: string;
  zoneName: string;
  alertType: string;
}

// ============================================================================
// DATABASE CONNECTION TYPES
// ============================================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | 'require' | 'prefer';
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: QueryField[];
}

export interface QueryField {
  name: string;
  dataTypeID: number;
  dataTypeSize: number;
  dataTypeModifier: number;
  format: string;
}

export interface DatabaseHealthStatus {
  isHealthy: boolean;
  connectionCount: number;
  activeConnections: number;
  idleConnections: number;
  version?: string;
  lastChecked: Date;
  errors?: string[];
}

// ============================================================================
// SPATIAL QUERY TYPES
// ============================================================================

export interface SpatialQuery {
  type: 'intersects' | 'contains' | 'within' | 'overlaps' | 'touches' | 'crosses';
  geometry: GeoPolygon | GeoPoint;
  buffer?: number; // Buffer distance in meters
}

export interface SpatialQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  includePoints?: boolean;
  activeOnly?: boolean;
}

export interface SpatialQueryResult<T> {
  results: T[];
  totalCount: number;
  hasMore: boolean;
  executionTimeMs: number;
}

// ============================================================================
// NOTE: Types are exported directly via their definitions above
// No need για additional export block
// ============================================================================