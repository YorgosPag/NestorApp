/**
 * 🔄 DIRECT FIRESTORE MIGRATION: building_1_palaiologou → Random ID
 * =================================================================
 *
 * Run this in browser console on localhost:3000
 * Uses the Firebase instance already loaded in the app
 */

const OLD_BUILDING_ID = 'building_1_palaiologou';
const NEW_BUILDING_ID = 'G8kMxQ2pVwN5jR7tE1sA';

async function migrateBuildingOneFirestore() {
  console.log('🎯 FIRESTORE MIGRATION: Building 1 → Random ID');
  console.log('=' .repeat(50));
  console.log(`FROM: ${OLD_BUILDING_ID}`);
  console.log(`TO:   ${NEW_BUILDING_ID}`);
  console.log('=' .repeat(50) + '\n');

  try {
    // Check if Firebase is available
    if (typeof window.firebase === 'undefined' && typeof window.db === 'undefined') {
      throw new Error('Firebase not available. Make sure you\'re on the app page.');
    }

    // Get Firestore instance (try different ways the app might expose it)
    let db;
    if (window.db) {
      db = window.db;
    } else if (window.firebase && window.firebase.firestore) {
      db = window.firebase.firestore();
    } else {
      throw new Error('Cannot access Firestore. Check if Firebase is initialized.');
    }

    console.log('✅ Firebase connection established');

    // Step 1: Get existing building data
    console.log('🔍 Step 1: Getting existing building data...');

    const oldBuildingRef = db.collection('buildings').doc(OLD_BUILDING_ID);
    const oldBuildingSnap = await oldBuildingRef.get();

    if (!oldBuildingSnap.exists) {
      throw new Error(`Building ${OLD_BUILDING_ID} not found in Firestore`);
    }

    const buildingData = oldBuildingSnap.data();
    console.log('✅ Found building data:', {
      name: buildingData.name,
      address: buildingData.address,
      floors: buildingData.buildingFloors?.length || 0
    });

    // Step 2: Create new building with random ID
    console.log('🏗️ Step 2: Creating new building...');

    const newBuildingRef = db.collection('buildings').doc(NEW_BUILDING_ID);
    const newBuildingData = {
      ...buildingData,
      id: NEW_BUILDING_ID, // Update the ID field
      _migration: {
        fromId: OLD_BUILDING_ID,
        migratedAt: new Date(),
        script: 'migrate-building-1-firestore.js'
      }
    };

    await newBuildingRef.set(newBuildingData);
    console.log('✅ New building created with ID:', NEW_BUILDING_ID);

    // Step 3: Update references (manual for now)
    console.log('\n🔄 Step 3: References need manual update...');
    console.log('⚠️ MANUAL STEPS REQUIRED:');
    console.log('1. Update units collection:');
    console.log(`   - Find units with buildingId: "${OLD_BUILDING_ID}"`);
    console.log(`   - Change to buildingId: "${NEW_BUILDING_ID}"`);
    console.log('');
    console.log('2. Update floors collection:');
    console.log(`   - Find floors with buildingId: "${OLD_BUILDING_ID}"`);
    console.log(`   - Change to buildingId: "${NEW_BUILDING_ID}"`);
    console.log('');
    console.log('3. Update any projects that reference this building');
    console.log('');

    // Step 4: Verification
    console.log('✅ Step 4: Verifying new building...');
    const newBuildingSnap = await newBuildingRef.get();

    if (newBuildingSnap.exists) {
      console.log('✅ New building verified:', newBuildingSnap.data().name);

      // Ask for confirmation before deleting old building
      console.log('\n🗑️ Step 5: Ready to delete old building...');
      console.log(`❓ Do you want to delete ${OLD_BUILDING_ID}? (y/n)`);
      console.log('Run: deleteOldBuilding() to delete the old building');
      console.log('Run: validateMigration() to check everything is OK');

      // Make functions available globally
      window.deleteOldBuilding = async () => {
        try {
          await oldBuildingRef.delete();
          console.log('✅ Old building deleted:', OLD_BUILDING_ID);
          return true;
        } catch (error) {
          console.error('❌ Error deleting old building:', error);
          return false;
        }
      };

      window.validateMigration = async () => {
        try {
          const newCheck = await newBuildingRef.get();
          const oldCheck = await oldBuildingRef.get();

          console.log('📊 MIGRATION STATUS:');
          console.log(`✅ New building exists: ${newCheck.exists}`);
          console.log(`✅ Old building removed: ${!oldCheck.exists}`);

          if (newCheck.exists && !oldCheck.exists) {
            console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
            return true;
          } else {
            console.log('⚠️ Migration incomplete - check manually');
            return false;
          }
        } catch (error) {
          console.error('❌ Validation error:', error);
          return false;
        }
      };

      return { success: true, newBuildingId: NEW_BUILDING_ID };

    } else {
      throw new Error('Failed to verify new building creation');
    }

  } catch (error) {
    console.error('💥 MIGRATION FAILED:', error.message);
    console.error('\n🔄 Possible solutions:');
    console.error('1. Make sure you\'re on localhost:3000 with the app loaded');
    console.error('2. Check that Firebase is initialized');
    console.error('3. Verify building_1_palaiologou exists in Firestore');

    return { success: false, error: error.message };
  }
}

// Make function globally available
window.migrateBuildingOneFirestore = migrateBuildingOneFirestore;

console.log(`
🔄 FIRESTORE Building Migration Script Loaded!

INSTRUCTIONS:
1. Make sure you're on localhost:3000 with the app loaded
2. Open Developer Tools (F12) → Console tab
3. Run: migrateBuildingOneFirestore()
4. Follow the manual steps for updating references
5. Run: deleteOldBuilding() when ready
6. Run: validateMigration() to verify

Script will:
- Read building_1_palaiologou from Firestore
- Create new building with random ID: G8kMxQ2pVwN5jR7tE1sA
- Provide manual steps for references
- Allow safe deletion of old building
`);