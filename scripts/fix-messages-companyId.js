/**
 * =============================================================================
 * FIX MESSAGES COMPANY IDs - MIGRATION SCRIPT
 * =============================================================================
 *
 * Fixes messages that were created without companyId or with wrong companyId.
 * Updates them to use the correct Firestore document ID.
 *
 * @module scripts/fix-messages-companyId
 * @enterprise One-time migration
 *
 * USAGE:
 * ```bash
 * # Dry run (preview changes)
 * node scripts/fix-messages-companyId.js
 *
 * # Execute migration
 * CONFIRM_MIGRATION=true node scripts/fix-messages-companyId.js
 * ```
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCRIPT_NAME = 'fix-messages-companyId.js';

// The correct companyId (Firestore document ID)
const CORRECT_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';

// Wrong companyIds to fix
const WRONG_COMPANY_IDS = ['pagonis-company'];

// Confirmation required to execute
const CONFIRM_MIGRATION = process.env.CONFIRM_MIGRATION === 'true';

// Batch size (Firestore limit is 500)
const BATCH_SIZE = 400;

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

async function fixMessagesCompanyIds() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  🔧 FIX MESSAGES COMPANY IDs - ${SCRIPT_NAME}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Correct companyId: ${CORRECT_COMPANY_ID}`);
  console.log(`  Mode:              ${CONFIRM_MIGRATION ? '🚀 EXECUTE' : '👀 DRY RUN'}`);
  console.log('');

  try {
    // Step 1: Get ALL messages
    console.log('📋 Step 1: Loading all messages...');

    const snapshot = await db.collection('messages').get();
    console.log(`   Total messages: ${snapshot.size}`);

    // Step 2: Find messages needing fix
    console.log('');
    console.log('📋 Step 2: Analyzing messages...');

    const messagesToFix = [];
    const stats = {
      noCompanyId: 0,
      wrongCompanyId: 0,
      correct: 0
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      const currentCompanyId = data.companyId;

      if (!currentCompanyId) {
        stats.noCompanyId++;
        messagesToFix.push({ id: doc.id, ref: doc.ref, reason: 'missing' });
      } else if (WRONG_COMPANY_IDS.includes(currentCompanyId)) {
        stats.wrongCompanyId++;
        messagesToFix.push({ id: doc.id, ref: doc.ref, reason: `wrong (${currentCompanyId})` });
      } else if (currentCompanyId === CORRECT_COMPANY_ID) {
        stats.correct++;
      } else {
        // Unknown companyId - log but don't fix
        console.log(`   ⚠️  Unknown companyId: ${currentCompanyId} for ${doc.id}`);
      }
    });

    console.log('');
    console.log('   Statistics:');
    console.log(`     ✅ Correct companyId: ${stats.correct}`);
    console.log(`     ⚠️  Missing companyId: ${stats.noCompanyId}`);
    console.log(`     ⚠️  Wrong companyId: ${stats.wrongCompanyId}`);
    console.log(`     📝 Total to fix: ${messagesToFix.length}`);
    console.log('');

    if (messagesToFix.length === 0) {
      console.log('✅ No messages need fixing!');
      console.log('');
      return;
    }

    // Show sample of messages to fix
    console.log('📋 Sample messages to fix:');
    messagesToFix.slice(0, 5).forEach(msg => {
      console.log(`   - ${msg.id} (${msg.reason})`);
    });
    if (messagesToFix.length > 5) {
      console.log(`   ... and ${messagesToFix.length - 5} more`);
    }
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

    // Execute migration in batches
    console.log(`📋 Step 3: Updating ${messagesToFix.length} messages in batches of ${BATCH_SIZE}...`);
    console.log('');

    let totalUpdated = 0;
    const batches = [];

    // Split into batches
    for (let i = 0; i < messagesToFix.length; i += BATCH_SIZE) {
      batches.push(messagesToFix.slice(i, i + BATCH_SIZE));
    }

    console.log(`   Processing ${batches.length} batch(es)...`);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batchMessages = batches[batchIdx];
      const batch = db.batch();

      batchMessages.forEach(msg => {
        batch.update(msg.ref, {
          companyId: CORRECT_COMPANY_ID,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      });

      await batch.commit();
      totalUpdated += batchMessages.length;
      console.log(`   ✓ Batch ${batchIdx + 1}/${batches.length} complete (${totalUpdated}/${messagesToFix.length})`);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  ✅ MIGRATION COMPLETE - ${totalUpdated} message(s) fixed`);
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

fixMessagesCompanyIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`❌ [${SCRIPT_NAME}] Unhandled error:`, error);
    process.exit(1);
  });
