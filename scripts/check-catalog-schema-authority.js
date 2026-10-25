#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.106 — Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΟΥ ΣΧΗΜΑΤΟΣ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.9)
 * =============================================================================
 *
 * «Γράφει κάποιος σχήμα καταλόγου (ιδιότητα · ομάδα · οικογένεια μέτρησης · κατηγορία · οικογένεια) ΕΞΩ από
 *  τη μηχανή αποθήκευσης — δηλαδή χωρίς επικύρωση απέναντι στη βιβλιοθήκη, χωρίς CAS, χωρίς ίχνος;»
 *
 * 🔑 ΓΙΑΤΙ: οι κανόνες Firestore κλείνουν τον ΠΕΛΑΤΗ (`allow write: if false`), όχι τον Admin SDK. Ένα δεύτερο
 * `db.collection(COLLECTIONS.CATALOG_FAMILIES).doc(x).set(…)` στον διακομιστή θα έγραφε οικογένεια που δείχνει σε
 * ιδιότητα που δεν υπάρχει, θα ξεκλείδωνε αλλαγή τύπου σε χρησιμοποιημένη ιδιότητα (παράγωγο `attributeIds`
 * εκτός συγχρονισμού) ή θα έσπαγε το `ancestorIds` ενός κλάδου — και κανείς δεν θα το μάθαινε (χωρίς ίχνος).
 * Ίδια οικογένεια με CHECK 3.87 · 3.88 · 3.89 · 3.102.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ ───────────────────────────────────────────────────────────────────────────
 *  Κ1 εγγραφή (`set/update/create/delete` · `setDoc/updateDoc/deleteDoc/addDoc`) σε `COLLECTIONS.CATALOG_*`
 *     ΜΟΝΟ στη μηχανή αποθήκευσης
 *  Κ2 η αναφορά εγγράφου της μηχανής (`catalogDocRef(`) ΜΟΝΟ στα δηλωμένα αρχεία — αλλιώς είναι πόρτα γύρω από Κ1
 *  Κ3 εξαίρεση ΜΟΝΟ με λόγο (`// catalog-schema-authority-exempt: <λόγος>` στη γραμμή πάνω)
 *  Κ4 καλωδίωση: η μηχανή ΟΝΤΩΣ κάνει συναλλαγή + ίχνος, κάθε γραφέας ΟΝΤΩΣ περνά από τη συναλλαγή της
 *  Κ5 η πόρτα απευθείας εγγραφής (MCP `WRITE_ALLOWED_COLLECTIONS`) μένει ΚΛΕΙΣΤΗ για κάθε `catalog_*`
 *  Κ6 (Φάση 2β, ADR-923 §5.10 Θωράκιση 1) ο ΜΟΝΟΣ δρόμος για παράγωγα (`stageDerived`) γράφει ΜΟΝΟ `derived`:
 *     (α) το σώμα του δεν αγγίζει αναθεώρηση / σφραγίδα / ίχνος (αλλιώς κάθε επανυπολογισμός = ψευδή 409 + ψεύτικο
 *     ιστορικό), (β) τον καλεί ΜΟΝΟ η μηχανή του συνόλου (αλλιώς είναι πόρτα που γράφει χωρίς κρίση του συνόλου)
 *
 * @see ADR-923 §5.9 · docs/gates/3.106.md · αδελφή: CHECK 3.102
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ast = require('./lib/write-authority/ast');
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const { ts, PROJECT_ROOT } = ast;

const CATALOG_COLLECTIONS = [
  'COLLECTIONS.CATALOG_ATTRIBUTES',
  'COLLECTIONS.CATALOG_ATTRIBUTE_GROUPS',
  'COLLECTIONS.CATALOG_MEASUREMENT_FAMILIES',
  'COLLECTIONS.CATALOG_CATEGORIES',
  'COLLECTIONS.CATALOG_FAMILIES',
  // Φάση 2β (ADR-923 §5.10) — τα δεδομένα
  'COLLECTIONS.CATALOG_PRODUCT_MODELS',
  'COLLECTIONS.CATALOG_PRODUCTS',
  'COLLECTIONS.CATALOG_ASSETS',
  'COLLECTIONS.CATALOG_SETTINGS',
  'COLLECTIONS.CATALOG_UNIQUE_VALUES',
];
/** Τα ονόματα των συλλογών στη βάση — για την πόρτα του MCP (Κ5). */
const CATALOG_COLLECTION_NAMES = [
  'catalog_attributes', 'catalog_attribute_groups', 'catalog_measurement_families', 'catalog_categories', 'catalog_families',
  'catalog_product_models', 'catalog_products', 'catalog_assets', 'catalog_settings', 'catalog_unique_values',
];

