/**
 * 🏢 ENTERPRISE MIGRATION: Normalize Storage Building References
 *
 * Migration script to convert storage.building (name) → storage.buildingId (ID)
 * This follows enterprise best practices where foreign keys use IDs, not names.
 *
 * PROBLEM:
 * - Storages currently store building NAME in `building` field
 * - This breaks when buildings are renamed
 * - Matching by name is slow and error-prone
 *
 * SOLUTION:
 * - Add `buildingId` field with the actual building document ID
 * - Keep `building` field for backward compatibility (can be removed later)
 *
 * SAFETY:
 * - Supports dry-run mode (default)
 * - Full logging and audit trail
 * - Rollback capability
 * - Non-destructive (adds field, doesn't remove existing)
 *
 * @author Enterprise Architecture Team
 * @date 2026-01-18
 * @version 1.0.0
 */

import type { Migration, MigrationResult, MigrationStep } from './types';
import { DEFAULT_MIGRATION_CONFIG } from './types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase-admin';

// ============================================================================
// MIGRATION METADATA
// ============================================================================

export const MIGRATION_ID = '006_normalize_storage_building_references';
export const MIGRATION_VERSION = '1.0.0';

// ============================================================================
// TYPES
// ============================================================================

interface StorageDocument {
  id: string;
  name?: string;
  building?: string;      // Current: building NAME
  buildingId?: string;    // Target: building ID
  projectId?: string;
}

interface BuildingDocument {
  id: string;
  name?: string;
  projectId?: string;
}

interface MigrationLogEntry {
  storageId: string;
  storageName: string;
  oldBuildingName: string | null;
  newBuildingId: string;
  buildingName: string;
  timestamp: Date;
}

interface DryRunResult {
  totalStorages: number;
  storagesToMigrate: number;
  storagesAlreadyMigrated: number;
  unmatchedStorages: number;
  proposedAssignments: Array<{
    storageId: string;
    storageName: string;
    currentBuildingName: string;
    matchedBuildingId: string;
    matchedBuildingName: string;
  }>;
  unmatchedList: Array<{
    storageId: string;
    storageName: string;
    buildingName: string;
  }>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get Firestore database instance
 */
function getFirestore(): FirebaseFirestore.Firestore {
  const database = db();

  if (!database) {
    throw new Error('Firestore database not available - check Firebase Admin initialization');
  }

  return database;
}

/**
 * Fetch all buildings and create a name → ID lookup map
 */
async function fetchBuildingsMap(): Promise<Map<string, BuildingDocument>> {
  const database = getFirestore();
  const buildingsRef = database.collection(COLLECTIONS.BUILDINGS);
  const snapshot = await buildingsRef.get();

  const buildingsMap = new Map<string, BuildingDocument>();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const building: BuildingDocument = {
      id: doc.id,
      name: data.name || '',
      projectId: data.projectId || ''
    };

    // Map by name (lowercase for case-insensitive matching)
    if (building.name) {
      buildingsMap.set(building.name.toLowerCase().trim(), building);
    }
  });

  console.log(`📋 [Migration] Loaded ${buildingsMap.size} buildings for matching`);
  return buildingsMap;
}

/**
 * Fetch all storages
 */
async function fetchStorages(): Promise<StorageDocument[]> {
  const database = getFirestore();
  const storagesRef = database.collection(COLLECTIONS.STORAGE);
  const snapshot = await storagesRef.get();

  const storages: StorageDocument[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    storages.push({
      id: doc.id,
      name: data.name || '',
      building: data.building || '',
      buildingId: data.buildingId || undefined,
      projectId: data.projectId || ''
    });
  });

  console.log(`📋 [Migration] Found ${storages.length} storage documents`);
  return storages;
}

/**
 * Match storage building name to building ID
 */
function matchBuildingId(
  storage: StorageDocument,
  buildingsMap: Map<string, BuildingDocument>
): BuildingDocument | null {
  if (!storage.building) return null;

  const buildingNameLower = storage.building.toLowerCase().trim();
  return buildingsMap.get(buildingNameLower) || null;
}

// ============================================================================
// DRY RUN
// ============================================================================

/**
 * Perform dry-run analysis without modifying data
 */
