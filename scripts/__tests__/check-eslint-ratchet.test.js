/**
 * ADR-598 ΦΑΣΗ 1 — ESLint Warning Ratchet: Jest test suite.
 *
 * Presubmit-grade tests for scripts/check-eslint-ratchet.js. Covers the pure
 * functions, the gate registry, the parse-error tolerance threshold, and the
 * baseline I/O boundary — everything EXCEPT the real ESLint spawn.
 *
 * Why we never spawn the real ESLint here:
 *   A real full scan is minutes and needs the whole src/ tree. Instead we drive
 *   summarize() against synthetic ESLint JSON fixtures and unit-test the I/O fns
 *   against tempdir baselines. The scan-driven legs (measure/runCheck end-to-end)
 *   are exercised by CI (.github/workflows/eslint-ratchet.yml) — mirrors
 *   scripts/__tests__/check-jscpd-ratchet.test.js.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT_UNDER_TEST = path.resolve(__dirname, '..', 'check-eslint-ratchet.js');

const {
  GATES,
  getGate,
  parseArgs,
  summarize,
  loadBaseline,
  writeBaseline,
  assertGateInstalled,
  getBaselineFile,
  getScanRoot,
} = require(SCRIPT_UNDER_TEST);

let TMP_ROOT;
let tmpCounter = 0;
function nextTmpBaseline() {
  tmpCounter += 1;
  return path.join(TMP_ROOT, `baseline-${tmpCounter}-${process.pid}.json`);
}

// Build a synthetic ESLint JSON result array: `files` is a list of
// { path, warnings: [ruleId...], fatal: N }. Mirrors ESLint's --format json shape.
function eslintResults(files) {
  return files.map((f) => ({
    filePath: path.join(process.cwd(), f.path || 'x.ts'),
    messages: [
      ...(f.warnings || []).map((ruleId) => ({ ruleId, severity: 1, line: 1, message: 'w' })),
      ...Array.from({ length: f.fatal || 0 }, () => ({ ruleId: null, severity: 2, fatal: true, line: 1, message: 'Parsing error' })),
    ],
  }));
}

const COMPLEXITY = GATES.complexity;

beforeAll(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-ratchet-test-'));
});
afterAll(() => {
  if (TMP_ROOT && fs.existsSync(TMP_ROOT)) fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

let savedEnv;
beforeEach(() => {
  savedEnv = {
    ESLINT_RATCHET_BASELINE_FILE: process.env.ESLINT_RATCHET_BASELINE_FILE,
    ESLINT_RATCHET_SCAN_ROOT: process.env.ESLINT_RATCHET_SCAN_ROOT,
  };
  delete process.env.ESLINT_RATCHET_BASELINE_FILE;
  delete process.env.ESLINT_RATCHET_SCAN_ROOT;
});
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('gate registry', () => {
  test('exposes the three ADR-598 ΦΑΣΗ 1 gates', () => {
    expect(Object.keys(GATES).sort()).toEqual(['complexity', 'jsx-a11y', 'security']);
  });
  test('getGate returns a known gate', () => {
    expect(getGate('complexity').adr).toBe('ADR-598 G7');
  });
  test('getGate throws on unknown gate', () => {
    expect(() => getGate('bogus')).toThrow(/Unknown --gate/);
  });
  test('complexity gate counts only its three core rules', () => {
    expect(COMPLEXITY.ruleIds).toEqual(['complexity', 'max-depth', 'max-params']);
    expect(COMPLEXITY.needs).toEqual([]);
  });
  test('plugin gates declare their dependency', () => {
    expect(GATES['jsx-a11y'].needs).toContain('eslint-plugin-jsx-a11y');
    expect(GATES.security.needs).toContain('eslint-plugin-security');
  });
  test('plugin gates scope their count by namespace prefix', () => {
    // ESLint 9's --config is additive with the repo's main config, so plugin
    // gates count only their own namespace (see check-eslint-ratchet.js GATES).
    expect(GATES['jsx-a11y'].rulePrefix).toBe('jsx-a11y/');
    expect(GATES.security.rulePrefix).toBe('security/');
    expect(COMPLEXITY.rulePrefix).toBeUndefined();
  });
});

describe('parseArgs', () => {
  test('parses --gate + --check', () => {
    expect(parseArgs(['node', 's', '--gate', 'complexity', '--check'])).toMatchObject({ gate: 'complexity', check: true });
  });
  test('--full is an alias for --check', () => {
    expect(parseArgs(['node', 's', '--gate', 'security', '--full']).check).toBe(true);
  });
  test('parses --write-baseline', () => {
    expect(parseArgs(['node', 's', '--gate', 'complexity', '--write-baseline']).writeBaseline).toBe(true);
  });
  test('throws on unknown argument', () => {
    expect(() => parseArgs(['node', 's', '--nope'])).toThrow(/Unknown argument/);
  });
});

describe('summarize', () => {
  test('counts only the gate ruleIds, groups per rule', () => {
    const res = eslintResults([
      { path: 'a.ts', warnings: ['complexity', 'max-depth', 'no-console'] },
      { path: 'b.ts', warnings: ['complexity', 'max-params'] },
    ]);
    const s = summarize(COMPLEXITY, res);
    expect(s.total).toBe(4); // no-console excluded
    expect(s.perRule).toEqual({ complexity: 2, 'max-depth': 1, 'max-params': 1 });
    expect(s.files).toBe(2);
  });
  test('null ruleIds gate counts every warning', () => {
    const gate = { ruleIds: null, needs: [] };
    const s = summarize(gate, eslintResults([{ path: 'a.tsx', warnings: ['jsx-a11y/alt-text', 'jsx-a11y/anchor-is-valid'] }]));
    expect(s.total).toBe(2);
  });
  test('rulePrefix gate counts only its namespace, drops leaked foreign rules', () => {
    // The plugin gate's ESLint run also emits the repo main-config rules
    // (design-system/*, custom/*) because ESLint 9's --config is additive; the
    // rulePrefix filter is what keeps the ratchet scoped to jsx-a11y.
    const gate = { ruleIds: null, rulePrefix: 'jsx-a11y/', needs: [] };
    const s = summarize(gate, eslintResults([
      { path: 'a.tsx', warnings: ['jsx-a11y/alt-text', 'design-system/no-hardcoded-colors', 'custom/no-hardcoded-strings', 'jsx-a11y/anchor-is-valid'] },
    ]));
    expect(s.total).toBe(2);
    expect(s.perRule).toEqual({ 'jsx-a11y/alt-text': 1, 'jsx-a11y/anchor-is-valid': 1 });
  });
  test('parse errors below threshold: counted-as-skipped, run continues', () => {
    const files = [{ path: 'bad.ts', fatal: 1 }];
    for (let i = 0; i < 20; i++) files.push({ path: `ok${i}.ts`, warnings: ['complexity'] });
    const s = summarize(COMPLEXITY, eslintResults(files)); // 1/21 ≈ 4.7%
    expect(s.total).toBe(20);
    expect(s.parseErrors).toHaveLength(1);
  });
  test('parse errors above 25% abort (config-broken guard)', () => {
    const files = [];
    for (let i = 0; i < 10; i++) files.push({ path: `bad${i}.ts`, fatal: 1 });
    for (let i = 0; i < 5; i++) files.push({ path: `ok${i}.ts`, warnings: ['complexity'] });
    expect(() => summarize(COMPLEXITY, eslintResults(files))).toThrow(/gate config is almost certainly broken/);
  });
});

describe('loadBaseline', () => {
  test('returns null when file is missing', () => {
    expect(loadBaseline(nextTmpBaseline())).toBeNull();
  });
  test('flags invalid JSON', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, '{not json');
    expect(loadBaseline(f).__invalid).toMatch(/invalid JSON/);
  });
  test('flags missing numeric total', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ perRule: {} }));
    expect(loadBaseline(f).__invalid).toMatch(/total/);
  });
  test('accepts a valid baseline', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ total: 42, perRule: { complexity: 42 } }));
    expect(loadBaseline(f).total).toBe(42);
  });
});

describe('writeBaseline', () => {
  test('round-trips through loadBaseline with parseErrors count', () => {
    const f = nextTmpBaseline();
    writeBaseline('complexity', COMPLEXITY, { total: 7, files: 3, perRule: { complexity: 7 }, parseErrors: ['x.ts:1 — e'] }, f);
    const b = loadBaseline(f);
    expect(b.total).toBe(7);
    expect(b.parseErrors).toBe(1);
    expect(b.gate).toBe('complexity');
  });
});

describe('assertGateInstalled', () => {
  test('core-only gate needs nothing', () => {
    expect(() => assertGateInstalled(COMPLEXITY)).not.toThrow();
  });
  test('throws for a gate whose plugin is absent', () => {
    expect(() => assertGateInstalled({ adr: 'X', needs: ['definitely-not-installed-xyz'] })).toThrow(/not installed/);
  });
});

describe('env overrides', () => {
  test('ESLINT_RATCHET_SCAN_ROOT overrides default', () => {
    process.env.ESLINT_RATCHET_SCAN_ROOT = 'src/foo';
    expect(getScanRoot()).toBe('src/foo');
  });
  test('ESLINT_RATCHET_BASELINE_FILE overrides gate default', () => {
    process.env.ESLINT_RATCHET_BASELINE_FILE = '/tmp/x.json';
    expect(getBaselineFile(COMPLEXITY)).toBe(path.resolve('/tmp/x.json'));
  });
  test('default baseline file comes from the gate', () => {
    expect(getBaselineFile(COMPLEXITY)).toContain('.eslint-complexity-baseline.json');
  });
});
