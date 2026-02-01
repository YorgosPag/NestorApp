/**
 * Check if floor document exists in Firestore
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
  });
}

const db = admin.firestore();

async function checkFloorDocument() {
  // The floor ID we saved the floorplan for
  const floorId = 'flr_93a0a2d5-b343-4983-ac56-7f4867ef55d6';
  
  console.log('🔍 Checking floor document:', floorId);
  
  // Check floors collection
  const floorDoc = await db.collection('floors').doc(floorId).get();
  
  if (floorDoc.exists) {
    const data = floorDoc.data();
    console.log('✅ Floor document EXISTS:');
    console.log('  - buildingId:', data.buildingId);
    console.log('  - name:', data.name);
    console.log('  - level:', data.level);
  } else {
    console.log('❌ Floor document NOT FOUND in floors collection');
    
    // Let's search for any floor documents
    console.log('\n🔍 Searching for floors with enterprise ID pattern...');
    const floorsSnapshot = await db.collection('floors')
      .limit(10)
      .get();
    
    if (floorsSnapshot.empty) {
      console.log('⚠️ No floors found in floors collection');
    } else {
      console.log(`📋 Found ${floorsSnapshot.size} floor documents:`);
      floorsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}: buildingId=${data.buildingId}, name=${data.name}`);
      });
    }
  }
  
  // Also check if the floorplan was saved
  console.log('\n🔍 Checking floor_floorplans collection...');
  const buildingId = 'UO6WLuyBjAZH2ncKvEPh';
  const docId = `${buildingId}_${floorId}_floor`;
  
  const floorplanDoc = await db.collection('floor_floorplans').doc(docId).get();
  
  if (floorplanDoc.exists) {
    const data = floorplanDoc.data();
    console.log('✅ Floor floorplan metadata EXISTS:');
    console.log('  - docId:', docId);
    console.log('  - buildingId:', data.buildingId);
    console.log('  - floorId:', data.floorId);
    console.log('  - deleted:', data.deleted);
  } else {
    console.log('❌ Floor floorplan metadata NOT FOUND');
  }
  
  // Check cadFiles collection (DxfFirestoreService metadata)
  console.log('\n🔍 Checking cadFiles collection...');
  const fileId = `floor_floorplan_${buildingId}_${floorId}`;
  const cadFileDoc = await db.collection('cadFiles').doc(fileId).get();
  
  if (cadFileDoc.exists) {
    const data = cadFileDoc.data();
    console.log('✅ cadFiles metadata EXISTS:');
    console.log('  - fileId:', fileId);
    console.log('  - fileName:', data.fileName);
    console.log('  - storagePath:', data.storagePath);
    console.log('  - version:', data.version);
  } else {
    console.log('❌ cadFiles metadata NOT FOUND');
  }
}

checkFloorDocument()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
