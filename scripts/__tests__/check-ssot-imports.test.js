/**
 * CHECK 3.7 — SSoT Imports Ratchet: Jest test suite.
 *
 * Tests the Node.js rewrite of check-ssot-imports.sh.
 * All pure functions are unit-tested against synthetic fixtures.
 * Integration: CLI is smoke-tested via spawnSync.
 *
 * No subprocesses spawned for the core logic (all in-process).
 */

'use strict';

const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'check-ssot-imports.js');

const {
  parseFlatRegistry,
  loadBaseline,
  normalizePath,
  isAllowlisted,
  countViolations,
  collectViolationDetails,
  checkFile,
  COMMENT_RE,
  TS_EXT_RE,
} = require(SCRIPT);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip ANSI from output for assertions. */
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

let tmpRoot;
let tmpCounter = 0;

function tmpDir() {
  const dir = path.join(tmpRoot, `t${tmpCounter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function write(dir, name, content) {
  const p = path.join(dir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ssot-imports-test-'));
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// GROUP 1: normalizePath
// ---------------------------------------------------------------------------

describe('normalizePath', () => {
  test('forward slashes unchanged', () => {
    expect(normalizePath('src/foo/bar.ts')).toBe('src/foo/bar.ts');
  });

  test('backslashes converted', () => {
    expect(normalizePath('src\\foo\\bar.ts')).toBe('src/foo/bar.ts');
  });

  test('mixed slashes', () => {
    expect(normalizePath('src\\foo/bar\\baz.ts')).toBe('src/foo/bar/baz.ts');
  });
});

// ---------------------------------------------------------------------------
// GROUP 2: COMMENT_RE and TS_EXT_RE constants
// ---------------------------------------------------------------------------

describe('COMMENT_RE', () => {
  test.each([
    ['// line comment',      true],
    ['  // indented comment', true],
    [' * jsdoc line',        true],
    ['# shell comment',      true],
    ['  # indented shell',   true],
    ['const x = 1;',         false],
    ['x.collection("name")', false],
    ['',                     false],
  ])('"%s" → isComment=%s', (line, expected) => {
    expect(COMMENT_RE.test(line)).toBe(expected);
  });
});

describe('TS_EXT_RE', () => {
  test.each([
    ['foo.ts',   true],
    ['foo.tsx',  true],
    ['foo.js',   false],
    ['foo.ts.bak', false],
    ['foo.d.ts', true],
  ])('"%s" → match=%s', (file, expected) => {
    expect(TS_EXT_RE.test(file)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// GROUP 3: isAllowlisted
// ---------------------------------------------------------------------------

describe('isAllowlisted', () => {
  const allowlist = [
    'src/config/firestore-collections.ts',
    'src/config/',
    'functions/',
  ];

  test('exact match → true', () => {
    expect(isAllowlisted('src/config/firestore-collections.ts', allowlist)).toBe(true);
  });

  test('prefix match (dir) → true', () => {
    expect(isAllowlisted('src/config/other.ts', allowlist)).toBe(true);
  });

  test('prefix match (nested) → true', () => {
    expect(isAllowlisted('functions/src/index.ts', allowlist)).toBe(true);
  });

  test('no match → false', () => {
    expect(isAllowlisted('src/services/foo.ts', allowlist)).toBe(false);
  });

  test('empty allowlist → false', () => {
    expect(isAllowlisted('src/foo.ts', [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GROUP 4: parseFlatRegistry
// ---------------------------------------------------------------------------

describe('parseFlatRegistry', () => {
  const FLAT = `
EXEMPT:(__tests__/|\\.test\\.|node_modules/)
MODULE:firestore-collections
SSOT:src/config/firestore-collections.ts
PATTERN:\\.(collection|doc)\\(['"][a-z_]+['"]\\)
ALLOW:src/config/firestore-collections.ts
MODULE:enterprise-id
SSOT:src/services/enterprise-id.service.ts
PATTERN:crypto\\.randomUUID\\(\\)
ALLOW:src/services/enterprise-id.service.ts
MODULE:no-patterns
`.trim();

  let parsed;

  beforeAll(() => {
    parsed = parseFlatRegistry(FLAT);
  });

  test('exemptRe parsed', () => {
    expect(parsed.exemptRe).toBeInstanceOf(RegExp);
    expect(parsed.exemptRe.test('src/__tests__/foo.ts')).toBe(true);
    expect(parsed.exemptRe.test('src/services/foo.ts')).toBe(false);
  });

  test('modules count (no-patterns module has no re → still parsed)', () => {
    // no-patterns has no PATTERN lines → re=null → still in array
    expect(parsed.modules.length).toBe(3);
  });

  test('firestore-collections module', () => {
    const mod = parsed.modules.find(m => m.name === 'firestore-collections');
    expect(mod).toBeDefined();
    expect(mod.re).toBeInstanceOf(RegExp);
    expect(mod.re.test(".collection('users')")).toBe(true);
    expect(mod.re.test(".doc('projects')")).toBe(true);
    expect(mod.re.test('someOtherCode()')).toBe(false);
    expect(mod.allowlist).toContain('src/config/firestore-collections.ts');
  });

  test('enterprise-id module', () => {
    const mod = parsed.modules.find(m => m.name === 'enterprise-id');
    expect(mod).toBeDefined();
    expect(mod.re.test('crypto.randomUUID()')).toBe(true);
    expect(mod.re.test('someOtherFn()')).toBe(false);
  });

  test('no-patterns module has null re', () => {
    const mod = parsed.modules.find(m => m.name === 'no-patterns');
    expect(mod.re).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GROUP 5: loadBaseline
// ---------------------------------------------------------------------------

describe('loadBaseline', () => {
  test('valid baseline file', () => {
    const dir = tmpDir();
    const p = write(dir, 'baseline.json', JSON.stringify({
      _meta: { description: 'test' },
      files: { 'src/foo.ts': 2, 'src/bar.ts': 1 },
    }));
    const result = loadBaseline(p);
    expect(result.files['src/foo.ts']).toBe(2);
    expect(result.files['src/bar.ts']).toBe(1);
  });

  test('missing file → empty files', () => {
    const result = loadBaseline('/nonexistent/path.json');
    expect(result.files).toEqual({});
  });

  test('malformed JSON → empty files', () => {
    const dir = tmpDir();
    const p = write(dir, 'bad.json', 'not json {{{');
    const result = loadBaseline(p);
    expect(result.files).toEqual({});
  });

  test('missing files property → empty files', () => {
    const dir = tmpDir();
    const p = write(dir, 'nofiles.json', JSON.stringify({ _meta: {} }));
    const result = loadBaseline(p);
    expect(result.files).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// GROUP 6: countViolations
// ---------------------------------------------------------------------------

describe('countViolations', () => {
  const modules = parseFlatRegistry(`
MODULE:firestore-collections
PATTERN:\\.(collection|doc)\\(['"][a-z_]+['"]\\)
ALLOW:src/config/firestore-collections.ts
MODULE:enterprise-id
PATTERN:crypto\\.randomUUID\\(\\)
`.trim()).modules;

  test('no violations → 0', () => {
    const lines = ['const x = 1;', 'const y = doSomething();'];
    expect(countViolations(lines, 'src/foo.ts', modules)).toBe(0);
  });

  test('one firestore violation', () => {
    const lines = ["db.collection('users').get()"];
    expect(countViolations(lines, 'src/foo.ts', modules)).toBe(1);
  });

  test('two violations in two modules from same line', () => {
    // Line matches both firestore-collections AND is also a randomUUID
    const lines = ["db.collection('users').doc('x'); crypto.randomUUID()"];
    expect(countViolations(lines, 'src/foo.ts', modules)).toBe(2);
  });

  test('comment lines excluded', () => {
    const lines = [
      "// db.collection('users')",
      " * db.collection('users')",
      '# crypto.randomUUID()',
    ];
    expect(countViolations(lines, 'src/foo.ts', modules)).toBe(0);
  });

  test('allowlisted file → 0', () => {
    const lines = ["db.collection('users').get()"];
    expect(countViolations(lines, 'src/config/firestore-collections.ts', modules)).toBe(0);
  });

  test('multiple violations in same file, same module', () => {
    const lines = [
      "db.collection('users').get()",
      "db.collection('projects').get()",
      'crypto.randomUUID()',
    ];
    expect(countViolations(lines, 'src/foo.ts', modules)).toBe(3);
  });

  test('allowlist prefix match skips module', () => {
    const mods = parseFlatRegistry(`
MODULE:storage-upload
PATTERN:\\.makePublic\\(\\)
ALLOW:src/services/storage-admin/
`.trim()).modules;
    const lines = ['bucket.makePublic()'];
    // In allowlist via prefix → no violation
    expect(countViolations(lines, 'src/services/storage-admin/upload.ts', mods)).toBe(0);
    // Not in allowlist → violation
    expect(countViolations(lines, 'src/services/other.ts', mods)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GROUP 7: collectViolationDetails
// ---------------------------------------------------------------------------

describe('collectViolationDetails', () => {
  const modules = parseFlatRegistry(`
MODULE:enterprise-id
PATTERN:crypto\\.randomUUID\\(\\)
`.trim()).modules;

  test('returns formatted lines with line numbers', () => {
    const lines = ['const x = 1;', 'const id = crypto.randomUUID();', 'return id;'];
    const details = collectViolationDetails(lines, 'src/foo.ts', modules);
    expect(details).toHaveLength(1);
    expect(details[0]).toContain('[enterprise-id]');
    expect(details[0]).toContain('2:'); // line number
    expect(details[0]).toContain('crypto.randomUUID');
  });

  test('comment lines not included', () => {
    const lines = ['// crypto.randomUUID()', 'crypto.randomUUID()'];
    const details = collectViolationDetails(lines, 'src/foo.ts', modules);
    expect(details).toHaveLength(1);
    expect(details[0]).toContain('2:');
  });

  test('allowlisted file → empty', () => {
    const mods = parseFlatRegistry(`
MODULE:enterprise-id
PATTERN:crypto\\.randomUUID\\(\\)
ALLOW:src/services/enterprise-id.service.ts
`.trim()).modules;
    const lines = ['crypto.randomUUID()'];
    expect(collectViolationDetails(lines, 'src/services/enterprise-id.service.ts', mods)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GROUP 8: checkFile
// ---------------------------------------------------------------------------

describe('checkFile', () => {
  const modules = parseFlatRegistry(`
MODULE:enterprise-id
PATTERN:crypto\\.randomUUID\\(\\)
ALLOW:src/services/enterprise-id.service.ts
`.trim()).modules;
  const exemptRe = /(__tests__|\.test\.)/;

  test('non-existent file → null', () => {
    expect(checkFile('/nonexistent.ts', modules, {}, null)).toBeNull();
  });

  test('non-TS file → null', () => {
    const dir = tmpDir();
    const p = write(dir, 'foo.js', 'crypto.randomUUID()');
    expect(checkFile(p, modules, {}, null)).toBeNull();
  });

  test('exempt file → null', () => {
    const dir = tmpDir();
    const p = write(dir, 'foo.test.ts', 'crypto.randomUUID()');
    expect(checkFile(p, modules, {}, exemptRe)).toBeNull();
  });

  test('clean file, not in baseline → clean', () => {
    const dir = tmpDir();
    const p = write(dir, 'clean.ts', 'const x = 1;');
    const r = checkFile(p, modules, {}, null);
    expect(r.kind).toBe('clean');
    expect(r.current).toBe(0);
  });

  test('new file with violation → blocked (zero tolerance)', () => {
    const dir = tmpDir();
    const p = write(dir, 'new.ts', 'const id = crypto.randomUUID();');
    const r = checkFile(p, modules, {}, null);
    expect(r.kind).toBe('blocked');
    expect(r.inBaseline).toBe(false);
    expect(r.current).toBe(1);
    expect(r.baseline).toBe(0);
  });

  test('existing baseline file, same count → same', () => {
    const dir = tmpDir();
    const p = write(dir, 'legacy.ts', 'crypto.randomUUID()');
    const norm = normalizePath(p);
    const r = checkFile(p, modules, { [norm]: 1 }, null);
    expect(r.kind).toBe('same');
  });

  test('existing file, count decreased → ratchet-down', () => {
    const dir = tmpDir();
    const p = write(dir, 'improved.ts', 'const x = 1;'); // 0 violations
    const norm = normalizePath(p);
    const r = checkFile(p, modules, { [norm]: 2 }, null);
    expect(r.kind).toBe('ratchet-down');
    expect(r.current).toBe(0);
    expect(r.baseline).toBe(2);
  });

  test('existing file, count increased → blocked (inBaseline=true)', () => {
    const dir = tmpDir();
    const p = write(dir, 'worse.ts', [
      'crypto.randomUUID()',
      'crypto.randomUUID()',
    ].join('\n'));
    const norm = normalizePath(p);
    const r = checkFile(p, modules, { [norm]: 1 }, null);
    expect(r.kind).toBe('blocked');
    expect(r.inBaseline).toBe(true);
    expect(r.current).toBe(2);
    expect(r.baseline).toBe(1);
  });

  test('details populated on block', () => {
    const dir = tmpDir();
    const p = write(dir, 'blocked.ts', 'const id = crypto.randomUUID();');
    const r = checkFile(p, modules, {}, null);
    expect(r.details).toBeDefined();
    expect(r.details.length).toBeGreaterThan(0);
    expect(r.details[0]).toContain('[enterprise-id]');
  });
});

// ---------------------------------------------------------------------------
// GROUP 9: CLI integration (spawnSync)
// ---------------------------------------------------------------------------

describe('CLI integration', () => {
  function runCLI(args, cwd) {
    return spawnSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
  }

  test('no args → exit 0', () => {
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  test('missing flat file → exit 0 with warning', () => {
    const dir = tmpDir();
    const f = write(dir, 'foo.ts', 'const x = 1;');
    const result = runCLI([f], dir);
    expect(result.status).toBe(0);
    expect(stripAnsi(result.stdout)).toContain('SSoT flat registry not found');
  });

  test('missing baseline → exit 0 with warning', () => {
    const dir = tmpDir();
    write(dir, '.ssot-registry-flat.txt', 'EXEMPT:__tests__\nMODULE:m\nPATTERN:x\n');
    const f = write(dir, 'foo.ts', 'const x = 1;');
    const result = runCLI([f], dir);
    expect(result.status).toBe(0);
    expect(stripAnsi(result.stdout)).toContain('SSoT baseline not found');
  });

  test('clean file → exit 0, no output', () => {
    const dir = tmpDir();
    write(dir, '.ssot-registry-flat.txt', 'EXEMPT:__tests__\nMODULE:enterprise-id\nPATTERN:crypto\\.randomUUID\\(\\)\n');
    write(dir, '.ssot-violations-baseline.json', JSON.stringify({ files: {} }));
    const f = write(dir, 'clean.ts', 'const x = 1;');
    const result = runCLI([f], dir);
    expect(result.status).toBe(0);
    expect(stripAnsi(result.stdout).trim()).toBe('');
  });

  test('new file with violation → exit 1, BLOCKED message', () => {
    const dir = tmpDir();
    write(dir, '.ssot-registry-flat.txt', 'EXEMPT:__tests__\nMODULE:enterprise-id\nPATTERN:crypto\\.randomUUID\\(\\)\n');
    write(dir, '.ssot-violations-baseline.json', JSON.stringify({ files: {} }));
    const f = write(dir, 'bad.ts', 'const id = crypto.randomUUID();');
    const result = runCLI([f], dir);
    expect(result.status).toBe(1);
    expect(stripAnsi(result.stdout)).toContain('COMMIT BLOCKED');
    expect(stripAnsi(result.stdout)).toContain('NEW FILE');
  });

  test('ratchet-down → exit 0, shows progress', () => {
    const dir = tmpDir();
    write(dir, '.ssot-registry-flat.txt', 'EXEMPT:__tests__\nMODULE:enterprise-id\nPATTERN:crypto\\.randomUUID\\(\\)\n');
    const f = write(dir, 'improved.ts', 'const x = 1;'); // 0 violations
    const normalized = normalizePath(f);
    write(dir, '.ssot-violations-baseline.json', JSON.stringify({ files: { [normalized]: 3 } }));
    const result = runCLI([f], dir);
    expect(result.status).toBe(0);
    expect(stripAnsi(result.stdout)).toContain('RATCHET DOWN');
    expect(stripAnsi(result.stdout)).toContain('3 → 0 (-3)');
  });
});
