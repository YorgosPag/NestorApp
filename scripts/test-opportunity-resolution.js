/**
 * Test script for opportunity tenant resolution
 * Run with: pnpm exec node scripts/test-opportunity-resolution.js
 */

// Load environment variables manually
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

// Initialize if not already
if (!admin.apps.length) {
  // Try B64 key first, then JSON key
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
    console.log('✅ Using FIREBASE_SERVICE_ACCOUNT_KEY_B64');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('✅ Using FIREBASE_SERVICE_ACCOUNT_KEY');
  } else {
    console.error('❌ No Firebase service account key found in environment!');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function test() {
  console.log('🔍 Testing Opportunity tenant resolution...\n');

  // Get first 5 opportunities
  const snapshot = await db.collection('opportunities').limit(5).get();
  console.log('Found', snapshot.size, 'opportunities\n');

  let resolved = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('📄 Opportunity:', doc.id);
    console.log('   - title:', data.title || 'NONE');
    console.log('   - assignedTo:', data.assignedTo || 'NONE');
    console.log('   - createdBy:', data.createdBy || 'NONE');
    console.log('   - contactId:', data.contactId || 'NONE');
    console.log('   - companyId (direct):', data.companyId || 'NONE');

    // Try to resolve via assignedTo
    if (data.assignedTo) {
      const userDoc = await db.collection('users').doc(data.assignedTo).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const userCompanyId = userData.companyId;
        if (userCompanyId) {
          console.log('   ✅ RESOLVED via assignedTo! companyId:', userCompanyId);
          resolved++;
        } else {
          console.log('   ⚠️ User found but NO companyId');
          failed++;
        }
      } else {
        console.log('   ❌ User NOT found in users collection');
        failed++;
      }
    } else {
      console.log('   ❌ No assignedTo field');
      failed++;
    }
    console.log('');
  }

  console.log('================================');
  console.log('SUMMARY:');
  console.log('  Resolved:', resolved);
  console.log('  Failed:', failed);
  console.log('================================');
}

test()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
