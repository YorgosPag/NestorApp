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
const { surfaceInkNames } = require('../lib/contrast/surface-ink-tokens');
const { loadTailwindColors, resolveClassToken } = require('../lib/contrast/tailwind-class-resolver');

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

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Σ — Η ΕΜΒΕΛΕΙΑ ΠΑΡΑΓΕΤΑΙ (ADR-770 §16): το «πριν» και το «μετά», ΕΚΤΕΛΕΣΜΕΝΑ
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Μέχρι τις 2026-08-27 η πύλη ρωτούσε ονομαστικά για το `text-primary`. Το
 * `--destructive` ήταν **η ίδια κλάση σφάλματος** — χρώμα επιφάνειας ως μελάνι — και
 * πέρασε από δίπλα: μετρήθηκε **1,67:1** σε ζωντανή οθόνη, σε 391 αρχεία.
 *
 * 🔑 Αυτά τα tests **δεν** επικαλούνται τη λίστα· τη **χτίζουν** από δύο πραγματικά
 * `tailwind.config.ts` και ελέγχουν ότι διαφέρει **ακριβώς** εκεί που πρέπει.
 */
describe('Σ — η εμβέλεια παράγεται από το tailwind.config.ts, δεν γράφεται', () => {
  const NL = String.fromCharCode(10);
  const GLOBALS = [
    ':root {',
    '  --background: 214 95% 93%; --card: 213 92% 95%; --popover: 212 89% 97%;',
    '  --muted: 212 85% 94%; --secondary: 213 88% 96%; --accent: 211 83% 92%;',
    '  --primary: 217 91% 60%; --destructive: 0 84.2% 60.2%;',
    '  --foreground: 222 47% 11%; --text-error: 0 72% 42%;',
    '}',
    '.dark {',
    '  --background: 220 20% 11%; --card: 217 33% 17%; --popover: 220 20% 11%;',
    '  --muted: 217 27% 11%; --secondary: 217 27% 11%; --accent: 217 27% 11%;',
    '  --primary: 217 33% 17%; --destructive: 0 62.8% 30.6%;',
    '  --foreground: 210 40% 98%; --text-error: 0 84% 70%;',
    '}',
  ].join(NL);

  /** Μίνι-repo — ο resolver το υποστηρίζει ρητά (λύνει το tailwindcss από το __dirname). */
  function miniRepo(textColorBlock) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-scope-'));
    fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app', 'globals.css'), GLOBALS);
    fs.writeFileSync(
      path.join(root, 'tailwind.config.ts'),
      [
        'export default {',
        '  content: [],',
        '  theme: { extend: {',
        '    colors: {',
        '      primary: { DEFAULT: "hsl(var(--primary))" },',
        '      destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--foreground))" },',
        '      card: { DEFAULT: "hsl(var(--card))" },',
        '    },',
        textColorBlock,
        '  } },',
        '};',
      ].join(NL),
    );
    return root;
  }

  const PRIN = () => miniRepo('    // καμία παράκαμψη ανά utility');
  const META = () => miniRepo('    textColor: { destructive: { DEFAULT: "hsl(var(--text-error) / <alpha-value>)" } },');

  test('Σ1 — ΠΡΙΝ τη διόρθωση το `destructive` ΕΙΝΑΙ στην εμβέλεια· ΜΕΤΑ δεν είναι', () => {
    const before = surfaceInkNames(PRIN());
    const after = surfaceInkNames(META());
    expect(before).toContain('destructive');
    expect(after).not.toContain('destructive');
    // Και η ΜΟΝΗ διαφορά: αλλιώς το test θα περνούσε για λάθος λόγο.
    expect(before.filter((n) => !after.includes(n))).toEqual(['destructive']);
    expect(after.filter((n) => !before.includes(n))).toEqual([]);
    // Το `primary` μένει και στα δύο — η γενίκευση ΔΕΝ έχασε την αρχική εμβέλεια.
    expect(after).toContain('primary');
  });

  test('Σ2 — ο ΙΔΙΟΣ κώδικας: παραβίαση ΠΡΙΝ, καθαρός ΜΕΤΑ — χωρίς να αλλάξει γραμμή', () => {
    const [file] = fixtureFiles({
      'UserMenu.tsx': 'export const x = <span className="text-destructive">Αποσύνδεση</span>;',
    });
    const before = scanFiles([file], [], surfaceInkNames(PRIN()));
    const after = scanFiles([file], [], surfaceInkNames(META()));
    expect(before.map((s) => s.state)).toEqual(['theme-surface']);
    expect(after).toEqual([]);
  });

  test('Σ3 — το `bg-destructive` ΔΕΝ κρίνεται: η επιφάνεια είναι ο ΣΩΣΤΟΣ ρόλος', () => {
    const [file] = fixtureFiles({
      'DeleteButton.tsx': 'export const x = <button className="bg-destructive text-destructive-foreground">Δ</button>;',
    });
    expect(scanFiles([file], [], surfaceInkNames(PRIN()))).toEqual([]);
  });

  test('Σ4 — ο resolver ρωτά την παλέτα ΤΟΥ UTILITY, όχι μόνο το theme.colors', () => {
    const palette = loadTailwindColors(META());
    expect(resolveClassToken('text-destructive', palette).varName).toBe('--text-error');
    expect(resolveClassToken('bg-destructive', palette).varName).toBe('--destructive');
    // Χωρίς παράκαμψη, οι δύο συμφωνούν — η παλέτα utility ΣΠΕΡΝΕΤΑΙ από το colors.
    const legacy = loadTailwindColors(PRIN());
    expect(resolveClassToken('text-destructive', legacy).varName).toBe('--destructive');
  });

  test('Σ5 — fail-closed: σκέτο theme.colors ΑΠΟΡΡΙΠΤΕΤΑΙ, δεν απαντά λάθος σιωπηλά', () => {
    const palette = loadTailwindColors(META());
    expect(() => resolveClassToken('text-destructive', palette.colors)).toThrow(/loadTailwindColors/);
  });

  test('Σ6 — fail-closed: παλέτα χωρίς κανένα token επιφάνειας ΣΚΑΕΙ αντί να πει «0»', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-empty-'));
    fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app', 'globals.css'), ':root { --foreground: 0 0% 0%; }');
    fs.writeFileSync(
      path.join(root, 'tailwind.config.ts'),
      'export default { content: [], theme: { extend: { colors: { ink: "#000000" } } } };',
    );
    expect(() => surfaceInkNames(root)).toThrow(/fail-closed/);
  });
});
