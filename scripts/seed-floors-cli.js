/**
 * 🏢 SEED FLOORS CLI SCRIPT - MULTI-BUILDING VERSION
 *
 * Τρέξε αυτό το script από το terminal:
 * node scripts/seed-floors-cli.js
 *
 * Τι κάνει:
 * 1. Βρίσκει ΟΛΕΣ τα buildings από τη βάση
 * 2. Δημιουργεί ορόφους για ΚΑΘΕ building
 * 3. Χρησιμοποιεί enterprise IDs (flr_uuid)
 *
 * Απαιτεί: Firebase Admin SDK credentials
 * - Set GOOGLE_APPLICATION_CREDENTIALS environment variable
 * - Or run: gcloud auth application-default login
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const path = require('path');

// =============================================================================
// 🏢 CONFIGURATION
// =============================================================================

// 🔒 Company ID for tenant isolation
const TARGET_COMPANY_ID = 'comp_ySl83AUCbGRjn7bDGxn5';

/**
 * 🏢 Floor templates - θα δημιουργηθούν για ΚΑΘΕ building
 * Μπορείς να προσθέσεις/αφαιρέσεις ορόφους εδώ
 */
const FLOOR_TEMPLATES = [
  { number: -1, name: 'Υπόγειο', units: 0, description: 'Αποθήκες και parking' },
  { number: 0, name: 'Ισόγειο', units: 2, description: 'Καταστήματα και είσοδος' },
  { number: 1, name: '1ος Όροφος', units: 2, description: 'Διαμερίσματα' },
  { number: 2, name: '2ος Όροφος', units: 2, description: 'Διαμερίσματα' },
  { number: 3, name: '3ος Όροφος', units: 2, description: 'Διαμερίσματα' },
  { number: 4, name: '4ος Όροφος', units: 1, description: 'Ρετιρέ' },
];

/**
 * 🏢 Fallback buildings αν δεν βρεθούν στη βάση
 * Αυτά είναι τα γνωστά buildings
 */
const FALLBACK_BUILDINGS = [
  {
    id: 'G8kMxQ2pVwN5jR7tE1sA',
    name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
    projectId: 'xL2nV4bC6mZ8kJ9hG1fQ',
    projectName: 'Παλαιολόγου Πολυκατοικία',
  },
  {
    id: 'building_1_palaiologou',
    name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου (Legacy)',
    projectId: '1001',
    projectName: 'Παλαιολόγου Πολυκατοικία',
  },
];

// =============================================================================
// 🏢 ENTERPRISE ID GENERATION
// =============================================================================

function generateFloorId() {
  const uuid = crypto.randomUUID();
  return `flr_${uuid}`;
}

// =============================================================================
// 🏢 FIREBASE INITIALIZATION
// =============================================================================

function initializeFirebase() {
  if (admin.apps.length) {
    return admin.firestore();
  }

  // Try service account files (multiple naming conventions)
  const possiblePaths = [
    path.join(__dirname, '..', 'service-account.json'),
    path.join(__dirname, '..', 'pagonis-87766-firebase-adminsdk-fbsvc-469209d7a0.json'),
  ];

  let serviceAccountPath = null;
  for (const p of possiblePaths) {
    try {
      require.resolve(p);
      serviceAccountPath = p;
      break;
    } catch (e) {
      // File doesn't exist, try next
    }
  }

  if (!serviceAccountPath) {
    serviceAccountPath = possiblePaths[0]; // Will fail with helpful error
  }

  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized with service account');
    return admin.firestore();
  } catch (e) {
    // Fallback to application default credentials
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('✅ Firebase Admin initialized with default credentials');
      return admin.firestore();
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin');
      console.error('');
      console.error('📋 OPTIONS:');
      console.error('   1. Place service-account.json in project root');
      console.error('   2. Set GOOGLE_APPLICATION_CREDENTIALS env variable');
      console.error('   3. Run: gcloud auth application-default login');
      console.error('');
      process.exit(1);
    }
  }
}

// =============================================================================
// 🏢 FETCH ALL BUILDINGS
// =============================================================================

