/**
 * =============================================================================
 * 🔐 BATCH SET USER CLAIMS - ENTERPRISE OPS SCRIPT
 * =============================================================================
 *
 * Uses the /api/admin/set-user-claims endpoint for RBAC-safe, audited updates.
 * This avoids duplicating permission logic in scripts and keeps SSoT server-side.
 *
 * REQUIRED ENV:
 * - API_URL (e.g. http://localhost:3000)
 * - SET_USER_CLAIMS_PATH (e.g. /api/admin/set-user-claims)
 * - ADMIN_ID_TOKEN (Firebase ID token for an admin with users:users:manage)
 * - CLAIMS_INPUT_PATH (path to JSON file with user entries)
 *
 * INPUT FILE FORMAT (JSON array):
 * [
 *   { "uid": "...", "email": "...", "companyId": "...", "globalRole": "company_admin", "permissions": ["admin_access"] }
 * ]
 *
 * OUTPUT:
 * - JSONL report in migration-reports/ via reportWriter
 *
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');
const { createReportWriter } = require('./_shared/reportWriter');

function getRequiredEnv(key) {
  const value = process.env[key];
  if (!value || typeof value !== 'string' || value.trim() === '') {
    throw new Error(`[claims-batch] Missing required env: ${key}`);
  }
  return value.trim();
}

function readInputFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[claims-batch] Input file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('[claims-batch] Input must be a JSON array');
  }
  return data;
}

async function run() {
  loadEnvLocal();

  const apiUrl = getRequiredEnv('API_URL');
  const apiPath = getRequiredEnv('SET_USER_CLAIMS_PATH');
  const token = getRequiredEnv('ADMIN_ID_TOKEN');
  const inputPath = getRequiredEnv('CLAIMS_INPUT_PATH');

  const absoluteInputPath = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(process.cwd(), inputPath);

  const entries = readInputFile(absoluteInputPath);
  const report = createReportWriter('set-user-claims-batch');

  for (const entry of entries) {
    report.incrementScanned(1);

    const { uid, email, companyId, globalRole, permissions } = entry || {};
    if (!uid || !email || !companyId || !globalRole) {
      report.recordSkip({
        id: uid || email || 'unknown',
        reason: 'invalid_input',
        details: 'uid, email, companyId, globalRole are required',
      });
      continue;
    }

    try {
      const response = await fetch(`${apiUrl}${apiPath}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid,
          email,
          companyId,
          globalRole,
          permissions,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        report.recordError({
          id: uid,
          error: payload.error || `HTTP ${response.status}`,
        });
        continue;
      }

      report.recordUpdate({
        id: uid,
        before: null,
        after: {
          companyId,
          globalRole,
          permissions: payload.user?.permissions,
        },
      });
    } catch (error) {
      report.recordError({
        id: uid || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  await report.finalize();
}

run().catch((error) => {
  console.error('[claims-batch] Fatal error:', error);
  process.exit(1);
});
