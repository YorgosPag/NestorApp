/**
 * DATABASE ANALYTICS & REPORTING ENGINE
 * Geo-Alert System - Phase 4: Enterprise Analytics και Business Intelligence
 *
 * Comprehensive analytics engine με:
 * - Project performance metrics
 * - Spatial data quality assessment
 * - Transformation accuracy analysis
 * - Usage statistics και trends
 * - Custom report generation
 */

import type { DatabaseManager } from '../connection/DatabaseManager';
import { databaseManager } from '../connection/DatabaseManager';

// ============================================================================
// ANALYTICS DATA TYPES
// ============================================================================

export interface ProjectAnalytics {
  // Basic metrics
  totalProjects: number;
  calibratedProjects: number;
  uncalibratedProjects: number;

  // Temporal metrics
  projectsCreatedLastMonth: number;
  projectsCreatedLastWeek: number;
  mostActiveDay: string;

  // Quality metrics
  averageRmsError: number;
  bestProject: {
    id: string;
    name: string;
    rmsError: number;
  } | null;
  worstProject: {
    id: string;
    name: string;
    rmsError: number;
  } | null;

  // Size metrics
  totalDxfFiles: number;
  totalFileSize: number;
  averageFileSize: number;
  largestProject: {
    id: string;
    name: string;
    fileSize: number;
  } | null;
}

export interface ControlPointAnalytics {
  // Basic metrics
  totalControlPoints: number;
  activeControlPoints: number;
  inactiveControlPoints: number;

  // Type distribution
  controlPointsByType: {
    control: number;
    check: number;
    tie: number;
  };

  // Accuracy metrics
  accuracyDistribution: {
    excellent: number; // ≤0.5m
    good: number;      // ≤1.0m
    fair: number;      // ≤2.0m
    poor: number;      // ≤5.0m
    unacceptable: number; // >5.0m
  };

  averageAccuracy: number;
  bestAccuracy: number;
  worstAccuracy: number;

  // Usage metrics
  totalUsage: number;
  averageUsage: number;
  mostUsedPoint: {
    id: string;
    name: string;
    usageCount: number;
  } | null;

  // Temporal metrics
  pointsAddedLastMonth: number;
  pointsAddedLastWeek: number;
}

export interface SpatialDataAnalytics {
  // Entity metrics
  totalSpatialEntities: number;
  entitiesByType: Record<string, number>;
  entitiesByLayer: Record<string, number>;

  // Geometric metrics
  totalLength: number; // Sum of all linear features (meters)
  totalArea: number;   // Sum of all polygonal features (square meters)
  averageEntitySize: number;

  // Quality metrics
  validGeometries: number;
  invalidGeometries: number;
  transformationErrors: number;

  // Spatial distribution
  spatialExtent: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    centerLng: number;
    centerLat: number;
    spanLng: number;
    spanLat: number;
  };

  // Density analysis
  highDensityAreas: Array<{
    centerLng: number;
    centerLat: number;
    entityCount: number;
    radius: number;
  }>;
}

export interface AccuracyTrendAnalysis {
  // Time-series data
  dailyAccuracyTrends: Array<{
    date: string;
    averageAccuracy: number;
    pointCount: number;
    calibratedProjects: number;
  }>;

  // Improvement metrics
  accuracyImprovement: {
    overallTrend: 'improving' | 'declining' | 'stable';
    trendPercentage: number;
    bestMonth: string;
    worstMonth: string;
  };

  // Accuracy benchmarks
  benchmarkComparison: {
    asprsClassI: number;    // Percentage meeting ASPRS Class I (0.3m)
    asprsClassII: number;   // Percentage meeting ASPRS Class II (0.6m)
    asprsClassIII: number;  // Percentage meeting ASPRS Class III (1.2m)
    isoCadastral: number;   // Percentage meeting ISO cadastral standards (0.05-0.20m)
  };
}

export interface UsageStatistics {
  // User activity
  totalSessions: number;
  uniqueUsers: number;
  averageSessionDuration: number;

  // Feature usage
  mostUsedFeatures: Array<{
    feature: string;
    usageCount: number;
  }>;

  // Geographic distribution
  usageByRegion: Array<{
    region: string;
    projectCount: number;
    controlPointCount: number;
  }>;

