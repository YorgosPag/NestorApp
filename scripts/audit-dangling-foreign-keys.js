#!/usr/bin/env node
/**
 * =============================================================================
 * AUDIT DANGLING FOREIGN KEYS — read-only μετρητής ακεραιότητας αναφορών
 * =============================================================================
 *
 * Απαντά **με αριθμούς** τις τρεις ερωτήσεις που κανένας κανόνας δεν μπορεί:
 *
 *   1. Πόσα έγγραφα **δεν έχουν** το ξένο κλειδί που ο κανόνας ανάγνωσης διαβάζει;
 *   2. Πόσα το έχουν αλλά δείχνει σε γονέα **που δεν υπάρχει** (κρεμάμενο);
 *   3. Πόσα **δεν έχουν** το πεδίο μισθωτή που φιλτράρει ο παραγωγικός πελάτης
 *      — δηλαδή είναι **αόρατα** στην εφαρμογή ακόμη κι όταν όλα δουλεύουν;
 *
 * ## Γιατί υπάρχει (ADR-823)
 *
 * Οι κανόνες **δεν μπορούν** να επιβάλουν την παρουσία ή την εγκυρότητα του ξένου
 * κλειδιού: αυτές οι συλλογές γράφονται με `allow create: if false`, δηλαδή **μόνο**
 * από το Admin SDK — που **παρακάμπτει τους κανόνες**. Το σχόλιο *«every production
 * document carries projectId (server writes it)»* είναι **ισχυρισμός χωρίς
 * μηχανισμό**. Αυτό το script είναι ο μηχανισμός μέτρησης.
 *
 * ⚠️ **ΤΙ ΔΕΝ ΕΙΝΑΙ**: δεν είναι φρουρός και δεν διορθώνει τίποτα. **ΜΗΔΕΝ γραφές.**
 * Μετρά ώστε να αποφασίσει άνθρωπος. Αν βγάλει `0`, η μετανάστευση **δεν υπάρχει**.
 *
 * ## Η κλάση παράγεται, δεν αντιγράφεται
 *
 * Οι συλλογές και τα ξένα κλειδιά τους **διαβάζονται από το ίδιο το `firestore.rules`**
 * με τον parser της CHECK 3.16 (`_shared/firestore-rules-parser`). Αν προστεθεί
 * ενδέκατη συλλογή στην κλάση, ο ελεγκτής τη βλέπει **χωρίς αλλαγή κώδικα** — ένας
 * χειρόγραφος πίνακας εδώ θα πάλιωνε σιωπηλά.
 *
 * ## Κόστος
 *
 * Μία σάρωση ανά συλλογή με `.select()` (μόνο τα δύο πεδία που χρειάζονται, όχι
 * ολόκληρα έγγραφα) + **ομαδικές** αναγνώσεις γονέων σε παρτίδες — ποτέ N+1.
 *
 * @module scripts/audit-dangling-foreign-keys
 * @enterprise ADR-823 (ακεραιότητα αναφορών) · ADR-298 (κανόνες) · ADR-284 §3.1
 *
 * USAGE:
 * ```bash
 * CONFIRM_DIAGNOSTICS=true node scripts/audit-dangling-foreign-keys.js
 * CONFIRM_DIAGNOSTICS=true node scripts/audit-dangling-foreign-keys.js --json
 * CONFIRM_DIAGNOSTICS=true node scripts/audit-dangling-foreign-keys.js --collection properties
 * ```
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');
const { parseFirestoreRules } = require('./_shared/firestore-rules-parser');

const SCRIPT_NAME = 'audit-dangling-foreign-keys.js';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RULES_FILE = path.join(PROJECT_ROOT, 'firestore.rules');

/** Το πεδίο μισθωτή που φιλτράρει ο παραγωγικός πελάτης για αυτές τις συλλογές. */
const TENANT_FIELD = 'companyId';

/** Πόσους γονείς ζητάμε μαζί. Το `getAll` του Admin SDK δέχεται άνετα εκατοντάδες. */
const PARENT_BATCH = 250;

/** Πόσα δείγματα id τυπώνονται ανά εύρημα — αρκετά για να ψάξεις, όχι για dump. */
const SAMPLE_LIMIT = 10;

// ---------------------------------------------------------------------------
// Παραγωγή της κλάσης ΑΠΟ ΤΟΥΣ ΚΑΝΟΝΕΣ
// ---------------------------------------------------------------------------

/** Ο βοηθός κανόνων → η συλλογή γονέα που πραγματικά ανοίγει. */
const HELPER_PARENT = {
  belongsToProjectCompany: 'projects',
  belongsToBuildingCompany: 'buildings',
};

/**
 * Κάθε συλλογή της οποίας το `allow read` κρίνει διαβάζοντας **ΞΕΝΟ** έγγραφο
 * μέσω πεδίου του ίδιου του εγγράφου.
 *
 * @param {string} rulesContent
 * @returns {{ collection: string, foreignKey: string, parent: string, line: number }[]}
 */
