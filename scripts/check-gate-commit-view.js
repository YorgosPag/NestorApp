#!/usr/bin/env node
/**
 * CHECK 3.107 — ΠΥΛΗ ΤΗΣ ΟΨΗΣ ΤΟΥ COMMIT (ADR-924).
 *
 * «Κρίνει αυτή η πύλη ό,τι **θα δεσμευτεί** — ή τον δίσκο, όπου ζει και η ξένη αστάδιοποίητη δουλειά;»
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-10-29): ένα commit 4 αρχείων απέτυχε τρεις φορές σε τρεις πύλες (3.6 · 3.73 ·
 * 3.85) για αλλαγές που **ΔΕΝ ήταν μέσα του** — ξένη αστάδιοποίητη δουλειά στον δίσκο. Το SSoT για
 * «κρίνε το commit» υπήρχε ήδη από 27/09 (`git-index-snapshot.js`, CHECK 3.34)· το χρησιμοποιούσαν 3
 * πύλες στις 90. Κανείς δεν ήξερε ποιες έλειπαν, γιατί κανείς δεν το ρωτούσε.
 *
 * ⚠️ RATCHET ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ: οι πύλες που ήδη κρίνουν τον δίσκο ζουν στη baseline και φεύγουν μία μία·
 * μια ΝΕΑ πύλη ρωτά το commit ή δηλώνει γιατί όχι (`.gate-commit-view.json`, λόγος ≥40).
 *
 *   node scripts/check-gate-commit-view.js [--index] [--generate-baseline]
 *   SKIP_GATE_COMMIT_VIEW=1 — ρητή παράκαμψη (αιτιολόγησέ την στον Giorgio).
 *
 * @module scripts/check-gate-commit-view
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { createCommitView } = require('./lib/git-index-snapshot');
const { takeInventory, BASELINE_FILE, DECLARATIONS_FILE, EXECUTOR } = require('./lib/gate-commit-view/inventory');
const { STATES, BLOCKING, judge, tallyOf } = require('./lib/gate-commit-view/judge');
const { measureRawReads, compareRawReads } = require('./lib/gate-commit-view/raw-reads');

const ROOT = path.resolve(__dirname, '..');
const OWN_INPUTS = new Set([EXECUTOR, DECLARATIONS_FILE, BASELINE_FILE]);

function diskSource(root) {
  // ⚠️ ΜΟΝΟ αρχεία, όπως στο ευρετήριο: φάκελος που «υπάρχει» έλυνε το `require('./x')` στον φάκελο.
  const isFile = rel => fs.statSync(path.join(root, rel), { throwIfNoEntry: false })?.isFile() === true;
  return {
    has: isFile,
    readText: rel => (isFile(rel) ? fs.readFileSync(path.join(root, rel), 'utf8') : null),
  };
}

/** Η όψη του commit — η πύλη κρίνει τον εαυτό της με τον κανόνα που επιβάλλει. */
function commitSource(root) {
  return createCommitView({ repoRoot: root, include: rel => rel.startsWith('scripts/') || OWN_INPUTS.has(rel) });
}

function report(rows, log = console.log) {
  const tally = tallyOf(rows);
  log('');
  log('🔭 CHECK 3.107 — όψη του commit (ADR-924)');
  for (const state of Object.values(STATES)) {
    log(`   ${BLOCKING.has(state) ? '⛔' : state === STATES.STALE_BASELINE ? '⬇ ' : '✅'} ${state.padEnd(24)} ${tally[state]}`);
  }
  for (const row of rows.filter(r => BLOCKING.has(r.state))) {
    log(`   ⛔ ${row.id} ${row.state}${row.script ? ` — ${row.script}` : ''}`);
  }
  const stale = rows.filter(r => r.state === STATES.STALE_BASELINE).map(r => r.id);
  if (stale.length > 0) log(`   ⬇ ${stale.join(' · ')}: εκτός χρέους πλέον — κλείδωσέ το: npm run gate-commit-view:baseline`);
  return rows.filter(r => BLOCKING.has(r.state)).length;
}

