/**
 * ADR-861 Φ3 — ΤΟ ΜΟΝΤΕΛΟ ΜΙΑΣ ΠΑΓΩΜΕΝΗΣ ΕΚΔΟΣΗΣ ΝΟΜΙΚΟΥ ΕΓΓΡΑΦΟΥ.
 *
 * Καθαρές συναρτήσεις + ένα σημείο ανάγνωσης δίσκου (`paths`/`load*`). Το χρησιμοποιούν
 * **και** ο γεννήτορας (`freeze-legal-version.js`) **και** η πύλη (`check-legal-documents.js`)
 * — μία επίλυση, μία σειριοποίηση, ένα αποτύπωμα (μάθημα ADR-749: δύο μηχανές = δύο αριθμοί).
 *
 * 🔑 **Αποτύπωμα = sha256 των bytes του αρχείου**, και τα bytes είναι η **κανονική**
 * σειριοποίηση (`stableStringify`: ταξινομημένα κλειδιά, LF, τελικό newline). Ο browser
 * ξαναπαράγει τα ίδια bytes με την ίδια συνάρτηση (`lib/legal/canonical-json.ts`), άρα ο
 * αναγνώστης μπορεί να επαληθεύσει ό,τι κατέβασε.
 *
 * @module scripts/lib/legal-documents/model
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { readPath, stableStringify, sha256 } = require('../i18n-shell-slice/slice-build');
const { requireTypeScript } = require('../ts-module-loader');

const ROOT = path.resolve(__dirname, '..', '..', '..');

const paths = {
  root: ROOT,
  outlines: path.join(ROOT, 'src', 'constants', 'legal-documents.ts'),
  operators: path.join(ROOT, 'src', 'constants', 'platform-operator.ts'),
  versionsDir: path.join(ROOT, 'src', 'config', 'legal-document-versions'),
  manifest: path.join(ROOT, 'src', 'config', 'legal-document-versions', 'manifest.json'),
  index: path.join(ROOT, 'src', 'config', 'legal-document-versions', 'index.generated.ts'),
  locale: (locale) => path.join(ROOT, 'src', 'i18n', 'locales', locale, 'legal.json'),
  frozen: (id, version) => path.join(ROOT, 'src', 'config', 'legal-document-versions', id, `v${version}.json`),
};

/** Σχετική διαδρομή με `/` — για μηνύματα και για `git show`. */
const rel = (absolute) => path.relative(ROOT, absolute).replace(/\\/g, '/');

const digestOf = (bytes) => `sha256:${sha256(bytes)}`;

/** Το αποτύπωμα του φορέα που **ίσχυε** — `null` όταν δεν υπήρχε (`pending`). */
function operatorFingerprint(record) {
  return record === null ? null : digestOf(stableStringify(record));
}

class LegalTextMissingError extends Error {
  constructor(id, locale, key) {
    super(`[legal-documents] ${id} (${locale}): λείπει το κλειδί «${key}» στο legal.json`);
    this.name = 'LegalTextMissingError';
  }
}

function textAt(tree, id, locale, key) {
  const value = readPath(tree, key);
  if (typeof value !== 'string' || value.trim() === '') throw new LegalTextMissingError(id, locale, key);
  return value;
}

function resolveBlock(block, lookup) {
  switch (block.kind) {
    case 'paragraph':
      return { kind: 'paragraph', text: lookup(block.key) };
    case 'list':
      return {
        kind: 'list',
        ordered: block.ordered,
        items: block.items.map((item) => (item.mailbox
          ? { text: lookup(item.key), mailbox: item.mailbox }
          : { text: lookup(item.key) })),
      };
    case 'operator-identity':
      return { kind: 'operator-identity' };
    case 'clause':
      return { kind: 'clause', id: block.id, text: lookup(block.key) };
    default:
      throw new Error(`[legal-documents] άγνωστο είδος μπλοκ «${block.kind}»`);
  }
}

/** Το περίγραμμα ενός εγγράφου, επιλυμένο σε **κείμενο** για μία γλώσσα. */
function resolveLocale(id, outline, locale, legalJson) {
  const tree = readPath(legalJson, outline.source);
  const lookup = (key) => textAt(tree, id, locale, key);
  return {
    title: lookup(outline.titleKey),
    sections: outline.sections.map((s) => ({
      id: s.id,
      heading: lookup(s.headingKey),
      blocks: s.blocks.map((b) => resolveBlock(b, lookup)),
    })),
  };
}

/** Όλες οι γλώσσες μαζί — ποτέ έκδοση για τη μία μόνο. */
function resolveDocument(id, outline, locales, legalByLocale) {
  const out = {};
  for (const locale of locales) out[locale] = resolveLocale(id, outline, locale, legalByLocale[locale]);
  return out;
}

/** Το σημείωμα αλλαγής μιας έκδοσης — `versionNotes.<id>.v<N>`, append-only στο `legal.json`. */
function changeNoteOf(id, version, locales, legalByLocale) {
  if (version === 1) return null;
  const note = {};
  for (const locale of locales) {
    note[locale] = textAt(legalByLocale[locale], id, locale, `versionNotes.${id}.v${version}`);
  }
  return note;
}

function buildFrozen({ id, version, effectiveFrom, material, changeNote, text, operatorRecord }) {
  return {
    document: id,
    version,
    effectiveFrom,
    material,
    changeNote,
    locales: text,
    operator: { fingerprint: operatorFingerprint(operatorRecord), record: operatorRecord },
  };
}

// ── Ανάγνωση δίσκου ──────────────────────────────────────────────────────────

function loadOutlines() {
  const mod = requireTypeScript(paths.outlines);
  return { ids: mod.LEGAL_DOCUMENT_IDS, outlines: mod.LEGAL_DOCUMENT_OUTLINES, locales: mod.LEGAL_DOCUMENT_LOCALES };
}

function loadOperators() {
  const mod = requireTypeScript(paths.operators);
  return {
    history: mod.PLATFORM_OPERATORS,
    recordOn: (day) => {
      const standing = mod.operatorOn(day, mod.PLATFORM_OPERATORS);
      return standing.kind === 'declared' ? standing.record : null;
    },
    today: () => mod.calendarDayOf(new Date()),
  };
}

function loadLegalByLocale(locales) {
  const out = {};
  for (const locale of locales) out[locale] = JSON.parse(fs.readFileSync(paths.locale(locale), 'utf8'));
  return out;
}

function loadManifest() {
  if (!fs.existsSync(paths.manifest)) return { documents: {} };
  return JSON.parse(fs.readFileSync(paths.manifest, 'utf8'));
}

function readFrozenBytes(id, version) {
  const file = paths.frozen(id, version);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

module.exports = {
  paths,
  rel,
  digestOf,
  stableStringify,
  operatorFingerprint,
  resolveDocument,
  changeNoteOf,
  buildFrozen,
  loadOutlines,
  loadOperators,
  loadLegalByLocale,
  loadManifest,
  readFrozenBytes,
  LegalTextMissingError,
};
