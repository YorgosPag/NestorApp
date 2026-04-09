/**
 * 🔍 Debug Data Script
 * Check floor_floorplans, buildings, and floors collections
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load service account
const serviceAccountPath = join(__dirname, '..', 'pagonis-87766-firebase-adminsdk-fbsvc-469209d7a0.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function debugData() {
  console.log('🔍 DEBUGGING DATA...\n');

  // 1. Check floor_floorplans collection
  console.log('='.repeat(60));
  console.log('📐 FLOOR_FLOORPLANS COLLECTION:');
  console.log('='.repeat(60));
  const floorplansSnapshot = await db.collection('floor_floorplans').get();
  if (floorplansSnapshot.empty) {
    console.log('   (empty)');
  } else {
    floorplansSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('\n   Document ID: ' + doc.id);
      console.log('   buildingId: ' + data.buildingId);
      console.log('   floorId: ' + data.floorId);
      console.log('   floorNumber: ' + data.floorNumber);
      console.log('   fileName: ' + data.fileName);
    });
  }

  // 2. Check buildings for project Παλαιολόγου
  console.log('\n' + '='.repeat(60));
  console.log('🏢 BUILDINGS FOR PROJECT pzK8mN3xQw9vR2dL4jF7:');
  console.log('='.repeat(60));
  const buildingsSnapshot = await db.collection('buildings')
    .where('projectId', '==', 'pzK8mN3xQw9vR2dL4jF7')
    .get();
  if (buildingsSnapshot.empty) {
    console.log('   (no buildings found)');
  } else {
    buildingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('\n   Building ID: ' + doc.id);
      console.log('   Name: ' + data.name);
      console.log('   projectId: ' + data.projectId);
    });
  }

  // 3. Check floors collection for building G8kMxQ2pVwN5jR7tE1sA
  console.log('\n' + '='.repeat(60));
  console.log('🏢 FLOORS FOR BUILDING G8kMxQ2pVwN5jR7tE1sA:');
  console.log('='.repeat(60));
  const floorsSnapshot = await db.collection('floors')
    .where('buildingId', '==', 'G8kMxQ2pVwN5jR7tE1sA')
    .get();
  if (floorsSnapshot.empty) {
    console.log('   (no floors found)');
  } else {
    floorsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('\n   Floor ID: ' + doc.id);
      console.log('   Name: ' + data.name);
      console.log('   Number: ' + data.number);
      console.log('   buildingId: ' + data.buildingId);
    });
  }

  // 4. Check units for building
  console.log('\n' + '='.repeat(60));
  console.log('🏠 UNITS WITH buildingId = L9nBzX3rYhM6kS8vF2dG:');
  console.log('='.repeat(60));
  const unitsSnapshot1 = await db.collection('units')
    .where('buildingId', '==', 'L9nBzX3rYhM6kS8vF2dG')
    .limit(3)
    .get();
  if (unitsSnapshot1.empty) {
    console.log('   (no units found)');
  } else {
    unitsSnapshot1.docs.forEach(doc => {
      const data = doc.data();
      console.log('\n   Unit ID: ' + doc.id);
      console.log('   Name: ' + data.name);
      console.log('   buildingId: ' + data.buildingId);
      console.log('   building: ' + data.building);
      console.log('   floorId: ' + data.floorId);
      console.log('   floor: ' + data.floor);
    });
  }

  // 5. Check units for building G8kMxQ2pVwN5jR7tE1sA
  console.log('\n' + '='.repeat(60));
  console.log('🏠 UNITS WITH buildingId = G8kMxQ2pVwN5jR7tE1sA:');
  console.log('='.repeat(60));
  const unitsSnapshot2 = await db.collection('units')
    .where('buildingId', '==', 'G8kMxQ2pVwN5jR7tE1sA')
    .limit(3)
    .get();
  if (unitsSnapshot2.empty) {
    console.log('   (no units found)');
  } else {
    unitsSnapshot2.docs.forEach(doc => {
      const data = doc.data();
      console.log('\n   Unit ID: ' + doc.id);
      console.log('   Name: ' + data.name);
      console.log('   buildingId: ' + data.buildingId);
      console.log('   building: ' + data.building);
      console.log('   floorId: ' + data.floorId);
      console.log('   floor: ' + data.floor);
    });
  }

  // 6. Check cad_files for floor floorplans
  console.log('\n' + '='.repeat(60));
  console.log('📁 CADFILES WITH floor_floorplan PREFIX:');
  console.log('='.repeat(60));
  const cad_filesSnapshot = await db.collection('cad_files').get();
  const floorCadFiles = cad_filesSnapshot.docs.filter(doc => doc.id.startsWith('floor_floorplan'));
  if (floorCadFiles.length === 0) {
    console.log('   (no floor floorplan cad_files found)');
  } else {
    floorCadFiles.forEach(doc => {
      console.log('\n   CadFile ID: ' + doc.id);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ DEBUG COMPLETE');
  console.log('='.repeat(60));
}

debugData();
