/**
 * @jest-environment node
 */
/**
 * CHECK 3.103 — η πύλη του μελανιού (ADR-909 §6.9 · Γ2.8).
 *
 *   Μ0      — το ΖΩΝΤΑΝΟ δέντρο περνά απέναντι στο πραγματικό μητρώο και την πραγματική baseline
 *   Α1..Α14 — ΑΠΟΔΕΙΞΗ: κάθε μορφή καταγωγής από εγκεκριμένη συνάρτηση
 *   Θ1..Θ16 — ΟΧΙ απόδειξη: κυριολεκτικό, σταθερά, παράμετρος, μισός κλάδος, κύκλος — και τι ΔΕΝ είναι νεροχύτης
 *   Τ1..Τ3  — η ταυτότητα: όνομα συνάρτησης, κείμενο χωρίς παραλήπτη
 *   Κ1..Κ8  — ο κριτής (καθαρή συνάρτηση): οι τέσσερις αρνήσεις, οι δύο ζώνες, οι επαναλήψεις
 *   Ε1..Ε10 — η πύλη ΕΚΤΕΛΕΙΤΑΙ πάνω σε fixtures
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { findSinkAssignments } = require('../lib/paper-ink/detect');
const { judge, STATES, MIN_WHY } = require('../lib/paper-ink/judge');

const REPO = path.resolve(__dirname, '..', '..');
/** `PAPER_INK_GATE`: οι μεταλλάξεις του CLI τρέχουν σε ΑΝΤΙΓΡΑΦΟ του — το jest.mock δεν φτάνει σε θυγατρική διεργασία. */
const GATE = process.env.PAPER_INK_GATE || path.join(REPO, 'scripts', 'check-paper-ink.js');
const APPROVED = new Set(['inkOf', 'widthOf', 'styleOf']);

const scan = (src, name = 'probe.ts') => findSinkAssignments(src, name, APPROVED);
/** Η μία ανάθεση ενός αποσπάσματος — αποτυγχάνει ΔΥΝΑΤΑ αν δεν είναι ακριβώς μία (ποτέ κενή επιτυχία). */
function only(src) {
  const found = scan(src);
  if (found.length !== 1) throw new Error(`περίμενα 1 ανάθεση, βρήκα ${found.length}: ${src}`);
  return found[0];
}
const proven = (src) => only(src).proven;
const inFn = (body, params = 'ctx: C') => `function paint(${params}) {\n${body}\n}`;

function runGate(root, args = [], extraEnv = {}) {
  const env = { ...process.env, PAPER_INK_ROOT: root, ...extraEnv };
  if (!('SKIP_PAPER_INK' in extraEnv)) delete env.SKIP_PAPER_INK;
  const run = spawnSync('node', [GATE, ...args], { cwd: REPO, encoding: 'utf8', env });
  return { blocked: run.status !== 0, out: `${run.stdout}${run.stderr}` };
}

describe('Μ0 — η βάση', () => {
  it('το ζωντανό δέντρο περνά, και η αναφορά λέει μηδέν σε κάθε άρνηση', () => {
    const { blocked, out } = runGate(REPO);
    expect(out).toContain('CHECK 3.103');
    expect(blocked).toBe(false);
    const report = runGate(REPO, ['--report']).out;
    for (const state of Object.values(STATES)) expect(report).toMatch(new RegExp(`⛔ ${state}\\s+0\\b`));
    expect(report).toMatch(/αποδεδειγμένες: [1-9]/);
  });
});

