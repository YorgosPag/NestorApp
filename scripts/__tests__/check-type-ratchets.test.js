/**
 * ADR-598 ΦΑΣΗ 2 — Type & bundle ratchets: Jest suite.
 *
 * Presubmit-grade tests for the three G5/G6/G14 ratchets and their shared
 * baseline library. Covers every pure function: the shared parse-args / baseline
 * I/O / direction-aware compare (scripts/lib/ratchet-baseline.js) and each gate's
 * output parser (type-coverage summary line, bundle analysis reducer, tsc
 * --extendedDiagnostics counters).
 *
 * What we deliberately DO NOT do here: spawn type-coverage / next build / tsc.
 * Those are minutes-long, need the whole tree, and belong to CI (N.17) — the
 * measure() legs are exercised by the gate workflows, not by Jest. This mirrors
 * scripts/__tests__/check-eslint-ratchet.test.js.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ratchet = require('../lib/ratchet-baseline');
const typeCoverage = require('../check-type-coverage-ratchet');
const bundleSize = require('../check-bundle-size-ratchet');
const typeComplexity = require('../check-type-complexity-ratchet');

let TMP_ROOT;
let tmpCounter = 0;
function nextTmp(name) {
  tmpCounter += 1;
  return path.join(TMP_ROOT, `${name}-${tmpCounter}-${process.pid}.json`);
}

beforeAll(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'type-ratchets-test-'));
});
afterAll(() => {
  if (TMP_ROOT && fs.existsSync(TMP_ROOT)) fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Shared library — scripts/lib/ratchet-baseline.js
// ---------------------------------------------------------------------------
describe('ratchet-baseline: parseArgs', () => {
  test('default (no flags) is neither check nor write', () => {
    expect(ratchet.parseArgs(['node', 's'])).toEqual({ check: false, writeBaseline: false, help: false });
  });
  test('parses --check and --full alias', () => {
    expect(ratchet.parseArgs(['node', 's', '--check']).check).toBe(true);
    expect(ratchet.parseArgs(['node', 's', '--full']).check).toBe(true);
  });
  test('parses --write-baseline and --help', () => {
    expect(ratchet.parseArgs(['node', 's', '--write-baseline']).writeBaseline).toBe(true);
    expect(ratchet.parseArgs(['node', 's', '-h']).help).toBe(true);
  });
  test('throws on unknown argument', () => {
    expect(() => ratchet.parseArgs(['node', 's', '--nope'])).toThrow(/Unknown argument/);
  });
});

describe('ratchet-baseline: loadBaseline', () => {
  test('missing file → null', () => {
    expect(ratchet.loadBaseline(nextTmp('missing'))).toBeNull();
  });
  test('invalid JSON → __invalid', () => {
    const f = nextTmp('bad');
    fs.writeFileSync(f, '{not json');
    expect(ratchet.loadBaseline(f).__invalid).toMatch(/invalid JSON/);
  });
  test('missing required numeric key → __invalid', () => {
    const f = nextTmp('nokey');
    fs.writeFileSync(f, JSON.stringify({ totalCount: 10 }));
    expect(ratchet.loadBaseline(f, ['percent']).__invalid).toMatch(/percent/);
  });
  test('present-but-non-numeric required key → __invalid', () => {
    const f = nextTmp('strkey');
    fs.writeFileSync(f, JSON.stringify({ percent: '98' }));
    expect(ratchet.loadBaseline(f, ['percent']).__invalid).toMatch(/percent/);
  });
  test('valid baseline round-trips', () => {
    const f = nextTmp('ok');
    ratchet.writeBaselineFile(f, { percent: 98.7, typedCount: 9, totalCount: 10 });
    const b = ratchet.loadBaseline(f, ['percent']);
    expect(b.percent).toBe(98.7);
  });
});

describe('ratchet-baseline: isRegression', () => {
  test("direction 'up' blocks on drop, passes on hold/rise", () => {
    expect(ratchet.isRegression({ current: 97.9, baseline: 98.0, direction: 'up' })).toBe(true);
    expect(ratchet.isRegression({ current: 98.0, baseline: 98.0, direction: 'up' })).toBe(false);
    expect(ratchet.isRegression({ current: 99.0, baseline: 98.0, direction: 'up' })).toBe(false);
  });
  test("direction 'down' blocks on rise beyond tolerance", () => {
    // baseline 1000, tol 2% → ceiling 1020
    expect(ratchet.isRegression({ current: 1021, baseline: 1000, direction: 'down', tolerancePct: 2 })).toBe(true);
    expect(ratchet.isRegression({ current: 1020, baseline: 1000, direction: 'down', tolerancePct: 2 })).toBe(false);
    expect(ratchet.isRegression({ current: 990, baseline: 1000, direction: 'down', tolerancePct: 2 })).toBe(false);
  });
  test("direction 'up' honours tolerance floor", () => {
    // baseline 98, tol 1% → floor 97.02
    expect(ratchet.isRegression({ current: 97.1, baseline: 98, direction: 'up', tolerancePct: 1 })).toBe(false);
    expect(ratchet.isRegression({ current: 97.0, baseline: 98, direction: 'up', tolerancePct: 1 })).toBe(true);
  });
  test('unknown direction throws', () => {
    expect(() => ratchet.isRegression({ current: 1, baseline: 1, direction: 'sideways' })).toThrow(/Unknown ratchet direction/);
  });
});

// ---------------------------------------------------------------------------
// G5 — type-coverage
// ---------------------------------------------------------------------------
describe('G5 type-coverage: parseTypeCoverageOutput', () => {
  const { parseTypeCoverageOutput } = typeCoverage;
  test('parses the summary line', () => {
    expect(parseTypeCoverageOutput('9500 / 9600 98.96%')).toEqual({ typedCount: 9500, totalCount: 9600, percent: 98.96 });
  });
  test('parses the parenthesised fraction format (type-coverage 2.29.x)', () => {
    // Real output that broke the seed run: "(1817536 / 1828437) 99.40%".
    expect(parseTypeCoverageOutput('(1817536 / 1828437) 99.40%\ntype-coverage success.'))
      .toEqual({ typedCount: 1817536, totalCount: 1828437, percent: 99.4 });
  });
  test('picks the LAST summary line (ignores --detail noise above)', () => {
    const out = ['src/a.ts:1:2: any', '10 / 20 50.00%', 'src/b.ts:3:4: any', '9500 / 9600 98.96%'].join('\n');
    expect(parseTypeCoverageOutput(out).percent).toBe(98.96);
  });
  test('tolerates CRLF and surrounding whitespace', () => {
    expect(parseTypeCoverageOutput('\r\n  1234 / 5678 21.73%  \r\n').typedCount).toBe(1234);
  });
  test('throws when no summary line is present (fail-closed)', () => {
    expect(() => parseTypeCoverageOutput('some error\nno numbers here')).toThrow(/no summary line/);
  });
  test('descriptor is an UP ratchet on percent with zero tolerance', () => {
    expect(typeCoverage.DESCRIPTOR.direction).toBe('up');
    expect(typeCoverage.DESCRIPTOR.metricKey).toBe('percent');
    expect(typeCoverage.DESCRIPTOR.resolveTolerancePct()).toBe(0);
  });
  test('buildPayload keeps the three metrics + adr', () => {
    const p = typeCoverage.buildPayload({ percent: 98.96, typedCount: 9500, totalCount: 9600 });
    expect(p).toMatchObject({ percent: 98.96, typedCount: 9500, totalCount: 9600, adr: 'ADR-598 G5' });
  });
  test('describe shows +/- delta vs baseline', () => {
    const s = typeCoverage.describe({ measured: { percent: 98.9, typedCount: 9, totalCount: 10 }, baseline: { percent: 98.5 } });
    expect(s).toMatch(/\+0\.40pp/);
  });
});

// ---------------------------------------------------------------------------
// G6 — bundle-size
// ---------------------------------------------------------------------------
describe('G6 bundle-size: summarizeAnalysis', () => {
  const { summarizeAnalysis } = bundleSize;
  test('reduces analyzer output to totalSize/chunksCount/cssSize', () => {
    const analysis = {
      totalSize: 2048,
      chunks: [{ size: 1000 }, { size: 500 }],
      css: [{ size: 300 }, { size: 248 }],
    };
    expect(summarizeAnalysis(analysis)).toEqual({ totalSize: 2048, chunksCount: 2, cssSize: 548 });
  });
  test('handles empty/missing arrays', () => {
    expect(summarizeAnalysis({ totalSize: 0 })).toEqual({ totalSize: 0, chunksCount: 0, cssSize: 0 });
  });
  test('descriptor is a DOWN ratchet on totalSize with default 2% tolerance', () => {
    expect(bundleSize.DESCRIPTOR.direction).toBe('down');
    expect(bundleSize.DESCRIPTOR.metricKey).toBe('totalSize');
    expect(bundleSize.DEFAULT_TOLERANCE_PCT).toBe(2);
  });
  test('tolerance comes from the baseline when present, else default', () => {
    expect(bundleSize.DESCRIPTOR.resolveTolerancePct({ tolerancePct: 5 })).toBe(5);
    expect(bundleSize.DESCRIPTOR.resolveTolerancePct({})).toBe(2);
  });
  test('buildPayload stores the tolerance in the baseline (SSoT)', () => {
    const p = bundleSize.buildPayload({ totalSize: 1000, chunksCount: 3, cssSize: 200 });
    expect(p).toMatchObject({ totalSize: 1000, chunksCount: 3, cssSize: 200, tolerancePct: 2, adr: 'ADR-598 G6' });
  });
  test('formatBytes is human-readable', () => {
    expect(bundleSize.formatBytes(0)).toBe('0 B');
    expect(bundleSize.formatBytes(1536)).toBe('1.50 KB');
  });
});

// ---------------------------------------------------------------------------
// G14 — type-complexity
// ---------------------------------------------------------------------------
describe('G14 type-complexity: parseExtendedDiagnostics', () => {
  const { parseExtendedDiagnostics } = typeComplexity;
  const SAMPLE = [
    'Files:                         1234',
    'Lines:                       567890',
    'Instantiations:             1048576',
    'Types:                       204800',
    'Check time:                    12.3s',
  ].join('\n');
  test('extracts Instantiations and Types', () => {
    expect(parseExtendedDiagnostics(SAMPLE)).toEqual({ instantiations: 1048576, types: 204800 });
  });
  test('Types defaults to 0 when absent', () => {
    expect(parseExtendedDiagnostics('Instantiations: 42').types).toBe(0);
  });
  test('throws (fail-closed) when Instantiations is missing', () => {
    expect(() => parseExtendedDiagnostics('Files: 3\nTypes: 9')).toThrow(/Instantiations/);
  });
  test('descriptor is a DOWN ratchet on instantiations', () => {
    expect(typeComplexity.DESCRIPTOR.direction).toBe('down');
    expect(typeComplexity.DESCRIPTOR.metricKey).toBe('instantiations');
  });
  test('resolveTolerancePct reads the governance budget file', () => {
    const budgetFile = nextTmp('budget');
    fs.writeFileSync(budgetFile, JSON.stringify({ policy: { tolerancePct: 7 } }));
    const prev = process.env.TYPE_COMPLEXITY_BUDGET_FILE;
    process.env.TYPE_COMPLEXITY_BUDGET_FILE = budgetFile;
    try {
      expect(typeComplexity.resolveTolerancePct()).toBe(7);
    } finally {
      if (prev === undefined) delete process.env.TYPE_COMPLEXITY_BUDGET_FILE;
      else process.env.TYPE_COMPLEXITY_BUDGET_FILE = prev;
    }
  });
  test('resolveTolerancePct falls back when budget is missing/broken', () => {
    const prev = process.env.TYPE_COMPLEXITY_BUDGET_FILE;
    process.env.TYPE_COMPLEXITY_BUDGET_FILE = nextTmp('does-not-exist');
    try {
      expect(typeComplexity.resolveTolerancePct()).toBe(typeComplexity.FALLBACK_TOLERANCE_PCT);
    } finally {
      if (prev === undefined) delete process.env.TYPE_COMPLEXITY_BUDGET_FILE;
      else process.env.TYPE_COMPLEXITY_BUDGET_FILE = prev;
    }
  });
  test('the committed budget file is valid and 3%', () => {
    const budget = JSON.parse(fs.readFileSync(typeComplexity.getBudgetFile(), 'utf8'));
    expect(budget.policy.tolerancePct).toBe(3);
    expect(budget.baseline.file).toBe('.type-complexity-baseline.json');
  });
});