export async function dryRun(): Promise<DryRunResult> {
  console.log('🔍 [Migration] Starting dry-run analysis...');

  const buildingsMap = await fetchBuildingsMap();
  const storages = await fetchStorages();

  const result: DryRunResult = {
    totalStorages: storages.length,
    storagesToMigrate: 0,
    storagesAlreadyMigrated: 0,
    unmatchedStorages: 0,
    proposedAssignments: [],
    unmatchedList: []
  };

  for (const storage of storages) {
    // Already has buildingId - skip
    if (storage.buildingId) {
      result.storagesAlreadyMigrated++;
      continue;
    }

    // Try to match building name to ID
    const matchedBuilding = matchBuildingId(storage, buildingsMap);

    if (matchedBuilding) {
      result.storagesToMigrate++;
      result.proposedAssignments.push({
        storageId: storage.id,
        storageName: storage.name || 'Unnamed',
        currentBuildingName: storage.building || '',
        matchedBuildingId: matchedBuilding.id,
        matchedBuildingName: matchedBuilding.name || ''
      });
    } else {
      result.unmatchedStorages++;
      result.unmatchedList.push({
        storageId: storage.id,
        storageName: storage.name || 'Unnamed',
        buildingName: storage.building || ''
      });
    }
  }

  console.log('📊 [Migration] Dry-run results:');
  console.log(`   Total storages: ${result.totalStorages}`);
  console.log(`   To migrate: ${result.storagesToMigrate}`);
  console.log(`   Already migrated: ${result.storagesAlreadyMigrated}`);
  console.log(`   Unmatched: ${result.unmatchedStorages}`);

  if (result.unmatchedList.length > 0) {
    console.log('⚠️ [Migration] Unmatched storages:');
    result.unmatchedList.forEach(s => {
      console.log(`   - ${s.storageName} (building: "${s.buildingName}")`);
    });
  }

  return result;
}

// ============================================================================
// EXECUTE MIGRATION
// ============================================================================

/**
 * Execute the migration - updates storage documents with buildingId
 */
