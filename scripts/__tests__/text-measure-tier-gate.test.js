/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ CHECK 3.64 — Η ΠΥΛΗ ΤΗΣ ΒΑΘΜΙΔΑΣ ΜΕΤΡΗΣΗΣ (ADR-799 Φάση 2)
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ** — μίνι-repo με **πραγματική** απογραφή, μία
 *    αλλαγή τη φορά· και ο μεταλλάκτης **ΟΥΡΛΙΑΖΕΙ** αν δεν άλλαξε τίποτα.
 *
 * ⚠️ `@jest-environment node`: η πύλη διαβάζει τον δίσκο.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const censusLib = require('../lib/text-measure-tier/census.js');
const gate = require('../lib/text-measure-tier/gate.js');
const cli = require('../check-text-measure-tier.js');

const S = gate.GATE_STATES;
const REPO_ROOT = path.join(__dirname, '..', '..');
const ENGINE = 'src/subapps/dxf-viewer/text-engine/fonts/text-advance.ts';
const LONG_REASON = 'δοκιμαστικός λόγος, αρκετά μακρύς ώστε να περάσει το υποχρεωτικό κατώφλι της πύλης';

const idsOf = (r, state) => r.rows.filter((x) => x.state === state).map((x) => x.id);
const counts = (r, ledger) => r.ledgers[ledger].tally;

/**
 * Μίνι-repo: αντιγράφει τα **πραγματικά** αρχεία-εισόδους (μηχανή μέτρησης + stub-font) ώστε
 * τα αποτυπώματα να είναι αληθινά, και δέχεται δικιά του απογραφή/δηλώσεις.
 */
function miniRepo({ observations, declarations = {}, engineEdit = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tier364-'));
  const copy = (rel, mutate) => {
    let text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    if (mutate) {
      const next = mutate(text);
      if (next === text) throw new Error(`η μετάλλαξη στο ${rel} ΔΕΝ άλλαξε τίποτα.`);
      text = next;
    }
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text);
  };
  copy(ENGINE, engineEdit);
  copy('src/subapps/dxf-viewer/text-engine/fonts/__tests__/_stub-font.ts');

  // Τα αρχεία test που «παρατηρήθηκαν» πρέπει να υπάρχουν, αλλιώς το αποτύπωμα είναι null.
  for (const o of observations) {
    const dest = path.join(root, o.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, `// fixture για ${path.basename(o.file)}\n`);
  }
  fs.writeFileSync(
    path.join(root, '.text-measure-tier.json'),
    JSON.stringify({ blindMeasureSuites: declarations }, null, 2),
  );
  // Η απογραφή γράφεται ΜΕΣΩ του πραγματικού συγγραφέα, ώστε το αποτύπωμα να παραχθεί όπως στην πράξη.
  const dir = path.join(root, censusLib.CENSUS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'w1.ndjson'), observations.map((o) => JSON.stringify(o)).join('\n') + '\n');
  censusLib.writeCensus(root);
  return root;
}

const blind = (file, dropped = ['bold']) => ({ file, glyph: 0, css: 0, nominal: 3, dropped });
const honest = (file) => ({ file, glyph: 0, css: 0, nominal: 5, dropped: [] });
const styled = (file) => ({ file, glyph: 4, css: 0, nominal: 0, dropped: [] });

const FIXTURE = [
  blind('src/subapps/dxf-viewer/bim/table/__tests__/fixture-blind.test.ts'),
  honest('src/subapps/dxf-viewer/bim/table/__tests__/fixture-honest.test.ts'),
  styled('src/subapps/dxf-viewer/bim/table/__tests__/fixture-styled.test.ts'),
];

