#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.87 — Η ΠΥΛΗ ΤΗΣ ΑΡΧΗΣ ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ CDE (ADR-862 Φ0 Β12)
 * =============================================================================
 *
 * «Γράφει κάποιος την κατάσταση CDE ενός αρχείου ΕΞΩ από τον ΕΝΑ γραφέα — και διαβάζει
 *  κάποια client λίστα `files` ΧΩΡΙΣ τον φράχτη ανάγνωσης;»
 *
 * 🔴 ΓΙΑΤΙ (μετρημένο 2026-09-16/17): πριν τη Φ0 το `cdeState` ήταν ελεύθερο dropdown και ο
 * `supersedeFileRecord` έγραφε κατάσταση με client SDK. Οι κανόνες (`cdeCustodyUnchanged`)
 * κλείνουν πλέον τον **πελάτη** — αλλά **ΟΧΙ** το Admin SDK: ένας δεύτερος γραφέας στον
 * διακομιστή θα περνούσε κάθε κανόνα. Αυτή η πύλη κλείνει ό,τι ο κανόνας δομικά δεν βλέπει.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ (κάθε ένα δική του γραμμή — ποτέ «ή», μάθημα 3.41) ─────────────────────
 *  Κ1 γραφή πεδίου φύλαξης (η λίστα διαβάζεται από το `cdeCustodyKeys()` του
 *     firestore.rules — ΜΙΑ πηγή) σε όρισμα κλήσης εγγραφής, εκτός δηλωμένου γραφέα
 *  Κ2 ο κριτής (`decideContainerAccess`) και ο PEP (`container-visibility-guard`) έχουν
 *     καταναλωτές — αλλιώς «πράσινο επειδή κανείς δεν κρίνει»
 *  Κ3 δεύτερη σημαία έγκρισης σε αρχεία (`isForConstruction` · `approvedForBuild` …)
 *  Κ4 κάθε κατάσταση του `CDE_STATES` έχει γραμμή σε `AUDIENCE_REACH` ΚΑΙ `READ_REACH_BY_STATE`
 *  Κ5 client λίστα `files` (`collection(db, …FILES)`) χωρίς τον παραγωγό ορατότητας
 *
 * ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ: τα θεραπευμένα αρχεία κουβαλούν σχόλια που ΟΝΟΜΑΖΟΥΝ τα πεδία.
 * ⚠️ «ΓΡΑΦΗ» = αντικείμενο που φτάνει σε `.set/.update/.create/setDoc/updateDoc` (άμεσα ή
 *    μέσω μεταβλητής του ίδιου αρχείου). Το `supersededByFileId` είναι ΚΑΙ παράμετρος
 *    αιτήματος προς τον γραφέα και ωφέλιμο φορτίο γεγονότος — μετρημένα 9 τέτοια σημεία,
 *    κανένα γραφή. Σαρωτής κλειδιών θα κοκκίνιζε στους ΚΑΤΑΝΑΛΩΤΕΣ του γραφέα.
 * 🔓 Εξαίρεση ΜΟΝΟ με λόγο, στη γραμμή πάνω: `// cde-authority-exempt: <λόγος>`.
 *
 * @see ADR-862 Φ0 Β12 · docs/gates/3.87.md
 */

'use strict';

const path = require('path');

const ast = require('./lib/write-authority/ast');
const { openGateInput } = require('./lib/gate-input');
const { toPosix } = require('./lib/module-graph/resolve-specifier');
const { scanScope, tallyOf, gateEntry } = require('./lib/write-authority/gate-runner');

const { ts, PROJECT_ROOT, sourceFileOf, lineOf } = ast;
const { rulesKeyListOf } = require('./_shared/firestore-rules-parser');

/** Ο ΕΝΑΣ γραφέας κατάστασης — γράφει κάθε πεδίο φύλαξης. */
const STATE_WRITER = 'src/services/iso19650/container-transitions.ts';

/** Οι γραφείς της ΓΕΝΝΗΣΗΣ — γράφουν ΜΟΝΟ τον φράχτη ανάγνωσης, πάντα `BIRTH_READ_REACH`. */
const BIRTH_WRITERS = {
  cdeReadReach: [
    'src/services/file-record/file-record-core.ts',
    'src/services/file-record/file-record-ingestion.ts',
    'src/app/api/cad-files/dual-write-to-files.ts',
    'src/app/api/quotes/scan/quote-file-record-writer.ts',
  ],
};

