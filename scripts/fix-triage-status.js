/**
 * Fix existing emails to have triageStatus: 'pending'
 *
 * This script updates all messages with triageStatus: 'reviewed' to 'pending'
 * so they appear in the AI Inbox triage queue.
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

async function fixTriageStatus() {
  console.log('🔧 Fixing triage status for existing messages...\n');

  // Find all messages with triageStatus: 'reviewed'
  const snapshot = await db.collection('messages')
    .where('triageStatus', '==', 'reviewed')
    .get();

  if (snapshot.empty) {
    console.log('✅ No messages with triageStatus: reviewed found');
    return;
  }

  console.log(`📧 Found ${snapshot.size} messages with triageStatus: 'reviewed'\n`);

  let updated = 0;
  const batch = db.batch();

  snapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`   📝 ${doc.id}: ${data.subject || data.content?.substring(0, 50) || 'No subject'}`);

    batch.update(doc.ref, {
      triageStatus: 'pending',
      updatedAt: new Date()
    });
    updated++;
  });

  await batch.commit();

  console.log(`\n✅ Updated ${updated} messages to triageStatus: 'pending'`);
  console.log('🔄 Refresh the AI Inbox to see the changes');
}

fixTriageStatus()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
