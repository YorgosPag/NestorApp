#!/usr/bin/env node
/**
 * CHECK 3.103 — Η ΠΥΛΗ ΤΟΥ ΜΕΛΑΝΙΟΥ (ADR-909 §6.9 · Γ2.8).
 * «Βάζει αυτός ο ζωγράφος χρώμα ή πάχος στον καμβά ΧΩΡΙΣ να ρωτήσει την πολιτική εκτύπωσης;»
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ (μετρημένο 2026-10-09)**: τα Υδραυλικά έβγαιναν **μπλε** σε «Ασπρόμαυρη» δημόσια κάτοψη — ζωγράφοι
 *    με ωμό `ctx.strokeStyle`. Η πύλη pixels (CHECK 3.101) το έπιασε **μόνο** επειδή το σχέδιο είχε θερμοσίφωνα: βλέπει
 *    ό,τι υπάρχει στο δείγμα της και ό,τι αφήνει το προφίλ. Στέγη, θεμέλιο, οπλισμό, καλώδια ΔΕΝ τα βλέπει ποτέ.
 * 🔑 Αυτή η πύλη διαβάζει τον **ΚΩΔΙΚΑ**: ο ανιχνευτής (`lib/paper-ink/detect.js`, AST) αποδεικνύει ότι η τιμή
 *    κατάγεται από εγκεκριμένη συνάρτηση· ο κριτής (`lib/paper-ink/judge.js`) τη συγκρίνει με το μητρώο.
 * ⛔ ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ στη ζώνη `strict` (εξαίρεση μόνο με λόγο) · 🔴 RATCHET κατά ταυτότητα στη ζώνη `ratchet`.
 *
 * CLI:
 *   node scripts/check-paper-ink.js                  # κρίση (πάντα πλήρης — ~1 s)
 *   node scripts/check-paper-ink.js --report
 *   node scripts/check-paper-ink.js --write-baseline
 *
 * Env: SKIP_PAPER_INK=1 · PAPER_INK_ROOT (fixtures των tests)
 */

'use strict';

const path = require('node:path');

const ratchet = require('./lib/ratchet-baseline');
const { walkScope } = require('./lib/i18n-raw-fallback/ratchet');
const { openGateInput } = require('./lib/gate-input');
const { sourceFileOf, ts } = require('./lib/write-authority/ast');
const { findSinkAssignments, SINKS } = require('./lib/paper-ink/detect');
const { judge, STATES } = require('./lib/paper-ink/judge');

const ROOT = process.env.PAPER_INK_ROOT || ratchet.PROJECT_ROOT;
const REGISTRY_FILE = path.join(ROOT, '.paper-ink-registry.json');
const BASELINE_FILE = path.join(ROOT, '.paper-ink-baseline.json');
/** Πρόφιλτρο ΧΩΡΙΣ απώλεια: εύρημα απαιτεί το όνομα ενός νεροχύτη στο κείμενο. */
const SINK_NAME = new RegExp([...SINKS].join('|'));

function readRegistry(input) {
  const registry = input.readJson(REGISTRY_FILE);
  for (const key of ['approved', 'kinds', 'zones', 'exceptions']) {
    if (typeof registry[key] !== 'object' || registry[key] === null) throw new Error(`μητρώο χωρίς «${key}»`);
  }
  return registry;
}

