#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §18 — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΑΠΟΔΟΣΗΣ NAMESPACE
 * =============================================================================
 *
 * «Ποιανού είναι τα κλειδιά ενός αρχείου που **δεν δηλώνει** namespace;»
 *
 * Μέχρι 2026-08-22 η απάντηση ήταν **σιωπή**: το `addEntry` έπαιρνε `targets = []`
 * και το κλειδί εξαφανιζόταν χωρίς λέξη. Μετρημένο τότε, **πριν** γραφτεί γραμμή
 * θεραπείας: **3 αρχεία / 98 λυμένα κλειδιά** σε 16 κλειστότητες — εκ των οποίων
 * **13** εξηγούσαν ωμά κλειδιά που ο χρησμός (CHECK 3.51 Χ) είχε δει **ζωντανά** στο
 * `/login`, και **30** έλειπαν από το ΚΕΛΥΦΟΣ, δηλαδή από κάθε διαδρομή.
 *
 * ⚠️ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ **ΕΙΣΟΔΟΥΣ**, ΟΧΙ ΣΤΗΝ ΠΥΛΗ. Κάθε ομάδα στήνει
 * μίνι-repo με **αληθινό γράφο module** από πραγματικά σχήματα κώδικα και αλλάζει
 * **μία** γραμμή.
 *
 * ⚠️ ΤΟ `Κ1` ΕΙΝΑΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ. Χωρίς αυτό, το «με κληρονομιά τα κλειδιά
 * προσγειώνονται» θα μπορούσε να είναι πράσινο επειδή **δεν υπήρξε ποτέ βλάβη**.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const P = require('../lib/i18n-shell-slice/plan');
const { DEFAULTS } = require('../lib/i18n-shell-slice/config');

const REPO = path.resolve(__dirname, '../..');

/* =============================================================================
 * ΤΟ ΜΙΝΙ-REPO — πραγματικός γράφος module, όχι προσομοίωση
 * ========================================================================== */

const NL = '\n';

/**
 * ⚠️ ΠΡΑΓΜΑΤΙΚΗ ΕΙΣΑΓΩΓΗ, ΟΧΙ RE-EXPORT — ΜΕΤΡΗΜΕΝΟ ΓΡΑΦΟΝΤΑΣ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Ένα σκέτο
 * `export { X } from './x'` **δεν** φέρνει το module στην κλειστότητα (το
 * `creditNamedImport` χρεώνει **σύμβολα**, όχι αρχεία): fixture γραμμένο έτσι δίνει
 * closure = **μόνο το layout**, οπότε κάθε άγκυρα βγαίνει πράσινη επειδή **δεν κοίταξε
 * τίποτα** — το σχήμα «0 = κανείς δεν κοίταξε», μέσα στο test που το κυνηγά.
 */
const LAYOUT = (symbol, from) => `import { ${symbol} } from '${from}';${NL}`
  + `export default function Layout() { return ${symbol}(); }${NL}`;

const scratchRoots = [];

/** Στήνει repo στον δίσκο και χτίζει τον **αληθινό** γράφο. */
function miniRepo(files, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-attr-'));
  scratchRoots.push(root);
  const write = (rel, body) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
  };
  write('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }));
  for (const [rel, body] of Object.entries(files)) write(rel, body);
  const graph = P.buildModuleGraph(root);
  // ⚠️ Το `shellRoots` ορίζεται ΡΗΤΑ: η προεπιλογή ονομάζει και το `(light)/page.tsx`
  // του πραγματικού δέντρου, που εδώ δεν υπάρχει — και το `resolveRoots` ΣΩΣΤΑ πετά.
  const config = {
    ...DEFAULTS, keyConstants: [], shellRoots: ['src/app/**/layout.tsx'], ...overrides,
  };
  const plan = P.buildShellPlan(root, config, graph);
  // ⚠️ Ο ΦΡΟΥΡΟΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΠΕΙΡΑΜΑΤΟΣ: αν η κλειστότητα δεν έφτασε πέρα από το
  // layout, το fixture είναι σπασμένο και ΚΑΘΕ ετυμηγορία από κάτω είναι ανούσια.
  if (plan.closure.files.length < 2) {
    throw new Error(`μίνι-repo: η κλειστότητα έμεινε στο layout (${plan.closure.files.join(', ')})`);
  }
  return { root, graph, config, plan };
}

afterAll(() => {
  for (const root of scratchRoots) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ο δίσκος δεν είναι το test */ }
  }
});

/** Τα κλειδιά που ζήτησε ένα namespace, ταξινομημένα. */
const keysFor = (plan, ns) => {
  const want = plan.wants.get(ns);
  return want ? [...want.keys].sort() : [];
};
const unattributed = plan => plan.violations.filter(v => v.kind === 'unattributed-namespace');

