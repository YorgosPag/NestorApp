/**
 * =============================================================================
 * 🧹 ENTERPRISE: Clear `permissions` custom claim (cosmetic cleanup)
 * =============================================================================
 *
 * Removes the legacy `permissions` array from a user's custom claims. Used
 * after a super_admin downgrade where the claim is ineffective without the
 * `super_admin` role but still lingers and clutters audits.
 *
 * Counterpart context: ADR-356 owner migration 2026-05-16
 * (pagonis.oe@gmail.com downgraded; `permissions: ['admin_access']` leftover).
 *
 * USAGE:
 *   node scripts/clear-permissions.js
 *
 * Preserves: globalRole, companyId, mfaEnrolled, every other claim.
 * Removes:   permissions (the entire array).
 *
 * @module scripts/clear-permissions
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TARGET_EMAIL = 'pagonis.oe@gmail.com';

// =============================================================================
// LOAD SERVICE ACCOUNT
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
    console.error('❌ Failed to load service account:', error.message);
    process.exit(1);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🧹 ================================================');
  console.log('🧹 ENTERPRISE: Clear `permissions` claim');
  console.log('🧹 ================================================\n');

  console.log('📦 Loading service account...');
  const serviceAccount = loadServiceAccount();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  console.log('✅ Firebase Admin initialized\n');

  const auth = admin.auth();

  try {
    // ========================================================================
    // STEP 1: Find user
    // ========================================================================
    console.log(`🔍 Looking for user: ${TARGET_EMAIL}`);

    let user;
    try {
      user = await auth.getUserByEmail(TARGET_EMAIL);
      console.log(`✅ User found: ${user.uid}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Current Claims: ${JSON.stringify(user.customClaims || {})}\n`);
    } catch (error) {
      console.error(`❌ User not found: ${TARGET_EMAIL}`);
      process.exit(1);
    }

    const existingClaims = user.customClaims || {};

    if (!('permissions' in existingClaims)) {
      console.log('✨ No `permissions` claim present — nothing to do.\n');
      process.exit(0);
    }

    // ========================================================================
    // STEP 2: Strip `permissions` claim (preserve everything else)
    // ========================================================================
    console.log('🧹 Removing `permissions` claim (preserving rest)...');

    const { permissions: _removed, ...newClaims } = existingClaims;

    await auth.setCustomUserClaims(user.uid, newClaims);
    console.log('✅ Custom claims updated!');
    console.log(`   New Claims: ${JSON.stringify(newClaims)}\n`);

    // ========================================================================
    // STEP 3: Verify
    // ========================================================================
    console.log('🔍 Verifying claims...');
    const updatedUser = await auth.getUser(user.uid);
    console.log(`✅ Verified Claims: ${JSON.stringify(updatedUser.customClaims)}\n`);

    // ========================================================================
    // SUCCESS
    // ========================================================================
    console.log('🎉 ================================================');
    console.log('🎉 SUCCESS! `permissions` claim cleared.');
    console.log('🎉 ================================================\n');
    console.log('⚠️  IMPORTANT: If the user is currently signed in,');
    console.log('   they MUST sign out + sign in for the token to refresh.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
