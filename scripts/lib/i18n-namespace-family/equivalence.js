/**
 * CHECK 3.108 (ADR-280 §11) — η ΑΠΟΔΕΙΞΗ ότι μια αναδιατύπωση του `useTranslation([...])` δεν αλλάζει ΚΑΝΕΝΑ κείμενο.
 *
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ (μετρημένο 2026-10-30): η σειρά του πίνακα είναι **σειρά προτεραιότητας**. Ο hook ψάχνει
 * primary → compat remap → τα υπόλοιπα με τη σειρά του `resolveAllNamespaces()` (δηλωμένα, ΜΕΤΑ τα splits τους).
 * Το `['P', …splits(P), 'X']` γίνεται `['P', 'X']` ⇒ σειρά `P, X, …splits(P)`: το X περνά ΜΠΡΟΣΤΑ από τα splits.
 * Μετρήθηκαν ~25 κοινά φύλλα ανάμεσα σε οικογένειες (π.χ. `common` ∩ `properties-detail` = 7) και 3 μέσα σε
 * οικογένεια (`contacts-core` ∩ `contacts-relationships`). Μια τυφλή αναδιατύπωση θα άλλαζε λέξεις στην οθόνη.
 *
 * 🔑 Κριτήριο: για ΚΑΘΕ κόμβο (φύλλο ή αντικείμενο — το `returnObjects` ζητά και αντικείμενα) ΚΑΘΕ φορτωμένου
 * namespace, σε ΚΑΘΕ γλώσσα, το πρώτο namespace που τον έχει μένει το ίδιο. Και το σύνολο των φορτωμένων ίδιο.
 *
 * @module scripts/lib/i18n-namespace-family/equivalence
 */
'use strict';

const { withCompatNamespaces } = require('../i18n-namespace-extract');

const LOCALES_DIR = 'src/i18n/locales';
const LOCALE_FILE = /^src\/i18n\/locales\/([^/]+)\/([^/]+)\.json$/;

/**
 * Όλα τα μονοπάτια κόμβων ενός locale αντικειμένου (`a`, `a.b`, `a.b.c`) → `true` αν είναι φύλλο, `false` αν είναι
 * αντικείμενο (ή πίνακας — το `returnObjects` ζητά και τα δύο).
 */
function nodePaths(obj, prefix = '', out = new Map()) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.set(p, !v || typeof v !== 'object');
    nodePaths(v, p, out);
  }
  return out;
}

/** `γλώσσα → ns → Set(μονοπάτια)`, από την ΕΙΣΟΔΟ της πύλης (ADR-924). Άκυρο JSON ⇒ σφάλμα με όνομα. */
function loadLocaleIndex(input) {
  const index = new Map();
  const files = input.files([LOCALES_DIR], { accept: (rel) => LOCALE_FILE.test(rel) });
  for (const abs of files) {
    const [, lang, ns] = input.rel(abs).match(LOCALE_FILE);
    let parsed;
    try { parsed = JSON.parse(input.read(abs)); } catch (e) {
      throw new Error(`CHECK 3.108 — ${input.rel(abs)}: άκυρο JSON (${e.message})`);
    }
    if (!index.has(lang)) index.set(lang, new Map());
    index.get(lang).set(ns, nodePaths(parsed));
  }
  if (index.size === 0) throw new Error('CHECK 3.108 — κανένα locale: η απόδειξη ισοδυναμίας δεν μπορεί να κριθεί');
  return index;
}

/**
 * `γλώσσα → μονοπάτι → Set(ns)` ΜΟΝΟ για μονοπάτια που ζουν σε ≥2 namespaces. Ένα μονοπάτι με έναν ιδιοκτήτη έχει
 * τον ίδιο «πρώτο» σε ΚΑΘΕ σειρά με το ίδιο σύνολο φορτωμένων — άρα η σειρά κρίνεται μόνο στις συγκρούσεις.
 */
function sharedPaths(localeIndex) {
  const shared = new Map();
  for (const [lang, byNs] of localeIndex) {
    const owners = new Map();
    const leaf = new Set();
    for (const [ns, paths] of byNs) {
      for (const [p, isLeaf] of paths) {
        if (!owners.has(p)) owners.set(p, new Set());
        owners.get(p).add(ns);
        if (isLeaf) leaf.add(p);
      }
    }
    shared.set(lang, [...owners].filter(([, set]) => set.size > 1).map(([p, set]) => ({ path: p, owners: set, leaf: leaf.has(p) })));
  }
  return shared;
}

