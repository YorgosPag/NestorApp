'use strict';
/**
 * Καθαρισμός ορφανών φακέλων worktree (ADR-925 §17): `npm run wt:prune [-- --yes]`.
 *
 * Ορφανός = άμεσο παιδί μιας από τις δύο ρίζες worktrees (`wt:*` και harness) που το git ΔΕΝ
 * γνωρίζει. Πρότυπο `git worktree prune` / `docker system prune`: σβήσιμο με κριτήριο, ξερή
 * εκτέλεση εξ ορισμού. Ό,τι δεν αποδεικνύεται ορφανό παραλείπεται με αιτία, δεν σβήνεται.
 */

const fs = require('node:fs');
const path = require('node:path');
const { HANDOFF_DIR, HANDOFF_EXTENSION, HARNESS_WORKTREE_DIR, worktreeRoot } = require('./config');
const { gitReport, primaryDir, worktrees } = require('./git');
const { clearResidue, freeBytes, isInside, nearestExisting } = require('./lifecycle');

/** Οι ρίζες που ανήκουν σε worktrees, χωρίς διπλότυπα και μόνο όσες υπάρχουν. */
function pruneRoots(primary, env) {
  const roots = [worktreeRoot(env), path.join(primary, HARNESS_WORKTREE_DIR)];
  const distinct = roots.filter((root, index) => roots.findIndex((other) => path.relative(other, root) === '') === index);
  return distinct.filter((root) => fs.existsSync(root));
}

/** Καθαρίζει (ή, χωρίς `apply`, μόνο απαριθμεί) καταχωρήσεις χωρίς φάκελο· locked μένουν. */
function pruneEntries(primary, apply) {
  const out = gitReport(primary, ['worktree', 'prune', '--verbose', ...(apply ? [] : ['--dry-run'])]);
  return out.split(/\r?\n/).filter(Boolean);
}

/** Ένας φάκελος που το git γνωρίζει ο ίδιος, ή που περιέχει καταχωρημένο worktree, δεν είναι ορφανός. */
function holdsRegistered(dir, registered) {
  return registered.some((item) => isInside(dir, item));
}

/**
 * `.git` αρχείο που δείχνει σε ζωντανό φάκελο διαχείρισης, ο οποίος δείχνει ΠΙΣΩ σε αυτόν τον φάκελο:
 * καταχωρημένο σε κάποιο repo (ίσως άλλο). Αν ο φάκελος διαχείρισης ανήκει πλέον σε άλλο worktree
 * με το ίδιο όνομα, το δικό μας είναι ορφανό. Ό,τι δεν διαβάζεται κρίνεται καταχωρημένο.
 */
function linkedElsewhere(dir, dotGit) {
  try {
    const match = fs.readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m);
    if (!match) return true;
    const admin = path.resolve(dir, match[1].trim());
    const back = path.join(admin, 'gitdir');
    if (!fs.existsSync(back)) return false;
    return path.relative(path.resolve(admin, fs.readFileSync(back, 'utf8').trim()), dotGit) === '';
  } catch {
    return true;
  }
}

/** Handoffs πρώτου επιπέδου που ΔΕΝ υπάρχουν byte-ίδια στο κύριο αντίγραφο. Μόνο fs: το git δεν ξέρει τον φάκελο. */
function uncollectedHandoffs(dir, primary) {
  const source = path.join(dir, HANDOFF_DIR);
  if (!fs.existsSync(source)) return [];
  return fs.readdirSync(source, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(HANDOFF_EXTENSION))
    .map((entry) => entry.name)
    .filter((name) => {
      const destination = path.join(primary, HANDOFF_DIR, name);
      return !fs.existsSync(destination) || !fs.readFileSync(destination).equals(fs.readFileSync(path.join(source, name)));
    })
    .sort();
}

