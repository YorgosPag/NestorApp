/**
 * 🔴 Η ΚΟΙΝΗ ΜΗΧΑΝΗ ΤΩΝ RATCHET — ΟΙ ΠΡΩΤΕΣ ΤΗΣ ΑΓΚΥΡΕΣ (2026-08-25).
 *
 * Το `scripts/lib/ratchet-baseline.js` είναι το control-flow **27** πυλών (14 σε pre-commit,
 * 13 σε CI) και μέχρι σήμερα **δεν είχε ούτε ένα test**. Δεν είναι ακαδημαϊκό: η ασυμμετρία
 * που κλείνει εδώ — η **αριθμητική** διαδρομή σιωπούσε για τον τζόγο ενώ η **ταυτοτική** τον
 * ανέφερε — άφησε το ταβάνι του CHECK G15 (knip) στο **456** ενώ το δέντρο μετρούσε **57**,
 * επί **40 ημέρες**. Ταβάνι 8× πάνω από την πραγματικότητα είναι πύλη που δεν φυλάει τίποτα.
 *
 * 🏆 Η αρχή είναι του **PHPStan** (`reportUnmatchedIgnoredErrors`, **ενεργό από προεπιλογή**)
 * και του **ESLint** (`reportUnusedDisableDirectives`): *μια καταστολή που δεν χρειάζεται πια
 * είναι η ίδια ελάττωμα*, γιατί κρύβει την επόμενη παλινδρόμηση στο ίδιο σημείο.
 *
 * @see scripts/lib/ratchet-baseline.js — `announceSlack`
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ratchet = require('../lib/ratchet-baseline.js');

/** Τρέχει το CLI αιχμαλωτίζοντας έξοδο + exit code — το `runRatchetCli` καλεί `process.exit`. */
function capture(run) {
  const out = [];
  const log = console.log;
  const err = console.error;
  const exit = process.exit;
  let code = null;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => out.push(a.join(' '));
  process.exit = (c) => {
    code = c;
    throw Object.assign(new Error('__exit__'), { __exit: true });
  };
  try {
    run();
  } catch (e) {
    if (!e || !e.__exit) throw e;
  } finally {
    console.log = log;
    console.error = err;
    process.exit = exit;
  }
  return { text: out.join('\n'), code };
}

function baselineWith(payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-'));
  const file = path.join(dir, 'baseline.json');
  fs.writeFileSync(file, JSON.stringify(payload));
  return file;
}

const numericGate = (measuredTotal, baselineTotal, direction = 'down') => ({
  adr: 'ADR-TEST',
  scriptName: 'scripts/check-test.js',
  baselineFile: baselineWith({ total: baselineTotal }),
  requiredKeys: ['total'],
  metricKey: 'total',
  direction,
  resolveTolerancePct: () => 0,
  measure: () => ({ total: measuredTotal }),
  buildPayload: (m) => m,
  describe: ({ measured, baseline }) => `total ${measured.total}/${baseline ? baseline.total : '—'}`,
  slackNoun: 'ευρήματα',
  slackCommand: 'seed-me',
});

