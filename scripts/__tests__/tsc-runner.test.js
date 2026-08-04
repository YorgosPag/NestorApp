/**
 * ADR-757 ΦΑΣΗ Β — scripts/lib/tsc-runner.js: ο κοινός εκκινητής του `tsc`.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ:
 * Το check-type-ratchets.test.js γράφει ρητά «measure() legs are exercised by the
 * gate workflows, not by Jest» — και το `measure()` ήταν **ακριβώς** το κομμάτι
 * που έσπασε και έμεινε κόκκινο 9 μέρες. Κάλυψη **δίπλα** στο σφάλμα δεν είναι
 * κάλυψη. Ο ταξινομητής αποσπάστηκε από το spawn ώστε **κάθε** κατάσταση να
 * ελέγχεται χωρίς να ξοδεύονται 5 λεπτά CI για να αναπαραχθεί κατάρρευση.
 *
 * ΔΟΜΗ (η ίδια με CHECK 3.34/3.36/3.37):
 *   Μ0     — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό (αγκύρωση παλινδρόμησης)
 *   Μ1..Μ6 — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν δεν την πιάσει, δεν είναι όργανο
 *   Π      — η απόδειξη ΔΕΝ χάνεται ποτέ ξανά (το μήνυμα κουβαλά την έξοδο του tsc)
 *   Κ      — το ταβάνι μνήμης παράγεται, δεν αντιγράφεται
 *   G14    — ο καταναλωτής: Memory used + η προειδοποίηση πριν τον γκρεμό
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const tsc = require('../lib/tsc-runner');
const typeComplexity = require('../check-type-complexity-ratchet');

const { TSC_OUTCOME, classifyTscResult, resolveHeapMb, formatTscFailure } = tsc;

/** Ό,τι επιστρέφει το spawnSync, με τα κενά συμπληρωμένα. */
function spawnResult(over = {}) {
  return { error: undefined, status: 0, signal: null, stdout: '', stderr: '', ...over };
}

/** Το πραγματικό κείμενο που τυπώνει ο V8 όταν εξαντλείται το heap. */
const REAL_V8_OOM = [
  '<--- Last few GCs --->',
  '[1893:0x7f8] 291402 ms: Mark-Compact 6053.2 (6141.1) -> 6049.8 (6142.6) MB',
  '<--- JS stacktrace --->',
  'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory',
].join('\n');

// ─── Μ0 — το ζωντανό δέντρο ───────────────────────────────────────────────────

describe('Μ0 — ζωντανή αγκύρωση', () => {
  test('το ταβάνι του τρέχοντος μηχανήματος είναι μέσα στα όρια', () => {
    const mb = resolveHeapMb({}, 16 * 1024 * 1024 * 1024);
    expect(mb).toBeGreaterThanOrEqual(tsc.MIN_TSC_HEAP_MB);
    expect(mb).toBeLessThanOrEqual(tsc.CI_TSC_HEAP_MB);
  });

  test('οι έξι καταστάσεις είναι παγωμένες και μοναδικές', () => {
    const values = Object.values(TSC_OUTCOME);
    expect(values).toHaveLength(6);
    expect(new Set(values).size).toBe(6);
    expect(Object.isFrozen(TSC_OUTCOME)).toBe(true);
  });

  test('το committed budget δηλώνει heapWarnPct', () => {
    const budget = JSON.parse(fs.readFileSync(typeComplexity.getBudgetFile(), 'utf8'));
    expect(budget.policy.heapWarnPct).toBe(80);
  });

  test('και οι δύο πύλες tsc δείχνουν στο ΙΔΙΟ ταβάνι (κανένα ιδιωτικό νούμερο)', () => {
    const dxfSource = fs.readFileSync(path.join(__dirname, '..', 'check-dxf-tsc-ratchet.js'), 'utf8');
    const complexitySource = fs.readFileSync(path.join(__dirname, '..', 'check-type-complexity-ratchet.js'), 'utf8');
    expect(dxfSource).toContain('tsc.resolveHeapMb()');
    // Καμία από τις δύο δεν ξαναγράφει ταβάνι με το χέρι.
    expect(dxfSource).not.toMatch(/max-old-space-size=\d/);
    expect(complexitySource).not.toMatch(/max-old-space-size=\d/);
  });

  test('το workflow ΔΕΝ ξαναβάζει NODE_OPTIONS (η παγίδα του ADR-598)', () => {
    const wf = fs.readFileSync(
      path.join(__dirname, '..', '..', '.github', 'workflows', 'type-complexity-ratchet.yml'),
      'utf8',
    );
    expect(wf).not.toMatch(/^\s*NODE_OPTIONS:/m);
  });
});

