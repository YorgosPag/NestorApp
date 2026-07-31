#!/usr/bin/env node
/**
 * ADR-744 §3 — from "which keys" to the bytes on disk.
 *
 * THE IDEA THE INDUSTRY DOES NOT IMPLEMENT
 * ----------------------------------------
 * i18next, next-intl and Lingui all split at NAMESPACE granularity: a screen
 * that needs one string from `common-shared` loads all 39.935 bytes of it. This
 * module slices at KEY granularity — the shell needs `search.*` out of
 * `common-shared`, roughly 400 bytes, so that is what ships synchronously. The
 * remaining 99% still arrives through the existing async preload, unchanged.
 *
 * WHY THAT IS SAFE RATHER THAN CLEVER
 * -----------------------------------
 * A namespace present in i18next with SOME of its keys is not a half-loaded
 * namespace — `addResourceBundle(..., deep=true, overwrite=true)` merges the
 * full version over the slice when the async load lands, and `t()` for a key
 * that is not in the slice yet behaves exactly as it does today. The slice can
 * only ever ADD correct strings to the first frame; it can never remove one.
 *
 * DETERMINISM (ADR-727's two traps, inherited verbatim)
 * -----------------------------------------------------
 * 1. No `new Date()` anywhere near the output. Provenance is a sha256 of the
 *    INPUTS, which is the only version of "when was this built" that can answer
 *    "is it still correct".
 * 2. LF, sorted keys, one trailing newline. `core.autocrlf=true` with no
 *    `.gitattributes` means a raw byte comparison against the working tree is
 *    permanently red on Windows; the gate normalizes, and this writer gives it
 *    something stable to normalize.
 */

'use strict';

const crypto = require('node:crypto');

