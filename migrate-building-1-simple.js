/**
 * 🔄 SIMPLE MIGRATION: building_1_palaiologou → Random ID
 * ======================================================
 *
 * OBJECTIVE: Replace ONLY building_1_palaiologou with G8kMxQ2pVwN5jR7tE1sA
 * APPROACH: Simple API calls - no complex Firebase operations
 *
 * FROM: building_1_palaiologou
 * TO:   G8kMxQ2pVwN5jR7tE1sA
 */

const OLD_BUILDING_ID = 'building_1_palaiologou';
const NEW_BUILDING_ID = 'G8kMxQ2pVwN5jR7tE1sA';

/**
 * 🎯 Step 1: Get existing building data
 */
async function getBuildingData() {
  console.log('🔍 Step 1: Getting building data...');

  try {
    const response = await fetch(`http://localhost:3000/api/buildings/${OLD_BUILDING_ID}`);
    const result = await response.json();

    if (result.success && result.building) {
      console.log('✅ Found building:', result.building.name);
      console.log('📊 Building data:', {
        address: result.building.address,
        floors: result.building.buildingFloors?.length || 0
      });
      return result.building;
    } else {
      console.log('❌ Building not found or API error');
      return null;
    }
  } catch (error) {
    console.error('💥 Error fetching building:', error.message);
    return null;
  }
}

/**
 * 🏗️ Step 2: Create new building with random ID
 */
async function createNewBuilding(buildingData) {
  console.log('🏗️ Step 2: Creating new building with random ID...');

  try {
    // Create new building data with new ID
    const newBuildingData = {
      ...buildingData,
      id: NEW_BUILDING_ID,
      // Add migration metadata
      _migration: {
        fromId: OLD_BUILDING_ID,
        migratedAt: new Date().toISOString(),
        script: 'migrate-building-1-simple.js'
      }
    };

    const response = await fetch('http://localhost:3000/api/buildings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newBuildingData)
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ New building created:', NEW_BUILDING_ID);
      return true;
    } else {
      console.error('❌ Failed to create new building:', result.error);
      return false;
    }

  } catch (error) {
    console.error('💥 Error creating building:', error.message);
    return false;
  }
}

/**
 * 🔄 Step 3: Update references in other collections
 */
async function updateReferences() {
  console.log('🔄 Step 3: Updating references...');

  const collections = ['units', 'floors', 'building_floorplans'];
  const updateResults = {};

  for (const collection of collections) {
    try {
      console.log(`📝 Updating ${collection}...`);

      // This would need a special API endpoint for batch updates
      // For now, we'll create a simple endpoint call
      const response = await fetch(`http://localhost:3000/api/admin/update-building-references`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection: collection,
          oldBuildingId: OLD_BUILDING_ID,
          newBuildingId: NEW_BUILDING_ID
        })
      });

      const result = await response.json();

      if (result.success) {
        updateResults[collection] = result.updatedCount || 0;
        console.log(`  ✅ Updated ${updateResults[collection]} documents in ${collection}`);
      } else {
        updateResults[collection] = `ERROR: ${result.error}`;
        console.log(`  ❌ Failed to update ${collection}: ${result.error}`);
      }

    } catch (error) {
      updateResults[collection] = `ERROR: ${error.message}`;
      console.log(`  ❌ Error updating ${collection}: ${error.message}`);
    }
  }

  return updateResults;
}

/**
 * 🗑️ Step 4: Delete old building
 */
async function deleteOldBuilding() {
  console.log('🗑️ Step 4: Deleting old building...');

  try {
    const response = await fetch(`http://localhost:3000/api/buildings/${OLD_BUILDING_ID}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Old building deleted:', OLD_BUILDING_ID);
      return true;
    } else {
      console.error('❌ Failed to delete old building:', result.error);
      return false;
    }

  } catch (error) {
    console.error('💥 Error deleting building:', error.message);
    return false;
  }
}

/**
 * ✅ Step 5: Validate migration
 */
async function validateMigration() {
  console.log('✅ Step 5: Validating migration...');

  try {
    // Check new building exists
    const newResponse = await fetch(`http://localhost:3000/api/buildings/${NEW_BUILDING_ID}`);
    const newResult = await newResponse.json();

    // Check old building is gone
    const oldResponse = await fetch(`http://localhost:3000/api/buildings/${OLD_BUILDING_ID}`);
    const oldResult = await oldResponse.json();

    const validation = {
      newBuildingExists: newResult.success && newResult.building,
      oldBuildingGone: !oldResult.success || !oldResult.building,
      success: false
    };

    validation.success = validation.newBuildingExists && validation.oldBuildingGone;

    if (validation.success) {
      console.log('🎉 VALIDATION PASSED!');
      console.log(`  ✅ New building exists: ${NEW_BUILDING_ID}`);
      console.log(`  ✅ Old building removed: ${OLD_BUILDING_ID}`);
    } else {
      console.log('❌ VALIDATION FAILED!');
      console.log(`  New building exists: ${validation.newBuildingExists}`);
      console.log(`  Old building removed: ${validation.oldBuildingGone}`);
    }

    return validation;

  } catch (error) {
    console.error('💥 Validation error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 🚀 Main execution - SIMPLE & SAFE
 */
async function migrateBuildingOne() {
  try {
    console.log('🎯 SIMPLE MIGRATION: Building 1 → Random ID');
    console.log('=' .repeat(50));
    console.log(`FROM: ${OLD_BUILDING_ID}`);
    console.log(`TO:   ${NEW_BUILDING_ID}`);
    console.log('=' .repeat(50) + '\n');

    // Step 1: Get existing data
    const buildingData = await getBuildingData();
    if (!buildingData) {
      throw new Error('Cannot find existing building data');
    }

    // Step 2: Create new building
    const created = await createNewBuilding(buildingData);
    if (!created) {
      throw new Error('Failed to create new building');
    }

    // Step 3: Update references
    const updateResults = await updateReferences();
    console.log('\n📊 Reference update results:', updateResults);

    // Step 4: Delete old building
    const deleted = await deleteOldBuilding();
    if (!deleted) {
      console.log('⚠️ Warning: Failed to delete old building - you may need to do this manually');
    }

    // Step 5: Validate
    const validation = await validateMigration();

    // Final report
    console.log('\n🎉 MIGRATION COMPLETED!');
    console.log('─'.repeat(40));

    if (validation.success) {
      console.log('✅ Status: SUCCESS');
      console.log('🔒 Building now has secure random ID!');
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Test the application');
      console.log('2. Run the script for building_2_palaiologou');
    } else {
      console.log('❌ Status: FAILED');
      console.log('🔄 You may need to check manually');
    }

    return validation;

  } catch (error) {
    console.error('\n💥 MIGRATION FAILED:', error.message);
    console.error('🔄 Check the logs and try manual steps if needed');
    return { success: false, error: error.message };
  }
}

// For browser console usage
if (typeof window !== 'undefined') {
  window.migrateBuildingOne = migrateBuildingOne;
  console.log(`
🔄 Building 1 Migration Script Loaded!

To run:
1. Make sure you're on localhost:3000
2. Open browser console (F12)
3. Run: migrateBuildingOne()
  `);
}

// For Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    migrateBuildingOne,
    getBuildingData,
    createNewBuilding,
    updateReferences,
    deleteOldBuilding,
    validateMigration
  };
}

// Auto-run if called directly with Node.js
if (typeof require !== 'undefined' && require.main === module) {
  migrateBuildingOne().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}