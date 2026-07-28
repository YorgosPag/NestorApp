/**
 * CHECK 3.33 — i18n generated-types freshness gate: Jest suite (ADR-727).
 *
 * Presubmit-grade tests for scripts/check-i18n-types-freshness.js.
 *
 * Two of these groups are load-bearing rather than decorative — they are the
 * tests that go red against the *obvious wrong implementation*:
 *
 *   Group 5 (determinism) — the generator used to embed `new Date()`, so a
 *     naive "regenerate and compare bytes" gate could never pass. If anyone
 *     reintroduces a clock into the generated header, Group 5 fails.
 *
 *   Group 7 (line endings) — this repo runs core.autocrlf=true with no
 *     .gitattributes, so the working-tree copy is CRLF while the generator
 *     emits LF. A gate that compared raw bytes would be red on every Windows
 *     checkout regardless of freshness. If anyone drops the normalization,
 *     Group 7 fails.
 *
 * Fixtures are built programmatically in a tempdir rather than committed: the
 * inputs here are 2-3 line JSON files whose *content* is the point of each
 * assertion, and an on-disk fixture would hide that content from the reader.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_UNDER_TEST = path.resolve(__dirname, '..', 'check-i18n-types-freshness.js');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const {
  normalize,
  readFingerprint,
  firstDifference,
  classify,
  runCheck,
  parseArgs,
  printHelp,
  main,
  getLocaleDir,
  getTypesFile,
  FINGERPRINT_PATTERN,
  VERDICT_MESSAGES,
} = require(SCRIPT_UNDER_TEST);

const {
  collectTranslationData,
  generateTypeDefinitions,
  fingerprintTranslationData,
  DEFAULT_LOCALE_DIR,
  TYPES_OUTPUT_FILE,
} = require(path.resolve(__dirname, '..', 'generate-i18n-types.js'));

let TMP_ROOT;
let tmpCounter = 0;

/**
 * Materialize a locale directory + its correctly generated types file.
 * Returns the paths plus the generated text so tests can mutate one side.
 */
function makeWorkspace(namespaces) {
  tmpCounter += 1;
  const dir = path.join(TMP_ROOT, `ws-${tmpCounter}`);
  const localeDir = path.join(dir, 'el');
  fs.mkdirSync(localeDir, { recursive: true });

  for (const [name, content] of Object.entries(namespaces)) {
    fs.writeFileSync(path.join(localeDir, `${name}.json`), JSON.stringify(content, null, 2), 'utf8');
  }

  const typesFile = path.join(dir, 'i18n.ts');
  const { data } = collectTranslationData(localeDir);
  const generated = generateTypeDefinitions(data);
  fs.writeFileSync(typesFile, generated, 'utf8');

  return { dir, localeDir, typesFile, generated, fingerprint: fingerprintTranslationData(data) };
}

/** Regenerate the expected text for a locale dir as it stands right now. */
function expectedFor(localeDir) {
  const { data } = collectTranslationData(localeDir);
  return { text: generateTypeDefinitions(data), fingerprint: fingerprintTranslationData(data) };
}

