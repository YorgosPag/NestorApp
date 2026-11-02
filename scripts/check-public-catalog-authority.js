#!/usr/bin/env node
/**
 * CHECK 3.112 — **Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΗΣ ΔΗΜΟΣΙΑΣ ΒΙΤΡΙΝΑΣ** (ADR-923 §5.13).
 *
 * Η ΕΡΩΤΗΣΗ: «αγγίζει κάποιος το δημόσιο έγγραφο καταλόγου, το outbox του ή το ράφι του ΕΞΩ από τους δηλωμένους κατόχους;»
 *
 * 🔴 Οι κανόνες κλείνουν τον πελάτη, ΟΧΙ το Admin SDK. Ένας δεύτερος γραφέας θα έβγαζε έγγραφο που διαβάζει ανώνυμος χωρίς
 * συνθήκη δημοσίευσης, χωρίς κλειστό σχήμα και χωρίς φράχτη: ανακλημένος προμηθευτής θα ξαναφαινόταν, και το jest του γραφέα
 * θα έμενε πράσινο.
 *
 * 🔑 Ένας κανόνας, πίνακας φυλαγμένων συμβόλων: κάθε γραμμή του μητρώου = σύμβολο + οι κάτοχοί του με λόγο. Το σχήμα
 * εκτελεί την ίδια κρίση για όλα, ώστε νέο σύμβολο να είναι μία γραμμή.
 * ⚠️ Μετρούνται χρήσεις στο AST: σχόλιο που ονομάζει το σύμβολο και ο ορισμός του στο δικό του αρχείο δεν είναι χρήση.
 *
 * Μόνο στο `src/`, εκτός tests: το κρίνει το κοινό `scanScope`. @see docs/gates/3.112.md
 */

'use strict';

const ast = require('./lib/write-authority/ast');
const { defineRegistryGate } = require('./lib/write-authority/gate-runner');
const { openGateInput } = require('./lib/gate-input');

const { ts, PROJECT_ROOT, calleeName } = ast;
const REGISTRY_FILE = '.public-catalog-authority.json';
const MIN_REASON_LENGTH = 40;

const STATES = {
  OWNER: 'declared-owner-uses-symbol',
  OUTSIDE: 'public-catalog-touched-outside-owner',
  SILENT_DECLARATION: 'declared-file-does-not-do-it',
  NO_REASON: 'declaration-without-reason',
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [STATES.OUTSIDE, STATES.SILENT_DECLARATION, STATES.NO_REASON, STATES.SOURCE_DRIFT];

function loadRegistry(root, input = openGateInput({ root })) {
  return input.readJson(REGISTRY_FILE);
}

const namesOf = (registry, kind) => new Set(registry.guards.filter((guard) => guard.kind === kind).map((guard) => guard.name));

/** Χρήση ονόματος ως τιμή: όχι εισαγωγή/εξαγωγή, όχι το όνομα της ίδιας της δήλωσης. */
function isValueUse(node) {
  const { parent } = node;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isTypeReferenceNode(parent)) return false;
  return !(ts.isVariableDeclaration(parent) && parent.name === node);
}

/** Οι χρήσεις ενός αρχείου: όνομα συμβόλου → γραμμές. */
function scan(sf, registry) {
  const [members, calls, references] = ['member', 'call', 'reference'].map((kind) => namesOf(registry, kind));
  const uses = new Map();
  const note = (name, line) => uses.set(name, [...(uses.get(name) || []), line]);
  ast.walk(sf, (node) => {
    if (ts.isPropertyAccessExpression(node) && members.has(node.getText(sf))) note(node.getText(sf), ast.lineOf(sf, node));
    if (ts.isCallExpression(node) && calls.has(calleeName(node))) note(calleeName(node), ast.lineOf(sf, node));
    if (ts.isIdentifier(node) && references.has(node.text) && isValueUse(node)) note(node.text, ast.lineOf(sf, node));
  });
  return uses;
}

function findingsIn(rel, uses, registry) {
  return registry.guards.flatMap((guard) => {
    if (guard.owners[rel] !== undefined) return [];
    return (uses.get(guard.name) || []).map((line) => ({
      state: STATES.OUTSIDE,
      file: rel,
      line,
      detail: `\`${guard.name}\` εκτός δηλωμένων κατόχων (${REGISTRY_FILE})`,
    }));
  });
}

function judgeOwner(guard, file, reason, usesOf) {
  if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) {
    return { state: STATES.NO_REASON, file, detail: `\`${guard.name}\`: δήλωση χωρίς λόγο ≥ ${MIN_REASON_LENGTH} χαρακτήρων` };
  }
  if ((usesOf(file).get(guard.name) || []).length === 0) {
    return { state: STATES.SILENT_DECLARATION, file, detail: `δηλωμένο για \`${guard.name}\` αλλά δεν το χρησιμοποιεί πια` };
  }
  return { state: STATES.OWNER, file };
}

/** Κάθε δήλωση κρίνεται και για αρχείο εκτός προφίλτρου: ποτέ σιωπή. */
function declaredFindings(root, registry, factsByFile, input = openGateInput({ root })) {
  const usesOf = (file) => factsByFile.get(file) || new Map();
  return registry.guards.flatMap((guard) => Object.entries(guard.owners).map(([file, reason]) => (
    input.exists(file)
      ? judgeOwner(guard, file, reason, usesOf)
      : { state: STATES.SOURCE_DRIFT, file, detail: `δηλωμένο για \`${guard.name}\` αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ` }
  )));
}

function relevancePattern(registry) {
  const names = registry.guards.map((guard) => guard.name.split('.').pop());
  return new RegExp(names.join('|'));
}

const { measure, report, main } = defineRegistryGate({
  check: '3.112',
  skipEnv: 'SKIP_PUBLIC_CATALOG_AUTHORITY',
  ok: 'η δημόσια βιτρίνα έχει ΕΝΑΝ γραφέα, ΕΝΑ outbox και ΜΙΑ πόρτα μέσων',
  projectRoot: PROJECT_ROOT, loadRegistry, relevant: relevancePattern, scan, findingsIn, declaredFindings, states: STATES,
  report: {
    title: '🛒 CHECK 3.112 — Πύλη του ενός γραφέα της δημόσιας βιτρίνας (ADR-923 §5.13)',
    blocking: BLOCKING,
    healthy: [STATES.OWNER],
    width: 38,
    remedy: [
      `ΘΕΡΑΠΕΙΑ: το δημόσιο έγγραφο αλλάζει ΜΟΝΟ με σημείωση στο outbox, και το αδειάζει ο \`drainPublicModel\`. Νέος κάτοχος`,
      `συμβόλου = γραμμή στο ${REGISTRY_FILE}, με λόγο.`,
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = { measure, report, main, loadRegistry, STATES, BLOCKING, REGISTRY_FILE };
