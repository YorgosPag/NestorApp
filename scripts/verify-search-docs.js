/**
 * Verify search documents in Firestore
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });
}

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verify() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📊 SEARCH DOCUMENTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Get all search documents grouped by entityType
  const snapshot = await db.collection('searchDocuments').get();

  const byType = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const type = data.entityType || 'unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push({ id: doc.id, title: data.title, tenantId: data.tenantId });
  });

  console.log(`  Total search documents: ${snapshot.size}`);
  console.log('');
  console.log('  By entity type:');

  Object.keys(byType).sort().forEach(type => {
    console.log(`    ${type}: ${byType[type].length}`);
  });

  console.log('');

  // Show opportunity details
  if (byType.opportunity) {
    console.log('  Opportunity documents:');
    byType.opportunity.forEach(doc => {
      console.log(`    ✅ ${doc.id}`);
      console.log(`       title: ${doc.title}`);
      console.log(`       tenantId: ${doc.tenantId}`);
    });
  }

  console.log('');
}

verify()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
