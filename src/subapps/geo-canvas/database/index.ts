/**
 * POSTGIS DATABASE SERVICES - MASTER INDEX
 * Geo-Alert System - Phase 4: Enterprise Spatial Database Integration
 *
 * Centralized export για όλα τα database services και utilities.
 * Αυτό είναι το single entry point για όλες τις database operations.
 */

// ============================================================================
// CORE DATABASE INFRASTRUCTURE
// ============================================================================

// Configuration και Connection Management
export { default as getDatabaseConfig } from './config/database.config';
export type {
  DatabaseConfig,
  DatabaseHealthStatus
} from './config/database.config';

export { default as databaseManager, DatabaseManager } from './connection/DatabaseManager';
export type {
  DatabaseConnection,
  DatabaseTransaction,
  QueryResult,
  ConnectionPoolStats,
  QueryPerformanceMetrics
} from './connection/DatabaseManager';

// ============================================================================
// DATA ACCESS LAYER (REPOSITORIES)
// ============================================================================

// Project Repository
export { default as projectRepository, ProjectRepository } from './repositories/ProjectRepository';
export type {
  GeoProject,
  CreateProjectParams,
  UpdateProjectParams,
  SetTransformationParams,
  ProjectQueryOptions,
  ProjectStatistics
} from './repositories/ProjectRepository';

// Control Point Repository
export { default as controlPointRepository, ControlPointRepository } from './repositories/ControlPointRepository';
export type {
  GeoControlPoint,
  CreateControlPointParams,
  UpdateControlPointParams,
  ControlPointQueryOptions,
  ControlPointStatistics,
  SpatialDistributionAnalysis
} from './repositories/ControlPointRepository';

// ============================================================================
// SPATIAL QUERY ENGINE
// ============================================================================

export { default as spatialQueryEngine, SpatialQueryEngine } from './queries/SpatialQueryEngine';
export type {
  SpatialQueryOptions,
  ProximitySearchParams,
  BoundingBoxParams,
  GeospatialBufferParams,
  SpatialIntersectionParams,
  SpatialRelationshipResult,
  ClusterAnalysisParams,
  SpatialCluster,
  ConvexHullResult,
  GridAnalysisParams,
  GridCell
} from './queries/SpatialQueryEngine';

// ============================================================================
// ANALYTICS και REPORTING
// ============================================================================

export { default as databaseAnalytics, DatabaseAnalytics } from './analytics/DatabaseAnalytics';
export type {
  ProjectAnalytics,
  ControlPointAnalytics,
  SpatialDataAnalytics,
  AccuracyTrendAnalysis,
  UsageStatistics,
  CustomReportParams,
  CustomReportResult
} from './analytics/DatabaseAnalytics';

// ============================================================================
// DATA MIGRATION και SYNCHRONIZATION
// ============================================================================

export { default as dataMigrationService, DataMigrationService } from './migration/DataMigrationService';
export type {
  MigrationOptions,
  MigrationProgress,
  MigrationError,
  MigrationWarning,
  MigrationResult,
  ConflictItem,
  SyncStatus
} from './migration/DataMigrationService';

// ============================================================================
// ENTERPRISE DATABASE SERVICE (FACADE PATTERN)
// ============================================================================

/**
 * Enterprise Database Service - Unified API για όλες τις database operations
 * Implements Facade pattern για simplified access to complex subsystems
 */
export class GeoAlertDatabaseService {
  // Core services
  readonly manager = databaseManager;
  readonly projects = projectRepository;
  readonly controlPoints = controlPointRepository;
  readonly spatial = spatialQueryEngine;
  readonly analytics = databaseAnalytics;
  readonly migration = dataMigrationService;

  // ========================================================================
  // INITIALIZATION και HEALTH MONITORING
  // ========================================================================

