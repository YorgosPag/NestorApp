#!/usr/bin/env node
'use strict';
/**
 * **Εξαγωγή του συμβολαίου στο αποθετήριο του κινητού** (ADR-904 Ε6) — vendored αντίγραφο + προέλευση.
 *
 * Πρότυπο Uber (κοινά IDL **vendored** στα μονοαποθετήρια κινητού, όχι submodule): το αποθετήριο του κινητού κρατά
 * αντίγραφο του `contracts/capture-api/` και ένα `PROVENANCE.json` που λέει **από ποιο commit** του Νέστορα ήρθε και
 * με ποιο **sha256** ανά αρχείο. Το CI του κινητού ξαναϋπολογίζει τα sha256 — χειρόγραφη αλλαγή στο αντίγραφο = κόκκινο.
 *
 * ⛔ Αρνείται να εξαγάγει μπαγιάτικο συμβόλαιο (CHECK 3.98 πρέπει να είναι πράσινο) — αλλιώς ο πελάτης θα χτιζόταν
 * πάνω σε κάτι που ο διακομιστής δεν λέει πια.
 *
 * CLI: npm run capture-api-contract:export -- <διαδρομή αποθετηρίου κινητού>
 *      (γράφει στο <διαδρομή>/contract/)
 */

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { judge } = require('./check-capture-api-contract');
const { OUTPUT_ROOT } = require('./lib/capture-api-contract/plan');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = 'contract';
const FILES = ['openapi.json', 'fixtures.json'];

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/** Το commit του Νέστορα και αν το συμβόλαιο έχει αλλαγές που **δεν** είναι ακόμη σε commit. */
function sourceRevision() {
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  return { commit: git('rev-parse', 'HEAD'), uncommitted: git('status', '--porcelain', '--', OUTPUT_ROOT).length > 0 };
}

/** Τα bytes με LF — ίδιο sha256 σε Windows (autocrlf) και Linux CI. */
const readLfBytes = (abs) => Buffer.from(fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n'), 'utf8');

function exportTo(mobileRepo) {
  const freshness = judge(ROOT);
  if (!freshness.ok) throw new Error('το συμβόλαιο είναι μπαγιάτικο — τρέξε πρώτα: npm run generate:capture-api-contract');
  const outDir = path.join(mobileRepo, TARGET_DIR);
  fs.mkdirSync(outDir, { recursive: true });
  const hashes = {};
  for (const name of FILES) {
    const bytes = readLfBytes(path.join(ROOT, OUTPUT_ROOT, name));
    fs.writeFileSync(path.join(outDir, name), bytes);
    hashes[name] = sha256(bytes);
  }
  const { info } = JSON.parse(fs.readFileSync(path.join(outDir, 'openapi.json'), 'utf8'));
  const provenance = { contractVersion: info.version, source: { repository: 'nestor', path: OUTPUT_ROOT, ...sourceRevision() }, sha256: hashes };
  fs.writeFileSync(path.join(outDir, 'PROVENANCE.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  return { outDir, provenance };
}

/**
 * Ο στόχος είναι **άλλο** αποθετήριο: απόλυτη διαδρομή, **έξω** από το Νέστορα. Μετρημένο 2026-10-03: το bash
 * έφαγε το `\` και το `C:\nestor-mobile` έφτασε ως `C:nestor-mobile` (σχετική στον δίσκο) ⇒ το `path.resolve` το
 * έλυσε **μέσα** στο Νέστορα και η εξαγωγή έγραψε εκεί σιωπηλά.
 */
function targetRefusal(target) {
  if (!path.isAbsolute(target)) return `η διαδρομή «${target}» δεν είναι απόλυτη`;
  const relative = path.relative(ROOT, path.resolve(target));
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return `η διαδρομή «${target}» είναι μέσα στο αποθετήριο του Νέστορα — ο στόχος είναι το αποθετήριο του κινητού`;
  }
  return null;
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Χρήση: npm run capture-api-contract:export -- <διαδρομή αποθετηρίου κινητού>');
    process.exit(2);
  }
  const refusal = targetRefusal(target);
  if (refusal) {
    console.error(`❌ ${refusal}`);
    process.exit(2);
  }
  try {
    const { outDir, provenance } = exportTo(path.resolve(target));
    console.log(`✅ συμβόλαιο ${provenance.contractVersion} → ${outDir}`);
    if (provenance.source.uncommitted) console.log('⚠️  το συμβόλαιο έχει αλλαγές εκτός commit — η προέλευση το δηλώνει (uncommitted: true).');
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { exportTo, targetRefusal };
