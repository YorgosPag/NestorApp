/**
 * =============================================================================
 * CHECK 3.7 — SSoT Imports Ratchet: σουίτα δοκιμών (ADR-749)
 * =============================================================================
 *
 * Δοκιμάζει τον **ενοποιημένο πυρήνα** (`lib/ssot/*`) και την πύλη που τον
 * καταναλώνει. Καθεμία από τις ομάδες «🔴 ΠΕΡΙΣΤΑΤΙΚΟ» κωδικοποιεί σφάλμα που
 * **συνέβη** και μετρήθηκε — όχι υποθετικό σενάριο.
 *
 * @see ADR-749 — SSoT violation engine unification
 * @see ADR-294 — SSoT Ratchet Enforcement
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'check-ssot-imports.js');

const {
  loadRegistry, compilePattern, findForeignDialect,
  normalizePath, isAllowlisted, COMMENT_RE, TS_EXT_RE,
} = require('../lib/ssot/registry');
const { analyzeFile } = require('../lib/ssot/scan');
const { loadBaseline, compareFile, writeBaseline, SCHEMA_VERSION } = require('../lib/ssot/baseline');

// ---------------------------------------------------------------------------
// Βοηθητικά
// ---------------------------------------------------------------------------

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

/** Χτίζει modules χωρίς να αγγίζει τον δίσκο (μέσω του ΠΡΑΓΜΑΤΙΚΟΥ compiler). */
function makeModules(spec) {
  return Object.entries(spec).map(([name, m]) => ({
    name,
    patterns: (m.forbiddenPatterns || []).map((p, i) => compilePattern(name, i, p)),
    allowlist: (m.allowlist || []).map(normalizePath),
  }));
}

function countsOf(content, file, spec) {
  return analyzeFile(content, file, makeModules(spec)).counts;
}

