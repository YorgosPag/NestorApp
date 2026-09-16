/**
 * ADR-861 Φ3 — Ο «ΚΟΣΜΟΣ» ΠΟΥ ΚΡΙΝΕΙ Η ΠΥΛΗ: δίσκος + git, σε ένα σημείο.
 *
 * Το `judge.js` είναι καθαρό· εδώ ζουν **μόνο** οι αναγνώσεις. Και το παραγόμενο ευρετήριο
 * αποδίδεται **εδώ**, ώστε γεννήτορας και πύλη να συγκρίνουν με **την ίδια** απόδοση.
 *
 * ⚠️ **Βάση σύγκρισης του Κ3** = `HEAD` (pre-commit). Στο CI η βάση ορίζεται με
 * `LEGAL_DOCUMENTS_BASE_REF` (π.χ. `origin/main`)· χωρίς αυτήν, στο CI ο Κ3 συγκρίνει το commit
 * με τον εαυτό του — **δηλωμένο όριο**, όχι σιωπηλό πράσινο (ADR-861 §7).
 *
 * @module scripts/lib/legal-documents/world
 */

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const M = require('./model');

const toIdentifier = (id, version) =>
  `${id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}V${version}`;

/** Η **μία** απόδοση του ευρετηρίου εισαγωγών — ντετερμινιστική, LF. */
function renderIndex(manifest, ids) {
  const imports = [];
  const names = [];
  for (const id of ids) {
    const rows = (manifest.documents && manifest.documents[id]) || [];
    for (const row of rows) {
      const name = toIdentifier(id, row.version);
      imports.push(`import ${name} from './${id}/v${row.version}.json';`);
      names.push(name);
    }
  }
  return [
    '/**',
    ' * ⚠️ ΠΑΡΑΓΕΤΑΙ — `npm run legal:freeze` / `npm run legal:index`. ΜΗΝ το επεξεργαστείς (CHECK 3.85 Κ7).',
    ' *',
    ' * Κάθε παγωμένη έκδοση νομικού εγγράφου, ως **άγνωστη** τιμή: τη στενεύει σε τύπο **ένας**',
    ' * αναγνώστης, `lib/legal/legal-document-versions.ts` — ποτέ `as`.',
    ' *',
    ' * @see ADR-861 §7',
    ' */',
    '',
    ...imports,
    '',
    `export const FROZEN_LEGAL_DOCUMENTS: readonly unknown[] = [${names.join(', ')}];`,
    '',
  ].join('\n');
}

function readHeadManifest() {
  const ref = process.env.LEGAL_DOCUMENTS_BASE_REF || 'HEAD';
  try {
    const text = execFileSync('git', ['show', `${ref}:${M.rel(M.paths.manifest)}`], {
      cwd: M.paths.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(text);
  } catch {
    return null; // δεν υπήρχε στη βάση — τίποτα δημοσιευμένο να φυλαχτεί.
  }
}

function loadWorld() {
  const { ids, outlines, locales } = M.loadOutlines();
  const manifest = M.loadManifest();
  return {
    ids,
    outlines,
    locales,
    legalByLocale: M.loadLegalByLocale(locales),
    manifest,
    headManifest: readHeadManifest(),
    readFrozenBytes: M.readFrozenBytes,
    operators: M.loadOperators(),
    indexText: fs.existsSync(M.paths.index) ? fs.readFileSync(M.paths.index, 'utf8') : null,
    expectedIndexText: renderIndex(manifest, ids),
  };
}

module.exports = { loadWorld, renderIndex, readHeadManifest };
