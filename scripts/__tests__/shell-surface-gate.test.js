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
  HANDWRITTEN_MEASURE,
  CARD_ROOT,
  ROUNDED,
  stripComments,
  rootElementOf,
  exportedBody,
  exportedRootOf,
  localBody,
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

  // ⚠️ Το παλιό Μ2 μετάλλασσε το ΧΕΙΡΟΓΡΑΦΟ `data-shell-surface` του ιδιοκτήτη.
  //    Από τη ΦΑΣΗ Β ο ιδιοκτήτης **παραδίδει** στο ΕΝΑ primitive και δεν γράφει
  //    τίποτα μόνος του, οπότε ο στόχος δεν υπάρχει — και ο μεταλλάκτης
  //    **ούρλιαξε**, όπως όφειλε. Την ίδια βλάβη (ο διάδρομος γίνεται σιωπηλά 0)
  //    την καλύπτουν πλέον **δύο** άγκυρες, στα δύο σημεία όπου μπορεί να συμβεί:
  //    `Β-Μ1` (το primitive παύει να γράφει) και `Β-Μ2` (ο ιδιοκτήτης παύει να
  //    παραδίδει). Δύο θέσεις, δύο άγκυρες — όχι μία που κοιτά τη μισή αλλαγή.

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

  it('Π4: ΠΡΙΝ τη ΦΑΣΗ Β, οι τέσσερις σελίδες του `(me)` έγραφαν την ΙΔΙΑ τιμή τέσσερις φορές', () => {
    // Η μέτρηση που γέννησε τη ΦΑΣΗ Β, σε πραγματικό ιστορικό: όχι «κάποιες
    // σελίδες έχουν padding», αλλά **ταυτόσημη** χειρόγραφη γραμμή, τετραπλή.
    const files = [
      'src/components/demand/MyDemandsContent.tsx',
      'src/components/demand/DemandDetailContent.tsx',
      'src/components/owner-property/MyOwnerPropertiesContent.tsx',
      'src/components/owner-property/OwnerPropertyDetailContent.tsx',
    ];
    const roots = files.map((f) => rootElementOf(stripComments(gitShow(PINNED, f))).classAttr);
    expect(new Set(roots).size).toBe(1);
    expect(roots[0]).toContain('max-w-3xl');
    expect(OUTER_PADDING.test(roots[0])).toBe(true);
  });

  it('Π5: Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — οι ΣΗΜΕΡΙΝΕΣ εκδοχές τους δεν γράφουν ούτε κενό ούτε πλάτος', () => {
    for (const f of [
      'src/components/demand/MyDemandsContent.tsx',
      'src/components/demand/DemandDetailContent.tsx',
      'src/components/owner-property/MyOwnerPropertiesContent.tsx',
      'src/components/owner-property/OwnerPropertyDetailContent.tsx',
    ]) {
      const root = exportedRootOf(stripComments(fs.readFileSync(path.join(REPO, f), 'utf8')));
      expect(OUTER_PADDING.test(root.classAttr)).toBe(false);
      expect(HANDWRITTEN_MEASURE.test(root.classAttr)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ΦΑΣΗ Β — Ο ΕΝΑΣ ΓΡΑΦΕΑΣ, ΟΙ ΓΕΙΤΟΝΙΕΣ, ΤΟ ΜΕΤΡΟ            (ADR-797 §Β)
// ═══════════════════════════════════════════════════════════════════════════

const PRIMITIVE = path.join(REPO, 'src', 'core', 'containers', 'ShellSurface.tsx');
const REGISTRY = path.join(REPO, '.shell-surface.json');

describe('Β-Κ — το κριτήριο της ΦΑΣΗΣ Β', () => {
  it('Β-Κ1: το χειρόγραφο `max-w-*` είναι ΔΕΥΤΕΡΟΣ άξονας, όχι κατάσταση', () => {
    // Μια σελίδα μπορεί να είναι ΚΑΘΑΡΗ ως προς το κενό ΚΑΙ να γράφει πλάτος.
    // Αν οι δύο ερωτήσεις μοιράζονταν μία κατάσταση, η μία θα έκρυβε την άλλη.
    expect(HANDWRITTEN_MEASURE.test('w-full flex flex-col gap-6')).toBe(false);
    expect(HANDWRITTEN_MEASURE.exec('mx-auto w-full max-w-5xl')[1]).toBe('max-w-5xl');
    expect(HANDWRITTEN_MEASURE.exec('flex max-w-[42rem] p-0')[1]).toBe('max-w-[42rem]');
    // ⚠️ ΔΕΝ πιάνει το `max-w-full` ως ταβάνι πρόζας; πιάνει — και σωστά:
    //    είναι κι αυτό χειρόγραφη απόφαση πλάτους. Το κριτήριο είναι «γράφτηκε
    //    αριθμός/λέξη με το χέρι», όχι «ποιος αριθμός».
    expect(HANDWRITTEN_MEASURE.test('w-full max-w-full')).toBe(true);
  });

  it('Β-Κ2: η ΚΑΡΤΑ δεν είναι κουτί διάταξης — το κενό της είναι spacing.component', () => {
    // Μετρημένο: 1 στις 15 μπλοκάρουσες ρίζες ήταν κάρτα (6,7%). Χωρίς αυτή τη
    // διάκριση η πύλη ζητούσε να σβηστεί το κενό ΜΕΣΑ σε κάρτα — δηλαδή να
    // κολλήσει το κείμενο στο περίγραμμα.
    const card = 'mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border border-border bg-card p-6';
    expect(CARD_ROOT.test(card) && ROUNDED.test(card)).toBe(true);
    // …και ΚΑΝΕΝΑ από τα κουτιά διάταξης δεν περνά για κάρτα:
    for (const box of ['container mx-auto space-y-4 p-4 sm:p-6',
                       'mx-auto max-w-3xl p-6 space-y-10',
                       'flex min-h-screen items-center justify-center bg-background px-4',
                       'mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8']) {
      expect(CARD_ROOT.test(box) && ROUNDED.test(box)).toBe(false);
    }
  });

  it('Β-Κ3: η ρίζα βρίσκεται ΚΑΤΑ ΕΞΑΓΩΓΗ, με ένα άλμα εντός αρχείου', () => {
    // 🔴 Το `ListingDetailContent` επιστρέφει `<ListingDetailBody/>`, και το
    //    ΤΕΛΕΥΤΑΙΟ `return` του αρχείου είναι μια ΚΑΡΤΑ (`ListingOffers`).
    //    Η ΦΑΣΗ Α έκρινε την κάρτα· αυτό είναι το ψευδώς θετικό που θεραπεύτηκε.
    const src = stripComments(
      fs.readFileSync(path.join(REPO, 'src', 'components', 'listing-detail', 'ListingDetailContent.tsx'), 'utf8'));
    expect(exportedBody(src).name).toBe('ListingDetailContent');
    expect(exportedRootOf(src).tag).toBe('main');
    // Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η παλιά διαδρομή έδινε ΑΛΛΟ στοιχείο — αλλιώς η άγκυρα
    // θα ήταν πράσινη ακόμη κι αν το άλμα δεν έκανε τίποτα.
    expect(rootElementOf(src).tag).toBe('section');
  });

  it('Β-Κ4: το όριο σώματος αντέχει πολυγραμμικό destructuring παραμέτρων', () => {
    // 🔴 Η πρώτη γραφή έψαχνε «`}` σε στήλη 0» και έπαιρνε το κλείσιμο της
    //    ΠΑΡΑΜΕΤΡΟΥ — σώμα 53 χαρακτήρων, καμία ρίζα, σιωπηλή πτώση πίσω.
    const src = stripComments(
      fs.readFileSync(path.join(REPO, 'src', 'components', 'listing-detail', 'ListingDetailContent.tsx'), 'utf8'));
    const body = localBody(src, 'ListingDetailBody');
    expect(body).not.toBeNull();
    expect(body.end - body.start).toBeGreaterThan(400);
  });

  it('Β-Κ5: το `bleed` αναγνωρίζεται από τα ΩΜΑ attributes, όχι μόνο από το tag', () => {
    // Ο χάρτης του `/search/results` το δηλώνει στο component περιεχομένου του,
    // πάνω σε `<main>`. Κριτήριο «μόνο tag» θα του έδινε διάδρομο πάνω στον καμβά.
    const v = classifyPage(path.join(REPO, 'src', 'app', '(light)', 'search', 'results', 'page.tsx'), REPO);
    expect(v.state).toBe('declared-bleed');
  });

  it('Β-Κ6: οι γειτονιές ΠΑΡΑΓΟΝΤΑΙ από τον δίσκο — καμία χειρόγραφη λίστα στην πύλη', () => {
    const gate = fs.readFileSync(GATE, 'utf8');
    expect(gate).toContain('readdirSync(APP_ROOT');
    // ⛔ Καμία κυριολεκτική ονομασία γειτονιάς ως δεδομένο ελέγχου.
    const code = gate.slice(gate.indexOf('function routeGroups'));
    expect(code).not.toMatch(/\['\(app\)'|"\(app\)"\s*,/);
  });
});

describe('Β-Λ — η κλειστή λογιστική', () => {
  it('Β-Λ1: το άθροισμα των καταστάσεων σελίδας ισούται με τις σελίδες', () => {
    const r = runGate(['--report']);
    expect(r.code).toBe(0);
    // ⚠️ ΜΟΝΟ το τμήμα ΜΕΤΑ το «Σελίδες:» — αλλιώς το άθροισμα μαζεύει και τους
    //    κάδους των ΓΕΙΤΟΝΙΩΝ, δηλαδή η άγκυρα θα έλεγχε δύο λογιστικές σαν μία
    //    και θα ήταν πράσινη μόνο κατά σύμπτωση.
    const section = r.out.slice(r.out.indexOf('Σελίδες:'));
    const pages = Number(/Σελίδες:\s*(\d+)/.exec(section)[1]);
    // 🪤 Η ΣΗΜΑΙΑ `u` ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΗ: τα 🔴 και 🔶 είναι **surrogate pairs**,
    //    και χωρίς `u` μια κλάση χαρακτήρων τα σπάει στα μισά τους. Το άθροισμα
    //    έβγαινε **131 αντί για 157** — δηλαδή η άγκυρα της κλειστής λογιστικής
    //    θα ήταν σιωπηλά τυφλή σε τρεις κάδους, ανάμεσά τους ΚΑΙ ΟΙ ΔΥΟ
    //    μπλοκάροντες.
    // ⚠️ ΟΙ ΑΞΟΝΕΣ ΔΕΝ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΕΙΣ ΣΕΛΙΔΑΣ, ΚΑΙ ΓΙ' ΑΥΤΟ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΟ
    //    ΑΘΡΟΙΣΜΑ. Το πλάτος (2ος) και το ύψος (4ος) ταξιδεύουν **δίπλα** στην
    //    κατάσταση: μια σελίδα μπορεί να τα έχει και τα δύο ΚΑΙ να είναι «clean»
    //    ως προς το κενό. Το φίλτρο δείχνει στην ίδια την ετικέτα του άξονα, όχι
    //    σε λίστα ονομάτων — ήταν λίστα, και έσπασε την ημέρα που προστέθηκε ο
    //    τέταρτος άξονας (άθροισμα 163 αντί για 157).
    const sum = [...section.matchAll(/^\s+[✅🔴🔶]\s+([a-z-]+)\s+(\d+)([^\n]*)/gmu)]
      .filter((m) => !/άξονας/.test(m[3]))
      .reduce((a, m) => a + Number(m[2]), 0);
    expect(sum).toBe(pages);
  });

  it('Β-Λ2: το άθροισμα των καταστάσεων γειτονιάς ισούται με τις γειτονιές', () => {
    const r = runGate(['--report']);
    const groups = Number(/Γειτονιές[^:]*:\s*(\d+)/.exec(r.out)[1]);
    const sum = [...r.out.matchAll(/^\s+[✅⛔]\s+(corridor-\S+|group-without-\S+)\s+(\d+)\s*$/gm)]
      .reduce((a, [, , n]) => a + Number(n), 0);
    expect(sum).toBe(groups);
  });

  it('Β-Λ3: οι κάδοι γειτονιάς τυπώνονται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ', () => {
    // Ένα «0» που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος»
    // (μάθημα CHECK 3.48 / Κ6).
    const r = runGate(['--report']);
    for (const state of ['group-without-corridor', 'group-without-layout',
                         'corridor-contradicts-declaration']) {
      expect(r.out).toContain(state);
    }
  });
});

describe('Β-Μ — μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ', () => {
  it('Β-Μ1: το primitive παύει να γράφει τον δείκτη ⇒ ΚΟΚΚΙΝΟ', () => {
    // Η χειρότερη δυνατή βλάβη: ο διάδρομος σβήνει σε ΟΛΕΣ τις γειτονιές
    // ταυτόχρονα, και τίποτα δεν σπάει ορατά.
    withMutation(PRIMITIVE, 'data-shell-surface=""', 'data-shell-x=""', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('primitive-lost-marker');
    });
  });

  it('Β-Μ2: ο ιδιοκτήτης παύει να παραδίδει στο primitive ⇒ ΚΟΚΚΙΝΟ', () => {
    // ⚠️ Ο στόχος φέρει την ΕΣΟΧΗ του: το `as="main"` εμφανίζεται **πρώτα** μέσα
    //    στο docblock που τεκμηριώνει την παράδοση. Σκέτη συμβολοσειρά θα
    //    μετάλλασσε το **σχόλιο** και η πύλη θα έμενε πράσινη — η μετάλλαξη θα
    //    «πετύχαινε» χωρίς να αγγίξει κώδικα (μάθημα CHECK 3.50 / Κ7β).
    withMutation(OWNER, '\n      as="main"', '\n      as="div"', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('owner-lost-marker');
    });
  });

  it('Β-Μ3: ο ιδιοκτήτης ξαναγράφει τον δείκτη με το χέρι ⇒ ΚΟΚΚΙΝΟ (δύο γραφείς)', () => {
    withMutation(OWNER, '      as="main"', '      as="main"\n      data-shell-surface=""', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('owner-writes-marker-by-hand');
    });
  });

  it('Β-Μ4: γειτονιά χάνει τον διάδρομό της ⇒ ΚΟΚΚΙΝΟ', () => {
    withMutation(
      path.join(REPO, 'src', 'app', '(light)', 'layout.tsx'),
      '<ShellSurface className="flex flex-1 flex-col">{children}</ShellSurface>',
      '<div className="flex flex-1 flex-col">{children}</div>',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('group-without-corridor');
      },
    );
  });

  it('Β-Μ5: το άλμα φτάνει — γειτονιά που δηλώνει διάδρομο ΜΕΣΩ component περνά', () => {
    // Ο ΠΑΡΟΝΟΜΑΣΤΗΣ του Β-Μ4: το `(me)` δεν γράφει `ShellSurface` στο layout
    // του· το βρίσκει ένα άλμα μακριά, στο `PrivateSpaceShell`. Χωρίς αυτή την
    // άγκυρα, ένα κριτήριο «μόνο στο layout» θα ήταν πράσινο στο Β-Μ4 και
    // λάθος εδώ.
    withMutation(
      path.join(REPO, 'src', 'components', 'private-space', 'PrivateSpaceShell.tsx'),
      '<ShellSurface measure="wide" className="flex-1">',
      '<div className="flex-1">',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('(me)');
      },
    );
  });

  it('Β-Μ6: δήλωση γειτονιάς που δεν υπάρχει στον δίσκο ⇒ ΚΟΚΚΙΝΟ', () => {
    withMutation(
      REGISTRY,
      '"groupsWithoutCorridor": {',
      '"groupsWithoutCorridor": {\n    "(anyparkti)": { "reason": "γειτονιά που δεν υπάρχει καθόλου στον δίσκο, για δοκιμή" },',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('orphan-group-declaration');
      },
    );
  });

  it('Β-Μ7: αντίφαση μητρώου/δίσκου ⇒ ΚΟΚΚΙΝΟ (δύο αλήθειες που διαφωνούν)', () => {
    // ⚠️ Ο ΣΤΟΧΟΣ ΟΝΟΜΑΖΕΙ ΡΗΤΑ ΤΟ ΚΑΤΑΣΤΙΧΟ ΤΟΥ ΔΙΑΔΡΟΜΟΥ. Σκέτο «"(bare)": {»
    //    έγινε ΔΙΦΟΡΟΥΜΕΝΟ μόλις το μητρώο απέκτησε δεύτερο κατάστιχο
    //    (groupsWithoutFrame, ΦΑΣΗ Γ): το replace χτυπούσε το ΠΡΩΤΟ, δηλαδή η
    //    άγκυρα δοκίμαζε **άλλον κανόνα από αυτόν που ονομάζει**.
    withMutation(REGISTRY, '"groupsWithoutCorridor": {\n    "(bare)": {', '"groupsWithoutCorridor": {\n    "(light)": { "reason": "δοκιμή αντίφασης — το layout ΔΙΝΕΙ διάδρομο" },\n    "(bare)": {', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('corridor-contradicts-declaration');
    });
  });

  it('Β-Μ8: σελίδα που ξαναγράφει χειρόγραφο `max-w-*` ⇒ ΚΟΚΚΙΝΟ', () => {
    withMutation(
      path.join(REPO, 'src', 'components', 'demand', 'MyDemandsContent.tsx'),
      '<main className="flex w-full flex-col gap-6">',
      '<main className="mx-auto flex w-full max-w-3xl flex-col gap-6">',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('page-measure');
      },
    );
  });

  it('Β-Μ9: δήλωση γειτονιάς χωρίς ουσιαστικό λόγο ⇒ ΚΟΚΚΙΝΟ', () => {
    withMutation(REGISTRY, /"reason": "ΓΥΜΝΗ ΕΠΙΦΑΝΕΙΑ[^"]*"/, '"reason": "επειδή"', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('αδύνατη η μέτρηση');
    });
  });
});

