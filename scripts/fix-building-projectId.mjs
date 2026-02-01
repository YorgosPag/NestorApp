/**
 * 🔧 Fix Building projectId
 * Updates the building "ΚΤΙΡΙΟ Α - Παλαιολόγου" to have the correct projectId
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

async function fixBuildingProjectId() {
  const buildingId = 'G8kMxQ2pVwN5jR7tE1sA';
  const correctProjectId = 'pzK8mN3xQw9vR2dL4jF7';
  const wrongProjectId = 'xL2nV4bC6mZ8kJ9hG1fQ';

  console.log('🔧 Fixing building projectId...');
  console.log('   Building ID: ' + buildingId);
  console.log('   Wrong projectId: ' + wrongProjectId);
  console.log('   Correct projectId: ' + correctProjectId);

  try {
    // Get the building document
    const buildingRef = db.collection('buildings').doc(buildingId);
    const buildingDoc = await buildingRef.get();

    if (!buildingDoc.exists) {
      console.error('❌ Building not found!');
      process.exit(1);
    }

    const buildingData = buildingDoc.data();
    console.log('\n📋 Current building data:');
    console.log('   Name: ' + buildingData.name);
    console.log('   Current projectId: ' + buildingData.projectId);

    if (buildingData.projectId === correctProjectId) {
      console.log('\n✅ Building already has correct projectId!');
      process.exit(0);
    }

    // Update the projectId
    await buildingRef.update({
      projectId: correctProjectId,
      updatedAt: new Date().toISOString()
    });

    console.log('\n✅ Building projectId updated successfully!');

    // Verify the update
    const updatedDoc = await buildingRef.get();
    const updatedData = updatedDoc.data();
    console.log('   New projectId: ' + updatedData.projectId);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixBuildingProjectId();
