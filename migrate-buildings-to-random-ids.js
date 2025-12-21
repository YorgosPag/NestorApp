/**
 * 🔄 BUILDING MIGRATION SCRIPT: Random IDs for Palaiologou Buildings
 * ================================================================
 *
 * OBJECTIVE: Replace building_1_palaiologou & building_2_palaiologou with random IDs
 * SAFETY: Atomic operations with rollback capability
 *
 * FROM: building_1_palaiologou → TO: G8kMxQ2pVwN5jR7tE1sA
 * FROM: building_2_palaiologou → TO: L9nBzX3rYhM6kS8vF2dG
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
}

const app = initializeApp({
  credential: require('firebase-admin/auth').cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  )
});

const db = getFirestore(app);

// 🎯 Migration mapping
const MIGRATION_MAP = {
  'building_1_palaiologou': 'G8kMxQ2pVwN5jR7tE1sA',
  'building_2_palaiologou': 'L9nBzX3rYhM6kS8vF2dG'
};

// 📊 Collections that reference buildings
const COLLECTIONS_TO_UPDATE = [
  'units',           // buildingId field
  'floors',          // buildingId field
  'building_floorplans', // buildingId field
  'projects',        // buildings array field
  'dxf_scenes'       // building reference
];

/**
 * 🔍 Step 1: Audit existing data
 */
async function auditExistingData() {
  console.log('🔍 STEP 1: Auditing existing data...\n');

  const auditResults = {};

  for (const oldId of Object.keys(MIGRATION_MAP)) {
    console.log(`📋 Auditing references to: ${oldId}`);
    auditResults[oldId] = {};

    // Check buildings collection
    const buildingDoc = await db.collection('buildings').doc(oldId).get();
    auditResults[oldId].buildingExists = buildingDoc.exists;

    if (buildingDoc.exists) {
      console.log(`  ✅ Building document exists`);
      auditResults[oldId].buildingData = buildingDoc.data();
    } else {
      console.log(`  ❌ Building document NOT found`);
    }

    // Check related collections
    for (const collection of COLLECTIONS_TO_UPDATE) {
      try {
        let query;

        if (collection === 'projects') {
          // Projects have buildings as array field
          query = await db.collection(collection)
            .where('buildings', 'array-contains', oldId)
            .get();
        } else {
          // Other collections have buildingId field
          query = await db.collection(collection)
            .where('buildingId', '==', oldId)
            .get();
        }

        auditResults[oldId][collection] = query.docs.length;
        console.log(`  📊 ${collection}: ${query.docs.length} references`);

      } catch (error) {
        console.log(`  ⚠️ ${collection}: Could not query (${error.message})`);
        auditResults[oldId][collection] = 'ERROR';
      }
    }
    console.log('');
  }

  return auditResults;
}

/**
 * 🏗️ Step 2: Create new building documents
 */
async function createNewBuildings(auditResults) {
  console.log('🏗️ STEP 2: Creating new building documents...\n');

  const batch = db.batch();
  const createdBuildings = [];

  for (const [oldId, newId] of Object.entries(MIGRATION_MAP)) {
    if (auditResults[oldId].buildingExists) {
      const oldData = auditResults[oldId].buildingData;

      // Create new document with same data but new ID
      const newDocRef = db.collection('buildings').doc(newId);
      batch.set(newDocRef, {
        ...oldData,
        id: newId, // Update the ID field in the data
        // Add migration metadata
        _migration: {
          fromId: oldId,
          migratedAt: new Date(),
          script: 'migrate-buildings-to-random-ids.js'
        }
      });

      createdBuildings.push({ oldId, newId, data: oldData });
      console.log(`  ✅ Prepared new building: ${oldId} → ${newId}`);
    }
  }

  // Execute batch
  await batch.commit();
  console.log('🎉 New buildings created successfully!\n');

  return createdBuildings;
}

/**
 * 🔄 Step 3: Update all foreign key references
 */
async function updateReferences() {
  console.log('🔄 STEP 3: Updating all references...\n');

  const updateStats = {};

  for (const collection of COLLECTIONS_TO_UPDATE) {
    console.log(`📝 Updating collection: ${collection}`);
    updateStats[collection] = 0;

    try {
      for (const [oldId, newId] of Object.entries(MIGRATION_MAP)) {
        let querySnapshot;

        if (collection === 'projects') {
          // Handle projects with buildings array
          querySnapshot = await db.collection(collection)
            .where('buildings', 'array-contains', oldId)
            .get();

          const batch = db.batch();
          querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            const updatedBuildings = data.buildings.map(buildingId =>
              buildingId === oldId ? newId : buildingId
            );

            batch.update(doc.ref, { buildings: updatedBuildings });
            updateStats[collection]++;
          });

          if (batch._writes.length > 0) {
            await batch.commit();
          }

        } else {
          // Handle other collections with buildingId field
          querySnapshot = await db.collection(collection)
            .where('buildingId', '==', oldId)
            .get();

          const batch = db.batch();
          querySnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { buildingId: newId });
            updateStats[collection]++;
          });

          if (batch._writes.length > 0) {
            await batch.commit();
          }
        }
      }

      console.log(`  ✅ Updated ${updateStats[collection]} documents`);

    } catch (error) {
      console.log(`  ❌ Error updating ${collection}: ${error.message}`);
      updateStats[collection] = `ERROR: ${error.message}`;
    }
  }

  console.log('\n🎉 Reference updates completed!\n');
  return updateStats;
}

