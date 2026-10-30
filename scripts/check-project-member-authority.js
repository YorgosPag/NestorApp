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

const ast = require('./lib/write-authority/ast');
const { openGateInput } = require('./lib/gate-input');
const { defineScanGate } = require('./lib/write-authority/gate-runner');

const { ts, PROJECT_ROOT, sourceFileOf, chainNodes, isCallTo, isCreation } = ast;

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
  'src/services/document-registry/registry-responsibility.server.ts': 'οι υπεύθυνοι έργου στην αλυσίδα ειδοποιήσεων λήξεων (ADR-915 Φ5β · μόνο ανάγνωση)',
};
const POLICY_CONSUMERS = [BIRTH, BACKFILL];

const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete', 'add']);
const exemptions = ast.exemptionsFor('project-member-authority-exempt');

const STATES = {
  WRITER: 'writer',
  READER: 'declared-reader',
  BIRTH: 'project-birth',
  EXEMPT: ast.EXEMPTION_STATES.EXEMPT,
  PATH_OUTSIDE_REF: 'members-path-outside-ref',
  UNDECLARED_CONSUMER: 'undeclared-members-consumer',
  READER_WRITES: 'reader-writes-members',
  SECOND_BIRTH: 'second-project-birth',
  POLICY_UNASKED: 'staffing-policy-unasked',
  EXEMPT_NO_REASON: ast.EXEMPTION_STATES.EXEMPT_NO_REASON,
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [
  STATES.PATH_OUTSIDE_REF, STATES.UNDECLARED_CONSUMER, STATES.READER_WRITES, STATES.SECOND_BIRTH,
  STATES.POLICY_UNASKED, STATES.EXEMPT_NO_REASON, STATES.SOURCE_DRIFT,
];

/** Είναι αυτή η κλήση `X.collection(COLLECTIONS.PROJECTS)` (ή `collection(db, COLLECTIONS.PROJECTS)`); */
const isProjectsCollection = (node) => ast.isCollectionOf(node, 'COLLECTIONS.PROJECTS');

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

const classifyByExemption = exemptions.classify;

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
function wiringFindings(root, input = openGateInput({ root })) {
  const findings = [];
  for (const declared of [REF_FILE, WRITER, BIRTH, POLICY, BACKFILL, ...Object.keys(READERS)]) {
    if (!input.exists(declared)) {
      findings.push({ state: STATES.SOURCE_DRIFT, file: declared, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
    }
  }
  for (const consumer of POLICY_CONSUMERS) {
    const text = input.read(consumer);
    if (text !== null && !text.includes('initialProjectTeam(')) {
      findings.push({ state: STATES.POLICY_UNASKED, file: consumer,
        detail: 'δεν ρωτά την `initialProjectTeam` — η αρχική ομάδα αποφασίζεται αλλού ή πουθενά' });
    }
  }
  return findings;
}

const RELEVANT = /PROJECT_MEMBERS|projectMembersCollection|COLLECTIONS\.PROJECTS/;

const { measure, report, main } = defineScanGate({
  projectRoot: PROJECT_ROOT, relevant: RELEVANT, findingsIn, wiringFindings, states: STATES,
  check: '3.88', skipEnv: 'SKIP_PROJECT_MEMBER_AUTHORITY',
  ok: 'τα μέλη έργου γράφονται ΜΟΝΟ από τον γραφέα, κάθε έργο γεννιέται με ομάδα',
  report: {
    title: '👥 CHECK 3.88 — Πύλη της αρχής της ομάδας έργου (ADR-862 Φ0 Β14)',
    blocking: BLOCKING,
    healthy: [STATES.WRITER, STATES.READER, STATES.BIRTH, STATES.EXEMPT],
    width: 30,
    remedy: [
      'ΘΕΡΑΠΕΙΑ: μέλη → `enrollProjectMembers` / `updateProjectMember` / `removeProjectMember`·',
      'νέο έργο → `writeProjectBirth`. ⚠️ ΜΗΝ προσθέσεις αναγνώστη «επειδή βολεύει».',
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, findingsIn, wiringFindings, sourceFileOf,
  STATES, BLOCKING, REF_FILE, WRITER, BIRTH, READERS,
};
