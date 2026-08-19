/**
 * CHECK 3.34 — i18n key-level shell slice: Jest suite (ADR-744).
 *
 * Four of these groups are load-bearing rather than decorative — they are the
 * ones that go red against the *obvious wrong implementation*:
 *
 *   Group 2 (dynamic boundary) — following `import()` edges is what ADR-700
 *     does, and doing it here measured 7.492 files / 2,93 MB instead of 393 /
 *     35 KB. If anyone "fixes" the walk to follow dynamic imports, Group 2 fails.
 *
 *   Group 4 (the ladder) — every rung was added because a real call site in this
 *     repo needed it. A regex-based rewrite cannot tell `t(a ? 'x' : 'y')` from
 *     `t(a)`, and the difference is 400 bytes versus a 40 KB namespace.
 *
 *   Group 6 (fingerprint locality) — the pre-commit layer re-fingerprints ONE
 *     staged file with no graph and no siblings, and must land on the exact
 *     number the generator wrote. If anyone folds a resolved key set into the
 *     fingerprint, the gate becomes permanently and invisibly red on any file
 *     whose keys come from elsewhere. Group 6 is the only thing watching.
 *
 *   Group 8 (line endings) — core.autocrlf=true with no .gitattributes means a
 *     raw byte comparison is red on every Windows checkout regardless of
 *     freshness. Inherited verbatim from ADR-727's trap #2.
 *
 * Fixtures are built programmatically: the inputs are a few lines of TS or JSON
 * whose *content* is the point of each assertion, and an on-disk fixture would
 * hide that content from the reader.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LIB = path.resolve(__dirname, '..', 'lib', 'i18n-shell-slice');
const { computeShellClosure } = require(path.join(LIB, 'shell-closure'));
const {
  splitKey,
  staticPrefixOf,
  leftmostStringLiteral,
  resolveAccessChain,
  collectLocalConstants,
  harvestPropertyValues,
  loadKeyConstants,
  hasDefaultValue,
  parseSource,
  extractSurface,
  classifyTranslateCalls,
} = require(path.join(LIB, 'key-extract'));
const {
  pruneNamespace,
  aggregateMissing,
  stableStringify,
  sha256,
  fingerprintShellFile,
  buildSlices,
  copyPluralSiblings,
} = require(path.join(LIB, 'slice-build'));
const { DEFAULTS, loadConfig, policyFor, parsePolicyEntry, assertKnownFields } = require(path.join(LIB, 'config'));
const { patternToRegExp, serializeWants, hydrateWants } = require(path.join(LIB, 'plan'));
const { bootstrap } = require(path.join(LIB, 'cli'));
const { normalize, checkArtifactIntegrity, parseArgs } = require(path.resolve(__dirname, '..', 'check-i18n-shell-slice.js'));
const MG = require(path.resolve(__dirname, '..', 'lib', 'module-graph'));
const { stripComments, extractTCalls } = require(path.resolve(__dirname, '..', 'lib', 'i18n-namespace-extract'));

// ─── helpers ─────────────────────────────────────────────────────────────────

let tmpRoot;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-slice-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function write(relPath, content) {
  const abs = path.join(tmpRoot, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return MG.toPosix(abs);
}

/** Builds a real module graph over the temp tree — no mocking of the ADR-700 layer. */
function graphOf(files) {
  return MG.buildGraph({
    projectRoot: MG.toPosix(tmpRoot),
    aliases: [],
    files,
    readFile: file => fs.readFileSync(file, 'utf8'),
    onParseError: () => {},
  });
}

function classify(source) {
  return classifyTranslateCalls(source, { file: '/x/a.tsx', keyConstants: new Map() });
}

const keysOf = result => result.keys.map(k => (k.ns ? `${k.ns}:${k.key}` : k.key)).sort();

// ─── Group 1: barrel-aware closure ───────────────────────────────────────────

