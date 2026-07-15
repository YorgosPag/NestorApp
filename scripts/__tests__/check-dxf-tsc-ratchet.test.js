/**
 * CHECK 3.29 — DXF Viewer TypeScript Error Ratchet: Jest test suite (ADR-663).
 *
 * Presubmit-grade tests for scripts/check-dxf-tsc-ratchet.js. Covers every pure
 * function (tsc-output parsing, per-file comparison, path normalisation), every
 * baseline I/O boundary, and the CLI legs that do NOT spawn tsc (smoke, --help,
 * arg parsing, bad baselines).
 *
 * Why we never spawn the real tsc here:
 *   A real type-check of the subapp is 40-90s and needs the whole tree present.
 *   Instead we unit-test the pure fns + I/O fns against tempdir fixtures and
 *   canned tsc output, and drive the no-tsc CLI legs via spawnSync with a
 *   DXF_TSC_BASELINE_FILE env override. The tsc-driven legs (runFull /
 *   writeBaseline) are exercised end-to-end by CI — mirrors
 *   scripts/__tests__/check-jscpd-ratchet.test.js.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_UNDER_TEST = path.resolve(__dirname, '..', 'check-dxf-tsc-ratchet.js');

const {
  parseArgs,
  parseErrors,
  normalizeFile,
  isTestFile,
  loadBaseline,
  writeBaseline,
  compare,
  getBaselineFile,
  getProject,
  DEFAULT_BASELINE_FILE,
  DEFAULT_PROJECT,
} = require(SCRIPT_UNDER_TEST);

let TMP_ROOT;
let tmpCounter = 0;
function nextTmpBaseline() {
  tmpCounter += 1;
  return path.join(TMP_ROOT, `baseline-${tmpCounter}-${process.pid}.json`);
}

beforeAll(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'dxf-tsc-ratchet-test-'));
});

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

// Real tsc output, verbatim in shape: two diagnostics plus the indented
// continuation lines tsc emits for nested type mismatches.
const SAMPLE_TSC_OUTPUT = [
  'npm info using npm@10.8.2',
  "src/subapps/dxf-viewer/utils/rotation-math.ts(79,13): error TS2339: Property 'corner1' does not exist.",
  "  Property 'corner1' does not exist on type 'Partial<EllipseEntity>'.",
  "src/subapps/dxf-viewer/utils/rotation-math.ts(80,13): error TS2339: Property 'corner2' does not exist.",
  "src/subapps/dxf-viewer/bim/__tests__/wall.test.ts(12,3): error TS2322: Type 'X' is not assignable.",
].join('\n');

describe('parseArgs', () => {
  const OLD_ENV = process.env.DXF_TSC_FULL;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.DXF_TSC_FULL;
    else process.env.DXF_TSC_FULL = OLD_ENV;
  });

  it('defaults to smoke mode (no flags set)', () => {
    expect(parseArgs(['node', 'script'])).toEqual({ full: false, writeBaseline: false, help: false });
  });

  it('parses --full, --write-baseline and --help', () => {
    expect(parseArgs(['node', 'x', '--full']).full).toBe(true);
    expect(parseArgs(['node', 'x', '--write-baseline']).writeBaseline).toBe(true);
    expect(parseArgs(['node', 'x', '--help']).help).toBe(true);
    expect(parseArgs(['node', 'x', '-h']).help).toBe(true);
  });

  it('throws on an unknown argument rather than silently ignoring it', () => {
    expect(() => parseArgs(['node', 'x', '--nope'])).toThrow(/Unknown argument: --nope/);
    expect(() => parseArgs(['node', 'x', 'stray.ts'])).toThrow(/Unknown argument: stray\.ts/);
  });

  it('DXF_TSC_FULL=1 forces full mode without the flag', () => {
    process.env.DXF_TSC_FULL = '1';
    expect(parseArgs(['node', 'x']).full).toBe(true);
  });
});

describe('normalizeFile', () => {
  it('converts backslashes to POSIX separators', () => {
    expect(normalizeFile('src\\subapps\\dxf-viewer\\a.ts')).toBe('src/subapps/dxf-viewer/a.ts');
  });

  it('strips an absolute project-root prefix down to a repo-relative path', () => {
    const abs = path.join(path.resolve(__dirname, '..', '..'), 'src', 'a.ts');
    expect(normalizeFile(abs)).toBe('src/a.ts');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeFile('  src/a.ts  ')).toBe('src/a.ts');
  });
});

describe('isTestFile', () => {
  it.each([
    ['src/subapps/dxf-viewer/bim/__tests__/wall.test.ts', true],
    ['src/subapps/dxf-viewer/a.test.ts', true],
    ['src/subapps/dxf-viewer/a.spec.tsx', true],
    ['src/subapps/dxf-viewer/utils/rotation-math.ts', false],
    ['src/subapps/dxf-viewer/testing-helpers.ts', false],
  ])('%s → %s', (file, expected) => {
    expect(isTestFile(file)).toBe(expected);
  });
});

describe('parseErrors', () => {
  it('counts one error per diagnostic line and ignores continuation lines', () => {
    const r = parseErrors(SAMPLE_TSC_OUTPUT);
    // 3 diagnostics — the indented "Property 'corner1' does not exist on type" line
    // is part of the first diagnostic and must NOT be counted again.
    expect(r.totalErrors).toBe(3);
    expect(r.byFile['src/subapps/dxf-viewer/utils/rotation-math.ts']).toBe(2);
    expect(r.byFile['src/subapps/dxf-viewer/bim/__tests__/wall.test.ts']).toBe(1);
  });

  it('splits the source/test totals', () => {
    const r = parseErrors(SAMPLE_TSC_OUTPUT);
    expect(r.sourceErrors).toBe(2);
    expect(r.testErrors).toBe(1);
    expect(r.sourceErrors + r.testErrors).toBe(r.totalErrors);
  });

  it('returns an all-zero result for clean output', () => {
    expect(parseErrors('npm info using npm@10.8.2\n')).toEqual({
      totalErrors: 0,
      sourceErrors: 0,
      testErrors: 0,
      byFile: {},
    });
  });

  it('emits byFile keys in sorted order so a regenerated baseline diffs cleanly', () => {
    const r = parseErrors(
      [
        'src/z.ts(1,1): error TS1: a',
        'src/a.ts(1,1): error TS1: b',
        'src/m.ts(1,1): error TS1: c',
      ].join('\n'),
    );
    expect(Object.keys(r.byFile)).toEqual(['src/a.ts', 'src/m.ts', 'src/z.ts']);
  });

  it('normalises Windows separators into the byFile keys', () => {
    const r = parseErrors('src\\subapps\\dxf-viewer\\a.ts(1,1): error TS2345: x');
    expect(r.byFile['src/subapps/dxf-viewer/a.ts']).toBe(1);
  });

  it('ignores warnings and non-diagnostic noise', () => {
    const r = parseErrors(
      ['src/a.ts(1,1): warning TS6133: unused', 'random log line', ''].join('\n'),
    );
    expect(r.totalErrors).toBe(0);
  });
});

describe('loadBaseline', () => {
  it('returns null when the file does not exist', () => {
    expect(loadBaseline(path.join(TMP_ROOT, 'nope.json'))).toBeNull();
  });

  it('flags invalid JSON instead of throwing', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, '{ not json');
    expect(loadBaseline(f).__invalid).toMatch(/invalid JSON/);
  });

  it('flags a baseline missing totalErrors', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ byFile: {} }));
    expect(loadBaseline(f).__invalid).toMatch(/totalErrors/);
  });

  it('flags a baseline missing byFile', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ totalErrors: 3 }));
    expect(loadBaseline(f).__invalid).toMatch(/byFile/);
  });

  it('loads a valid baseline', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ totalErrors: 2, byFile: { 'src/a.ts': 2 } }));
    const b = loadBaseline(f);
    expect(b.__invalid).toBeUndefined();
    expect(b.totalErrors).toBe(2);
  });
});

describe('writeBaseline', () => {
  it('round-trips through loadBaseline with the tracked fields intact', () => {
    const f = nextTmpBaseline();
    writeBaseline({ totalErrors: 3, sourceErrors: 2, testErrors: 1, byFile: { 'src/a.ts': 3 } }, f);
    const b = loadBaseline(f);
    expect(b.totalErrors).toBe(3);
    expect(b.sourceErrors).toBe(2);
    expect(b.testErrors).toBe(1);
    expect(b.byFile).toEqual({ 'src/a.ts': 3 });
    expect(b.check).toBe('CHECK 3.29');
    expect(b.adr).toBe('ADR-663');
  });
});

describe('compare — the ratchet rule', () => {
  const baseline = { totalErrors: 5, byFile: { 'src/a.ts': 3, 'src/b.ts': 2 } };

  it('passes when every file holds at its baseline', () => {
    const { regressions } = compare(baseline, { byFile: { 'src/a.ts': 3, 'src/b.ts': 2 } });
    expect(regressions).toEqual([]);
  });

  it('passes when errors decrease, and reports what improved', () => {
    const { regressions, cleaned } = compare(baseline, { byFile: { 'src/a.ts': 1, 'src/b.ts': 2 } });
    expect(regressions).toEqual([]);
    expect(cleaned).toEqual([{ file: 'src/a.ts', baseline: 3, current: 1, delta: 2 }]);
  });

  it('reports a file fully cleared as cleaned (absent from current)', () => {
    const { regressions, cleaned } = compare(baseline, { byFile: { 'src/b.ts': 2 } });
    expect(regressions).toEqual([]);
    expect(cleaned).toContainEqual({ file: 'src/a.ts', baseline: 3, current: 0, delta: 3 });
  });

  it('BLOCKS a known file rising above its baseline', () => {
    const { regressions } = compare(baseline, { byFile: { 'src/a.ts': 4, 'src/b.ts': 2 } });
    expect(regressions).toEqual([
      { file: 'src/a.ts', baseline: 3, current: 4, delta: 1, isNew: false },
    ]);
  });

  it('BLOCKS a NEW file with any errors — zero tolerance', () => {
    const { regressions } = compare(baseline, { byFile: { 'src/a.ts': 3, 'src/b.ts': 2, 'src/new.ts': 1 } });
    expect(regressions).toEqual([
      { file: 'src/new.ts', baseline: 0, current: 1, delta: 1, isNew: true },
    ]);
  });

  it('BLOCKS a new broken file even when the overall total dropped', () => {
    // The whole point of per-file over total-only: b.ts got fixed, but that must
    // not buy the right to land a brand-new broken file.
    const { regressions } = compare(baseline, { byFile: { 'src/a.ts': 3, 'src/new.ts': 1 } });
    expect(regressions).toHaveLength(1);
    expect(regressions[0].file).toBe('src/new.ts');
  });

  it('tolerates a baseline with no byFile map (defensive)', () => {
    expect(compare({ totalErrors: 0 }, { byFile: {} }).regressions).toEqual([]);
  });
});

describe('config accessors', () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env.DXF_TSC_BASELINE_FILE = OLD.DXF_TSC_BASELINE_FILE;
    process.env.DXF_TSC_PROJECT = OLD.DXF_TSC_PROJECT;
    if (OLD.DXF_TSC_BASELINE_FILE === undefined) delete process.env.DXF_TSC_BASELINE_FILE;
    if (OLD.DXF_TSC_PROJECT === undefined) delete process.env.DXF_TSC_PROJECT;
  });

  it('defaults the baseline + project to the repo SSoT paths', () => {
    delete process.env.DXF_TSC_BASELINE_FILE;
    delete process.env.DXF_TSC_PROJECT;
    expect(getBaselineFile()).toBe(DEFAULT_BASELINE_FILE);
    expect(getProject()).toBe(DEFAULT_PROJECT);
    expect(DEFAULT_PROJECT).toBe('src/subapps/dxf-viewer/tsconfig.json');
  });

  it('honours the env overrides', () => {
    process.env.DXF_TSC_BASELINE_FILE = path.join(TMP_ROOT, 'custom.json');
    process.env.DXF_TSC_PROJECT = 'other/tsconfig.json';
    expect(getBaselineFile()).toBe(path.resolve(path.join(TMP_ROOT, 'custom.json')));
    expect(getProject()).toBe('other/tsconfig.json');
  });
});

// The CLI legs that never spawn tsc — driven for real via spawnSync.
describe('CLI (no-tsc legs)', () => {
  function run(args, env = {}) {
    return spawnSync(process.execPath, [SCRIPT_UNDER_TEST, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
  }

  it('--help exits 0 and names the baseline + project', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/CHECK 3\.29/);
    expect(r.stdout).toMatch(/dxf-viewer\/tsconfig\.json/);
  });

  it('smoke exits 0 against a valid baseline', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ totalErrors: 7, sourceErrors: 4, byFile: { 'src/a.ts': 7 } }));
    const r = run([], { DXF_TSC_BASELINE_FILE: f });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/smoke — baseline OK \(errors:7, source:4\)/);
  });

  it('smoke exits 1 and points at the fix when the baseline is missing', () => {
    const r = run([], { DXF_TSC_BASELINE_FILE: path.join(TMP_ROOT, 'absent.json') });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/baseline missing/);
    expect(r.stderr).toMatch(/npm run dxf:tsc:baseline/);
  });

  it('smoke exits 1 on a corrupt baseline (never silently passes)', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, '{{{');
    const r = run([], { DXF_TSC_BASELINE_FILE: f });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/invalid JSON/);
  });

  it('exits 1 on an unknown argument', () => {
    const r = run(['--bogus']);
    expect(r.status).toBe(1);
  });
});

describe('committed baseline', () => {
  it('is present, valid, and matches the ADR-663 contract', () => {
    const b = loadBaseline(DEFAULT_BASELINE_FILE);
    expect(b).not.toBeNull();
    expect(b.__invalid).toBeUndefined();
    expect(b.check).toBe('CHECK 3.29');
    expect(b.project).toBe(DEFAULT_PROJECT);
    expect(b.sourceErrors + b.testErrors).toBe(b.totalErrors);
    // The map must actually account for the tracked total — a drifted baseline
    // would silently under-gate.
    const summed = Object.values(b.byFile).reduce((a, n) => a + n, 0);
    expect(summed).toBe(b.totalErrors);
  });
});
