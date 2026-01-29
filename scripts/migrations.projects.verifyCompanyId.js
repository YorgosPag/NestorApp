/**
 * =============================================================================
 * CANONICAL SCRIPT: Verify & Backfill Projects companyId
 * =============================================================================
 *
 * Enterprise-grade migration script for projects companyId verification/backfill.
 * Projects are the PRIMARY tenant-scoped entity - all other entities derive from them.
 *
 * @module scripts/migrations.projects.verifyCompanyId
 * @enterprise Zero Duplicates - Canonical Path
 * @compliance Local_Protocol v1.1 - ZERO hardcoded values
 *
 * USAGE:
 * ```bash
 * # DRY RUN (default) - Scan and report only
 * COMPANY_ID=<COMPANY_DOC_ID> COLLECTION_PROJECTS=projects COLLECTION_USERS=users node scripts/migrations.projects.verifyCompanyId.js
 *
 * # EXECUTE - Fix projects with missing companyId
 * COMPANY_ID=<COMPANY_DOC_ID> COLLECTION_PROJECTS=projects COLLECTION_USERS=users DRY_RUN=false node scripts/migrations.projects.verifyCompanyId.js
 * ```
 *
 * COMPLIANCE:
 * - ✅ ZERO hardcoded defaults (PAGE_SIZE/BATCH_SIZE from centralized config)
 * - ✅ All collection names REQUIRED via env
 * - ✅ Streaming approach (process per page, not accumulate all)
 * - ✅ Structured audit report (JSONL output)
 * - ✅ Memory-safe for large datasets
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

const SCRIPT_NAME = 'migrations.projects.verifyCompanyId.js';

// Get and validate inputs
const envVars = loadEnvLocal();
const COMPANY_ID = getCompanyId(SCRIPT_NAME);
const DRY_RUN = getDryRun();

// Use centralized defaults - NOT hardcoded in this script
const PAGE_SIZE = getNumericEnv('PAGE_SIZE', DEFAULTS.PAGE_SIZE);
const BATCH_SIZE = getNumericEnv('BATCH_SIZE', DEFAULTS.BATCH_SIZE);

// Collection names REQUIRED (no hardcoded defaults per Local_Protocol)
const COLLECTION_PROJECTS = process.env.COLLECTION_PROJECTS;
if (!COLLECTION_PROJECTS) {
  console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_PROJECTS is required`);
  console.error(`Usage: COLLECTION_PROJECTS=projects COLLECTION_USERS=users COMPANY_ID=<ID> node scripts/${SCRIPT_NAME}`);
  process.exit(1);
}

const COLLECTION_USERS = process.env.COLLECTION_USERS;
if (!COLLECTION_USERS) {
  console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_USERS is required`);
  console.error(`Usage: COLLECTION_PROJECTS=projects COLLECTION_USERS=users COMPANY_ID=<ID> node scripts/${SCRIPT_NAME}`);
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

  console.log(`[${SCRIPT_NAME}] Firebase Admin initialized`);
} catch (error) {
  console.error(`[${SCRIPT_NAME}] Failed to initialize Firebase Admin:`, error.message);
  process.exit(1);
}

const db = admin.firestore();

// =============================================================================
// STATISTICS
// =============================================================================

const stats = {
  scanned: 0,
  hasCompanyId: 0,
  missingCompanyId: 0,
  matchesTarget: 0,
  differentCompany: 0,
  updated: 0,
  noCreatedBy: 0,
  userNotFound: 0,
  errors: 0,
  batches: 0,
  pages: 0,
  cacheHits: 0,
  cacheMisses: 0
};

// User companyId cache (avoids N+1 queries)
const userCompanyIdCache = new Map();

// =============================================================================
// HELPER: Get user companyId with caching
// =============================================================================

async function getUserCompanyId(userId) {
  if (userCompanyIdCache.has(userId)) {
    stats.cacheHits++;
    return userCompanyIdCache.get(userId);
  }

  stats.cacheMisses++;
  try {
    const userDoc = await db.collection(COLLECTION_USERS).doc(userId).get();
    const companyId = userDoc.exists ? (userDoc.data().companyId || null) : null;
    userCompanyIdCache.set(userId, companyId);
    return companyId;
  } catch (error) {
    console.error(`      Failed to fetch user ${userId}:`, error.message);
    userCompanyIdCache.set(userId, null);
    return null;
  }
}

// =============================================================================
// MAIN VERIFICATION FUNCTION - STREAMING APPROACH
// =============================================================================

async function verifyProjectsCompanyId() {
  const startTime = Date.now();

  // Initialize report writer
  const report = createReportWriter(COLLECTION_PROJECTS, {
    outputPath: process.env.REPORT_OUTPUT_PATH
  });

  printHeader('PROJECTS COMPANYID VERIFICATION', {
    'Target Company': COMPANY_ID,
    'Mode': DRY_RUN ? 'DRY-RUN (scan only)' : 'EXECUTE (will fix missing)',
    'Collection': COLLECTION_PROJECTS,
    'Users Collection': COLLECTION_USERS,
    'Page Size': `${PAGE_SIZE} documents`,
    'Batch Size': `${BATCH_SIZE} documents`,
    'Report File': report.getFilePath()
  });

  try {
    console.log('Step 1: Scanning projects collection (streaming mode)...');
    console.log('');

    let lastDoc = null;
    let hasMore = true;

    // STREAMING: Process per page, not accumulate all
    while (hasMore) {
      stats.pages++;
      console.log(`   Page ${stats.pages}: Fetching ${PAGE_SIZE} documents...`);

      let query = db.collection(COLLECTION_PROJECTS).limit(PAGE_SIZE);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      // Collect docs to update for THIS PAGE only (memory-safe)
      const pageDocsToUpdate = [];

      for (const doc of snapshot.docs) {
        stats.scanned++;
        report.incrementScanned();
        const data = doc.data();

        if (data.companyId) {
          stats.hasCompanyId++;
          if (data.companyId === COMPANY_ID) {
            stats.matchesTarget++;
            report.recordSkip({
              id: doc.id,
              reason: 'already_has_target_companyId',
              details: `companyId=${data.companyId}`
            });
          } else {
            stats.differentCompany++;
            report.recordSkip({
              id: doc.id,
              reason: 'different_company',
              details: `companyId=${data.companyId} (target=${COMPANY_ID})`
            });
          }
        } else {
          stats.missingCompanyId++;

          // Try to derive companyId from createdBy
          if (data.createdBy) {
            const userCompanyId = await getUserCompanyId(data.createdBy);

            if (userCompanyId === COMPANY_ID) {
              pageDocsToUpdate.push({
                id: doc.id,
                ref: doc.ref,
                name: data.name || data.title || 'Unnamed',
                createdBy: data.createdBy,
                derivedCompanyId: userCompanyId
              });
            } else if (userCompanyId) {
              console.log(`      Project "${data.name || doc.id}" belongs to different company (${userCompanyId})`);
              stats.differentCompany++;
              report.recordSkip({
                id: doc.id,
                reason: 'user_different_company',
                details: `user=${data.createdBy} has companyId=${userCompanyId}`
              });
            } else {
              stats.userNotFound++;
              console.log(`      Project "${data.name || doc.id}" - user ${data.createdBy} not found or has no companyId`);
              report.recordSkip({
                id: doc.id,
                reason: 'user_not_found_or_no_company',
                details: `createdBy=${data.createdBy}`
              });
            }
          } else {
            stats.noCreatedBy++;
            console.log(`      Project "${data.name || doc.id}" has no createdBy field`);
            report.recordSkip({
              id: doc.id,
              reason: 'no_createdBy_field'
            });
          }
        }
      }

      // STREAMING: Process this page's updates immediately (not accumulate)
      if (pageDocsToUpdate.length > 0) {
        console.log(`      Page ${stats.pages}: ${pageDocsToUpdate.length} documents need update`);

        if (DRY_RUN) {
          // DRY-RUN: Record what would be updated
          pageDocsToUpdate.forEach(doc => {
            report.recordUpdate({
              id: doc.id,
              before: null,
              after: COMPANY_ID,
              metadata: { name: doc.name, createdBy: doc.createdBy, dryRun: true }
            });
          });
        } else {
          // EXECUTE: Batch write this page's documents
          for (let i = 0; i < pageDocsToUpdate.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const batchDocs = pageDocsToUpdate.slice(i, i + BATCH_SIZE);
            stats.batches++;

            batchDocs.forEach(doc => {
              batch.update(doc.ref, {
                companyId: COMPANY_ID,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                _migratedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            });

            try {
              await batch.commit();
              stats.updated += batchDocs.length;
              console.log(`      Batch ${stats.batches}: Updated ${batchDocs.length} documents`);

              // Record successful updates
              batchDocs.forEach(doc => {
                report.recordUpdate({
                  id: doc.id,
                  before: null,
                  after: COMPANY_ID,
                  metadata: { name: doc.name, createdBy: doc.createdBy }
                });
              });
            } catch (error) {
              stats.errors += batchDocs.length;
              console.error(`      Batch ${stats.batches} failed:`, error.message);

              // Record errors
              batchDocs.forEach(doc => {
                report.recordError({
                  id: doc.id,
                  error: error.message
                });
              });
            }
          }
        }
      }

      console.log(`      Scanned: ${snapshot.size}, Has companyId: ${stats.hasCompanyId}, Missing: ${stats.missingCompanyId}`);

      // Pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < PAGE_SIZE) {
        hasMore = false;
      }
    }

    // Finalize report
    const reportSummary = await report.finalize();

    // Print final report
    const duration = Date.now() - startTime;
    const success = stats.errors === 0;

    printFooter(success, {
      'Scanned': `${stats.scanned} projects`,
      'Has companyId': `${stats.hasCompanyId} projects`,
      'Matches target': `${stats.matchesTarget} projects`,
      'Different company': `${stats.differentCompany} projects`,
      'Missing companyId': `${stats.missingCompanyId} projects`,
      'No createdBy': `${stats.noCreatedBy} projects`,
      'User not found': `${stats.userNotFound} projects`,
      ...(DRY_RUN ? {} : {
        'Updated': `${stats.updated} projects`,
        'Errors': `${stats.errors} projects`
      }),
      'Cache hits/misses': `${stats.cacheHits}/${stats.cacheMisses}`,
      'Pages processed': `${stats.pages}`,
      'Report file': reportSummary.filePath
    }, duration);

    if (DRY_RUN) {
      console.log('');
      console.log('DRY-RUN: No changes were made to the database');
      console.log('');
      console.log('To execute migration, run:');
      console.log(`   COMPANY_ID=${COMPANY_ID} COLLECTION_PROJECTS=${COLLECTION_PROJECTS} COLLECTION_USERS=${COLLECTION_USERS} DRY_RUN=false node scripts/${SCRIPT_NAME}`);
      console.log('');
    }

    return success;

  } catch (error) {
    console.error('');
    console.error(`[${SCRIPT_NAME}] Verification failed:`, error.message);
    throw error;
  }
}

// =============================================================================
// RUN VERIFICATION
// =============================================================================

verifyProjectsCompanyId()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error(`[${SCRIPT_NAME}] Unhandled error:`, error);
    process.exit(1);
  });
