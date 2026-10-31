'use strict';
/**
 * Κύκλος ζωής χώρου εργασίας πράκτορα (ADR-925): δημιουργία, απογραφή, σβήσιμο.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { MAIN_BRANCH, BRANCH_PREFIX, assertDiskRoom, locate, worktreeRoot } = require('./config');
const { branchExists, commitsAhead, git, isDirty, primaryDir, tryGit, worktrees } = require('./git');

function freeBytes(dir) {
  const stats = fs.statfsSync(dir);
  return Number(stats.bavail) * Number(stats.bsize);
}

function nearestExisting(dir) {
  let current = dir;
  while (!fs.existsSync(current)) current = path.dirname(current);
  return current;
}

/**
 * Δικό του `node_modules` σε κάθε worktree: ~2 λεπτά (μετρημένο 2026-10-31).
 *
 * `hardlink` ρητά: στη σιωπή το pnpm πέφτει σε αντιγραφή και ένας σχεδόν γεμάτος δίσκος
 * θα έχανε GB. Έτσι αποτυγχάνει αντί να γεμίσει. `--ignore-scripts` γιατί το `prepare`
 * αλλάζει ρυθμίσεις git κοινές με όλα τα worktrees, άρα το patch τρέχει ρητά εδώ.
 */
function installDependencies(dir) {
  const flags = '--offline --frozen-lockfile --ignore-scripts --package-import-method=hardlink';
  execFileSync(`pnpm install ${flags}`, { cwd: dir, shell: true, stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/patch-radix-react19.js'], { cwd: dir, stdio: 'inherit' });
}

function discardWorkspace(primary, target) {
  tryGit(primary, ['worktree', 'remove', '--force', target.dir]);
  tryGit(primary, ['branch', '-D', target.branch]);
}

function createWorkspace(task, options = {}) {
  const { cwd = process.cwd(), env = process.env, minimumFree, install = installDependencies } = options;
  const target = locate(task, env);
  const primary = primaryDir(cwd);
  if (fs.existsSync(target.dir)) throw new Error(`Υπάρχει ήδη ${target.dir}.`);
  if (branchExists(primary, target.branch)) throw new Error(`Υπάρχει ήδη το κλαδί ${target.branch}.`);
  assertDiskRoom(freeBytes(nearestExisting(worktreeRoot(env))), minimumFree);

  fs.mkdirSync(worktreeRoot(env), { recursive: true });
  git(primary, ['worktree', 'add', '-b', target.branch, target.dir, MAIN_BRANCH]);
  try {
    install(target.dir);
  } catch (error) {
    discardWorkspace(primary, target); // μισό αντίγραφο χωρίς εξαρτήσεις δεν το θέλει κανείς
    throw new Error(`Η εγκατάσταση απέτυχε και το worktree αφαιρέθηκε.\n${error.message}`);
  }
  return target;
}

function listWorkspaces({ cwd = process.cwd(), env = process.env } = {}) {
  const primary = primaryDir(cwd);
  const workspaces = worktrees(cwd)
    .filter((item) => item.branch && item.branch.startsWith(BRANCH_PREFIX))
    .map((item) => ({
      ...item,
      dirty: isDirty(item.dir),
      ahead: commitsAhead(primary, MAIN_BRANCH, item.branch),
    }));
  return { workspaces, freeBytes: freeBytes(nearestExisting(worktreeRoot(env))) };
}

function requireWorkspace(cwd, target) {
  const entry = worktrees(cwd).find((item) => item.branch === target.branch);
  if (!entry) throw new Error(`Δεν υπάρχει ενεργό worktree για το κλαδί ${target.branch}.`);
  return entry;
}

/**
 * Το `git worktree remove` πετυχαίνει κι ας μείνουν φάκελοι μέσα (μετρημένο 2026-10-31:
 * `node_modules`, `packages`, `src`, 3,7 MB). Το `rmSync` δεν ακολουθεί junction.
 */
function clearResidue(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  if (fs.existsSync(dir)) throw new Error(`Έμεινε υπόλειμμα στο ${dir}. Κλείσε ό,τι το κρατά ανοιχτό.`);
}

function removeWorkspace(task, { cwd = process.cwd(), env = process.env } = {}) {
  const target = locate(task, env);
  const entry = requireWorkspace(cwd, target);
  const primary = primaryDir(cwd);
  if (isDirty(entry.dir)) throw new Error(`Το ${entry.dir} έχει αδέσμευτη δουλειά. Δεν σβήνω τίποτα.`);

  git(primary, ['worktree', 'remove', entry.dir]);
  clearResidue(entry.dir);
  // `-d`, όχι `-D`: το git αρνείται αν το κλαδί δεν έχει ενταχθεί, και τότε τα commits μένουν ασφαλή.
  return { ...target, branchRemoved: tryGit(primary, ['branch', '-d', target.branch]).ok };
}

module.exports = { clearResidue, createWorkspace, listWorkspaces, removeWorkspace, requireWorkspace };