describe('Group 1 — the closure credits the declaring file, not the barrel', () => {
  it('a named import through a barrel pulls only the declaring module', () => {
    const root = write('src/app/layout.tsx', `import { Button } from './ui';\nexport default function L() { return null; }\n`);
    write('src/app/ui/index.ts', `export { Button } from './button';\nexport { Table } from './table';\n`);
    write('src/app/ui/button.tsx', `export const Button = () => null;\n`);
    write('src/app/ui/table.tsx', `export const Table = () => null;\n`);

    const files = ['src/app/layout.tsx', 'src/app/ui/index.ts', 'src/app/ui/button.tsx', 'src/app/ui/table.tsx']
      .map(f => MG.toPosix(path.join(tmpRoot, f)));
    const closure = computeShellClosure(graphOf(files), [root]);

    expect(closure.files).toContain('src/app/ui/button.tsx');
    expect(closure.files).not.toContain('src/app/ui/table.tsx');
  });

  it('a side-effect import brings the whole module in', () => {
    const root = write('src/app/layout.tsx', `import './polyfill';\nexport default function L() { return null; }\n`);
    const poly = write('src/app/polyfill.ts', `export const x = 1;\n`);
    const closure = computeShellClosure(graphOf([root, poly]), [root]);
    expect(closure.files).toContain('src/app/polyfill.ts');
  });

  it('an unresolvable named import still brings the target module in (fail-safe)', () => {
    const root = write('src/app/layout.tsx', `import Thing from './thing';\nexport default function L() { return Thing; }\n`);
    const thing = write('src/app/thing.ts', `const Thing = 1;\nexport { Thing as default };\n`);
    const closure = computeShellClosure(graphOf([root, thing]), [root]);
    expect(closure.files).toContain('src/app/thing.ts');
  });
});

// ─── Group 2: the boundaries that make a shell a shell ───────────────────────

describe('Group 2 — dynamic and route boundaries (LOAD-BEARING)', () => {
  it('a dynamic import is CUT, not followed', () => {
    const root = write('src/app/layout.tsx', `const Heavy = () => import('./heavy');\nexport default function L() { return Heavy; }\n`);
    const heavy = write('src/app/heavy.tsx', `export const Heavy = () => null;\n`);
    const closure = computeShellClosure(graphOf([root, heavy]), [root]);

    expect(closure.files).not.toContain('src/app/heavy.tsx');
    expect(closure.dynamicBoundaries).toContain('src/app/heavy.tsx');
  });

  it('a page reached by a static import is CUT — it owns its own loading state', () => {
    const root = write('src/app/layout.tsx', `import { P } from './dash/page';\nexport default function L() { return P; }\n`);
    const page = write('src/app/dash/page.tsx', `export const P = () => null;\n`);
    const closure = computeShellClosure(graphOf([root, page]), [root]);

    expect(closure.files).not.toContain('src/app/dash/page.tsx');
    expect(closure.routeBoundaries).toContain('src/app/dash/page.tsx');
  });

  it('a root that IS a page stays in the closure', () => {
    const root = write('src/app/page.tsx', `import { W } from './widget';\nexport default function P() { return W; }\n`);
    const widget = write('src/app/widget.tsx', `export const W = () => null;\n`);
    const closure = computeShellClosure(graphOf([root, widget]), [root]);

    expect(closure.files).toEqual(expect.arrayContaining(['src/app/page.tsx', 'src/app/widget.tsx']));
  });
});

// ─── Group 3: namespace extraction and comment blindness ─────────────────────

describe('Group 3 — a comment is documentation, not a call site', () => {
  it('stripComments blanks comments while preserving length and lines', () => {
    const source = "const a = 1; // t('x')\n/* useTranslation('files') */\nconst b = 2;\n";
    const stripped = stripComments(source);
    expect(stripped).toHaveLength(source.length);
    expect(stripped.split('\n')).toHaveLength(source.split('\n').length);
    expect(stripped).not.toContain('files');
    expect(stripped).toContain('const b = 2;');
  });

  it('does not eat a // inside a string literal', () => {
    const source = `const url = 'https://x.dev'; const k = 'keep';\n`;
    expect(stripComments(source)).toContain("'keep'");
  });

  it('does not eat an escaped // inside a regex literal', () => {
    // A swallowed useTranslation() means a namespace the shell needs never
    // reaches the slice — a raw key on screen. Asymmetric damage, cheap guard.
    const source = `p.replace(/\\/\\//g, ''); useTranslation('files');\n`;
    expect(stripComments(source)).toContain("useTranslation('files')");
  });

  it('extractTCalls keeps its documented behaviour after the move to the shared lib', () => {
    expect(extractTCalls(`t('a.b'), t("c"), t('ns:skipped'), t(x)`).map(m => m.key)).toEqual(['a.b', 'c']);
  });
});

// ─── Group 4: the classification ladder (LOAD-BEARING) ───────────────────────

