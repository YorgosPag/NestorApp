/**
 * Presubmit-grade tests for scripts/lib/i18n-namespace-extract.js — the SSoT
 * namespace extractor shared by CHECK 3.8 (check-i18n-missing-keys.js) and the
 * baseline generator (generate-i18n-keys-baseline.js).
 *
 * The one behaviour worth guarding hardest: a bare bundle identifier
 * `useTranslation(COMMON_NAMESPACES)` MUST resolve to its namespace list. If it
 * silently returned [], both checks would skip the file and drop i18n key
 * validation for every t() in it — the exact regression this module prevents.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadNamespaceBundles,
  extractNamespaces,
} = require('../lib/i18n-namespace-extract');

// Build a throwaway repo root with a namespace-bundles.ts fixture.
function makeRepo(bundlesSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nsbundle-'));
  const dir = path.join(root, 'src', 'i18n');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'namespace-bundles.ts'), bundlesSource, 'utf8');
  return root;
}

const REAL_BUNDLE = `
export const COMMON_NAMESPACES = [
  'common',
  'common-account',
  'common-sales',
] as const;

export const MEP_NAMESPACES = ['mep', 'mep-forms'] as const;
`;

describe('loadNamespaceBundles', () => {
  test('parses every "export const X = [...] as const" bundle', () => {
    const root = makeRepo(REAL_BUNDLE);
    const bundles = loadNamespaceBundles(root);
    expect([...bundles.keys()].sort()).toEqual(['COMMON_NAMESPACES', 'MEP_NAMESPACES']);
    expect(bundles.get('COMMON_NAMESPACES')).toEqual(['common', 'common-account', 'common-sales']);
    expect(bundles.get('MEP_NAMESPACES')).toEqual(['mep', 'mep-forms']);
  });

  test('returns an empty map when the bundles file is absent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nobundle-'));
    expect(loadNamespaceBundles(root).size).toBe(0);
  });
});

describe('extractNamespaces', () => {
  let bundles;
  beforeAll(() => {
    bundles = loadNamespaceBundles(makeRepo(REAL_BUNDLE));
  });

  test('resolves a bare bundle identifier to its namespace list', () => {
    const ns = extractNamespaces('const {t} = useTranslation(COMMON_NAMESPACES);', bundles);
    expect(ns).toEqual(['common', 'common-account', 'common-sales']);
  });

  test('still handles a single string literal', () => {
    expect(extractNamespaces("useTranslation('dxf-viewer')", bundles)).toEqual(['dxf-viewer']);
  });

  test('still handles an inline array literal', () => {
    expect(extractNamespaces("useTranslation(['a', 'b'])", bundles)).toEqual(['a', 'b']);
  });

  test('ignores an unknown identifier (runtime variable)', () => {
    expect(extractNamespaces('useTranslation(props.namespace)', bundles)).toEqual([]);
  });

  test('de-duplicates across mixed call shapes', () => {
    const src = "useTranslation('common'); useTranslation(COMMON_NAMESPACES);";
    expect(extractNamespaces(src, bundles)).toEqual(['common', 'common-account', 'common-sales']);
  });

  test('without a bundles map, a const identifier resolves to nothing (back-compat)', () => {
    expect(extractNamespaces('useTranslation(COMMON_NAMESPACES)')).toEqual([]);
  });
});