/** @returns {{ reason: string, detail?: string[] } | null} γιατί ΔΕΝ σβήνεται, ή `null`. */
function skipReason(dir, { primary, cwd }) {
  const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!stat) return { reason: 'gone' };
  if (!stat.isDirectory()) return { reason: 'not-directory' };
  if (isInside(dir, cwd)) return { reason: 'cwd' };
  const dotGit = path.join(dir, '.git');
  const gitStat = fs.lstatSync(dotGit, { throwIfNoEntry: false });
  if (gitStat && gitStat.isDirectory()) return { reason: 'foreign-repo' };
  if (gitStat && linkedElsewhere(dir, dotGit)) return { reason: 'registered-elsewhere' };
  const handoffs = uncollectedHandoffs(dir, primary);
  return handoffs.length > 0 ? { reason: 'handoffs', detail: handoffs } : null;
}

/** Bytes αρχείων, χωρίς να ακολουθεί junction ή symlink. Τα hard links του pnpm μετρούν ολόκληρα. */
function diskUsage(dir) {
  let bytes = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue; // απρόσιτος υποφάκελος: η μέτρηση είναι ενδεικτική, όχι φράχτης
    }
    entries.forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) bytes += fs.lstatSync(full, { throwIfNoEntry: false })?.size || 0;
    });
  }
  return bytes;
}

function registeredDirs(primary) {
  return worktrees(primary).map((item) => item.dir);
}

/**
 * Απογραφή χωρίς αλλαγή στον φάκελο (με `apply`, μόνο το `git worktree prune` γίνεται πραγματικό).
 * @returns {{ primary: string, roots: string[], pruned: string[], orphans: { dir: string, bytes: number, skip: object | null }[] }}
 */
function findOrphans({ cwd = process.cwd(), env = process.env, apply = false } = {}) {
  const primary = primaryDir(cwd);
  const pruned = pruneEntries(primary, apply);
  const registered = registeredDirs(primary);
  const roots = pruneRoots(primary, env);
  const context = { primary, cwd: path.resolve(cwd) };
  const orphans = roots
    .flatMap((root) => fs.readdirSync(root).map((name) => path.join(root, name)))
    .filter((dir) => !holdsRegistered(dir, registered))
    .map((dir) => {
      const skip = skipReason(dir, context);
      return { dir, skip, bytes: skip && skip.reason === 'gone' ? 0 : diskUsage(dir) };
    });
  return { primary, roots, pruned, orphans };
}

/** Ελεύθερα bytes ανά δίσκο των ριζών (μία μέτρηση ανά γράμμα δίσκου). */
function freeByDrive(roots) {
  const byDrive = new Map(roots.map((root) => [path.parse(root).root.toLowerCase(), root]));
  return [...byDrive.values()].reduce((sum, root) => sum + freeBytes(nearestExisting(root)), 0);
}

/**
 * Σβήσιμο των ορφανών. Πριν από ΚΑΘΕ φάκελο ξαναρωτά το git και τους φράχτες: άλλος πράκτορας
 * μπορεί στο μεταξύ να έφτιαξε worktree με το ίδιο όνομα. Κρατημένος φάκελος = `residue`, συνέχεια.
 */
function pruneOrphans({ cwd = process.cwd(), env = process.env, retry } = {}) {
  const scan = findOrphans({ cwd, env, apply: true });
  const before = freeByDrive(scan.roots);
  const context = { primary: scan.primary, cwd: path.resolve(cwd) };
  const orphans = scan.orphans.map((orphan) => {
    if (orphan.skip) return orphan;
    if (holdsRegistered(orphan.dir, registeredDirs(scan.primary))) return { ...orphan, skip: { reason: 'registered' } };
    const skip = skipReason(orphan.dir, context);
    if (skip) return { ...orphan, skip };
    return { ...orphan, residue: clearResidue(orphan.dir, retry) };
  });
  return { ...scan, orphans, freedBytes: Math.max(0, freeByDrive(scan.roots) - before) };
}

module.exports = { findOrphans, pruneOrphans };
