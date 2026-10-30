/**
 * CHECK 3.108 (ADR-280 §11) — ο ΣΑΡΩΤΗΣ: ποιες κλήσεις `useTranslation([...])` γράφουν με το χέρι μια
 * **οικογένεια** namespaces που ο hook ήδη επεκτείνει μόνος του.
 *
 * 🔑 Η αυθεντία της οικογένειας είναι το `COMPAT_NAMESPACE_MAP` (`src/i18n/namespace-compat.ts`), όπως το διαβάζει
 * το `loadCompatNamespaces()` — ο ΙΔΙΟΣ parser με τα CHECK 3.8 / 3.34. Εδώ ΔΕΝ ζει δεύτερος.
 *
 * ⚠️ Οι θέσεις (`start`/`end`) είναι θέσεις του **αρχικού** κειμένου: το `stripComments` κενώνει τα σχόλια με
 * κενά ίσου μήκους, άρα το ταίριασμα γίνεται στο καθαρό και η επεξεργασία στο πρωτότυπο, χωρίς μετατόπιση.
 *
 * @module scripts/lib/i18n-namespace-family/scan
 */
'use strict';

const { stripComments } = require('../i18n-namespace-extract');

/** `useTranslation(` + πίνακας χωρίς εμφωλευμένες αγκύλες — το σχήμα κάθε δήλωσης namespaces του repo. */
const ARRAY_CALL = /\buseTranslation\(\s*(\[[^\][]*\])/g;
const LITERAL = /^\s*(['"])([a-zA-Z0-9_-]+)\1\s*$/;

/** Κλειστό σύνολο, fail-closed — άγνωστη κατάσταση ⇒ `throw` με όνομα στον λογιστή. */
const KINDS = {
  PARENT_WITH_SPLITS: 'parent-with-splits', // ⛔ Κ1: P + split(P) — ο hook φορτώνει ήδη τα splits
  ALL_SPLITS: 'all-splits-no-parent',       // ⛔ Κ2: όλα τα splits του P, χωρίς τον P — ίδια κλάση, άλλη μορφή
  // ✅ P + split(P) όπου η ΣΕΙΡΑ φέρει νόημα: η αφαίρεση των splits θα άλλαζε λέξη στην οθόνη (κοινό κλειδί με άλλο
  //    namespace της λίστας — απόδειξη `equivalence.js`). Δεν είναι περιττό· είναι σύγκρουση κλειδιών, άλλη κλάση.
  ORDER_BEARING: 'order-bearing',
  CLEAN: 'clean',                           // ✅
};

/** Τα στοιχεία του πίνακα· μη-literal (spread, μεταβλητή) ⇒ `null` = ο πίνακας δεν είναι στατικά γνωστός. */
function parseItems(body) {
  const inner = body.slice(1, -1).trim();
  if (!inner) return { items: [], quote: "'" };
  const parts = inner.split(',').map((p) => p.trim()).filter(Boolean);
  const items = [];
  let quote = null;
  for (const part of parts) {
    const m = part.match(LITERAL);
    if (!m) return null;
    quote = quote || m[1];
    items.push(m[2]);
  }
  return { items, quote: quote || "'" };
}

/** Κάθε `useTranslation([...])` του αρχείου, με τις θέσεις του πίνακα στο ΑΡΧΙΚΟ κείμενο. */
function findArrayCalls(content) {
  const clean = stripComments(content);
  const calls = [];
  for (const m of clean.matchAll(ARRAY_CALL)) {
    const start = m.index + m[0].length - m[1].length;
    const end = start + m[1].length;
    const parsed = parseItems(content.slice(start, end));
    calls.push({ start, end, line: content.slice(0, start).split('\n').length, ...(parsed || { items: null }) });
  }
  return calls;
}

/** Γονέας του `ns` στην οικογένεια (αν είναι split), αλλιώς `null`. */
function parentOf(ns, compat) {
  for (const [parent, splits] of compat) if (splits.includes(ns)) return parent;
  return null;
}

/**
 * Κ1 / Κ2 / καθαρό — με τους γονείς που το προκάλεσαν (για το μήνυμα). Το `[0]` δεν μετράει ως split του Κ1: ορίζει
 * το primary (`['common-photos', 'common']` = «ψάξε πρώτα εδώ»), δηλαδή είναι πρόθεση, όχι επανάληψη.
 */
function classify(items, compat) {
  if (!items) return { kind: KINDS.CLEAN, parents: [] };
  const present = new Set(items);
  const tail = new Set(items.slice(1));
  const k1 = [...compat.keys()].filter((p) => present.has(p) && compat.get(p).some((s) => tail.has(s)));
  if (k1.length) return { kind: KINDS.PARENT_WITH_SPLITS, parents: k1 };
  const k2 = [...compat.keys()].filter((p) => compat.get(p).length > 1 && compat.get(p).every((s) => present.has(s)));
  if (k2.length) return { kind: KINDS.ALL_SPLITS, parents: k2 };
  return { kind: KINDS.CLEAN, parents: [] };
}

/**
 * Η πρόταση του `--fix` για Κ1: σβήνονται τα splits των οποίων ο γονέας είναι ΗΔΗ στον πίνακα. Το `[0]` δεν αλλάζει
 * ποτέ (primary + compat remap), η σχετική σειρά των υπολοίπων μένει. Κ2 ΔΕΝ διορθώνεται αυτόματα: η προσθήκη του
 * γονέα θα φόρτωνε namespace που σήμερα δεν φορτώνεται — αλλαγή συμπεριφοράς, όχι αναδιατύπωση.
 */
function proposeFix(items, compat) {
  const present = new Set(items);
  const next = items.filter((ns, i) => {
    if (i === 0) return true;
    const parent = parentOf(ns, compat);
    return !(parent && present.has(parent));
  });
  return next.length === items.length ? null : next;
}

/** Το κείμενο που αντικαθιστά τον πίνακα: ένα στοιχείο ⇒ σκέτο literal (`useTranslation('P')`). */
function renderList(items, quote) {
  const lit = (ns) => `${quote}${ns}${quote}`;
  return items.length === 1 ? lit(items[0]) : `[${items.map(lit).join(', ')}]`;
}

module.exports = { KINDS, findArrayCalls, classify, proposeFix, renderList, parentOf, parseItems };
