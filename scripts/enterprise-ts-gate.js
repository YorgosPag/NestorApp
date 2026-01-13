#!/usr/bin/env node

/**
 * =============================================================================
 * ENTERPRISE TYPESCRIPT ERROR GATE
 * =============================================================================
 *
 * Tracks TypeScript error count and prevents regressions.
 * Used as part of CI/CD pipeline to enforce error budget policy.
 *
 * Usage:
 *   node scripts/enterprise-ts-gate.js           # Check against baseline
 *   node scripts/enterprise-ts-gate.js --update  # Update baseline with current count
 *   node scripts/enterprise-ts-gate.js --report  # Show detailed report
 *
 * @module scripts/enterprise-ts-gate
 * @enterprise ADR-027 - TypeScript Error Budget Gate
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION - LOADED FROM CENTRAL CONFIG (SSoT)
// ============================================================================

const CONFIG_FILE = path.join(__dirname, '..', 'config', 'quality-gates', 'ts-error-budget.json');

/**
 * Load policy configuration from central config file
 * @enterprise ADR-027 - Externalized policy governance
 * FAIL CLOSED: If config is missing or invalid, the gate FAILS (no silent fallback)
 */
function loadPolicyConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('');
    console.error('❌ ENTERPRISE GATE FAILURE: Policy config not found');
    console.error('');
    console.error(`   Missing: ${CONFIG_FILE}`);
    console.error('');
    console.error('   This gate requires centralized policy configuration.');
    console.error('   Create the config file or restore from backup.');
    console.error('');
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('');
    console.error('❌ ENTERPRISE GATE FAILURE: Invalid policy config');
    console.error('');
    console.error(`   File: ${CONFIG_FILE}`);
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('   Fix the JSON syntax or restore from backup.');
    console.error('');
    process.exit(1);
  }
}

const POLICY_CONFIG = loadPolicyConfig();
const BASELINE_FILE = path.join(__dirname, '..', POLICY_CONFIG.baseline.file);
const ALLOWED_REGRESSION = POLICY_CONFIG.policy.allowedRegression;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Count TypeScript errors by running tsc --noEmit
 */
function countTsErrors() {
  try {
    // Run tsc and capture output
    execSync('npx tsc --noEmit 2>&1', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe',
    });
    // If no errors, tsc exits with 0
    return { count: 0, errors: [] };
  } catch (error) {
    // tsc exits with non-zero on errors
    const output = error.stdout || error.stderr || '';
    const lines = output.split('\n').filter(line => line.includes('error TS'));
    return {
      count: lines.length,
      errors: lines.slice(0, 20), // Keep first 20 for reporting
    };
  }
}

/**
 * Load baseline from file
 */