// ─── Μ1..Μ6 — μία μετάλλαξη ανά ρητή κατάσταση ────────────────────────────────

describe('Μ1..Μ6 — κάθε ρητή κατάσταση πιάνεται', () => {
  test('Μ1 spawn-failed — το εκτελέσιμο δεν βρέθηκε', () => {
    const r = classifyTscResult(spawnResult({ error: Object.assign(new Error('spawnSync npx ENOENT'), { code: 'ENOENT' }), status: null }));
    expect(r.outcome).toBe(TSC_OUTCOME.SPAWN_FAILED);
  });

  test('Μ2 out-of-memory — το πραγματικό κείμενο του V8', () => {
    const r = classifyTscResult(spawnResult({ status: 134, stderr: REAL_V8_OOM }));
    expect(r.outcome).toBe(TSC_OUTCOME.OUT_OF_MEMORY);
  });

  test('Μ2β 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΦΕΡΟΥΣΑ — OOM με σήμα ΔΕΝ είναι «killed»', () => {
    // Ο V8 τυπώνει FATAL ERROR και μετά κάνει abort ⇒ το signal ΕΙΝΑΙ γεμάτο.
    // Αν ο έλεγχος σήματος προηγηθεί του κειμένου, ΚΑΘΕ OOM μεταμφιέζεται σε
    // «killed» — δηλαδή η πύλη ξαναπέφτει για λάθος λόγο. Αυτό το test είναι ο
    // φύλακας αυτής ακριβώς της σειράς.
    const r = classifyTscResult(spawnResult({ status: null, signal: 'SIGABRT', stderr: REAL_V8_OOM }));
    expect(r.outcome).toBe(TSC_OUTCOME.OUT_OF_MEMORY);
    expect(r.outcome).not.toBe(TSC_OUTCOME.KILLED);
  });

  test('Μ3 killed — σήμα ΧΩΡΙΣ μήνυμα heap (OOM-killer του λειτουργικού)', () => {
    const r = classifyTscResult(spawnResult({ status: null, signal: 'SIGKILL' }));
    expect(r.outcome).toBe(TSC_OUTCOME.KILLED);
    expect(r.detail).toMatch(/SIGKILL/);
  });

  test('Μ4 output-truncated — υπέρβαση maxBuffer, η έξοδος είναι ελλιπής', () => {
    const r = classifyTscResult(spawnResult({ error: Object.assign(new Error('maxBuffer'), { code: 'ENOBUFS' }) }));
    expect(r.outcome).toBe(TSC_OUTCOME.OUTPUT_TRUNCATED);
  });

  test('Μ5 🔴 μη μηδενική έξοδος ΜΕ σφάλματα τύπων ΔΕΝ είναι αποτυχία', () => {
    // Το `tsc` βγαίνει non-zero όποτε βρίσκει σφάλματα — που είναι η ΚΑΝΟΝΙΚΗ
    // περίπτωση για το CHECK 3.29 (381 σφάλματα στη baseline). Αν το status
    // μετρούσε ως αποτυχία, η πύλη του DXF δεν θα μετρούσε ποτέ τίποτα.
    const r = classifyTscResult(spawnResult({ status: 2, stdout: "src/a.ts(1,2): error TS2345: nope" }));
    expect(r.outcome).toBe(TSC_OUTCOME.RAN);
  });

  test('Μ6 ran — καθαρή έξοδος με μετρητές', () => {
    const r = classifyTscResult(spawnResult({ status: 0, stdout: 'Instantiations: 42' }));
    expect(r.outcome).toBe(TSC_OUTCOME.RAN);
    expect(r.detail).toBeNull();
  });
});