const STORE = 'src/server/catalog/catalog-store.server.ts';
const LIBRARY_READS = 'src/server/catalog/catalog-library-reads.server.ts';
const KINDS = 'src/server/catalog/catalog-kinds.ts';
const DIRECT_WRITE_DOOR = 'mcp-server/src/security/access-control.ts';

const UNIQUE_RESERVATIONS = 'src/server/catalog/unique-reservations.server.ts';
const AGGREGATE = 'src/server/catalog/catalog-aggregate.server.ts';

/** Ποια αρχεία επιτρέπεται να καλούν `catalogDocRef(` (Κ2) — η μηχανή γράφει, οι αναγνώσεις διαβάζουν. */
const DOC_REF_USERS = new Set([STORE, LIBRARY_READS]);
/** Οι αναφορές εγγράφου της μηχανής (Κ2) → ποια αρχεία τις καλούν. Η κράτηση διαβάζεται μόνο από τον σχεδιαστή της. */
const DOC_REF_FUNCTIONS = { catalogDocRef: DOC_REF_USERS, uniqueValueRef: new Set([STORE, UNIQUE_RESERVATIONS]) };
/** Ποιος καλεί τον δρόμο των παραγώγων (Κ6β): μόνο η μηχανή του συνόλου, που κρίνει το σύνολο πριν γράψει. */
const DERIVED_USERS = new Set([STORE, AGGREGATE]);
/** Ό,τι το σώμα του `stageDerived` ΔΕΝ πρέπει να αγγίζει (Κ6α). */
const DERIVED_FORBIDDEN = ['revision', 'updatedAt', 'updatedBy', 'changes.push', 'recordTrackedEntityWrite'];

/** Κάθε δηλωμένος γραφέας, με το πώς ΑΠΟΔΕΙΚΝΥΕΙ ότι περνά από τη μηχανή (Κ4). Κλειστό σύνολο. */
const WIRING = {
  [STORE]: ['runTransaction(', 'recordTrackedEntityWrite('],
  'src/server/catalog/attribute-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/attribute-group-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/measurement-family-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/category-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/family-writer.server.ts': ['runCatalogTransaction('],
  // Φάση 2β — δεδομένα: κάθε γραφέας στη συναλλαγή· η μηχανή του συνόλου κρίνει, κρατά και γράφει παράγωγα.
  'src/server/catalog/product-model-writer.server.ts': ['runCatalogTransaction(', 'commitAggregate('],
  'src/server/catalog/product-writer.server.ts': ['runCatalogTransaction(', 'commitAggregate('],
  'src/server/catalog/asset-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/catalog-settings-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/completeness-recompute.server.ts': ['runCatalogTransaction(', 'commitAggregate('],
  [AGGREGATE]: ['judgeAggregate(', 'planUniqueReservations(', 'stageReservationPlan(', 'stageDerived('],
  [KINDS]: CATALOG_COLLECTIONS.filter((key) => key !== 'COLLECTIONS.CATALOG_UNIQUE_VALUES'),
};

const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete']);
const CLIENT_WRITES = new Set(['setDoc', 'updateDoc', 'deleteDoc', 'addDoc']);
const exemptions = ast.exemptionsFor('catalog-schema-authority-exempt');