function deriveForeignKeyClass(rulesContent) {
  const pattern = /belongsTo(?:Project|Building)Company\(resource\.data\.([a-zA-Z0-9_]+)\)/;
  const helperPattern = /(belongsTo(?:Project|Building)Company)\(resource\.data\.[a-zA-Z0-9_]+\)/;
  const out = [];

  for (const block of parseFirestoreRules(rulesContent)) {
    const expr = block.firstAllowReadExpression;
    if (!expr) continue;
    const keyMatch = pattern.exec(expr);
    const helperMatch = helperPattern.exec(expr);
    if (!keyMatch || !helperMatch) continue;
    out.push({
      collection: block.collection,
      foreignKey: keyMatch[1],
      parent: HELPER_PARENT[helperMatch[1]],
      line: block.lineStart,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Σάρωση
// ---------------------------------------------------------------------------

/**
 * Διαβάζει **μόνο** τα δύο πεδία που κρίνουν, ποτέ ολόκληρα έγγραφα.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ collection: string, foreignKey: string }} target
 * @returns {Promise<{ total: number, missingKey: string[], missingTenant: string[], refs: Map<string, string[]> }>}
 */
async function scanCollection(db, target) {
  const snapshot = await db
    .collection(target.collection)
    .select(target.foreignKey, TENANT_FIELD)
    .get();

  const missingKey = [];
  const missingTenant = [];
  /** parentId → τα παιδιά που το δείχνουν */
  const refs = new Map();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const parentId = data[target.foreignKey];
    if (typeof parentId !== 'string' || parentId.trim() === '') {
      missingKey.push(doc.id);
    } else {
      const bucket = refs.get(parentId);
      if (bucket) bucket.push(doc.id);
      else refs.set(parentId, [doc.id]);
    }
    const tenant = data[TENANT_FIELD];
    if (typeof tenant !== 'string' || tenant.trim() === '') {
      missingTenant.push(doc.id);
    }
  });

  return { total: snapshot.size, missingKey, missingTenant, refs };
}

/**
 * Ομαδική επαλήθευση ύπαρξης γονέων — παρτίδες, ποτέ ένα-ένα.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} parentCollection
 * @param {string[]} parentIds
 * @returns {Promise<Set<string>>} όσα ΔΕΝ υπάρχουν
 */
async function findMissingParents(db, parentCollection, parentIds) {
  const missing = new Set();
  for (let i = 0; i < parentIds.length; i += PARENT_BATCH) {
    const chunk = parentIds.slice(i, i + PARENT_BATCH);
    const refs = chunk.map((id) => db.collection(parentCollection).doc(id));
    const docs = await db.getAll(...refs);
    docs.forEach((doc, idx) => {
      if (!doc.exists) missing.add(chunk[idx]);
    });
  }
  return missing;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ collection: string, foreignKey: string, parent: string, line: number }} target
 */
async function auditTarget(db, target) {
  const scan = await scanCollection(db, target);
  const missingParents = await findMissingParents(db, target.parent, [...scan.refs.keys()]);

  const dangling = [];
  for (const parentId of missingParents) {
    for (const childId of scan.refs.get(parentId)) {
      dangling.push({ childId, parentId });
    }
  }

  return {
    collection: target.collection,
    rulesLine: target.line,
    foreignKey: target.foreignKey,
    parentCollection: target.parent,
    total: scan.total,
    missingForeignKey: scan.missingKey,
    danglingForeignKey: dangling,
    missingTenantField: scan.missingTenant,
    distinctMissingParents: [...missingParents],
  };
}

// ---------------------------------------------------------------------------
// Αναφορά
// ---------------------------------------------------------------------------

function sample(ids) {
  const shown = ids.slice(0, SAMPLE_LIMIT).join(', ');
  return ids.length > SAMPLE_LIMIT ? `${shown}, … (+${ids.length - SAMPLE_LIMIT})` : shown;
}

/** @param {Awaited<ReturnType<typeof auditTarget>>[]} results */
function printHuman(results) {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' ΑΚΕΡΑΙΟΤΗΤΑ ΑΝΑΦΟΡΩΝ — ΜΟΝΟ ΑΝΑΓΝΩΣΗ, ΚΑΜΙΑ ΓΡΑΦΗ (ADR-823)');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('| συλλογή | γρ. | έγγραφα | λείπει κλειδί | ΚΡΕΜΑΜΕΝΟ | λείπει companyId |');
  console.log('|---|---|---|---|---|---|');

  for (const r of results) {
    console.log(
      `| ${r.collection} | ${r.rulesLine} | ${r.total} | ${r.missingForeignKey.length} | ` +
        `${r.danglingForeignKey.length} | ${r.missingTenantField.length} |`,
    );
  }

  const findings = results.filter(
    (r) => r.missingForeignKey.length || r.danglingForeignKey.length || r.missingTenantField.length,
  );

  if (findings.length === 0) {
    console.log('');
    console.log('✅ ΜΗΔΕΝ ευρήματα. Καμία μετανάστευση δεδομένων δεν χρειάζεται.');
    console.log('   (Το `0` εδώ σημαίνει «μετρήθηκε», όχι «δεν κοίταξε κανείς»:');
    console.log('    η σάρωση διάβασε κάθε έγγραφο κάθε συλλογής της κλάσης.)');
    return;
  }

  console.log('');
  console.log('──────────────────────── ΛΕΠΤΟΜΕΡΕΙΕΣ ────────────────────────');
  for (const r of findings) {
    console.log('');
    console.log(`▶ ${r.collection}  (${r.foreignKey} → ${r.parentCollection})`);
    if (r.missingForeignKey.length) {
      console.log(`   • ΛΕΙΠΕΙ ${r.foreignKey} σε ${r.missingForeignKey.length}: ${sample(r.missingForeignKey)}`);
    }
    if (r.danglingForeignKey.length) {
      console.log(`   • ΚΡΕΜΑΜΕΝΟ ${r.foreignKey} σε ${r.danglingForeignKey.length} έγγραφα,`);
      console.log(`     προς ${r.distinctMissingParents.length} ανύπαρκτους γονείς: ${sample(r.distinctMissingParents)}`);
      console.log(`     παιδιά: ${sample(r.danglingForeignKey.map((d) => d.childId))}`);
      console.log(`     ⚠️ ΣΥΝΕΠΕΙΑ: ερώτημα κατά ${r.foreignKey} σε αυτούς τους γονείς ΑΠΟΡΡΙΠΤΕΤΑΙ.`);
    }
    if (r.missingTenantField.length) {
      console.log(`   • ΛΕΙΠΕΙ ${TENANT_FIELD} σε ${r.missingTenantField.length}: ${sample(r.missingTenantField)}`);
      console.log(`     ⚠️ ΣΥΝΕΠΕΙΑ: ΑΟΡΑΤΑ στο παραγωγικό ερώτημα (φιλτράρει ${TENANT_FIELD}).`);
    }
  }
  console.log('');
  console.log('⚠️ ΜΗΝ διορθώσεις τυφλά. Κάθε γραμμή θέλει απόφαση: διαγραφή ορφανού,');
  console.log('   επανασύνδεση σε σωστό γονέα, ή συμπλήρωση του companyId από τον γονέα.');
  console.log('   Επινοημένη τιμή ΑΠΑΓΟΡΕΥΕΤΑΙ — «δεν ξέρω» δεν γράφεται ως κωδικός.');
}