beforeAll(() => { tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ssot-imports-test-')); });
afterAll(() => { fs.rmSync(tmpRoot, { recursive: true, force: true }); });

// ===========================================================================
// ΟΜΑΔΑ 1 — βασικά εργαλεία διαδρομών
// ===========================================================================
describe('normalizePath', () => {
  test('οι forward slashes μένουν', () => expect(normalizePath('src/a/b.ts')).toBe('src/a/b.ts'));
  test('τα backslashes γίνονται forward', () => expect(normalizePath('src\\a\\b.ts')).toBe('src/a/b.ts'));
  test('μεικτά', () => expect(normalizePath('src\\a/b.ts')).toBe('src/a/b.ts'));
});

describe('COMMENT_RE / TS_EXT_RE', () => {
  test.each(['// σχόλιο', '  // εσοχή', ' * jsdoc', '# shell'])('«%s» είναι σχόλιο', l =>
    expect(COMMENT_RE.test(l)).toBe(true));
  test.each(['const x = 1;', 'a.b(); // τέλος γραμμής'])('«%s» δεν είναι σχόλιο', l =>
    expect(COMMENT_RE.test(l)).toBe(false));
  test.each(['a.ts', 'a.tsx'])('%s ελέγχεται', f => expect(TS_EXT_RE.test(f)).toBe(true));
  test.each(['a.js', 'a.json', 'a.md', 'a.tsxx'])('%s δεν ελέγχεται', f =>
    expect(TS_EXT_RE.test(f)).toBe(false));
});

describe('isAllowlisted', () => {
  const allow = ['src/a/exact.ts', 'src/b/'];
  test('ακριβής διαδρομή', () => expect(isAllowlisted('src/a/exact.ts', allow)).toBe(true));
  test('πρόθεμα φακέλου', () => expect(isAllowlisted('src/b/deep/x.ts', allow)).toBe(true));
  test('άσχετο αρχείο', () => expect(isAllowlisted('src/c/x.ts', allow)).toBe(false));
  test('κενό allowlist', () => expect(isAllowlisted('src/a.ts', [])).toBe(false));
});

// ===========================================================================
// ΟΜΑΔΑ 2 — 🔴 ΠΕΡΙΣΤΑΤΙΚΟ: κλείδωμα διαλέκτου (6 νεκρά patterns, 2026-08-03)
// ===========================================================================
describe('🔴 κλείδωμα διαλέκτου — ένα pattern δεν επιτρέπεται να είναι σιωπηλά νεκρό', () => {
  test('POSIX κλάση απορρίπτεται κατά τη μεταγλώττιση', () => {
    expect(() => compilePattern('m', 0, "type:[[:space:]]*'function'")).toThrow(/δεν είναι ECMAScript/);
  });

  test('το μήνυμα λέει ΤΙ να γράψει ο συντάκτης', () => {
    expect(() => compilePattern('m', 0, 'a[[:space:]]b')).toThrow(/Γράψε \\s/);
  });

  test('έγκυρο ECMAScript περνάει', () => {
    expect(() => compilePattern('m', 0, "e\\.key\\s*===\\s*'Escape'")).not.toThrow();
  });

  test('lookahead/lookbehind είναι εγγενή ECMAScript και επιτρέπονται', () => {
    expect(findForeignDialect('X(?![^\'"]*Y)')).toEqual([]);
    expect(findForeignDialect('(?<=a)b')).toEqual([]);
  });

  test('άκυρη σύνταξη απορρίπτεται με όνομα module και δείκτη', () => {
    expect(() => compilePattern('mymod', 3, '(unclosed')).toThrow(/\[mymod\] forbiddenPatterns\[3\]/);
  });

  // Η ΑΠΟΔΕΙΞΗ: το ίδιο pattern, πριν και μετά τη μετάφραση.
  test('το [[:space:]] σε JS ΔΕΝ σημαίνει κενό — γι᾽ αυτό απαγορεύεται', () => {
    const posixAsJs = new RegExp("type:[[:space:]]*'function'");
    const ecma = new RegExp("type:\\s*'function'");
    const realLine = "  type: 'function',";
    expect(posixAsJs.test(realLine)).toBe(false);   // νεκρός φρουρός
    expect(ecma.test(realLine)).toBe(true);         // ζωντανός
  });
});

// ===========================================================================
// ΟΜΑΔΑ 3 — 🔴 ΠΕΡΙΣΤΑΤΙΚΟ: μονάδα μέτρησης (103 έναντι 86, 2026-08-03)
// ===========================================================================
describe('🔴 μονάδα μέτρησης — μία γραμμή, ένα module, ΜΙΑ παραβίαση', () => {
  const OVERLAPPING = {
    'escape-command-bus': {
      forbiddenPatterns: ["e\\.key\\s*===\\s*['\"]Escape['\"]", "key\\s*===\\s*['\"]Escape['\"]"],
    },
  };

  test('γραμμή που πιάνεται από ΔΥΟ patterns του ίδιου module μετράει 1', () => {
    const counts = countsOf("if (e.key === 'Escape') {", 'src/a.ts', OVERLAPPING);
    expect(counts.get('escape-command-bus')).toBe(1);
  });

  test('δύο διαφορετικές γραμμές μετρούν 2', () => {
    const counts = countsOf("if (e.key === 'Escape') {\nif (e.key === 'Escape') {", 'src/a.ts', OVERLAPPING);
    expect(counts.get('escape-command-bus')).toBe(2);
  });

  test('γραμμή που παραβιάζει ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ modules μετράει 1 σε καθένα', () => {
    const counts = countsOf('crypto.randomUUID();', 'src/a.ts', {
      'enterprise-id': { forbiddenPatterns: ['crypto\\.randomUUID'] },
      'no-inline-uuid': { forbiddenPatterns: ['randomUUID\\('] },
    });
    expect(counts.get('enterprise-id')).toBe(1);
    expect(counts.get('no-inline-uuid')).toBe(1);
  });

  test('τα σχόλια δεν μετρούν', () => {
    const counts = countsOf('// crypto.randomUUID();\n * crypto.randomUUID();', 'src/a.ts', {
      m: { forbiddenPatterns: ['crypto\\.randomUUID'] },
    });
    expect(counts.size).toBe(0);
  });

  test('τα allowlisted αρχεία παραλείπονται', () => {
    const counts = countsOf('crypto.randomUUID();', 'src/ok.ts', {
      m: { forbiddenPatterns: ['crypto\\.randomUUID'], allowlist: ['src/ok.ts'] },
    });
    expect(counts.size).toBe(0);
  });

  // Η πύλη τρέχει `re.test(line)` ανά γραμμή. Το παλιό golden test έτρεχε
  // `re.test(ολόκληρο κείμενο)` με σημαία `m` — ΔΕΝ είναι ισοδύναμο.
  test('τα ^ και $ αγκυρώνουν στη ΓΡΑΜΜΗ, όχι στο αρχείο', () => {
    const counts = countsOf('foo\n  ResponsiveContainer,\nbar', 'src/a.ts', {
      'chart-card-shell': { forbiddenPatterns: ['^\\s*ResponsiveContainer,?\\s*$'] },
    });
    expect(counts.get('chart-card-shell')).toBe(1);
  });

  test('τα findings καταγράφουν αριθμό γραμμής και module', () => {
    const modules = makeModules({ m: { forbiddenPatterns: ['bad'] } });
    const { findings } = analyzeFile('ok\nbad\nok', 'src/a.ts', modules, { collect: true });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ module: 'm', line: 2, text: 'bad' });
  });

  test('η ζωντάνια καταγράφει ΚΑΘΕ pattern που πιάνει, όχι μόνο το πρώτο', () => {
    const patternHits = new Map();
    analyzeFile("if (e.key === 'Escape') {", 'src/a.ts', makeModules(OVERLAPPING), { patternHits });
    expect(patternHits.get('escape-command-bus#0')).toBe(1);
    expect(patternHits.get('escape-command-bus#1')).toBe(1);
  });
});

