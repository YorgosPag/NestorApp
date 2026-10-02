/**
 * @jest-environment node
 */
/**
 * CHECK 3.97 — η πύλη της ωμής εφεδρείας i18n (ADR-898 §18.2).
 *
 *   Μ0      — το ΖΩΝΤΑΝΟ δέντρο περνά απέναντι στην πραγματική baseline · τα 3 διορθωμένα αρχεία = 0
 *   Π1..Π3  — ΑΠΟΔΕΙΞΗ σε ΠΡΑΓΜΑΤΙΚΟ ιστορικό κώδικα (ΚΑΡΦΩΜΕΝΟ commit, ποτέ `HEAD`)
 *   Θ1..Θ10 — θετικά: κάθε μορφή ωμής εφεδρείας μετρά
 *   Α1..Α10 — αρνητικά: κείμενο, κενό, εμφωλευμένο `t()`, `defaultValue` ΕΞΩ από `t(…)`
 *   Ρ1..Ρ5  — η λογική του ratchet (καθαρή συνάρτηση)
 *   Ε1..Ε6  — η πύλη ΕΚΤΕΛΕΙΤΑΙ πάνω σε αρχεία fixture (νέο · αύξηση · ίσο · μείωση · fail-closed · SKIP)
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { findRawFallbacks } = require('../lib/i18n-raw-fallback/detect');
const { compare, inScope } = require('../lib/i18n-raw-fallback/ratchet');

const REPO = path.resolve(__dirname, '..', '..');
const GATE = path.join(REPO, 'scripts', 'check-i18n-raw-fallback.js');

/** 🔴 ΚΑΡΦΩΜΕΝΟ — το τελευταίο commit όπου τα τρία αρχεία της λίστας κτιρίων είχαν ΖΩΝΤΑΝΗ την ωμή εφεδρεία. */
const PINNED = '1d92fcbf';
const HISTORICAL = [
  { file: 'src/domain/cards/building/useBuildingCardModel.ts', count: 2 },
  { file: 'src/components/building-management/BuildingCard.tsx', count: 1 },
  { file: 'src/components/building-management/BuildingsPage/BuildingsGroupedView.tsx', count: 2 },
];

const count = (src, name = 'probe.tsx') => findRawFallbacks(src, name).length;

/** Εκτελεί την πύλη σε ρίζα fixture. `{ blocked, out }` — ποτέ σιωπηλό. */
function runGate(root, args, extraEnv = {}) {
  const env = { ...process.env, I18N_RAW_FALLBACK_ROOT: root, ...extraEnv };
  delete env.SKIP_I18N_RAW_FALLBACK;
  Object.assign(env, extraEnv);
  try {
    return { blocked: false, out: execFileSync('node', [GATE, ...args], { cwd: REPO, encoding: 'utf8', env }) };
  } catch (err) {
    return { blocked: true, out: String(err.stdout ?? '') };
  }
}