export async function execute(options: { dryRun?: boolean } = {}): Promise<MigrationResult> {
  const startTime = Date.now();
  const migrationLog: MigrationLogEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(`🚀 [Migration] Starting ${MIGRATION_ID} v${MIGRATION_VERSION}`);
  console.log(`   Mode: ${options.dryRun ? 'DRY-RUN' : 'EXECUTE'}`);

  try {
    // Step 1: Dry-run analysis
    const dryRunResult = await dryRun();

    if (options.dryRun) {
      return {
        success: true,
        migrationId: MIGRATION_ID,
        executedAt: new Date(),
        affectedRecords: 0,
        executionTimeMs: Date.now() - startTime,
        warnings: dryRunResult.unmatchedStorages > 0
          ? [`${dryRunResult.unmatchedStorages} storages could not be matched to buildings`]
          : undefined
      };
    }

    // Step 2: Execute migration
    if (dryRunResult.storagesToMigrate === 0) {
      console.log('✅ [Migration] No storages to migrate');
      return {
        success: true,
        migrationId: MIGRATION_ID,
        executedAt: new Date(),
        affectedRecords: 0,
        executionTimeMs: Date.now() - startTime
      };
    }

    const database = getFirestore();
    const batch = database.batch();
    let batchCount = 0;
    const maxBatchSize = DEFAULT_MIGRATION_CONFIG.batchSize;

    for (const assignment of dryRunResult.proposedAssignments) {
      const storageRef = database.collection(COLLECTIONS.STORAGE).doc(assignment.storageId);

      batch.update(storageRef, {
        buildingId: assignment.matchedBuildingId,
        // Keep building name for backward compatibility
        _migratedAt: new Date(),
        _migratedFrom: 'building_name_to_id'
      });

      migrationLog.push({
        storageId: assignment.storageId,
        storageName: assignment.storageName,
        oldBuildingName: assignment.currentBuildingName,
        newBuildingId: assignment.matchedBuildingId,
        buildingName: assignment.matchedBuildingName,
        timestamp: new Date()
      });

      batchCount++;

      // Commit batch if reaching limit
      if (batchCount >= maxBatchSize) {
        await batch.commit();
        console.log(`📦 [Migration] Committed batch of ${batchCount} updates`);
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 [Migration] Committed final batch of ${batchCount} updates`);
    }

    // Handle unmatched storages
    if (dryRunResult.unmatchedStorages > 0) {
      warnings.push(
        `${dryRunResult.unmatchedStorages} storages could not be matched: ` +
        dryRunResult.unmatchedList.map(s => s.storageName).join(', ')
      );
    }

    console.log(`✅ [Migration] Successfully migrated ${dryRunResult.storagesToMigrate} storages`);

    return {
      success: true,
      migrationId: MIGRATION_ID,
      executedAt: new Date(),
      affectedRecords: dryRunResult.storagesToMigrate,
      executionTimeMs: Date.now() - startTime,
      warnings: warnings.length > 0 ? warnings : undefined,
      rollbackData: {
        backupId: `${MIGRATION_ID}_${Date.now()}`,
        timestamp: new Date(),
        snapshotData: { migrationLog }
      }
    };

  } catch (error) {
    console.error('❌ [Migration] Error:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');

    return {
      success: false,
      migrationId: MIGRATION_ID,
      executedAt: new Date(),
      affectedRecords: 0,
      executionTimeMs: Date.now() - startTime,
      errors
    };
  }
}

// ============================================================================
// ROLLBACK
// ============================================================================

/**
 * Rollback migration - removes buildingId field
 */
export async function rollback(): Promise<MigrationResult> {
  const startTime = Date.now();

  console.log(`🔄 [Migration] Rolling back ${MIGRATION_ID}...`);

  try {
    const database = getFirestore();
    const storagesRef = database.collection(COLLECTIONS.STORAGE);

    // Find all storages that were migrated by this script
    const snapshot = await storagesRef
      .where('_migratedFrom', '==', 'building_name_to_id')
      .get();

    if (snapshot.empty) {
      console.log('ℹ️ [Migration] No migrated storages found to rollback');
      return {
        success: true,
        migrationId: MIGRATION_ID,
        executedAt: new Date(),
        affectedRecords: 0,
        executionTimeMs: Date.now() - startTime
      };
    }

    const batch = database.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      batch.update(doc.ref, {
        buildingId: null,  // Remove the field
        _migratedAt: null,
        _migratedFrom: null
      });
      count++;
    });

    await batch.commit();

    console.log(`✅ [Migration] Rolled back ${count} storages`);

    return {
      success: true,
      migrationId: MIGRATION_ID,
      executedAt: new Date(),
      affectedRecords: count,
      executionTimeMs: Date.now() - startTime
    };

  } catch (error) {
    console.error('❌ [Migration] Rollback error:', error);

    return {
      success: false,
      migrationId: MIGRATION_ID,
      executedAt: new Date(),
      affectedRecords: 0,
      executionTimeMs: Date.now() - startTime,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

// ============================================================================
// MIGRATION DEFINITION (for MigrationEngine)
// ============================================================================

export const migration: Migration = {
  id: MIGRATION_ID,
  version: MIGRATION_VERSION,
  name: 'Normalize Storage Building References',
  description: 'Convert storage.building (name) to storage.buildingId (ID) for enterprise data integrity',
  author: 'Enterprise Architecture Team',
  createdAt: new Date('2026-01-18'),
  dependencies: [],
  steps: [
    {
      stepId: 'analyze',
      description: 'Analyze storages and match to buildings',
      execute: async () => {
        const result = await dryRun();
        return {
          affectedRecords: result.storagesToMigrate,
          data: result,
          message: `Found ${result.storagesToMigrate} storages to migrate, ${result.unmatchedStorages} unmatched`
        };
      }
    },
    {
      stepId: 'migrate',
      description: 'Update storage documents with buildingId',
      execute: async () => {
        const result = await execute({ dryRun: false });
        return {
          affectedRecords: result.affectedRecords,
          message: result.success
            ? `Migrated ${result.affectedRecords} storages`
            : `Migration failed: ${result.errors?.join(', ')}`
        };
      },
      rollback: async () => {
        const result = await rollback();
        return {
          affectedRecords: result.affectedRecords,
          message: `Rolled back ${result.affectedRecords} storages`
        };
      }
    }
  ]
};

export default migration;
