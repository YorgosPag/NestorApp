#!/usr/bin/env node
/**
 * ADR-865 — ΑΝΑΠΤΥΞΗ **ΚΑΙ** ΚΑΤΑΓΡΑΦΗ, ΣΕ ΜΙΑ ΠΡΑΞΗ.
 *
 *   npm run firestore:deploy                                 # όλοι οι στόχοι
 *   npm run firestore:deploy -- --only firestore:indexes     # ένας
 *   npm run firestore:deploy -- --verify                     # = npm run firestore:verify (κανένα deploy)
 *   npm run firestore:deploy -- --wait                       # deploy, και αναμονή μέχρι READY
 *   npm run firestore:deploy -- --dry-run                    # ταυτότητα + μεταγλώττιση, ΚΑΜΙΑ εγγραφή
 *   … --pipeline                                             # ΜΟΝΟ GitHub Actions (§11): χωρίς μητρώο
 *
 * 🔁 **Από ADR-865 §11 την ανάπτυξη την κάνει η γραμμή παραγωγής** (`docker-build.yml`,
 * `firebase-apply`, με έγκριση Giorgio). Η τοπική χρήση μένει για **έκτακτη ανάγκη** — και
 * **γράφει** το μητρώο, όπως πάντα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Η ΚΑΤΑΓΡΑΦΗ ΔΕΝ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΗ ΕΝΤΟΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 * Ένα μητρώο που το γράφει άνθρωπος **μετά** είναι **ισχυρισμός** για μια πράξη — και σαπίζει
 * ακριβώς όπως σάπισε η γνώση που γέννησε αυτό το ADR. Εδώ η γραμμή είναι **ΠΑΡΑΓΩΓΟ** της
 * πράξης: γράφεται **μόνο** αν το `firebase deploy` γύρισε 0, με το αποτύπωμα των bytes που
 * **στάλθηκαν**, και με το commit του δέντρου εκείνης της στιγμής.
 *
 * ⚠️ **ΠΟΤΕ ΑΠΟ ΠΡΑΚΤΟΡΑ.** Αυτή η εντολή γράφει στην **παραγωγή** (`pagonis-87766`). Την τρέχει
 * **ο Giorgio**, ρητά — ίδιο δόγμα με το N.(-1) για το push. Ο πράκτορας τη **συνιστά**, δεν την
 * εκτελεί.
 *
 * ⚠️ **Deploy ≠ διαθέσιμος**: ο δείκτης χτίζεται (`CREATING`) και το ερώτημα αποτυγχάνει μέχρι να
 * γίνει `READY` (μάθημα ADR-845 §Ο-18). Γι' αυτό, μετά από **κάθε** ανάπτυξη ρωτιέται ο
 * **πάροχος** (`verify-live.js`, ADR-865 §10) — κανόνες **και** δείκτες, ορισμοί **και** κατάσταση —
 * και ο κωδικός εξόδου είναι **εκείνης** της ερώτησης: `3` = αναπτύχθηκε αλλά **χτίζεται ακόμη**.
 *
 * @see ADR-865 · CHECK 3.86
 */

'use strict';

const fs = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');

const M = require('../lib/firestore-deploy/model');
const { loadWorld, TREE } = require('../lib/firestore-deploy/world');
const { resolveProject, argValue } = require('../lib/firestore-deploy/live');
const { runVerification } = require('./verify-live');

function fail(message) {
  console.error(`\n❌ firestore:deploy — ${message}\n`);
  process.exit(1);
}

/**
 * Το project — **ποτέ μαντεψιά** (`resolveProject`: ρητό `--project`, αλλιώς
 * `FIREBASE_PROJECT_ID`), αλλιώς άρνηση. Λάθος project εδώ γράφει κανόνες ασφαλείας σε **ξένο** δέντρο.
 */
