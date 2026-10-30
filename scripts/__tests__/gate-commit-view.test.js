/**
 * CHECK 3.107 / ADR-924 — η όψη του commit.
 *
 * Τρία επίπεδα, όλα ΕΚΤΕΛΟΥΝ τον πραγματικό κώδικα:
 *   Ο1–Ο3  SSoT: `createCommitView` · `importClosure` · `materializeTypeScriptClosure` πάνω σε ΠΡΑΓΜΑΤΙΚΟ
 *          προσωρινό git repo (το ευρετήριο του repo δεν αγγίζεται ποτέ).
 *   Κ1–Κ9  η κρίση της μετα-πύλης, κατάσταση προς κατάσταση, με συνθετική απογραφή.
 *   Ζ1     το ζωντανό δέντρο: καμία μπλοκάρουσα γραμμή, και η απογραφή ΚΟΙΤΑΖΕΙ (παρονομαστής).
 *
 * 🔴 Το περιστατικό: commit 4 αρχείων απέτυχε σε 3.6 · 3.73 · 3.85 για ξένη αστάδιοποίητη δουλειά.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { createCommitView } = require('../lib/git-index-snapshot');
const { importClosure } = require('../lib/ts-import-closure');
const { materializeTypeScriptClosure } = require('../lib/ts-module-loader');
const { dispatchesOf, classifyDispatch, takeInventory, SNAPSHOT_SSOT } = require('../lib/gate-commit-view/inventory');
const { STATES, BLOCKING, judge, tallyOf } = require('../lib/gate-commit-view/judge');
const { diskSource } = require('../check-gate-commit-view');

const ROOT = path.resolve(__dirname, '..', '..');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-view-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const git = (...args) => spawnSync('git', ['-C', tmp, ...args], { encoding: 'utf8' });
function write(rel, text) {
  fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
  fs.writeFileSync(path.join(tmp, rel), text, 'utf8');
}
/** Γράφει, σταδιοποιεί, και (προαιρετικά) αφήνει ΑΛΛΟ κείμενο στον δίσκο — η ξένη δουλειά. */
function stage(rel, staged, disk = staged) {
  write(rel, staged);
  git('add', rel);
  if (disk !== staged) write(rel, disk);
}

describe('Ο1 — createCommitView: το ευρετήριο, όχι ο δίσκος', () => {
  beforeEach(() => git('init', '-q'));

  test('σταδιοποιημένο κείμενο νικά την αστάδιοποίητη αλλαγή του δίσκου', () => {
    stage('src/a.ts', 'staged\n', 'disk\n');
    const view = createCommitView({ repoRoot: tmp });
    expect(view.readText('src/a.ts')).toBe('staged\n');
    expect(view.divergent).toBe(1);
  });

  test('untracked αρχείο ΔΕΝ υπάρχει στην όψη — δεν θα είναι στο commit', () => {
    stage('src/a.ts', 'a\n');
    write('src/untracked.ts', 'x\n');
    const view = createCommitView({ repoRoot: tmp });
    expect(view.files).toEqual(['src/a.ts']);
    expect(view.readText('src/untracked.ts')).toBeNull();
  });

  test('αρχείο σβησμένο από τον δίσκο αλλά στο ευρετήριο ⇒ διαβάζεται ως blob', () => {
    stage('src/a.ts', 'kept\n');
    fs.rmSync(path.join(tmp, 'src/a.ts'));
    expect(createCommitView({ repoRoot: tmp }).readText('src/a.ts')).toBe('kept\n');
  });

  test('include φιλτράρει — ό,τι εξαιρείται δεν διαβάζεται', () => {
    stage('src/a.ts', 'a\n');
    stage('docs/x.md', 'x\n');
    const view = createCommitView({ repoRoot: tmp, include: rel => rel.startsWith('src/') });
    expect(view.files).toEqual(['src/a.ts']);
    expect(view.has('docs/x.md')).toBe(false);
  });
});