function writeBaseline(rows, rawReads) {
  const gates = rows.filter(r => r.state === STATES.BASELINE || r.state === STATES.UNDECLARED).map(r => r.id)
    .sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
  const body = {
    $doc: 'CHECK 3.107 / ADR-924 — πύλες που ΑΚΟΜΗ κρίνουν τον δίσκο. Μόνο μειώνεται: npm run gate-commit-view:baseline.',
    gates,
    $rawReads: 'ADR-924 Φ4 — ωμά σημεία ανάγνωσης fs ανά αρχείο της κλειστότητας των πυλών commit-view. Μόνο μειώνεται.',
    rawReads,
  };
  fs.writeFileSync(path.join(ROOT, BASELINE_FILE), `${JSON.stringify(body, null, 2)}\n`);
  const sites = Object.values(rawReads).reduce((sum, n) => sum + n, 0);
  console.log(`✅ ${BASELINE_FILE}: ${gates.length} πύλες · ${sites} ωμά σημεία ανάγνωσης σε ${Object.keys(rawReads).length} αρχεία`);
}

/** Το στατικό σκέλος (Φ4): νέο ωμό σημείο ανάγνωσης σε κλειστότητα πύλης commit-view ⇒ μπλοκάρει. */
function reportRawReads(baseline, current, log = console.log) {
  const sites = Object.values(current).reduce((sum, n) => sum + n, 0);
  if (baseline === null) {
    // η baseline ΑΥΤΗΣ της όψης δεν έχει ακόμη ratchet (π.χ. commit πριν σταδιοποιηθεί) — μετρά, δεν κρίνει
    log(`   ⏳ ωμά σημεία ανάγνωσης     ${sites} σε ${Object.keys(current).length} αρχεία — το ratchet οπλίζεται με τη baseline`);
    return 0;
  }
  const { grown, shrunk } = compareRawReads(current, baseline);
  log(`   ${grown.length ? '⛔' : '✅'} ωμά σημεία ανάγνωσης     ${sites} σε ${Object.keys(current).length} αρχεία`);
  for (const { file, from, to } of grown) log(`   ⛔ ${file}: ${from} → ${to} — πέρασε την είσοδο της πύλης (gate-input)`);
  if (shrunk.length > 0) log(`   ⬇ ${shrunk.length} αρχείο(α) με λιγότερα σημεία — κλείδωσέ το: npm run gate-commit-view:baseline`);
  return grown.length;
}

function main(argv = process.argv.slice(2)) {
  if (process.env.SKIP_GATE_COMMIT_VIEW === '1') {
    console.log('⏭️  CHECK 3.107 παραλείφθηκε (SKIP_GATE_COMMIT_VIEW=1)');
    return 0;
  }
  const source = argv.includes('--index') ? commitSource(ROOT) : diskSource(ROOT);
  const inventory = takeInventory(source);
  const rows = judge(inventory);
  const committed = rows.filter(r => r.state === STATES.COMMIT_VIEW && r.script.endsWith('.js')).map(r => r.script);
  const rawReads = measureRawReads(committed, source);
  if (argv.includes('--generate-baseline')) {
    writeBaseline(rows, rawReads);
    return 0;
  }
  const gateBlocking = report(rows);
  const rawBlocking = reportRawReads(inventory.rawReads, rawReads);
  if (gateBlocking > 0) {
    console.log(`\n❌ CHECK 3.107 — ${gateBlocking} πύλη(ες) κρίνουν τον δίσκο χωρίς δήλωση. Θεραπεία: πέρασε \`--index\` από τον`);
    console.log('   εκτελεστή ΚΑΙ διάβασε μέσα από το `git-index-snapshot.js` — ή δήλωσε τον λόγο στο .gate-commit-view.json.');
  }
  if (rawBlocking > 0) {
    console.log(`\n❌ CHECK 3.107 — ${rawBlocking} αρχείο(α) απέκτησαν νέο ωμό σημείο ανάγνωσης στην κλειστότητα πύλης που κρίνει`);
    console.log('   το commit. Θεραπεία: διάβασε μέσα από την είσοδο (`gate-input`) — ή δήλωσε ανάγνωση περιβάλλοντος.');
  }
  if (gateBlocking + rawBlocking > 0) return 1;
  console.log('✅ CHECK 3.107 — καμία νέα πύλη δεν κρίνει τον δίσκο σιωπηλά');
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { main, report, diskSource, commitSource };