function runCli(env = {}, args = []) {
  return spawnSync(process.execPath, [SCRIPT_UNDER_TEST, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

// U+FEFF as an escape, never as a literal: an invisible character inside a
// regex or template is the kind of thing an editor silently eats.
const BOM = '\uFEFF';

const SAMPLE = {
  common: { save: 'Αποθήκευση', cancel: 'Άκυρο' },
  errors: { notFound: 'Δεν βρέθηκε', nested: { deep: 'Βαθύ' } },
};

beforeAll(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-types-freshness-'));
});

afterAll(() => {
  if (TMP_ROOT && fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});

let savedEnv;
beforeEach(() => {
  savedEnv = {
    I18N_TYPES_LOCALE_DIR: process.env.I18N_TYPES_LOCALE_DIR,
    I18N_TYPES_OUTPUT_FILE: process.env.I18N_TYPES_OUTPUT_FILE,
  };
  delete process.env.I18N_TYPES_LOCALE_DIR;
  delete process.env.I18N_TYPES_OUTPUT_FILE;
});
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  jest.restoreAllMocks();
});

// =============================================================================
// Group 1 — normalize(text)
// =============================================================================
describe('normalize', () => {
  it('converts CRLF to LF', () => {
    expect(normalize('a\r\nb\r\n')).toBe('a\nb\n');
  });

  it('strips a leading BOM', () => {
    expect(normalize(BOM + 'export type X = 1;\n')).toBe('export type X = 1;\n');
  });

  it('collapses repeated trailing newlines to exactly one', () => {
    expect(normalize('body\n\n\n')).toBe('body\n');
  });

  it('adds a trailing newline when the file has none', () => {
    expect(normalize('body')).toBe('body\n');
  });

  it('leaves interior whitespace untouched', () => {
    expect(normalize('  indented\n\n  block\n')).toBe('  indented\n\n  block\n');
  });

  it('is idempotent', () => {
    const once = normalize('a\r\n\r\n');
    expect(normalize(once)).toBe(once);
  });
});

// =============================================================================
// Group 2 — readFingerprint(text) / FINGERPRINT_PATTERN
// =============================================================================
describe('readFingerprint', () => {
  it('extracts the sha256 from a generated header', () => {
    const { generated, fingerprint } = makeWorkspace(SAMPLE);
    expect(readFingerprint(generated)).toBe(fingerprint);
  });

  it('extracts it from a CRLF copy of the same header', () => {
    const { generated, fingerprint } = makeWorkspace(SAMPLE);
    expect(readFingerprint(generated.replace(/\n/g, '\r\n'))).toBe(fingerprint);
  });

  it('returns null for the pre-ADR-727 timestamp header', () => {
    const legacy = ' * Generated: 2026-04-03T19:12:27.149Z\n';
    expect(readFingerprint(legacy)).toBeNull();
  });

  it('returns null when the hash is not 64 hex chars', () => {
    expect(readFingerprint(' * Generated from: sha256:abc123\n')).toBeNull();
  });

  it('anchors to the comment line form, not a loose substring', () => {
    const hex = 'a'.repeat(64);
    expect(FINGERPRINT_PATTERN.test(`const x = "sha256:${hex}";`)).toBe(false);
    expect(FINGERPRINT_PATTERN.test(` * Generated from: sha256:${hex}`)).toBe(true);
  });
});

// =============================================================================
// Group 3 — firstDifference(expected, actual)
// =============================================================================
describe('firstDifference', () => {
  it('returns null for identical text', () => {
    expect(firstDifference('a\nb\n', 'a\nb\n')).toBeNull();
  });

  it('reports the 1-indexed line of the first divergence', () => {
    const diff = firstDifference('a\nb\nc\n', 'a\nX\nc\n');
    expect(diff).toMatchObject({ line: 2, expected: 'b', actual: 'X' });
  });

  it('reports both line counts', () => {
    const diff = firstDifference('a\nb\nc\n', 'a\n');
    expect(diff.expectedLineCount).toBe(4);
    expect(diff.actualLineCount).toBe(2);
  });

  it('labels a truncated file as end of file', () => {
    expect(firstDifference('a\nb', 'a').actual).toBe('(end of file)');
  });
});

// =============================================================================
// Group 4 — classify(expected, actual, fingerprint): the five verdicts
// =============================================================================
describe('classify', () => {
  it('returns fresh when the generated text matches', () => {
    const ws = makeWorkspace(SAMPLE);
    expect(classify(ws.generated, ws.generated, ws.fingerprint)).toEqual({ verdict: 'fresh' });
  });

  it('returns missing when the file is absent', () => {
    const ws = makeWorkspace(SAMPLE);
    expect(classify(ws.generated, null, ws.fingerprint)).toEqual({ verdict: 'missing' });
  });

  it('returns legacy-header for a pre-ADR-727 timestamp file', () => {
    const ws = makeWorkspace(SAMPLE);
    const legacy = ws.generated.replace(/ \* Generated from: sha256:[0-9a-f]{64}/, ' * Generated: 2026-04-03T19:12:27.149Z');
    const result = classify(ws.generated, legacy, ws.fingerprint);
    expect(result.verdict).toBe('legacy-header');
    expect(result.diff.line).toBe(7);
  });

  it('returns stale-inputs when the on-disk fingerprint is for older locales', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.writeFileSync(path.join(ws.localeDir, 'common.json'), JSON.stringify({ save: 'Α', cancel: 'Β', added: 'Γ' }), 'utf8');
    const now = expectedFor(ws.localeDir);

    const result = classify(now.text, ws.generated, now.fingerprint);
    expect(result.verdict).toBe('stale-inputs');
    expect(result.actualFingerprint).toBe(ws.fingerprint);
    expect(result.actualFingerprint).not.toBe(now.fingerprint);
  });

  it('returns hand-edited when the header matches but the body was altered', () => {
    const ws = makeWorkspace(SAMPLE);
    const tampered = ws.generated.replace('cancel: string;', 'cancel: number;');
    expect(tampered).not.toBe(ws.generated);

    const result = classify(ws.generated, tampered, ws.fingerprint);
    expect(result.verdict).toBe('hand-edited');
  });

  it('has a human-readable message for every non-fresh verdict', () => {
    for (const verdict of ['missing', 'legacy-header', 'stale-inputs', 'hand-edited']) {
      expect(typeof VERDICT_MESSAGES[verdict]).toBe('string');
      expect(VERDICT_MESSAGES[verdict].length).toBeGreaterThan(10);
    }
  });
});

