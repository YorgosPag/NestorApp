/**
 * CHECK 3.30 — barrel-aware dead-export gate (ADR-364 §10.9).
 *
 * Fixtures are in-memory module graphs, not files on disk: the gate's whole
 * job is graph reasoning, and a gate whose own reasoning is untested is exactly
 * the "anchor without a gate is a comment" failure of ADR-587 §6.1.
 *
 * The §10.7 scenario (a consumer, a barrel, and a dead island of two hooks) is
 * pinned as a regression test at the bottom: that is the shape knip 6.6.2
 * scored 1/4 on, and the reason this gate exists.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  toPosix, resolveSpecifier, readTsPathAliases,
} = require('../lib/module-graph/resolve-specifier');
const { parseModule, detectPureBarrel } = require('../lib/module-graph/parse-module');
const { buildGraph, computeLiveness, occursInLiveModule, usageKey } = require('../lib/module-graph/build-graph');
const { classifyExports } = require('../lib/module-graph/classify-exports');
const { isEntryFile, isIgnored } = require('../lib/module-graph/scan-config');
const { compareSets } = require('../lib/ratchet-baseline');
const {
  parseCliArgs, runSmoke, REQUIRED_BASELINE_KEYS, PROJECT_ROOT,
} = require('../check-barrel-deadcode-ratchet');

// Anchored through path.resolve so the fixture paths match what the resolver
// produces on Windows ('C:/repo') and on POSIX ('/repo') alike.
const ROOT = toPosix(path.resolve('/repo'));
const at = rel => `${ROOT}/${rel}`;

function analyseFixture(fileMap, { entries = [], scope = 'src', aliases = [] } = {}) {
  const files = Object.keys(fileMap);
  const graph = buildGraph({ projectRoot: ROOT, aliases, files, readFile: f => fileMap[f] });
  const isEntry = f => entries.map(at).includes(f);
  const live = computeLiveness(graph, { isEntry });
  const withTests = computeLiveness(graph, { isEntry, withTests: true });
  const inScope = f => !/(\.test\.|__tests__)/.test(f) && f.startsWith(at(scope));
  const result = classifyExports(graph, live, withTests, { inScope });

  const bucketOf = (rel, name) => {
    for (const bucket of ['dead', 'unusedExport', 'suspect', 'testOnly', 'live']) {
      if (result[bucket].some(e => e.file === at(rel) && e.name === name)) return bucket;
    }
    return 'not-reported';
  };
  return { graph, live, withTests, result, bucketOf, deadFiles: result.deadFiles.map(f => f.slice(ROOT.length + 1)) };
}

describe('resolve-specifier', () => {
  const fileSet = new Set([
    at('src/a.ts'), at('src/ui/Button.tsx'), at('src/ui/index.ts'), at('src/subapps/dxf-viewer/systems/s.ts'),
  ]);
  const ctx = {
    projectRoot: ROOT,
    fileSet,
    aliases: [
      { prefix: '@/systems/', wildcard: true, targets: [{ prefix: './src/subapps/dxf-viewer/systems/', wildcard: true }] },
      { prefix: '@/', wildcard: true, targets: [{ prefix: './src/', wildcard: true }] },
    ],
  };

  it('resolves a relative specifier to its .ts file', () => {
    expect(resolveSpecifier('../a', at('src/ui/Button.tsx'), ctx)).toEqual({ kind: 'internal', file: at('src/a.ts') });
  });

  it('prefers a .tsx sibling over a directory index', () => {
    expect(resolveSpecifier('./ui/Button', at('src/a.ts'), ctx).file).toBe(at('src/ui/Button.tsx'));
  });

  it('falls back to a directory index', () => {
    expect(resolveSpecifier('./ui', at('src/a.ts'), ctx).file).toBe(at('src/ui/index.ts'));
  });

  it('maps an ESM .js specifier back onto the .ts source', () => {
    expect(resolveSpecifier('../a.js', at('src/ui/index.ts'), ctx).file).toBe(at('src/a.ts'));
  });

  it('honours the LONGEST matching alias, not the first', () => {
    // `@/systems/*` and `@/*` both match; picking `@/*` would resolve to
    // src/systems/s.ts, which does not exist.
    expect(resolveSpecifier('@/systems/s', at('src/a.ts'), ctx).file).toBe(at('src/subapps/dxf-viewer/systems/s.ts'));
  });

  it('classifies a bare package as external', () => {
    expect(resolveSpecifier('react', at('src/a.ts'), ctx)).toEqual({ kind: 'external' });
  });

  it('reports an unresolvable relative import instead of silently dropping it', () => {
    expect(resolveSpecifier('./nope', at('src/a.ts'), ctx)).toEqual({ kind: 'unresolved' });
  });

  it('reads the real tsconfig.base.json alias table', () => {
    const aliases = readTsPathAliases(toPosix(path.resolve(__dirname, '..', '..')));
    expect(aliases.some(a => a.prefix === '@/')).toBe(true);
    expect(aliases[0].prefix.length).toBeGreaterThanOrEqual(aliases[aliases.length - 1].prefix.length);
  });
});

describe('parse-module', () => {
  const parse = (name, src) => parseModule(at(name), src);

  it('detects a pure barrel', () => {
    const mod = parse('src/hooks/index.ts', "export * from './useFoo';\nexport { b } from './b';\n");
    expect(mod.isBarrel).toBe(true);
  });

  it('does NOT treat an index.ts containing real code as a barrel', () => {
    const mod = parse('src/hooks/index.ts', "import { a } from './a';\nexport const x = a + 1;\n");
    expect(mod.isBarrel).toBe(false);
  });

  it('captures every export form', () => {
    const mod = parse('src/x.ts', [
      'export function fn() {}',
      'export const c = 1;',
      'export class K {}',
      'export interface I { a: number }',
      'export type T = number;',
      'export enum E { A }',
      'const local = 2;',
      'export { local as aliased };',
    ].join('\n'));
    const names = mod.exports.filter(e => e.origin === 'local').map(e => e.name).sort();
    expect(names).toEqual(['K', 'E', 'I', 'T', 'aliased', 'c', 'fn'].sort());
  });

  it('records the WRITTEN name of a default export, not just "default"', () => {
    const mod = parse('src/x.tsx', 'function Panel() { return null; }\nexport default Panel;\n');
    const def = mod.exports.find(e => e.name === 'default');
    expect(def.localName).toBe('Panel');
  });

  it('ignores identifiers that only appear in comments', () => {
    // The Floating3DPanel lesson: grep finds prose, the AST does not.
    const mod = parse('src/x.ts', '// Ghost is mentioned here\n/** and here: Ghost */\nexport const y = 1;\n');
    expect(mod.identifiers.has('Ghost')).toBe(false);
  });

  it('counts local uses so a redundant export is not mistaken for dead code', () => {
    const mod = parse('src/x.ts', 'export interface Opts { a: number }\nexport function f(o: Opts) { return o.a; }\n');
    expect(mod.exports.find(e => e.name === 'Opts').localUses).toBe(2);
    expect(mod.exports.find(e => e.name === 'f').localUses).toBe(1);
  });

  it('records dynamic imports', () => {
    const mod = parse('src/x.ts', "export const load = () => import('./heavy');\n");
    expect(mod.imports).toContainEqual({ spec: './heavy', kind: 'dynamic', names: [] });
  });

  it('attributes a pass-through re-export to the DECLARING module', () => {
    const mod = parse('src/hooks/index.ts', "import { useFoo } from './useFoo';\nexport { useFoo };\n");
    expect(mod.exports.find(e => e.name === 'useFoo').origin).toBe('reexport');
    expect(mod.imports).toHaveLength(0); // a barrel forwards; it does not consume
  });

  it('keeps the import as consumption when the re-exporting file is not a barrel', () => {
    const mod = parse('src/util.ts', "import { useFoo } from './useFoo';\nexport { useFoo };\nexport const z = 1;\n");
    expect(mod.exports.find(e => e.name === 'useFoo').origin).toBe('reexport');
    expect(mod.imports).toHaveLength(1);
  });

  it('detectPureBarrel only ever accepts an index file', () => {
    const mod = parse('src/re-exports.ts', "export * from './a';\n");
    expect(mod.isBarrel).toBe(false);
    expect(detectPureBarrel(at('src/notindex.ts'), { statements: [] })).toBe(false);
  });
});

