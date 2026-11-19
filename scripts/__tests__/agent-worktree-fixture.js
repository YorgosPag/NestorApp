'use strict';
/**
 * Κοινό στήσιμο των tests του χώρου εργασίας πράκτορα (ADR-925): ΠΡΑΓΜΑΤΙΚΟ git σε
 * προσωρινό repo. Μόνο η εγκατάσταση εξαρτήσεων αντικαθίσταται, γιατί κοστίζει λεπτά.
 *
 * Δεν είναι αρχείο test (δεν ταιριάζει στο `*.test.js`)· το χρησιμοποιούν τα
 * `agent-worktree.test.js` και `agent-worktree-handoffs.test.js`.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { git } = require('../lib/agent-worktree/git');
const { createWorkspace } = require('../lib/agent-worktree/lifecycle');

const write = (dir, name, text) => fs.writeFileSync(path.join(dir, name), text);

/**
 * Git hook = αρχείο **εκτελέσιμο**. Σε Linux το git **παρακάμπτει σιωπηλά** hook χωρίς exec bit
 * (στα Windows δεν ελέγχεται) ⇒ στο CI το hook δεν έτρεχε ποτέ και οι άγκυρες της ένταξης
 * κοκκίνιζαν για λόγο άσχετο με τον κώδικα (ADR-783). Κάθε hook των tests γράφεται από εδώ.
 */
function writeHook(dir, name, text) {
  write(dir, name, text);
  fs.chmodSync(path.join(dir, name), 0o755);
}

function commitIn(dir, name, text, message = `add ${name}`) {
  write(dir, name, text);
  git(dir, ['add', name]);
  git(dir, ['commit', '-m', message]);
}

function fakeInstall(dir) {
  fs.mkdirSync(path.join(dir, 'node_modules'));
  write(path.join(dir, 'node_modules'), 'dep.txt', 'εξάρτηση\n');
}

/** Νέο προσωρινό repo στο `main`, χωρίς hooks, με ρίζα worktrees μέσα στο ίδιο sandbox. */
function createSandbox() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wt-'));
  const primary = path.join(sandbox, 'repo');
  fs.mkdirSync(primary);
  git(primary, ['init', '-b', 'main']);
  git(primary, ['config', 'user.email', 'test@example.com']);
  git(primary, ['config', 'user.name', 'test']);
  git(primary, ['config', 'core.hooksPath', '.no-hooks']);
  commitIn(primary, '.gitignore', 'node_modules/\n');
  const env = { NESTOR_WORKTREE_ROOT: path.join(sandbox, 'worktrees') };
  return { sandbox, primary, env };
}

const posix = (file) => file.replace(/\\/g, '/');

/**
 * Pre-commit που κάνει ό,τι το πραγματικό όταν περνά (ADR-925 §18): καταγράφει το δέντρο που
 * ενέκρινε. Κάθε πέρασμα γράφει τα σταδιοποιημένα του στο `seen`, για να μετρηθεί ποιος τον έτρεξε.
 */
function installStampingHook({ sandbox, primary }) {
  const hooks = path.join(sandbox, 'stamp-hooks');
  const seen = path.join(sandbox, 'stamp-seen.txt');
  const recorder = posix(path.resolve(__dirname, '../lib/agent-worktree/verified-trees.js'));
  fs.mkdirSync(hooks, { recursive: true });
  writeHook(hooks, 'pre-commit', `#!/bin/sh\ngit diff --cached --name-only >> "${posix(seen)}"\nnode "${recorder}"\n`);
  git(primary, ['config', 'core.hooksPath', posix(hooks)]);
  return { seen };
}

const removeSandbox = ({ sandbox }) => fs.rmSync(sandbox, { recursive: true, force: true });

const openWorkspace = ({ primary, env }, task) =>
  createWorkspace(task, { cwd: primary, env, minimumFree: 0, install: fakeInstall });

module.exports = { commitIn, createSandbox, fakeInstall, installStampingHook, openWorkspace, removeSandbox, write, writeHook };
