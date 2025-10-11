/**
 * SPATIAL QUERY ENGINE
 * Geo-Alert System - Phase 4: Advanced PostGIS Spatial Queries
 *
 * Enterprise-class spatial query engine με:
 * - Complex geometric operations
 * - Spatial relationships analysis
 * - Performance-optimized queries
 * - GeoJSON integration
 * - Coordinate transformation support
 */

import type { DatabaseManager } from '../connection/DatabaseManager';
import { databaseManager } from '../connection/DatabaseManager';

// ============================================================================
// SPATIAL QUERY TYPES
// ============================================================================

export interface SpatialQueryOptions {
  // Coordinate reference system
  srid?: number;
  // Performance options
  useIndex?: boolean;
  tolerance?: number;
  // Output format
  outputFormat?: 'geojson' | 'wkt' | 'wkb' | 'coordinates';
}

export interface ProximitySearchParams {
  centerPoint: {
    lng: number;
    lat: number;
  };
  radiusMeters: number;
  projectId?: string;
  entityTypes?: string[];
  limit?: number;
}

export interface BoundingBoxParams {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  projectId?: string;
  entityTypes?: string[];
  limit?: number;
}

export interface GeospatialBufferParams {
  geometry: GeoJSON.Geometry;
  bufferMeters: number;
  segments?: number; // Number of segments για circle approximation
}

export interface SpatialIntersectionParams {
  geometry1: GeoJSON.Geometry;
  geometry2: GeoJSON.Geometry;
  tolerance?: number;
}

export interface SpatialRelationshipResult {
  intersects: boolean;
  contains: boolean;
  within: boolean;
  touches: boolean;
  crosses: boolean;
  overlaps: boolean;
  disjoint: boolean;
  distance: number; // In meters
}

export interface ClusterAnalysisParams {
  projectId: string;
  maxDistanceMeters: number;
  minPointsPerCluster: number;
  entityTypes?: string[];
}

export interface SpatialCluster {
  clusterId: number;
  centerPoint: {
    lng: number;
    lat: number;
  };
  entityCount: number;
  avgAccuracy: number;
  boundingBox: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  entities: Array<{
    id: string;
    type: string;
    distance: number;
  }>;
}

export interface ConvexHullResult {
  geometry: GeoJSON.Polygon;
  area: number; // Square meters
  perimeter: number; // Meters
  pointCount: number;
}

export interface GridAnalysisParams {
  bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  cellSizeMeters: number;
  projectId?: string;
}

export interface GridCell {
  cellId: string;
  bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  entityCount: number;
  controlPointCount: number;
  avgAccuracy: number;
  geometry: GeoJSON.Polygon;
}

// ============================================================================
// SPATIAL QUERY ENGINE CLASS
// ============================================================================

