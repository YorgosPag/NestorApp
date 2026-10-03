/**
 * @jest-environment node
 *
 * CHECK 3.98 (ADR-904 Ε6) — η πύλη φρεσκάδας του συμβολαίου της εφαρμογής κινητού, και ο κοινός κριτής
 * `scripts/lib/generated-artifacts.js` (μοιράζεται με το CHECK 3.93).
 *
 *  Γ1 — ο κριτής: fresh / stale / missing / orphan, ανοχή CRLF·
 *  Γ2 — η πύλη στο πραγματικό αποθετήριο είναι πράσινη (το συμβόλαιο στο repo = ό,τι λέει ο κώδικας)·
 *  Γ3 — η πύλη ΚΟΚΚΙΝΙΖΕΙ σε χειρόγραφη αλλαγή του παραγόμενου αρχείου (μετάλλαξη σε αντίγραφο, ποτέ επί τόπου)·
 *  Γ4 — η εξαγωγή αρνείται στόχο σχετικό ή μέσα στο Νέστορα (μετρημένο: `C:nestor-mobile` έγραψε μέσα στο repo).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { STATES, applyJudgement, judgeOutputs } = require('../lib/generated-artifacts');
const { buildPlan, OUTPUT_ROOT } = require('../lib/capture-api-contract/plan');
const { judge } = require('../check-capture-api-contract');
const { targetRefusal } = require('../export-capture-api-contract');

const ROOT = path.resolve(__dirname, '..', '..');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'generated-artifacts-'));
}

describe('Γ1 — ο κοινός κριτής', () => {
  const outputs = [{ path: 'out/a.json', content: '{"a":1}\n' }, { path: 'out/b.json', content: '{"b":2}\n' }];

  it('missing → γράφεται → fresh', () => {
    const root = tempRoot();
    const first = judgeOutputs(root, outputs, 'out');
    expect(first.results.map((r) => r.state)).toEqual([STATES.MISSING, STATES.MISSING]);
    applyJudgement(root, outputs, first.results);
    expect(judgeOutputs(root, outputs, 'out').ok).toBe(true);
  });

  it('stale σε αλλαγή · orphan σε ξένο αρχείο · CRLF = fresh', () => {
    const root = tempRoot();
    applyJudgement(root, outputs, judgeOutputs(root, outputs, 'out').results);
    fs.writeFileSync(path.join(root, 'out/a.json'), '{"a":2}\n');
    fs.writeFileSync(path.join(root, 'out/b.json'), '{"b":2}\r\n');
    fs.writeFileSync(path.join(root, 'out/c.json'), '{}\n');
    const states = Object.fromEntries(judgeOutputs(root, outputs, 'out').results.map((r) => [r.path, r.state]));
    expect(states).toEqual({ 'out/a.json': STATES.STALE, 'out/b.json': STATES.FRESH, 'out/c.json': STATES.ORPHAN });
  });
});

describe('Γ2/Γ3 — η πύλη στο πραγματικό συμβόλαιο', () => {
  it('το σχέδιο χτίζεται χωρίς σφάλματα και περιέχει openapi.json + fixtures.json', () => {
    const plan = buildPlan(ROOT);
    expect(plan.errors).toEqual([]);
    expect(plan.outputs.map((o) => o.path)).toEqual([`${OUTPUT_ROOT}/openapi.json`, `${OUTPUT_ROOT}/fixtures.json`]);
  });

  it('το αποθηκευμένο συμβόλαιο είναι φρέσκο', () => {
    expect(judge(ROOT).results.filter((r) => r.state !== STATES.FRESH)).toEqual([]);
  });

  it('χειρόγραφη αλλαγή στο παραγόμενο αρχείο ⇒ stale (σε αντίγραφο του σχεδίου)', () => {
    const root = tempRoot();
    const plan = buildPlan(ROOT);
    applyJudgement(root, plan.outputs, judgeOutputs(root, plan.outputs, plan.outputRoot).results);
    const openapi = path.join(root, OUTPUT_ROOT, 'openapi.json');
    fs.writeFileSync(openapi, fs.readFileSync(openapi, 'utf8').replace('"maxBytes": 41943040', '"maxBytes": 52428800'));
    const states = judgeOutputs(root, plan.outputs, plan.outputRoot).results.map((r) => r.state);
    expect(states).toEqual([STATES.STALE, STATES.FRESH]);
  });
});

describe('Γ4 — ο στόχος της εξαγωγής', () => {
  const sibling = path.join(path.dirname(ROOT), 'nestor-mobile');
  const lookalike = `${ROOT}_other`;

  it.each([
    ['σχετική στον δίσκο (το \ που έφαγε το bash)', 'C:nestor-mobile'],
    ['σχετική', 'nestor-mobile'],
    ['η ρίζα του Νέστορα', ROOT],
    ['υποφάκελος του Νέστορα', path.join(ROOT, 'nestor-mobile')],
  ])('%s ⇒ άρνηση', (_label, target) => {
    expect(targetRefusal(target)).not.toBeNull();
  });

  it.each([
    ['αδελφό αποθετήριο', sibling],
    ['φάκελος με κοινό πρόθεμα ονόματος', lookalike],
  ])('%s ⇒ δεκτό', (_label, target) => {
    expect(targetRefusal(target)).toBeNull();
  });
});
