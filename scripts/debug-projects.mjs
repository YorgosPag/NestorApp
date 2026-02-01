/**
 * 🔍 Debug Projects and Buildings
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

async function debugProjects() {
  console.log('🔍 DEBUGGING PROJECTS AND BUILDINGS...\n');

  // Get all projects
  console.log('='.repeat(60));
  console.log('📁 ALL PROJECTS:');
  console.log('='.repeat(60));
  const projectsSnapshot = await db.collection('projects').get();
  const projects = [];
  projectsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    projects.push({ id: doc.id, name: data.name });
    console.log('\n   Project ID: ' + doc.id);
    console.log('   Name: ' + data.name);
  });

  // For each project, count buildings
  console.log('\n' + '='.repeat(60));
  console.log('🏢 BUILDINGS COUNT PER PROJECT:');
  console.log('='.repeat(60));

  for (const project of projects) {
    const buildingsSnapshot = await db.collection('buildings')
      .where('projectId', '==', project.id)
      .get();
    console.log('\n   ' + project.name + ' (' + project.id + ')');
    console.log('   Buildings: ' + buildingsSnapshot.size);

    if (buildingsSnapshot.size > 0) {
      buildingsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('     - ' + data.name);
      });
    }
  }

  // Check for buildings with wrong/missing projectId
  console.log('\n' + '='.repeat(60));
  console.log('⚠️ ALL BUILDINGS (checking projectIds):');
  console.log('='.repeat(60));
  const allBuildingsSnapshot = await db.collection('buildings').get();
  allBuildingsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const projectExists = projects.find(p => p.id === data.projectId);
    const status = projectExists ? '✅' : '❌ INVALID';
    console.log('\n   ' + status + ' ' + data.name);
    console.log('      ID: ' + doc.id);
    console.log('      projectId: ' + data.projectId);
    if (!projectExists) {
      console.log('      ⚠️ Project not found!');
    }
  });

  console.log('\n✅ DEBUG COMPLETE');
}

debugProjects();
