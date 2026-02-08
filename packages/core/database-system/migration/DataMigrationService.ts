/**
 * DATA MIGRATION & SYNCHRONIZATION SERVICE
 * Geo-Alert System - Phase 4: Data Migration και Sync Tools
 *
 * Enterprise data migration service με:
 * - Bidirectional data sync (Memory ↔ Database)
 * - Batch import/export operations
 * - Data transformation and validation
 * - Conflict resolution strategies
 * - Progress monitoring και rollback capabilities
 */

import type { DatabaseManager } from '../connection/DatabaseManager';
import { databaseManager } from '../connection/DatabaseManager';
import type { GeoProject } from '../repositories/ProjectRepository';
import { projectRepository } from '../repositories/ProjectRepository';
import type { GeoControlPoint } from '../repositories/ControlPointRepository';
import { controlPointRepository } from '../repositories/ControlPointRepository';

// ============================================================================
// MEMORY MODEL TYPES - Represent in-memory data structures
// ============================================================================

/**
 * 🏢 ENTERPRISE: Memory-side control point representation
 * Different from GeoControlPoint which is the database model
 */
interface MemoryControlPoint {
  id: string;
  projectId: string;
  name?: string;
  description?: string;
  /** DXF coordinates as nested object (memory model) */
  dxfPoint: {
    x: number;
    y: number;
    z?: number;
  };
  /** Geographic coordinates */
  geoPoint?: {
    lng: number;
    lat: number;
    alt?: number;
  };
  /** Accuracy in meters (simplified property name) */
  accuracy: number;
  accuracySource?: string;
  pointType: 'control' | 'check' | 'tie';
  isActive: boolean;
}

type MemoryProject = Record<string, unknown>;

// ============================================================================
// MIGRATION DATA TYPES
// ============================================================================

export interface MigrationOptions {
  // Migration direction
  direction: 'memory_to_db' | 'db_to_memory' | 'bidirectional';

  // Data selection
  includeProjects?: boolean;
  includeControlPoints?: boolean;
  includeSpatialEntities?: boolean;

  // Project filters
  projectIds?: string[];
  projectNames?: string[];

  // Conflict resolution
  conflictResolution: 'overwrite' | 'merge' | 'skip' | 'prompt';

  // Validation options
  validateGeometry?: boolean;
  validateAccuracy?: boolean;
  minAccuracyThreshold?: number;

  // Performance options
  batchSize?: number;
  maxParallelOperations?: number;

  // Progress tracking
  onProgress?: (progress: MigrationProgress) => void;
  onError?: (error: MigrationError) => void;
}

export interface MigrationProgress {
  stage: 'validation' | 'export' | 'transform' | 'import' | 'cleanup';
  currentItem: number;
  totalItems: number;
  percentage: number;
  itemType: 'project' | 'control_point' | 'spatial_entity';
  currentItemName?: string;
  estimatedTimeRemaining?: number; // milliseconds
  errors: MigrationError[];
  warnings: MigrationWarning[];
}

export interface MigrationError {
  id: string;
  type: 'validation' | 'transformation' | 'database' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  itemId?: string;
  itemType?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  canRetry: boolean;
}

export interface MigrationWarning {
  id: string;
  type: 'data_loss' | 'accuracy_degradation' | 'format_conversion' | 'performance';
  message: string;
  itemId?: string;
  itemType?: string;
  recommendation?: string;
  timestamp: Date;
}

export interface MigrationResult {
  success: boolean;
  totalProcessed: number;
  successfullyMigrated: number;
  errors: MigrationError[];
  warnings: MigrationWarning[];
  duration: number; // milliseconds
  summary: {
    projectsProcessed: number;
    controlPointsProcessed: number;
    spatialEntitiesProcessed: number;
  };
  rollbackAvailable: boolean;
  rollbackData?: unknown;
}

export interface ConflictItem {
  id: string;
  type: 'project' | 'control_point';
  memoryVersion: Record<string, unknown>;
  databaseVersion: Record<string, unknown>;
  conflicts: Array<{
    field: string;
    memoryValue: unknown;
    databaseValue: unknown;
    recommendation: 'memory' | 'database' | 'merge';
  }>;
}