// ---------------------------------------------------------------------------
// Είσοδος
// ---------------------------------------------------------------------------

function requireOptIn() {
  if (process.env.CONFIRM_DIAGNOSTICS === 'true') return;
  console.error('');
  console.error(`❌ [${SCRIPT_NAME}] SECURITY: CONFIRM_DIAGNOSTICS=true is required`);
  console.error('');
  console.error('   Το script σαρώνει ΟΛΑ τα έγγραφα δέκα συλλογών παραγωγής.');
  console.error('   Είναι ΜΟΝΟ ΑΝΑΓΝΩΣΗ — δεν γράφει ποτέ τίποτα.');
  console.error('');
  console.error(`   Χρήση:  CONFIRM_DIAGNOSTICS=true node scripts/${SCRIPT_NAME}`);
  console.error('');
  process.exit(1);
}

function initAdmin() {
  const envVars = loadEnvLocal();
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log(`✅ [${SCRIPT_NAME}] Firebase Admin initialized — project ${serviceAccount.project_id}`);
}

async function main() {
  requireOptIn();

  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const onlyIdx = argv.indexOf('--collection');
  const only = onlyIdx === -1 ? null : argv[onlyIdx + 1];

  let targets = deriveForeignKeyClass(fs.readFileSync(RULES_FILE, 'utf8'));
  if (only) targets = targets.filter((t) => t.collection === only);

  if (targets.length === 0) {
    console.error(`❌ [${SCRIPT_NAME}] Καμία συλλογή προς έλεγχο${only ? ` (--collection ${only})` : ''}.`);
    process.exit(1);
  }

  initAdmin();
  const db = admin.firestore();

  console.log(`🔍 [${SCRIPT_NAME}] Κλάση παραγμένη από firestore.rules: ${targets.length} συλλογές`);

  const results = [];
  for (const target of targets) {
    process.stdout.write(`   … ${target.collection}`);
    results.push(await auditTarget(db, target));
    process.stdout.write('\n');
  }

  if (asJson) console.log(JSON.stringify({ generatedFrom: 'firestore.rules', results }, null, 2));
  else printHuman(results);

  process.exit(0);
}

// ⚠️ Ο φρουρός `require.main` υπάρχει ώστε η **άγκυρα** να μπορεί να **ΕΚΤΕΛΕΣΕΙ** την
// `deriveForeignKeyClass` χωρίς να ανοίξει σύνδεση με την παραγωγή. Χωρίς αυτόν, το
// μόνο που θα μπορούσε να ελέγξει ένα test είναι το **κείμενο** του αρχείου — δηλαδή
// «η συνάρτηση είναι ΓΡΑΜΜΕΝΗ», ποτέ «η συνάρτηση ΔΟΥΛΕΥΕΙ».
if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ [${SCRIPT_NAME}]`, error && error.message ? error.message : error);
    process.exit(1);
  });
}

module.exports = { deriveForeignKeyClass, TENANT_FIELD };
