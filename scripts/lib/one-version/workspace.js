/**
 * CHECK 3.65 — Η ΑΠΟΓΡΑΦΗ ΤΟΥ WORKSPACE (ADR-800)
 *
 * Διαβάζει το `pnpm-workspace.yaml` — τα `packages:` globs και το μπλοκ
 * `catalog:` — και επιστρέφει τα manifests που βρίσκονται στον δίσκο.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ, fail-closed**: υποστηρίζονται ακριβώς τρεις μορφές glob —
 * `.`, `<dir>/*`, `<dir>/**`. Οτιδήποτε άλλο ⇒ `throw` **με το pattern μέσα**.
 * Ένας «ανεκτικός» επεκτατής θα σιωπούσε πάνω σε μέλος που δεν κατάλαβε, και το
 * μέλος θα έμενε **έξω από κάθε κανόνα** — δηλαδή ακριβώς ο τρόπος με τον οποίο
 * γεννήθηκε το πρόβλημα που κρίνει αυτή η πύλη.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const WORKSPACE_FILE = 'pnpm-workspace.yaml';

const unquote = (s) => s.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

/** Ρηχή, δομική ανάγνωση των μπλοκ που μας αφορούν. Καμία εξάρτηση YAML. */
function parseWorkspaceFile(text) {
  const packages = [];
  const catalog = {};
  let block = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^packages:\s*$/.test(line)) { block = 'packages'; continue; }
    if (/^catalog:\s*$/.test(line)) { block = 'catalog'; continue; }
    if (/^\S/.test(line)) { block = null; continue; }
    if (block === 'packages') {
      const m = line.match(/^\s+-\s*(.+?)\s*$/);
      if (m) packages.push(unquote(m[1]));
    } else if (block === 'catalog') {
      const m = line.match(/^\s+"?([^":\s]+)"?:\s*(.+?)\s*$/);
      if (m) catalog[m[1]] = unquote(m[2]);
    }
  }
  return { packages, catalog };
}

/** Οι υποφάκελοι ενός καταλόγου, ταξινομημένοι — ντετερμινιστικά. */
function subdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'node_modules')
    .map((e) => e.name)
    .sort();
}

/** Αναδρομική συλλογή για το `**` — σταματά σε φάκελο που έχει manifest. */
function walkForManifests(repoRoot, relDir, out) {
  for (const name of subdirs(path.join(repoRoot, relDir))) {
    const rel = `${relDir}/${name}`;
    if (fs.existsSync(path.join(repoRoot, rel, 'package.json'))) out.push(rel);
    else walkForManifests(repoRoot, rel, out);
  }
}

/** Επεκτείνει ΕΝΑ pattern. Άγνωστη μορφή ⇒ σφάλμα με όνομα. */
function expandPattern(repoRoot, pattern) {
  if (pattern === '.') return ['.'];
  let m;
  if ((m = pattern.match(/^([\w./-]+)\/\*$/))) {
    return subdirs(path.join(repoRoot, m[1]))
      .map((n) => `${m[1]}/${n}`)
      .filter((rel) => fs.existsSync(path.join(repoRoot, rel, 'package.json')));
  }
  if ((m = pattern.match(/^([\w./-]+)\/\*\*$/))) {
    const out = [];
    walkForManifests(repoRoot, m[1], out);
    return out;
  }
  throw new Error(
    `${WORKSPACE_FILE}: μη υποστηριζόμενο glob ${JSON.stringify(pattern)} — υποστηρίζονται ".", "<dir>/*", "<dir>/**".`,
  );
}

/**
 * @returns {{members: Array<{dir: string, manifestPath: string, manifest: object}>, catalog: object, patterns: string[]}}
 */
function readWorkspace(repoRoot) {
  const file = path.join(repoRoot, WORKSPACE_FILE);
  if (!fs.existsSync(file)) throw new Error(`${WORKSPACE_FILE} δεν βρέθηκε στη ρίζα.`);
  const { packages, catalog } = parseWorkspaceFile(fs.readFileSync(file, 'utf8'));
  if (packages.length === 0) throw new Error(`${WORKSPACE_FILE}: κενό "packages:" — δεν υπάρχει workspace να κριθεί.`);

  const seen = new Set();
  const members = [];
  for (const pattern of packages) {
    for (const dir of expandPattern(repoRoot, pattern)) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      const manifestPath = path.join(repoRoot, dir, 'package.json');
      members.push({ dir, manifestPath, manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) });
    }
  }
  return { members, catalog, patterns: packages };
}

/** Οι δηλωμένες εξαρτήσεις ενός manifest, σε ένα επίπεδο. */
function declaredDependencies(manifest) {
  return {
    ...(manifest.dependencies || {}),
    ...(manifest.devDependencies || {}),
    ...(manifest.optionalDependencies || {}),
  };
}

module.exports = { WORKSPACE_FILE, readWorkspace, declaredDependencies, parseWorkspaceFile };