describe('liveness — the barrel question', () => {
  it('calls a barrel-only export dead, and the same export live once imported directly', () => {
    const base = {
      [at('src/hooks/useFoo.ts')]: 'export function useFoo() { return 1; }\n',
      [at('src/hooks/index.ts')]: "export { useFoo } from './useFoo';\n",
      [at('src/app/page.tsx')]: 'export default function Page() { return null; }\n',
    };
    expect(analyseFixture(base, { entries: ['src/app/page.tsx'] }).bucketOf('src/hooks/useFoo.ts', 'useFoo')).toBe('dead');

    const wired = {
      ...base,
      [at('src/app/page.tsx')]: "import { useFoo } from '../hooks';\nexport default function Page() { return useFoo(); }\n",
    };
    expect(analyseFixture(wired, { entries: ['src/app/page.tsx'] }).bucketOf('src/hooks/useFoo.ts', 'useFoo')).toBe('live');
  });

  it('sees through a chain of barrels', () => {
    const files = {
      [at('src/deep/useFoo.ts')]: 'export function useFoo() { return 1; }\n',
      [at('src/deep/index.ts')]: "export * from './useFoo';\n",
      [at('src/index.ts')]: "export * from './deep';\n",
      [at('src/app/page.tsx')]: "import { useFoo } from '../index';\nexport default function Page() { return useFoo(); }\n",
    };
    expect(analyseFixture(files, { entries: ['src/app/page.tsx'] }).bucketOf('src/deep/useFoo.ts', 'useFoo')).toBe('live');
  });

  it('does not let a dead island keep itself alive', () => {
    // The measured §10.7 failure: useEntityDrag had exactly one importer, and
    // that importer was itself dead. "Has an importer" is not liveness.
    const files = {
      [at('src/hooks/useDrag.ts')]: 'export function useDrag() { return 1; }\n',
      [at('src/hooks/useMove.ts')]: "import { useDrag } from './useDrag';\nexport function useMove() { return useDrag(); }\n",
      [at('src/hooks/index.ts')]: "export * from './useDrag';\nexport * from './useMove';\n",
      [at('src/app/page.tsx')]: 'export default function Page() { return null; }\n',
    };
    const a = analyseFixture(files, { entries: ['src/app/page.tsx'] });
    expect(a.bucketOf('src/hooks/useDrag.ts', 'useDrag')).toBe('dead');
    expect(a.bucketOf('src/hooks/useMove.ts', 'useMove')).toBe('dead');
    expect(a.deadFiles).toEqual(expect.arrayContaining(['src/hooks/useDrag.ts', 'src/hooks/useMove.ts']));
  });

  it('treats a namespace import as opaque and keeps everything live', () => {
    const files = {
      [at('src/api.ts')]: 'export const a = 1;\nexport const b = 2;\n',
      [at('src/app/page.tsx')]: "import * as api from '../api';\nexport default function Page() { return api; }\n",
    };
    const a = analyseFixture(files, { entries: ['src/app/page.tsx'] });
    expect(a.bucketOf('src/api.ts', 'a')).toBe('live');
    expect(a.bucketOf('src/api.ts', 'b')).toBe('live');
  });

  it('treats a dynamic import as opaque', () => {
    const files = {
      [at('src/heavy.ts')]: 'export const heavy = 1;\n',
      [at('src/app/page.tsx')]: "export default function Page() { return import('../heavy'); }\n",
    };
    expect(analyseFixture(files, { entries: ['src/app/page.tsx'] }).bucketOf('src/heavy.ts', 'heavy')).toBe('live');
  });

  it('keeps a side-effect-imported module out of the dead-file list', () => {
    const files = {
      [at('src/register.ts')]: 'globalThis.x = 1;\n',
      [at('src/app/page.tsx')]: "import '../register';\nexport default function Page() { return null; }\n",
    };
    expect(analyseFixture(files, { entries: ['src/app/page.tsx'] }).deadFiles).not.toContain('src/register.ts');
  });

  it('does not crash on an unresolvable specifier', () => {
    const files = {
      [at('src/app/page.tsx')]: "import { x } from './missing';\nexport default function Page() { return x; }\n",
    };
    expect(() => analyseFixture(files, { entries: ['src/app/page.tsx'] })).not.toThrow();
  });
});

