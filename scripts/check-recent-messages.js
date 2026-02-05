/**
 * Check recent messages in Firestore
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

async function checkMessages() {
  console.log('📧 Checking recent messages in Firestore...\n');

  const snapshot = await db.collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('❌ No messages found');
    return;
  }

  console.log('📋 Recent Messages:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let idx = 0;
  snapshot.forEach((doc) => {
    idx++;
    const data = doc.data();
    const createdAt = data.createdAt && data.createdAt.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || 'N/A';

    console.log('\n📨 Message ' + idx + ':');
    console.log('   ID: ' + doc.id);
    console.log('   From: ' + (data.from || 'N/A'));
    console.log('   Subject: ' + (data.subject || 'N/A'));
    console.log('   Type: ' + (data.type || 'N/A'));
    console.log('   Direction: ' + (data.direction || 'N/A'));
    console.log('   Created: ' + createdAt);

    if (data.metadata && data.metadata.provider) {
      console.log('   Provider: ' + data.metadata.provider);
    }
    if (data.attachments && data.attachments.length > 0) {
      console.log('   Attachments: ' + data.attachments.length);
    }
    if (data.intentAnalysis) {
      console.log('   Intent: ' + (data.intentAnalysis.intentType || 'N/A'));
      console.log('   Confidence: ' + (data.intentAnalysis.confidence || 'N/A'));
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

checkMessages()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
