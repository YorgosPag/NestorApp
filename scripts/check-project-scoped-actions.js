#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.111 — Η ΠΥΛΗ ΤΩΝ ΠΡΑΞΕΩΝ ΕΡΓΟΥ (ADR-926)
 * =============================================================================
 *
 * «Έχει κάθε πράξη έργου ΣΗΜΕΙΟ ΕΠΙΒΟΛΗΣ και γραμμή στον πίνακα — και βγαίνει το έργο ΜΟΝΟ από τον πόρο;»
 *
 * 🔴 ΓΙΑΤΙ (μετρημένο 2026-11-02): ο ρόλος έργου ήταν νεκρός στις διαδρομές, γιατί γραμμή στον κατάλογο χωρίς σημείο
 * επιβολής δεν κάνει τίποτα, και κανείς δεν το έβλεπε. Το αντίθετο είναι χειρότερο: πράξη που ανοίγει με `projectId`
 * από το σώμα δίνει ρόλο έργου σε ό,τι διαλέξει ο καλών. Και το `DELETE /api/trash/.../permanent-delete` ζητούσε μόνο σύνδεση.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ ───────────────────────────────────────────────────────────────
 *  Κ1 κάθε πράξη του καταλόγου έχει γραμμή στον `PROJECT_ROLE_POLICY`, και κάθε γραμμή πράξη
 *  Κ2 κάθε πράξη έχει σημείο επιβολής: διαδρομή με `permissions` + `permissionResource`, ή δηλωμένο αρχείο με `projectId`
 *  Κ3 κανένα `permissionOptions` σε διαδρομή: το έργο έρχεται από τον πόρο, ποτέ από το αίτημα (AIP-203)
 *  Κ4 κανένα αντίγραφο του καταλόγου: πίνακας με ≥3 πράξεις του έξω από το SSoT
 *  Κ5 η οριστική διαγραφή μένει έξω από τον κατάλογο, και οι διαδρομές της ζητούν `trash:entities:purge`
 *
 * @see ADR-926 · docs/gates/3.111.md · αδελφή: CHECK 3.68
 */

'use strict';

const ast = require('./lib/write-authority/ast');
const { openGateInput } = require('./lib/gate-input');
const { defineScanGate } = require('./lib/write-authority/gate-runner');

const { ts, PROJECT_ROOT } = ast;

const CATALOGUE = 'src/lib/auth/project-scoped-actions.ts';
const POLICY = 'src/app/api/buildings/__tests__/building-floor-role-policy.fixture.ts';
const PURGE = 'trash:entities:purge';
/** Τα αρχεία όπου οι ίδιες λέξεις είναι δεδομένα ρόλων, όχι αντίγραφο της κρίσης. */
const ROLE_DATA = new Set([CATALOGUE, 'src/lib/auth/role-catalogue.ts', 'src/lib/auth/permission-sets.ts']);
/** Πράξεις που ΔΕΝ μπαίνουν ποτέ στον κατάλογο: μη αναστρέψιμες. */
const NEVER_PROJECT_SCOPED = [PURGE, 'projects:floors:delete'];
const PURGE_ROUTES = [
  'src/app/api/trash/[entityType]/[entityId]/permanent-delete/route.ts',
  'src/app/api/contacts/[contactId]/permanent-delete/route.ts',
];

const STATES = {
  ENFORCED: 'enforced-project-action',
  ROW_MISSING: 'action-without-policy-row',
  ROW_ORPHAN: 'policy-row-without-action',
  UNENFORCED: 'action-without-enforcement',
  OPTIONS_FROM_REQUEST: 'permission-options-in-route',
  CATALOGUE_COPY: 'catalogue-copied',
  PURGE_SCOPED: 'irreversible-action-in-catalogue',
  PURGE_OPEN: 'purge-route-without-permission',
  SOURCE_DRIFT: 'declared-source-missing',
};
const BLOCKING = Object.values(STATES).filter((state) => state !== STATES.ENFORCED);

