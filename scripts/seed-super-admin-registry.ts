/**
 * =============================================================================
 * SEED: SUPER ADMIN REGISTRY — ADR-145
 * =============================================================================
 *
 * Creates the initial super admin registry in Firestore.
 * Run once to bootstrap the `settings/super_admin_registry` document.
 *
 * Usage:
 *   npx tsx scripts/seed-super-admin-registry.ts
 *
 * Prerequisites:
 *   - Firebase Admin SDK credentials (GOOGLE_APPLICATION_CREDENTIALS or similar)
 *   - Firestore access to the target project
 *
 * @see ADR-145 (Super Admin AI Assistant)
 */

import * as admin from 'firebase-admin';

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'pagonis-87766',
  });
}

const db = admin.firestore();

// ============================================================================
// ADMIN DATA
// ============================================================================

/**
 * Super admin identities — REAL production values.
 *
 * Γιώργος Παγώνης: Telegram @SteFanoThess (ψευδώνυμο), userId 5618410820
 */
const INITIAL_ADMINS = [
  {
    firebaseUid: null,
    displayName: 'Γιώργος Παγώνης',
    channels: {
      telegram: {
        userId: '5618410820',
        chatId: '5618410820',
      },
      email: {
        addresses: ['gpagonis@layera.gr'],
      },
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seedSuperAdminRegistry(): Promise<void> {
  const docPath = 'settings/super_admin_registry';

  console.log('=== Super Admin Registry Seed ===');
  console.log(`Target: ${docPath}`);

  // Check if document already exists
  const docRef = db.doc(docPath);
  const existing = await docRef.get();

  if (existing.exists) {
    console.log('Registry already exists. Existing admins:');
    const data = existing.data();
    const admins = data?.admins ?? [];
    for (const adm of admins) {
      console.log(`  - ${adm.displayName} (active: ${adm.isActive})`);
    }
    console.log('\nTo overwrite, delete the document first and re-run this script.');
    return;
  }

  // Create the registry document
  const registryDoc = {
    admins: INITIAL_ADMINS,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };

  await docRef.set(registryDoc);

  console.log('Registry created successfully!');
  console.log(`Admins registered: ${INITIAL_ADMINS.length}`);
  for (const adm of INITIAL_ADMINS) {
    console.log(`  - ${adm.displayName}`);
  }
  console.log('\nIMPORTANT: Update the placeholder values (Telegram IDs, emails) in Firestore.');
}

// ============================================================================
// EXECUTE
// ============================================================================

seedSuperAdminRegistry()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
