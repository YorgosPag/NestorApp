/**
 * Check triage status for all messages
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

async function checkTriageStatus() {
  console.log('🔍 Checking triage status for all messages...\n');

  const snapshot = await db.collection('messages').get();

  if (snapshot.empty) {
    console.log('❌ No messages found');
    return;
  }

  const statusCounts = {};
  const noStatusMessages = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const status = data.triageStatus;

    if (status === undefined || status === null) {
      noStatusMessages.push({
        id: doc.id,
        from: data.from,
        subject: data.subject || (typeof data.content === 'string' ? data.content.substring(0, 50) : 'N/A')
      });
    } else {
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
  });

  console.log('📊 Triage Status Distribution:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`   ${status}: ${count}`);
  }

  if (noStatusMessages.length > 0) {
    console.log(`\n⚠️  Messages WITHOUT triageStatus: ${noStatusMessages.length}`);
    noStatusMessages.slice(0, 5).forEach(msg => {
      console.log(`   - ${msg.id}: ${msg.from} - ${msg.subject}`);
    });
    if (noStatusMessages.length > 5) {
      console.log(`   ... and ${noStatusMessages.length - 5} more`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📧 Total messages: ${snapshot.size}`);
}

checkTriageStatus()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
