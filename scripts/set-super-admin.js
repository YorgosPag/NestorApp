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
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TARGET_EMAIL = 'georgios.pagonis@gmail.com';
const TARGET_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';
const TARGET_ROLE = 'super_admin';

// =============================================================================
// LOAD SERVICE ACCOUNT
// =============================================================================

function loadServiceAccount() {
  try {
    // Read .env.local
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');

    // Extract FIREBASE_SERVICE_ACCOUNT_KEY
    const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
    if (!match) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
    }

    // Parse JSON (handle potential line breaks)
    const jsonStr = match[1].trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('❌ Failed to load service account:', error.message);
    process.exit(1);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🔐 ================================================');
  console.log('🔐 ENTERPRISE: Direct Super Admin Setup');
  console.log('🔐 ================================================\n');

  // Initialize Firebase Admin
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
    // STEP 1: Find user by email
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

    // ========================================================================
    // STEP 2: Set custom claims
    // ========================================================================
    console.log('🔐 Setting custom claims...');

    const newClaims = {
      companyId: TARGET_COMPANY_ID,
      globalRole: TARGET_ROLE,
      mfaEnrolled: false,
    };

    await auth.setCustomUserClaims(user.uid, newClaims);
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
      companyId: TARGET_COMPANY_ID,
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
    console.log('🔍 Verifying claims...');
    const updatedUser = await auth.getUser(user.uid);
    console.log(`✅ Verified Claims: ${JSON.stringify(updatedUser.customClaims)}\n`);

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
