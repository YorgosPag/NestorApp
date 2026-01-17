/**
 * =============================================================================
 * 🏗️ CANONICAL SCRIPT: Backfill Buildings companyId
 * =============================================================================
 *
 * Enterprise-grade migration script for backfilling missing companyId.
 * SINGLE source of truth for buildings migrations.
 *
 * @module scripts/migrations.buildings.backfillCompanyId
 * @enterprise Zero Duplicates - Canonical Path
 *
 * USAGE:
 * ```bash
 * # Dry-run (preview changes - DEFAULT)
 * COMPANY_ID=<COMPANY_DOC_ID> node scripts/migrations.buildings.backfillCompanyId.js
 *
 * # Execute migration
 * COMPANY_ID=<COMPANY_DOC_ID> DRY_RUN=false node scripts/migrations.buildings.backfillCompanyId.js
 *
 * # Custom page/batch size
 * COMPANY_ID=<ID> PAGE_SIZE=50 BATCH_SIZE=100 node scripts/migrations.buildings.backfillCompanyId.js
 * ```
 *
 * FEATURES:
 * - Idempotent (safe to re-run)
 * - Dry-run mode by default
 * - Page-by-page processing (memory efficient)
 * - Batch writes (Firestore limit: 500)
 * - All config from env/argv (ZERO hardcoded values)
 * - Detailed progress reporting
 *
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');
const { getCompanyId, getDryRun, getNumericEnv, printHeader, printFooter } = require('./_shared/validateInputs');

// =============================================================================
// CONFIGURATION - ALL FROM ENV/ARGV (ZERO HARDCODED)
// =============================================================================

const SCRIPT_NAME = 'migrations.buildings.backfillCompanyId.js';

// Get and validate inputs
const envVars = loadEnvLocal();
const COMPANY_ID = getCompanyId(SCRIPT_NAME);
const DRY_RUN = getDryRun();
const PAGE_SIZE = getNumericEnv('PAGE_SIZE', 100);
const BATCH_SIZE = getNumericEnv('BATCH_SIZE', 500);

// 🔒 ENTERPRISE: Collection name REQUIRED (no hardcoded default)
const COLLECTION_BUILDINGS = process.env.COLLECTION_BUILDINGS;
if (!COLLECTION_BUILDINGS) {
  console.error(`❌ [${SCRIPT_NAME}] ERROR: COLLECTION_BUILDINGS is required`);
  console.error(`💡 [${SCRIPT_NAME}] Usage:`);
  console.error(`   COLLECTION_BUILDINGS=buildings COMPANY_ID=<ID> node scripts/${SCRIPT_NAME}`);
  process.exit(1);
}

// 🔒 ENTERPRISE: Optional legacy company IDs for rewrite (comma-separated)
// DEFAULT: Only update documents with MISSING companyId (null/undefined)
// OPTIONAL: If LEGACY_COMPANY_IDS is set, also rewrite those specific values
const LEGACY_COMPANY_IDS = process.env.LEGACY_COMPANY_IDS
  ? process.env.LEGACY_COMPANY_IDS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

// =============================================================================
// INITIALIZE FIREBASE ADMIN
// =============================================================================

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

const db = admin.firestore();

// =============================================================================
// STATISTICS
// =============================================================================

const stats = {
  scanned: 0,
  needsUpdate: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  batches: 0,
  pages: 0
};

// =============================================================================
// MAIN MIGRATION FUNCTION
// =============================================================================

async function backfillBuildingsCompanyId() {
  const startTime = Date.now();

  printHeader('BUILDINGS COMPANYID BACKFILL MIGRATION', {
    '🎯 Target Company': COMPANY_ID,
    '🔧 Mode': DRY_RUN ? 'DRY-RUN (preview only)' : 'EXECUTE (will write to DB)',
    '📄 Page Size': `${PAGE_SIZE} documents`,
    '📦 Batch Size': `${BATCH_SIZE} documents`,
    '📁 Collection': COLLECTION_BUILDINGS,
    '🔄 Legacy IDs': LEGACY_COMPANY_IDS.length > 0 ? LEGACY_COMPANY_IDS.join(', ') : '(none - only missing)'
  });

  try {
    // Step 1: Query buildings - SAFE logic
    console.log('📋 Step 1: Scanning buildings collection...');
    if (LEGACY_COMPANY_IDS.length > 0) {
      console.log('   Looking for: companyId == null/undefined OR companyId in [' + LEGACY_COMPANY_IDS.join(', ') + ']');
    } else {
      console.log('   Looking for: companyId == null/undefined ONLY (safe mode)');
    }
    console.log('   ⚠️  Will NOT touch buildings with other companyIds (multi-tenant safe)');
    console.log('');

    let lastDoc = null;
    let hasMore = true;

    // Page-by-page processing
    while (hasMore) {
      stats.pages++;
      console.log(`   📄 Page ${stats.pages}: Fetching ${PAGE_SIZE} documents...`);

      // Build query
      let query = db.collection(COLLECTION_BUILDINGS).limit(PAGE_SIZE);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      // Process this page
      const docsToUpdate = [];

      snapshot.docs.forEach(doc => {
        stats.scanned++;
        const data = doc.data();

        // 🔒 ENTERPRISE: Safe multi-tenant logic
        // - ALWAYS update if companyId is missing (null/undefined)
        // - ONLY update legacy values if explicitly listed in LEGACY_COMPANY_IDS
        // - NEVER touch documents with other companyIds (prevents cross-tenant corruption)
        const isMissing = !data.companyId;
        const isLegacyValue = LEGACY_COMPANY_IDS.length > 0 && LEGACY_COMPANY_IDS.includes(data.companyId);
        const alreadyCorrect = data.companyId === COMPANY_ID;

        if (alreadyCorrect) {
          // Already has correct companyId - skip
          stats.skipped++;
        } else if (isMissing || isLegacyValue) {
          // Needs update: missing OR explicitly listed legacy value
          stats.needsUpdate++;
          docsToUpdate.push({
            id: doc.id,
            ref: doc.ref,
            name: data.name || 'Unnamed',
            currentCompanyId: data.companyId || '(none)',
            reason: isMissing ? 'missing' : 'legacy'
          });
        } else {
          // Has a companyId that is NOT the target and NOT in legacy list
          // DO NOT TOUCH - belongs to another tenant
          stats.skipped++;
        }
      });

      console.log(`      Scanned: ${snapshot.size}, Need update: ${docsToUpdate.length}, Already OK: ${snapshot.size - docsToUpdate.length}`);

      // Commit batch writes for this page (if not dry-run)
      if (docsToUpdate.length > 0) {
        if (DRY_RUN) {
          // Preview
          console.log('      🔍 DRY-RUN - Would update:');
          docsToUpdate.slice(0, 3).forEach(doc => {
            console.log(`         - ${doc.name} (${doc.id}): ${doc.currentCompanyId} → ${COMPANY_ID} [${doc.reason}]`);
          });
          if (docsToUpdate.length > 3) {
            console.log(`         ... and ${docsToUpdate.length - 3} more`);
          }
        } else {
          // Execute batch writes (respect Firestore limit)
          for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const batchDocs = docsToUpdate.slice(i, i + BATCH_SIZE);
            stats.batches++;

            batchDocs.forEach(doc => {
              batch.update(doc.ref, {
                companyId: COMPANY_ID,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            });

            try {
              await batch.commit();
              stats.updated += batchDocs.length;
              console.log(`      ✅ Batch ${stats.batches}: Updated ${batchDocs.length} documents`);
            } catch (error) {
              stats.errors += batchDocs.length;
              console.error(`      ❌ Batch ${stats.batches} failed:`, error.message);
            }
          }
        }
      }

      // Pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < PAGE_SIZE) {
        hasMore = false;
      }
    }

    // Print final report
    const duration = Date.now() - startTime;
    const success = stats.errors === 0;

    printFooter(success, {
      '🔍 Scanned': `${stats.scanned} buildings`,
      '🎯 Needed update': `${stats.needsUpdate} buildings`,
      ...(DRY_RUN ? {} : {
        '✅ Updated': `${stats.updated} buildings`,
        '❌ Errors': `${stats.errors} buildings`,
        '📦 Batches': `${stats.batches}`
      }),
      '✓ Skipped (already correct)': `${stats.skipped} buildings`,
      '📄 Pages processed': `${stats.pages}`
    }, duration);

    if (DRY_RUN) {
      console.log('');
      console.log('ℹ️  DRY-RUN: No changes were made to the database');
      console.log('');
      console.log('💡 To execute migration, run:');
      console.log(`   COMPANY_ID=${COMPANY_ID} DRY_RUN=false node scripts/${SCRIPT_NAME}`);
      console.log('');
    }

    return success;

  } catch (error) {
    console.error('');
    console.error(`❌ [${SCRIPT_NAME}] Migration failed:`, error.message);
    throw error;
  }
}

// =============================================================================
// RUN MIGRATION
// =============================================================================

backfillBuildingsCompanyId()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error(`❌ [${SCRIPT_NAME}] Unhandled error:`, error);
    process.exit(1);
  });