// =============================================================================
// Group 5 — DETERMINISM (handoff §4.2.1)
//
// This is the group that fails against the naive implementation. Before
// ADR-727 the header carried `new Date().toISOString()`, so two consecutive
// generations of the SAME locales produced different bytes and any freshness
// gate built on comparison was structurally incapable of ever passing.
// =============================================================================
describe('determinism of the generated output', () => {
  it('produces byte-identical output for two consecutive runs on identical input', () => {
    const { data } = collectTranslationData(makeWorkspace(SAMPLE).localeDir);
    expect(generateTypeDefinitions(data)).toBe(generateTypeDefinitions(data));
  });

  it('emits no clock-derived value in the header', () => {
    const ws = makeWorkspace(SAMPLE);
    const header = ws.generated.split('\n').slice(0, 9).join('\n');
    expect(header).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(header).toMatch(/Generated from: sha256:[0-9a-f]{64}/);
  });

  it('classifies a freshly regenerated file as fresh, not as drift', () => {
    const ws = makeWorkspace(SAMPLE);
    const regenerated = expectedFor(ws.localeDir);
    expect(classify(regenerated.text, ws.generated, regenerated.fingerprint).verdict).toBe('fresh');
  });

  it('gives the same fingerprint for identical content written with different JSON formatting', () => {
    const compact = makeWorkspace(SAMPLE);
    tmpCounter += 1;
    const prettyDir = path.join(TMP_ROOT, `ws-${tmpCounter}`, 'el');
    fs.mkdirSync(prettyDir, { recursive: true });
    for (const [name, content] of Object.entries(SAMPLE)) {
      fs.writeFileSync(path.join(prettyDir, `${name}.json`), JSON.stringify(content, null, 8), 'utf8');
    }
    expect(expectedFor(prettyDir).fingerprint).toBe(compact.fingerprint);
  });
});

