/**
 * 🏢 ENTERPRISE DATA MIGRATION SCRIPT
 *
 * Μετακινεί τα storage units από το `units` collection στο `storage_units` collection
 * σύμφωνα με την αρχιτεκτονική του local_4.log
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ (local_4.log):
 * Building
 * ├── Μονάδες (Units)      ← units collection
 * ├── Αποθήκες (Storage)   ← storage_units collection
 * └── Πάρκινγκ (Parking)   ← parkingSpaces collection
 *
 * USAGE:
 * node scripts/migrate-storages-to-collection.js [--dry-run] [--delete-after]
 *
 * OPTIONS:
 * --dry-run       Preview changes without modifying database
 * --delete-after  Delete storage units from units collection after migration
 *
 * @author Enterprise Architecture Team
 * @date 2026-01-08
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} = require('firebase/firestore');

// Firebase configuration - Simple inline env loader (no dotenv dependency)
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found at:', envPath);
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}
loadEnv();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collection names
const UNITS_COLLECTION = 'units';
const STORAGE_COLLECTION = 'storage_units';

// Storage type identifiers
const STORAGE_TYPES = ['storage', 'αποθήκη', 'αποθηκη'];

/**
 * Check if a unit is a storage unit
 */
function isStorageUnit(unit) {
  const type = (unit.type || '').toLowerCase();
  const propertyType = (unit.propertyType || '').toLowerCase();
  const name = (unit.name || unit.title || '').toLowerCase();

  return STORAGE_TYPES.some(storageType =>
    type.includes(storageType) ||
    propertyType.includes(storageType) ||
    name.includes('αποθήκη') ||
    name.includes('αποθηκη')
  );
}

/**
 * Generate enterprise storage ID
 */
function generateStorageId() {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  return `stor_${uuid}`;
}

/**
 * Transform unit data to storage format
 */
function transformToStorage(unit, originalId) {
  return {
    // Keep original fields
    name: unit.name || unit.title || `Αποθήκη ${originalId.slice(0, 4)}`,
    buildingId: unit.buildingId || null,
    projectId: unit.projectId || null,
    floorId: unit.floorId || null,
    floor: unit.floor || 0,

    // Storage-specific fields
    type: determineStorageType(unit),
    area: unit.area || 0,
    status: unit.status || 'available',

    // Metadata
    originalUnitId: originalId, // Reference to original unit for audit
    migratedAt: new Date().toISOString(),
    migratedFrom: 'units_collection',

    // Preserve other fields
    price: unit.price || null,
    notes: unit.notes || unit.description || null,
    createdAt: unit.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Determine storage type based on floor
 */
function determineStorageType(unit) {
  const floor = unit.floor || 0;
  if (floor < 0) return 'basement';
  if (floor === 0) return 'ground';
  return 'external';
}

/**
 * Main migration function
 */
async function migrateStorages(options = {}) {
  const { dryRun = false, deleteAfter = false } = options;

  console.log('\\n🏢 ENTERPRISE STORAGE MIGRATION');
  console.log('================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Delete after migration: ${deleteAfter ? 'YES' : 'NO'}`);
  console.log('');

  try {
    // 1. Get all units
    console.log('📥 Fetching units from Firestore...');
    const unitsSnapshot = await getDocs(collection(db, UNITS_COLLECTION));

    const allUnits = [];
    unitsSnapshot.forEach(doc => {
      allUnits.push({ id: doc.id, ...doc.data() });
    });

    console.log(`   Found ${allUnits.length} total units`);

    // 2. Filter storage units
    const storageUnits = allUnits.filter(isStorageUnit);
    const regularUnits = allUnits.filter(unit => !isStorageUnit(unit));

    console.log(`   - ${regularUnits.length} regular units (διαμερίσματα, καταστήματα, κλπ)`);
    console.log(`   - ${storageUnits.length} storage units (αποθήκες)`);

    if (storageUnits.length === 0) {
      console.log('\\n✅ No storage units found in units collection. Nothing to migrate.');
      return;
    }

    // 3. Preview storage units
    console.log('\\n📋 Storage units to migrate:');
    storageUnits.forEach((unit, index) => {
      console.log(`   ${index + 1}. ${unit.name || unit.title || unit.id}`);
      console.log(`      Type: ${unit.type || 'N/A'}, Floor: ${unit.floor || 'N/A'}`);
      console.log(`      Building: ${unit.buildingId || 'N/A'}`);
    });

    if (dryRun) {
      console.log('\\n⚠️ DRY RUN - No changes made');
      console.log('   Run without --dry-run to perform actual migration');
      return;
    }

    // 4. Perform migration
    console.log('\\n🚀 Starting migration...');

    const batch = writeBatch(db);
    const migratedIds = [];

    for (const unit of storageUnits) {
      const newId = generateStorageId();
      const storageData = transformToStorage(unit, unit.id);

      // Add to storage_units collection
      const storageRef = doc(db, STORAGE_COLLECTION, newId);
      batch.set(storageRef, storageData);

      migratedIds.push({ oldId: unit.id, newId, name: unit.name || unit.title });
      console.log(`   ✅ ${unit.name || unit.id} → ${newId}`);
    }

    // Commit batch write
    await batch.commit();
    console.log(`\\n✅ Successfully migrated ${migratedIds.length} storage units`);

    // 5. Optionally delete from units collection
    if (deleteAfter) {
      console.log('\\n🗑️ Deleting migrated units from units collection...');

      for (const { oldId, name } of migratedIds) {
        await deleteDoc(doc(db, UNITS_COLLECTION, oldId));
        console.log(`   ❌ Deleted: ${name} (${oldId})`);
      }

      console.log(`\\n✅ Deleted ${migratedIds.length} units from units collection`);
    }

    // 6. Summary
    console.log('\\n📊 MIGRATION SUMMARY');
    console.log('=====================');
    console.log(`Total units processed: ${allUnits.length}`);
    console.log(`Storage units migrated: ${migratedIds.length}`);
    console.log(`Remaining units: ${regularUnits.length}`);
    console.log(`Storage units ${deleteAfter ? 'deleted' : 'kept'} in units collection`);

    // Output mapping for reference
    console.log('\\n📝 ID Mapping (old → new):');
    migratedIds.forEach(({ oldId, newId, name }) => {
      console.log(`   ${oldId} → ${newId} (${name})`);
    });

  } catch (error) {
    console.error('\\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  deleteAfter: args.includes('--delete-after'),
};

// Run migration
migrateStorages(options)
  .then(() => {
    console.log('\\n✅ Migration script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\\n❌ Migration script failed:', error);
    process.exit(1);
  });
