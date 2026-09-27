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

module.exports = { materializeIndex, writeIndexBlob, readIndexText };
