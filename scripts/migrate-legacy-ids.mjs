/**
 * Standalone migration script — Legacy Auto-IDs → Enterprise IDs
 *
 * Uses Firebase Admin SDK directly (no auth needed).
 * Run: node scripts/migrate-legacy-ids.mjs [--dry-run]
 *
 * @see /api/admin/migrate-enterprise-ids (same logic)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// ENV LOADING
// ============================================================================

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
    // Strip outer quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// ============================================================================
// FIREBASE INIT
// ============================================================================

function initFirebase() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  let raw;
  if (b64) {
    raw = Buffer.from(b64, 'base64').toString('utf-8');
  } else if (json) {
    raw = json;
  } else {
    throw new Error('No Firebase credentials found in .env.local');
  }

  const sa = JSON.parse(raw);
  const app = initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
    projectId: sa.project_id,
  });

  return getFirestore(app);
}

const db = initFirebase();
console.log('Firebase Admin initialized\n');

// ============================================================================
// ID GENERATION (mirrors enterprise-id.service.ts)
// ============================================================================

function generateId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

// ============================================================================
// COLLECTION CONFIGS
// ============================================================================

/** @type {Record<string, string>} */
const COLLECTIONS = {
  BUILDINGS: 'buildings',
  CONTACTS: 'contacts',
  CONTACT_LINKS: 'contact_links',
  PROJECTS: 'projects',
  UNITS: 'units',
  NOTIFICATIONS: 'notifications',
  AI_AGENT_FEEDBACK: 'ai_agent_feedback',
  AI_PIPELINE_AUDIT: 'ai_pipeline_audit',
  ENTITY_AUDIT_TRAIL: 'entity_audit_trail',
  AI_PIPELINE_QUEUE: 'ai_pipeline_queue',
  OBLIGATIONS: 'obligations',
  LEGAL_CONTRACTS: 'legal_contracts',
  BROKERAGE_AGREEMENTS: 'brokerage_agreements',
  COMMISSION_RECORDS: 'commission_records',
};

const SIMPLE_CONFIGS = [
  { collection: COLLECTIONS.NOTIFICATIONS,      prefix: 'notif', generateId: () => generateId('notif') },
  { collection: COLLECTIONS.AI_AGENT_FEEDBACK,   prefix: 'fb',    generateId: () => generateId('fb') },
  { collection: COLLECTIONS.AI_PIPELINE_AUDIT,   prefix: 'paud',  generateId: () => generateId('paud') },
  { collection: COLLECTIONS.ENTITY_AUDIT_TRAIL,  prefix: 'eaud',  generateId: () => generateId('eaud') },
  { collection: COLLECTIONS.AI_PIPELINE_QUEUE,   prefix: 'pq',    generateId: () => generateId('pq') },
  { collection: COLLECTIONS.OBLIGATIONS,         prefix: 'obl',   generateId: () => generateId('obl') },
  { collection: COLLECTIONS.LEGAL_CONTRACTS,     prefix: 'lc',    generateId: () => generateId('lc'), hasInternalId: true },
  { collection: COLLECTIONS.BROKERAGE_AGREEMENTS, prefix: 'brk',  generateId: () => generateId('brk'), hasInternalId: true },
  { collection: COLLECTIONS.COMMISSION_RECORDS,   prefix: 'com',  generateId: () => generateId('com'), hasInternalId: true },
];

const BUILDING_PREFIXES = ['bldg'];
const CONTACT_PREFIXES = ['cont', 'comp'];
const BUILDING_SUBCOLLECTIONS = ['units', 'floors', 'parking', 'storage'];

