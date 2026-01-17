/**
 * 🔐 LOCAL ADMIN SCRIPT - Set User Custom Claims
 *
 * Enterprise out-of-band claim provisioning script
 * Runs locally with Firebase Admin SDK to bootstrap user claims
 *
 * @usage node scripts/set-user-claims-local.js
 * @requires FIREBASE_SERVICE_ACCOUNT_KEY in .env.local
 */

// Firebase Admin SDK
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load .env.local manually (no dotenv dependency)
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  });

  return envVars;
}

const envVars = loadEnvLocal();

// ============================================================================
// CONFIGURATION
// ============================================================================

const USER_UID = 'ITjmw0syn7WiYuskqaGtzLPuN852';
const USER_EMAIL = 'pagonis.oe@gmail.com';

// 🔒 ENTERPRISE: COMPANY_ID must be Firestore document ID (not slug)
// Get from environment variable or command line argument
const COMPANY_ID = process.env.COMPANY_ID || process.argv[2];
const GLOBAL_ROLE = 'super_admin';

// ============================================================================
// VALIDATION
// ============================================================================

if (!COMPANY_ID) {
  console.error('❌ [SET_CLAIMS] ERROR: COMPANY_ID is required');
  console.error('💡 [SET_CLAIMS] Usage:');
  console.error('   COMPANY_ID=pzNUy8ksddGCtcQMqumR node scripts/set-user-claims-local.js');
  console.error('   OR: node scripts/set-user-claims-local.js pzNUy8ksddGCtcQMqumR');
  process.exit(1);
}

// 🔒 ENTERPRISE: Reject slug-like values (must be Firestore docId format)
if (COMPANY_ID.includes('-') && COMPANY_ID.length < 20) {
  console.error('❌ [SET_CLAIMS] ERROR: COMPANY_ID appears to be a slug, not a Firestore document ID');
  console.error(`📍 [SET_CLAIMS] Received: "${COMPANY_ID}"`);
  console.error('💡 [SET_CLAIMS] Expected: Firestore docId (e.g., "pzNUy8ksddGCtcQMqumR")');
  console.error('📋 [SET_CLAIMS] Slugs like "pagonis-company" are NOT valid for tenant isolation');
  process.exit(1);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('🔐 [SET_CLAIMS] Starting local claim provisioning...');
console.log('📍 [SET_CLAIMS] Target User:', USER_EMAIL);
console.log('📍 [SET_CLAIMS] UID:', USER_UID);
console.log('📍 [SET_CLAIMS] Company:', COMPANY_ID);
console.log('📍 [SET_CLAIMS] Role:', GLOBAL_ROLE);
console.log('');

// Check for service account key
if (!envVars.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('❌ [SET_CLAIMS] ERROR: FIREBASE_SERVICE_ACCOUNT_KEY not found in environment');
  console.error('💡 [SET_CLAIMS] Add your service account JSON to .env.local');
  console.error('');
  console.error('Example .env.local:');
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\'');
  process.exit(1);
}

// Parse service account
let serviceAccount;
try {
  serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.log('✅ [SET_CLAIMS] Service account loaded');
  console.log('📍 [SET_CLAIMS] Project ID:', serviceAccount.project_id);
  console.log('');
} catch (error) {
  console.error('❌ [SET_CLAIMS] ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY');
  console.error('💡 [SET_CLAIMS] Check JSON formatting in .env.local');
  console.error('📋 [SET_CLAIMS] Error:', error.message);
  process.exit(1);
}

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ [SET_CLAIMS] Firebase Admin SDK initialized');
  console.log('');
} catch (error) {
  console.error('❌ [SET_CLAIMS] ERROR: Failed to initialize Firebase Admin');
  console.error('📋 [SET_CLAIMS] Error:', error.message);
  process.exit(1);
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function setUserClaims() {
  try {
    // Step 1: Verify user exists
    console.log('🔍 [SET_CLAIMS] Step 1: Verifying user exists...');
    const userRecord = await admin.auth().getUser(USER_UID);
    console.log('✅ [SET_CLAIMS] User found:', userRecord.email);
    console.log('');

    // Step 2: Get existing claims
    console.log('🔍 [SET_CLAIMS] Step 2: Checking existing claims...');
    const existingClaims = userRecord.customClaims || {};
    console.log('📋 [SET_CLAIMS] Existing claims:', JSON.stringify(existingClaims, null, 2));
    console.log('');

    // Step 3: Set new claims
    console.log('🔧 [SET_CLAIMS] Step 3: Setting new custom claims...');
    const newClaims = {
      companyId: COMPANY_ID,
      globalRole: GLOBAL_ROLE,
      permissions: [], // Empty array - super_admin bypasses checks anyway
      mfaEnrolled: false
    };

    await admin.auth().setCustomUserClaims(USER_UID, newClaims);
    console.log('✅ [SET_CLAIMS] Custom claims set successfully!');
    console.log('📋 [SET_CLAIMS] New claims:', JSON.stringify(newClaims, null, 2));
    console.log('');

    // Step 4: Verify claims were set
    console.log('🔍 [SET_CLAIMS] Step 4: Verifying claims...');
    const updatedUser = await admin.auth().getUser(USER_UID);
    const verifiedClaims = updatedUser.customClaims || {};
    console.log('✅ [SET_CLAIMS] Verified claims:', JSON.stringify(verifiedClaims, null, 2));
    console.log('');

    // Step 5: Instructions for user
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ SUCCESS! Custom claims have been set.');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('');
    console.log('1. Go to: https://nestor-app.vercel.app/');
    console.log('2. Click LOGOUT (important!)');
    console.log('3. Click LOGIN again');
    console.log('4. Go to: https://nestor-app.vercel.app/debug/token-info');
    console.log('5. Verify you see:');
    console.log('   - Global Role: super_admin (GREEN)');
    console.log('   - Company ID: pagonis-company');
    console.log('');
    console.log('If claims still show MISSING, wait 1-2 minutes and try again.');
    console.log('Firebase tokens can take a moment to refresh globally.');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('❌ FAILED TO SET CLAIMS');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    console.error('📋 Error:', error.message);
    if (error.code) {
      console.error('📋 Error Code:', error.code);
    }
    console.error('');
    console.error('💡 Common issues:');
    console.error('- Wrong Firebase project in service account');
    console.error('- Invalid UID');
    console.error('- Missing permissions in service account');
    console.error('');
    process.exit(1);
  }
}

// ============================================================================
// RUN
// ============================================================================

setUserClaims()
  .then(() => {
    console.log('🎉 [SET_CLAIMS] Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ [SET_CLAIMS] Script failed:', error);
    process.exit(1);
  });
