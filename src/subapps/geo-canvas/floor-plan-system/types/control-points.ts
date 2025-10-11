/**
 * 📍 FLOOR PLAN CONTROL POINTS - TYPE DEFINITIONS
 *
 * Types για georeferencing control point system
 *
 * @module floor-plan-system/types/control-points
 */

/**
 * Floor plan local coordinate (DXF coordinate system)
 */
export interface FloorPlanCoordinate {
  /** X coordinate in local space (DXF units) */
  x: number;
  /** Y coordinate in local space (DXF units) */
  y: number;
}

/**
 * Geographic coordinate (WGS84)
 */
export interface GeoCoordinate {
  /** Longitude (WGS84) */
  lng: number;
  /** Latitude (WGS84) */
  lat: number;
}

/**
 * Control point για georeferencing
 *
 * Συνδέει ένα σημείο στην κάτοψη με ένα σημείο στο χάρτη
 */
export interface FloorPlanControlPoint {
  /** Unique ID */
  id: string;
  /** Floor plan coordinate (local DXF space) */
  floorPlan: FloorPlanCoordinate;
  /** Geographic coordinate (map) */
  geo: GeoCoordinate;
  /** User-provided label (optional) */
  label?: string;
  /** Accuracy estimate in meters (optional) */
  accuracy?: number;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Control point picking state
 */
export type ControlPointPickingState =
  | 'idle'              // Not picking
  | 'picking-floor'     // Waiting for user to click on floor plan
  | 'picking-geo'       // Waiting for user to click on map
  | 'complete';         // Point pair complete

/**
 * Control point picking mode
 */
export interface ControlPointPickingMode {
  /** Current picking state */
  state: ControlPointPickingState;
  /** Temporary floor plan coordinate (when state = 'picking-geo') */
  tempFloorPlan: FloorPlanCoordinate | null;
  /** Temporary geo coordinate (when state = 'picking-floor') */
  tempGeo: GeoCoordinate | null;
}
