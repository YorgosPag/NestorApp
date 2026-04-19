/**
 * CHECK 3.18 — SSoT Discover Ratchet: Jest test suite (ADR-294, ADR-314).
 *
 * Google-level presubmit-grade tests for scripts/check-ssot-discover-ratchet.js.
 * Covers every pure function, every file I/O boundary, every CLI entry point,
 * plus a regression snapshot test that protects against bash scanner output
 * format drift (if someone renames a Summary: label, tests fail loudly).
 *
 * Why in-process unit tests + mocked spawn integration tests:
 *   Running the real bash scanner takes ~4 min on Windows Git Bash / ~30-60s
 *   on Linux (see ADR-314). Spawning it per test would make the suite
 *   multi-hour. Instead we:
 *     - Unit-test the pure fns + I/O fns directly against tempdir fixtures.
 *     - Integration-test the CLI (smoke mode, --help, bad baselines, unknown
 *       args) via spawnSync with SSOT_DISCOVER_BASELINE_FILE env override.
 *     - Never spawn the real scanner here — fixture snapshot file covers that
 *       leg via parseSummary() regression.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_UNDER_TEST = path.resolve(__dirname, '..', 'check-ssot-discover-ratchet.js');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

const {
  parseArgs,
  parseSummary,
  stripAnsi,
  loadBaseline,
  writeBaseline,
  compare,
  getBaselineFile,
  getScannerPath,
  runScanner,
  runFull,
  runSmoke,
  printHelp,
  main,
  TRACKED_METRICS,
  DEFAULT_BASELINE_FILE,
  DEFAULT_SCANNER,
} = require(SCRIPT_UNDER_TEST);

// Shared tempdir for I/O tests — each test gets a unique path via counter.
let TMP_ROOT;
let tmpCounter = 0;
function nextTmpBaseline() {
  tmpCounter += 1;
  return path.join(TMP_ROOT, `baseline-${tmpCounter}-${process.pid}.json`);
}

beforeAll(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ssot-discover-test-'));
});

afterAll(() => {
  if (TMP_ROOT && fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});

// Restore env between tests so env-driven helpers don't leak across cases.
let savedEnv;
beforeEach(() => {
  savedEnv = {
    SSOT_DISCOVER_BASELINE_FILE: process.env.SSOT_DISCOVER_BASELINE_FILE,
    SSOT_DISCOVER_SCANNER: process.env.SSOT_DISCOVER_SCANNER,
    SSOT_DISCOVER_FULL: process.env.SSOT_DISCOVER_FULL,
  };
  delete process.env.SSOT_DISCOVER_BASELINE_FILE;
  delete process.env.SSOT_DISCOVER_SCANNER;
  delete process.env.SSOT_DISCOVER_FULL;
});
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

// =============================================================================
// Group 1 — stripAnsi(s)
// =============================================================================
describe('stripAnsi', () => {
  const ESC = String.fromCharCode(27);

  it('removes a single SGR escape sequence', () => {
    expect(stripAnsi(`${ESC}[0;31mRED${ESC}[0m`)).toBe('RED');
  });

  it('returns plain strings unchanged', () => {
    expect(stripAnsi('plain text with 123 numbers')).toBe('plain text with 123 numbers');
  });

  it('removes multiple interleaved codes', () => {
    const s = `${ESC}[1m${ESC}[0;36mhi${ESC}[0m there ${ESC}[1;33m!${ESC}[0m`;
    expect(stripAnsi(s)).toBe('hi there !');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });
});

// =============================================================================
// Group 2 — parseSummary(output)
// =============================================================================
describe('parseSummary', () => {
  const minimalOutput = fs.readFileSync(
    path.join(FIXTURES_DIR, 'ssot-discover-output.minimal.txt'),
    'utf8'
  );

  it('extracts all 5 metrics from a clean Summary block', () => {
    expect(parseSummary(minimalOutput)).toEqual({
      centralizedFiles: 136,
      protected: 45,
      unprotected: 91,
      duplicateExports: 21,
      antiPatterns: 5,
    });
  });

  it('throws a descriptive error when a label is missing', () => {
    const broken = minimalOutput.replace('Duplicate exports:', 'Duplicate-exports:');
    expect(() => parseSummary(broken)).toThrow(/Could not parse "Duplicate exports"/);
  });

  it('parses output containing ANSI color escapes once stripped', () => {
    const ansi = fs.readFileSync(
      path.join(FIXTURES_DIR, 'ssot-discover-output.ansi.txt'),
      'utf8'
    );
    // Callers pass already-stripped output (runScanner strips), but parseSummary
    // itself must still work on stripped ANSI variants.
    expect(parseSummary(stripAnsi(ansi))).toEqual({
      centralizedFiles: 136,
      protected: 45,
      unprotected: 91,
      duplicateExports: 21,
      antiPatterns: 5,
    });
  });

  it('tolerates multiple spaces between label and number', () => {
    const out = [
      'Summary:',
      '  Centralized files:          10',
      '  Protected:                   4',
      '  Unprotected:                 6',
      '  Duplicate exports:           2',
      '  Anti-patterns:               1',
    ].join('\n');
    expect(parseSummary(out)).toEqual({
      centralizedFiles: 10,
      protected: 4,
      unprotected: 6,
      duplicateExports: 2,
      antiPatterns: 1,
    });
  });
});

// =============================================================================
// Group 3 — loadBaseline(filePath)
// =============================================================================
describe('loadBaseline', () => {
  it('returns null when baseline file is absent', () => {
    const missing = path.join(TMP_ROOT, 'no-such-file.json');
    expect(loadBaseline(missing)).toBeNull();
  });

  it('flags malformed JSON with __invalid reason', () => {
    const result = loadBaseline(path.join(FIXTURES_DIR, 'baseline-corrupt.json'));
    expect(result).toMatchObject({ __invalid: expect.stringMatching(/invalid JSON/) });
  });

  it('flags missing numeric field with __invalid reason', () => {
    const result = loadBaseline(path.join(FIXTURES_DIR, 'baseline-missing-field.json'));
    expect(result).toEqual({ __invalid: 'missing numeric field "duplicateExports"' });
  });

  it('flags non-numeric tracked field with __invalid reason', () => {
    const result = loadBaseline(path.join(FIXTURES_DIR, 'baseline-non-numeric.json'));
    expect(result).toEqual({ __invalid: 'missing numeric field "duplicateExports"' });
  });

  it('flags null tracked field with __invalid reason', () => {
    const result = loadBaseline(path.join(FIXTURES_DIR, 'baseline-null-field.json'));
    expect(result).toEqual({ __invalid: 'missing numeric field "antiPatterns"' });
  });

  it('returns the parsed payload when all tracked fields are numeric', () => {
    const result = loadBaseline(path.join(FIXTURES_DIR, 'baseline-valid.json'));
    expect(result).toMatchObject({
      duplicateExports: 21,
      antiPatterns: 5,
      unprotected: 91,
      centralizedFiles: 136,
      protected: 45,
      adr: 'ADR-314',
      check: 'CHECK 3.18',
    });
    expect(result.__invalid).toBeUndefined();
  });

  it('honours the env override via getBaselineFile() when no arg is passed', () => {
    const target = nextTmpBaseline();
    fs.writeFileSync(target, fs.readFileSync(path.join(FIXTURES_DIR, 'baseline-valid.json')));
    process.env.SSOT_DISCOVER_BASELINE_FILE = target;
    const result = loadBaseline();
    expect(result.duplicateExports).toBe(21);
  });
});

// =============================================================================
// Group 4 — writeBaseline(counts, filePath)
// =============================================================================
describe('writeBaseline', () => {
  const counts = {
    centralizedFiles: 50,
    protected: 10,
    unprotected: 40,
    duplicateExports: 3,
    antiPatterns: 2,
  };

  let origLog;
  beforeEach(() => {
    origLog = console.log;
    console.log = () => {};
  });
  afterEach(() => {
    console.log = origLog;
  });

  it('writes all 5 metrics + description + adr + check fields', () => {
    const target = nextTmpBaseline();
    writeBaseline(counts, target);
    const payload = JSON.parse(fs.readFileSync(target, 'utf8'));
    expect(payload).toMatchObject({
      ...counts,
      adr: 'ADR-314',
      check: 'CHECK 3.18',
      generatedBy: expect.stringContaining('check-ssot-discover-ratchet.js --write-baseline'),
    });
    expect(payload.description).toMatch(/SSoT Discover Ratchet baseline/);
  });

  it('uses a valid ISO-8601 generatedAt timestamp', () => {
    const target = nextTmpBaseline();
    writeBaseline(counts, target);
    const payload = JSON.parse(fs.readFileSync(target, 'utf8'));
    const parsed = new Date(payload.generatedAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(payload.generatedAt).toBe(parsed.toISOString());
  });

  it('produces parse-able JSON with a trailing newline', () => {
    const target = nextTmpBaseline();
    writeBaseline(counts, target);
    const raw = fs.readFileSync(target, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('is idempotent across writes (stable shape, only generatedAt differs)', () => {
    const target = nextTmpBaseline();
    writeBaseline(counts, target);
    const first = JSON.parse(fs.readFileSync(target, 'utf8'));
    writeBaseline(counts, target);
    const second = JSON.parse(fs.readFileSync(target, 'utf8'));
    // Compare ignoring the timestamp.
    const { generatedAt: _g1, ...rest1 } = first;
    const { generatedAt: _g2, ...rest2 } = second;
    expect(rest1).toEqual(rest2);
  });

  it('round-trips through loadBaseline producing the same tracked counts', () => {
    const target = nextTmpBaseline();
    writeBaseline(counts, target);
    const roundTripped = loadBaseline(target);
    for (const m of TRACKED_METRICS) {
      expect(roundTripped[m]).toBe(counts[m]);
    }
  });
});

// =============================================================================
// Group 5 — compare(baseline, current)
// =============================================================================
describe('compare', () => {
  const baseline = { duplicateExports: 21, antiPatterns: 5, unprotected: 91 };

  it('returns [] when all tracked metrics match exactly', () => {
    expect(compare(baseline, { ...baseline })).toEqual([]);
  });

  it('returns [] when every tracked metric dropped below baseline', () => {
    expect(compare(baseline, { duplicateExports: 10, antiPatterns: 0, unprotected: 50 })).toEqual(
      []
    );
  });

  it('reports a single raise with delta when one metric rose', () => {
    const raises = compare(baseline, { ...baseline, duplicateExports: 22 });
    expect(raises).toEqual([
      { metric: 'duplicateExports', baseline: 21, current: 22, delta: 1 },
    ]);
  });

  it('reports every metric that rose, in TRACKED_METRICS order', () => {
    const raises = compare(baseline, {
      duplicateExports: 30,
      antiPatterns: 6,
      unprotected: 92,
    });
    expect(raises.map((r) => r.metric)).toEqual(['duplicateExports', 'antiPatterns', 'unprotected']);
    expect(raises.map((r) => r.delta)).toEqual([9, 1, 1]);
  });

  it('ignores untracked fields even when they rise (centralizedFiles, protected)', () => {
    const raises = compare(
      { ...baseline, centralizedFiles: 136, protected: 45 },
      { ...baseline, centralizedFiles: 999, protected: 999 }
    );
    expect(raises).toEqual([]);
  });
});

// =============================================================================
// Group 6 — parseArgs(argv)
// =============================================================================
describe('parseArgs', () => {
  const asArgv = (...flags) => ['node', 'script.js', ...flags];

  it('defaults all flags to false with no arguments', () => {
    expect(parseArgs(asArgv())).toEqual({ full: false, writeBaseline: false, help: false });
  });

  it('sets full=true with --full', () => {
    expect(parseArgs(asArgv('--full'))).toMatchObject({ full: true });
  });

  it('sets writeBaseline=true with --write-baseline', () => {
    expect(parseArgs(asArgv('--write-baseline'))).toMatchObject({ writeBaseline: true });
  });

  it('sets help=true with --help or -h', () => {
    expect(parseArgs(asArgv('--help'))).toMatchObject({ help: true });
    expect(parseArgs(asArgv('-h'))).toMatchObject({ help: true });
  });

  it('throws on unknown arguments', () => {
    expect(() => parseArgs(asArgv('--bogus'))).toThrow(/Unknown argument: --bogus/);
  });

  it('honours SSOT_DISCOVER_FULL=1 env var even without --full flag', () => {
    process.env.SSOT_DISCOVER_FULL = '1';
    expect(parseArgs(asArgv())).toMatchObject({ full: true });
  });

  it('ignores SSOT_DISCOVER_FULL when not exactly "1"', () => {
    process.env.SSOT_DISCOVER_FULL = 'true';
    expect(parseArgs(asArgv())).toMatchObject({ full: false });
  });
});

// =============================================================================
// Group 7 — env-driven resolvers (getBaselineFile / getScannerPath)
// =============================================================================
describe('env-driven resolvers', () => {
  it('getBaselineFile returns DEFAULT_BASELINE_FILE when env unset', () => {
    expect(getBaselineFile()).toBe(DEFAULT_BASELINE_FILE);
  });

  it('getBaselineFile resolves env override to absolute path', () => {
    process.env.SSOT_DISCOVER_BASELINE_FILE = 'relative/path.json';
    expect(path.isAbsolute(getBaselineFile())).toBe(true);
  });

  it('getScannerPath returns DEFAULT_SCANNER when env unset', () => {
    expect(getScannerPath()).toBe(DEFAULT_SCANNER);
  });
});

// =============================================================================
// Group 8 — CLI integration (spawnSync, smoke + help + error paths only)
// =============================================================================
describe('CLI integration (spawnSync)', () => {
  // Never spawn --full in tests — real scanner takes ~4min on Windows.
  // These cover smoke + --help + error exit codes.

  function runCli(args, envOverrides = {}) {
    return spawnSync(process.execPath, [SCRIPT_UNDER_TEST, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...envOverrides },
    });
  }

  it('exits 0 in smoke mode with a valid baseline env override', () => {
    const baseline = nextTmpBaseline();
    fs.copyFileSync(path.join(FIXTURES_DIR, 'baseline-valid.json'), baseline);
    const result = runCli([], { SSOT_DISCOVER_BASELINE_FILE: baseline });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/smoke — baseline OK/);
  });

  it('exits 1 when the baseline file is missing', () => {
    const baseline = path.join(TMP_ROOT, 'does-not-exist.json');
    const result = runCli([], { SSOT_DISCOVER_BASELINE_FILE: baseline });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/baseline missing/);
  });

  it('exits 1 when the baseline file is corrupt JSON', () => {
    const result = runCli([], {
      SSOT_DISCOVER_BASELINE_FILE: path.join(FIXTURES_DIR, 'baseline-corrupt.json'),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/baseline invalid/);
  });

  it('exits 1 when the baseline is missing a tracked numeric field', () => {
    const result = runCli([], {
      SSOT_DISCOVER_BASELINE_FILE: path.join(FIXTURES_DIR, 'baseline-missing-field.json'),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/baseline invalid.*duplicateExports/s);
  });

  it('exits 0 on --help and prints Usage', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Usage:/);
    expect(result.stdout).toMatch(/--full/);
    expect(result.stdout).toMatch(/--write-baseline/);
  });

  it('exits non-zero on an unknown argument', () => {
    const result = runCli(['--no-such-flag']);
    expect(result.status).not.toBe(0);
    // parseArgs throws synchronously; Node reports the error on stderr.
    expect(result.stderr || '').toMatch(/Unknown argument/);
  });
});

// =============================================================================
// Group 9 — In-process coverage of runScanner / runFull / runSmoke / main
// =============================================================================
// These touch console + process.exit, so we stub both to capture behaviour
// without aborting the Jest worker. Real scanner is replaced by a fake bash
// script that echoes the minimal fixture.
describe('in-process: runScanner / runFull / runSmoke / printHelp / main', () => {
  const fakeScannerOk = path.join(FIXTURES_DIR, 'fake-scanner-ok.sh');
  const fakeScannerFail = path.join(FIXTURES_DIR, 'fake-scanner-fail.sh');

  let exitSpy;
  let logSpy;
  let errSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`__EXIT__:${code ?? 0}`);
    });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  describe('runScanner', () => {
    it('returns stripped stdout from a successful scanner invocation', () => {
      process.env.SSOT_DISCOVER_SCANNER = fakeScannerOk;
      const output = runScanner();
      // Should contain the fixture Summary header and NO raw ANSI escape codes.
      expect(output).toMatch(/Summary:/);
      expect(output).not.toMatch(new RegExp(String.fromCharCode(27)));
    });

    it('exits 1 when the scanner binary is missing', () => {
      process.env.SSOT_DISCOVER_SCANNER = path.join(TMP_ROOT, 'no-scanner.sh');
      expect(() => runScanner()).toThrow('__EXIT__:1');
      expect(errSpy.mock.calls.flat().join(' ')).toMatch(/scanner missing/);
    });

    it('exits 1 when the scanner exits non-zero', () => {
      process.env.SSOT_DISCOVER_SCANNER = fakeScannerFail;
      expect(() => runScanner()).toThrow('__EXIT__:1');
      expect(errSpy.mock.calls.flat().join(' ')).toMatch(/scanner exited with status/);
    });
  });

  describe('runSmoke', () => {
    it('exits 0 when baseline is valid', () => {
      process.env.SSOT_DISCOVER_BASELINE_FILE = path.join(FIXTURES_DIR, 'baseline-valid.json');
      expect(() => runSmoke()).toThrow('__EXIT__:0');
      expect(logSpy.mock.calls.flat().join(' ')).toMatch(/smoke — baseline OK/);
    });

    it('exits 1 and prints remediation when baseline is missing', () => {
      process.env.SSOT_DISCOVER_BASELINE_FILE = path.join(TMP_ROOT, 'missing-baseline.json');
      expect(() => runSmoke()).toThrow('__EXIT__:1');
      const stderr = errSpy.mock.calls.flat().join(' ');
      expect(stderr).toMatch(/baseline missing/);
      expect(stderr).toMatch(/ssot:discover:baseline/);
    });

    it('exits 1 when baseline JSON is corrupt', () => {
      process.env.SSOT_DISCOVER_BASELINE_FILE = path.join(FIXTURES_DIR, 'baseline-corrupt.json');
      expect(() => runSmoke()).toThrow('__EXIT__:1');
      expect(errSpy.mock.calls.flat().join(' ')).toMatch(/baseline invalid/);
    });
  });

  describe('runFull', () => {
    it('exits 0 when current counts equal baseline', () => {
      // Fake scanner echoes 21/5/91; baseline-valid.json has the same numbers.
      process.env.SSOT_DISCOVER_SCANNER = fakeScannerOk;
      process.env.SSOT_DISCOVER_BASELINE_FILE = path.join(FIXTURES_DIR, 'baseline-valid.json');
      expect(() => runFull()).toThrow('__EXIT__:0');
      expect(logSpy.mock.calls.flat().join(' ')).toMatch(/CHECK 3.18 OK/);
    });

    it('exits 1 with raise diagnostic when baseline is lower than current', () => {
      process.env.SSOT_DISCOVER_SCANNER = fakeScannerOk;
      // Write a tighter baseline (duplicateExports = 10) so fixture's 21 is a raise.
      const tighter = nextTmpBaseline();
      writeBaseline(
        { centralizedFiles: 136, protected: 45, unprotected: 91, duplicateExports: 10, antiPatterns: 5 },
        tighter
      );
      process.env.SSOT_DISCOVER_BASELINE_FILE = tighter;
      expect(() => runFull()).toThrow('__EXIT__:1');
      const stderr = errSpy.mock.calls.flat().join(' ');
      expect(stderr).toMatch(/CHECK 3.18 FAIL/);
      expect(stderr).toMatch(/duplicateExports: 10 → 21/);
    });

    it('exits 1 when baseline is missing', () => {
      process.env.SSOT_DISCOVER_SCANNER = fakeScannerOk;
      process.env.SSOT_DISCOVER_BASELINE_FILE = path.join(TMP_ROOT, 'no-baseline.json');
      expect(() => runFull()).toThrow('__EXIT__:1');
      expect(errSpy.mock.calls.flat().join(' ')).toMatch(/baseline missing/);
    });

    it('exits 1 when baseline is invalid', () => {
      process.env.SSOT_DISCOVER_SCANNER = fakeScannerOk;
      process.env.SSOT_DISCOVER_BASELINE_FILE = path.join(FIXTURES_DIR, 'baseline-corrupt.json');
      expect(() => runFull()).toThrow('__EXIT__:1');
      expect(errSpy.mock.calls.flat().join(' ')).toMatch(/baseline invalid/);
    });
  });

  describe('printHelp', () => {
    it('prints Usage banner with paths', () => {
      printHelp();
      const out = logSpy.mock.calls.flat().join(' ');
      expect(out).toMatch(/Usage:/);
      expect(out).toMatch(/--full/);
      expect(out).toMatch(/Baseline file:/);
      expect(out).toMatch(/Scanner:/);
    });
  });

  describe('main', () => {
    const saveArgv = () => process.argv.slice();
    let origArgv;
    beforeEach(() => {
      origArgv = saveArgv();
    });
    afterEach(() => {
      process.argv = origArgv;
    });

    it('exits 0 and prints help for --help', () => {
      process.argv = ['node', SCRIPT_UNDER_TEST, '--help'];
      expect(() => main()).toThrow('__EXIT__:0');
      expect(logSpy.mock.calls.flat().join(' ')).toMatch(/Usage:/);
    });

    it('runs smoke path when no flags are passed', () => {
      process.argv = ['node', SCRIPT_UNDER_TEST];
      process.env.SSOT_DISCOVER_BASELINE_FILE = path.join(FIXTURES_DIR, 'baseline-valid.json');
      expect(() => main()).toThrow('__EXIT__:0');
      expect(logSpy.mock.calls.flat().join(' ')).toMatch(/smoke — baseline OK/);
    });

    it('runs full path with --full flag and fake scanner', () => {
      process.argv = ['node', SCRIPT_UNDER_TEST, '--full'];
      process.env.SSOT_DISCOVER_SCANNER = path.join(FIXTURES_DIR, 'fake-scanner-ok.sh');
      process.env.SSOT_DISCOVER_BASELINE_FILE = path.join(FIXTURES_DIR, 'baseline-valid.json');
      expect(() => main()).toThrow('__EXIT__:0');
      expect(logSpy.mock.calls.flat().join(' ')).toMatch(/CHECK 3.18 OK/);
    });

    it('writes baseline then exits 0 with --write-baseline', () => {
      const target = nextTmpBaseline();
      process.argv = ['node', SCRIPT_UNDER_TEST, '--write-baseline'];
      process.env.SSOT_DISCOVER_SCANNER = path.join(FIXTURES_DIR, 'fake-scanner-ok.sh');
      process.env.SSOT_DISCOVER_BASELINE_FILE = target;
      expect(() => main()).toThrow('__EXIT__:0');
      expect(fs.existsSync(target)).toBe(true);
      const written = JSON.parse(fs.readFileSync(target, 'utf8'));
      expect(written.duplicateExports).toBe(21);
      expect(written.adr).toBe('ADR-314');
    });
  });
});

// =============================================================================
// Group 10 — Regression snapshot (bash scanner output format)
// =============================================================================
describe('regression: bash scanner output format', () => {
  const snapshotPath = path.join(FIXTURES_DIR, 'ssot-discover-output.txt');

  // The full scanner snapshot is generated by running the real bash scanner
  // once and committing the output. If the scanner is renamed, reformatted, or
  // one of the Summary: labels changes wording, this test fails loudly so the
  // check script can be updated atomically with the bash.
  const hasSnapshot = fs.existsSync(snapshotPath) && fs.statSync(snapshotPath).size > 1000;
  const describeOrSkip = hasSnapshot ? describe : describe.skip;

  describeOrSkip('with committed fixture', () => {
    const output = hasSnapshot ? fs.readFileSync(snapshotPath, 'utf8') : '';

    it('parseSummary extracts all 5 counts from the real scanner snapshot', () => {
      const counts = parseSummary(stripAnsi(output));
      for (const m of TRACKED_METRICS) {
        expect(typeof counts[m]).toBe('number');
        expect(counts[m]).toBeGreaterThanOrEqual(0);
      }
      expect(counts.centralizedFiles).toBeGreaterThan(0);
      expect(counts.protected + counts.unprotected).toBe(counts.centralizedFiles);
    });
  });
});
