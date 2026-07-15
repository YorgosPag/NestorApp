/**
 * =============================================================================
 * AUDIT MISSING AUTH CLAIMS — read-only pre-flight for the ADR-657 fail-closed
 * =============================================================================
 *
 * Lists every Firebase Auth user whose custom claims are MISSING `companyId`
 * and/or `globalRole`. These are exactly the users who, today, are silently
 * rescued by the fail-OPEN fallbacks in `src/lib/auth/auth-context.ts` and
 * `src/server/auth/require-project-for-page.ts`:
 *
 *   companyId  → falls back to process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID
 *   globalRole → falls back to 'company_admin'   ← privilege escalation
 *
 * ADR-657 §3.5 makes both fail-CLOSED (missing claim ⇒ 401). This script MUST
 * be run BEFORE that change ships:
 *
 *   • 0 rows  → safe to ship the fail-closed patch immediately.
 *   • N rows  → those users get 401 on their next request. Decide per row:
 *               backfill to a SAFE value (globalRole 'external_user', a real
 *               companyId) via scripts/claims.setCompanyId.js, or accept the
 *               lockout and re-provision. NEVER backfill globalRole to an admin
 *               tier — re-elevate real admins by hand.
 *
 * READ-ONLY. It never writes a claim. Bulk read of user metadata, so it is
 * gated behind CONFIRM_DIAGNOSTICS=true and masks all PII.
 *
 * @module scripts/audit-missing-auth-claims
 * @enterprise ADR-657 §3.5, ADR-063 (company isolation via custom claims)
 *
 * USAGE:
 * ```bash
 * CONFIRM_DIAGNOSTICS=true node scripts/audit-missing-auth-claims.js
 * ```
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');
const { maskEmail } = require('./_shared/mask-email');

const SCRIPT_NAME = 'audit-missing-auth-claims.js';

// --- Security: explicit opt-in (bulk read of sensitive user data) -----------

if (process.env.CONFIRM_DIAGNOSTICS !== 'true') {
  console.error('');
  console.error(`❌ [${SCRIPT_NAME}] SECURITY: CONFIRM_DIAGNOSTICS=true is required`);
  console.error('');
  console.error('   This script bulk-reads Firebase Auth user metadata.');
  console.error('');
  console.error('   Usage:');
  console.error(`   CONFIRM_DIAGNOSTICS=true node scripts/${SCRIPT_NAME}`);
  console.error('');
  process.exit(1);
}

// --- Initialize Firebase Admin ----------------------------------------------

let envVars;
try {
  envVars = loadEnvLocal();
} catch (error) {
  console.error(`❌ [${SCRIPT_NAME}] Failed to load environment:`, error.message);
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log(`✅ [${SCRIPT_NAME}] Firebase Admin initialized`);
} catch (error) {
  console.error(`❌ [${SCRIPT_NAME}] Failed to initialize Firebase Admin:`, error.message);
  process.exit(1);
}

// --- Audit ------------------------------------------------------------------

/**
 * @param {import('firebase-admin/auth').UserRecord} user
 * @returns {{ missingCompanyId: boolean, missingGlobalRole: boolean }}
 */
function claimGaps(user) {
  const claims = user.customClaims || {};
  const has = (k) => claims[k] !== undefined && claims[k] !== null && claims[k] !== '';
  return {
    missingCompanyId: !has('companyId'),
    missingGlobalRole: !has('globalRole'),
  };
}

async function auditMissingClaims() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔍 AUDIT MISSING AUTH CLAIMS (ADR-657 fail-closed pre-flight)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  let total = 0;
  let disabledCount = 0;
  const offenders = []; // { uidPrefix, email(masked), disabled, missing[] }

  try {
    let pageToken;
    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      for (const user of page.users) {
        total += 1;
        const { missingCompanyId, missingGlobalRole } = claimGaps(user);
        if (missingCompanyId || missingGlobalRole) {
          const missing = [];
          if (missingCompanyId) missing.push('companyId');
          if (missingGlobalRole) missing.push('globalRole');
          if (user.disabled) disabledCount += 1;
          offenders.push({
            uidPrefix: `${user.uid.substring(0, 8)}…`,
            email: maskEmail(user.email),
            disabled: user.disabled,
            missing,
          });
        }
      }
      pageToken = page.pageToken;
    } while (pageToken);
  } catch (error) {
    console.error('');
    console.error(`❌ [${SCRIPT_NAME}] ERROR while listing users:`, error.message);
    process.exit(1);
  }

  // A disabled user cannot authenticate at all — Firebase blocks it before
  // extractCustomClaims() runs — so a claim-less DISABLED user is already
  // locked out and the fail-closed patch changes nothing for them. Only
  // ENABLED users missing claims are a shipping blocker.
  const blocking = offenders.filter((o) => !o.disabled);

  console.log(`  Scanned users            : ${total}`);
  console.log(`  Users missing claim(s)   : ${offenders.length}`);
  console.log(`    ↳ disabled (safe)      : ${disabledCount}`);
  console.log(`    ↳ enabled (BLOCKING)   : ${blocking.length}`);
  console.log('');

  if (blocking.length === 0) {
    console.log('✅ SAFE TO SHIP — every user who can still log in has both claims.');
    console.log('   The ADR-657 fail-closed patch will not lock anyone out.');
    if (offenders.length > 0) {
      console.log(`   (${offenders.length} disabled account(s) lack claims but cannot authenticate.)`);
    }
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    process.exit(0);
  }

  console.log('⚠️  DO NOT SHIP the fail-closed patch yet — these ENABLED users would 401:');
  console.log('');
  console.log('┌────────────┬──────────────────────┬──────────┬──────────────────────');
  console.log('│ UID        │ Email (masked)       │ Disabled │ Missing');
  console.log('├────────────┼──────────────────────┼──────────┼──────────────────────');
  for (const o of blocking) {
    console.log(
      `│ ${o.uidPrefix.padEnd(10)} │ ${String(o.email).padEnd(20)} │ ` +
        `${(o.disabled ? '⚠️ yes' : 'no').padEnd(8)} │ ${o.missing.join(', ')}`,
    );
  }
  console.log('└────────────┴──────────────────────┴──────────┴──────────────────────');
  console.log('');
  console.log('   Next step per row: backfill to a SAFE value');
  console.log('   (globalRole → external_user, a real companyId) via');
  console.log('   scripts/claims.setCompanyId.js, OR accept lockout + re-provision.');
  console.log('   NEVER backfill globalRole to an admin tier.');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  // Non-zero exit so CI/automation treats "not clean" as a gate.
  process.exit(2);
}

auditMissingClaims();
