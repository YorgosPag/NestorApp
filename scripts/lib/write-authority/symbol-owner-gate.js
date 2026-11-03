/**
 * Η πύλη **«σύμβολο → δηλωμένοι κάτοχοι, με λόγο»** — η κρίση πίσω από τα CHECK 3.112 (δημόσια βιτρίνα, ADR-923 §5.13)
 * και 3.113 (υπεργολαβία, ADR-928). Ένα μητρώο JSON: κάθε γραμμή του `guards` = σύμβολο (`member` · `call` · `reference`)
 * και τα μόνα αρχεία που επιτρέπεται να το χρησιμοποιούν, το καθένα με λόγο. Η πύλη μετρά **χρήσεις στο AST** (σχόλιο που
 * ονομάζει το σύμβολο και ο ορισμός του δεν είναι χρήση) και κρίνει και τις **δηλώσεις** (λόγος · αρχείο που υπάρχει ·
 * αρχείο που το κάνει ακόμη).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-11-03, ADR-928 Φ1): η 3.113 θα ήταν αντίγραφο της 3.112 με άλλο μητρώο — ακριβώς ο κλώνος που μετρά
 * το CHECK 3.28. Ένα module, δύο καταναλωτές (κανόνας N.18· ίδιο σκεπτικό με το `gate-runner`).
 */

'use strict';

const ast = require('./ast');
const { defineRegistryGate } = require('./gate-runner');
const { openGateInput } = require('../gate-input');

const { ts, PROJECT_ROOT, calleeName } = ast;
const MIN_REASON_LENGTH = 40;

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

function relevancePattern(registry) {
  const names = registry.guards.map((guard) => guard.name.split('.').pop());
  return new RegExp(names.join('|'));
}

/**
 * `spec` = `{ check, skipEnv, ok, registryFile, outsideState, report: { title, width, remedy }, extraFindings? }`.
 * `extraFindings(root, input, STATES)` — έλεγχοι εκτός `src/` (π.χ. η λίστα εγγραφής του MCP), ίδιες καταστάσεις.
 */
function defineSymbolOwnerGate(spec) {
  const STATES = {
    OWNER: 'declared-owner-uses-symbol',
    OUTSIDE: spec.outsideState,
    SILENT_DECLARATION: 'declared-file-does-not-do-it',
    NO_REASON: 'declaration-without-reason',
    SOURCE_DRIFT: 'source-drift',
  };
  const BLOCKING = [STATES.OUTSIDE, STATES.SILENT_DECLARATION, STATES.NO_REASON, STATES.SOURCE_DRIFT];
  const loadRegistry = (root, input = openGateInput({ root })) => input.readJson(spec.registryFile);

  const findingsIn = (rel, uses, registry) => registry.guards.flatMap((guard) => {
    if (guard.owners[rel] !== undefined) return [];
    return (uses.get(guard.name) || []).map((line) => ({
      state: STATES.OUTSIDE, file: rel, line, detail: `\`${guard.name}\` εκτός δηλωμένων κατόχων (${spec.registryFile})`,
    }));
  });

  const judgeOwner = (guard, file, reason, usesOf) => {
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) {
      return { state: STATES.NO_REASON, file, detail: `\`${guard.name}\`: δήλωση χωρίς λόγο ≥ ${MIN_REASON_LENGTH} χαρακτήρων` };
    }
    if ((usesOf(file).get(guard.name) || []).length === 0) {
      return { state: STATES.SILENT_DECLARATION, file, detail: `δηλωμένο για \`${guard.name}\` αλλά δεν το χρησιμοποιεί πια` };
    }
    return { state: STATES.OWNER, file };
  };

  /** Κάθε δήλωση κρίνεται και για αρχείο εκτός προφίλτρου: ποτέ σιωπή. */
  const declaredFindings = (root, registry, factsByFile, input = openGateInput({ root })) => {
    const usesOf = (file) => factsByFile.get(file) || new Map();
    const declared = registry.guards.flatMap((guard) => Object.entries(guard.owners).map(([file, reason]) => (
      input.exists(file)
        ? judgeOwner(guard, file, reason, usesOf)
        : { state: STATES.SOURCE_DRIFT, file, detail: `δηλωμένο για \`${guard.name}\` αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ` }
    )));
    return spec.extraFindings ? [...declared, ...spec.extraFindings(root, input, STATES)] : declared;
  };

  const gate = defineRegistryGate({
    check: spec.check,
    skipEnv: spec.skipEnv,
    ok: spec.ok,
    projectRoot: PROJECT_ROOT, loadRegistry, relevant: relevancePattern, scan, findingsIn, declaredFindings, states: STATES,
    report: { ...spec.report, blocking: BLOCKING, healthy: [STATES.OWNER] },
  });
  return { ...gate, loadRegistry, STATES, BLOCKING, REGISTRY_FILE: spec.registryFile };
}

module.exports = { defineSymbolOwnerGate, MIN_REASON_LENGTH };