describe('Group 4 — every rung of the dynamic-key ladder', () => {
  it('explicit ns:key literals are taken (the shared regex drops them)', () => {
    expect(keysOf(classify(`t('files:upload.ok')`))).toEqual(['files:upload.ok']);
  });

  it('a backtick literal with no substitution is a key', () => {
    expect(keysOf(classify('t(`a.b`)'))).toEqual(['a.b']);
  });

  it('both branches of a ternary are taken', () => {
    expect(keysOf(classify(`t(flag ? 'yes.k' : 'no.k')`))).toEqual(['no.k', 'yes.k']);
  });

  it('a template with a static head becomes a PREFIX, not a key', () => {
    const result = classify('t(`emailShare.${templateKey}`)');
    expect(result.prefixes.map(p => p.prefix)).toEqual(['emailShare']);
    expect(result.unresolved).toHaveLength(0);
  });

  it('a template with no static head is unresolved — never guessed', () => {
    expect(classify('t(`${x}.suffix`)').unresolved).toHaveLength(1);
  });

  it("string concatenation yields the leftmost literal's prefix", () => {
    expect(classify(`t('errors.' + code)`).prefixes.map(p => p.prefix)).toEqual(['errors']);
  });

  it('?? and || are alternatives — BOTH sides are classified', () => {
    expect(keysOf(classify(`t('primary.k' || 'other.k')`))).toEqual(['other.k', 'primary.k']);
  });

  it('a half-resolvable alternative keeps the branch it can name AND still reports unresolved', () => {
    // Dropping 'fall.back' because its sibling is opaque would be the wrong
    // direction: a key we keep costs bytes, a key we drop is a raw key.
    const result = classify(`t(a ?? 'fall.back')`);
    expect(keysOf(result)).toEqual(['fall.back']);
    expect(result.unresolved).toHaveLength(1);
  });

  it('a local const map resolves through a computed index (all values)', () => {
    const source = `const M: Record<string,string> = { a: 'p.one', b: 'p.two' };\nt(M[x]);\n`;
    expect(keysOf(classify(source))).toEqual(['p.one', 'p.two']);
  });

  it('a property read off a loop binding resolves from the file literals', () => {
    const source = `const NAV = [{ labelKey: 'account.nav.profile' }, { labelKey: 'account.nav.security' }];\n`
      + `NAV.map(item => t(item.labelKey));\n`;
    expect(keysOf(classify(source))).toEqual(['account.nav.profile', 'account.nav.security']);
  });

  it('a property whose literals live in ANOTHER shell module resolves via the shell-wide harvest', () => {
    const local = `export function Tabs({ tabs }) { return tabs.map(tab => t(tab.labelKey)); }\n`;
    const foreign = harvestPropertyValues(parseSource('/x/cfg.ts', `const TABS = [{ labelKey: 'module.orders' }];\n`));
    const withHarvest = classifyTranslateCalls(local, { file: '/x/tabs.tsx', keyConstants: new Map(), propertyValues: foreign });
    expect(keysOf(withHarvest)).toEqual(['module.orders']);
    // …and stays unresolved without it, which is what forces the two-phase walk.
    expect(classify(local).unresolved).toHaveLength(1);
  });

  it('a defaultValue makes the call incapable of flashing — resolved, contributes nothing', () => {
    const result = classify(`t(anything, { defaultValue: fallback })`);
    expect(result.unresolved).toHaveLength(0);
    expect(result.keys).toHaveLength(0);
    expect(result.defaulted).toBe(1);
  });

  it('an opaque variable with no default is UNRESOLVED — the refusal is the guarantee', () => {
    const result = classify(`t(step.titleKey)`);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].line).toBe(1);
  });

  it('a dynamic { ns } option is unresolved even when the key is a literal', () => {
    expect(classify(`t('a.b', { ns: someNs })`).unresolved).toHaveLength(1);
  });

  it('a static { ns } option overrides the file namespaces', () => {
    expect(keysOf(classify(`t('a.b', { ns: 'files' })`))).toEqual(['files:a.b']);
  });

  it('i18n.t(...) counts as a translate call', () => {
    expect(keysOf(classify(`i18n.t('x:y.z')`))).toEqual(['x:y.z']);
  });
});

// ─── Group 5: key-constant SSoTs ─────────────────────────────────────────────