const STATES = {
  STORE: 'declared-store',
  EXEMPT: 'exempt-with-reason',
  WRITE_OUTSIDE: 'catalog-write-outside-store',
  DOC_REF_OUTSIDE: 'catalog-doc-ref-outside-declared',
  STORE_UNASKED: 'store-unasked',
  DIRECT_DOOR_OPEN: 'direct-write-door-open',
  EXEMPT_NO_REASON: 'exempt-without-reason',
  SOURCE_DRIFT: 'source-drift',
  DERIVED_TRACKED: 'derived-path-tracked',
  DERIVED_OUTSIDE: 'derived-write-outside-aggregate',
};
const BLOCKING = [
  STATES.WRITE_OUTSIDE, STATES.DOC_REF_OUTSIDE, STATES.STORE_UNASKED, STATES.DIRECT_DOOR_OPEN,
  STATES.EXEMPT_NO_REASON, STATES.SOURCE_DRIFT, STATES.DERIVED_TRACKED, STATES.DERIVED_OUTSIDE,
];
const DETAIL = {
  [STATES.WRITE_OUTSIDE]: `γράφει σχήμα καταλόγου έξω από τη μηχανή — πέρασε από τους γραφείς του \`src/server/catalog/\` (${STORE})`,
  [STATES.DOC_REF_OUTSIDE]: 'αναφορά εγγράφου της μηχανής (`catalogDocRef(`/`uniqueValueRef(`) εκτός δηλωμένων αρχείων — πόρτα γύρω από τη μηχανή',
  [STATES.DERIVED_OUTSIDE]: '`stageDerived(` εκτός μηχανής συνόλου — γράφει παράγωγα χωρίς να κρίνει το σύνολο (Κ6β)',
};

/** Γράφει αυτή η κλήση σε συλλογή καταλόγου; */
function isCatalogWrite(call, refsByKey) {
  const callee = call.expression;
  const touches = (expression) => CATALOG_COLLECTIONS.some((key) => ast.refersTo(expression, refsByKey.get(key), key));
  if (ts.isIdentifier(callee) && CLIENT_WRITES.has(callee.text)) return touches(call.arguments[0]);
  if (!ts.isPropertyAccessExpression(callee) || !WRITE_METHODS.has(callee.name.text)) return false;
  return touches(callee.expression) || touches(call.arguments[0]);
}

function classify(sf, node, rel, state) {
  const reason = exemptions.reasonAbove(sf, node);
  if (reason === null) return { state, file: rel, line: ast.lineOf(sf, node), detail: DETAIL[state] };
  return reason.length > 0
    ? { state: STATES.EXEMPT, file: rel }
    : { state: STATES.EXEMPT_NO_REASON, file: rel, line: ast.lineOf(sf, node), detail: 'εξαίρεση ΧΩΡΙΣ λόγο' };
}

/** Κ1 + Κ2 + Κ3 για ένα αρχείο. */
function findingsIn(sf, rel) {
  if (rel === STORE) return [{ state: STATES.STORE, file: rel }];
  const refsByKey = new Map(CATALOG_COLLECTIONS.map((key) => [key, ast.refIdentifiersOf(sf, key)]));
  const findings = [];
  ast.walk(sf, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (isCatalogWrite(node, refsByKey)) findings.push(classify(sf, node, rel, STATES.WRITE_OUTSIDE));
    else if (Object.entries(DOC_REF_FUNCTIONS).some(([fn, users]) => ast.isCallTo(node, fn) && !users.has(rel))) {
      findings.push(classify(sf, node, rel, STATES.DOC_REF_OUTSIDE));
    } else if (ast.isCallTo(node, 'stageDerived') && !DERIVED_USERS.has(rel)) {
      findings.push(classify(sf, node, rel, STATES.DERIVED_OUTSIDE));
    }
  });
  return findings;
}

/** Είναι κάποια `catalog_*` μέλος του συνόλου εγγραφής του MCP; (AST: σχόλιο που την ονομάζει δεν μετρά.) */
function directDoorOpen(text) {
  const sf = ast.sourceFileOf(DIRECT_WRITE_DOOR, text);
  let open = false;
  ast.walk(sf, (node) => {
    if (!ts.isVariableDeclaration(node) || node.name.getText() !== 'WRITE_ALLOWED_COLLECTIONS' || !node.initializer) return;
    ast.walk(node.initializer, (member) => {
      if (ts.isStringLiteral(member) && CATALOG_COLLECTION_NAMES.includes(member.text)) open = true;
    });
  });
  return open;
}

