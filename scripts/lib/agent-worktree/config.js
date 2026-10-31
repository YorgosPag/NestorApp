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
  LAND_LOCK,
  MAIN_BRANCH,
  MIN_FREE_BYTES,
  assertDiskRoom,
  assertTask,
  locate,
  worktreeRoot,
};