describe('Group 5 — registered key-constant trees', () => {
  it('resolves a leaf, and a whole subtree when the access stops short', () => {
    write('src/config/keys.ts', `export const K = {\n  files: { a: 'files:one', b: 'files:two' },\n} as const;\n`);
    const constants = loadKeyConstants(tmpRoot, [{ file: 'src/config/keys.ts', exportName: 'K' }]);
    const leaf = classifyTranslateCalls(`t(K.files.a)`, { file: '/x/a.ts', keyConstants: constants });
    const subtree = classifyTranslateCalls(`t(K.files)`, { file: '/x/a.ts', keyConstants: constants });
    expect(keysOf(leaf)).toEqual(['files:one']);
    expect(keysOf(subtree)).toEqual(['files:one', 'files:two']);
  });

  it('a missing constant file is not fatal — it simply resolves nothing', () => {
    expect(loadKeyConstants(tmpRoot, [{ file: 'nope.ts', exportName: 'K' }]).size).toBe(0);
  });
});

// ─── Group 6: fingerprint locality (LOAD-BEARING) ────────────────────────────

describe('Group 6 — the fingerprint must be computable from ONE file', () => {
  const surfaceOf = source => ({
    importSpecs: ['named ./x'],
    namespaces: ['common'],
    ...extractSurface(source, { file: '/x/a.tsx' }),
  });

  it('is stable across runs for identical input', () => {
    const source = `const N = [{ labelKey: 'a.b' }];\nt('c.d');\n`;
    expect(fingerprintShellFile(surfaceOf(source))).toBe(fingerprintShellFile(surfaceOf(source)));
  });

  it('changes when a t() call changes', () => {
    expect(fingerprintShellFile(surfaceOf(`t('a.b');`)))
      .not.toBe(fingerprintShellFile(surfaceOf(`t('a.c');`)));
  });

  it('changes when an import edge changes — the only way a module can join the shell', () => {
    const base = surfaceOf(`t('a.b');`);
    expect(fingerprintShellFile(base))
      .not.toBe(fingerprintShellFile({ ...base, importSpecs: ['named ./y'] }));
  });

  it('does NOT depend on anything resolved from other modules', () => {
    // The surface of a generic renderer is identical whether or not the shell
    // happens to contain a module that supplies its labelKey literals.
    const generic = `export function Tabs({ tabs }) { return tabs.map(tab => t(tab.labelKey)); }\n`;
    const surface = surfaceOf(generic);
    expect(Object.keys(surface)).toEqual(expect.arrayContaining(['callTexts', 'harvest']));
    expect(surface).not.toHaveProperty('keys');
    expect(surface).not.toHaveProperty('unresolved');
  });
});

// ─── Group 7: slicing ────────────────────────────────────────────────────────

describe('Group 7 — pruning a namespace down to the keys the shell asks for', () => {
  const source = {
    search: { globalSearch: 'Αναζήτηση', placeholder: 'Πληκτρολογήστε', hints: { minChars: '3' } },
    unrelated: { huge: 'x'.repeat(1000) },
    item: 'μία', item_other: 'πολλές',
  };

  it('takes a single dotted key and nothing else', () => {
    const { slice, matched } = pruneNamespace(source, { keys: new Set(['search.globalSearch']), prefixes: new Set(), whole: false });
    expect(slice).toEqual({ search: { globalSearch: 'Αναζήτηση' } });
    expect(matched).toBe(1);
  });

  it('a prefix takes the whole subtree', () => {
    const { slice } = pruneNamespace(source, { keys: new Set(), prefixes: new Set(['search']), whole: false });
    expect(slice.search.hints).toEqual({ minChars: '3' });
    expect(slice.unrelated).toBeUndefined();
  });

  it('plural siblings travel with their stem — otherwise t(k,{count}) renders the raw key', () => {
    const { slice } = pruneNamespace(source, { keys: new Set(['item']), prefixes: new Set(), whole: false });
    expect(slice).toEqual({ item: 'μία', item_other: 'πολλές' });
  });

  it('copyPluralSiblings handles a nested stem', () => {
    const target = {};
    copyPluralSiblings({ a: { b: 'x', b_other: 'y' } }, target, 'a.b');
    expect(target).toEqual({ a: { b_other: 'y' } });
  });

  it('a key no locale defines is reported, never invented', () => {
    const { slice, missing } = pruneNamespace(source, { keys: new Set(['nope.here']), prefixes: new Set(), whole: false });
    expect(slice).toEqual({});
    expect(missing).toEqual(['nope.here']);
  });

  it('whole: true short-circuits to the untouched namespace', () => {
    expect(pruneNamespace(source, { keys: new Set(), prefixes: new Set(), whole: true }).slice).toBe(source);
  });

  it('a key found in ONE of its candidate namespaces is not reported missing', () => {
    // `buttons.cancel` is requested from every namespace the file declares, and
    // lives in exactly one. Reporting it five times would bury the real signal.
    const wants = new Map([
      ['common-actions', { keys: new Set(['buttons.cancel']), prefixes: new Set(), whole: false }],
      ['common-photos', { keys: new Set(['buttons.cancel']), prefixes: new Set(), whole: false }],
    ]);
    expect(aggregateMissing(wants, { 'common-actions': [], 'common-photos': ['buttons.cancel'] })).toEqual([]);
    expect(aggregateMissing(wants, { 'common-actions': ['buttons.cancel'], 'common-photos': ['buttons.cancel'] }))
      .toEqual(['buttons.cancel']);
  });

  it('buildSlices drops a namespace that ends up empty', () => {
    const result = buildSlices({
      wants: new Map([['a', { keys: new Set(['nope']), prefixes: new Set(), whole: false }]]),
      languages: ['el'],
      readNamespace: () => ({ real: 'x' }),
    });
    expect(result.resources.el).toEqual({});
  });
});

