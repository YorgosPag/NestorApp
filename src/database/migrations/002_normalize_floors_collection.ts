/**
 * Migration 002: Normalize Floors Collection (Enterprise Database Normalization)
 *
 * PROBLEM:
 * - Floors are stored as embedded arrays (buildingFloors) inside buildings
 * - No direct queries possible on floors
 * - Performance issues when loading navigation
 * - Tight coupling between buildings and floors
 * - Scalability problems with large datasets
 *
 * ENTERPRISE SOLUTION:
 * - Extract buildingFloors to separate normalized 'floors' collection
 * - Establish proper foreign key relationships (floor.buildingId → building.id)
 * - Enable direct queries and indexing on floors
 * - Follow 3NF database normalization principles
 * - Maintain referential integrity
 */

import { Migration, MigrationStep } from './types';
import { collection, getDocs, doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('Migration002');

interface BuildingRecord {
  id: string;
  name: string;
  projectId: string;
  projectName?: string;
  project?: string;
  buildingFloors?: Array<{
    id: string;
    name: string;
    number: number;
    units?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface FloorRecord {
  id: string;
  name: string;
  number: number;
  buildingId: string;
  buildingName: string;
  projectId: string;
  projectName?: string;
  units?: number;
  createdAt: string;
  migrationInfo: {
    migrationId: string;
    migratedAt: string;
    sourceType: 'buildingFloors_embedded_array';
    originalBuildingId: string;
  };
  [key: string]: unknown;
}

interface MigrationData {
  buildings: BuildingRecord[];
  floorsToCreate: FloorRecord[];
  stats: {
    buildingsWithFloors: number;
    buildingsWithoutFloors: number;
    totalFloorsToExtract: number;
  };
}

class FloorsNormalizationMigrationSteps {
  private migrationData: MigrationData = {
    buildings: [],
    floorsToCreate: [],
    stats: {
      buildingsWithFloors: 0,
      buildingsWithoutFloors: 0,
      totalFloorsToExtract: 0
    }
  };

  /**
   * Step 1: Analyze buildings with embedded floors
   */
  analyzeBuildingsWithFloorsStep(): MigrationStep {
    return {
      stepId: 'analyze_buildings_with_floors',
      description: 'Analyze buildings with embedded buildingFloors arrays',
      execute: async () => {
        logger.info('Analyzing buildings with embedded floors...');

        // Fetch all buildings
        const buildingsSnapshot = await getDocs(collection(db, COLLECTIONS.BUILDINGS));
        this.migrationData.buildings = buildingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as BuildingRecord[];

        logger.info('Found buildings total', { count: this.migrationData.buildings.length });

        // Analyze which buildings have buildingFloors
        for (const building of this.migrationData.buildings) {
          if (building.buildingFloors && Array.isArray(building.buildingFloors) && building.buildingFloors.length > 0) {
            this.migrationData.stats.buildingsWithFloors++;
            this.migrationData.stats.totalFloorsToExtract += building.buildingFloors.length;

            logger.info('Building has embedded floors', { buildingName: building.name, floorCount: building.buildingFloors.length });
          } else {
            this.migrationData.stats.buildingsWithoutFloors++;
          }
        }

        logger.info('Analysis Results', {
          buildingsWithFloors: this.migrationData.stats.buildingsWithFloors,
          buildingsWithoutFloors: this.migrationData.stats.buildingsWithoutFloors,
          totalFloorsToExtract: this.migrationData.stats.totalFloorsToExtract
        });

        return {
          affectedRecords: this.migrationData.stats.totalFloorsToExtract,
          analysis: this.migrationData.stats
        };
      },
      validate: async () => {
        return this.migrationData.buildings.length > 0;
      }
    };
  }

  /**
   * Step 2: Create normalized floor records
   */
  createNormalizedFloorRecordsStep(): MigrationStep {
    return {
      stepId: 'create_normalized_floor_records',
      description: 'Create normalized floor records with proper foreign key relationships',
      execute: async () => {
        logger.info('Creating normalized floor records...');

        this.migrationData.floorsToCreate = [];

        for (const building of this.migrationData.buildings) {
          if (!building.buildingFloors || !Array.isArray(building.buildingFloors)) {
            continue;
          }

          logger.info('Processing building', { buildingName: building.name });

          for (const embeddedFloor of building.buildingFloors) {
            // Create normalized floor record with enterprise structure
            const normalizedFloor: FloorRecord = {
              // Preserve any additional embedded data
              ...embeddedFloor,

              id: embeddedFloor.id || `floor_${building.id}_${embeddedFloor.number}`,
              name: embeddedFloor.name,
              number: embeddedFloor.number,

              // Foreign key relationships (Enterprise 3NF pattern)
              buildingId: building.id,
              buildingName: building.name,
              projectId: building.projectId,
              projectName: building.projectName || building.project,

              // Additional metadata
              units: embeddedFloor.units || 0,

              // Enterprise audit trail
              createdAt: new Date().toISOString(),
              migrationInfo: {
                migrationId: '002_normalize_floors_collection',
                migratedAt: new Date().toISOString(),
                sourceType: 'buildingFloors_embedded_array',
                originalBuildingId: building.id
              },

            };

            this.migrationData.floorsToCreate.push(normalizedFloor);
            logger.info('Created floor record', { floorName: normalizedFloor.name, buildingName: building.name });
          }
        }

        logger.info('Created normalized floor records', { count: this.migrationData.floorsToCreate.length });

        return {
          affectedRecords: this.migrationData.floorsToCreate.length,
          floorsCreated: this.migrationData.floorsToCreate.length
        };
      },
      validate: async () => {
        return this.migrationData.floorsToCreate.length === this.migrationData.stats.totalFloorsToExtract;
      }
    };
  }

  /**
   * Step 3: Insert normalized floors into collection (Enterprise Batch Operation)
   */
  insertNormalizedFloorsStep(): MigrationStep {
    return {
      stepId: 'insert_normalized_floors',
      description: 'Insert normalized floors into floors collection using enterprise batch operations',
      execute: async () => {
        logger.info('Inserting normalized floors into floors collection...');

        const insertResults = {
          successfulInserts: 0,
          failedInserts: 0,
          errors: [] as string[]
        };

        // Enterprise pattern: Batch operations for performance
        const BATCH_SIZE = 500; // Firestore batch limit
        const batches = [];

        for (let i = 0; i < this.migrationData.floorsToCreate.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const batchFloors = this.migrationData.floorsToCreate.slice(i, i + BATCH_SIZE);

          logger.info('Processing batch', { batchNumber: Math.floor(i / BATCH_SIZE) + 1, floorCount: batchFloors.length });

          for (const floor of batchFloors) {
            try {
              // Create new document in floors collection
              const floorRef = doc(collection(db, COLLECTIONS.FLOORS), floor.id);
              batch.set(floorRef, floor);

              logger.info('Queued floor', { floorName: floor.name, buildingName: floor.buildingName });

            } catch (error) {
              const errorMessage = `Failed to queue floor ${floor.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              insertResults.errors.push(errorMessage);
              logger.error(errorMessage);
            }
          }

          batches.push(batch);
        }

        // Execute all batches (Enterprise atomic operations)
        logger.info('Executing batches', { count: batches.length });

        for (let i = 0; i < batches.length; i++) {
          try {
            await batches[i].commit();
            const batchSize = Math.min(BATCH_SIZE, this.migrationData.floorsToCreate.length - (i * BATCH_SIZE));
            insertResults.successfulInserts += batchSize;
            logger.info('Batch committed successfully', { batchNumber: i + 1, totalBatches: batches.length, floorCount: batchSize });

          } catch (error) {
            const batchSize = Math.min(BATCH_SIZE, this.migrationData.floorsToCreate.length - (i * BATCH_SIZE));
            insertResults.failedInserts += batchSize;
            const errorMessage = `Batch ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            insertResults.errors.push(errorMessage);
            logger.error(errorMessage);
          }
        }

        logger.info('Insert Results', { successful: insertResults.successfulInserts, failed: insertResults.failedInserts });

        if (insertResults.failedInserts > 0) {
          throw new Error(`${insertResults.failedInserts} floor inserts failed. See errors above.`);
        }

        return {
          affectedRecords: insertResults.successfulInserts,
          insertResults
        };
      },
      rollback: async () => {
        logger.info('Rolling back floor inserts...');

        // Delete all created floors
        for (const floor of this.migrationData.floorsToCreate) {
          try {
            const floorRef = doc(db, COLLECTIONS.FLOORS, floor.id);
            await updateDoc(floorRef, { deleted: true, deletedAt: new Date().toISOString() });
            logger.info('Marked floor as deleted', { floorName: floor.name });
          } catch (error) {
            logger.error('Failed to rollback floor', { floorName: floor.name, error });
          }
        }
      },
      validate: async () => {
        // Verify all floors were inserted correctly
        for (const floor of this.migrationData.floorsToCreate) {
          const floorDoc = await getDoc(doc(db, COLLECTIONS.FLOORS, floor.id));
          if (!floorDoc.exists()) {
            return false;
          }
        }
        return true;
      }
    };
  }

  /**
   * Step 4: Verify normalization integrity
   */
  verifyNormalizationIntegrityStep(): MigrationStep {
    return {
      stepId: 'verify_normalization_integrity',
      description: 'Verify foreign key relationships and data integrity after normalization',
      execute: async () => {
        logger.info('Verifying normalization integrity...');

        // Re-fetch floors to verify
        const floorsSnapshot = await getDocs(collection(db, COLLECTIONS.FLOORS));
        const createdFloors = floorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as FloorRecord[];

        const integrityResults = {
          totalFloors: createdFloors.length,
          floorsWithValidBuildingIds: 0,
          floorsWithValidProjectIds: 0,
          orphanFloors: 0,
          floorsFromMigration: 0
        };

        for (const floor of createdFloors) {
          // Check if from this migration
          if (floor.migrationInfo?.migrationId === '002_normalize_floors_collection') {
            integrityResults.floorsFromMigration++;
          }

          // Verify foreign key relationships
          const buildingExists = this.migrationData.buildings.some(building => building.id === floor.buildingId);
          if (buildingExists) {
            integrityResults.floorsWithValidBuildingIds++;
          } else {
            integrityResults.orphanFloors++;
            logger.warn('Orphan floor found', { floorName: floor.name, buildingId: floor.buildingId });
          }

          // Verify project relationships
          const projectExists = this.migrationData.buildings.some(building =>
            building.projectId === floor.projectId && building.id === floor.buildingId
          );
          if (projectExists) {
            integrityResults.floorsWithValidProjectIds++;
          }
        }

        const integrityScore = (integrityResults.floorsWithValidBuildingIds / integrityResults.totalFloors) * 100;
        logger.info('Normalization Integrity Results', {
          totalFloors: integrityResults.totalFloors,
          floorsFromMigration: integrityResults.floorsFromMigration,
          validBuildingIds: integrityResults.floorsWithValidBuildingIds,
          validProjectIds: integrityResults.floorsWithValidProjectIds,
          orphanFloors: integrityResults.orphanFloors,
          referentialIntegrity: `${integrityScore.toFixed(1)}%`
        });

        return {
          affectedRecords: integrityResults.floorsFromMigration,
          data: integrityResults
        };
      },
      validate: async () => {
        // Migration successful if at least 95% of floors have valid foreign keys
        const floorsSnapshot = await getDocs(collection(db, COLLECTIONS.FLOORS));
        const floors = floorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FloorRecord[];

        const validFloors = floors.filter(floor =>
          this.migrationData.buildings.some(building => building.id === floor.buildingId)
        );

        const integrityScore = (validFloors.length / floors.length) * 100;
        return integrityScore >= 95;
      }
    };
  }
}

// Export the migration definition
export function createFloorsNormalizationMigration(): Migration {
  const migrationSteps = new FloorsNormalizationMigrationSteps();

  return {
    id: '002_normalize_floors_collection',
    version: '1.0.0',
    name: 'Normalize Floors Collection (Enterprise Database Normalization)',
    description: 'Extracts embedded buildingFloors arrays to normalized floors collection with proper foreign key relationships following 3NF principles',
    author: 'Claude Enterprise Migration System',
    createdAt: new Date(),
    dependencies: [], // No dependencies on previous migrations
    steps: [
      migrationSteps.analyzeBuildingsWithFloorsStep(),
      migrationSteps.createNormalizedFloorRecordsStep(),
      migrationSteps.insertNormalizedFloorsStep(),
      migrationSteps.verifyNormalizationIntegrityStep()
    ]
  };
}
