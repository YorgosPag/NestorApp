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

/**
 * ~11 δευτ. συνολικά, γραμμική αύξηση: αρκούν για διεργασία που κλείνει (π.χ. αμέσως μετά το
 * `ExitWorktree`) ή για antivirus. Δικός μας βρόχος, γιατί το `maxRetries` του `rmSync` ΔΕΝ
 * καλύπτει το cwd: πετά `EBUSY` σε 1 ms (μετρημένο 2026-10-31, Node 20.19).
 */
const RESIDUE_RETRY = { attempts: 11, delayMs: 200 };

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Το `git worktree remove` αφήνει φακέλους με junctions (μετρημένο 2026-10-31: 5.404 σε
 * ένα υπόλειμμα). Το `rmSync` δεν ακολουθεί junction.
 *
 * Επιστρέφει `null` όταν ο φάκελος έφυγε, αλλιώς την αιτία. Τιμή, όχι εξαίρεση: το υπόλειμμα
 * είναι κανονική κατάσταση του κύκλου ζωής και δεν πρέπει να διακόπτει τα υπόλοιπα βήματα.
 */
function clearResidue(dir, { attempts, delayMs } = RESIDUE_RETRY) {
  let failure = 'άγνωστη αιτία';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      failure = error.code || error.message;
    }
    if (!fs.existsSync(dir)) return null;
    if (attempt < attempts) sleep(attempt * delayMs);
  }
  return failure;
}

function discardWorkspace(primary, target) {
  tryGit(primary, ['worktree', 'remove', '--force', target.dir]);
  tryGit(primary, ['branch', '-D', target.branch]);
  clearResidue(target.dir);
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

/**
 * Το git κρατά την καταχώρηση και όταν ο φάκελος έχει σβηστεί («prunable»). Με `cwd` που
 * λείπει το `execFileSync` πετά `spawnSync git ENOENT`, και μία τέτοια γραμμή έριχνε όλη
 * την απογραφή (μετρημένο 2026-10-31). Το λέμε ως κατάσταση, δεν το κρύβουμε.
 */
function listWorkspaces({ cwd = process.cwd(), env = process.env } = {}) {
  const primary = primaryDir(cwd);
  const workspaces = worktrees(cwd)
    .filter((item) => item.branch && item.branch.startsWith(BRANCH_PREFIX))
    .map((item) => {
      const missing = !fs.existsSync(item.dir);
      return {
        ...item,
        missing,
        dirty: !missing && isDirty(item.dir),
        ahead: commitsAhead(primary, MAIN_BRANCH, item.branch),
      };
    });
  return { workspaces, freeBytes: freeBytes(nearestExisting(worktreeRoot(env))) };
}

function requireWorkspace(cwd, target) {
  const entry = worktrees(cwd).find((item) => item.branch === target.branch);
  if (!entry) throw new Error(`Δεν υπάρχει ενεργό worktree για το κλαδί ${target.branch}.`);
  return entry;
}

const samePath = (a, b) => path.relative(a, b) === '';

/** Το cwd κρατά τον φάκελο στα Windows: από μέσα του το σβήσιμο αποτυγχάνει πάντα. */
function assertOutside(cwd, dir) {
  const [first] = path.relative(dir, path.resolve(cwd)).split(path.sep);
  if (first !== '..' && !path.isAbsolute(first)) {
    throw new Error(`Τρέχεις μέσα από το ${dir}. Βγες πρώτα (πράκτορας: ExitWorktree) και ξανατρέξε από το κύριο αντίγραφο.`);
  }
}

/** Εδώ σβήνουμε αναδρομικά: ένα ανεξάρτητο repo δεν είναι ποτέ δικό μας υπόλειμμα. */
function assertNotForeignRepo(dir) {
  const dotGit = fs.statSync(path.join(dir, '.git'), { throwIfNoEntry: false });
  if (dotGit && dotGit.isDirectory()) throw new Error(`Το ${dir} είναι ανεξάρτητο repo, όχι worktree. Δεν σβήνω τίποτα.`);
}

/**
 * Κατά φάκελο, όχι κατά κλαδί: σε rebase ένα worktree φαίνεται χωρίς κλαδί, και αλλιώς
 * θα κρινόταν υπόλειμμα μαζί με τη δουλειά του.
 */
function findEntry(primary, target) {
  return worktrees(primary).find((item) => item.branch === target.branch || samePath(item.dir, target.dir));
}

/**
 * Κρίνει την κατάσταση μετά, όχι τον κωδικό εξόδου: με κρατημένο φάκελο το git τερματίζει
 * με 255 ΑΦΟΥ έχει ήδη σβήσει την καταχώρηση (μετρημένο 2026-10-31, git 2.54). Επιστρέφει
 * αν υπήρχε καταχώρηση.
 */
function unregister(primary, target) {
  const entry = findEntry(primary, target);
  if (!entry) return false;
  if (!fs.existsSync(entry.dir)) {
    git(primary, ['worktree', 'prune']);
    return true;
  }
  if (isDirty(entry.dir)) throw new Error(`Το ${entry.dir} έχει αδέσμευτη δουλειά. Δεν σβήνω τίποτα.`);
  const removed = tryGit(primary, ['worktree', 'remove', entry.dir]);
  if (findEntry(primary, target)) throw new Error(`Το git αρνήθηκε το σβήσιμο.\n${removed.out}`);
  return true;
}

/**
 * Σύγκλιση, όχι σειρά βημάτων: κάθε εκτέλεση ολοκληρώνει ό,τι βρει, άρα μια διακοπή
 * διορθώνεται ξανατρέχοντας την ίδια εντολή. Το κλαδί σβήνεται πριν από τον φάκελο, ώστε
 * ένα κρατημένο υπόλειμμα να μην το αφήνει πίσω.
 */
function removeWorkspace(task, { cwd = process.cwd(), env = process.env, retry = RESIDUE_RETRY } = {}) {
  const target = locate(task, env);
  assertOutside(cwd, target.dir);
  assertNotForeignRepo(target.dir);
  const primary = primaryDir(cwd);
  const registered = unregister(primary, target);
  const hasBranch = branchExists(primary, target.branch);
  const hasDir = fs.existsSync(target.dir);
  // `-d`, όχι `-D`: το git αρνείται αν το κλαδί δεν έχει ενταχθεί, και τότε τα commits μένουν ασφαλή.
  const branch = hasBranch ? tryGit(primary, ['branch', '-d', target.branch]) : { ok: true };
  return {
    ...target,
    nothingFound: !registered && !hasBranch && !hasDir,
    branchKept: branch.ok ? null : branch.out,
    residue: hasDir ? clearResidue(target.dir, retry) : null,
  };
}

module.exports = { clearResidue, createWorkspace, listWorkspaces, removeWorkspace, requireWorkspace };