/** Κ6α: το σώμα του `stageDerived` (χωρίς σχόλια) — γράφει ΜΟΝΟ `derived`, χωρίς αναθεώρηση/σφραγίδα/ίχνος. */
function derivedPathFindings(storeText) {
  const sf = ast.sourceFileOf(STORE, storeText);
  let body = null;
  ast.walk(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text === 'stageDerived' && node.body) body = node.body;
  });
  if (body === null) return [{ state: STATES.STORE_UNASKED, file: STORE, detail: 'λείπει ο δρόμος των παραγώγων `stageDerived` (Κ6α)' }];
  const code = ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, body, sf);
  const touched = DERIVED_FORBIDDEN.filter((token) => code.includes(token));
  return touched.length === 0 ? [] : [{ state: STATES.DERIVED_TRACKED, file: STORE,
    detail: `το \`stageDerived\` αγγίζει ${touched.join(' · ')} — ο επανυπολογισμός θα έδινε ψευδή 409 / ψεύτικο ιστορικό (Κ6α)` }];
}

/** Κ4 + Κ5 + Κ6α + ύπαρξη δηλωμένων αρχείων. */
function wiringFindings(root) {
  const findings = [];
  const read = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : null);
  for (const [file, proofs] of Object.entries(WIRING)) {
    const text = read(file);
    if (text === null) {
      findings.push({ state: STATES.SOURCE_DRIFT, file, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
      continue;
    }
    const missing = proofs.filter((proof) => !text.includes(proof));
    if (missing.length > 0) {
      findings.push({ state: STATES.STORE_UNASKED, file, detail: `δεν περνά από τη μηχανή (λείπει: ${missing.join(' · ')})` });
    }
  }
  const store = read(STORE);
  if (store !== null) findings.push(...derivedPathFindings(store));
  const door = read(DIRECT_WRITE_DOOR);
  if (door === null) findings.push({ state: STATES.SOURCE_DRIFT, file: DIRECT_WRITE_DOOR, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
  else if (directDoorOpen(door)) {
    findings.push({ state: STATES.DIRECT_DOOR_OPEN, file: DIRECT_WRITE_DOOR,
      detail: 'συλλογή `catalog_*` στο `WRITE_ALLOWED_COLLECTIONS` — απευθείας εγγραφή παρακάμπτει τη μηχανή' });
  }
  return findings;
}

const RELEVANT = /COLLECTIONS\.CATALOG_|catalogDocRef\(|uniqueValueRef\(|stageDerived\(/;

function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const files = (opts.codeFiles || collectSourceFiles(root, ['src'])).filter((f) => !/__tests__|\.test\.|\.spec\./.test(f));
  if (!opts.codeFiles && files.length < 1000) throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία — η σάρωση δεν κοίταξε`);
  const findings = [];
  for (const abs of files) {
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!RELEVANT.test(text)) continue;
    findings.push(...findingsIn(ast.sourceFileOf(abs, text), toPosix(path.relative(root, abs))));
  }
  findings.push(...(opts.skipWiring ? [] : wiringFindings(root)));
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, findings.filter((f) => f.state === s).length]));
  return { findings, tally, examined: files.length };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('🗂️  CHECK 3.106 — Πύλη του ενός γραφέα του καταλόγου — σχήμα και δεδομένα (ADR-923 §5.9 · §5.10)');
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(40)} ${tally[s]}`);
  for (const s of [STATES.STORE, STATES.EXEMPT]) log(`   ✅ ${s.padEnd(40)} ${tally[s]}`);
  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  for (const f of blocking) log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.detail}`);
  if (blocking.length) {
    log('\n   ΘΕΡΑΠΕΙΑ: κάθε εγγραφή σχήματος → γραφέας στο `src/server/catalog/` → `runCatalogTransaction` + `stage*`.');
    log('   ⚠️ ΜΗΝ προσθέσεις αρχείο στο DOC_REF_USERS «επειδή βολεύει»: κάθε τέτοιο αρχείο είναι πόρτα γύρω από την επικύρωση.');
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_CATALOG_SCHEMA_AUTHORITY === '1') {
    console.log('⏭️  CHECK 3.106 παραλείφθηκε (SKIP_CATALOG_SCHEMA_AUTHORITY=1)');
    return 0;
  }
  const blocking = report(measure());
  console.log(blocking > 0
    ? `\n❌ CHECK 3.106 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)\n`
    : '\n✅ CHECK 3.106 — κάθε εγγραφή σχήματος καταλόγου περνά από τη μηχανή\n');
  return blocking > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, findingsIn, wiringFindings, directDoorOpen, derivedPathFindings,
  STATES, BLOCKING, WIRING, STORE, AGGREGATE, DOC_REF_USERS, DIRECT_WRITE_DOOR, CATALOG_COLLECTIONS,
};
