#!/usr/bin/env node
/**
 * ADR-865 — ΑΝΑΠΤΥΞΗ **ΚΑΙ** ΚΑΤΑΓΡΑΦΗ, ΣΕ ΜΙΑ ΠΡΑΞΗ.
 *
 *   npm run firestore:deploy                                 # όλοι οι στόχοι
 *   npm run firestore:deploy -- --only firestore:indexes     # ένας
 *   npm run firestore:deploy -- --verify                     # ΜΟΝΟ επαλήθευση, κανένα deploy
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
 * γίνει `READY` (μάθημα ADR-845 §Ο-18). Η `--verify` το λέει ρητά.
 *
 * @see ADR-865 · CHECK 3.86
 */

'use strict';

const fs = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');

const M = require('../lib/firestore-deploy/model');
const { loadWorld } = require('../lib/firestore-deploy/world');

function fail(message) {
  console.error(`\n❌ firestore:deploy — ${message}\n`);
  process.exit(1);
}

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

/**
 * Το project — **ποτέ μαντεψιά**: ρητό `--project`, αλλιώς `FIREBASE_PROJECT_ID`, αλλιώς άρνηση.
 * Ένα λάθος project εδώ γράφει κανόνες ασφαλείας σε **ξένο** δέντρο.
 */
function projectId(argv) {
  const explicit = argValue(argv, '--project') || process.env.FIREBASE_PROJECT_ID;
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
// ΕΠΑΛΗΘΕΥΣΗ — ΖΩΝΤΑΝΑ ΕΝΑΝΤΙ ΑΡΧΕΙΟΥ (η μέθοδος που βρήκε τη βλάβη)
// ============================================================================

/** Κλειδί δείκτη, χωρίς το `__name__` που προσθέτει ο διακομιστής. */
const indexKey = (i) =>
  `${i.collectionGroup}:${i.fields.filter((f) => f.fieldPath !== '__name__')
    .map((f) => `${f.fieldPath}/${f.order || f.arrayConfig}`).join(',')}`;

/**
 * Σύγκριση **ζωντανών** δεικτών με το αρχείο. Είναι ο **μόνος** από τους τρεις στόχους που ο
 * πάροχος επιστρέφει read-only (`firebase firestore:indexes`) — για τους κανόνες δεν υπάρχει
 * αντίστοιχη εντολή, και το `--dry-run` **μετρήθηκε τυφλό** (βλ. `model.js`).
 */
function verifyIndexes(project) {
  const run = spawnSync('npx', ['--no-install', 'firebase', 'firestore:indexes', '--project', project], {
    cwd: M.paths.root, encoding: 'utf8', shell: process.platform === 'win32',
  });
  if (run.status !== 0) return { ok: false, detail: 'το firebase firestore:indexes απέτυχε' };
  const text = run.stdout.slice(run.stdout.indexOf('{'));
  const live = new Set((JSON.parse(text).indexes || []).map(indexKey));
  const file = JSON.parse(fs.readFileSync(M.paths.of('firestore.indexes.json'), 'utf8')).indexes || [];
  const missing = file.filter((i) => !live.has(indexKey(i)));
  return { ok: missing.length === 0, live: live.size, file: file.length, missing: missing.map(indexKey) };
}

function reportVerification(project) {
  const v = verifyIndexes(project);
  if (v.ok === false && v.detail) {
    console.warn(`⚠️  επαλήθευση δεικτών: ${v.detail}`);
    return;
  }
  console.log(`\n🔎 δείκτες — ζωντανά ${v.live} · αρχείο ${v.file}`);
  if (v.ok) {
    console.log('   ✅ καμία διαφορά· ⚠️ ένας ΝΕΟΣ δείκτης χτίζεται (CREATING) — το ερώτημα αποτυγχάνει μέχρι READY.');
    return;
  }
  console.error('   ⛔ ΛΕΙΠΟΥΝ ζωντανά:');
  for (const key of v.missing) console.error(`      - ${key}`);
}

// ============================================================================
// ΑΝΑΠΤΥΞΗ
// ============================================================================

function deploy(targets, project) {
  const run = spawnSync('npx', ['--no-install', 'firebase', 'deploy', '--only', targets.join(','), '--project', project], {
    cwd: M.paths.root, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (run.status !== 0) fail(`το firebase deploy γύρισε ${run.status} — καμία γραμμή δεν γράφτηκε`);
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

function main(argv) {
  const project = projectId(argv);
  const world = loadWorld();
  const only = argValue(argv, '--only');
  const known = world.targets.map((t) => t.target);
  const targets = only ? only.split(',').map((s) => s.trim()) : known;

  for (const t of targets) if (!known.includes(t)) fail(`άγνωστος στόχος «${t}» — γνωστοί: ${known.join(', ')}`);

  if (argv.includes('--verify')) {
    reportVerification(project);
    return;
  }

  deploy(targets, project);

  const ledger = M.loadLedger();
  const next = { deployments: [...ledger.deployments, ...rowsFor(world, targets, headCommit())] };
  fs.writeFileSync(M.paths.ledger, M.renderLedger(next), 'utf8');
  console.log(`\n✅ ${M.rel(M.paths.ledger)} — ${targets.length} γραμμή(ές). ΣΤΑΔΙΟΠΟΙΗΣΕ ΤΟ στο commit.`);

  if (targets.includes('firestore:indexes')) reportVerification(project);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { main, verifyIndexes, indexKey };
