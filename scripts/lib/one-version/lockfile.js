/**
 * CHECK 3.65 — Ο ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ `pnpm-lock.yaml` (ADR-800)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΓΙΑΤΙ ΣΤΕΝΟΣ ΔΟΜΙΚΟΣ ΑΝΑΓΝΩΣΤΗΣ ΚΑΙ ΟΧΙ ΠΛΗΡΗΣ YAML PARSER
 * ═══════════════════════════════════════════════════════════════════════════
 * Το έργο **δεν έχει** εξάρτηση `yaml`/`js-yaml` και δεν προστίθεται — ακριβώς
 * το σκεπτικό που είναι ήδη γραμμένο στο `scripts/lib/ci/workflow-meta.js:17`.
 * Διαβάζουμε **μόνο** το μπλοκ `importers:`, που έχει σταθερή, ρηχή δομή.
 *
 * ⚠️ **FAIL-CLOSED**: κάθε γραμμή που δεν αναγνωρίζεται ⇒ `throw` **με το
 * περιεχόμενό της**. Ένας ανεκτικός αναγνώστης θα επέστρεφε λιγότερα δεδομένα
 * και η πύλη θα ήταν **πράσινη επειδή δεν είδε** — το σχήμα «0 = κανείς δεν
 * κοίταξε» που αυτό το repo έχει πληρώσει εννιά φορές.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ LOCKFILE ΑΠΑΝΤΑ ΑΛΛΟ ΕΡΩΤΗΜΑ ΑΠΟ ΤΑ MANIFESTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `specifier` που γράφει εδώ η pnpm είναι το εύρος **ΜΕΤΑ** τα
 * `pnpm.overrides`. Μετρημένο ζωντανά: το subapp δήλωνε `react: ^18.3.1` και το
 * lockfile έγραφε `^19.2.1`. Άρα:
 *   • το **manifest** λέει τι *δηλώθηκε*  ⇒ κανόνας Κ1 (διπλή δήλωση)
 *   • το **lockfile** λέει τι *εγκαταστάθηκε* ⇒ κανόνας Κ2 (διχασμός έκδοσης)
 * Δύο πηγές, δύο ερωτήματα — **ποτέ μία με «ή»** (πρότυπο CHECK 3.39/3.40).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEP_FIELDS = new Set(['dependencies', 'devDependencies', 'optionalDependencies']);

const unquote = (s) => s.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

/**
 * Το επίθεμα peer «(react@19.2.1)» **δεν είναι έκδοση** — είναι τα συμφραζόμενα
 * επίλυσης. Χωρίς αυτή την κανονικοποίηση, το ίδιο `0.542.0` σε δύο διαφορετικά
 * peer περιβάλλοντα θα μετριόταν ως **ψευδής** διχασμός.
 */
const bareVersion = (v) => String(v).replace(/\(.*\)$/, '');

/** Εντοπίζει το μπλοκ `importers:` — ρίχνει αν λείπει (fail-closed). */
function locateImporters(lines) {
  const at = lines.findIndex((l) => l === 'importers:');
  if (at < 0) throw new Error('pnpm-lock.yaml: δεν βρέθηκε μπλοκ "importers:".');
  return at;
}

/** Μία γραμμή → μετάβαση κατάστασης. Άγνωστη μορφή ⇒ `throw` με το περιεχόμενο. */
function consumeLine(line, lineNo, state, importers) {
  let m;
  // ⚠️ Μέλος **χωρίς καμία εξάρτηση** το γράφει η pnpm ως `  member: {}` — είναι
  //    απολύτως νόμιμο και ο πρώτος αναγνώστης έσκαγε πάνω του (το βρήκε η
  //    άγκυρα `Μ6`). Ένα σκέτο `{}` δεν είναι σφάλμα· είναι «καμία εξάρτηση».
  if ((m = line.match(/^ {2}(\S.*?):\s*\{\}\s*$/))) {
    state.importer = unquote(m[1]);
    importers[state.importer] = {};
    state.pkg = null;
    return;
  }
  if ((m = line.match(/^ {2}(\S.*?):\s*$/))) {
    state.importer = unquote(m[1]);
    importers[state.importer] = {};
    state.pkg = null;
    return;
  }
  if ((m = line.match(/^ {4}(\S+):\s*(\{\})?\s*$/)) && DEP_FIELDS.has(m[1])) {
    state.field = m[1];
    state.pkg = null;
    return;
  }
  if ((m = line.match(/^ {6}(\S.*?):\s*$/))) {
    state.pkg = unquote(m[1]);
    importers[state.importer][state.pkg] = { field: state.field };
    return;
  }
  if ((m = line.match(/^ {8}(specifier|version):\s*(.*)$/))) {
    importers[state.importer][state.pkg][m[1]] = unquote(m[2].trim());
    return;
  }
  throw new Error(`pnpm-lock.yaml:${lineNo} — μη αναγνωρίσιμη γραμμή importers: ${JSON.stringify(line)}`);
}

/**
 * @returns {{importers: Record<string, Record<string, {field: string, specifier: string, version: string}>>}}
 */
function readLockfile(repoRoot) {
  const file = path.join(repoRoot, 'pnpm-lock.yaml');
  if (!fs.existsSync(file)) throw new Error('pnpm-lock.yaml δεν βρέθηκε στη ρίζα.');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const importers = {};
  const state = { importer: null, field: null, pkg: null };
  for (let i = locateImporters(lines) + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line) && line.trim()) break; // επόμενο μπλοκ ανώτατου επιπέδου
    if (!line.trim()) continue;
    consumeLine(line, i + 1, state, importers);
  }
  if (Object.keys(importers).length === 0) throw new Error('pnpm-lock.yaml: μπλοκ importers κενό.');
  return { importers };
}

module.exports = { readLockfile, bareVersion };