// ─── Π — η απόδειξη δεν χάνεται ποτέ ξανά ─────────────────────────────────────

describe('Π — το μήνυμα κουβαλά την απόδειξη', () => {
  const failure = {
    outcome: TSC_OUTCOME.OUT_OF_MEMORY,
    detail: 'V8 exhausted the JS heap',
    command: 'npx tsc --extendedDiagnostics --noEmit',
    heapMb: 12288,
    status: null,
    signal: 'SIGABRT',
    output: REAL_V8_OOM,
  };

  test('λέει UNKNOWN, ΟΧΙ παλινδρόμηση (μοντέλο Monitoring Plugins)', () => {
    const text = formatTscFailure(failure);
    expect(text).toMatch(/UNKNOWN/);
    expect(text).toMatch(/NOT a regression/);
  });

  test('κουβαλά εντολή, ταβάνι, κατάσταση εξόδου ΚΑΙ την έξοδο του tsc', () => {
    const text = formatTscFailure(failure);
    expect(text).toContain('npx tsc --extendedDiagnostics --noEmit');
    expect(text).toContain('12288');
    expect(text).toContain('SIGABRT');
    // Αυτό ακριβώς πετιόταν επί 13 συνεχόμενες κόκκινες εκτελέσεις:
    expect(text).toContain('JavaScript heap out of memory');
  });

  test('ακόμα και σιωπηλός μεταγλωττιστής το λέει ρητά', () => {
    expect(formatTscFailure({ ...failure, output: '' })).toMatch(/no output at all/);
  });

  test('🔴 ΟΛΟΚΛΗΡΩΣΗ — το ΠΡΑΓΜΑΤΙΚΟ σχήμα του runTsc() δίνει την έξοδο', () => {
    // Ο runTsc() επιστρέφει `combined`, όχι `output`. Όταν οι πύλες κάνουν
    // formatTscFailure(run), αν η συνάρτηση διάβαζε ΜΟΝΟ το `output` θα τύπωνε
    // «no output at all» ΚΡΑΤΩΝΤΑΣ την απόδειξη στο διπλανό πεδίο — ακριβώς το
    // ελάττωμα που υποτίθεται ότι θεραπεύει. Πιάστηκε πριν το commit επειδή το
    // test τροφοδοτείται με το σχήμα της παραγωγής, όχι με χειροποίητο object.
    const asRunTscReturns = {
      outcome: TSC_OUTCOME.OUT_OF_MEMORY,
      detail: 'V8 exhausted the JS heap',
      heapMb: 12288,
      command: 'npx tsc --noEmit',
      status: null,
      signal: 'SIGABRT',
      stdout: '',
      stderr: REAL_V8_OOM,
      combined: `\n${REAL_V8_OOM}`,
    };
    const text = formatTscFailure(asRunTscReturns);
    expect(text).toContain('JavaScript heap out of memory');
    expect(text).not.toMatch(/no output at all/);
  });

  test('η ουρά κόβεται αλλά κρατά το ΤΕΛΟΣ (εκεί είναι το fatal)', () => {
    const noise = 'x'.repeat(5000);
    const tail = tsc.outputTail(`${noise}\nFATAL ERROR: boom`, 200);
    expect(tail).toContain('FATAL ERROR: boom');
    expect(tail.length).toBeLessThan(400);
  });
});

// ─── Κ — το ταβάνι παράγεται, δεν αντιγράφεται ────────────────────────────────

