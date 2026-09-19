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
 *   node scripts/check-firestore-deploy-proof.js             # commit — κρίνει το INDEX· μπλοκ Κ1-Κ4, αναφορά Κ5
 *   node scripts/check-firestore-deploy-proof.js --at-push   # push  — κρίνει κάθε <local sha> του stdin (pre-push)
 *   node scripts/check-firestore-deploy-proof.js --report    # μόνο αναφορά (ο ΔΙΣΚΟΣ), ποτέ έξοδος 1
 *
 * 🔑 ADR-865 §11.8: κρίνεται ό,τι **φεύγει** (index · pushed commit), ποτέ σιωπηλά ο δίσκος — σε
 * κοινό working tree οι ακομμίτιστες αλλαγές **άλλων** δεν είναι μέρος αυτού του commit/push.
 *
 * 🔁 ADR-865 §11: ο Κ5 **δεν** μπλοκάρει πια το push — την ανάπτυξη την κάνει η γραμμή παραγωγής,
 * με έγκριση, και ο κώδικας περιμένει τους κανόνες/δείκτες του (βλ. `judge.js`).
 *
 * Escape: `SKIP_FIRESTORE_DEPLOY_PROOF=1` (αιτιολόγηση στον Giorgio)
 */

'use strict';

const fs = require('node:fs');

const { judgeFirestoreDeploy, blocking } = require('./lib/firestore-deploy/judge');
const { loadWorld, parsePushLines, publishedRef, git, TREE } = require('./lib/firestore-deploy/world');
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
  'off-pipeline': () => `${c.dim('·')} αυτό το ref δεν πυροδοτεί τη γραμμή (${M.PIPELINE.ref}) — καμία ανάπτυξη`,
});

/** Η κατάσταση κάθε στόχου, σε μία γραμμή ο καθένας — με την τελευταία **τοπική** ανάπτυξη ως ιστορικό. */
function reportTargets(world, label) {
  console.log(`\n🚀 CHECK 3.86 — απόδειξη ανάπτυξης (ADR-865 §11) · κρίνεται: ${label}`);
  for (const { target, source, published } of world.targets) {
    const last = M.lastDeployment(world.ledger, target);
    const local = last ? ` · τελευταία τοπική ανάπτυξη ${last.at}` : '';
    const mark = (PUBLISHED_MARK[published] || PUBLISHED_MARK.unknown)(shortRef(world.publishedRef));
    console.log(`   ${target} ${c.dim(`· ${source}`)} · ${mark}${c.dim(local)}`);
  }
  for (const source of world.worktreeDrift) {
    console.log(c.dim(`   ℹ️  ο δίσκος διαφέρει στο ${source} — ΔΕΝ κρίθηκε, δεν είναι μέρος αυτού που κρίνεται (ADR-865 §11.8)`));
  }
}

/** Πλήρες sha ⇒ 8 χαρακτήρες· ονόματα ref αυτούσια. */
const shortRef = (ref) => (/^[0-9a-f]{40}$/.test(ref || '') ? ref.slice(0, 8) : ref);

// ============================================================================
// ΤΙ ΚΡΙΝΕΤΑΙ — ADR-865 §11.8 (Ε1): ό,τι φεύγει, όχι ό,τι βρίσκεται στον δίσκο
// ============================================================================

/** Το stdin του pre-push — κενό όταν η εντολή τρέχει με το χέρι από τερματικό. */
function readStdin() {
  if (process.stdin.isTTY) return '';
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Ένας κόσμος ανά ref που **στέλνεται** — το δέντρο του `<local sha>`, η βάση του Κ3 = ό,τι έχει
 * ήδη ο remote, και ο Κ5 **μόνο** για το ref της γραμμής (`M.PIPELINE.ref`).
 */
function pushWorld({ localSha, remoteRef, remoteSha }) {
  const onPipeline = remoteRef === M.PIPELINE.ref;
  const base = remoteSha ?? git(['merge-base', localSha, publishedRef()]);
  const world = loadWorld({ tree: localSha, baseRef: base, published: onPipeline ? remoteSha ?? publishedRef() : null });
  return { label: `push ${localSha.slice(0, 8)} → ${remoteRef}`, world };
}

/** @returns {Array<{label:string, world:object}>} */
function worldsFor(argv, readInput = readStdin) {
  if (argv.includes('--report')) return [{ label: 'ο δίσκος (--report)', world: loadWorld({ tree: TREE.WORKTREE }) }];
  if (!argv.includes('--at-push')) return [{ label: 'το index (ό,τι θα δεσμευτεί)', world: loadWorld({ tree: TREE.INDEX }) }];
  const pushes = parsePushLines(readInput());
  if (pushes.length === 0) return [{ label: 'HEAD (χωρίς stdin του push)', world: loadWorld({ tree: 'HEAD' }) }];
  return pushes.map(pushWorld);
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
  const findings = [];
  for (const { label, world } of worldsFor(argv)) {
    const own = judgeFirestoreDeploy(world);
    reportTargets(world, label);
    reportFindings(own);
    findings.push(...own);
  }

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

module.exports = { main, worldsFor };