describe('classification buckets', () => {
  const page = 'export default function Page() { return null; }\n';

  it('separates test-only usage from real usage', () => {
    const files = {
      [at('src/x.ts')]: 'export const helper = 1;\n',
      [at('src/__tests__/x.test.ts')]: "import { helper } from '../x';\nexpect(helper).toBe(1);\n",
      [at('src/app/page.tsx')]: page,
    };
    expect(analyseFixture(files, { entries: ['src/app/page.tsx'] }).bucketOf('src/x.ts', 'helper')).toBe('testOnly');
  });

  it('downgrades to suspect when the name appears in a LIVE module', () => {
    const files = {
      [at('src/registry.ts')]: 'export const WIDGET_KEY = 1;\n',
      [at('src/app/page.tsx')]: 'const WIDGET_KEY = 2;\nexport default function Page() { return WIDGET_KEY; }\n',
    };
    expect(analyseFixture(files, { entries: ['src/app/page.tsx'] }).bucketOf('src/registry.ts', 'WIDGET_KEY')).toBe('suspect');
  });

  it('does NOT downgrade when the only other mention is inside a dead module', () => {
    const files = {
      [at('src/registry.ts')]: 'export const WIDGET_KEY = 1;\n',
      [at('src/orphan.ts')]: 'const WIDGET_KEY = 2;\nexport const orphan = WIDGET_KEY;\n',
      [at('src/app/page.tsx')]: page,
    };
    expect(analyseFixture(files, { entries: ['src/app/page.tsx'] }).bucketOf('src/registry.ts', 'WIDGET_KEY')).toBe('dead');
  });

  it('reports a redundant export of live code as unusedExport, not dead', () => {
    const files = {
      [at('src/x.ts')]: 'export interface Opts { a: number }\nexport function run(o: Opts) { return o.a; }\n',
      [at('src/app/page.tsx')]: "import { run } from '../x';\nexport default function Page() { return run({ a: 1 }); }\n",
    };
    expect(analyseFixture(files, { entries: ['src/app/page.tsx'] }).bucketOf('src/x.ts', 'Opts')).toBe('unusedExport');
  });

  it('calls the same shape dead when the whole module is unreachable', () => {
    const files = {
      [at('src/x.ts')]: 'export interface Opts { a: number }\nexport function run(o: Opts) { return o.a; }\n',
      [at('src/app/page.tsx')]: page,
    };
    const a = analyseFixture(files, { entries: ['src/app/page.tsx'] });
    expect(a.bucketOf('src/x.ts', 'Opts')).toBe('dead');
    expect(a.deadFiles).toContain('src/x.ts');
  });

  it('never reports the entry point itself as dead', () => {
    const a = analyseFixture({ [at('src/app/page.tsx')]: page }, { entries: ['src/app/page.tsx'] });
    expect(a.bucketOf('src/app/page.tsx', 'default')).toBe('live');
    expect(a.deadFiles).toEqual([]);
  });

  it('occursInLiveModule honours the overflow guard', () => {
    const owners = new Map([['wide', { files: [], overflow: true }]]);
    expect(occursInLiveModule(owners, 'wide', at('src/x.ts'), new Set())).toBe(true);
    expect(occursInLiveModule(new Map(), 'unknown', at('src/x.ts'), new Set())).toBe(false);
  });
});

