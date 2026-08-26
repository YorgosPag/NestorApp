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
const { initAdminApp, requireUserByEmail, printVerifiedClaims } = require('./_shared/firebaseAdminOps');
const { setClaimsWithMirror } = require('./_shared/setClaimsWithMirror');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TARGET_EMAIL = 'pagonis.oe@gmail.com';
// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🧹 ================================================');
  console.log('🧹 ENTERPRISE: Clear `permissions` claim');
  console.log('🧹 ================================================\n');

  console.log('📦 Loading service account...');
  const { auth } = initAdminApp(admin);
  console.log('✅ Firebase Admin initialized\n');

  try {
    // ========================================================================
    // STEP 1: Find user
    // ========================================================================
    const user = await requireUserByEmail(auth, TARGET_EMAIL);

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

    // ADR-813: ΕΝΑΣ γραφέας. ⚠️ ΑΝΑΚΛΗΣΗ — βλ. downgrade-super-admin.js.
    await setClaimsWithMirror(admin, user.uid, newClaims);
    console.log('✅ Custom claims updated!');
    console.log(`   New Claims: ${JSON.stringify(newClaims)}\n`);

    // ========================================================================
    // STEP 3: Verify
    // ========================================================================
    await printVerifiedClaims(auth, user.uid);

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