describe('Α — αποδεικνύεται', () => {
  it.each([
    ['Α1 κλήση εγκεκριμένης', inFn('ctx.strokeStyle = inkOf(RAW);')],
    ['Α2 ψευδώνυμο εισαγωγής', `import { inkOf as tagInk } from './x';\n${inFn('ctx.fillStyle = tagInk(RAW);')}`],
    ['Α3 τοπική συνάρτηση', `function local(c: string) { return inkOf(c); }\n${inFn('ctx.strokeStyle = local(RAW);')}`],
    ['Α4 `const` από εγκεκριμένη', inFn('const ink = inkOf(RAW);\nctx.strokeStyle = ink;')],
    ['Α5 αποδόμηση με μετονομασία', inFn('const { lineWidthPx: w } = styleOf(e);\nctx.lineWidth = w;')],
    ['Α6 πεδίο αποδεδειγμένου ονόματος', inFn('const s = styleOf(e);\nctx.strokeStyle = s.color;')],
    ['Α7 αντίγραφο νεροχύτη', inFn('ctx.fillStyle = ctx.strokeStyle;')],
    ['Α8 `??` με δύο αποδεδειγμένους', inFn('const { color } = styleOf(e);\nctx.strokeStyle = color ?? inkOf(RAW);')],
    ['Α9 τριαδικός με δύο αποδεδειγμένους', inFn('ctx.lineWidth = thin ? widthOf(1) : widthOf(2);')],
    ['Α10 `null` είναι ουδέτερο', inFn('ctx.strokeStyle = on ? inkOf(RAW) : null;')],
    ['Α11 `let` με κάθε ανάθεση αποδεδειγμένη', inFn('let ink = inkOf(A);\nif (x) ink = inkOf(B);\nctx.strokeStyle = ink;')],
    ['Α12 τοπικό βέλος', inFn('const r = (k: string) => styleOf(k);\nconst s = r(K);\nctx.lineWidth = s.lineWidthPx;')],
    ['Α13 παρένθεση / `as` / `!`', inFn('ctx.strokeStyle = (inkOf(RAW) as string)!;')],
  ])('%s', (_name, src) => expect(proven(src)).toBe(true));

  it('Α15 το `return` ενός εμφωλευμένου callback ΔΕΝ είναι `return` της συνάρτησης', () => {
    const local = "function local(c: string) { xs.forEach((x) => { return '#000'; }); return inkOf(c); }";
    expect(proven(`${local}\n${inFn('ctx.strokeStyle = local(RAW);')}`)).toBe(true);
  });

  it('Α14 μέθοδος `this.` της ίδιας κλάσης', () => {
    const src = 'class P {\n  private ink(c: string) { return inkOf(c); }\n'
      + '  render() { this.ctx.strokeStyle = this.ink(RAW); }\n}';
    expect(proven(src)).toBe(true);
  });
});

describe('Θ — ΔΕΝ αποδεικνύεται (συντηρητικά)', () => {
  it.each([
    ['Θ1 συμβολοσειρά', inFn("ctx.strokeStyle = '#ff0000';")],
    ['Θ2 αριθμός', inFn('ctx.lineWidth = 0.8;')],
    ['Θ3 template', inFn('ctx.strokeStyle = `rgba(0,0,0,${a})`;')],
    ['Θ4 σταθερά αρχείου', `const ROOF = '#a04a2b';\n${inFn('ctx.strokeStyle = ROOF;')}`],
    ['Θ5 κλειδί πίνακα', inFn('ctx.strokeStyle = KIND_STROKE[kind];')],
    ['Θ6 παράμετρος', inFn('ctx.lineWidth = widthPx;', 'ctx: C, widthPx: number')],
    ['Θ7 εισαγόμενη εκτός καταλόγου', inFn('ctx.strokeStyle = someOtherInk(RAW);')],
    ['Θ8 αριθμητική πάνω σε αποδεδειγμένο', inFn('ctx.lineWidth = widthOf(1) + 2;')],
    ['Θ9 `??` με ωμή εφεδρεία', inFn('const { color } = styleOf(e);\nctx.strokeStyle = color ?? KIND_STROKE[k];')],
    ['Θ10 τριαδικός με έναν ωμό κλάδο', inFn('ctx.lineWidth = print ? widthOf(1) : 0.5;')],
    ['Θ11 `let` με ΜΙΑ ωμή ανάθεση', inFn("let ink = inkOf(A);\nif (x) ink = '#f00';\nctx.strokeStyle = ink;")],
    ['Θ12 τοπική με ΕΝΑ ωμό `return`', `function local(c: string) { if (c) return inkOf(c); return '#000'; }\n${inFn('ctx.strokeStyle = local(RAW);')}`],
    ['Θ13 κύκλος ⇒ όχι «μάλλον ναι»', `function a(): string { return b(); }\nfunction b(): string { return a(); }\n${inFn('ctx.strokeStyle = a();')}`],
    ['Θ14 πεδίο παραμέτρου', inFn('ctx.lineWidth = dc.lineWidth2;', 'ctx: C, dc: D')],
    ['Θ15 τοπικός ομώνυμος κρίνεται από το ΣΩΜΑ του', `function inkOf(c: string) { return c; }\n${inFn('ctx.strokeStyle = inkOf(RAW);')}`],
  ])('%s', (_name, src) => expect(proven(src)).toBe(false));

  it('Θ16 τι ΔΕΝ είναι νεροχύτης: σχόλιο, σύγκριση, άλλη ιδιότητα, ανάγνωση', () => {
    const src = inFn([
      '// πριν: ctx.strokeStyle = RAW',
      'if (ctx.strokeStyle === RAW) return;',
      "ctx.font = '12px x';",
      'const w = ctx.lineWidth;',
      'ctx.globalAlpha = 0.5;',
    ].join('\n'));
    expect(scan(src)).toEqual([]);
  });
});

