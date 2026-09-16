#!/usr/bin/env node
/**
 * ADR-861 Φ3 — ΠΑΓΩΜΑ ΝΕΑΣ ΕΚΔΟΣΗΣ ΝΟΜΙΚΟΥ ΕΓΓΡΑΦΟΥ.
 *
 *   npm run legal:freeze -- --document privacy-policy [--effective-from 2026-10-01] [--material|--minor]
 *   npm run legal:index                                 # μόνο το παραγόμενο ευρετήριο
 *
 * Τι κάνει: επιλύει το περίγραμμα (`constants/legal-documents.ts`) πάνω στο `legal.json` για
 * **όλες** τις γλώσσες, γράφει `src/config/legal-document-versions/<id>/v<N>.json` (κανονικά
 * bytes, μαζί με τον φορέα που **ισχύει** την `effectiveFrom`), προσθέτει γραμμή στο μητρώο και
 * ξαναπαράγει το ευρετήριο.
 *
 * Αρνείται: (α) κείμενο **ίδιο** με την τελευταία έκδοση — καμία κενή έκδοση· (β) `effectiveFrom`
 * πριν από την τελευταία· (γ) έκδοση ≥ 2 χωρίς ρητό `--material` ή `--minor` — η κρίση
 * «ουσιώδης αλλαγή;» είναι **ανθρώπινη** και γράφεται, δεν μαντεύεται· (δ) έκδοση ≥ 2 χωρίς
 * σημείωμα `versionNotes.<id>.v<N>` σε κάθε γλώσσα.
 *
 * ⚠️ **Δεν αγγίζει ΠΟΤΕ δημοσιευμένη έκδοση.** Η πύλη CHECK 3.85 το φυλά ούτως ή άλλως.
 *
 * @see ADR-861 §7
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const M = require('../lib/legal-documents/model');
const { renderIndex } = require('../lib/legal-documents/world');

const MANIFEST_DOC =
  'ADR-861 Φ3 — ΜΗΤΡΩΟ ΕΚΔΟΣΕΩΝ ΝΟΜΙΚΩΝ ΕΓΓΡΑΦΩΝ. ΠΑΡΑΓΕΤΑΙ από `npm run legal:freeze` και είναι '
  + 'APPEND-ONLY: γραμμή που δημοσιεύτηκε δεν αλλάζει και δεν σβήνεται ποτέ (CHECK 3.85 Κ3).';

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

function fail(message) {
  console.error(`\n❌ legal:freeze — ${message}\n`);
  process.exit(1);
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function writeIndex(manifest, ids) {
  writeText(M.paths.index, renderIndex(manifest, ids));
  console.log(`✅ ${M.rel(M.paths.index)}`);
}

function materialityOf(argv, version) {
  const material = argv.includes('--material');
  const minor = argv.includes('--minor');
  if (material && minor) fail('--material ΚΑΙ --minor μαζί — διάλεξε ένα');
  if (version === 1) return true;
  if (!material && !minor) fail(`η έκδοση ${version} θέλει ρητή κρίση: --material (ουσιώδης αλλαγή) ή --minor`);
  return material;
}

function freeze(argv) {
  const { ids, outlines, locales } = M.loadOutlines();
  const id = argValue(argv, '--document');
  if (!ids.includes(id)) fail(`άγνωστο έγγραφο «${id}» — γνωστά: ${ids.join(', ')}`);

  const operators = M.loadOperators();
  const effectiveFrom = argValue(argv, '--effective-from') || operators.today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) fail(`--effective-from «${effectiveFrom}» δεν είναι YYYY-MM-DD`);

  const legalByLocale = M.loadLegalByLocale(locales);
  const manifest = M.loadManifest();
  const rows = (manifest.documents && manifest.documents[id]) || [];
  const latest = rows[rows.length - 1];
  const text = M.resolveDocument(id, outlines[id], locales, legalByLocale);

  if (latest) {
    const previous = JSON.parse(M.readFrozenBytes(id, latest.version));
    if (M.stableStringify(previous.locales) === M.stableStringify(text)) {
      fail(`το κείμενο του «${id}» είναι ίδιο με την έκδοση ${latest.version} — καμία κενή έκδοση`);
    }
    if (effectiveFrom < latest.effectiveFrom) fail(`--effective-from πριν από την έκδοση ${latest.version} (${latest.effectiveFrom})`);
  }

  const version = rows.length + 1;
  const material = materialityOf(argv, version);
  const frozen = M.buildFrozen({
    id,
    version,
    effectiveFrom,
    material,
    changeNote: M.changeNoteOf(id, version, locales, legalByLocale),
    text,
    operatorRecord: operators.recordOn(effectiveFrom),
  });
  const bytes = M.stableStringify(frozen);
  writeText(M.paths.frozen(id, version), bytes);

  const next = {
    $doc: MANIFEST_DOC,
    documents: { ...manifest.documents, [id]: [...rows, { version, effectiveFrom, material, digest: M.digestOf(bytes) }] },
  };
  writeText(M.paths.manifest, M.stableStringify(next));
  console.log(`✅ ${M.rel(M.paths.frozen(id, version))} (${M.digestOf(bytes)})`);
  writeIndex(next, ids);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--index')) {
    writeIndex(M.loadManifest(), M.loadOutlines().ids);
  } else {
    freeze(argv);
  }
}

module.exports = { freeze };
