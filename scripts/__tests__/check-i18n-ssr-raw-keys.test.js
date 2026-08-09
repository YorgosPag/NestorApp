/**
 * =============================================================================
 * CHECK 3.51 (ADR-781) — αυτοέλεγχος του στατικού μισού (Κ1 + Κ2)
 * =============================================================================
 *
 * ΓΙΑΤΙ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, ΟΧΙ ΣΤΗΝ ΠΥΛΗ
 * --------------------------------------------------------
 * Κάθε `Μ` παίρνει **πραγματικό** κώδικα και αλλάζει **μία** γραμμή — δηλαδή
 * κάνει ακριβώς ό,τι θα έκανε ένας άνθρωπος αύριο. Μετάλλαξη στον κώδικα της
 * πύλης θα απεδείκνυε μόνο ότι ο κώδικας εκτελείται· μετάλλαξη στην είσοδο
 * αποδεικνύει ότι η πύλη **απαντά το ερώτημα**.
 *
 * 🔑 Η ΒΑΘΜΟΝΟΜΗΣΗ ΕΙΝΑΙ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ, ΟΧΙ ΣΕ FIXTURE
 * -------------------------------------------------------------
 * Ο `useTranslationLazy.ts` **υπήρξε** και **έσπασε 141 διαδρομές**. Ζει στο
 * `8ecd4fec`. Ο Κ1 οφείλει να είναι **ΚΟΚΚΙΝΟΣ** πάνω του και **ΠΡΑΣΙΝΟΣ**
 * στη σημερινή θεραπεία. Χωρίς αυτό το ζεύγος η πύλη μπορεί να έχει γεννηθεί
 * μονίμως πράσινη και κανείς δεν θα το ήξερε.
 *
 * ⚠️ ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`: το working tree μοιράζεται με άλλον agent
 * και το `HEAD` μετακινείται — τα Π θα αυτοακυρώνονταν **σιωπηλά**.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const K1 = require('../lib/i18n-ssr/readiness-ast');
const K2 = require('../lib/i18n-ssr/answerability');
const LK = require('../lib/i18n/locale-keys');
const { loadConfig } = require('../lib/i18n-shell-slice/config');

const BS = String.fromCharCode(92);
const REPO_ROOT = path.join(__dirname, '..', '..');
const POSIX_ROOT = REPO_ROOT.split(BS).join('/');

/** Το commit ΠΡΙΝ τη διαγραφή του `useTranslationLazy.ts` (a21b5352 τον σβήνει). */
const PINNED = '8ecd4fec';

function gitShow(ref) {
  const out = execFileSync('git', ['show', ref], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  // Μια κενή απάντηση θα έκανε κάθε `expect` να περάσει κενή — το test θα ήταν
  // πράσινο επειδή δεν κοίταξε. Ίδιο σχήμα με ό,τι κυνηγά η ίδια η πύλη.
  if (out.trim() === '') throw new Error(`κενή απάντηση από \`git show ${ref}\``);
  return out;
}

const readLive = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/**
 * Μίνι-repo από **πραγματικά** αρχεία, με `edits` που ΠΡΕΠΕΙ να αλλάζουν κάτι.
 * Μια μετάλλαξη που δεν άλλαξε τίποτα είναι ο ορισμός του νεκρού test.
 */
function miniRepo(files, edits = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr351-'));
  for (const rel of files) {
    let source = readLive(rel);
    if (edits[rel]) {
      const next = edits[rel](source);
      if (next === source) throw new Error(`η μετάλλαξη στο ${rel} ΔΕΝ άλλαξε τίποτα.`);
      source = next;
    }
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source);
  }
  return root.split(BS).join('/');
}

// ---------------------------------------------------------------------------

const CONFIG = loadConfig(POSIX_ROOT);
const SLICE = JSON.parse(readLive('src/i18n/generated/shell-slice.el.json'));
const WHOLE = new Set(JSON.parse(readLive('src/i18n/generated/shell-slice.whole.json')));
const MANIFEST = JSON.parse(readLive('src/i18n/generated/shell-slice.manifest.json'));

