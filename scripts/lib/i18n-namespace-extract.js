/**
 * =============================================================================
 * SSoT: i18n STATIC EXTRACTION — namespaces + literal keys
 * =============================================================================
 * Shared by:
 *   - scripts/check-i18n-missing-keys.js       (CHECK 3.8, blocking)
 *   - scripts/generate-i18n-keys-baseline.js   (baseline generator)
 *   - scripts/lib/i18n-shell-slice/            (CHECK 3.34 / ADR-744)
 *
 * Both used to carry a byte-identical copy of `extractNamespaces`. This module
 * is the single source, and it adds ONE capability the copies lacked: resolving
 * a bare bundle identifier — `useTranslation(COMMON_NAMESPACES)` — back to the
 * namespace list it stands for, by statically reading
 * `src/i18n/namespace-bundles.ts`.
 *
 * Why it matters: without this, moving a repeated `useTranslation([...])` array
 * into a shared const would make these checks see ZERO namespaces for the file
 * and silently skip it — dropping i18n key validation for every `t()` in it.
 *
 * Mirrors the proven `readServiceFormNamespaces()` pattern in
 * scripts/check-i18n-resolver-reachability.js (CHECK 3.13).
 * =============================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse `src/i18n/namespace-bundles.ts` into a Map of
 * bundleConstName -> string[] of namespaces.
 *
 * Each bundle is declared as:
 *   export const NAME = [ 'a', 'b', ... ] as const;
 *
 * @param {string} repoRoot absolute path to the repository root
 * @returns {Map<string, string[]>}
 */
function loadNamespaceBundles(repoRoot) {
  const bundles = new Map();
  const file = path.join(repoRoot, 'src', 'i18n', 'namespace-bundles.ts');
  if (!fs.existsSync(file)) return bundles;

  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    return bundles;
  }

  const declRegex =
    /export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]\s*as\s+const/g;
  for (const decl of src.matchAll(declRegex)) {
    const name = decl[1];
    const body = decl[2];
    const namespaces = [];
    for (const m of body.matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g)) {
      namespaces.push(m[1]);
    }
    if (namespaces.length > 0) bundles.set(name, namespaces);
  }
  return bundles;
}

/**
 * Parse `src/i18n/namespace-compat.ts` into a Map of
 * parentNamespace -> string[] of ADR-280 split namespaces.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-744 §12 / ADR-280): ο **χρόνος εκτέλεσης** φορτώνει
 * `δηλωμένα namespaces + compat splits` — αυτό κάνει το `resolveAllNamespaces()`
 * του `src/i18n/hooks/useTranslation.ts`, και μετά το `resolveAcrossNamespaces()`
 * ψάχνει το κλειδί σε **όλα** τους. Ένας στατικός έλεγχος που κοιτάζει **μόνο** τα
 * δηλωμένα λέει «λείπει» για κλειδί που η εφαρμογή **βρίσκει κανονικά**.
 *
 * Μετρημένο 2026-08-09: με τη μετανάστευση 22 components από τον καταργημένο
 * `useTranslationLazy` (τον οποίο το `extractNamespaces` ΔΕΝ έβλεπε), το CHECK 3.8
 * απέκτησε ορατότητα και ανέφερε **113 λείποντα κλειδιά** στο `geo-canvas`. Από αυτά
 * τα **97 υπάρχουν** στο `geo-canvas-drawing`, δηλαδή ήταν **ψευδώς θετικά** — και η
 * «διόρθωσή» τους θα ήταν να **αντιγραφούν** τα 97 κλειδιά στο `geo-canvas.json`,
 * δηλαδή να **καταστραφεί το ίδιο το split** που όρισε το ADR-280.
 *
 * ⚠️ ΜΗΝ γράψεις χειρόγραφη λίστα ζευγών εδώ. Αυθεντία είναι το
 * `COMPAT_NAMESPACE_MAP` του `namespace-compat.ts` — δεύτερο αντίγραφο θα απέκλινε
 * σιωπηλά, ακριβώς όπως οι δύο λίστες namespace του CHECK 3.34 που είχαν αποκλίνει
 * κατά 63 χωρίς καμία πύλη να τις συγκρίνει.
 *
 * @param {string} repoRoot absolute path to the repository root
 * @returns {Map<string, string[]>}
 */