function gitShow(rev, file) {
  const out = execFileSync('git', ['show', `${rev}:${file}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 << 20 });
  if (!out.trim()) throw new Error(`Το git show ${rev}:${file} δεν επέστρεψε τίποτα — το test δεν εκτέλεσε κώδικα.`);
  return out;
}

describe('Μ0 — η βάση', () => {
  it('το ζωντανό `src/` περνά απέναντι στην πραγματική baseline', () => {
    const { blocked, out } = runGate(REPO, ['--all']);
    expect(out).toContain('CHECK 3.97');
    expect(blocked).toBe(false);
  });

  it.each(HISTORICAL)('το ΣΗΜΕΡΙΝΟ $file έχει 0 ευρήματα — η διόρθωση είναι πραγματική', ({ file }) => {
    expect(count(fs.readFileSync(path.join(REPO, file), 'utf8'), file)).toBe(0);
  });
});

describe('Π — η πύλη πιάνει το ΠΡΑΓΜΑΤΙΚΟ περιστατικό της λίστας κτιρίων', () => {
  it.each(HISTORICAL)('Π: $file στο καρφωμένο commit ⇒ $count εύρημα(τα)', ({ file, count: n }) => {
    const source = gitShow(PINNED, file);
    expect(source).toContain('defaultValue:');
    expect(count(source, file)).toBe(n);
  });
});

describe('Θ — θετικά: ό,τι δεν αποδεικνύεται κείμενο μετρά', () => {
  it.each([
    ['Θ1 identifier', 't(`status.${x}`, { defaultValue: x })'],
    ['Θ2 πρόσβαση μέλους', 't(`s.${b.status}`, { defaultValue: b.status })'],
    ['Θ3 template με ${}', 't(k, { defaultValue: `${x}` })'],
    ['Θ4 ??', "t(k, { defaultValue: x ?? 'standard' })"],
    ['Θ5 ||', "t(k, { defaultValue: err || '' })"],
    ['Θ6 shorthand', 't(k, { defaultValue })'],
    ['Θ7 τριαδικός με ωμό κλάδο', "t(k, { defaultValue: c ? t('a') : raw })"],
    ['Θ8 String(x)', 't(k, { defaultValue: String(x) })'],
    ['Θ9 i18n.t', 'i18n.t(k, { defaultValue: x })'],
    ['Θ10 συνώνυμο tCommon', 'tCommon(k, { count: 2, defaultValue: x })'],
  ])('%s', (_name, expr) => {
    expect(count(`const v = ${expr};`)).toBe(1);
  });
});

describe('Α — αρνητικά: γνωστό κείμενο, ή όχι κλήση μετάφρασης', () => {
  it.each([
    ['Α1 κυριολεκτική', "t(k, { defaultValue: 'Κείμενο' })"],
    ['Α2 κενή', "t(k, { defaultValue: '' })"],
    ['Α3 template χωρίς ${}', 't(k, { defaultValue: `Κείμενο` })'],
    ['Α4 εμφωλευμένο t()', "t(k, { defaultValue: t('types.other') })"],
    ['Α5 τριαδικός με δύο t()', "t(k, { defaultValue: c ? t('a') : t('b') })"],
    ['Α6 undefined', 't(k, { defaultValue: undefined })'],
    ['Α7 hook ρυθμίσεων', 'useState({ defaultValue: DEFAULT_X })'],
    ['Α8 άσχετη συνάρτηση', 'format(k, { defaultValue: x })'],
    ['Α9 χωρίς επιλογές', 't(`status.${x}`)'],
  ])('%s', (_name, expr) => {
    expect(count(`const v = ${expr};`)).toBe(0);
  });

  it('Α10 Radix `<Accordion defaultValue={x}>` — JSX γνώρισμα, όχι κλήση', () => {
    expect(count('export const A = ({ x }) => <Accordion type="multiple" defaultValue={x} />;')).toBe(0);
  });
});

describe('Ρ — ratchet ανά αρχείο', () => {
  it('Ρ1 νέο αρχείο ⇒ παλινδρόμηση με isNewFile', () => {
    expect(compare({ 'src/a.ts': 1 }, {}, 'staged', ['src/a.ts']).regressions).toEqual([{ file: 'src/a.ts', was: 0, now: 1, isNewFile: true }]);
  });
  it('Ρ2 αύξηση ⇒ παλινδρόμηση', () => {
    expect(compare({ 'src/a.ts': 3 }, { 'src/a.ts': 2 }, 'staged', ['src/a.ts']).regressions).toHaveLength(1);
  });
  it('Ρ3 ίσο ⇒ τίποτα', () => {
    expect(compare({ 'src/a.ts': 2 }, { 'src/a.ts': 2 }, 'staged', ['src/a.ts'])).toEqual({ regressions: [], progress: [] });
  });
  it('Ρ4 μείωση ως το μηδέν ⇒ πρόοδος, ΜΟΝΟ για ό,τι σαρώθηκε', () => {
    expect(compare({}, { 'src/a.ts': 2, 'src/b.ts': 1 }, 'staged', ['src/a.ts']).progress).toEqual([{ file: 'src/a.ts', was: 2, now: 0 }]);
    expect(compare({}, { 'src/a.ts': 2, 'src/b.ts': 1 }, 'all').progress).toHaveLength(2);
  });
  it('Ρ5 εμβέλεια: tests, mocks, .d.ts, locales ΕΞΩ · dxf-viewer ΜΕΣΑ', () => {
    expect(inScope('src/a/__tests__/x.test.ts')).toBe(false);
    expect(inScope('src/a/x.spec.tsx')).toBe(false);
    expect(inScope('src/types/x.d.ts')).toBe(false);
    expect(inScope('src/i18n/locales/el/x.ts')).toBe(false);
    expect(inScope('scripts/x.ts')).toBe(false);
    expect(inScope('src/subapps/dxf-viewer/x.tsx')).toBe(true);
  });
});

describe('Ε — η πύλη ΕΚΤΕΛΕΙΤΑΙ πάνω σε fixtures', () => {
  let root;
  const baselinePath = () => path.join(root, '.i18n-raw-fallback-baseline.json');
  const writeSrc = (rel, n) => {
    const lines = Array.from({ length: n }, (_, i) => `export const v${i} = t(\`s.\${x}\`, { defaultValue: x });`);
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), `declare const t: (k: string, o?: object) => string;\ndeclare const x: string;\n${lines.join('\n')}\n`);
  };
  const seed = (files) => fs.writeFileSync(baselinePath(), JSON.stringify({ _meta: {}, files }));

  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-3-97-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('Ε1 νέο αρχείο με εύρημα ⇒ ΜΠΛΟΚ, με γραμμή', () => {
    seed({}); writeSrc('src/new.ts', 1);
    const { blocked, out } = runGate(root, ['src/new.ts']);
    expect(blocked).toBe(true);
    expect(out).toContain('ΝΕΟ ΑΡΧΕΙΟ');
    expect(out).toContain('γραμμή 3');
  });
  it('Ε2 αύξηση ⇒ ΜΠΛΟΚ', () => {
    seed({ 'src/a.ts': 1 }); writeSrc('src/a.ts', 2);
    expect(runGate(root, ['src/a.ts']).out).toContain('1 → 2');
  });
  it('Ε3 ίσο ⇒ περνά', () => {
    seed({ 'src/a.ts': 2 }); writeSrc('src/a.ts', 2);
    expect(runGate(root, ['src/a.ts']).blocked).toBe(false);
  });
  it('Ε4 μείωση ⇒ περνά και τυπώνει την πρόοδο', () => {
    seed({ 'src/a.ts': 3 }); writeSrc('src/a.ts', 1);
    const { blocked, out } = runGate(root, ['src/a.ts']);
    expect(blocked).toBe(false);
    expect(out).toContain('3 → 1');
  });
  it('Ε5 baseline λείπει ⇒ ΜΠΛΟΚ (fail-closed)', () => {
    writeSrc('src/a.ts', 1);
    expect(runGate(root, ['src/a.ts']).blocked).toBe(true);
  });
  it('Ε6 SKIP_I18N_RAW_FALLBACK=1 ⇒ περνά · --write-baseline γράφει τον πραγματικό αριθμό', () => {
    seed({}); writeSrc('src/new.ts', 2);
    expect(runGate(root, ['src/new.ts'], { SKIP_I18N_RAW_FALLBACK: '1' }).blocked).toBe(false);
    runGate(root, ['--write-baseline']);
    expect(JSON.parse(fs.readFileSync(baselinePath(), 'utf8')).files).toEqual({ 'src/new.ts': 2 });
  });
});
