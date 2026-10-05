/**
 * ADR-744 §27 — ο χάρτης `κλειδί τεμπέλικης διαδρομής → namespaces[]`, και τα κατάστιχά του.
 *
 * Κάθε ομάδα στήνει **μίνι-repo με αληθινό γράφο** (ίδιο πρότυπο με το
 * `i18n-namespace-attribution.test.js`): ο walker, ο resolver και ο εξαγωγέας είναι οι
 * πραγματικοί — καμία απομίμηση της μηχανής που κρίνεται.
 *
 * Μεταλλάξεις (2026-10-05) — καθεμία κοκκινίζει **ακριβώς** την άγκυρα που ονομάζει:
 *   Μ1 χωρίς `withCompatNamespaces` ⇒ Γ5 · Μ2 χωρίς `∩ SUPPORTED` ⇒ Γ4 · Μ3 χωρίς φίλτρο `ssr` ⇒ Γ6 ·
 *   Μ4 `resolveConst` → null ⇒ Γ2 · Μ5 το `answered` αγνοείται ⇒ Γ7β · Μ6 χωρίς `deadOpaque` ⇒ Γ7γ ·
 *   Μ7 το `ABSENT` σιωπά ⇒ Α2 · Μ8 `grew` πάντα false ⇒ Α3 · Μ9 χωρίς `ORPHAN_ROW` ⇒ Κ2 ·
 *   Μ10 ο χάρτης στο `artifacts` αντί `signedOnly` ⇒ Υ1.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LIB = path.resolve(__dirname, '../lib/i18n-shell-slice');
const P = require(path.join(LIB, 'plan'));
const RS = require(path.join(LIB, 'route-slices'));
const LR = require(path.join(LIB, 'lazy-routes'));
const LC = require(path.join(LIB, 'lazy-route-census'));
const { DEFAULTS, loadConfig } = require(path.join(LIB, 'config'));
const { extractNamespaces, loadNamespaceBundles } = require(path.resolve(__dirname, '../lib/i18n-namespace-extract'));

const NL = '\n';
const REGISTRY = 'src/utils/routes.tsx';
const SEAL = { count: 0, at: '2026-10-05', why: 'άγκυρα — μηδέν ζεύγη εκτός εκκίνησης στο μίνι-repo' };
const scratchRoots = [];

const LAZY_CONFIG = (supported, critical) => `export const SUPPORTED_NAMESPACES = [${NL}`
  + supported.map(ns => `  '${ns}',  // σχόλιο με 'εισαγωγικά' που ένας regex θα διάβαζε${NL}`).join('')
  + `] as const;${NL}export type Namespace = typeof SUPPORTED_NAMESPACES[number];${NL}`
  + `export const CRITICAL_NAMESPACES: readonly Namespace[] = [${critical.map(ns => `'${ns}'`).join(', ')}];${NL}`;

const registry = entries => `import { defineLazyRoutes } from './factory';${NL}export const Routes = defineLazyRoutes({${NL}`
  + entries.map(([key, spec, extra = '']) => `  ${key}: { load: () => import('${spec}')${extra} },${NL}`).join('') + `});${NL}`;

const uses = (ns, child) => `${child ? `import { ${child[0]} } from '${child[1]}';${NL}` : ''}`
  + `import { useTranslation } from '@/i18n/hook';${NL}`
  + `export default function Page() { const { t } = useTranslation(${ns}); ${child ? `${child[0]}(); ` : ''}return t('x'); }${NL}`;

/** Στήνει repo στον δίσκο και χτίζει τον **αληθινό** γράφο. */
function miniRepo(files, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-ns-'));
  scratchRoots.push(root);
  const write = (rel, body) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
  };
  // ⚠️ `tsconfig.base.json`, ΟΧΙ `tsconfig.json`: από εκεί διαβάζει τα aliases ο resolver. Με λάθος όνομα
  // κάθε `@/…` μένει άλυτο και ο χάρτης βγαίνει ΑΔΕΙΟΣ — δηλαδή άγκυρες που δεν κοίταξαν τίποτα.
  write('tsconfig.base.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }));
  write('src/utils/factory.ts', `export function defineLazyRoutes(d) { return d; }${NL}`);
  write('src/i18n/hook.ts', `export function useTranslation(ns) { return { t: (k) => k }; }${NL}`);
  if (!files['src/i18n/lazy-config.ts']) write('src/i18n/lazy-config.ts', LAZY_CONFIG(['alpha', 'beta', 'gamma', 'alpha-extra', 'boot'], ['boot']));
  for (const [rel, body] of Object.entries(files)) write(rel, body);
  const config = {
    ...DEFAULTS, keyConstants: [], shellRoots: ['src/app/**/layout.tsx'], lazyRouteRegistries: [REGISTRY],
    lazyRouteMountSeal: SEAL, ...overrides,
  };
  const graph = P.buildModuleGraph(root);
  return { root, graph, config, build: () => LR.buildLazyRouteNamespaces({ projectRoot: root, config, graph }) };
}