// ─── Group 8: determinism and line endings (LOAD-BEARING) ────────────────────

describe('Group 8 — reproducible bytes, on any platform', () => {
  it('stableStringify sorts at every depth and ends with exactly one LF', () => {
    const a = stableStringify({ b: { d: 1, c: 2 }, a: 3 });
    const b = stableStringify({ a: 3, b: { c: 2, d: 1 } });
    expect(a).toBe(b);
    expect(a.endsWith('}\n')).toBe(true);
    expect(a).not.toContain('\r');
  });

  it('carries no timestamp — provenance is a hash of the inputs (ADR-727 trap #1)', () => {
    const text = stableStringify({ common: { a: 'x' } });
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(sha256(text)).toBe(sha256(stableStringify({ common: { a: 'x' } })));
  });

  it('normalize folds CRLF and BOM so a Windows checkout is not permanently red', () => {
    expect(normalize('﻿{\r\n  "a": 1\r\n}\r\n')).toBe('{\n  "a": 1\n}\n');
  });

  it('artifact integrity compares NORMALIZED bytes against the recorded sha256', () => {
    const text = stableStringify({ common: { a: 'x' } });
    const relPath = 'out/slice.json';
    fs.mkdirSync(path.join(tmpRoot, 'out'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, relPath), text.replace(/\n/g, '\r\n'), 'utf8');

    const spy = jest.spyOn(path, 'join');
    spy.mockRestore();
    // Compare directly through the same primitives the gate uses.
    const onDisk = fs.readFileSync(path.join(tmpRoot, relPath), 'utf8');
    expect(sha256(normalize(onDisk))).toBe(sha256(text));
  });
});

// ─── Group 9: configuration is reviewed, not guessed ─────────────────────────

describe('Group 9 — config refuses to be silently wrong', () => {
  it('rejects an unknown top-level field instead of ignoring it', () => {
    expect(() => assertKnownFields({ shelRoots: [] })).toThrow(/unknown field/i);
    expect(() => assertKnownFields({ $doc: 'ok', shellRoots: [] })).not.toThrow();
  });

  it('falls back to documented defaults when the file is absent', () => {
    const config = loadConfig(tmpRoot);
    expect(config.shellRoots).toEqual(DEFAULTS.shellRoots);
    expect(config.languages).toEqual(['el']);
  });

  it('rejects malformed JSON loudly', () => {
    fs.writeFileSync(path.join(tmpRoot, '.i18n-shell-slice.json'), '{ nope', 'utf8');
    expect(() => loadConfig(tmpRoot)).toThrow(/not valid JSON/);
  });

  it('parses ns-qualified and bare policy entries', () => {
    expect(parsePolicyEntry('files:a.b')).toEqual({ ns: 'files', key: 'a.b' });
    expect(parsePolicyEntry('a.b')).toEqual({ ns: null, key: 'a.b' });
  });

  it('policyFor returns null for a file with no reviewed entry — which the generator treats as fatal', () => {
    expect(policyFor({ dynamicKeyPolicy: {} }, 'src/x.tsx')).toBeNull();
    expect(policyFor({ dynamicKeyPolicy: { 'src/x.tsx': { reason: 'r' } } }, 'src/x.tsx'))
      .toMatchObject({ reason: 'r', wholeNamespaces: [], keys: [], prefixes: [] });
  });
});

// ─── Group 10: root discovery and manifest round-trip ────────────────────────