/** Τα string στοιχεία του `PROJECT_SCOPED_ACTIONS`, από το AST: σχόλιο που ονομάζει πράξη δεν μετρά. */
function catalogueActions(text) {
  const sf = ast.sourceFileOf(CATALOGUE, text);
  const actions = [];
  const collect = (node) => {
    if (ts.isStringLiteral(node)) actions.push(node.text);
    ts.forEachChild(node, collect);
  };
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === 'PROJECT_SCOPED_ACTIONS' && node.initializer) {
      const seed = ts.isSatisfiesExpression?.(node.initializer) ? node.initializer.expression : node.initializer;
      collect(seed);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return actions;
}

/** `πράξη → { operation } | { enforcedBy }`, από τον `PROJECT_ROLE_POLICY`. */
function policyRows(text) {
  const sf = ast.sourceFileOf(POLICY, text);
  const rows = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === 'PROJECT_ROLE_POLICY' && ts.isObjectLiteralExpression(node.initializer)) {
      for (const row of node.initializer.properties) {
        if (!ts.isPropertyAssignment(row) || !ts.isObjectLiteralExpression(row.initializer)) continue;
        const [field] = row.initializer.properties;
        rows.set(row.name.text, { kind: field.name.text, value: field.initializer.text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return rows;
}

const literalOf = (node) => (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null);

/** Τα αντικείμενα επιλογών του αρχείου: όσα δηλώνουν `permissions`. */
function optionObjects(sf) {
  const found = [];
  ast.walk(sf, (node) => {
    if (!ts.isObjectLiteralExpression(node)) return;
    const names = new Map(node.properties.filter((p) => p.name && ts.isIdentifier(p.name)).map((p) => [p.name.text, p]));
    if (names.has('permissions')) found.push(names);
  });
  return found;
}

/** Οι πράξεις που το αρχείο κρίνει μέσω `permissionResource`. */
function enforcedIn(sf) {
  return optionObjects(sf)
    .filter((names) => names.has('permissionResource'))
    .map((names) => literalOf(names.get('permissions').initializer))
    .filter(Boolean);
}

function findingsIn(sf, rel) {
  const findings = [];
  const isRoute = rel.startsWith('src/app/api/');
  if (isRoute) {
    for (const names of optionObjects(sf)) {
      if (names.has('permissionOptions')) {
        findings.push({ state: STATES.OPTIONS_FROM_REQUEST, file: rel, line: ast.lineOf(sf, names.get('permissionOptions')),
          detail: '`permissionOptions` σε διαδρομή: δήλωσε `permissionResource`, το έργο βγαίνει από τον πόρο' });
      }
    }
  }
  if (!ROLE_DATA.has(rel) && !/__tests__|\.test\./.test(rel)) findings.push(...catalogueCopies(sf, rel));
  return findings;
}

/** Οι πράξεις δομής έργου, η καρδιά του καταλόγου. Κρίνεται το σχήμα, ώστε η σάρωση αρχείου να μη διαβάζει δεύτερη είσοδο. */
const STRUCTURE_ACTION = /^(buildings:buildings|projects:floors):(create|update|delete)$/;

function catalogueCopies(sf, rel) {
  const findings = [];
  ast.walk(sf, (node) => {
    if (!ts.isArrayLiteralExpression(node)) return;
    const hits = node.elements.filter((element) => STRUCTURE_ACTION.test(literalOf(element) ?? ''));
    if (hits.length >= 3) {
      findings.push({ state: STATES.CATALOGUE_COPY, file: rel, line: ast.lineOf(sf, node),
        detail: `πίνακας με ${hits.length} πράξεις έργου: διάβασε το \`PROJECT_SCOPED_ACTIONS\`` });
    }
  });
  return findings;
}

function enforcementFindings(actions, rows, read) {
  const findings = [];
  const routeFiles = new Set([
    'src/app/api/buildings/route.ts', 'src/app/api/buildings/building-update.handler.ts',
    'src/app/api/buildings/[buildingId]/route.ts', 'src/app/api/floors/route.ts',
  ]);
  const enforced = new Set();
  for (const file of routeFiles) {
    const text = read(file);
    if (text === null) { findings.push({ state: STATES.SOURCE_DRIFT, file, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' }); continue; }
    enforcedIn(ast.sourceFileOf(file, text)).forEach((action) => enforced.add(action));
  }
  for (const action of actions) {
    const row = rows.get(action);
    if (!row) continue;
    const proven = row.kind === 'enforcedBy' ? (read(row.value) ?? '').includes('projectId') : enforced.has(action);
    findings.push(proven
      ? { state: STATES.ENFORCED, file: CATALOGUE, detail: action }
      : { state: STATES.UNENFORCED, file: CATALOGUE, detail: `\`${action}\` δεν έχει σημείο επιβολής: γραμμή χωρίς διαδρομή είναι νεκρή` });
  }
  return findings;
}

/** Κ1 + Κ2 + Κ5: το ζευγάρι κατάλογος ⇄ πίνακας, και οι διαδρομές οριστικής διαγραφής. */
function wiringFindings(root, input = openGateInput({ root })) {
  const read = (rel) => input.read(rel);
  const catalogueText = read(CATALOGUE);
  const policyText = read(POLICY);
  if (catalogueText === null || policyText === null) {
    return [{ state: STATES.SOURCE_DRIFT, file: catalogueText === null ? CATALOGUE : POLICY, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' }];
  }
  const actions = catalogueActions(catalogueText);
  const rows = policyRows(policyText);
  const findings = [];
  for (const action of actions) {
    if (!rows.has(action)) findings.push({ state: STATES.ROW_MISSING, file: POLICY, detail: `\`${action}\` χωρίς γραμμή` });
  }
  for (const action of rows.keys()) {
    if (!actions.includes(action)) findings.push({ state: STATES.ROW_ORPHAN, file: POLICY, detail: `\`${action}\` δεν είναι στον κατάλογο` });
  }
  for (const action of NEVER_PROJECT_SCOPED) {
    if (actions.includes(action)) {
      findings.push({ state: STATES.PURGE_SCOPED, file: CATALOGUE, detail: `\`${action}\` είναι μη αναστρέψιμη: μένει στον \`company_admin\`` });
    }
  }
  for (const route of PURGE_ROUTES) {
    const text = read(route);
    if (text === null) findings.push({ state: STATES.SOURCE_DRIFT, file: route, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
    else if (!optionObjects(ast.sourceFileOf(route, text)).some((names) => literalOf(names.get('permissions').initializer) === PURGE)) {
      findings.push({ state: STATES.PURGE_OPEN, file: route, detail: `η διαδρομή δεν ζητά \`${PURGE}\`` });
    }
  }
  return [...findings, ...enforcementFindings(actions, rows, read)];
}

const RELEVANT = /permissionOptions|buildings:buildings:|projects:floors:|legal:conveyance:|projects:projects:update/;

const { measure, report, main } = defineScanGate({
  projectRoot: PROJECT_ROOT, relevant: RELEVANT, findingsIn, wiringFindings, states: STATES,
  check: '3.111', skipEnv: 'SKIP_PROJECT_SCOPED_ACTIONS',
  ok: 'κάθε πράξη έργου έχει σημείο επιβολής, και το έργο βγαίνει από τον πόρο',
  report: {
    title: '🏗️ CHECK 3.111 — Πύλη των πράξεων έργου (ADR-926)',
    blocking: BLOCKING,
    healthy: [STATES.ENFORCED],
    width: 42,
    remedy: [
      'ΘΕΡΑΠΕΙΑ: νέα πράξη → γραμμή στο `PROJECT_SCOPED_ACTIONS` + γραμμή στο `PROJECT_ROLE_POLICY` + `permissionResource` στη διαδρομή.',
      '⚠️ ΜΗΝ περάσεις `projectId` από το σώμα, και ΜΗΝ βάλεις μη αναστρέψιμη πράξη στον κατάλογο.',
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, findingsIn, wiringFindings, catalogueActions, policyRows, enforcedIn,
  STATES, BLOCKING, CATALOGUE, POLICY, PURGE, PURGE_ROUTES,
};