/**
 * Check if ID has enterprise format: prefix_uuid-v4
 * Rejects legacy formats like lc_1773532540279_frbrz2 or brk_1773585985426_gjvw2c
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasEnterpriseId(id, prefixes) {
  for (const p of prefixes) {
    if (id.startsWith(`${p}_`)) {
      const remainder = id.slice(p.length + 1);
      return UUID_V4_REGEX.test(remainder);
    }
  }
  return false;
}

// ============================================================================
// SCAN
// ============================================================================

async function scan() {
  const report = { buildings: [], contacts: [], simple: [] };

  // Buildings
  const bSnap = await db.collection(COLLECTIONS.BUILDINGS).get();
  for (const doc of bSnap.docs) {
    if (!hasEnterpriseId(doc.id, BUILDING_PREFIXES)) {
      report.buildings.push({ id: doc.id, newId: generateId('bldg'), collection: COLLECTIONS.BUILDINGS });
    }
  }

  // Contacts
  const cSnap = await db.collection(COLLECTIONS.CONTACTS).get();
  for (const doc of cSnap.docs) {
    if (!hasEnterpriseId(doc.id, CONTACT_PREFIXES)) {
      const isCompany = doc.data().type === 'company';
      report.contacts.push({
        id: doc.id,
        newId: isCompany ? generateId('comp') : generateId('cont'),
        collection: COLLECTIONS.CONTACTS,
        type: isCompany ? 'company' : 'individual',
      });
    }
  }

  // Simple collections
  for (const cfg of SIMPLE_CONFIGS) {
    const snap = await db.collection(cfg.collection).get();
    for (const doc of snap.docs) {
      if (!hasEnterpriseId(doc.id, [cfg.prefix])) {
        report.simple.push({
          id: doc.id,
          newId: cfg.generateId(),
          collection: cfg.collection,
          hasInternalId: cfg.hasInternalId || false,
        });
      }
    }
  }

  return report;
}

// ============================================================================
// MIGRATE
// ============================================================================

async function migrateSubcollection(parentCol, oldId, newId, subName) {
  const oldRef = db.collection(parentCol).doc(oldId).collection(subName);
  const snap = await oldRef.get();
  if (snap.empty) return 0;

  const batch = db.batch();
  const newRef = db.collection(parentCol).doc(newId).collection(subName);
  for (const doc of snap.docs) {
    batch.set(newRef.doc(doc.id), doc.data());
    batch.delete(oldRef.doc(doc.id));
  }
  await batch.commit();
  return snap.size;
}

async function updateBuildingRefs(oldId, newId) {
  let updated = 0;

  // contact_links.entityId
  const clSnap = await db.collection(COLLECTIONS.CONTACT_LINKS).where('entityId', '==', oldId).get();
  if (!clSnap.empty) {
    const batch = db.batch();
    for (const doc of clSnap.docs) { batch.update(doc.ref, { entityId: newId }); updated++; }
    await batch.commit();
  }

  // projects.buildings / buildingIds arrays
  const pSnap = await db.collection(COLLECTIONS.PROJECTS).get();
  for (const doc of pSnap.docs) {
    const d = doc.data();
    const updates = {};
    if (Array.isArray(d.buildings) && d.buildings.includes(oldId)) {
      updates.buildings = d.buildings.map(id => id === oldId ? newId : id);
    }
    if (Array.isArray(d.buildingIds) && d.buildingIds.includes(oldId)) {
      updates.buildingIds = d.buildingIds.map(id => id === oldId ? newId : id);
    }
    if (Object.keys(updates).length > 0) { await doc.ref.update(updates); updated++; }
  }

  return updated;
}

async function updateContactRefs(oldId, newId) {
  let updated = 0;

  const clSnap = await db.collection(COLLECTIONS.CONTACT_LINKS).where('contactId', '==', oldId).get();
  if (!clSnap.empty) {
    const batch = db.batch();
    for (const doc of clSnap.docs) { batch.update(doc.ref, { contactId: newId }); updated++; }
    await batch.commit();
  }

  const bSnap = await db.collection(COLLECTIONS.BUILDINGS).where('linkedCompanyId', '==', oldId).get();
  if (!bSnap.empty) {
    const batch = db.batch();
    for (const doc of bSnap.docs) { batch.update(doc.ref, { linkedCompanyId: newId }); updated++; }
    await batch.commit();
  }

  const uSnap = await db.collection(COLLECTIONS.UNITS).where('soldTo', '==', oldId).get();
  if (!uSnap.empty) {
    const batch = db.batch();
    for (const doc of uSnap.docs) { batch.update(doc.ref, { soldTo: newId }); updated++; }
    await batch.commit();
  }

  return updated;
}

async function execute(report) {
  let migrated = 0;
  let errors = 0;

  // ── Buildings ──
  for (const bldg of report.buildings) {
    try {
      const oldRef = db.collection(COLLECTIONS.BUILDINGS).doc(bldg.id);
      const snap = await oldRef.get();
      if (!snap.exists) continue;

      await db.collection(COLLECTIONS.BUILDINGS).doc(bldg.newId).set(snap.data());

      let subs = 0;
      for (const sub of BUILDING_SUBCOLLECTIONS) {
        subs += await migrateSubcollection(COLLECTIONS.BUILDINGS, bldg.id, bldg.newId, sub);
      }
      const refs = await updateBuildingRefs(bldg.id, bldg.newId);
      await oldRef.delete();

      console.log(`  ✅ building ${bldg.id} → ${bldg.newId} (${subs} subcol docs, ${refs} refs)`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ building ${bldg.id}: ${err.message}`);
      errors++;
    }
  }

  // ── Contacts ──
  for (const contact of report.contacts) {
    try {
      const oldRef = db.collection(COLLECTIONS.CONTACTS).doc(contact.id);
      const snap = await oldRef.get();
      if (!snap.exists) continue;

      await db.collection(COLLECTIONS.CONTACTS).doc(contact.newId).set(snap.data());
      const refs = await updateContactRefs(contact.id, contact.newId);
      await oldRef.delete();

      console.log(`  ✅ contact ${contact.id} → ${contact.newId} (${contact.type}, ${refs} refs)`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ contact ${contact.id}: ${err.message}`);
      errors++;
    }
  }

  // ── Simple Collections (batch) ──
  const BATCH_LIMIT = 400;
  for (let i = 0; i < report.simple.length; i += BATCH_LIMIT) {
    const chunk = report.simple.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    let batchCount = 0;

    for (const item of chunk) {
      try {
        const oldRef = db.collection(item.collection).doc(item.id);
        const snap = await oldRef.get();
        if (!snap.exists) continue;

        let data = snap.data();
        // Update internal `id` field if present
        if (item.hasInternalId && typeof data.id === 'string') {
          data = { ...data, id: item.newId };
        }

        batch.set(db.collection(item.collection).doc(item.newId), data);
        batch.delete(oldRef);
        batchCount++;
      } catch (err) {
        console.error(`  ❌ ${item.collection} ${item.id}: ${err.message}`);
        errors++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      for (const item of chunk) {
        console.log(`  ✅ ${item.collection} ${item.id} → ${item.newId}`);
      }
      migrated += batchCount;
    }
  }

  return { migrated, errors };
}

// ============================================================================
// MAIN
// ============================================================================

const isDryRun = process.argv.includes('--dry-run');

console.log(isDryRun ? '🔍 DRY-RUN MODE\n' : '🚀 EXECUTE MODE\n');
console.log('Scanning for legacy documents...\n');

const report = await scan();

const total = report.buildings.length + report.contacts.length + report.simple.length;

// Group simple by collection for display
const simpleByCol = {};
for (const s of report.simple) {
  if (!simpleByCol[s.collection]) simpleByCol[s.collection] = [];
  simpleByCol[s.collection].push(s);
}

console.log(`📊 SCAN RESULTS:`);
console.log(`   Buildings:  ${report.buildings.length} legacy`);
console.log(`   Contacts:   ${report.contacts.length} legacy`);
for (const [col, docs] of Object.entries(simpleByCol)) {
  console.log(`   ${col}: ${docs.length} legacy`);
  // Show samples
  for (const d of docs.slice(0, 2)) {
    console.log(`     ${d.id} → ${d.newId}`);
  }
  if (docs.length > 2) console.log(`     ... και ${docs.length - 2} ακόμα`);
}
console.log(`\n   TOTAL: ${total} legacy documents\n`);

if (total === 0) {
  console.log('✅ Δεν βρέθηκαν legacy documents — όλα enterprise IDs!');
  process.exit(0);
}

// ── Fix legacy tenantId in config documents ──
const LEGACY_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';
const ENTERPRISE_COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

const configSnap = await db.collection('config').get();
const legacyTenantDocs = [];
for (const doc of configSnap.docs) {
  const data = doc.data();
  if (data.tenantId === LEGACY_COMPANY_ID) {
    legacyTenantDocs.push({ id: doc.id, collection: 'config' });
  }
}

if (legacyTenantDocs.length > 0) {
  console.log(`\n📋 CONFIG tenantId FIX:`);
  console.log(`   ${legacyTenantDocs.length} documents with legacy tenantId "${LEGACY_COMPANY_ID}"`);
  for (const d of legacyTenantDocs) {
    console.log(`     config/${d.id}`);
  }
  console.log(`   → Will update to "${ENTERPRISE_COMPANY_ID}"\n`);
}

if (isDryRun) {
  console.log('ℹ️  Dry-run complete. Τρέξε χωρίς --dry-run για εκτέλεση.');
  process.exit(0);
}

// ── Execute tenantId fix first ──
if (legacyTenantDocs.length > 0) {
  console.log('Fixing config tenantId...\n');
  const batch = db.batch();
  for (const d of legacyTenantDocs) {
    batch.update(db.collection('config').doc(d.id), { tenantId: ENTERPRISE_COMPANY_ID });
  }
  await batch.commit();
  for (const d of legacyTenantDocs) {
    console.log(`  ✅ config/${d.id} tenantId → ${ENTERPRISE_COMPANY_ID}`);
  }
  console.log('');
}

console.log('Executing migration...\n');
const result = await execute(report);

console.log(`\n${'='.repeat(60)}`);
console.log(`✅ Migration ολοκληρώθηκε!`);
console.log(`   Migrated: ${result.migrated}`);
console.log(`   Errors:   ${result.errors}`);
console.log(`${'='.repeat(60)}`);

process.exit(result.errors > 0 ? 1 : 0);