const measureK2Live = () =>
  K2.measureAnswerability({
    projectRoot: POSIX_ROOT,
    config: CONFIG,
    slice: SLICE,
    closureFiles: Object.keys(MANIFEST.shellFiles),
  });

// ===========================================================================
// Μ0 — ο παρονομαστής. Το ζωντανό δέντρο, αμετάλλακτο.
// ===========================================================================

describe('Μ0 — το ζωντανό δέντρο είναι ΠΡΑΣΙΝΟ και στους δύο κανόνες', () => {
  test('Μ0.1 — Κ1: καμία επιφάνεια δεν παραδίδει `t` με ετοιμότητα-μόνο-σε-effect', () => {
    const result = K1.classifyFile('src/i18n/hooks/useTranslation.ts', readLive('src/i18n/hooks/useTranslation.ts'));
    expect(K1.K1_BLOCKING).not.toContain(result.state);
    expect(result.state).toBe(K1.K1_STATES.SYNCHRONOUS);
  });

  test('Μ0.2 — Κ2: μηδέν αναπάντητα σημεία κλήσης στην κλειστότητα των layouts', () => {
    const measured = measureK2Live();
    const census = K2.assertClosedK2(measured.records);
    expect(census[K2.K2_STATES.UNANSWERABLE]).toBe(0);
    expect(census[K2.K2_STATES.UNRESOLVED_NO_POLICY]).toBe(0);
    // Ο παρονομαστής: αν πέσει στο μηδέν, η πύλη δεν κοιτάζει τίποτα.
    expect(measured.callSites).toBeGreaterThan(500);
  });

  test('Μ0.3 — η λογιστική κλείνει και στους δύο κανόνες', () => {
    const measured = measureK2Live();
    const census = K2.assertClosedK2(measured.records);
    const total = Object.values(census).reduce((a, b) => a + b, 0);
    expect(total).toBe(measured.records.length);
  });
});

// ===========================================================================
// Μ1..Μ7 — μία μετάλλαξη ανά κατάσταση, ΣΤΙΣ ΕΙΣΟΔΟΥΣ
// ===========================================================================

