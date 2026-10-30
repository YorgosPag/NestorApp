#!/usr/bin/env node
/**
 * ADR-700 §1 — What to read, and what counts as a root.
 *
 * DIVERGENCE FROM knip.json — deliberate, and the entire point of this gate:
 *   knip.json:14 declares `src/**\/index.ts` an ENTRY POINT, so every barrel is
 *   "public API" and everything it forwards is used by definition. Here barrels
 *   are ordinary modules; the roots are only what the framework really calls
 *   without an import. knip.json:33 additionally hides `src/subapps/dxf-viewer`
 *   from the REPORT (knip's own docs call `ignore` an anti-pattern for this) —
 *   we scan it as first-class.
 *
 * Backup/archive trees ARE excluded from the graph, not just the report: a dead
 * tree that still imports live code would keep that code alive on paper.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { toPosix } = require('../posix-path');

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

// ⚠️ ΚΑΤΑ ΟΝΟΜΑ, ΟΠΟΥΔΗΠΟΤΕ: ΜΟΝΟ φάκελοι εργαλείων, που δεν κουβαλούν ΠΟΤΕ πηγαίο κώδικα του έργου.
// 🔴 ΜΕΤΡΗΜΕΝΟ 2026-10-30 (ADR-924 §8.7): το `coverage` εδώ έκρυβε τη ΔΙΑΔΡΟΜΗ
// `src/app/(app)/o/[workspace]/projects/[id]/procurement/coverage/page.tsx` από κάθε πύλη — το ίδιο σφάλμα
// με το αναγκύρωτο `coverage/` του `.gitignore`. Τα παραγόμενα ζουν ΑΓΚΥΡΩΜΕΝΑ στο `IGNORED_PATH_PREFIXES`.
const IGNORED_DIR_NAMES = new Set(['node_modules', '.next', '.git']);

/** Παραγόμενα (κάλυψη jest, build) — πρόθεμα από τη ρίζα, ποτέ όνομα οπουδήποτε. */
const IGNORED_PATH_PREFIXES = [
  'coverage/',
  'src/subapps/dxf-viewer/coverage/',
  'packages/core/dist/',
];

const IGNORED_PATH_FRAGMENTS = [
  'src/subapps/dxf-viewer-10-backup/',
  'src/subapps/dxf-viewer/test.BACK/',
  'src/subapps/dxf-viewer/archive/',
  'src/app/test.BACK/',
  'src/ai.back/',
  'recovery/',
  'src/md_files/',
  'src/txt_files/',
];

// Next.js file conventions + the roots the framework calls without an import.
const APP_ENTRY_BASENAMES = new Set([
  'page', 'layout', 'route', 'loading', 'error', 'not-found', 'template',
  'default', 'global-error', 'sitemap', 'robots', 'manifest',
  'opengraph-image', 'twitter-image', 'icon', 'apple-icon', 'instrumentation',
]);

function isIgnored(relPosix) {
  return IGNORED_PATH_PREFIXES.some(prefix => relPosix.startsWith(prefix))
    || IGNORED_PATH_FRAGMENTS.some(fragment => relPosix.includes(fragment));
}

function isSourceFile(name) {
  if (name.endsWith('.d.ts')) return false;
  return SOURCE_EXTENSIONS.some(ext => name.endsWith(ext));
}

/**
 * Ο ΕΝΑΣ περιπατητής του δίσκου (ADR-924 Φ3). Κλαδεύει ΜΟΝΟ τους φακέλους εργαλείων (`IGNORED_DIR_NAMES`) και
 * ό,τι απορρίπτει το `pruneDir(rel + '/')`· κρατά κάθε αρχείο που δέχεται το `accept(rel)`. `out` ← απόλυτα posix.
 */
function walkFiles(dir, projectRoot, { accept, pruneDir = () => false }, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = toPosix(path.join(dir, entry.name));
    const rel = toPosix(path.relative(projectRoot, abs));
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name) || isGenerated(`${rel}/`) || pruneDir(`${rel}/`)) continue;
      walkFiles(abs, projectRoot, { accept, pruneDir }, out);
    } else if (entry.isFile() && accept(rel)) {
      out.push(abs);
    }
  }
  return out;
}

