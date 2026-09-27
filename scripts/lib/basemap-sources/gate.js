/**
 * CHECK 3.95 — Ο ΠΥΡΗΝΑΣ: σάρωση, κρίση, λογιστική (ADR-891 Φ1).
 *
 * Καθαρές συναρτήσεις πάνω σε κείμενο (`judgeText`) + μία σάρωση του δέντρου (`sweep`), ώστε οι
 * άγκυρες να κρίνουν **την ίδια** λογική που τρέχει στο pre-commit, και οι μεταλλάξεις να την
 * **εκτελούν** σε προσωρινό δέντρο.
 *
 * @module scripts/lib/basemap-sources/gate
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const { collectSourceFiles } = require('../module-graph/scan-config');
const { toPosix } = require('../module-graph/resolve-specifier');
const {
  BLOCKING,
  CATALOG_FILE,
  GATE_STATES,
  MIN_REASON,
  PREFILTER,
  SOURCE_MARKERS,
  SOURCE_OWNERS,
  isTestFile,
} = require('./contract.js');

/** Το κείμενο κάθε κυριολεκτικής συμβολοσειράς (και κάθε σταθερού κομματιού template). */
function literalTexts(fileName, text) {
  const kind = /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push({ text: node.text, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      out.push({ text: node.text, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Τα ευρήματα ενός αρχείου: κάθε συμβολοσειρά που ταιριάζει σε μοτίβο πηγής. */
function judgeText(fileName, text) {
  const lower = text.toLowerCase();
  if (!PREFILTER.some((needle) => lower.includes(needle))) return [];
  const hits = [];
  for (const literal of literalTexts(fileName, text)) {
    const marker = SOURCE_MARKERS.find((m) => m.test(literal.text));
    if (marker) hits.push({ line: literal.line, marker: marker.id, why: marker.why, text: literal.text });
  }
  return hits;
}

/** Κ1′ — η υγεία των ίδιων των δηλώσεων ιδιοκτησίας. */
function judgeOwners(root, owners) {
  const findings = [];
  for (const [rel, reason] of Object.entries(owners)) {
    if (!fs.existsSync(path.join(root, rel))) {
      findings.push({ state: GATE_STATES.ORPHAN_OWNER, rel, detail: 'δηλωμένος ιδιοκτήτης που δεν υπάρχει' });
    } else if (typeof reason !== 'string' || reason.trim().length < MIN_REASON) {
      findings.push({ state: GATE_STATES.REASONLESS_OWNER, rel, detail: `λόγος < ${MIN_REASON} χαρακτήρες` });
    }
  }
  return findings;
}

function emptyTally() {
  return Object.fromEntries(Object.values(GATE_STATES).map((state) => [state, 0]));
}

/**
 * Σαρώνει το `src/` της ρίζας. Επιστρέφει ευρήματα + λογιστική: **κάθε** κάδος, και στο μηδέν.
 * @param {string} root
 * @param {{ owners?: Record<string, string>, catalog?: string }} [options] μόνο για τις μεταλλάξεις
 */
function sweep(root, options = {}) {
  const owners = options.owners ?? SOURCE_OWNERS;
  const catalog = options.catalog ?? CATALOG_FILE;
  const tally = emptyTally();
  const violations = [];
  let catalogSources = 0;
  let population = 0;

  for (const abs of collectSourceFiles(root, ['src'])) {
    const rel = toPosix(path.relative(root, abs));
    if (isTestFile(rel)) continue;
    population += 1;
    const hits = judgeText(abs, fs.readFileSync(abs, 'utf8'));
    if (Object.hasOwn(owners, rel)) {
      tally[GATE_STATES.OWNER] += 1;
      if (rel === catalog) catalogSources = hits.length;
      continue;
    }
    if (hits.length === 0) {
      tally[GATE_STATES.CLEAN] += 1;
      continue;
    }
    tally[GATE_STATES.UNDECLARED_SOURCE] += 1;
    for (const hit of hits) {
      violations.push({ state: GATE_STATES.UNDECLARED_SOURCE, rel: `${rel}:${hit.line}`, detail: `${hit.why} — «${hit.text}»` });
    }
  }

  for (const finding of judgeOwners(root, owners)) {
    tally[finding.state] += 1;
    violations.push(finding);
  }
  if (catalogSources === 0) {
    tally[GATE_STATES.EMPTY_CATALOG] += 1;
    violations.push({ state: GATE_STATES.EMPTY_CATALOG, rel: catalog, detail: 'το μητρώο δεν δηλώνει καμία πηγή' });
  }

  return { violations, tally, population, catalogSources };
}

module.exports = { BLOCKING, judgeText, literalTexts, sweep };