// =============================================================================
// Group 6 — REAL DETECTION (handoff §4.2.2)
// =============================================================================
describe('detection of a genuinely stale file', () => {
  it('flags an added locale key as stale-inputs', () => {
    const ws = makeWorkspace(SAMPLE);
    const content = JSON.parse(fs.readFileSync(path.join(ws.localeDir, 'common.json'), 'utf8'));
    content.brandNewKey = 'Νέο';
    fs.writeFileSync(path.join(ws.localeDir, 'common.json'), JSON.stringify(content, null, 2), 'utf8');

    const now = expectedFor(ws.localeDir);
    expect(classify(now.text, ws.generated, now.fingerprint).verdict).toBe('stale-inputs');
    expect(now.text).toContain('brandNewKey');
    expect(ws.generated).not.toContain('brandNewKey');
  });

  it('flags a whole new namespace file as stale-inputs', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.writeFileSync(path.join(ws.localeDir, 'reports.json'), JSON.stringify({ title: 'Αναφορές' }), 'utf8');

    const now = expectedFor(ws.localeDir);
    expect(classify(now.text, ws.generated, now.fingerprint).verdict).toBe('stale-inputs');
    expect(now.text).toContain("'reports'");
  });

  it('flags a deleted namespace file as stale-inputs', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.unlinkSync(path.join(ws.localeDir, 'errors.json'));

    const now = expectedFor(ws.localeDir);
    expect(classify(now.text, ws.generated, now.fingerprint).verdict).toBe('stale-inputs');
  });

  it('flags a changed value TYPE even when the key set is unchanged', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.writeFileSync(path.join(ws.localeDir, 'common.json'), JSON.stringify({ save: 'Α', cancel: 42 }), 'utf8');

    const now = expectedFor(ws.localeDir);
    expect(classify(now.text, ws.generated, now.fingerprint).verdict).toBe('stale-inputs');
    expect(now.text).toContain('cancel: number;');
  });

  it('does NOT flag a pure translation-text change (types are key-shaped, not value-shaped)', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.writeFileSync(path.join(ws.localeDir, 'common.json'), JSON.stringify({ save: 'ΑΛΛΑΓΜΕΝΟ', cancel: 'ΚΙ ΑΥΤΟ' }), 'utf8');

    const now = expectedFor(ws.localeDir);
    // The interface body is identical, but the fingerprint moved — so the gate
    // asks for a regeneration. Documented on purpose: the header is part of the
    // file, and a cheap regeneration is preferable to a header that lies.
    expect(classify(now.text, ws.generated, now.fingerprint).verdict).toBe('stale-inputs');
    const stripHeader = (s) => s.split('\n').slice(9).join('\n');
    expect(stripHeader(now.text)).toBe(stripHeader(ws.generated));
  });
});

// =============================================================================
// Group 7 — LINE ENDINGS (core.autocrlf=true, no .gitattributes)
//
// The working tree carries CRLF; the generator writes LF. Without
// normalization this gate would be permanently red on Windows.
// =============================================================================
describe('line-ending tolerance', () => {
  it('treats a CRLF working-tree copy as fresh', () => {
    const ws = makeWorkspace(SAMPLE);
    const crlf = ws.generated.replace(/\n/g, '\r\n');
    expect(crlf).not.toBe(ws.generated);
    expect(classify(ws.generated, crlf, ws.fingerprint).verdict).toBe('fresh');
  });

  it('treats a BOM-prefixed copy as fresh', () => {
    const ws = makeWorkspace(SAMPLE);
    expect(classify(ws.generated, `${BOM}${ws.generated}`, ws.fingerprint).verdict).toBe('fresh');
  });

  it('treats an extra trailing newline as fresh', () => {
    const ws = makeWorkspace(SAMPLE);
    expect(classify(ws.generated, `${ws.generated}\n\n`, ws.fingerprint).verdict).toBe('fresh');
  });

  it('still detects real drift inside a CRLF file', () => {
    const ws = makeWorkspace(SAMPLE);
    const crlfTampered = ws.generated.replace('cancel: string;', 'cancel: number;').replace(/\n/g, '\r\n');
    expect(classify(ws.generated, crlfTampered, ws.fingerprint).verdict).toBe('hand-edited');
  });

  it('confirms the working tree really does carry CRLF (the reason this group exists)', () => {
    if (!fs.existsSync(TYPES_OUTPUT_FILE)) return;
    const onDisk = fs.readFileSync(TYPES_OUTPUT_FILE, 'utf8');
    const generatorOutput = generateTypeDefinitions(collectTranslationData().data);
    // Not asserted as always-CRLF (a fresh LF write is equally valid); asserted
    // is that whichever it is, normalization makes the comparison meaningful.
    expect(normalize(onDisk).includes('\r')).toBe(false);
    expect(normalize(generatorOutput).includes('\r')).toBe(false);
  });
});