  // Peak usage times
  peakUsageHours: Array<{
    hour: number;
    activityCount: number;
  }>;

  // Error analysis
  commonErrors: Array<{
    errorType: string;
    count: number;
    lastOccurred: Date;
  }>;
}

export interface CustomReportParams {
  reportType: 'project_summary' | 'accuracy_analysis' | 'spatial_coverage' | 'usage_report';
  projectIds?: string[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  includeInactive?: boolean;
  groupBy?: 'project' | 'date' | 'user' | 'accuracy_level';
  format?: 'json' | 'csv' | 'excel';
}

export interface CustomReportResult {
  reportId: string;
  reportType: string;
  generatedAt: Date;
  parameters: CustomReportParams;
  data: unknown[];
  summary: {
    totalRecords: number;
    dataQuality: number; // 0-100 score
    completeness: number; // 0-100 score
    recommendations: string[];
  };
}

// ============================================================================
// SQL RESULT ROW TYPES - Enterprise Type Safety for DB Queries
// ============================================================================

/** Project analytics SQL result row */
interface ProjectAnalyticsRow {
  total_projects: string;
  calibrated_projects: string;
  uncalibrated_projects: string;
  projects_last_month: string;
  projects_last_week: string;
  most_active_day: number | null;
  avg_rms_error: string;
  best_project_id: string | null;
  best_project_name: string | null;
  best_project_error: string;
  worst_project_id: string | null;
  worst_project_name: string | null;
  worst_project_error: string;
  total_dxf_files: string;
  total_file_size: string;
  avg_file_size: string;
  largest_project_id: string | null;
  largest_project_name: string | null;
  largest_project_size: string;
}

/** Control point analytics SQL result row */
interface ControlPointAnalyticsRow {
  total_control_points: string;
  active_points: string;
  inactive_points: string;
  control_count: string;
  check_count: string;
  tie_count: string;
  excellent_count: string;
  good_count: string;
  fair_count: string;
  poor_count: string;
  unacceptable_count: string;
  avg_accuracy: string;
  best_accuracy: string;
  worst_accuracy: string;
  points_last_month: string;
  points_last_week: string;
  most_active_project_id: string | null;
  most_active_project_name: string | null;
  most_active_point_count: string;
  asprs_class1: string;
  asprs_class2: string;
  asprs_class3: string;
  iso_cadastral: string;
}

/** Spatial analytics SQL result row */
interface SpatialAnalyticsRow {
  total_area: string;
  min_area: string;
  max_area: string;
  average_area: string;
  total_projects_with_bounds: string;
  projects_with_holes: string;
  avg_vertices_per_project: string;
  complexity_score: string;
}

/** Type distribution row */
interface TypeDistributionRow {
  dxf_entity_type: string;
  entity_count: string;
}

/** Layer distribution row */
interface LayerDistributionRow {
  layer_name: string;
  entity_count: string;
}

/** Density row */
interface DensityRow {
  center_lng: string;
  center_lat: string;
  entity_count: string;
  radius: string;
}

/** Generic row with indexable properties */
interface GenericAnalyticsRow {
  [key: string]: string | number | null;
}

// ============================================================================
// DATABASE ANALYTICS ENGINE CLASS
// ============================================================================

export class DatabaseAnalytics {
  private dbManager: DatabaseManager;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || databaseManager;
  }

  // ========================================================================
  // PROJECT ANALYTICS
  // ========================================================================

