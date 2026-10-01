/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ — CHECK 3.70 / ADR-808, «αδέσμευτα αναγνωριστικά».
 *
 * ⚠️ Η ΒΑΘΜΟΝΟΜΗΣΗ ΤΡΕΧΕΙ ΣΕ **ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ ΚΩΔΙΚΑ** (`git show <καρφωμένο>:`),
 * ποτέ σε fixture: ένα fixture αποδεικνύει ότι η πύλη αντιδρά σε **ό,τι της έγραψα εγώ**·
 * μόνο ο πραγματικός κώδικας αποδεικνύει ότι θα είχε πιάσει τη **ζωντανή** βλάβη.
 * ⚠️ **ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`** — το `HEAD` μετακινείται και οι άγκυρες θα
 * αυτοακυρώνονταν σιωπηλά. Το `gitShow` **σκάει** σε κενή απάντηση.
 */

'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const gate = require('../check-unbound-identifiers');
const { scanFile, ambientGlobals, harvestGlobals } = require('../lib/module-graph/unbound-identifiers');
const { windowValueGlobals } = require('../lib/module-graph/scope-resolution');
const ts = require('typescript');

const ROOT = gate.PROJECT_ROOT;
const PINNED = '95056738';   // η κατάσταση ΠΡΙΝ τη διόρθωση των 10 (ADR-808 §3)

function gitShow(rev, relPath) {
  const out = execFileSync('git', ['show', `${rev}:${relPath}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (!out || !out.trim()) throw new Error(`gitShow κενό: ${rev}:${relPath} — άκυρη βαθμονόμηση`);
  return out;
}

const namesIn = (rel, src) => scanFile(rel, src, ROOT).unbound.map((h) => h.name);

