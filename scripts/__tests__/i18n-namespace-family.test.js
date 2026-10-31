/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ — CHECK 3.108 / ADR-280 §11, «μία δήλωση οικογένειας namespaces».
 *
 * ⚠️ ΒΑΘΜΟΝΟΜΗΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ (`git show <καρφωμένο>:`), ποτέ μόνο σε fixture: το καρφωμένο commit είναι η
 * κατάσταση ΠΡΙΝ το codemod — η πύλη πρέπει να πιάνει εκεί τη χειρόγραφη λίστα που ήταν γραμμένη ~650 φορές.
 * ⚠️ **ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`**· το `gitShow` **σκάει** σε κενή απάντηση.
 */
'use strict';

const { execFileSync } = require('node:child_process');

const gate = require('../check-i18n-namespace-family');
const { KINDS, findArrayCalls, classify, proposeFix, renderList } = require('../lib/i18n-namespace-family/scan');
const { proveEquivalent, loadLocaleIndex, ANY_REQUEST } = require('../lib/i18n-namespace-family/equivalence');
const { requestOf } = require('../lib/i18n-namespace-family/request');
const { compareWithBaseline } = require('../lib/i18n-namespace-family/baseline');
const { loadCompatNamespaces } = require('../lib/i18n-namespace-extract');
const { openGateInput } = require('../lib/gate-input');

const ROOT = gate.PROJECT_ROOT;
const PINNED = '0c9895f6'; // ΠΡΙΝ το codemod (ADR-280 §11)

function gitShow(rev, relPath) {
  const out = execFileSync('git', ['show', `${rev}:${relPath}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (!out || !out.trim()) throw new Error(`gitShow κενό: ${rev}:${relPath} — άκυρη βαθμονόμηση`);
  return out;
}

const COMPAT = new Map([
  ['building', ['building-storage', 'building-address', 'building-filters', 'building-timeline', 'building-tabs']],
  ['common', ['common-actions', 'common-shared']],
]);

/** Συνθετικός δείκτης locale: `γλώσσα → ns → Map(μονοπάτι → φύλλο;)`. */
function index(byNs) {
  const langMap = new Map();
  for (const [ns, paths] of Object.entries(byNs)) langMap.set(ns, new Map(Object.entries(paths)));
  return new Map([['el', langMap]]);
}

describe('Π — βαθμονόμηση σε πραγματικό ιστορικό', () => {
  it.each([
    ['src/components/building-management/BuildingCard.tsx', 'building'],
    ['src/subapps/accounting/components/reports/ExportBar.tsx', 'accounting'],
  ])('Π1 — %s: η χειρόγραφη οικογένεια «%s» ΠΙΑΝΕΤΑΙ ως Κ1', (rel, parent) => {
    const compat = loadCompatNamespaces(ROOT);
    const calls = findArrayCalls(gitShow(PINNED, rel));
    const verdicts = calls.map((c) => classify(c.items, compat));
    expect(verdicts).toContainEqual({ kind: KINDS.PARENT_WITH_SPLITS, parents: [parent] });
  });

  it('Π2 — ΠΡΑΓΜΑΤΙΚΗ σύγκρουση (`navigation.actions.delete.label`: common-navigation ∩ properties-detail) ⇒ ΟΧΙ ισοδύναμο', () => {
    const input = openGateInput({ root: ROOT });
    const compat = loadCompatNamespaces(ROOT, input);
    const proof = proveEquivalent(['properties', 'common', 'common-navigation'], ['properties', 'common'], compat, loadLocaleIndex(input));
    expect(proof.equivalent).toBe(false);
    expect(proof.reason).toMatch(/common-navigation → properties-detail/);
  });

  it('Π3 — το ΠΡΑΓΜΑΤΙΚΟ κτίριο: 6 → 1 είναι ισοδύναμο (το `tabs` είναι κοινό ΜΟΝΟ ως αντικείμενο)', () => {
    const input = openGateInput({ root: ROOT });
    const compat = loadCompatNamespaces(ROOT, input);
    const hand = ['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline'];
    const noObjects = { ...ANY_REQUEST, objects: false };
    expect(proveEquivalent(hand, ['building'], compat, loadLocaleIndex(input), noObjects)).toEqual({ equivalent: true });
    expect(proveEquivalent(hand, ['building'], compat, loadLocaleIndex(input)).equivalent).toBe(false);
  });
});

