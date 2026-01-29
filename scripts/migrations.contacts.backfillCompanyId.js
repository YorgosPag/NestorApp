/**
 * =============================================================================
 * CANONICAL SCRIPT: Backfill Contacts companyId
 * =============================================================================
 *
 * Enterprise-grade migration script for backfilling missing companyId to contacts.
 * Derives companyId from createdBy user's company.
 *
 * @module scripts/migrations.contacts.backfillCompanyId
 * @enterprise Zero Duplicates - Canonical Path
 * @compliance Local_Protocol v1.1 - ZERO hardcoded values
 *
 * USAGE:
 * ```bash
 * # DRY RUN (default) - Scan and report only
 * COMPANY_ID=<COMPANY_DOC_ID> COLLECTION_CONTACTS=contacts COLLECTION_USERS=users node scripts/migrations.contacts.backfillCompanyId.js
 *
 * # EXECUTE - Backfill contacts with missing companyId
 * COMPANY_ID=<COMPANY_DOC_ID> COLLECTION_CONTACTS=contacts COLLECTION_USERS=users DRY_RUN=false node scripts/migrations.contacts.backfillCompanyId.js
 * ```
 *
 * COMPLIANCE:
 * - ✅ ZERO hardcoded defaults (PAGE_SIZE/BATCH_SIZE from centralized config)
 * - ✅ All collection names REQUIRED via env
 * - ✅ Streaming approach (process per page, not accumulate all)
 * - ✅ Structured audit report (JSONL output)
 * - ✅ Memory-safe for large datasets
 * - ✅ Multi-tenant safe (only updates contacts belonging to target company)
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

const SCRIPT_NAME = 'migrations.contacts.backfillCompanyId.js';

// Get and validate inputs
const envVars = loadEnvLocal();
const COMPANY_ID = getCompanyId(SCRIPT_NAME);
const DRY_RUN = getDryRun();

// Use centralized defaults - NOT hardcoded in this script
const PAGE_SIZE = getNumericEnv('PAGE_SIZE', DEFAULTS.PAGE_SIZE);
const BATCH_SIZE = getNumericEnv('BATCH_SIZE', DEFAULTS.BATCH_SIZE);

// Collection names REQUIRED (no hardcoded defaults per Local_Protocol)
const COLLECTION_CONTACTS = process.env.COLLECTION_CONTACTS;
if (!COLLECTION_CONTACTS) {
  console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_CONTACTS is required`);
  console.error(`Usage: COLLECTION_CONTACTS=contacts COLLECTION_USERS=users COMPANY_ID=<ID> node scripts/${SCRIPT_NAME}`);
  process.exit(1);
}

const COLLECTION_USERS = process.env.COLLECTION_USERS;
if (!COLLECTION_USERS) {
  console.error(`[${SCRIPT_NAME}] ERROR: COLLECTION_USERS is required`);
  console.error(`Usage: COLLECTION_CONTACTS=contacts COLLECTION_USERS=users COMPANY_ID=<ID> node scripts/${SCRIPT_NAME}`);
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
  needsUpdate: 0,
  updated: 0,
  noCreatedBy: 0,
  userNotFound: 0,
  userDifferentCompany: 0,
  skipped: 0,
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
// MAIN MIGRATION FUNCTION - STREAMING APPROACH
// =============================================================================

async function backfillContactsCompanyId() {
  const startTime = Date.now();

  // Initialize report writer
  const report = createReportWriter(COLLECTION_CONTACTS, {
    outputPath: process.env.REPORT_OUTPUT_PATH
  });

  printHeader('CONTACTS COMPANYID BACKFILL MIGRATION', {
    'Target Company': COMPANY_ID,
    'Mode': DRY_RUN ? 'DRY-RUN (scan only)' : 'EXECUTE (will update)',
    'Contacts Collection': COLLECTION_CONTACTS,
    'Users Collection': COLLECTION_USERS,
    'Page Size': `${PAGE_SIZE} documents`,
    'Batch Size': `${BATCH_SIZE} documents`,
    'Report File': report.getFilePath()
  });

  try {
    console.log('Step 1: Scanning contacts collection (streaming mode)...');
    console.log('   Looking for: companyId == null/undefined');
    console.log('   Will NOT touch contacts with other companyIds (multi-tenant safe)');
    console.log('');

    let lastDoc = null;
    let hasMore = true;

    // STREAMING: Process per page, not accumulate all
    while (hasMore) {
      stats.pages++;
      console.log(`   Page ${stats.pages}: Fetching ${PAGE_SIZE} documents...`);

      let query = db.collection(COLLECTION_CONTACTS).limit(PAGE_SIZE);
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

        // Check existing companyId
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
          stats.skipped++;
          continue;
        }

        // Missing companyId - try to derive from createdBy
        stats.missingCompanyId++;

        if (!data.createdBy) {
          stats.noCreatedBy++;
          console.log(`      SKIP: Contact "${data.name || data.email || doc.id}" has no createdBy field`);
          report.recordSkip({
            id: doc.id,
            reason: 'no_createdBy_field',
            details: `name=${data.name || 'N/A'}`
          });
          continue;
        }

        // Lookup user's companyId
        const userCompanyId = await getUserCompanyId(data.createdBy);

        if (!userCompanyId) {
          stats.userNotFound++;
          console.log(`      SKIP: Contact "${data.name || doc.id}" - user ${data.createdBy} not found or has no companyId`);
          report.recordSkip({
            id: doc.id,
            reason: 'user_not_found_or_no_company',
            details: `createdBy=${data.createdBy}`
          });
          continue;
        }

        if (userCompanyId !== COMPANY_ID) {
          stats.userDifferentCompany++;
          // This contact belongs to a different company - DO NOT TOUCH
          report.recordSkip({
            id: doc.id,
            reason: 'user_different_company',
            details: `user=${data.createdBy} has companyId=${userCompanyId}`
          });
          continue;
        }

        // Safe to update - belongs to target company
        stats.needsUpdate++;
        pageDocsToUpdate.push({
          id: doc.id,
          ref: doc.ref,
          name: data.name || data.email || 'Unnamed',
          createdBy: data.createdBy,
          derivedCompanyId: userCompanyId
        });
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

      console.log(`      Scanned: ${snapshot.size}, Need update: ${stats.needsUpdate}, Skipped: ${stats.skipped}`);

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
      'Scanned': `${stats.scanned} contacts`,
      'Has companyId': `${stats.hasCompanyId} contacts`,
      'Matches target': `${stats.matchesTarget} contacts`,
      'Different company': `${stats.differentCompany} contacts`,
      'Missing companyId': `${stats.missingCompanyId} contacts`,
      'Needs update': `${stats.needsUpdate} contacts`,
      'No createdBy': `${stats.noCreatedBy} contacts`,
      'User not found': `${stats.userNotFound} contacts`,
      'User different company': `${stats.userDifferentCompany} contacts`,
      ...(DRY_RUN ? {} : {
        'Updated': `${stats.updated} contacts`,
        'Errors': `${stats.errors} contacts`
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
      console.log(`   COMPANY_ID=${COMPANY_ID} COLLECTION_CONTACTS=${COLLECTION_CONTACTS} COLLECTION_USERS=${COLLECTION_USERS} DRY_RUN=false node scripts/${SCRIPT_NAME}`);
      console.log('');
    }

    return success;

  } catch (error) {
    console.error('');
    console.error(`[${SCRIPT_NAME}] Migration failed:`, error.message);
    throw error;
  }
}

// =============================================================================
// RUN MIGRATION
// =============================================================================

backfillContactsCompanyId()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error(`[${SCRIPT_NAME}] Unhandled error:`, error);
    process.exit(1);
  });