describe('scan-config roots', () => {
  it.each([
    ['src/app/dashboard/page.tsx', true],
    ['src/app/api/dxf/route.ts', true],
    ['src/middleware.ts', true],
    ['src/subapps/dxf-viewer/workers/parse.worker.ts', true],
    ['src/subapps/dxf-viewer/hooks/index.ts', false],
    ['src/components/Button.tsx', false],
  ])('isEntryFile(%s) === %s', (file, expected) => {
    expect(isEntryFile(file)).toBe(expected);
  });

  it('excludes backup trees from the graph, not merely from the report', () => {
    expect(isIgnored('src/subapps/dxf-viewer-10-backup/x.ts')).toBe(true);
    expect(isIgnored('src/subapps/dxf-viewer/hooks/x.ts')).toBe(false);
  });
});

describe('ratchet plumbing', () => {
  it('compareSets reports identity changes, not just counts', () => {
    const diff = compareSets(['a#x', 'c#z'], ['a#x', 'b#y']);
    expect(diff.added).toEqual(['c#z']);
    expect(diff.removed).toEqual(['b#y']);
    expect(diff.currentCount).toBe(2);
    expect(diff.baselineCount).toBe(2);
  });

  it('a same-size swap is still a regression', () => {
    expect(compareSets(['b'], ['a']).added).toEqual(['b']);
  });

  it('parses the CLI surface', () => {
    const opts = parseCliArgs(['node', 'x', '--scope', 'src/services/', '--report', '--limit', '5']);
    expect(opts.scopes).toEqual(['src/services']);
    expect(opts.mode).toBe('report');
    expect(opts.limit).toBe(5);
  });

  it('defaults to the DXF viewer scope and a ratchet check', () => {
    const opts = parseCliArgs(['node', 'x']);
    expect(opts.scopes).toEqual(['src/subapps/dxf-viewer']);
    expect(opts.mode).toBe('check');
  });

  it('rejects an unknown flag instead of silently ignoring it', () => {
    expect(() => parseCliArgs(['node', 'x', '--baseline'])).toThrow(/needs a value/);
    expect(() => parseCliArgs(['node', 'x', '--save-baseline'])).toThrow(/Unknown argument/);
  });

  it('recognises --smoke as its own mode', () => {
    expect(parseCliArgs(['node', 'x', '--smoke']).mode).toBe('smoke');
  });
});