describe('Σ — σαρωτής', () => {
  it('Σ1 — πολλές γραμμές, `"` και `\'`, θέσεις στο ΑΡΧΙΚΟ κείμενο', () => {
    const src = "x;\nconst { t } = useTranslation([\n  \"building\",\n  'building-storage',\n]);\n";
    const [call] = findArrayCalls(src);
    expect(call.items).toEqual(['building', 'building-storage']);
    expect(src.slice(call.start, call.end).startsWith('[')).toBe(true);
    expect(call.line).toBe(2);
  });
  it('Σ2 — σχόλιο ΔΕΝ μετράει· μη-literal ⇒ `items: null`', () => {
    expect(findArrayCalls("// useTranslation(['building', 'building-tabs'])")).toEqual([]);
    expect(findArrayCalls('useTranslation([...NS, "x"])')[0].items).toBeNull();
  });
});

describe('Κ — κανόνες', () => {
  it('Κ1 — γονέας + split ⇒ ⛔', () => {
    expect(classify(['building', 'building-tabs'], COMPAT).kind).toBe(KINDS.PARENT_WITH_SPLITS);
  });
  it('Κ1′ — split στο `[0]` είναι primary, ΟΧΙ επανάληψη', () => {
    expect(classify(['common-shared', 'common'], COMPAT).kind).toBe(KINDS.CLEAN);
  });
  it('Κ2 — ΟΛΑ τα splits χωρίς γονέα ⇒ ⛔· ένα split μόνο του ⇒ καθαρό', () => {
    expect(classify(['common-actions', 'common-shared'], COMPAT).kind).toBe(KINDS.ALL_SPLITS);
    expect(classify(['common-actions'], COMPAT).kind).toBe(KINDS.CLEAN);
  });
  it('Κ3 — bundle με γονέα χωρίς όλα τα splits ⇒ ⛔', () => {
    const input = { root: '/r', read: () => "export const X = ['common', 'common-actions'] as const;" };
    const out = gate.bundleViolations(input, COMPAT);
    expect(out).toHaveLength(1);
    expect(out[0].detail).toMatch(/common-shared/);
  });
});

describe('Δ — διόρθωση + απόδειξη', () => {
  it('Δ1 — κρατά `[0]` και σειρά· ένα στοιχείο ⇒ literal', () => {
    expect(proposeFix(['building', 'building-tabs', 'trash', 'building-storage'], COMPAT)).toEqual(['building', 'trash']);
    expect(renderList(['building'], "'")).toBe("'building'");
    expect(renderList(['a', 'b'], '"')).toBe('["a", "b"]');
  });
  it('Δ2 — ξένο namespace με ΚΟΙΝΟ φύλλο περνά μπροστά ⇒ ΟΧΙ ισοδύναμο', () => {
    const idx = index({ building: {}, 'building-tabs': { 'x.y': true }, trash: { 'x.y': true } });
    const proof = proveEquivalent(['building', 'building-tabs', 'trash'], ['building', 'trash'], COMPAT, idx);
    expect(proof).toEqual({ equivalent: false, reason: 'el: «x.y» building-tabs → trash' });
  });
  it('Δ3 — κοινό ΜΟΝΟ αντικείμενο: μετράει μόνο με `returnObjects`', () => {
    const idx = index({ building: {}, 'building-tabs': { tabs: false }, trash: { tabs: false } });
    const args = [['building', 'building-tabs', 'trash'], ['building', 'trash'], COMPAT, idx];
    expect(proveEquivalent(...args, { ...ANY_REQUEST, objects: false }).equivalent).toBe(true);
    expect(proveEquivalent(...args, ANY_REQUEST).equivalent).toBe(false);
  });
  it('Δ4 — κλειδί με ΡΗΤΟ ns που το έχει ⇒ η σειρά δεν το αγγίζει· χωρίς ns ⇒ το αγγίζει', () => {
    const idx = index({ building: {}, 'building-tabs': { 'x.y': true }, trash: { 'x.y': true } });
    const args = [['building', 'building-tabs', 'trash'], ['building', 'trash'], COMPAT, idx];
    const base = { all: false, objects: false, prefixes: [] };
    expect(proveEquivalent(...args, { ...base, keys: [{ ns: 'trash', key: 'x.y' }] }).equivalent).toBe(true);
    expect(proveEquivalent(...args, { ...base, keys: [{ ns: null, key: 'x.y' }] }).equivalent).toBe(false);
  });
  it('Δ5 — `fixContent`: αποδεδειγμένο ⇒ γράφεται· σύγκρουση ⇒ ΜΕΝΕΙ ως έχει και αναφέρεται', () => {
    const idx = index({ building: {}, 'building-tabs': { 'x.y': true }, trash: { 'x.y': true } });
    const ctx = { compat: COMPAT, localeIndex: () => idx, request: () => ANY_REQUEST };
    const ok = gate.fixContent("useTranslation(['building', 'building-tabs'])", ctx, () => {});
    expect(ok.next).toBe("useTranslation('building')");
    const skipped = [];
    const src = "useTranslation(['building', 'building-tabs', 'trash'])";
    expect(gate.fixContent(src, ctx, (line, reason) => skipped.push(reason)).next).toBe(src);
    expect(skipped).toEqual(['el: «x.y» building-tabs → trash']);
  });
});

