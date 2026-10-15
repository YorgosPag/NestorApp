/**
 * @fileoverview **ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΟΥ COMMIT** — τα αρχεία του ευρετηρίου (index) υλοποιημένα
 * σε προσωρινό φάκελο, ώστε μια πύλη pre-commit να κρίνει **ό,τι θα μπει στο commit**,
 * όχι ό,τι τυχαίνει να βρίσκεται στο working tree.
 * @module scripts/lib/git-index-snapshot
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-09-27, CHECK 3.34): σε δέντρο με πολλούς παράλληλους πράκτορες,
 * ένα commit **που δεν άγγιζε κανένα locale** (μετακόμιση `easing`) μπλοκαρίστηκε επειδή
 * **ξένες, αστάδιοποίητες** αλλαγές στο `admin.json` έκαναν το working tree να αποκλίνει από
 * το `shell-slice`. Η πύλη έκρινε λάθος αντικείμενο: το commit ήταν συνεπές, ο δίσκος όχι.
 *
 * 🔑 Γιατί `checkout-index` και όχι `git show :path` ανά αρχείο: ένα spawn για όλο το σύνολο
 * (εκατοντάδες locales) αντί για ένα ανά αρχείο· και οι βιβλιοθήκες μένουν **αμετάβλητες** —
 * διαβάζουν από `projectRoot` όπως πάντα, απλώς η ρίζα είναι το στιγμιότυπο.
 * Αρχείο που **δεν** είναι στο index (untracked / διαγραμμένο-και-σταδιοποιημένο) **λείπει**
 * από το στιγμιότυπο — ακριβώς όπως θα λείπει από το commit.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MAX_BUFFER = 64 * 1024 * 1024;

function runGit(repoRoot, args, input) {
  const result = spawnSync('git', args, {
    cwd: repoRoot, input, encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} απέτυχε (${result.status}): ${(result.stderr || '').trim()}`);
  }
  return result.stdout;
}

/**
 * @param {{repoRoot: string, pathspecs: string[]}} options pathspecs = αρχεία ή φάκελοι, σχετικοί με τη ρίζα
 * @returns {{root: string, files: string[], dispose: () => void}}
 */