// ===========================================================================
// ΟΜΑΔΑ 4 — 🔴 ΠΕΡΙΣΤΑΤΙΚΟ: ανταλλαγή παραβιάσεων (σχήμα v1)
// ===========================================================================
describe('🔴 ratchet ανά module — η ανταλλαγή δεν περνάει', () => {
  test('ίδιο σύνολο αλλά άλλο module ⇒ ΜΠΛΟΚ', () => {
    const current = new Map([['date-local', 2]]);
    const verdict = compareFile('src/a.ts', current, { 'escape-command-bus': 2 });
    expect(verdict.kind).toBe('blocked');
    expect(verdict.current).toBe(2);
    expect(verdict.baseline).toBe(2);          // το v1 θα έλεγε «καμία αλλαγή»
    expect(verdict.regressions).toEqual([{ module: 'date-local', current: 2, baseline: 0 }]);
  });

  test('ένα module ανεβαίνει ενώ άλλο πέφτει ⇒ ΜΠΛΟΚ (ακόμη κι αν το σύνολο πέφτει)', () => {
    const verdict = compareFile('src/a.ts', new Map([['a', 1], ['b', 2]]), { a: 5, b: 0 });
    expect(verdict.kind).toBe('blocked');
    expect(verdict.current).toBeLessThan(verdict.baseline);
  });

  test('όλα πέφτουν ⇒ ratchet-down', () => {
    expect(compareFile('src/a.ts', new Map([['a', 1]]), { a: 3 }).kind).toBe('ratchet-down');
  });

  test('αμετάβλητο ⇒ same', () => {
    expect(compareFile('src/a.ts', new Map([['a', 3]]), { a: 3 }).kind).toBe('same');
  });

  test('καθαρό και στα δύο ⇒ clean', () => {
    expect(compareFile('src/a.ts', new Map(), {}).kind).toBe('clean');
  });

  test('νέο αρχείο με παραβίαση ⇒ ΜΠΛΟΚ, μηδενική ανοχή', () => {
    const verdict = compareFile('src/new.ts', new Map([['a', 1]]), undefined);
    expect(verdict.kind).toBe('blocked');
    expect(verdict.inBaseline).toBe(false);
  });
});

