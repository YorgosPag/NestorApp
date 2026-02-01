/**
 * Find projects that have buildings (for testing floor selection)
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require('../pagonis-87766-firebase-adminsdk-fbsvc-469209d7a0.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  console.log('\n📋 PROJECTS ΜΕ ΚΤΙΡΙΑ (για να δεις ορόφους):');
  console.log('='.repeat(60));

  // Get all buildings grouped by projectId
  const buildingsSnapshot = await db.collection('buildings').get();
  const buildingsByProject = {};

  buildingsSnapshot.forEach(doc => {
    const data = doc.data();
    const projectId = data.projectId || 'unknown';
    if (!buildingsByProject[projectId]) {
      buildingsByProject[projectId] = [];
    }
    buildingsByProject[projectId].push({
      id: doc.id,
      name: data.name || data.buildingName || doc.id
    });
  });

  // Get project names
  for (const [projectId, buildings] of Object.entries(buildingsByProject)) {
    if (buildings.length === 0) continue;

    const projectDoc = await db.collection('projects').doc(projectId).get();
    let projectName = projectId;
    if (projectDoc.exists) {
      const data = projectDoc.data();
      projectName = data.name || data.projectName || projectId;
    }

    console.log('\n✅ ' + projectName);
    console.log('   ID: ' + projectId);
    console.log('   Κτίρια: ' + buildings.length);
    buildings.forEach((b, i) => {
      console.log('   ' + (i + 1) + '. ' + b.name);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 Επέλεξε ένα από τα παραπάνω projects για να δεις ορόφους!');
  console.log('');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