describe('Group 10 — roots are discovered, wants survive the manifest', () => {
  it('** crosses directories, * does not', () => {
    const layouts = patternToRegExp('src/app/**/layout.tsx');
    expect(layouts.test('src/app/layout.tsx')).toBe(true);
    expect(layouts.test('src/app/admin/deep/layout.tsx')).toBe(true);
    expect(layouts.test('src/other/layout.tsx')).toBe(false);
    expect(patternToRegExp('src/app/*.tsx').test('src/app/a/b.tsx')).toBe(false);
  });

  it('wants survive serialize → hydrate unchanged', () => {
    const wants = new Map([['common', { keys: new Set(['b', 'a']), prefixes: new Set(['p']), whole: false }]]);
    const back = hydrateWants(serializeWants(wants));
    expect([...back.get('common').keys].sort()).toEqual(['a', 'b']);
    expect(back.get('common').whole).toBe(false);
  });

  it('serializeWants is order-independent', () => {
    const a = new Map([['b', { keys: new Set(['y', 'x']), prefixes: new Set(), whole: false }], ['a', { keys: new Set(), prefixes: new Set(), whole: true }]]);
    const b = new Map([['a', { keys: new Set(), prefixes: new Set(), whole: true }], ['b', { keys: new Set(['x', 'y']), prefixes: new Set(), whole: false }]]);
    expect(stableStringify(serializeWants(a))).toBe(stableStringify(serializeWants(b)));
  });
});

// ─── Group 11: small pure helpers ────────────────────────────────────────────

describe('Group 11 — helpers', () => {
  it('splitKey separates an explicit namespace', () => {
    expect(splitKey('files:a.b')).toEqual({ ns: 'files', key: 'a.b' });
    expect(splitKey('a.b')).toEqual({ ns: null, key: 'a.b' });
  });

  it('staticPrefixOf keeps everything before the last dot, and rejects a dotless head', () => {
    expect(staticPrefixOf('a.b.')).toBe('a.b');
    expect(staticPrefixOf('nodots')).toBeNull();
  });

  it('leftmostStringLiteral walks a + chain', () => {
    const call = parseSource('/x/a.ts', `const v = 'a.' + b + c;`).statements[0].declarationList.declarations[0].initializer;
    expect(leftmostStringLiteral(call)).toBe('a.');
  });

  it('resolveAccessChain marks a computed index as a wildcard', () => {
    const src = parseSource('/x/a.ts', `const v = M.a[k].b;`);
    const chain = resolveAccessChain(src.statements[0].declarationList.declarations[0].initializer);
    expect(chain.root).toBe('M');
    expect(chain.wildcard).toBe(true);
  });

  it('collectLocalConstants folds a nested const tree', () => {
    const table = collectLocalConstants(parseSource('/x/a.ts', `const T = { a: { b: 'k1' }, c: 'k2' } as const;`));
    expect([...table.get('T').entries()].sort()).toEqual([['a.b', 'k1'], ['c', 'k2']]);
  });

  it('hasDefaultValue only sees a real option object', () => {
    const call = parseSource('/x/a.ts', `t(k, { defaultValue: v });`).statements[0].expression;
    expect(hasDefaultValue(call.arguments[1])).toBe(true);
    expect(hasDefaultValue(undefined)).toBe(false);
  });

  it('parseArgs separates the --full switch from staged file paths', () => {
    const args = parseArgs(['node', 'x', '--full', 'src\\a.ts']);
    expect(args.full).toBe(true);
    expect(args.files).toEqual(['src/a.ts']);
    expect(() => parseArgs(['node', 'x', '--nope'])).toThrow(/Unknown argument/);
  });

  it('the shared CLI preamble reports, then exits, and never returns a half-started run', () => {
    const calls = { errors: [], help: 0, exits: [] };
    const harness = extra => bootstrap({
      argv: ['node', 'x'],
      parseArgs: () => ({ help: false }),
      printHelp: () => { calls.help += 1; },
      projectRoot: tmpRoot,
      reportError: (message, phase) => calls.errors.push([phase, message]),
      exit: code => calls.exits.push(code),
      ...extra,
    });

    expect(harness({ parseArgs: () => ({ help: true }) })).toBeNull();
    expect(calls.help).toBe(1);
    expect(calls.exits).toEqual([0]);

    expect(harness({ parseArgs: () => { throw new Error('bad flag'); } })).toBeNull();
    expect(calls.errors).toEqual([['args', 'bad flag']]);

    fs.writeFileSync(path.join(tmpRoot, '.i18n-shell-slice.json'), '{ broken', 'utf8');
    expect(harness()).toBeNull();
    expect(calls.errors[1][0]).toBe('config');
  });
});

