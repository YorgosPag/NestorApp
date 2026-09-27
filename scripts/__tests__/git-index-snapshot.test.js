/**
 * CHECK 3.34 — το στιγμιότυπο του ευρετηρίου κρίνει το COMMIT, όχι τον δίσκο (2026-09-27).
 * Πραγματικό προσωρινό git repo: καμία εικονική υλοποίηση του git.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { materializeIndex } = require('../lib/git-index-snapshot');

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

describe('materializeIndex', () => {
  let repo;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'index-snapshot-test-'));
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 'test@example.com');
    git(repo, 'config', 'user.name', 'test');
    git(repo, 'config', 'core.autocrlf', 'false');
    fs.mkdirSync(path.join(repo, 'locales'));
    fs.writeFileSync(path.join(repo, 'locales', 'a.json'), 'committed');
    fs.writeFileSync(path.join(repo, 'other.txt'), 'outside the pathspec');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'init');
  });

  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it('διαβάζει το ΣΤΑΔΙΟΠΟΙΗΜΕΝΟ περιεχόμενο, όχι το αστάδιοποίητο του δίσκου', () => {
    const file = path.join(repo, 'locales', 'a.json');
    fs.writeFileSync(file, 'staged');
    git(repo, 'add', 'locales/a.json');
    fs.writeFileSync(file, 'foreign unstaged work');

    const snapshot = materializeIndex({ repoRoot: repo, pathspecs: ['locales'] });
    try {
      expect(fs.readFileSync(path.join(snapshot.root, 'locales', 'a.json'), 'utf8')).toBe('staged');
    } finally {
      snapshot.dispose();
    }
  });

  it('αρχείο εκτός ευρετηρίου (untracked) ΛΕΙΠΕΙ — όπως θα λείπει από το commit', () => {
    fs.writeFileSync(path.join(repo, 'locales', 'untracked.json'), 'x');
    const snapshot = materializeIndex({ repoRoot: repo, pathspecs: ['locales'] });
    try {
      expect(fs.existsSync(path.join(snapshot.root, 'locales', 'untracked.json'))).toBe(false);
      expect(snapshot.files).toEqual(['locales/a.json']);
    } finally {
      snapshot.dispose();
    }
  });

  it('υλοποιεί ΜΟΝΟ τα pathspecs, και ο dispose σβήνει τον φάκελο', () => {
    const snapshot = materializeIndex({ repoRoot: repo, pathspecs: ['locales'] });
    expect(fs.existsSync(path.join(snapshot.root, 'other.txt'))).toBe(false);
    snapshot.dispose();
    expect(fs.existsSync(snapshot.root)).toBe(false);
  });

  it('σταδιοποιημένη διαγραφή ⇒ λείπει από το στιγμιότυπο', () => {
    git(repo, 'rm', '-q', 'locales/a.json');
    const snapshot = materializeIndex({ repoRoot: repo, pathspecs: ['locales/a.json'] });
    try {
      expect(snapshot.files).toEqual([]);
    } finally {
      snapshot.dispose();
    }
  });
});
