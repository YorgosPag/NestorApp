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
const { toPosix } = require('./resolve-specifier');

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

const IGNORED_DIR_NAMES = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', 'out']);

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
  return IGNORED_PATH_FRAGMENTS.some(fragment => relPosix.includes(fragment));
}

function isSourceFile(name) {
  if (name.endsWith('.d.ts')) return false;
  return SOURCE_EXTENSIONS.some(ext => name.endsWith(ext));
}

function walk(dir, projectRoot, out) {
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
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      if (isIgnored(`${rel}/`)) continue;
      walk(abs, projectRoot, out);
    } else if (entry.isFile() && isSourceFile(entry.name) && !isIgnored(rel)) {
      out.push(abs);
    }
  }
  return out;
}

/** @returns absolute posix paths of every source file in the analysed roots. */
function collectSourceFiles(projectRoot, roots = ['src', 'packages']) {
  const out = [];
  for (const root of roots) walk(toPosix(path.join(projectRoot, root)), projectRoot, out);
  return out.sort();
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
  APP_ENTRY_BASENAMES,
  isIgnored,
  isSourceFile,
  walk,
  collectSourceFiles,
  isEntryFile,
};
