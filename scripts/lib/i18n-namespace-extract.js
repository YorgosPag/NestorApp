/**
 * =============================================================================
 * SSoT: i18n namespace extraction for the pre-commit key checks
 * =============================================================================
 * Shared by:
 *   - scripts/check-i18n-missing-keys.js       (CHECK 3.8, blocking)
 *   - scripts/generate-i18n-keys-baseline.js   (baseline generator)
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

module.exports = { loadNamespaceBundles, extractNamespaces };
