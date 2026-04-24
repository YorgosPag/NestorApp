/**
 * One-shot backfill: remove empty default fields from existing contact
 * documents (ADR-323 Layer 4).
 *
 * Context: before ADR-323 the update path wrote ~30 empty fields
 * (`specialty: ''`, `emails: []`, `socialMedia: { all empty }`, …) on every
 * save because `sanitizeContactData` was only called in CREATE. The runtime
 * fix prevents new writes from producing bloat; this script cleans up the
 * documents that were bloated before the fix landed.
 *
 * Semantics mirror `sanitizeContactForUpdate`:
 *   - empty string (trimmed)      → deleteField()
 *   - empty array                  → deleteField()
 *   - null                         → deleteField()
 *   - object with ALL nested keys empty → deleteField()
 *   - photoURL / logoURL / multiplePhotoURLs → preserved (own deletion flow)
 *   - non-empty values             → left alone (never touched)
 *
 * Run:
 *   node scripts/cleanup-empty-contact-fields.mjs --dry-run
 *   node scripts/cleanup-empty-contact-fields.mjs         # apply
 *   node scripts/cleanup-empty-contact-fields.mjs --collection=contacts --dry-run
 *
 * @see adrs/ADR-323-contact-mutations-sanitize-ssot-diff-updates.md
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const collectionArg = args.find((a) => a.startsWith('--collection='));
const COLLECTION = collectionArg ? collectionArg.split('=')[1] : 'contacts';

// ─── env loader (same pattern as migrate-legacy-ids.mjs) ─────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

// ─── firebase admin init ─────────────────────────────────────────────────────
function initFirebase() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const raw = b64 ? Buffer.from(b64, 'base64').toString('utf-8') : json;
  if (!raw) throw new Error('No Firebase credentials in .env.local');
  const sa = JSON.parse(raw);
  const app = initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
    projectId: sa.project_id,
  });
  return getFirestore(app);
}

const db = initFirebase();

// ─── preservation rules (mirror data-cleaning.ts requiresSpecialDeletion) ────
const PRESERVED_FIELDS = new Set(['photoURL', 'logoURL', 'multiplePhotoURLs']);

// Fields written/managed by the backend — never touch during cleanup
const SYSTEM_FIELDS = new Set([
  'id', '_id', 'createdAt', 'createdBy', 'updatedAt',
  '_lastModifiedAt', '_lastModifiedBy', '_lastModifiedByName',
  'companyId', 'status', 'previousStatus', 'type',
  'deletedAt', 'deletedBy', 'archivedAt', 'archivedBy',
  'restoredAt', 'restoredBy',
]);

// ─── empty detection ─────────────────────────────────────────────────────────
function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && !(v instanceof Date)) {
    const keys = Object.keys(v);
    if (keys.length === 0) return true;
    return keys.every((k) => isEmptyValue(v[k]));
  }
  return false;
}

// ─── main ────────────────────────────────────────────────────────────────────
async function cleanupCollection(collectionName) {
  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Scanning collection: ${collectionName}\n`);
  const snap = await db.collection(collectionName).get();
  console.log(`  Total documents: ${snap.size}`);

  let docsToClean = 0;
  let fieldsDeleted = 0;
  const perDocPlan = [];

  snap.forEach((doc) => {
    const data = doc.data();
    const deleteMap = {};
    for (const [key, value] of Object.entries(data)) {
      if (SYSTEM_FIELDS.has(key)) continue;
      if (PRESERVED_FIELDS.has(key)) continue;
      if (isEmptyValue(value)) {
        deleteMap[key] = FieldValue.delete();
      }
    }
    const count = Object.keys(deleteMap).length;
    if (count > 0) {
      docsToClean++;
      fieldsDeleted += count;
      perDocPlan.push({ id: doc.id, count, fields: Object.keys(deleteMap), deleteMap });
    }
  });

  console.log(`  Documents needing cleanup: ${docsToClean}`);
  console.log(`  Total empty fields to delete: ${fieldsDeleted}`);

  if (docsToClean === 0) {
    console.log('\n  Nothing to do. Exiting.');
    return;
  }

  // Show a preview (first 5 docs)
  console.log('\n  Preview (first 5):');
  for (const p of perDocPlan.slice(0, 5)) {
    console.log(`    ${p.id}: ${p.count} fields → [${p.fields.slice(0, 6).join(', ')}${p.fields.length > 6 ? ', …' : ''}]`);
  }

  if (DRY_RUN) {
    console.log('\n  [DRY-RUN] No writes performed. Re-run without --dry-run to apply.');
    return;
  }

  // Apply in batches of 450 (Firestore limit = 500, leave headroom)
  console.log('\n  Applying cleanup...');
  const BATCH_SIZE = 450;
  let applied = 0;
  for (let i = 0; i < perDocPlan.length; i += BATCH_SIZE) {
    const chunk = perDocPlan.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const p of chunk) {
      const ref = db.collection(collectionName).doc(p.id);
      batch.update(ref, p.deleteMap);
    }
    await batch.commit();
    applied += chunk.length;
    console.log(`    Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs (total ${applied}/${perDocPlan.length})`);
  }

  console.log(`\n  Done. Cleaned ${docsToClean} documents, deleted ${fieldsDeleted} empty fields.`);
}

// ─── entrypoint ──────────────────────────────────────────────────────────────
(async () => {
  try {
    await cleanupCollection(COLLECTION);
    process.exit(0);
  } catch (err) {
    console.error('FAILED:', err);
    process.exit(1);
  }
})();