const JUDGE_FILE = 'src/lib/auth/container-access.ts';
const PEP_FILE = 'src/lib/auth/container-visibility-guard.ts';
const READ_REACH_FILE = 'src/lib/auth/container-read-reach.ts';
const STATES_FILE = 'src/config/iso19650-constants.ts';
const VISIBILITY_SCOPE_MODULE = 'lib/files/file-visibility-scope';

const WRITE_METHODS = new Set(['set', 'update', 'create']);
const WRITE_FUNCTIONS = new Set(['setDoc', 'updateDoc']);
const SECOND_FLAG = /^(is)?(ForConstruction|forConstruction|ApprovedForBuild|approvedForBuild|ApprovedForConstruction)$/;
// ADR-866 §2.6.7 — ΚΑΙ το προσωπικό διαμέρισμα: `COLLECTIONS.FILES\b` δεν πιάνει το `FILES_PERSONAL`
// (το `_` είναι χαρακτήρας λέξης ⇒ κανένα όριο), άρα γραφέας που αναφέρει ΜΟΝΟ το προσωπικό
// διαμέρισμα ή το `FILE_COLLECTION[kind]` θα ήταν αόρατος στο Κ1.
const FILES_REFERENCE = /COLLECTIONS\.FILES(?:_PERSONAL)?\b|['"]FILES(?:_PERSONAL)?['"]|\bFILE_COLLECTION\b|collection\(\s*db\s*,\s*['"]files(?:_personal)?['"]/;
// Κ5 — client λίστα αρχείων: literal ή διαμέρισμα κατόχου (ο εταιρικός κλάδος θέλει φράχτη).
const FILES_LIST_TARGET = /collection\(\s*db\s*,\s*(COLLECTIONS\.FILES\b|['"]files['"]|COLLECTIONS\[\s*FILE_COLLECTION\[[^\]]*\]\s*\])\s*\)/;
const exemptions = ast.exemptionsFor('cde-authority-exempt');

const STATES = {
  WRITER: 'writer',
  BIRTH: 'birth',
  EXEMPT: ast.EXEMPTION_STATES.EXEMPT,
  JUDGE_CONSUMERS: 'judge-consumers',
  SCOPED_LISTS: 'scoped-client-lists',
  SECOND_WRITER: 'second-writer',
  EXEMPT_NO_REASON: ast.EXEMPTION_STATES.EXEMPT_NO_REASON,
  UNJUDGED: 'judge-without-consumers',
  SECOND_FLAG: 'second-approval-flag',
  TABLE_GAP: 'state-without-row',
  UNSCOPED_LIST: 'unscoped-client-list',
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [
  STATES.SECOND_WRITER, STATES.EXEMPT_NO_REASON, STATES.UNJUDGED,
  STATES.SECOND_FLAG, STATES.TABLE_GAP, STATES.UNSCOPED_LIST, STATES.SOURCE_DRIFT,
];

/** Κ1 — τα πεδία φύλαξης, από το καθολικό `cdeCustodyKeys()` του firestore.rules (ADR-866 §5.2). */
function custodyFieldsOf(rulesText) {
  return rulesKeyListOf(rulesText, 'cdeCustodyKeys');
}

/** Είναι αυτό το αντικείμενο όρισμα κλήσης εγγραφής (άμεσα ή μέσω μεταβλητής); */
function writeTargetsIn(sf) {
  const objects = new Set();
  const identifiers = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isWrite = (ts.isPropertyAccessExpression(callee) && WRITE_METHODS.has(callee.name.text))
        || (ts.isIdentifier(callee) && WRITE_FUNCTIONS.has(callee.text));
      if (isWrite) {
        for (const arg of node.arguments) {
          if (ts.isObjectLiteralExpression(arg)) objects.add(arg);
          if (ts.isIdentifier(arg)) identifiers.add(arg.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && identifiers.has(node.name.text)
      && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      objects.add(node.initializer);
    }
    ts.forEachChild(node, collect);
  };
  collect(sf);
  return objects;
}

/** Ανήκει το κλειδί (σε οποιοδήποτε βάθος) σε αντικείμενο που γράφεται; */
function isWritten(node, targets) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isObjectLiteralExpression(current) && targets.has(current)) return true;
  }
  return false;
}


/** Κ1 + Κ3 για ένα αρχείο. */
function custodyFindingsIn(sf, rel, fields) {
  const findings = [];
  const targets = writeTargetsIn(sf);
  const visit = (node) => {
    const named = (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)
      || ts.isPropertySignature(node)) && node.name && ts.isIdentifier(node.name);
    const key = named ? node.name.text : null;
    if (key && SECOND_FLAG.test(key)) {
      findings.push({ state: STATES.SECOND_FLAG, file: rel, line: lineOf(sf, node),
        detail: `δεύτερη σημαία έγκρισης «${key}» — η έγκριση ΕΙΝΑΙ η κατάσταση PUBLISHED` });
    }
    if (key && fields.includes(key) && !ts.isPropertySignature(node) && isWritten(node, targets)) {
      findings.push(classifyWrite(sf, node, rel, key));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

function classifyWrite(sf, node, rel, key) {
  if (rel === STATE_WRITER) return { state: STATES.WRITER, file: rel };
  if ((BIRTH_WRITERS[key] || []).includes(rel)) return { state: STATES.BIRTH, file: rel };
  return exemptions.classify(sf, node, rel, STATES.SECOND_WRITER,
    `γράφει «${key}» — η κατάσταση CDE αλλάζει ΜΟΝΟ από τον γραφέα (${STATE_WRITER})`);
}

/** Κ5 — client λίστα `files` χωρίς τον παραγωγό ορατότητας. */
function unscopedListIn(text, rel) {
  if (/['"]server-only['"]|firebase-admin|getAdminFirestore/.test(text)) return null;
  const directList = FILES_LIST_TARGET.test(text)
    && /\b(getDocs|onSnapshot|query)\(/.test(text);
  if (!directList || text.includes(VISIBILITY_SCOPE_MODULE)) return directList ? { state: STATES.SCOPED_LISTS, file: rel } : null;
  return { state: STATES.UNSCOPED_LIST, file: rel,
    detail: 'client λίστα `files` χωρίς `fileListReadPaths`/`fileListVisibilityConstraints` — ο κανόνας `list` την απορρίπτει ΟΛΟΚΛΗΡΗ' };
}

/** Κ4 — τα κλειδιά μιας object literal μεταβλητής (και των εμφωλευμένων της). */
function objectKeysOf(sf, variableName) {
  let found = null;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName) {
      let init = node.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) init = init.expression;
      if (init && ts.isObjectLiteralExpression(init)) found = init;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const keysOf = (literal) => (literal ? literal.properties.filter((p) => p.name).map((p) => p.name.getText()) : []);

function tableGaps(root, input = openGateInput({ root })) {
  // Αρχείο που λείπει από την όψη ⇒ κενό AST ⇒ «δεν διαβάστηκε» (SOURCE_DRIFT), ποτέ σιωπή.
  const read = (rel) => sourceFileOf(path.join(input.root, rel), input.read(rel) || '');
  const states = keysOf(objectKeysOf(read(STATES_FILE), 'CDE_STATES'));
  if (states.length === 0) return [{ state: STATES.SOURCE_DRIFT, file: STATES_FILE, detail: 'το CDE_STATES δεν διαβάστηκε' }];
  const findings = [];
  const audience = objectKeysOf(read(JUDGE_FILE), 'AUDIENCE_REACH');
  for (const row of audience ? audience.properties : []) {
    const missing = states.filter((s) => !keysOf(row.initializer).includes(s));
    if (missing.length) findings.push({ state: STATES.TABLE_GAP, file: JUDGE_FILE, detail: `AUDIENCE_REACH.${row.name.getText()} χωρίς: ${missing.join(' · ')}` });
  }
  const reach = keysOf(objectKeysOf(read(READ_REACH_FILE), 'READ_REACH_BY_STATE'));
  const missingReach = states.filter((s) => !reach.includes(s));
  if (missingReach.length) findings.push({ state: STATES.TABLE_GAP, file: READ_REACH_FILE, detail: `READ_REACH_BY_STATE χωρίς: ${missingReach.join(' · ')}` });
  if (!audience) findings.push({ state: STATES.SOURCE_DRIFT, file: JUDGE_FILE, detail: 'το AUDIENCE_REACH δεν διαβάστηκε' });
  return findings;
}

function measure(opts = {}) {
  const { root, input, files } = scanScope(opts, PROJECT_ROOT);
  const fields = custodyFieldsOf(input.read('firestore.rules') || '');
  const findings = [];
  if (fields.length === 0) findings.push({ state: STATES.SOURCE_DRIFT, file: 'firestore.rules', detail: 'το cdeCustodyKeys() δεν διαβάστηκε — η Κ1 δεν ξέρει τι φυλάει' });
  let judgeConsumers = 0;
  let pepConsumers = 0;
  for (const abs of files) {
    const rel = toPosix(path.relative(root, abs));
    const text = input.read(abs);
    if (text === null) continue;
    if (rel !== JUDGE_FILE && text.includes('decideContainerAccess(')) judgeConsumers += 1;
    if (rel !== PEP_FILE && text.includes('container-visibility-guard')) pepConsumers += 1;
    const list = unscopedListIn(text, rel);
    if (list) findings.push(list);
    const relevant = FILES_REFERENCE.test(text) || rel === 'src/types/file-record.ts';
    if (!relevant || !(fields.some((f) => text.includes(f)) || SECOND_FLAG.test(text) || /ForConstruction|ApprovedForBuild/i.test(text))) continue;
    findings.push(...custodyFindingsIn(sourceFileOf(abs, text), rel, fields));
  }
  for (const writer of [STATE_WRITER, ...Object.values(BIRTH_WRITERS).flat()]) {
    if (!input.exists(writer)) findings.push({ state: STATES.SOURCE_DRIFT, file: writer, detail: 'δηλωμένος γραφέας που ΔΕΝ ΥΠΑΡΧΕΙ' });
  }
  if (judgeConsumers === 0 || pepConsumers === 0) {
    findings.push({ state: STATES.UNJUDGED, file: JUDGE_FILE, detail: `καταναλωτές κριτή ${judgeConsumers} · PEP ${pepConsumers} — κανείς δεν κρίνει` });
  }
  findings.push(...tableGaps(root, input));
  const tally = tallyOf(findings, STATES);
  tally[STATES.JUDGE_CONSUMERS] = judgeConsumers + pepConsumers;
  return { findings, tally, examined: files.length, fields };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('🗂️  CHECK 3.87 — Πύλη της αρχής της κατάστασης CDE (ADR-862 Φ0 Β12)');
  log(`   αρχεία που εξετάστηκαν: ${result.examined} · πεδία φύλαξης (από firestore.rules): ${result.fields.length}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(26)} ${tally[s]}`);
  for (const s of [STATES.WRITER, STATES.BIRTH, STATES.EXEMPT, STATES.JUDGE_CONSUMERS, STATES.SCOPED_LISTS]) {
    log(`   ✅ ${s.padEnd(26)} ${tally[s]}`);
  }
  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  for (const f of blocking) log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.detail}`);
  if (blocking.length) {
    log('\n   ΘΕΡΑΠΕΙΑ: ζήτα την πράξη από τον γραφέα — `transitionContainer({ act, … })`.');
    log('   ⚠️ ΜΗΝ προσθέσεις γραφέα στη λίστα «επειδή βολεύει»: η λίστα λέει «ΕΔΩ ζει η απάντηση».');
  }
  return blocking.length;
}

const { main } = gateEntry({
  projectRoot: PROJECT_ROOT, measure, report, check: '3.87', skipEnv: 'SKIP_CDE_AUTHORITY',
  ok: 'η κατάσταση CDE γράφεται ΜΟΝΟ από τον γραφέα, κάθε client λίστα έχει φράχτη',
});

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, custodyFieldsOf, custodyFindingsIn, unscopedListIn, writeTargetsIn,
  sourceFileOf, tableGaps, STATES, BLOCKING, STATE_WRITER, BIRTH_WRITERS, FILES_REFERENCE,
};
