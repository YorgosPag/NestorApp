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
 *   node scripts/check-firestore-deploy-proof.js --at-push   # push  — ίδια κρίση (από το pre-push)
 *   node scripts/check-firestore-deploy-proof.js --report    # μόνο αναφορά, ποτέ έξοδος 1
 *
 * 🔁 ADR-865 §11: ο Κ5 **δεν** μπλοκάρει πια το push — την ανάπτυξη την κάνει η γραμμή παραγωγής,
 * με έγκριση, και ο κώδικας περιμένει τους κανόνες/δείκτες του (βλ. `judge.js`).
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

const PUBLISHED_MARK = Object.freeze({
  same: (ref) => `${c.green('✓')} ίδιο με το ${ref}`,
  differs: (ref) => `${c.yellow('⏳')} διαφέρει από το ${ref} — στο push: πλάνο → έγκριση`,
  unknown: (ref) => `${c.dim('?')} το ${ref} δεν υπάρχει εδώ — δεν κρίνεται`,
});

/** Η κατάσταση κάθε στόχου, σε μία γραμμή ο καθένας — με την τελευταία **τοπική** ανάπτυξη ως ιστορικό. */
function reportTargets(world) {
  console.log('\n🚀 CHECK 3.86 — απόδειξη ανάπτυξης (ADR-865 §11)');
  for (const { target, source, published } of world.targets) {
    const last = M.lastDeployment(world.ledger, target);
    const local = last ? ` · τελευταία τοπική ανάπτυξη ${last.at}` : '';
    const mark = (PUBLISHED_MARK[published] || PUBLISHED_MARK.unknown)(world.publishedRef);
    console.log(`   ${target} ${c.dim(`· ${source}`)} · ${mark}${c.dim(local)}`);
  }
}

function reportFindings(findings) {
  for (const f of findings) {
    const mark = f.severity === 'block' ? c.red('⛔') : c.yellow('⏳');
    console.error(`  ${mark} ${f.rule} · ${f.target}\n     ${f.detail}`);
  }
}

/** Το κείμενο της θεραπείας — **μία** διατύπωση, ώστε πύλη και hook να μη λένε άλλα. */
function remedy() {
  return [
    `${c.yellow('Τι θα γίνει:')} push → GitHub Actions «T1 🚀 Build & Deploy» → πλάνο → ΕΓΚΡΙΣΗ σου → ανάπτυξη → κώδικας`,
    c.dim('Έκτακτη ανάγκη (γράφει το μητρώο): npm run firestore:deploy -- --project <id>'),
    c.dim('Ζωντανή κατάσταση (μόνο ανάγνωση):  npm run firestore:verify -- --project <id>'),
  ].join('\n  ');
}

function main(argv) {
  if (process.env.SKIP_FIRESTORE_DEPLOY_PROOF) {
    console.warn('⚠️ CHECK 3.86 παρακάμφθηκε (SKIP_FIRESTORE_DEPLOY_PROOF) — αιτιολόγησέ το στον Giorgio.');
    return 0;
  }
  const world = loadWorld();
  const findings = judgeFirestoreDeploy(world);

  reportTargets(world);
  reportFindings(findings);

  const blockers = blocking(findings);
  if (argv.includes('--report') || blockers.length === 0) {
    if (findings.length === 0) console.log(c.green('✅ CHECK 3.86 — μητρώο ακέραιο, καμία αλλαγή προς ανάπτυξη'));
    else if (blockers.length === 0) console.log(`\n  ${remedy()}`);
    return 0;
  }
  console.error(`\n❌ CHECK 3.86 — ${blockers.length} εύρημα(τα) που μπλοκάρουν (Κ1-Κ4: μητρώο/παρονομαστής).\n`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main };