/* Τα σχήματα, ΑΠΟ ΠΡΑΓΜΑΤΙΚΟ ΚΩΔΙΚΑ (AuthForm.tsx · photo-preview-helpers.ts). */
const USE_TRANSLATION_STUB = `export function useTranslation(ns) { return { t: (k) => k }; }${NL}`;
const HOOK_DECLARES = `import { useTranslation } from '@/i18n/hooks/useTranslation';${NL}`
  + `export function useThing() { const { t } = useTranslation('auth'); return { t }; }${NL}`;
const HOOK_SILENT = `export function useThing() { return { t: (k) => k }; }${NL}`;
const BORROWS_FROM_IMPORT = `import { useThing } from './thing';${NL}`
  + `export function Comp() { const s = useThing(); return s.t('form.labels.email'); }${NL}`;
const TAKES_T_AS_PARAM = `export function label(t) { return t('photoPreview.titles.profile'); }${NL}`;
const MODAL_DECLARES = ns => `import { useTranslation } from '@/i18n/hooks/useTranslation';${NL}`
  + `import { label } from './helpers';${NL}`
  + `export function Modal() { const { t } = useTranslation(${ns}); return label(t); }${NL}`;

describe('Κ — ο μηχανισμός, σε μίνι-repo με αληθινό γράφο', () => {
  it('Κ1 (Ο ΠΑΡΟΝΟΜΑΣΤΗΣ): μηδέν δηλωμένα, κανένας γείτονας που δηλώνει ⇒ ΑΡΝΗΣΗ, και το κλειδί ΔΕΝ προσγειώνεται', () => {
    const { plan } = miniRepo({
      'src/app/layout.tsx': LAYOUT('Comp', '../comp'),
      'src/comp.tsx': BORROWS_FROM_IMPORT,
      'src/thing.ts': HOOK_SILENT,
    });
    const refusals = unattributed(plan);
    expect(refusals).toHaveLength(1);
    expect(refusals[0].file).toBe('src/comp.tsx');
    expect(refusals[0].snippet).toContain('form.labels.email');
    // ⚠️ Ο αριθμός μετρά ΞΕΧΩΡΙΣΤΑ κλειδιά, όχι εμφανίσεις: το `resolveFileKeys`
    // επιστρέφει το ίδιο κλειδί ΚΑΙ από τα literals ΚΑΙ από τον ταξινομητή.
    expect(refusals[0].snippet).toMatch(/^1 κλειδιά/);
    // Η ΒΛΑΒΗ, ΡΗΤΑ: κανένα namespace δεν ζήτησε ποτέ το κλειδί.
    expect([...plan.wants.keys()]).toEqual([]);
  });

  it('Κ2: κληρονομιά από module που ΕΙΣΑΓΩ (σχήμα AuthForm → useAuthFormState)', () => {
    const { plan } = miniRepo({
      'src/app/layout.tsx': LAYOUT('Comp', '../comp'),
      'src/comp.tsx': BORROWS_FROM_IMPORT,
      'src/thing.ts': HOOK_DECLARES,
      'src/i18n/hooks/useTranslation.ts': USE_TRANSLATION_STUB,
    });
    expect(unattributed(plan)).toHaveLength(0);
    expect(keysFor(plan, 'auth')).toContain('form.labels.email');
  });

  it('Κ3: κληρονομιά από module που ΜΕ ΕΙΣΑΓΕΙ (σχήμα παραμέτρου/prop) — η ΑΛΛΗ κατεύθυνση', () => {
    const { plan } = miniRepo({
      'src/app/layout.tsx': LAYOUT('Modal', '../modal'),
      'src/modal.tsx': MODAL_DECLARES("'common-photos'"),
      'src/helpers.ts': TAKES_T_AS_PARAM,
      'src/i18n/hooks/useTranslation.ts': USE_TRANSLATION_STUB,
    });
    expect(unattributed(plan)).toHaveLength(0);
    expect(keysFor(plan, 'common-photos')).toContain('photoPreview.titles.profile');
  });

  it('Κ4: ΕΝΑ ΑΛΜΑ, ΠΟΤΕ ΜΕΤΑΒΑΤΙΚΟ — αλυσίδα δύο αδήλωτων αρχείων ΑΡΝΕΙΤΑΙ', () => {
    const { plan } = miniRepo({
      'src/app/layout.tsx': LAYOUT('A', '../a'),
      'src/a.tsx': `import { useTranslation } from '@/i18n/hooks/useTranslation';${NL}`
        + `import { B } from './b';${NL}`
        + `export function A() { const { t } = useTranslation('auth'); return B(t); }${NL}`,
      'src/b.tsx': `import { C } from './c';${NL}export function B(t) { return C(t); }${NL}`,
      'src/c.tsx': `export function C(t) { return t('form.labels.password'); }${NL}`,
      'src/i18n/hooks/useTranslation.ts': USE_TRANSLATION_STUB,
    });
    // Το `b` κληρονομεί από το `a`. Το `c` απέχει ΔΥΟ άλματα ⇒ δεν μαντεύεται.
    expect(unattributed(plan).map(v => v.file)).toEqual(['src/c.tsx']);
    expect(keysFor(plan, 'auth')).not.toContain('form.labels.password');
  });

  it('Κ5: εγγραφή dynamicKeyPolicy ΚΑΤΑΠΙΝΕΙ την άρνηση ΚΑΙ ΔΕΝ αναφέρεται νεκρή', () => {
    const { plan } = miniRepo({
      'src/app/layout.tsx': LAYOUT('Comp', '../comp'),
      'src/comp.tsx': BORROWS_FROM_IMPORT,
      'src/thing.ts': HOOK_SILENT,
    }, {
      dynamicKeyPolicy: { 'src/comp.tsx': { reason: 'το namespace είναι runtime prop — μετρημένο' } },
    });
    expect(unattributed(plan)).toHaveLength(0);
    // ⚠️ Χωρίς αυτό, φρουρός που ΔΟΥΛΕΥΕΙ θα αναφερόταν «νεκρός» και θα διαγραφόταν.
    expect(plan.unusedPolicy).not.toContain('src/comp.tsx');
  });

  it('Κ6: ΡΗΤΟ namespace (ns:key) δεν χρειάζεται τη δήλωση του αρχείου ⇒ καμία άρνηση', () => {
    const { plan } = miniRepo({
      'src/app/layout.tsx': LAYOUT('Comp', '../comp'),
      'src/comp.tsx': `import { useThing } from './thing';${NL}`
        + `export function Comp() { const s = useThing(); return s.t('auth:form.labels.email'); }${NL}`,
      'src/thing.ts': HOOK_SILENT,
    });
    expect(unattributed(plan)).toHaveLength(0);
  });

  it('Κ7: η ΥΠΕΡ-ΑΠΟΔΟΣΗ είναι ακίνδυνη — ζητιέται σε ΚΑΘΕ κληρονομημένο ns, το locale αποφασίζει', () => {
    const { plan } = miniRepo({
      'src/app/layout.tsx': LAYOUT('Modal', '../modal'),
      'src/modal.tsx': MODAL_DECLARES("['common-photos', 'auth']"),
      'src/helpers.ts': TAKES_T_AS_PARAM,
      'src/i18n/hooks/useTranslation.ts': USE_TRANSLATION_STUB,
    });
    expect(unattributed(plan)).toHaveLength(0);
    expect(keysFor(plan, 'common-photos')).toContain('photoPreview.titles.profile');
    expect(keysFor(plan, 'auth')).toContain('photoPreview.titles.profile');
  });
});