function loadBaseline() {
  try {
    if (fs.existsSync(BASELINE_FILE)) {
      const content = fs.readFileSync(BASELINE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('⚠️ Could not load baseline file:', error.message);
  }
  return null;
}

/**
 * Save baseline to file
 */
function saveBaseline(count, metadata = {}) {
  const baseline = {
    errorCount: count,
    updatedAt: new Date().toISOString(),
    updatedBy: process.env.USER || process.env.USERNAME || 'unknown',
    nodeVersion: process.version,
    ...metadata,
  };

  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
  return baseline;
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const isUpdate = args.includes('--update');
  const isReport = args.includes('--report');

  console.log('');
  console.log('='.repeat(70));
  console.log('🏢 ENTERPRISE TYPESCRIPT ERROR GATE');
  console.log('='.repeat(70));
  console.log('');

  // Count current errors
  console.log('📊 Counting TypeScript errors...');
  const { count: currentCount, errors } = countTsErrors();
  console.log(`   Current error count: ${currentCount}`);

  // Update mode - with governance checks
  if (isUpdate) {
    console.log('');
    console.log('📝 Baseline update requested...');

    // Enterprise governance: check if approval token is required
    const governance = POLICY_CONFIG.governance || {};
    const restrictions = governance.updateRestrictions || {};

    if (restrictions.requireToken) {
      const tokenEnvVar = POLICY_CONFIG.baseline.approvalTokenEnvVar || 'TS_BASELINE_APPROVAL_TOKEN';
      const approvalToken = process.env[tokenEnvVar];

      if (!approvalToken) {
        console.log('');
        console.log('❌ BASELINE UPDATE BLOCKED: Approval token required');
        console.log('');
        console.log('   This baseline update is governed by enterprise policy.');
        console.log(`   Set environment variable: ${tokenEnvVar}=<your-token>`);
        console.log('');
        console.log('   Governance options:');
        console.log('   1. Request approval token from team lead');
        console.log('   2. Use CI/CD pipeline with proper credentials');
        console.log('   3. Set requireToken: false in config (dev only)');
        console.log('');
        console.log(`   📍 Policy config: ${CONFIG_FILE}`);
        console.log('');
        process.exit(1);
      }

      console.log('   ✅ Approval token verified');
    }

    const baseline = saveBaseline(currentCount, {
      reason: 'Manual baseline update',
      approvedBy: process.env.USER || process.env.USERNAME || 'unknown',
      governance: restrictions.requireToken ? 'token-verified' : 'unrestricted'
    });
    console.log(`   ✅ Baseline updated to: ${baseline.errorCount} errors`);
    console.log(`   📍 Saved to: ${BASELINE_FILE}`);
    console.log('');
    return;
  }

  // Load baseline
  const baseline = loadBaseline();

  if (!baseline) {
    console.log('');
    console.log('⚠️ No baseline found. Creating initial baseline...');
    const newBaseline = saveBaseline(currentCount, {
      reason: 'Initial baseline creation',
    });
    console.log(`   ✅ Initial baseline set to: ${newBaseline.errorCount} errors`);
    console.log(`   📍 Saved to: ${BASELINE_FILE}`);
    console.log('');
    console.log('   Run this script again to validate against baseline.');
    console.log('');
    return;
  }

  // Compare with baseline
  console.log('');
  console.log('📋 Baseline Information:');
  console.log(`   Error count: ${baseline.errorCount}`);
  console.log(`   Updated: ${baseline.updatedAt}`);
  console.log(`   Updated by: ${baseline.updatedBy}`);
  console.log('');

  const delta = currentCount - baseline.errorCount;

  // Report mode - show detailed info
  if (isReport) {
    console.log('📊 Detailed Report:');
    console.log(`   Baseline errors: ${baseline.errorCount}`);
    console.log(`   Current errors:  ${currentCount}`);
    console.log(`   Delta:           ${delta >= 0 ? '+' : ''}${delta}`);
    console.log('');

    if (errors.length > 0) {
      console.log('📝 Sample Errors (first 20):');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.substring(0, 100)}...`);
      });
      console.log('');
    }
  }

  // Gate check
  console.log('-'.repeat(70));
  console.log('🔍 GATE CHECK RESULT:');
  console.log('-'.repeat(70));

  if (delta > ALLOWED_REGRESSION) {
    console.log('');
    console.log('❌ GATE FAILED: TypeScript errors increased!');
    console.log('');
    console.log(`   Baseline: ${baseline.errorCount} errors`);
    console.log(`   Current:  ${currentCount} errors`);
    console.log(`   Delta:    +${delta} (max allowed: ${ALLOWED_REGRESSION})`);
    console.log('');
    console.log('💡 To fix this:');
    console.log('   1. Fix the TypeScript errors you introduced');
    console.log('   2. Or update baseline with: node scripts/enterprise-ts-gate.js --update');
    console.log('      (only if the errors are intentional/approved)');
    console.log('');
    process.exit(1);
  } else if (delta < 0) {
    console.log('');
    console.log('✅ GATE PASSED: TypeScript errors DECREASED! 🎉');
    console.log('');
    console.log(`   Baseline: ${baseline.errorCount} errors`);
    console.log(`   Current:  ${currentCount} errors`);
    console.log(`   Delta:    ${delta} (you fixed ${Math.abs(delta)} errors!)`);
    console.log('');
    console.log('💡 Consider updating baseline to lock in your improvements:');
    console.log('   node scripts/enterprise-ts-gate.js --update');
    console.log('');
  } else {
    console.log('');
    console.log('✅ GATE PASSED: TypeScript error count stable');
    console.log('');
    console.log(`   Baseline: ${baseline.errorCount} errors`);
    console.log(`   Current:  ${currentCount} errors`);
    console.log(`   Delta:    0`);
    console.log('');
  }

  // Summary
  console.log('='.repeat(70));
  console.log(`📊 SUMMARY: ${currentCount} errors (baseline: ${baseline.errorCount})`);
  console.log('='.repeat(70));
  console.log('');
}

// Run main function
main();
