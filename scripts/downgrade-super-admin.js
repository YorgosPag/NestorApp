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
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TARGET_EMAIL = 'pagonis.oe@gmail.com';
const TARGET_ROLE = 'external_user';

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
  console.log('🔻 ================================================');
  console.log('🔻 ENTERPRISE: Downgrade super_admin');
  console.log('🔻 ================================================\n');

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
  const db = admin.firestore();

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
      console.log(`   Display Name: ${user.displayName || 'N/A'}`);
      console.log(`   Current Claims: ${JSON.stringify(user.customClaims || {})}\n`);
    } catch (error) {
      console.error(`❌ User not found: ${TARGET_EMAIL}`);
      process.exit(1);
    }

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

    await auth.setCustomUserClaims(user.uid, newClaims);
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
    console.log('🔍 Verifying claims...');
    const updatedUser = await auth.getUser(user.uid);
    console.log(`✅ Verified Claims: ${JSON.stringify(updatedUser.customClaims)}\n`);

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
