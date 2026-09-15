/**
 * CHECK 12 / ADR-598 G13 — Η ΑΠΟΓΡΑΦΗ: τι είναι εγκατεστημένο, και είναι αυτό που θα φύγει;
 *
 * ## 🔴 Γιατί `pnpm licenses list` και όχι `license-checker` (μετρημένο 2026-09-16)
 * Με `node-linker=isolated` (`.npmrc`) το `license-checker` βλέπει μόνο το root `node_modules`:
 * **126** πακέτα. Ο πραγματικός γράφος prod είναι **1.071** name@version. Το CI που γράφει
 * «full tree» ήταν στην πράξη direct. Το `pnpm licenses list --prod` διαβάζει lockfile + store:
 * όλος ο γράφος, ~3s.
 *
 * ## 🔴 Κανένα προσωρινό αρχείο — και αυτό ΕΙΝΑΙ η διόρθωση της ρίζας
 * Ο παλιός hook έκανε `mktemp` → κενό (το git.exe είχε κάνει `TMPDIR` ένα **αρχείο**, από
 * μεταβλητή `TMP` του commit script) → `> ""` → exit 1, με το `2>/dev/null` να πετά την αιτία
 * ⇒ «license-checker produced no output» για εργαλείο που **δεν ξεκίνησε ποτέ**. Εδώ η έξοδος
 * μένει **στη μνήμη**, και κάθε αποτυχία ονομάζεται (`spawn-outcome.js`).
 *
 * ## Απόκλιση lockfile — «μέτρησα τον κόσμο που θα γίνει commit;»
 * Η απογραφή περιγράφει το **εγκατεστημένο** δέντρο. Αν το lockfile **του commit** διαφέρει από
 * εκείνο με το οποίο εγκαταστάθηκε (`node_modules/.pnpm/lock.yaml`), η κρίση θα αφορούσε άλλο
 * δέντρο ⇒ UNKNOWN «τρέξε pnpm install», **ποτέ** ψευδές πράσινο.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { SPAWN_OUTCOME, classifySpawnResult } = require('../spawn-outcome');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MAX_BUFFER = 64 * 1024 * 1024;
const LOCKFILE = 'pnpm-lock.yaml';
const INSTALLED_LOCKFILE = path.join('node_modules', '.pnpm', 'lock.yaml');

/** Στα Windows το `pnpm` είναι `pnpm.cmd` ⇒ χρειάζεται shell. Τα ορίσματα είναι σταθερά. */
const PNPM_LICENSES_COMMAND = Object.freeze({
  file: 'pnpm',
  args: Object.freeze(['licenses', 'list', '--json', '--prod']),
  shell: process.platform === 'win32',
});

const commandText = (command) => [command.file, ...command.args].join(' ');

/** Κανονικοποίηση του `{ "<άδεια>": [{name, versions[], paths[], license}] }` σε γραμμές. */
function normalizeLicenseReport(json) {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, error: 'αναμενόταν αντικείμενο { άδεια: [πακέτα] }' };
  }
  const packages = [];
  for (const [group, entries] of Object.entries(json)) {
    if (!Array.isArray(entries)) return { ok: false, error: `η ομάδα «${group}» δεν είναι λίστα` };
    for (const entry of entries) {
      const valid = entry && typeof entry.name === 'string' && Array.isArray(entry.versions) && typeof entry.license === 'string';
      if (!valid) return { ok: false, error: `μη αναμενόμενη εγγραφή στην ομάδα «${group}»` };
      entry.versions.forEach((version, i) => {
        packages.push({ id: `${entry.name}@${version}`, name: entry.name, version, license: entry.license,
          path: (entry.paths && entry.paths[i]) || null });
      });
    }
  }
  packages.sort((a, b) => a.id.localeCompare(b.id));
  return { ok: true, packages };
}

function interpretInventoryOutput(base) {
  const text = base.stdout.trim();
  if (!text) return { ...base, outcome: SPAWN_OUTCOME.NO_OUTPUT, detail: 'το εργαλείο βγήκε 0 χωρίς καμία έξοδο' };
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ...base, outcome: SPAWN_OUTCOME.UNPARSEABLE, detail: `μη έγκυρο JSON: ${error.message}` };
  }
  const norm = normalizeLicenseReport(json);
  if (!norm.ok) return { ...base, outcome: SPAWN_OUTCOME.UNPARSEABLE, detail: norm.error };
  // «0 = κανείς δεν κοίταξε»: ένας γράφος prod χωρίς κανένα πακέτο δεν είναι «καθαρός».
  if (norm.packages.length === 0) {
    return { ...base, outcome: SPAWN_OUTCOME.NO_OUTPUT, detail: 'κενή απογραφή — 0 πακέτα prod δεν είναι «καθαρό», είναι «δεν μέτρησα»' };
  }
  return { ...base, outcome: SPAWN_OUTCOME.RAN, detail: null, packages: norm.packages };
}

