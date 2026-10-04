#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.99 — Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΣΗΜΑΤΩΝ ΟΨΕΩΝ (ADR-905 §8 Ε2 · άγκυρα Α38)
 * =============================================================================
 *
 * «Γράφει κάποιος σήμα όψης ΕΞΩ από τον ΕΝΑ γραφέα — ή αλλάζει την υπόθεση ΧΩΡΙΣ να ζητήσει σήμα;»
 *
 * 🔴 ΓΙΑΤΙ: οι κανόνες (`conveyance_view_signals`: `create/update/delete: if false`) κλείνουν τον
 * ΠΕΛΑΤΗ — ΟΧΙ το Admin SDK. Δεύτερος γραφέας στον server θα σήμαινε όψη ΕΞΩ από το ακροατήριο
 * (ο αριθμός είναι πληροφορία ΧΡΟΝΙΣΜΟΥ: «η άλλη πλευρά δουλεύει ΤΩΡΑ»). Και γραφέας της υπόθεσης
 * που «ξέχασε» το σήμα αφήνει την οθόνη μπαγιάτικη ως το F5 — ακριβώς το σύμπτωμα του ADR-901 Π5.
 *
 * Η άγκυρα Α38 (jest) το έλεγχε ήδη· η πύλη το κάνει ΜΠΛΟΚ στο commit, με AST αντί για regex, και
 * διαβάζει την ΙΔΙΑ λίστα (`.view-signal-authority.json`) — ποτέ δεύτερο αντίγραφο.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ ───────────────────────────────────────────────────────────────────────
 *  Κ1 το `COLLECTIONS.CONVEYANCE_VIEW_SIGNALS` εμφανίζεται ΜΟΝΟ στον γραφέα + στην αναφορά του client
 *  Κ2 κάθε ΔΗΛΩΜΕΝΟΣ γραφέας της υπόθεσης καλεί τις συναρτήσεις σήματός του ≥ `min` φορές· και
 *     κάθε αρχείο που καλεί συνάρτηση σήματος είναι ΔΗΛΩΜΕΝΟ (κλειστό σύνολο, προς τις δύο μεριές)
 *  Κ3 η αναφορά του client ΔΕΝ γράφει (καμία κλήση `setDoc/updateDoc/deleteDoc/addDoc/writeBatch/runTransaction`)
 *  Κ4 ο γραφέας γράφει το έγγραφο σήματος με ΜΙΑ μορφή: μόνο `tx.set(` (merge + increment)
 *
 * ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ: οι κεφαλίδες ΟΝΟΜΑΖΟΥΝ τις απαγορευμένες κλήσεις για να τις απαγορεύσουν.
 *
 * @see ADR-905 §8 · ADR-901 §7 Α38 · docs/gates/3.99.md · αδελφές: CHECK 3.87 · 3.88 · 3.89
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ts = require(path.join(PROJECT_ROOT, 'node_modules', 'typescript'));
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const REGISTRY_FILE = '.view-signal-authority.json';
const COLLECTION_EXPR = 'COLLECTIONS.CONVEYANCE_VIEW_SIGNALS';
const CLIENT_WRITES = new Set(['setDoc', 'updateDoc', 'deleteDoc', 'addDoc', 'writeBatch', 'runTransaction']);
const TX_WRITES = new Set(['set', 'update', 'create', 'delete']);

