/**
 * Check for duplicate project names
 */
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('../pagonis-87766-firebase-adminsdk-fbsvc-469209d7a0.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function main() {
  console.log('\n🔍 ΑΝΑΖΗΤΗΣΗ "Μεγάλου Αλεξάνδρου" PROJECTS:');
  console.log('='.repeat(60));

  const projectsSnapshot = await db.collection('projects').get();

  projectsSnapshot.forEach(doc => {
    const data = doc.data();
    const name = data.name || data.projectName || '';
    if (name.includes('Μεγάλου') || name.includes('Αλεξάνδρου')) {
      console.log('\n📍 Project ID: ' + doc.id);
      console.log('   Όνομα: ' + name);
      console.log('   Company: ' + (data.companyId || 'N/A'));
    }
  });

  // Check buildings for each
  console.log('\n\n🏢 ΚΤΙΡΙΑ ΑΝΑ PROJECT:');
  console.log('='.repeat(60));

  const buildingsSnapshot = await db.collection('buildings').get();
  const buildingsByProject = {};

  buildingsSnapshot.forEach(doc => {
    const data = doc.data();
    const pid = data.projectId;
    if (!buildingsByProject[pid]) buildingsByProject[pid] = 0;
    buildingsByProject[pid]++;
  });

  // Show projects and their building counts
  projectsSnapshot.forEach(doc => {
    const data = doc.data();
    const name = data.name || data.projectName || '';
    if (name.includes('Μεγάλου') || name.includes('Αλεξάνδρου')) {
      const count = buildingsByProject[doc.id] || 0;
      console.log('\n📍 ' + doc.id);
      console.log('   Όνομα: ' + name);
      console.log('   Κτίρια: ' + count);
    }
  });

  console.log('\n');
  process.exit(0);
}

main().catch(console.error);
