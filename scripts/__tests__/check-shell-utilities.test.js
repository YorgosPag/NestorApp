/**
 * CHECK 3.72 — ADR-809. Άγκυρες της πύλης των καθολικών δυνατοτήτων.
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, ΟΧΙ ΣΤΗΝ ΠΥΛΗ** (μάθημα CHECK 3.44):
 * χτίζεται μίνι-repo από **πραγματικά** αρχεία, κάθε μετάλλαξη αλλάζει **μία**
 * γραμμή, και το `mutate()` **ουρλιάζει** αν η μετάλλαξη δεν άλλαξε τίποτα
 * (μάθημα CHECK 3.50: μετάλλαξη που δεν αλλάζει συμπεριφορά δεν αποδεικνύει
 * τίποτα — και μια «RED» πάνω σε ήδη σπασμένο test αποδεικνύει σπασμένο test,
 * όχι ζωντανό φρουρό, μάθημα CHECK 3.59).
 *
 * ⚠️ **Το `Π2` αποδεικνύει τον ΠΑΡΟΝΟΜΑΣΤΗ**: ότι η πύλη, πάνω στο πραγματικό
 * δέντρο, όντως **κοιτάζει** 157 οθόνες. Χωρίς αυτό, ένα «0 παραβιάσεις» θα
 * μπορούσε να σημαίνει «δεν βρήκα καμία σελίδα».
 *
 * @jest-environment node
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GATE = require('../check-shell-utilities');

const REPO = path.resolve(__dirname, '..', '..');
const OWNER = 'src/core/containers/ShellUtilities.tsx';
const UNIVERSAL = [
  '@/components/header/language-switcher',
  '@/components/header/theme-toggle',
  '@/components/header/user-menu',
];

// ---------------------------------------------------------------------------
// Το μίνι-repo — το ελάχιστο δέντρο που εκφράζει ΚΑΘΕ ερώτηση, και τίποτα άλλο
// ---------------------------------------------------------------------------

const REASON = 'Αποδίδει μηδέν DOM επίτηδες· γυμνή επιφάνεια για golden images.';

function baseFiles() {
  return {
    'tsconfig.base.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }),
    '.shell-utilities.json': JSON.stringify({
      owner: OWNER,
      universalSymbols: UNIVERSAL,
      groupsWithoutUtilities: { '(bare)': { reason: REASON } },
      pagesWithoutUtilities: {},
    }, null, 2),

    'src/components/header/language-switcher.tsx': 'export const LanguageSwitcher = () => <i />;\n',
    'src/components/header/theme-toggle.tsx': 'export const ThemeToggle = () => <i />;\n',
    'src/components/header/user-menu.tsx': 'export const UserMenu = () => <i />;\n',

    [OWNER]:
      "import { LanguageSwitcher } from '@/components/header/language-switcher';\n" +
      "import { ThemeToggle } from '@/components/header/theme-toggle';\n" +
      "import { UserMenu } from '@/components/header/user-menu';\n" +
      'export const ShellUtilities = () => <div><LanguageSwitcher /><ThemeToggle /><UserMenu /></div>;\n',

    // ⚠️ ΕΝΑΣ BARREL, ΕΠΙΤΗΔΕΣ: αναπαράγει ακριβώς τη συνθήκη που έκανε την πρώτη
    // γραφή της πύλης να βγάλει 157/157 πράσινα. Χωρίς αυτόν, το `Κ7` θα ήταν
    // πράσινο σε κόσμο όπου το ελάττωμα δεν μπορεί να υπάρξει.
    'src/shell/index.ts':
      "export { ShellUtilities } from '@/core/containers/ShellUtilities';\n" +
      "export { Decoy } from '@/shell/decoy';\n",
    'src/shell/decoy.tsx': 'export const Decoy = () => <span />;\n',

    'src/components/public-site/PublicSiteHeader.tsx':
      "import { ShellUtilities } from '@/core/containers/ShellUtilities';\n" +
      'export const PublicSiteHeader = () => <header><ShellUtilities /></header>;\n',

    'src/app/layout.tsx':
      "import { Decoy } from '@/shell/index';\n" +
      'export default function Root({ children }) { return <html><Decoy />{children}</html>; }\n',

    'src/app/(light)/layout.tsx':
      "import { PublicSiteHeader } from '@/components/public-site/PublicSiteHeader';\n" +
      'export default function L({ children }) { return <div><PublicSiteHeader />{children}</div>; }\n',
    'src/app/(light)/search/page.tsx': 'export default function P() { return <main />; }\n',

    'src/app/(bare)/layout.tsx': 'export default function B({ children }) { return <>{children}</>; }\n',
    'src/app/(bare)/harness/page.tsx': 'export default function P() { return <main />; }\n',
  };
}

function writeAll(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

/**
 * @param {(files: Record<string,string>) => void} [mutate] αλλάζει ΤΙΣ ΕΙΣΟΔΟΥΣ
 */
