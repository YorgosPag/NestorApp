'use strict';
/**
 * Κλήσεις git του χώρου εργασίας (ADR-925).
 *
 * `execFileSync` χωρίς κέλυφος: το όνομα εργασίας δεν φτάνει ποτέ σε shell.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

/**
 * Μέσα σε hook το git εξάγει `GIT_DIR` / `GIT_INDEX_FILE`. Αν κληρονομηθούν, κάθε
 * κλήση εδώ θα χτυπούσε το repo του hook αντί για εκείνο του `cwd`.
 */
const LEAKED_GIT_ENV = ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE', 'GIT_PREFIX', 'GIT_OBJECT_DIRECTORY'];

function cleanEnv() {
  const env = { ...process.env };
  LEAKED_GIT_ENV.forEach((key) => delete env[key]);
  return env;
}

/**
 * Τα αποτυπώματα των πυλών κρίνουν ωμά bytes. Με το `core.autocrlf=true` του repo ένα νέο
 * worktree βγαίνει CRLF ενώ το git κρατά LF, και οι πύλες το δηλώνουν «μπαγιάτικο» χωρίς
 * αλλαγή περιεχομένου (μετρημένο 2026-10-31, CHECK 3.84). Έτσι ο δίσκος = το git.
 */
const EXACT_BYTES = ['-c', 'core.autocrlf=false'];

function git(cwd, args, { inherit = false } = {}) {
  const stdio = inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'];
  const options = { cwd, env: cleanEnv(), encoding: 'utf8', stdio, maxBuffer: 1 << 28 };
  const out = execFileSync('git', [...EXACT_BYTES, ...args], options);
  return (out || '').trim();
}

/** Αποτυχία ως τιμή: ό,τι αρνείται το git είναι εδώ κανονική απάντηση, όχι κατάρρευση. */
function tryGit(cwd, args) {
  try {
    return { ok: true, out: git(cwd, args) };
  } catch (error) {
    return { ok: false, out: String(error.stderr || error.message).trim() };
  }
}

/** Τα ζωντανά worktrees· το πρώτο είναι πάντα το κύριο αντίγραφο. */
function worktrees(cwd) {
  const blocks = git(cwd, ['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/);
  return blocks.filter(Boolean).map((block) => {
    const field = (name) => (block.match(new RegExp(`^${name} (.+)$`, 'm')) || [])[1];
    const ref = field('branch');
    return { dir: path.resolve(field('worktree')), branch: ref ? ref.replace('refs/heads/', '') : null };
  });
}

function primaryDir(cwd) {
  return worktrees(cwd)[0].dir;
}

function isDirty(dir) {
  return git(dir, ['status', '--porcelain']).length > 0;
}

function branchExists(cwd, branch) {
  return tryGit(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).ok;
}

function revision(cwd, ref) {
  return git(cwd, ['rev-parse', ref]);
}

function commitsAhead(cwd, base, branch) {
  return Number(git(cwd, ['rev-list', '--count', `${base}..${branch}`]));
}

module.exports = { branchExists, commitsAhead, git, isDirty, primaryDir, revision, tryGit, worktrees };
