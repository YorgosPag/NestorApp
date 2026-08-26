/**
 * =============================================================================
 * 🔐 ENTERPRISE: Direct Super Admin Claims Setup
 * =============================================================================
 *
 * Node.js script για να θέσει super_admin claims απευθείας μέσω Firebase Admin SDK.
 * Χρησιμοποιεί service account credentials από .env.local.
 *
 * 🏢 ENTERPRISE PATTERN: AWS CLI / Azure CLI style direct admin access
 *
 * USAGE:
 *   node scripts/set-super-admin.js
 *
 * @module scripts/set-super-admin
 */

const admin = require('firebase-admin');
const { initAdminApp, requireUserByEmail, printVerifiedClaims } = require('./_shared/firebaseAdminOps');
const { setClaimsWithMirror } = require('./_shared/setClaimsWithMirror');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TARGET_EMAIL = 'georgios.pagonis@gmail.com';
const TARGET_ROLE = 'super_admin';
// Google-level pattern: role-only elevation. Preserve the user's existing
// `companyId` claim instead of overwriting it. Avoids breaking references in
// audit logs, ownership records, and contacts created by this user.
// Fallback: if user has no companyId yet, use this default.
const FALLBACK_COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🔐 ================================================');
  console.log('🔐 ENTERPRISE: Direct Super Admin Setup');
  console.log('🔐 ================================================\n');

  // Initialize Firebase Admin
  console.log('📦 Loading service account...');
  const { auth, db } = initAdminApp(admin);
console.log('✅ Firebase Admin initialized\n');


  try {
    // ========================================================================
    // STEP 1: Find user by email
    // ========================================================================
    const user = await requireUserByEmail(auth, TARGET_EMAIL);

// ========================================================================
    // STEP 2: Set custom claims (preserve existing companyId)
    // ========================================================================
    console.log('🔐 Setting custom claims (role-only elevation)...');

    const existingClaims = user.customClaims || {};
    const preservedCompanyId = existingClaims.companyId || FALLBACK_COMPANY_ID;
    const preservedMfa = existingClaims.mfaEnrolled === true;

    if (existingClaims.companyId) {
      console.log(`   📌 Preserving existing companyId: ${preservedCompanyId}`);
    } else {
      console.log(`   ⚠️  No existing companyId — using fallback: ${preservedCompanyId}`);
    }

    const newClaims = {
      ...existingClaims,
      companyId: preservedCompanyId,
      globalRole: TARGET_ROLE,
      mfaEnrolled: preservedMfa,
    };

    // ADR-813: ΕΝΑΣ γραφέας — claims + καθρέφτης ADR-360 σε μία πράξη.
    await setClaimsWithMirror(admin, user.uid, newClaims);
    console.log('✅ Custom claims set successfully!');
    console.log(`   New Claims: ${JSON.stringify(newClaims)}\n`);

    // ========================================================================
    // STEP 3: Update/Create Firestore user document
    // ========================================================================
    console.log('📄 Updating Firestore user document...');

    const userRef = db.collection('users').doc(user.uid);
    const userData = {
      email: user.email,
      displayName: user.displayName || null,
      companyId: preservedCompanyId,
      globalRole: TARGET_ROLE,
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.update(userData);
      console.log('✅ Firestore document UPDATED\n');
    } else {
      await userRef.set({
        ...userData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Firestore document CREATED\n');
    }

    // ========================================================================
    // STEP 4: Verify
    // ========================================================================
    await printVerifiedClaims(auth, user.uid);

// ========================================================================
    // SUCCESS
    // ========================================================================
    console.log('🎉 ================================================');
    console.log('🎉 SUCCESS! Super Admin claims set!');
    console.log('🎉 ================================================\n');
    console.log('⚠️  IMPORTANT: You MUST sign out and sign in again');
    console.log('   to refresh your Firebase Auth token!\n');
    console.log('   1. Go to your app');
    console.log('   2. Sign Out');
    console.log('   3. Sign In again');
    console.log('   4. Your token will now have super_admin claims\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