describe('Τ — η ταυτότητα', () => {
  it('Τ1 το κείμενο δεν κουβαλά τον παραλήπτη και έχει ενιαία κενά', () => {
    const a = only(inFn('this.ctx.strokeStyle   =  inkOf(\n  RAW\n);')).text;
    const b = only(inFn('dc.ctx.strokeStyle = inkOf( RAW );')).text;
    expect(a).toBe('strokeStyle = inkOf( RAW )');
    expect(b).toBe(a);
  });
  it('Τ2 όνομα: συνάρτηση · μέθοδος · βέλος σε `const` · επίπεδο αρχείου', () => {
    expect(only(inFn('ctx.lineWidth = 1;')).fn).toBe('paint');
    expect(only('class P { drawAxis() { this.ctx.lineWidth = 1; } }').fn).toBe('drawAxis');
    expect(only('const halo = (ctx: C) => { ctx.lineWidth = 1; };').fn).toBe('halo');
    expect(only('ctx.lineWidth = 1;').fn).toBe('<module>');
  });
  it('Τ3 ανώνυμο callback ⇒ η πλησιέστερη ΟΝΟΜΑΣΜΕΝΗ συνάρτηση, και η γραμμή είναι η σωστή', () => {
    const found = only(inFn('items.forEach(() => {\n  ctx.lineWidth = 1;\n});'));
    expect(found.fn).toBe('paint');
    expect(found.line).toBe(3);
  });
});

const KINDS = { chrome: 'δεν τυπώνεται', caller: 'παράμετρος' };
const WHY = 'Λάμψη hover: καλείται μόνο όταν το στοιχείο αιωρείται.';
const raw = (text, fn = 'halo', line = 1) => ({ line, fn, sink: text.split(' ')[0], text, proven: false });
const ok = (text) => ({ ...raw(text), proven: true });
const strictFile = (...assignments) => [{ file: 'src/strict/a.ts', zone: 'strict', assignments }];
const registryOf = (exceptions) => ({ kinds: KINDS, exceptions });
const exception = (assignments, over = {}) => ({
  file: 'src/strict/a.ts', fn: 'halo', kind: 'chrome', why: WHY, assignments, ...over,
});
const states = (verdict) => verdict.refused.map((r) => r.state);

