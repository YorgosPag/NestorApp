/**
 * CHECK 3.42 / ADR-773 §8 — η πύλη της πέμπτης αρχής χρώματος ελέγχεται από τη ΔΙΚΗ της σουίτα.
 *
 * ΔΟΜΗ (ίδια με τα CHECK 3.35/3.36/3.37/3.38/3.39):
 *   Μ0       — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό απέναντι στην πραγματική baseline
 *   Μ1..Μ9   — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν η πύλη δεν την πιάσει, δεν είναι πύλη
 *   Ρ        — ο ratchet: προσθήκη ⇒ μπλοκ, **ανταλλαγή** ⇒ μπλοκ
 *   Π        — ο ΠΡΑΓΜΑΤΙΚΟΣ κώδικας από το git: αναπαράγει το μετρημένο 1,02:1
 *   Κ        — κοκκίωση: τι ΔΕΝ πιάνει, δηλωμένο ως test και όχι ως ελπίδα
 *
 * ⚠️ ΚΑΘΕ ΜΕΤΑΛΛΑΞΗ ΑΛΛΑΖΕΙ ΣΥΜΠΕΡΙΦΟΡΑ. Η `Μ6` του Στρώματος 2β αστόχησε επειδή
 * στόχευε ένα `.sort()` — **σημασιολογικά ουδέτερο**. Μια μετάλλαξη που δεν αλλάζει
 * συμπεριφορά δεν αποδεικνύει τίποτα για την πύλη.
 *
 * ⚠️ ΤΟ COMMIT ΤΟΥ `Π` ΕΙΝΑΙ ΚΑΡΦΩΜΕΝΟ, ΟΧΙ `HEAD`. Το `HEAD` μετακινείται (το working
 * tree μοιράζεται με δεύτερο agent) και τα Π θα αυτοακυρώνονταν σιωπηλά. Και το
 * `git show` ελέγχεται για **κενή** απάντηση: στα Windows το `path.join` δίνει
 * backslash, το git απαντά «exists on disk, but not in HEAD» και ένα `if (x===null)
 * return` βάφει το test πράσινο — το σχήμα «κανείς δεν κοίταξε», μέσα στο test που το
 * κυνηγά (CHECK 3.41, μετρημένο).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { readThemes } = require('../lib/contrast/css-token-themes');
const { evaluate, RATCHETED_STATES } = require('../lib/contrast/theme-pairing');
const { buildClassPalette, auditBuckets, resolveScope } = require('../lib/contrast/tailwind-class-palette');
const { loadTailwindColors, resolveClassToken, lookupColor } = require('../lib/contrast/tailwind-class-resolver');
const { parseColorUtility, splitVariants, splitOpacity } = require('../lib/contrast/tailwind-classes');
const { compareSets } = require('../lib/ratchet-baseline');
const { measure, violationId, baselineFile, CLASS_RATCHETED_STATES } = require('../check-tailwind-theme-classes-ratchet');

const REPO_ROOT = path.join(__dirname, '..', '..');

/** Το commit που περιέχει το εύρημα-αφετηρία. ΚΑΡΦΩΜΕΝΟ επίτηδες — βλ. επικεφαλίδα. */
const PINNED = 'eff100ba';
const TOKENS_FILE = 'src/design-system/tokens/colors.ts';

/**
 * Ελάχιστο αλλά ΑΛΗΘΙΝΟ globals.css: δύο θέματα με επιφάνειες που όντως αντιστρέφονται.
 * Οι τιμές είναι οι πραγματικές του έργου (`--card` σκοτεινό = `217 33% 17%`).
 */
const MINI_CSS = `
:root {
  --background: 0 0% 100%;
  --card: 0 0% 100%;
  --foreground: 222 47% 11%;
  --card-foreground: 222 47% 11%;
}
.dark {
  --background: 222 47% 11%;
  --card: 217 33% 17%;
  --foreground: 210 40% 98%;
  --card-foreground: 210 40% 98%;
}
`;