/**
 * Τρέχει την απογραφή. **Ποτέ** δεν πετά: επιστρέφει `outcome` + την απόδειξη.
 * `command` / `env` εγχέονται **μόνο** από τη σουίτα (ψεύτικο εργαλείο, παλινδρόμηση `TMP`).
 */
function runLicenseInventory({ cwd = PROJECT_ROOT, command = PNPM_LICENSES_COMMAND, env = process.env } = {}) {
  const result = spawnSync(command.file, [...command.args], {
    cwd, env, encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'pipe'], shell: Boolean(command.shell),
  });
  const base = {
    command: commandText(command), cwd, status: result.status, signal: result.signal,
    stdout: result.stdout || '', stderr: result.stderr || '',
  };
  const cls = classifySpawnResult(result, { nonZeroIsFailure: true });
  if (cls.outcome !== SPAWN_OUTCOME.RAN) return { ...base, ...cls };
  return interpretInventoryOutput(base);
}

// ─── Lockfile ──────────────────────────────────────────────────────────────

const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n');

/**
 * Το lockfile **του commit**: `staged` = το blob του ευρετηρίου (`git show :pnpm-lock.yaml`,
 * ό,τι θα περιέχει το commit) · `worktree` = το αρχείο (CI, μετά το checkout).
 * @returns {{ok: true, text: string} | {ok: false, outcome: string, detail: string, command: string, stderr: string}}
 */
function readCommitLockfile({ repoRoot = PROJECT_ROOT, source = 'worktree' } = {}) {
  if (source === 'worktree') {
    const file = path.join(repoRoot, LOCKFILE);
    if (!fs.existsSync(file)) {
      return { ok: false, outcome: 'missing', detail: `λείπει το ${LOCKFILE}`, command: `read ${file}`, stderr: '' };
    }
    return { ok: true, text: fs.readFileSync(file, 'utf8') };
  }
  if (source !== 'staged') throw new Error(`άγνωστη πηγή lockfile «${source}» (staged | worktree)`);
  const result = spawnSync('git', ['show', `:${LOCKFILE}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  const cls = classifySpawnResult(result, { nonZeroIsFailure: true });
  if (cls.outcome !== SPAWN_OUTCOME.RAN) {
    return { ok: false, ...cls, command: `git show :${LOCKFILE}`, stderr: result.stderr || '' };
  }
  return { ok: true, text: result.stdout };
}

/**
 * @returns {{state: 'in-sync'|'drift'|'unmeasurable', detail: string, lockfileText?: string, evidence?: object}}
 */
function checkLockfileDrift({ repoRoot = PROJECT_ROOT, source = 'worktree' } = {}) {
  const commit = readCommitLockfile({ repoRoot, source });
  if (!commit.ok) {
    return { state: 'unmeasurable', detail: `το lockfile του commit δεν διαβάστηκε (${commit.outcome}): ${commit.detail}`, evidence: commit };
  }
  const installedFile = path.join(repoRoot, INSTALLED_LOCKFILE);
  if (!fs.existsSync(installedFile)) {
    return { state: 'unmeasurable', detail: `λείπει το ${INSTALLED_LOCKFILE} — δεν έχει γίνει εγκατάσταση (pnpm install)` };
  }
  const same = normalizeNewlines(commit.text) === normalizeNewlines(fs.readFileSync(installedFile, 'utf8'));
  return same
    ? { state: 'in-sync', detail: `${LOCKFILE} (${source}) = ${INSTALLED_LOCKFILE}`, lockfileText: commit.text }
    : { state: 'drift', detail: `το ${LOCKFILE} (${source}) ΔΙΑΦΕΡΕΙ από εκείνο με το οποίο εγκαταστάθηκε το node_modules — τρέξε pnpm install`, lockfileText: commit.text };
}

/**
 * Τα κλειδιά `name@version` της ενότητας `packages:` — **όλες** οι πλατφόρμες, όχι μόνο όσα
 * εγκαταστάθηκαν εδώ. Χρειάζεται για να μη λέγεται «κλαδεμένη» μια εξαίρεση πακέτου linux
 * όταν ο έλεγχος τρέχει σε Windows.
 */
function lockfilePackageKeys(lockfileText) {
  const keys = [];
  let inPackages = false;
  for (const line of normalizeNewlines(lockfileText).split('\n')) {
    if (/^\S/.test(line)) { inPackages = line.startsWith('packages:'); continue; }
    if (!inPackages) continue;
    const m = /^ {2}'?([^'\s][^']*?)'?:\s*$/.exec(line);
    if (m) keys.push(m[1]);
  }
  return keys;
}

/** `pnpm.patchedDependencies` — τα πακέτα που τροποποιούμε τοπικά. */
function patchedDependencies(repoRoot = PROJECT_ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  return Object.keys((manifest.pnpm && manifest.pnpm.patchedDependencies) || {});
}

module.exports = {
  PROJECT_ROOT,
  LOCKFILE,
  INSTALLED_LOCKFILE,
  PNPM_LICENSES_COMMAND,
  normalizeLicenseReport,
  runLicenseInventory,
  readCommitLockfile,
  checkLockfileDrift,
  lockfilePackageKeys,
  patchedDependencies,
};
