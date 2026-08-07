/**
 * CHECK 3.43 / ADR-774 — η πύλη της αρχής χρώματος στα CSS Modules, ελεγμένη από τη ΔΙΚΗ της σουίτα.
 *
 * ΔΟΜΗ (ίδια με τα CHECK 3.35–3.41):
 *   Μ0      — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό
 *   Μ1..Μ8  — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν η πύλη δεν την πιάσει, δεν είναι πύλη
 *   Π1..Π4  — ο ΠΡΑΓΜΑΤΙΚΟΣ ιστορικός κώδικας από το git: το ελάττωμα υπήρχε στ' αλήθεια
 *   Κ1..Κ7  — κοκκίωση: τι ΔΕΝ πιάνει, δηλωμένο ως test και όχι ως ελπίδα
 *
 * ⚠️ Τα Π **δεν** χρησιμοποιούν κατασκευασμένο fixture. Ένα fixture αποδεικνύει ότι ο κώδικας
 * συμφωνεί με τον εαυτό του· το `git show` αποδεικνύει ότι η πύλη περιγράφει την
 * **πραγματικότητα** — ότι το `EnterpriseTable.module.css` όντως έβαφε με σκληρά hex που
 * φορούσαν ρούχα token, και ότι κανένα από τα ονόματα που επικαλούνταν δεν υπήρχε ποτέ.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  USAGE_STATES,
  OS_THEME_STATES,
  buildDefinitionIndex,
  listCssFiles,
  scanCssUsages,
  scanOsThemeBlocks,
  findVarCalls,
  chromaticDeclarationsIn,
  isLiteralColor,
  stripCommentsKeepingLines,
} = require('../lib/css-vars/custom-property-index');
const { inspect, compare, totals, RATCHETED_STATES } = require('../check-css-token-authority');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GATE = 'scripts/check-css-token-authority.js';

// ---------------------------------------------------------------------------
// Εργαλεία
// ---------------------------------------------------------------------------

/**
 * Μίνι-repo με τα ΑΚΡΙΒΗ μονοπάτια που περιμένει ο δείκτης: `src/**​/*.css` για χρήσεις,
 * `src/app/globals.css` για τους ορισμούς. Ο δείκτης είναι καθολικός, οπότε το test πρέπει
 * να ελέγχει **και τις δύο** πλευρές — αλλιώς θα έλεγχε τη μισή ερώτηση.
 */