function loadCompatNamespaces(repoRoot) {
  const compat = new Map();
  const file = path.join(repoRoot, 'src', 'i18n', 'namespace-compat.ts');
  if (!fs.existsSync(file)) return compat;

  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    return compat;
  }

  // Στάδιο 1 — οι δηλώσεις: `export const X_COMPATIBILITY_NAMESPACES = [...] as const;`
  const constants = new Map();
  const declRegex =
    /export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]\s*as\s+const/g;
  for (const decl of src.matchAll(declRegex)) {
    const namespaces = [];
    for (const m of decl[2].matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g)) {
      namespaces.push(m[1]);
    }
    if (namespaces.length > 0) constants.set(decl[1], namespaces);
  }

  // Στάδιο 2 — ο πίνακας: `const COMPAT_NAMESPACE_MAP: … = { parent: CONST, … };`
  const mapMatch = src.match(
    /const\s+COMPAT_NAMESPACE_MAP\s*:[^=]*=\s*\{([\s\S]*?)\n\};/,
  );
  if (!mapMatch) return compat;

  for (const entry of mapMatch[1].matchAll(
    /['"]?([a-zA-Z0-9_-]+)['"]?\s*:\s*([A-Z][A-Z0-9_]*)\s*,/g,
  )) {
    const resolved = constants.get(entry[2]);
    if (resolved) compat.set(entry[1], resolved);
  }

  return compat;
}

/**
 * Ο ίδιος υπολογισμός με το `resolveAllNamespaces()` του runtime hook: δηλωμένα
 * namespaces **συν** τα ADR-280 compat splits τους. Ένα στατικό εργαλείο που ρωτά
 * «υπάρχει αυτό το κλειδί;» οφείλει να ψάχνει **εκεί που ψάχνει η εφαρμογή**.
 *
 * @param {readonly string[]} namespaces δηλωμένα namespaces του αρχείου
 * @param {Map<string, string[]>} [compat] result of loadCompatNamespaces()
 * @returns {string[]} de-duplicated namespace list
 */
function withCompatNamespaces(namespaces, compat) {
  if (!compat || compat.size === 0) return [...new Set(namespaces)];
  const all = [...namespaces];
  for (const ns of namespaces) {
    const splits = compat.get(ns);
    if (splits) all.push(...splits);
  }
  return [...new Set(all)];
}

/**
 * Extract the i18n namespaces a file loads from its `useTranslation(...)` calls.
 * Handles three call shapes:
 *   1. single literal   — useTranslation('files')
 *   2. array literal     — useTranslation(['files', 'common'])
 *   3. bundle identifier — useTranslation(COMMON_NAMESPACES)  (resolved via `bundles`)
 *
 * A bare identifier that is not a known bundle is ignored (it is a runtime
 * variable the static checker cannot resolve — same behaviour as before).
 *
 * @param {string} content source of a .ts/.tsx file
 * @param {Map<string, string[]>} [bundles] result of loadNamespaceBundles()
 * @returns {string[]} de-duplicated namespace list
 */
function extractNamespaces(content, bundles) {
  const namespaces = [];

  // 1. single namespace: useTranslation('files')
  for (const m of content.matchAll(
    /useTranslation\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g,
  )) {
    namespaces.push(m[1]);
  }

  // 2. array namespace: useTranslation(['files', 'common'])
  for (const m of content.matchAll(/useTranslation\(\s*\[([^\]]+)\]\s*\)/g)) {
    for (const item of m[1].matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g)) {
      namespaces.push(item[1]);
    }
  }

  // 3. bundle identifier: useTranslation(COMMON_NAMESPACES)
  if (bundles && bundles.size > 0) {
    for (const m of content.matchAll(
      /useTranslation\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g,
    )) {
      const resolved = bundles.get(m[1]);
      if (resolved) namespaces.push(...resolved);
    }
  }

  return [...new Set(namespaces)];
}

/**
 * Extract every `t('literal')` call — static string keys only.
 *
 * MOVED HERE from scripts/check-i18n-missing-keys.js (ADR-744). It lived there
 * as a non-exported local, so the second consumer (the shell-slice generator)
 * could only have copied it — precisely the sibling-clone CHECK 3.28 exists to
 * block. Behaviour is byte-identical to the original: CHECK 3.8 carries a
 * ratchet baseline tuned to exactly these matches, so this move must not change
 * a single result.
 *
 * Deliberately NOT comment-aware: a `t('x')` inside a comment yields a spurious
 * key, which for CHECK 3.8 is a (rare, baselined) false positive and for the
 * shell slice is one extra string — both harmless. Namespace extraction is the
 * opposite case and DOES need {@link stripComments}; see its note.
 *
 * @param {string} content source of a .ts/.tsx file
 * @returns {Array<{key: string, index: number}>}
 */