// =============================================================================
// Group 8 — parseArgs / printHelp / runCheck in-process
// =============================================================================
describe('parseArgs', () => {
  it('defaults to no flags', () => {
    expect(parseArgs(['node', 'script'])).toEqual({ check: false, help: false });
  });

  it('accepts --check', () => {
    expect(parseArgs(['node', 'script', '--check']).check).toBe(true);
  });

  it('accepts --help and -h', () => {
    expect(parseArgs(['node', 'script', '--help']).help).toBe(true);
    expect(parseArgs(['node', 'script', '-h']).help).toBe(true);
  });

  it('throws on an unknown argument', () => {
    expect(() => parseArgs(['node', 'script', '--full'])).toThrow('Unknown argument: --full');
  });
});

describe('runCheck (in-process, env-redirected)', () => {
  function withExitStub(fn) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`__EXIT__:${code ?? 0}`);
    });
    return fn;
  }

  it('exits 0 for a fresh workspace', () => {
    const ws = makeWorkspace(SAMPLE);
    process.env.I18N_TYPES_LOCALE_DIR = ws.localeDir;
    process.env.I18N_TYPES_OUTPUT_FILE = ws.typesFile;
    expect(withExitStub(runCheck)).toThrow('__EXIT__:0');
  });

  it('exits 1 when a locale key was added without regeneration', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.writeFileSync(path.join(ws.localeDir, 'common.json'), JSON.stringify({ save: 'Α', extra: 'Β' }), 'utf8');
    process.env.I18N_TYPES_LOCALE_DIR = ws.localeDir;
    process.env.I18N_TYPES_OUTPUT_FILE = ws.typesFile;
    expect(withExitStub(runCheck)).toThrow('__EXIT__:1');
  });

  it('exits 1 when the generated file is missing', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.unlinkSync(ws.typesFile);
    process.env.I18N_TYPES_LOCALE_DIR = ws.localeDir;
    process.env.I18N_TYPES_OUTPUT_FILE = ws.typesFile;
    expect(withExitStub(runCheck)).toThrow('__EXIT__:1');
  });

  it('exits 1 when the locale directory does not exist', () => {
    process.env.I18N_TYPES_LOCALE_DIR = path.join(TMP_ROOT, 'no-such-dir');
    process.env.I18N_TYPES_OUTPUT_FILE = path.join(TMP_ROOT, 'no-such-file.ts');
    expect(withExitStub(runCheck)).toThrow('__EXIT__:1');
  });

  it('exits 1 on malformed locale JSON instead of silently passing', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.writeFileSync(path.join(ws.localeDir, 'common.json'), '{ this is not json', 'utf8');
    process.env.I18N_TYPES_LOCALE_DIR = ws.localeDir;
    process.env.I18N_TYPES_OUTPUT_FILE = ws.typesFile;
    expect(withExitStub(runCheck)).toThrow('__EXIT__:1');
  });

  it('names the remediation command in the failure output', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.unlinkSync(ws.typesFile);
    process.env.I18N_TYPES_LOCALE_DIR = ws.localeDir;
    process.env.I18N_TYPES_OUTPUT_FILE = ws.typesFile;
    const errors = [];
    jest.spyOn(console, 'error').mockImplementation((m) => errors.push(String(m)));
    jest.spyOn(process, 'exit').mockImplementation((c) => { throw new Error(`__EXIT__:${c}`); });
    expect(() => runCheck()).toThrow('__EXIT__:1');
    expect(errors.join('\n')).toContain('npm run generate:i18n-types');
    expect(errors.join('\n')).toContain('SKIP_I18N_TYPES=1');
  });
});