export interface SyncStatus {
  isInSync: boolean;
  lastSyncTime?: Date;
  pendingChanges: number;
  conflicts: ConflictItem[];
  divergenceScore: number; // 0-100, how different memory και database are
}

// ============================================================================
// DATA MIGRATION SERVICE CLASS
// ============================================================================

export class DataMigrationService {
  private dbManager: DatabaseManager;
  private isRunning = false;
  private currentMigration: MigrationProgress | null = null;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || databaseManager;
  }

  // ========================================================================
  // MAIN MIGRATION OPERATIONS
  // ========================================================================

  /**
   * Migrate data from memory to database
   */
  async migrateMemoryToDatabase(
    memoryData: {
      projects?: MemoryProject[];
      controlPoints?: MemoryControlPoint[];
    },
    options: MigrationOptions
  ): Promise<MigrationResult> {
    if (this.isRunning) {
      throw new Error('Migration is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: MigrationError[] = [];
    const warnings: MigrationWarning[] = [];
    let successfullyMigrated = 0;
    let totalProcessed = 0;

    try {
      // Calculate total items
      let totalItems = 0;
      if (options.includeProjects && memoryData.projects) totalItems += memoryData.projects.length;
      if (options.includeControlPoints && memoryData.controlPoints) totalItems += memoryData.controlPoints.length;

      this.currentMigration = {
        stage: 'validation',
        currentItem: 0,
        totalItems,
        percentage: 0,
        itemType: 'project',
        errors: [],
        warnings: []
      };

      // Validation stage
      this.updateProgress('validation', 0, totalItems, 'project');
      const validationResult = await this.validateMemoryData(memoryData, options);
      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);

      if (validationResult.errors.some(e => e.severity === 'critical')) {
        throw new Error('Critical validation errors - migration aborted');
      }

      // Create default project if needed
      let defaultProject: GeoProject | null = null;
      if (options.includeControlPoints && memoryData.controlPoints && memoryData.controlPoints.length > 0) {
        defaultProject = await this.ensureDefaultProject();
      }

      // Migrate control points
      if (options.includeControlPoints && memoryData.controlPoints) {
        this.updateProgress('import', 0, memoryData.controlPoints.length, 'control_point');

        for (let i = 0; i < memoryData.controlPoints.length; i++) {
          const memoryPoint = memoryData.controlPoints[i];
          totalProcessed++;

          try {
            await this.migrateControlPointToDatabase(memoryPoint, defaultProject!, options);
            successfullyMigrated++;
          } catch (error) {
            errors.push({
              id: `cp_${i}`,
              type: 'database',
              severity: 'medium',
              message: `Failed to migrate control point: ${error}`,
              itemId: memoryPoint.id,
              itemType: 'control_point',
              timestamp: new Date(),
              canRetry: true
            });
          }

          this.updateProgress('import', i + 1, memoryData.controlPoints.length, 'control_point', memoryPoint.id);
        }
      }

      // Cleanup stage
      this.updateProgress('cleanup', totalItems, totalItems, 'project');

      const duration = Date.now() - startTime;

      return {
        success: errors.filter(e => e.severity === 'critical').length === 0,
        totalProcessed,
        successfullyMigrated,
        errors,
        warnings,
        duration,
        summary: {
          projectsProcessed: memoryData.projects?.length || 0,
          controlPointsProcessed: memoryData.controlPoints?.length || 0,
          spatialEntitiesProcessed: 0
        },
        rollbackAvailable: false // TODO: Implement rollback
      };

    } finally {
      this.isRunning = false;
      this.currentMigration = null;
    }
  }

  /**
   * Migrate data from database to memory
   */
  async migrateDatabaseToMemory(
    options: MigrationOptions
  ): Promise<{ projects: GeoProject[]; controlPoints: GeoControlPoint[]; result: MigrationResult }> {
    if (this.isRunning) {
      throw new Error('Migration is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: MigrationError[] = [];
    const warnings: MigrationWarning[] = [];
    let projects: GeoProject[] = [];
    let controlPoints: GeoControlPoint[] = [];

    try {
      // Export projects
      if (options.includeProjects) {
        this.updateProgress('export', 0, 1, 'project');
        try {
          projects = await projectRepository.listProjects({
            includeUncalibrated: true,
            limit: 1000 // Reasonable limit
          });
        } catch (error) {
          errors.push({
            id: 'projects_export',
            type: 'database',
            severity: 'high',
            message: `Failed to export projects: ${error}`,
            timestamp: new Date(),
            canRetry: true
          });
        }
      }

      // Export control points
      if (options.includeControlPoints) {
        this.updateProgress('export', 0, 1, 'control_point');
        try {
          // Get all control points from all projects
          const allProjects = await projectRepository.listProjects({ includeUncalibrated: true });
          for (const project of allProjects) {
            const projectControlPoints = await controlPointRepository.getControlPointsByProject(project.id, false);
            controlPoints.push(...projectControlPoints);
          }
        } catch (error) {
          errors.push({
            id: 'control_points_export',
            type: 'database',
            severity: 'high',
            message: `Failed to export control points: ${error}`,
            timestamp: new Date(),
            canRetry: true
          });
        }
      }

      const duration = Date.now() - startTime;

      const result: MigrationResult = {
        success: errors.filter(e => e.severity === 'critical').length === 0,
        totalProcessed: projects.length + controlPoints.length,
        successfullyMigrated: projects.length + controlPoints.length,
        errors,
        warnings,
        duration,
        summary: {
          projectsProcessed: projects.length,
          controlPointsProcessed: controlPoints.length,
          spatialEntitiesProcessed: 0
        },
        rollbackAvailable: false
      };

      return { projects, controlPoints, result };

    } finally {
      this.isRunning = false;
      this.currentMigration = null;
    }
  }

  // ========================================================================
  // SYNCHRONIZATION OPERATIONS
  // ========================================================================

  /**
   * Check sync status between memory and database
   */
  async checkSyncStatus(
    memoryData: {
      projects?: MemoryProject[];
      controlPoints?: MemoryControlPoint[];
    }
  ): Promise<SyncStatus> {
    try {
      // Get database data
      const dbProjects = await projectRepository.listProjects({ includeUncalibrated: true });
      const dbControlPoints: GeoControlPoint[] = [];

      for (const project of dbProjects) {
        const projectControlPoints = await controlPointRepository.getControlPointsByProject(project.id, false);
        dbControlPoints.push(...projectControlPoints);
      }

      // Compare data
      const conflicts: ConflictItem[] = [];
      let pendingChanges = 0;

      // Compare control points
      if (memoryData.controlPoints) {
        for (const memoryPoint of memoryData.controlPoints) {
          const dbPoint = dbControlPoints.find(dbcp =>
            dbcp.dxfX === memoryPoint.dxfPoint.x &&
            dbcp.dxfY === memoryPoint.dxfPoint.y
          );

          if (dbPoint) {
            // Check για conflicts
            const pointConflicts = this.detectControlPointConflicts(memoryPoint, dbPoint);
            if (pointConflicts.length > 0) {
              conflicts.push({
                id: memoryPoint.id,
                type: 'control_point',
                memoryVersion: memoryPoint as unknown as Record<string, unknown>,
                databaseVersion: dbPoint as unknown as Record<string, unknown>,
                conflicts: pointConflicts
              });
            }
          } else {
            pendingChanges++; // Point exists in memory but not in database
          }
        }
      }

      // Calculate divergence score
      const totalItems = (memoryData.controlPoints?.length || 0) + (memoryData.projects?.length || 0);
      const divergenceScore = totalItems > 0 ? (conflicts.length / totalItems) * 100 : 0;

      return {
        isInSync: conflicts.length === 0 && pendingChanges === 0,
        pendingChanges,
        conflicts,
        divergenceScore,
        lastSyncTime: undefined // TODO: Track last sync time
      };

    } catch (error) {
      throw new Error(`Failed to check sync status: ${error}`);
    }
  }

  /**
   * Resolve conflicts και perform sync
   */
  async synchronizeData(
    memoryData: {
      projects?: MemoryProject[];
      controlPoints?: MemoryControlPoint[];
    },
    conflictResolutions: Array<{
      conflictId: string;
      resolution: 'memory' | 'database' | 'merge';
    }>,
    options: MigrationOptions
  ): Promise<MigrationResult> {
    // This would implement sophisticated sync logic
    // For now, fallback to simple migration
    return this.migrateMemoryToDatabase(memoryData, options);
  }

  // ========================================================================
  // VALIDATION και TRANSFORMATION
  // ========================================================================

  /**
   * Validate memory data before migration
   */
  private async validateMemoryData(
    memoryData: {
      projects?: MemoryProject[];
      controlPoints?: MemoryControlPoint[];
    },
    options: MigrationOptions
  ): Promise<{ errors: MigrationError[]; warnings: MigrationWarning[] }> {
    const errors: MigrationError[] = [];
    const warnings: MigrationWarning[] = [];

    // Validate control points
    if (memoryData.controlPoints) {
      for (let i = 0; i < memoryData.controlPoints.length; i++) {
        const point = memoryData.controlPoints[i];

        // Required fields validation
        if (!point.id) {
          errors.push({
            id: `cp_${i}_no_id`,
            type: 'validation',
            severity: 'critical',
            message: 'Control point missing ID',
            itemId: `index_${i}`,
            itemType: 'control_point',
            timestamp: new Date(),
            canRetry: false
          });
        }

        if (!point.dxfPoint || point.dxfPoint.x === undefined || point.dxfPoint.y === undefined) {
          errors.push({
            id: `cp_${i}_no_dxf`,
            type: 'validation',
            severity: 'critical',
            message: 'Control point missing DXF coordinates',
            itemId: point.id,
            itemType: 'control_point',
            timestamp: new Date(),
            canRetry: false
          });
        }

        if (!point.geoPoint || point.geoPoint.lng === undefined || point.geoPoint.lat === undefined) {
          errors.push({
            id: `cp_${i}_no_geo`,
            type: 'validation',
            severity: 'critical',
            message: 'Control point missing geographic coordinates',
            itemId: point.id,
            itemType: 'control_point',
            timestamp: new Date(),
            canRetry: false
          });
        }

        // Accuracy validation
        if (options.validateAccuracy && options.minAccuracyThreshold) {
          if (point.accuracy > options.minAccuracyThreshold) {
            warnings.push({
              id: `cp_${i}_poor_accuracy`,
              type: 'accuracy_degradation',
              message: `Control point accuracy (${point.accuracy}m) exceeds threshold (${options.minAccuracyThreshold}m)`,
              itemId: point.id,
              itemType: 'control_point',
              recommendation: 'Consider improving point accuracy or excluding from transformation',
              timestamp: new Date()
            });
          }
        }

        // Geographic bounds validation (only if geoPoint exists)
        if (point.geoPoint) {
          if (point.geoPoint.lng < -180 || point.geoPoint.lng > 180) {
            errors.push({
              id: `cp_${i}_invalid_lng`,
              type: 'validation',
              severity: 'high',
              message: `Invalid longitude: ${point.geoPoint.lng}`,
              itemId: point.id,
              itemType: 'control_point',
              timestamp: new Date(),
              canRetry: false
            });
          }

          if (point.geoPoint.lat < -90 || point.geoPoint.lat > 90) {
            errors.push({
              id: `cp_${i}_invalid_lat`,
              type: 'validation',
              severity: 'high',
              message: `Invalid latitude: ${point.geoPoint.lat}`,
              itemId: point.id,
              itemType: 'control_point',
              timestamp: new Date(),
              canRetry: false
            });
          }
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Migrate individual control point to database
   */
  private async migrateControlPointToDatabase(
    memoryPoint: MemoryControlPoint,
    project: GeoProject,
    options: MigrationOptions
  ): Promise<void> {
    // Check if point already exists
    const existingPoints = await controlPointRepository.getControlPointsByProject(project.id);
    const existingPoint = existingPoints.find(ep =>
      Math.abs(ep.dxfX - memoryPoint.dxfPoint.x) < 0.001 &&
      Math.abs(ep.dxfY - memoryPoint.dxfPoint.y) < 0.001
    );

    if (existingPoint) {
      // Handle conflict based on resolution strategy
      switch (options.conflictResolution) {
        case 'skip':
          return; // Skip this point

        case 'overwrite':
          // Update existing point
          await controlPointRepository.updateControlPoint(existingPoint.id, {
            name: memoryPoint.description || `Point ${memoryPoint.id}`,
            description: memoryPoint.description,
            dxfX: memoryPoint.dxfPoint.x,
            dxfY: memoryPoint.dxfPoint.y,
            dxfZ: memoryPoint.dxfPoint.z,
            geoPoint: memoryPoint.geoPoint ? {
              lng: memoryPoint.geoPoint.lng,
              lat: memoryPoint.geoPoint.lat,
              alt: memoryPoint.geoPoint.alt
            } : existingPoint.geoPoint, // Keep existing if no new geoPoint
            accuracyMeters: memoryPoint.accuracy
          });
          break;

        case 'merge':
          // Implement merge logic (για τώρα, fallback to overwrite)
          await controlPointRepository.updateControlPoint(existingPoint.id, {
            accuracyMeters: Math.min(existingPoint.accuracyMeters, memoryPoint.accuracy) // Use better accuracy
          });
          break;

        case 'prompt':
          // This would prompt user για resolution - για τώρα skip
          return;
      }
    } else {
      // Create new point - geoPoint is required for new points
      if (!memoryPoint.geoPoint) {
        throw new Error(`Cannot create control point without geoPoint: ${memoryPoint.id}`);
      }
      await controlPointRepository.createControlPoint({
        projectId: project.id,
        name: memoryPoint.description || `Point ${memoryPoint.id}`,
        description: memoryPoint.description,
        dxfX: memoryPoint.dxfPoint.x,
        dxfY: memoryPoint.dxfPoint.y,
        dxfZ: memoryPoint.dxfPoint.z,
        geoPoint: {
          lng: memoryPoint.geoPoint.lng,
          lat: memoryPoint.geoPoint.lat,
          alt: memoryPoint.geoPoint.alt
        },
        accuracyMeters: memoryPoint.accuracy
      });
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Ensure default project exists
   */
  private async ensureDefaultProject(): Promise<GeoProject> {
    let defaultProject = await projectRepository.getProjectByName('Default Migration Project');

    if (!defaultProject) {
      defaultProject = await projectRepository.createProject({
        name: 'Default Migration Project',
        description: 'Auto-created project για migrated control points',
        createdBy: 'migration_service'
      });
    }

    return defaultProject;
  }

  /**
   * Detect conflicts between memory and database control points
   */
  private detectControlPointConflicts(
    memoryPoint: MemoryControlPoint,
    dbPoint: GeoControlPoint
  ): Array<{ field: string; memoryValue: unknown; databaseValue: unknown; recommendation: 'memory' | 'database' | 'merge' }> {
    const conflicts: Array<{ field: string; memoryValue: unknown; databaseValue: unknown; recommendation: 'memory' | 'database' | 'merge' }> = [];

    // Check accuracy differences
    if (Math.abs(memoryPoint.accuracy - dbPoint.accuracyMeters) > 0.1) {
      const accuracyRecommendation: 'memory' | 'database' = memoryPoint.accuracy < dbPoint.accuracyMeters ? 'memory' : 'database';
      conflicts.push({
        field: 'accuracy',
        memoryValue: memoryPoint.accuracy,
        databaseValue: dbPoint.accuracyMeters,
        recommendation: accuracyRecommendation
      });
    }

    // Check description differences
    if (memoryPoint.description !== dbPoint.description) {
      conflicts.push({
        field: 'description',
        memoryValue: memoryPoint.description,
        databaseValue: dbPoint.description,
        recommendation: 'merge' as 'merge'
      });
    }

    return conflicts;
  }

  /**
   * Update migration progress
   */
  private updateProgress(
    stage: 'validation' | 'export' | 'transform' | 'import' | 'cleanup',
    currentItem: number,
    totalItems: number,
    itemType: 'project' | 'control_point' | 'spatial_entity',
    currentItemName?: string
  ): void {
    if (this.currentMigration) {
      this.currentMigration.stage = stage;
      this.currentMigration.currentItem = currentItem;
      this.currentMigration.totalItems = totalItems;
      this.currentMigration.percentage = totalItems > 0 ? (currentItem / totalItems) * 100 : 0;
      this.currentMigration.itemType = itemType;
      this.currentMigration.currentItemName = currentItemName;
    }
  }

  /**
   * Get current migration progress
   */
  getCurrentProgress(): MigrationProgress | null {
    return this.currentMigration;
  }

  /**
   * Check if migration is running
   */
  isMigrationRunning(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const dataMigrationService = new DataMigrationService();
export default dataMigrationService;
