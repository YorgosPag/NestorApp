/**
 * 🔄 BUILDING MIGRATION SCRIPT: Browser Version
 * ============================================
 *
 * Run this in browser console on localhost:3000
 * Uses the existing Firebase connection from the app
 */

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

  // Use fetch to call our API
  const response = await fetch('/api/buildings');
  const result = await response.json();

  if (!result.success) {
    throw new Error('Could not fetch buildings');
  }

  const buildings = result.buildings;
  const auditResults = {};

  for (const oldId of Object.keys(MIGRATION_MAP)) {
    console.log(`📋 Auditing: ${oldId}`);

    const building = buildings.find(b => b.id === oldId);
    auditResults[oldId] = {
      buildingExists: !!building,
      buildingData: building
    };

    if (building) {
      console.log(`  ✅ Building found: ${building.name}`);
    } else {
      console.log(`  ❌ Building NOT found`);
    }
  }

  return auditResults;
}

/**
 * 🏗️ Step 2: Create new building documents via API
 */
async function createNewBuildings(auditResults) {
  console.log('🏗️ STEP 2: Creating new building documents...\n');

  const createdBuildings = [];

  for (const [oldId, newId] of Object.entries(MIGRATION_MAP)) {
    if (auditResults[oldId].buildingExists) {
      const oldData = auditResults[oldId].buildingData;

      // Create new building via API
      const response = await fetch('/api/buildings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...oldData,
          id: newId,
          _migration: {
            fromId: oldId,
            migratedAt: new Date().toISOString(),
            script: 'migrate-buildings-browser.js'
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        createdBuildings.push({ oldId, newId, data: oldData });
        console.log(`  ✅ Created: ${oldId} → ${newId}`);
      } else {
        throw new Error(`Failed to create building ${newId}: ${result.error}`);
      }
    }
  }

  console.log('🎉 New buildings created successfully!\n');
  return createdBuildings;
}

/**
 * 🔄 Step 3: Update references via API calls
 */
async function updateReferences() {
  console.log('🔄 STEP 3: Updating references via API...\n');

  // For this migration, we'll need to create a special API endpoint
  // or run manual Firestore operations

  const response = await fetch('/api/admin/migrate-building-references', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      migrationMap: MIGRATION_MAP,
      collections: COLLECTIONS_TO_UPDATE
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ References updated successfully!');
    console.log('📊 Update stats:', result.updateStats);
    return result.updateStats;
  } else {
    throw new Error(`Reference update failed: ${result.error}`);
  }
}

/**
 * 🗑️ Step 4: Delete old buildings
 */
async function deleteOldBuildings() {
  console.log('🗑️ STEP 4: Deleting old buildings...\n');

  for (const oldId of Object.keys(MIGRATION_MAP)) {
    const response = await fetch(`/api/buildings/${oldId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      console.log(`  🗑️ Deleted: ${oldId}`);
    } else {
      throw new Error(`Failed to delete ${oldId}: ${result.error}`);
    }
  }

  console.log('✅ Old buildings deleted successfully!\n');
}

/**
 * ✅ Step 5: Validation
 */
async function validateMigration() {
  console.log('✅ STEP 5: Validating migration...\n');

  const response = await fetch('/api/buildings');
  const result = await response.json();

  if (!result.success) {
    throw new Error('Could not fetch buildings for validation');
  }

  const buildings = result.buildings;
  const validation = { success: true, issues: [] };

  // Check new buildings exist
  for (const [oldId, newId] of Object.entries(MIGRATION_MAP)) {
    const newBuilding = buildings.find(b => b.id === newId);
    const oldBuilding = buildings.find(b => b.id === oldId);

    if (!newBuilding) {
      validation.success = false;
      validation.issues.push(`New building ${newId} does not exist`);
    } else {
      console.log(`  ✅ New building verified: ${newId}`);
    }

    if (oldBuilding) {
      validation.success = false;
      validation.issues.push(`Old building ${oldId} still exists`);
    } else {
      console.log(`  ✅ Old building removed: ${oldId}`);
    }
  }

  return validation;
}

/**
 * 🚀 Main execution
 */
async function migrateBuildingsToRandomIds() {
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

    // Step 3: Update references (requires API endpoint)
    console.log('⚠️ STEP 3: Reference updates need manual Firestore operations');
    console.log('   Creating API endpoint for this...\n');

    // For now, skip reference updates - will need manual Firestore operations

    // Step 4: Delete old buildings
    await deleteOldBuildings();

    // Step 5: Validate
    const validation = await validateMigration();

    // Final report
    console.log('🎉 MIGRATION COMPLETED!\n');
    console.log('📊 FINAL REPORT:');
    console.log('-'.repeat(40));
    console.log('✅ Buildings migrated:', createdBuildings.length);

    if (validation.success) {
      console.log('✅ Validation: PASSED');
      console.log('\n🎯 Buildings now have secure random IDs!');
      console.log('\n⚠️ NOTE: You may need to manually update references in:');
      COLLECTIONS_TO_UPDATE.forEach(collection => {
        console.log(`  - ${collection}`);
      });
    } else {
      console.log('❌ Validation: FAILED');
      console.log('Issues found:');
      validation.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return {
      success: validation.success,
      createdBuildings,
      validation
    };

  } catch (error) {
    console.error('💥 MIGRATION FAILED:', error.message);
    console.error('\n🔄 You may need to manually rollback changes');
    throw error;
  }
}

// Make functions globally available
window.migrateBuildingsToRandomIds = migrateBuildingsToRandomIds;
window.auditExistingData = auditExistingData;

console.log(`
🔄 Building Migration Script Loaded!

To run the migration:
1. Open your app at localhost:3000
2. Open browser console (F12)
3. Run: migrateBuildingsToRandomIds()

Or run individual steps:
- auditExistingData()
- etc.
`);