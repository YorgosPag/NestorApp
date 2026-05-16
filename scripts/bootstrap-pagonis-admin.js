/**
 * =============================================================================
 * 🔐 BOOTSTRAP PAGONIS ADMIN - ONE-TIME SETUP SCRIPT
 * =============================================================================
 *
 * Ρυθμίζει τον πρώτο super_admin χρήστη με τα απαραίτητα custom claims.
 *
 * USAGE:
 * ```bash
 * node scripts/bootstrap-pagonis-admin.js
 * ```
 *
 * AFTER RUNNING:
 * 1. Logout από την εφαρμογή
 * 2. Login ξανά (για να πάρεις τα νέα claims)
 * 3. Το navigation θα δείχνει όλες τις εταιρείες
 *
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');

// =============================================================================
// CONFIGURATION - CHANGE THESE AS NEEDED
// =============================================================================

const CONFIG = {
  // 🔐 User to bootstrap (can be email or UID)
  userEmail: 'pagonis.oe@gmail.com',

  // 🏢 Global role (super_admin sees ALL companies via navigation_companies)
  globalRole: 'super_admin',

  // ℹ️ companyId will be fetched from first navigation_company
};

// =============================================================================
// MAIN SCRIPT
// =============================================================================

async function bootstrapAdmin() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔐 BOOTSTRAP PAGONIS ADMIN');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Step 1: Load environment and initialize Firebase
    console.log('📋 Step 1: Loading environment...');
    const envVars = loadEnvLocal();

    const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('   ✅ Firebase Admin initialized');
    console.log('');

    // Step 2: Find user by email
    console.log('📋 Step 2: Finding user by email...');
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(CONFIG.userEmail);
      console.log(`   ✅ User found: ${userRecord.email} (${userRecord.uid})`);
    } catch (error) {
      console.error(`   ❌ User not found: ${CONFIG.userEmail}`);
      console.error('   Please make sure you have registered this email in Firebase Auth.');
      process.exit(1);
    }
    console.log('');

    // Step 3: Find a companyId from navigation_companies
    console.log('📋 Step 3: Finding companyId from navigation_companies...');
    const db = admin.firestore();
    const navCompaniesSnapshot = await db.collection('navigation_companies').limit(1).get();

    let companyId;
    if (navCompaniesSnapshot.empty) {
      console.log('   ⚠️ No navigation_companies found.');
      console.log('   Using user UID as companyId (temporary)...');
      companyId = userRecord.uid;
    } else {
      const firstNavCompany = navCompaniesSnapshot.docs[0].data();
      companyId = firstNavCompany.contactId || navCompaniesSnapshot.docs[0].id;
      console.log(`   ✅ Found companyId: ${companyId}`);
    }
    console.log('');

    // Step 4: Check existing claims
    console.log('📋 Step 4: Checking existing claims...');
    const existingClaims = userRecord.customClaims || {};
    console.log('   📍 Existing claims:', JSON.stringify(existingClaims, null, 2));
    console.log('');

    // Step 5: Set custom claims
    console.log('📋 Step 5: Setting custom claims...');
    const newClaims = {
      ...existingClaims,
      companyId: companyId,
      globalRole: CONFIG.globalRole,
      mfaEnrolled: existingClaims.mfaEnrolled || false,
      claimsUpdatedAt: Date.now()
    };

    console.log('   📝 New claims:', JSON.stringify(newClaims, null, 2));
    await admin.auth().setCustomUserClaims(userRecord.uid, newClaims);
    // ADR-360: mirror claimsUpdatedAt to Firestore so connected clients
    // detect the change via onSnapshot and auto-refresh their ID token.
    await db.collection('users').doc(userRecord.uid).set({
      claimsUpdatedAt: newClaims.claimsUpdatedAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('   ✅ Claims set successfully (mirror written)!');
    console.log('');

    // Step 6: Update/Create Firestore user document
    console.log('📋 Step 6: Updating Firestore user document...');
    const userRef = db.collection('users').doc(userRecord.uid);
    await userRef.set({
      email: userRecord.email,
      displayName: userRecord.displayName || null,
      companyId: companyId,
      globalRole: CONFIG.globalRole,
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('   ✅ Firestore document updated');
    console.log('');

    // Step 7: Verify claims
    console.log('📋 Step 7: Verifying claims...');
    const updatedUser = await admin.auth().getUser(userRecord.uid);
    console.log('   📍 Verified claims:', JSON.stringify(updatedUser.customClaims, null, 2));
    console.log('');

    // Success!
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  ✅ BOOTSTRAP COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  📧 Email:', userRecord.email);
    console.log('  🔑 Role:', CONFIG.globalRole);
    console.log('  🏢 Company ID:', companyId);
    console.log('');
    console.log('  ⚠️ IMPORTANT: Logout και Login ξανά στην εφαρμογή');
    console.log('     για να πάρεις τα νέα claims!');
    console.log('');
    console.log('  Μετά το login, πήγαινε στο /navigation για να δεις');
    console.log('  όλες τις εταιρείες.');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ BOOTSTRAP FAILED:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// =============================================================================
// RUN
// =============================================================================

bootstrapAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
