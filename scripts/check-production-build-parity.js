#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.57 (ADR-788) — ΚΑΘΕ PRODUCTION BUILD ΧΤΙΖΕΙ ΤΟΝ ΙΔΙΟ SERVER
 * =============================================================================
 *
 * Το σκεπτικό, οι μετρήσεις και τα απορριφθέντα κριτήρια ζουν στο
 * `scripts/lib/build-parity/parity.js` — εδώ μένει μόνο η εκτέλεση.
 *
 * **ΔΕΝ είναι ratchet — καμία baseline, ποτέ.** Δεν υπάρχει «λιγότερα builds με
 * λάθος περιβάλλον από χθες»: **ένα** αρκεί για να μετρήσει μια πύλη τον λάθος
 * server και να το πει «καθαρό».
 *
 * Layer 1 = pre-commit με σκανδάλη **μέσα στην πύλη** (~0,1s· τρέχει μόνο όταν
 *            είναι σταδιοποιημένο workflow / τοπική ενέργεια / το μητρώο tiers
 *            / η ίδια η πύλη).
 * Layer 2 = job στο **υπάρχον** `ci-gate-tiers.yml`, **άνευ όρων** — το μητρώο
 *            tiers και τα workflows αλλάζουν ανεξάρτητα, και η ταυτότητα της
 *            κανονικής κλήσης εξαρτάται **και από τα δύο**.
 *
 * Escape: `SKIP_BUILD_PARITY=1`
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const P = require('./lib/build-parity/parity');

const CHECK = 'CHECK 3.57 (ADR-788)';
const PROJECT_ROOT = path.join(__dirname, '..');
const REGISTRY = path.join(PROJECT_ROOT, '.ci-gate-tiers.json');

const DIM = '\x1b[2m';
const NC = '\x1b[0m';

function measure(projectRoot = PROJECT_ROOT) {
  const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, '.ci-gate-tiers.json'), 'utf8'));
  const tier1 = P.tierOneFiles(registry);
  const callers = P.findBuildCallers(projectRoot);
  const { records, canonical } = P.judge(callers, tier1);
  return { records, canonical, byState: P.census(records), tier1: [...tier1] };
}

function badge(state) {
  if (P.BLOCKING.includes(state)) return '⛔';
  if (P.COUNTED.includes(state)) return '🔶';
  return '✅';
}

function report(measured) {
  console.log(`\n${CHECK} — χτίζουν όλοι τον ίδιο server;\n`);
  for (const [state, count] of Object.entries(measured.byState)) {
    console.log(`    ${badge(state)} ${state.padEnd(24)}${String(count).padStart(4)}`);
  }
  console.log('');
  for (const record of measured.records) {
    console.log(`    ${badge(record.state)} ${record.file}${record.job === '—' ? '' : ` (${record.job})`}`);
    console.log(`       ${DIM}${record.detail}${NC}`);
  }
  console.log('');
}

/**
 * ⚠️ Η **προτιμώμενη** διόρθωση δηλώνεται ρητά και είναι «μην ξαναχτίσεις», όχι
 * «αντίγραψε τις μεταβλητές»: το δεύτερο διαχειρίζεται την απόκλιση, το πρώτο την
 * κάνει αδύνατη. Μια πύλη που δείχνει τη λάθος θεραπεία θεσμοθετεί το πρόβλημα.
 */
function printOffenders(measured, offenders) {
  console.error(`\n❌ ${CHECK} — build που ΔΕΝ παράγει τον server της παραγωγής\n`);
  for (const record of offenders) {
    console.error(`   🚫 ${record.file} (${record.job})  [${record.state}]`);
    console.error(`      ${record.detail}`);
  }
  console.error(`\n   Κανονική κλήση: ${measured.canonical.file} — ${Object.keys(measured.canonical.env).length} μεταβλητές.`);
  console.error('   🔑 Η ΠΡΟΤΙΜΩΜΕΝΗ διόρθωση ΔΕΝ είναι «αντίγραψε τις μεταβλητές»: είναι');
  console.error('      «μην ξαναχτίσεις». Τράβα την εικόνα που έσπρωξε το Tier 1 workflow');
  console.error('      (πρότυπο: `.github/workflows/i18n-ssr-oracle.yml`, ADR-788).\n');
  return 1;
}

function run() {
  if (process.env.SKIP_BUILD_PARITY) return 0;

  let measured;
  try {
    measured = measure();
  } catch (error) {
    console.error(`\n❌ ${CHECK} — Η ΠΥΛΗ ΑΡΝΕΙΤΑΙ ΝΑ ΑΠΟΦΑΝΘΕΙ\n   ${error.message}\n`);
    return 1;
  }

  if (process.argv.includes('--report')) {
    report(measured);
    return 0;
  }

  // ⛔ fail-closed: χωρίς κανονική κλήση δεν υπάρχει «ίδιος server» να συγκριθεί.
  if (!measured.canonical) {
    console.error(`\n❌ ${CHECK} — ΚΑΜΙΑ κανονική κλήση production build σε Tier 1 workflow\n`);
    console.error('   Το `.ci-gate-tiers.json` ορίζει ποιο workflow στέλνει στην παραγωγή.');
    console.error('   Χωρίς αυτό, «χτίζουν όλοι τον ίδιο server;» δεν έχει νόημα.\n');
    return 1;
  }

  const offenders = measured.records.filter((record) => P.BLOCKING.includes(record.state));
  if (offenders.length > 0) return printOffenders(measured, offenders);

  const counted = measured.records.filter((record) => P.COUNTED.includes(record.state)).length;
  // ⚠️ Ο 🔶 κάδος τυπώνεται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ.
  console.log(`✅ ${CHECK} — ${measured.records.length} κλήσεις build· 1 κανονική· ${counted} 🔶 περιττό/ά build ίδιου commit`);
  return 0;
}

if (require.main === module) process.exit(run());

module.exports = { measure, report, run, CHECK, REGISTRY };
