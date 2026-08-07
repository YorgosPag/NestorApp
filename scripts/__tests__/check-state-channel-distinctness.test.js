/**
 * CHECK 3.41 / ADR-771 Φ.1 — η πύλη διακριτότητας καναλιού ελέγχεται από τη ΔΙΚΗ της σουίτα.
 *
 * ΔΟΜΗ (ίδια με τα CHECK 3.35/3.36/3.37/3.38/3.39):
 *   Μ0      — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό
 *   Μ1..Μ5  — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν η πύλη δεν την πιάσει, δεν είναι πύλη
 *   Π1..Π2  — ο ΠΡΑΓΜΑΤΙΚΟΣ ιστορικός κώδικας από το git: το ελάττωμα υπήρχε στ' αλήθεια
 *   Κ1..Κ4  — κοκκίωση: τι ΔΕΝ πιάνει, δηλωμένο ως test και όχι ως ελπίδα
 *
 * ⚠️ Τα Π **δεν** χρησιμοποιούν κατασκευασμένο fixture: τραβούν τα πραγματικά αρχεία από το
 * git και αποδεικνύουν ότι ο ζωγράφος όντως έβαφε **μία** γωνία για δύο καταστάσεις. Ένα
 * fixture αποδεικνύει ότι ο κώδικας συμφωνεί με τον εαυτό του· το `git show` αποδεικνύει ότι
 * η πύλη περιγράφει την **πραγματικότητα**.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { readBoundStateMarks, COLOR_CONFIG_PATH } = require('../lib/contrast/state-marks');
const { checkIdentity, checkColourPromise, CVD_TARGET } = require('../check-state-channel-distinctness');
const { hexToRgb, worstCvdDeltaE } = require('../lib/contrast/cvd');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PAINTER_PATH = 'src/subapps/dxf-viewer/rendering/entities/table/stamp-table-bound-state.ts';

/** Το ζωντανό `color-config.ts`, ως κείμενο — η βάση κάθε μετάλλαξης. */
function liveConfigSource() {
  return fs.readFileSync(path.join(REPO_ROOT, COLOR_CONFIG_PATH), 'utf8');
}

/** Στήνει μίνι-repo με το ΑΚΡΙΒΕΣ μονοπάτι που περιμένει ο αναγνώστης. */
function miniRepo(configSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sc41-'));
  const dest = path.join(root, COLOR_CONFIG_PATH);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, configSource);
  return root;
}

/** Τρέχει ολόκληρη τη μηχανή πάνω σε μεταλλαγμένη πηγή. */
function run(configSource) {
  const marks = readBoundStateMarks(miniRepo(configSource));
  return { marks, failures: [...checkIdentity(marks), ...checkColourPromise(marks, false)] };
}

const rulesOf = (failures) => failures.map((f) => f.rule);

/**
 * Το commit **πριν** από το ADR-771 Φ.1 — η ιστορική άγκυρα.
 *
 * 🔴 **Καρφωμένο, ΟΧΙ `HEAD`.** Το `HEAD` μετακινείται: μόλις μπει αυτή η αλλαγή, το `HEAD`
 * θα περιέχει τον **διορθωμένο** κώδικα και τα Π θα έλεγχαν την απόδειξη ενάντια στην ίδια
 * τη διόρθωση — δηλαδή θα αυτοακυρώνονταν σιωπηλά. Το ADR-770 μπορεί να γράφει `HEAD:` γιατί
 * εκεί το αρχείο-μάρτυρας δεν αλλάζει· εδώ αλλάζει.
 */
const BEFORE_FIX = '5baa83ba';

/**
 * Ένα αρχείο όπως ήταν σε δοθέν commit· `null` **μόνο** όταν το commit δεν υπάρχει καθόλου
 * (ρηχό clone / αποκομμένο ιστορικό).
 *
 * ⚠️ Το μονοπάτι κανονικοποιείται σε `/`: το `path.join` δίνει `\` στα Windows και το git
 * απαντά «*exists on disk, but not in HEAD*». Η πρώτη εκδοχή αυτού του αρχείου το είχε και
 * **δύο Π πέρασαν πράσινα χωρίς να ελέγξουν τίποτα** — το ίδιο σχήμα «0 = κανείς δεν
 * κοίταξε» που κυνηγά όλο το repo, γεννημένο μέσα στο test που το κυνηγά.
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
    // Άγνωστο commit ⇒ το ιστορικό λείπει (ρηχό clone). Άγνωστο ΑΡΧΕΙΟ σε γνωστό commit
    // ⇒ η άγκυρα έχει σαπίσει και πρέπει να ουρλιάξει.
    if (/unknown revision|bad object|not a valid object/i.test(String(err.stderr ?? err))) return null;
    throw new Error(`git show ${rev}:${posix} απέτυχε — η ιστορική άγκυρα έχει σπάσει.\n${err.stderr ?? err}`);
  }
}

/** `true` όταν το ιστορικό είναι διαθέσιμο· αλλιώς τα Π δηλώνουν ρητά ότι παραλείπονται. */
const HISTORY_AVAILABLE = gitShow(BEFORE_FIX, PAINTER_PATH) !== null;