afterAll(() => {
  for (const root of scratchRoots) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ο δίσκος δεν είναι το test */ }
  }
});

describe('Γ — ο χάρτης παράγεται από την κλειστότητα του chunk', () => {
  it('Γ1: κυριολεκτικό + πίνακας, μέσα από πραγματική ακμή εισαγωγής — ταξινομημένα', () => {
    const { build } = miniRepo({
      [REGISTRY]: registry([['A', '@/pages/a']]),
      'src/pages/a.tsx': uses(`['gamma', 'alpha']`, ['Child', './child']),
      'src/pages/child.tsx': `import { useTranslation } from '@/i18n/hook';${NL}export function Child() { return useTranslation('beta').t('y'); }${NL}`,
    });
    const lazy = build();
    expect(lazy.rows).toEqual({ A: ['alpha', 'beta', 'gamma'] });
    // Ο φρουρός του ίδιου του πειράματος: η κλειστότητα πέρασε πέρα από τη ρίζα.
    expect([...lazy.inputs].sort()).toEqual(['src/i18n/hook.ts', 'src/pages/a.tsx', 'src/pages/child.tsx']);
    expect(lazy.provenance.get('A').get('beta')).toEqual(['src/pages/child.tsx']);
  });

  it('Γ2: `useTranslation(ΣΤΑΘΕΡΑ)` μέσα από αλυσίδα re-export — το τυφλό σημείο του κοινού εξαγωγέα', () => {
    const page = `import { NS, LIST } from '@/ns';${NL}import { useTranslation } from '@/i18n/hook';${NL}`
      + `export default function Page() { useTranslation(NS); return useTranslation(LIST as unknown as string[]).t('x'); }${NL}`;
    const { root, build } = miniRepo({
      [REGISTRY]: registry([['A', '@/pages/a']]),
      'src/pages/a.tsx': page,
      'src/ns/index.ts': `export { NS, LIST } from './decl';${NL}`,
      'src/ns/decl.ts': `export const NS = 'alpha';${NL}const BASE = ['beta'] as const;${NL}export const LIST = [...BASE, 'gamma'] as const;${NL}`,
    });
    // Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο κοινός εξαγωγέας, μόνος του, βλέπει ΜΗΔΕΝ εδώ.
    expect(extractNamespaces(page, loadNamespaceBundles(root))).toEqual([]);
    const lazy = build();
    expect(lazy.rows.A).toEqual(['alpha', 'beta', 'gamma']);
    expect(lazy.opaque).toEqual([]);
  });

  it('Γ3: ό,τι ζει πίσω από `import()` ΜΕΣΑ στο chunk δεν περιμένεται (έχει δικό του όριο)', () => {
    const { build } = miniRepo({
      [REGISTRY]: registry([['A', '@/pages/a']]),
      'src/pages/a.tsx': uses(`'alpha'`) + `export const later = () => import('./tab');${NL}`,
      'src/pages/tab.tsx': uses(`'beta'`),
    });
    expect(build().rows.A).toEqual(['alpha']);
  });

  it('Γ4: ρητό `t(\'ns:key\')` μετρά· ό,τι δεν είναι SUPPORTED πετιέται (`https` της μέτρησης)', () => {
    const { build } = miniRepo({
      [REGISTRY]: registry([['A', '@/pages/a']]),
      'src/pages/a.tsx': `export default function Page(t) { return [t('beta:title'), t('https:example'), t('nowhere:x')]; }${NL}`,
    });
    expect(build().rows.A).toEqual(['beta']);
  });

  it('Γ5: τα compat splits μπαίνουν — ο hook φορτώνει δηλωμένα ΣΥΝ splits', () => {
    const { build } = miniRepo({
      [REGISTRY]: registry([['A', '@/pages/a']]),
      'src/pages/a.tsx': uses(`'alpha'`),
      'src/i18n/namespace-compat.ts': `export const ALPHA_COMPATIBILITY_NAMESPACES = ['alpha-extra'] as const;${NL}`
        + `const COMPAT_NAMESPACE_MAP: Record<string, readonly string[]> = {${NL}  alpha: ALPHA_COMPATIBILITY_NAMESPACES,${NL}};${NL}`,
    });
    expect(build().rows.A).toEqual(['alpha', 'alpha-extra']);
  });

  it('Γ6: `ssr: true` ⇒ καμία γραμμή· μηδέν namespaces ⇒ ΚΕΝΗ γραμμή (η γραμμή είναι η απόδειξη κάλυψης)', () => {
    const { build } = miniRepo({
      [REGISTRY]: registry([['A', '@/pages/a', ', ssr: true'], ['B', '@/pages/b', ', ssr: false'], ['C', '@/pages/c']]),
      'src/pages/a.tsx': uses(`'alpha'`),
      'src/pages/b.tsx': uses(`'beta'`),
      'src/pages/c.tsx': `export default function Page() { return null; }${NL}`,
    });
    const lazy = build();
    expect(lazy.rows).toEqual({ B: ['beta'], C: [] });
    expect(LR.awaitedKeys(lazy.entries)).toEqual(['B', 'C']);
  });

  const OPAQUE_PAGE = `import { useTranslation } from '@/i18n/hook';${NL}`
    + `export default function Page({ ns }) { return useTranslation(ns).t('x'); }${NL}`;

  it('Γ7α: `useTranslation(prop)` χωρίς γραπτή απάντηση ⇒ ΟΝΟΜΑΖΕΤΑΙ, δεν σιωπά', () => {
    const { root, config, build } = miniRepo({ [REGISTRY]: registry([['A', '@/pages/a']]), 'src/pages/a.tsx': OPAQUE_PAGE });
    const lazy = build();
    expect(lazy.opaque).toEqual([{ file: 'src/pages/a.tsx', line: 2, text: 'useTranslation(ns)' }]);
    const judged = LR.judgeLazyRoutes(root, config, lazy, []);
    expect(judged.verdicts.join('\n')).toContain('src/pages/a.tsx:2');
  });

  it('Γ7β: με απάντηση στο κατάστιχο ⇒ τα namespaces της μπαίνουν και η κλήση παύει να καταγγέλλεται', () => {
    const { build } = miniRepo(
      { [REGISTRY]: registry([['A', '@/pages/a']]), 'src/pages/a.tsx': OPAQUE_PAGE },
      { lazyRouteOpaqueNamespaces: { 'src/pages/a.tsx': { namespaces: ['gamma'], reason: 'ο μόνος καλών δίνει πάντα `gamma`' } } },
    );
    const lazy = build();
    expect(lazy.rows.A).toEqual(['gamma']);
    expect(lazy.opaque).toEqual([]);
    expect(lazy.deadOpaque).toEqual([]);
  });

  it('Γ7γ: απάντηση σε ερώτηση που δεν τίθεται πια ⇒ ΝΕΚΡΗ εγγραφή, και κρίνεται', () => {
    const { root, config, build } = miniRepo(
      { [REGISTRY]: registry([['A', '@/pages/a']]), 'src/pages/a.tsx': uses(`'alpha'`) },
      { lazyRouteOpaqueNamespaces: { 'src/pages/a.tsx': { namespaces: ['gamma'], reason: 'έμεινε πίσω από παλιά μορφή του αρχείου' } } },
    );
    const lazy = build();
    expect(lazy.rows.A).toEqual(['alpha']);          // η νεκρή απάντηση ΔΕΝ προσθέτει αναμονή
    expect(lazy.deadOpaque).toEqual(['src/pages/a.tsx']);
    expect(LR.judgeLazyRoutes(root, config, lazy, []).verdicts.join('\n')).toContain('νεκρές εγγραφές');
  });

  it('Γ8: ό,τι δεν διαβάζεται ΑΡΝΕΙΤΑΙ — διπλό κλειδί · μητρώο χωρίς δήλωση · λάθος σχήμα · άλυτο import', () => {
    const second = 'src/utils/more.tsx';
    const dup = miniRepo(
      { [REGISTRY]: registry([['A', '@/pages/a']]), [second]: registry([['A', '@/pages/a']]), 'src/pages/a.tsx': uses(`'alpha'`) },
      { lazyRouteRegistries: [REGISTRY, second] },
    );
    expect(() => dup.build()).toThrow(/διπλό κλειδί τεμπέλικης διαδρομής «A»/);

    const none = miniRepo({ [REGISTRY]: `export const Routes = {};${NL}` });
    expect(() => none.build()).toThrow(/καμία κλήση defineLazyRoutes/);

    const shape = miniRepo({ [REGISTRY]: `import { defineLazyRoutes } from './factory';${NL}const x = {};${NL}export const R = defineLazyRoutes({ A: x });${NL}` });
    expect(() => shape.build()).toThrow(/δεν είναι `Κλειδί: \{ load, … \}`/);

    const ghost = miniRepo({ [REGISTRY]: registry([['A', '@/pages/missing']]) });
    const lazy = ghost.build();
    expect(lazy.unresolved.map(entry => entry.key)).toEqual(['A']);
    expect(LR.judgeLazyRoutes(ghost.root, ghost.config, lazy, []).verdicts.join('\n')).toContain('A (@/pages/missing)');
  });
});