function materializeIndex({ repoRoot, pathspecs }) {
  // ⚠️ Τα pathspecs ΔΕΝ περνούν ως ορίσματα: ~900 αρχεία κλειστότητας (CHECK 3.51) = ENAMETOOLONG στα Windows.
  // Μία `ls-files` για όλο το ευρετήριο (~30k, μετρημένο <1s) και φίλτρο εδώ: ακριβές αρχείο ή πρόθεμα φακέλου.
  const exact = new Set(pathspecs.map(spec => spec.replace(/\\/g, '/').replace(/\/+$/, '')));
  const underSpec = file => {
    for (let at = file.lastIndexOf('/'); at > 0; at = file.lastIndexOf('/', at - 1)) {
      if (exact.has(file.slice(0, at))) return true;
    }
    return false;
  };
  const files = exact.size === 0
    ? []
    : runGit(repoRoot, ['ls-files', '-z', '--cached']).split('\0').filter(f => f && (exact.has(f) || underSpec(f)));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-index-snapshot-'));
  const dispose = () => fs.rmSync(root, { recursive: true, force: true });
  try {
    if (files.length > 0) {
      const prefix = `${root.replace(/\\/g, '/')}/`;
      runGit(repoRoot, ['checkout-index', '-f', '-z', '--stdin', `--prefix=${prefix}`], `${files.join('\0')}\0`);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return { root, files, dispose };
}

/**
 * Γράφει περιεχόμενο **μόνο στο ευρετήριο** (`hash-object -w` + `update-index --cacheinfo`) — ο δίσκος μένει
 * ανέγγιχτος. Για παραγόμενα αρχεία των οποίων το αντίγραφο στον δίσκο κουβαλά **ξένη** αστάδιοποίητη δουλειά:
 * το commit παίρνει ό,τι γεννιέται από το ευρετήριο, και κανείς δεν χάνει τίποτα.
 * @param {{repoRoot: string, relPath: string, content: string}} options
 */
function writeIndexBlob({ repoRoot, relPath, content }) {
  const sha = runGit(repoRoot, ['hash-object', '-w', '--stdin', '--path', relPath], content).trim();
  runGit(repoRoot, ['update-index', '--add', '--cacheinfo', `100644,${sha},${relPath}`]);
  return sha;
}

/**
 * Το κείμενο ενός αρχείου **όπως είναι στο ευρετήριο** (`git show :path`), ή `null` αν δεν υπάρχει εκεί.
 * @param {{repoRoot: string, relPath: string}} options
 */
function readIndexText({ repoRoot, relPath }) {
  const result = spawnSync('git', ['show', `:${relPath}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (result.error) throw result.error;
  return result.status === 0 ? result.stdout : null;
}

/**
 * ADR-744 §31 — `μονοπάτι → blob sha` για κάθε εγγραφή του ευρετηρίου (stage 0). **Δωρεάν**
 * διεύθυνση περιεχομένου: το git έχει ήδη κατακερματίσει κάθε αρχείο που θα μπει στο commit.
 * @param {{repoRoot: string}} options
 * @returns {Map<string, string>}
 */
function listIndexEntries({ repoRoot }) {
  const entries = new Map();
  for (const record of runGit(repoRoot, ['ls-files', '-s', '-z']).split('\0')) {
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const [, sha, stage] = record.slice(0, tab).split(' ');
    if (stage === '0') entries.set(record.slice(tab + 1), sha);
  }
  return entries;
}

/**
 * Τα αρχεία των οποίων το working tree **αποκλίνει** από το ευρετήριο (αλλαγμένα ή σβησμένα,
 * αστάδιοποίητα). Για όλα τα υπόλοιπα, ο δίσκος ΕΙΝΑΙ το ευρετήριο — διαβάζεται χωρίς spawn.
 * @param {{repoRoot: string}} options
 * @returns {Set<string>}
 */
function listWorktreeDivergence({ repoRoot }) {
  return new Set(runGit(repoRoot, ['diff', '--name-only', '-z', '--no-renames']).split('\0').filter(Boolean));
}

/**
 * Το κείμενο πολλών blobs του ευρετηρίου, **ωμό** (τα bytes του αντικειμένου), σε ΕΝΑ spawn:
 * `git cat-file --batch` με είσοδο `<sha>`. Αντικείμενο που λείπει απλώς λείπει.
 *
 * ⚠️ ΓΙΑΤΙ ΟΧΙ `--filters`, ΜΕΤΡΗΜΕΝΟ (git 2.54, Windows): το `%(objectsize)` αναφέρει το μέγεθος
 * του **αφιλτράριστου** blob ενώ εκπέμπει τα **φιλτραρισμένα** bytes (LF→CRLF) ⇒ ο αναλυτής
 * αποσυγχρονίζεται από το πρώτο αρχείο και κάθε επόμενο κείμενο είναι σκουπίδι (33/33 λάθος).
 * Ό,τι διαβάζει ο walk (ακμές, ονόματα, namespaces) δεν εξαρτάται από το EOL.
 * @param {{repoRoot: string, entries: Array<[string, string]>}} options `[μονοπάτι, blob sha]`
 * @returns {Map<string, string>}
 */
function readIndexTexts({ repoRoot, entries }) {
  const out = new Map();
  if (entries.length === 0) return out;
  const result = spawnSync('git', ['cat-file', '--batch'], {
    cwd: repoRoot, input: entries.map(([, sha]) => `${sha}\n`).join(''), maxBuffer: MAX_BUFFER * 4,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git cat-file --batch απέτυχε (${result.status}): ${String(result.stderr).trim()}`);
  const buffer = result.stdout;
  let at = 0;
  for (const [rel] of entries) {
    const eol = buffer.indexOf(0x0a, at);
    const header = buffer.toString('utf8', at, eol);
    at = eol + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.slice(header.lastIndexOf(' ') + 1));
    out.set(rel, buffer.toString('utf8', at, at + size));
    at += size + 1;   // + το LF που κλείνει κάθε αντικείμενο
  }
  return out;
}

module.exports = {
  materializeIndex, writeIndexBlob, readIndexText, listIndexEntries, listWorktreeDivergence, readIndexTexts,
};