/**
 * Layer 1 (pre-commit) — ADR-364 §10.9.1. The hook must NOT pay for the ~30s
 * graph scan, so it runs `--smoke`, which only proves the baseline is there and
 * usable. These tests pin exactly that: the smoke reads a baseline, never a tree.
 */
describe('smoke mode (the pre-commit layer)', () => {
  let tmpDir;
  let logs;
  let errors;
  let logSpy;
  let errorSpy;

  const writeBaseline = (name, contents) => {
    const file = path.join(tmpDir, name);
    fs.writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents));
    return file;
  };

  const smoke = baselinePath => runSmoke(null, { baseline: baselinePath });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check330-'));
    logs = [];
    errors = [];
    logSpy = jest.spyOn(console, 'log').mockImplementation(m => logs.push(String(m)));
    errorSpy = jest.spyOn(console, 'error').mockImplementation(m => errors.push(String(m)));
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes on a well-formed baseline and reports the frozen counts', () => {
    const file = writeBaseline('ok.json', { deadExportCount: 1625, deadFileCount: 332, deadExports: [], deadFiles: [] });
    expect(smoke(file)).toBe(0);
    expect(logs.join('\n')).toMatch(/1625 dead exports \/ 332 dead files/);
  });

  it('fails when the baseline is missing — never reports a silent pass', () => {
    expect(smoke(path.join(tmpDir, 'absent.json'))).toBe(1);
    expect(errors.join('\n')).toMatch(/baseline missing/);
  });

  it('fails on unparseable JSON', () => {
    expect(smoke(writeBaseline('broken.json', '{ "deadExportCount": 1,'))).toBe(1);
    expect(errors.join('\n')).toMatch(/invalid JSON/);
  });

  // The trap this guards: a truncated baseline still parses, `deadExports || []`
  // reads as an empty set, and --check would report all 1.625 known entries as
  // brand-new regressions instead of naming the real fault.
  it('fails on a baseline that parses but lost its count fields', () => {
    expect(smoke(writeBaseline('truncated.json', { deadExports: [], deadFiles: [] }))).toBe(1);
    expect(errors.join('\n')).toMatch(/missing numeric field "deadExportCount"/);
  });

  it('fails when only half the required fields survived', () => {
    expect(smoke(writeBaseline('half.json', { deadExportCount: 3 }))).toBe(1);
    expect(errors.join('\n')).toMatch(/missing numeric field "deadFileCount"/);
  });

  it('points at the regeneration command rather than a raw node invocation', () => {
    smoke(path.join(tmpDir, 'absent.json'));
    expect(errors.join('\n')).toMatch(/npm run barrel-deadcode:baseline/);
  });

  // A gate whose own shipped baseline would fail its gate is not a gate.
  it('the committed baseline satisfies every required field', () => {
    const shipped = path.join(PROJECT_ROOT, '.barrel-deadcode-baseline.json');
    if (!fs.existsSync(shipped)) return; // not yet seeded in this checkout
    const parsed = JSON.parse(fs.readFileSync(shipped, 'utf8'));
    for (const key of REQUIRED_BASELINE_KEYS) expect(typeof parsed[key]).toBe('number');
    expect(Array.isArray(parsed.deadExports)).toBe(true);
    expect(Array.isArray(parsed.deadFiles)).toBe(true);
    expect(parsed.deadExports).toHaveLength(parsed.deadExportCount);
    expect(parsed.deadFiles).toHaveLength(parsed.deadFileCount);
  });
});