// ===========================================================================
// ΟΜΑΔΑ 5 — baseline: fail-closed
// ===========================================================================
describe('baseline — fail-closed', () => {
  test('baseline σχήματος v1 απορρίπτεται (δεν διαβάζεται υποβαθμισμένα)', () => {
    const dir = tmpDir();
    const p = write(dir, 'b.json', JSON.stringify({ _meta: {}, files: { 'src/a.ts': 4 } }));
    expect(() => loadBaseline(p)).toThrow(/σχήμα 1, αναμένεται 2/);
  });

  test('baseline που λείπει ⇒ εξαίρεση', () => {
    expect(() => loadBaseline(path.join(tmpDir(), 'δεν-υπάρχει.json'))).toThrow(/δεν βρέθηκε/);
  });

  test('κατεστραμμένο JSON ⇒ εξαίρεση που ονομάζει το αρχείο', () => {
    const dir = tmpDir();
    const p = write(dir, 'b.json', '{ not json');
    expect(() => loadBaseline(p)).toThrow(/δεν διαβάζεται/);
  });

  test('έγκυρο v2 διαβάζεται', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'b.json');
    writeBaseline(p, { 'src/a.ts': { m: 2 } });
    const loaded = loadBaseline(p);
    expect(loaded.schema).toBe(SCHEMA_VERSION);
    expect(loaded.files['src/a.ts']).toEqual({ m: 2 });
  });

  test('το baseline γράφεται με ταξινομημένα κλειδιά (σταθερό diff)', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'b.json');
    writeBaseline(p, { 'src/z.ts': { m: 1 }, 'src/a.ts': { m: 1 } });
    const keys = Object.keys(JSON.parse(fs.readFileSync(p, 'utf8')).files);
    expect(keys).toEqual(['src/a.ts', 'src/z.ts']);
  });

  test('τα σύνολα του _meta υπολογίζονται, δεν δηλώνονται', () => {
    const dir = tmpDir();
    const p = path.join(dir, 'b.json');
    const res = writeBaseline(p, { 'src/a.ts': { m: 2, n: 1 }, 'src/b.ts': { m: 1 } });
    expect(res).toEqual({ totalFiles: 2, totalViolations: 4 });
  });
});

// ===========================================================================
// ΟΜΑΔΑ 6 — το ΠΡΑΓΜΑΤΙΚΟ μητρώο του έργου
// ===========================================================================
describe('το πραγματικό .ssot-registry.json', () => {
  test('φορτώνεται χωρίς εξαίρεση (καμία ξένη διάλεκτος, καμία άκυρη σύνταξη)', () => {
    expect(() => loadRegistry(path.resolve(__dirname, '..', '..', '.ssot-registry.json'))).not.toThrow();
  });

  test('τα modules χωρίς patterns παραλείπονται (τα _comment_* κλειδιά)', () => {
    const { modules } = loadRegistry(path.resolve(__dirname, '..', '..', '.ssot-registry.json'));
    expect(modules.every(m => m.patterns.length > 0)).toBe(true);
  });
});