/**
 * Τα `t('ns:key')` — δηλαδή **ακριβώς ό,τι πετάει** η {@link extractTCalls}.
 *
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΣΥΝΑΡΤΗΣΗ ΚΑΙ ΟΧΙ ΣΗΜΑΙΑ. Το `extractTCalls` το καταναλώνει
 * **και το shell slice** (`plan.js`), που χαρτογραφεί κάθε αποτέλεσμα σε
 * `{ns: null, key}` — δηλαδή «λύσε το στα namespaces του αρχείου». Αν η ίδια
 * συνάρτηση άρχιζε να επιστρέφει και τα ρητά, το slice θα ζητούσε κλειδί με όνομα
 * `properties:toolbar.export.title` **μέσα** στα δικά του namespaces. Επιφάνεια
 * αμετάβλητη ⇒ **καμία άγκυρα δεν ξαναγράφεται για να περάσει**.
 *
 * 🔑 ΓΙΑΤΙ ΤΟ «ΡΗΤΟ» ΔΕΝ ΣΗΜΑΙΝΕΙ «ΣΩΣΤΟ». Η {@link extractTCalls} τα παραλείπει με
 * τον λόγο «these are explicitly scoped» — δηλαδή θεωρεί τη **δήλωση** απόδειξη.
 * Ένα ρητό namespace είναι **ισχυρισμός**, και ο ισχυρισμός ελέγχεται: μετρημένο
 * 2026-08-21, **39** τέτοιες κλήσεις σε 14 αρχεία δείχνουν σε κλειδί που **δεν
 * υπάρχει** στο namespace που ονομάζουν (`common-actions:actions.delete_loading`
 * — το locale έχει `save_loading`, όχι `delete_loading`). Το `src/i18n/config.ts`
 * **δεν ορίζει `fallbackNS`**, άρα δεν υπάρχει δεύτερη ευκαιρία: ωμό κλειδί.
 *
 * ⚠️ ΕΔΩ ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ, σε αντίθεση με την {@link extractTCalls}: εκεί ένα
 * `t('x')` σε σχόλιο είναι ένα παραπάνω αβλαβές string, εδώ θα ήταν **παραβίαση**
 * — και ένα ADR που τεκμηριώνει τη βλάβη θα γινόταν το ίδιο βλάβη (CHECK 3.36).
 *
 * @param {string} content source of a .ts/.tsx file
 * @returns {Array<{ns: string, key: string, index: number}>}
 */
function extractExplicitTCalls(content) {
  const out = [];
  const source = stripComments(content);
  const regex = /\bt\(\s*['"]([a-zA-Z0-9_.\-]+):([a-zA-Z0-9_.\-]+)['"]\s*[,)]/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    out.push({ ns: match[1], key: match[2], index: match.index });
  }
  return out;
}

function extractTCalls(content) {
  const keys = [];
  // Match t('key') or t('key', ...) — only single-quoted or double-quoted static strings
  const regex = /\bt\(\s*['"]([a-zA-Z0-9_.\-]+)['"]\s*[,)]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    // Skip cross-namespace references (ns:key) — these are explicitly scoped
    if (key.includes(':')) continue;
    keys.push({ key, index: match.index });
  }
  return keys;
}

/**
 * Blank out comments, preserving byte offsets and line count.
 *
 * WHY (measured, 2026-07-31): `src/i18n/hooks/useTranslation.ts:52` documents
 * the hook with the prose example `useTranslation(['dxf-viewer', …,
 * 'files-media'])`. {@link extractNamespaces} matched that COMMENT and credited
 * the i18n plumbing itself with two namespaces it never loads — which dragged
 * `dxf-viewer` (whole) into the ADR-744 shell slice. A comment is documentation,
 * not a call site.
 *
 * Offsets are preserved (comment bytes become spaces, newlines survive) so a
 * caller can still map an index back to a line number in the ORIGINAL source.
 *
 * Not applied inside {@link extractNamespaces} itself: CHECK 3.8's baseline was
 * cut against the comment-blind behaviour, and silently narrowing the namespace
 * set there could flip a resolved key to "missing" and block a commit for a
 * reason unrelated to the change. Callers that want it opt in.
 *
 * @param {string} content
 * @returns {string} same length as `content`
 */
function stripComments(content) {
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  // One pass, alternation ordered so string/template literals win over comment
  // openers — otherwise the `//` in a URL literal would blank the rest of a line.
  //
  // The `(?<!\\)` guard covers the other direction: an ESCAPED slash inside a
  // regex literal, as in `.replace(/\/\//g, '')`, presents a bare `//` to a
  // naive scanner and would blank everything after it on that line. The damage
  // there is asymmetric — a swallowed `useTranslation(...)` means a namespace
  // the shell needs never reaches the slice, which is a raw key on screen — so
  // the cheap guard is worth its keep even though the shape is rare.
  //
  // This is a scanner, not a lexer. It is deliberately not a full tokenizer:
  // the only consumers are static extractors whose worst case is one extra or
  // one missing match, and a real lexer here would be a second parser to keep
  // in step with `ts.createSourceFile`.
  return content.replace(
    /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|(?<!\\)\/\/[^\n]*/g,
    (match) => (match.startsWith('//') || match.startsWith('/*') ? blank(match) : match),
  );
}

module.exports = {
  loadNamespaceBundles,
  loadCompatNamespaces,
  withCompatNamespaces,
  extractNamespaces,
  extractTCalls,
  extractExplicitTCalls,
  stripComments,
};