describe('ADR-364 §10.7 regression — the shape knip scored 1/4 on', () => {
  const files = {
    // Consumer reachable from the app.
    [at('src/app/page.tsx')]: "import { useKeep } from '../subapps/dxf-viewer/hooks';\nexport default function Page() { return useKeep(); }\n",
    // The barrel: forwards everything, consumes nothing.
    [at('src/subapps/dxf-viewer/hooks/index.ts')]: [
      "export * from './useKeep';",
      "export * from './useEntityDrag';",
      "export * from './useMovementOperations';",
    ].join('\n'),
    [at('src/subapps/dxf-viewer/hooks/useKeep.ts')]: 'export function useKeep() { return 1; }\n',
    // The dead island: one hook, and its only consumer, itself unreachable.
    [at('src/subapps/dxf-viewer/hooks/useEntityDrag.ts')]: 'export function useEntityDrag() { return 1; }\n',
    [at('src/subapps/dxf-viewer/hooks/useMovementOperations.ts')]:
      "import { useEntityDrag } from './useEntityDrag';\nexport function useMovementOperations() { return useEntityDrag(); }\n",
    // A hook option nobody ever switched on, declared beside live code.
    [at('src/subapps/dxf-viewer/core/useDrawingMachine.ts')]: [
      'export function useDrawingMachine() { return 1; }',
      'export function useDrawingKeyboardShortcuts() { return 2; }',
    ].join('\n'),
    [at('src/subapps/dxf-viewer/core/index.ts')]: "export * from './useDrawingMachine';\n",
    [at('src/subapps/dxf-viewer/app/host.tsx')]: "import { useDrawingMachine } from '../core';\nexport const host = () => useDrawingMachine();\n",
  };

  const analysis = analyseFixture(files, { entries: ['src/app/page.tsx'], scope: 'src/subapps/dxf-viewer' });

  it('finds the barrel-only dead island', () => {
    expect(analysis.bucketOf('src/subapps/dxf-viewer/hooks/useEntityDrag.ts', 'useEntityDrag')).toBe('dead');
    expect(analysis.bucketOf('src/subapps/dxf-viewer/hooks/useMovementOperations.ts', 'useMovementOperations')).toBe('dead');
  });

  it('finds the unused sibling of a live export in a reachable module', () => {
    expect(analysis.bucketOf('src/subapps/dxf-viewer/core/useDrawingMachine.ts', 'useDrawingKeyboardShortcuts')).toBe('dead');
  });

  it('keeps the genuinely used hook alive, barrel and all', () => {
    // host.tsx is unreachable, so useDrawingMachine is live only via… nothing.
    // useKeep is the one reached through the barrel from the page.
    expect(analysis.bucketOf('src/subapps/dxf-viewer/hooks/useKeep.ts', 'useKeep')).toBe('live');
  });

  it('never lists a barrel as dead code of its own', () => {
    const barrelExports = analysis.result.dead.filter(e => e.file.endsWith('/hooks/index.ts'));
    expect(barrelExports).toEqual([]);
  });

  it('marks the four unreachable modules as dead files', () => {
    expect(analysis.deadFiles).toEqual(expect.arrayContaining([
      'src/subapps/dxf-viewer/hooks/useEntityDrag.ts',
      'src/subapps/dxf-viewer/hooks/useMovementOperations.ts',
    ]));
  });

  it('exposes the usage key shape the explain path relies on', () => {
    expect(usageKey('a', 'b')).toBe('a b');
  });
});