/* =============================================================================
 * Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ
 * ========================================================================== */

describe('Μ — μεταλλάξεις: μία γραμμή αλλάζει, η ετυμηγορία ΠΡΕΠΕΙ να γυρίσει', () => {
  const BASE = Object.freeze({
    'src/app/layout.tsx': LAYOUT('Comp', '../comp'),
    'src/comp.tsx': BORROWS_FROM_IMPORT,
    'src/thing.ts': HOOK_DECLARES,
    'src/i18n/hooks/useTranslation.ts': USE_TRANSLATION_STUB,
  });

  it('Μ0: η βάση είναι ΠΡΑΣΙΝΗ — αλλιώς οι μεταλλάξεις δεν αποδεικνύουν τίποτα', () => {
    const { plan } = miniRepo({ ...BASE });
    expect(unattributed(plan)).toHaveLength(0);
    expect(keysFor(plan, 'auth')).toContain('form.labels.email');
  });

  it('Μ1: ο γείτονας παύει να δηλώνει ⇒ ΑΡΝΗΣΗ (η κληρονομιά ΕΙΝΑΙ ο μηχανισμός)', () => {
    const mutated = { ...BASE, 'src/thing.ts': HOOK_SILENT };
    expect(mutated['src/thing.ts']).not.toBe(BASE['src/thing.ts']);
    expect(unattributed(miniRepo(mutated).plan)).toHaveLength(1);
  });

  it('Μ2: η ακμή εισαγωγής κόβεται ⇒ ΑΡΝΗΣΗ (γειτονία ΕΙΝΑΙ η ακμή, όχι ο φάκελος)', () => {
    const mutated = {
      ...BASE,
      'src/comp.tsx': `import { useThing } from './thing';${NL}`
        + `export function Comp() { useThing(); const s = { t: (k) => k }; return s.t('form.labels.email'); }${NL}`,
      'src/thing.ts': HOOK_SILENT,
    };
    expect(mutated['src/comp.tsx']).not.toBe(BASE['src/comp.tsx']);
    expect(unattributed(miniRepo(mutated).plan)).toHaveLength(1);
  });

  it('Μ3: το αρχείο δηλώνει ΜΟΝΟ ΤΟΥ ⇒ η κληρονομιά δεν χρειάζεται, και δεν παρεμβαίνει', () => {
    const mutated = {
      ...BASE,
      'src/comp.tsx': `import { useTranslation } from '@/i18n/hooks/useTranslation';${NL}`
        + `import { useThing } from './thing';${NL}`
        + `export function Comp() { const { t } = useTranslation('landing'); useThing(); return t('form.labels.email'); }${NL}`,
      'src/thing.ts': HOOK_SILENT,
    };
    const { plan } = miniRepo(mutated);
    expect(unattributed(plan)).toHaveLength(0);
    expect(keysFor(plan, 'landing')).toContain('form.labels.email');
    expect(keysFor(plan, 'auth')).toEqual([]);
  });
});

