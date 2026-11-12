'use strict';
/**
 * Κανόνες του απομονωμένου χώρου εργασίας πράκτορα (ADR-925): θέση, όνομα, δίσκος.
 *
 * Καθαρές συναρτήσεις, χωρίς I/O, ώστε να κρίνονται χωρίς δίσκο και git.
 */

const path = require('node:path');

const DEFAULT_ROOT = 'C:/Nestor_Worktrees';
const ROOT_ENV = 'NESTOR_WORKTREE_ROOT';
const BRANCH_PREFIX = 'agent/';
const MAIN_BRANCH = 'main';
const LAND_LOCK = 'agent-worktree-land.lock';

/**
 * Φάκελος των handoffs, σχετικός με τη ρίζα κάθε αντιγράφου. Τα handoffs του worktree
 * συλλέγονται στον ομώνυμο φάκελο του κύριου αντιγράφου, γιατί μόνο εκεί τα παίρνει το
 * backup και μόνο εκεί επιζούν το σβήσιμο του worktree (ADR-925 §9, 2026-11-11).
 */
const HANDOFF_DIR = 'HANDOFFS';
const HANDOFF_EXTENSION = '.md';

/**
 * Οι φάκελοι handoff που ΠΑΡΑΚΟΛΟΥΘΕΙ το git, σχετικοί με τη ρίζα (μετρημένο 2026-11-12: `HANDOFFS/` 985 `.md`
 * παρά το τοπικό `info/exclude` · `docs/handoffs/` 25 `.md`). Οι υποφάκελοι του `HANDOFFS/` κρατούν και κώδικα
 * (`.js` · `.ts` · `.sh`), γι' αυτό handoff είναι ΜΟΝΟ το `.md` πρώτου επιπέδου (ADR-924 §9).
 */
const TRACKED_HANDOFF_DIRS = Object.freeze([HANDOFF_DIR, 'docs/handoffs']);

/** Είναι η διαδρομή (σχετική, posix ή windows) έγγραφο handoff πρώτου επιπέδου; Καθαρή, χωρίς δίσκο. */
function isHandoffDocument(relPath) {
  const posix = String(relPath).replace(/\\/g, '/');
  const cut = posix.lastIndexOf('/');
  if (cut < 0) return false;
  const name = posix.slice(cut + 1);
  return TRACKED_HANDOFF_DIRS.includes(posix.slice(0, cut))
    && name.length > HANDOFF_EXTENSION.length
    && name.endsWith(HANDOFF_EXTENSION);
}

/**
 * 1,5 GB: ένα worktree πιάνει ~0,6 GB (μετρημένο 2026-10-31) και το repo χρειάζεται
 * περιθώριο για hooks και δοκιμές. Κάτω από αυτό, ο δίσκος που γεμίζει θα έριχνε
 * και τις υπόλοιπες εργασίες, όχι μόνο τη νέα.
 */
const MIN_FREE_BYTES = 1.5 * 1024 ** 3;

/** Το όνομα γίνεται φάκελος ΚΑΙ κλαδί: μόνο ό,τι είναι ασφαλές και στα δύο. */
const TASK_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

function assertTask(task) {
  if (typeof task !== 'string' || !TASK_PATTERN.test(task)) {
    throw new Error(`Μη έγκυρο όνομα εργασίας «${task}»: μόνο a-z, 0-9 και παύλα, 3-50 χαρακτήρες.`);
  }
  return task;
}

function worktreeRoot(env = process.env) {
  return path.resolve(env[ROOT_ENV] || DEFAULT_ROOT);
}

function locate(task, env = process.env) {
  assertTask(task);
  return { task, branch: `${BRANCH_PREFIX}${task}`, dir: path.join(worktreeRoot(env), task) };
}

function assertDiskRoom(freeBytes, minimum = MIN_FREE_BYTES) {
  if (freeBytes < minimum) {
    const toGb = (n) => (n / 1024 ** 3).toFixed(1);
    throw new Error(
      `Ο δίσκος έχει ${toGb(freeBytes)} GB ελεύθερα, χρειάζονται τουλάχιστον ${toGb(minimum)} GB. ` +
        'Ελευθέρωσε χώρο ή σβήσε worktree που τελείωσε (npm run wt:list).',
    );
  }
}

module.exports = {
  BRANCH_PREFIX,
  HANDOFF_DIR,
  HANDOFF_EXTENSION,
  LAND_LOCK,
  MAIN_BRANCH,
  MIN_FREE_BYTES,
  TRACKED_HANDOFF_DIRS,
  assertDiskRoom,
  assertTask,
  isHandoffDocument,
  locate,
  worktreeRoot,
};
