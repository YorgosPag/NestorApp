/**
 * Άγκυρες για τη ΜΙΑ ΠΗΓΗ ΤΩΝ ΠΥΛΩΝ (ADR-8xx) — `docs/gates/3.NN.md` → πίνακας `CLAUDE.md`.
 *
 * @jest-environment node
 *
 * ⚠️ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, ΟΧΙ ΣΤΗΝ ΠΥΛΗ: μίνι-repo από ΠΡΑΓΜΑΤΙΚΑ αρχεία, μία
 *    γραμμή αλλαγή. Ο μεταλλάκτης ΟΥΡΛΙΑΖΕΙ αν η μετάλλαξη δεν άλλαξε τίποτα (μάθημα 3.44/Μ11:
 *    ένα «RED» πάνω σε test που ήταν ήδη σπασμένο αποδεικνύει σπασμένο test, όχι ζωντανό φρουρό).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readGateSources, parseFrontmatter, byGateNumber } = require('../lib/gate-index/source');
const { renderRows, clip, baselineCell, leadDescription, ROW_BUDGET } = require('../lib/gate-index/render');
const { judgeFreshness, STATES: F, BLOCKING: F_BLOCKING } = require('../lib/gate-index/freshness');

const REAL = path.resolve(__dirname, '..', '..');

// ── μίνι-repo ────────────────────────────────────────────────────────────────
let tmp;
function miniRepo(gates, guideExtra = '') {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-index-'));
  fs.mkdirSync(path.join(tmp, 'docs', 'gates'), { recursive: true });
  for (const g of gates) {
    const fm = ['---', ...Object.entries(g.fm).map(([k, v]) => `${k}: "${v}"`), '---', '', `# CHECK ${g.fm.gate}`, '', g.body, ''];
    fs.writeFileSync(path.join(tmp, 'docs', 'gates', `${g.fm.gate}.md`), fm.join('\n'), 'utf8');
  }
  fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), guideExtra, 'utf8');
  return tmp;
}
afterEach(() => { if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true }); tmp = null; });

const FM = (gate, over = {}) => ({
  gate, title: 'Δοκιμαστική', adr: 'ADR-999', summary: 'ρωτά κάτι;',
  mechanism: 'ZERO TOL', baseline: 'no baseline', tests: '', escape: '', ...over,
});
const inv = (runs, rows) => ({ runs: new Set(runs), rows: new Set(rows) });

/** Μετάλλαξη που ΟΥΡΛΙΑΖΕΙ αν δεν άλλαξε τίποτα. */
function mutate(file, from, to) {
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(from, to);
  if (after === before) throw new Error(`ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ — τίποτα δεν άλλαξε σε ${path.basename(file)}`);
  fs.writeFileSync(file, after, 'utf8');
}

// ═══ Κ — το συμβόλαιο του αναγνώστη ═══════════════════════════════════════════
describe('Κ — αναγνώστης της πηγής', () => {
  test('Κ1: frontmatter που λείπει πεδίο ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ σιωπηλή προεπιλογή', () => {
    expect(() => parseFrontmatter('---\ngate: "3.1"\n---\n\nσώμα\n', 'x.md')).toThrow(/λείπει το πεδίο/);
  });

  test('Κ2: κενό σώμα ⇒ άρνηση — αρχείο χωρίς περιεχόμενο δεν είναι τεκμηρίωση', () => {
    const fm = ['---', ...Object.entries(FM('3.1')).map(([k, v]) => `${k}: "${v}"`), '---', ''].join('\n');
    expect(() => parseFrontmatter(fm, 'x.md')).toThrow(/κενό σώμα/);
  });

  test('Κ3: το πεδίο gate ΠΡΕΠΕΙ να συμφωνεί με το όνομα αρχείου (δύο αυθεντίες = καμία)', () => {
    const root = miniRepo([{ fm: FM('3.2'), body: 'σώμα' }]);
    fs.renameSync(path.join(root, 'docs/gates/3.2.md'), path.join(root, 'docs/gates/3.3.md'));
    expect(() => readGateSources(root)).toThrow(/το πεδίο gate λέει/);
  });

  test('Κ4: κενός φάκελος ⇒ ΑΡΝΗΣΗ, όχι κενός πίνακας — «τίποτα» δεν διαβάζεται ως «καθαρό»', () => {
    const root = miniRepo([]);
    expect(() => readGateSources(root)).toThrow(/κενό/);
  });

  test('Κ5: αριθμητική σειρά «3.5 < 3.11», ποτέ λεξικογραφική', () => {
    expect([{ gate: '3.11' }, { gate: '3.5' }].sort(byGateNumber).map((g) => g.gate)).toEqual(['3.5', '3.11']);
  });

  test('Κ6: το αποτύπωμα αλλάζει σε ΜΕΤΟΝΟΜΑΣΙΑ, όχι μόνο σε αλλαγή περιεχομένου', () => {
    const a = miniRepo([{ fm: FM('3.1'), body: 'ίδιο' }]);
    const f1 = readGateSources(a).fingerprint;
    fs.writeFileSync(path.join(a, 'docs/gates/3.2.md'), fs.readFileSync(path.join(a, 'docs/gates/3.1.md'), 'utf8').replace('"3.1"', '"3.2"'), 'utf8');
    fs.unlinkSync(path.join(a, 'docs/gates/3.1.md'));
    expect(readGateSources(a).fingerprint).not.toBe(f1);
  });
});

