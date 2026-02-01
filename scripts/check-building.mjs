/**
 * 🔍 Check specific building
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

async function checkBuilding() {
  // Check if building L9nBzX3rYhM6kS8vF2dG exists
  const buildingId = 'L9nBzX3rYhM6kS8vF2dG';
  console.log('🔍 Checking building: ' + buildingId);

  const buildingDoc = await db.collection('buildings').doc(buildingId).get();

  if (!buildingDoc.exists) {
    console.log('❌ Building NOT FOUND in database!');
  } else {
    const data = buildingDoc.data();
    console.log('✅ Building EXISTS:');
    console.log('   Name: ' + data.name);
    console.log('   projectId: ' + data.projectId);
    console.log('   project: ' + data.project);
  }

  // Also check floors for this building
  console.log('\n🔍 Checking floors for building ' + buildingId + ':');
  const floorsSnapshot = await db.collection('floors')
    .where('buildingId', '==', buildingId)
    .get();

  if (floorsSnapshot.empty) {
    console.log('   (no floors found)');
  } else {
    floorsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('   Floor: ' + doc.id + ' - ' + data.name);
    });
  }
}

checkBuilding();
