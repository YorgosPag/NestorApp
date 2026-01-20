/**
 * List ALL FileRecords (including soft-deleted)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadServiceAccount() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
  if (!match) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found');
  return JSON.parse(match[1].trim());
}

async function main() {
  console.log('🔍 Listing ALL FileRecords (including deleted)...\n');

  const serviceAccount = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();

  try {
    const filesRef = db.collection('files');
    const snapshot = await filesRef.get();

    console.log(`📊 Total FileRecords: ${snapshot.size}\n`);
    console.log('=' .repeat(80));

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      const isDeleted = data.isDeleted === true;

      console.log(`\n${isDeleted ? '🗑️ ' : '📄 '}${doc.id}`);
      console.log(`   displayName: ${data.displayName || 'N/A'}`);
      console.log(`   status:      ${data.status || 'N/A'}`);
      console.log(`   isDeleted:   ${data.isDeleted || false}`);
      console.log(`   companyId:   ${data.companyId || 'N/A'}`);
      console.log(`   createdBy:   ${data.createdBy || 'N/A'}`);

      if (isDeleted) {
        console.log(`   deletedAt:   ${data.deletedAt ? new Date(data.deletedAt._seconds * 1000).toISOString() : 'N/A'}`);
        console.log(`   deletedBy:   ${data.deletedBy || 'N/A'}`);
      }
    });

    console.log('\n' + '=' .repeat(80));

    // Count stats
    const deletedCount = snapshot.docs.filter(d => d.data().isDeleted === true).length;
    const activeCount = snapshot.size - deletedCount;
    console.log(`\n📊 Summary:`);
    console.log(`   Active files:  ${activeCount}`);
    console.log(`   Deleted files: ${deletedCount}`);

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

main();