function projectId(argv) {
  const explicit = resolveProject(argv);
  if (!explicit) fail('λείπει το project — δώσε --project <id> ή όρισε FIREBASE_PROJECT_ID');
  return explicit;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function headCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: M.paths.root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// ============================================================================
// ΑΝΑΠΤΥΞΗ
// ============================================================================

/**
 * Το `firebase deploy` της **καρφωμένης** έκδοσης (`M.FIREBASE_TOOLS_VERSION`) — όχι «ό,τι είναι
 * εγκατεστημένο global»: ο επαληθευτής (`drift.js`) αντιγράφει τη σημασιολογία **αυτής** της
 * έκδοσης, άρα και ο deployer πρέπει να είναι αυτή (ADR-865 §11).
 *
 * `--non-interactive` στη γραμμή παραγωγής: μετρημένο στην πηγή του 15.13.0
 * (`lib/firestore/api.js:85-121`) — δείκτες εκτός αρχείου **δεν** σβήνονται χωρίς `--force`, και
 * το `checkStorageRulesIamPermissions` **δεν** αγγίζει IAM (`lib/rulesDeploy.js:65`).
 * Το `--force` **δεν** δίνεται ποτέ από εδώ.
 */
function firebaseArgs(targets, project, { pipeline, dryRun }) {
  return [
    '--yes', `firebase-tools@${M.FIREBASE_TOOLS_VERSION}`,
    'deploy', '--only', targets.join(','), '--project', project,
    ...(pipeline ? ['--non-interactive'] : []),
    ...(dryRun ? ['--dry-run'] : []),
  ];
}

function deploy(targets, project, mode) {
  const run = spawnSync('npx', firebaseArgs(targets, project, mode), {
    cwd: M.paths.root, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (run.status !== 0) fail(`το firebase deploy γύρισε ${run.status} — καμία γραμμή δεν γράφτηκε`);
}

/**
 * `--pipeline` **μόνο** μέσα στο GitHub Actions: εκεί το αρχείο της πράξης είναι το GitHub
 * Deployment του environment (ποιος ενέκρινε, πότε, ποιο commit) — γι' αυτό **δεν** γράφεται το
 * τοπικό μητρώο. Έξω από το Actions η σημαία θα ήταν ανάπτυξη **χωρίς κανένα αρχείο** ⇒ άρνηση.
 */
function modeOf(argv, env = process.env) {
  const pipeline = argv.includes('--pipeline');
  if (pipeline && env.GITHUB_ACTIONS !== 'true') {
    throw new Error('--pipeline μόνο μέσα στο GitHub Actions — τοπικά η ανάπτυξη ΓΡΑΦΕΙ το μητρώο (npm run firestore:deploy)');
  }
  return { pipeline, dryRun: argv.includes('--dry-run') };
}

function recordRows(world, targets) {
  const ledger = M.loadLedger();
  const next = { deployments: [...ledger.deployments, ...rowsFor(world, targets, headCommit())] };
  fs.writeFileSync(M.paths.ledger, M.renderLedger(next), 'utf8');
  console.log(`\n✅ ${M.rel(M.paths.ledger)} — ${targets.length} γραμμή(ές). ΣΤΑΔΙΟΠΟΙΗΣΕ ΤΟ στο commit.`);
}

/** Οι γραμμές των στόχων που **στάλθηκαν**, με το αποτύπωμα των bytes εκείνης της στιγμής. */
function rowsFor(world, targets, commit) {
  const at = today();
  return targets.map((target) => {
    const entry = world.targets.find((t) => t.target === target);
    if (!entry || entry.digest === null) fail(`ο στόχος «${target}» δεν έχει αρχείο-πηγή`);
    return { at, target, source: entry.source, digest: entry.digest, commit };
  });
}

/**
 * @returns {Promise<number>} ο κωδικός εξόδου της **ζωντανής** ερώτησης μετά την ανάπτυξη —
 *   «αναπτύχθηκε» δεν αναφέρεται ποτέ ως «διαθέσιμο» χωρίς να ρωτηθεί ο πάροχος.
 */
async function main(argv) {
  if (argv.includes('--verify')) return runVerification(argv);

  const mode = modeOf(argv);
  const project = projectId(argv);
  // Το `firebase deploy` διαβάζει τον ΔΙΣΚΟ ⇒ αυτά είναι τα bytes που στέλνονται (ADR-865 §11.8).
  const world = loadWorld({ tree: TREE.WORKTREE });
  const only = argValue(argv, '--only');
  const known = world.targets.map((t) => t.target);
  const targets = only ? only.split(',').map((s) => s.trim()).filter(Boolean) : known;

  for (const t of targets) if (!known.includes(t)) fail(`άγνωστος στόχος «${t}» — γνωστοί: ${known.join(', ')}`);

  deploy(targets, project, mode);
  if (mode.dryRun) {
    console.log('\n🧪 --dry-run: ταυτότητα, δικαιώματα και μεταγλώττιση επικυρώθηκαν — ΤΙΠΟΤΑ δεν γράφτηκε.');
    return 0;
  }
  if (!mode.pipeline) recordRows(world, targets);

  return runVerification(verifyArgsAfterDeploy(project, argv));
}

/**
 * Η ερώτηση προς τον πάροχο **μετά** την ανάπτυξη — πάνω στον **δίσκο**, γιατί αυτόν έστειλε το
 * `firebase deploy` (ADR-865 §11.8). Με την προεπιλογή `HEAD` θα έκρινε **άλλο** πράγμα από αυτό
 * που μόλις ανέβηκε, όποτε ο δίσκος ≠ HEAD.
 */
function verifyArgsAfterDeploy(project, argv) {
  const timeout = argValue(argv, '--timeout');
  const waitFlags = argv.includes('--wait') ? ['--wait', ...(timeout ? ['--timeout', timeout] : [])] : [];
  return ['--project', project, '--tree', TREE.WORKTREE, ...waitFlags];
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => fail(error.stack || error.message),
  );
}

module.exports = { main, firebaseArgs, modeOf, verifyArgsAfterDeploy };
