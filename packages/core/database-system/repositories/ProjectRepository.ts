/**
 * PROJECT REPOSITORY
 * Geo-Alert System - Phase 4: Spatial Data Persistence Layer
 *
 * Enterprise repository για DXF project management με:
 * - CRUD operations για geo_projects table
 * - Spatial bounds management
 * - Transformation parameters persistence
 * - Project-level analytics
 */

import type { DatabaseManager, DatabaseTransaction } from '../connection/DatabaseManager';
import { databaseManager } from '../connection/DatabaseManager';
import type * as GeoJSON from 'geojson';

// ============================================================================
// PROJECT DATA TYPES
// ============================================================================

export interface GeoProject {
  id: string;
  name: string;
  description?: string;

  // DXF file metadata
  dxfFilename?: string;
  dxfFileHash?: string;
  dxfFileSize?: number;

  // Coordinate reference systems
  sourceCrs: string;
  targetCrs: string;

  // Transformation parameters (6-parameter affine)
  transformA?: number;
  transformB?: number;
  transformC?: number;
  transformD?: number;
  transformE?: number;
  transformF?: number;

  // Transformation quality
  rmsError?: number;
  transformationMethod: string;
  isCalibrated: boolean;

  // Spatial bounds (GeoJSON Polygon)
  spatialBounds?: GeoJSON.Polygon;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreateProjectParams {
  name: string;
  description?: string;
  dxfFilename?: string;
  dxfFileHash?: string;
  dxfFileSize?: number;
  sourceCrs?: string;
  targetCrs?: string;
  createdBy?: string;
}

export interface UpdateProjectParams {
  name?: string;
  description?: string;
  dxfFilename?: string;
  dxfFileHash?: string;
  dxfFileSize?: number;
  sourceCrs?: string;
  targetCrs?: string;
}

export interface SetTransformationParams {
  transformA: number;
  transformB: number;
  transformC: number;
  transformD: number;
  transformE: number;
  transformF: number;
  rmsError: number;
  transformationMethod: string;
  spatialBounds?: GeoJSON.Polygon;
}

export interface ProjectQueryOptions {
  includeUncalibrated?: boolean;
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  spatialFilter?: GeoJSON.Polygon; // Projects που intersect με αυτό το polygon
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'created_at' | 'updated_at' | 'rms_error';
  orderDirection?: 'ASC' | 'DESC';
}

export interface ProjectStatistics {
  totalProjects: number;
  calibratedProjects: number;
  uncalibratedProjects: number;
  averageRmsError: number;
  bestRmsError: number;
  worstRmsError: number;
  totalDxfFiles: number;
  totalFileSize: number;
}

// ============================================================================
// DATABASE ROW INTERFACES - Query Result Types
// ============================================================================

/** Row type for project statistics */
interface ProjectStatisticsRow {
  total_projects: string;
  calibrated_projects: string;
  uncalibrated_projects: string;
  average_rms_error: string | null;
  best_rms_error: string | null;
  worst_rms_error: string | null;
  total_dxf_files: string;
  total_file_size: string | null;
}

/** Row type for project database row */
interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  dxf_filename: string | null;
  dxf_file_hash: string | null;
  dxf_file_size: number | null;
  source_crs: string;
  target_crs: string;
  transform_a: number | null;
  transform_b: number | null;
  transform_c: number | null;
  transform_d: number | null;
  transform_e: number | null;
  transform_f: number | null;
  rms_error: number | null;
  transformation_method: string;
  is_calibrated: boolean;
  spatial_bounds_geojson: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** Row type for count query */
interface CountRow {
  count: string;
}

// ============================================================================
// PROJECT REPOSITORY CLASS
// ============================================================================

export class ProjectRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || databaseManager;
  }

  // ========================================================================
  // CREATE OPERATIONS
  // ========================================================================

  /**
   * Create new DXF project
   */
  async createProject(params: CreateProjectParams): Promise<GeoProject> {
    const sql = `
      INSERT INTO geo_projects (
        name, description, dxf_filename, dxf_file_hash, dxf_file_size,
        source_crs, target_crs, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id, name, description, dxf_filename, dxf_file_hash, dxf_file_size,
        source_crs, target_crs, transform_a, transform_b, transform_c,
        transform_d, transform_e, transform_f, rms_error, transformation_method,
        is_calibrated, ST_AsGeoJSON(spatial_bounds) as spatial_bounds_geojson,
        created_at, updated_at, created_by
    `;

    const values = [
      params.name,
      params.description || null,
      params.dxfFilename || null,
      params.dxfFileHash || null,
      params.dxfFileSize || null,
      params.sourceCrs || 'LOCAL',
      params.targetCrs || 'EPSG:4326',
      params.createdBy || null
    ];

    try {
      const result = await this.dbManager.query(sql, values);
      return this.mapRowToProject(result.rows[0] as ProjectRow);
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Project με όνομα '${params.name}' υπάρχει ήδη`);
      }
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  // ========================================================================
  // READ OPERATIONS
  // ========================================================================

  /**
   * Get project by ID
   */
  async getProjectById(id: string): Promise<GeoProject | null> {
    const sql = `
      SELECT
        id, name, description, dxf_filename, dxf_file_hash, dxf_file_size,
        source_crs, target_crs, transform_a, transform_b, transform_c,
        transform_d, transform_e, transform_f, rms_error, transformation_method,
        is_calibrated, ST_AsGeoJSON(spatial_bounds) as spatial_bounds_geojson,
        created_at, updated_at, created_by
      FROM geo_projects
      WHERE id = $1
    `;

    const result = await this.dbManager.query(sql, [id]);
    return result.rows.length > 0 ? this.mapRowToProject(result.rows[0] as ProjectRow) : null;
  }

  /**
   * Get project by name
   */
  async getProjectByName(name: string): Promise<GeoProject | null> {
    const sql = `
      SELECT
        id, name, description, dxf_filename, dxf_file_hash, dxf_file_size,
        source_crs, target_crs, transform_a, transform_b, transform_c,
        transform_d, transform_e, transform_f, rms_error, transformation_method,
        is_calibrated, ST_AsGeoJSON(spatial_bounds) as spatial_bounds_geojson,
        created_at, updated_at, created_by
      FROM geo_projects
      WHERE name = $1
    `;

    const result = await this.dbManager.query(sql, [name]);
    return result.rows.length > 0 ? this.mapRowToProject(result.rows[0] as ProjectRow) : null;
  }

  /**
   * List projects με advanced filtering
   */
  async listProjects(options: ProjectQueryOptions = {}): Promise<GeoProject[]> {
    let sql = `
      SELECT
        id, name, description, dxf_filename, dxf_file_hash, dxf_file_size,
        source_crs, target_crs, transform_a, transform_b, transform_c,
        transform_d, transform_e, transform_f, rms_error, transformation_method,
        is_calibrated, ST_AsGeoJSON(spatial_bounds) as spatial_bounds_geojson,
        created_at, updated_at, created_by
      FROM geo_projects
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    // Apply filters
    if (!options.includeUncalibrated) {
      sql += ` AND is_calibrated = true`;
    }

    if (options.createdBy) {
      sql += ` AND created_by = $${paramIndex++}`;
      params.push(options.createdBy);
    }

    if (options.createdAfter) {
      sql += ` AND created_at >= $${paramIndex++}`;
      params.push(options.createdAfter);
    }

    if (options.createdBefore) {
      sql += ` AND created_at <= $${paramIndex++}`;
      params.push(options.createdBefore);
    }

    if (options.spatialFilter) {
      sql += ` AND ST_Intersects(spatial_bounds, ST_GeomFromGeoJSON($${paramIndex++}))`;
      params.push(JSON.stringify(options.spatialFilter));
    }

    // Apply ordering
    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'DESC';
    sql += ` ORDER BY ${orderBy} ${orderDirection}`;

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
    return (result.rows as ProjectRow[]).map(row => this.mapRowToProject(row));
  }

  // ========================================================================
  // UPDATE OPERATIONS
  // ========================================================================

  /**
   * Update project basic information
   */
  async updateProject(id: string, params: UpdateProjectParams): Promise<GeoProject> {
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

    if (params.dxfFilename !== undefined) {
      updateFields.push(`dxf_filename = $${paramIndex++}`);
      values.push(params.dxfFilename);
    }

    if (params.dxfFileHash !== undefined) {
      updateFields.push(`dxf_file_hash = $${paramIndex++}`);
      values.push(params.dxfFileHash);
    }

    if (params.dxfFileSize !== undefined) {
      updateFields.push(`dxf_file_size = $${paramIndex++}`);
      values.push(params.dxfFileSize);
    }

    if (params.sourceCrs !== undefined) {
      updateFields.push(`source_crs = $${paramIndex++}`);
      values.push(params.sourceCrs);
    }

    if (params.targetCrs !== undefined) {
      updateFields.push(`target_crs = $${paramIndex++}`);
      values.push(params.targetCrs);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `
      UPDATE geo_projects
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING
        id, name, description, dxf_filename, dxf_file_hash, dxf_file_size,
        source_crs, target_crs, transform_a, transform_b, transform_c,
        transform_d, transform_e, transform_f, rms_error, transformation_method,
        is_calibrated, ST_AsGeoJSON(spatial_bounds) as spatial_bounds_geojson,
        created_at, updated_at, created_by
    `;

    const result = await this.dbManager.query(sql, values);
    if (result.rows.length === 0) {
      throw new Error(`Project με ID '${id}' δεν βρέθηκε`);
    }

    return this.mapRowToProject(result.rows[0] as ProjectRow);
  }

  /**
   * Set transformation parameters και calibrate project
   */
  async setTransformation(id: string, params: SetTransformationParams): Promise<GeoProject> {
    const sql = `
      UPDATE geo_projects
      SET
        transform_a = $2,
        transform_b = $3,
        transform_c = $4,
        transform_d = $5,
        transform_e = $6,
        transform_f = $7,
        rms_error = $8,
        transformation_method = $9,
        is_calibrated = true,
        spatial_bounds = CASE WHEN $10 IS NOT NULL THEN ST_GeomFromGeoJSON($10) ELSE spatial_bounds END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING
        id, name, description, dxf_filename, dxf_file_hash, dxf_file_size,
        source_crs, target_crs, transform_a, transform_b, transform_c,
        transform_d, transform_e, transform_f, rms_error, transformation_method,
        is_calibrated, ST_AsGeoJSON(spatial_bounds) as spatial_bounds_geojson,
        created_at, updated_at, created_by
    `;

    const values = [
      id,
      params.transformA,
      params.transformB,
      params.transformC,
      params.transformD,
      params.transformE,
      params.transformF,
      params.rmsError,
      params.transformationMethod,
      params.spatialBounds ? JSON.stringify(params.spatialBounds) : null
    ];

    const result = await this.dbManager.query(sql, values);
    if (result.rows.length === 0) {
      throw new Error(`Project με ID '${id}' δεν βρέθηκε`);
    }

    return this.mapRowToProject(result.rows[0] as ProjectRow);
  }

  // ========================================================================
  // DELETE OPERATIONS
  // ========================================================================

  /**
   * Delete project (cascades to control points και entities)
   */
  async deleteProject(id: string): Promise<boolean> {
    const sql = `DELETE FROM geo_projects WHERE id = $1`;
    const result = await this.dbManager.query(sql, [id]);
    return result.rowCount > 0;
  }

  // ========================================================================
  // ANALYTICS και STATISTICS
  // ========================================================================

  /**
   * Get project statistics
   */
  async getProjectStatistics(): Promise<ProjectStatistics> {
    const sql = `
      SELECT
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE is_calibrated = true) as calibrated_projects,
        COUNT(*) FILTER (WHERE is_calibrated = false) as uncalibrated_projects,
        AVG(rms_error) FILTER (WHERE rms_error IS NOT NULL) as average_rms_error,
        MIN(rms_error) FILTER (WHERE rms_error IS NOT NULL) as best_rms_error,
        MAX(rms_error) FILTER (WHERE rms_error IS NOT NULL) as worst_rms_error,
        COUNT(*) FILTER (WHERE dxf_filename IS NOT NULL) as total_dxf_files,
        SUM(dxf_file_size) FILTER (WHERE dxf_file_size IS NOT NULL) as total_file_size
      FROM geo_projects
    `;

    const result = await this.dbManager.query(sql);
    const row = result.rows[0] as ProjectStatisticsRow;

    return {
      totalProjects: parseInt(row.total_projects) || 0,
      calibratedProjects: parseInt(row.calibrated_projects) || 0,
      uncalibratedProjects: parseInt(row.uncalibrated_projects) || 0,
      averageRmsError: row.average_rms_error ? parseFloat(row.average_rms_error) : 0,
      bestRmsError: row.best_rms_error ? parseFloat(row.best_rms_error) : 0,
      worstRmsError: row.worst_rms_error ? parseFloat(row.worst_rms_error) : 0,
      totalDxfFiles: parseInt(row.total_dxf_files) || 0,
      totalFileSize: row.total_file_size ? parseInt(row.total_file_size) : 0
    };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Map database row to GeoProject object
   */
  private mapRowToProject(row: ProjectRow): GeoProject {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      dxfFilename: row.dxf_filename ?? undefined,
      dxfFileHash: row.dxf_file_hash ?? undefined,
      dxfFileSize: row.dxf_file_size ?? undefined,
      sourceCrs: row.source_crs,
      targetCrs: row.target_crs,
      transformA: row.transform_a ?? undefined,
      transformB: row.transform_b ?? undefined,
      transformC: row.transform_c ?? undefined,
      transformD: row.transform_d ?? undefined,
      transformE: row.transform_e ?? undefined,
      transformF: row.transform_f ?? undefined,
      rmsError: row.rms_error ?? undefined,
      transformationMethod: row.transformation_method,
      isCalibrated: row.is_calibrated,
      spatialBounds: row.spatial_bounds_geojson ? JSON.parse(row.spatial_bounds_geojson) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined
    };
  }

  /**
   * Validate project name
   */
  async validateProjectName(name: string, excludeId?: string): Promise<boolean> {
    let sql = `SELECT COUNT(*) as count FROM geo_projects WHERE name = $1`;
    const params: unknown[] = [name];

    if (excludeId) {
      sql += ` AND id != $2`;
      params.push(excludeId);
    }

    const result = await this.dbManager.query(sql, params);
    const row = result.rows[0] as CountRow;
    return parseInt(row.count) === 0;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const projectRepository = new ProjectRepository();
export default projectRepository;