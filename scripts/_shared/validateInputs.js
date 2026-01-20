/**
 * =============================================================================
 * SHARED UTILITY: Validate Script Inputs
 * =============================================================================
 *
 * Enterprise-grade input validation for scripts.
 * Single source of truth for validation across all scripts.
 *
 * @module scripts/_shared/validateInputs
 * @enterprise Zero Duplicates - Shared Utilities
 */

// 🔒 ENTERPRISE: Firestore auto-generated document ID pattern
// Auto-IDs are exactly 20 alphanumeric characters (no dashes, no special chars)
const FIRESTORE_AUTO_ID_REGEX = /^[A-Za-z0-9]{20}$/;

/**
 * Validate and get COMPANY_ID from env/argv
 * Enforces Firestore auto-ID format by default (rejects slugs)
 *
 * 🔒 ENTERPRISE VALIDATION:
 * - Strict accept: Firestore auto-ID (^[A-Za-z0-9]{20}$)
 * - Reject: slugs, short strings, special characters
 * - Override: ALLOW_CUSTOM_COMPANY_ID=true for custom/legacy IDs
 *
 * @param {string} scriptName - Name of calling script (for error messages)
 * @returns {string} Valid company ID (Firestore docId)
 * @throws {Error} If COMPANY_ID is invalid or missing
 */
function getCompanyId(scriptName) {
  const companyId = process.env.COMPANY_ID || process.argv[2];
  const allowCustom = process.env.ALLOW_CUSTOM_COMPANY_ID === 'true';

  if (!companyId) {
    console.error(`❌ [${scriptName}] ERROR: COMPANY_ID is required`);
    console.error(`💡 [${scriptName}] Usage:`);
    console.error(`   COMPANY_ID=<COMPANY_DOC_ID> node scripts/${scriptName}`);
    console.error(`   OR: node scripts/${scriptName} <COMPANY_DOC_ID>`);
    console.error('');
    console.error('   Replace <COMPANY_DOC_ID> with your actual Firestore company document ID');
    process.exit(1);
  }

  // 🔒 ENTERPRISE: Strict validation for Firestore auto-ID
  const isAutoId = FIRESTORE_AUTO_ID_REGEX.test(companyId);

  if (!isAutoId && !allowCustom) {
    console.error(`❌ [${scriptName}] ERROR: COMPANY_ID does not match Firestore auto-ID format`);
    console.error(`📍 [${scriptName}] Received: "${companyId}"`);
    console.error(`💡 [${scriptName}] Expected: Firestore auto-ID (20 alphanumeric chars, e.g., "pzNUy8ksddGCtcQMqumR")`);
    console.error('');
    console.error('   Common mistakes:');
    console.error('   ❌ "my-company" - This is a slug, not a Firestore document ID');
    console.error('   ❌ "pagonis" - Too short, auto-IDs are exactly 20 characters');
    console.error('   ❌ "abc-123-xyz" - Contains dashes, auto-IDs are alphanumeric only');
    console.error('');
    console.error('   If you have a custom/legacy document ID, set override:');
    console.error(`   ALLOW_CUSTOM_COMPANY_ID=true COMPANY_ID="${companyId}" node scripts/${scriptName}`);
    process.exit(1);
  }

  // Log validation result
  if (isAutoId) {
    console.log(`✅ [${scriptName}] COMPANY_ID validated: Firestore auto-ID format`);
  } else {
    console.log(`⚠️  [${scriptName}] COMPANY_ID: Custom ID accepted (ALLOW_CUSTOM_COMPANY_ID=true)`);
  }

  return companyId;
}

/**
 * Get DRY_RUN setting from env
 * Default: true (dry-run mode)
 *
 * @returns {boolean} Whether to run in dry-run mode
 */
function getDryRun() {
  return process.env.DRY_RUN !== 'false';
}

/**
 * Get numeric env variable with default
 *
 * @param {string} name - Environment variable name
 * @param {number} defaultValue - Default value
 * @returns {number} Parsed value or default
 */
function getNumericEnv(name, defaultValue) {
  const value = process.env[name];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get USER_UID from env/argv (for claim scripts)
 *
 * @param {string} scriptName - Name of calling script
 * @returns {string} User UID
 */
function getUserUid(scriptName) {
  const userUid = process.env.USER_UID || process.argv[3];

  if (!userUid) {
    console.error(`❌ [${scriptName}] ERROR: USER_UID is required`);
    console.error(`💡 [${scriptName}] Usage:`);
    console.error(`   COMPANY_ID=<ID> USER_UID=<UID> node scripts/${scriptName}`);
    process.exit(1);
  }

  return userUid;
}

/**
 * Print script header
 *
 * @param {string} title - Script title
 * @param {Record<string, string>} config - Configuration to display
 */
function printHeader(title, config) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🔧 ${title}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  Object.entries(config).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });

  console.log('');
}

/**
 * Print script footer
 *
 * @param {boolean} success - Whether script succeeded
 * @param {Record<string, number>} stats - Statistics to display
 * @param {number} duration - Duration in ms
 */
function printFooter(success, stats, duration) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);

  Object.entries(stats).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });

  console.log('');
  console.log(success ? '✅ Script completed successfully' : '❌ Script completed with errors');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

module.exports = {
  getCompanyId,
  getDryRun,
  getNumericEnv,
  getUserUid,
  printHeader,
  printFooter
};
