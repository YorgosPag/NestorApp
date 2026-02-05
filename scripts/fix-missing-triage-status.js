/**
 * Fix messages without triageStatus
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load env
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (e) {}
}

loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// Init Firebase
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (serviceAccount) {
  const credentials = JSON.parse(serviceAccount);
  admin.initializeApp({
    credential: admin.credential.cert(credentials),
    projectId: credentials.project_id
  });
}

const db = admin.firestore();

async function fixMissingStatus() {
  console.log('🔧 Fixing messages without triageStatus...\n');

  const snapshot = await db.collection('messages').get();

  const batch = db.batch();
  let count = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.triageStatus === undefined || data.triageStatus === null) {
      console.log(`   📝 Fixing: ${doc.id}`);
      batch.update(doc.ref, {
        triageStatus: 'pending',
        updatedAt: new Date()
      });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`\n✅ Fixed ${count} messages`);
  } else {
    console.log('✅ No messages need fixing');
  }
}

fixMissingStatus()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