// ═══ Ρ — η προβολή ════════════════════════════════════════════════════════════
describe('Ρ — προβολή στη γραμμή', () => {
  test('Ρ1: το κόψιμο ΔΕΝ αφήνει μισή έμφαση — μισό `**` βγάζει τον πίνακα από τα ρούχα του', () => {
    const out = clip('αρχή **έμφαση που κόβεται στη μέση** τέλος', 20);
    expect((out.match(/\*\*/g) || []).length % 2).toBe(0);
  });

  test('Ρ2: το κόψιμο ΔΕΝ αφήνει ανοιχτό backtick', () => {
    const out = clip('αρχή `κώδικας που κόβεται` τέλος', 15);
    expect((out.match(/`/g) || []).length % 2).toBe(0);
  });

  test('Ρ3: baseline που ΔΕΝ ονομάζει αρχείο ⇒ πρόβλημα ΜΕ ΟΝΟΜΑ (ο αντιγραμμένος αριθμός)', () => {
    const { problem } = baselineCell(FM('3.1', { baseline: '378 violations / 13 files' }), REAL);
    expect(problem).toMatch(/δεν ονομάζει αρχείο/);
  });

  test('Ρ4: baseline που ονομάζει ΑΝΥΠΑΡΚΤΟ αρχείο ⇒ αδέσποτος δείκτης (ένα σκαλί πάνω από ESLint)', () => {
    const { problem } = baselineCell(FM('3.1', { baseline: '`.den-yparxei-baseline.json`' }), REAL);
    expect(problem).toMatch(/ΔΕΝ ΥΠΑΡΧΕΙ/);
  });

  test('Ρ5: η περιγραφή-fallback βγαίνει από τη ΔΟΜΗ (μετά το «—»), δεν είναι μαντεψιά', () => {
    expect(leadDescription('**Τίτλος** (ADR-1) — η περιγραφή εδώ. Και άλλα.')).toBe('η περιγραφή εδώ');
    expect(leadDescription('χωρίς παύλα καθόλου')).toBe('');
  });

  test('Ρ6: γραμμή πάνω από το ταβάνι ⇒ ΑΡΝΗΣΗ — το ταβάνι είναι ο μηχανισμός, όχι αισθητική', () => {
    const g = FM('3.1', { title: 'Τ'.repeat(ROW_BUDGET + 50) });
    const { problems } = renderRows([{ ...g, body: 'σώμα' }], REAL);
    expect(problems.join(' ')).toMatch(/ταβάνι/);
  });
});

// ═══ Ζ — το δεύτερο κατάστιχο (φρεσκάδα) ══════════════════════════════════════
describe('Ζ — πηγή ⇄ προβολή', () => {
  const stamp = (fp) => `<!-- fingerprint: sha256:${fp} -->\n| **3.1** | x | y | z |\n`;

  test('Ζ1: πηγή + φρέσκο αποτύπωμα ⇒ καμία μπλοκάρουσα', () => {
    const root = miniRepo([{ fm: FM('3.1'), body: 'σώμα' }]);
    const fp = readGateSources(root).fingerprint;
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), stamp(fp), 'utf8');
    const v = judgeFreshness(inv(['3.1'], ['3.1']), root).violations;
    expect(v.filter((x) => F_BLOCKING.includes(x.state))).toHaveLength(0);
  });

  test('Ζ2: ΜΕΤΑΛΛΑΞΗ ΣΤΗΝ ΠΗΓΗ χωρίς regenerate ⇒ ⛔ stale-projection', () => {
    const root = miniRepo([{ fm: FM('3.1'), body: 'σώμα' }]);
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), stamp(readGateSources(root).fingerprint), 'utf8');
    mutate(path.join(root, 'docs/gates/3.1.md'), 'σώμα', 'ΑΛΛΑΓΜΕΝΟ σώμα');
    expect(judgeFreshness(inv(['3.1'], ['3.1']), root).violations.map((x) => x.state)).toContain(F.STALE);
  });

  test('Ζ3: γραμμή στον οδηγό ΧΩΡΙΣ πηγή ⇒ ⛔ source-missing (ο δείκτης 📘 δεν λύνεται)', () => {
    const root = miniRepo([{ fm: FM('3.1'), body: 'σώμα' }]);
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), stamp(readGateSources(root).fingerprint), 'utf8');
    expect(judgeFreshness(inv(['3.1', '3.2'], ['3.1', '3.2']), root).violations.map((x) => x.state)).toContain(F.MISSING);
  });

  test('Ζ4: πηγή για πύλη που ΔΕΝ τρέχει ⇒ ⛔ source-orphan (μάθημα writeArtifacts, ADR-744)', () => {
    const root = miniRepo([{ fm: FM('3.1'), body: 'σ' }, { fm: FM('3.2'), body: 'σ' }]);
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), stamp(readGateSources(root).fingerprint), 'utf8');
    expect(judgeFreshness(inv(['3.1'], ['3.1']), root).violations.map((x) => x.state)).toContain(F.ORPHAN);
  });

  test('Ζ5: οδηγός ΧΩΡΙΣ αποτύπωμα ⇒ ⛔ — «δεν βρήκα σφραγίδα» ΠΟΤΕ δεν σημαίνει «φρέσκο»', () => {
    const root = miniRepo([{ fm: FM('3.1'), body: 'σ' }]);
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '| **3.1** | χωρίς σφραγίδα | x | y |\n', 'utf8');
    expect(judgeFreshness(inv(['3.1'], ['3.1']), root).violations.map((x) => x.state)).toContain(F.STALE);
  });

  test('Ζ6: FAIL-CLOSED — φάκελος πηγής που λείπει ⇒ ⛔ source-unreadable, όχι κενό σύνολο', () => {
    const root = miniRepo([{ fm: FM('3.1'), body: 'σ' }]);
    fs.rmSync(path.join(root, 'docs/gates'), { recursive: true, force: true });
    expect(judgeFreshness(inv(['3.1'], ['3.1']), root).violations.map((x) => x.state)).toContain(F.UNREADABLE);
  });
});

// ═══ Φ — Ο ΦΡΟΥΡΟΣ ΕΚΤΕΛΕΙΤΑΙ (η ραφή ένεσης) ═════════════════════════════════
describe('Φ — ο φρουρός zero-tolerance ΠΥΡΟΔΟΤΕΙ', () => {
  const { enforceZeroTolerance } = require('../check-gate-inventory');

  test('Φ1: με μπλοκάρουσα κατάσταση ⇒ ΤΕΡΜΑΤΙΖΕΙ — χωρίς αυτό οι ⛔ είναι διακοσμητικές', () => {
    // 🔴 Αυτή η άγκυρα υπάρχει επειδή το ελάττωμα ΗΤΑΝ ΖΩΝΤΑΝΟ: το `runSetRatchetCli` κοιτά
    //    μόνο τα σύνολα, οπότε η αναφορά τύπωνε «⛔ ghost-row 1» και η πύλη απαντούσε EXIT=0.
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const fake = () => ({ blocking: [{ state: 'ghost-row', id: '3.997', detail: 'φάντασμα' }] });
    expect(() => enforceZeroTolerance([], fake)).toThrow('EXIT');
    expect(exit).toHaveBeenCalledWith(1);
    jest.restoreAllMocks();
  });

  test('Φ2: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — χωρίς μπλοκάρουσα ΔΕΝ τερματίζει (αλλιώς θα έφραζε τα πάντα)', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT'); });
    expect(() => enforceZeroTolerance([], () => ({ blocking: [] }))).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  test('Φ3: το --report ΔΕΝ τερματίζει — η αναφορά πρέπει να μπορεί να δείξει το πρόβλημα', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT'); });
    const fake = () => ({ blocking: [{ state: 'ghost-row', id: 'x', detail: 'y' }] });
    expect(() => enforceZeroTolerance(['--report'], fake)).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});

// ═══ Π — βαθμονόμηση στο ΠΡΑΓΜΑΤΙΚΟ δέντρο ════════════════════════════════════
describe('Π — πραγματικό δέντρο', () => {
  test('Π1: όλες οι πηγές διαβάζονται και ο πίνακας παράγεται χωρίς πρόβλημα', () => {
    const { gates } = readGateSources(REAL);
    expect(gates.length).toBeGreaterThan(50);
    expect(renderRows(gates, REAL).problems).toEqual([]);
  });

  test('Π2: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — υπάρχουν όντως πύλες με baseline αρχείο (αλλιώς ο Ρ4 δεν κοίταξε)', () => {
    const withBaseline = readGateSources(REAL).gates.filter((g) => /`\.[a-z0-9.-]+\.json`/i.test(g.baseline));
    expect(withBaseline.length).toBeGreaterThan(10);
  });

  test('Π3: καμία παραγόμενη γραμμή δεν ξεπερνά το ταβάνι — το ευρετήριο μένει ευρετήριο', () => {
    const { rows } = renderRows(readGateSources(REAL).gates, REAL);
    const over = rows.filter((r) => r.line.length > ROW_BUDGET);
    expect(over.map((r) => `${r.gate}=${r.line.length}`)).toEqual([]);
  });

  test('Π4: ο οδηγός ΕΙΝΑΙ φρέσκος ως προς την πηγή (Μ0 — πράσινο πριν ΚΑΙ μετά)', () => {
    const { takeInventory } = require('../lib/gate-inventory/inventory');
    const v = judgeFreshness(takeInventory(REAL), REAL).violations.filter((x) => F_BLOCKING.includes(x.state));
    expect(v.map((x) => `${x.state}: ${x.id}`)).toEqual([]);
  });
});