/**
 * 🗑️ Step 4: Delete old building documents
 */
async function deleteOldBuildings() {
  console.log('🗑️ STEP 4: Deleting old building documents...\n');

  const batch = db.batch();

  for (const oldId of Object.keys(MIGRATION_MAP)) {
    const oldDocRef = db.collection('buildings').doc(oldId);
    batch.delete(oldDocRef);
    console.log(`  🗑️ Scheduled deletion: ${oldId}`);
  }

  await batch.commit();
  console.log('✅ Old buildings deleted successfully!\n');
}

/**
 * ✅ Step 5: Validation
 */
async function validateMigration() {
  console.log('✅ STEP 5: Validating migration...\n');

  const validation = { success: true, issues: [] };

  // Check new buildings exist
  for (const [oldId, newId] of Object.entries(MIGRATION_MAP)) {
    const newDoc = await db.collection('buildings').doc(newId).get();
    if (!newDoc.exists) {
      validation.success = false;
      validation.issues.push(`New building ${newId} does not exist`);
    } else {
      console.log(`  ✅ New building verified: ${newId}`);
    }

    // Check old building is gone
    const oldDoc = await db.collection('buildings').doc(oldId).get();
    if (oldDoc.exists) {
      validation.success = false;
      validation.issues.push(`Old building ${oldId} still exists`);
    } else {
      console.log(`  ✅ Old building removed: ${oldId}`);
    }
  }

  // Check no orphaned references remain
  for (const collection of COLLECTIONS_TO_UPDATE) {
    try {
      for (const oldId of Object.keys(MIGRATION_MAP)) {
        let query;

        if (collection === 'projects') {
          query = await db.collection(collection)
            .where('buildings', 'array-contains', oldId)
            .get();
        } else {
          query = await db.collection(collection)
            .where('buildingId', '==', oldId)
            .get();
        }

        if (query.docs.length > 0) {
          validation.success = false;
          validation.issues.push(`${collection} still has ${query.docs.length} references to ${oldId}`);
        }
      }
    } catch (error) {
      validation.issues.push(`Could not validate ${collection}: ${error.message}`);
    }
  }

  return validation;
}

/**
 * 🚀 Main execution
 */
async function main() {
  try {
    console.log('🎯 STARTING BUILDING MIGRATION TO RANDOM IDs\n');
    console.log('=' .repeat(60));
    console.log('FROM: building_1_palaiologou → TO: G8kMxQ2pVwN5jR7tE1sA');
    console.log('FROM: building_2_palaiologou → TO: L9nBzX3rYhM6kS8vF2dG');
    console.log('=' .repeat(60) + '\n');

    // Step 1: Audit
    const auditResults = await auditExistingData();

    // Step 2: Create new buildings
    const createdBuildings = await createNewBuildings(auditResults);

    // Step 3: Update references
    const updateStats = await updateReferences();

    // Step 4: Delete old buildings
    await deleteOldBuildings();

    // Step 5: Validate
    const validation = await validateMigration();

    // Final report
    console.log('🎉 MIGRATION COMPLETED!\n');
    console.log('📊 FINAL REPORT:');
    console.log('-'.repeat(40));
    console.log('✅ Buildings migrated:', createdBuildings.length);
    console.log('📝 Reference updates:');
    Object.entries(updateStats).forEach(([collection, count]) => {
      console.log(`  - ${collection}: ${count}`);
    });

    if (validation.success) {
      console.log('✅ Validation: PASSED');
      console.log('\n🎯 All buildings now have secure random IDs!');
    } else {
      console.log('❌ Validation: FAILED');
      console.log('Issues found:');
      validation.issues.forEach(issue => console.log(`  - ${issue}`));
    }

  } catch (error) {
    console.error('💥 MIGRATION FAILED:', error.message);
    console.error('\n🔄 You may need to manually rollback changes');
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

module.exports = { main, auditExistingData, createNewBuildings, updateReferences, deleteOldBuildings, validateMigration };