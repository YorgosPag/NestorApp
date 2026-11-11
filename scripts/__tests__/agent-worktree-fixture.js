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

const removeSandbox = ({ sandbox }) => fs.rmSync(sandbox, { recursive: true, force: true });

const openWorkspace = ({ primary, env }, task) =>
  createWorkspace(task, { cwd: primary, env, minimumFree: 0, install: fakeInstall });

module.exports = { commitIn, createSandbox, fakeInstall, openWorkspace, removeSandbox, write };