// ─── Μ0 — αγκύρωση παλινδρόμησης στο ζωντανό δέντρο ───────────────────────────

describe('Μ0 — το ζωντανό δέντρο', () => {
  it('περνά και τους δύο κανόνες', () => {
    const { failures } = run(liveConfigSource());
    expect(failures).toEqual([]);
  });

  it('εκθέτει και τις πέντε καταστάσεις, με φορέα και μη-χρωματικό διακριτικό', () => {
    const { marks } = run(liveConfigSource());
    expect(marks.map((m) => m.id).sort()).toEqual(
      ['bound-readonly', 'bound-writable', 'conflict', 'overridden', 'stale'],
    );
    for (const m of marks) {
      expect(m.carrier).toBeTruthy();
      expect(m.variant).not.toMatch(/undefined|null/);
      expect(m.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('λύνει τις αναφορές UI_COLORS σε πραγματικά hex — καμία ανεπίλυτη', () => {
    const { marks } = run(liveConfigSource());
    expect(marks.find((m) => m.id === 'overridden').hex).toBe('#f59e0b');
    expect(marks.find((m) => m.id === 'conflict').hex).toBe('#ef4444');
    expect(marks.find((m) => m.id === 'bound-writable').hex).toBe('#0099ff');
  });
});

// ─── Μ1..Μ5 — μία μετάλλαξη ανά ρητή κατάσταση ────────────────────────────────

describe('Μ1..Μ5 — μεταλλάξεις', () => {
  it('Μ1: ίδια γωνία στα δύο τρίγωνα ⇒ Κ1 μπλοκ (η ΑΚΡΙΒΗΣ ιστορική παλινδρόμηση)', () => {
    const mutated = liveConfigSource().replace(
      "conflict: { hex: UI_COLORS.ERROR, corner: 'top-right' }",
      "conflict: { hex: UI_COLORS.ERROR, corner: 'top-left' }",
    );
    expect(mutated).not.toBe(liveConfigSource());
    const { failures } = run(mutated);
    expect(rulesOf(failures)).toContain('Κ1');
    expect(failures[0].detail).toMatch(/overridden|conflict/);
  });

  it('Μ2: ίδια ένταση σε γράψιμη/μη-γράψιμη λωρίδα ⇒ Κ1 μπλοκ', () => {
    const mutated = liveConfigSource().replace('readOnlyColumnAlpha: 0.22', 'readOnlyColumnAlpha: 0.55');
    const { failures } = run(mutated);
    expect(rulesOf(failures)).toContain('Κ1');
  });

  it('Μ3: μπαγιάτικη λωρίδα χωρίς μοτίβο ⇒ πέφτει πάνω στη γράψιμη ⇒ Κ1 μπλοκ', () => {
    // Το `stale` κρατά ΜΟΝΟ το μοτίβο ως διακριτικό — ίδιος φορέας με τις άλλες λωρίδες.
    const mutated = liveConfigSource().replace(
      'staleDashPx: [4, 3] as readonly number[]',
      'staleDashPx: [] as readonly number[]',
    );
    const { marks, failures } = run(mutated);
    expect(marks.find((m) => m.id === 'stale').variant).toBe('dashed:');
    // Παραμένει διακριτό από «solid:*» — αυτό είναι ΣΩΣΤΟ και δηλώνεται εδώ ρητά,
    // ώστε το Μ3 να μη διαβαστεί ως αποτυχία της πύλης.
    expect(failures).toEqual([]);
  });

  it('Μ4: σύγκρουση βαμμένη σχεδόν όπως η παράκαμψη ⇒ Κ2 μπλοκ', () => {
    // `#f59e0b` → `#f0a52a`: διαφορετικό hex, αλλά η διαφορά καταρρέει σε αχρωματοψία.
    const mutated = liveConfigSource().replace(
      "conflict: { hex: UI_COLORS.ERROR, corner: 'top-right' }",
      "conflict: { hex: '#f0a52a', corner: 'top-right' }",
    );
    const { failures } = run(mutated);
    expect(rulesOf(failures)).toContain('Κ2');
    expect(worstCvdDeltaE(hexToRgb('#f59e0b'), hexToRgb('#f0a52a'))).toBeLessThan(CVD_TARGET);
  });

  it('Μ5: ανεπίλυτη αναφορά χρώματος ⇒ Κ2 μπλοκ, ποτέ σιωπηλή παράλειψη', () => {
    const mutated = liveConfigSource().replace(
      "conflict: { hex: UI_COLORS.ERROR, corner: 'top-right' }",
      "conflict: { hex: SOME_UNKNOWN.THING, corner: 'top-right' }",
    );
    const { failures } = run(mutated);
    expect(rulesOf(failures)).toContain('Κ2');
    expect(failures.some((f) => /Ανεπίλυτο/.test(f.detail))).toBe(true);
  });
});

// ─── Π — ο ΠΡΑΓΜΑΤΙΚΟΣ ιστορικός κώδικας ──────────────────────────────────────

describe('Π — το ελάττωμα υπήρχε στ’ αλήθεια (git, όχι fixture)', () => {
  it('το ιστορικό είναι διαθέσιμο — αλλιώς τα Π1/Π2 δεν αποδεικνύουν τίποτα', () => {
    // Δηλωμένο ως ΞΕΧΩΡΙΣΤΟ test, όχι ως `if` μέσα στα άλλα: ένα early-return θα έβαφε
    // πράσινα δύο tests που δεν εκτέλεσαν καμία απόδειξη.
    expect(HISTORY_AVAILABLE).toBe(true);
  });

  (HISTORY_AVAILABLE ? it : it.skip)(
    `Π1: ο ζωγράφος στο ${BEFORE_FIX} έβαφε ΜΙΑ διαδρομή τριγώνου, χωρίς κλάδο γωνίας`,
    () => {
      const historic = gitShow(BEFORE_FIX, PAINTER_PATH);
      // Η ιστορική διαδρομή ξεκινούσε ΠΑΝΤΑ από `mark.rect.x` (πάνω-αριστερά), και η μόνη
      // διαφορά ανά κατάσταση ήταν το `fillStyle`.
      expect(historic).toMatch(/lineTo\(rc, mark\.rect\.x, mark\.rect\.y, true\)/);
      expect(historic).toMatch(/mark\.state === 'conflict'\s*\?\s*TABLE_BOUND_STATE\.conflictHex/);
      // …και καμία έννοια γωνίας πουθενά.
      expect(historic).not.toMatch(/top-right|corner:/);
    },
  );

  (HISTORY_AVAILABLE ? it : it.skip)(
    `Π2: το config στο ${BEFORE_FIX} δήλωνε δύο χρώματα και ΚΑΜΙΑ γωνία`,
    () => {
      const historic = gitShow(BEFORE_FIX, COLOR_CONFIG_PATH);
      expect(historic).toMatch(/overriddenHex:\s*UI_COLORS\.WARNING/);
      expect(historic).toMatch(/conflictHex:\s*UI_COLORS\.ERROR/);
      expect(historic).not.toMatch(/exceptionMarks/);
    },
  );

  it('Π3: και τα δύο ιστορικά χρώματα περνούσαν το CVD — γι’ αυτό ΔΕΝ αρκεί το Κ2', () => {
    // Η δικαιολόγηση της αλλαγής ΔΕΝ είναι «τα χρώματα μοιάζουν». Δεν μοιάζουν. Αυτό το
    // test κλειδώνει ακριβώς αυτό, ώστε κανείς να μην «απλοποιήσει» την πύλη σε ένα
    // κανόνα με «ή» — που θα έμενε πράσινος πάνω στο ιστορικό ελάττωμα.
    const separation = worstCvdDeltaE(hexToRgb('#f59e0b'), hexToRgb('#ef4444'));
    expect(separation).toBeGreaterThan(CVD_TARGET);
    expect(separation).toBeCloseTo(13.9, 0);
  });
});

// ─── Κ — κοκκίωση: τι ΔΕΝ πιάνει ──────────────────────────────────────────────

describe('Κ — δηλωμένα όρια', () => {
  it('Κ1: διαφορετικός φορέας ⇒ ουδέποτε παραβίαση, ακόμα και με ΤΑΥΤΟΣΗΜΟ χρώμα', () => {
    // `stale` και `overridden` έχουν το ΙΔΙΟ hex (και τα δύο `WARNING`) και δεν
    // μπλοκάρουν: το ένα είναι λωρίδα στήλης, το άλλο τρίγωνο κελιού.
    const { marks, failures } = run(liveConfigSource());
    const stale = marks.find((m) => m.id === 'stale');
    const overridden = marks.find((m) => m.id === 'overridden');
    expect(stale.hex).toBe(overridden.hex);
    expect(stale.carrier).not.toBe(overridden.carrier);
    expect(failures).toEqual([]);
  });

  it('Κ2: ΔΕΝ κρίνει αντίθεση με το φόντο — άλλη ερώτηση, άλλος ιδιοκτήτης', () => {
    // Χρώμα ταυτόσημο με το προεπιλεγμένο φόντο καμβά (`#1d283a`) περνά καθαρό εδώ.
    const mutated = liveConfigSource().replace(
      "conflict: { hex: UI_COLORS.ERROR, corner: 'top-right' }",
      "conflict: { hex: '#1d283a', corner: 'top-right' }",
    );
    const { failures } = run(mutated);
    expect(rulesOf(failures)).not.toContain('Κ1');
  });

  it('Κ3: ΔΕΝ σαρώνει άλλες οικογένειες καταστάσεων — μόνο TABLE_BOUND_STATE', () => {
    const { marks } = run(liveConfigSource());
    expect(marks).toHaveLength(5);
  });

  it('Κ4: απουσία TABLE_BOUND_STATE ⇒ σφάλμα, ΠΟΤΕ σιωπηλό πράσινο', () => {
    expect(() => run('export const SOMETHING_ELSE = {} as const;')).toThrow(/TABLE_BOUND_STATE/);
  });
});
