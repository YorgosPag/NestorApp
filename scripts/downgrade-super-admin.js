/**
 * =============================================================================
 * 🔐 ENTERPRISE: Downgrade super_admin → external_user (revoke privileges)
 * =============================================================================
 *
 * Counterpart to set-super-admin.js. Used when migrating away from a legacy
 * super_admin account (e.g. ADR-356 owner migration: pagonis.oe@gmail.com →
 * georgios.pagonis@gmail.com on 2026-05-16). Keeps the user record intact for
 * audit/history references; only the role is downgraded.
 *
 * USAGE:
 *   node scripts/downgrade-super-admin.js
 *
 * Preserves: companyId, mfaEnrolled, all other custom claims.
 * Changes:   globalRole → external_user (or whatever TARGET_ROLE is set to).
 *
 * NOTE: The downgraded user MUST sign out + sign in to refresh their token.
 *
 * @module scripts/downgrade-super-admin
 */

const admin = require('firebase-admin');
const { initAdminApp, requireUserByEmail, printVerifiedClaims } = require('./_shared/firebaseAdminOps');
const { setClaimsWithMirror } = require('./_shared/setClaimsWithMirror');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TARGET_EMAIL = 'pagonis.oe@gmail.com';
const TARGET_ROLE = 'external_user';
// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🔻 ================================================');
  console.log('🔻 ENTERPRISE: Downgrade super_admin');
  console.log('🔻 ================================================\n');

  console.log('📦 Loading service account...');
  const { auth, db } = initAdminApp(admin);
  console.log('✅ Firebase Admin initialized\n');

  try {
    // ========================================================================
    // STEP 1: Find user
    // ========================================================================
    const user = await requireUserByEmail(auth, TARGET_EMAIL);

const existingClaims = user.customClaims || {};

    if (existingClaims.globalRole !== 'super_admin') {
      console.warn(`⚠️  Current globalRole is "${existingClaims.globalRole}" — not super_admin. Proceeding anyway to set ${TARGET_ROLE}.`);
    }

    // ========================================================================
    // STEP 2: Set downgraded claims (preserve companyId + mfaEnrolled + rest)
    // ========================================================================
    console.log(`🔻 Downgrading globalRole → ${TARGET_ROLE} (preserving other claims)...`);

    const newClaims = {
      ...existingClaims,
      globalRole: TARGET_ROLE,
    };

    // ADR-813: ΕΝΑΣ γραφέας. ⚠️ ΑΝΑΚΛΗΣΗ — χωρίς τον καθρέφτη ο υποβιβασμένος
    // κρατούσε τα προνόμιά του έως μία ώρα (όσο ζει το cached ID token).
    await setClaimsWithMirror(admin, user.uid, newClaims);
    console.log('✅ Custom claims updated!');
    console.log(`   New Claims: ${JSON.stringify(newClaims)}\n`);

    // ========================================================================
    // STEP 3: Update Firestore user document
    // ========================================================================
    console.log('📄 Updating Firestore user document...');

    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update({
        globalRole: TARGET_ROLE,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Firestore document UPDATED\n');
    } else {
      console.warn('⚠️  Firestore user doc does not exist — skipping doc update.\n');
    }

    // ========================================================================
    // STEP 4: Verify
    // ========================================================================
    await printVerifiedClaims(auth, user.uid);

// ========================================================================
    // SUCCESS
    // ========================================================================
    console.log('🎉 ================================================');
    console.log('🎉 SUCCESS! User downgraded.');
    console.log('🎉 ================================================\n');
    console.log('⚠️  IMPORTANT: If the user is currently signed in,');
    console.log('   they MUST sign out + sign in again for the new');
    console.log('   role to take effect (Firebase token refresh).\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
