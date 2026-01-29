/**
 * =============================================================================
 * CANONICAL SCRIPT: Backfill Leads companyId
 * =============================================================================
 *
 * Enterprise-grade migration script for backfilling missing companyId to leads.
 * Derives companyId from createdBy user's company.
 *
 * @module scripts/migrations.leads.backfillCompanyId
 * @enterprise Zero Duplicates - Canonical Path
 * @compliance Local_Protocol v1.1 - ZERO hardcoded values
 *
 * USAGE:
 * ```bash
 * # DRY RUN (default)
 * COMPANY_ID=<ID> COLLECTION_LEADS=leads COLLECTION_USERS=users node scripts/migrations.leads.backfillCompanyId.js
 *
 * # EXECUTE
 * COMPANY_ID=<ID> COLLECTION_LEADS=leads COLLECTION_USERS=users DRY_RUN=false node scripts/migrations.leads.backfillCompanyId.js
 * ```
 *
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');
const { getCompanyId, getDryRun, getNumericEnv, printHeader, printFooter } = require('./_shared/validateInputs');
const { DEFAULTS } = require('./_shared/migrationConfig');
const { createReportWriter } = require('./_shared/reportWriter');

const SCRIPT_NAME = 'migrations.leads.backfillCompanyId.js';

const envVars = loadEnvLocal();
const COMPANY_ID = getCompanyId(SCRIPT_NAME);
const DRY_RUN = getDryRun();
const PAGE_SIZE = getNumericEnv('PAGE_SIZE', DEFAULTS.PAGE_SIZE);
const BATCH_SIZE = getNumericEnv('BATCH_SIZE', DEFAULTS.BATCH_SIZE);

const COLLECTION_LEADS = process.env.COLLECTION_LEADS;
if (!COLLECTION_LEADS) { console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_LEADS is required`); process.exit(1); }

const COLLECTION_USERS = process.env.COLLECTION_USERS;
if (!COLLECTION_USERS) { console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_USERS is required`); process.exit(1); }

try {
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (error) { console.error(`[${SCRIPT_NAME}] Firebase init failed:`, error.message); process.exit(1); }

const db = admin.firestore();

const stats = {
  scanned: 0, hasCompanyId: 0, missingCompanyId: 0, matchesTarget: 0,
  differentCompany: 0, needsUpdate: 0, updated: 0, cannotDerive: 0,
  errors: 0, batches: 0, pages: 0, cacheHits: 0, cacheMisses: 0
};

const userCompanyIdCache = new Map();

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

async function backfillLeadsCompanyId() {
  const startTime = Date.now();
  const report = createReportWriter(COLLECTION_LEADS, { outputPath: process.env.REPORT_OUTPUT_PATH });

  printHeader('LEADS COMPANYID BACKFILL MIGRATION', {
    'Target Company': COMPANY_ID,
    'Mode': DRY_RUN ? 'DRY-RUN' : 'EXECUTE',
    'Collection': COLLECTION_LEADS,
    'Page/Batch': `${PAGE_SIZE}/${BATCH_SIZE}`,
    'Report': report.getFilePath()
  });

  try {
    let lastDoc = null, hasMore = true;

    while (hasMore) {
      stats.pages++;
      let query = db.collection(COLLECTION_LEADS).limit(PAGE_SIZE);
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
          if (data.companyId === COMPANY_ID) stats.matchesTarget++;
          else stats.differentCompany++;
          report.recordSkip({ id: doc.id, reason: data.companyId === COMPANY_ID ? 'already_has_target' : 'different_company' });
          continue;
        }

        stats.missingCompanyId++;

        if (!data.createdBy) {
          stats.cannotDerive++;
          report.recordSkip({ id: doc.id, reason: 'no_createdBy' });
          continue;
        }

        const derivedCompanyId = await getUserCompanyId(data.createdBy);

        if (!derivedCompanyId) {
          stats.cannotDerive++;
          report.recordSkip({ id: doc.id, reason: 'user_no_company', details: `createdBy=${data.createdBy}` });
          continue;
        }

        if (derivedCompanyId !== COMPANY_ID) {
          stats.differentCompany++;
          report.recordSkip({ id: doc.id, reason: 'user_different_company', details: `derived=${derivedCompanyId}` });
          continue;
        }

        stats.needsUpdate++;
        pageDocsToUpdate.push({ id: doc.id, ref: doc.ref });
      }

      if (pageDocsToUpdate.length > 0) {
        if (DRY_RUN) {
          pageDocsToUpdate.forEach(d => report.recordUpdate({ id: d.id, before: null, after: COMPANY_ID, metadata: { dryRun: true } }));
        } else {
          for (let i = 0; i < pageDocsToUpdate.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const batchDocs = pageDocsToUpdate.slice(i, i + BATCH_SIZE);
            stats.batches++;
            batchDocs.forEach(d => batch.update(d.ref, { companyId: COMPANY_ID, updatedAt: admin.firestore.FieldValue.serverTimestamp(), _migratedAt: admin.firestore.FieldValue.serverTimestamp() }));
            try {
              await batch.commit();
              stats.updated += batchDocs.length;
              batchDocs.forEach(d => report.recordUpdate({ id: d.id, before: null, after: COMPANY_ID }));
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
      'Scanned': `${stats.scanned}`, 'Missing': `${stats.missingCompanyId}`,
      'Needs update': `${stats.needsUpdate}`, 'Cannot derive': `${stats.cannotDerive}`,
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

backfillLeadsCompanyId().then(s => process.exit(s ? 0 : 1)).catch(() => process.exit(1));