describe('Α — η απογραφή των αναμονών εκτός εκκίνησης (ταυτότητα, ποτέ bytes)', () => {
  const seal = count => ({ count, at: '2026-10-05', why: 'άγκυρα — σφραγισμένο πλήθος για την απογραφή' });

  it('Α0: «εκτός εκκίνησης» = ούτε ολόκληρο στο κέλυφος ούτε CRITICAL', () => {
    const { root } = miniRepo({ [REGISTRY]: registry([]) });
    const boot = LR.bootNamespaces(root, ['alpha']);
    expect(LC.mountOnlyPairs({ A: ['alpha', 'beta', 'boot'], B: ['boot'] }, boot)).toEqual({ A: ['beta'] });
  });

  it('Α1: νέο ζεύγος χωρίς δήλωση ⇒ ΚΟΚΚΙΝΟ, και το μήνυμα ονομάζει ποιος το σέρνει', () => {
    const audit = LC.auditMountCensus({ A: ['beta'] }, { A: ['beta', 'gamma'] }, seal(2));
    expect(audit.failures).toEqual([{ key: 'A', namespace: 'gamma', verdict: LC.CENSUS.UNDECLARED }]);
    const provenance = new Map([['A', new Map([['gamma', ['src/tab.tsx']]])]]);
    expect(LC.describeMountFailures(audit.failures, provenance)).toContain('το ονομάζει: src/tab.tsx');
  });

  it('Α2: δηλωμένο ζεύγος που δεν περιμένεται πια ⇒ ΚΟΚΚΙΝΟ (αλλιώς κρατά ψηλά το ταβάνι)', () => {
    const audit = LC.auditMountCensus({ A: ['beta', 'gamma'] }, { A: ['beta'] }, seal(2));
    expect(audit.failures).toEqual([{ key: 'A', namespace: 'gamma', verdict: LC.CENSUS.ABSENT }]);
    expect(audit.grew).toBe(false);
  });

  it('Α3: ΔΥΟ ΚΑΝΟΝΕΣ — σωστά δηλωμένα ζεύγη πάνω από τη σφράγιση ⇒ Κ1 πράσινο, Κ2 ΚΟΚΚΙΝΟ', () => {
    const pairs = { A: ['beta', 'gamma'] };
    const audit = LC.auditMountCensus(pairs, pairs, seal(1));
    expect(audit.failures).toEqual([]);
    expect(audit.grew).toBe(true);
    expect(LC.describeMountGrowth(audit)).toContain('2 ζεύγη');
  });

  it('Α4: σφράγιση με τζόγο ⇒ ανακοινώνεται, δεν μπλοκάρει', () => {
    const pairs = { A: ['beta'] };
    const audit = LC.auditMountCensus(pairs, pairs, seal(3));
    expect(audit.grew).toBe(false);
    expect(LC.announceMountSlack(audit).join('\n')).toContain('2 δωρεάν');
    expect(LC.announceMountSlack(LC.auditMountCensus(pairs, pairs, seal(1)))).toEqual([]);
  });

  it('Α5: το σχήμα κρίνεται στη ΦΟΡΤΩΣΗ — κενή εγγραφή, διπλό namespace, απάντηση χωρίς λόγο', () => {
    expect(() => LC.parseMountLedger({ A: [] })).toThrow(/μη κενός πίνακας/);
    expect(() => LC.parseMountLedger({ A: ['x', 'x'] })).toThrow(/ξεχωριστών/);
    expect(() => LC.parseOpaqueLedger({ 'a.tsx': { namespaces: [], reason: 'μικρό' } })).toThrow(/λείπει ο λόγος/);
    expect(() => LC.parseOpaqueLedger({ 'a.tsx': { namespaces: 'x', reason: 'ένας επαρκώς μεγάλος λόγος' } })).toThrow(/πίνακας namespaces/);
    const { root } = miniRepo({ [REGISTRY]: registry([]) });
    fs.writeFileSync(path.join(root, '.i18n-shell-slice.json'), JSON.stringify({ lazyRouteMountNamespaces: { A: [] } }));
    expect(() => loadConfig(root)).toThrow(/lazyRouteMountNamespaces\.A/);
  });

  it('Α6 (ΔΟΜΙΚΟ): το κατάστιχο δεν έχει από πού να μετρήσει bytes', () => {
    const source = fs.readFileSync(path.join(LIB, 'lazy-route-census.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(source).not.toMatch(/Buffer\.|byteLength|JSON\.stringify|statSync/);
  });
});

describe('Κ — το Layer 1: κάλυψη μητρώων ⇄ χάρτη, χωρίς γράφο', () => {
  const supported = new Set(['alpha', 'beta']);

  it('Κ1: διαδρομή χωρίς γραμμή ⇒ ΚΟΚΚΙΝΟ', () => {
    expect(LR.auditCoverage(['A', 'B'], { A: [] }, supported)).toEqual([{ verdict: LR.COVERAGE.MISSING_ROW, key: 'B' }]);
  });

  it('Κ2: γραμμή χωρίς διαδρομή ⇒ ΚΟΚΚΙΝΟ (σβησμένη εγγραφή που άφησε ίχνος)', () => {
    expect(LR.auditCoverage(['A'], { A: [], Z: ['alpha'] }, supported)).toEqual([{ verdict: LR.COVERAGE.ORPHAN_ROW, key: 'Z' }]);
  });

  it('Κ3: γραμμή με namespace εκτός SUPPORTED, ή που δεν είναι πίνακας ⇒ ΚΟΚΚΙΝΟ', () => {
    expect(LR.auditCoverage(['A'], { A: ['alpha', 'ghost'] }, supported)[0]).toMatchObject({ verdict: LR.COVERAGE.UNSUPPORTED, namespaces: ['ghost'] });
    expect(LR.auditCoverage(['A'], { A: 'alpha' }, supported)).toHaveLength(1);
  });

  it('Κ4: `judgeLazyArtifact` στον δίσκο — απόν · φρέσκο · μητρώο που απέκτησε διαδρομή · νέο ζεύγος', () => {
    const files = { [REGISTRY]: registry([['A', '@/pages/a']]), 'src/pages/a.tsx': uses(`'alpha'`) };
    const { root, config, build } = miniRepo(files);
    expect(LR.judgeLazyArtifact(root, config, [])[0]).toContain('is missing');

    const artifact = path.join(root, LR.artifactPath(config));
    fs.mkdirSync(path.dirname(artifact), { recursive: true });
    fs.writeFileSync(artifact, LR.renderLazyArtifact(build().rows));
    // `alpha` εκτός εκκίνησης και αδήλωτο ⇒ η απογραφή μιλά· δηλωμένο + σφραγισμένο ⇒ καθαρό.
    expect(LR.judgeLazyArtifact(root, config, []).join('\n')).toContain('A → alpha');
    const declared = { ...config, lazyRouteMountNamespaces: { A: ['alpha'] }, lazyRouteMountSeal: { ...SEAL, count: 1 } };
    expect(LR.judgeLazyArtifact(root, declared, [])).toEqual([]);
    expect(LR.judgeLazyArtifact(root, config, ['alpha'])).toEqual([]);   // ολόκληρο στο κέλυφος ⇒ εκκίνηση

    fs.writeFileSync(path.join(root, REGISTRY), registry([['A', '@/pages/a'], ['B', '@/pages/a']]));
    expect(LR.judgeLazyArtifact(root, declared, []).join('\n')).toContain('B: τεμπέλικη διαδρομή ΧΩΡΙΣ γραμμή');
  });
});

describe('Υ — ο χάρτης υπογράφεται από το ΙΔΙΟ manifest', () => {
  it('Υ1: μπαίνει στο `manifest.artifacts`, ΟΧΙ στο `sliceBytes`, και το `inputsSha256` τον καλύπτει', () => {
    const { root, graph, config } = miniRepo({
      'src/app/layout.tsx': `import { Shell } from '../shell';${NL}export default function Layout() { return Shell(); }${NL}`,
      'src/shell.tsx': `export function Shell() { return null; }${NL}`,
      [REGISTRY]: registry([['A', '@/pages/a']]),
      'src/pages/a.tsx': uses(`'alpha'`),
    });
    const plan = P.buildShellPlan(root, config, graph);
    const bare = P.renderArtifacts(root, config, plan);
    const complete = RS.renderComplete({ projectRoot: root, config, plan, graph, rendered: bare });
    const rel = LR.artifactPath(config);

    expect(complete.lazy.rows).toEqual({ A: ['alpha'] });
    expect(complete.rendered.artifacts.get(rel)).toBe(LR.renderLazyArtifact({ A: ['alpha'] }));
    expect(Object.keys(complete.rendered.manifest.artifacts)).toContain(rel);
    expect(complete.rendered.manifest.stats.sliceBytes).toBe(bare.manifest.stats.sliceBytes);
    expect(complete.rendered.manifest.inputsSha256).not.toBe(bare.manifest.inputsSha256);

    const none = RS.renderComplete({ projectRoot: root, config: { ...config, lazyRouteRegistries: [] }, plan, graph, rendered: bare });
    expect(none.lazy).toBeNull();
    expect(none.rendered).toBe(bare);
  });
});
