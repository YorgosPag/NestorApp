#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.102 — Η ΠΥΛΗ ΤΗΣ ΑΡΧΗΣ ΤΗΣ ΣΤΟΙΒΑΣ ΟΡΟΦΩΝ (ADR-910)
 * =============================================================================
 *
 * «Γεννά, σβήνει ή αλλάζει τη ΘΕΣΗ ενός ορόφου κάποιος ΕΞΩ από το σύνορο της στοίβας;»
 *
 * 🔴 ΓΙΑΤΙ (μετρημένο 2026-10-10): δύο έγγραφα «Ισόγειο» στο ίδιο κτίριο. Ο κανόνας μοναδικότητας υπήρχε, αλλά
 * (α) ήταν «διάβασε, μετά γράψε» χωρίς συναλλαγή, (β) η επανατοποθέτηση ειδικών σταθμών έγραφε `number` χωρίς να
 * τον ρωτήσει, (γ) ο MCP server επέτρεπε απευθείας εγγραφή στο `floors`. Το σύνορο (`floor-stack-authority.ts`)
 * τα κλείνει — αυτή η πύλη εμποδίζει τον ΕΠΟΜΕΝΟ γραφέα να τα ξανανοίξει.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ (κάθε ένα δική του γραμμή) ────────────────────────────────────────────
 *  Κ1 γέννηση/αφαίρεση ορόφου (`createEntity('floor'` · `executeDeletion(…'floor'` · `.set/.create/.delete` σε
 *     `COLLECTIONS.FLOORS`) ΜΟΝΟ στους δηλωμένους γραφείς
 *  Κ2 εγγραφή πεδίου ΘΕΣΗΣ (`number` · `kind` · `name` · `buildingId`) σε όροφο ΜΟΝΟ στους δηλωμένους γραφείς·
 *     αδιαφανής εγγραφή (`update(μεταβλητή)`) σε όροφο = εύρημα· `withVersionCheck` σε ορόφους ΧΩΡΙΣ συνοδό = εύρημα
 *  Κ3 εξαίρεση ΜΟΝΟ με λόγο
 *  Κ4 καλωδίωση: κάθε δηλωμένος γραφέας ρωτά ΟΝΤΩΣ το σύνορο — αλλιώς «πράσινο επειδή κανείς δεν το ρωτά»
 *  Κ5 η πόρτα απευθείας εγγραφής (MCP `WRITE_ALLOWED_COLLECTIONS`) μένει ΚΛΕΙΣΤΗ για το `floors`
 *
 * 🔓 Εξαίρεση ΜΟΝΟ με λόγο, στη γραμμή πάνω: `// floor-stack-authority-exempt: <λόγος>`.
 *
 * @see ADR-910 · docs/gates/3.102.md · αδελφές: CHECK 3.87 · 3.88 · 3.89
 */

'use strict';

const ast = require('./lib/write-authority/ast');
const { openGateInput } = require('./lib/gate-input');
const { defineScanGate } = require('./lib/write-authority/gate-runner');

const { ts, PROJECT_ROOT } = ast;
const FLOORS = 'COLLECTIONS.FLOORS';

const AUTHORITY = 'src/app/api/floors/floor-stack-authority.ts';
const BIRTH = 'src/app/api/floors/floor-birth.ts';
const REMOVAL = 'src/app/api/floors/floor-removal.ts';
const COMPANION = 'src/app/api/floors/floor-slot-companion.ts';
const RECONCILE = 'src/app/api/floors/floor-stack-reconcile.service.ts';
const HANDLERS = 'src/app/api/floors/floors.handlers.ts';
const DIRECT_WRITE_DOOR = 'mcp-server/src/security/access-control.ts';

/** Κάθε δηλωμένος γραφέας, με το πώς ΑΠΟΔΕΙΚΝΥΕΙ ότι ρωτά το σύνορο (Κ4). Κλειστό σύνολο. */
const STACK_WRITERS = {
  [AUTHORITY]: 'transaction.get(lockRef)',
  [BIRTH]: 'withFloorStack(',
  [REMOVAL]: 'withFloorStack(',
  [COMPANION]: 'openFloorStack(',
  [RECONCILE]: 'withFloorStack(',
  [HANDLERS]: 'floorSlotCompanion(',
};

/** Τα πεδία που ορίζουν ΠΟΙΑ θέση πιάνει ένας όροφος και σε ΠΟΙΑ στοίβα. */
const SLOT_FIELDS = new Set(['number', 'kind', 'name', 'buildingId']);
const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete']);
const CLIENT_WRITES = { setDoc: 'set', updateDoc: 'update', deleteDoc: 'delete', addDoc: 'create' };
const exemptions = ast.exemptionsFor('floor-stack-authority-exempt');

