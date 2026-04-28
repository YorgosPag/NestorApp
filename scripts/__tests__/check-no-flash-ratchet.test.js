/**
 * Golden tests for CHECK 3.25 — No-Navigation-Flash Ratchet
 *
 * Two concerns (mirrors `registry-golden-regex.test.js` pattern):
 *
 *   1. Pattern semantics — for each detector A/B/C, a hand-crafted
 *      `shouldMatch` fixture must trigger the regex AND a `shouldSkip`
 *      fixture (compliant code) must NOT trigger it.
 *
 *   2. Scanner mechanics — file scope, allowlist, baseline ratchet
 *      (new file zero-tol, existing same/lower OK, existing more BLOCK),
 *      CLI flag handling, in-process exit codes via run().
 *
 * Fixtures inline (under ~30 LOC each) — single-file review surface.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'check-no-flash-ratchet.js');
const scanner = require(SCRIPT_PATH);

// =============================================================================
// Fixtures
// =============================================================================

const HOOK_MATCH_NO_CACHE = `'use client';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { Foo } from '@/types/foo';

export function useFoos() {
  const { data, loading } = useAsyncData<Foo[]>({
    fetcher: () => fetch('/api/foos').then(r => r.json()),
    deps: [],
    initialData: [],
  });
  return { foos: data ?? [], loading };
}`;

const HOOK_SKIP_FULL_CACHE = `'use client';
import { useAsyncData } from '@/hooks/useAsyncData';
import { createStaleCache } from '@/lib/stale-cache';
import type { Foo } from '@/types/foo';

const fooCache = createStaleCache<Foo[]>('foos');

export function useFoos() {
  const { data, loading } = useAsyncData<Foo[]>({
    fetcher: async () => { const r = await fetch('/api/foos'); const j = await r.json(); fooCache.set(j); return j; },
    deps: [],
    initialData: fooCache.get() ?? [],
    silentInitialFetch: fooCache.hasLoaded(),
  });
  return { foos: data ?? [], loading };
}`;

const HOOK_SKIP_NON_ARRAY = `'use client';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { Foo } from '@/types/foo';

export function useFoo(id: string) {
  const { data, loading } = useAsyncData<Foo | null>({
    fetcher: () => fetch(\`/api/foos/\${id}\`).then(r => r.json()),
    deps: [id],
    initialData: null,
  });
  return { foo: data, loading };
}`;

const PAGE_MATCH_NS_GUARD = `'use client';
import { Loader2 } from 'lucide-react';

export function FoosPageContent() {
  const isNamespaceReady = true;
  if (!isNamespaceReady) {
    return <div><Loader2 className="animate-spin" /></div>;
  }
  return <main>list</main>;
}`;

const PAGE_MATCH_BARE_LOADING = `'use client';
import { Loader2 } from 'lucide-react';

export function FoosPageContent() {
  const loading = true;
  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin" />;
  }
  return <main>list</main>;
}`;

const PAGE_SKIP_CANONICAL = `'use client';
import { PageLoadingState } from '@/core/states';
import { FileText } from 'lucide-react';

export function FoosPageContent() {
  const data: any[] = [];
  const loading = true;
  if (loading && data.length === 0) {
    return <PageLoadingState icon={FileText} message="loading" />;
  }
  return <main>list</main>;
}`;

const PAGE_SKIP_BOTH_PATTERNS = `'use client';
export function FoosPageContent() {
  return <main>nothing fancy</main>;
}`;

// =============================================================================
// Group 1 — Pattern A semantics
// =============================================================================

describe('Pattern A — useAsyncData<T[]> without ADR-300 stale-cache', () => {
  it('matches a hook with bare useAsyncData<Foo[]> and no cache', () => {
    const v = scanner.findHookViolations(HOOK_MATCH_NO_CACHE);
    expect(v).toHaveLength(1);
    expect(v[0].kind).toBe('pattern-A-stale-cache-missing');
    expect(v[0].line).toBeGreaterThan(0);
  });

  it('skips a hook with full ADR-300 wiring (cache import + silentInitialFetch)', () => {
    expect(scanner.findHookViolations(HOOK_SKIP_FULL_CACHE)).toEqual([]);
  });

  it('skips a hook fetching a non-array (single record)', () => {
    expect(scanner.findHookViolations(HOOK_SKIP_NON_ARRAY)).toEqual([]);
  });

  it('matches when cache is imported but silentInitialFetch missing', () => {
    const partial = HOOK_SKIP_FULL_CACHE.replace(
      'silentInitialFetch: fooCache.hasLoaded(),',
      ''
    );
    expect(scanner.findHookViolations(partial)).toHaveLength(1);
  });

  it('matches when silentInitialFetch present but cache import missing', () => {
    const partial = HOOK_MATCH_NO_CACHE.replace(
      'initialData: [],',
      'initialData: [], silentInitialFetch: true,'
    );
    expect(scanner.findHookViolations(partial)).toHaveLength(1);
  });

  it('handles dotted generic types (useAsyncData<MyNs.Foo[]>)', () => {
    const src = HOOK_MATCH_NO_CACHE.replace(
      'useAsyncData<Foo[]>',
      'useAsyncData<MyNs.Foo[]>'
    );
    expect(scanner.findHookViolations(src)).toHaveLength(1);
  });

  it('regex matches the array-generic shape but not the non-array', () => {
    expect(scanner.RE_USE_ASYNC_DATA_ARRAY.test('useAsyncData<Foo[]>')).toBe(true);
    expect(scanner.RE_USE_ASYNC_DATA_ARRAY.test('useAsyncData<Foo>')).toBe(false);
    expect(scanner.RE_USE_ASYNC_DATA_ARRAY.test('useAsyncData<Foo | null>')).toBe(false);
  });
});

// =============================================================================
// Group 2 — Pattern B semantics
// =============================================================================

describe('Pattern B — !isNamespaceReady early-return', () => {
  it('matches the canonical guard form', () => {
    const v = scanner.findPageContentViolations(PAGE_MATCH_NS_GUARD);
    expect(v.find((x) => x.kind === 'pattern-B-namespace-ready-guard')).toBeTruthy();
  });

  it('skips PageContent without the guard', () => {
    const v = scanner.findPageContentViolations(PAGE_SKIP_BOTH_PATTERNS);
    expect(v.find((x) => x.kind === 'pattern-B-namespace-ready-guard')).toBeFalsy();
  });

  it('skips PageContent with the canonical loading + length guard', () => {
    const v = scanner.findPageContentViolations(PAGE_SKIP_CANONICAL);
    expect(v.find((x) => x.kind === 'pattern-B-namespace-ready-guard')).toBeFalsy();
  });

  it('matches with whitespace variations', () => {
    const src = `if(   !isNamespaceReady   ){\n  return <div/>;\n}`;
    expect(scanner.RE_NAMESPACE_READY_GUARD.test(src)).toBe(true);
  });

  it('does not match isNamespaceReady (without negation)', () => {
    const src = `if (isNamespaceReady) { return <div/>; }`;
    expect(scanner.RE_NAMESPACE_READY_GUARD.test(src)).toBe(false);
  });
});

// =============================================================================
// Group 3 — Pattern C semantics
// =============================================================================

describe('Pattern C — bare if (loading) → <Loader2>', () => {
  it('matches bare if (loading) returning Loader2', () => {
    const v = scanner.findPageContentViolations(PAGE_MATCH_BARE_LOADING);
    expect(v.find((x) => x.kind === 'pattern-C-bare-loading-loader2')).toBeTruthy();
  });

  it('skips canonical (loading && data.length === 0) + PageLoadingState', () => {
    const v = scanner.findPageContentViolations(PAGE_SKIP_CANONICAL);
    expect(v.find((x) => x.kind === 'pattern-C-bare-loading-loader2')).toBeFalsy();
  });

  it('does not match if (loading && X)', () => {
    const src = `if (loading && data.length === 0) { return <Loader2 />; }`;
    expect(scanner.RE_BARE_LOADING_LOADER2.test(src)).toBe(false);
  });

  it('does not match without Loader2 in body', () => {
    const src = `if (loading) { return null; }`;
    expect(scanner.RE_BARE_LOADING_LOADER2.test(src)).toBe(false);
  });

  it('matches across newline-separated body', () => {
    const src = `if (loading) {\n  console.log('x');\n  return <Loader2 />;\n}`;
    expect(scanner.RE_BARE_LOADING_LOADER2.test(src)).toBe(true);
  });
});

// =============================================================================
// Group 4 — File scope (path matchers)
// =============================================================================

describe('File scope — isHookFile / isPageContentFile', () => {
  it.each([
    ['src/hooks/useFoo.ts', true],
    ['src/hooks/procurement/useFoo.ts', true],
    ['src/subapps/procurement/hooks/useFoo.ts', true],
    ['src/subapps/procurement/hooks/nested/useFoo.ts', true],
  ])('%s → isHookFile=%s', (p, expected) => {
    expect(scanner.isHookFile(p)).toBe(expected);
  });

  it.each([
    ['src/lib/stale-cache.ts', false],
    ['src/components/foo/Foo.tsx', false],
    ['src/hooks/useFoo.tsx', false],
    ['src/hooks/__tests__/useFoo.ts', false],
    ['src/subapps/foo/hooks/__tests__/useBar.ts', false],
  ])('%s → isHookFile=%s', (p, expected) => {
    expect(scanner.isHookFile(p)).toBe(expected);
  });

  it.each([
    ['src/components/foo/pages/FooPageContent.tsx', true],
    ['src/components/admin/role-management/pages/RoleManagementPageContent.tsx', true],
    ['src/subapps/procurement/components/pages/QuotesPageContent.tsx', true],
    ['src/subapps/foo/components/admin/pages/BarPageContent.tsx', true],
  ])('%s → isPageContentFile=%s', (p, expected) => {
    expect(scanner.isPageContentFile(p)).toBe(expected);
  });

  it.each([
    ['src/components/foo/pages/FooPage.tsx', false],
    ['src/components/foo/FooPageContent.tsx', false],
    ['src/components/foo/pages/__tests__/FooPageContent.tsx', false],
  ])('%s → isPageContentFile=%s', (p, expected) => {
    expect(scanner.isPageContentFile(p)).toBe(expected);
  });

  it('normalizes Windows-style backslashes', () => {
    expect(scanner.isHookFile('src\\hooks\\useFoo.ts')).toBe(true);
    expect(scanner.isPageContentFile('src\\components\\foo\\pages\\FooPageContent.tsx')).toBe(true);
  });
});

// =============================================================================
// Group 5 — Allowlist
// =============================================================================

describe('Allowlist', () => {
  it.each([
    'src/lib/stale-cache.ts',
    'src/hooks/useAsyncData.ts',
    'src/hooks/__tests__/useFoo.ts',
    'src/subapps/dxf-viewer/hooks/useGrid.ts',
  ])('%s is allowlisted', (p) => {
    expect(scanner.isAllowlisted(p)).toBe(true);
  });

  it.each([
    'src/hooks/useFoo.ts',
    'src/subapps/procurement/hooks/useQuotes.ts',
    'src/components/foo/pages/FooPageContent.tsx',
  ])('%s is NOT allowlisted', (p) => {
    expect(scanner.isAllowlisted(p)).toBe(false);
  });
});

// =============================================================================
// Group 6 — Baseline ratchet (in-process via tmp dir)
// =============================================================================

describe('Baseline ratchet semantics', () => {
  let tmpRoot;
  let savedCwd;
  let savedBaselineEnv;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'no-flash-test-'));
    fs.mkdirSync(path.join(tmpRoot, 'src', 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'src', 'components', 'foo', 'pages'), {
      recursive: true,
    });
    savedCwd = process.cwd();
    process.chdir(tmpRoot);
    savedBaselineEnv = process.env.NO_FLASH_BASELINE_FILE;
    process.env.NO_FLASH_BASELINE_FILE = path.join(tmpRoot, '.no-flash-baseline.json');
    // module reload so BASELINE_FILE picks env var
    delete require.cache[SCRIPT_PATH];
  });
  afterEach(() => {
    process.chdir(savedCwd);
    if (savedBaselineEnv === undefined) delete process.env.NO_FLASH_BASELINE_FILE;
    else process.env.NO_FLASH_BASELINE_FILE = savedBaselineEnv;
    delete require.cache[SCRIPT_PATH];
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  function fresh() {
    return require(SCRIPT_PATH);
  }

  it('--write-baseline emits empty baseline when src is clean', () => {
    fs.writeFileSync(
      path.join(tmpRoot, 'src', 'hooks', 'useFoo.ts'),
      HOOK_SKIP_FULL_CACHE
    );
    const code = fresh().run(['node', 'script', '--write-baseline']);
    expect(code).toBe(0);
    const baseline = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, '.no-flash-baseline.json'), 'utf8')
    );
    expect(baseline._meta.totalViolations).toBe(0);
    expect(baseline.files).toEqual({});
  });

  it('--write-baseline records violations from current tree', () => {
    fs.writeFileSync(
      path.join(tmpRoot, 'src', 'hooks', 'useFoo.ts'),
      HOOK_MATCH_NO_CACHE
    );
    const code = fresh().run(['node', 'script', '--write-baseline']);
    expect(code).toBe(0);
    const baseline = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, '.no-flash-baseline.json'), 'utf8')
    );
    expect(baseline._meta.totalViolations).toBe(1);
    expect(baseline.files['src/hooks/useFoo.ts']).toBe(1);
  });

  it('blocks a NEW file with violations (zero tolerance)', () => {
    fs.writeFileSync(
      path.join(tmpRoot, '.no-flash-baseline.json'),
      JSON.stringify({ _meta: {}, files: {} }) + '\n'
    );
    fs.writeFileSync(
      path.join(tmpRoot, 'src', 'hooks', 'useFoo.ts'),
      HOOK_MATCH_NO_CACHE
    );
    const code = fresh().run(['node', 'script', 'src/hooks/useFoo.ts']);
    expect(code).toBe(1);
  });

  it('passes when count equals baseline', () => {
    fs.writeFileSync(
      path.join(tmpRoot, 'src', 'hooks', 'useFoo.ts'),
      HOOK_MATCH_NO_CACHE
    );
    fs.writeFileSync(
      path.join(tmpRoot, '.no-flash-baseline.json'),
      JSON.stringify({ _meta: {}, files: { 'src/hooks/useFoo.ts': 1 } }) + '\n'
    );
    const code = fresh().run(['node', 'script', 'src/hooks/useFoo.ts']);
    expect(code).toBe(0);
  });

  it('passes (and reports improvement) when count drops below baseline', () => {
    fs.writeFileSync(
      path.join(tmpRoot, 'src', 'hooks', 'useFoo.ts'),
      HOOK_SKIP_FULL_CACHE
    );
    fs.writeFileSync(
      path.join(tmpRoot, '.no-flash-baseline.json'),
      JSON.stringify({ _meta: {}, files: { 'src/hooks/useFoo.ts': 1 } }) + '\n'
    );
    const code = fresh().run(['node', 'script', 'src/hooks/useFoo.ts']);
    expect(code).toBe(0);
  });

  it('counts one Pattern-A violation per file regardless of repetitions', () => {
    // Pattern A is a file-level rule — wiring the cache fixes all hits at once.
    // Doubling the trigger should NOT inflate the count vs baseline.
    const doubled = `${HOOK_MATCH_NO_CACHE}\n\n${HOOK_MATCH_NO_CACHE.replace('useFoos', 'useBars')}`;
    fs.writeFileSync(path.join(tmpRoot, 'src', 'hooks', 'useFoo.ts'), doubled);
    fs.writeFileSync(
      path.join(tmpRoot, '.no-flash-baseline.json'),
      JSON.stringify({ _meta: {}, files: { 'src/hooks/useFoo.ts': 1 } }) + '\n'
    );
    const code = fresh().run(['node', 'script', 'src/hooks/useFoo.ts']);
    expect(code).toBe(0);
  });

  it('blocks when PageContent gains BOTH B+C while baseline had just one', () => {
    fs.mkdirSync(path.join(tmpRoot, 'src', 'components', 'foo', 'pages'), {
      recursive: true,
    });
    const both = PAGE_MATCH_NS_GUARD.replace(
      'return <main>list</main>;',
      'if (loading) { return <Loader2 />; }\n  return <main>list</main>;'
    );
    fs.writeFileSync(
      path.join(tmpRoot, 'src', 'components', 'foo', 'pages', 'FooPageContent.tsx'),
      both
    );
    fs.writeFileSync(
      path.join(tmpRoot, '.no-flash-baseline.json'),
      JSON.stringify({
        _meta: {},
        files: { 'src/components/foo/pages/FooPageContent.tsx': 1 },
      }) + '\n'
    );
    const code = fresh().run([
      'node',
      'script',
      'src/components/foo/pages/FooPageContent.tsx',
    ]);
    expect(code).toBe(1);
  });

  it('returns 0 with no in-scope files', () => {
    const code = fresh().run(['node', 'script']);
    expect(code).toBe(0);
  });

  it('skips out-of-scope files passed explicitly', () => {
    fs.writeFileSync(path.join(tmpRoot, 'src', 'foo.ts'), HOOK_MATCH_NO_CACHE);
    const code = fresh().run(['node', 'script', 'src/foo.ts']);
    expect(code).toBe(0);
  });
});

// =============================================================================
// Group 7 — CLI parseArgs
// =============================================================================

describe('parseArgs', () => {
  it('detects --all flag', () => {
    expect(scanner.parseArgs(['n', 's', '--all']).scanAll).toBe(true);
  });
  it('detects --write-baseline flag', () => {
    expect(scanner.parseArgs(['n', 's', '--write-baseline']).writeBaseline).toBe(true);
  });
  it('returns args without flags', () => {
    expect(scanner.parseArgs(['n', 's', 'a.ts', '--all', 'b.ts']).args).toEqual([
      'a.ts',
      '--all',
      'b.ts',
    ]);
  });
});
