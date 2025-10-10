/**
 * CONTROL POINT REPOSITORY
 * Geo-Alert System - Phase 4: Spatial Data Persistence Layer
 *
 * Enterprise repository για ground control points management με:
 * - CRUD operations για geo_control_points table
 * - Spatial queries και proximity search
 * - Accuracy-based filtering
 * - Usage tracking και analytics
 */

import type { DatabaseManager, DatabaseTransaction } from '../connection/DatabaseManager';
import { databaseManager } from '../connection/DatabaseManager';

// ============================================================================
// CONTROL POINT DATA TYPES
// ============================================================================

export interface GeoControlPoint {
  id: string;
  projectId: string;
  name?: string;
  description?: string;

  // DXF local coordinates
  dxfX: number;
  dxfY: number;
  dxfZ?: number;

  // Geographic coordinates (WGS84)
  geoPoint: {
    lng: number;
    lat: number;
    alt?: number;
  };

  // Accuracy and quality
  accuracyMeters: number;
  accuracySource?: string;

  // Point classification
  pointType: 'control' | 'check' | 'tie';
  isActive: boolean;

  // Usage statistics
  usageCount: number;
  lastUsedAt?: Date;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateControlPointParams {
  projectId: string;
  name?: string;
  description?: string;
  dxfX: number;
  dxfY: number;
  dxfZ?: number;
  geoPoint: {
    lng: number;
    lat: number;
    alt?: number;
  };
  accuracyMeters: number;
  accuracySource?: string;
  pointType?: 'control' | 'check' | 'tie';
}

export interface UpdateControlPointParams {
  name?: string;
  description?: string;
  dxfX?: number;
  dxfY?: number;
  dxfZ?: number;
  geoPoint?: {
    lng: number;
    lat: number;
    alt?: number;
  };
  accuracyMeters?: number;
  accuracySource?: string;
  pointType?: 'control' | 'check' | 'tie';
  isActive?: boolean;
}

export interface ControlPointQueryOptions {
  projectId?: string;
  pointType?: 'control' | 'check' | 'tie';
  isActive?: boolean;
  accuracyRange?: {
    min?: number;
    max?: number;
  };
  spatialFilter?: {
    // Proximity search (meters radius)
    near?: {
      lng: number;
      lat: number;
      radiusMeters: number;
    };
    // Bounding box search
    bbox?: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    };
  };
  usedAfter?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'created_at' | 'accuracy_meters' | 'usage_count';
  orderDirection?: 'ASC' | 'DESC';
}

export interface ControlPointStatistics {
  totalPoints: number;
  activePoints: number;
  inactivePoints: number;
  controlPoints: number;
  checkPoints: number;
  tiePoints: number;
  averageAccuracy: number;
  bestAccuracy: number;
  worstAccuracy: number;
  totalUsage: number;
  averageUsage: number;
}

export interface SpatialDistributionAnalysis {
  pointCount: number;
  spatialSpread: number; // Distance between furthest points (meters)
  averageDistance: number; // Average distance between consecutive points (meters)
  convexHullArea: number; // Area covered by control points (square meters)
  gdopScore: number; // Geometric Dilution of Precision (0-100)
  qualityLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNACCEPTABLE';
  recommendations: string[];
}

// ============================================================================
// CONTROL POINT REPOSITORY CLASS
// ============================================================================