function run(mutate) {
  const files = baseFiles();
  if (mutate) {
    const before = JSON.stringify(files);
    mutate(files);
    if (JSON.stringify(files) === before) {
      throw new Error('Η μετάλλαξη ΔΕΝ άλλαξε τίποτα — δεν αποδεικνύει τίποτα (CHECK 3.50).');
    }
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chk371-'));
  writeAll(root, files);
  return { root, result: GATE.analyse(root) };
}

const statesOf = (findings) => findings.map((f) => f.state);
const pageState = (r, file) => r.pages.find((p) => p.file === file)?.state;

// ---------------------------------------------------------------------------
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το μίνι-repo είναι ΚΑΘΑΡΟ πριν από κάθε μετάλλαξη
// ---------------------------------------------------------------------------

describe('Μ0 — το μίνι-repo είναι καθαρό (αλλιώς κάθε «RED» είναι ψεύτικο)', () => {
  test('Μ0α — μηδέν μπλοκάροντα ευρήματα', () => {
    const { result } = run();
    expect(GATE.blockingOf(result)).toEqual([]);
  });

  test('Μ0β — και οι δύο σελίδες ταξινομήθηκαν, καμία δεν χάθηκε', () => {
    const { result } = run();
    expect(result.pages).toHaveLength(2);
    expect(pageState(result, 'src/app/(light)/search/page.tsx')).toBe(GATE.PAGE_STATES.VIA_LAYOUT);
    expect(pageState(result, 'src/app/(bare)/harness/page.tsx')).toBe(GATE.PAGE_STATES.DECLARED);
  });

  test('Μ0γ — ο ιδιοκτήτης αναγνωρίζεται πλήρης', () => {
    const { result } = run();
    expect(result.owner.state).toBe(GATE.OWNER_STATES.OK);
    expect(result.owner.missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Κ1 — ΠΡΟΣΒΑΣΙΜΟΤΗΤΑ
// ---------------------------------------------------------------------------

describe('Κ1 — προσβασιμότητα των καθολικών δυνατοτήτων', () => {
  test('Μ1 — το κέλυφος παύει να αποδίδει τον ιδιοκτήτη ⇒ σιωπηλή οθόνη', () => {
    const { result } = run((f) => {
      f['src/components/public-site/PublicSiteHeader.tsx'] =
        'export const PublicSiteHeader = () => <header />;\n';
    });
    expect(pageState(result, 'src/app/(light)/search/page.tsx')).toBe(GATE.PAGE_STATES.SILENT);
    expect(GATE.blockingOf(result).length).toBeGreaterThan(0);
  });

  test('Μ2 — ο ιδιοκτήτης ΕΙΣΑΓΕΤΑΙ αλλά ΔΕΝ αποδίδεται ⇒ σιωπηλή', () => {
    // 🔑 Η καρδιά του κριτηρίου: «προσιτό» ≠ «ζωγραφίζεται». Η πρώτη γραφή της
    // πύλης ρωτούσε το πρώτο και ήταν ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΗ.
    const { result } = run((f) => {
      f['src/components/public-site/PublicSiteHeader.tsx'] =
        "import { ShellUtilities } from '@/core/containers/ShellUtilities';\n" +
        'export const PublicSiteHeader = () => <header>{String(ShellUtilities)}</header>;\n';
    });
    expect(pageState(result, 'src/app/(light)/search/page.tsx')).toBe(GATE.PAGE_STATES.SILENT);
  });

  test('Κ1β — σελίδα που αποδίδει η ΙΔΙΑ τον ιδιοκτήτη μετριέται via-page', () => {
    const { result } = run((f) => {
      f['src/app/(light)/layout.tsx'] = 'export default function L({ children }) { return <div>{children}</div>; }\n';
      f['src/app/(light)/search/page.tsx'] =
        "import { ShellUtilities } from '@/core/containers/ShellUtilities';\n" +
        'export default function P() { return <main><ShellUtilities /></main>; }\n';
    });
    expect(pageState(result, 'src/app/(light)/search/page.tsx')).toBe(GATE.PAGE_STATES.VIA_PAGE);
    expect(GATE.blockingOf(result)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Κ2 — ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ, ΚΑΙ ΠΡΟΣ ΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ
// ---------------------------------------------------------------------------

describe('Κ2 — το κλειστό σύνολο δηλώσεων', () => {
  test('Μ3 — σβησμένη δήλωση ⇒ η γειτονιά γίνεται σιωπηλή, δεν εξαφανίζεται', () => {
    const { result } = run((f) => {
      const cfg = JSON.parse(f['.shell-utilities.json']);
      cfg.groupsWithoutUtilities = {};
      f['.shell-utilities.json'] = JSON.stringify(cfg, null, 2);
    });
    expect(pageState(result, 'src/app/(bare)/harness/page.tsx')).toBe(GATE.PAGE_STATES.SILENT);
  });

  test('Μ4 — λόγος κάτω από το κατώφλι ⇒ reasonless', () => {
    const { result } = run((f) => {
      const cfg = JSON.parse(f['.shell-utilities.json']);
      cfg.groupsWithoutUtilities['(bare)'].reason = 'γιατί έτσι';
      f['.shell-utilities.json'] = JSON.stringify(cfg, null, 2);
    });
    expect(statesOf(result.declarations)).toContain(GATE.DECL_STATES.REASONLESS);
  });

  test('Μ5 — δήλωση για γειτονιά που δεν υπάρχει ⇒ orphan', () => {
    const { result } = run((f) => {
      const cfg = JSON.parse(f['.shell-utilities.json']);
      cfg.groupsWithoutUtilities['(ghost)'] = { reason: REASON };
      f['.shell-utilities.json'] = JSON.stringify(cfg, null, 2);
    });
    expect(statesOf(result.declarations)).toContain(GATE.DECL_STATES.ORPHAN);
  });

  test('Μ6 — δήλωση σιωπής για γειτονιά που ΟΝΤΩΣ φτάνει ⇒ contradicted', () => {
    // Δύο αλήθειες που διαφωνούν (ADR-749): χωρίς αυτόν τον κανόνα η δήλωση
    // σαπίζει σιωπηλά όταν η γειτονιά αποκτήσει κέλυφος.
    const { result } = run((f) => {
      const cfg = JSON.parse(f['.shell-utilities.json']);
      cfg.groupsWithoutUtilities['(light)'] = { reason: REASON };
      f['.shell-utilities.json'] = JSON.stringify(cfg, null, 2);
    });
    expect(statesOf(result.declarations)).toContain(GATE.DECL_STATES.CONTRADICTED);
  });
});

// ---------------------------------------------------------------------------
// Κ3 — ΙΔΙΟΚΤΗΣΙΑ (ο λόγος που ο Κ1 είναι άγκυρα)
// ---------------------------------------------------------------------------

describe('Κ3 — ιδιοκτησία των καθολικών συμβόλων', () => {
  test('Μ7 — τέταρτος συναρμολογητής ⇒ ⛔, ΕΝΩ ο Κ1 μένει πράσινος', () => {
    const { result } = run((f) => {
      f['src/components/public-site/PublicSiteHeader.tsx'] =
        "import { ShellUtilities } from '@/core/containers/ShellUtilities';\n" +
        "import { ThemeToggle } from '@/components/header/theme-toggle';\n" +
        'export const PublicSiteHeader = () => <header><ShellUtilities /><ThemeToggle /></header>;\n';
    });
    // 🔑 Ο Κ1 ΕΙΝΑΙ ΠΡΑΣΙΝΟΣ ΕΔΩ — αυτό ακριβώς αποδεικνύει γιατί χρειάζεται ο Κ3.
    expect(pageState(result, 'src/app/(light)/search/page.tsx')).toBe(GATE.PAGE_STATES.VIA_LAYOUT);
    expect(statesOf(result.symbols)).toContain(GATE.SYMBOL_STATES.OUTSIDE_OWNER);
    expect(GATE.blockingOf(result).length).toBeGreaterThan(0);
  });

  test('Μ8 — ο ιδιοκτήτης χάνει ένα από τα τρία ⇒ owner-incomplete', () => {
    const { result } = run((f) => {
      f[OWNER] =
        "import { LanguageSwitcher } from '@/components/header/language-switcher';\n" +
        "import { ThemeToggle } from '@/components/header/theme-toggle';\n" +
        'export const ShellUtilities = () => <div><LanguageSwitcher /><ThemeToggle /></div>;\n';
    });
    expect(result.owner.state).toBe(GATE.OWNER_STATES.INCOMPLETE);
    expect(result.owner.missing).toEqual(['@/components/header/user-menu']);
  });

  test('Μ9 — ο δηλωμένος ιδιοκτήτης δεν υπάρχει ⇒ owner-missing (fail-closed)', () => {
    const { result } = run((f) => {
      const cfg = JSON.parse(f['.shell-utilities.json']);
      cfg.owner = 'src/core/containers/Nowhere.tsx';
      f['.shell-utilities.json'] = JSON.stringify(cfg, null, 2);
    });
    expect(result.owner.state).toBe(GATE.OWNER_STATES.MISSING);
  });

  test('Κ3β — άγκυρα που εισάγει σύμβολο ΔΕΝ είναι συναρμολογητής', () => {
    const { result } = run((f) => {
      f['src/components/header/__tests__/theme.test.tsx'] =
        "import { ThemeToggle } from '@/components/header/theme-toggle';\n" +
        'test("x", () => expect(ThemeToggle).toBeDefined());\n';
    });
    expect(statesOf(result.symbols)).toContain(GATE.SYMBOL_STATES.TEST_SITE);
    expect(statesOf(result.symbols)).not.toContain(GATE.SYMBOL_STATES.OUTSIDE_OWNER);
  });
});

// ---------------------------------------------------------------------------
// Κ — ΔΟΜΙΚΑ ΣΥΜΒΟΛΑΙΑ
// ---------------------------------------------------------------------------

describe('Κ — συμβόλαια της πύλης', () => {
  test('Κ4 — ο BARREL δεν κάνει ψευδώς «προσιτό» τον ιδιοκτήτη', () => {
    // Το ριζικό layout του μίνι-repo εισάγει από barrel που επανεξάγει ΚΑΙ τον
    // ιδιοκτήτη. Αν η πύλη ρωτούσε «προσιτό;», η (bare) θα έβγαινε ✅ και η
    // δήλωσή της `contradicted` — δηλαδή ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΗ πύλη.
    const { result } = run();
    expect(pageState(result, 'src/app/(bare)/harness/page.tsx')).toBe(GATE.PAGE_STATES.DECLARED);
    expect(statesOf(result.declarations)).not.toContain(GATE.DECL_STATES.CONTRADICTED);
  });

  test('Κ5 — ο barrel λύνεται στο module που ΔΗΛΩΝΕΙ, όχι στον barrel', () => {
    const { result } = run((f) => {
      f['src/app/(light)/layout.tsx'] =
        "import { ShellUtilities } from '@/shell/index';\n" +
        'export default function L({ children }) { return <div><ShellUtilities />{children}</div>; }\n';
    });
    expect(pageState(result, 'src/app/(light)/search/page.tsx')).toBe(GATE.PAGE_STATES.VIA_LAYOUT);
  });

  test('Κ6 — η λογιστική κλείνει· άγνωστη κατάσταση ΡΙΧΝΕΙ με όνομα', () => {
    expect(() => GATE.tally([{ state: 'φάντασμα' }], GATE.PAGE_ORDER, 'σελίδων'))
      .toThrow(/άγνωστη κατάσταση «φάντασμα»/);
  });

  test('Κ7 — η σκανδάλη πιάνει τον ΙΔΙΟ τον κώδικα της πύλης', () => {
    // Αλλιώς αλλαγή στο κριτήριο περνά χωρίς να ασκηθεί ποτέ το κριτήριο
    // (μάθημα CHECK 3.43/3.57).
    expect(GATE.triggers(['scripts/check-shell-utilities.js'])).toBe(true);
    expect(GATE.triggers(['scripts/lib/shell-utilities/reach.js'])).toBe(true);
    expect(GATE.triggers(['.shell-utilities.json'])).toBe(true);
    expect(GATE.triggers(['src/core/containers/ShellUtilities.tsx'])).toBe(true);
    expect(GATE.triggers(['README.md'])).toBe(false);
  });

  test('Κ8 — λείπει το συμβόλαιο ⇒ ΡΙΧΝΕΙ, ποτέ «όλα καλά»', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chk371-empty-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    expect(() => GATE.analyse(root)).toThrow(/λείπει το \.shell-utilities\.json/);
  });
});

// ---------------------------------------------------------------------------
// Π — ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΔΕΝΤΡΟ
// ---------------------------------------------------------------------------

describe('Π — βαθμονόμηση στο πραγματικό δέντρο', () => {
  const real = GATE.analyse(REPO);

  test('Π1 — καμία σιωπηλή οθόνη σήμερα (zero-tol εφικτό, ΜΕΤΡΗΜΕΝΟ)', () => {
    expect(GATE.blockingOf(real)).toEqual([]);
  });

  test('Π2 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η πύλη όντως κοιτάζει ολόκληρο το δέντρο', () => {
    // Χωρίς αυτό, «0 παραβιάσεις» θα μπορούσε να σημαίνει «δεν βρήκα σελίδες».
    expect(real.pages.length).toBeGreaterThan(140);
    expect(real.ledgers.pages[GATE.PAGE_STATES.VIA_LAYOUT]).toBeGreaterThan(140);
    expect(real.ledgers.pages[GATE.PAGE_STATES.DECLARED]).toBeGreaterThan(0);
  });

  test('Π3 — ο ιδιοκτήτης είναι ΕΝΑΣ, και τα τρία σύμβολα είναι δικά του', () => {
    expect(real.owner.state).toBe(GATE.OWNER_STATES.OK);
    expect(real.ledgers.symbols[GATE.SYMBOL_STATES.OWNER_SITE]).toBe(1);
    expect(real.ledgers.symbols[GATE.SYMBOL_STATES.OUTSIDE_OWNER]).toBe(0);
  });

  test('Π4 — και οι τέσσερις γειτονιές με ανθρώπους φτάνουν από το LAYOUT', () => {
    // Το `(auth)` έμπαινε από τη ΣΕΛΙΔΑ και δύο οθόνες του δεν έμπαιναν καθόλου.
    for (const group of ['(app)', '(auth)', '(light)', '(me)']) {
      const pages = real.pages.filter((p) => p.file.startsWith(`src/app/${group}/`));
      expect(pages.length).toBeGreaterThan(0);
      expect(pages.every((p) => p.state === GATE.PAGE_STATES.VIA_LAYOUT)).toBe(true);
    }
  });
});