/** Κάθε αρχείο των ριζών που δέχεται το `accept(rel)` — ταξινομημένα απόλυτα posix. */
function listFiles(projectRoot, roots, accept, pruneDir) {
  const out = [];
  for (const root of roots) walkFiles(toPosix(path.join(projectRoot, root)), projectRoot, { accept, pruneDir }, out);
  return out.sort();
}

/** Μονοπάτι κάτω από φάκελο εργαλείου (`node_modules` …) — ό,τι κλαδεύει ο `walkFiles`, για μονοπάτι από το git. */
function underToolDir(relPosix) {
  return isGenerated(relPosix) || relPosix.split('/').slice(0, -1).some(segment => IGNORED_DIR_NAMES.has(segment));
}

/**
 * Παραγόμενο (κάλυψη jest, build) — ΠΟΤΕ πηγή για καμία πύλη, όποιο κι αν είναι το κριτήριό της. Ο περιπατητής το κλαδεύει
 * πάντα (ADR-924 §8.8: χωρίς αυτό, η σάρωση `.css` του 3.43 έβλεπε 4 CSS της αναφοράς κάλυψης).
 */
function isGenerated(relPosix) {
  return IGNORED_PATH_PREFIXES.some(prefix => relPosix.startsWith(prefix));
}

const isSourcePath = rel => isSourceFile(rel.slice(rel.lastIndexOf('/') + 1)) && !isIgnored(rel);

/**
 * `.ts`/`.tsx` (όχι `.d.ts`) **χωρίς** τις εξαιρέσεις backup του `isIgnored` — ο παρονομαστής των πυλών συνόρου
 * (3.61 · 3.75), που κρίνουν και τα αρχεία των backup. Ήταν δύο πανομοιότυποι τοπικοί περιπατητές (ADR-924 Φ3).
 */
const isTypeScriptSource = rel => /\.tsx?$/.test(rel) && !rel.endsWith('.d.ts');

/**
 * ADR-744 §31 — το ΙΔΙΟ κριτήριο με το `walk`, για μονοπάτι που ΔΕΝ προέρχεται από τον δίσκο
 * (π.χ. `git ls-files`). Ο `walk` κλαδεύει φακέλους για ταχύτητα· εδώ ρωτιέται κάθε πρόγονος.
 * Άγκυρα: ισοδυναμία με το `collectSourceFiles` στο πραγματικό δέντρο.
 */
function isAnalysedSourcePath(relPosix) {
  return !underToolDir(relPosix) && isSourcePath(relPosix);
}

/** @returns absolute posix paths of every source file in the analysed roots. */
function collectSourceFiles(projectRoot, roots = ['src', 'packages']) {
  return listFiles(projectRoot, roots, isSourcePath, isIgnored);
}

function isEntryFile(relPosix) {
  if (relPosix === 'src/middleware.ts' || relPosix === 'src/instrumentation.ts') return true;
  if (relPosix.startsWith('src/app/api/')) return true;
  if (/\.worker\.tsx?$/.test(relPosix)) return true;
  if (!relPosix.startsWith('src/app/')) return false;
  const base = relPosix.slice(relPosix.lastIndexOf('/') + 1).replace(/\.tsx?$/, '');
  return APP_ENTRY_BASENAMES.has(base);
}

module.exports = {
  SOURCE_EXTENSIONS,
  IGNORED_DIR_NAMES,
  IGNORED_PATH_FRAGMENTS,
  IGNORED_PATH_PREFIXES,
  APP_ENTRY_BASENAMES,
  isIgnored,
  isSourceFile,
  isAnalysedSourcePath,
  isTypeScriptSource,
  walkFiles,
  listFiles,
  underToolDir,
  collectSourceFiles,
  isEntryFile,
};
