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

// ---------------------------------------------------------------------------
// Θ — οι υποσχέσεις της ΘΕΡΑΠΕΙΑΣ (ADR-774 §4.3, εκστρατεία Π1)
// ---------------------------------------------------------------------------
/**
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΟΜΑΔΑ — **η πύλη 3.43 δεν μπορεί να απαντήσει την ερώτηση.**
 *
 * Το 3.43 ρωτά «**υπάρχει** αυτό το custom property;». Μόλις η θεραπεία δείξει σε υπαρκτό
 * token, η πύλη γίνεται **μονίμως πράσινη** σε αυτά τα σημεία — και μένει πράσινη ακόμα κι
 * αν κάποιος αλλάξει την **τιμή** του token και το κείμενο γίνει αδιάβαστο. Δηλαδή η ίδια η
 * επιτυχία της θεραπείας **σβήνει** τον φρουρό.
 *
 * ⚠️ ΚΑΙ ΤΟ ΧΕΙΡΟΤΕΡΟ, ΜΕΤΡΗΜΕΝΟ: το Κ1 (ZERO-TOL) πιάνει τη **διαγραφή** ενός token, γιατί
 * το `hsl(var(--focus-ring))` δεν έχει fallback ⇒ γίνεται `dangling-no-fallback`. **ΔΕΝ**
 * πιάνει όμως τη διαγραφή **του ενός από τα δύο θέματα**: αν σβήσει μόνο το σκέλος του
 * `.dark`, το όνομα εξακολουθεί να «ορίζεται» και η πύλη λέει ✅ ενώ ο δείκτης εστίασης
 * κληρονομεί το φωτεινό μπλε πάνω σε σκοτεινό πάνελ. Αυτό το πιάνει **μόνο** το Θ1.
 *
 * ΠΟΙΟΣ ΤΑ ΤΡΕΧΕΙ (επαληθεύτηκε εκτελώντας, όχι διαβάζοντας):
 *   · CI — `ui-contrast-ratchet.yml`, βήμα «Mutation suite — CHECK 3.43», σκανδάλη
 *     `src/**\/*.css` ⇒ **κάθε** αλλαγή στο `globals.css` το ξυπνά. Αυτή είναι η κάλυψη.
 *   · pre-commit — μόνο όταν αλλάζει η ίδια η πύλη (`scripts/lib/css-vars/**` κ.λπ.).
 *     🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: αλλαγή **μόνο** στο `globals.css` **δεν** τρέχει αυτά τα tests
 *     τοπικά — τα πιάνει το CI. Δεν «διορθώνεται» με πλάτεμα της σκανδάλης του hook: θα
 *     έτρεχε 27 tests σε κάθε commit που αγγίζει οποιοδήποτε `.css`.
 *
 * ⚠️ ΤΑ ΚΑΤΩΦΛΙΑ ΕΙΝΑΙ ΣΤΑΘΕΡΕΣ ΚΥΡΙΟΛΕΞΙΕΣ, ΠΟΤΕ ΥΠΟΛΟΓΙΣΜΟΙ ΑΠΟ ΤΗΝ ΠΗΓΗ ΠΟΥ ΚΡΙΝΕΤΑΙ.
 * Ένα test που παράγει το αναμενόμενο από το `globals.css` θα έμενε πράσινο πάνω σε κάθε
 * αλλαγή του `globals.css` — δηλαδή ακριβώς πάνω στην αλλαγή που φυλάει.
 */
