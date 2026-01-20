/**
 * =============================================================================
 * CHECK USER CLAIMS - SECURE DIAGNOSTIC SCRIPT
 * =============================================================================
 *
 * Enterprise-grade script for checking Firebase custom claims.
 * SECURITY: Requires explicit confirmation, masks PII, hides claim values.
 *
 * @module scripts/check-user-claims
 * @enterprise ADR-029 - Security First (No Debug Endpoints)
 *
 * USAGE:
 * ```bash
 * # Check claims for a specific user (UID)
 * CONFIRM_DIAGNOSTICS=true USER_UID=<UID> node scripts/check-user-claims.js
 *
 * # Check claims for a specific user (email)
 * CONFIRM_DIAGNOSTICS=true USER_EMAIL=<EMAIL> node scripts/check-user-claims.js
 * ```
 *
 * SECURITY FEATURES:
 * - CONFIRM_DIAGNOSTICS=true required (explicit opt-in)
 * - PII masking: Email addresses are masked in output
 * - Claim values hidden: Only shows "SET" status, not actual values
 * - No bulk operations: One user at a time
 *
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCRIPT_NAME = 'check-user-claims.js';

// =============================================================================
// SECURITY: EXPLICIT CONFIRMATION REQUIRED
// =============================================================================

const CONFIRM_DIAGNOSTICS = process.env.CONFIRM_DIAGNOSTICS === 'true';

if (!CONFIRM_DIAGNOSTICS) {
  console.error('');
  console.error(`❌ [${SCRIPT_NAME}] SECURITY: CONFIRM_DIAGNOSTICS=true is required`);
  console.error('');
  console.error('   This script accesses sensitive user data.');
  console.error('   You must explicitly confirm you want to run diagnostics.');
  console.error('');
  console.error('   Usage:');
  console.error(`   CONFIRM_DIAGNOSTICS=true USER_UID=<UID> node scripts/${SCRIPT_NAME}`);
  console.error(`   CONFIRM_DIAGNOSTICS=true USER_EMAIL=<EMAIL> node scripts/${SCRIPT_NAME}`);
  console.error('');
  process.exit(1);
}

// =============================================================================
// PII MASKING: SECURE EMAIL DISPLAY
// =============================================================================

/**
 * Masks email for secure logging
 * Example: "user@example.com" → "u***@e***.com"
 *
 * @param {string|null|undefined} email - Email to mask
 * @returns {string} Masked email or placeholder
 */
function maskEmail(email) {
  // Guard: null, undefined, or non-string
  if (!email || typeof email !== 'string') {
    return '(none)';
  }

  // Guard: no @ symbol
  const atIndex = email.indexOf('@');
  if (atIndex < 1) {
    return '***';
  }

  const local = email.substring(0, atIndex);
  const domain = email.substring(atIndex + 1);

  // Guard: no domain
  if (!domain || domain.length < 1) {
    return `${local[0]}***@***`;
  }

  // Guard: no TLD
  const dotIndex = domain.lastIndexOf('.');
  if (dotIndex < 1) {
    return `${local[0]}***@***`;
  }

  const domainName = domain.substring(0, dotIndex);
  const tld = domain.substring(dotIndex + 1);

  // Guard: invalid domain parts
  if (!domainName || !tld) {
    return `${local[0]}***@***`;
  }

  return `${local[0]}***@${domainName[0]}***.${tld}`;
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

const USER_UID = process.env.USER_UID;
const USER_EMAIL = process.env.USER_EMAIL;

if (!USER_UID && !USER_EMAIL) {
  console.error('');
  console.error(`❌ [${SCRIPT_NAME}] ERROR: USER_UID or USER_EMAIL is required`);
  console.error('');
  console.error('   Usage:');
  console.error(`   CONFIRM_DIAGNOSTICS=true USER_UID=<UID> node scripts/${SCRIPT_NAME}`);
  console.error(`   CONFIRM_DIAGNOSTICS=true USER_EMAIL=<EMAIL> node scripts/${SCRIPT_NAME}`);
  console.error('');
  process.exit(1);
}

// =============================================================================
// INITIALIZE FIREBASE ADMIN
// =============================================================================

let envVars;
try {
  envVars = loadEnvLocal();
} catch (error) {
  console.error(`❌ [${SCRIPT_NAME}] Failed to load environment:`, error.message);
  process.exit(1);
}

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
// MAIN: CHECK USER CLAIMS
// =============================================================================

async function checkUserClaims() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  🔍 CHECK USER CLAIMS - ${SCRIPT_NAME}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    let user;

    // Get user by UID or email
    if (USER_UID) {
      console.log(`📋 Looking up user by UID: ${USER_UID.substring(0, 8)}...`);
      user = await admin.auth().getUser(USER_UID);
    } else {
      console.log(`📋 Looking up user by email: ${maskEmail(USER_EMAIL)}`);
      user = await admin.auth().getUserByEmail(USER_EMAIL);
    }

    // Display user info (PII masked)
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────');
    console.log('│ USER INFO (PII MASKED)');
    console.log('├─────────────────────────────────────────────────────────────');
    console.log(`│ UID:           ${user.uid}`);
    console.log(`│ Email:         ${maskEmail(user.email)}`);
    console.log(`│ Display Name:  ${user.displayName || '(not set)'}`);
    console.log(`│ Email Verified: ${user.emailVerified ? '✅ Yes' : '❌ No'}`);
    console.log(`│ Disabled:      ${user.disabled ? '⚠️ Yes' : '✅ No'}`);
    console.log('└─────────────────────────────────────────────────────────────');

    // Display custom claims (VALUES HIDDEN for security)
    const claims = user.customClaims || {};
    const claimKeys = Object.keys(claims);

    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────');
    console.log('│ CUSTOM CLAIMS (VALUES HIDDEN)');
    console.log('├─────────────────────────────────────────────────────────────');

    if (claimKeys.length === 0) {
      console.log('│ ⚠️  No custom claims set');
    } else {
      // Critical claims check
      const criticalClaims = ['companyId', 'globalRole'];

      for (const key of criticalClaims) {
        if (claims[key] !== undefined && claims[key] !== null) {
          console.log(`│ ${key}: ✅ SET`);
        } else {
          console.log(`│ ${key}: ❌ NOT SET`);
        }
      }

      // Other claims
      const otherClaims = claimKeys.filter(k => !criticalClaims.includes(k));
      if (otherClaims.length > 0) {
        console.log('│');
        console.log('│ Other claims:');
        for (const key of otherClaims) {
          console.log(`│   ${key}: ✅ SET`);
        }
      }
    }

    console.log('└─────────────────────────────────────────────────────────────');

    // Summary
    console.log('');
    const hasCompanyId = claims.companyId !== undefined && claims.companyId !== null;
    const hasGlobalRole = claims.globalRole !== undefined && claims.globalRole !== null;

    if (hasCompanyId && hasGlobalRole) {
      console.log('✅ STATUS: User has required claims for multi-tenant access');
    } else {
      console.log('⚠️  STATUS: User is missing required claims');
      if (!hasCompanyId) console.log('   - Missing: companyId');
      if (!hasGlobalRole) console.log('   - Missing: globalRole');
      console.log('');
      console.log('💡 To set claims, use:');
      console.log(`   COMPANY_ID=<ID> USER_UID=${user.uid} node scripts/claims.setCompanyId.js`);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ CHECK COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error(`❌ [${SCRIPT_NAME}] ERROR:`, error.message);
    console.error('');

    if (error.code === 'auth/user-not-found') {
      console.error('   User not found. Check the UID or email and try again.');
    }

    process.exit(1);
  }
}

// Run
checkUserClaims();