const MINI_TW_CONFIG = `export default {
  content: [],
  theme: { extend: { colors: {
    background: 'hsl(var(--background))',
    card: 'hsl(var(--card))',
    foreground: 'hsl(var(--foreground))',
  } } },
};
`;

const MINI_REGISTRY = {
  exemptPatterns: '(__tests__|\\\\.test\\\\.)',
  modules: {
    'tailwind-hardcoded-palette': {
      ssotFile: TOKENS_FILE,
      forbiddenPatterns: ['(bg|text)-(slate|red)-(50|100|900)'],
      allowlist: [TOKENS_FILE],
    },
  },
};

/** Στήνει μίνι-repo με το ΑΚΡΙΒΕΣ δέντρο που περιμένουν οι τρεις readers. */
function miniRepo(moduleSource, { css = MINI_CSS, registry = MINI_REGISTRY } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tc42-'));
  fs.mkdirSync(path.join(root, 'src', 'design-system', 'tokens'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app', 'globals.css'), css);
  fs.writeFileSync(path.join(root, 'tailwind.config.ts'), MINI_TW_CONFIG);
  fs.writeFileSync(path.join(root, '.ssot-registry.json'), JSON.stringify(registry, null, 2));
  fs.writeFileSync(path.join(root, TOKENS_FILE), moduleSource);
  return root;
}

/**
 * Τρέχει ΟΛΗ τη μηχανή πάνω σε μίνι-repo.
 *
 * ⚠️ Το `evaluate` περιλαμβάνει πλέον **και** τους ημιδιαφανείς (Κατηγορία Ε,
 * 2026-08-08). Μέχρι τότε εδώ υπήρχε δεύτερη κλήση `evaluateTranslucent` — αν την
 * ξαναπροσθέσεις, κάθε ημιδιαφανής μετριέται **δύο φορές**.
 */
function run(moduleSource, opts) {
  const root = miniRepo(moduleSource, opts);
  const themes = readThemes(root);
  const palette = buildClassPalette(root, themes);
  const result = evaluate(palette, themes);
  const findings = [...result.findings, ...palette.extraFindings];
  return { palette, findings, ledger: auditBuckets(palette) };
}

const statesOf = (r, state) => r.findings.filter((f) => f.state === state);
const bucketOf = (r, name) => r.ledger.counts[name];

/** `git show` που ΑΡΝΕΙΤΑΙ να επιστρέψει σιωπηλά κενό. */
function gitShow(commit, relPath) {
  const spec = `${commit}:${relPath.replace(/\\/g, '/')}`;
  const body = execFileSync('git', ['show', spec], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 8 << 20 });
  if (!body || body.trim().length < 100) {
    throw new Error(`git show ${spec} γύρισε κενό — το test θα ήταν ψευδώς πράσινο.`);
  }
  return body;
}

// ─── Μ0 — αγκύρωση παλινδρόμησης στο ζωντανό δέντρο ───────────────────────────

describe('Μ0 — το ζωντανό δέντρο περνά απέναντι στην πραγματική baseline', () => {
  const baseline = JSON.parse(fs.readFileSync(baselineFile(), 'utf8'));

  test('η baseline έχει το σχήμα που περιμένει η πύλη', () => {
    expect(Array.isArray(baseline.violations)).toBe(true);
    expect(Array.isArray(baseline.declarations)).toBe(true);
    expect(baseline.adr).toMatch(/CHECK 3\.42/);
    expect(baseline.note).toMatch(/ΔΕΝ είναι δείκτης υγείας/);
  });

  test('το ζωντανό δέντρο δεν έχει καμία προσθήκη έναντι της baseline', () => {
    const m = measure();
    expect(compareSets(m.violationIds, baseline.violations).added).toEqual([]);
    expect(compareSets(m.declarations, baseline.declarations).added).toEqual([]);
  });

  test('τα σύνολα του αρχείου συμφωνούν με τα δικά του δεδομένα', () => {
    expect(baseline.violations.length).toBe(baseline.violation_count);
    expect(baseline.declarations.length).toBe(baseline.declaration_count);
  });

  test('κάθε κατάσταση της baseline είναι ratcheted — καμία υγιής δεν μπήκε κατά λάθος', () => {
    for (const id of baseline.violations) {
      expect(CLASS_RATCHETED_STATES).toContain(id.split('::')[0]);
    }
  });

  test('η εμβέλεια είναι η allowlist του μητρώου, όχι σκληρή λίστα — και δεν έχει drift', () => {
    const scope = resolveScope(REPO_ROOT);
    expect(scope.drift).toEqual([]);
    expect(scope.files).toContain(TOKENS_FILE);
    expect(scope.files.length).toBe(baseline.files);
  });
});

// ─── Μ1..Μ9 — μία μετάλλαξη ανά ρητή κατάσταση ────────────────────────────────

describe('Μ1..Μ9 — κάθε κατάσταση παράγεται από πραγματική μετάλλαξη', () => {
  test('Μ1 — ωμή κλίμακα σε ρόλο κειμένου ⇒ theme-flip', () => {
    const r = run(`export const t = { text: { primary: "text-slate-900" } } as const;`);
    expect(statesOf(r, 'theme-flip')).toHaveLength(1);
    expect(statesOf(r, 'theme-flip')[0].detail).toMatch(/#0f172a/);
    expect(bucketOf(r, 'judged-mono')).toBe(1);
  });

  test('Μ2 — σημασιολογικό token αντί για κλίμακα ⇒ ΚΑΜΙΑ παραβίαση, κάδος themed-var', () => {
    const r = run(`export const t = { text: { primary: "text-foreground" } } as const;`);
    expect(r.findings.filter((f) => CLASS_RATCHETED_STATES.includes(f.state))).toHaveLength(0);
    expect(bucketOf(r, 'themed-var')).toBe(1);
    expect(bucketOf(r, 'judged-mono')).toBe(0);
  });

  test('Μ3 — σκαλί που ΔΕΝ υπάρχει ⇒ class-unknown (η κλάση δεν παράγει CSS)', () => {
    const r = run(`export const t = { text: { primary: "text-slate-901" } } as const;`);
    expect(statesOf(r, 'class-unknown')).toHaveLength(1);
    expect(statesOf(r, 'class-unknown')[0].detail).toMatch(/ΔΕΝ παράγει CSS/);
    // ΔΕΝ κρίνεται ως χρώμα: δεν υπάρχει τιμή για να κριθεί.
    expect(statesOf(r, 'theme-flip')).toHaveLength(0);
  });

  test('Μ4 — αυθαίρετη τιμή σε ανύπαρκτο custom property ⇒ dangling-var', () => {
    const r = run(`export const t = { background: { surface: "bg-[hsl(var(--nope-xyz))]" } } as const;`);
    expect(statesOf(r, 'dangling-var')).toHaveLength(1);
    expect(statesOf(r, 'dangling-var')[0].detail).toMatch(/--nope-xyz/);
  });

  test('Μ5 — βάση + `dark:` ⇒ θεματικό ζεύγος· σκούρο σκέλος για σκοτεινό θέμα = αόρατο', () => {
    const r = run(`export const t = { text: { primary: "text-slate-900 dark:text-slate-800" } } as const;`);
    expect(bucketOf(r, 'judged-themed-pair')).toBe(1);
    expect(bucketOf(r, 'judged-mono')).toBe(0);
    expect(statesOf(r, 'themed-side-invisible').length).toBeGreaterThan(0);
  });

  test('Μ5β — το ΣΩΣΤΟ `dark:` ζεύγος δεν παράγει παραβίαση (ο έλεγχος διακρίνει)', () => {
    const r = run(`export const t = { text: { primary: "text-slate-900 dark:text-slate-100" } } as const;`);
    expect(bucketOf(r, 'judged-themed-pair')).toBe(1);
    expect(statesOf(r, 'themed-side-invisible')).toHaveLength(0);
    expect(statesOf(r, 'themed-side-ok')).toHaveLength(2);
  });

  test('Μ6 — ημιδιαφανές κείμενο αόρατο παντού ⇒ translucent-invisible (με ΣΥΝΘΕΣΗ)', () => {
    const r = run(`export const t = { text: { ghost: "text-white/5" } } as const;`);
    expect(bucketOf(r, 'judged-translucent')).toBe(1);
    expect(statesOf(r, 'translucent-invisible')).toHaveLength(1);
    expect(statesOf(r, 'translucent-invisible')[0].detail).toMatch(/α=0\.05/);
  });

  test('Μ7 — σκαλί παλέτας σε primitive μονοπάτι ⇒ ΕΚΤΟΣ ΕΜΒΕΛΕΙΑΣ, αλλά ΜΕΤΡΗΜΕΝΟ', () => {
    const r = run(`export const t = { palette: { blue: { "500": "bg-blue-500" } } } as const;`);
    expect(bucketOf(r, 'role-out-of-scope')).toBe(1);
    expect(bucketOf(r, 'judged-mono')).toBe(0);
    expect(r.findings).toHaveLength(0);
  });

  test('Μ8 — `// theme-exempt:` με λόγο σβήνει τη ΘΕΜΑΤΙΚΗ κρίση', () => {
    const r = run(`export const t = {
      text: {
        // theme-exempt: κατηγορικό χρώμα ταυτότητας για debug overlay
        primary: "text-slate-900",
      },
    } as const;`);
    expect(bucketOf(r, 'exempt')).toBe(1);
    expect(statesOf(r, 'theme-flip')).toHaveLength(0);
  });

  test('Μ9 — το `theme-exempt` ΔΕΝ σβήνει λάθος: το class-unknown επιβιώνει', () => {
    const r = run(`export const t = {
      text: {
        // theme-exempt: υποτίθεται κατηγορικό
        primary: "text-slate-901",
      },
    } as const;`);
    expect(statesOf(r, 'class-unknown')).toHaveLength(1);
    expect(bucketOf(r, 'exempt')).toBe(0);
  });
});

// ─── Ρ — ο ratchet κατά ταυτότητα ─────────────────────────────────────────────

describe('Ρ — ratchet κατά ταυτότητα: προσθήκη ΚΑΙ ανταλλαγή μπλοκάρουν', () => {
  test('Ρ1 — νέα παραβίαση σε νέα δήλωση ⇒ added', () => {
    const before = run(`export const t = { text: { a: "text-foreground" } } as const;`);
    const after = run(`export const t = { text: { a: "text-foreground", b: "text-slate-900" } } as const;`);
    const ids = (r) => r.findings.filter((f) => CLASS_RATCHETED_STATES.includes(f.state)).map(violationId).sort();
    expect(compareSets(ids(after), ids(before)).added).toHaveLength(1);
  });

  test('Ρ2 — ΑΝΤΑΛΛΑΓΗ (ίδιο πλήθος, άλλη ταυτότητα) ⇒ added, δεν περνά ως «5→5»', () => {
    const before = run(`export const t = { text: { a: "text-slate-900" } } as const;`);
    const after = run(`export const t = { text: { b: "text-slate-900" } } as const;`);
    const ids = (r) => r.findings.filter((f) => CLASS_RATCHETED_STATES.includes(f.state)).map(violationId).sort();
    expect(ids(before)).toHaveLength(1);
    expect(ids(after)).toHaveLength(1);
    expect(compareSets(ids(after), ids(before)).added).toHaveLength(1);
  });

  test('Ρ3 — ΝΕΑ μονοθεματική κλάση μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ σήμερα περνά (μοντέλο Atlassian)', () => {
    // Το `text-slate-950` περνά και στα δύο θέματα εδώ, αλλά είναι ΝΕΑ ταυτότητα στο
    // κλειστό σύνολο: θα σπάσει μόλις μετακινηθεί μια επιφάνεια.
    const before = run(`export const t = { text: { a: "text-foreground" } } as const;`);
    const after = run(`export const t = { text: { a: "text-foreground", b: "text-slate-500" } } as const;`);
    expect(compareSets(after.palette.judged, before.palette.judged).added).toHaveLength(1);
  });
});

// ─── Π — ο ΠΡΑΓΜΑΤΙΚΟΣ κώδικας, από το git ────────────────────────────────────

describe('Π — η μηχανή αναπαράγει το ΜΕΤΡΗΜΕΝΟ εύρημα του ADR-773 §3', () => {
  test('Π1 — το καρφωμένο commit περιέχει όντως τις τρεις μονοθεματικές δηλώσεις', () => {
    const body = gitShow(PINNED, TOKENS_FILE);
    expect(body).toMatch(/primary:\s*'text-slate-900'/);
    expect(body).toMatch(/secondary:\s*'text-slate-600'/);
    expect(body).toMatch(/muted:\s*'text-slate-400'/);
  });

  test('Π2 — οι τρεις κλάσεις λύνονται στα hex που κατέγραψε το ADR-773', () => {
    const { colors } = loadTailwindColors(REPO_ROOT);
    expect(resolveClassToken('text-slate-900', colors).hex).toBe('#0f172a');
    expect(resolveClassToken('text-slate-600', colors).hex).toBe('#475569');
    expect(resolveClassToken('text-slate-400', colors).hex).toBe('#94a3b8');
  });

  test('Π3 — το `text-slate-900` δίνει 1,02:1 στο ΣΚΟΤΕΙΝΟ `--background` του πραγματικού globals.css', () => {
    const { hslToRgb, contrastRatio } = require('../lib/contrast/wcag-contrast');
    const { hexToRgb } = require('../lib/contrast/theme-pairing');
    const { describeValue } = require('../lib/contrast/css-token-themes');
    const themes = readThemes(REPO_ROOT);
    const dark = describeValue(themes.dark.get('--background'));
    const ratio = contrastRatio(hexToRgb('#0f172a'), hslToRgb(dark.hsl));
    expect(ratio).toBeGreaterThan(1.0);
    expect(ratio).toBeLessThan(1.1); // το μετρημένο 1,02:1 του ADR-773 §3
  });

  test('Π4 — η ζωντανή πύλη σημειώνει την ίδια δήλωση ως theme-flip', () => {
    const m = measure();
    const hit = m.violations.find(
      (f) => f.file === TOKENS_FILE && f.state === 'theme-flip' && /text\.primary/.test(f.detail),
    );
    expect(hit).toBeDefined();
    expect(hit.detail).toMatch(/#0f172a/);
  });
});

// ─── Κ — κοκκίωση και δηλωμένα όρια ───────────────────────────────────────────

describe('Κ — κοκκίωση: τι κρίνεται, τι όχι, και ΓΙΑΤΙ γραπτά', () => {
  test('Κ1 — Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ στο ζωντανό δέντρο: καμία δήλωση δεν πέφτει σιωπηλά έξω', () => {
    const themes = readThemes(REPO_ROOT);
    const palette = buildClassPalette(REPO_ROOT, themes);
    const ledger = auditBuckets(palette);
    expect(ledger.balanced).toBe(true);
    expect(ledger.placed).toBe(ledger.total);
    // Κάθε κάδος έχει γραπτή περιγραφή — «κενή αιτιολογία» είναι σιωπηλή απόρριψη.
    for (const key of Object.keys(ledger.counts)) {
      expect(typeof ledger.descriptions[key]).toBe('string');
      expect(ledger.descriptions[key].length).toBeGreaterThan(10);
    }
  });

  test('Κ2 — ο ρόλος βγαίνει από το ΜΟΝΟΠΑΤΙ, όχι από το πρόθεμα utility', () => {
    // Ίδιο πρόθεμα `text-`, ίδια τιμή· το ένα μονοπάτι ισχυρίζεται ρόλο, το άλλο όχι.
    const semantic = run(`export const t = { text: { primary: "text-slate-900" } } as const;`);
    const categorical = run(`export const t = { fileTypes: { pdf: "text-slate-900" } } as const;`);
    expect(bucketOf(semantic, 'judged-mono')).toBe(1);
    expect(bucketOf(categorical, 'judged-mono')).toBe(0);
    expect(bucketOf(categorical, 'role-out-of-scope')).toBe(1);
  });

  test('Κ2β — πληθυντικός/camelCase ΟΝΤΩΣ ονομάζει ρόλο: `fileIcons` κρίνεται', () => {
    // Το μάθημα των «13 από τις 79» (ADR-770 Στρ. 2): ένας ταξινομητής που λέει
    // `unknown` σε ολοφάνερο ρόλο δεν είναι συντηρητικός — είναι σιωπηλή απόρριψη.
    // Άρα ο συγγραφέας που γράφει `fileIcons` ΔΗΛΩΝΕΙ εικονίδια, και κρίνονται στα 3:1.
    const r = run(`export const t = { fileIcons: { pdf: "text-slate-900" } } as const;`);
    expect(bucketOf(r, 'judged-mono')).toBe(1);
    expect(statesOf(r, 'theme-flip')[0].detail).toMatch(/WCAG 1\.4\.11/);
  });

  test('Κ3 — ΚΑΜΙΑ δική μας χαρτογράφηση: η τιμή έρχεται από το πακέτο tailwindcss', () => {
    const twColors = require('tailwindcss/colors');
    const { colors } = loadTailwindColors(REPO_ROOT);
    for (const shade of ['50', '400', '600', '900', '950']) {
      expect(lookupColor(colors, `slate-${shade}`).value).toBe(twColors.slate[shade]);
    }
    // Και δεν υπάρχει σκληροκωδικοποιημένος πίνακας παλέτας στον ΚΩΔΙΚΑ μας.
    // ⚠️ Τα σχόλια αφαιρούνται πρώτα: η τεκμηρίωση ΟΦΕΙΛΕΙ να δείχνει το παράδειγμα
    // `slate-900 → #0f172a`· ένα test που το απαγορεύει τιμωρεί τη σαφήνεια.
    const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const f of ['tailwind-class-resolver.js', 'tailwind-classes.js', 'tailwind-class-palette.js']) {
      const code = stripComments(fs.readFileSync(path.join(__dirname, '..', 'lib', 'contrast', f), 'utf8'));
      expect(code).not.toMatch(/#[0-9a-f]{6}\b/i);
    }
  });

  test('Κ4 — τα σημασιολογικά ονόματα του ΕΡΓΟΥ λύνονται σε token, όχι σε hex', () => {
    const { colors } = loadTailwindColors(REPO_ROOT);
    for (const cls of ['bg-card', 'text-foreground', 'text-muted-foreground', 'border-border', 'ring-ring']) {
      const r = resolveClassToken(cls, colors);
      expect(r.form).toBe('css-var');
      expect(r.varName).toMatch(/^--/);
    }
  });

  test('Κ5 — η αναζήτηση είναι ΑΝΑΔΡΟΜΙΚΗ: `performance-success-bg` = τρία επίπεδα', () => {
    const { colors } = loadTailwindColors(REPO_ROOT);
    // Η δύο-επιπέδων εκδοχή γύριζε `not-a-color` για κλάση που ΥΠΑΡΧΕΙ.
    expect(resolveClassToken('bg-performance-success-bg', colors).varName).toBe('--performance-success-bg');
    expect(resolveClassToken('bg-bg-enterprise-success', colors).varName).toBe('--bg-success');
    expect(resolveClassToken('text-sidebar-primary-foreground', colors).varName).toBe('--sidebar-primary-foreground');
  });

  test('Κ6 — η γραμματική δέχεται παραλλαγές με αγκύλες χωρίς να τις κόβει', () => {
    expect(splitVariants('data-[state=checked]:bg-primary').utility).toBe('bg-primary');
    expect(splitVariants('supports-[display:grid]:bg-card').utility).toBe('bg-card');
    expect(parseColorUtility('dark:hover:bg-slate-800/30')).toMatchObject({ dark: true, util: 'bg', alpha: 0.3 });
    expect(parseColorUtility('border-l-red-500')).toMatchObject({ util: 'border', value: 'red-500' });
    // Ο τροποποιητής διαφάνειας ΔΕΝ αναζητείται μέσα στην αγκύλη.
    expect(splitOpacity('[rgb(0_0_0/0.5)]')).toEqual({ base: '[rgb(0_0_0/0.5)]', alpha: 1 });
  });

  test('Κ7 — ΔΗΛΩΜΕΝΟ ΚΕΝΟ: ωμή ΤΙΜΗ (όχι κλάση) δεν κρίνεται εδώ, αλλά ΜΕΤΡΙΕΤΑΙ', () => {
    const r = run(`export const t = { text: { primary: "#1e293b" } } as const;`);
    expect(bucketOf(r, 'literal-value-uncovered')).toBe(1);
    expect(bucketOf(r, 'judged-mono')).toBe(0);
    expect(r.palette.notAClassByFile[TOKENS_FILE]).toBe(1);
  });

  test('Κ8 — ΔΗΛΩΜΕΝΟ ΚΕΝΟ: διαβάθμιση δεν έχει ΜΙΑ ετυμηγορία', () => {
    const r = run(`export const t = { background: { hero: "bg-gradient-to-r from-slate-900 to-slate-100" } } as const;`);
    expect(bucketOf(r, 'gradient')).toBe(1);
    expect(r.findings).toHaveLength(0);
  });

  test('Κ9 — fail-closed: allowlist που δείχνει σε ανύπαρκτο αρχείο ⇒ ΣΦΑΛΜΑ, ποτέ «καθαρό»', () => {
    const registry = JSON.parse(JSON.stringify(MINI_REGISTRY));
    registry.modules['tailwind-hardcoded-palette'].allowlist.push('src/does/not/exist.ts');
    const root = miniRepo(`export const t = {} as const;`, { registry });
    expect(resolveScope(root).drift).toEqual(['src/does/not/exist.ts']);
  });

  test('Κ10 — fail-closed: χωρίς tailwind.config.ts η πύλη ΣΚΑΕΙ αντί να πει «0»', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tc42-noconf-'));
    expect(() => loadTailwindColors(root)).toThrow(/fail-closed/);
  });

  test('Κ11 — `transparent` είναι χρώμα ΧΩΡΙΣ δυνατή ετυμηγορία, όχι «δεν είναι χρώμα»', () => {
    const r = run(`export const t = { background: { none: "bg-transparent" } } as const;`);
    expect(bucketOf(r, 'keyword')).toBe(1);
    expect(bucketOf(r, 'not-a-class')).toBe(0);
  });

  test('Κ12 — δήλωση με ΔΥΟ utilities: δύο ταυτότητες ΚΑΙ δύο ρόλοι, όχι ένας', () => {
    const r = run(`export const t = { background: { chip: "bg-slate-900 text-slate-400" } } as const;`);
    expect(bucketOf(r, 'multi-color')).toBe(1);
    expect(r.palette.judged).toHaveLength(2);
    expect(new Set(r.palette.judged).size).toBe(2);
    // Το μονοπάτι λέει «surface». Χωρίς τον ρόλο ανά utility, το ΧΡΩΜΑ ΚΕΙΜΕΝΟΥ θα
    // κρινόταν ως επιφάνεια — λάθος ερώτηση, λάθος κατώφλι, λάθος απάντηση.
    const roles = r.palette.entries.map((e) => e.role).sort();
    expect(roles).toEqual(['foreground', 'surface']);
  });
});
