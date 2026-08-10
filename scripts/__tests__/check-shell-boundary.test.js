/**
 * CHECK 3.52 — ADR-777 §8.12. Άγκυρες της πύλης του συνόρου κελύφους.
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, ΟΧΙ ΣΤΗΝ ΠΥΛΗ** (μάθημα CHECK 3.44):
 * χτίζεται μίνι-repo με **πραγματικό `git init`** — ο κανόνας Κ2 ρωτά το ευρετήριο
 * του git, οπότε προσομοίωση θα δοκίμαζε την πύλη σε κόσμο που δεν υπάρχει
 * (μάθημα CHECK 3.47). Κάθε μετάλλαξη αλλάζει **μία** γραμμή ή **ένα** μονοπάτι, και
 * το `mutate()` **ουρλιάζει** αν η μετάλλαξη δεν άλλαξε τίποτα (μάθημα CHECK 3.50:
 * μια μετάλλαξη που δεν αλλάζει συμπεριφορά δεν αποδεικνύει τίποτα).
 *
 * @jest-environment node
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GATE = require('../check-shell-boundary');
const TREE = require('../lib/shell-boundary/tree');

const REPO = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Το μίνι-repo
// ---------------------------------------------------------------------------

const HOOKS_MODULE = 'src/services/realtime/hooks/usePublicListings.ts';

/** Το ελάχιστο δέντρο που εκφράζει ΚΑΘΕ ερώτηση της πύλης — και τίποτα παραπάνω. */
function baseFiles() {
  return {
    'tsconfig.base.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }),
    '.shell-boundary.json': JSON.stringify({
      owner: 'src/app/(app)/layout.tsx',
      shellSymbols: ['@/components/app-sidebar', '@/components/app-header'],
      groups: {
        '(app)': { wearsShell: true, why: 'η εφαρμογή' },
        '(light)': { wearsShell: false, why: 'οι δημόσιες οθόνες' },
        '(bare)': { wearsShell: false, why: 'golden-image' },
      },
      publicDataHooks: [{ module: HOOKS_MODULE, names: ['usePublicListings', 'useListingLedger'] }],
    }, null, 2),

    'src/components/app-sidebar.tsx': 'export const AppSidebar = () => null;\n',
    'src/components/app-header.tsx': 'export const AppHeader = () => null;\n',
    [HOOKS_MODULE]:
      'export function usePublicListings() { return []; }\n' +
      'export function useListingLedger() { return {}; }\n' +
      'export function computeListingLedger() { return {}; }\n',

    'src/components/search/SearchLandingContent.tsx':
      "import { usePublicListings } from '@/services/realtime/hooks/usePublicListings';\n" +
      'export const SearchLandingContent = () => usePublicListings();\n',
    'src/components/internal/LedgerPanel.tsx':
      "import { computeListingLedger } from '@/services/realtime/hooks/usePublicListings';\n" +
      'export const LedgerPanel = () => computeListingLedger();\n',

    'src/app/layout.tsx': 'export default function Root({ children }) { return children; }\n',
    'src/app/(app)/layout.tsx':
      "import { AppSidebar } from '@/components/app-sidebar';\n" +
      "import { AppHeader } from '@/components/app-header';\n" +
      'export default function AppLayout({ children }) { return [AppSidebar, AppHeader, children]; }\n',
    'src/app/(app)/projects/page.tsx': 'export default function P() { return null; }\n',
    'src/app/(app)/ledger/page.tsx':
      "import { LedgerPanel } from '@/components/internal/LedgerPanel';\n" +
      'export default function P() { return LedgerPanel; }\n',

    'src/app/(light)/layout.tsx': 'export default function L({ children }) { return children; }\n',
    'src/app/(light)/search/page.tsx':
      "import { SearchLandingContent } from '@/components/search/SearchLandingContent';\n" +
      'export default function P() { return SearchLandingContent; }\n',

    'src/app/(bare)/layout.tsx': 'export default function B({ children }) { return children; }\n',
    'src/app/(bare)/harness/page.tsx': 'export default function P() { return null; }\n',
  };
}

