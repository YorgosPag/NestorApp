#!/usr/bin/env node
/**
 * 🏢 ENTERPRISE: Standalone Migration Runner (CommonJS)
 *
 * Τρέχει το migration 006 (storage building references) απευθείας
 *
 * USAGE:
 *   node scripts/run-migration-006.cjs --dry-run   # Δείχνει τι θα αλλάξει
 *   node scripts/run-migration-006.cjs --execute   # Εκτελεί το migration
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load .env.local for development (manual parsing)
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (err) {
    // Ignore errors
  }
}

loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// ============================================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================================

// Check if already initialized
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    console.error('❌ No FIREBASE_PROJECT_ID found in environment');
    process.exit(1);
  }

  try {
    // PRIORITY 1: Base64 encoded service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
      console.log('🔐 Using Base64 encoded service account...');
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decoded);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
      console.log('✅ Firebase Admin initialized with Base64 service account');
    }
    // PRIORITY 2: Plain JSON service account
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log('🔐 Using JSON service account...');
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
      console.log('✅ Firebase Admin initialized with JSON service account');
    }
    // PRIORITY 3: Application default credentials
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId
      });
      console.log('✅ Firebase Admin initialized with application default credentials');
    }
    else {
      console.error('❌ No Firebase credentials found');
      console.log('\n📋 Required environment variables (one of):');
      console.log('   1. FIREBASE_SERVICE_ACCOUNT_KEY_B64 (Base64 encoded)');
      console.log('   2. FIREBASE_SERVICE_ACCOUNT_KEY (JSON)');
      console.log('   3. GOOGLE_APPLICATION_CREDENTIALS (file path)');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin:', err.message);
    process.exit(1);
  }
}

const db = admin.firestore();

// ============================================================================
// COLLECTIONS
// ============================================================================

const COLLECTIONS = {
  STORAGE: 'storage_units',
  BUILDINGS: 'buildings',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchBuildingsMap() {
  const snapshot = await db.collection(COLLECTIONS.BUILDINGS).get();
  const buildingsMap = new Map();
  const buildingsArray = []; // For fuzzy matching

  snapshot.forEach((doc) => {
    const data = doc.data();
    const building = {
      id: doc.id,
      name: data.name || '',
      projectId: data.projectId || ''
    };

    if (building.name) {
      // Exact match by full name (lowercase)
      buildingsMap.set(building.name.toLowerCase().trim(), building);
      // Also store in array for fuzzy matching
      buildingsArray.push(building);
    }
  });

  console.log(`📋 Loaded ${buildingsMap.size} buildings for matching`);

  // Return both map and array
  return { map: buildingsMap, array: buildingsArray };
}

/**
 * 🏢 ENTERPRISE: Fuzzy match building by name prefix
 *
 * Handles cases where storage.building = "ΚΤΙΡΙΟ Α"
 * but building.name = "ΚΤΙΡΙΟ Α - Παλαιολόγου"
 */
function fuzzyMatchBuilding(storageBuildingName, buildingsArray) {
  const searchTerm = storageBuildingName.toLowerCase().trim();

  // 1. Try exact match first
  const exactMatch = buildingsArray.find(b =>
    b.name.toLowerCase().trim() === searchTerm
  );
  if (exactMatch) return exactMatch;

  // 2. Try prefix match (building name starts with storage building name)
  const prefixMatch = buildingsArray.find(b =>
    b.name.toLowerCase().trim().startsWith(searchTerm)
  );
  if (prefixMatch) return prefixMatch;

  // 3. Try contains match (last resort)
  const containsMatch = buildingsArray.find(b =>
    b.name.toLowerCase().includes(searchTerm)
  );
  if (containsMatch) return containsMatch;

  return null;
}

async function fetchStorages() {
  const snapshot = await db.collection(COLLECTIONS.STORAGE).get();
  const storages = [];

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

async function dryRun() {
  console.log('\n🔍 Starting DRY-RUN analysis...\n');

  const { map: buildingsMap, array: buildingsArray } = await fetchBuildingsMap();
  const storages = await fetchStorages();

  const result = {
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

    // Skip if no building name
    if (!storage.building) {
      result.unmatchedStorages++;
      result.unmatchedList.push({
        storageId: storage.id,
        storageName: storage.name || 'Unnamed',
        buildingName: '(no building name set)'
      });
      continue;
    }

    // 🏢 ENTERPRISE: Use fuzzy matching for better results
    const matchedBuilding = fuzzyMatchBuilding(storage.building, buildingsArray);

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

async function execute() {
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
    console.log('   node scripts/run-migration-006.cjs --execute\n');
  } else {
    console.log('\nUsage:');
    console.log('  node scripts/run-migration-006.cjs --dry-run   # Preview changes');
    console.log('  node scripts/run-migration-006.cjs --execute   # Execute migration');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
