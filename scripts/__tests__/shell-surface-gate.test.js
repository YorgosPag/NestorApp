/**
 * ΑΓΚΥΡΕΣ CHECK 3.63 — ο διάδρομος του κελύφους (ADR-797)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ, ΚΑΙ ΤΙ ΟΧΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * **Κ** — το ΚΡΙΤΗΡΙΟ: τι θεωρείται «εξωτερικό κενό» και πού βρίσκεται η ρίζα.
 * **Μ** — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, όχι στην πύλη: αλλάζει **πραγματικό**
 *         αρχείο σε μίνι-repo και απαιτείται να κοκκινίσει. Ο μεταλλάκτης
 *         **ουρλιάζει** αν η μετάλλαξη δεν άλλαξε τίποτα — «RED» πάνω σε
 *         αμετάβλητη είσοδο αποδεικνύει σπασμένο test, όχι ζωντανό φρουρό
 *         (μάθημα CHECK 3.44 / Μ11 και 3.59).
 * **Λ** — η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ: κανένα αρχείο δεν χάνεται σιωπηλά.
 *
 * ⚠️ Αυτές οι άγκυρες **δεν** αποδεικνύουν ότι ο διάδρομος ζωγραφίζεται σωστά
 * στην οθόνη — αυτό μετρήθηκε ζωντανά (ADR-797 §4) και είναι **άλλο** ερώτημα.
 * Ένα test που ισχυρίζεται και τα δύο θα ήταν πράσινο για λάθος λόγο.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  OUTER_PADDING,
  NEGATIVE_MARGIN,
  stripComments,
  rootElementOf,
  classifyPage,
  collectPages,
} = require('../lib/shell-surface/scan');

const REPO = path.resolve(__dirname, '..', '..');
const GATE = path.join(REPO, 'scripts', 'check-shell-surface.js');
const OWNER = path.join(REPO, 'src', 'components', 'layout', 'MainContentBridge.tsx');
const SHELL_ROOT = path.join(REPO, 'src', 'app', '(app)');

/** Τρέχει την πύλη στο πραγματικό δέντρο. */
function runGate(args = []) {
  try {
    const out = execFileSync('node', [GATE, ...args], { cwd: REPO, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

/**
 * Μεταλλάσσει ένα ΠΡΑΓΜΑΤΙΚΟ αρχείο, τρέχει την πύλη, επαναφέρει.
 *
 * ⚠️ Αν το `replace` δεν άλλαξε τίποτα, αποτυγχάνει **ρητά**: μια μετάλλαξη που
 *    δεν μετάλλαξε δεν είναι δοκιμή.
 */
function withMutation(file, from, to, assertFn) {
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(from, to);
  expect(after).not.toBe(before); // ο μεταλλάκτης ουρλιάζει
  try {
    fs.writeFileSync(file, after);
    assertFn(runGate());
  } finally {
    fs.writeFileSync(file, before);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
describe('Μ0 — η βάση είναι πράσινη πριν και μετά', () => {
  it('η πύλη περνά στο αμετάβλητο δέντρο', () => {
    const r = runGate();
    expect(r.code).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Κ — το κριτήριο', () => {
  it('Κ1: το `p-6`/`px-4`/`pl-2` είναι εξωτερικό κενό', () => {
    expect(OUTER_PADDING.test('flex flex-col gap-6 p-6')).toBe(true);
    expect(OUTER_PADDING.test('mx-auto max-w-3xl px-4 py-8')).toBe(true);
    expect(OUTER_PADDING.test('pl-2 flex')).toBe(true);
  });

  it('Κ2: το `py-*` ΔΕΝ είναι — ο κάθετος ρυθμός δεν ανταγωνίζεται την μπάρα', () => {
    expect(OUTER_PADDING.test('flex flex-col py-8')).toBe(false);
  });

  it('Κ3: το `p-*` ΜΕΣΑ σε άλλη λέξη δεν πιάνεται (π.χ. `group-p-4` δεν υπάρχει)', () => {
    expect(OUTER_PADDING.test('snap-4')).toBe(false);
    expect(OUTER_PADDING.test('gap-4')).toBe(false);
    expect(OUTER_PADDING.test('top-4')).toBe(false);
  });

  it('Κ4: το αρνητικό περιθώριο είναι σιωπηλό opt-out', () => {
    expect(NEGATIVE_MARGIN.test('-mx-6 w-full')).toBe(true);
    expect(NEGATIVE_MARGIN.test('mx-6 w-full')).toBe(false);
  });

  it('Κ5: η ρίζα βρίσκεται και ΧΩΡΙΣ παρενθέσεις — το ιδίωμα που τύφλωνε το 67%', () => {
    const withParens = 'export default function P() {\n  return (\n    <main className="p-6">x</main>\n  );\n}';
    const without = 'export default function P() {\n  return <main className="p-6">x</main>;\n}';
    expect(rootElementOf(withParens).classAttr).toBe('p-6');
    expect(rootElementOf(without).classAttr).toBe('p-6');
  });

  it('Κ6: self-closing ρίζα διαβάζεται σωστά', () => {
    const src = 'export default function P() {\n  return <Content className="px-4" />;\n}';
    expect(rootElementOf(src).tag).toBe('Content');
    expect(rootElementOf(src).classAttr).toBe('px-4');
  });

  it('Κ7: το `p-6` ΜΕΣΑ ΣΕ ΣΧΟΛΙΟ δεν κρίνεται — αλλιώς η πύλη κοκκινίζει στη ΘΕΡΑΠΕΙΑ', () => {
    const src = '/* ADR-797: το p-6 έφυγε από εδώ */\nexport default function P() {\n  return <main className="flex">x</main>;\n}';
    expect(rootElementOf(stripComments(src)).classAttr).toBe('flex');
  });

  it('Κ8: το `//` μέσα σε URL δεν σβήνει γραμμή', () => {
    expect(stripComments('const u = "https://x.gr/a";').includes('https://x.gr/a')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Λ — κλειστή λογιστική', () => {
  it('Λ1: κάθε σελίδα του κελύφους παίρνει ΑΚΡΙΒΩΣ μία κατάσταση', () => {
    const pages = collectPages(SHELL_ROOT);
    const tally = {};
    for (const p of pages) {
      const v = classifyPage(p, REPO);
      expect(typeof v.state).toBe('string');
      tally[v.state] = (tally[v.state] || 0) + 1;
    }
    const sum = Object.values(tally).reduce((a, b) => a + b, 0);
    expect(sum).toBe(pages.length);
  });

  it('Λ2: το τυφλό σημείο μετριέται και μένει μικρό (<15% των σελίδων)', () => {
    // 🔴 Η ΠΡΩΤΗ ΓΡΑΦΗ ΕΔΙΝΕ 93/139 = 67%. Η πύλη θα γεννιόταν σχεδόν ανενεργή,
    //    με το «δεν βρήκα» να διαβάζεται «καθαρό». Αυτό το κατώφλι κλειδώνει ότι
    //    δεν θα ξανασυμβεί σιωπηλά.
    const pages = collectPages(SHELL_ROOT);
    const unresolved = pages.filter((p) => classifyPage(p, REPO).state === 'unresolved-root');
    expect(unresolved.length / pages.length).toBeLessThan(0.15);
  });

  it('Λ3: η αναφορά τυπώνει τον ιδιοκτήτη ΚΑΙ τους μπλοκάροντες κάδους', () => {
    const r = runGate(['--report']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('MainContentBridge');
    expect(r.out).toContain('data-shell-surface');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Μ — μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ', () => {
  it('Μ1: σελίδα που ξαναδηλώνει `p-6` ⇒ ΚΟΚΚΙΝΟ', () => {
    withMutation(
      path.join(REPO, 'src', 'components', 'mandate', 'MandateCatalogContent.tsx'),
      '<section className="flex w-full flex-col gap-6">',
      '<section className="flex w-full flex-col gap-6 p-6">',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('content-padding');
      },
    );
  });

  it('Μ2: ο ιδιοκτήτης χάνει τον δείκτη ⇒ ΚΟΚΚΙΝΟ (ο διάδρομος γίνεται σιωπηλά 0)', () => {
    withMutation(OWNER, /\n\s*data-shell-surface\n/, '\n', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('owner-lost-marker');
    });
  });

  it('Μ3: ο ιδιοκτήτης δηλώνει δικό του padding ⇒ ΚΟΚΚΙΝΟ (ο κριτής γίνεται διάδικος)', () => {
    withMutation(OWNER, 'flex-1 overflow-y-auto', 'px-6 flex-1 overflow-y-auto', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('owner-declares-padding');
    });
  });

  it('Μ4: νέο bleed χωρίς γραμμή στο μητρώο ⇒ ΚΟΚΚΙΝΟ (κλειστό σύνολο)', () => {
    withMutation(
      path.join(REPO, 'src', 'app', '(app)', 'o', '[workspace]', 'construction', 'portfolio', 'page.tsx'),
      '<main className="flex flex-col gap-6">',
      '<main data-shell-surface="bleed" className="flex flex-col gap-6">',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('bleed');
      },
    );
  });

  it('Μ5: δήλωση bleed χωρίς ουσιαστικό λόγο ⇒ ΚΟΚΚΙΝΟ (fail-closed στη μέτρηση)', () => {
    withMutation(
      path.join(REPO, '.shell-surface.json'),
      /"reason": "Επιφάνεια-καμβάς[^"]*"/,
      '"reason": "γιατί ναι"',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('αδύνατη η μέτρηση');
      },
    );
  });

  it('Μ6: ορφανή δήλωση στο μητρώο ⇒ ΚΟΚΚΙΝΟ (το μητρώο δεν σαπίζει σιωπηλά)', () => {
    withMutation(
      path.join(REPO, '.shell-surface.json'),
      '"fullBleed": {',
      '"fullBleed": {\n    "/o/[workspace]/anyparkti": { "reason": "διαδρομή που δεν υπάρχει καθόλου στο δέντρο" },',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('orphan-declaration');
      },
    );
  });

  it('Μ7: το `--write-baseline` ΑΡΝΕΙΤΑΙ να κλειδώσει zero-tolerance', () => {
    // Ένα zero-tol που κλειδώνεται με ένα flag δεν είναι zero-tol
    // (πρότυπο CHECK 3.44 / 3.50 / 3.58).
    const before = fs.readFileSync(OWNER, 'utf8');
    const after = before.replace('flex-1 overflow-y-auto', 'px-6 flex-1 overflow-y-auto');
    expect(after).not.toBe(before);
    try {
      fs.writeFileSync(OWNER, after);
      const r = runGate(['--write-baseline']);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('ΑΡΝΟΥΜΑΙ');
    } finally {
      fs.writeFileSync(OWNER, before);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Π — βαθμονόμηση σε πραγματικό ιστορικό', () => {
  const PINNED = '2aff5dcd'; // ⚠️ ΚΑΡΦΩΜΕΝΟ. ΠΟΤΕ HEAD: το HEAD μετακινείται και η άγκυρα αυτοακυρώνεται.

  function gitShow(ref, file) {
    const out = execFileSync('git', ['show', `${ref}:${file}`], { cwd: REPO, encoding: 'utf8' });
    if (!out || !out.trim()) throw new Error(`git show ${ref}:${file} → κενό`);
    return out;
  }

  it('Π1: ΠΡΙΝ τη θεραπεία, το `MandateCatalogContent` δήλωνε `p-6` — η πύλη το πιάνει', () => {
    const historic = gitShow(PINNED, 'src/components/mandate/MandateCatalogContent.tsx');
    const root = rootElementOf(stripComments(historic));
    expect(root).not.toBeNull();
    expect(OUTER_PADDING.test(root.classAttr)).toBe(true);
  });

  it('Π2: Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — η ΣΗΜΕΡΙΝΗ εκδοχή του ίδιου αρχείου ΠΕΡΝΑ', () => {
    // Χωρίς αυτό, το Π1 θα ήταν πράσινο ακόμα κι αν η πύλη κοκκίνιζε τα πάντα.
    const today = fs.readFileSync(
      path.join(REPO, 'src', 'components', 'mandate', 'MandateCatalogContent.tsx'), 'utf8');
    const root = rootElementOf(stripComments(today));
    expect(OUTER_PADDING.test(root.classAttr)).toBe(false);
  });

  it('Π3: ΠΡΙΝ τη θεραπεία, ο ιδιοκτήτης δεν είχε δείκτη — άρα ο διάδρομος ήταν 0', () => {
    const historic = gitShow(PINNED, 'src/components/layout/MainContentBridge.tsx');
    expect(historic).not.toContain('data-shell-surface');
    // …και κανένα padding: η αλυσίδα δήλωνε ΜΗΔΕΝ σε κάθε κρίκο.
    const open = historic.match(/<main\b([^>]*)>/);
    expect(open).not.toBeNull();
    expect(OUTER_PADDING.test(open[1])).toBe(false);
  });
});