function miniRepo({ definitions = ':root { --defined-token: #ffffff; }', files = {} }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cta43-'));
  const globals = path.join(root, 'src', 'app', 'globals.css');
  fs.mkdirSync(path.dirname(globals), { recursive: true });
  fs.writeFileSync(globals, definitions);
  for (const [rel, content] of Object.entries(files)) {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  return root;
}

/** Τρέχει ολόκληρη τη μηχανή πάνω σε μεταλλαγμένο δέντρο. */
function run(spec) {
  const root = miniRepo(spec);
  const defined = buildDefinitionIndex(root);
  return { root, defined, ...inspect(root, listCssFiles(root), defined) };
}

const statesOf = (records) => records.map((r) => r.state);

/**
 * Το commit **πριν** από τη Φ.5 — η ιστορική άγκυρα.
 *
 * 🔴 **Καρφωμένο, ΟΧΙ `HEAD`.** Η Φ.5 **διαγράφει** τα αρχεία-μάρτυρες. Με `HEAD:` τα Π θα
 * γίνονταν πράσινα «επειδή το αρχείο δεν υπάρχει» — δηλαδή η απόδειξη θα αυτοακυρωνόταν
 * ακριβώς τη στιγμή που θα έπρεπε να μετράει. Μάθημα πληρωμένο στη Φ.1.
 */
const BEFORE_PHASE5 = '5baa83ba';
const DEAD_CSS = 'src/components/ui/table/EnterpriseTable.module.css';
const DEAD_CONSUMER = 'src/components/projects/parking/ParkingSpotTableRow.tsx';

/**
 * Ένα αρχείο όπως ήταν σε δοθέν commit· `null` **μόνο** όταν το commit δεν υπάρχει καθόλου.
 *
 * ⚠️ Το μονοπάτι κανονικοποιείται σε `/`: το `path.join` δίνει `\` στα Windows και το git
 * απαντά «*exists on disk, but not in HEAD*». Στη Φ.1 αυτό έκανε **δύο Π να περάσουν πράσινα
 * χωρίς να ελέγξουν τίποτα**. Άγνωστο ΑΡΧΕΙΟ σε ΓΝΩΣΤΟ commit ⇒ η άγκυρα σάπισε, ουρλιάζουμε.
 */
function gitShow(rev, file) {
  const posix = file.split(path.sep).join('/');
  try {
    return execFileSync('git', ['show', `${rev}:${posix}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    const message = String(err.stderr ?? err);
    if (/unknown revision|bad object|not a valid object/i.test(message)) return null;
    throw new Error(`Η ιστορική άγκυρα ${rev}:${posix} σάπισε — ${message}`);
  }
}

// ===========================================================================
describe('Μ0 — το ζωντανό δέντρο', () => {
  test('Μ0: η πύλη τρέχει καθαρή στο πραγματικό repo (καμία παλινδρόμηση, κανένα Κ1)', () => {
    const out = execFileSync('node', [GATE, '--all'], {
      cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    expect(out).toContain('✅ CHECK 3.43');
    // Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: μια πύλη που δεν λέει πόσα εξέτασε δεν αποδεικνύει ότι κοίταξε.
    expect(out).toMatch(/defined/);
    expect(out).toMatch(/dangling-literal-color/);
  });

  test('Μ0β: το Κ1 είναι σήμερα 0 — γι΄ αυτό ΜΠΟΡΕΙ να είναι zero-tolerance', () => {
    const defined = buildDefinitionIndex(REPO_ROOT);
    const usages = scanCssUsages(REPO_ROOT, listCssFiles(REPO_ROOT), defined);
    const noFallback = usages.filter((u) => u.state === USAGE_STATES.DANGLING_NO_FALLBACK);
    expect(noFallback).toEqual([]);
  });
});

// ===========================================================================
describe('Μ — μεταλλάξεις: κάθε ρητή κατάσταση πιάνεται', () => {
  test('Μ1: var(--αόριστο) ΧΩΡΙΣ fallback ⇒ dangling-no-fallback (Κ1, zero-tol)', () => {
    const { zeroTolerance } = run({ files: { 'src/m1.module.css': '.a { color: var(--ghost); }' } });
    expect(zeroTolerance).toHaveLength(1);
    expect(zeroTolerance[0].name).toBe('--ghost');
  });

  test('Μ2: var(--αόριστο, #hex) ⇒ dangling-literal-color — ΤΟ ΙΔΙΟ που το stylelint λέει «όχι πρόβλημα»', () => {
    const { usages } = run({ files: { 'src/m2.module.css': '.a { color: var(--ghost, #f9fafb); }' } });
    expect(statesOf(usages)).toEqual([USAGE_STATES.DANGLING_LITERAL_COLOR]);
  });

  test('Μ3: var(--ΟΡΙΣΜΕΝΟ, #hex) ⇒ defined — το fallback είναι αδιάφορο όταν το token υπάρχει', () => {
    const { usages } = run({ files: { 'src/m3.module.css': '.a { color: var(--defined-token, #f9fafb); }' } });
    expect(statesOf(usages)).toEqual([USAGE_STATES.DEFINED]);
  });

  test('Μ4: prefers-color-scheme που δηλώνει ΙΔΙΟΤΗΤΑ χρώματος ⇒ Κ3', () => {
    const { osBlocks } = run({
      files: { 'src/m4.module.css': '@media (prefers-color-scheme: dark) { .a { background-color: #111; } }' },
    });
    expect(statesOf(osBlocks)).toEqual([OS_THEME_STATES.CHROMATIC]);
  });

  test('Μ5: prefers-color-scheme που ΞΑΝΑΟΡΙΖΕΙ token ⇒ Κ3 — η βλάβη που η πρώτη εκδοχή έχανε', () => {
    // 🔴 Η πρώτη εκδοχή του `chromaticDeclarationsIn` μετρούσε ΜΟΝΟ ιδιότητες CSS και ανέφερε
    // «0 χρωματικές δηλώσεις» για το `theme/tokens.color.css` — ένα αρχείο με 19 χρωματικά
    // tokens μέσα σε αυτό ακριβώς το μπλοκ. Το test υπάρχει για να μην ξανασυμβεί.
    const { osBlocks } = run({
      files: { 'src/m5.module.css': '@media (prefers-color-scheme: dark) { :root { --cp-bg: rgb(17, 24, 39); } }' },
    });
    expect(statesOf(osBlocks)).toEqual([OS_THEME_STATES.CHROMATIC]);
  });

  test('Μ6: prefers-color-scheme ΧΩΡΙΣ τίποτα χρωματικό ⇒ ΔΕΝ μπλοκάρει (όχι ψευδώς θετικό)', () => {
    const { osBlocks } = run({
      files: { 'src/m6.module.css': '@media (prefers-color-scheme: dark) { .a { font-weight: 700; } }' },
    });
    expect(statesOf(osBlocks)).toEqual([OS_THEME_STATES.NON_CHROMATIC]);
  });

  test('Μ7: ΑΝΤΑΛΛΑΓΗ ίδιου πλήθους σε ίδιο αρχείο ⇒ μπλοκ (σχήμα v2, ADR-749)', () => {
    // Η baseline λέει «1 dangling, 0 os-theme». Το τρέχον λέει «0 dangling, 1 os-theme».
    // Το άθροισμα είναι ίδιο· ένα αριθμητικό ratchet θα το άφηνε να περάσει.
    const current = { 'src/x.css': { [OS_THEME_STATES.CHROMATIC]: 1 } };
    const baseline = { 'src/x.css': { [USAGE_STATES.DANGLING_LITERAL_COLOR]: 1 } };
    const { regressions } = compare(current, baseline, 'all');
    expect(regressions).toHaveLength(1);
    expect(regressions[0].state).toBe(OS_THEME_STATES.CHROMATIC);
  });

  test('Μ8: εμφωλευμένο var(--a, var(--b, #hex)) ⇒ ΔΥΟ εγγραφές, το εσωτερικό είναι το χειρότερο', () => {
    // Ένα άλμα του δείκτη ως την κλειστή παρένθεση θα έκρυβε το `--b` πίσω από την πιο αθώα
    // ταξινόμηση του `--a` (`dangling-token-fallback`).
    const { usages } = run({ files: { 'src/m8.module.css': '.a { color: var(--ghost, var(--phantom, #ff0000)); }' } });
    expect(statesOf(usages).sort()).toEqual(
      [USAGE_STATES.DANGLING_LITERAL_COLOR, USAGE_STATES.DANGLING_TOKEN_FALLBACK].sort(),
    );
  });
});

// ===========================================================================
describe('Π — το ελάττωμα υπήρχε στ΄ αλήθεια (git, όχι fixture)', () => {
  test('Π0: το ιστορικό είναι διαθέσιμο — αλλιώς τα Π δεν αποδεικνύουν τίποτα', () => {
    expect(gitShow(BEFORE_PHASE5, DEAD_CSS)).not.toBeNull();
  });

  test('Π1: στο 5baa83ba το module άκουγε το ΛΕΙΤΟΥΡΓΙΚΟ, όχι την κλάση .dark', () => {
    const css = gitShow(BEFORE_PHASE5, DEAD_CSS);
    if (css === null) return; // Π0 το έχει ήδη κοκκινίσει
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).not.toContain('.dark');
  });

  test('Π2: ΚΑΝΕΝΑ από τα χρωματικά του ονόματα δεν οριζόταν — τα hex ήταν ΠΑΝΤΑ η τιμή', () => {
    const css = gitShow(BEFORE_PHASE5, DEAD_CSS);
    if (css === null) return;
    const root = miniRepo({ files: { [DEAD_CSS]: css } });
    // Ο δείκτης ορισμών του ΠΡΑΓΜΑΤΙΚΟΥ repo — όχι του mini repo — γιατί η ερώτηση είναι
    // «οριζόταν αυτό το όνομα κάπου στην εφαρμογή;».
    const defined = buildDefinitionIndex(REPO_ROOT);
    const usages = scanCssUsages(root, [DEAD_CSS], defined);
    const literal = usages.filter((u) => u.state === USAGE_STATES.DANGLING_LITERAL_COLOR);
    expect(literal.length).toBeGreaterThanOrEqual(20);
    // Δείγμα που ονομάζεται ρητά: αν κάποιος ορίσει αυτά τα tokens, το test ΠΡΕΠΕΙ να αλλάξει.
    expect(literal.map((u) => u.name)).toEqual(
      expect.arrayContaining(['--bg-selected-light', '--focus-color', '--text-primary', '--border-primary']),
    );
  });

  test('Π3: ο μοναδικός καταναλωτής ήταν το ParkingSpotTableRow — και ΕΚΕΙΝΟ ήταν νεκρό', () => {
    const consumer = gitShow(BEFORE_PHASE5, DEAD_CONSUMER);
    if (consumer === null) return;
    expect(consumer).toContain("from '@/components/ui/table/EnterpriseTable.module.css'");
    // Το `columnWidths` έφτανε ως `_columnWidths`: η γραμμή ΔΕΝ στοίχιζε ποτέ με την κεφαλίδα.
    expect(consumer).toContain('columnWidths: _columnWidths');
  });

  test('Π4: μετά τη Φ.5 κανένα από τα 15 αρχεία δεν υπάρχει στο δίσκο', () => {
    const gone = [
      DEAD_CSS,
      DEAD_CONSUMER,
      'src/components/projects/parking/ParkingComponents.styles.ts',
      'src/components/parking/parking-spot-table/ParkingSpotTable.tsx',
      'src/components/parking/parking-spot-table/index.ts',
    ];
    for (const file of gone) {
      expect(fs.existsSync(path.join(REPO_ROOT, file))).toBe(false);
    }
  });
});

// ===========================================================================
describe('Κ — δηλωμένα όρια', () => {
  test('Κ1: ΔΕΝ κρίνει `.ts`/`.tsx` — αυτό είναι ερώτημα του CHECK 3.40', () => {
    const { usages } = run({
      files: {
        'src/k1.ts': "export const s = { color: 'var(--ghost, #ff0000)' };",
        'src/k1.module.css': '.a { padding: 0; }',
      },
    });
    expect(usages).toEqual([]);
  });

  test('Κ2: ΔΕΝ κρίνει αντίθεση — ένα ΟΡΙΣΜΕΝΟ token μπορεί κάλλιστα να είναι αόρατο', () => {
    const { usages } = run({
      definitions: ':root { --defined-token: #ffffff; --card: #ffffff; }',
      files: { 'src/k2.module.css': '.a { color: var(--defined-token); background: var(--card); }' },
    });
    expect(new Set(statesOf(usages))).toEqual(new Set([USAGE_STATES.DEFINED]));
  });

  test('Κ3: τα namespaces τρίτων (--radix-*, --tw-*) ΔΕΝ είναι παραβίαση, ούτε χωρίς fallback', () => {
    const { usages, zeroTolerance } = run({
      files: { 'src/k3.module.css': '.a { width: var(--radix-select-trigger-width); color: var(--tw-ring-color); }' },
    });
    expect(zeroTolerance).toEqual([]);
    expect(new Set(statesOf(usages))).toEqual(new Set([USAGE_STATES.RUNTIME_NAMESPACE]));
  });

  test('Κ4: `currentColor` και `transparent` ΔΕΝ είναι σταθερό χρώμα — ακολουθούν το θέμα', () => {
    expect(isLiteralColor('currentColor')).toBe(false);
    expect(isLiteralColor('transparent')).toBe(false);
    expect(isLiteralColor('#f9fafb')).toBe(true);
    expect(isLiteralColor('rgba(59, 130, 246, 0.2)')).toBe(true);
    expect(isLiteralColor('oklch(0.7 0.1 200)')).toBe(true);
  });

  test('Κ5: fallback που είναι ο ίδιος token ⇒ ξεχωριστή κατάσταση, ΔΕΝ μπλοκάρει', () => {
    const { usages, tally } = run({
      definitions: ':root { --border: 0 0% 50%; }',
      files: { 'src/k5.module.css': '.a { border-color: var(--ghost, hsl(var(--border))); }' },
    });
    expect(statesOf(usages)).toContain(USAGE_STATES.DANGLING_TOKEN_FALLBACK);
    expect(tally).toEqual({}); // τίποτα ratchet-αρόμενο
  });

  test('Κ6: σχόλιο ΔΕΝ αποδίδεται — αγνοείται, με διατήρηση αριθμών γραμμής', () => {
    const css = '.a {\n/* color: var(--ghost, #f00); */\n  padding: 0;\n}\n.b { color: var(--ghost2, #0f0); }';
    const stripped = stripCommentsKeepingLines(css);
    expect(stripped.split('\n')).toHaveLength(css.split('\n').length);
    expect(findVarCalls(stripped).map((c) => c.name)).toEqual(['--ghost2']);
  });

  test('Κ7: χαλασμένη baseline ⇒ ΣΦΑΛΜΑ, ποτέ σιωπηλό πράσινο (fail-closed)', () => {
    const bad = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cta43b-')), 'broken.json');
    fs.writeFileSync(bad, '{ this is not json');
    let code = 0;
    let output = '';
    try {
      execFileSync('node', [GATE, '--all'], {
        cwd: REPO_ROOT, encoding: 'utf8',
        env: { ...process.env, CSS_TOKEN_AUTHORITY_BASELINE_FILE: bad },
      });
    } catch (err) {
      code = err.status;
      output = String(err.stdout ?? '') + String(err.stderr ?? '');
    }
    expect(code).toBe(1);
    expect(output).toContain('baseline');
  });
});

// ===========================================================================
describe('Λογιστική — ο παρονομαστής κλείνει', () => {
  test('κάθε var() του ζωντανού δέντρου έχει ΜΙΑ ρητή κατάσταση, καμία undefined', () => {
    const defined = buildDefinitionIndex(REPO_ROOT);
    const usages = scanCssUsages(REPO_ROOT, listCssFiles(REPO_ROOT), defined);
    const known = new Set(Object.values(USAGE_STATES));
    expect(usages.length).toBeGreaterThan(0);
    for (const u of usages) expect(known.has(u.state)).toBe(true);
  });

  test('κάθε μπλοκ prefers-color-scheme έχει ΜΙΑ ρητή κατάσταση', () => {
    const blocks = scanOsThemeBlocks(REPO_ROOT, listCssFiles(REPO_ROOT));
    const known = new Set(Object.values(OS_THEME_STATES));
    for (const b of blocks) expect(known.has(b.state)).toBe(true);
  });

  test('μόνο οι δύο δηλωμένες καταστάσεις μπαίνουν στη baseline', () => {
    expect(RATCHETED_STATES).toEqual([USAGE_STATES.DANGLING_LITERAL_COLOR, OS_THEME_STATES.CHROMATIC]);
  });

  test('η baseline του repo συμφωνεί με το ζωντανό δέντρο (καμία απόκλιση artifact)', () => {
    const baseline = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '.css-token-authority-baseline.json'), 'utf8'),
    );
    const defined = buildDefinitionIndex(REPO_ROOT);
    const { tally } = inspect(REPO_ROOT, listCssFiles(REPO_ROOT), defined);
    expect(tally).toEqual(baseline.files);
    expect(totals(tally).dangling).toBe(baseline._meta.totalDanglingLiteralColor);
  });

  test('ο ταξινομητής χρωματικών δηλώσεων βλέπει ΚΑΙ ιδιότητες ΚΑΙ tokens', () => {
    expect(chromaticDeclarationsIn('.a { background-color: #111; }')).toHaveLength(1);
    expect(chromaticDeclarationsIn(':root { --x: rgb(1,2,3); }')).toHaveLength(1);
    expect(chromaticDeclarationsIn('.a { font-size: 12px; }')).toHaveLength(0);
  });
});
