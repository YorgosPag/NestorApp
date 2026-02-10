/**
 * 🏢 ENTERPRISE MIGRATION: Assign Project Codes
 *
 * Migration script to assign human-readable project codes (PRJ-001, PRJ-002, etc.)
 * to existing projects in Firestore.
 *
 * SAFETY:
 * - Supports dry-run mode (default)
 * - Full logging and audit trail
 * - Rollback capability
 * - Sorted by createdAt for consistent ordering
 *
 * @author Enterprise Architecture Team
 * @date 2026-01-10
 * @version 1.0.0
 */

import type { Migration, MigrationResult } from './types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PROJECT_CODE_CONFIG, formatProjectCode } from '@/services/project-code.service';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('Migration005');

// ============================================================================
// MIGRATION METADATA
// ============================================================================

export const MIGRATION_ID = '005_assign_project_codes';
export const MIGRATION_VERSION = '1.0.0';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectDocument {
  id: string;
  name?: string;
  createdAt?: Date | { toDate: () => Date };
  projectCode?: string;
}

interface MigrationLogEntry {
  projectId: string;
  projectName: string;
  oldCode: string | null;
  newCode: string;
  timestamp: Date;
}

interface DryRunResult {
  totalProjects: number;
  projectsToMigrate: number;
  projectsAlreadyMigrated: number;
  proposedAssignments: Array<{
    projectId: string;
    projectName: string;
    proposedCode: string;
  }>;
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Get Firestore database instance
 * Uses static import for reliable module resolution
 */
function getFirestore(): FirebaseFirestore.Firestore {
  const database = getAdminFirestore();

  if (!database) {
    throw new Error('Firestore database not available - check Firebase Admin initialization');
  }

  return database;
}

/**
 * Fetch all projects sorted by creation date
 *
 * NOTE: Uses simple .get() instead of .orderBy('createdAt') because Firestore
 * excludes documents that don't have the orderBy field. Sorting is done in JS.
 */
async function fetchProjectsSorted(): Promise<ProjectDocument[]> {
  const database = getAdminFirestore();

  if (!database) {
    throw new Error('Firestore database not available');
  }

  const projectsRef = database.collection(COLLECTIONS.PROJECTS);
  const snapshot = await projectsRef.get();

  const projects: ProjectDocument[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    projects.push({
      id: doc.id,
      name: data.name || data.title || 'Unnamed Project',
      createdAt: data.createdAt,
      projectCode: data.projectCode
    });
  });

