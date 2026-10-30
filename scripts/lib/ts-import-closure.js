/**
 * Η ΚΛΕΙΣΤΟΤΗΤΑ ΕΙΣΑΓΩΓΩΝ ενός module `.ts` — ποια αρχεία του repo **πρέπει να υπάρχουν** για να
 * εκτελεστεί (ADR-924). Καθαρή: διαβάζει μέσα από `readText`/`has`, άρα δουλεύει το ίδιο πάνω στον
 * δίσκο και πάνω στην όψη του commit (`createCommitView`).
 *
 * ⚠️ ΣΥΝΤΑΚΤΙΚΗ, όχι AST, επίτηδες: ΥΠΕΡ-εκτιμά (ένα `from '…'` μέσα σε σχόλιο προσθέτει αρχείο που
 * δεν θα φορτωθεί) και δεν υπο-εκτιμά για τις μορφές που γράφει αυτό το repo — `import … from`,
 * `export … from`, `import '…'`, `import('…')`, `require('…')`. Ένα αρχείο παραπάνω στο στιγμιότυπο
 * κοστίζει ένα αντίγραφο· ένα λιγότερο, `Cannot find module`.
 * ⚠️ Εξωτερικά πακέτα (`ts-node`, `zod` …) ΔΕΝ μπαίνουν: λύνονται από το `node_modules` του repo.
 *
 * @module scripts/lib/ts-import-closure
 */

'use strict';

const path = require('node:path');

const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g;
const ALIAS_PREFIX = '@/';
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx', '/index.js'];

/** Τα specifiers που αναφέρει ένα κείμενο, με τη σειρά που εμφανίζονται. */
function specifiersOf(text) {
  return [...text.matchAll(SPECIFIER_RE)].map(match => match[1]);
}

/** Η βάση (χωρίς κατάληξη) ενός specifier του repo, ή `null` για εξωτερικό πακέτο. */
function baseOf(specifier, fromRel) {
  if (specifier.startsWith(ALIAS_PREFIX)) return `src/${specifier.slice(ALIAS_PREFIX.length)}`;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), specifier));
  }
  return null;
}

/** Το αρχείο του repo όπου λύνεται ένα specifier — η σειρά του Node για `.ts`/index. */
function resolveSpecifier(specifier, fromRel, has) {
  const base = baseOf(specifier, fromRel);
  if (base === null) return null;
  for (const suffix of CANDIDATE_SUFFIXES) {
    if (has(`${base}${suffix}`)) return `${base}${suffix}`;
  }
  return null;
}

/**
 * @param {{entries: string[], readText: (rel: string) => ?string, has: (rel: string) => boolean}} options
 *        `entries` = σχετικά μονοπάτια (posix) των modules που θα εκτελεστούν.
 * @returns {string[]} ταξινομημένα σχετικά μονοπάτια — οι είσοδοι και ό,τι φτάνουν.
 */
function importClosure({ entries, readText, has }) {
  const seen = new Set();
  const queue = entries.filter(rel => has(rel));
  while (queue.length > 0) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (rel.endsWith('.json')) continue;
    const text = readText(rel);
    if (text === null) continue;
    for (const specifier of specifiersOf(text)) {
      const target = resolveSpecifier(specifier, rel, has);
      if (target !== null && !seen.has(target)) queue.push(target);
    }
  }
  return [...seen].sort();
}

module.exports = { importClosure, resolveSpecifier, specifiersOf };
