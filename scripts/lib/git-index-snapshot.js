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
  const listed = pathspecs.length === 0
    ? ''
    : runGit(repoRoot, ['ls-files', '-z', '--cached', '--', ...pathspecs]);
  const files = [...new Set(listed.split('\0').filter(Boolean))];
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

module.exports = { materializeIndex };