describe('Ο2 — importClosure: ό,τι πρέπει να υπάρχει για να εκτελεστεί', () => {
  const tree = {
    'src/a.ts': "import { b } from '@/lib/b';\nimport type { T } from './t';\nexport * from '../src/c';\n",
    'src/lib/b.ts': "const z = require('zod');\nexport { x } from './dir';\n",
    'src/lib/dir/index.ts': 'export const x = 1;\n',
    'src/t.ts': 'export type T = 1;\n',
    'src/c.ts': "import './side-effect';\n",
    'src/side-effect.ts': '',
    'src/unreached.ts': '',
  };
  const source = { has: rel => rel in tree, readText: rel => (rel in tree ? tree[rel] : null) };

  test('ακολουθεί @/ · σχετικά · index · type imports · side-effect· όχι εξωτερικά πακέτα', () => {
    expect(importClosure({ entries: ['src/a.ts'], ...source })).toEqual([
      'src/a.ts', 'src/c.ts', 'src/lib/b.ts', 'src/lib/dir/index.ts', 'src/side-effect.ts', 'src/t.ts',
    ]);
  });

  test('είσοδος που δεν υπάρχει ⇒ κενή κλειστότητα, όχι σφάλμα', () => {
    expect(importClosure({ entries: ['src/nope.ts'], ...source })).toEqual([]);
  });
});

