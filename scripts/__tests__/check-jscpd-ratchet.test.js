/**
 * CHECK 3.28 — jscpd Clone Ratchet: Jest test suite (ADR-584).
 *
 * Presubmit-grade tests for scripts/check-jscpd-ratchet.js. Covers every pure
 * function, every baseline I/O boundary, and the CLI entry points that do NOT
 * spawn jscpd (smoke, --help, arg parsing, bad baselines).
 *
 * Why we never spawn the real jscpd here:
 *   A real full scan is ~10s and needs the whole src/ tree present. Instead we
 *   unit-test the pure fns + I/O fns against tempdir fixtures, and drive the
 *   no-scan CLI legs (smoke/help/errors) via spawnSync with a
 *   JSCPD_BASELINE_FILE env override. The scan-driven legs (runFull/runDiff/
 *   writeBaseline) are exercised end-to-end by the pre-commit hook + CI, not
 *   by this suite — mirrors scripts/__tests__/check-ssot-discover-ratchet.test.js.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_UNDER_TEST = path.resolve(__dirname, '..', 'check-jscpd-ratchet.js');

const {
  parseArgs,
  parseSummary,
  normalizeName,
  loadBaseline,
  writeBaseline,
  compare,
  getBaselineFile,
  getScanRoot,
  TRACKED_METRICS,
  DEFAULT_BASELINE_FILE,
  CONFIG_FILE,
} = require(SCRIPT_UNDER_TEST);

let TMP_ROOT;
let tmpCounter = 0;
function nextTmpBaseline() {
  tmpCounter += 1;
  return path.join(TMP_ROOT, `baseline-${tmpCounter}-${process.pid}.json`);
}

beforeAll(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-ratchet-test-'));
});
afterAll(() => {
  if (TMP_ROOT && fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});

let savedEnv;
beforeEach(() => {
  savedEnv = {
    JSCPD_BASELINE_FILE: process.env.JSCPD_BASELINE_FILE,
    JSCPD_FULL: process.env.JSCPD_FULL,
    JSCPD_SCAN_ROOT: process.env.JSCPD_SCAN_ROOT,
  };
  delete process.env.JSCPD_BASELINE_FILE;
  delete process.env.JSCPD_FULL;
  delete process.env.JSCPD_SCAN_ROOT;
});
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

// A well-formed jscpd JSON report skeleton, parameterised by clone count.
function fakeReport(clones, extra = {}) {
  return {
    duplicates: extra.duplicates ?? [],
    statistics: {
      total: {
        clones,
        duplicatedLines: extra.duplicatedLines ?? clones * 10,
        percentage: extra.percentage ?? 3.5,
        sources: extra.sources ?? 100,
      },
    },
  };
}

// =============================================================================
// Group 1 — parseArgs(argv)
// =============================================================================
describe('parseArgs', () => {
  const A = (...rest) => parseArgs(['node', 'script', ...rest]);

  it('defaults to smoke (no flags)', () => {
    expect(A()).toEqual({ full: false, diff: false, writeBaseline: false, help: false, files: [] });
  });

  it('parses --full', () => {
    expect(A('--full').full).toBe(true);
  });

  it('parses --diff and collects positional files', () => {
    const out = A('--diff', 'src/a.ts', 'src/b.tsx');
    expect(out.diff).toBe(true);
    expect(out.files).toEqual(['src/a.ts', 'src/b.tsx']);
  });

  it('parses --write-baseline', () => {
    expect(A('--write-baseline').writeBaseline).toBe(true);
  });

  it('parses --help and -h', () => {
    expect(A('--help').help).toBe(true);
    expect(A('-h').help).toBe(true);
  });

  it('JSCPD_FULL=1 forces full even without the flag', () => {
    process.env.JSCPD_FULL = '1';
    expect(A().full).toBe(true);
  });

  it('throws on an unknown -- flag', () => {
    expect(() => A('--nope')).toThrow(/Unknown argument: --nope/);
  });

  it('treats a bare token as a file, not a flag', () => {
    expect(A('src/only.ts').files).toEqual(['src/only.ts']);
  });
});

// =============================================================================
// Group 2 — parseSummary(report)
// =============================================================================
describe('parseSummary', () => {
  it('reads clones + context fields from a valid report', () => {
    expect(parseSummary(fakeReport(4548, { duplicatedLines: 58309, percentage: 3.9162, sources: 8833 }))).toEqual({
      clones: 4548,
      duplicatedLines: 58309,
      percentage: 3.9162,
      sources: 8833,
    });
  });

  it('defaults missing context fields to 0', () => {
    const report = { statistics: { total: { clones: 3 } } };
    expect(parseSummary(report)).toEqual({ clones: 3, duplicatedLines: 0, percentage: 0, sources: 0 });
  });

  it('throws when statistics.total is absent', () => {
    expect(() => parseSummary({ statistics: {} })).toThrow(/statistics\.total\.clones/);
  });

  it('throws when clones is not numeric', () => {
    expect(() => parseSummary({ statistics: { total: { clones: 'x' } } })).toThrow(/statistics\.total\.clones/);
  });

  it('throws on a null report', () => {
    expect(() => parseSummary(null)).toThrow(/statistics\.total\.clones/);
  });
});

// =============================================================================
// Group 3 — normalizeName(name)
// =============================================================================
describe('normalizeName', () => {
  it('returns (unknown) for empty/undefined', () => {
    expect(normalizeName('')).toBe('(unknown)');
    expect(normalizeName(undefined)).toBe('(unknown)');
  });

  it('strips the Windows \\\\?\\ long-path prefix and backslashes', () => {
    const root = path.resolve(__dirname, '..', '..');
    const abs = `\\\\?\\${root}\\src\\a\\b.ts`;
    expect(normalizeName(abs)).toBe('src/a/b.ts');
  });

  it('makes an absolute repo path relative to the project root', () => {
    const root = path.resolve(__dirname, '..', '..');
    expect(normalizeName(`${root}/src/x/y.tsx`)).toBe('src/x/y.tsx');
  });

  it('leaves an already-relative path untouched (only slash-normalised)', () => {
    expect(normalizeName('src\\rel\\path.ts')).toBe('src/rel/path.ts');
  });
});

// =============================================================================
// Group 4 — loadBaseline(filePath)
// =============================================================================
describe('loadBaseline', () => {
  it('returns null when the file is missing', () => {
    expect(loadBaseline(path.join(TMP_ROOT, 'nope.json'))).toBeNull();
  });

  it('loads a valid baseline', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ clones: 4548 }));
    expect(loadBaseline(f)).toMatchObject({ clones: 4548 });
  });

  it('flags invalid JSON', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, '{ not json');
    expect(loadBaseline(f).__invalid).toMatch(/invalid JSON/);
  });

  it('flags a baseline missing the tracked clones field', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ duplicatedLines: 10 }));
    expect(loadBaseline(f).__invalid).toMatch(/missing numeric field "clones"/);
  });

  it('flags a non-numeric clones field', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ clones: '4548' }));
    expect(loadBaseline(f).__invalid).toMatch(/missing numeric field "clones"/);
  });
});

// =============================================================================
// Group 5 — writeBaseline(counts, filePath) round-trip
// =============================================================================
describe('writeBaseline', () => {
  const counts = { clones: 4548, duplicatedLines: 58309, percentage: 3.9162, sources: 8833 };

  it('writes a JSON baseline that loadBaseline can read back', () => {
    const f = nextTmpBaseline();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      writeBaseline(counts, f);
    } finally {
      logSpy.mockRestore();
    }
    const back = loadBaseline(f);
    expect(back.clones).toBe(4548);
    expect(back.check).toBe('CHECK 3.28');
    expect(back.adr).toBe('ADR-584');
    expect(typeof back.generatedAt).toBe('string');
  });

  it('rounds percentage to 4 decimals', () => {
    const f = nextTmpBaseline();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      writeBaseline({ ...counts, percentage: 3.916073301875 }, f);
    } finally {
      logSpy.mockRestore();
    }
    expect(loadBaseline(f).percentage).toBe(3.9161);
  });
});

// =============================================================================
// Group 6 — compare(baseline, current) ratchet semantics
// =============================================================================
describe('compare', () => {
  it('reports no raise when clones stay equal', () => {
    expect(compare({ clones: 4548 }, { clones: 4548 })).toEqual([]);
  });

  it('reports no raise when clones drop (cleanup)', () => {
    expect(compare({ clones: 4548 }, { clones: 4500 })).toEqual([]);
  });

  it('reports a raise with delta when clones rise', () => {
    expect(compare({ clones: 4548 }, { clones: 4550 })).toEqual([
      { metric: 'clones', baseline: 4548, current: 4550, delta: 2 },
    ]);
  });

  it('only ever tracks the clones metric', () => {
    expect(TRACKED_METRICS).toEqual(['clones']);
  });
});

// =============================================================================
// Group 7 — env-driven helpers
// =============================================================================
describe('getBaselineFile / getScanRoot', () => {
  it('defaults the baseline path to .jscpd-baseline.json', () => {
    expect(getBaselineFile()).toBe(DEFAULT_BASELINE_FILE);
  });

  it('honours JSCPD_BASELINE_FILE override', () => {
    const f = nextTmpBaseline();
    process.env.JSCPD_BASELINE_FILE = f;
    expect(getBaselineFile()).toBe(path.resolve(f));
  });

  it('defaults the scan root to src', () => {
    expect(getScanRoot()).toBe('src');
  });

  it('honours JSCPD_SCAN_ROOT override', () => {
    process.env.JSCPD_SCAN_ROOT = 'src/subapps';
    expect(getScanRoot()).toBe('src/subapps');
  });
});

// =============================================================================
// Group 8 — CLI integration (no real jscpd spawn)
// =============================================================================
describe('CLI (no-scan legs)', () => {
  function run(args, env = {}) {
    return spawnSync('node', [SCRIPT_UNDER_TEST, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
  }

  it('--help exits 0 and prints usage + config pointer', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/CHECK 3\.28/);
    expect(r.stdout).toMatch(/\.jscpdrc\.json/);
  });

  it('smoke passes with a valid baseline (no scan)', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, JSON.stringify({ clones: 4548 }));
    const r = run([], { JSCPD_BASELINE_FILE: f });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/smoke.*clones:4548/);
  });

  it('smoke fails when the baseline is missing', () => {
    const r = run([], { JSCPD_BASELINE_FILE: path.join(TMP_ROOT, 'ghost.json') });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/baseline missing/);
  });

  it('smoke fails when the baseline is invalid JSON', () => {
    const f = nextTmpBaseline();
    fs.writeFileSync(f, '{ broken');
    const r = run([], { JSCPD_BASELINE_FILE: f });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/invalid JSON/);
  });

  it('unknown flag exits non-zero', () => {
    const r = run(['--bogus']);
    expect(r.status).not.toBe(0);
  });
});

// =============================================================================
// Group 9 — config + baseline are wired to the real repo files
// =============================================================================
describe('repo wiring', () => {
  it('points at the checked-in .jscpdrc.json', () => {
    expect(fs.existsSync(CONFIG_FILE)).toBe(true);
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    expect(cfg.minTokens).toBe(50);
    expect(cfg.format).toEqual(expect.arrayContaining(['typescript', 'tsx']));
  });

  it('ships a valid, in-range baseline', () => {
    const b = loadBaseline(DEFAULT_BASELINE_FILE);
    expect(b).not.toBeNull();
    expect(b.__invalid).toBeUndefined();
    expect(typeof b.clones).toBe('number');
    expect(b.clones).toBeGreaterThanOrEqual(0);
  });
});
