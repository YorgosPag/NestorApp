#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.88 — Η ΠΥΛΗ ΤΗΣ ΑΡΧΗΣ ΤΗΣ ΟΜΑΔΑΣ ΕΡΓΟΥ (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * «Γράφει κάποιος μέλος έργου ΕΞΩ από τον ΕΝΑ γραφέα — ή γεννά έργο ΧΩΡΙΣ την αρχική του ομάδα;»
 *
 * 🔴 ΓΙΑΤΙ (μετρημένο 2026-09-17): 8 έργα, 0 μέλη. Το έργο γραφόταν με σκέτο `.set()` και ο
 * κριτής (`decideContainerAccess`, βήμα 4) έκρυβε κάθε αρχείο CDE ακόμη και από τον δημιουργό.
 * Οι κανόνες (`members: if false`) κλείνουν τον ΠΕΛΑΤΗ — ΟΧΙ το Admin SDK: ένας δεύτερος
 * γραφέας μελών ή ένας δεύτερος δημιουργός έργων στον διακομιστή περνά κάθε κανόνα.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ (κάθε ένα δική του γραμμή) ────────────────────────────────────────────
 *  Κ1 το μονοπάτι μελών (`SUBCOLLECTIONS.PROJECT_MEMBERS`) χτίζεται ΜΟΝΟ στο `project-member-ref.ts`
 *  Κ2 το `projectMembersCollection(` καλείται ΜΟΝΟ από ΔΗΛΩΜΕΝΟ καταναλωτή· και σε αναγνώστη
 *     καμία αλυσίδα εγγραφής (`.set/.update/.create/.delete`) πάνω του
 *  Κ3 νέο έργο (`.set(` χωρίς `merge` / `.create(` σε `COLLECTIONS.PROJECTS`) ΜΟΝΟ στη γέννηση
 *  Κ4 η πολιτική στελέχωσης έχει ΚΑΙ τους δύο καταναλωτές (γέννηση + backfill) — αλλιώς
 *     «πράσινο επειδή κανείς δεν τη ρωτά»
 *
 * ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ: τα θεραπευμένα αρχεία κουβαλούν σχόλια που ΟΝΟΜΑΖΟΥΝ τις κλήσεις.
 * 🔓 Εξαίρεση ΜΟΝΟ με λόγο, στη γραμμή πάνω: `// project-member-authority-exempt: <λόγος>`.
 *
 * @see ADR-862 Φ0 Β14 · docs/gates/3.88.md · αδελφή: CHECK 3.87
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ts = require(path.join(PROJECT_ROOT, 'node_modules', 'typescript'));
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const REF_FILE = 'src/lib/auth/project-member-ref.ts';
const WRITER = 'src/lib/auth/project-member-write.ts';
const BIRTH = 'src/app/api/projects/list/project-birth.ts';
const POLICY = 'src/lib/auth/project-staffing-policy.ts';
const BACKFILL = 'src/app/api/admin/migrations/backfill-project-members/backfill-project-members-operations.ts';

/** Οι ΔΗΛΩΜΕΝΟΙ αναγνώστες — κλειστό σύνολο, με λόγο ο καθένας. */
const READERS = {
  'src/lib/auth/project-member-read.ts': 'ο ΕΝΑΣ αναγνώστης (κριτής ορατότητας)',
  'src/services/iso19650/container-custody.ts': 'η ομάδα του αιτούντος στην είσοδο στο CDE',
  'src/app/api/admin/role-management/project-members/route.ts': 'ο κατάλογος μελών του διαχειριστή (GET)',
};
const POLICY_CONSUMERS = [BIRTH, BACKFILL];

const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete', 'add']);
const EXEMPT = /project-member-authority-exempt:\s*(\S.*)?$/;