/* =============================================================================
 * Π — ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΔΕΝΤΡΟ: ΟΙ ΤΕΣΣΕΡΙΣ ΔΗΜΟΣΙΕΣ ΟΘΟΝΕΣ
 * ========================================================================== */

describe('Π — το πραγματικό δέντρο', () => {
  const shell = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.el.json'), 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(path.join(REPO, '.i18n-ssr-oracle-baseline.json'), 'utf8'));
  const ROUTES = Object.freeze({
    '/login': 'login',
    '/privacy-policy': 'privacy-policy',
    '/terms': 'terms',
    '/data-deletion': 'data-deletion',
  });
  const get = (tree, dotted) => dotted.split('.').reduce((o, k) => ((o && typeof o === 'object') ? o[k] : undefined), tree);
  const answered = (trees, key) => trees.some(tree => Object.values(tree).some(ns => typeof get(ns, key) === 'string'));

  // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΡΧΕΤΑΙ ΑΠΟ ΤΗ BASELINE ΤΟΥ ΧΡΗΣΜΟΥ, ΟΧΙ ΑΠΟ ΤΟ SLICE. Μια άγκυρα
  // που διάβαζε το slice και για τα δύο σκέλη θα έμενε πράσινη σβήνοντας κλειδιά — ο
  // παρονομαστής θα μετακινούνταν μαζί με τη μετάλλαξη (ADR-790 §9.1).
  const rawKeysOf = url => baseline.violations
    .filter(v => v.startsWith(`${url}|`))
    .map(v => v.split('|'))
    .filter(parts => parts[1] !== 'surface-shell-only')
    .map(parts => parts[2]);

  it.each(Object.keys(ROUTES))('Π1 [%s]: η baseline ΟΝΤΩΣ κατέγραψε ωμά κλειδιά εδώ', url => {
    expect(rawKeysOf(url).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(ROUTES))('Π2 [%s]: ΚΑΘΕ ωμό κλειδί απαντιέται πλέον σύγχρονα', (url, id) => {
    const slice = JSON.parse(fs.readFileSync(path.join(REPO, `src/i18n/generated/routes/${id}.el.json`), 'utf8'));
    const missing = rawKeysOf(url)
      .map(key => (key.includes(':') ? key.split(':').slice(1).join(':') : key))
      .filter(key => !answered([slice, shell], key));
    expect(missing).toEqual([]);
  });

  it('Π3: τα κλειδιά που έλειπαν από ΤΟ ΚΕΛΥΦΟΣ επέστρεψαν (photo-preview-helpers)', () => {
    for (const key of ['photoPreview.contactType.individual', 'photoPreview.titles.profile', 'photoPreview.titles.logo']) {
      expect(answered([shell], key)).toBe(true);
    }
  });

  it('Π4: κανείς δεν δανείζει πια μεταφραστή στην οθόνη σύνδεσης', () => {
    for (const file of ['src/auth/components/AuthForm.tsx', 'src/auth/components/MfaVerificationForm.tsx']) {
      const source = fs.readFileSync(path.join(REPO, file), 'utf8');
      expect(source).toContain("useTranslation('auth')");
      expect(source).not.toContain('state.t(');
    }
    // Και ο hook έπαψε να το εξάγει — αλλιώς ο επόμενος θα το ξαναδανειζόταν.
    const hook = fs.readFileSync(path.join(REPO, 'src/auth/hooks/useAuthFormState.ts'), 'utf8');
    expect(hook).not.toMatch(/^ {4}t,$/m);
  });
});