describe('Κ — ο κριτής', () => {
  it('Κ1 αναπόδεικτη στη ζώνη strict χωρίς εξαίρεση ⇒ undeclared, με αρχείο:γραμμή', () => {
    const verdict = judge(registryOf([]), strictFile(raw('lineWidth = 2', 'halo', 7), ok('lineWidth = widthOf(1)')));
    expect(states(verdict)).toEqual([STATES.UNDECLARED]);
    expect(verdict.refused[0].detail).toBe('src/strict/a.ts:7 — halo :: lineWidth = 2');
    expect(verdict.tally).toEqual({ assignments: 2, proven: 1, strict: 1, ratchet: 0 });
  });
  it('Κ2 η εξαίρεση καλύπτει ΑΚΡΙΒΩΣ ό,τι ονομάζει — νέα ωμή γραμμή στην ίδια συνάρτηση μπλοκάρει', () => {
    const registry = registryOf([exception(['lineWidth = 2'])]);
    expect(judge(registry, strictFile(raw('lineWidth = 2'))).refused).toEqual([]);
    const grown = judge(registry, strictFile(raw('lineWidth = 2'), raw("strokeStyle = '#f00'")));
    expect(states(grown)).toEqual([STATES.UNDECLARED]);
    expect(grown.declarations).toEqual(['src/strict/a.ts#halo :: lineWidth = 2']);
    expect(grown.byKind).toEqual({ chrome: 1 });
  });
  it('Κ3 εξαίρεση που δεν αντιστοιχεί σε τίποτα ⇒ stale (και όταν η ανάθεση ΑΠΟΔΕΙΧΤΗΚΕ)', () => {
    const registry = registryOf([exception(['lineWidth = 2'])]);
    expect(states(judge(registry, strictFile()))).toEqual([STATES.STALE]);
    expect(states(judge(registry, strictFile(ok('lineWidth = 2'))))).toEqual([STATES.STALE]);
  });
  it('Κ4 εξαίρεση με λίγο λόγο ή άγνωστο είδος ⇒ unreasoned', () => {
    const short = judge(registryOf([exception(['lineWidth = 2'], { why: 'x'.repeat(MIN_WHY - 1) })]), strictFile(raw('lineWidth = 2')));
    expect(states(short)).toEqual([STATES.UNREASONED]);
    const exact = judge(registryOf([exception(['lineWidth = 2'], { why: 'x'.repeat(MIN_WHY) })]), strictFile(raw('lineWidth = 2')));
    expect(exact.refused).toEqual([]);
    const blank = judge(registryOf([exception(['lineWidth = 2'], { why: `${' '.repeat(MIN_WHY)}x` })]), strictFile(raw('lineWidth = 2')));
    expect(states(blank)).toEqual([STATES.UNREASONED]);
    const kind = judge(registryOf([exception(['lineWidth = 2'], { kind: 'whatever' })]), strictFile(raw('lineWidth = 2')));
    expect(states(kind)).toEqual([STATES.UNREASONED]);
  });
  it('Κ5 η ίδια ανάθεση ΔΥΟ φορές θέλει ΔΥΟ δηλώσεις', () => {
    const twice = strictFile(raw('lineWidth = 2'), raw('lineWidth = 2'));
    expect(states(judge(registryOf([exception(['lineWidth = 2'])]), twice))).toEqual([STATES.UNDECLARED]);
    expect(judge(registryOf([exception(['lineWidth = 2', 'lineWidth = 2'])]), twice).refused).toEqual([]);
  });
  it('Κ9 ίδια ανάθεση σε ΔΥΟ συναρτήσεις: η αρίθμηση είναι ανά συνάρτηση — η σειρά του μητρώου δεν μετρά', () => {
    const scanned = strictFile(raw('lineWidth = 2', 'halo'), raw('lineWidth = 2', 'glow'));
    const reversed = registryOf([exception(['lineWidth = 2'], { fn: 'glow' }), exception(['lineWidth = 2'])]);
    const verdict = judge(reversed, scanned);
    expect(verdict.refused).toEqual([]);
    expect(verdict.declarations).toEqual(['src/strict/a.ts#glow :: lineWidth = 2', 'src/strict/a.ts#halo :: lineWidth = 2']);
  });
  it('Κ6 εξαίρεση άλλης συνάρτησης ή άλλου αρχείου ΔΕΝ καλύπτει', () => {
    const scanned = strictFile(raw('lineWidth = 2'));
    for (const over of [{ fn: 'other' }, { file: 'src/strict/b.ts' }]) {
      const verdict = judge(registryOf([exception(['lineWidth = 2'], over)]), scanned);
      expect(states(verdict).sort()).toEqual([STATES.STALE, STATES.UNDECLARED]);
    }
  });
  it('Κ7 ζώνη ratchet: ταυτότητες, ΟΧΙ αρνήσεις — και εξαίρεση εκεί είναι stale', () => {
    const scanned = [{ file: 'src/loose/z.ts', zone: 'ratchet', assignments: [raw('lineWidth = 2', 'draw', 4)] }];
    const verdict = judge(registryOf([]), scanned);
    expect(verdict.refused).toEqual([]);
    expect(verdict.violationIds).toEqual(['src/loose/z.ts#draw :: lineWidth = 2']);
    expect(verdict.violations[0]).toMatchObject({ file: 'src/loose/z.ts', line: 4, id: verdict.violationIds[0] });
    const excused = judge(registryOf([exception(['lineWidth = 2'], { file: 'src/loose/z.ts', fn: 'draw' })]), scanned);
    expect(states(excused)).toEqual([STATES.STALE]);
  });
  it('Κ8 εγκεκριμένο όνομα χωρίς σπίτι ⇒ approved-missing', () => {
    const verdict = judge(registryOf([]), [], ['inkOf — το src/ink.ts δεν το εξάγει']);
    expect(states(verdict)).toEqual([STATES.APPROVED_MISSING]);
  });
});

