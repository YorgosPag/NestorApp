/**
 * Enterprise Database Normalization: Floors Collection (Admin SDK)
 * Extracts embedded buildingFloors to normalized floors collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { COLLECTIONS } from '@/config/firestore-collections';

// Initialize Admin SDK if not already initialized
let adminDb: FirebaseFirestore.Firestore;

try {
  if (getApps().length === 0) {
    const app = initializeApp({
      projectId: 'nestor-pagonis'
    });
    adminDb = getFirestore(app);
  } else {
    adminDb = getFirestore();
  }
} catch (error) {
  console.error('Failed to initialize Admin SDK:', error);
}

interface BuildingRecord {
  id: string;
  name: string;
  projectId: string;
  projectName?: string;
  buildingFloors?: Array<{
    id: string;
    name: string;
    number: number;
    units?: number;
    [key: string]: any;
  }>;
  [key: string]: any;
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
    sourceType: string;
    originalBuildingId: string;
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  try {
    console.log('🏢 ENTERPRISE DATABASE NORMALIZATION STARTING...');
    console.log('📋 Migration: Floors Collection Normalization (3NF)');

    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized');
    }

    // Step 1: Fetch all buildings with embedded floors
    console.log('📋 Step 1: Analyzing buildings with embedded floors...');
    const buildingsSnapshot = await adminDb.collection(COLLECTIONS.BUILDINGS).get();
    const buildings: BuildingRecord[] = buildingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BuildingRecord[];

    console.log(`   Found ${buildings.length} buildings`);

    // Analyze which buildings have embedded floors
    const stats = {
      buildingsWithFloors: 0,
      buildingsWithoutFloors: 0,
      totalFloorsToExtract: 0
    };

    const floorsToCreate: FloorRecord[] = [];

    for (const building of buildings) {
      if (building.buildingFloors && Array.isArray(building.buildingFloors) && building.buildingFloors.length > 0) {
        stats.buildingsWithFloors++;
        stats.totalFloorsToExtract += building.buildingFloors.length;

        console.log(`   📋 Building "${building.name}" has ${building.buildingFloors.length} embedded floors`);

        // Create normalized floor records
        for (const embeddedFloor of building.buildingFloors) {
          const normalizedFloor: FloorRecord = {
            id: embeddedFloor.id || `floor_${building.id}_${embeddedFloor.number}`,
            name: embeddedFloor.name,
            number: embeddedFloor.number,

            // Enterprise foreign key relationships (3NF)
            buildingId: building.id,
            buildingName: building.name,
            projectId: building.projectId,
            projectName: building.projectName || building.project,

            // Metadata
            units: embeddedFloor.units || 0,

            // Enterprise audit trail
            createdAt: new Date().toISOString(),
            migrationInfo: {
              migrationId: '002_normalize_floors_collection_admin',
              migratedAt: new Date().toISOString(),
              sourceType: 'buildingFloors_embedded_array',
              originalBuildingId: building.id
            }
          };

          floorsToCreate.push(normalizedFloor);
        }
      } else {
        stats.buildingsWithoutFloors++;
      }
    }

    console.log('📊 Analysis Results:');
    console.log(`   - Buildings with embedded floors: ${stats.buildingsWithFloors}`);
    console.log(`   - Buildings without embedded floors: ${stats.buildingsWithoutFloors}`);
    console.log(`   - Total floors to extract: ${stats.totalFloorsToExtract}`);

    // Step 2: Insert normalized floors (Enterprise batch operations)
    console.log('📋 Step 2: Inserting normalized floors...');

    const BATCH_SIZE = 500;
    let successfulInserts = 0;
    let failedInserts = 0;

    for (let i = 0; i < floorsToCreate.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const batchFloors = floorsToCreate.slice(i, i + BATCH_SIZE);

      console.log(`   📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batchFloors.length} floors`);

      for (const floor of batchFloors) {
        const floorRef = adminDb.collection(COLLECTIONS.FLOORS).doc(floor.id);
        batch.set(floorRef, floor);
        console.log(`     ✅ Queued floor: ${floor.name} (${floor.buildingName})`);
      }

      try {
        await batch.commit();
        successfulInserts += batchFloors.length;
        console.log(`   ✅ Batch committed successfully (${batchFloors.length} floors)`);
      } catch (error) {
        failedInserts += batchFloors.length;
        console.error(`   ❌ Batch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Step 3: Verify normalization integrity
    console.log('📋 Step 3: Verifying normalization integrity...');
    const floorsSnapshot = await adminDb.collection(COLLECTIONS.FLOORS).get();
    const createdFloors = floorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const integrityResults = {
      totalFloors: createdFloors.length,
      floorsWithValidBuildingIds: 0,
      floorsFromThisMigration: 0,
      orphanFloors: 0
    };

    for (const floor of createdFloors) {
      // Check if from this migration
      if (floor.migrationInfo?.migrationId === '002_normalize_floors_collection_admin') {
        integrityResults.floorsFromThisMigration++;
      }

      // Verify foreign key relationships
      const buildingExists = buildings.some(building => building.id === floor.buildingId);
      if (buildingExists) {
        integrityResults.floorsWithValidBuildingIds++;
      } else {
        integrityResults.orphanFloors++;
      }
    }

    const integrityScore = (integrityResults.floorsWithValidBuildingIds / integrityResults.totalFloors) * 100;

    console.log('📊 Final Results:');
    console.log(`   - Total floors in collection: ${integrityResults.totalFloors}`);
    console.log(`   - Floors from this migration: ${integrityResults.floorsFromThisMigration}`);
    console.log(`   - Successful inserts: ${successfulInserts}`);
    console.log(`   - Failed inserts: ${failedInserts}`);
    console.log(`   - Referential integrity: ${integrityScore.toFixed(1)}%`);

    if (failedInserts > 0) {
      throw new Error(`${failedInserts} floor inserts failed`);
    }

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      migration: {
        id: '002_normalize_floors_collection_admin',
        name: 'Floors Collection Normalization (Enterprise 3NF)',
        method: 'firebase_admin_batch_normalization'
      },
      execution: {
        executionTimeMs: executionTime,
        affectedRecords: successfulInserts,
        completedAt: new Date().toISOString()
      },
      results: {
        stats,
        floorsCreated: floorsToCreate.map(f => ({
          id: f.id,
          name: f.name,
          buildingName: f.buildingName,
          projectName: f.projectName
        })),
        integrity: {
          totalFloors: integrityResults.totalFloors,
          floorsFromMigration: integrityResults.floorsFromThisMigration,
          integrityScore: parseFloat(integrityScore.toFixed(1)),
          orphanFloors: integrityResults.orphanFloors
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Database Normalization'
      }
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ ENTERPRISE NORMALIZATION FAILED: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        execution: {
          executionTimeMs: executionTime,
          failedAt: new Date().toISOString()
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          system: 'Nestor Pagonis Enterprise Platform - Database Normalization'
        }
      },
      { status: 500 }
    );
  }
}