  /**
   * Initialize all database services
   */
  async initialize(): Promise<void> {
    await this.manager.initialize();
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<{
    database: DatabaseHealthStatus;
    services: {
      projects: boolean;
      controlPoints: boolean;
      spatial: boolean;
      analytics: boolean;
      migration: boolean;
    };
    overall: 'healthy' | 'degraded' | 'critical';
  }> {
    const dbHealth = this.manager.getHealthStatus();

    const services = {
      projects: dbHealth.isConnected,
      controlPoints: dbHealth.isConnected,
      spatial: dbHealth.isConnected,
      analytics: dbHealth.isConnected,
      migration: !this.migration.isMigrationRunning()
    };

    const allHealthy = Object.values(services).every(status => status);
    const mostHealthy = Object.values(services).filter(status => status).length >= 3;

    const overall = allHealthy ? 'healthy' : mostHealthy ? 'degraded' : 'critical';

    return {
      database: dbHealth,
      services,
      overall
    };
  }

  // ========================================================================
  // QUICK ACCESS METHODS (για common operations)
  // ========================================================================

  /**
   * Quick method: Create project με control points
   */
  async createProjectWithControlPoints(
    projectData: CreateProjectParams,
    controlPointsData: CreateControlPointParams[]
  ): Promise<{ project: GeoProject; controlPoints: GeoControlPoint[] }> {
    return this.manager.transaction(async (trx) => {
      // Create project
      const project = await this.projects.createProject(projectData);

      // Create control points
      const controlPointsWithProject = controlPointsData.map(cp => ({
        ...cp,
        projectId: project.id
      }));

      const controlPoints = await this.controlPoints.createControlPoints(controlPointsWithProject);

      return { project, controlPoints };
    });
  }

  /**
   * Quick method: Get project με all related data
   */
  async getProjectComplete(projectId: string): Promise<{
    project: GeoProject | null;
    controlPoints: GeoControlPoint[];
    statistics: ControlPointStatistics;
    spatialAnalysis: SpatialDistributionAnalysis;
  } | null> {
    const project = await this.projects.getProjectById(projectId);
    if (!project) return null;

    const [controlPoints, statistics, spatialAnalysis] = await Promise.all([
      this.controlPoints.getControlPointsByProject(projectId),
      this.controlPoints.getControlPointStatistics(projectId),
      this.controlPoints.analyzeSpatialDistribution(projectId)
    ]);

    return {
      project,
      controlPoints,
      statistics,
      spatialAnalysis
    };
  }

  /**
   * Quick method: Search nearby features
   */
  async searchNearby(
    centerPoint: { lng: number; lat: number },
    radiusMeters: number,
    projectId?: string
  ): Promise<{
    controlPoints: any[];
    spatialEntities: any[];
    totalFound: number;
  }> {
    const [controlPoints, spatialEntities] = await Promise.all([
      this.spatial.findNearbyControlPoints(centerPoint, radiusMeters, projectId),
      this.spatial.proximitySearch({
        centerPoint,
        radiusMeters,
        projectId,
        limit: 50
      })
    ]);

    return {
      controlPoints,
      spatialEntities,
      totalFound: controlPoints.length + spatialEntities.length
    };
  }

  /**
   * Quick method: Generate comprehensive project report
   */
  async generateProjectReport(projectId: string): Promise<CustomReportResult> {
    return this.analytics.generateCustomReport({
      reportType: 'project_summary',
      projectIds: [projectId],
      includeInactive: false,
      format: 'json'
    });
  }

  // ========================================================================
  // CLEANUP και SHUTDOWN
  // ========================================================================

  /**
   * Graceful shutdown of all database services
   */
  async shutdown(): Promise<void> {
    await this.manager.shutdown();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Global Database Service Instance
 * Use this για all database operations in the Geo-Alert System
 */
export const geoAlertDatabase = new GeoAlertDatabaseService();

// Default export για convenience
export default geoAlertDatabase;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Initialize database services με error handling
 */
export async function initializeDatabaseServices(): Promise<{
  success: boolean;
  error?: string;
  healthStatus?: any;
}> {
  try {
    await geoAlertDatabase.initialize();
    const healthStatus = await geoAlertDatabase.getSystemHealth();

    return {
      success: healthStatus.overall !== 'critical',
      healthStatus
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database initialization error'
    };
  }
}

/**
 * Check if database services are ready
 */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    const health = await geoAlertDatabase.getSystemHealth();
    return health.overall === 'healthy';
  } catch {
    return false;
  }
}

/**
 * Get database performance metrics
 */
export async function getDatabasePerformanceMetrics(): Promise<{
  connectionPool: ConnectionPoolStats;
  queryPerformance: QueryPerformanceMetrics;
  health: DatabaseHealthStatus;
}> {
  return {
    connectionPool: geoAlertDatabase.manager.getConnectionPoolStats(),
    queryPerformance: geoAlertDatabase.manager.getPerformanceMetrics(),
    health: geoAlertDatabase.manager.getHealthStatus()
  };
}