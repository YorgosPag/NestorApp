/**
 * @jest-environment node
 *
 * ADR-924 §8.6 — Η ΑΝΑΦΟΡΑ ΤΗΣ ΠΥΛΗΣ ΦΤΑΝΕΙ ΣΤΟΝ ΑΝΘΡΩΠΟ (`scripts/lib/gate-worker.js`).
 *
 *   Ω1  `console.log` × N + `process.exit(1)` ⇒ ΟΛΕΣ οι γραμμές (πριν: μόνο η πρώτη, 35/35 μετρημένα)
 *   Ω2  και σε επιτυχία, και με `process.stdout.write`, και stderr στη θέση του
 *   Ω3  `process.exitCode` / φυσικό τέλος / ασύγχρονο exit — κωδικός σωστός, έξοδος πλήρης
 *   Ω4  σφάλμα και timeout ⇒ κωδικός 1 + το μήνυμα, και ό,τι τυπώθηκε πριν
 *   Ω5  το προσωρινό αρχείο εξόδου σβήνεται
 *   Ω6  τα ορίσματα της πύλης (`--index`) τα βλέπει ΚΑΙ η βιβλιοθήκη που φορτώνει — όχι μόνο το script (§8.9)
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runThread } = require('../lib/gate-worker');

const ROOT = path.resolve(__dirname, '..', '..');
const LINES = 400;

let tmp;
const fixture = (name, body) => {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, `'use strict';\n${body}\n`, 'utf8');
  return file;
};
const run = (script, timeoutMs = 30_000) =>
  runThread({ id: 'T', name: 'fixture', script, args: [] }, { cwd: ROOT, timeoutMs });
const report = `for (let i = 0; i < ${LINES}; i++) console.log('  finding ' + i + ' ' + 'x'.repeat(80));
console.log('  END-OF-REPORT');`;
const lineCount = out => out.split('\n').filter(l => l.startsWith('  finding ')).length;

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-worker-')); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('Ω — η αναφορά του worker φτάνει ακέραιη', () => {
  it('Ω1 · process.exit(1) μετά από αναφορά ⇒ όλες οι γραμμές', async () => {
    const r = await run(fixture('fail.js', `${report}\nprocess.exit(1);`));
    expect(r.exitCode).toBe(1);
    expect(lineCount(r.output)).toBe(LINES);
    expect(r.output).toContain('END-OF-REPORT');
  });

  it('Ω2 · process.exit(0), stdout.write και stderr', async () => {
    const r = await run(fixture('mixed.js', `process.stdout.write('A\\n'); process.stderr.write('B\\n');
${report}\nprocess.exit(0);`));
    expect(r.exitCode).toBe(0);
    expect(lineCount(r.output)).toBe(LINES);
    expect(r.output.indexOf('A\n')).toBeLessThan(r.output.indexOf('B\n'));
  });

  it.each([
    ['exitCode', 'process.exitCode = 1;', 1],
    ['φυσικό τέλος', '', 0],
    ['ασύγχρονο exit', 'setTimeout(() => process.exit(1), 0);', 1],
  ])('Ω3 · %s', async (_label, tail, code) => {
    const r = await run(fixture('end.js', `${report}\n${tail}`));
    expect(r.exitCode).toBe(code);
    expect(lineCount(r.output)).toBe(LINES);
  });

  it('Ω4α · ριχμένο σφάλμα ⇒ 1, μήνυμα, και η προηγούμενη έξοδος', async () => {
    const r = await run(fixture('throw.js', `${report}\nthrow new Error('boom-424');`));
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('boom-424');
    expect(lineCount(r.output)).toBe(LINES);
  });

  it('Ω4β · timeout ⇒ 1 + μήνυμα, χωρίς να χαθεί ό,τι τυπώθηκε', async () => {
    const r = await run(fixture('hang.js', `${report}\nsetInterval(() => {}, 1000);`), 1500);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('timed out');
    expect(lineCount(r.output)).toBe(LINES);
  });

  // ADR-924 §8.9 — ΜΕΤΡΗΜΕΝΟ: το `--index` ζούσε μόνο σε Proxy του `process` στο πλαίσιο του script· βιβλιοθήκη που ρωτά
  // `process.argv` (`commitInput(root)`, `runSetRatchetCli`) έβλεπε το argv του worker ⇒ η 3.93 έκρινε τον δίσκο (25 ≠ 21).
  it('Ω6 · η βιβλιοθήκη της πύλης βλέπει τα ορίσματα της πύλης', async () => {
    const lib = fixture('lib.js', "module.exports = () => process.argv.includes('--index') && process.argv.includes('a.ts');");
    const gate = fixture('argv.js', `console.log('LIB=' + require(${JSON.stringify(lib)})());`);
    const r = await runThread({ id: 'T', name: 'fixture', script: gate, args: ['a.ts', '--index'] }, { cwd: ROOT, timeoutMs: 30_000 });
    expect(r.output).toContain('LIB=true');
  });

  it('Ω5 · κανένα αρχείο εξόδου (ούτε κατάστιχο) δεν μένει πίσω', async () => {
    const before = new Set(fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(`gate-${process.pid}-`)));
    await run(fixture('ok.js', report));
    const after = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(`gate-${process.pid}-`) && !before.has(f));
    expect(after).toEqual([]);
  });
});

/**
 * ADR-924 Φ4 — Η ΔΥΝΑΜΙΚΗ ΑΠΟΔΕΙΞΗ: «πέρασε πράγματι η όψη του commit;» (το δίδαγμα του Ω6 — η στατική απογραφή έβλεπε
 * «ζητά `--index`, φτάνει στο SSoT» ✅ ενώ 13 πύλες έκριναν σιωπηλά τον δίσκο). Συνθετικό στιγμιότυπο, χωρίς git.
 *
 *   Ω7  πύλη με `--index` που ανοίγει είσοδο ΔΙΣΚΟΥ ⇒ αποτυγχάνει με όνομα· με είσοδο ευρετηρίου ⇒ περνά
 *   Ω8  ωμή ανάγνωση αρχείου που αποκλίνει/untracked ⇒ αποτυγχάνει· δηλωμένο περιβάλλον ή φορτωτής modules ⇒ περνά
 *   Ω9  χωρίς `--index` καμία κρίση (σουίτες, `npm run`)
 */
