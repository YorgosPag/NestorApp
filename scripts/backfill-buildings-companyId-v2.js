/**
 * =============================================================================
 * BUILDINGS BACKFILL SCRIPT - ENTERPRISE MIGRATION
 * =============================================================================
 *
 * Idempotent migration script to backfill missing companyId in buildings
 * Enterprise patterns: SAP/Salesforce data migrations
 *
 * Features:
 * - Dry-run mode (default)
 * - Pagination for large datasets
 * - Batch writes (500 docs max per batch)
 * - Detailed progress reporting
 * - Idempotent (safe to re-run)
 * - COMPANY_ID from env/argv
 *
 * @usage
 * ```bash
 * # Dry-run (preview)
 * COMPANY_ID=pzNUy8ksddGCtcQMqumR node scripts/backfill-buildings-companyId-v2.js
 *
 * # Execute migration
 * COMPANY_ID=pzNUy8ksddGCtcQMqumR DRY_RUN=false node scripts/backfill-buildings-companyId-v2.js
 * ```
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const COMPANY_ID = process.env.COMPANY_ID || process.argv[2];
const DRY_RUN = process.env.DRY_RUN !== 'false';
const BATCH_SIZE = 500; // Firestore batch write limit
const PAGE_SIZE = 100; // Query pagination size

// =============================================================================
// VALIDATION
// =============================================================================

if (!COMPANY_ID) {
  console.error('❌ [BACKFILL] ERROR: COMPANY_ID is required');
  console.error('💡 [BACKFILL] Usage:');
  console.error('   COMPANY_ID=pzNUy8ksddGCtcQMqumR node scripts/backfill-buildings-companyId-v2.js');
  console.error('   COMPANY_ID=pzNUy8ksddGCtcQMqumR DRY_RUN=false node scripts/backfill-buildings-companyId-v2.js');
  process.exit(1);
}

// Validate docId format (reject slugs)
if (COMPANY_ID.includes('-') && COMPANY_ID.length < 20) {
  console.error('❌ [BACKFILL] ERROR: COMPANY_ID appears to be a slug, not a Firestore document ID');
  console.error(`📍 [BACKFILL] Received: "${COMPANY_ID}"`);
  console.error('💡 [BACKFILL] Expected: Firestore docId (e.g., "pzNUy8ksddGCtcQMqumR")');
  process.exit(1);
}

// =============================================================================
// LOAD ENVIRONMENT
// =============================================================================

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  });

  return envVars;
}

const envVars = loadEnvLocal();

// =============================================================================
// INITIALIZE FIREBASE ADMIN
// =============================================================================

try {
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('✅ [BACKFILL] Firebase Admin initialized');
} catch (error) {
  console.error('❌ [BACKFILL] Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

const db = admin.firestore();
const BUILDINGS_COLLECTION = 'buildings';

// =============================================================================
// STATISTICS
// =============================================================================

const stats = {
  scanned: 0,
  needsUpdate: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  batches: 0
};

// =============================================================================
// MAIN MIGRATION FUNCTION
// =============================================================================

async function backfillBuildingsCompanyId() {
  const startTime = Date.now();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏗️  BUILDINGS COMPANYID BACKFILL MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`🎯 Target Company: ${COMPANY_ID}`);
  console.log(`🔧 Mode: ${DRY_RUN ? 'DRY-RUN (preview only)' : 'EXECUTE (will write to DB)'}`);
  console.log(`📦 Batch Size: ${BATCH_SIZE} documents`);
  console.log(`📄 Page Size: ${PAGE_SIZE} documents`);
  console.log('');

  try {
    // Step 1: Query buildings without companyId
    console.log('📋 [BACKFILL] Step 1: Querying buildings without companyId...');

    let query = db.collection(BUILDINGS_COLLECTION)
      .where('companyId', '==', null)
      .limit(PAGE_SIZE);

    let hasMore = true;
    let lastDoc = null;
    const buildingsToUpdate = [];

    // Pagination loop
    while (hasMore) {
      let snapshot;

      if (lastDoc) {
        snapshot = await query.startAfter(lastDoc).get();
      } else {
        snapshot = await query.get();
      }

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      snapshot.docs.forEach(doc => {
        stats.scanned++;
        const data = doc.data();

        // Check if building needs update
        if (!data.companyId) {
          stats.needsUpdate++;
          buildingsToUpdate.push({
            id: doc.id,
            ref: doc.ref,
            name: data.name || 'Unnamed Building',
            projectId: data.projectId || 'N/A'
          });
        } else {
          stats.skipped++;
        }
      });

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      console.log(`   📄 Scanned ${stats.scanned} buildings (${stats.needsUpdate} need update)...`);

      // Check if we have more pages
      if (snapshot.size < PAGE_SIZE) {
        hasMore = false;
      }
    }

    console.log('');
    console.log(`✅ [BACKFILL] Scan complete: ${stats.scanned} buildings scanned`);
    console.log(`   🔍 Need update: ${stats.needsUpdate}`);
    console.log(`   ✓ Already have companyId: ${stats.skipped}`);
    console.log('');

    if (buildingsToUpdate.length === 0) {
      console.log('🎉 [BACKFILL] No buildings need updating. Migration complete!');
      return;
    }

    // Step 2: Update in batches
    if (DRY_RUN) {
      console.log('🔍 [BACKFILL] DRY-RUN MODE - Preview of changes:');
      console.log('');
      buildingsToUpdate.slice(0, 10).forEach((building, index) => {
        console.log(`   ${index + 1}. ${building.name} (ID: ${building.id})`);
        console.log(`      Project: ${building.projectId}`);
        console.log(`      Will set: companyId = "${COMPANY_ID}"`);
        console.log('');
      });

      if (buildingsToUpdate.length > 10) {
        console.log(`   ... and ${buildingsToUpdate.length - 10} more buildings`);
        console.log('');
      }

      console.log('💡 [BACKFILL] To execute migration, run:');
      console.log(`   COMPANY_ID=${COMPANY_ID} DRY_RUN=false node scripts/backfill-buildings-companyId-v2.js`);

    } else {
      console.log('⚙️  [BACKFILL] EXECUTE MODE - Updating buildings...');
      console.log('');

      // Process in batches (Firestore limit: 500 writes per batch)
      for (let i = 0; i < buildingsToUpdate.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchItems = buildingsToUpdate.slice(i, i + BATCH_SIZE);

        stats.batches++;
        console.log(`   📦 Batch ${stats.batches}: Updating ${batchItems.length} buildings...`);

        batchItems.forEach(building => {
          batch.update(building.ref, {
            companyId: COMPANY_ID,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });

        try {
          await batch.commit();
          stats.updated += batchItems.length;
          console.log(`   ✅ Batch ${stats.batches} committed successfully (${stats.updated}/${buildingsToUpdate.length})`);
        } catch (error) {
          stats.errors += batchItems.length;
          console.error(`   ❌ Batch ${stats.batches} failed:`, error);
        }
      }

      console.log('');
      console.log(`✅ [BACKFILL] Migration complete!`);
    }

  } catch (error) {
    console.error('');
    console.error('❌ [BACKFILL] Migration failed:', error);
    throw error;
  }

  // Final report
  const duration = Date.now() - startTime;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`🔍 Scanned: ${stats.scanned} buildings`);
  console.log(`🎯 Needed update: ${stats.needsUpdate} buildings`);

  if (!DRY_RUN) {
    console.log(`✅ Updated: ${stats.updated} buildings`);
    console.log(`❌ Errors: ${stats.errors} buildings`);
    console.log(`📦 Batches: ${stats.batches}`);
  }

  console.log(`✓ Skipped (already had companyId): ${stats.skipped} buildings`);
  console.log('');

  if (DRY_RUN) {
    console.log('ℹ️  DRY-RUN: No changes were made to the database');
  } else {
    console.log('✅ Changes committed to Firestore');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

// =============================================================================
// RUN MIGRATION
// =============================================================================

backfillBuildingsCompanyId()
  .then(() => {
    console.log('🎉 [BACKFILL] Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ [BACKFILL] Script failed:', error);
    console.error('');
    process.exit(1);
  });
