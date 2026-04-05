#!/usr/bin/env ts-node
/**
 * ADR-287 Batch 14 — Property Enums Backfill Migration
 *
 * One-off normalizer για existing Firestore property records. Διαβάζει όλα
 * τα documents στο `properties` collection, εφαρμόζει τους SSoT resolvers
 * στα `type` (PropertyType) και `commercialStatus` (CommercialStatus) πεδία,
 * γράφει πίσω τα canonical tokens.
 *
 * Συμπληρωματικό του Batch 13 (write-time normalization στο
 * property-mutation-gateway) — backfills legacy records που γράφτηκαν πριν
 * την ενεργοποίηση της middleware ή που μπήκαν απευθείας στο Firestore.
 *
 * Zero drift: χρησιμοποιεί ΤΟΥΣ ΙΔΙΟΥΣ normalizers που χρησιμοποιεί το
 * runtime gateway + το AI pipeline (single import από src/constants/).
 *
 * USAGE:
 *   npx ts-node scripts/migrate-property-enums.ts --dry-run   # default — δείχνει τι θα άλλαζε
 *   npx ts-node scripts/migrate-property-enums.ts --apply     # εφαρμόζει τις αλλαγές στο Firestore
 *
 * @author Enterprise Architecture Team
 * @date 2026-04-05
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { normalizePropertyType } from '../src/constants/property-types';
import { normalizeCommercialStatus } from '../src/constants/commercial-statuses';

// ============================================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================================

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '..', 'config', 'firebase-service-account.json');

if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    console.log('✅ Firebase Admin initialized with application default credentials');
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized from service account file');
    } catch (error) {
      console.error('❌ Could not initialize Firebase Admin:', error);
      process.exit(1);
    }
  }
}

const db = admin.firestore();
const PROPERTIES_COLLECTION = process.env.NEXT_PUBLIC_PROPERTIES_COLLECTION || 'properties';

// ============================================================================
// CLI ARGS
// ============================================================================

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dryRun = !apply; // dry-run by default

console.log(`\n🔧 ADR-287 Batch 14 — Property Enums Backfill`);
console.log(`   Mode:       ${apply ? '🔴 APPLY (writes enabled)' : '🟢 DRY-RUN (no writes)'}`);
console.log(`   Collection: ${PROPERTIES_COLLECTION}`);
console.log('');

// ============================================================================
// NORMALIZATION LOGIC
// ============================================================================

interface PropertyChange {
  readonly id: string;
  readonly field: 'type' | 'commercialStatus';
  readonly from: unknown;
  readonly to: string;
}

interface PropertyReject {
  readonly id: string;
  readonly field: 'type' | 'commercialStatus';
  readonly value: unknown;
  readonly reason: string;
}

function normalizeDocument(
  id: string,
  data: admin.firestore.DocumentData,
): { updates: Record<string, string>; changes: PropertyChange[]; rejects: PropertyReject[] } {
  const updates: Record<string, string> = {};
  const changes: PropertyChange[] = [];
  const rejects: PropertyReject[] = [];

  const rawType = data.type;
  if (rawType !== null && rawType !== undefined && rawType !== '') {
    const canonical = normalizePropertyType(rawType);
    if (!canonical) {
      rejects.push({ id, field: 'type', value: rawType, reason: 'no canonical match' });
    } else if (canonical !== rawType) {
      updates.type = canonical;
      changes.push({ id, field: 'type', from: rawType, to: canonical });
    }
  }

  const rawStatus = data.commercialStatus;
  if (rawStatus !== null && rawStatus !== undefined && rawStatus !== '') {
    const canonical = normalizeCommercialStatus(rawStatus);
    if (!canonical) {
      rejects.push({ id, field: 'commercialStatus', value: rawStatus, reason: 'no canonical match' });
    } else if (canonical !== rawStatus) {
      updates.commercialStatus = canonical;
      changes.push({ id, field: 'commercialStatus', from: rawStatus, to: canonical });
    }
  }

  return { updates, changes, rejects };
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function migrate(): Promise<void> {
  console.log(`📥 Fetching all documents from '${PROPERTIES_COLLECTION}'...`);
  const snapshot = await db.collection(PROPERTIES_COLLECTION).get();
  console.log(`   Found ${snapshot.size} documents\n`);

  const allChanges: PropertyChange[] = [];
  const allRejects: PropertyReject[] = [];
  let touched = 0;
  let cleanCount = 0;

  // Batched writes (Firestore limit: 500 ops/batch)
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchOps = 0;
  let committedBatches = 0;

  for (const doc of snapshot.docs) {
    const { updates, changes, rejects } = normalizeDocument(doc.id, doc.data());

    allRejects.push(...rejects);

    if (changes.length === 0) {
      cleanCount++;
      continue;
    }

    allChanges.push(...changes);
    touched++;

    if (apply) {
      batch.update(doc.ref, updates);
      batchOps++;

      if (batchOps >= BATCH_SIZE) {
        await batch.commit();
        committedBatches++;
        console.log(`   ✅ Committed batch #${committedBatches} (${batchOps} updates)`);
        batch = db.batch();
        batchOps = 0;
      }
    }
  }

  if (apply && batchOps > 0) {
    await batch.commit();
    committedBatches++;
    console.log(`   ✅ Committed final batch #${committedBatches} (${batchOps} updates)`);
  }

  // ==========================================================================
  // REPORT
  // ==========================================================================

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Total documents:       ${snapshot.size}`);
  console.log(`   Already canonical:     ${cleanCount}`);
  console.log(`   Documents to update:   ${touched}`);
  console.log(`   Fields to normalize:   ${allChanges.length}`);
  console.log(`   Unresolvable values:   ${allRejects.length}`);
  console.log('');

  if (allChanges.length > 0) {
    console.log('🔄 NORMALIZATIONS (first 20):');
    for (const change of allChanges.slice(0, 20)) {
      console.log(`   [${change.id}] ${change.field}: ${JSON.stringify(change.from)} → "${change.to}"`);
    }
    if (allChanges.length > 20) {
      console.log(`   ... και ${allChanges.length - 20} ακόμη`);
    }
    console.log('');
  }

  if (allRejects.length > 0) {
    console.log('⚠️  UNRESOLVABLE VALUES (χρειάζονται manual review):');
    for (const reject of allRejects) {
      console.log(`   [${reject.id}] ${reject.field}=${JSON.stringify(reject.value)} (${reject.reason})`);
    }
    console.log('');
  }

  if (dryRun) {
    console.log('🟢 DRY-RUN complete — δεν έγιναν writes στο Firestore.');
    console.log('   Για εκτέλεση: npx ts-node scripts/migrate-property-enums.ts --apply');
  } else {
    console.log(`🔴 APPLY complete — ${committedBatches} batch(es) committed στο Firestore.`);
  }
  console.log('');
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