describe('Κ1 — μεταλλάξεις στις εισόδους', () => {
  const LIVE = 'src/i18n/hooks/useTranslation.ts';

  test('Μ1 — σπόρος σταθερά + γραφή μόνο σε i18n effect ⇒ ⛔ effect-only', () => {
    const mutated = readLive(LIVE).replace(
      /useState\(\(\) => \{[\s\S]*?\n  \}\);/,
      'useState(false);'
    );
    expect(mutated).not.toBe(readLive(LIVE));
    const result = K1.classifyFile(LIVE, mutated);
    expect(result.state).toBe(K1.K1_STATES.EFFECT_ONLY);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  test('Μ2 — `useState(() => false)` είναι σταθερά με καπέλο, όχι σύγχρονος υπολογισμός', () => {
    const mutated = readLive(LIVE).replace(
      /useState\(\(\) => \{[\s\S]*?\n  \}\);/,
      'useState(() => false);'
    );
    expect(mutated).not.toBe(readLive(LIVE));
    expect(K1.classifyFile(LIVE, mutated).state).toBe(K1.K1_STATES.EFFECT_ONLY);
  });

  test('Μ3 — ρητή εξαίρεση με λόγο αφοπλίζει· ΧΩΡΙΣ λόγο ΔΕΝ αφοπλίζει', () => {
    const base = readLive(LIVE).replace(/useState\(\(\) => \{[\s\S]*?\n  \}\);/, 'useState(false);');
    const withReason = base.replace(
      /(\n\s*)(const \[namespaceLoaded)/,
      '$1// ssr-readiness-exempt: dokimi\n  $2'
    );
    const withoutReason = base.replace(
      /(\n\s*)(const \[namespaceLoaded)/,
      '$1// ssr-readiness-exempt:\n  $2'
    );
    expect(withReason).not.toBe(base);
    expect(withoutReason).not.toBe(base);
    expect(K1.classifyFile(LIVE, withReason).findings).toHaveLength(0);
    expect(K1.classifyFile(LIVE, withoutReason).state).toBe(K1.K1_STATES.EFFECT_ONLY);
  });

  test('Μ4 — αν το effect ΔΕΝ αγγίζει i18n, δεν είναι αυτή η βλάβη', () => {
    const source = [
      "import { useTranslation } from 'react-i18next';",
      'export function useThing() {',
      "  const { t } = useTranslation('x');",
      '  const [loadingCompanies, setLoadingCompanies] = useState(false);',
      '  useEffect(() => { fetchCompanies().then(() => setLoadingCompanies(false)); }, []);',
      '  return { t, loadingCompanies };',
      '}',
    ].join('\n');
    expect(K1.classifyFile('x.ts', source).state).toBe(K1.K1_STATES.UNRELATED);
  });

  test('Μ5 — γραφή ΚΑΙ εκτός effect ⇒ ο server μπορεί να τη δει ⇒ ✅ eager', () => {
    const source = [
      "import { useTranslation } from 'react-i18next';",
      'export function useThing() {',
      "  const { t, i18n } = useTranslation('x');",
      '  const [ready, setReady] = useState(false);',
      '  if (i18n.hasResourceBundle(i18n.language, "x")) setReady(true);',
      '  useEffect(() => { setReady(i18n.hasResourceBundle(i18n.language, "x")); }, [i18n]);',
      '  return { t, ready };',
      '}',
    ].join('\n');
    expect(K1.classifyFile('x.ts', source).state).toBe(K1.K1_STATES.EAGER);
  });

  test('Μ6 — module που ΔΕΝ παραδίδει `t` δεν κρίνεται καθόλου', () => {
    const source = [
      'export function useThing() {',
      '  const [ready, setReady] = useState(false);',
      '  useEffect(() => { setReady(i18n.hasResourceBundle()); }, []);',
      '  return { ready };',
      '}',
    ].join('\n');
    expect(K1.classifyFile('x.ts', source).state).toBe(K1.K1_STATES.NOT_A_SURFACE);
  });

  test('Μ7 — άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ (fail-closed)', () => {
    expect(() => K1.assertClosedK1([{ file: 'a.ts', state: 'φανταστική' }]))
      .toThrow(/άγνωστη κατάσταση "φανταστική"/);
  });
});

describe('Κ2 — μεταλλάξεις στις εισόδους', () => {
  /** Ένα πραγματικό shell module, μικρό αρκετά για μίνι-repo. */
  const SHELL_FILE = 'src/components/sidebar/sidebar-menu-item.tsx';

  const measureIn = (root, files) =>
    K2.measureAnswerability({
      projectRoot: root,
      config: { ...CONFIG, keyConstants: [], excludeConsumers: [] },
      slice: SLICE,
        closureFiles: files,
    });

  test('Μ8 — κλειδί που το slice ΔΕΝ απαντά ⇒ ⛔ unanswerable, ΑΚΟΜΑ ΚΑΙ σε `whole` ns', () => {
    // ⚠️ Το `sidebar-menu-item.tsx` δηλώνει `useTranslation('navigation')`, και
    // το `navigation` είναι ΕΝΑ ΑΠΟ ΤΑ 9 `whole`. Η πρώτη γραφή του Κ2 έλεγε
    // «whole ⇒ απαντά οτιδήποτε» και ήταν ΤΥΦΛΗ ακριβώς εδώ — ίδιο σχήμα με το
    // `if (want.whole) continue` που άφησε τη βλάβη των 17 κλειδιών να ζήσει.
    const root = miniRepo([SHELL_FILE], {
      [SHELL_FILE]: (source) => `${source}\nconst __probe = t("pages.__anyparkto__");\n`,
    });
    const bad = measureIn(root, [SHELL_FILE]).records.filter((record) => record.state === K2.K2_STATES.UNANSWERABLE);
    expect(bad.map((record) => record.key)).toContain('pages.__anyparkto__');
  });

  test('Μ9 — το ίδιο σχήμα με ΥΠΑΡΚΤΟ κλειδί ⇒ ✅ answerable (ο διαχωριστής δουλεύει)', () => {
    // ⚠️ Το ns-πρόθεμα ΔΕΝ είναι μέρος του κλειδιού: με `useTranslation('navigation')`
    // το i18next ψάχνει `pages.home` ΜΕΣΑ στο bundle `navigation`.
    const root = miniRepo([SHELL_FILE], {
      [SHELL_FILE]: (source) => `${source}\nconst __probe = t("pages.home");\n`,
    });
    const measured = measureIn(root, [SHELL_FILE]);
    expect(measured.records.filter((record) => record.state === K2.K2_STATES.UNANSWERABLE)).toHaveLength(0);
    expect(measured.records.filter((record) => record.state === K2.K2_STATES.ANSWERABLE).map((record) => record.key))
      .toContain('pages.home');
  });

  test('Μ10 — ανεπίλυτη δυναμική `t()` χωρίς policy ⇒ ⛔', () => {
    // ⚠️ ΟΧΙ το SHELL_FILE: εκείνο ΕΧΕΙ εγγραφή `dynamicKeyPolicy` και θα έδινε
    // `policy-covered` — δηλαδή το test θα περνούσε πράσινο για ΛΑΘΟΣ λόγο.
    const NO_POLICY = 'src/components/app-sidebar.tsx';
    const root = miniRepo([NO_POLICY], {
      [NO_POLICY]: (source) => `${source}\nconst __dyn = (k: string) => t(k);\n`,
    });
    const states = measureIn(root, [NO_POLICY]).records.map((record) => record.state);
    expect(states).toContain(K2.K2_STATES.UNRESOLVED_NO_POLICY);
  });

  test('Μ12 — κλειδί που ΔΕΝ είναι όρισμα του `t()` εδώ ⇒ 🔶 δηλωμένο κενό, ΟΧΙ παραβίαση', () => {
    // Το `plan.resolveFileKeys` λύνει και τιμές συγκομισμένες από ΑΛΛΑ modules.
    // Χωρίς αυτόν τον διαχωρισμό μετρήθηκαν **357** ψευδώς θετικά.
    const root = miniRepo([SHELL_FILE], {
      [SHELL_FILE]: (source) => `${source}\nconst MAP = { labelKey: "pages.__den_einai_klisi__" };\n`,
    });
    const measured = measureIn(root, [SHELL_FILE]);
    expect(measured.records.filter((record) => record.state === K2.K2_STATES.UNANSWERABLE)).toHaveLength(0);
  });

  test('Μ13 — αρχείο που ΔΕΝ δηλώνει ns (το `t` είναι παράμετρος) ⇒ 🔶 δηλωμένο κενό', () => {
    const HELPER = 'src/core/modals/photo-preview-helpers.ts';
    const root = miniRepo([HELPER]);
    const measured = measureIn(root, [HELPER]);
    expect(measured.records.filter((record) => record.state === K2.K2_STATES.UNANSWERABLE)).toHaveLength(0);
    expect(measured.records.map((record) => record.state)).toContain(K2.K2_STATES.NAMESPACE_INJECTED);
  });

  test('Μ11 — άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ (fail-closed)', () => {
    expect(() => K2.assertClosedK2([{ file: 'a.ts', state: 'φανταστική' }]))
      .toThrow(/άγνωστη κατάσταση "φανταστική"/);
  });
});

// ===========================================================================
// Π — άγκυρες σε ΠΡΑΓΜΑΤΙΚΟ ιστορικό, με ΚΑΡΦΩΜΕΝΟ commit
// ===========================================================================

describe('Π — η βαθμονόμηση σε πραγματικό ιστορικό', () => {
  test('Π1 — ο ΠΡΑΓΜΑΤΙΚΟΣ `useTranslationLazy` του 8ecd4fec είναι ⛔ ΚΟΚΚΙΝΟΣ', () => {
    const historic = gitShow(`${PINNED}:src/i18n/hooks/useTranslationLazy.ts`);
    // ΑΓΚΥΡΑ: αν το ιστορικό αρχείο δεν είναι αυτό που νομίζουμε, το test
    // πρέπει να σκάει, όχι να περνά με άλλο κώδικα.
    expect(historic).toContain('const [isNamespaceLoaded, setIsNamespaceLoaded] = useState(false);');
    expect(historic).toContain('isLoading: !isNamespaceLoaded');

    const result = K1.classifyFile('src/i18n/hooks/useTranslationLazy.ts', historic);
    expect(result.state).toBe(K1.K1_STATES.EFFECT_ONLY);
    expect(result.findings.map((finding) => finding.property).sort()).toEqual(['isLoading', 'ready']);
  });

  test('Π2 — η ΣΗΜΕΡΙΝΗ θεραπεία είναι ✅ ΠΡΑΣΙΝΗ (αλλιώς η πύλη είναι μονίμως κόκκινη στη σωστή λύση)', () => {
    const live = readLive('src/i18n/hooks/useTranslation.ts');
    expect(live).toContain('useState(() => {');
    expect(K1.classifyFile('src/i18n/hooks/useTranslation.ts', live).state).toBe(K1.K1_STATES.SYNCHRONOUS);
  });

  test('Π3 — ο ιστορικός καταναλωτής ΔΕΝ ενοχοποιείται: η αιτία ήταν σε ΕΝΑ αρχείο', () => {
    const consumer = gitShow(`${PINNED}:src/components/sidebar/sidebar-menu-item.tsx`);
    expect(consumer).toContain('if (isLoading) return title;');
    expect(K1.K1_BLOCKING).not.toContain(K1.classifyFile('sidebar-menu-item.tsx', consumer).state);
  });

  test('Π4 — το κλειδί που έβαφε ωμό ΥΠΗΡΧΕ ήδη στο slice (δεν έλειπαν δεδομένα)', () => {
    expect(LK.answersKey(SLICE.navigation, 'pages.home')).toBe(true);
    expect(typeof LK.lookupKey(SLICE.navigation, 'pages.home')).toBe('string');
  });
});

// ===========================================================================
// Κ — δηλωμένα όρια και μαθήματα που δεν επιτρέπεται να ξεχαστούν
// ===========================================================================

describe('Κ — δηλωμένα όρια', () => {
  test('Κ1 — ο per-route στατικός έλεγχος ΑΠΟΡΡΙΦΘΗΚΕ ΜΕ ΜΕΤΡΗΣΗ (99,88% FP)', () => {
    // Δεν υπάρχει κώδικας να ελεγχθεί — υπάρχει **απόφαση**, και πρέπει να
    // παραμείνει γραμμένη εκεί που θα τη διαβάσει ο επόμενος που θα μπει στον
    // πειρασμό. Η άγκυρα κλειδώνει ότι το σκεπτικό δεν σβήστηκε.
    const doc = readLive('scripts/lib/i18n-ssr/answerability.js');
    expect(doc).toContain('99,88%');
    expect(doc).toContain('3.224');
    expect(doc).toMatch(/ΡΙΖΕΣ ΕΙΝΑΙ ΤΑ LAYOUTS/);
  });

  test('Κ2 — ο ταξινομητής σπόρου ξεχωρίζει σταθερά από σύγχρονο υπολογισμό', () => {
    const cases = [
      ['useState(false)', 'constant'],
      ['useState(() => false)', 'constant'],
      ['useState({ a: 1, b: [2] })', 'constant'],
      ['useState(compute())', 'synchronous'],
      ['useState(() => list.every(fn))', 'synchronous'],
      ['useState(SOME_IMPORTED)', 'unanalyzable'],
    ];
    for (const [expression, expected] of cases) {
      const source = `const { t } = useTranslation(); const [a, setA] = ${expression}; return { t, a };`;
      const ts = require('typescript');
      const file = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let seed = null;
      const visit = (node) => {
        if (ts.isCallExpression(node) && node.expression.getText(file) === 'useState') {
          seed = K1.classifySeed(node.arguments[0], new Set());
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(file, visit);
      expect([expression, seed]).toEqual([expression, expected]);
    }
  });

  test('Κ3 — ένα κλειδί που δείχνει σε ΑΝΤΙΚΕΙΜΕΝΟ δεν απαντά (το i18next βάφει το κλειδί)', () => {
    expect(LK.answersKey({ a: { b: 'τιμή' } }, 'a')).toBe(false);
    expect(LK.answersKey({ a: { b: 'τιμή' } }, 'a.b')).toBe(true);
    expect(LK.answersKey({ a: ['ένα', 'δύο'] }, 'a')).toBe(true); // returnObjects
  });

  test('Κ4 — ΚΑΜΙΑ ειδική περίπτωση για `whole` ns: το lookup είναι ο ΜΟΝΟΣ κριτής', () => {
    // 🔴 ΑΓΚΥΡΑ ΠΑΛΙΝΔΡΟΜΗΣΗΣ. Η πρώτη γραφή του Κ2 έλεγε «whole ⇒ true χωρίς
    // lookup» και ήταν ΤΥΦΛΗ στα 9 namespaces όπου ζούσε η βλάβη — το ίδιο
    // ακριβώς σχήμα με το `if (want.whole) continue`. Αν κάποιος το ξαναγράψει,
    // αυτό το test σκάει.
    expect(WHOLE.has('navigation')).toBe(true);              // το ns ΕΙΝΑΙ whole
    expect(K2.sliceAnswers(SLICE, 'navigation', 'pages.home')).toBe(true);
    expect(K2.sliceAnswers(SLICE, 'navigation', 'pages.__den_yparxei__')).toBe(false);
    expect(K2.sliceAnswers(SLICE, '__agnwsto_ns__', 'ο,τιδήποτε')).toBe(false);
  });

  test('Κ5 — οι υποψήφιοι ns ακολουθούν τη σειρά του i18next, με defaultNS στο τέλος', () => {
    expect(K2.candidatesFor('files', ['a', 'b'])).toEqual(['files']);
    expect(K2.candidatesFor(null, ['a', 'b'])).toEqual(['a', 'b']);
    expect(K2.candidatesFor(null, [])).toEqual([K2.DEFAULT_NS]);
  });

  test('Κ6 — το flatten δεν μετρά ενδιάμεσους κόμβους (αλλιώς κάθε κλειδί «υπάρχει»)', () => {
    const keys = LK.flattenAnswerableKeys({ a: { b: { c: 'x' } }, d: 'y' });
    expect([...keys].sort()).toEqual(['a.b.c', 'd']);
  });

  test('Κ7 — χαλασμένο locale ΔΕΝ διαβάζεται ως άδειο (fail-closed)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lk351-'));
    fs.writeFileSync(path.join(root, 'broken.json'), '{ όχι json');
    const { index, unreadable } = LK.buildKeyIndex(root);
    expect(index.has('broken')).toBe(false);
    expect(unreadable).toHaveLength(1);
    expect(unreadable[0].reason).toMatch(/unparsable/);
  });

  test('Κ8 — δηλωμένο όριο: φρουρός πάνω σε PROP/CONTEXT δεν είναι ορατός στον Κ1', () => {
    const source = [
      "import { useTranslation } from 'react-i18next';",
      'export function Thing({ isLoading, title }: Props) {',
      "  const { t } = useTranslation('x');",
      '  if (isLoading) return title;',
      '  return <span>{t(title)}</span>;',
      '}',
    ].join('\n');
    // Ρητά ΟΧΙ εύρημα — και ο λόγος είναι ότι το αναλαμβάνει ο ΧΡΗΣΜΟΣ Χ.
    expect(K1.K1_BLOCKING).not.toContain(K1.classifyFile('x.tsx', source).state);
  });
});