function writeAll(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

function git(root, args) {
  execFileSync('git', args, { cwd: root, stdio: 'pipe' });
}

/**
 * @param {(files: Record<string,string>) => void} [mutate] αλλάζει ΤΙΣ ΕΙΣΟΔΟΥΣ
 * @returns {{root: string, result: object}}
 */
function miniRepo(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-boundary-'));
  const files = baseFiles();
  const before = JSON.stringify(files);
  if (mutate) mutate(files);
  if (mutate && JSON.stringify(files) === before) {
    throw new Error('Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ — δεν αποδεικνύει τίποτα.');
  }

  writeAll(root, files);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'gate@test']);
  git(root, ['config', 'user.name', 'gate']);
  git(root, ['add', '-A']);

  return { root, result: GATE.analyse(root) };
}

function statesOf(result) {
  return [
    ...result.pages.map(f => f.state),
    ...result.groups.map(f => f.state),
    ...result.symbols.map(f => f.state),
    result.owner.state,
  ];
}

function blockingStates(result) {
  return GATE.blockingOf(result).map(f => f.state);
}

// ---------------------------------------------------------------------------
// Μ0 — το μίνι-repo, ΑΜΕΤΑΛΛΑΚΤΟ, είναι ΠΡΑΣΙΝΟ
// ---------------------------------------------------------------------------

