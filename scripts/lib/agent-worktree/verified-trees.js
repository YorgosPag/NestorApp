'use strict';
/**
 * Αποτυπώματα δέντρων που ενέκρινε το pre-commit (ADR-925 §18).
 *
 * Η ένταξη ρωτούσε «κινήθηκε το `main`;» (merge-base ≠ `main`). Αυτό δεν είναι το ερώτημα:
 * ένα χειροκίνητο `git rebase main` μέσα στο worktree ξαναγράφει κάθε commit **χωρίς hook**,
 * και μετά το merge-base ΙΣΟΥΤΑΙ με το `main` ⇒ fast-forward κώδικα που δεν είδε ποτέ πύλη.
 * 🔴 ΠΕΡΙΣΤΑΤΙΚΟ 2026-11-17: το `80226268` (rebase pick, 17:25) έφερε δύο κλήσεις σε
 * διαγραμμένο `namedError` στο `main`· το CHECK 3.70 το είδε μόνο στο CI (`c17c0101`).
 *
 * Το σωστό ερώτημα είναι εκείνο της merge queue (GitHub merge queue, Bors): **ελέγχθηκε
 * ΑΥΤΟΣ ο κώδικας;** Το hook, μόλις περάσει, καταγράφει το δέντρο του ευρετηρίου (= το δέντρο
 * του commit που γίνεται)· η ένταξη ξανακρίνει όταν κάποιο commit του κλαδιού έχει δέντρο
 * που κανείς δεν ενέκρινε. Fail-closed: χωρίς καταγραφή (λείπει το αρχείο, merge commit,
 * rebase, cherry-pick) ⇒ ξανακρίνεται, ποτέ σιωπηλό πέρασμα.
 *
 * Το αρχείο ζει στο git-dir **του worktree** (`.git/worktrees/<όνομα>/`): ανά χώρο, εκτός
 * δέντρου, ποτέ σε commit.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const STAMP_FILE = 'nestor-verified-trees';
const KEEP = 500;
const TREE = /^[0-9a-f]{40,64}$/;

function runGit(cwd, args, env) {
  return execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function stampPath(cwd, env) {
  return path.resolve(cwd, runGit(cwd, ['rev-parse', '--git-dir'], env), STAMP_FILE);
}

function readStamps(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => TREE.test(line));
}

/**
 * Από μέσα από το hook: το περιβάλλον του hook ΚΡΑΤΙΕΤΑΙ επίτηδες — το `GIT_INDEX_FILE`
 * δείχνει το ευρετήριο που θα δεσμευτεί (και το προσωρινό του `commit <paths>`).
 */
function recordVerifiedTree({ cwd = process.cwd(), env = process.env } = {}) {
  const tree = runGit(cwd, ['write-tree'], env);
  const file = stampPath(cwd, env);
  const kept = readStamps(file).filter((line) => line !== tree).slice(-(KEEP - 1));
  fs.writeFileSync(file, `${[...kept, tree].join('\n')}\n`, 'utf8');
  return tree;
}

/** Τα commits του `base..HEAD` που το δέντρο τους δεν το ενέκρινε ποτέ το hook. */
function unverifiedCommits(dir, base, env) {
  const stamps = new Set(readStamps(stampPath(dir, env)));
  const log = runGit(dir, ['log', '--format=%H %T', `${base}..HEAD`], env);
  return log.split(/\r?\n/).filter(Boolean)
    .map((line) => line.split(' '))
    .filter(([, tree]) => !stamps.has(tree))
    .map(([commit]) => commit);
}

module.exports = { STAMP_FILE, recordVerifiedTree, unverifiedCommits };

if (require.main === module) {
  try {
    recordVerifiedTree();
  } catch (error) {
    // Ποτέ δεν μπλοκάρει το commit: χωρίς καταγραφή η ένταξη απλώς ξανακρίνει (fail-closed).
    console.error(`⚠️ Δεν καταγράφηκε το εγκεκριμένο δέντρο (${error.message}) — το wt:land θα ξανακρίνει.`);
  }
}
