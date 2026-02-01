/**
 * 🔍 Check Floor Floorplans for ΚΤΙΡΙΟ Β
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, '..', 'pagonis-87766-firebase-adminsdk-fbsvc-469209d7a0.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkFloorFloorplans() {
  const buildingId = 'L9nBzX3rYhM6kS8vF2dG'; // ΚΤΙΡΙΟ Β

  console.log('🔍 Checking floor floorplans for ΚΤΙΡΙΟ Β...\n');
  console.log('Building ID: ' + buildingId);

  // 1. Get floors for this building
  console.log('\n' + '='.repeat(50));
  console.log('📋 FLOORS FOR ΚΤΙΡΙΟ Β:');
  console.log('='.repeat(50));

  const floorsSnapshot = await db.collection('floors')
    .where('buildingId', '==', buildingId)
    .get();

  const floors = [];
  floorsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    floors.push({ id: doc.id, number: data.number, name: data.name });
    console.log('   Floor ID: ' + doc.id);
    console.log('   Name: ' + data.name);
    console.log('   Number: ' + data.number);
    console.log('');
  });

  // 2. Check cadFiles for floor floorplans
  console.log('='.repeat(50));
  console.log('📁 CADFILES FOR ΚΤΙΡΙΟ Β:');
  console.log('='.repeat(50));

  const cadFilesSnapshot = await db.collection('cadFiles').get();
  const buildingCadFiles = cadFilesSnapshot.docs.filter(doc =>
    doc.id.includes(buildingId) && doc.id.startsWith('floor_floorplan')
  );

  if (buildingCadFiles.length === 0) {
    console.log('   (no floor floorplan cadFiles found for ΚΤΙΡΙΟ Β)');
  } else {
    buildingCadFiles.forEach(doc => {
      console.log('   CadFile ID: ' + doc.id);
    });
  }

  // 3. Check floor_floorplans collection
  console.log('\n' + '='.repeat(50));
  console.log('📐 FLOOR_FLOORPLANS COLLECTION FOR ΚΤΙΡΙΟ Β:');
  console.log('='.repeat(50));

  const floorplansSnapshot = await db.collection('floor_floorplans')
    .where('buildingId', '==', buildingId)
    .get();

  if (floorplansSnapshot.empty) {
    console.log('   (no documents found)');
  } else {
    floorplansSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('   Doc ID: ' + doc.id);
      console.log('   floorId: ' + data.floorId);
      console.log('   fileType: ' + data.fileType);
    });
  }

  // 4. Check unit data
  console.log('\n' + '='.repeat(50));
  console.log('🏠 UNIT "Διαμέρισμα Α527":');
  console.log('='.repeat(50));

  const unitDoc = await db.collection('units').doc('gj9omjArEpHxpdkABTtc').get();
  if (unitDoc.exists) {
    const data = unitDoc.data();
    console.log('   Name: ' + data.name);
    console.log('   buildingId: ' + data.buildingId);
    console.log('   building (text): ' + data.building);
    console.log('   floorId: ' + data.floorId);
    console.log('   floor (number): ' + data.floor);
  }

  console.log('\n✅ CHECK COMPLETE');
}

checkFloorFloorplans();