describe('ratchet-baseline — ο τζόγος του ταβανιού (PHPStan/ESLint αρχή)', () => {
  const savedCi = process.env.GITHUB_ACTIONS;
  afterEach(() => {
    if (savedCi === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = savedCi;
  });

  it('Τ1: ratchet «down» ΚΑΤΩ από το ταβάνι ⇒ ο τζόγος ΑΝΑΦΕΡΕΤΑΙ, με τους δύο αριθμούς', () => {
    delete process.env.GITHUB_ACTIONS;
    const r = capture(() => ratchet.runRatchetCli(numericGate(57, 456), ['node', 'x', '--check']));
    expect(r.code).toBe(0);
    expect(r.text).toContain('399 ευρήματα κάτω από το ταβάνι');
    expect(r.text).toContain('baseline 456, μετρημένο 57');
    expect(r.text).toContain('seed-me');
  });

  /**
   * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς αυτό, ένα «περιέχει τη λέξη ταβάνι» θα μπορούσε να είναι πράσινο
   * επειδή η γραμμή τυπώνεται ΠΑΝΤΑ — δηλαδή η άγκυρα δεν θα ξεχώριζε τίποτα.
   */
  it('Τ2: ΑΚΡΙΒΩΣ στο ταβάνι ⇒ ΚΑΜΙΑ γραμμή τζόγου — καμία ψεύτικη καταγγελία', () => {
    delete process.env.GITHUB_ACTIONS;
    const r = capture(() => ratchet.runRatchetCli(numericGate(456, 456), ['node', 'x', '--check']));
    expect(r.code).toBe(0);
    expect(r.text).not.toContain('ταβάνι');
  });

  it('Τ3: ratchet «up» — ο τζόγος υπολογίζεται ΜΕ ΤΗΝ ΚΑΤΕΥΘΥΝΣΗ, όχι ως απόλυτη διαφορά', () => {
    delete process.env.GITHUB_ACTIONS;
    const r = capture(() => ratchet.runRatchetCli(numericGate(90, 80, 'up'), ['node', 'x', '--check']));
    expect(r.code).toBe(0);
    expect(r.text).toContain('10 ευρήματα κάτω από το ταβάνι');
  });

  it('Τ4: παλινδρόμηση ⇒ ΜΠΛΟΚ, και ΚΑΜΙΑ γραμμή τζόγου (δεν υπάρχει τζόγος να κλειδωθεί)', () => {
    delete process.env.GITHUB_ACTIONS;
    const r = capture(() => ratchet.runRatchetCli(numericGate(500, 456), ['node', 'x', '--check']));
    expect(r.code).toBe(1);
    expect(r.text).not.toContain('κάτω από το ταβάνι');
  });

  it('Τ5: ΜΟΝΟ κάτω από GitHub Actions εκπέμπεται annotation — τοπικά μένει σκέτη γραμμή', () => {
    delete process.env.GITHUB_ACTIONS;
    expect(capture(() => ratchet.runRatchetCli(numericGate(57, 456), ['node', 'x', '--check'])).text)
      .not.toContain('::warning');

    process.env.GITHUB_ACTIONS = 'true';
    expect(capture(() => ratchet.runRatchetCli(numericGate(57, 456), ['node', 'x', '--check'])).text)
      .toContain('::warning title=ADR-TEST');
  });

  /**
   * ⚠️ ΕΝΑ ΣΩΜΑ ΓΙΑ ΤΙΣ ΔΥΟ ΔΙΑΔΡΟΜΕΣ (N.18): η ταυτοτική διαδρομή είχε ΔΙΚΗ της γραμμή
   * προόδου. Γραμμένη δεύτερη φορά, θα αποκλίνει στην πρώτη ρύθμιση — και η ταυτοτική δεν θα
   * έπαιρνε ποτέ το annotation του PR.
   */
  it('Τ6: η ΤΑΥΤΟΤΙΚΗ διαδρομή περνά από το ΙΔΙΟ σώμα — ίδια γραμμή, ίδιο annotation', async () => {
    process.env.GITHUB_ACTIONS = 'true';
    const file = baselineWith({ violations: ['a', 'b'], declarations: ['d1'] });
    const descriptor = {
      adr: 'ADR-TEST-SET',
      baselineFile: file,
      labels: { violations: 'παραβιάσεις', declarations: 'δηλώσεις' },
      commands: { report: 'r', baseline: 'seed-set', seed: 's' },
      measure: () => ({ violationIds: ['a'], declarations: ['d1'], violations: [] }),
      buildPayload: (m) => m,
      printReport: () => {},
      violationId: (f) => f.id,
      messages: { worse: 'w', newDeclLabel: 'n', newDeclAdvice: [] },
    };
    let captured = null;
    const log = console.log;
    const exit = process.exit;
    const lines = [];
    console.log = (...a) => lines.push(a.join(' '));
    process.exit = (c) => { captured = c; throw Object.assign(new Error('__exit__'), { __exit: true }); };
    try {
      await ratchet.runSetRatchetCli(descriptor, ['node', 'x']);
    } catch (e) {
      if (!e || !e.__exit) throw e;
    } finally {
      console.log = log;
      process.exit = exit;
    }
    const text = lines.join('\n');
    expect(captured).toBe(0);
    expect(text).toContain('1 παραβιάσεις / 0 δηλώσεις λιγότερες');
    expect(text).toContain('::warning title=ADR-TEST-SET');
    expect(text).toContain('seed-set');
  });
});
