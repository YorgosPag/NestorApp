/**
 * CHECK 3.38 / ADR-770 — η πύλη αντίθεσης UI ελέγχεται από τη ΔΙΚΗ της σουίτα.
 *
 * ΔΟΜΗ (η ίδια με τα CHECK 3.35/3.36/3.37):
 *   Μ0      — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό απέναντι στην πραγματική baseline
 *   Μ1..Μ8  — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν η πύλη δεν την πιάσει, δεν είναι πύλη
 *   Π       — οι ανιχνευτές πάνω στον ΠΡΑΓΜΑΤΙΚΟ κώδικα που έφτασε στο main σπασμένος
 *   Κ       — κοκκίωση: τι ΔΕΝ πιάνει, δηλωμένο ως test και όχι ως ελπίδα
 *
 * ⚠️ Το Π δεν χρησιμοποιεί κατασκευασμένο fixture: τραβά το περιεχόμενο από το git.
 * Ένα fixture αποδεικνύει ότι η regex ταιριάζει με τον εαυτό της· το `git show`
 * αποδεικνύει ότι η πύλη θα είχε φράξει τον κώδικα που **όντως** πέρασε.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  RATCHETED_STATES,
  tallyByFile,
  compare,
  totals,
  baselineFile,
} = require('../check-text-primary-ratchet');
const { scanFiles } = require('../lib/contrast/text-primary-sites');
const { findGluedClasses, GLUED_RULES } = require('../lib/contrast/glued-class');

const REPO_ROOT = path.join(__dirname, '..', '..');

/** Γράφει προσωρινά αρχεία και επιστρέφει τις απόλυτες διαδρομές τους. */
function fixtureFiles(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-gate-'));
  return Object.entries(entries).map(([name, body]) => {
    const full = path.join(dir, name);
    fs.writeFileSync(full, body);
    return full;
  });
}

const site = (file, state) => ({ file, state });

// ─── Μ0 — αγκύρωση παλινδρόμησης ──────────────────────────────────────────────

describe('Μ0 — το ζωντανό δέντρο περνά απέναντι στην πραγματική baseline', () => {
  const baseline = JSON.parse(fs.readFileSync(baselineFile(), 'utf8'));

  test('η baseline έχει το σχήμα που περιμένει η πύλη', () => {
    expect(typeof baseline.files).toBe('object');
    expect(Object.keys(baseline.files).length).toBeGreaterThan(100);
    expect(baseline._meta.check).toBe('CHECK 3.38');
    // Το _meta ΠΡΕΠΕΙ να λέει ότι ο αριθμός δεν είναι δείκτης υγείας — το μάθημα
    // των τεσσάρων «0 = κανείς δεν κοίταξε» του CLAUDE.md.
    expect(baseline._meta.note).toMatch(/ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ/);
  });

  test('σύγκριση της baseline με τον εαυτό της ⇒ καμία παλινδρόμηση', () => {
    const { regressions, progress } = compare(baseline.files, baseline.files, 'all');
    expect(regressions).toEqual([]);
    expect(progress).toEqual([]);
  });

  test('το σύνολο του _meta συμφωνεί με τα δεδομένα του ίδιου αρχείου', () => {
    expect(totals(baseline.files).invisible).toBe(baseline._meta.totalInvisible);
    expect(totals(baseline.files).files).toBe(baseline._meta.totalFiles);
  });
});

// ─── Μ1..Μ5 — μεταλλάξεις του ratchet ─────────────────────────────────────────