const sharedCache = new WeakMap();
function sharedOf(localeIndex) {
  if (!sharedCache.has(localeIndex)) sharedCache.set(localeIndex, sharedPaths(localeIndex));
  return sharedCache.get(localeIndex);
}

function firstHit(order, owners) {
  for (const ns of order) if (owners.has(ns)) return ns;
  return null;
}

/** Η πιο συντηρητική ερώτηση: «το αρχείο μπορεί να ζητήσει ΟΤΙΔΗΠΟΤΕ, και αντικείμενα». */
const ANY_REQUEST = Object.freeze({ all: true, objects: true, keys: [], prefixes: [] });

/**
 * Ζητά το αρχείο αυτό το μονοπάτι; Κλειδί = ο κόμβος, το υποδέντρο του, και οι πληθυντικοί του (`k_one`).
 * 🔑 Κλειδί με ΡΗΤΟ namespace (`t('ns:k')` ή `t(k, { ns })`) λύνεται ΜΕΣΑ σε αυτό όταν το namespace το έχει — πριν
 * από κάθε σάρωση της λίστας (`useTranslation.ts`: το ρητό πρόθεμα δεν ξανα-προθεματίζεται). Άρα μετράει μόνο αν το
 * δηλωμένο namespace ΔΕΝ το έχει (τότε πέφτει στη σάρωση, όπου η σειρά κρίνει).
 */
function requested(path, owners, request) {
  if (request.all) return true;
  const under = (k) => path === k || path.startsWith(`${k}.`) || path.startsWith(`${k}_`);
  const hit = (e, test) => test(e.key) && !(e.ns && owners.has(e.ns));
  return request.keys.some((e) => hit(e, under)) || request.prefixes.some((e) => hit(e, (k) => path.startsWith(k)));
}

/**
 * Ένα κοινό μονοπάτι κρίνεται μόνο αν το αρχείο **μπορεί** να το ζητήσει. Ένας κόμβος-αντικείμενο έχει νόημα μόνο
 * με `returnObjects`: χωρίς αυτό το i18next απαντά «returned an object instead of string» — κείμενο που δεν
 * ονομάζει namespace, άρα ίδιο σε κάθε σειρά.
 * 🔑 Μετρημένο: τα `building-tabs` και `building-timeline` μοιράζονται ΜΟΝΟ τον κόμβο-αντικείμενο `tabs`
 * (ADR-280 `LEGACY_NESTED_MAP`: το `tabs.timeline` μετακόμισε) — κανένα φύλλο.
 */
function matters(entry, request) {
  if (!entry.leaf && !request.objects) return false;
  return requested(entry.path, entry.owners, request);
}

/**
 * @param {{all: boolean, objects: boolean, keys: {ns: ?string, key: string}[], prefixes: {ns: ?string, key: string}[]}} [request] — τι μπορεί να ζητήσει
 *   το αρχείο (ο ταξινομητής AST του shell slice, ADR-744). Προεπιλογή: τα πάντα.
 * @returns {{equivalent: boolean, reason?: string}} — `reason` ονομάζει το πρώτο κλειδί που θα άλλαζε.
 */
function proveEquivalent(oldItems, newItems, compat, localeIndex, request = ANY_REQUEST) {
  const oldOrder = withCompatNamespaces(oldItems, compat);
  const newOrder = withCompatNamespaces(newItems, compat);
  if (oldOrder[0] !== newOrder[0]) return { equivalent: false, reason: `primary ${oldOrder[0]} → ${newOrder[0]}` };
  const same = oldOrder.length === newOrder.length && oldOrder.every((ns) => newOrder.includes(ns));
  if (!same) return { equivalent: false, reason: `φορτωμένα [${oldOrder}] → [${newOrder}]` };
  for (const [lang, shared] of sharedOf(localeIndex)) {
    for (const entry of shared) {
      if (!matters(entry, request)) continue;
      const before = firstHit(oldOrder, entry.owners);
      const after = firstHit(newOrder, entry.owners);
      if (before !== after) return { equivalent: false, reason: `${lang}: «${entry.path}» ${before} → ${after}` };
    }
  }
  return { equivalent: true };
}

module.exports = { loadLocaleIndex, proveEquivalent, nodePaths, ANY_REQUEST };
