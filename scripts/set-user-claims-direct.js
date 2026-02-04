/**
 * =============================================================================
 * 🔐 SET USER CLAIMS (DIRECT) - ENTERPRISE OPS SCRIPT
 * =============================================================================
 *
 * Uses Firebase Admin SDK directly for one-off claims remediation.
 * Inputs are provided via environment variables (no hardcoded values).
 *
 * REQUIRED ENV:
 * - TARGET_UID
 * - TARGET_EMAIL
 * - TARGET_COMPANY_ID
 * - TARGET_GLOBAL_ROLE
 *
 * OPTIONAL ENV:
 * - TARGET_PERMISSIONS (comma-separated PermissionId list)
 *
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');

function getRequiredEnv(key) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return value.trim();
}

function parsePermissions(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

async function run() {
  loadEnvLocal();

  const uid = getRequiredEnv('TARGET_UID');
  const email = getRequiredEnv('TARGET_EMAIL');
  const companyId = getRequiredEnv('TARGET_COMPANY_ID');
  const globalRole = getRequiredEnv('TARGET_GLOBAL_ROLE');

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountRaw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found in environment');
  }

  const serviceAccount = JSON.parse(serviceAccountRaw);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const auth = admin.auth();
  const db = admin.firestore();

  const userRecord = await auth.getUser(uid);
  if (userRecord.email && userRecord.email !== email) {
    console.warn(`[SET_USER_CLAIMS] Email mismatch: provided=${email}, actual=${userRecord.email}`);
  }

  const existingClaims = userRecord.customClaims || {};
  const explicitPermissions = parsePermissions(process.env.TARGET_PERMISSIONS);
  const permissionsSet = new Set(
    Array.isArray(existingClaims.permissions) ? existingClaims.permissions : []
  );

  for (const perm of explicitPermissions) {
    permissionsSet.add(perm);
  }

  if (globalRole === 'super_admin' || globalRole === 'company_admin') {
    permissionsSet.add('admin_access');
  }

  const permissions = Array.from(permissionsSet);

  const newClaims = {
    ...existingClaims,
    companyId,
    globalRole,
    mfaEnrolled: existingClaims.mfaEnrolled === true,
    permissions,
  };

  await auth.setCustomUserClaims(uid, newClaims);

  await db.collection('users').doc(uid).set(
    {
      email: userRecord.email || email,
      displayName: userRecord.displayName || null,
      companyId,
      globalRole,
      permissions,
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log('[SET_USER_CLAIMS] Claims updated successfully');
  console.log(JSON.stringify({ uid, email: userRecord.email || email, companyId, globalRole, permissions }, null, 2));
}

run().catch((error) => {
  console.error('[SET_USER_CLAIMS] Failed:', error.message || error);
  process.exit(1);
});