// =============================================================================
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Μ0 — παρονομαστής', () => {
  it('Μ0α: το ΟΡΓΑΝΟ υπάρχει στη μηχανή μέτρησης', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, ENGINE), 'utf8');
    expect(src).toMatch(/export function __installAdvanceCensus/);
    expect(src).toMatch(/if \(!censusSink\) return baseAdvanceWorld/);
  });

  it('Μ0β: ΚΑΘΕ κατάστιχο κλείνει', () => {
    const result = gate.sweep(miniRepo({ observations: FIXTURE }));
    for (const [ledger, states] of Object.entries(gate.LEDGER_STATES)) {
      const summed = states.reduce((n, s) => n + result.ledgers[ledger].tally[s], 0);
      const emitted = result.rows.filter((r) => r.ledger === ledger).length;
      expect({ ledger, summed }).toEqual({ ledger, summed: result.ledgers[ledger].population });
      expect({ ledger, emitted }).toEqual({ ledger, emitted: summed });
    }
  });

  it('Μ0γ: ο συλλέκτης φορτώνει το ΚΑΝΟΝΙΚΟ jest.setup.js', () => {
    // Χωρίς αυτό, η απογραφή θα έτρεχε σε ΑΛΛΟ περιβάλλον από την κανονική σουίτα —
    // δηλαδή θα μετρούσε κάτι που κανείς δεν εκτελεί (σχήμα ADR-749).
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/lib/text-measure-tier/census-setup.js'), 'utf8');
    expect(src).toMatch(/require\(path\.join\(REPO_ROOT, 'jest\.setup\.js'\)\)/);
    expect(fs.existsSync(path.join(REPO_ROOT, 'jest.setup.js'))).toBe(true);
  });
});

// =============================================================================
// Κ — ΤΟ ΚΡΙΤΗΡΙΟ
// =============================================================================