export class SpatialQueryEngine {
  private dbManager: DatabaseManager;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || databaseManager;
  }

  // ========================================================================
  // PROXIMITY και DISTANCE QUERIES
  // ========================================================================

  /**
   * Find entities within radius of a point
   */
  async proximitySearch(params: ProximitySearchParams): Promise<any[]> {
    let sql = `
      SELECT
        se.id,
        se.dxf_entity_type,
        se.dxf_layer,
        ST_AsGeoJSON(se.geo_geometry) as geometry,
        ST_Distance(
          se.geo_geometry::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as distance_meters
      FROM geo_spatial_entities se
      WHERE ST_DWithin(
        se.geo_geometry::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    `;

    const queryParams: unknown[] = [
      params.centerPoint.lng,
      params.centerPoint.lat,
      params.radiusMeters
    ];
    let paramIndex = 4;

    // Add project filter
    if (params.projectId) {
      sql += ` AND se.project_id = $${paramIndex++}`;
      queryParams.push(params.projectId);
    }

    // Add entity type filter
    if (params.entityTypes && params.entityTypes.length > 0) {
      sql += ` AND se.dxf_entity_type = ANY($${paramIndex++})`;
      queryParams.push(params.entityTypes);
    }

    sql += ` ORDER BY distance_meters ASC`;

    // Add limit
    if (params.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      queryParams.push(params.limit);
    }

    const result = await this.dbManager.query(sql, queryParams);
    return result.rows.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry),
      distance_meters: parseFloat(row.distance_meters)
    }));
  }

  /**
   * Find control points within radius
   */
  async findNearbyControlPoints(
    centerPoint: { lng: number; lat: number },
    radiusMeters: number,
    projectId?: string
  ): Promise<any[]> {
    let sql = `
      SELECT
        cp.id,
        cp.name,
        cp.description,
        cp.accuracy_meters,
        ST_X(cp.geo_point) as lng,
        ST_Y(cp.geo_point) as lat,
        ST_Distance(
          cp.geo_point::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as distance_meters
      FROM geo_control_points cp
      WHERE cp.is_active = true
        AND ST_DWithin(
          cp.geo_point::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
    `;

    const queryParams: unknown[] = [centerPoint.lng, centerPoint.lat, radiusMeters];

    if (projectId) {
      sql += ` AND cp.project_id = $4`;
      queryParams.push(projectId);
    }

    sql += ` ORDER BY distance_meters ASC`;

    const result = await this.dbManager.query(sql, queryParams);
    return result.rows.map(row => ({
      ...row,
      distance_meters: parseFloat(row.distance_meters),
      lng: parseFloat(row.lng),
      lat: parseFloat(row.lat)
    }));
  }

  // ========================================================================
  // BOUNDING BOX και AREA QUERIES
  // ========================================================================

  /**
   * Find entities within bounding box
   */
  async boundingBoxSearch(params: BoundingBoxParams): Promise<any[]> {
    let sql = `
      SELECT
        se.id,
        se.dxf_entity_type,
        se.dxf_layer,
        se.dxf_color,
        ST_AsGeoJSON(se.geo_geometry) as geometry,
        se.length_meters,
        se.area_square_meters
      FROM geo_spatial_entities se
      WHERE ST_Within(
        se.geo_geometry,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
    `;

    const queryParams: unknown[] = [
      params.minLng,
      params.minLat,
      params.maxLng,
      params.maxLat
    ];
    let paramIndex = 5;

    // Add project filter
    if (params.projectId) {
      sql += ` AND se.project_id = $${paramIndex++}`;
      queryParams.push(params.projectId);
    }

    // Add entity type filter
    if (params.entityTypes && params.entityTypes.length > 0) {
      sql += ` AND se.dxf_entity_type = ANY($${paramIndex++})`;
      queryParams.push(params.entityTypes);
    }

    sql += ` ORDER BY se.created_at DESC`;

    // Add limit
    if (params.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      queryParams.push(params.limit);
    }

    const result = await this.dbManager.query(sql, queryParams);
    return result.rows.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry)
    }));
  }

  // ========================================================================
  // GEOMETRIC OPERATIONS
  // ========================================================================

  /**
   * Create buffer around geometry
   */
  async createBuffer(params: GeospatialBufferParams): Promise<GeoJSON.Polygon> {
    const sql = `
      SELECT ST_AsGeoJSON(
        ST_Buffer(
          ST_GeomFromGeoJSON($1)::geography,
          $2,
          $3
        )::geometry
      ) as buffered_geometry
    `;

    const segments = params.segments || 32;
    const result = await this.dbManager.query(sql, [
      JSON.stringify(params.geometry),
      params.bufferMeters,
      segments
    ]);

    return JSON.parse(result.rows[0].buffered_geometry);
  }

  /**
   * Calculate intersection of two geometries
   */
  async calculateIntersection(params: SpatialIntersectionParams): Promise<GeoJSON.Geometry | null> {
    const sql = `
      SELECT ST_AsGeoJSON(
        ST_Intersection(
          ST_GeomFromGeoJSON($1),
          ST_GeomFromGeoJSON($2)
        )
      ) as intersection_geometry
    `;

    const result = await this.dbManager.query(sql, [
      JSON.stringify(params.geometry1),
      JSON.stringify(params.geometry2)
    ]);

    const intersectionGeom = result.rows[0]?.intersection_geometry;
    return intersectionGeom ? JSON.parse(intersectionGeom) : null;
  }

  /**
   * Analyze spatial relationship between two geometries
   */
  async analyzeSpatialRelationship(
    geometry1: GeoJSON.Geometry,
    geometry2: GeoJSON.Geometry
  ): Promise<SpatialRelationshipResult> {
    const sql = `
      WITH geoms AS (
        SELECT
          ST_GeomFromGeoJSON($1) as geom1,
          ST_GeomFromGeoJSON($2) as geom2
      )
      SELECT
        ST_Intersects(geom1, geom2) as intersects,
        ST_Contains(geom1, geom2) as contains,
        ST_Within(geom1, geom2) as within,
        ST_Touches(geom1, geom2) as touches,
        ST_Crosses(geom1, geom2) as crosses,
        ST_Overlaps(geom1, geom2) as overlaps,
        ST_Disjoint(geom1, geom2) as disjoint,
        ST_Distance(geom1::geography, geom2::geography) as distance
      FROM geoms
    `;

    const result = await this.dbManager.query(sql, [
      JSON.stringify(geometry1),
      JSON.stringify(geometry2)
    ]);

    const row = result.rows[0];
    return {
      intersects: row.intersects,
      contains: row.contains,
      within: row.within,
      touches: row.touches,
      crosses: row.crosses,
      overlaps: row.overlaps,
      disjoint: row.disjoint,
      distance: parseFloat(row.distance)
    };
  }

  // ========================================================================
  // CLUSTERING και DENSITY ANALYSIS
  // ========================================================================

  /**
   * Perform spatial clustering analysis
   */
  async performClusterAnalysis(params: ClusterAnalysisParams): Promise<SpatialCluster[]> {
    // Simplified clustering based on distance
    const sql = `
      WITH clustered_points AS (
        SELECT
          cp.id,
          cp.name,
          cp.accuracy_meters,
          cp.geo_point,
          ST_ClusterDBSCAN(cp.geo_point::geography, $2, 2) OVER () as cluster_id
        FROM geo_control_points cp
        WHERE cp.project_id = $1
          AND cp.is_active = true
      ),
      cluster_stats AS (
        SELECT
          cluster_id,
          COUNT(*) as point_count,
          ST_Centroid(ST_Collect(geo_point)) as center_point,
          AVG(accuracy_meters) as avg_accuracy,
          ST_Envelope(ST_Collect(geo_point)) as bbox
        FROM clustered_points
        WHERE cluster_id IS NOT NULL
        GROUP BY cluster_id
      )
      SELECT
        cs.cluster_id,
        cs.point_count,
        ST_X(cs.center_point) as center_lng,
        ST_Y(cs.center_point) as center_lat,
        cs.avg_accuracy,
        ST_XMin(cs.bbox) as min_lng,
        ST_YMin(cs.bbox) as min_lat,
        ST_XMax(cs.bbox) as max_lng,
        ST_YMax(cs.bbox) as max_lat,
        array_agg(cp.id) as entity_ids
      FROM cluster_stats cs
      JOIN clustered_points cp ON cs.cluster_id = cp.cluster_id
      GROUP BY cs.cluster_id, cs.point_count, cs.center_point, cs.avg_accuracy, cs.bbox
      ORDER BY cs.point_count DESC
    `;

    const result = await this.dbManager.query(sql, [
      params.projectId,
      params.maxDistanceMeters
    ]);

    return result.rows.map(row => ({
      clusterId: row.cluster_id,
      centerPoint: {
        lng: parseFloat(row.center_lng),
        lat: parseFloat(row.center_lat)
      },
      entityCount: parseInt(row.point_count),
      avgAccuracy: parseFloat(row.avg_accuracy),
      boundingBox: {
        minLng: parseFloat(row.min_lng),
        minLat: parseFloat(row.min_lat),
        maxLng: parseFloat(row.max_lng),
        maxLat: parseFloat(row.max_lat)
      },
      entities: row.entity_ids.map((id: string) => ({
        id,
        type: 'control_point',
        distance: 0 // TODO: Calculate individual distances
      }))
    }));
  }

  // ========================================================================
  // CONVEX HULL και AREA ANALYSIS
  // ========================================================================

  /**
   * Calculate convex hull of control points
   */
  async calculateConvexHull(projectId: string): Promise<ConvexHullResult> {
    const sql = `
      WITH control_points AS (
        SELECT geo_point
        FROM geo_control_points
        WHERE project_id = $1 AND is_active = true
      ),
      hull AS (
        SELECT
          ST_ConvexHull(ST_Collect(geo_point)) as hull_geom,
          COUNT(*) as point_count
        FROM control_points
      )
      SELECT
        ST_AsGeoJSON(hull_geom) as hull_geometry,
        ST_Area(hull_geom::geography) as area_sqm,
        ST_Perimeter(hull_geom::geography) as perimeter_m,
        point_count
      FROM hull
      WHERE hull_geom IS NOT NULL
    `;

    const result = await this.dbManager.query(sql, [projectId]);

    if (result.rows.length === 0) {
      throw new Error('Insufficient control points για convex hull calculation');
    }

    const row = result.rows[0];
    return {
      geometry: JSON.parse(row.hull_geometry),
      area: parseFloat(row.area_sqm),
      perimeter: parseFloat(row.perimeter_m),
      pointCount: parseInt(row.point_count)
    };
  }

  // ========================================================================
  // GRID ANALYSIS
  // ========================================================================

  /**
   * Perform spatial grid analysis
   */
  async performGridAnalysis(params: GridAnalysisParams): Promise<GridCell[]> {
    const sql = `
      WITH RECURSIVE grid AS (
        -- Calculate grid dimensions
        SELECT
          $1::float as min_lng,
          $2::float as min_lat,
          $3::float as max_lng,
          $4::float as max_lat,
          $5::float as cell_size_degrees
      ),
      grid_cells AS (
        SELECT
          i, j,
          min_lng + (i * cell_size_degrees) as cell_min_lng,
          min_lat + (j * cell_size_degrees) as cell_min_lat,
          min_lng + ((i + 1) * cell_size_degrees) as cell_max_lng,
          min_lat + ((j + 1) * cell_size_degrees) as cell_max_lat
        FROM grid,
        generate_series(0, FLOOR((max_lng - min_lng) / cell_size_degrees)::int) as i,
        generate_series(0, FLOOR((max_lat - min_lat) / cell_size_degrees)::int) as j
      ),
      cell_stats AS (
        SELECT
          gc.*,
          COALESCE(entity_count, 0) as entity_count,
          COALESCE(control_point_count, 0) as control_point_count,
          COALESCE(avg_accuracy, 0) as avg_accuracy
        FROM grid_cells gc
        LEFT JOIN (
          SELECT
            FLOOR((ST_X(se.geo_geometry) - $1) / $5) as i,
            FLOOR((ST_Y(se.geo_geometry) - $2) / $5) as j,
            COUNT(*) as entity_count
          FROM geo_spatial_entities se
          WHERE ($6 IS NULL OR se.project_id = $6)
            AND ST_Within(se.geo_geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
          GROUP BY i, j
        ) entities ON gc.i = entities.i AND gc.j = entities.j
        LEFT JOIN (
          SELECT
            FLOOR((ST_X(cp.geo_point) - $1) / $5) as i,
            FLOOR((ST_Y(cp.geo_point) - $2) / $5) as j,
            COUNT(*) as control_point_count,
            AVG(cp.accuracy_meters) as avg_accuracy
          FROM geo_control_points cp
          WHERE ($6 IS NULL OR cp.project_id = $6)
            AND cp.is_active = true
            AND ST_Within(cp.geo_point, ST_MakeEnvelope($1, $2, $3, $4, 4326))
          GROUP BY i, j
        ) control_points ON gc.i = control_points.i AND gc.j = control_points.j
      )
      SELECT
        CONCAT(i, '_', j) as cell_id,
        cell_min_lng, cell_min_lat, cell_max_lng, cell_max_lat,
        entity_count, control_point_count, avg_accuracy,
        ST_AsGeoJSON(ST_MakeEnvelope(cell_min_lng, cell_min_lat, cell_max_lng, cell_max_lat, 4326)) as cell_geometry
      FROM cell_stats
      WHERE entity_count > 0 OR control_point_count > 0
      ORDER BY i, j
    `;

    // Convert cell size από meters to degrees (approximate)
    const cellSizeDegrees = params.cellSizeMeters / 111320; // 1 degree ≈ 111.32 km

    const queryParams = [
      params.bounds.minLng,
      params.bounds.minLat,
      params.bounds.maxLng,
      params.bounds.maxLat,
      cellSizeDegrees,
      params.projectId || null
    ];

    const result = await this.dbManager.query(sql, queryParams);

    return result.rows.map(row => ({
      cellId: row.cell_id,
      bounds: {
        minLng: parseFloat(row.cell_min_lng),
        minLat: parseFloat(row.cell_min_lat),
        maxLng: parseFloat(row.cell_max_lng),
        maxLat: parseFloat(row.cell_max_lat)
      },
      entityCount: parseInt(row.entity_count),
      controlPointCount: parseInt(row.control_point_count),
      avgAccuracy: parseFloat(row.avg_accuracy),
      geometry: JSON.parse(row.cell_geometry)
    }));
  }

  // ========================================================================
  // COORDINATE TRANSFORMATION
  // ========================================================================

  /**
   * Transform coordinates between different CRS
   */
  async transformCoordinates(
    coordinates: { x: number; y: number; z?: number },
    fromSRID: number,
    toSRID: number
  ): Promise<{ x: number; y: number; z?: number }> {
    const sql = `
      SELECT
        ST_X(transformed) as x,
        ST_Y(transformed) as y,
        ST_Z(transformed) as z
      FROM (
        SELECT ST_Transform(
          ST_SetSRID(ST_MakePoint($1, $2, $3), $4),
          $5
        ) as transformed
      ) t
    `;

    const result = await this.dbManager.query(sql, [
      coordinates.x,
      coordinates.y,
      coordinates.z || null,
      fromSRID,
      toSRID
    ]);

    const row = result.rows[0];
    return {
      x: parseFloat(row.x),
      y: parseFloat(row.y),
      z: row.z ? parseFloat(row.z) : undefined
    };
  }

  // ========================================================================
  // UTILITY QUERIES
  // ========================================================================

  /**
   * Get available spatial reference systems
   */
  async getAvailableSRS(): Promise<Array<{ srid: number; auth_name: string; auth_srid: number; srtext: string }>> {
    const sql = `
      SELECT srid, auth_name, auth_srid, srtext
      FROM spatial_ref_sys
      WHERE srid IN (4326, 3857, 2100, 32634, 32635, 32636) -- Common Greek CRS
      ORDER BY srid
    `;

    const result = await this.dbManager.query(sql);
    return result.rows;
  }

  /**
   * Validate geometry
   */
  async validateGeometry(geometry: GeoJSON.Geometry): Promise<{ isValid: boolean; reason?: string }> {
    const sql = `
      SELECT
        ST_IsValid(ST_GeomFromGeoJSON($1)) as is_valid,
        ST_IsValidReason(ST_GeomFromGeoJSON($1)) as reason
    `;

    const result = await this.dbManager.query(sql, [JSON.stringify(geometry)]);
    const row = result.rows[0];

    return {
      isValid: row.is_valid,
      reason: row.is_valid ? undefined : row.reason
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const spatialQueryEngine = new SpatialQueryEngine();
export default spatialQueryEngine;