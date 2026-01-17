/**
 * =============================================================================
 * 🔐 CANONICAL SCRIPT: Set User Company Claims
 * =============================================================================
 *
 * Enterprise-grade script for setting Firebase custom claims.
 * SINGLE source of truth for claim updates.
 *
 * @module scripts/claims.setCompanyId
 * @enterprise Zero Duplicates - Canonical Path
 *
 * USAGE:
 * ```bash
 * # Set claims for a user
 * COMPANY_ID=<COMPANY_DOC_ID> USER_UID=<USER_UID> node scripts/claims.setCompanyId.js
 *
 * # Or with command line args
 * node scripts/claims.setCompanyId.js <COMPANY_DOC_ID> <USER_UID>
 * ```
 *
 * FEATURES:
 * - companyId MUST be Firestore docId (rejects slugs)
 * - Sets companyId + globalRole claims
 * - Optional: companySlug for human-readable reference
 *
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');
const { getCompanyId, getUserUid, printHeader, printFooter } = require('./_shared/validateInputs');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCRIPT_NAME = 'claims.setCompanyId.js';
const GLOBAL_ROLE = process.env.GLOBAL_ROLE || 'company_admin';

// Get and validate inputs
const envVars = loadEnvLocal();
const COMPANY_ID = getCompanyId(SCRIPT_NAME);
const USER_UID = process.env.USER_UID || process.argv[3];

if (!USER_UID) {
  console.error(`❌ [${SCRIPT_NAME}] ERROR: USER_UID is required`);
  console.error(`💡 [${SCRIPT_NAME}] Usage:`);
  console.error(`   COMPANY_ID=<ID> USER_UID=<UID> node scripts/${SCRIPT_NAME}`);
  console.error(`   OR: node scripts/${SCRIPT_NAME} <COMPANY_ID> <USER_UID>`);
  process.exit(1);
}

// =============================================================================
// INITIALIZE FIREBASE ADMIN
// =============================================================================

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

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function setUserClaims() {
  const startTime = Date.now();

  printHeader('SET USER COMPANY CLAIMS', {
    '🎯 Company ID': COMPANY_ID,
    '👤 User UID': USER_UID,
    '🔑 Global Role': GLOBAL_ROLE
  });

  try {
    // Step 1: Verify user exists
    console.log('📋 Step 1: Verifying user exists...');
    const userRecord = await admin.auth().getUser(USER_UID);
    console.log(`   ✅ User found: ${userRecord.email}`);
    console.log(`   📍 Current claims:`, userRecord.customClaims || '(none)');

    // Step 2: Prepare new claims
    console.log('');
    console.log('📋 Step 2: Preparing new claims...');
    const newClaims = {
      companyId: COMPANY_ID,      // Firestore docId (REQUIRED)
      globalRole: GLOBAL_ROLE,    // User role
      claimsUpdatedAt: Date.now() // For tracking
    };
    console.log('   📝 New claims:', newClaims);

    // Step 3: Set custom claims
    console.log('');
    console.log('📋 Step 3: Setting custom claims...');
    await admin.auth().setCustomUserClaims(USER_UID, newClaims);
    console.log('   ✅ Claims set successfully!');

    // Step 4: Verify claims were set
    console.log('');
    console.log('📋 Step 4: Verifying claims...');
    const updatedUser = await admin.auth().getUser(USER_UID);
    console.log('   📍 Updated claims:', updatedUser.customClaims);

    // Validate claim was set correctly
    if (updatedUser.customClaims?.companyId !== COMPANY_ID) {
      throw new Error('Claim verification failed - companyId mismatch');
    }

    console.log('   ✅ Claims verified!');

    // Print footer
    const duration = Date.now() - startTime;
    printFooter(true, {
      '👤 User': userRecord.email,
      '🏢 Company ID': COMPANY_ID,
      '🔑 Role': GLOBAL_ROLE
    }, duration);

    console.log('');
    console.log('⚠️  IMPORTANT: User must refresh their token to get new claims.');
    console.log('   In the app, call: const { refreshToken } = useAuth(); await refreshToken();');
    console.log('   Or ask user to logout/login.');
    console.log('');

  } catch (error) {
    console.error('');
    console.error(`❌ [${SCRIPT_NAME}] FAILED:`, error.message);
    process.exit(1);
  }
}

// =============================================================================
// RUN
// =============================================================================

setUserClaims()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`❌ [${SCRIPT_NAME}] Unhandled error:`, error);
    process.exit(1);
  });