describe('Θ — οι υποσχέσεις της θεραπείας Π1 (ό,τι η πύλη ΔΕΝ βλέπει)', () => {
  const { readThemes } = require('../lib/contrast/css-token-themes');
  const {
    parseHslToken, hslToRgb, contrastRatio, compositeOver, toHex,
  } = require('../lib/contrast/wcag-contrast');

  const themes = readThemes(REPO_ROOT);
  const rgbOf = (theme, name) => {
    const raw = themes[theme].get(name);
    if (!raw || /var\(/.test(raw)) return null;
    const hsl = parseHslToken(raw);
    return hsl ? hslToRgb(hsl) : null;
  };
  const ratio = (theme, fg, bg) => contrastRatio(rgbOf(theme, fg), rgbOf(theme, bg));

  // ΒΑΘΜΟΝΟΜΗΣΗ — γνωστή τιμή από ΣΧΟΛΙΟ της πηγής (globals.css: «Tailwind gray-200 (#e5e7eb)»).
  // Αν αυτό σπάσει, κανένας αριθμός παρακάτω δεν είναι έγκυρος και το ξέρουμε ΠΡΙΝ τον διαβάσουμε.
  test('Θ0 — η ανάγνωση των θεμάτων είναι βαθμονομημένη', () => {
    expect(toHex(rgbOf('light', '--border'))).toBe('#e5e7eb');
    expect(toHex(rgbOf('dark', '--background'))).toBe('#161a22');
  });

  test('Θ1 — το --focus-ring ορίζεται σε ΚΑΙ ΤΑ ΔΥΟ θέματα (το Κ1 βλέπει μόνο «υπάρχει»)', () => {
    expect(rgbOf('light', '--focus-ring')).not.toBeNull();
    expect(rgbOf('dark', '--focus-ring')).not.toBeNull();
    // Και ΔΙΑΦΟΡΕΤΙΚΑ: ίδια τιμή στα δύο θέματα σημαίνει ότι κάποιος αντέγραψε το ένα σκέλος.
    expect(rgbOf('light', '--focus-ring')).not.toEqual(rgbOf('dark', '--focus-ring'));
  });

  test('Θ2 — ο δείκτης εστίασης πιάνει 3:1 επί του πάνελ, και στα δύο (WCAG 2.4.11)', () => {
    expect(ratio('light', '--focus-ring', '--popover')).toBeGreaterThanOrEqual(3);
    expect(ratio('dark', '--focus-ring', '--popover')).toBeGreaterThanOrEqual(3);
  });

  test('Θ3 — το κείμενο του κουμπιού «Εφαρμογή» πιάνει 4,5:1 (το σφάλμα που διορθώθηκε)', () => {
    // ΗΤΑΝ: λευκό επί #3b82f6 = 3,68:1, κάτω από το WCAG 1.4.3, ΚΑΙ ΣΤΑ ΔΥΟ θέματα.
    expect(ratio('light', '--primary-foreground', '--status-info')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('dark', '--primary-foreground', '--status-info')).toBeGreaterThanOrEqual(4.5);
  });

  test('Θ4 — το κύριο κείμενο του πάνελ πιάνει 4,5:1 και στα δύο', () => {
    expect(ratio('light', '--popover-foreground', '--popover')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('dark', '--popover-foreground', '--popover')).toBeGreaterThanOrEqual(4.5);
  });

  test('Θ5 — το σβησμένο κείμενο στο 62% δεν είναι ΧΕΙΡΟΤΕΡΟ από το χειρόγραφο', () => {
    // Οι δύο σταθερές είναι το ΜΕΤΡΗΜΕΝΟ χειρόγραφο πριν τη θεραπεία:
    //   φωτεινό  #71717a επί #ffffff = 4,83:1
    //   σκοτεινό #a1a1aa επί #1c1c1f = 6,63:1
    const HANDWRITTEN = { light: 4.83, dark: 6.63 };
    const ALPHA = 0.62; // ΤΟ ΙΔΙΟ ποσοστό που γράφουν τα τρία CSS Modules.
    for (const theme of ['light', 'dark']) {
      const painted = compositeOver(
        rgbOf(theme, '--popover-foreground'), rgbOf(theme, '--popover'), ALPHA,
      );
      const r = contrastRatio(painted, rgbOf(theme, '--popover'));
      expect(r).toBeGreaterThanOrEqual(4.5);              // WCAG 1.4.3, ετικέτες 10px
      expect(r).toBeGreaterThanOrEqual(HANDWRITTEN[theme]); // …και καμία οπισθοδρόμηση
    }
  });

  test('Θ6 — κανένα από τα τρία αρχεία δεν ξαναποκτά χειρόγραφο δεύτερο θέμα', () => {
    // Η ΔΟΜΙΚΗ άγκυρα, όχι αριθμητική: το ελάττωμα του Π1 δεν ήταν «λάθος χρώμα», ήταν
    // «ΔΥΟ συστήματα». Ένα `:global(.dark)` που ξαναβάφει είναι η επιστροφή του δεύτερου.
    const DIR = path.join(REPO_ROOT, 'src/subapps/dxf-viewer/systems/properties');
    const FILES = [
      'PropertiesPalette.module.css',
      'QuickPropertiesMiniPanel.module.css',
      'QuickPropertiesHoverPopover.module.css',
    ];
    for (const f of FILES) {
      const css = stripCommentsKeepingLines(fs.readFileSync(path.join(DIR, f), 'utf8'));
      expect({ file: f, darkOverrides: (css.match(/:global\(\.dark\)/g) || []).length })
        .toEqual({ file: f, darkOverrides: 0 });
    }
  });

  /* ═══════════════════════ Π2 — το chrome του καμβά (ADR-774 §4.5/Φ.2) ═══════════════════════
   *
   * 🔴 ΕΔΩ Η ΠΥΛΗ ΕΙΝΑΙ ΑΚΟΜΑ ΠΙΟ ΤΥΦΛΗ ΑΠ' ΟΤΙ ΣΤΟ Π1, ΚΑΙ ΤΟ ΞΕΡΟΥΜΕ ΜΕΤΡΗΜΕΝΑ.
   * Το CHECK 3.43 κρίνει `var(--αδέσποτο, <χρώμα>)`. Το `GuideColorPalette.module.css` είχε
   * **οκτώ** σταθερά λευκά **χωρίς καθόλου `var()`** — άρα ούτε καν υποψήφια για την πύλη — και
   * κάθε ένα από αυτά ήταν αόρατο στο φωτεινό θέμα. Δηλαδή η κατηγορία μπορεί να επιστρέψει
   * **χωρίς ο αριθμός της baseline να κουνηθεί καθόλου**. Μόνο δομική άγκυρα το πιάνει.
   */

  const P2_FILES = [
    'canvas-v2/overlays/RulerCornerBox.module.css',
    'ui/components/dxf-context-menu/DxfContextMenu.module.css',
    'ui/components/GuideColorPalette.module.css',
    'ui/match-properties/match-properties-dialog.module.css',
    'ui/components/table-format-toolbar/TableAxisColorMenu.module.css',
    'ui/components/table-format-toolbar/TableFormatToolbar.module.css',
    'ui/components/table-format-toolbar/table-toolbar-panel.module.css',
    'ui/components/table-format-toolbar/TableBorderMenu.module.css',
  ];
  const readP2 = (rel) => stripCommentsKeepingLines(
    fs.readFileSync(path.join(REPO_ROOT, 'src/subapps/dxf-viewer', rel), 'utf8'),
  );

  test('Θ7 — το ζεύγος του καμβά ορίζεται, είναι τα ΔΥΟ ΑΚΡΑ, και ΔΕΝ αντιστρέφεται ανά θέμα', () => {
    // Η σταθερότητα ΕΙΝΑΙ η ορθότητα: η επιφάνεια είναι ο καμβάς, που δεν ακολουθεί το θέμα
    // της εφαρμογής (preset `light` = λευκός καμβάς με σκοτεινή εφαρμογή). Το Fluent τα
    // αντιστρέφει γιατί εκεί η επιφάνεια ΑΚΟΛΟΥΘΕΙ το θέμα· εδώ αντιστροφή θα ήταν συσχέτιση
    // με λάθος μεταβλητή. Αν κάποιος «διορθώσει» προσθέτοντας override στο `.dark`, σπάει εδώ.
    expect(toHex(rgbOf('light', '--focus-ring-canvas-outer'))).toBe('#ffffff');
    expect(toHex(rgbOf('light', '--focus-ring-canvas-inner'))).toBe('#000000');
    // Η ΑΠΟΥΣΙΑ ΑΠΟ ΤΟ `.dark` ΕΙΝΑΙ Η ΕΓΓΥΗΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ. Το `readThemes` διαβάζει τα δύο
    // μπλοκ **χωριστά**, οπότε ένα token ορισμένο μόνο στο `:root` λείπει από τον χάρτη του
    // σκοτεινού· αυτό ακριβώς σημαίνει «κληρονομείται αυτούσιο και στα δύο». Αν κάποιος
    // προσθέσει override στο `.dark` — δηλαδή αντιστρέψει το ζεύγος όπως το Fluent — σπάει εδώ.
    expect(themes.dark.has('--focus-ring-canvas-outer')).toBe(false);
    expect(themes.dark.has('--focus-ring-canvas-inner')).toBe(false);
  });

  test('Θ8 — το ζεύγος έχει ΚΑΤΩ ΟΡΙΟ ≥4,5:1 σε ΚΑΘΕ γκρι που μπορεί να διαλέξει ο χρήστης', () => {
    // Η ΥΠΟΣΧΕΣΗ, όχι δείγμα: σάρωση και των 256 ουδέτερων. Το χειρότερο είναι το γκρι όπου
    // εξισώνονται τα δύο άκρα (L = √(1,05·0,05) − 0,05 ⇒ #757575 ⇒ 4,61:1).
    const inner = rgbOf('light', '--focus-ring-canvas-inner');
    const outer = rgbOf('light', '--focus-ring-canvas-outer');
    let floor = Infinity;
    for (let v = 0; v <= 255; v += 1) {
      const bg = [v, v, v];
      floor = Math.min(floor, Math.max(contrastRatio(inner, bg), contrastRatio(outer, bg)));
    }
    expect(floor).toBeGreaterThanOrEqual(4.5);
    // …και τα δύο σκέλη ξεχωρίζουν ΜΕΤΑΞΥ ΤΟΥΣ, ώστε ο δείκτης να μένει αντιληπτός ως ΣΧΗΜΑ
    // ακόμα κι αν το ένα χαθεί μέσα στο φόντο. Αυτό είναι ο μηχανισμός, όχι το χρώμα.
    expect(contrastRatio(inner, outer)).toBeGreaterThanOrEqual(20);
  });

  test('Θ9 — στο preset `cinema4d` ένα ΜΟΝΟ μπλε αποτυγχάνει· το ζεύγος περνά', () => {
    // Ο λόγος ύπαρξης του ζεύγους, με ΠΡΑΓΜΑΤΙΚΟ preset της λίστας μας — όχι υπόθεση. Το
    // #868686 είναι το κάτω άκρο της διαβάθμισης του cinema4d· το #3b82f6 ήταν το παλιό χρώμα.
    const CINEMA4D_GRADIENT_BOTTOM = [0x86, 0x86, 0x86];
    const OLD_SINGLE_BLUE = [0x3b, 0x82, 0xf6];
    expect(contrastRatio(OLD_SINGLE_BLUE, CINEMA4D_GRADIENT_BOTTOM)).toBeLessThan(3);
    const pair = Math.max(
      contrastRatio(rgbOf('light', '--focus-ring-canvas-inner'), CINEMA4D_GRADIENT_BOTTOM),
      contrastRatio(rgbOf('light', '--focus-ring-canvas-outer'), CINEMA4D_GRADIENT_BOTTOM),
    );
    expect(pair).toBeGreaterThanOrEqual(3);
  });

  test('Θ10 — το κόκκινο του μενού πιάνει 4,5:1 σε ΑΜΦΟΤΕΡΑ τα φόντα του, και στα δύο θέματα', () => {
    // Το κείμενο κάθεται είτε στο πάνελ είτε στο φόντο hover. Ένα test σε ΕΝΑ από τα δύο θα
    // ήταν πράσινο πάνω στο ελάττωμα. Τα υπάρχοντα tokens ΟΛΑ αποτυγχάνουν κάπου:
    //   --text-error 3,51 φωτ · --destructive 1,74 σκοτ · --status-error 3,63 σκοτ.
    const INK_SHARE = 0.80; // ΤΟ ΙΔΙΟ ποσοστό που γράφει το DxfContextMenu.module.css
    for (const theme of ['light', 'dark']) {
      const ink = compositeOver(
        rgbOf(theme, '--popover-foreground'), rgbOf(theme, '--text-error'), 1 - INK_SHARE,
      );
      expect(contrastRatio(ink, rgbOf(theme, '--popover'))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink, rgbOf(theme, '--bg-error'))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('Θ11 — το μελάνι της προειδοποίησης πιάνει 4,5:1 στο δοχείο της, και στα δύο', () => {
    // ⚠️ ΤΟ ΠΡΟΦΑΝΕΣ ΖΕΥΓΟΣ ΕΙΝΑΙ ΛΑΘΟΣ: `--text-warning` επί `--bg-warning` δίνει **1,61:1**
    // στο φωτεινό. Τα ονόματα μοιάζουν· δεν είναι ζεύγος. Η ίδια η αποτυχία κατοχυρώνεται
    // παρακάτω, ώστε μια μελλοντική «απλοποίηση» προς αυτό να σπάσει εδώ και να διαβάσει γιατί.
    for (const theme of ['light', 'dark']) {
      expect(ratio(theme, '--foreground', '--bg-warning')).toBeGreaterThanOrEqual(4.5);
    }
    // 🔑 ΚΑΙ ΤΟ ΣΧΗΜΑ ΤΗΣ ΑΠΟΤΥΧΙΑΣ ΕΙΝΑΙ ΤΟ ΜΑΘΗΜΑ: το προφανές ζεύγος δεν είναι «λίγο
    // χειρότερο», είναι σπασμένο ΣΤΟ ΕΝΑ θέμα και μια χαρά στο άλλο — γι' αυτό η μηχανική
    // μετονομασία *φαίνεται* να δουλεύει σε όποιο θέμα τύχει να κοιτάς.
    expect(ratio('light', '--text-warning', '--bg-warning')).toBeLessThan(4.5); // μετρημένο 1,61
    expect(ratio('dark', '--text-warning', '--bg-warning')).toBeGreaterThanOrEqual(4.5); // 7,15
  });

  test('Θ12 — το state layer στο 10% είναι ΟΡΑΤΟ και στα δύο θέματα (ήταν 1/255 στο φωτεινό)', () => {
    // Το ελάττωμα δεν ήταν «λάθος χρώμα», ήταν «αόρατο». Κατώφλι σε /255, όχι σε λόγο
    // αντίθεσης: μια επιφάνεια hover δεν είναι κείμενο — το ερώτημα είναι αν τη ΒΛΕΠΕΙΣ.
    const ALPHA = 0.10;  // ΤΟ ΙΔΙΟ ποσοστό που γράφουν τα CSS Modules του Π2
    for (const theme of ['light', 'dark']) {
      const surface = rgbOf(theme, '--popover');
      const painted = compositeOver(rgbOf(theme, '--popover-foreground'), surface, ALPHA);
      const delta = Math.max(...[0, 1, 2].map((i) => Math.abs(painted[i] - surface[i])));
      expect(delta).toBeGreaterThanOrEqual(8);
      // …και η ΠΑΛΙΑ μορφή αποδεδειγμένα δεν το πετύχαινε: λευκό 10% στο φωτεινό = 1/255.
      if (theme === 'light') {
        const old = compositeOver([255, 255, 255], surface, ALPHA);
        expect(Math.max(...[0, 1, 2].map((i) => Math.abs(old[i] - surface[i])))).toBeLessThan(8);
      }
    }
  });

  test('Θ13 — κανένα από τα 8 αρχεία του Π2 δεν ξαναποκτά σταθερό ασπρόμαυρο state layer', () => {
    // Η ΔΟΜΙΚΗ άγκυρα — η μόνη που πιάνει την επιστροφή της κατηγορίας, γιατί ένα ωμό
    // `rgba(255,255,255,α)` ΔΕΝ έχει `var()` και άρα **δεν μετριέται πουθενά** στη baseline.
    // ⚠️ Τα σχόλια αφαιρούνται ΠΡΩΤΑ: τρία από αυτά τα αρχεία *περιγράφουν* την παλιά μορφή
    // στην τεκμηρίωσή τους, και μια τεκμηρίωση του ελαττώματος δεν είναι το ελάττωμα
    // (το μάθημα `Κ7β` του CHECK 3.50).
    const FIXED_BW_LAYER = /rgba\(\s*(?:255\s*,\s*255\s*,\s*255|0\s*,\s*0\s*,\s*0)\s*,/g;
    for (const rel of P2_FILES) {
      const hits = (readP2(rel).match(FIXED_BW_LAYER) || []).length;
      expect({ file: rel, fixedBlackWhiteLayers: hits })
        .toEqual({ file: rel, fixedBlackWhiteLayers: 0 });
    }
  });
});