// ===========================================================================
// ΟΜΑΔΑ 7 — CLI από άκρη σε άκρη
// ===========================================================================
describe('CLI', () => {
  function runCLI(args, cwd) {
    return spawnSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
  }

  function writeRegistry(dir, modules, exemptPatterns = '__tests__') {
    return write(dir, '.ssot-registry.json', JSON.stringify({ exemptPatterns, modules }));
  }

  function writeV2Baseline(dir, files = {}) {
    return write(dir, '.ssot-violations-baseline.json',
      JSON.stringify({ _meta: { schema: SCHEMA_VERSION }, files }));
  }

  const ENTERPRISE_ID = { 'enterprise-id': { forbiddenPatterns: ['crypto\\.randomUUID\\(\\)'] } };

  test('χωρίς ορίσματα ⇒ exit 0', () => {
    expect(spawnSync('node', [SCRIPT], { encoding: 'utf8' }).status).toBe(0);
  });

  test('μητρώο που λείπει ⇒ exit 1 (fail CLOSED)', () => {
    const dir = tmpDir();
    const f = write(dir, 'foo.ts', 'const x = 1;');
    const r = runCLI([f], dir);
    expect(r.status).toBe(1);
    expect(stripAnsi(r.stdout)).toContain('δεν βρέθηκε το SSoT μητρώο');
  });

  test('baseline που λείπει ⇒ exit 1 (fail CLOSED)', () => {
    const dir = tmpDir();
    writeRegistry(dir, ENTERPRISE_ID);
    const f = write(dir, 'foo.ts', 'const x = 1;');
    const r = runCLI([f], dir);
    expect(r.status).toBe(1);
    expect(stripAnsi(r.stdout)).toContain('δεν βρέθηκε το SSoT baseline');
  });

  test('μη αναγνώσιμο μητρώο ⇒ exit 1', () => {
    const dir = tmpDir();
    write(dir, '.ssot-registry.json', '{ not json');
    writeV2Baseline(dir);
    const f = write(dir, 'foo.ts', 'const x = 1;');
    const r = runCLI([f], dir);
    expect(r.status).toBe(1);
    expect(stripAnsi(r.stdout)).toContain('δεν μπορεί να τρέξει');
  });

  // 🔴 ΠΕΡΙΣΤΑΤΙΚΟ: pattern σε ξένη διάλεκτο δεν επιτρέπεται να περάσει σιωπηλά.
  test('μητρώο με POSIX pattern ⇒ exit 1, ονομάζει το module', () => {
    const dir = tmpDir();
    writeRegistry(dir, { 'tabs-primitive': { forbiddenPatterns: ['import[[:space:]]+X'] } });
    writeV2Baseline(dir);
    const f = write(dir, 'foo.ts', 'const x = 1;');
    const r = runCLI([f], dir);
    expect(r.status).toBe(1);
    expect(stripAnsi(r.stdout)).toContain('tabs-primitive');
  });

  test('καθαρό αρχείο ⇒ exit 0, καμία έξοδος', () => {
    const dir = tmpDir();
    writeRegistry(dir, ENTERPRISE_ID);
    writeV2Baseline(dir);
    const f = write(dir, 'clean.ts', 'const x = 1;');
    const r = runCLI([f], dir);
    expect(r.status).toBe(0);
    expect(stripAnsi(r.stdout).trim()).toBe('');
  });

  test('νέο αρχείο με παραβίαση ⇒ exit 1 + ΝΕΟ ΑΡΧΕΙΟ', () => {
    const dir = tmpDir();
    writeRegistry(dir, ENTERPRISE_ID);
    writeV2Baseline(dir);
    const f = write(dir, 'bad.ts', 'const id = crypto.randomUUID();');
    const r = runCLI([f], dir);
    expect(r.status).toBe(1);
    expect(stripAnsi(r.stdout)).toContain('ΜΠΛΟΚΑΡΙΣΤΗΚΕ');
    expect(stripAnsi(r.stdout)).toContain('ΝΕΟ ΑΡΧΕΙΟ');
    expect(stripAnsi(r.stdout)).toContain('[enterprise-id]');
  });

  test('allowlisted αρχείο ⇒ exit 0', () => {
    const dir = tmpDir();
    const f = write(dir, 'allowed.ts', 'const id = crypto.randomUUID();');
    writeRegistry(dir, {
      'enterprise-id': {
        forbiddenPatterns: ['crypto\\.randomUUID\\(\\)'],
        allowlist: [normalizePath(f)],
      },
    });
    writeV2Baseline(dir);
    expect(runCLI([f], dir).status).toBe(0);
  });

  test('ratchet-down ⇒ exit 0 και δείχνει την πρόοδο ανά module', () => {
    const dir = tmpDir();
    writeRegistry(dir, ENTERPRISE_ID);
    const f = write(dir, 'improved.ts', 'const x = 1;');
    writeV2Baseline(dir, { [normalizePath(f)]: { 'enterprise-id': 3 } });
    const r = runCLI([f], dir);
    expect(r.status).toBe(0);
    const out = stripAnsi(r.stdout);
    expect(out).toContain('RATCHET DOWN');
    expect(out).toContain('3 → 0 (-3)');
    expect(out).toContain('[enterprise-id] 3 → 0');
  });

  // 🔴 ΠΕΡΙΣΤΑΤΙΚΟ: το v1 baseline επέτρεπε ανταλλαγή — από άκρη σε άκρη.
  test('ανταλλαγή παραβίασης μεταξύ modules ⇒ ΜΠΛΟΚ', () => {
    const dir = tmpDir();
    writeRegistry(dir, {
      'enterprise-id': { forbiddenPatterns: ['crypto\\.randomUUID\\(\\)'] },
      'date-local': { forbiddenPatterns: ['new Date\\(\\)\\.toLocaleDateString'] },
    });
    const f = write(dir, 'swap.ts', 'const d = new Date().toLocaleDateString();');
    writeV2Baseline(dir, { [normalizePath(f)]: { 'enterprise-id': 1 } });
    const r = runCLI([f], dir);
    expect(r.status).toBe(1);
    expect(stripAnsi(r.stdout)).toContain('[date-local]');
  });

  test('baseline v1 στον δίσκο ⇒ exit 1 με οδηγία διόρθωσης', () => {
    const dir = tmpDir();
    writeRegistry(dir, ENTERPRISE_ID);
    write(dir, '.ssot-violations-baseline.json', JSON.stringify({ _meta: {}, files: { 'a.ts': 3 } }));
    const f = write(dir, 'foo.ts', 'const x = 1;');
    const r = runCLI([f], dir);
    expect(r.status).toBe(1);
    expect(stripAnsi(r.stdout)).toContain('npm run ssot:baseline');
  });
});