  // Sort by createdAt if available
  projects.sort((a, b) => {
    const dateA = a.createdAt
      ? (typeof a.createdAt === 'object' && 'toDate' in a.createdAt
        ? a.createdAt.toDate()
        : a.createdAt as Date)
      : new Date(0);
    const dateB = b.createdAt
      ? (typeof b.createdAt === 'object' && 'toDate' in b.createdAt
        ? b.createdAt.toDate()
        : b.createdAt as Date)
      : new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  return projects;
}

/**
 * Execute dry run - preview changes without applying
 */
export async function executeDryRun(): Promise<DryRunResult> {
  const projects = await fetchProjectsSorted();

  const result: DryRunResult = {
    totalProjects: projects.length,
    projectsToMigrate: 0,
    projectsAlreadyMigrated: 0,
    proposedAssignments: []
  };

  let nextSequence = 1;

  for (const project of projects) {
    if (project.projectCode) {
      result.projectsAlreadyMigrated++;
      logger.info(`  ✓ ${project.name} - already has code: ${project.projectCode}`);

      // Update nextSequence if existing code is higher
      const existingSequence = parseInt(project.projectCode.replace(/\D/g, ''), 10);
      if (!isNaN(existingSequence) && existingSequence >= nextSequence) {
        nextSequence = existingSequence + 1;
      }
    } else {
      const proposedCode = formatProjectCode(nextSequence);
      result.projectsToMigrate++;
      result.proposedAssignments.push({
        projectId: project.id,
        projectName: project.name || 'Unnamed',
        proposedCode
      });
      logger.info(`  → ${project.name} - will receive: ${proposedCode}`);
      nextSequence++;
    }
  }

  logger.info('\n📊 DRY RUN SUMMARY:');
  logger.info(`  Total projects: ${result.totalProjects}`);
  logger.info(`  Already migrated: ${result.projectsAlreadyMigrated}`);
  logger.info(`  To be migrated: ${result.projectsToMigrate}`);

  return result;
}

/**
 * Execute actual migration - apply changes to Firestore
 */
export async function executeMigration(
  options: { dryRun?: boolean } = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const { dryRun = true } = options; // Default to dry run for safety

  if (dryRun) {
    const dryRunResult = await executeDryRun();
    return {
      success: true,
      migrationId: MIGRATION_ID,
      executedAt: new Date(),
      affectedRecords: 0,
      executionTimeMs: Date.now() - startTime,
      warnings: ['DRY RUN - No changes applied']
    };
  }

  logger.info('🚀 Starting LIVE migration for project codes...\n');
  logger.info('⚠️  THIS WILL MODIFY YOUR DATABASE\n');

  const database = getFirestore();
  const projects = await fetchProjectsSorted();
  const migrationLog: MigrationLogEntry[] = [];
  const errors: string[] = [];

  let nextSequence = 1;
  let affectedRecords = 0;

  // First pass: determine starting sequence from existing codes
  for (const project of projects) {
    if (project.projectCode) {
      const existingSequence = parseInt(project.projectCode.replace(/\D/g, ''), 10);
      if (!isNaN(existingSequence) && existingSequence >= nextSequence) {
        nextSequence = existingSequence + 1;
      }
    }
  }

  logger.info(`📌 Starting sequence: ${nextSequence}\n`);

  // Second pass: assign codes to projects without them
  for (const project of projects) {
    if (project.projectCode) {
      logger.info(`  ✓ ${project.name} - keeping existing: ${project.projectCode}`);
      continue;
    }

    const newCode = formatProjectCode(nextSequence);

    try {
      // Update Firestore document
      await database
        .collection(COLLECTIONS.PROJECTS)
        .doc(project.id)
        .update({
          projectCode: newCode,
          updatedAt: new Date()
        });

      migrationLog.push({
        projectId: project.id,
        projectName: project.name || 'Unnamed',
        oldCode: null,
        newCode,
        timestamp: new Date()
      });

      logger.info(`  ✓ ${project.name} - assigned: ${newCode}`);
      affectedRecords++;
      nextSequence++;
    } catch (error) {
      const errorMessage = `Failed to update project ${project.id}: ${error}`;
      errors.push(errorMessage);
      logger.error(`  ✗ ${project.name} - ERROR: ${error}`);
    }
  }

  // Initialize or update the counter
  try {
    const counterRef = database
      .collection(COLLECTIONS.COUNTERS)
      .doc(PROJECT_CODE_CONFIG.COUNTER_DOC);

    await counterRef.set({
      next: nextSequence,
      updatedAt: new Date(),
      totalGenerated: nextSequence - 1,
      migratedAt: new Date(),
      migratedBy: MIGRATION_ID
    }, { merge: true });

    logger.info(`\n✓ Counter initialized at: ${nextSequence}`);
  } catch (error) {
    errors.push(`Failed to initialize counter: ${error}`);
  }

  logger.info('\n📊 MIGRATION COMPLETE:');
  logger.info(`  Projects updated: ${affectedRecords}`);
  logger.info(`  Errors: ${errors.length}`);
  logger.info(`  Execution time: ${Date.now() - startTime}ms`);

  return {
    success: errors.length === 0,
    migrationId: MIGRATION_ID,
    executedAt: new Date(),
    affectedRecords,
    rollbackData: {
      backupId: MIGRATION_ID,
      timestamp: new Date(),
      snapshotData: { migrationLog }
    },
    errors: errors.length > 0 ? errors : undefined,
    executionTimeMs: Date.now() - startTime
  };
}

/**
 * Rollback migration - remove assigned codes
 */
export async function rollbackMigration(
  rollbackData: MigrationLogEntry[]
): Promise<MigrationResult> {
  const startTime = Date.now();
  logger.info('🔄 Starting ROLLBACK for project code migration...\n');

  const database = getFirestore();
  const errors: string[] = [];
  let affectedRecords = 0;

  for (const entry of rollbackData) {
    try {
      await database
        .collection(COLLECTIONS.PROJECTS)
        .doc(entry.projectId)
        .update({
          projectCode: entry.oldCode, // Will be null for newly assigned
          updatedAt: new Date()
        });

      logger.info(`  ✓ Reverted: ${entry.projectName} (${entry.newCode} → ${entry.oldCode || 'null'})`);
      affectedRecords++;
    } catch (error) {
      const errorMessage = `Failed to rollback project ${entry.projectId}: ${error}`;
      errors.push(errorMessage);
      logger.error(`  ✗ ${entry.projectName} - ERROR: ${error}`);
    }
  }

  logger.info('\n📊 ROLLBACK COMPLETE:');
  logger.info(`  Projects reverted: ${affectedRecords}`);
  logger.info(`  Errors: ${errors.length}`);

  return {
    success: errors.length === 0,
    migrationId: `${MIGRATION_ID}_rollback`,
    executedAt: new Date(),
    affectedRecords,
    errors: errors.length > 0 ? errors : undefined,
    executionTimeMs: Date.now() - startTime
  };
}

// ============================================================================
// MIGRATION DEFINITION
// ============================================================================

export const migration: Migration = {
  id: MIGRATION_ID,
  version: MIGRATION_VERSION,
  name: 'Assign Project Codes',
  description: 'Assigns human-readable project codes (PRJ-001, PRJ-002, etc.) to existing projects',
  author: 'Enterprise Architecture Team',
  createdAt: new Date('2026-01-10'),
  dryRun: true, // Default to dry run
  steps: [
    {
      stepId: 'fetch_projects',
      description: 'Fetch all projects sorted by creation date',
      execute: async () => {
        const projects = await fetchProjectsSorted();
        return {
          affectedRecords: projects.length,
          data: { projects }
        };
      }
    },
    {
      stepId: 'assign_codes',
      description: 'Assign sequential project codes',
      execute: async () => {
        const result = await executeMigration({ dryRun: false });
        return {
          affectedRecords: result.affectedRecords,
          data: { result }
        };
      },
      rollback: async () => {
        logger.warn('Rollback requires manual intervention with rollbackData');
      }
    }
  ]
};

export default migration;