describe('Ρ — τι μπορεί να ζητήσει το αρχείο', () => {
  const file = 'x.tsx';
  it('Ρ1 — literal κλειδιά, χωρίς διαφυγή ⇒ ΟΧΙ «τα πάντα»', () => {
    const r = requestOf("const { t } = useTranslation('a');\nconst x = t('k.one');\nuseMemo(() => 1, [t]);", file);
    expect(r.all).toBe(false);
    expect(r.keys).toEqual([{ ns: null, key: 'k.one' }]);
  });
  it('Ρ2 — `t` ως ΤΙΜΗ (όρισμα / prop) ⇒ «τα πάντα»', () => {
    expect(requestOf("const { t } = useTranslation('a');\nformat(t, 1);", file).all).toBe(true);
    expect(requestOf("const { t } = useTranslation('a');\nconst e = <Row t={t} />;", file).all).toBe(true);
  });
  it('Ρ3 — ανεπίλυτο κλειδί ⇒ «τα πάντα»', () => {
    expect(requestOf("const { t } = useTranslation('a');\nt(step.key);", file).all).toBe(true);
  });
});

describe('Β — ratchet κατά ταυτότητα (order-bearing)', () => {
  const entry = { file: 'a.tsx', items: ['building', 'building-tabs', 'trash'] };
  it('Β1 — γνωστή ⇒ περνά· νέα ⇒ μπλοκάρει· εξαφανισμένη ⇒ μπαγιάτικη', () => {
    const known = new Map([['a.tsx::[building,building-tabs,trash]', 1], ['gone.tsx::[x]', 1]]);
    const { fresh, stale } = compareWithBaseline([entry, { ...entry, file: 'b.tsx' }], known);
    expect(fresh.map((e) => e.file)).toEqual(['b.tsx']);
    expect(stale).toEqual(['gone.tsx::[x]']);
  });
});

describe('Μ — main (ραφή ένεσης)', () => {
  const blocking = { blocking: [{ file: 'a.tsx', line: 1, state: KINDS.PARENT_WITH_SPLITS, detail: 'x' }] };
  afterEach(() => { delete process.env.SKIP_I18N_NAMESPACE_FAMILY; });
  it('Μ1 — παράβαση ⇒ 1· καθαρό ⇒ 0', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(gate.main([], () => blocking)).toBe(1);
    expect(gate.main([], () => ({ blocking: [] }))).toBe(0);
    spy.mockRestore();
  });
  it('Μ2 — escape ⇒ 0 χωρίς να μετρήσει', () => {
    process.env.SKIP_I18N_NAMESPACE_FAMILY = '1';
    expect(gate.main([], () => { throw new Error('δεν έπρεπε να τρέξει'); })).toBe(0);
  });
});
