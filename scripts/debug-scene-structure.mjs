/**
 * 🔍 Debug Scene Structure - Check what the scene data looks like
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

async function debugSceneStructure() {
  const fileId = 'floor_floorplan_L9nBzX3rYhM6kS8vF2dG_flr_e894d5a9-037a-4a7a-960b-b2d531e8955d';
  const storagePath = 'dxf-scenes/' + fileId + '/scene.json';

  console.log('🔍 Debugging scene structure for:', fileId);
  console.log('');

  // Load scene from storage
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const [content] = await file.download();
  const scene = JSON.parse(content.toString());

  console.log('📊 SCENE STRUCTURE:');
  console.log('='.repeat(60));
  console.log('');

  // Check top-level properties
  console.log('🔑 Top-level keys:', Object.keys(scene));
  console.log('');

  // Check entities
  if (scene.entities) {
    console.log('✅ scene.entities exists');
    console.log('   Length:', scene.entities.length);
    console.log('   First entity:', JSON.stringify(scene.entities[0], null, 2).slice(0, 200));

    // Check entity types
    const types = {};
    scene.entities.forEach(e => {
      types[e.type] = (types[e.type] || 0) + 1;
    });
    console.log('   Entity types:', types);
  } else {
    console.log('❌ scene.entities is MISSING');
  }

  // Check layers
  if (scene.layers) {
    console.log('');
    if (Array.isArray(scene.layers)) {
      console.log('✅ scene.layers is an ARRAY with', scene.layers.length, 'items');
    } else {
      console.log('✅ scene.layers is an OBJECT with keys:', Object.keys(scene.layers).slice(0, 10));
      console.log('   Sample layer data:');
      Object.entries(scene.layers).slice(0, 3).forEach(([key, value]) => {
        console.log('     ' + key + ':', JSON.stringify(value));
      });
    }
  } else {
    console.log('❌ scene.layers is MISSING');
  }

  // Check bounds
  if (scene.bounds) {
    console.log('');
    console.log('✅ scene.bounds:', JSON.stringify(scene.bounds));
  } else {
    console.log('❌ scene.bounds is MISSING');
  }

  // Check if scene.scene exists (nested)
  if (scene.scene) {
    console.log('');
    console.log('⚠️ NESTED scene.scene exists - this could be the issue!');
    console.log('   scene.scene keys:', Object.keys(scene.scene));
  }

  console.log('');
  console.log('✅ DEBUG COMPLETE');
}

debugSceneStructure();
