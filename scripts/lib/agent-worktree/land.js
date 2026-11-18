'use strict';
/**
 * Σειριακή ένταξη κλαδιού στο `main` (ADR-925): το τοπικό αντίστοιχο της merge queue.
 *
 * Το κλαδί ελέγχθηκε πάνω σε παλιό `main`. Αν το `main` κινήθηκε, το πράσινο εκείνο
 * δεν λέει τίποτα για το αποτέλεσμα της ένωσης, άρα ξανακρίνεται το ίδιο το αποτέλεσμα:
 * rebase, ένα commit, πλήρες pre-commit. Το ίδιο και όταν το `main` ΔΕΝ κινήθηκε αλλά
 * κάποιο commit έχει δέντρο που το hook δεν ενέκρινε ποτέ (χειροκίνητο rebase, §18 ·
 * `verified-trees.js`). Δεν κάνει ποτέ push.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LAND_LOCK, MAIN_BRANCH, locate } = require('./config');
const { commitsAhead, git, isDirty, primaryDir, revision, tryGit } = require('./git');
const { tryHarvest } = require('./handoffs');
const { requireWorkspace } = require('./lifecycle');
const { unverifiedCommits } = require('./verified-trees');
const { cleanGitEnv } = require('../git-hook-env');

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

const HANDOFF_SUBJECT = /^docs\(handoff\)/;

/**
 * Μήνυμα του ενιαίου commit. `messages` = νεότερο πρώτο.
 * Τίτλος: το ΠΑΛΑΙΟΤΕΡΟ που ΔΕΝ είναι `docs(handoff)` — αλλιώς το νεότερο (GitHub
 * «Squash and merge»). Το πρώτο commit ενός κλαδιού είναι η αλλαγή· τα επόμενα είναι
 * συνήθως διορθώσεις για τις πύλες (fde89989: τίτλος `chore` πάνω από το `feat`). Το
 * handoff της προηγούμενης συνεδρίας παρακάμπτεται (21474786). Το σώμα κρατά ΟΛΑ τα μηνύματα.
 */
function composeLandMessage(messages) {
  const clean = messages.map((text) => text.trim()).filter(Boolean);
  if (clean.length === 0) throw new Error('Κανένα μήνυμα commit για ένωση.');
  const lead = clean.findLastIndex((text) => !HANDOFF_SUBJECT.test(text));
  const chosen = lead === -1 ? 0 : lead;
  return [clean[chosen], ...clean.filter((_, index) => index !== chosen)].join('\n\n');
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
  const log = git(dir, ['log', '--format=%B%x00', `${base}..HEAD`]);
  const draft = writeMessage(composeLandMessage(log.split('\0')));
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
    if (moved) rebaseOntoMain(entry.dir);
    // §18: όχι μόνο «κινήθηκε το main;» — και «ενέκρινε το hook ΑΥΤΑ τα δέντρα;» (χειροκίνητο rebase).
    const reverified = moved || unverifiedCommits(entry.dir, base, cleanGitEnv()).length > 0;
    if (reverified) recommitThroughGates(entry.dir, base);
    fastForwardMain(primary, target.branch, base);
    // Μετά την ένταξη, όχι πριν: το `main` ήδη κινήθηκε, άρα μια αποτυχία εδώ αναφέρεται, δεν ακυρώνει.
    const handoffs = tryHarvest(entry.dir, primary);
    return { ...target, reverified, head: revision(primary, MAIN_BRANCH), handoffs };
  });
}

module.exports = { composeLandMessage, land };