describe('Μ1..Μ5 — ο ratchet πιάνει κάθε τρόπο χειροτέρευσης', () => {
  const BASE = { 'src/a.tsx': { 'theme-surface': 2 }, 'src/b.tsx': { 'file-light-bg': 1 } };

  test('Μ1 — ΝΕΟ αρχείο με αόρατη χρήση ⇒ ΜΠΛΟΚ, σημειωμένο ως νέο', () => {
    const { regressions } = compare({ 'src/new.tsx': { 'theme-surface': 1 } }, BASE, 'staged');
    expect(regressions).toHaveLength(1);
    expect(regressions[0]).toMatchObject({ file: 'src/new.tsx', state: 'theme-surface', was: 0, now: 1, isNewFile: true });
  });

  test('Μ2 — υπάρχον αρχείο ΑΥΞΑΝΕΙ ⇒ ΜΠΛΟΚ', () => {
    const { regressions } = compare({ 'src/a.tsx': { 'theme-surface': 3 } }, BASE, 'staged');
    expect(regressions).toEqual([{ file: 'src/a.tsx', state: 'theme-surface', was: 2, now: 3, isNewFile: false }]);
  });

  test('Μ3 — μείωση ⇒ ΠΡΟΟΔΟΣ, όχι παλινδρόμηση', () => {
    const { regressions, progress } = compare({ 'src/a.tsx': { 'theme-surface': 1 } }, BASE, 'staged');
    expect(regressions).toEqual([]);
    expect(progress).toEqual([{ file: 'src/a.tsx', state: 'theme-surface', was: 2, now: 1 }]);
  });

  test('Μ4 — αλλαγή ΚΑΤΑΣΤΑΣΗΣ μέσα στο ίδιο αρχείο δεν κρύβεται πίσω από ίδιο σύνολο', () => {
    // 2 theme-surface → 1 theme-surface + 1 file-light-bg: το ΣΥΝΟΛΟ μένει 2.
    // Ένα αριθμητικό ratchet θα το άφηνε να περάσει· το ανά-κατάσταση όχι.
    const { regressions } = compare({ 'src/a.tsx': { 'theme-surface': 1, 'file-light-bg': 1 } }, BASE, 'staged');
    expect(regressions).toEqual([{ file: 'src/a.tsx', state: 'file-light-bg', was: 0, now: 1, isNewFile: false }]);
  });

  test('Μ5 — απουσία αρχείου: πρόοδος ΜΟΝΟ σε --all, ποτέ σε staged', () => {
    // Σε staged, το `src/b.tsx` απλώς δεν σαρώθηκε. Αν μετρούσε ως πρόοδος, ένα
    // reseed μετά από άσχετο commit θα «καθάριζε» αρχεία που κανείς δεν άγγιξε.
    expect(compare({ 'src/a.tsx': { 'theme-surface': 2 } }, BASE, 'staged').progress).toEqual([]);
    expect(compare({ 'src/a.tsx': { 'theme-surface': 2 } }, BASE, 'all').progress)
      .toEqual([{ file: 'src/b.tsx', state: 'file-light-bg', was: 1, now: 0 }]);
  });
});

// ─── Μ6..Μ8 — καταστάσεις και κατηγοριοποίηση ─────────────────────────────────

describe('Μ6..Μ8 — ποιες καταστάσεις μπαίνουν στη baseline και ποιες όχι', () => {
  test('Μ6 — το `in-comment` ΔΕΝ μπαίνει (δεν αποδίδεται)', () => {
    expect(tallyByFile([site('src/a.tsx', 'in-comment')])).toEqual({});
  });

  test('Μ7 — το `inert-class` ΔΕΝ μπαίνει στη baseline: είναι μηδενικής ανοχής', () => {
    expect(tallyByFile([site('src/a.tsx', 'inert-class')])).toEqual({});
    expect(RATCHETED_STATES).not.toContain('inert-class');
  });

  test('Μ8 — το `element-light-bg` ΜΠΑΙΝΕΙ: ο σαρωτής δεν λέει καμία κατάσταση «εντάξει»', () => {
    expect(RATCHETED_STATES).toContain('element-light-bg');
    expect(tallyByFile([site('src/a.tsx', 'element-light-bg')])).toEqual({ 'src/a.tsx': { 'element-light-bg': 1 } });
    // …αλλά ΔΕΝ μετριέται ως «αόρατη»: οι 2 εξετάστηκαν με το μάτι και είναι σωστές.
    expect(totals({ 'src/a.tsx': { 'element-light-bg': 5 } }).invisible).toBe(0);
  });
});

// ─── Π — οι ανιχνευτές πάνω σε ΠΡΑΓΜΑΤΙΚΟ ιστορικό κώδικα ─────────────────────

/**
 * 🔴 ΚΑΡΦΩΜΕΝΟ SHA, ΚΑΙ **ΠΟΤΕ** `HEAD`.
 *
 * Η πρώτη γραφή αυτής της ομάδας διάβαζε `HEAD:<αρχείο>`. Λειτουργούσε για όσο ο
 * σπασμένος κώδικας **ήταν** ο `HEAD` — δηλαδή μέχρι το επόμενο commit. Μόλις μπήκε
 * η διόρθωση του ADR-759 §4.12.3, το «πραγματικό ιστορικό» έγινε ο **διορθωμένος**
 * κώδικας και τα τρία tests γύρισαν 0 ευρήματα: η ομάδα που αποδεικνύει ότι η πύλη
 * πιάνει **αυτοακυρώθηκε στο πρώτο commit μετά τη γέννησή της**.
 *
 * Το `4a1babe2` είναι το τελευταίο commit **πριν** τη διόρθωση: εκεί ζουν και οι
 * τρεις κολλημένες κλάσεις και οι τέσσερις χρήσεις του `text-primary` ως μελάνι.
 * Ένα SHA είναι αμετάβλητο — ένα `HEAD` είναι ραντεβού με τον εαυτό σου.
 *
 * ⚠️ Απαιτεί **πλήρες** ιστορικό: `actions/checkout` με `fetch-depth: 0`. Αν το
 * αντικείμενο λείπει, το `git show` **πετάει** και το test γίνεται κόκκινο — που
 * είναι το σωστό: «δεν μπόρεσα να κοιτάξω» δεν επιτρέπεται να μοιάζει με «καθαρό».
 */
