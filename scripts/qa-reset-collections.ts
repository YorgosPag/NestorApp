/**
 * QA Reset Collections Script
 *
 * Αδειάζει τις 16 QA collections για καθαρό testing context.
 * Ref: docs/QA_AGENT_FINDINGS.md → "Firestore Collections Reset — QA Clean Slate"
 *
 * Usage:
 *   npx tsx scripts/qa-reset-collections.ts
 *
 * ΠΡΟΣΟΧΗ: ΔΕΝ αγγίζει settings, projects, buildings ή άλλες production collections.
 */

import * as admin from 'firebase-admin';

// ── Firebase Admin Init ──────────────────────────────────────────────
if (!admin.apps.length) {
  // Try service account key from env (same pattern as set-super-admin.js)
  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const keyB64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;

  if (keyB64) {
    const decoded = Buffer.from(keyB64, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decoded);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else if (keyJson) {
    const serviceAccount = JSON.parse(keyJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Fallback: Application Default Credentials (local dev with gcloud auth)
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'pagonis-87766',
    });
  }
}

const db = admin.firestore();

// ── The 16 QA Collections ────────────────────────────────────────────
const QA_COLLECTIONS = [
  'ai_agent_feedback',
  'ai_chat_history',
  'ai_pipeline_audit',
  'ai_pipeline_queue',
  'ai_query_strategies',
  'ai_usage',
  'companies',
  'contacts',
  'conversations',
  'external_identities',
  'files',
  'messages',
  'file_links',
  'search_documents',
  'units',
  'voice_commands',
] as const;

// ── Batch Delete (Firestore limit: 500 per batch) ───────────────────
async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = db.collection(collectionName);
  let totalDeleted = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snapshot = await collectionRef.limit(500).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;
  }

  return totalDeleted;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('');
  console.log('🧹 QA Reset — Αδειάζω 16 collections...');
  console.log('─'.repeat(50));

  let grandTotal = 0;

  for (const collection of QA_COLLECTIONS) {
    const count = await deleteCollection(collection);
    grandTotal += count;
    const icon = count > 0 ? '🗑️' : '✅';
    console.log(`  ${icon} ${collection}: ${count} docs deleted`);
  }

  console.log('─'.repeat(50));
  console.log(`✅ Ολοκληρώθηκε! Σύνολο: ${grandTotal} documents διαγράφηκαν.`);
  console.log('📋 Clean slate — έτοιμο για νέα QA tests.');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