describe('Β-Τ — η κλίμακα του μέτρου δεν μπορεί να εκφράσει παραβίαση WCAG', () => {
  const TOKENS = path.join(REPO, 'design-tokens.json');
  const BUILD = path.join(REPO, 'scripts', 'build-design-tokens.js');

  function runBuild() {
    try {
      execFileSync('node', [BUILD], { cwd: REPO, encoding: 'utf8' });
      return { code: 0, out: '' };
    } catch (e) {
      return { code: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') };
    }
  }

  /**
   * Το advance του γλύφου «0» και τα px ανά ΠΡΑΓΜΑΤΙΚΟ χαρακτήρα — μετρημένα
   * ντετερμινιστικά από το `hmtx` της Roboto πάνω σε 458.272 χαρακτήρες locale
   * (ADR-797 §Β.11). ⚠️ Η ΔΕΣΜΕΥΤΙΚΗ ΓΛΩΣΣΑ ΕΙΝΑΙ ΤΑ ΑΓΓΛΙΚΑ: πλατύτεροι
   * χαρακτήρες ⇒ περισσότεροι σε ίδιο πλάτος.
   */
  const CH_PX = 8.984;
  const PX_PER_CHAR = { el: 7.895, en: 7.088 };
  const charsOf = (ch, lang) => (ch * CH_PX) / PX_PER_CHAR[lang];

  it('Β-Τ1: οι ρόλοι υπάρχουν και είναι ΑΡΙΘΜΟΣ ch, όχι pixel', () => {
    // 🔴 ΔΙΟΡΘΩΘΗΚΕ 2026-08-26 (ADR-816): εδώ έγραφε `toBe(65)` και `toBe(80)` —
    //    **καρφωμένες τιμές**. Μια εντολή να αλλάξει το `prose` σε μετρημένη
    //    τιμή έκανε την άγκυρα κόκκινη, δηλαδή ο φρουρός μπλόκαρε τη
    //    **ΘΕΡΑΠΕΙΑ** αντί για τη βλάβη. Είναι ακριβώς η προειδοποίηση που το
    //    ίδιο το ADR-797 §Γ γράφει για το CHECK 3.50: «ΜΗΝ κάνεις tests που
    //    καρφώνουν τιμές». Ελέγχεται πλέον η **ΙΔΙΟΤΗΤΑ**.
    const t = JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
    const m = t.spacing.layout.measure;
    for (const [role, node] of Object.entries(m)) {
      if (role.startsWith('_')) continue;
      const n = Number(node.value);
      expect(`${role}=${Number.isFinite(n)}`).toBe(`${role}=true`);
      expect(String(node.value)).not.toMatch(/px|rem|ch/);
      // `type: other` ⇒ ο γεννήτορας ΔΕΝ κολλά `px`. Η μονάδα είναι δουλειά του CSS.
      expect(`${role}.type=${node.type}`).toBe(`${role}.type=other`);
    }
    expect(Object.keys(m).filter((k) => !k.startsWith('_')).sort()).toEqual(['prose', 'wide']);
  });

  it('Β-Τ1β: το `prose` κρατά ΚΑΙ ΤΙΣ ΔΥΟ γλώσσες εντός 45-75 χαρακτήρων', () => {
    // 🔑 Η άγκυρα που ΑΝΤΙΚΑΘΙΣΤΑ την καρφωμένη τιμή, και είναι αυστηρότερη:
    //    δεν λέει «να είναι 59», λέει «να ικανοποιεί τον λόγο για τον οποίο
    //    επιλέχθηκε». Το εύρος 45-75 είναι του Bringhurst· το ταβάνι 80 του
    //    σκέλους 2 του WCAG 1.4.8 προκύπτει **δωρεάν** από αυτό.
    //    ⚠️ Με 65ch τα αγγλικά έβγαιναν **82,4** — εκτός. Με 59ch: 74,8.
    const t = JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
    const prose = Number(t.spacing.layout.measure.prose.value);
    for (const lang of ['el', 'en']) {
      const chars = charsOf(prose, lang);
      expect(`${lang}:${chars <= 75}`).toBe(`${lang}:true`);
      expect(`${lang}:${chars >= 45}`).toBe(`${lang}:true`);
    }
  });

  // ⚠️ ΤΟ ΟΝΟΜΑ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ ΔΙΟΡΘΩΘΗΚΕ 2026-08-25 (ADR-797 §Β.11): έλεγε
  //    «80 χαρακτήρες / WCAG 1.4.8» και **ΚΑΝΕΝΑ ΑΠΟ ΤΑ ΔΥΟ ΔΕΝ ΙΣΧΥΕΙ**. Το `ch`
  //    δεν είναι χαρακτήρας (80ch = 91 el / 101 en, μετρημένο), και το 1.4.8 είναι
  //    AAA και ζητά ΜΗΧΑΝΙΣΜΟ επιλογής, όχι προεπιλεγμένο πλάτος. Ο φρουρός
  //    ΠΑΡΑΜΕΝΕΙ — φυλά **σύμβαση σχεδίασης**, και αυτό είναι που ελέγχεται εδώ.
  it('Β-Τ2: ρόλος πάνω από 80ch ⇒ το BUILD ΣΚΑΕΙ (σύμβαση μέτρου, ADR-797 §Β.11)', () => {
    const before = fs.readFileSync(TOKENS, 'utf8');
    // Αγκυρωμένη στον ΡΟΛΟ, όχι στην εσοχή: μια αλλαγή μορφοποίησης δεν
    // επιτρέπεται να αφοπλίσει σιωπηλά την άγκυρα.
    const after = before.replace(/("wide":\s*\{\s*"value":\s*")80(")/, '$181$2');
    expect(after).not.toBe(before); // ο μεταλλάκτης ουρλιάζει
    try {
      fs.writeFileSync(TOKENS, after);
      const r = runBuild();
      expect(r.code).not.toBe(0);
      // Το μήνυμα οφείλει να ΟΝΟΜΑΖΕΙ τρία πράγματα, αλλιώς ο επόμενος που θα το
      // δει δεν ξέρει τι έσπασε ούτε πού να κοιτάξει:
      expect(r.out).toContain('measure.wide'); //  ποιος ρόλος
      expect(r.out).toContain('81ch');         //  ποια τιμή απορρίφθηκε
      expect(r.out).toContain('§Β.11');        //  ποια αυθεντία το ορίζει
      // ⛔ ΚΑΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΕΠΙΚΑΛΕΙΤΑΙ ΤΟ WCAG 1.4.8: το ταβάνι είναι
      //    σύμβαση σχεδίασης· η επίκληση προτύπου που ΔΕΝ το ορίζει είναι
      //    ακριβώς το ψεύδος που το §Β.11 αναίρεσε σε 12 σημεία. Χωρίς αυτή τη
      //    γραμμή, ο επόμενος «διορθώνει» το μήνυμα πίσω στο 1.4.8 και η
      //    άγκυρα μένει πράσινη.
      expect(r.out).not.toContain('1.4.8');
    } finally {
      fs.writeFileSync(TOKENS, before);
      runBuild(); // επαναφορά των παραγόμενων
    }
  });

  it('Β-Τ3: Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — στο 80 το build ΠΕΡΝΑ', () => {
    // Χωρίς αυτό, το Β-Τ2 θα ήταν πράσινο ακόμη κι αν το build έσκαγε πάντα.
    expect(runBuild().code).toBe(0);
  });

  it('Β-Τ4: το CSS συνθέτει τη μονάδα από τον ρόλο — καμία τιμή δεν γράφεται δεύτερη φορά', () => {
    const raw = fs.readFileSync(path.join(REPO, 'src', 'app', 'shell-surface.css'), 'utf8');
    expect(raw).toContain('calc(var(--spacing-layout-measure-prose) * 1ch)');
    expect(raw).toContain('calc(var(--spacing-layout-measure-wide) * 1ch)');
    // ⛔ Κανένας ωμός αριθμός χαρακτήρων μέσα στους ΚΑΝΟΝΕΣ.
    // 🔴 ΤΟ `stripComments` ΕΔΩ ΔΕΝ ΕΙΝΑΙ ΚΑΛΛΩΠΙΣΜΟΣ: η πρώτη γραφή αυτής της
    //    άγκυρας ΚΟΚΚΙΝΙΣΕ πάνω στο **σχόλιο** που παραθέτει τον κανόνα του
    //    Ryan Mulligan (`--content: min(50ch, 100% - gap*2)`). Δηλαδή ο φρουρός
    //    πυροδότησε πάνω στην **τεκμηρίωση του προτύπου που επιβάλλει** — το
    //    ίδιο σχήμα με το Κ7β του CHECK 3.50, μέσα στο test που το κυνηγά.
    expect(stripComments(raw)).not.toMatch(/min\(\s*\d+ch/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ΦΑΣΗ Γ — Ο ΤΕΤΑΡΤΟΣ ΑΞΟΝΑΣ: ΤΟ ΥΨΟΣ ΤΟΥ ΚΑΔΡΟΥ                 (ADR-797 §Γ)
// ═══════════════════════════════════════════════════════════════════════════

const {
  VIEWPORT_HEIGHT,
  OUT_OF_FLOW: VP_OUT_OF_FLOW,
  viewportOf,
} = require('../lib/shell-surface/scan');

const CSS_FILE = path.join(REPO, 'src', 'app', 'shell-surface.css');
const LIGHT_LAYOUT = path.join(REPO, 'src', 'app', '(light)', 'layout.tsx');
const ME_LAYOUT = path.join(REPO, 'src', 'app', '(me)', 'layout.tsx');
const RESULTS_CONTENT = path.join(REPO, 'src', 'components', 'search-results', 'SearchResultsContent.tsx');
const SHELL_REGISTRY = path.join(REPO, '.shell-surface.json');
const CLEAN_APP_PAGE = path.join(REPO, 'src', 'app', '(app)', 'o', '[workspace]', 'crm', 'email-analytics', 'page.tsx');

describe('Γ-Κ — το κριτήριο του ύψους', () => {
  it('Γ-Κ1: πιάνει ΟΛΕΣ τις μορφές ύψους παραθύρου', () => {
    const forms = ['h-screen', 'min-h-screen', 'h-svh', 'min-h-svh', 'h-dvh', 'h-lvh',
      'h-[calc(100vh-4rem)]', 'min-h-[calc(100dvh-2rem)]'];
    for (const k of forms) {
      expect(VIEWPORT_HEIGHT.test('flex ' + k + ' items-center')).toBe(true);
    }
  });

  it('Γ-Κ2: ΔΕΝ πιάνει το `max-h-*` — ταβάνι, όχι ύψος', () => {
    // Ένα αιωρούμενο πάνελ που λέει «μη γίνεις ψηλότερο από το παράθυρο» δεν
    // διεκδικεί καμία αυθεντία διάταξης. Μετρημένο: 4 τέτοιες, όλες νόμιμες.
    expect(VIEWPORT_HEIGHT.test('overflow-y-auto max-h-screen')).toBe(false);
    expect(VIEWPORT_HEIGHT.test('max-h-[calc(100vh-6rem)] overflow-y-auto')).toBe(false);
  });

  it('Γ-Κ3: το εκτός ροής εξαιρείται — ένα modal μετράει ΝΟΜΙΜΑ το παράθυρο', () => {
    expect(VP_OUT_OF_FLOW.test('fixed inset-0 h-screen')).toBe(true);
    expect(VP_OUT_OF_FLOW.test('absolute inset-0 h-screen')).toBe(true);
    expect(VP_OUT_OF_FLOW.test('flex h-screen flex-col')).toBe(false);
    const root = { classAttr: 'fixed inset-0 h-screen', attrs: '', tag: 'div' };
    expect(viewportOf(root, 'x', '').height).toBeNull();
  });

  it('Γ-Κ4: ύψος ΜΕΣΑ ΣΕ ΣΧΟΛΙΟ δεν κρίνεται — αλλιώς κοκκινίζει η ΘΕΡΑΠΕΙΑ', () => {
    // Σχήμα Κ7β του CHECK 3.50: ο κώδικας εδώ τεκμηριώνει τη βλάβη με τη
    // λέξη-δείκτη μέσα σε σχόλιο· χωρίς stripComments ο φρουρός θα πυροδοτούσε
    // πάνω στο κείμενο που εξηγεί γιατί υπάρχει.
    const src = '/* ADR-797: το min-h-screen έφυγε από εδώ */\n'
      + 'export default function P() {\n  return <main className="flex flex-1">x</main>;\n}';
    const tmp = path.join(os.tmpdir(), 'vp-comment-' + Date.now() + '.tsx');
    fs.writeFileSync(tmp, src);
    try {
      expect(classifyPage(tmp, REPO).viewport.height).toBeNull();
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('Γ-Κ5: ο δείκτης διαβάζεται από τα ΩΜΑ attributes, όχι από κλάση', () => {
    const marked = { classAttr: 'flex', attrs: 'data-shell-viewport', tag: 'main' };
    expect(viewportOf(marked, 'x', 'data-shell-viewport').atRoot).toBe(true);
    const plain = { classAttr: 'flex', attrs: '', tag: 'main' };
    expect(viewportOf(plain, 'x', '').atRoot).toBe(false);
  });

  it('Γ-Κ6: η συγχώνευση είναι ΑΝΑ ΥΠΟ-ΕΡΩΤΗΜΑ — το ύψος της σελίδας δεν χάνεται', () => {
    // 🔴 ΑΥΤΗ Η ΑΓΚΥΡΑ ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΠΡΑΓΜΑΤΙΚΟ ΣΦΑΛΜΑ. Η πρώτη συγχώνευση
    //    έλεγε «κερδίζει όποιο ΔΗΛΩΝΕΙ» και έχανε σιωπηλά το ύψος κάθε σελίδας
    //    που είναι καθαρή ως προς το κενό: μετρημένο **1 στις 5** παραβιάσεις
    //    εξαφανιζόταν. Το έπιασε ΔΕΥΤΕΡΗ, ανεξάρτητη μέτρηση — όχι η ανάγνωση.
    const page = path.join(REPO, 'src', 'app', '(app)', 'test-harness', 'listing-shapes', 'page.tsx');
    const v = classifyPage(page, REPO);
    expect(v.viewport).not.toBeNull();
    expect(v.viewport.height).not.toBeNull();
    expect(v.viewport.height.klass).toMatch(/h-screen/);
  });
});

describe('Γ-Σ — το συμβόλαιο του CSS', () => {
  const css = () => stripComments(fs.readFileSync(CSS_FILE, 'utf8'));

  it('Γ-Σ1: `svh`, ΠΟΤΕ σκέτο `vh` — το `vh` ΕΙΝΑΙ το `lvh` (MDN)', () => {
    const rules = css();
    expect(rules).toContain('100svh');
    // Το lvh είναι ψηλότερο από το ορατό στο κινητό ⇒ γεννά κύλιση μόνο του.
    expect(rules).not.toMatch(/\b100vh\b/);
    // Και το dvh δεν ενημερώνεται στα 60fps (web.dev: «updating is throttled»).
    expect(rules).not.toMatch(/\b100dvh\b/);
  });

  it('Γ-Σ2: `overflow: clip`, ΠΟΤΕ `hidden` στο κάδρο', () => {
    // Το `hidden` δημιουργεί scroll container ⇒ γίνεται ο πρόγονος κύλισης για
    // κάθε `position: sticky` από κάτω — η #1 τεκμηριωμένη αιτία νεκρού sticky.
    const rules = css();
    const frameRule = rules.slice(rules.indexOf('[data-shell-frame]:has('));
    expect(frameRule).toContain('overflow: clip');
    expect(frameRule).not.toContain('overflow: hidden');
  });

  it('Γ-Σ3: ο επιλογέας είναι ΔΕΣΜΕΥΜΕΝΟΥ ΒΑΘΟΥΣ — οδηγία MDN για το :has()', () => {
    // «any DOM change within the entire subtree requires the browser to
    //  re-check the :has() condition» ⇒ αλυσίδα άμεσων παιδιών, όχι απόγονος.
    expect(css()).toContain(':has(> [data-shell-surface] > [data-shell-viewport])');
    expect(css()).not.toMatch(/\[data-shell-frame\]:has\(\s*\[data-shell-viewport\]/);
  });

  it('Γ-Σ4: καμία ιδιότητα που γεννά containing block για `position: fixed`', () => {
    // `container-type` · `contain: layout|content|strict` · `content-visibility`
    // κάνουν το κέλυφος containing block ⇒ κάθε modal/dropdown που δραπετεύει
    // θα αγκυρωνόταν πάνω του. Το Chrome άλλαξε στο 129· Firefox/Safari ΟΧΙ.
    const rules = css();
    expect(rules).not.toMatch(/container-type\s*:/);
    expect(rules).not.toMatch(/contain\s*:\s*(layout|content|strict)/);
    expect(rules).not.toMatch(/content-visibility\s*:\s*auto/);
  });
});

describe('Γ-Λ — η λογιστική του κάδρου', () => {
  it('Γ-Λ1: το άθροισμα των καταστάσεων κάδρου ισούται με τις γειτονιές', () => {
    const out = runGate(['--report']).out;
    const groups = Number(/Γειτονιές \(παραγμένες από τον δίσκο\): (\d+)/.exec(out)[1]);
    const states = ['frame-owned', 'frame-declared-manual', 'frame-without-owner',
      'frame-without-layout', 'frame-contradicts-declaration'];
    const sum = states.reduce((acc, st) => {
      const m = new RegExp(st + '\\s+(\\d+)').exec(out);
      return acc + (m ? Number(m[1]) : 0);
    }, 0);
    expect(sum).toBe(groups);
  });

  it('Γ-Λ2: οι κάδοι του ύψους τυπώνονται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ', () => {
    // Ένα «0» που δεν τυπώνεται διαβάζεται «δεν υπάρχει τέτοιος έλεγχος»
    // (μάθημα CHECK 3.48 / Κ6).
    const out = runGate(['--report']).out;
    expect(out).toContain('frame-without-owner');
    expect(out).toContain('frame-contradicts-declaration');
    expect(out).toContain('κλειδωμένες επιφάνειες');
  });
});

describe('Γ-Μ — μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ: οι πέντε κανόνες πυροδοτούν ΑΝΕΞΑΡΤΗΤΑ', () => {
  it('Γ-Μ1 (Υ1): γειτονιά χάνει το κάδρο της ⇒ ΚΟΚΚΙΝΟ', () => {
    withMutation(LIGHT_LAYOUT, 'data-shell-frame ', '', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('frame-without-owner');
    });
  });

  it('Γ-Μ2 (Υ1): το μητρώο λέει «χωρίς κάδρο» ενώ το layout φέρει κάδρο ⇒ ΚΟΚΚΙΝΟ', () => {
    // Δύο αλήθειες που διαφωνούν (ADR-749) — όχι «εντάξει επειδή το ένα περνά».
    withMutation(SHELL_REGISTRY,
      '"groupsWithoutFrame": {\n    "(app)"',
      '"groupsWithoutFrame": {\n    "(light)": { "reason": "ΜΕΤΑΛΛΑΞΗ ΤΗΣ ΑΓΚΥΡΑΣ Γ-Μ2 — δεν είναι αληθής δήλωση" },\n    "(app)"',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('frame-contradicts-declaration');
      });
  });

  it('Γ-Μ3 (Υ2): κλείδωμα χωρίς γραμμή στο μητρώο ⇒ ΚΟΚΚΙΝΟ', () => {
    withMutation(SHELL_REGISTRY, '"/search/results": {\n      "reason": "Χάρτης',
      '"/search/results-ΜΕΤΑΛΛΑΞΗ": {\n      "reason": "Χάρτης', (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('undeclared-viewport-lock');
      });
  });

  it('Γ-Μ4 (Υ2): δήλωση κλειδώματος ΧΩΡΙΣ αξίωση εξαίρεσης WCAG 1.4.10 ⇒ ΚΟΚΚΙΝΟ', () => {
    // Κλειδωμένη επιφάνεια δεν κυλά ⇒ στο 400% zoom ό,τι δεν χωρά ΧΑΝΕΤΑΙ. Η
    // εξαίρεση υπάρχει για επιφάνειες χειρισμού, όχι για κείμενο — και πρέπει
    // να είναι ΓΡΑΠΤΗ, ώστε να μπορεί να ελεγχθεί ξανά από άνθρωπο.
    withMutation(SHELL_REGISTRY, '"reflowException"', '"reflowExceptionΜΕΤΑΛΛΑΞΗ"', (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toMatch(/reflowException|WCAG/);
    });
  });

  it('Γ-Μ5 (Υ5): ο δείκτης φεύγει από τη ρίζα ⇒ ΚΟΚΚΙΝΟ (το κλείδωμα δεν συμβαίνει)', () => {
    // 🔑 Ο ΚΑΝΟΝΑΣ ΠΟΥ ΚΑΝΕΙΣ ΣΤΗ ΒΙΟΜΗΧΑΝΙΑ ΔΕΝ ΕΧΕΙ. dockview · golden-layout ·
    //    FlexLayout · rc-dock · Blueprint γράφουν την αντίστοιχη απαίτησή τους
    //    σε ΠΡΟΖΑ στο README και **καμία δεν την ελέγχει**· η αστοχία τους είναι
    //    σιωπηλή (μηδενικό ύψος — Blueprint#2777).
    withMutation(RESULTS_CONTENT,
      '      data-shell-viewport\n      className="flex min-h-0 flex-1 flex-col bg-background"\n    >',
      '      className="flex min-h-0 flex-1 flex-col bg-background"\n    >\n      <div data-shell-viewport />',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('viewport-marker-not-at-root');
      });
  });

  it('Γ-Μ6 (Υ3): μέτρο γραμμής ΚΑΙ κλείδωμα στον ίδιο διάδρομο ⇒ ΚΟΚΚΙΝΟ', () => {
    // Το `measure` κάνει τον διάδρομο `display: grid` με στήλη κειμένου· το
    // κλείδωμα ζητά από το ΙΔΙΟ στοιχείο να μοιράσει ύψος ως flex.
    withMutation(LIGHT_LAYOUT, '<ShellSurface className="flex flex-1 flex-col">',
      '<ShellSurface measure="wide" className="flex flex-1 flex-col">', (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('viewport-with-measure');
      });
  });

  it('Γ-Μ7 (Υ4): ΝΕΑ δεύτερη αυθεντία ύψους ⇒ ΚΟΚΚΙΝΟ', () => {
    // ⚠️ Ο ΣΤΟΧΟΣ ΔΙΑΛΕΧΤΗΚΕ ΜΕ ΜΕΤΡΗΣΗ, ΟΧΙ ΜΕ ΤΟ ΜΑΤΙ. Η πρώτη εκδοχή
    //    μετάλλασσε το (app)/o/[workspace]/buildings, του οποίου η ρίζα είναι
    //    <ProtectedRoute> **χωρίς className**: ο resolver δεν φτάνει ποτέ στο
    //    εσωτερικό <div>, οπότε η μετάλλαξη έμενε ΠΡΑΣΙΝΗ και θα «αποδείκνυε»
    //    ότι ο κανόνας δουλεύει ενώ δεν είχε κοιτάξει τίποτα. Μετρήθηκε ποιες
    //    καθαρές σελίδες του (app) έχουν ρίζα ΜΕΣΑ στο ίδιο τους το page.tsx:
    //    **μία**.
    withMutation(CLEAN_APP_PAGE, "'container mx-auto'", "'container mx-auto min-h-screen'", (r) => {
      expect(r.code).not.toBe(0);
      expect(r.out).toContain('nested-viewport-height');
    });
  });

  it('Γ-Μ8: ορφανή δήλωση κλειδώματος ⇒ ΚΟΚΚΙΝΟ (το μητρώο δεν σαπίζει σιωπηλά)', () => {
    withMutation(SHELL_REGISTRY, '"viewportLocked": {',
      '"viewportLocked": {\n    "/δεν-υπαρχει-ΜΕΤΑΛΛΑΞΗ": { "reason": "ΑΓΚΥΡΑ Γ-Μ8 — διαδρομή που δεν υπάρχει στον δίσκο", "reflowException": "ΑΓΚΥΡΑ Γ-Μ8 — αξίωση που δεν αντιστοιχεί σε τίποτα" },',
      (r) => {
        expect(r.code).not.toBe(0);
        expect(r.out).toContain('orphan-viewport-declaration');
      });
  });

  it('Γ-Μ9: το `--write-baseline` ΑΡΝΕΙΤΑΙ zero-tolerance του τέταρτου άξονα', () => {
    // Ένα zero-tolerance που κλειδώνεται με ένα `--write-baseline` δεν είναι
    // zero-tolerance (πρότυπο CHECK 3.44/3.58/3.60).
    const before = fs.readFileSync(LIGHT_LAYOUT, 'utf8');
    const after = before.replace('data-shell-frame ', '');
    expect(after).not.toBe(before);
    try {
      fs.writeFileSync(LIGHT_LAYOUT, after);
      const r = runGate(['--write-baseline']);
      expect(r.code).not.toBe(0);
      expect(r.out).toMatch(/ΑΡΝΟΥΜΑΙ|frame-without-owner/);
    } finally {
      fs.writeFileSync(LIGHT_LAYOUT, before);
    }
  });
});

describe('Γ-Π — βαθμονόμηση σε ΠΡΑΓΜΑΤΙΚΟ ιστορικό', () => {
  const GAMMA_PINNED = '2aff5dcd'; // ⚠️ ΚΑΡΦΩΜΕΝΟ. ΠΟΤΕ HEAD.

  function showAt(ref, file) {
    const out = execFileSync('git', ['show', ref + ':' + file], { cwd: REPO, encoding: 'utf8' });
    if (!out || !out.trim()) throw new Error('git show ' + ref + ':' + file + ' → κενό');
    return out;
  }

  it('Γ-Π1: ΠΡΙΝ τη θεραπεία, το `(light)` έγραφε ύψος με το χέρι και ΔΕΝ είχε κάδρο', () => {
    const historic = stripComments(showAt(GAMMA_PINNED, 'src/app/(light)/layout.tsx'));
    expect(historic).not.toContain('data-shell-frame');
    const root = exportedRootOf(historic);
    expect(VIEWPORT_HEIGHT.test(root.classAttr)).toBe(true);
    expect(root.classAttr).toContain('min-h-screen'); // ΕΛΑΧΙΣΤΟ, όχι ύψος
  });

  it('Γ-Π2: Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — η ΣΗΜΕΡΙΝΗ εκδοχή φέρει κάδρο και ΔΕΝ γράφει ύψος', () => {
    // Χωρίς αυτό, το Γ-Π1 θα ήταν πράσινο ακόμη κι αν η πύλη κατήγγελλε τα πάντα.
    const today = stripComments(fs.readFileSync(LIGHT_LAYOUT, 'utf8'));
    expect(today).toContain('data-shell-frame');
    expect(VIEWPORT_HEIGHT.test(exportedRootOf(today).classAttr)).toBe(false);
  });

  it('Γ-Π3: το δίδυμο `(me)` έλεγε ΤΟ ΙΔΙΟ ψέμα — και θεραπεύτηκε μαζί', () => {
    const historic = stripComments(showAt(GAMMA_PINNED, 'src/app/(me)/layout.tsx'));
    expect(VIEWPORT_HEIGHT.test(exportedRootOf(historic).classAttr)).toBe(true);
    const today = stripComments(fs.readFileSync(ME_LAYOUT, 'utf8'));
    expect(today).toContain('data-shell-frame');
    expect(VIEWPORT_HEIGHT.test(exportedRootOf(today).classAttr)).toBe(false);
  });
});