describe('Ο3 — materializeTypeScriptClosure: εκτελείται ό,τι ΘΑ ΔΕΣΜΕΥΤΕΙ', () => {
  beforeEach(() => git('init', '-q'));

  /**
   * ⚠️ Σε ΘΥΓΑΤΡΙΚΟ `node`, επίτηδες: μέσα στο jest το `require` είναι το σύστημα του jest
   * (`moduleNameMapper` ⇒ `@/` → το `src/` του REPO) και το άγκιστρο του loader δεν ενεργοποιείται ποτέ.
   * Μετρημένο: η άγκυρα μέσα στο jest φόρτωνε τον δίσκο του repo. Ο hook τρέχει σε πραγματικό Node.
   */
  test('@/ λύνεται ΜΕΣΑ στο στιγμιότυπο: η σταδιοποιημένη τιμή, ποτέ του δίσκου (πραγματικό Node)', () => {
    stage('src/constants/entry.ts', "import { VALUE } from '@/lib/value';\nexport const READ = VALUE;\n");
    stage('src/lib/value.ts', "export const VALUE = 'staged';\n", "export const VALUE = 'disk';\n");
    const program = [
      "const path = require('path');",
      `const L = require(${JSON.stringify(path.join(ROOT, 'scripts/lib/ts-module-loader.js'))});`,
      "const s = L.materializeTypeScriptClosure({ repoRoot: process.argv[1], entries: ['src/constants/entry.ts'] });",
      "try { process.stdout.write(L.requireTypeScript(path.join(s.root, 'src/constants/entry.ts')).READ); }",
      "finally { s.dispose(); process.stdout.write(require('fs').existsSync(s.root) ? ' leaked' : ' disposed'); }",
    ].join('\n');
    const r = spawnSync(process.execPath, ['-e', program, tmp], { encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(r.stdout).toBe('staged disposed');
  });

  test('τα bytes είναι του blob (LF), όχι του checkout με autocrlf', () => {
    stage('src/data.json', '{\n  "a": 1\n}\n');
    const snapshot = materializeTypeScriptClosure({ repoRoot: tmp, entries: [], extra: ['src/data.json'] });
    try {
      expect(fs.readFileSync(path.join(snapshot.root, 'src/data.json'), 'utf8')).toBe('{\n  "a": 1\n}\n');
    } finally {
      snapshot.dispose();
    }
  });
});

describe('Κ — η κρίση της μετα-πύλης', () => {
  const gate = (id, over = {}) => ({ id, script: `scripts/g${id}.js`, args: '', asksIndex: false, reader: false, missing: false, ...over });
  const states = inv => Object.fromEntries(judge(inv).map(r => [r.id, r.state]));
  const REASON = 'κρίνει τον δίσκο επίτηδες: μετρά κάτι που ζει μόνο εκεί, όχι στο ευρετήριο';

  test('Κ1 — --index + αναγνώστης ⇒ commit-view', () => {
    expect(states({ gates: [gate('3.1', { asksIndex: true, reader: true })], declared: {}, baseline: [] })['3.1'])
      .toBe(STATES.COMMIT_VIEW);
  });

  test('Κ2 — --index ΧΩΡΙΣ αναγνώστη ⇒ ⛔ flag-without-reader (η σημαία είναι διακόσμηση)', () => {
    expect(states({ gates: [gate('3.1', { asksIndex: true })], declared: {}, baseline: ['3.1'] })['3.1'])
      .toBe(STATES.FLAG_WITHOUT_READER);
  });

  test('Κ3 — αναγνώστης ΧΩΡΙΣ --index ⇒ ΔΕΝ μετρά ως commit-view (ο hook δεν τον ενεργοποιεί)', () => {
    expect(states({ gates: [gate('3.1', { reader: true })], declared: {}, baseline: [] })['3.1']).toBe(STATES.UNDECLARED);
  });

  test('Κ4 — νέα πύλη που κρίνει τον δίσκο ⇒ ⛔ undeclared · στη baseline ⇒ 🔶 baseline', () => {
    const s = states({ gates: [gate('3.1'), gate('3.2')], declared: {}, baseline: ['3.2'] });
    expect([s['3.1'], s['3.2']]).toEqual([STATES.UNDECLARED, STATES.BASELINE]);
  });

  test('Κ5 — δήλωση με λόγο ⇒ declared · χωρίς επαρκή λόγο ⇒ ⛔ reasonless', () => {
    const s = states({ gates: [gate('3.1'), gate('3.2')], declared: { '3.1': REASON, '3.2': 'γιατί έτσι' }, baseline: [] });
    expect([s['3.1'], s['3.2']]).toEqual([STATES.DECLARED, STATES.REASONLESS]);
  });

  test('Κ6 — δήλωση για πύλη που δεν δρομολογείται ⇒ ⛔ orphan', () => {
    expect(states({ gates: [], declared: { '3.9': REASON }, baseline: [] })['3.9']).toBe(STATES.ORPHAN);
  });

  test('Κ7 — baseline για πύλη που πλέον κρίνει το commit ⇒ ⬇ stale, ΟΧΙ μπλοκ', () => {
    const rows = judge({ gates: [gate('3.1', { asksIndex: true, reader: true })], declared: {}, baseline: ['3.1'] });
    expect(rows.map(r => r.state)).toEqual([STATES.COMMIT_VIEW, STATES.STALE_BASELINE]);
    expect(rows.some(r => BLOCKING.has(r.state))).toBe(false);
  });

  test('Κ8 — script που λείπει ⇒ ⛔ missing-script (ποτέ σιωπηλό πράσινο)', () => {
    expect(states({ gates: [gate('3.1', { missing: true })], declared: {}, baseline: ['3.1'] })['3.1'])
      .toBe(STATES.MISSING_SCRIPT);
  });

  test('Κ9 — κλειστή λογιστική: άγνωστη κατάσταση ⇒ throw με όνομα', () => {
    expect(() => tallyOf([{ id: '3.1', state: 'nonsense' }])).toThrow(/nonsense/);
  });
});

describe('Δ — η παραγωγή από τον εκτελεστή', () => {
  const EXECUTOR = [
    "  addThread('3.1', 'One', 'scripts/one.js', ['--index']);",
    "  addThread('3.2', 'Two', 'scripts/two.js',",
    '    someTriggers);',
    "  addBash('3.3', 'Three', 'scripts/three.sh', files);",
    "  if (x) addThread('3.2', 'Two', 'scripts/two.js', ['--index']);",
  ].join('\n');

  test('Δ1 — πολυγραμμικές δρομολογήσεις · addBash · ίδια πύλη σε δύο κλάδους ενώνει τα ορίσματα', () => {
    const byId = Object.fromEntries(dispatchesOf(EXECUTOR).map(d => [d.id, d]));
    expect(Object.keys(byId)).toEqual(['3.1', '3.2', '3.3']);
    expect(byId['3.2'].args).toContain("'--index'");
    expect(byId['3.3'].script).toBe('scripts/three.sh');
  });

  test('Δ2 — αναγνώστης = κλειστότητα require προς το SSoT (js) · `git show ":` (sh)', () => {
    const files = {
      'scripts/one.js': "require('./lib/reader');\n",
      'scripts/lib/reader.js': "require('./git-index-snapshot');\n",
      [SNAPSHOT_SSOT]: '',
      'scripts/two.js': "require('node:fs');\n",
      'scripts/three.sh': 'git show ":$1"\n',
    };
    const source = { has: rel => rel in files, readText: rel => (rel in files ? files[rel] : null) };
    const reader = id => classifyDispatch(dispatchesOf(EXECUTOR).find(d => d.id === id), source).reader;
    expect([reader('3.1'), reader('3.2'), reader('3.3')]).toEqual([true, false, true]);
  });
});

describe('Φ4 — το μητρώο περιβάλλοντος · η κλειστότητα bash · το στατικό ratchet (ADR-924 §8.11)', () => {
  const { countRawReads, measureRawReads, compareRawReads } = require('../lib/gate-commit-view/raw-reads');
  const gate = id => ({ id, script: `scripts/g${id}.js`, args: "'--index'", asksIndex: true, reader: true, missing: false });
  const REASON = 'περιγράφει το εγκατεστημένο περιβάλλον, που χτίστηκε από τον δίσκο — όχι το commit';
  const statesOf = environment => Object.fromEntries(judge({ gates: [gate('3.1')], declared: {}, environment, baseline: [] })
    .map(r => [r.id, r.state]));

  test('Κ10 — ανάγνωση περιβάλλοντος: με αρχεία+λόγο ⇒ καμία γραμμή · χωρίς λόγο ⇒ ⛔ reasonless · άγνωστη πύλη ⇒ ⛔ orphan', () => {
    expect(statesOf({ '3.1': { files: ['package.json'], reason: REASON } })).toEqual({ '3.1': STATES.COMMIT_VIEW });
    expect(statesOf({ '3.1': { files: ['package.json'], reason: 'λόγος' } })['3.1 (environment)']).toBe(STATES.REASONLESS);
    expect(statesOf({ '3.1': { files: [], reason: REASON } })['3.1 (environment)']).toBe(STATES.REASONLESS);
    expect(statesOf({ '3.9': { files: ['x'], reason: REASON } })['3.9 (environment)']).toBe(STATES.ORPHAN);
  });

  test('Δ3 — bash: ο αναγνώστης σε βιβλιοθήκη που γίνεται `source` μετρά (commit-source.sh)', () => {
    const files = {
      'scripts/a.sh': 'source "$(dirname "${BASH_SOURCE[0]}")/lib/commit-source.sh"\n',
      'scripts/lib/commit-source.sh': 'read_source() { git show ":$1"; }\n',
      'scripts/b.sh': 'source "$(dirname "${BASH_SOURCE[0]}")/lib/other.sh"\n',
      'scripts/lib/other.sh': 'cat "$1"\n',
    };
    const source = { has: rel => rel in files, readText: rel => (rel in files ? files[rel] : null) };
    const reader = script => classifyDispatch({ id: '3.1', script, args: "'--index'" }, source).reader;
    expect([reader('scripts/a.sh'), reader('scripts/b.sh')]).toEqual([true, false]);
  });

  test('Ρ1 — μέτρηση: `fs.x(` και αποδομημένο `x(`, ποτέ σε σχόλιο', () => {
    expect(countRawReads("fs.readFileSync(a);\nconst t = existsSync(b) && statSync(b);\n// fs.readFileSync(c)\n * readdirSync(d)\n"))
      .toBe(3);
  });

  test('Ρ2 — η κλειστότητα: μόνο scripts/, χωρίς τις αυθεντίες της εισόδου', () => {
    const files = {
      'scripts/g.js': "require('./lib/x'); require('./lib/gate-input');\nfs.readFileSync(1);\n",
      'scripts/lib/x.js': 'fs.existsSync(1); fs.statSync(2);\n',
      'scripts/lib/gate-input.js': 'fs.readFileSync(9); fs.readFileSync(9);\n',
    };
    const source = { has: rel => rel in files, readText: rel => (rel in files ? files[rel] : null) };
    expect(measureRawReads(['scripts/g.js'], source)).toEqual({ 'scripts/g.js': 1, 'scripts/lib/x.js': 2 });
  });

  test('Ρ3 — ratchet: περισσότερα ή νέο αρχείο ⇒ grown (μπλοκ) · λιγότερα ⇒ shrunk (κλείδωσε)', () => {
    const { grown, shrunk } = compareRawReads({ a: 3, b: 1, n: 1 }, { a: 2, b: 2 });
    expect(grown).toEqual([{ file: 'a', from: 2, to: 3 }, { file: 'n', from: 0, to: 1 }]);
    expect(shrunk).toEqual([{ file: 'b', from: 2, to: 1 }]);
  });
});

describe('Ζ — το ζωντανό δέντρο', () => {
  const rows = judge(takeInventory(diskSource(ROOT)));

  test('Ζ1 ΠΑΡΟΝΟΜΑΣΤΗΣ — η απογραφή ΚΟΙΤΑΖΕΙ: δεκάδες πύλες, και οι μεταφερμένες κρίνουν το commit', () => {
    expect(rows.length).toBeGreaterThan(50);
    const commitView = rows.filter(r => r.state === STATES.COMMIT_VIEW).map(r => r.id);
    expect(commitView).toEqual(expect.arrayContaining(['3.34', '3.73', '3.85', '3.107']));
  });

  test('Ζ2 — καμία μπλοκάρουσα γραμμή', () => {
    expect(rows.filter(r => BLOCKING.has(r.state))).toEqual([]);
  });
});