export class ControlPointRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || databaseManager;
  }

  // ========================================================================
  // CREATE OPERATIONS
  // ========================================================================

  /**
   * Create new control point
   */
  async createControlPoint(params: CreateControlPointParams): Promise<GeoControlPoint> {
    const sql = `
      INSERT INTO geo_control_points (
        project_id, name, description, dxf_x, dxf_y, dxf_z,
        geo_point, accuracy_meters, accuracy_source, point_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        ST_SetSRID(ST_MakePoint($7, $8, $9), 4326),
        $10, $11, $12
      )
      RETURNING
        id, project_id, name, description, dxf_x, dxf_y, dxf_z,
        ST_X(geo_point) as geo_lng, ST_Y(geo_point) as geo_lat, ST_Z(geo_point) as geo_alt,
        accuracy_meters, accuracy_source, point_type, is_active,
        usage_count, last_used_at, created_at, updated_at
    `;

    const values = [
      params.projectId,
      params.name || null,
      params.description || null,
      params.dxfX,
      params.dxfY,
      params.dxfZ || null,
      params.geoPoint.lng,
      params.geoPoint.lat,
      params.geoPoint.alt || null,
      params.accuracyMeters,
      params.accuracySource || null,
      params.pointType || 'control'
    ];

    try {
      const result = await this.dbManager.query(sql, values);
      return this.mapRowToControlPoint(result.rows[0]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Control point με όνομα '${params.name}' υπάρχει ήδη στο project`);
      }
      throw new Error(`Failed to create control point: ${error}`);
    }
  }

  /**
   * Bulk create control points (transaction-safe)
   */
  async createControlPoints(points: CreateControlPointParams[]): Promise<GeoControlPoint[]> {
    return this.dbManager.transaction(async (trx) => {
      const createdPoints: GeoControlPoint[] = [];

      for (const point of points) {
        const sql = `
          INSERT INTO geo_control_points (
            project_id, name, description, dxf_x, dxf_y, dxf_z,
            geo_point, accuracy_meters, accuracy_source, point_type
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            ST_SetSRID(ST_MakePoint($7, $8, $9), 4326),
            $10, $11, $12
          )
          RETURNING
            id, project_id, name, description, dxf_x, dxf_y, dxf_z,
            ST_X(geo_point) as geo_lng, ST_Y(geo_point) as geo_lat, ST_Z(geo_point) as geo_alt,
            accuracy_meters, accuracy_source, point_type, is_active,
            usage_count, last_used_at, created_at, updated_at
        `;

        const values = [
          point.projectId,
          point.name || null,
          point.description || null,
          point.dxfX,
          point.dxfY,
          point.dxfZ || null,
          point.geoPoint.lng,
          point.geoPoint.lat,
          point.geoPoint.alt || null,
          point.accuracyMeters,
          point.accuracySource || null,
          point.pointType || 'control'
        ];

        const result = await trx.query(sql, values);
        createdPoints.push(this.mapRowToControlPoint(result.rows[0]));
      }

      return createdPoints;
    });
  }

  // ========================================================================
  // READ OPERATIONS
  // ========================================================================

  /**
   * Get control point by ID
   */
  async getControlPointById(id: string): Promise<GeoControlPoint | null> {
    const sql = `
      SELECT
        id, project_id, name, description, dxf_x, dxf_y, dxf_z,
        ST_X(geo_point) as geo_lng, ST_Y(geo_point) as geo_lat, ST_Z(geo_point) as geo_alt,
        accuracy_meters, accuracy_source, point_type, is_active,
        usage_count, last_used_at, created_at, updated_at
      FROM geo_control_points
      WHERE id = $1
    `;

    const result = await this.dbManager.query(sql, [id]);
    return result.rows.length > 0 ? this.mapRowToControlPoint(result.rows[0]) : null;
  }

  /**
   * Get control points by project ID
   */
  async getControlPointsByProject(projectId: string, activeOnly: boolean = true): Promise<GeoControlPoint[]> {
    let sql = `
      SELECT
        id, project_id, name, description, dxf_x, dxf_y, dxf_z,
        ST_X(geo_point) as geo_lng, ST_Y(geo_point) as geo_lat, ST_Z(geo_point) as geo_alt,
        accuracy_meters, accuracy_source, point_type, is_active,
        usage_count, last_used_at, created_at, updated_at
      FROM geo_control_points
      WHERE project_id = $1
    `;

    const params: unknown[] = [projectId];

    if (activeOnly) {
      sql += ` AND is_active = true`;
    }

    sql += ` ORDER BY created_at ASC`;

    const result = await this.dbManager.query(sql, params);
    return result.rows.map(row => this.mapRowToControlPoint(row));
  }

  /**
   * List control points με advanced filtering
   */
  async listControlPoints(options: ControlPointQueryOptions = {}): Promise<GeoControlPoint[]> {
    let sql = `
      SELECT
        id, project_id, name, description, dxf_x, dxf_y, dxf_z,
        ST_X(geo_point) as geo_lng, ST_Y(geo_point) as geo_lat, ST_Z(geo_point) as geo_alt,
        accuracy_meters, accuracy_source, point_type, is_active,
        usage_count, last_used_at, created_at, updated_at
    `;

    // Add distance calculation για proximity search
    if (options.spatialFilter?.near) {
      sql += `, ST_Distance(
        geo_point::geography,
        ST_SetSRID(ST_MakePoint($${this.getNextParamIndex(sql)}, $${this.getNextParamIndex(sql) + 1}), 4326)::geography
      ) as distance_meters`;
    }

    sql += ` FROM geo_control_points WHERE 1=1`;

    const params: unknown[] = [];
    let paramIndex = 1;

    // Apply filters
    if (options.projectId) {
      sql += ` AND project_id = $${paramIndex++}`;
      params.push(options.projectId);
    }

    if (options.pointType) {
      sql += ` AND point_type = $${paramIndex++}`;
      params.push(options.pointType);
    }

    if (options.isActive !== undefined) {
      sql += ` AND is_active = $${paramIndex++}`;
      params.push(options.isActive);
    }

    // Accuracy range filter
    if (options.accuracyRange?.min !== undefined) {
      sql += ` AND accuracy_meters >= $${paramIndex++}`;
      params.push(options.accuracyRange.min);
    }

    if (options.accuracyRange?.max !== undefined) {
      sql += ` AND accuracy_meters <= $${paramIndex++}`;
      params.push(options.accuracyRange.max);
    }

    // Spatial filters
    if (options.spatialFilter?.near) {
      const { lng, lat, radiusMeters } = options.spatialFilter.near;
      sql += ` AND ST_DWithin(
        geo_point::geography,
        ST_SetSRID(ST_MakePoint($${paramIndex++}, $${paramIndex++}), 4326)::geography,
        $${paramIndex++}
      )`;
      params.push(lng, lat, radiusMeters);
    }

    if (options.spatialFilter?.bbox) {
      const { minLng, minLat, maxLng, maxLat } = options.spatialFilter.bbox;
      sql += ` AND ST_Within(
        geo_point,
        ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326)
      )`;
      params.push(minLng, minLat, maxLng, maxLat);
    }

    // Usage date filter
    if (options.usedAfter) {
      sql += ` AND last_used_at >= $${paramIndex++}`;
      params.push(options.usedAfter);
    }

    // Apply ordering
    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'ASC';

    if (options.spatialFilter?.near) {
      sql += ` ORDER BY distance_meters ASC`;
    } else {
      sql += ` ORDER BY ${orderBy} ${orderDirection}`;
    }

    // Apply pagination
    if (options.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await this.dbManager.query(sql, params);
    return result.rows.map(row => this.mapRowToControlPoint(row));
  }

  // ========================================================================
  // UPDATE OPERATIONS
  // ========================================================================

  /**
   * Update control point
   */
  async updateControlPoint(id: string, params: UpdateControlPointParams): Promise<GeoControlPoint> {
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(params.name);
    }

    if (params.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(params.description);
    }

    if (params.dxfX !== undefined) {
      updateFields.push(`dxf_x = $${paramIndex++}`);
      values.push(params.dxfX);
    }

    if (params.dxfY !== undefined) {
      updateFields.push(`dxf_y = $${paramIndex++}`);
      values.push(params.dxfY);
    }

    if (params.dxfZ !== undefined) {
      updateFields.push(`dxf_z = $${paramIndex++}`);
      values.push(params.dxfZ);
    }

    if (params.geoPoint !== undefined) {
      updateFields.push(`geo_point = ST_SetSRID(ST_MakePoint($${paramIndex++}, $${paramIndex++}, $${paramIndex++}), 4326)`);
      values.push(params.geoPoint.lng, params.geoPoint.lat, params.geoPoint.alt || null);
    }

    if (params.accuracyMeters !== undefined) {
      updateFields.push(`accuracy_meters = $${paramIndex++}`);
      values.push(params.accuracyMeters);
    }

    if (params.accuracySource !== undefined) {
      updateFields.push(`accuracy_source = $${paramIndex++}`);
      values.push(params.accuracySource);
    }

    if (params.pointType !== undefined) {
      updateFields.push(`point_type = $${paramIndex++}`);
      values.push(params.pointType);
    }

    if (params.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(params.isActive);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `
      UPDATE geo_control_points
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING
        id, project_id, name, description, dxf_x, dxf_y, dxf_z,
        ST_X(geo_point) as geo_lng, ST_Y(geo_point) as geo_lat, ST_Z(geo_point) as geo_alt,
        accuracy_meters, accuracy_source, point_type, is_active,
        usage_count, last_used_at, created_at, updated_at
    `;

    const result = await this.dbManager.query(sql, values);
    if (result.rows.length === 0) {
      throw new Error(`Control point με ID '${id}' δεν βρέθηκε`);
    }

    return this.mapRowToControlPoint(result.rows[0]);
  }

  /**
   * Record usage of control point
   */
  async recordUsage(id: string): Promise<void> {
    const sql = `
      UPDATE geo_control_points
      SET
        usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.dbManager.query(sql, [id]);
  }

  // ========================================================================
  // DELETE OPERATIONS
  // ========================================================================

  /**
   * Delete control point
   */
  async deleteControlPoint(id: string): Promise<boolean> {
    const sql = `DELETE FROM geo_control_points WHERE id = $1`;
    const result = await this.dbManager.query(sql, [id]);
    return result.rowCount > 0;
  }

  /**
   * Soft delete (deactivate) control point
   */
  async deactivateControlPoint(id: string): Promise<boolean> {
    const sql = `
      UPDATE geo_control_points
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    const result = await this.dbManager.query(sql, [id]);
    return result.rowCount > 0;
  }

  // ========================================================================
  // ANALYTICS και SPATIAL ANALYSIS
  // ========================================================================

  /**
   * Get control point statistics για project
   */
  async getControlPointStatistics(projectId: string): Promise<ControlPointStatistics> {
    const sql = `
      SELECT
        COUNT(*) as total_points,
        COUNT(*) FILTER (WHERE is_active = true) as active_points,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_points,
        COUNT(*) FILTER (WHERE point_type = 'control') as control_points,
        COUNT(*) FILTER (WHERE point_type = 'check') as check_points,
        COUNT(*) FILTER (WHERE point_type = 'tie') as tie_points,
        AVG(accuracy_meters) as average_accuracy,
        MIN(accuracy_meters) as best_accuracy,
        MAX(accuracy_meters) as worst_accuracy,
        SUM(usage_count) as total_usage,
        AVG(usage_count) as average_usage
      FROM geo_control_points
      WHERE project_id = $1
    `;

    const result = await this.dbManager.query(sql, [projectId]);
    const row = result.rows[0];

    return {
      totalPoints: parseInt(row.total_points) || 0,
      activePoints: parseInt(row.active_points) || 0,
      inactivePoints: parseInt(row.inactive_points) || 0,
      controlPoints: parseInt(row.control_points) || 0,
      checkPoints: parseInt(row.check_points) || 0,
      tiePoints: parseInt(row.tie_points) || 0,
      averageAccuracy: parseFloat(row.average_accuracy) || 0,
      bestAccuracy: parseFloat(row.best_accuracy) || 0,
      worstAccuracy: parseFloat(row.worst_accuracy) || 0,
      totalUsage: parseInt(row.total_usage) || 0,
      averageUsage: parseFloat(row.average_usage) || 0
    };
  }

  /**
   * Analyze spatial distribution quality
   */
  async analyzeSpatialDistribution(projectId: string): Promise<SpatialDistributionAnalysis> {
    const sql = `
      WITH control_points AS (
        SELECT geo_point
        FROM geo_control_points
        WHERE project_id = $1 AND is_active = true AND point_type = 'control'
      ),
      distances AS (
        SELECT
          ST_Distance(a.geo_point::geography, b.geo_point::geography) as distance
        FROM control_points a
        CROSS JOIN control_points b
        WHERE a.geo_point != b.geo_point
      )
      SELECT
        (SELECT COUNT(*) FROM control_points) as point_count,
        COALESCE(MAX(distance), 0) as max_distance,
        COALESCE(AVG(distance), 0) as avg_distance,
        COALESCE(ST_Area(ST_ConvexHull(ST_Collect(geo_point))::geography), 0) as convex_hull_area
      FROM control_points
      CROSS JOIN distances
    `;

    const result = await this.dbManager.query(sql, [projectId]);
    const row = result.rows[0];

    const pointCount = parseInt(row.point_count) || 0;
    const spatialSpread = parseFloat(row.max_distance) || 0;
    const averageDistance = parseFloat(row.avg_distance) || 0;
    const convexHullArea = parseFloat(row.convex_hull_area) || 0;

    // Calculate GDOP score (simplified)
    let gdopScore = 0;
    let qualityLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNACCEPTABLE' = 'UNACCEPTABLE';
    const recommendations: string[] = [];

    if (pointCount >= 4) {
      // Basic GDOP calculation based on spatial distribution
      const spreadScore = Math.min(spatialSpread / 1000, 10); // Up to 10 points για 1km spread
      const areaScore = Math.min(convexHullArea / 1000000, 10); // Up to 10 points για 1km² area
      gdopScore = Math.min((spreadScore + areaScore) * 5, 100);

      if (gdopScore >= 80) qualityLevel = 'EXCELLENT';
      else if (gdopScore >= 60) qualityLevel = 'GOOD';
      else if (gdopScore >= 40) qualityLevel = 'FAIR';
      else if (gdopScore >= 20) qualityLevel = 'POOR';
    }

    // Generate recommendations
    if (pointCount < 3) {
      recommendations.push('Χρειάζονται τουλάχιστον 3 control points για transformation');
    } else if (pointCount < 4) {
      recommendations.push('Προτείνεται τουλάχιστον 4 control points για καλύτερη ακρίβεια');
    }

    if (spatialSpread < 100) {
      recommendations.push('Τα control points είναι πολύ κοντά - διασκορπίστε τα περισσότερο');
    }

    if (convexHullArea < 10000) { // Less than 100m x 100m
      recommendations.push('Η περιοχή κάλυψης είναι μικρή - προσθέστε points σε μεγαλύτερη έκταση');
    }

    return {
      pointCount,
      spatialSpread,
      averageDistance,
      convexHullArea,
      gdopScore,
      qualityLevel,
      recommendations
    };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Map database row to GeoControlPoint object
   */
  private mapRowToControlPoint(row: any): GeoControlPoint {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      dxfX: parseFloat(row.dxf_x),
      dxfY: parseFloat(row.dxf_y),
      dxfZ: row.dxf_z ? parseFloat(row.dxf_z) : undefined,
      geoPoint: {
        lng: parseFloat(row.geo_lng),
        lat: parseFloat(row.geo_lat),
        alt: row.geo_alt ? parseFloat(row.geo_alt) : undefined
      },
      accuracyMeters: parseFloat(row.accuracy_meters),
      accuracySource: row.accuracy_source,
      pointType: row.point_type,
      isActive: row.is_active,
      usageCount: parseInt(row.usage_count),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Get next parameter index για dynamic SQL building
   */
  private getNextParamIndex(sql: string): number {
    const matches = sql.match(/\$(\d+)/g);
    if (!matches) return 1;
    const maxIndex = Math.max(...matches.map(m => parseInt(m.substring(1))));
    return maxIndex + 1;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const controlPointRepository = new ControlPointRepository();
export default controlPointRepository;