/** Reads a dotted path out of a locale tree. Returns `undefined` when absent. */
function readPath(tree, dotted) {
  let current = tree;
  for (const part of dotted.split('.')) {
    if (current === null || typeof current !== 'object' || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

/** Writes a dotted path into `target`, creating intermediate objects. */
function writePath(target, dotted, value) {
  const parts = dotted.split('.');
  const last = parts.pop();
  let cursor = target;
  for (const part of parts) {
    if (typeof cursor[part] !== 'object' || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[last] = value;
}

// i18next resolves `t('foo', { count })` against foo_one / foo_other, so a slice
// that copied only the bare `foo` would ship a pluralized string that renders as
// a raw key on every plural form. Siblings travel with their stem.
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other', '_plural'];

function copyPluralSiblings(source, target, dotted) {
  const cut = dotted.lastIndexOf('.');
  const parentPath = cut === -1 ? null : dotted.slice(0, cut);
  const stem = cut === -1 ? dotted : dotted.slice(cut + 1);
  const parent = parentPath === null ? source : readPath(source, parentPath);
  if (parent === null || typeof parent !== 'object') return;
  for (const suffix of PLURAL_SUFFIXES) {
    const sibling = `${stem}${suffix}`;
    if (sibling in parent) writePath(target, parentPath ? `${parentPath}.${sibling}` : sibling, parent[sibling]);
  }
}

/**
 * @param {object} source      the full locale namespace
 * @param {{keys: Set<string>, prefixes: Set<string>, whole: boolean}} want
 * @returns {{slice: object, matched: number, missing: string[]}}
 *   `missing` = a key the shell asks for that no locale defines. NOT this gate's
 *   problem — CHECK 3.8 owns missing keys — so it is reported, not fatal.
 */
function pruneNamespace(source, want) {
  if (want.whole) return { slice: source, matched: -1, missing: [] };

  const slice = {};
  const missing = [];
  let matched = 0;

  // A prefix stands for a subtree the call site indexes dynamically
  // (`t(`emailShare.${k}`)`), so the whole subtree must travel.
  for (const prefix of want.prefixes) {
    const subtree = readPath(source, prefix);
    if (subtree === undefined) { missing.push(`${prefix}.*`); continue; }
    writePath(slice, prefix, subtree);
    matched += 1;
  }
  for (const key of want.keys) {
    if (readPath(slice, key) !== undefined) continue;   // already inside a copied subtree
    const value = readPath(source, key);
    if (value === undefined) { missing.push(key); continue; }
    writePath(slice, key, value);
    copyPluralSiblings(source, slice, key);
    matched += 1;
  }
  return { slice, matched, missing };
}

/** Deterministic JSON: keys sorted at every depth, 2-space indent, LF, trailing newline. */
function stableStringify(value) {
  const sortDeep = (node) => {
    if (Array.isArray(node)) return node.map(sortDeep);
    if (node === null || typeof node !== 'object') return node;
    const out = {};
    for (const key of Object.keys(node).sort()) out[key] = sortDeep(node[key]);
    return out;
  };
  return `${JSON.stringify(sortDeep(value), null, 2).replace(/\r\n/g, '\n')}\n`;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Provenance of one shell module — computed ONLY from what that file itself
 * says, never from anything resolved against the rest of the shell. The
 * pre-commit gate re-derives this number from a single staged file with no
 * graph and no siblings loaded, and it must land on the generator's value
 * exactly; anything cross-module in here would make the gate silently red.
 *
 * The import specifiers are in there on purpose: a new module can only enter
 * the shell closure when a module ALREADY in it gains an import edge, so
 * hashing the edges is what lets the cheap layer detect closure growth without
 * rebuilding the 13.877-module graph (~19s).
 */
function fingerprintShellFile({ importSpecs, namespaces, callTexts, harvest }) {
  const harvested = {};
  for (const [name, values] of harvest || new Map()) harvested[name] = [...values].sort();
  return sha256(stableStringify({
    importSpecs: [...importSpecs].sort(),
    namespaces: [...namespaces].sort(),
    callTexts: [...(callTexts || [])].sort(),
    harvest: harvested,
  }));
}

/**
 * A key with no explicit namespace is requested from EVERY namespace its file
 * declares, because that is how i18next resolves it. So "absent from
 * common-photos" is the normal case for a key that lives in common-actions, and
 * reporting it would bury the one signal that matters under five copies of
 * noise. A key counts as missing only when NO namespace that was asked for it
 * has it.
 */
function aggregateMissing(wants, missingByNamespace) {
  const requestedIn = new Map();
  const remember = (key, namespace) => {
    if (!requestedIn.has(key)) requestedIn.set(key, new Set());
    requestedIn.get(key).add(namespace);
  };
  for (const [namespace, want] of wants) {
    if (want.whole) continue;
    want.keys.forEach(key => remember(key, namespace));
    want.prefixes.forEach(prefix => remember(`${prefix}.*`, namespace));
  }

  const missingIn = new Map(Object.entries(missingByNamespace).map(([ns, list]) => [ns, new Set(list)]));
  const orphans = [];
  for (const [key, namespaces] of requestedIn) {
    if ([...namespaces].every(ns => missingIn.get(ns)?.has(key))) orphans.push(key);
  }
  return orphans.sort();
}

/**
 * Builds every language's slice.
 *
 * @param {{wants: Map<string, {keys: Set, prefixes: Set, whole: boolean}>,
 *          languages: string[],
 *          readNamespace: (lang: string, ns: string) => ?object}} input
 */
function buildSlices({ wants, languages, readNamespace }) {
  const resources = {};
  const rawMissing = {};
  let matchedKeys = 0;
  const [primaryLanguage] = languages;

  for (const language of languages) {
    const perLanguage = {};
    for (const namespace of [...wants.keys()].sort()) {
      const source = readNamespace(language, namespace);
      if (source === null || source === undefined) continue;
      const { slice, matched, missing } = pruneNamespace(source, wants.get(namespace));
      // Record what was NOT found BEFORE deciding whether the slice is worth
      // keeping. Skipping this for an empty slice used to hide a key from
      // `aggregateMissing` entirely: with no entry for that namespace the
      // "missing everywhere" test could never be satisfied, so a key no locale
      // defines was reported as fine. Measured on the real tree — 14 keys the
      // shell can request resolved to nothing and the report said zero.
      if (language === primaryLanguage) rawMissing[namespace] = missing;
      if (Object.keys(slice).length === 0) continue;
      perLanguage[namespace] = slice;
      if (matched > 0 && language === primaryLanguage) matchedKeys += matched;
    }
    resources[language] = perLanguage;
  }
  return { resources, unresolvableKeys: aggregateMissing(wants, rawMissing), matchedKeys };
}

module.exports = {
  PLURAL_SUFFIXES,
  readPath,
  writePath,
  copyPluralSiblings,
  pruneNamespace,
  aggregateMissing,
  stableStringify,
  sha256,
  fingerprintShellFile,
  buildSlices,
};