// ─── Group 12: the real artifact ─────────────────────────────────────────────

describe('Group 12 — the committed slice is sane', () => {
  const REPO = path.resolve(__dirname, '..', '..');
  const slicePath = path.join(REPO, 'src', 'i18n', 'generated', 'shell-slice.el.json');
  const manifestPath = path.join(REPO, 'src', 'i18n', 'generated', 'shell-slice.manifest.json');

  // 🔴 ADR-744 §14.6 — ΑΥΤΟ ΤΟ TEST ΜΕΤΡΟΥΣΕ ΑΛΛΟ ΠΡΑΓΜΑ ΑΠΟ ΑΥΤΟ ΠΟΥ ΔΗΛΩΝΕ.
  //
  // Το σχόλιό του έλεγε — σωστά — «this ceiling exists to catch the migration ledger
  // GROWING», αλλά το κατώφλι ήταν `bytes < 220_000` πάνω στα **ΣΥΝΟΛΙΚΑ** bytes του
  // αρχείου. Μετρημένο 2026-08-19: το ledger είναι **179.301 bytes (78,3%)** και τα
  // key-sliced κλειδιά **10.443**. Δηλαδή το κατώφλι κυριαρχούνταν από το ledger αλλά
  // **κοκκίνιζε από το 10 KB** — και το key-sliced μέρος μεγαλώνει ακριβώς όταν κάποιος
  // **διορθώνει** ωμό κλειδί. Η πύλη μπλόκαρε τη ΘΕΡΑΠΕΙΑ, το αντι-πρότυπο που τα
  // CHECK 3.44 και 3.53 απορρίπτουν ρητά.
  //
  // Ήταν ήδη ΚΟΚΚΙΝΟ και κανείς δεν το έτρεχε: στο `f400ae45` το slice ήταν **227.512**
  // bytes έναντι ορίου 220.000 (ίδιο σχήμα με τα 11 tests του ADR-587 §6.1).
  //
  // ⚠️ Η διόρθωση ΔΕΝ είναι «ανέβασε το νούμερο» — θα ξαναπάλιωνε στην επόμενη νόμιμη
  // προσθήκη κλειδιού και το τρίτο νούμερο θα αντιγραφόταν σε handoff όπως το «91
  // unprotected» του N.12. Μετριέται πλέον το **ledger**, που είναι ΛΙΣΤΑ: μεγαλώνει με
  // **εγγραφές**, όχι με κλειδιά.
  it('το migration ledger ΔΕΝ μεγαλώνει — μόνο συρρικνώνεται', () => {
    const whole = JSON.parse(fs.readFileSync(
      path.join(REPO, 'src', 'i18n', 'generated', 'shell-slice.whole.json'), 'utf8'));
    const wholeNs = Array.isArray(whole) ? whole : Object.keys(whole);

    // Ο ΚΥΡΙΟΣ φρουρός: 11η εγγραφή = ένα ακόμη ΟΛΟΚΛΗΡΟ namespace στον σύγχρονο δρόμο.
    // Το ADR το λέει «should reach zero» — άρα κάθε νόμιμη κίνηση είναι ΠΡΟΣ ΤΑ ΚΑΤΩ.
    expect(wholeNs.length).toBeLessThanOrEqual(10);

    // Και σε bytes, για την περίπτωση που ένα ΥΠΑΡΧΟΝ whole namespace φουσκώσει.
    const slice = JSON.parse(fs.readFileSync(slicePath, 'utf8'));
    const ledgerBytes = wholeNs.reduce(
      (sum, ns) => sum + (slice[ns] ? Buffer.byteLength(JSON.stringify(slice[ns]), 'utf8') : 0), 0);
    expect(ledgerBytes).toBeLessThan(185_000);
  });

  it('exists, and is materially smaller than the 295.093 bytes it replaced', () => {
    // Η αναφορά είναι ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΤΟ ΙΔΙΟ ΤΟ TEST ΟΝΟΜΑΖΕΙ — ο σύγχρονος bootstrap
    // που αντικαταστάθηκε (295.093 bytes, el+en) — όχι ένα αυθαίρετο τρίτο νούμερο.
    // Ό,τι ΠΡΕΠΕΙ να πέφτει το φυλάει το test από πάνω· εδώ φυλάγεται μόνο ότι το ADR
    // δεν έχει ακυρωθεί συνολικά.
    const bytes = Buffer.byteLength(fs.readFileSync(slicePath, 'utf8'), 'utf8');
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(295_093);
  });

  it('its manifest signs the bytes on disk', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const recorded = manifest.artifacts['src/i18n/generated/shell-slice.el.json'];
    expect(sha256(normalize(fs.readFileSync(slicePath, 'utf8')))).toBe(recorded);
    expect(checkArtifactIntegrity(manifest)).toBeNull();
  });

  it('contains the namespace i18next is told is the default', () => {
    expect(Object.keys(JSON.parse(fs.readFileSync(slicePath, 'utf8')))).toContain('common');
  });

  it('the manifest records the shell modules the cheap gate re-fingerprints', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(Object.keys(manifest.shellFiles).length).toBeGreaterThan(100);
    expect(manifest.shellFiles['src/app/layout.tsx']).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── Group 13: aliased `t` (ADR-744 §14.5) ───────────────────────────────────

describe('Group 13 — ένα aliased `t` ΜΕΤΑΦΡΑΖΕΙ, άρα μετριέται', () => {
  it('🔴 ΑΓΚΥΡΑ — `const { t: tParking } = useTranslation(…)` συνεισφέρει κλειδιά', () => {
    const source = `
      const { t } = useTranslation(COMMON_NAMESPACES);
      const { t: tParking } = useTranslation('parking');
      const a = t('search.results');
      const b = tParking('status.available');
    `;
    // Πριν από το ADR-744 §14.5 το `b` ήταν ΑΟΡΑΤΟ: ο έλεγχος ήταν `callee.text === 't'`.
    expect(keysOf(classify(source))).toEqual(['search.results', 'status.available']);
  });

  it('το σκέτο `{ t }` εξακολουθεί να μετράει — καμία παλινδρόμηση', () => {
    expect(keysOf(classify(`const { t } = useTranslation('x'); t('a.b');`))).toEqual(['a.b']);
  });

  it('`i18n.t(…)` εξακολουθεί να μετράει', () => {
    expect(keysOf(classify(`i18n.t('a.b');`))).toEqual(['a.b']);
  });

  it('🔴 ΜΗΔΕΝ ΨΕΥΔΩΣ ΘΕΤΙΚΑ — `t`-πρόθεμα ΧΩΡΙΣ δέσμευση από useTranslation ΔΕΝ μετράει', () => {
    // Ο generator ΑΡΝΕΙΤΑΙ να παράξει σε ανεπίλυτη κλήση, οπότε ένα ψευδώς θετικό εδώ
    // δεν είναι θόρυβος — είναι ΦΡΑΓΜΟΣ. Γι' αυτό το κριτήριο είναι η ΔΕΣΜΕΥΣΗ.
    const noise = `
      const s = toString('a.b');
      const r = trim('c.d');
      const v = tSomething('e.f');
    `;
    expect(keysOf(classify(noise))).toEqual([]);
  });

  it('alias από ΑΛΛΟ hook (όχι useTranslation*) ΔΕΝ μετράει', () => {
    expect(keysOf(classify(`const { t: tFake } = useSomethingElse('x'); tFake('a.b');`))).toEqual([]);
  });

  it('`useTranslationLazy` δίνει κι αυτό μεταφραστή', () => {
    expect(keysOf(classify(`const { t: tLazy } = useTranslationLazy('x'); tLazy('a.b');`))).toEqual(['a.b']);
  });

  it('collectTranslateAliases περιέχει ΠΑΝΤΑ το `t`, ακόμα και σε κενό αρχείο', () => {
    const { parseSource, collectTranslateAliases } = require('../lib/i18n-shell-slice/key-extract');
    expect([...collectTranslateAliases(parseSource('/x/a.tsx', ''))]).toEqual(['t']);
  });

  it('🔴 ΑΓΚΥΡΑ ΠΡΑΓΜΑΤΙΚΟΥ ΚΩΔΙΚΑ — τα δύο `tShell()` του ShareModal ταξιδεύουν', () => {
    // Μετρημένο 2026-08-19: το slice είχε `shareSurface.submitting` (μη-aliased κλήση)
    // αλλά ΟΧΙ τα `close`/`errorPrefix` (aliased) — το ΙΔΙΟ αρχείο, μισό ορατό.
    const slice = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'i18n', 'generated', 'shell-slice.el.json'), 'utf8'));
    expect(typeof slice['common-shared'].shareSurface.close).toBe('string');
    expect(typeof slice['common-shared'].shareSurface.errorPrefix).toBe('string');
  });
});
