/**
 * =============================================================================
 * DIAGNOSE TELEGRAM INTEGRATION - DIAGNOSTIC SCRIPT
 * =============================================================================
 *
 * Checks all aspects of Telegram integration:
 * - Conversations collection
 * - Messages collection
 * - External identities
 * - User custom claims
 *
 * @module scripts/diagnose-telegram
 * @enterprise Diagnostic tool
 *
 * USAGE:
 * ```bash
 * node scripts/diagnose-telegram.js
 * ```
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCRIPT_NAME = 'diagnose-telegram.js';
const CORRECT_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';
const USER_EMAIL = process.env.USER_EMAIL || 'pagonis.oe@gmail.com';

// =============================================================================
// INITIALIZE
// =============================================================================

let envVars;
try {
  envVars = loadEnvLocal();
} catch (error) {
  console.error(`❌ [${SCRIPT_NAME}] Failed to load environment:`, error.message);
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log(`✅ [${SCRIPT_NAME}] Firebase Admin initialized`);
} catch (error) {
  console.error(`❌ [${SCRIPT_NAME}] Failed to initialize Firebase Admin:`, error.message);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function diagnose() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔍 TELEGRAM INTEGRATION DIAGNOSTICS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // 1. Check User Custom Claims
  console.log('📋 1. USER CUSTOM CLAIMS');
  console.log('─────────────────────────');
  try {
    const user = await auth.getUserByEmail(USER_EMAIL);
    const claims = user.customClaims || {};
    console.log(`   Email: ${USER_EMAIL}`);
    console.log(`   UID: ${user.uid}`);
    console.log(`   companyId: ${claims.companyId || '❌ NOT SET'}`);
    console.log(`   globalRole: ${claims.globalRole || '❌ NOT SET'}`);

    if (claims.companyId === CORRECT_COMPANY_ID) {
      console.log(`   ✅ companyId matches expected: ${CORRECT_COMPANY_ID}`);
    } else {
      console.log(`   ⚠️  companyId MISMATCH! Expected: ${CORRECT_COMPANY_ID}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');

  // 2. Check Conversations
  console.log('📋 2. CONVERSATIONS COLLECTION');
  console.log('─────────────────────────────────');
  try {
    const convSnapshot = await db.collection('conversations').get();
    console.log(`   Total: ${convSnapshot.size} conversation(s)`);

    if (convSnapshot.size > 0) {
      const byCompanyId = {};
      convSnapshot.forEach(doc => {
        const data = doc.data();
        const cid = data.companyId || 'NO_COMPANY_ID';
        byCompanyId[cid] = (byCompanyId[cid] || 0) + 1;
      });

      console.log('   By companyId:');
      for (const [cid, count] of Object.entries(byCompanyId)) {
        const status = cid === CORRECT_COMPANY_ID ? '✅' : '⚠️';
        console.log(`     ${status} ${cid}: ${count}`);
      }

      // Show details of first few
      console.log('');
      console.log('   Latest conversations:');
      const sorted = convSnapshot.docs.slice(0, 3);
      for (const doc of sorted) {
        const data = doc.data();
        console.log(`     - ${doc.id}`);
        console.log(`       channel: ${data.channel}, companyId: ${data.companyId}`);
        console.log(`       messages: ${data.messageCount}, status: ${data.status}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');

  // 3. Check Messages
  console.log('📋 3. MESSAGES COLLECTION');
  console.log('───────────────────────────');
  try {
    const msgSnapshot = await db.collection('messages').get();
    console.log(`   Total: ${msgSnapshot.size} message(s)`);

    if (msgSnapshot.size > 0) {
      const byCompanyId = {};
      const byDirection = { inbound: 0, outbound: 0, unknown: 0 };

      msgSnapshot.forEach(doc => {
        const data = doc.data();
        const cid = data.companyId || 'NO_COMPANY_ID';
        byCompanyId[cid] = (byCompanyId[cid] || 0) + 1;
        byDirection[data.direction || 'unknown']++;
      });

      console.log('   By companyId:');
      for (const [cid, count] of Object.entries(byCompanyId)) {
        const status = cid === CORRECT_COMPANY_ID ? '✅' : '⚠️';
        console.log(`     ${status} ${cid}: ${count}`);
      }

      console.log('   By direction:');
      console.log(`     inbound: ${byDirection.inbound}, outbound: ${byDirection.outbound}`);

      // Show details of latest messages
      console.log('');
      console.log('   Latest messages:');
      const sorted = msgSnapshot.docs.slice(-5);
      for (const doc of sorted) {
        const data = doc.data();
        const text = data.content?.text?.substring(0, 50) || '[no text]';
        console.log(`     - ${data.direction}: "${text}..." (companyId: ${data.companyId})`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');

  // 4. Check External Identities
  console.log('📋 4. EXTERNAL IDENTITIES COLLECTION');
  console.log('───────────────────────────────────────');
  try {
    const idSnapshot = await db.collection('external_identities').get();
    console.log(`   Total: ${idSnapshot.size} identity(ies)`);

    if (idSnapshot.size > 0) {
      idSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`     - ${doc.id}`);
        console.log(`       provider: ${data.provider}, displayName: ${data.displayName}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');

  // 5. Check Environment
  console.log('📋 5. ENVIRONMENT VARIABLES');
  console.log('─────────────────────────────');
  const defaultCompanyId = envVars.NEXT_PUBLIC_DEFAULT_COMPANY_ID;
  console.log(`   NEXT_PUBLIC_DEFAULT_COMPANY_ID: ${defaultCompanyId || '❌ NOT SET'}`);
  if (defaultCompanyId === CORRECT_COMPANY_ID) {
    console.log(`   ✅ Matches expected: ${CORRECT_COMPANY_ID}`);
  } else {
    console.log(`   ⚠️  MISMATCH! Expected: ${CORRECT_COMPANY_ID}`);
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🏁 DIAGNOSIS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

// =============================================================================
// RUN
// =============================================================================

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`❌ [${SCRIPT_NAME}] Unhandled error:`, error);
    process.exit(1);
  });