const STATES = {
  WRITER: 'writer',
  READER: 'declared-reader',
  BIRTH: 'project-birth',
  EXEMPT: 'exempt-with-reason',
  PATH_OUTSIDE_REF: 'members-path-outside-ref',
  UNDECLARED_CONSUMER: 'undeclared-members-consumer',
  READER_WRITES: 'reader-writes-members',
  SECOND_BIRTH: 'second-project-birth',
  POLICY_UNASKED: 'staffing-policy-unasked',
  EXEMPT_NO_REASON: 'exempt-without-reason',
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [
  STATES.PATH_OUTSIDE_REF, STATES.UNDECLARED_CONSUMER, STATES.READER_WRITES, STATES.SECOND_BIRTH,
  STATES.POLICY_UNASKED, STATES.EXEMPT_NO_REASON, STATES.SOURCE_DRIFT,
];

function sourceFileOf(absPath, text) {
  return ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(absPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

/** Η εξαίρεση της γραμμής από πάνω: `null` αν δεν υπάρχει, αλλιώς ο λόγος (μπορεί κενός). */
function exemptionAbove(sf, node) {
  const above = sf.text.split(/\r?\n/)[lineOf(sf, node) - 2] || '';
  const match = above.match(EXEMPT);
  return match ? (match[1] || '').trim() : null;
}

/** Ο αριστερός κρίκος μιας αλυσίδας κλήσεων/προσβάσεων — κάθε κόμβος, από έξω προς τα μέσα. */
function chainNodes(node) {
  const nodes = [];
  for (let current = node; current; ) {
    nodes.push(current);
    if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) current = current.expression;
    else break;
  }
  return nodes;
}

const isCallTo = (node, name) => ts.isCallExpression(node) && ts.isIdentifier(node.expression)
  && node.expression.text === name;

/** Είναι αυτή η κλήση `X.collection(COLLECTIONS.PROJECTS)` (ή `collection(db, COLLECTIONS.PROJECTS)`); */
function isProjectsCollection(node) {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  const named = (ts.isPropertyAccessExpression(callee) && callee.name.text === 'collection')
    || (ts.isIdentifier(callee) && callee.text === 'collection');
  return named && node.arguments.some((arg) => arg.getText() === 'COLLECTIONS.PROJECTS');
}

/** Οι μεταβλητές του αρχείου που κρατούν αναφορά εγγράφου/συλλογής έργων. */
function projectRefIdentifiers(sf) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && chainNodes(node.initializer).some(isProjectsCollection)) names.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

/** `.set(x)` χωρίς δεύτερο όρισμα `{ merge: true }` ⇒ δημιουργία/αντικατάσταση. */
function isCreation(call, method) {
  if (method === 'create') return true;
  if (method !== 'set') return false;
  const options = call.arguments[call.arguments.length - 1];
  const hasMerge = call.arguments.length > 1 && options !== call.arguments[0] && ts.isObjectLiteralExpression(options)
    && options.properties.some((p) => p.name && /merge|mergeFields/.test(p.name.getText()));
  return !hasMerge;
}

/** `doc(db, COLLECTIONS.PROJECTS, …)` του client SDK. */
const isProjectsDocCall = (node) => isCallTo(node, 'doc')
  && node.arguments.some((arg) => arg.getText() === 'COLLECTIONS.PROJECTS');

/** Δείχνει αυτό το όρισμα σε έγγραφο έργων (μεταβλητή, αλυσίδα Admin, ή `doc(db, …)`); */
function refersToProject(arg, refs) {
  if (!arg) return false;
  if (ts.isIdentifier(arg)) return refs.has(arg.text);
  return chainNodes(arg).some((n) => isProjectsCollection(n) || isProjectsDocCall(n));
}

/**
 * Γεννά αυτή η κλήση έγγραφο έργων;
 * Τρεις μορφές: `ref.set(data)` · `tx|batch.set(ref, data)` · `setDoc(ref, data)`.
 */
function writesProject(call, refs) {
  const callee = call.expression;
  if (ts.isIdentifier(callee) && callee.text === 'setDoc') {
    return isCreation(call, 'set') && refersToProject(call.arguments[0], refs);
  }
  if (!ts.isPropertyAccessExpression(callee) || !isCreation(call, callee.name.text)) return false;
  if (chainNodes(callee.expression).some(isProjectsCollection)) return true;
  return call.arguments.length >= 2 && refersToProject(call.arguments[0], refs);
}

/** Γράφει αυτή η κλήση πάνω σε αλυσίδα που ξεκινά από `projectMembersCollection(`; */
function writesMembers(call) {
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  if (!WRITE_METHODS.has(call.expression.name.text)) return false;
  return chainNodes(call.expression.expression).some((n) => isCallTo(n, 'projectMembersCollection'));
}

function classifyByExemption(sf, node, rel, blockingState, detail) {
  const reason = exemptionAbove(sf, node);
  if (reason === null) return { state: blockingState, file: rel, line: lineOf(sf, node), detail };
  return reason.length > 0
    ? { state: STATES.EXEMPT, file: rel }
    : { state: STATES.EXEMPT_NO_REASON, file: rel, line: lineOf(sf, node), detail: 'εξαίρεση ΧΩΡΙΣ λόγο' };
}

/** Κ1 + Κ2 + Κ3 για ένα αρχείο. */
function findingsIn(sf, rel) {
  const findings = [];
  const refs = projectRefIdentifiers(sf);
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && node.getText() === 'SUBCOLLECTIONS.PROJECT_MEMBERS' && rel !== REF_FILE) {
      findings.push(classifyByExemption(sf, node, rel, STATES.PATH_OUTSIDE_REF,
        `χτίζει το μονοπάτι μελών — ζήτα το από το \`projectMembersCollection\` (${REF_FILE})`));
    }
    if (isCallTo(node, 'projectMembersCollection')) findings.push(...consumerFinding(sf, node, rel));
    if (ts.isCallExpression(node) && rel !== WRITER && writesMembers(node)) {
      findings.push(classifyByExemption(sf, node, rel, STATES.READER_WRITES,
        `γράφει μέλος έργου — η ένταξη ζει ΜΟΝΟ στον ${WRITER}`));
    }
    if (ts.isCallExpression(node) && writesProject(node, refs)) {
      findings.push(rel === BIRTH ? { state: STATES.BIRTH, file: rel }
        : classifyByExemption(sf, node, rel, STATES.SECOND_BIRTH,
          `γεννά έργο χωρίς την αρχική ομάδα — κάλεσε το \`writeProjectBirth\` (${BIRTH})`));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

function consumerFinding(sf, node, rel) {
  if (rel === REF_FILE) return [];
  if (rel === WRITER) return [{ state: STATES.WRITER, file: rel }];
  if (READERS[rel]) return [{ state: STATES.READER, file: rel }];
  return [classifyByExemption(sf, node, rel, STATES.UNDECLARED_CONSUMER,
    'αδήλωτος καταναλωτής του μονοπατιού μελών — δήλωσέ τον στο READERS με λόγο, ή ζήτα από τον γραφέα/αναγνώστη')];
}

/** Κ4 + ύπαρξη δηλωμένων αρχείων. */
function wiringFindings(root) {
  const findings = [];
  for (const declared of [REF_FILE, WRITER, BIRTH, POLICY, BACKFILL, ...Object.keys(READERS)]) {
    if (!fs.existsSync(path.join(root, declared))) {
      findings.push({ state: STATES.SOURCE_DRIFT, file: declared, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
    }
  }
  for (const consumer of POLICY_CONSUMERS) {
    const abs = path.join(root, consumer);
    if (fs.existsSync(abs) && !fs.readFileSync(abs, 'utf8').includes('initialProjectTeam(')) {
      findings.push({ state: STATES.POLICY_UNASKED, file: consumer,
        detail: 'δεν ρωτά την `initialProjectTeam` — η αρχική ομάδα αποφασίζεται αλλού ή πουθενά' });
    }
  }
  return findings;
}

const RELEVANT = /PROJECT_MEMBERS|projectMembersCollection|COLLECTIONS\.PROJECTS/;

function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const files = (opts.codeFiles || collectSourceFiles(root, ['src'])).filter((f) => !/__tests__|\.test\.|\.spec\./.test(f));
  if (!opts.codeFiles && files.length < 1000) throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία — η σάρωση δεν κοίταξε`);
  const findings = [];
  for (const abs of files) {
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!RELEVANT.test(text)) continue;
    findings.push(...findingsIn(sourceFileOf(abs, text), toPosix(path.relative(root, abs))));
  }
  findings.push(...(opts.skipWiring ? [] : wiringFindings(root)));
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, findings.filter((f) => f.state === s).length]));
  return { findings, tally, examined: files.length };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('👥 CHECK 3.88 — Πύλη της αρχής της ομάδας έργου (ADR-862 Φ0 Β14)');
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(30)} ${tally[s]}`);
  for (const s of [STATES.WRITER, STATES.READER, STATES.BIRTH, STATES.EXEMPT]) log(`   ✅ ${s.padEnd(30)} ${tally[s]}`);
  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  for (const f of blocking) log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.detail}`);
  if (blocking.length) {
    log('\n   ΘΕΡΑΠΕΙΑ: μέλη → `enrollProjectMembers` / `updateProjectMember` / `removeProjectMember`·');
    log('   νέο έργο → `writeProjectBirth`. ⚠️ ΜΗΝ προσθέσεις αναγνώστη «επειδή βολεύει».');
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_PROJECT_MEMBER_AUTHORITY === '1') {
    console.log('⏭️  CHECK 3.88 παραλείφθηκε (SKIP_PROJECT_MEMBER_AUTHORITY=1)');
    return 0;
  }
  const blocking = report(measure());
  console.log(blocking > 0
    ? `\n❌ CHECK 3.88 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)\n`
    : '\n✅ CHECK 3.88 — τα μέλη έργου γράφονται ΜΟΝΟ από τον γραφέα, κάθε έργο γεννιέται με ομάδα\n');
  return blocking > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, findingsIn, wiringFindings, sourceFileOf,
  STATES, BLOCKING, REF_FILE, WRITER, BIRTH, READERS,
};