describe('Κ — κριτήριο', () => {
  it('Κ1: 🔑 «nominal» ΜΟΝΟ ΤΟΥ ΔΕΝ είναι παραβίαση — παραβίαση είναι «nominal + ζητημένο στυλ»', () => {
    expect(censusLib.isBlind(honest('a.test.ts'))).toBe(false);
    expect(censusLib.isBlind(blind('b.test.ts'))).toBe(true);
    const result = gate.sweep(miniRepo({ observations: FIXTURE }));
    expect(idsOf(result, S.UNDECLARED_BLIND)).toEqual([FIXTURE[0].file]);
    expect(idsOf(result, S.HONEST_NOMINAL)).toEqual([FIXTURE[1].file]);
    expect(idsOf(result, S.STYLED_MEASURE)).toEqual([FIXTURE[2].file]);
  });

  it('Κ2: η ΣΕΙΡΑ είναι συμβόλαιο — σουίτα που μετρά ΚΑΙ σωστά ΚΑΙ τυφλά κρίνεται ΤΥΦΛΗ', () => {
    const mixed = { file: 'src/subapps/dxf-viewer/x/__tests__/mixed.test.ts', glyph: 9, css: 2, nominal: 1, dropped: ['italic'] };
    const result = gate.sweep(miniRepo({ observations: [mixed] }));
    expect(idsOf(result, S.UNDECLARED_BLIND)).toContain(mixed.file);
    expect(idsOf(result, S.STYLED_MEASURE)).not.toContain(mixed.file);
  });

  it('Κ3: η δήλωση ΚΑΤΑΝΑΛΩΝΕΤΑΙ — undeclared γίνεται declared', () => {
    const declarations = { [FIXTURE[0].file]: { reason: LONG_REASON } };
    const result = gate.sweep(miniRepo({ observations: FIXTURE, declarations }));
    expect(counts(result, 'suites')[S.UNDECLARED_BLIND]).toBe(0);
    expect(idsOf(result, S.DECLARED_BLIND)).toEqual([FIXTURE[0].file]);
    expect(counts(result, 'declarations')[S.ORPHAN_DECLARATION]).toBe(0);
  });

  it('Κ4: δήλωση για σουίτα που ΔΕΝ παρατηρήθηκε τυφλή ⇒ orphan-declaration', () => {
    const declarations = { [FIXTURE[1].file]: { reason: LONG_REASON } };
    const result = gate.sweep(miniRepo({ observations: FIXTURE, declarations }));
    expect(idsOf(result, S.ORPHAN_DECLARATION)).toEqual([FIXTURE[1].file]);
  });

  it('Κ5: δήλωση χωρίς ουσιαστικό λόγο ⇒ reasonless-declaration', () => {
    const declarations = { [FIXTURE[0].file]: { reason: 'γιατί ναι' } };
    const result = gate.sweep(miniRepo({ observations: FIXTURE, declarations }));
    expect(idsOf(result, S.REASONLESS_DECLARATION)).toEqual([FIXTURE[0].file]);
  });

  it('Κ6: ΦΡΕΣΚΑΔΑ — αλλαγή στη ΜΗΧΑΝΗ ΜΕΤΡΗΣΗΣ ⇒ stale-census', () => {
    const root = miniRepo({ observations: FIXTURE });
    const enginePath = path.join(root, ENGINE);
    fs.writeFileSync(enginePath, `${fs.readFileSync(enginePath, 'utf8')}\n// άλλαξε η μηχανή\n`);
    const result = gate.sweep(root);
    expect(idsOf(result, S.STALE_CENSUS)).toHaveLength(1);
    expect(result.rows.find((r) => r.state === S.STALE_CENSUS).detail).toMatch(/text-advance\.ts/);
  });

  it('Κ7: ΦΡΕΣΚΑΔΑ — αλλαγή σε ΠΑΡΑΤΗΡΗΜΕΝΗ σουίτα ⇒ stale-census', () => {
    const root = miniRepo({ observations: FIXTURE });
    const target = path.join(root, FIXTURE[0].file);
    fs.writeFileSync(target, `${fs.readFileSync(target, 'utf8')}\n// άλλαξε το test\n`);
    expect(idsOf(gate.sweep(root), S.STALE_CENSUS)).toHaveLength(1);
  });

  it('Κ8: ΤΟ `mtime` ΔΕΝ ΕΙΝΑΙ ΣΗΜΑ — άγγιγμα χωρίς αλλαγή περιεχομένου ΔΕΝ παλιώνει', () => {
    const root = miniRepo({ observations: FIXTURE });
    const target = path.join(root, FIXTURE[0].file);
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(target, future, future);
    expect(counts(gate.sweep(root), 'census')[S.STALE_CENSUS]).toBe(0);
  });

  it('Κ9: FAIL-CLOSED — απούσα απογραφή ⇒ missing-census, ΠΟΤΕ σιωπηλό πράσινο', () => {
    const root = miniRepo({ observations: FIXTURE });
    fs.unlinkSync(path.join(root, censusLib.CENSUS_FILE));
    const result = gate.sweep(root);
    expect(counts(result, 'census')[S.MISSING_CENSUS]).toBe(1);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('Κ10: FAIL-CLOSED — απόν/κακοσχηματισμένο κλειστό σύνολο ⇒ σφάλμα με όνομα', () => {
    const root = miniRepo({ observations: FIXTURE });
    fs.writeFileSync(path.join(root, '.text-measure-tier.json'), '{"other": 1}');
    expect(() => gate.sweep(root)).toThrow(/blindMeasureSuites/);
    fs.unlinkSync(path.join(root, '.text-measure-tier.json'));
    expect(() => gate.sweep(root)).toThrow(/text-measure-tier\.json/);
  });

  it('Κ11: Ο ΚΩΔΙΚΑΣ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΠΥΛΗΣ ΕΙΝΑΙ ΣΚΑΝΔΑΛΗ', () => {
    expect(cli.affects('scripts/check-text-measure-tier.js')).toBe(true);
    expect(cli.affects(path.join('scripts', 'lib', 'text-measure-tier', 'gate.js'))).toBe(true);
    expect(cli.affects('.text-measure-tier.json')).toBe(true);
    expect(cli.affects('.text-measure-census.json')).toBe(true);
    expect(cli.affects(path.join('src', 'subapps', 'dxf-viewer', 'text-engine', 'fonts', 'text-advance.ts'))).toBe(true);
    expect(cli.affects(path.join('src', 'app', 'page.tsx'))).toBe(false);
  });

  it('Κ12: οι παρατηρήσεις ΔΥΟ workers ΕΝΩΝΟΝΤΑΙ, δεν χάνεται καμία', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tier364m-'));
    const dir = path.join(root, censusLib.CENSUS_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const f = 'src/x/__tests__/split.test.ts';
    fs.writeFileSync(path.join(dir, 'w1.ndjson'), `${JSON.stringify({ file: f, glyph: 1, css: 0, nominal: 2, dropped: ['bold'] })}\n`);
    fs.writeFileSync(path.join(dir, 'w2.ndjson'), `${JSON.stringify({ file: f, glyph: 0, css: 3, nominal: 1, dropped: ['italic'] })}\n`);
    const merged = censusLib.collectRuns(root).get(f);
    expect(merged).toEqual({ file: f, glyph: 1, css: 3, nominal: 3, dropped: ['bold', 'italic'] });
  });

  it('Κ13: κάθε ⛔ κατάσταση ανήκει σε κατάστιχο', () => {
    const all = new Set(Object.values(gate.LEDGER_STATES).flat());
    for (const state of gate.BLOCKING) expect({ state, known: all.has(state) }).toEqual({ state, known: true });
  });
});