const STATES = {
  WRITER: 'the-writer',
  CLIENT_REF: 'client-ref',
  CASE_WRITER: 'declared-case-writer',
  COLLECTION_OUTSIDE: 'signal-collection-outside-writer',
  UNDECLARED_CALLER: 'undeclared-signal-caller',
  MISSING_SIGNAL: 'case-writer-without-signal',
  CLIENT_WRITES: 'client-ref-writes',
  SECOND_WRITE_FORM: 'second-signal-write-form',
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [
  STATES.COLLECTION_OUTSIDE, STATES.UNDECLARED_CALLER, STATES.MISSING_SIGNAL,
  STATES.CLIENT_WRITES, STATES.SECOND_WRITE_FORM, STATES.SOURCE_DRIFT,
];

function loadRegistry(root) {
  return JSON.parse(fs.readFileSync(path.join(root, REGISTRY_FILE), 'utf8'));
}

function sourceFileOf(absPath, text) {
  return ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(absPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

/** Το όνομα της συνάρτησης που καλείται άμεσα (`f(` ή `x.f(`) — αλλιώς `null`. */
function calleeName(call) {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

/** Όσα ενδιαφέρουν την πύλη σε ένα αρχείο, σε ένα πέρασμα. */
function scan(sf) {
  const facts = { collectionAt: [], calls: [], txWrites: [] };
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && node.getText() === COLLECTION_EXPR) facts.collectionAt.push(lineOf(sf, node));
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name) facts.calls.push({ name, line: lineOf(sf, node) });
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'tx'
        && TX_WRITES.has(callee.name.text)) facts.txWrites.push({ method: callee.name.text, line: lineOf(sf, node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return facts;
}

/** Κ1 + Κ2 (καλών αδήλωτος) + Κ3 + Κ4 για ένα αρχείο. */
function findingsIn(sf, rel, registry) {
  const facts = scan(sf);
  const findings = [];
  const isWriter = rel === registry.writer;
  const isClientRef = rel === registry.clientRef;
  for (const line of facts.collectionAt) {
    if (!isWriter && !isClientRef) {
      findings.push({ state: STATES.COLLECTION_OUTSIDE, file: rel, line,
        detail: `ονομάζει τη συλλογή σημάτων — ζήτα σήμα από τον ${registry.writer}` });
    }
  }
  const signalNames = new Set(registry.signalFunctions);
  if (!isWriter && !registry.caseWriters[rel]) {
    for (const call of facts.calls.filter((c) => signalNames.has(c.name))) {
      findings.push({ state: STATES.UNDECLARED_CALLER, file: rel, line: call.line,
        detail: `καλεί \`${call.name}\` χωρίς δήλωση — πρόσθεσέ το στο ${REGISTRY_FILE} (caseWriters, με min + why)` });
    }
  }
  if (isClientRef) {
    for (const call of facts.calls.filter((c) => CLIENT_WRITES.has(c.name))) {
      findings.push({ state: STATES.CLIENT_WRITES, file: rel, line: call.line, detail: `η αναφορά του client γράφει (\`${call.name}\`)` });
    }
  }
  if (isWriter) {
    for (const write of facts.txWrites.filter((w) => w.method !== 'set')) {
      findings.push({ state: STATES.SECOND_WRITE_FORM, file: rel, line: write.line,
        detail: `\`tx.${write.method}(\` — το σήμα γράφεται ΜΟΝΟ με \`tx.set(\` merge + increment` });
    }
    if (facts.txWrites.filter((w) => w.method === 'set').length !== 1) {
      findings.push({ state: STATES.SECOND_WRITE_FORM, file: rel, detail: `αναμενόταν ΑΚΡΙΒΩΣ ένα \`tx.set(\`, βρέθηκαν ${facts.txWrites.filter((w) => w.method === 'set').length}` });
    }
  }
  return { findings, facts };
}

/** Κ2 (η άλλη μεριά): κάθε δηλωμένος γραφέας ζητά σήμα όσες φορές οφείλει. + ύπαρξη αρχείων. */
function declaredFindings(root, registry, factsByFile) {
  const findings = [];
  for (const declared of [registry.writer, registry.clientRef, ...Object.keys(registry.caseWriters)]) {
    if (!fs.existsSync(path.join(root, declared))) {
      findings.push({ state: STATES.SOURCE_DRIFT, file: declared, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
    }
  }
  for (const [file, spec] of Object.entries(registry.caseWriters)) {
    if (!fs.existsSync(path.join(root, file))) continue;
    // Αρχείο που δεν πέρασε καν το προφίλτρο = ΜΗΔΕΝ κλήσεις — ποτέ «δεν κοίταξα άρα πράσινο».
    const facts = factsByFile.get(file) || { calls: [] };
    const count = facts.calls.filter((c) => spec.calls.includes(c.name)).length;
    findings.push(count >= spec.min
      ? { state: STATES.CASE_WRITER, file }
      : { state: STATES.MISSING_SIGNAL, file, detail: `${count}/${spec.min} κλήσεις ${spec.calls.join(' | ')} — ${spec.why}` });
  }
  return findings;
}

const RELEVANT = /CONVEYANCE_VIEW_SIGNALS|signalViewsInTx|signalCaseChangeInTx|caseRosterSignal|invitationHostSignal|setDoc|tx\./;

function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const registry = opts.registry || loadRegistry(root);
  const files = (opts.codeFiles || collectSourceFiles(root, ['src'])).filter((f) => !/__tests__|\.test\.|\.spec\./.test(f));
  if (!opts.codeFiles && files.length < 1000) throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία — η σάρωση δεν κοίταξε`);
  const findings = [];
  const factsByFile = new Map();
  for (const abs of files) {
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!RELEVANT.test(text)) continue;
    const rel = toPosix(path.relative(root, abs));
    const result = findingsIn(sourceFileOf(abs, text), rel, registry);
    factsByFile.set(rel, result.facts);
    findings.push(...result.findings);
    if (rel === registry.writer) findings.push({ state: STATES.WRITER, file: rel });
    if (rel === registry.clientRef) findings.push({ state: STATES.CLIENT_REF, file: rel });
  }
  findings.push(...declaredFindings(root, registry, factsByFile));
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, findings.filter((f) => f.state === s).length]));
  return { findings, tally, examined: files.length };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('📡 CHECK 3.99 — Πύλη του ενός γραφέα σημάτων όψεων (ADR-905 §8 Ε2 · Α38)');
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(34)} ${tally[s]}`);
  for (const s of [STATES.WRITER, STATES.CLIENT_REF, STATES.CASE_WRITER]) log(`   ✅ ${s.padEnd(34)} ${tally[s]}`);
  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  for (const f of blocking) log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.detail}`);
  if (blocking.length) {
    log(`\n   ΘΕΡΑΠΕΙΑ: σήμα → \`signalCaseChangeInTx\` (κρίση ακροατηρίου + γραφή, μέσα στη συναλλαγή της πράξης)·`);
    log(`   νέος γραφέας της υπόθεσης → γραμμή στο ${REGISTRY_FILE} με \`min\` και \`why\`. ⚠️ ΜΗΝ γράψεις δεύτερο γραφέα.`);
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_VIEW_SIGNAL_AUTHORITY === '1') {
    console.log('⏭️  CHECK 3.99 παραλείφθηκε (SKIP_VIEW_SIGNAL_AUTHORITY=1)');
    return 0;
  }
  const blocking = report(measure());
  console.log(blocking > 0
    ? `\n❌ CHECK 3.99 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)\n`
    : '\n✅ CHECK 3.99 — ένας γραφέας σημάτων, και κάθε γραφέας της υπόθεσης τον ρωτά\n');
  return blocking > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = { measure, report, main, findingsIn, loadRegistry, sourceFileOf, STATES, BLOCKING, REGISTRY_FILE };
