/**
 * =============================================================================
 * UPDATE SUPER ADMIN REGISTRY — Add Messenger PSID + WhatsApp Phone
 * =============================================================================
 *
 * Reads the super_admin_registry, finds Γιώργος Παγώνης,
 * and adds messenger.psid + whatsapp.phoneNumber from stored conversations.
 *
 * Usage:
 *   node scripts/update-admin-messenger-psid.js
 *
 * @see ADR-145 (Super Admin AI Assistant)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// =============================================================================
// LOAD SERVICE ACCOUNT (same pattern as set-super-admin.js)
// =============================================================================

function loadServiceAccount() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');

    const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
    if (!match) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
    }

    return JSON.parse(match[1].trim());
  } catch (error) {
    console.error('Failed to load service account:', error.message);
    process.exit(1);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('=== Update Super Admin Registry: Messenger + WhatsApp ===\n');

  const serviceAccount = loadServiceAccount();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const db = admin.firestore();

  // ── Step 1: Find Messenger conversations to get PSID ──
  console.log('Step 1: Searching for Messenger conversations...\n');

  const conversations = await db.collection('conversations')
    .where('channel', '==', 'MESSENGER')
    .limit(10)
    .get();

  if (conversations.empty) {
    console.log('No Messenger conversations found.');
    console.log('The PSID will appear after Giorgos sends a message via Messenger.');
    console.log('');
    console.log('ALTERNATIVE: Check the external_identities collection...\n');

    const identities = await db.collection('external_identities')
      .where('provider', '==', 'MESSENGER')
      .limit(10)
      .get();

    if (!identities.empty) {
      console.log('Found external identities:');
      identities.forEach(doc => {
        const data = doc.data();
        console.log(`  - ID: ${doc.id}, userId: ${data.externalUserId}, name: ${data.displayName}`);
      });
    }

    // Also check messages collection
    console.log('\nChecking messages collection for Messenger messages...\n');
    const messages = await db.collection('messages')
      .where('channel', '==', 'MESSENGER')
      .limit(10)
      .get();

    if (!messages.empty) {
      console.log('Found Messenger messages:');
      messages.forEach(doc => {
        const data = doc.data();
        console.log(`  - ID: ${doc.id}`);
        console.log(`    from: ${data.from || 'N/A'}`);
        console.log(`    senderId: ${data.senderId || 'N/A'}`);
        console.log(`    senderName: ${data.senderName || 'N/A'}`);
        console.log(`    chatId: ${data.chatId || 'N/A'}`);
        console.log(`    conversationId: ${data.conversationId || 'N/A'}`);
      });
    } else {
      console.log('No Messenger messages found either.');
    }
  } else {
    console.log('Found Messenger conversations:');
    conversations.forEach(doc => {
      const data = doc.data();
      console.log(`  - ID: ${doc.id}`);
      console.log(`    chatId: ${data.chatId || 'N/A'}`);
      console.log(`    senderName: ${data.senderName || 'N/A'}`);
      console.log(`    participantId: ${data.participantId || 'N/A'}`);
    });
  }

  // ── Step 2: Read current registry ──
  console.log('\n\nStep 2: Reading current super_admin_registry...\n');

  const registryRef = db.doc('settings/super_admin_registry');
  const registryDoc = await registryRef.get();

  if (!registryDoc.exists) {
    console.log('Registry document not found!');
    process.exit(1);
  }

  const registry = registryDoc.data();
  const admins = registry.admins || [];

  console.log(`Found ${admins.length} admin(s):`);
  admins.forEach((adm, i) => {
    console.log(`  [${i}] ${adm.displayName} (active: ${adm.isActive})`);
    console.log(`       telegram: ${adm.channels?.telegram?.userId || 'N/A'}`);
    console.log(`       email: ${JSON.stringify(adm.channels?.email?.addresses || [])}`);
    console.log(`       whatsapp: ${adm.channels?.whatsapp?.phoneNumber || 'N/A'}`);
    console.log(`       messenger: ${adm.channels?.messenger?.psid || 'N/A'}`);
    console.log(`       instagram: ${adm.channels?.instagram?.igsid || 'N/A'}`);
  });

  // ── Step 3: Check pipeline queue for Messenger messages with sender info ──
  console.log('\n\nStep 3: Checking ai_pipeline_queue for Messenger messages...\n');

  const queueItems = await db.collection('ai_pipeline_queue')
    .where('channel', '==', 'messenger')
    .limit(5)
    .get();

  if (!queueItems.empty) {
    console.log('Found pipeline queue items:');
    queueItems.forEach(doc => {
      const data = doc.data();
      const sender = data.intakeMessage?.normalized?.sender;
      console.log(`  - ID: ${doc.id}`);
      console.log(`    messengerUserId: ${sender?.messengerUserId || 'N/A'}`);
      console.log(`    name: ${sender?.name || 'N/A'}`);
      console.log(`    rawPayload.psid: ${data.intakeMessage?.rawPayload?.psid || 'N/A'}`);
    });
  } else {
    console.log('No Messenger items in pipeline queue.');
  }

  console.log('\n=== DONE ===');
  console.log('\nTo update the registry with PSID, run:');
  console.log('  node scripts/update-admin-messenger-psid.js --update PSID_VALUE');

  // ── Step 4: If --update flag is passed, update the registry ──
  const updateFlag = process.argv.indexOf('--update');
  if (updateFlag !== -1) {
    const psid = process.argv[updateFlag + 1];
    if (!psid) {
      console.error('\nMissing PSID value. Usage: --update PSID_VALUE');
      process.exit(1);
    }

    const whatsappFlag = process.argv.indexOf('--whatsapp');
    const whatsappPhone = whatsappFlag !== -1 ? process.argv[whatsappFlag + 1] : null;

    console.log(`\n\nUpdating registry for Giorgos Pagonis...`);
    console.log(`  Messenger PSID: ${psid}`);
    if (whatsappPhone) {
      console.log(`  WhatsApp Phone: ${whatsappPhone}`);
    }

    // Find Giorgos in the admins array
    const giorgosIndex = admins.findIndex(a => a.displayName === 'Γιώργος Παγώνης');
    if (giorgosIndex === -1) {
      console.error('Admin "Γιώργος Παγώνης" not found in registry!');
      process.exit(1);
    }

    // Update channels
    admins[giorgosIndex].channels.messenger = { psid };
    if (whatsappPhone) {
      admins[giorgosIndex].channels.whatsapp = { phoneNumber: whatsappPhone };
    }
    admins[giorgosIndex].updatedAt = new Date().toISOString();

    await registryRef.update({
      admins,
      updatedAt: new Date().toISOString(),
    });

    console.log('Registry UPDATED successfully!');
    console.log('Cache will refresh within 5 minutes (or on next cold start).');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
