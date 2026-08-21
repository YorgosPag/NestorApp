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
  extractTCalls,
  extractExplicitTCalls,
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

// ─── Ρ: το ρητό `t('ns:key')` είναι ΙΣΧΥΡΙΣΜΟΣ, όχι απόδειξη ────────────────────
//
// 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ. Η `extractTCalls` πετάει κάθε κλήση με `:` — «these are
// explicitly scoped» — δηλαδή θεωρεί τη **δήλωση** απόδειξη ορθότητας. Μετρημένο
// 2026-08-21 (ADR-777 §8.41): **19** τέτοιες κλήσεις σε 7 αρχεία δείχνουν σε κλειδί
// που ΔΕΝ υπάρχει στο namespace που ονομάζουν, και το `src/i18n/config.ts` **δεν
// ορίζει `fallbackNS`** ⇒ ωμό κλειδί στην οθόνη. Ήταν το **76%** της αλήθειας.

describe('Ρ — extractExplicitTCalls: ό,τι πετάει η extractTCalls', () => {
  it('Ρ1 — το ρητό `ns:key` επιστρέφεται χωρισμένο σε ns + κλειδί', () => {
    const out = extractExplicitTCalls("t('common-actions:actions.delete_loading')");
    expect(out).toHaveLength(1);
    expect(out[0].ns).toBe('common-actions');
    expect(out[0].key).toBe('actions.delete_loading');
  });

  // 🔑 ΟΙ ΔΥΟ ΣΥΝΑΡΤΗΣΕΙΣ ΕΙΝΑΙ ΣΥΜΠΛΗΡΩΜΑΤΙΚΕΣ, ΠΟΤΕ ΕΠΙΚΑΛΥΠΤΟΜΕΝΕΣ — αλλιώς η
  // ίδια κλήση θα μετριόταν δύο φορές και η baseline θα ήταν διπλάσια της αλήθειας.
  it('Ρ2 — καμία κλήση δεν πιάνεται ΚΑΙ από τις δύο', () => {
    const src = "t('bare.key'); t('ns:scoped.key');";
    expect(extractTCalls(src).map(c => c.key)).toEqual(['bare.key']);
    expect(extractExplicitTCalls(src).map(c => `${c.ns}:${c.key}`)).toEqual(['ns:scoped.key']);
  });

  // 🔴 ΕΔΩ ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ (CHECK 3.36): ένα ADR που τεκμηριώνει τη βλάβη δεν
  // επιτρέπεται να γίνει το ίδιο βλάβη. Η `extractTCalls` ΔΕΝ τα κόβει — εκεί ένα
  // παραπάνω string είναι αβλαβές, εδώ θα ήταν **παραβίαση**.
  it('Ρ3 — παράδειγμα σε σχόλιο ΔΕΝ είναι θέση κλήσης', () => {
    const src = [
      "// κακό παράδειγμα: t('common-actions:actions.delete_loading')",
      "const x = 1;",
    ].join('\n');
    expect(extractExplicitTCalls(src)).toHaveLength(0);
  });

  it('Ρ4 — η θέση επιστρέφεται, ώστε η αναφορά να δείχνει γραμμή', () => {
    const out = extractExplicitTCalls("const a=1;\nt('ns:k.v')");
    expect(out[0].index).toBeGreaterThan(0);
  });

  // ⚠️ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΩΣ ΠΑΡΟΝΟΜΑΣΤΗΣ: το locale έχει `save_loading`
  // και ΟΧΙ `delete_loading`. Αν αυτό αλλάξει, η άγκυρα πρέπει να το πει — γιατί
  // τότε το εύρημα θεραπεύτηκε και η baseline οφείλει να πέσει.
  it('Ρ5 — το κλειδί που γέννησε την επέκταση όντως λείπει από το locale', () => {
    const locale = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'src', 'i18n', 'locales', 'el', 'common-actions.json'), 'utf8'));
    expect(locale.actions.save_loading).toBeDefined();
    expect(locale.actions.delete_loading).toBeUndefined();
  });

  // 🔴 ΤΟ `fallbackNS` ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ Η ΑΣΤΟΧΙΑ ΕΙΝΑΙ ΟΡΑΤΗ ΣΤΗΝ ΟΘΟΝΗ.
  // Αν κάποιος το προσθέσει, το κριτήριο «μόνο στο namespace που ονομάζει» παύει
  // να είναι σωστό — και αυτή η άγκυρα είναι που θα το πει.
  it('Ρ6 — το i18next ΔΕΝ έχει fallbackNS, άρα δεν υπάρχει δεύτερη ευκαιρία', () => {
    const config = fs.readFileSync(path.join(REPO_ROOT, 'src', 'i18n', 'config.ts'), 'utf8');
    expect(config).not.toMatch(/\bfallbackNS\s*:/);
  });
});
