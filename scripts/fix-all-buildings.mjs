/**
 * 🔧 Fix All Building projectIds
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

const CORRECT_PROJECT_ID = 'pzK8mN3xQw9vR2dL4jF7'; // Παλαιολόγου Πολυκατοικία

async function fixBuildings() {
  console.log('🔧 FIXING BUILDING PROJECT IDs...\n');

  // Fix building L9nBzX3rYhM6kS8vF2dG (ΚΤΙΡΙΟ Β - Βοηθητικές Εγκαταστάσεις)
  console.log('1️⃣ Fixing L9nBzX3rYhM6kS8vF2dG (ΚΤΙΡΙΟ Β)...');
  const building1Ref = db.collection('buildings').doc('L9nBzX3rYhM6kS8vF2dG');
  const building1Doc = await building1Ref.get();
  if (building1Doc.exists) {
    const data = building1Doc.data();
    console.log('   Current projectId: ' + data.projectId);
    if (data.projectId !== CORRECT_PROJECT_ID) {
      await building1Ref.update({
        projectId: CORRECT_PROJECT_ID,
        updatedAt: new Date().toISOString()
      });
      console.log('   ✅ Updated to: ' + CORRECT_PROJECT_ID);
    } else {
      console.log('   Already correct!');
    }
  }

  // Check what project "ΚΤΙΡΙΟ Α - Κύριο Εμπορικό Καλαμαριάς" should belong to
  console.log('\n2️⃣ Checking UO6WLuyBjAZH2ncKvEPh (Κύριο Εμπορικό Καλαμαριάς)...');
  const building2Ref = db.collection('buildings').doc('UO6WLuyBjAZH2ncKvEPh');
  const building2Doc = await building2Ref.get();
  if (building2Doc.exists) {
    const data = building2Doc.data();
    console.log('   Name: ' + data.name);
    console.log('   project field: ' + data.project);
    console.log('   Current projectId: ' + data.projectId);

    // This building should NOT be in Παλαιολόγου project
    // It's "Εμπορικό Καλαμαριάς" - different project
    // Let's find the correct project
    const projectsSnapshot = await db.collection('projects')
      .where('name', '==', 'Κύριο Εμπορικό Καλαμαριάς')
      .get();

    if (!projectsSnapshot.empty) {
      const correctProjectId = projectsSnapshot.docs[0].id;
      console.log('   Found correct project: ' + correctProjectId);
      await building2Ref.update({
        projectId: correctProjectId,
        updatedAt: new Date().toISOString()
      });
      console.log('   ✅ Updated!');
    } else {
      // Search for project containing "Καλαμαριά" or "Εμπορικό"
      const allProjects = await db.collection('projects').get();
      console.log('\n   Available projects:');
      allProjects.docs.forEach(doc => {
        console.log('   - ' + doc.id + ': ' + doc.data().name);
      });
      console.log('\n   ⚠️ Could not find matching project - needs manual fix');
    }
  }

  console.log('\n✅ DONE!');
}

fixBuildings();
