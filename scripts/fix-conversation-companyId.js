/**
 * =============================================================================
 * FIX CONVERSATION COMPANY IDs - ONE-TIME MIGRATION SCRIPT
 * =============================================================================
 *
 * Fixes conversations that were created with wrong companyId ('pagonis-company')
 * and updates them to use the correct Firestore document ID (pzNUy8ksddGCtcQMqumR).
 *
 * @module scripts/fix-conversation-companyId
 * @enterprise One-time migration - DO NOT RUN TWICE
 *
 * USAGE:
 * ```bash
 * # Dry run (preview changes)
 * node scripts/fix-conversation-companyId.js
 *
 * # Execute migration
 * CONFIRM_MIGRATION=true node scripts/fix-conversation-companyId.js
 * ```
 *
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCRIPT_NAME = 'fix-conversation-companyId.js';

// The wrong companyId (slug) that was being used
const WRONG_COMPANY_ID = 'pagonis-company';

// The correct companyId (Firestore document ID)
const CORRECT_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';

// Confirmation required to execute
const CONFIRM_MIGRATION = process.env.CONFIRM_MIGRATION === 'true';

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

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function fixConversationCompanyIds() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  🔧 FIX CONVERSATION COMPANY IDs - ${SCRIPT_NAME}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Wrong companyId:   ${WRONG_COMPANY_ID}`);
  console.log(`  Correct companyId: ${CORRECT_COMPANY_ID}`);
  console.log(`  Mode:              ${CONFIRM_MIGRATION ? '🚀 EXECUTE' : '👀 DRY RUN'}`);
  console.log('');

  try {
    // Step 1: Find conversations with wrong companyId
    console.log('📋 Step 1: Finding conversations with wrong companyId...');

    const conversationsQuery = db.collection('conversations')
      .where('companyId', '==', WRONG_COMPANY_ID);

    const snapshot = await conversationsQuery.get();

    console.log(`   Found: ${snapshot.size} conversation(s) with companyId: '${WRONG_COMPANY_ID}'`);

    if (snapshot.size === 0) {
      console.log('');
      console.log('✅ No conversations need fixing!');
      console.log('');
      return;
    }

    // Step 2: List affected conversations
    console.log('');
    console.log('📋 Step 2: Affected conversations:');
    console.log('');

    const conversationsToFix = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      conversationsToFix.push({
        id: doc.id,
        channel: data.channel,
        status: data.status,
        messageCount: data.messageCount,
        createdAt: data.audit?.createdAt?.toDate?.() || 'unknown'
      });
      console.log(`   - ${doc.id} (${data.channel}, ${data.messageCount || 0} messages)`);
    });

    console.log('');

    // Step 3: Execute or preview
    if (!CONFIRM_MIGRATION) {
      console.log('⚠️  DRY RUN MODE - No changes will be made');
      console.log('');
      console.log('   To execute migration, run:');
      console.log(`   CONFIRM_MIGRATION=true node scripts/${SCRIPT_NAME}`);
      console.log('');
      return;
    }

    // Execute migration
    console.log('📋 Step 3: Updating conversations...');
    console.log('');

    const batch = db.batch();
    let updateCount = 0;

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        companyId: CORRECT_COMPANY_ID,
        'audit.updatedAt': admin.firestore.Timestamp.now(),
        'audit.migrationNote': `companyId fixed from '${WRONG_COMPANY_ID}' to '${CORRECT_COMPANY_ID}' on ${new Date().toISOString()}`
      });
      updateCount++;
      console.log(`   ✓ Queued: ${doc.id}`);
    });

    console.log('');
    console.log('   Committing batch update...');
    await batch.commit();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  ✅ MIGRATION COMPLETE - ${updateCount} conversation(s) fixed`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('');
    console.error(`❌ [${SCRIPT_NAME}] FAILED:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// =============================================================================
// RUN
// =============================================================================

fixConversationCompanyIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`❌ [${SCRIPT_NAME}] Unhandled error:`, error);
    process.exit(1);
  });