  /**
   * Get comprehensive project analytics
   */
  async getProjectAnalytics(): Promise<ProjectAnalytics> {
    const sql = `
      WITH project_stats AS (
        SELECT
          COUNT(*) as total_projects,
          COUNT(*) FILTER (WHERE is_calibrated = true) as calibrated_projects,
          COUNT(*) FILTER (WHERE is_calibrated = false) as uncalibrated_projects,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as projects_last_month,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as projects_last_week,
          AVG(rms_error) FILTER (WHERE rms_error IS NOT NULL) as avg_rms_error,
          MIN(rms_error) FILTER (WHERE rms_error IS NOT NULL) as best_rms_error,
          MAX(rms_error) FILTER (WHERE rms_error IS NOT NULL) as worst_rms_error,
          COUNT(*) FILTER (WHERE dxf_filename IS NOT NULL) as total_dxf_files,
          SUM(dxf_file_size) FILTER (WHERE dxf_file_size IS NOT NULL) as total_file_size,
          AVG(dxf_file_size) FILTER (WHERE dxf_file_size IS NOT NULL) as avg_file_size,
          MAX(dxf_file_size) FILTER (WHERE dxf_file_size IS NOT NULL) as max_file_size
        FROM geo_projects
      ),
      best_project AS (
        SELECT id, name, rms_error
        FROM geo_projects
        WHERE rms_error = (SELECT MIN(rms_error) FROM geo_projects WHERE rms_error IS NOT NULL)
        LIMIT 1
      ),
      worst_project AS (
        SELECT id, name, rms_error
        FROM geo_projects
        WHERE rms_error = (SELECT MAX(rms_error) FROM geo_projects WHERE rms_error IS NOT NULL)
        LIMIT 1
      ),
      largest_project AS (
        SELECT id, name, dxf_file_size
        FROM geo_projects
        WHERE dxf_file_size = (SELECT MAX(dxf_file_size) FROM geo_projects WHERE dxf_file_size IS NOT NULL)
        LIMIT 1
      ),
      daily_activity AS (
        SELECT
          EXTRACT(DOW FROM created_at) as day_of_week,
          COUNT(*) as project_count
        FROM geo_projects
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY EXTRACT(DOW FROM created_at)
        ORDER BY project_count DESC
        LIMIT 1
      )
      SELECT
        ps.*,
        bp.id as best_project_id, bp.name as best_project_name, bp.rms_error as best_project_error,
        wp.id as worst_project_id, wp.name as worst_project_name, wp.rms_error as worst_project_error,
        lp.id as largest_project_id, lp.name as largest_project_name, lp.dxf_file_size as largest_project_size,
        da.day_of_week as most_active_day
      FROM project_stats ps
      LEFT JOIN best_project bp ON true
      LEFT JOIN worst_project wp ON true
      LEFT JOIN largest_project lp ON true
      LEFT JOIN daily_activity da ON true
    `;

    const result = await this.dbManager.query(sql);
    const row = result.rows[0] as ProjectAnalyticsRow;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      totalProjects: parseInt(row.total_projects) || 0,
      calibratedProjects: parseInt(row.calibrated_projects) || 0,
      uncalibratedProjects: parseInt(row.uncalibrated_projects) || 0,
      projectsCreatedLastMonth: parseInt(row.projects_last_month) || 0,
      projectsCreatedLastWeek: parseInt(row.projects_last_week) || 0,
      mostActiveDay: row.most_active_day !== null ? dayNames[row.most_active_day] : 'No data',
      averageRmsError: parseFloat(row.avg_rms_error) || 0,
      bestProject: row.best_project_id ? {
        id: row.best_project_id,
        name: row.best_project_name || 'Unnamed',
        rmsError: parseFloat(row.best_project_error)
      } : null,
      worstProject: row.worst_project_id ? {
        id: row.worst_project_id,
        name: row.worst_project_name || 'Unnamed',
        rmsError: parseFloat(row.worst_project_error)
      } : null,
      totalDxfFiles: parseInt(row.total_dxf_files) || 0,
      totalFileSize: parseInt(row.total_file_size) || 0,
      averageFileSize: parseFloat(row.avg_file_size) || 0,
      largestProject: row.largest_project_id ? {
        id: row.largest_project_id,
        name: row.largest_project_name || 'Unnamed',
        fileSize: parseInt(row.largest_project_size)
      } : null
    };
  }

  // ========================================================================
  // CONTROL POINT ANALYTICS
  // ========================================================================

  /**
   * Get comprehensive control point analytics
   */
  async getControlPointAnalytics(): Promise<ControlPointAnalytics> {
    const sql = `
      WITH cp_stats AS (
        SELECT
          COUNT(*) as total_control_points,
          COUNT(*) FILTER (WHERE is_active = true) as active_control_points,
          COUNT(*) FILTER (WHERE is_active = false) as inactive_control_points,
          COUNT(*) FILTER (WHERE point_type = 'control') as control_type_count,
          COUNT(*) FILTER (WHERE point_type = 'check') as check_type_count,
          COUNT(*) FILTER (WHERE point_type = 'tie') as tie_type_count,
          COUNT(*) FILTER (WHERE accuracy_meters <= 0.5) as excellent_accuracy,
          COUNT(*) FILTER (WHERE accuracy_meters > 0.5 AND accuracy_meters <= 1.0) as good_accuracy,
          COUNT(*) FILTER (WHERE accuracy_meters > 1.0 AND accuracy_meters <= 2.0) as fair_accuracy,
          COUNT(*) FILTER (WHERE accuracy_meters > 2.0 AND accuracy_meters <= 5.0) as poor_accuracy,
          COUNT(*) FILTER (WHERE accuracy_meters > 5.0) as unacceptable_accuracy,
          AVG(accuracy_meters) as avg_accuracy,
          MIN(accuracy_meters) as best_accuracy,
          MAX(accuracy_meters) as worst_accuracy,
          SUM(usage_count) as total_usage,
          AVG(usage_count) as avg_usage,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as points_last_month,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as points_last_week
        FROM geo_control_points
      ),
      most_used AS (
        SELECT id, name, usage_count
        FROM geo_control_points
        WHERE usage_count = (SELECT MAX(usage_count) FROM geo_control_points)
        LIMIT 1
      )
      SELECT
        cps.*,
        mu.id as most_used_id, mu.name as most_used_name, mu.usage_count as most_used_count
      FROM cp_stats cps
      LEFT JOIN most_used mu ON true
    `;

    const result = await this.dbManager.query(sql);
    const row = result.rows[0] as GenericAnalyticsRow;

    return {
      totalControlPoints: parseInt(String(row.total_control_points)) || 0,
      activeControlPoints: parseInt(String(row.active_control_points)) || 0,
      inactiveControlPoints: parseInt(String(row.inactive_control_points)) || 0,
      controlPointsByType: {
        control: parseInt(String(row.control_type_count)) || 0,
        check: parseInt(String(row.check_type_count)) || 0,
        tie: parseInt(String(row.tie_type_count)) || 0
      },
      accuracyDistribution: {
        excellent: parseInt(String(row.excellent_accuracy)) || 0,
        good: parseInt(String(row.good_accuracy)) || 0,
        fair: parseInt(String(row.fair_accuracy)) || 0,
        poor: parseInt(String(row.poor_accuracy)) || 0,
        unacceptable: parseInt(String(row.unacceptable_accuracy)) || 0
      },
      averageAccuracy: parseFloat(String(row.avg_accuracy)) || 0,
      bestAccuracy: parseFloat(String(row.best_accuracy)) || 0,
      worstAccuracy: parseFloat(String(row.worst_accuracy)) || 0,
      totalUsage: parseInt(String(row.total_usage)) || 0,
      averageUsage: parseFloat(String(row.avg_usage)) || 0,
      mostUsedPoint: row.most_used_id ? {
        id: String(row.most_used_id),
        name: String(row.most_used_name) || 'Unnamed',
        usageCount: parseInt(String(row.most_used_count))
      } : null,
      pointsAddedLastMonth: parseInt(String(row.points_last_month)) || 0,
      pointsAddedLastWeek: parseInt(String(row.points_last_week)) || 0
    };
  }

  // ========================================================================
  // SPATIAL DATA ANALYTICS
  // ========================================================================

  /**
   * Get comprehensive spatial data analytics
   */
  async getSpatialDataAnalytics(): Promise<SpatialDataAnalytics> {
    const sql = `
      WITH entity_stats AS (
        SELECT
          COUNT(*) as total_spatial_entities,
          COUNT(*) FILTER (WHERE is_valid_geometry = true) as valid_geometries,
          COUNT(*) FILTER (WHERE is_valid_geometry = false) as invalid_geometries,
          COUNT(*) FILTER (WHERE transformation_error IS NOT NULL) as transformation_errors,
          SUM(length_meters) FILTER (WHERE length_meters IS NOT NULL) as total_length,
          SUM(area_square_meters) FILTER (WHERE area_square_meters IS NOT NULL) as total_area,
          AVG(COALESCE(length_meters, area_square_meters, 0)) as avg_entity_size
        FROM geo_spatial_entities
      ),
      entity_types AS (
        SELECT
          dxf_entity_type,
          COUNT(*) as entity_count
        FROM geo_spatial_entities
        GROUP BY dxf_entity_type
        ORDER BY entity_count DESC
      ),
      entity_layers AS (
        SELECT
          COALESCE(dxf_layer, 'Unknown') as layer_name,
          COUNT(*) as entity_count
        FROM geo_spatial_entities
        GROUP BY dxf_layer
        ORDER BY entity_count DESC
      ),
      spatial_extent AS (
        SELECT
          ST_XMin(extent) as min_lng,
          ST_YMin(extent) as min_lat,
          ST_XMax(extent) as max_lng,
          ST_YMax(extent) as max_lat,
          ST_X(ST_Centroid(extent)) as center_lng,
          ST_Y(ST_Centroid(extent)) as center_lat
        FROM (
          SELECT ST_Extent(geo_geometry) as extent
          FROM geo_spatial_entities
          WHERE geo_geometry IS NOT NULL
        ) e
      ),
      density_analysis AS (
        SELECT
          ST_X(cluster_center) as center_lng,
          ST_Y(cluster_center) as center_lat,
          cluster_count as entity_count,
          cluster_radius as radius
        FROM (
          SELECT
            ST_Centroid(ST_Collect(geo_geometry)) as cluster_center,
            COUNT(*) as cluster_count,
            AVG(ST_Distance(geo_geometry::geography, ST_Centroid(ST_Collect(geo_geometry))::geography)) as cluster_radius
          FROM geo_spatial_entities
          WHERE geo_geometry IS NOT NULL
          GROUP BY ST_SnapToGrid(geo_geometry, 0.01) -- Group by ~1km grid
          HAVING COUNT(*) >= 10 -- Only high-density areas
          ORDER BY cluster_count DESC
          LIMIT 5
        ) clusters
      )
      SELECT
        es.*,
        se.min_lng, se.min_lat, se.max_lng, se.max_lat, se.center_lng, se.center_lat,
        (se.max_lng - se.min_lng) as span_lng,
        (se.max_lat - se.min_lat) as span_lat
      FROM entity_stats es
      LEFT JOIN spatial_extent se ON true
    `;

    const result = await this.dbManager.query(sql);
    const row = result.rows[0] as GenericAnalyticsRow;

    // Get entity types
    const typesResult = await this.dbManager.query(`
      SELECT dxf_entity_type, COUNT(*) as entity_count
      FROM geo_spatial_entities
      GROUP BY dxf_entity_type
      ORDER BY entity_count DESC
    `);

    const entitiesByType: Record<string, number> = {};
    (typesResult.rows as TypeDistributionRow[]).forEach(typeRow => {
      entitiesByType[typeRow.dxf_entity_type] = parseInt(typeRow.entity_count);
    });

    // Get entity layers
    const layersResult = await this.dbManager.query(`
      SELECT COALESCE(dxf_layer, 'Unknown') as layer_name, COUNT(*) as entity_count
      FROM geo_spatial_entities
      GROUP BY dxf_layer
      ORDER BY entity_count DESC
    `);

    const entitiesByLayer: Record<string, number> = {};
    (layersResult.rows as LayerDistributionRow[]).forEach(layerRow => {
      entitiesByLayer[layerRow.layer_name] = parseInt(layerRow.entity_count);
    });

    // Get high-density areas
    const densityResult = await this.dbManager.query(`
      SELECT
        ST_X(cluster_center) as center_lng,
        ST_Y(cluster_center) as center_lat,
        cluster_count as entity_count,
        cluster_radius as radius
      FROM (
        SELECT
          ST_Centroid(ST_Collect(geo_geometry)) as cluster_center,
          COUNT(*) as cluster_count,
          AVG(ST_Distance(geo_geometry::geography, ST_Centroid(ST_Collect(geo_geometry))::geography)) as cluster_radius
        FROM geo_spatial_entities
        WHERE geo_geometry IS NOT NULL
        GROUP BY ST_SnapToGrid(geo_geometry, 0.01)
        HAVING COUNT(*) >= 10
        ORDER BY cluster_count DESC
        LIMIT 5
      ) clusters
    `);

    const highDensityAreas = (densityResult.rows as DensityRow[]).map(densityRow => ({
      centerLng: parseFloat(densityRow.center_lng),
      centerLat: parseFloat(densityRow.center_lat),
      entityCount: parseInt(densityRow.entity_count),
      radius: parseFloat(densityRow.radius)
    }));

    return {
      totalSpatialEntities: parseInt(String(row.total_spatial_entities)) || 0,
      entitiesByType,
      entitiesByLayer,
      totalLength: parseFloat(String(row.total_length)) || 0,
      totalArea: parseFloat(String(row.total_area)) || 0,
      averageEntitySize: parseFloat(String(row.avg_entity_size)) || 0,
      validGeometries: parseInt(String(row.valid_geometries)) || 0,
      invalidGeometries: parseInt(String(row.invalid_geometries)) || 0,
      transformationErrors: parseInt(String(row.transformation_errors)) || 0,
      spatialExtent: {
        minLng: parseFloat(String(row.min_lng)) || 0,
        minLat: parseFloat(String(row.min_lat)) || 0,
        maxLng: parseFloat(String(row.max_lng)) || 0,
        maxLat: parseFloat(String(row.max_lat)) || 0,
        centerLng: parseFloat(String(row.center_lng)) || 0,
        centerLat: parseFloat(String(row.center_lat)) || 0,
        spanLng: parseFloat(String(row.span_lng)) || 0,
        spanLat: parseFloat(String(row.span_lat)) || 0
      },
      highDensityAreas
    };
  }

  // ========================================================================
  // ACCURACY TREND ANALYSIS
  // ========================================================================

  /**
   * Analyze accuracy trends over time
   */
  async getAccuracyTrendAnalysis(): Promise<AccuracyTrendAnalysis> {
    // Daily accuracy trends
    const dailyTrendsResult = await this.dbManager.query(`
      SELECT
        DATE(cp.created_at) as date,
        AVG(cp.accuracy_meters) as avg_accuracy,
        COUNT(*) as point_count,
        COUNT(DISTINCT cp.project_id) as calibrated_projects
      FROM geo_control_points cp
      JOIN geo_projects p ON cp.project_id = p.id
      WHERE cp.created_at >= CURRENT_DATE - INTERVAL '90 days'
        AND cp.is_active = true
        AND p.is_calibrated = true
      GROUP BY DATE(cp.created_at)
      ORDER BY date ASC
    `);

    const dailyAccuracyTrends = (dailyTrendsResult.rows as GenericAnalyticsRow[]).map(row => ({
      date: String(row.date),
      averageAccuracy: parseFloat(String(row.avg_accuracy)),
      pointCount: parseInt(String(row.point_count)),
      calibratedProjects: parseInt(String(row.calibrated_projects))
    }));

    // Calculate trend
    let overallTrend: 'improving' | 'declining' | 'stable' = 'stable';
    let trendPercentage = 0;

    if (dailyAccuracyTrends.length >= 2) {
      const firstValue = dailyAccuracyTrends[0].averageAccuracy;
      const lastValue = dailyAccuracyTrends[dailyAccuracyTrends.length - 1].averageAccuracy;
      trendPercentage = ((lastValue - firstValue) / firstValue) * 100;

      if (trendPercentage < -5) overallTrend = 'improving'; // Lower accuracy is better
      else if (trendPercentage > 5) overallTrend = 'declining';
    }

    // Benchmark comparison
    const benchmarkResult = await this.dbManager.query(`
      SELECT
        COUNT(*) FILTER (WHERE accuracy_meters <= 0.3) * 100.0 / COUNT(*) as asprs_class_i,
        COUNT(*) FILTER (WHERE accuracy_meters <= 0.6) * 100.0 / COUNT(*) as asprs_class_ii,
        COUNT(*) FILTER (WHERE accuracy_meters <= 1.2) * 100.0 / COUNT(*) as asprs_class_iii,
        COUNT(*) FILTER (WHERE accuracy_meters <= 0.2) * 100.0 / COUNT(*) as iso_cadastral
      FROM geo_control_points
      WHERE is_active = true
    `);

    const benchmarkRow = benchmarkResult.rows[0] as GenericAnalyticsRow;

    return {
      dailyAccuracyTrends,
      accuracyImprovement: {
        overallTrend,
        trendPercentage,
        bestMonth: 'January', // TODO: Calculate actual best month
        worstMonth: 'March'   // TODO: Calculate actual worst month
      },
      benchmarkComparison: {
        asprsClassI: parseFloat(String(benchmarkRow.asprs_class_i)) || 0,
        asprsClassII: parseFloat(String(benchmarkRow.asprs_class_ii)) || 0,
        asprsClassIII: parseFloat(String(benchmarkRow.asprs_class_iii)) || 0,
        isoCadastral: parseFloat(String(benchmarkRow.iso_cadastral)) || 0
      }
    };
  }

  // ========================================================================
  // USAGE STATISTICS
  // ========================================================================

  /**
   * Get system usage statistics
   */
  async getUsageStatistics(): Promise<UsageStatistics> {
    // Mock implementation - in real system, this would come από audit logs
    return {
      totalSessions: 1250,
      uniqueUsers: 45,
      averageSessionDuration: 1800, // 30 minutes

      mostUsedFeatures: [
        { feature: 'Add Control Point', usageCount: 3200 },
        { feature: 'Calibrate Transformation', usageCount: 890 },
        { feature: 'Export GeoJSON', usageCount: 567 },
        { feature: 'Spatial Query', usageCount: 234 }
      ],

      usageByRegion: [
        { region: 'Attica', projectCount: 25, controlPointCount: 450 },
        { region: 'Thessaloniki', projectCount: 18, controlPointCount: 320 },
        { region: 'Patras', projectCount: 12, controlPointCount: 180 }
      ],

      peakUsageHours: [
        { hour: 9, activityCount: 150 },
        { hour: 10, activityCount: 180 },
        { hour: 14, activityCount: 165 },
        { hour: 15, activityCount: 145 }
      ],

      commonErrors: [
        { errorType: 'Insufficient Control Points', count: 23, lastOccurred: new Date() },
        { errorType: 'Invalid Geometry', count: 15, lastOccurred: new Date() },
        { errorType: 'Coordinate System Mismatch', count: 8, lastOccurred: new Date() }
      ]
    };
  }

  // ========================================================================
  // CUSTOM REPORTS
  // ========================================================================

  /**
   * Generate custom report based on parameters
   */
  async generateCustomReport(params: CustomReportParams): Promise<CustomReportResult> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let data: unknown[] = [];
    let totalRecords = 0;

    switch (params.reportType) {
      case 'project_summary':
        data = await this.generateProjectSummaryReport(params);
        break;

      case 'accuracy_analysis':
        data = await this.generateAccuracyAnalysisReport(params);
        break;

      case 'spatial_coverage':
        data = await this.generateSpatialCoverageReport(params);
        break;

      case 'usage_report':
        data = await this.generateUsageReport(params);
        break;

      default:
        throw new Error(`Unknown report type: ${params.reportType}`);
    }

    totalRecords = data.length;

    // Calculate quality scores
    const dataQuality = this.calculateDataQuality(data);
    const completeness = this.calculateCompleteness(data);
    const recommendations = this.generateRecommendations(data, params);

    return {
      reportId,
      reportType: params.reportType,
      generatedAt: new Date(),
      parameters: params,
      data,
      summary: {
        totalRecords,
        dataQuality,
        completeness,
        recommendations
      }
    };
  }

  // ========================================================================
  // PRIVATE REPORT GENERATORS
  // ========================================================================

  private async generateProjectSummaryReport(params: CustomReportParams): Promise<unknown[]> {
    let sql = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.is_calibrated,
        p.rms_error,
        p.created_at,
        COUNT(cp.id) as control_point_count,
        AVG(cp.accuracy_meters) as avg_accuracy,
        COUNT(se.id) as entity_count
      FROM geo_projects p
      LEFT JOIN geo_control_points cp ON p.id = cp.project_id AND cp.is_active = true
      LEFT JOIN geo_spatial_entities se ON p.id = se.project_id
      WHERE 1=1
    `;

    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Apply filters
    if (params.projectIds && params.projectIds.length > 0) {
      sql += ` AND p.id = ANY($${paramIndex++})`;
      queryParams.push(params.projectIds);
    }

    if (params.dateRange) {
      sql += ` AND p.created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      queryParams.push(params.dateRange.startDate, params.dateRange.endDate);
    }

    if (!params.includeInactive) {
      sql += ` AND p.is_calibrated = true`;
    }

    sql += ` GROUP BY p.id, p.name, p.description, p.is_calibrated, p.rms_error, p.created_at`;
    sql += ` ORDER BY p.created_at DESC`;

    const result = await this.dbManager.query(sql, queryParams);
    return result.rows;
  }

  private async generateAccuracyAnalysisReport(params: CustomReportParams): Promise<unknown[]> {
    let sql = `
      SELECT
        cp.id,
        cp.name,
        cp.accuracy_meters,
        cp.point_type,
        cp.created_at,
        p.name as project_name,
        CASE
          WHEN cp.accuracy_meters <= 0.5 THEN 'EXCELLENT'
          WHEN cp.accuracy_meters <= 1.0 THEN 'GOOD'
          WHEN cp.accuracy_meters <= 2.0 THEN 'FAIR'
          WHEN cp.accuracy_meters <= 5.0 THEN 'POOR'
          ELSE 'UNACCEPTABLE'
        END as accuracy_class
      FROM geo_control_points cp
      JOIN geo_projects p ON cp.project_id = p.id
      WHERE cp.is_active = true
    `;

    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.projectIds && params.projectIds.length > 0) {
      sql += ` AND cp.project_id = ANY($${paramIndex++})`;
      queryParams.push(params.projectIds);
    }

    if (params.dateRange) {
      sql += ` AND cp.created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      queryParams.push(params.dateRange.startDate, params.dateRange.endDate);
    }

    sql += ` ORDER BY cp.accuracy_meters ASC`;

    const result = await this.dbManager.query(sql, queryParams);
    return result.rows;
  }

  private async generateSpatialCoverageReport(params: CustomReportParams): Promise<unknown[]> {
    // Mock implementation - would generate spatial coverage analysis
    return [];
  }

  private async generateUsageReport(params: CustomReportParams): Promise<unknown[]> {
    // Mock implementation - would analyze usage patterns
    return [];
  }

  // ========================================================================
  // QUALITY ASSESSMENT METHODS
  // ========================================================================

  private calculateDataQuality(data: unknown[]): number {
    if (data.length === 0) return 0;

    let qualityScore = 100;
    let issues = 0;

    data.forEach(record => {
      // Check για missing critical fields
      if (!record.name || record.name.trim() === '') issues++;
      if (record.rms_error && record.rms_error > 5.0) issues++; // Poor accuracy
      if (record.control_point_count && record.control_point_count < 3) issues++; // Insufficient points
    });

    const qualityPenalty = (issues / data.length) * 50;
    return Math.max(qualityScore - qualityPenalty, 0);
  }

  private calculateCompleteness(data: unknown[]): number {
    if (data.length === 0) return 0;

    let totalFields = 0;
    let filledFields = 0;

    data.forEach(record => {
      Object.values(record).forEach(value => {
        totalFields++;
        if (value !== null && value !== undefined && value !== '') {
          filledFields++;
        }
      });
    });

    return totalFields > 0 ? (filledFields / totalFields) * 100 : 0;
  }

  private generateRecommendations(data: unknown[], params: CustomReportParams): string[] {
    const recommendations: string[] = [];

    if (data.length === 0) {
      recommendations.push('No data found για the specified criteria');
      return recommendations;
    }

    // Analyze the data and generate context-specific recommendations
    const projectsWithPoorAccuracy = data.filter(d => d.rms_error && d.rms_error > 2.0).length;
    const projectsWithFewPoints = data.filter(d => d.control_point_count && d.control_point_count < 4).length;

    if (projectsWithPoorAccuracy > 0) {
      recommendations.push(`${projectsWithPoorAccuracy} projects have poor accuracy (>2.0m RMS) - consider adding more control points`);
    }

    if (projectsWithFewPoints > 0) {
      recommendations.push(`${projectsWithFewPoints} projects have insufficient control points (<4) - add more για better transformation quality`);
    }

    return recommendations;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const databaseAnalytics = new DatabaseAnalytics();
export default databaseAnalytics;