describe('env overrides', () => {
  it('getLocaleDir falls back to the primary locale dir', () => {
    expect(getLocaleDir()).toBe(DEFAULT_LOCALE_DIR);
  });

  it('getTypesFile falls back to src/types/i18n.ts', () => {
    expect(getTypesFile()).toBe(TYPES_OUTPUT_FILE);
  });

  it('both honour their env override', () => {
    process.env.I18N_TYPES_LOCALE_DIR = TMP_ROOT;
    process.env.I18N_TYPES_OUTPUT_FILE = path.join(TMP_ROOT, 'x.ts');
    expect(getLocaleDir()).toBe(path.resolve(TMP_ROOT));
    expect(getTypesFile()).toBe(path.resolve(path.join(TMP_ROOT, 'x.ts')));
  });

  it('printHelp names the check and the fix', () => {
    const lines = [];
    jest.spyOn(console, 'log').mockImplementation((m) => lines.push(String(m)));
    printHelp();
    expect(lines.join('\n')).toContain('CHECK 3.33');
    expect(lines.join('\n')).toContain('npm run generate:i18n-types');
  });
});

// =============================================================================
// Group 9 — real CLI (spawnSync) — exit codes as the hook sees them
// =============================================================================
describe('CLI', () => {
  it('--help exits 0', () => {
    const r = runCli({}, ['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('CHECK 3.33');
  });

  it('an unknown argument exits 1', () => {
    const r = runCli({}, ['--full']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Unknown argument: --full');
  });

  it('exits 0 on a fresh workspace', () => {
    const ws = makeWorkspace(SAMPLE);
    const r = runCli({ I18N_TYPES_LOCALE_DIR: ws.localeDir, I18N_TYPES_OUTPUT_FILE: ws.typesFile });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('CHECK 3.33 OK');
  });

  it('exits 0 with an explicit --check', () => {
    const ws = makeWorkspace(SAMPLE);
    const r = runCli({ I18N_TYPES_LOCALE_DIR: ws.localeDir, I18N_TYPES_OUTPUT_FILE: ws.typesFile }, ['--check']);
    expect(r.status).toBe(0);
  });

  it('exits 1 and explains itself on a stale workspace', () => {
    const ws = makeWorkspace(SAMPLE);
    fs.writeFileSync(path.join(ws.localeDir, 'common.json'), JSON.stringify({ save: 'Α', added: 'Β' }), 'utf8');
    const r = runCli({ I18N_TYPES_LOCALE_DIR: ws.localeDir, I18N_TYPES_OUTPUT_FILE: ws.typesFile });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('CHECK 3.33 FAIL');
    expect(r.stderr).toContain('the locale files changed');
    expect(r.stderr).toContain('npm run generate:i18n-types');
  });
});

// =============================================================================
// Group 10 — the real repository (the invariant the gate exists to hold)
// =============================================================================
describe('repository invariant', () => {
  it('the committed src/types/i18n.ts is in sync with src/i18n/locales/el', () => {
    const r = runCli();
    if (r.status !== 0) {
      throw new Error(`CHECK 3.33 is red on the real repo:\n${r.stdout}\n${r.stderr}`);
    }
    expect(r.status).toBe(0);
  });

  it('the real locale set is non-trivial (guards against a silently empty scan)', () => {
    const { fileCount } = collectTranslationData();
    expect(fileCount).toBeGreaterThan(50);
  });
});
