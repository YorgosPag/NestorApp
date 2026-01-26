/**
 * Migration script: Add companyId to opportunities
 * Run with: pnpm exec node scripts/migrate-opportunities-companyid.js
 *
 * Options:
 *   --dry-run    Preview changes without writing (default)
 *   --execute    Actually write changes to Firestore
 */

// Load environment variables manually
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });
}

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    console.error('❌ No Firebase service account key found!');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Configuration
const DEFAULT_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';
const COLLECTION = 'opportunities';

async function migrate(dryRun = true) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🏢 OPPORTUNITY COMPANYID MIGRATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Mode:', dryRun ? '🔍 DRY-RUN (preview only)' : '⚡ EXECUTE (writing to Firestore)');
  console.log('  Default companyId:', DEFAULT_COMPANY_ID);
  console.log('');

  // Get all opportunities
  const snapshot = await db.collection(COLLECTION).get();
  console.log(`  Found ${snapshot.size} opportunities total`);
  console.log('');

  let needsMigration = 0;
  let alreadyHas = 0;
  let migrated = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (data.companyId) {
      alreadyHas++;
      continue;
    }

    needsMigration++;

    if (dryRun) {
      console.log(`  [DRY-RUN] Would update: ${doc.id}`);
      console.log(`            title: ${data.title || 'N/A'}`);
      console.log(`            → companyId: ${DEFAULT_COMPANY_ID}`);
      console.log('');
      migrated++;
    } else {
      try {
        batch.update(doc.ref, {
          companyId: DEFAULT_COMPANY_ID,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;
        migrated++;

        // Commit every 500 (Firestore batch limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  ✅ Committed batch of ${batchCount} documents`);
          batchCount = 0;
        }
      } catch (err) {
        console.error(`  ❌ Error updating ${doc.id}:`, err.message);
        errors++;
      }
    }
  }

  // Commit remaining
  if (!dryRun && batchCount > 0) {
    try {
      await batch.commit();
      console.log(`  ✅ Committed final batch of ${batchCount} documents`);
    } catch (err) {
      console.error('  ❌ Final batch commit failed:', err.message);
      errors += batchCount;
      migrated -= batchCount;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total opportunities:     ${snapshot.size}`);
  console.log(`  Already have companyId:  ${alreadyHas}`);
  console.log(`  Needed migration:        ${needsMigration}`);
  console.log(`  ${dryRun ? 'Would migrate' : 'Migrated'}:          ${migrated}`);
  if (errors > 0) {
    console.log(`  Errors:                  ${errors}`);
  }
  console.log('');

  if (dryRun && needsMigration > 0) {
    console.log('  ℹ️  Run with --execute to apply changes:');
    console.log('     pnpm exec node scripts/migrate-opportunities-companyid.js --execute');
    console.log('');
  }
}

// Parse arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

migrate(dryRun)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
