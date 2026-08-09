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
  loadCompatNamespaces,
  withCompatNamespaces,
  extractNamespaces,
} = require('../lib/i18n-namespace-extract');

const REPO_ROOT = path.join(__dirname, '..', '..');

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

// ============================================================================
// ADR-280 compat splits (ADR-744 §12) — ΤΟ ΣΤΑΤΙΚΟ ΕΡΓΑΛΕΙΟ ΠΡΕΠΕΙ ΝΑ ΨΑΧΝΕΙ
// ΕΚΕΙ ΠΟΥ ΨΑΧΝΕΙ Η ΕΦΑΡΜΟΓΗ
// ============================================================================

// Φτιάχνει throwaway repo root με fixture `namespace-compat.ts`.
function makeCompatRepo(source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nscompat-'));
  const dir = path.join(root, 'src', 'i18n');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'namespace-compat.ts'), source, 'utf8');
  return root;
}

const COMPAT_FIXTURE = `
export const GEO_CANVAS_COMPATIBILITY_NAMESPACES = ['geo-canvas-drawing'] as const;

export const COMMON_COMPATIBILITY_NAMESPACES = [
  'common-actions',
  'common-shared',
] as const;

export const UNREFERENCED_COMPATIBILITY_NAMESPACES = ['nobody-uses-me'] as const;

const COMPAT_NAMESPACE_MAP: Record<string, readonly string[]> = {
  common: COMMON_COMPATIBILITY_NAMESPACES,
  'geo-canvas': GEO_CANVAS_COMPATIBILITY_NAMESPACES,
};
`;

describe('loadCompatNamespaces', () => {
  test('χαρτογραφεί γονέα → splits, δια μέσου του ονόματος της σταθεράς', () => {
    const compat = loadCompatNamespaces(makeCompatRepo(COMPAT_FIXTURE));
    expect([...compat.keys()].sort()).toEqual(['common', 'geo-canvas']);
    expect(compat.get('geo-canvas')).toEqual(['geo-canvas-drawing']);
    expect(compat.get('common')).toEqual(['common-actions', 'common-shared']);
  });

  test('σταθερά που ΔΕΝ αναφέρεται στον πίνακα δεν γίνεται ποτέ γονέας', () => {
    const compat = loadCompatNamespaces(makeCompatRepo(COMPAT_FIXTURE));
    expect([...compat.values()].flat()).not.toContain('nobody-uses-me');
  });

  test('απόν αρχείο → κενός χάρτης (skip-safe, ποτέ throw)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nocompat-'));
    expect(loadCompatNamespaces(root).size).toBe(0);
  });

  /**
   * 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΜΕΤΡΑΕΙ: ο parser τρέχει πάνω στο ΠΡΑΓΜΑΤΙΚΟ αρχείο, όχι σε
   * fixture. Αν κάποιος αλλάξει το σχήμα του `COMPAT_NAMESPACE_MAP` (π.χ. inline
   * πίνακες αντί για ονόματα σταθερών), το regex θα επιστρέψει σιωπηλά κενό χάρτη
   * και το CHECK 3.8 θα ξαναρχίσει να αναφέρει 97 ψευδώς θετικά — χωρίς κανένα
   * σφάλμα. Το «0 = κανείς δεν κοίταξε» πρέπει να είναι ΑΔΥΝΑΤΟ εδώ.
   */
  test('ΤΟ ΠΡΑΓΜΑΤΙΚΟ namespace-compat.ts: κάθε εγγραφή του πίνακα λύνεται', () => {
    const compat = loadCompatNamespaces(REPO_ROOT);
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'src', 'i18n', 'namespace-compat.ts'),
      'utf8',
    );
    const mapBody = source.match(
      /const\s+COMPAT_NAMESPACE_MAP\s*:[^=]*=\s*\{([\s\S]*?)\n\};/,
    );
    expect(mapBody).not.toBeNull();
    const declaredEntries = [
      ...mapBody[1].matchAll(/['"]?([a-zA-Z0-9_-]+)['"]?\s*:\s*[A-Z][A-Z0-9_]*\s*,/g),
    ].map((m) => m[1]);

    expect(declaredEntries.length).toBeGreaterThan(0);
    expect(compat.size).toBe(declaredEntries.length);
    for (const parent of declaredEntries) {
      expect(compat.get(parent)).toEqual(expect.arrayContaining([expect.any(String)]));
    }
    // Το ζεύγος που γέννησε τη λειτουργία (ADR-744 §12).
    expect(compat.get('geo-canvas')).toContain('geo-canvas-drawing');
  });
});

describe('withCompatNamespaces', () => {
  let compat;
  beforeAll(() => {
    compat = loadCompatNamespaces(makeCompatRepo(COMPAT_FIXTURE));
  });

  test('προσθέτει τα splits, κρατώντας ΠΡΩΤΟ το δηλωμένο namespace', () => {
    expect(withCompatNamespaces(['geo-canvas'], compat)).toEqual([
      'geo-canvas',
      'geo-canvas-drawing',
    ]);
  });

  test('namespace χωρίς split μένει ακριβώς ως έχει', () => {
    expect(withCompatNamespaces(['dxf-viewer'], compat)).toEqual(['dxf-viewer']);
  });

  test('de-duplicates όταν το split είναι ήδη δηλωμένο ρητά', () => {
    expect(withCompatNamespaces(['geo-canvas', 'geo-canvas-drawing'], compat)).toEqual([
      'geo-canvas',
      'geo-canvas-drawing',
    ]);
  });

  test('χωρίς χάρτη compat είναι ταυτοτική (back-compat)', () => {
    expect(withCompatNamespaces(['geo-canvas'], undefined)).toEqual(['geo-canvas']);
    expect(withCompatNamespaces(['geo-canvas'], new Map())).toEqual(['geo-canvas']);
  });
});
