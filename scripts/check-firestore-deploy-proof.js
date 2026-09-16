#!/usr/bin/env node
/**
 * CHECK 3.86 / ADR-865 — ΠΥΛΗ: «ό,τι χρειάζεται ο πελάτης για να διαβάσει είναι ΑΝΕΠΤΥΓΜΕΝΟ —
 * ή μόνο γραμμένο;»
 *
 * Η κρίση ζει στο `scripts/lib/firestore-deploy/judge.js` (Κ1–Κ5)· εδώ **μόνο** το CLI.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-09-16, ADR-864 Φ1β)
 * ────────────────────────────────────────────────────────────────────────────
 * Η ενότητα «Ιστορικό» του ιδιώτη έδειχνε **κόκκινο** *«Missing or insufficient permissions»*.
 * Ο κώδικας ήταν **σωστός σε κάθε κρίκο**: σωστό βιβλίο, σωστό φίλτρο `userId`, σωστός κανόνας
 * στο `firestore.rules`, σωστός δείκτης στο `firestore.indexes.json`, σουίτα emulator 42 κελιών
 * πράσινη. Αυτό που έλειπε **δεν ήταν κώδικας — ήταν η ΑΝΑΠΤΥΞΗ**: ζωντανοί δείκτες **436**,
 * αρχείο **437**, και η **μία** διαφορά ήταν ακριβώς ο δικός μας.
 *
 * ⚠️ **ΔΕΥΤΕΡΗ ΦΟΡΑ ΣΕ ΕΞΙ ΜΕΡΕΣ.** Το ADR-845 §Ο-18 (2026-09-10) το είχε ήδη **ονομάσει** —
 * *«κανένας αυτοματισμός δεν ανεβάζει δείκτες· το push πάει στο Netcup, όχι στο Firebase»* — και
 * **δεν έφτιαξε όργανο**. Δεύτερη εμφάνιση δεν είναι ατύχημα: είναι **κενό οργάνου**.
 *
 * CLI:
 *   node scripts/check-firestore-deploy-proof.js             # commit — μπλοκ Κ1-Κ4, αναφορά Κ5
 *   node scripts/check-firestore-deploy-proof.js --at-push   # push  — μπλοκάρει ΚΑΙ ο Κ5
 *   node scripts/check-firestore-deploy-proof.js --report    # μόνο αναφορά, ποτέ έξοδος 1
 *
 * Escape: `SKIP_FIRESTORE_DEPLOY_PROOF=1` (αιτιολόγηση στον Giorgio)
 */

'use strict';

const { judgeFirestoreDeploy, blocking } = require('./lib/firestore-deploy/judge');
const { loadWorld } = require('./lib/firestore-deploy/world');
const M = require('./lib/firestore-deploy/model');

const c = {
  red: (s) => `[31m${s}[0m`,
  yellow: (s) => `[33m${s}[0m`,
  green: (s) => `[32m${s}[0m`,
  dim: (s) => `[2m${s}[0m`,
};

/** Η κατάσταση κάθε στόχου, σε μία γραμμή ο καθένας. */
function reportTargets(world) {
  console.log('\n🚀 CHECK 3.86 — απόδειξη ανάπτυξης (ADR-865)');
  for (const { target, source, digest } of world.targets) {
    const last = M.lastDeployment(world.ledger, target);
    if (digest !== null && last !== null && last.digest === digest) {
      console.log(`   ${c.green('✓')} ${target} ${c.dim(`· ${source} · αναπτύχθηκε ${last.at}`)}`);
      continue;
    }
    const age = world.ageOf(source);
    const since = age === null ? '' : ` · ${age} commit(s) από την τελευταία αλλαγή`;
    console.log(`   ${c.yellow('⏳')} ${target} ${c.dim(`· ${source}${since}`)}`);
  }
}

function reportFindings(findings, atPush) {
  for (const f of findings) {
    const blocks = f.severity === 'block' || (atPush && f.severity === 'pushBlock');
    const mark = blocks ? c.red('⛔') : c.yellow('⏳');
    console.error(`  ${mark} ${f.rule} · ${f.target}\n     ${f.detail}`);
  }
}

/** Το κείμενο της θεραπείας — **μία** διατύπωση, ώστε πύλη και hook να μη λένε άλλα. */
function remedy(atPush) {
  const lines = [
    `${c.yellow('Θεραπεία:')} npm run firestore:deploy            (deploy + καταγραφή, ΜΙΑ πράξη)`,
    c.dim('              npm run firestore:deploy -- --only firestore:indexes'),
    c.dim('⚠️  Το push πάει στο Netcup — ΠΟΤΕ στο Firebase. Κανόνες και δείκτες ανεβαίνουν ΜΟΝΟ έτσι.'),
  ];
  if (atPush) {
    lines.push(c.dim('Escape (αιτιολόγηση στον Giorgio): SKIP_FIRESTORE_DEPLOY_PROOF=1 git push …'));
  }
  return lines.join('\n  ');
}

function main(argv) {
  if (process.env.SKIP_FIRESTORE_DEPLOY_PROOF) {
    console.warn('⚠️ CHECK 3.86 παρακάμφθηκε (SKIP_FIRESTORE_DEPLOY_PROOF) — αιτιολόγησέ το στον Giorgio.');
    return 0;
  }
  const atPush = argv.includes('--at-push');
  const world = loadWorld();
  const findings = judgeFirestoreDeploy(world);

  reportTargets(world);
  reportFindings(findings, atPush);

  const blockers = blocking(findings, { atPush });
  if (argv.includes('--report') || blockers.length === 0) {
    if (findings.length === 0) console.log(c.green('✅ CHECK 3.86 — κάθε στόχος έχει απόδειξη ανάπτυξης'));
    else if (blockers.length === 0) console.log(`\n  ${remedy(false)}`);
    return 0;
  }
  console.error(`\n❌ CHECK 3.86 — ${blockers.length} εύρημα(τα) που μπλοκάρουν.\n  ${remedy(atPush)}\n`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main };
