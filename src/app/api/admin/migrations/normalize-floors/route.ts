/**
 * =============================================================================
 * DATABASE NORMALIZATION MIGRATION - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Enterprise database normalization (3NF) using Firebase Admin SDK.
 * Extracts embedded buildingFloors arrays to normalized floors collection.
 *
 * @module api/admin/migrations/normalize-floors
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - System-Level Operation: Cross-tenant database normalization
 * - Multi-Layer Security: withAuth + explicit super_admin check
 * - Comprehensive audit logging with logMigrationExecuted
 * - Enterprise patterns: SAP/Microsoft data normalization
 *
 * 🏢 ENTERPRISE: Database Normalization (3NF)
 * - Third Normal Form (3NF) compliance
 * - Foreign key relationship establishment
 * - Referential integrity verification
 * - Batch operations με consistency guarantees
 * - All operations logged to audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
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
  project?: string; // 🏢 ENTERPRISE: Legacy field name
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
    sourceType: string;
    originalBuildingId: string;
  };
}

/**
 * POST /api/admin/migrations/normalize-floors
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 */
export async function POST(request: NextRequest): Promise<Response> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleFloorsNormalization(req, ctx);
    },
    { permissions: 'admin:migrations:execute' }
  );

  return handler(request);
}

async function handleFloorsNormalization(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  // 🔐 ENTERPRISE: Database normalization is SYSTEM-LEVEL (cross-tenant)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [MIGRATION_NORMALIZE] BLOCKED: Non-super_admin attempted database normalization: ` +
      `${ctx.email} (${ctx.globalRole})`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute database normalization migrations',
        message: 'Database normalization is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  console.log(`🔐 [MIGRATION_NORMALIZE] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

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
    // 🏢 ENTERPRISE: Type-safe floor data extraction
    interface VerificationFloor {
      id: string;
      buildingId?: string;
      migrationInfo?: { migrationId?: string };
    }
    const createdFloors: VerificationFloor[] = floorsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        buildingId: data.buildingId as string | undefined,
        migrationInfo: data.migrationInfo as { migrationId?: string } | undefined
      };
    });

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

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      '002_normalize_floors_collection_admin',
      {
        migrationName: 'Floors Collection Normalization (Enterprise 3NF)',
        method: 'firebase_admin_batch_normalization',
        affectedRecords: successfulInserts,
        executionTimeMs: executionTime,
        buildingsWithFloors: stats.buildingsWithFloors,
        totalFloorsExtracted: stats.totalFloorsToExtract,
        integrityScore: parseFloat(integrityScore.toFixed(1)),
        referentialIntegrity: {
          totalFloors: integrityResults.totalFloors,
          validFloors: integrityResults.floorsWithValidBuildingIds,
          orphanFloors: integrityResults.orphanFloors,
        },
        result: 'success',
        metadata,
      },
      `Database normalization executed by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ [MIGRATION_NORMALIZE] Audit logging failed (non-blocking):', err);
    });

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