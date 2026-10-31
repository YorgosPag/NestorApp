'use strict';
/**
 * Σειριακή ένταξη κλαδιού στο `main` (ADR-925): το τοπικό αντίστοιχο της merge queue.
 *
 * Το κλαδί ελέγχθηκε πάνω σε παλιό `main`. Αν το `main` κινήθηκε, το πράσινο εκείνο
 * δεν λέει τίποτα για το αποτέλεσμα της ένωσης, άρα ξανακρίνεται το ίδιο το αποτέλεσμα:
 * rebase, ένα commit, πλήρες pre-commit. Δεν κάνει ποτέ push.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LAND_LOCK, MAIN_BRANCH, locate } = require('./config');
const { commitsAhead, git, isDirty, primaryDir, revision, tryGit } = require('./git');
const { requireWorkspace } = require('./lifecycle');

function withLandLock(primary, action) {
  const lock = path.join(git(primary, ['rev-parse', '--git-common-dir']), LAND_LOCK);
  const absolute = path.resolve(primary, lock);
  try {
    fs.mkdirSync(absolute); // ατομικό: δύο εντάξεις δεν το πετυχαίνουν ποτέ και οι δύο
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Τρέχει ήδη ένταξη (${absolute}). Περίμενε να τελειώσει.`);
  }
  try {
    return action();
  } finally {
    fs.rmdirSync(absolute);
  }
}

function assertLandable(primary, entry, branch) {
  const current = git(primary, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (current !== MAIN_BRANCH) throw new Error(`Το κύριο αντίγραφο είναι στο «${current}», όχι στο ${MAIN_BRANCH}.`);
  if (isDirty(entry.dir)) throw new Error(`Το ${entry.dir} έχει αδέσμευτη δουλειά. Κάνε πρώτα commit.`);
  if (commitsAhead(primary, MAIN_BRANCH, branch) === 0) throw new Error(`Το ${branch} δεν έχει τίποτα για ένταξη.`);
}

function rebaseOntoMain(dir) {
  const rebased = tryGit(dir, ['rebase', MAIN_BRANCH]);
  if (rebased.ok) return;
  tryGit(dir, ['rebase', '--abort']);
  throw new Error(`Σύγκρουση με το ${MAIN_BRANCH}. Το κλαδί έμεινε ως είχε· λύσ' την μέσα στο worktree.\n${rebased.out}`);
}

function writeMessage(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-land-'));
  const file = path.join(dir, 'message.txt');
  fs.writeFileSync(file, `${text}\n`, 'utf8');
  return { file, dir };
}

/**
 * Το `--amend` δεν κάνει δουλειά εδώ: το index θα ήταν ίδιο με το HEAD και το hook θα
 * έκρινε κενό σύνολο. Μόνο το `reset --soft` φέρνει ΟΛΗ την αλλαγή μπροστά στις πύλες.
 */
function recommitThroughGates(dir, base) {
  const tip = revision(dir, 'HEAD');
  const message = git(dir, ['log', '--reverse', '--format=%B', `${base}..HEAD`]);
  const draft = writeMessage(message);
  git(dir, ['reset', '--soft', base]);
  try {
    git(dir, ['commit', '-F', draft.file], { inherit: true });
  } catch (error) {
    git(dir, ['reset', '--soft', tip]);
    throw new Error(`Οι πύλες απέρριψαν το αποτέλεσμα της ένωσης. Το κλαδί έμεινε ως είχε.\n${error.message}`);
  } finally {
    fs.rmSync(draft.dir, { recursive: true, force: true });
  }
}

function fastForwardMain(primary, branch, base) {
  if (revision(primary, MAIN_BRANCH) !== base) {
    throw new Error(`Το ${MAIN_BRANCH} κινήθηκε στο μεταξύ. Τρέξε ξανά την ένταξη.`);
  }
  const merged = tryGit(primary, ['merge', '--ff-only', branch]);
  if (!merged.ok) {
    throw new Error(`Το git αρνήθηκε την ένταξη· δεν άλλαξε τίποτα.\n${merged.out}`);
  }
}

function land(task, { cwd = process.cwd(), env = process.env } = {}) {
  const target = locate(task, env);
  const entry = requireWorkspace(cwd, target);
  const primary = primaryDir(cwd);
  return withLandLock(primary, () => {
    assertLandable(primary, entry, target.branch);
    const base = revision(primary, MAIN_BRANCH);
    const moved = git(primary, ['merge-base', MAIN_BRANCH, target.branch]) !== base;
    if (moved) {
      rebaseOntoMain(entry.dir);
      recommitThroughGates(entry.dir, base);
    }
    fastForwardMain(primary, target.branch, base);
    return { ...target, reverified: moved, head: revision(primary, MAIN_BRANCH) };
  });
}

module.exports = { land };