// ───────────────────────────────────────────────────────────── Π — ΒΑΘΜΟΝΟΜΗΣΗ
describe('Π — βαθμονόμηση σε πραγματικό ιστορικό κώδικα', () => {
  const CASES = [
    ['src/lib/auth/roles.ts', 'RoleDefinition', 'επανεξαγωγή τύπου χωρίς εισαγωγή (αρχείο ΑΣΦΑΛΕΙΑΣ)'],
    ['src/subapps/dxf-viewer/bim/table/table-cell-reference.ts', 'TableCellAddress', 'ίδιο μοτίβο'],
    ['src/subapps/dxf-viewer/bim/geometry/shared/xy-bounds.ts', 'MinMaxRect', 'ξεχασμένη εισαγωγή'],
    ['src/components/building-management/building-services.ts', 'BuildingUpdatePayload', 'επανεξαγωγή σχημάτων'],
    ['src/app/api/conversations/[conversationId]/messages/route.ts', 'MessagesCanonicalResponse', 'τύπος που ΔΕΝ ΥΠΗΡΞΕ ΠΟΤΕ'],
    ['src/subapps/dxf-viewer/systems/properties/PropertiesPalette.tsx', 'entity', 'ΖΩΝΤΑΝΟ ReferenceError στην οθόνη'],
    ['src/subapps/geo-canvas/profiling/performance-profiler-collectors.ts', 'NetworkInformation', 'ξεχασμένη εισαγωγή'],
    ['src/lib/geo/__tests__/geo-ring.test.ts', 'GeoPoint', 'ξεχασμένη εισαγωγή σε test'],
  ];

  it.each(CASES)('Π1 — %s: το «%s» ΠΙΑΝΕΤΑΙ στο %s (%s)', (rel, symbol) => {
    expect(namesIn(rel, gitShow(PINNED, rel))).toContain(symbol);
  });

  it.each(CASES)('Π2 — %s: η ΣΗΜΕΡΙΝΗ εκδοχή είναι ΚΑΘΑΡΗ (ο παρονομαστής)', (rel) => {
    const fs = require('node:fs');
    expect(namesIn(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'))).toEqual([]);
  });

  it('🔴 Π3 — ΠΑΡΟΝΟΜΑΣΤΗΣ: το καρφωμένο commit περιέχει ΟΝΤΩΣ βλάβες', () => {
    // Χωρίς αυτό, ένα Π1 που περνά θα μπορούσε να σημαίνει «το git επέστρεψε σκουπίδια».
    const total = CASES.reduce((n, [rel]) => n + namesIn(rel, gitShow(PINNED, rel)).length, 0);
    expect(total).toBeGreaterThanOrEqual(CASES.length);
  });
});

// ───────────────────────────────────────────────────────────── Ε — ΕΜΒΕΛΕΙΑ (ADR-808 §11)
describe('Ε — όνομα δηλωμένο σε ΑΛΛΗ εμβέλεια (το κενό του επίπεδου συνόλου)', () => {
  // Ο refactor `d2534967` έβαλε `renderQuoteRow` + `toolbar` ΜΕΣΑ στον comparator ενός `sort`
  // ⇒ React #31 (`[object BarProp]`) στην παραγωγή, ενώ η πύλη απαντούσε `unbound: []`.
  const QL = 'src/subapps/procurement/components/QuoteList.tsx';
  const hitsIn = (src, rel = QL) => scanFile(rel, src, ROOT).unbound.map((h) => `${h.name}:${h.reason}`);

  it('🔴 Ε1 — το ΖΩΝΤΑΝΟ σφάλμα ΠΙΑΝΕΤΑΙ, με τον ΣΩΣΤΟ λόγο για το καθένα', () => {
    expect(hitsIn(gitShow('d2534967', QL)).sort())
      .toEqual(['renderQuoteRow:out-of-scope', 'toolbar:out-of-scope-window']);
  });

  it('Ε2 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο γονέας του commit και η σημερινή εκδοχή είναι ΚΑΘΑΡΟΙ', () => {
    const fs = require('node:fs');
    expect(hitsIn(gitShow('d2534967^', QL))).toEqual([]);
    expect(hitsIn(fs.readFileSync(path.join(ROOT, QL), 'utf8'))).toEqual([]);
  });

  it.each([
    ['μπλοκ μέσα σε callback', 'export function f() { [1].map(() => { const inner = 1; return inner; }); return inner; }', 'inner:out-of-scope'],
    ['ιδιότητα του window (σιωπηλή)', 'export function f() { if (1) { const status = 1; void status; } return status; }', 'status:out-of-scope-window'],
    ['function μέσα σε μπλοκ (module = strict)', 'export function f() { { function hid() {} } return hid; }', 'hid:out-of-scope'],
    ['μέλος enum έξω από το enum', 'enum E { A = 1 } export const z = A;', 'A:out-of-scope'],
  ])('🔴 Ε3 — %s ⇒ ΠΙΑΝΕΤΑΙ', (_label, src, expected) => {
    expect(hitsIn(src, 'x.ts')).toEqual([expected]);
  });

  it.each([
    ['hoisting function', 'export function a() { return b(); } function b() { return 1; }'],
    ['όνομα function expression', 'export const f = function self(n: number): number { return n ? self(n - 1) : 0; };'],
    ['μέλη namespace', 'namespace N { export const x = 1; export const y = x + 1; } export const z = N.y;'],
    ['μέλος enum ΜΕΣΑ στο enum', 'enum E { A = 1, B = A + 1 } export const e = E.B;'],
    ['catch / παράμετροι τύπων', 'export function g<T>(v: T): T | string { try { return v; } catch (err) { return String(err); } }'],
    ['var hoisting από μπλοκ', 'export function h() { if (1) { var late = 1; } return late; }'],
    ['shorthand', 'export function k(a: number) { const o = { a }; return o; }'],
    ['τοπικό `it` + καθολικό `it` του jest (ήταν 82 σημεία)', "it('x', () => { [1].find((it) => it === 1); });"],
  ])('Ε4 — %s ⇒ ΚΑΘΑΡΟ (κανένα ψευδώς θετικό)', (_label, src) => {
    expect(hitsIn(src, 'x.ts')).toEqual([]);
  });

  it('🔴 Ε5 — οι ιδιότητες του window ΠΑΡΑΓΟΝΤΑΙ από το lib.dom, χωρίς τα καθολικά του jest', () => {
    const w = windowValueGlobals();
    for (const n of ['toolbar', 'status', 'name', 'history', 'event']) expect(`${n}: ${w.has(n)}`).toBe(`${n}: true`);
    for (const n of ['it', 'jest', 'describe', 'renderQuoteRow']) expect(`${n}: ${w.has(n)}`).toBe(`${n}: false`);
    expect(w.size).toBeGreaterThan(300);
  });
});

// ───────────────────────────────────────────────────────────── Κ — ΣΥΜΒΟΛΑΙΟ
describe('Κ — το συμβόλαιο της πύλης', () => {
  // ⚠️ ΜΙΑ πλήρης σάρωση για όλες τις άγκυρες που τη χρειάζονται: τρεις ξεχωριστές
  //    κόστιζαν 84s σε μια σουίτα που το CHECK 3.54 τρέχει σε ΚΑΘΕ PR.
  let full;
  beforeAll(() => { full = gate.measure(['--all']); }, 180_000);

  it('Κ1 — η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ σε πλήρη σάρωση, και ο παρονομαστής δεν είναι μηδέν', () => {
    const sum = Object.values(full.tally).reduce((a, b) => a + b, 0);
    expect(full.files).toBeGreaterThan(10000);
    expect(sum).toBe(full.files);
  });

  it('🔴 Κ2 — το ΠΡΑΓΜΑΤΙΚΟ δέντρο είναι ΚΑΘΑΡΟ (η προϋπόθεση του zero-tolerance)', () => {
    expect(full.violations).toEqual([]);
    expect(full.tally[gate.STATES.UNBOUND]).toBe(0);
  });

  it('🔴 Κ3 — «δεν αναλύθηκε» ΔΕΝ μετριέται ως «καθαρό»', () => {
    const broken = scanFile('x.ts', 'const a = (((;', ROOT);
    expect(broken.parsed).toBe(false);
    expect(broken.unbound).toEqual([]);   // δεν εφευρίσκει πάνω σε σπασμένη σύνταξη
  });

  it('🔴 Κ4 — `export … from` ΔΕΝ δεσμεύει· `import` + `export` ΔΕΣΜΕΥΕΙ', () => {
    const bad = "export type { X } from './y';\nexport function f(): X | null { return null; }\n";
    const good = "import type { X } from './y';\nexport type { X };\nexport function f(): X | null { return null; }\n";
    expect(namesIn('a.ts', bad)).toContain('X');
    expect(namesIn('a.ts', good)).toEqual([]);
  });

  it('Κ5 — τα ΚΑΘΟΛΙΚΑ δεν αναφέρονται (αλλιώς η πύλη ουρλιάζει σε σωστό κώδικα)', () => {
    const src = 'export const f = (e: HTMLElement, r: Record<string, number>): Promise<void> => {\n'
      + '  console.log(e, r, JSON.stringify({}), Math.max(1, 2));\n  return Promise.resolve();\n};\n';
    expect(namesIn('a.ts', src)).toEqual([]);
  });

  it('🔴 Κ6 — τα ΜΕΤΑΒΑΤΙΚΑ ambient namespaces είναι γνωστά (ήταν 131 σημεία θορύβου)', () => {
    const amb = ambientGlobals(ROOT);
    expect(amb.has('FirebaseFirestore')).toBe(true);   // optionalDependencies του firebase-admin
    expect(amb.has('GeoJSON')).toBe(true);             // `export as namespace`
  });

  it('🔴 Κ7 — τα καθολικά είναι ΑΚΡΙΒΗ, όχι φουσκωμένα: μέλη namespace ΔΕΝ είναι καθολικά', () => {
    const out = new Set();
    harvestGlobals(ts.createSourceFile('d.d.ts',
      'declare namespace Outer {\n  interface Inner { a: number }\n  class Thing {}\n}\n',
      ts.ScriptTarget.Latest, false, ts.ScriptKind.TS), out);
    expect([...out]).toEqual(['Outer']);   // ΟΧΙ Inner, ΟΧΙ Thing
  });

  it('🔴 Κ8 — module `.d.ts`: τίποτα καθολικό εκτός από `declare global` και `export as namespace`', () => {
    const out = new Set();
    harvestGlobals(ts.createSourceFile('m.d.ts',
      "import x from 'y';\nexport interface NotGlobal { a: 1 }\nexport as namespace Umd;\n"
      + 'declare global {\n  interface ReallyGlobal { b: 2 }\n}\n',
      ts.ScriptTarget.Latest, false, ts.ScriptKind.TS), out);
    expect([...out].sort()).toEqual(['ReallyGlobal', 'Umd']);
  });

  it('Κ9 — script `.d.ts` (χωρίς import/export): ΟΛΑ καθολικά', () => {
    const out = new Set();
    harvestGlobals(ts.createSourceFile('s.d.ts',
      'declare interface A { x: 1 }\ndeclare var B: number;\ndeclare function C(): void;\n',
      ts.ScriptTarget.Latest, false, ts.ScriptKind.TS), out);
    expect([...out].sort()).toEqual(['A', 'B', 'C']);
  });

  it('🔴 Κ10 — ο πυρήνας των καθολικών ΔΕΝ έχει καταρρεύσει (φρουρός της προσωρινής μνήμης)', () => {
    const amb = ambientGlobals(ROOT);
    for (const n of ['HTMLElement', 'Promise', 'NodeJS', 'React', 'jest']) expect(amb.has(n)).toBe(true);
    expect(amb.size).toBeGreaterThan(1500);
  });

  it('🔴 Κ11 — η μνήμη ΔΕΝ κρύβει πραγματικά σφάλματα: κανένα από τα 8 δεν είναι καθολικό', () => {
    const amb = ambientGlobals(ROOT);
    for (const n of ['RoleDefinition', 'TableCellAddress', 'MinMaxRect', 'BuildingUpdatePayload',
      'MessagesCanonicalResponse', 'entity', 'NetworkInformation', 'GeoPoint']) {
      expect(`${n}: ${amb.has(n)}`).toBe(`${n}: false`);
    }
  });

  it('Κ12 — η έξοδος διαφυγής υπάρχει και είναι ΜΙΑ', () => {
    process.env.SKIP_UNBOUND_IDENTIFIERS = '1';
    try { expect(gate.main(['--all'])).toBe(0); } finally { delete process.env.SKIP_UNBOUND_IDENTIFIERS; }
  });

  it('🔴 Κ13 — η κλιμάκωση σε πλήρη σάρωση: `.d.ts`/manifest ⇒ ΔΕΝ αρκούν τα σταδιοποιημένα', () => {
    // Δηλωμένο όριο του Layer 1: αν φύγει καθολική δήλωση, σπάνε αρχεία που κανείς δεν έστειλε.
    expect(full.scope).toBe('all');
  });
});

// ───────────────────────────────────────────────────────────── Μ — ΑΠΟΔΕΙΞΗ ΖΩΗΣ
describe('Μ — ο φρουρός είναι ΚΑΛΩΔΙΩΜΕΝΟΣ (μέσω ραφής ένεσης)', () => {
  const clean = () => ({ scope: 'all', files: 1, tally: {}, violations: [], blocking: [] });
  const dirty = () => ({
    scope: 'all', files: 1, tally: {},
    violations: [{ file: 'a.ts', name: 'X', line: 1 }],
    blocking: [{ file: 'a.ts', name: 'X', line: 1 }],
  });

  it('Μ0 — καθαρή μέτρηση ⇒ ΠΡΑΣΙΝΟ (ο παρονομαστής: το `main` μπορεί να πει «ναι»)', () => {
    expect(gate.main([], clean)).toBe(0);
  });

  it('🔴 Μ1 — βρώμικη μέτρηση ⇒ ΚΟΚΚΙΝΟ (χωρίς αυτό η πύλη είναι διακοσμητική)', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try { expect(gate.main([], dirty)).toBe(1); } finally { err.mockRestore(); }
  });

  it('🔴 Μ2 — το `--report` ΤΥΠΩΝΕΙ και ΔΕΝ μπλοκάρει, ακόμη και με ευρήματα', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try { expect(gate.main(['--report'], dirty)).toBe(0); } finally { log.mockRestore(); }
  });

  // 🔶 ΔΗΛΩΜΕΝΟ ΚΕΝΟ: ο φρουρός «η λογιστική δεν κλείνει» ΔΕΝ έχει άγκυρα. Για να
  //    πυροδοτήσει χρειάζεται αρχείο που δεν κατατάσσεται σε **καμία** από τις 4
  //    καταστάσεις — δομικά αδύνατο όσο ο βρόχος τελειώνει σε `else`. Ένα test που
  //    ξαναγράφει τη σύγκριση θα απεδείκνυε **τον εαυτό του**, όχι τον φρουρό
  //    (το σφάλμα του ADR-790 §9.1) — γι' αυτό δεν γράφτηκε.
});