async function fetchAllBuildings(db) {
  console.log('\n🔍 Αναζήτηση buildings στη βάση...');

  const buildingsRef = db.collection('buildings');
  const snapshot = await buildingsRef.get();

  if (snapshot.empty) {
    console.log('⚠️  Δεν βρέθηκαν buildings στη βάση. Χρήση fallback buildings...');
    return FALLBACK_BUILDINGS;
  }

  const buildings = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    buildings.push({
      id: doc.id,
      name: data.name || data.buildingName || `Building ${doc.id}`,
      projectId: data.projectId || data.project || 'unknown',
      projectName: data.projectName || '',
      companyId: data.companyId || TARGET_COMPANY_ID,
    });
  });

  console.log(`✅ Βρέθηκαν ${buildings.length} buildings`);
  buildings.forEach((b, i) => {
    console.log(`   ${i + 1}. ${b.name} (${b.id})`);
  });

  return buildings;
}

// =============================================================================
// 🏢 MAIN FUNCTION
// =============================================================================

async function seedFloors() {
  console.log('');
  console.log('🏢 SEED FLOORS SCRIPT - MULTI-BUILDING VERSION');
  console.log('='.repeat(70));

  const db = initializeFirebase();
  const floorsRef = db.collection('floors');

  // =======================================================================
  // STEP 1: Fetch all buildings
  // =======================================================================
  const buildings = await fetchAllBuildings(db);

  if (buildings.length === 0) {
    console.error('❌ Δεν βρέθηκαν buildings. Δεν μπορώ να συνεχίσω.');
    process.exit(1);
  }

  // =======================================================================
  // STEP 2: Delete existing floors
  // =======================================================================
  console.log('\n🗑️  Διαγραφή υπαρχόντων floors...');

  const existingSnapshot = await floorsRef.get();
  const deletedIds = [];

  for (const doc of existingSnapshot.docs) {
    await floorsRef.doc(doc.id).delete();
    deletedIds.push(doc.id);
  }

  console.log(`✅ Διαγράφηκαν ${deletedIds.length} floors`);

  // =======================================================================
  // STEP 3: Create floors for EACH building
  // =======================================================================
  console.log('\n🏢 Δημιουργία νέων floors για κάθε building...');
  console.log('-'.repeat(70));

  const allCreatedFloors = [];
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const building of buildings) {
    console.log(`\n📍 Building: ${building.name}`);

    for (const template of FLOOR_TEMPLATES) {
      const floorId = generateFloorId();

      const floorDoc = {
        // 🏢 ENTERPRISE: Core fields
        id: floorId,
        number: template.number,
        name: template.name,
        units: template.units,

        // 🏢 ENTERPRISE: Foreign key relationships
        buildingId: building.id,
        buildingName: building.name,
        projectId: String(building.projectId),
        projectName: building.projectName || '',

        // 🔒 TENANT ISOLATION
        companyId: building.companyId || TARGET_COMPANY_ID,

        // 🏢 ENTERPRISE: Metadata
        description: template.description || '',
        createdAt: now,
        updatedAt: now,
        createdBy: 'seed-floors-cli',
      };

      await floorsRef.doc(floorId).set(floorDoc);

      allCreatedFloors.push({
        id: floorId,
        number: template.number,
        name: template.name,
        building: building.name,
      });

      console.log(`   ✓ ${template.name} → ${floorId}`);
    }
  }

  // =======================================================================
  // SUMMARY
  // =======================================================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`   Buildings:        ${buildings.length}`);
  console.log(`   Floors/Building:  ${FLOOR_TEMPLATES.length}`);
  console.log(`   Total Deleted:    ${deletedIds.length}`);
  console.log(`   Total Created:    ${allCreatedFloors.length}`);
  console.log(`   Company ID:       ${TARGET_COMPANY_ID}`);

  console.log('\n📋 CREATED FLOORS BY BUILDING:');
  const byBuilding = {};
  allCreatedFloors.forEach(f => {
    if (!byBuilding[f.building]) byBuilding[f.building] = [];
    byBuilding[f.building].push(f.name);
  });
  Object.entries(byBuilding).forEach(([building, floors]) => {
    console.log(`   ${building}: ${floors.join(', ')}`);
  });

  console.log('\n🎉 SEEDING COMPLETED!');
  console.log('');

  process.exit(0);
}

// =============================================================================
// 🏢 RUN
// =============================================================================

seedFloors().catch(error => {
  console.error('\n❌ Error:', error.message || error);
  process.exit(1);
});