describe('Κ — παραγωγή ταβανιού μνήμης', () => {
  test('runner 16 GB → το αποδεδειγμένο ταβάνι του CI', () => {
    expect(resolveHeapMb({}, 16 * 1024 * 1024 * 1024)).toBe(tsc.CI_TSC_HEAP_MB);
  });

  test('αδύναμο PC 8 GB → χαμηλότερο ταβάνι, ΟΧΙ 12 GB', () => {
    // ADR-598: το τοπικό build δεν πρέπει να ζητά 12 GB σε μηχάνημα που δεν τα έχει —
    // αλλιώς αντί για καθαρό JS OOM τρως SIGKILL από το λειτουργικό.
    const mb = resolveHeapMb({}, 8 * 1024 * 1024 * 1024);
    expect(mb).toBe(6144);
    expect(mb).toBeLessThan(tsc.CI_TSC_HEAP_MB);
  });

  test('μικροσκοπικό μηχάνημα → ποτέ κάτω από το κατώφλι λειτουργίας', () => {
    expect(resolveHeapMb({}, 2 * 1024 * 1024 * 1024)).toBe(tsc.MIN_TSC_HEAP_MB);
  });

  test('TSC_HEAP_MB υπερισχύει για στοχευμένη διερεύνηση', () => {
    expect(resolveHeapMb({ TSC_HEAP_MB: '3000' }, 16 * 1024 * 1024 * 1024)).toBe(3000);
  });

  test('σκουπίδια στο TSC_HEAP_MB αγνοούνται (δεν γίνεται NaN ταβάνι)', () => {
    expect(resolveHeapMb({ TSC_HEAP_MB: 'όχι-αριθμός' }, 16 * 1024 * 1024 * 1024)).toBe(tsc.CI_TSC_HEAP_MB);
  });
});

// ─── G14 — ο καταναλωτής ──────────────────────────────────────────────────────

describe('G14 — Memory used + η προειδοποίηση πριν τον γκρεμό', () => {
  const SAMPLE = [
    'Instantiations:             3642770',
    'Types:                      1512367',
    'Memory used:                6624656K',
  ].join('\n');

  test('διαβάζεται η μνήμη που ήδη τύπωνε το tsc', () => {
    expect(typeComplexity.parseExtendedDiagnostics(SAMPLE).memoryUsedKB).toBe(6624656);
  });

  test('απουσία γραμμής μνήμης δεν σπάει τη μέτρηση', () => {
    expect(typeComplexity.parseExtendedDiagnostics('Instantiations: 42').memoryUsedKB).toBe(0);
  });

  test('κάτω από το κατώφλι: απλή αναφορά, καμία φασαρία', () => {
    const note = typeComplexity.heapHeadroomNote({ heapMb: 12288, memoryUsedKB: 4 * 1024 * 1024 });
    expect(note).not.toMatch(/CLIFF/);
    expect(note).toContain('12,288 MB ceiling');
  });

  test('🔑 πάνω από το κατώφλι: ο γκρεμός ανακοινώνεται ΠΡΙΝ γίνει', () => {
    // 6.469 MB από 7.000 = 92%. Αυτό ακριβώς έλειπε: το όργανο ανακάλυπτε το
    // ταβάνι μόνο πεθαίνοντας πάνω του.
    const note = typeComplexity.heapHeadroomNote({ heapMb: 7000, memoryUsedKB: 6624656 });
    expect(note).toMatch(/APPROACHING THE OOM CLIFF/);
    expect(note).toMatch(/UNKNOWN/);
  });

  test('χωρίς δεδομένα μνήμης δεν επινοείται προειδοποίηση', () => {
    expect(typeComplexity.heapHeadroomNote({ instantiations: 1 })).toBe('');
  });

  test('η baseline καταγράφει πλέον τη μνήμη', () => {
    const payload = typeComplexity.buildPayload({ instantiations: 1, types: 2, memoryUsedKB: 3 });
    expect(payload.memoryUsedKB).toBe(3);
  });
});
