/**
 * 🔍 Test loading floor floorplan directly
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, '..', 'pagonis-87766-firebase-adminsdk-fbsvc-469209d7a0.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'pagonis-87766.firebasestorage.app'
});

const db = getFirestore();
const storage = getStorage(app);

async function testLoadFloorplan() {
  const fileId = 'floor_floorplan_L9nBzX3rYhM6kS8vF2dG_flr_e894d5a9-037a-4a7a-960b-b2d531e8955d';

  console.log('🔍 Testing load for fileId: ' + fileId);
  console.log('');

  // 1. Check cad_files collection
  console.log('1️⃣ Checking cad_files collection...');
  const cadFileDoc = await db.collection('cad_files').doc(fileId).get();
  if (cadFileDoc.exists) {
    const data = cadFileDoc.data();
    console.log('   ✅ CadFile exists');
    console.log('   fileName: ' + data.fileName);
    console.log('   hasScene: ' + !!data.scene);
    console.log('   lastModified: ' + data.lastModified);
  } else {
    console.log('   ❌ CadFile NOT found');
  }

  // 2. Check Firebase Storage
  console.log('\n2️⃣ Checking Firebase Storage...');
  const bucket = storage.bucket();
  const storagePath = 'dxf-scenes/' + fileId + '/scene.json';

  try {
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();

    if (exists) {
      console.log('   ✅ Storage file exists: ' + storagePath);
      const [metadata] = await file.getMetadata();
      console.log('   Size: ' + metadata.size + ' bytes');
      console.log('   Updated: ' + metadata.updated);
    } else {
      console.log('   ❌ Storage file NOT found: ' + storagePath);
    }
  } catch (error) {
    console.log('   ❌ Error checking storage: ' + error.message);
  }

  // 3. Try loading scene from storage
  console.log('\n3️⃣ Trying to load scene data...');
  try {
    const file = bucket.file(storagePath);
    const [content] = await file.download();
    const sceneData = JSON.parse(content.toString());

    console.log('   ✅ Scene loaded successfully!');
    console.log('   Entity count: ' + (sceneData.entities?.length || 0));
    console.log('   Layer count: ' + (sceneData.layers?.length || 0));
  } catch (error) {
    console.log('   ❌ Error loading scene: ' + error.message);
  }

  console.log('\n✅ TEST COMPLETE');
}

testLoadFloorplan();
