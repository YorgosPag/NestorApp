/**
 * memory-graph.js — ΕΝΑΣ ορισμός ταυτότητας + ΕΝΑΣ resolver δεικτών.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η ανάκληση ενός memory είναι γράφος — ευρετήριο → [[δείκτης]] →
 * αρχείο. Αν ο «δείκτης» λύνεται με διαφορετικό κανόνα σε κάθε εργαλείο, ο γράφος
 * γίνεται τύχη. Εδώ ζει ΟΛΗ η αριθμητική της ταυτότητας — κανένα άλλο αρχείο δεν
 * επιτρέπεται να ξαναγράψει `normalizeId`.
 */

'use strict';

const path = require('path');

/** Πρόθεμα τύπου στο filename. Κανονικοποιείται ΕΞΩ από την ταυτότητα (βλ. normalizeId). */
const TYPE_PREFIXES = ['feedback', 'project', 'reference', 'user'];

/** Πάνω από 2 άλματα από το ευρετήριο, η ανάκληση γίνεται τύχη. */
const DEPTH_PRACTICAL = 2;

/**
 * Κανονικοποίηση: πεζά, ενιαίοι διαχωριστές, ΧΩΡΙΣ πρόθεμα τύπου.
 *
 * Το πρόθεμα φεύγει και από τα ΔΥΟ σκέλη της σύγκρισης. Συνέπεια — και είναι η
 * συνέπεια που κάνει ασφαλές το ΒΗΜΑ 1 της εξυγίανσης: η μετονομασία
 * `3d-mirror-2d-ssot` → `feedback-3d-mirror-2d-ssot` δίνει ΤΟ ΙΔΙΟ id, άρα
 * κανένας υπάρχων δείκτης δεν σπάει. (Αποδεικνύεται, δεν υποτίθεται: το
 * `memory-normalize-ids.js --dry-run` μετράει link-by-link πριν/μετά.)
 */
function normalizeId(raw) {
  const base = String(raw).trim().toLowerCase().replace(/[-\s]+/g, '_');
  for (const p of TYPE_PREFIXES) {
    if (base.startsWith(`${p}_`)) return base.slice(p.length + 1);
  }
  return base;
}

/** Η ΚΑΝΟΝΙΚΗ μορφή του `name:` για ένα αρχείο: filename με παύλες. */
const canonicalName = (slug) => slug.replace(/_/g, '-');

/** Εξάγει ΩΜΑ αναγνωριστικά από [[wikilink]] και από [text](file.md). */
function extractLinks(text) {
  const out = new Set();
  for (const m of text.matchAll(/\[\[([^\]|#]+)/g)) {
    out.add(path.basename(m[1].trim()));
  }
  for (const m of text.matchAll(/\]\(([^)\s]+?)\.md\)/g)) {
    out.add(path.basename(m[1].trim()));
  }
  return out;
}

/**
 * Χτίζει alias→slug. ΓΙΑΤΙ ανέχεται χάος: το σύστημα είχε 3 ασυνεπείς συμβάσεις
 * ταυτότητας (filename snake_case με πρόθεμα, `name:` άλλοτε kebab-με/χωρίς-πρόθεμα,
 * άλλοτε ελεύθερος τίτλος). Χωρίς ανοχή, ΚΑΘΕ wikilink θα φαινόταν σπασμένος.
 * Ο resolver ανέχεται· ο έλεγχος ταυτότητας καταγγέλλει την ασυνέπεια χωριστά.
 *
 * @param {Iterable<string>} slugs
 * @param {(slug: string) => string|null} nameOf — επιστρέφει το `name:` του αρχείου
 */
function buildAliasMap(slugs, nameOf) {
  const alias = new Map();
  const add = (key, slug) => {
    const k = normalizeId(key);
    if (k && !alias.has(k)) alias.set(k, slug);
  };
  for (const slug of slugs) {
    add(slug, slug);
    const name = nameOf(slug);
    if (name) add(name, slug);
  }
  return alias;
}

/** Λύνει ένα ωμό αναγνωριστικό σε slug αρχείου, ή null. */
const resolveLink = (raw, alias) => alias.get(normalizeId(raw)) ?? null;

/**
 * BFS από το ευρετήριο. Επιστρέφει Map<slug, depth> (depth 1 = μέσα στο index).
 *
 * @param {string} indexText
 * @param {Map<string,string>} alias
 * @param {(slug: string) => string} readOf — περιεχόμενο ενός memory
 */
function computeReachability(indexText, alias, readOf) {
  const depth = new Map();
  const queue = [];
  const rootSlugs = new Set();
  for (const raw of extractLinks(indexText)) {
    const slug = resolveLink(raw, alias);
    if (!slug) continue;
    rootSlugs.add(slug);
    if (!depth.has(slug)) {
      depth.set(slug, 1);
      queue.push(slug);
    }
  }
  while (queue.length) {
    const node = queue.shift();
    for (const raw of extractLinks(readOf(node))) {
      const next = resolveLink(raw, alias);
      if (next && !depth.has(next)) {
        depth.set(next, depth.get(node) + 1);
        queue.push(next);
      }
    }
  }
  return { depth, rootSlugs };
}

module.exports = {
  TYPE_PREFIXES,
  DEPTH_PRACTICAL,
  normalizeId,
  canonicalName,
  extractLinks,
  buildAliasMap,
  resolveLink,
  computeReachability,
};
