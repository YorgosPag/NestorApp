/**
 * =============================================================================
 * CANONICAL SCRIPT: Backfill Tasks companyId
 * =============================================================================
 *
 * Enterprise-grade migration script for backfilling missing companyId to tasks.
 * Derives companyId from createdBy user's company OR projectId lookup.
 *
 * @module scripts/migrations.tasks.backfillCompanyId
 * @enterprise Zero Duplicates - Canonical Path
 * @compliance Local_Protocol v1.1 - ZERO hardcoded values
 *
 * USAGE:
 * ```bash
 * # DRY RUN (default) - Scan and report only
 * COMPANY_ID=<ID> COLLECTION_TASKS=tasks COLLECTION_USERS=users COLLECTION_PROJECTS=projects node scripts/migrations.tasks.backfillCompanyId.js
 *
 * # EXECUTE - Backfill tasks with missing companyId
 * COMPANY_ID=<ID> COLLECTION_TASKS=tasks COLLECTION_USERS=users COLLECTION_PROJECTS=projects DRY_RUN=false node scripts/migrations.tasks.backfillCompanyId.js
 * ```
 *
 * COMPLIANCE:
 * - ✅ ZERO hardcoded defaults (PAGE_SIZE/BATCH_SIZE from centralized config)
 * - ✅ All collection names REQUIRED via env
 * - ✅ Streaming approach (process per page, not accumulate all)
 * - ✅ Structured audit report (JSONL output)
 * - ✅ Memory-safe for large datasets
 * - ✅ Multi-tenant safe (verifies ownership before update)
 * - ✅ Fail-closed when cannot derive companyId
 *
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');
const { getCompanyId, getDryRun, getNumericEnv, printHeader, printFooter } = require('./_shared/validateInputs');
const { DEFAULTS } = require('./_shared/migrationConfig');
const { createReportWriter } = require('./_shared/reportWriter');

// =============================================================================
// CONFIGURATION - ALL FROM ENV/CENTRALIZED CONFIG (ZERO HARDCODED)
// =============================================================================

const SCRIPT_NAME = 'migrations.tasks.backfillCompanyId.js';

const envVars = loadEnvLocal();
const COMPANY_ID = getCompanyId(SCRIPT_NAME);
const DRY_RUN = getDryRun();
const PAGE_SIZE = getNumericEnv('PAGE_SIZE', DEFAULTS.PAGE_SIZE);
const BATCH_SIZE = getNumericEnv('BATCH_SIZE', DEFAULTS.BATCH_SIZE);

// Collection names REQUIRED
const COLLECTION_TASKS = process.env.COLLECTION_TASKS;
if (!COLLECTION_TASKS) {
  console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_TASKS is required`);
  process.exit(1);
}

const COLLECTION_USERS = process.env.COLLECTION_USERS;
if (!COLLECTION_USERS) {
  console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_USERS is required`);
  process.exit(1);
}

const COLLECTION_PROJECTS = process.env.COLLECTION_PROJECTS;
if (!COLLECTION_PROJECTS) {
  console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_PROJECTS is required`);
  process.exit(1);
}

// =============================================================================
// INITIALIZE FIREBASE ADMIN
// =============================================================================

try {
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log(`[${SCRIPT_NAME}] Firebase Admin initialized`);
} catch (error) {
  console.error(`[${SCRIPT_NAME}] Failed to initialize Firebase Admin:`, error.message);
  process.exit(1);
}

const db = admin.firestore();

// =============================================================================
// STATISTICS & CACHES
// =============================================================================

const stats = {
  scanned: 0, hasCompanyId: 0, missingCompanyId: 0, matchesTarget: 0,
  differentCompany: 0, needsUpdate: 0, updated: 0, cannotDerive: 0,
  errors: 0, batches: 0, pages: 0, cacheHits: 0, cacheMisses: 0
};

const userCompanyIdCache = new Map();
const projectCompanyIdCache = new Map();

async function getUserCompanyId(userId) {
  if (userCompanyIdCache.has(userId)) { stats.cacheHits++; return userCompanyIdCache.get(userId); }
  stats.cacheMisses++;
  try {
    const doc = await db.collection(COLLECTION_USERS).doc(userId).get();
    const companyId = doc.exists ? (doc.data().companyId || null) : null;
    userCompanyIdCache.set(userId, companyId);
    return companyId;
  } catch (e) { userCompanyIdCache.set(userId, null); return null; }
}

async function getProjectCompanyId(projectId) {
  if (projectCompanyIdCache.has(projectId)) { stats.cacheHits++; return projectCompanyIdCache.get(projectId); }
  stats.cacheMisses++;
  try {
    const doc = await db.collection(COLLECTION_PROJECTS).doc(projectId).get();
    const companyId = doc.exists ? (doc.data().companyId || null) : null;
    projectCompanyIdCache.set(projectId, companyId);
    return companyId;
  } catch (e) { projectCompanyIdCache.set(projectId, null); return null; }
}

// =============================================================================
// MAIN MIGRATION FUNCTION
// =============================================================================

async function backfillTasksCompanyId() {
  const startTime = Date.now();
  const report = createReportWriter(COLLECTION_TASKS, { outputPath: process.env.REPORT_OUTPUT_PATH });

  printHeader('TASKS COMPANYID BACKFILL MIGRATION', {
    'Target Company': COMPANY_ID,
    'Mode': DRY_RUN ? 'DRY-RUN' : 'EXECUTE',
    'Tasks Collection': COLLECTION_TASKS,
    'Page/Batch Size': `${PAGE_SIZE}/${BATCH_SIZE}`,
    'Report File': report.getFilePath()
  });

  try {
    console.log('Scanning tasks collection (streaming mode)...\n');
    let lastDoc = null, hasMore = true;

    while (hasMore) {
      stats.pages++;
      let query = db.collection(COLLECTION_TASKS).limit(PAGE_SIZE);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snapshot = await query.get();
      if (snapshot.empty) { hasMore = false; break; }

      const pageDocsToUpdate = [];

      for (const doc of snapshot.docs) {
        stats.scanned++;
        report.incrementScanned();
        const data = doc.data();

        if (data.companyId) {
          stats.hasCompanyId++;
          if (data.companyId === COMPANY_ID) { stats.matchesTarget++; }
          else { stats.differentCompany++; }
          report.recordSkip({ id: doc.id, reason: data.companyId === COMPANY_ID ? 'already_has_target' : 'different_company' });
          continue;
        }

        stats.missingCompanyId++;

        // Try to derive companyId: 1) projectId lookup, 2) createdBy lookup
        let derivedCompanyId = null;
        let derivedFrom = null;

        if (data.projectId) {
          derivedCompanyId = await getProjectCompanyId(data.projectId);
          if (derivedCompanyId) derivedFrom = 'project';
        }

        if (!derivedCompanyId && data.createdBy) {
          derivedCompanyId = await getUserCompanyId(data.createdBy);
          if (derivedCompanyId) derivedFrom = 'user';
        }

        if (!derivedCompanyId) {
          stats.cannotDerive++;
          report.recordSkip({ id: doc.id, reason: 'cannot_derive_companyId', details: `projectId=${data.projectId || 'N/A'}, createdBy=${data.createdBy || 'N/A'}` });
          continue;
        }

        if (derivedCompanyId !== COMPANY_ID) {
          stats.differentCompany++;
          report.recordSkip({ id: doc.id, reason: 'derived_different_company', details: `derived=${derivedCompanyId} from ${derivedFrom}` });
          continue;
        }

        stats.needsUpdate++;
        pageDocsToUpdate.push({ id: doc.id, ref: doc.ref, derivedFrom });
      }

      // Process page updates
      if (pageDocsToUpdate.length > 0) {
        if (DRY_RUN) {
          pageDocsToUpdate.forEach(d => report.recordUpdate({ id: d.id, before: null, after: COMPANY_ID, metadata: { dryRun: true, derivedFrom: d.derivedFrom } }));
        } else {
          for (let i = 0; i < pageDocsToUpdate.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const batchDocs = pageDocsToUpdate.slice(i, i + BATCH_SIZE);
            stats.batches++;
            batchDocs.forEach(d => batch.update(d.ref, { companyId: COMPANY_ID, updatedAt: admin.firestore.FieldValue.serverTimestamp(), _migratedAt: admin.firestore.FieldValue.serverTimestamp() }));
            try {
              await batch.commit();
              stats.updated += batchDocs.length;
              batchDocs.forEach(d => report.recordUpdate({ id: d.id, before: null, after: COMPANY_ID, metadata: { derivedFrom: d.derivedFrom } }));
            } catch (e) {
              stats.errors += batchDocs.length;
              batchDocs.forEach(d => report.recordError({ id: d.id, error: e.message }));
            }
          }
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < PAGE_SIZE) hasMore = false;
    }

    const reportSummary = await report.finalize();
    const duration = Date.now() - startTime;

    printFooter(stats.errors === 0, {
      'Scanned': `${stats.scanned}`, 'Has companyId': `${stats.hasCompanyId}`,
      'Missing': `${stats.missingCompanyId}`, 'Needs update': `${stats.needsUpdate}`,
      'Cannot derive': `${stats.cannotDerive}`,
      ...(DRY_RUN ? {} : { 'Updated': `${stats.updated}`, 'Errors': `${stats.errors}` }),
      'Report': reportSummary.filePath
    }, duration);

    if (DRY_RUN) console.log(`\nTo execute: DRY_RUN=false node scripts/${SCRIPT_NAME}\n`);
    return stats.errors === 0;
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] Failed:`, error.message);
    throw error;
  }
}

backfillTasksCompanyId().then(s => process.exit(s ? 0 : 1)).catch(() => process.exit(1));