const STATES = {
  STACK_WRITER: 'declared-stack-writer',
  EXEMPT: ast.EXEMPTION_STATES.EXEMPT,
  BORN_OUTSIDE: 'floor-born-outside-boundary',
  REMOVED_OUTSIDE: 'floor-removed-outside-boundary',
  SLOT_WRITE: 'slot-field-written-outside-boundary',
  OPAQUE_WRITE: 'opaque-floor-write-outside-boundary',
  NO_COMPANION: 'versioned-floor-update-without-companion',
  BOUNDARY_UNASKED: 'stack-boundary-unasked',
  DIRECT_DOOR_OPEN: 'direct-write-door-open',
  EXEMPT_NO_REASON: ast.EXEMPTION_STATES.EXEMPT_NO_REASON,
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [
  STATES.BORN_OUTSIDE, STATES.REMOVED_OUTSIDE, STATES.SLOT_WRITE, STATES.OPAQUE_WRITE, STATES.NO_COMPANION,
  STATES.BOUNDARY_UNASKED, STATES.DIRECT_DOOR_OPEN, STATES.EXEMPT_NO_REASON, STATES.SOURCE_DRIFT,
];

const DETAIL = {
  [STATES.BORN_OUTSIDE]: `γεννά όροφο έξω από το σύνορο — κάλεσε το \`writeFloorBirth\` (${BIRTH})`,
  [STATES.REMOVED_OUTSIDE]: `σβήνει όροφο έξω από το σύνορο — κάλεσε το \`removeFloor\` (${REMOVAL})`,
  [STATES.SLOT_WRITE]: `γράφει πεδίο θέσης ορόφου έξω από το σύνορο — πέρασε από το \`withFloorStack\` (${AUTHORITY})`,
  [STATES.OPAQUE_WRITE]: 'γράφει σε όροφο περιεχόμενο που η πύλη δεν βλέπει (όχι object literal) — γράψε ρητά τα πεδία, ή εξαίρεση με λόγο',
  [STATES.NO_COMPANION]: `\`withVersionCheck\` σε ορόφους χωρίς \`companion\` — πέρασε το \`floorSlotCompanion\` (${COMPANION})`,
};

/** Μια εγγραφή σε έγγραφο ορόφων: ποια πράξη, και τι περιεχόμενο. `null` ⇒ η κλήση δεν γράφει σε όροφο. */
function floorWriteOf(call, refs) {
  const callee = call.expression;
  if (ts.isIdentifier(callee) && CLIENT_WRITES[callee.text]) {
    return ast.refersTo(call.arguments[0], refs, FLOORS)
      ? { method: CLIENT_WRITES[callee.text], call, data: call.arguments[1] } : null;
  }
  if (!ts.isPropertyAccessExpression(callee) || !WRITE_METHODS.has(callee.name.text)) return null;
  const method = callee.name.text;
  if (ast.chainNodes(callee.expression).some((n) => ast.isCollectionOf(n, FLOORS) || ast.isDocOf(n, FLOORS))
    || (ts.isIdentifier(callee.expression) && refs.has(callee.expression.text))) {
    return { method, call, data: call.arguments[0] };
  }
  return ast.refersTo(call.arguments[0], refs, FLOORS) ? { method, call, data: call.arguments[1] } : null;
}

/**
 * Το περιεχόμενο μιας εγγραφής, κοιτώντας **μέσα** από τη ΜΙΑ σφραγίδα έκδοσης του έργου:
 * `versionedWrite(before, { …πεδία }, userId).data` γράφει τα πεδία του δεύτερου ορίσματος (+ `_v`/`updatedAt`).
 */
function writtenFields(data) {
  if (data && ts.isPropertyAccessExpression(data) && data.name.text === 'data' && ast.isCallTo(data.expression, 'versionedWrite')) {
    return data.expression.arguments[1];
  }
  return data;
}

/** Τι παραβιάζει αυτή η εγγραφή σε όροφο — ή `null` όταν δεν αγγίζει τη στοίβα (π.χ. μόνο `elevation`). */
function violationOf(write) {
  if (write.method === 'delete') return STATES.REMOVED_OUTSIDE;
  if (ast.isCreation(write.call, write.method)) return STATES.BORN_OUTSIDE;
  const keys = ast.literalKeys(writtenFields(write.data));
  if (keys === null) return STATES.OPAQUE_WRITE;
  return keys.some((key) => SLOT_FIELDS.has(key)) ? STATES.SLOT_WRITE : null;
}

/** `withVersionCheck({ collection: COLLECTIONS.FLOORS, … })` — έχει συνοδό; `null` ⇒ δεν αφορά ορόφους. */
function versionedFloorUpdate(call) {
  if (!ast.isCallTo(call, 'withVersionCheck')) return null;
  const options = call.arguments[0];
  if (!options || !ts.isObjectLiteralExpression(options)) return null;
  const property = (name) => options.properties.find((p) => p.name && p.name.getText() === name);
  const collection = property('collection');
  if (!collection || !ts.isPropertyAssignment(collection) || collection.initializer.getText() !== FLOORS) return null;
  return property('companion') ? null : STATES.NO_COMPANION;
}

/** Η γενική είσοδος γέννησης/αφαίρεσης: `createEntity('floor', …)` · `executeDeletion(db, 'floor', …)`. */
function entityDoorOf(call) {
  const isFloor = (arg) => arg && /^['"]floor['"]$/.test(arg.getText());
  if (ast.isCallTo(call, 'createEntity') && isFloor(call.arguments[0])) return STATES.BORN_OUTSIDE;
  if (ast.isCallTo(call, 'executeDeletion') && call.arguments.some(isFloor)) return STATES.REMOVED_OUTSIDE;
  return null;
}

function classify(sf, node, rel, state) {
  if (STACK_WRITERS[rel]) return { state: STATES.STACK_WRITER, file: rel };
  return exemptions.classify(sf, node, rel, state, DETAIL[state]);
}

/** Κ1 + Κ2 + Κ3 για ένα αρχείο. */
function findingsIn(sf, rel) {
  const findings = [];
  const refs = ast.refIdentifiersOf(sf, FLOORS);
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const write = floorWriteOf(node, refs);
      const state = entityDoorOf(node) || versionedFloorUpdate(node) || (write && violationOf(write));
      if (state) findings.push(classify(sf, node, rel, state));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

/** Κ4 + Κ5 + ύπαρξη δηλωμένων αρχείων. */
function wiringFindings(root, input = openGateInput({ root })) {
  const findings = [];
  const read = (rel) => input.read(rel);
  for (const [writer, proof] of Object.entries(STACK_WRITERS)) {
    const text = read(writer);
    if (text === null) findings.push({ state: STATES.SOURCE_DRIFT, file: writer, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
    else if (!text.includes(proof)) {
      findings.push({ state: STATES.BOUNDARY_UNASKED, file: writer,
        detail: `δηλωμένος γραφέας που ΔΕΝ ρωτά το σύνορο (λείπει \`${proof}\`)` });
    }
  }
  const door = read(DIRECT_WRITE_DOOR);
  if (door === null) findings.push({ state: STATES.SOURCE_DRIFT, file: DIRECT_WRITE_DOOR, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
  else if (directDoorOpen(door)) {
    findings.push({ state: STATES.DIRECT_DOOR_OPEN, file: DIRECT_WRITE_DOOR,
      detail: 'το `floors` είναι στο `WRITE_ALLOWED_COLLECTIONS` — απευθείας εγγραφή παρακάμπτει το σύνορο' });
  }
  return findings;
}

/** Είναι το `'floors'` μέλος του συνόλου εγγραφής του MCP; (AST: ένα σχόλιο που το ονομάζει δεν μετρά.) */
function directDoorOpen(text) {
  const sf = ast.sourceFileOf(DIRECT_WRITE_DOOR, text);
  let open = false;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === 'WRITE_ALLOWED_COLLECTIONS' && node.initializer) {
      const members = (n) => {
        if (ts.isStringLiteral(n) && n.text === 'floors') open = true;
        ts.forEachChild(n, members);
      };
      members(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return open;
}

const RELEVANT = /COLLECTIONS\.FLOORS|createEntity\(|executeDeletion\(/;

const { measure, report, main } = defineScanGate({
  projectRoot: PROJECT_ROOT, relevant: RELEVANT, findingsIn, wiringFindings, states: STATES,
  check: '3.102', skipEnv: 'SKIP_FLOOR_STACK_AUTHORITY',
  ok: 'κάθε αλλαγή της στοίβας ορόφων περνά από το σύνορο',
  report: {
    title: '🏢 CHECK 3.102 — Πύλη της αρχής της στοίβας ορόφων (ADR-910)',
    blocking: BLOCKING,
    healthy: [STATES.STACK_WRITER, STATES.EXEMPT],
    width: 42,
    remedy: [
      'ΘΕΡΑΠΕΙΑ: νέος όροφος → `writeFloorBirth` · αφαίρεση → `removeFloor` · αριθμός/είδος/όνομα →',
      '`withFloorStack` ή ο συνοδός `floorSlotCompanion`. ⚠️ ΜΗΝ προσθέσεις γραφέα στο STACK_WRITERS «επειδή βολεύει».',
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, findingsIn, wiringFindings, directDoorOpen,
  STATES, BLOCKING, STACK_WRITERS, AUTHORITY, BIRTH, REMOVAL, HANDLERS, DIRECT_WRITE_DOOR,
};