describe('Ε — η πύλη ΕΚΤΕΛΕΙΤΑΙ πάνω σε fixtures', () => {
  let root;
  const file = (rel) => path.join(root, rel);
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
    fs.writeFileSync(file(rel), text);
  };
  const painter = (body) => `import { inkOf } from '../ink';\nexport function draw(ctx: any) {\n${body}\n}\n`;
  const registry = (exceptions = [], over = {}) => write('.paper-ink-registry.json', JSON.stringify({
    approved: { inkOf: 'src/ink.ts' }, kinds: KINDS,
    zones: { strict: ['src/strict'], ratchet: ['src/loose'] }, exceptions, ...over,
  }));
  const seed = (violations = [], declarations = []) => write('.paper-ink-baseline.json', JSON.stringify({ violations, declarations }));
  const halo = (assignments) => ({ file: 'src/strict/a.ts', fn: 'draw', kind: 'chrome', why: WHY, assignments });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-3-103-'));
    write('src/ink.ts', 'export function inkOf(c: string): string { return c; }\n');
    registry();
    seed();
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('Ε1 αποδεδειγμένος ζωγράφος ⇒ περνά', () => {
    write('src/strict/a.ts', painter('  ctx.strokeStyle = inkOf(RAW);'));
    expect(runGate(root).blocked).toBe(false);
  });
  it('Ε2 🔴 ωμό χρώμα στη ζώνη strict ⇒ ΜΠΛΟΚ, με αρχείο:γραμμή — και ΔΕΝ μπαίνει σε baseline', () => {
    write('src/strict/a.ts', painter("  ctx.strokeStyle = '#ff0000';"));
    const { blocked, out } = runGate(root);
    expect(blocked).toBe(true);
    expect(out).toContain("undeclared: src/strict/a.ts:3 — draw :: strokeStyle = '#ff0000'");
    expect(runGate(root, ['--write-baseline']).blocked).toBe(true);
    expect(JSON.parse(fs.readFileSync(file('.paper-ink-baseline.json'), 'utf8'))).toEqual({ violations: [], declarations: [] });
  });
  it('Ε3 εξαίρεση με λόγο ⇒ περνά ΜΟΝΟ αφού γραφτεί και στη baseline', () => {
    write('src/strict/a.ts', painter('  ctx.lineWidth = 2;'));
    registry([halo(['lineWidth = 2'])]);
    const before = runGate(root);
    expect(before.blocked).toBe(true);
    expect(before.out).toContain('νέα εξαίρεση');
    expect(runGate(root, ['--write-baseline']).blocked).toBe(false);
    expect(runGate(root).blocked).toBe(false);
  });
  it('Ε4 εξαίρεση που περίσσεψε ⇒ ΜΠΛΟΚ (stale)', () => {
    write('src/strict/a.ts', painter('  ctx.strokeStyle = inkOf(RAW);'));
    registry([halo(['lineWidth = 2'])]);
    seed([], ['src/strict/a.ts#draw :: lineWidth = 2']);
    expect(runGate(root).out).toContain('stale: src/strict/a.ts#draw :: lineWidth = 2');
  });
  it('Ε5 ζώνη ratchet: νέα ταυτότητα ⇒ ΜΠΛΟΚ · ίδια ⇒ περνά · λιγότερες ⇒ περνά με πρόοδο', () => {
    write('src/loose/z.ts', painter('  ctx.lineWidth = 2;'));
    expect(runGate(root).blocked).toBe(true);
    seed(['src/loose/z.ts#draw :: lineWidth = 2']);
    expect(runGate(root).blocked).toBe(false);
    write('src/loose/z.ts', painter('  ctx.strokeStyle = inkOf(RAW);'));
    const healed = runGate(root);
    expect(healed.blocked).toBe(false);
    expect(healed.out).toContain('1 αναθέσεις που δεν κρίθηκαν / 0 εξαιρέσεις με λόγο λιγότερες');
  });
  it('Ε6 ζώνη ratchet: ΑΝΤΑΛΛΑΓΗ (μία έφυγε, μία ήρθε) ⇒ ΜΠΛΟΚ', () => {
    seed(['src/loose/z.ts#draw :: lineWidth = 2']);
    write('src/loose/z.ts', painter('  ctx.lineWidth = 3;'));
    expect(runGate(root).blocked).toBe(true);
  });
  it('Ε7 εγκεκριμένο όνομα που το σπίτι του δεν εξάγει πια ⇒ ΜΠΛΟΚ', () => {
    write('src/ink.ts', '// export function inkOf — μόνο σε σχόλιο\nfunction inkOf(c: string) { return c; }\n');
    expect(runGate(root).out).toContain('approved-missing: inkOf');
  });
  it('Ε8 fail-closed: μητρώο που λείπει · χαλασμένο · χωρίς πεδίο · baseline που λείπει', () => {
    fs.rmSync(file('.paper-ink-baseline.json'));
    expect(runGate(root).blocked).toBe(true);
    seed();
    registry([], { zones: undefined });
    expect(runGate(root).out).toContain('αδύνατη η μέτρηση');
    write('.paper-ink-registry.json', '{ όχι json');
    expect(runGate(root).blocked).toBe(true);
    fs.rmSync(file('.paper-ink-registry.json'));
    expect(runGate(root).blocked).toBe(true);
  });
  it('Ε9 tests και `.d.ts` ΕΞΩ από την εμβέλεια', () => {
    write('src/strict/__tests__/a.test.ts', painter("  ctx.strokeStyle = '#f00';"));
    write('src/strict/a.spec.ts', painter("  ctx.strokeStyle = '#f00';"));
    write('src/strict/a.d.ts', painter("  ctx.strokeStyle = '#f00';"));
    expect(runGate(root).blocked).toBe(false);
  });
  it('Ε10 SKIP_PAPER_INK=1 ⇒ περνά (και χωρίς αυτό, το ίδιο δέντρο μπλοκάρει)', () => {
    write('src/strict/a.ts', painter("  ctx.strokeStyle = '#ff0000';"));
    expect(runGate(root).blocked).toBe(true);
    expect(runGate(root, [], { SKIP_PAPER_INK: '1' }).blocked).toBe(false);
  });
});