describe('Μ0 — η υγιής βάση περνά', () => {
  test('καμία μπλοκάρουσα κατάσταση', () => {
    const { result } = miniRepo();
    expect(blockingStates(result)).toEqual([]);
  });

  test('η λογιστική σελίδων κλείνει και ταξινομεί σωστά', () => {
    const { result } = miniRepo();
    expect(result.ledgers.pages[GATE.PAGE_STATES.SHELL_PAGE]).toBe(2);
    expect(result.ledgers.pages[GATE.PAGE_STATES.BARE_PAGE]).toBe(2);
    expect(result.pages).toHaveLength(4);
  });

  test('ο ιδιοκτήτης είναι εντάξει και είναι το ΜΟΝΟ σημείο εισαγωγής', () => {
    const { result } = miniRepo();
    expect(result.owner.state).toBe(GATE.OWNER_STATES.OK);
    expect(result.ledgers.symbols[GATE.SYMBOL_STATES.OUTSIDE_OWNER]).toBe(0);
    expect(result.ledgers.symbols[GATE.SYMBOL_STATES.OWNER_SITE]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Μ1-Μ8 — μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ
// ---------------------------------------------------------------------------

describe('μεταλλάξεις στις εισόδους', () => {
  /**
   * 🔴 Η ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΑΠΑΙΤΕΙ ΡΗΤΑ ΤΟ ADR-777 §8.12 ΒΗΜΑ 5:
   * «μετακίνησε μια δημόσια σελίδα μέσα στο (app) και η άγκυρα ΠΡΕΠΕΙ να κοκκινίσει».
   * Ο Κ1 από μόνος του θα έμενε ΠΡΑΣΙΝΟΣ εδώ — η δήλωση μετακινείται μαζί με το αρχείο.
   */
  test('Μ1 — δημόσια σελίδα μετακομίζει στο (app) ⇒ public-surface-wearing-shell', () => {
    const { result } = miniRepo(files => {
      files['src/app/(app)/search/page.tsx'] = files['src/app/(light)/search/page.tsx'];
      delete files['src/app/(light)/search/page.tsx'];
    });
    expect(blockingStates(result)).toContain(GATE.PAGE_STATES.PUBLIC_WEARING_SHELL);
  });

  test('Μ2 — σελίδα εκτός κάθε group ⇒ ungrouped-page', () => {
    const { result } = miniRepo(files => {
      files['src/app/search/page.tsx'] = files['src/app/(light)/search/page.tsx'];
      delete files['src/app/(light)/search/page.tsx'];
    });
    expect(blockingStates(result)).toContain(GATE.PAGE_STATES.UNGROUPED);
  });

  test('Μ3 — δεύτερο layout εισάγει το κέλυφος ⇒ shell-outside-owner', () => {
    const { result } = miniRepo(files => {
      files['src/app/(light)/layout.tsx'] =
        "import { AppSidebar } from '@/components/app-sidebar';\n" +
        'export default function L({ children }) { return [AppSidebar, children]; }\n';
    });
    expect(blockingStates(result)).toContain(GATE.SYMBOL_STATES.OUTSIDE_OWNER);
  });

  test('Μ4 — ο ιδιοκτήτης-layout διαγράφεται ⇒ owner-missing + shell-mismatch', () => {
    const { result } = miniRepo(files => { delete files['src/app/(app)/layout.tsx']; });
    expect(blockingStates(result)).toContain(GATE.OWNER_STATES.MISSING);
    expect(blockingStates(result)).toContain(GATE.PAGE_STATES.SHELL_MISMATCH);
  });

  test('Μ5 — νέο αδήλωτο route group ⇒ undeclared-group', () => {
    const { result } = miniRepo(files => {
      files['src/app/(marketing)/layout.tsx'] = 'export default function M({ children }) { return children; }\n';
      files['src/app/(marketing)/promo/page.tsx'] = 'export default function P() { return null; }\n';
    });
    expect(blockingStates(result)).toContain(GATE.GROUP_STATES.UNDECLARED);
  });

  test('Μ6 — δηλωμένο group που δεν υπάρχει στον δίσκο ⇒ orphan-declaration', () => {
    const { result } = miniRepo(files => {
      delete files['src/app/(bare)/layout.tsx'];
      delete files['src/app/(bare)/harness/page.tsx'];
    });
    expect(blockingStates(result)).toContain(GATE.GROUP_STATES.ORPHAN);
  });

  test('Μ7 — ο ιδιοκτήτης παύει να εισάγει το κέλυφος ⇒ owner-without-shell', () => {
    const { result } = miniRepo(files => {
      files['src/app/(app)/layout.tsx'] = 'export default function AppLayout({ children }) { return children; }\n';
    });
    expect(blockingStates(result)).toContain(GATE.OWNER_STATES.WITHOUT_SHELL);
  });

  test('Μ8 — δημόσια σελίδα μένει στη θέση της αλλά το group δηλώνεται wearsShell ⇒ κόκκινο', () => {
    const { result } = miniRepo(files => {
      const cfg = JSON.parse(files['.shell-boundary.json']);
      cfg.groups['(light)'].wearsShell = true;
      files['.shell-boundary.json'] = JSON.stringify(cfg, null, 2);
    });
    expect(blockingStates(result)).toContain(GATE.PAGE_STATES.PUBLIC_WEARING_SHELL);
  });
});

// ---------------------------------------------------------------------------
// Κ — άγκυρες κριτηρίου
// ---------------------------------------------------------------------------

describe('Κ — άγκυρες κριτηρίου', () => {
  /**
   * 🔴 Η ΜΕΤΡΗΜΕΝΗ ΔΙΑΚΡΙΣΗ (2026-08-10): το ίδιο module εξάγει και ΚΑΘΑΡΗ συνάρτηση.
   * Αν το κριτήριο ήταν «εισάγει από αυτό το module», το εσωτερικό /ledger θα γινόταν
   * ψευδώς θετικό — και η πύλη θα ζητούσε να μετακομίσει σε δημόσιο group.
   */
  test('Κ1 — καθαρή συνάρτηση του ΙΔΙΟΥ module ΔΕΝ κάνει τη σελίδα δημόσια', () => {
    const { result } = miniRepo();
    const ledgerPage = result.pages.find(p => p.file === 'src/app/(app)/ledger/page.tsx');
    expect(ledgerPage.state).toBe(GATE.PAGE_STATES.SHELL_PAGE);
  });

  test('Κ2 — εμφωλευμένο group δεν αλλάζει το group της ΡΙΖΑΣ', () => {
    expect(TREE.rootGroupOf('src/app/(app)/x/(inner)/page.tsx')).toBe('(app)');
    expect(TREE.rootGroupOf('src/app/page.tsx')).toBeNull();
  });

  /** Χωρίς το `/` στο `startsWith`, το `…/proj` θα «τύλιγε» το `…/projects`. */
  test('Κ3 — η αλυσίδα προγόνων κόβει σε ΟΡΙΟ ΦΑΚΕΛΟΥ, όχι σε πρόθεμα κειμένου', () => {
    const layouts = ['src/app/layout.tsx', 'src/app/(app)/proj/layout.tsx'];
    expect(TREE.ancestorLayoutsOf('src/app/(app)/projects/page.tsx', layouts))
      .toEqual(['src/app/layout.tsx']);
    expect(TREE.ancestorLayoutsOf('src/app/(app)/proj/deep/page.tsx', layouts))
      .toEqual(layouts);
  });

  test('Κ4 — άγνωστη κατάσταση στη λογιστική ⇒ throw ΜΕ ΟΝΟΜΑ', () => {
    expect(() => GATE.tally([{ state: 'φάντασμα' }], GATE.PAGE_ORDER, 'σελίδων'))
      .toThrow(/άγνωστη κατάσταση «φάντασμα»/);
  });

  test('Κ5 — η σκανδάλη πιάνει page/layout/config/την ίδια την πύλη, και τίποτα άλλο', () => {
    expect(GATE.triggers(['src/app/(app)/x/page.tsx'])).toBe(true);
    expect(GATE.triggers(['src/app/layout.tsx'])).toBe(true);
    expect(GATE.triggers(['.shell-boundary.json'])).toBe(true);
    expect(GATE.triggers(['scripts/lib/shell-boundary/tree.js'])).toBe(true);
    expect(GATE.triggers(['src/components/app-sidebar.tsx'])).toBe(false);
    expect(GATE.triggers(['README.md'])).toBe(false);
  });

  test('Κ6 — τα route handlers του api/ ΔΕΝ μπαίνουν στον πληθυσμό', () => {
    const { result } = miniRepo(files => {
      files['src/app/api/thing/route.ts'] = 'export function GET() { return null; }\n';
      files['src/app/api/thing/page.tsx'] = 'export default function P() { return null; }\n';
    });
    expect(result.pages.map(p => p.file)).not.toContain('src/app/api/thing/page.tsx');
  });
});

// ---------------------------------------------------------------------------
// Π — το ΠΡΑΓΜΑΤΙΚΟ repo (δεύτερη φωνή, χειρόγραφη)
// ---------------------------------------------------------------------------

describe('Π — το πραγματικό δέντρο', () => {
  test('Π1 — το σύνορο του repo είναι καθαρό μετά τη μετακόμιση ADR-777 §8.12', () => {
    const result = GATE.analyse(REPO);
    expect(GATE.blockingOf(result).map(f => `${f.file || f.group} [${f.state}]`)).toEqual([]);
  });

  test('Π2 — οι τρεις δημόσιες οθόνες ζουν σε group ΧΩΡΙΣ κέλυφος', () => {
    const result = GATE.analyse(REPO);
    const publicPages = [
      'src/app/(light)/search/page.tsx',
      'src/app/(light)/search/results/page.tsx',
      'src/app/(light)/listing/[id]/page.tsx',
    ];
    for (const file of publicPages) {
      const hit = result.pages.find(p => p.file === file);
      expect(hit).toBeDefined();
      expect(hit.state).toBe(GATE.PAGE_STATES.BARE_PAGE);
    }
  });

  test('Π3 — το golden-image harness είναι γυμνό (ADR-775 §13)', () => {
    const result = GATE.analyse(REPO);
    const hit = result.pages.find(p => p.file === 'src/app/(bare)/test-harness/dxf-canvas/page.tsx');
    expect(hit).toBeDefined();
    expect(hit.state).toBe(GATE.PAGE_STATES.BARE_PAGE);
  });

  test('Π4 — το /test-harness/dxf-perf ΚΡΑΤΑΕΙ το κέλυφος (ADR-726 §13.1)', () => {
    const result = GATE.analyse(REPO);
    const hit = result.pages.find(p => p.file === 'src/app/(app)/test-harness/dxf-perf/page.tsx');
    expect(hit).toBeDefined();
    expect(hit.state).toBe(GATE.PAGE_STATES.SHELL_PAGE);
  });
});