/** Εξάγει το αρχείο ένα όνομα ως συνάρτηση ή σταθερά; (AST — ένα σχόλιο που το ονομάζει δεν μετρά) */
function exportsName(file, name, input) {
  const text = input.read(file);
  if (text === null) return false;
  const exported = (st) => (st.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  return sourceFileOf(path.join(ROOT, file), text).statements.some((st) => exported(st) && (
    (ts.isFunctionDeclaration(st) && st.name && st.name.text === name)
    || (ts.isVariableStatement(st) && st.declarationList.declarations.some((d) => d.name.getText() === name))));
}

function scanZones(registry, input) {
  const approved = new Set(Object.keys(registry.approved));
  const scanned = [];
  for (const [zone, dirs] of Object.entries(registry.zones)) {
    for (const file of dirs.flatMap((dir) => walkScope(ROOT, dir, input))) {
      const text = input.read(file);
      if (SINK_NAME.test(text)) scanned.push({ file, zone, assignments: findSinkAssignments(text, file, approved) });
    }
  }
  return scanned;
}

/** `opts.input` = η είσοδος της πύλης (ADR-924· προεπιλογή ο δίσκος της `ROOT`, το `main` δίνει την όψη του commit). */
function measure(opts = {}) {
  const input = opts.input || openGateInput({ root: ROOT });
  const registry = readRegistry(input);
  const missing = Object.entries(registry.approved)
    .filter(([name, home]) => !exportsName(home, name, input))
    .map(([name, home]) => `${name} — το ${home} δεν το εξάγει`);
  return { ...judge(registry, scanZones(registry, input), missing), zones: registry.zones };
}

function printReport(m) {
  const { assignments, proven, strict, ratchet: unjudged } = m.tally;
  console.log(`📋 CHECK 3.103 — αναθέσεις νεροχύτη: ${assignments} · αποδεδειγμένες: ${proven}`);
  console.log(`   ⛔ ζώνη strict  (${m.zones.strict.join(' · ')})`);
  console.log(`      αναπόδεικτες ${strict} = δηλωμένες εξαιρέσεις ${m.declarations.length} + αδήλωτες`
    + ` ${m.refused.filter((r) => r.state === STATES.UNDECLARED).length}`);
  for (const [kind, n] of Object.entries(m.byKind).sort()) console.log(`        · ${kind.padEnd(14)} ${n}`);
  console.log(`   🔴 ζώνη ratchet (${m.zones.ratchet.join(' · ')})`);
  console.log(`      ΔΕΝ ΚΡΙΘΗΚΑΝ ${unjudged} — ο αριθμός είναι απογραφή, όχι «καθαρό»`);
  // ⚠️ Κάθε άρνηση τυπώνεται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ: «0» που δεν τυπώνεται διαβάζεται «δεν υπάρχει τέτοιος έλεγχος».
  for (const state of Object.values(STATES)) {
    const rows = m.refused.filter((r) => r.state === state);
    console.log(`   ⛔ ${state.padEnd(18)} ${rows.length}`);
    for (const r of rows) console.log(`        ${r.detail}`);
  }
}

/** ⚠️ Το `runSetRatchetCli` αρνείται ΠΡΙΝ φτάσει εδώ (`refusals`) — οι αρνήσεις δεν μπαίνουν ποτέ σε baseline. */
function buildPayload(m) {
  return {
    $doc: 'CHECK 3.103 / ADR-909 §6.9 — ΡΑΤΣΕΤΑ ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ. `violations` = αναθέσεις της ζώνης ratchet που ΔΕΝ '
      + 'ΚΡΙΘΗΚΑΝ (απογραφή, όχι «καθαρό»)· `declarations` = οι εξαιρέσεις με λόγο της ζώνης strict. Μόνο μειώνονται.',
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

const DESCRIPTOR = {
  adr: 'ADR-909 §6.9 (CHECK 3.103)',
  skipEnv: 'SKIP_PAPER_INK',
  baselineFile: BASELINE_FILE,
  root: ROOT,
  labels: { violations: 'αναθέσεις που δεν κρίθηκαν', declarations: 'εξαιρέσεις με λόγο' },
  commands: { report: 'npm run paper-ink:report', baseline: 'npm run paper-ink:baseline', seed: 'npm run paper-ink:baseline' },
  measure: (_args, input) => measure({ input }),
  buildPayload,
  printReport,
  refusals: (m) => m.refused.map((r) => `${r.state}: ${r.detail}`),
  violationId: (f) => f.id,
  messages: {
    worse: 'νέα ανάθεση χρώματος / πάχους που δεν ρωτά την πολιτική εκτύπωσης',
    newDeclLabel: 'νέα εξαίρεση',
    newDeclAdvice: [
      'Η εξαίρεση είναι για ό,τι ΔΕΝ είναι μελάνι στο χαρτί (chrome, μάσκα) ή παίρνει την τιμή από τον καλούντα.',
      'Γραμμή ΠΕΡΙΕΧΟΜΕΝΟΥ δεν εξαιρείται: πέρασέ την από `applyLiveStroke` / `liveStrokeInk` / `liveStrokeWidthPx`.',
    ],
  },
};

if (require.main === module) ratchet.runSetRatchetCli(DESCRIPTOR);

module.exports = { measure, buildPayload, printReport, exportsName, DESCRIPTOR };
