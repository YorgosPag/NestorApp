#!/usr/bin/env node
/**
 * CHECK 3.85 / ADR-861 Φ3 — ΠΥΛΗ: «είναι κάθε νομικό κείμενο μια αμετάβλητη, αποδείξιμη
 * έκδοση — και ξέρει κάθε έκδοση ποιος ήταν ο φορέας τότε;»
 *
 * Η κρίση ζει στο `scripts/lib/legal-documents/judge.js` (Κ1–Κ7)· εδώ **μόνο** το CLI.
 *
 * ⛔ **ZERO TOL, ΚΑΜΙΑ baseline.** Μια παγωμένη έκδοση που άλλαξε, ή κείμενο που αλλάζει χωρίς
 * έκδοση, δεν είναι «χρέος εκστρατείας» — είναι **ψέμα προς όποιον συναίνεσε** σε ό,τι διάβασε
 * (ADR-864 Α8). Καμία ανοχή δεν έχει νόημα.
 *
 * ⚠️ **Καμία σκανδάλη**: το πλήρες κοστίζει ~1s (3 JSON + 2 TS με transpile). Όταν το πλήρες είναι
 * φθηνό, η μερική ανάλυση είναι δεύτερη αυθεντία (πρότυπο CHECK 3.84).
 *
 * CLI:
 *   node scripts/check-legal-documents.js            # κρίση
 *   node scripts/check-legal-documents.js --report   # αναφορά χωρίς έξοδο 1
 *
 * Escape: `SKIP_LEGAL_DOCUMENTS=1` (αιτιολόγηση στον Giorgio)
 */

'use strict';

const { judgeLegalDocuments } = require('./lib/legal-documents/judge');
const { loadWorld } = require('./lib/legal-documents/world');

function report(world, findings) {
  const docs = (world.manifest && world.manifest.documents) || {};
  console.log('\n📜 CHECK 3.85 — εκδόσεις νομικών εγγράφων');
  for (const id of world.ids) {
    const rows = docs[id] || [];
    const latest = rows[rows.length - 1];
    console.log(`   ${id}: ${rows.length} έκδοση(εις)${latest ? ` · τελευταία v${latest.version} από ${latest.effectiveFrom}` : ''}`);
  }
  for (const f of findings) {
    console.error(`  ⛔ ${f.rule}: ${f.document}${f.version === null ? '' : ` v${f.version}`}\n     ${f.detail}`);
  }
}

function main(argv) {
  if (process.env.SKIP_LEGAL_DOCUMENTS) {
    console.warn('⚠️ CHECK 3.85 παρακάμφθηκε (SKIP_LEGAL_DOCUMENTS) — αιτιολόγησέ το στον Giorgio.');
    return 0;
  }
  const world = loadWorld();
  const findings = judgeLegalDocuments(world);
  report(world, findings);
  if (argv.includes('--report') || findings.length === 0) {
    if (findings.length === 0) console.log('✅ CHECK 3.85 — καθαρό');
    return 0;
  }
  console.error(`\n❌ CHECK 3.85 — ${findings.length} εύρημα(τα). Οι εκδόσεις είναι αμετάβλητες· διόρθωση = νέα έκδοση (npm run legal:freeze).`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main };