describe('Ω7–Ω9 — η όψη του commit φτάνει όπου ζητήθηκε', () => {
  const GATE_INPUT = JSON.stringify(path.join(ROOT, 'scripts', 'lib', 'gate-input.js'));
  const ROOT_JSON = JSON.stringify(ROOT);
  const snapshotWith = (suspect) => ({ repoRoot: ROOT, entries: [], divergent: suspect, blobs: [], untracked: [] });
  const runIndexed = (script, { suspect = [], environment = {}, args = ['--index'] } = {}) =>
    runThread({ id: 'T', name: 'fixture', script, args }, {
      cwd: ROOT, timeoutMs: 30_000, run: { snapshot: snapshotWith(suspect), environment },
    });

  it('Ω7 · είσοδος ΔΙΣΚΟΥ ενώ ζητήθηκε `--index` ⇒ exit 1 με όνομα', async () => {
    const gate = fixture('disk.js', `require(${GATE_INPUT}).openGateInput({ root: ${ROOT_JSON} }); console.log('OK');`);
    const r = await runIndexed(gate);
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/ΔΕΝ έφτασε[\s\S]*ΔΙΣΚΟΥ/);
  });

  it('Ω7 · είσοδος ευρετηρίου (`commitInput`) ⇒ περνά, χωρίς εύρημα', async () => {
    const gate = fixture('index.js', `require(${GATE_INPUT}).commitInput(${ROOT_JSON}); console.log('OK');`);
    const r = await runIndexed(gate);
    expect(r.exitCode).toBe(0);
    expect(r.output).not.toMatch(/ΔΕΝ έφτασε/);
  });

  it('Ω8 · ωμό `fs` σε αρχείο που αποκλίνει ⇒ exit 1, το αρχείο με όνομα', async () => {
    const gate = fixture('raw.js', `require('fs').existsSync(require('path').join(${ROOT_JSON}, 'package.json'));`);
    const r = await runIndexed(gate, { suspect: ['package.json'] });
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/fs\.existsSync` στο package\.json/);
  });

  it('Ω8 · το ίδιο, ΔΗΛΩΜΕΝΟ ως περιβάλλον ⇒ περνά', async () => {
    const gate = fixture('env.js', `require('fs').existsSync(require('path').join(${ROOT_JSON}, 'package.json'));`);
    const r = await runIndexed(gate, { suspect: ['package.json'], environment: { T: ['package.json'] } });
    expect(r.exitCode).toBe(0);
  });

  it('Ω8 · ο φορτωτής modules (κώδικας που εκτελείται) δεν είναι διαρροή', async () => {
    const lib = JSON.stringify(path.join(ROOT, 'scripts', 'lib', 'posix-path.js'));
    const gate = fixture('load.js', `require(${lib}); console.log('OK');`);
    const r = await runIndexed(gate, { suspect: ['scripts/lib/posix-path.js'] });
    expect(r.exitCode).toBe(0);
  });

  it('Ω9 · χωρίς `--index` καμία κρίση — η είσοδος δίσκου είναι η σωστή', async () => {
    const gate = fixture('plain.js', `require(${GATE_INPUT}).openGateInput({ root: ${ROOT_JSON} });`);
    const r = await runIndexed(gate, { args: [] });
    expect(r.exitCode).toBe(0);
  });
});
