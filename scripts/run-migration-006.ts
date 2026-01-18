#!/usr/bin/env ts-node
/**
 * 🏢 ENTERPRISE: Standalone Migration Runner
 *
 * Τρέχει το migration 006 (storage building references) απευθείας
 * χωρίς να χρειάζεται authentication μέσω API.
 *
 * USAGE:
 *   npx ts-node scripts/run-migration-006.ts --dry-run   # Δείχνει τι θα αλλάξει
 *   npx ts-node scripts/run-migration-006.ts --execute   # Εκτελεί το migration
 *
 * @author Enterprise Architecture Team
 * @date 2026-01-18
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// ============================================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================================

// Load service account from environment or file
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '..', 'config', 'firebase-service-account.json');

// Check if already initialized
if (!admin.apps.length) {
  try {
    // Try to use application default credentials first
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('✅ Firebase Admin initialized with application default credentials');
  } catch {
    // Fallback to service account file
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized with service account file');
    } catch (err) {
      console.error('❌ Failed to initialize Firebase Admin:', err);
      console.log('\n📋 To fix this, either:');
      console.log('   1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
      console.log('   2. Place firebase-service-account.json in config/ folder');
      process.exit(1);
    }
  }
}

const db = admin.firestore();

// ============================================================================
// COLLECTIONS (matching src/config/firestore-collections.ts)
// ============================================================================

const COLLECTIONS = {
  STORAGE: 'storage_units',
  BUILDINGS: 'buildings',
};

// ============================================================================
// TYPES
// ============================================================================

interface StorageDocument {
  id: string;
  name?: string;
  building?: string;
  buildingId?: string;
  projectId?: string;
}

interface BuildingDocument {
  id: string;
  name?: string;
  projectId?: string;
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

async function fetchBuildingsMap(): Promise<Map<string, BuildingDocument>> {
  const snapshot = await db.collection(COLLECTIONS.BUILDINGS).get();
  const buildingsMap = new Map<string, BuildingDocument>();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const building: BuildingDocument = {
      id: doc.id,
      name: data.name || '',
      projectId: data.projectId || ''
    };

    if (building.name) {
      buildingsMap.set(building.name.toLowerCase().trim(), building);
    }
  });

  console.log(`📋 Loaded ${buildingsMap.size} buildings for matching`);
  return buildingsMap;
}

async function fetchStorages(): Promise<StorageDocument[]> {
  const snapshot = await db.collection(COLLECTIONS.STORAGE).get();
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

  console.log(`📋 Found ${storages.length} storage documents`);
  return storages;
}

// ============================================================================
// DRY RUN
// ============================================================================

async function dryRun(): Promise<DryRunResult> {
  console.log('\n🔍 Starting DRY-RUN analysis...\n');

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
    if (storage.buildingId) {
      result.storagesAlreadyMigrated++;
      continue;
    }

    const buildingNameLower = (storage.building || '').toLowerCase().trim();
    const matchedBuilding = buildingsMap.get(buildingNameLower);

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

  // Print results
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    DRY-RUN RESULTS                        ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Total storages:      ${result.totalStorages}`);
  console.log(`   To migrate:          ${result.storagesToMigrate}`);
  console.log(`   Already migrated:    ${result.storagesAlreadyMigrated}`);
  console.log(`   Unmatched:           ${result.unmatchedStorages}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (result.proposedAssignments.length > 0) {
    console.log('\n📋 Proposed changes:');
    result.proposedAssignments.forEach(a => {
      console.log(`   ✓ "${a.storageName}" → buildingId: ${a.matchedBuildingId} (${a.matchedBuildingName})`);
    });
  }

  if (result.unmatchedList.length > 0) {
    console.log('\n⚠️  Unmatched storages (will be skipped):');
    result.unmatchedList.forEach(s => {
      console.log(`   ✗ "${s.storageName}" - building name "${s.buildingName}" not found`);
    });
  }

  return result;
}

// ============================================================================
// EXECUTE MIGRATION
// ============================================================================

async function execute(): Promise<void> {
  console.log('\n🚀 Starting MIGRATION EXECUTION...\n');

  const dryRunResult = await dryRun();

  if (dryRunResult.storagesToMigrate === 0) {
    console.log('\n✅ No storages to migrate. All done!');
    return;
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                  EXECUTING MIGRATION                      ');
  console.log('═══════════════════════════════════════════════════════════');

  const batch = db.batch();
  let count = 0;

  for (const assignment of dryRunResult.proposedAssignments) {
    const storageRef = db.collection(COLLECTIONS.STORAGE).doc(assignment.storageId);

    batch.update(storageRef, {
      buildingId: assignment.matchedBuildingId,
      _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      _migratedFrom: 'building_name_to_id'
    });

    count++;
    console.log(`   📝 Updated: ${assignment.storageName}`);
  }

  await batch.commit();

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   ✅ Successfully migrated ${count} storages!`);
  console.log('═══════════════════════════════════════════════════════════');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🏢 ENTERPRISE MIGRATION: Storage Building References     ║');
  console.log('║     Version 1.0.0                                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  if (args.includes('--execute')) {
    await execute();
  } else if (args.includes('--dry-run') || args.length === 0) {
    await dryRun();
    console.log('\n💡 To execute the migration, run:');
    console.log('   npx ts-node scripts/run-migration-006.ts --execute\n');
  } else {
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/run-migration-006.ts --dry-run   # Preview changes');
    console.log('  npx ts-node scripts/run-migration-006.ts --execute   # Execute migration');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