const PRE_FIX_COMMIT = '4a1babe2';

describe('Π — η πύλη θα είχε φράξει τον κώδικα που όντως πέρασε (git show 4a1babe2)', () => {
  const TARGETS = [
    'src/components/ui/form/action-button-config.ts',
    'src/components/ui/form/ToolbarButtons.tsx',
  ];

  let files;
  beforeAll(() => {
    const bodies = {};
    for (const t of TARGETS) {
      bodies[path.basename(t)] = execFileSync('git', ['show', `${PRE_FIX_COMMIT}:${t}`], {
        encoding: 'utf8', cwd: REPO_ROOT, maxBuffer: 1e8,
      });
    }
    files = fixtureFiles(bodies);
  });

  test('ο σαρωτής βρίσκει την ανύπαρκτη κλάση `text-primaryflex`', () => {
    const inert = scanFiles(files, []).filter((s) => s.state === 'inert-class');
    expect(inert.map((s) => s.matched)).toEqual(['text-primaryflex']);
  });

  test('βρίσκει και τις 4 χρήσεις του `text-primary` ως μελάνι στον κατάλογο', () => {
    const surface = scanFiles(files, []).filter((s) => s.state === 'theme-surface');
    expect(surface).toHaveLength(4);
  });

  test('ο ανιχνευτής κολλημένων βρίσκει 3, ΚΑΙ ΜΕ ΤΟΥΣ ΔΥΟ κανόνες', () => {
    const hits = files.flatMap((f) => findGluedClasses(fs.readFileSync(f, 'utf8')));
    expect(hits).toHaveLength(3);
    expect(new Set(hits.map((h) => h.rule))).toEqual(new Set(['arbitrary-close', 'named-color']));
  });

  test('το ΣΗΜΕΡΙΝΟ δέντρο είναι στο μηδέν και στους δύο ανιχνευτές', () => {
    const live = TARGETS.map((t) => path.join(REPO_ROOT, t));
    expect(scanFiles(live, []).filter((s) => s.state === 'inert-class')).toEqual([]);
    expect(live.flatMap((f) => findGluedClasses(fs.readFileSync(f, 'utf8')))).toEqual([]);
  });
});

// ─── Κ — κοκκίωση: τι ΔΕΝ πιάνει, γραμμένο ─────────────────────────────────────

describe('Κ — τα όρια είναι δηλωμένα, όχι σιωπηλά', () => {
  test('οι κανόνες κολλημένης δεν χτυπούν ΝΟΜΙΜΟ κώδικα', () => {
    const legit = [
      'className={cn(base, "text-primary flex items-center gap-2")}',
      'className="text-primary-foreground bg-primary"',
      'className="text-muted-foreground"',
      'className={cn("min-w-[100px] justify-start", extra)}',
      'const x = arr[0][1];',
      'className="w-[calc(100%-2rem)] p-4"',
    ];
    for (const line of legit) {
      for (const rule of GLUED_RULES) expect({ line, rule: rule.id, hit: rule.re.test(line) }).toEqual({ line, rule: rule.id, hit: false });
    }
  });

  test('τα σχόλια εξαιρούνται — αλλιώς αυτό το ίδιο το αρχείο θα ήταν παραβίαση', () => {
    const src = ['/**', ' * παράδειγμα: "text-primaryflex items-center"', ' */', 'const a = 1;'].join('\n');
    expect(findGluedClasses(src)).toEqual([]);
  });

  test('ΔΗΛΩΜΕΝΟ ΚΕΝΟ — ανταλλαγή στο ίδιο αρχείο, ίδια κατάσταση, ΠΕΡΝΑΕΙ', () => {
    // Και οι δύο χρήσεις είναι εξίσου αόρατες, οπότε το πλήθος είναι το σωστό μέτρο
    // βλάβης εδώ. Το ADR-749 προειδοποιεί για ανταλλαγή ΜΕΤΑΞΥ modules — αυτήν την
    // πιάνει η κοκκίωση ανά αρχείο (Μ1). Γραμμένο ώστε να μην ανακαλυφθεί ως έκπληξη.
    const before = { 'src/a.tsx': { 'theme-surface': 2 } };
    const after = { 'src/a.tsx': { 'theme-surface': 2 } };
    expect(compare(after, before, 'all').regressions).toEqual([]);
  });

  test('ο αριθμός γραμμής ΔΕΝ είναι μέρος της ταυτότητας (αλλιώς κάθε μετακίνηση = κόκκινο)', () => {
    const moved = tallyByFile([{ file: 'src/a.tsx', line: 900, state: 'theme-surface' }]);
    const original = tallyByFile([{ file: 'src/a.tsx', line: 12, state: 'theme-surface' }]);
    expect(moved).toEqual(original);
  });
});
