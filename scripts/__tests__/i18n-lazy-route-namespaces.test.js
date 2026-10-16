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

/**
 * =============================================================================
 * Λ — ADR-744 §31: Ο ΧΑΡΤΗΣ ΞΑΝΑΧΤΙΖΕΤΑΙ ΣΤΟ LAYER 1 (on-demand γράφος + μνήμη κατά περιεχόμενο)
 * =============================================================================
 *
 * Κάθε κόκκινο τρέχει μέσα από την ΠΡΑΓΜΑΤΙΚΗ `runLayerOne`, και η απόδειξη ότι το πιάνει ο F (όχι
 * κάποιος άλλος) είναι η ΜΕΤΑΛΛΑΞΗ σε ΑΝΤΙΓΡΑΦΟ του ελεγκτή όπου ο F σωπαίνει (Λ1). Τίποτα στον
 * δίσκο του repo δεν αγγίζεται.
 */
describe('Λ — §31: ο χάρτης τεμπέλικων διαδρομών ξαναχτίζεται στο Layer 1', () => {
  const { spawnSync } = require('node:child_process');
  const MG = require('../lib/module-graph');
  const { collectSourceFiles, isAnalysedSourcePath } = require('../lib/module-graph/scan-config');
  const GIT = require('../lib/git-index-snapshot');
  const GI = require(path.join(LIB, 'global-inputs'));
  const SC = require(path.join(LIB, 'source-cache'));
  const LF_PATH = path.join(LIB, 'lazy-freshness');
  const { computeShellClosure, walkSurface } = require(path.join(LIB, 'shell-closure'));
  const { fingerprintShellFile, toLf } = require(path.join(LIB, 'slice-build'));
  const CHECKER = path.resolve(__dirname, '../check-i18n-shell-slice.js');
  const writeIn = root => (rel, body) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
  };

  const DEEP = 'src/pages/deep.tsx';
  const BASE = {
    [REGISTRY]: registry([['A', '@/pages/a']]),
    'src/pages/a.tsx': uses(`'boot'`, ['Deep', './deep']),
    [DEEP]: `export function Deep() { return null; }${NL}`,
  };
  const DEEP_BETA = `import { useTranslation } from '@/i18n/hook';${NL}export function Deep() { return useTranslation('beta').t('k'); }${NL}`;

  /** Πλήρες δέντρο που περνά ΟΛΟ το Layer 1: config · bundles · ΑΝΤΙΓΡΑΦΟ toolchain · artifacts · manifest. */
  function gateRepo(files = BASE) {
    // ADR-744 §32 — ΚΕΛΥΦΟΣ ΠΟΥ ΥΠΑΡΧΕΙ: ο G λύνει τις ρίζες του (ένα δέντρο χωρίς ρίζα κελύφους θα έριχνε
    // και τον γεννήτορα — ήταν ανέφικτο fixture που πριν κανείς δεν ρωτούσε).
    const { root } = miniRepo({ 'src/app/layout.tsx': `export default function Layout() { return null; }${NL}`, ...files });
    const write = writeIn(root);
    write('.i18n-shell-slice.json', JSON.stringify({
      lazyRouteRegistries: [REGISTRY], lazyRouteMountSeal: SEAL, excludeConsumers: ['src/i18n/'], keyConstants: [],
      shellRoots: ['src/app/layout.tsx'],
    }));
    write('src/i18n/namespace-bundles.ts', `export const COMMON_NAMESPACES = ['common'] as const;${NL}`);
    for (const rel of GI.toolchainClosure(GI.CODE_ROOT).files) write(rel, fs.readFileSync(path.join(GI.CODE_ROOT, rel), 'utf8'));
    const config = loadConfig(root);
    const lazy = LR.buildLazyRouteNamespaces({ projectRoot: root, config, graph: P.buildModuleGraph(root) });
    write(LR.artifactPath(config), LR.renderLazyArtifact(lazy.rows));
    write(`${config.outputDir}/${P.WHOLE_NAME}`, `[]${NL}`);
    write(`${config.outputDir}/shell-slice.manifest.json`, JSON.stringify({
      languages: [], artifacts: {}, wants: {}, stats: {},
      globalInputs: GI.computeGlobalInputs(root, config, root),
    }));
    return { root, write, rows: lazy.rows };
  }

  /** Η ΠΥΛΗ: `{ red: null | μήνυμα, logs }`. */
  function gate(root, staged, run = require(CHECKER).runLayerOne) {
    const errors = [];
    const logs = [];
    const exit = jest.spyOn(process, 'exit').mockImplementation(code => { throw new Error(`exit:${code}`); });
    const error = jest.spyOn(console, 'error').mockImplementation(text => errors.push(String(text)));
    const log = jest.spyOn(console, 'log').mockImplementation(text => logs.push(String(text)));
    try {
      run(loadConfig(root), staged, root, { cacheDir: path.join(root, '.cache') });
      return { red: null, logs: logs.join('\n') };
    } catch (thrown) {
      if (!String(thrown.message).startsWith('exit:')) throw thrown;
      return { red: errors.join('\n'), logs: logs.join('\n') };
    } finally {
      exit.mockRestore(); error.mockRestore(); log.mockRestore();
    }
  }

  /** ΑΝΤΙΓΡΑΦΟ του ελεγκτή με τον F ΣΙΩΠΗΛΟ — η εποχή πριν το §31. */
  function checkerWithoutF() {
    let run;
    jest.isolateModules(() => {
      jest.doMock(LF_PATH, () => ({ ...jest.requireActual(LF_PATH), checkLazyRouteFreshness: () => ({ reasons: [], stats: null }) }));
      run = require(CHECKER).runLayerOne;
    });
    jest.dontMock(LF_PATH);
    return run;
  }

  it('Λ0 ΠΑΡΟΝΟΜΑΣΤΗΣ: καθαρό δέντρο ⇒ πράσινο, ΚΑΙ ο F έτρεξε (όχι «πράσινο επειδή δεν κοίταξε»)', () => {
    const { root, rows } = gateRepo();
    expect(rows).toEqual({ A: ['boot'] });
    const run = gate(root, [DEEP]);
    expect(run.red).toBeNull();
    expect(run.logs).toContain('CHECK 3.34 F');
  }, 60_000);

  it('Λ1 🔴 νέο `useTranslation` σε αρχείο ΕΚΤΟΣ κάθε πίνακα ⇒ ΚΟΚΚΙΝΟ με διαδρομή + namespace + αρχείο· χωρίς F (αντίγραφο) πράσινο', () => {
    const { root, write } = gateRepo();
    write(DEEP, DEEP_BETA);
    expect(gate(root, [DEEP], checkerWithoutF()).red).toBeNull();          // η τρύπα, αναπαραγμένη
    expect(gate(root, [DEEP]).red).toContain(`A: +beta (από ${DEEP})`);  // η θεραπεία
  }, 60_000);

  it('Λ2 🔴 `{X}` → `{X, Y}` πίσω από barrel: η κλειστότητα μεγαλώνει ⇒ ΚΟΚΚΙΝΟ (ο ΙΔΙΟΣ walk, όχι προσέγγιση)', () => {
    const page = names => `import { ${names} } from './kit';${NL}import { useTranslation } from '@/i18n/hook';${NL}`
      + `export default function Page() { return useTranslation('boot').t(String([${names}].length)); }${NL}`;
    const { root, write } = gateRepo({
      [REGISTRY]: registry([['A', '@/pages/a']]),
      'src/pages/a.tsx': page('X'),
      'src/pages/kit/index.ts': `export { X } from './x';${NL}export { Y } from './y';${NL}`,
      'src/pages/kit/x.ts': `export const X = 1;${NL}`,
      'src/pages/kit/y.ts': `import { useTranslation } from '@/i18n/hook';${NL}export const Y = () => useTranslation('beta');${NL}`,
    });
    expect(gate(root, ['src/pages/a.tsx']).red).toBeNull();
    write('src/pages/a.tsx', page('X, Y'));
    expect(gate(root, ['src/pages/a.tsx']).red).toContain('A: +beta (από src/pages/kit/y.ts)');
  }, 60_000);

  it('Λ3 ΜΝΗΜΗ: το δεύτερο πέρασμα κάνει 0 parses και κρίνει ΤΑΥΤΟΣΗΜΑ· το record ≡ φρέσκο parse', () => {
    const { root, write } = gateRepo();
    const parses = logs => Number(/\(disk\): (\d+) parses/.exec(logs)[1]);
    expect(parses(gate(root, [DEEP]).logs)).toBeGreaterThan(0);
    expect(parses(gate(root, [DEEP]).logs)).toBe(0);
    write(DEEP, DEEP_BETA);
    const warm = gate(root, [DEEP]);
    expect(parses(warm.logs)).toBe(1);                                    // ΜΟΝΟ το αλλαγμένο
    expect(warm.red).toContain(`A: +beta (από ${DEEP})`);

    const sources = SC.createDiskSources(root);
    const cached = SC.createCachedSources({ sources, cacheDir: path.join(root, '.cache'), namespace: SC.cacheNamespace(root, loadConfig(root)) });
    const abs = MG.toPosix(path.join(root, 'src/pages/a.tsx'));
    expect(cached.loadModule(abs, sources.readText)).toEqual(MG.parseGraphModule(abs, sources.readText(abs)));
  }, 90_000);

  it('Λ4 ON-DEMAND ≡ ΠΡΟΘΥΜΟΣ: ίδιος χάρτης, ίδιες είσοδοι — και με σταθερά πίσω από barrel και άλυτη εισαγωγή', () => {
    const { root, graph, config } = miniRepo({
      [REGISTRY]: registry([['A', '@/pages/a'], ['B', '@/pages/b']]),
      'src/pages/a.tsx': `import { NS } from '@/ns';${NL}import { useTranslation } from '@/i18n/hook';${NL}export default function P() { return useTranslation(NS).t('x'); }${NL}`,
      'src/ns/index.ts': `export { NS } from './decl';${NL}`,
      'src/ns/decl.ts': `export const NS = 'alpha';${NL}`,
      'src/pages/b.tsx': `import { Gone } from './gone';${NL}${uses(`'beta'`)}`,
      'src/unrelated/far.ts': `export const FAR = 1;${NL}`,
    });
    const sources = SC.createDiskSources(root);
    const onDemand = MG.createOnDemandGraph({ projectRoot: root, aliases: graph.aliases, files: sources.files, readText: sources.readText });
    const eager = LR.buildLazyRouteNamespaces({ projectRoot: root, config, graph });
    const lazy = LR.buildLazyRouteNamespaces({ projectRoot: root, config, graph: onDemand, sources });
    expect(lazy.rows).toEqual(eager.rows);
    expect(lazy.rows).toEqual({ A: ['alpha'], B: ['beta'] });
    expect([...lazy.inputs].sort()).toEqual([...eager.inputs].sort());
    expect(onDemand.modules.size).toBeLessThan(sources.files.length);    // ΔΕΝ διάβασε τα όλα
  });

  // ADR-744 §32.11 — ο πίνακας `consultedFiles` και ο C αποσύρθηκαν: η συμμετοχή του G διαβάζει
  // `closure.files ∪ closure.consulted` (closure-participation.js) και το Ξ5 κρίνει την αλλαγή του
  // barrel από άκρη σε άκρη. Εδώ μένει το ΔΕΔΟΜΕΝΟ πάνω στο οποίο στέκεται: ο walk ΔΗΛΩΝΕΙ το barrel.
  it('Λ5 barrel που ο walk ΔΙΑΒΑΖΕΙ χωρίς να είναι μέλος: δηλώνεται στο `consulted` (η συμμετοχή του G το βλέπει — Ξ5)', () => {
    const { root, graph } = miniRepo({
      'src/app/layout.tsx': `import { X } from '../kit';${NL}export default function L() { return X; }${NL}`,
      'src/kit/index.ts': `export { X } from './x';${NL}`,
      'src/kit/x.ts': `export const X = 1;${NL}`,
    });
    const closure = computeShellClosure(graph, [MG.toPosix(path.join(root, 'src/app/layout.tsx'))]);
    expect(closure.files).toEqual(['src/app/layout.tsx', 'src/kit/x.ts']);
    expect(closure.consulted).toEqual(['src/kit/index.ts']);
  });

  it('Λ6 ΑΠΟΤΥΠΩΜΑ = ό,τι διαβάζει ο walk: ονόματα εισαγωγών, εξαγωγές, re-exports ΜΕΤΡΑΝΕ· σώμα και σχόλια ΟΧΙ', () => {
    const surface = text => walkSurface(MG.parseGraphModule('/x/a.ts', text));
    const base = `import { A } from './k';${NL}export { R } from './r';${NL}export const L = A;${NL}`;
    expect(surface(base)).not.toEqual(surface(base.replace('{ A }', '{ A, B }')));
    expect(surface(base)).not.toEqual(surface(base.replace('{ R }', '{ R as S }')));
    expect(surface(base)).not.toEqual(surface(base.replace('const L', 'const M')));
    expect(surface(base)).toEqual(surface(`${base}// σχόλιο${NL}const local = 2 + 2;${NL}`));
    expect(fingerprintShellFile({ importSpecs: surface(base), namespaces: [] }))
      .not.toBe(fingerprintShellFile({ importSpecs: surface(base.replace('{ A }', '{ A, B }')), namespaces: [] }));
  });

  it('Λ8 ΕΥΡΕΤΗΡΙΟ: πολλά blobs σε ΕΝΑ batch ≡ `git show`· το αποκλίνον αρχείο διαβάζεται από το ευρετήριο, ΟΧΙ τον δίσκο', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-git-'));
    scratchRoots.push(root);
    const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q');
    git('config', 'core.autocrlf', 'true');
    const write = writeIn(root);
    // Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ ΣΦΑΛΜΑΤΟΣ ΠΟΥ ΜΕΤΡΗΘΗΚΕ: CRLF στον δίσκο, ώστε ένα `--filters` να άλλαζε μέγεθος.
    write('src/a.ts', `export const A = 'α';\r\n`.repeat(3));
    write('src/b.tsx', `export const B = 1;${NL}`);
    write('src/c.ts', `// τρίτο\r\n`);
    git('add', 'src');
    write('src/b.tsx', `export const B = 'ΔΙΣΚΟΣ';${NL}`);          // αστάδιοποίητη, «ξένη» αλλαγή
    const entries = GIT.listIndexEntries({ repoRoot: root });
    expect(entries.size).toBe(3);
    const texts = GIT.readIndexTexts({ repoRoot: root, entries: [...entries] });
    for (const [rel] of entries) expect(texts.get(rel)).toBe(git('cat-file', 'blob', entries.get(rel)).stdout);
    expect([...GIT.listWorktreeDivergence({ repoRoot: root })]).toEqual(['src/b.tsx']);
    const sources = SC.createIndexSources({ repoRoot: root, root });
    expect(sources.readText(`${MG.toPosix(root)}/src/b.tsx`)).toBe(`export const B = 1;${NL}`);
    // Το κλειδί του δίσκου (CRLF) συμπίπτει με το blob (LF) — αλλιώς οι δύο πηγές σάρωναν η μία την άλλη.
    expect(SC.gitBlobSha(toLf(fs.readFileSync(path.join(root, 'src/a.ts'), 'utf8')))).toBe(entries.get('src/a.ts'));
  });

  it('Λ9 το κατηγόρημα για μονοπάτια ΕΚΤΟΣ δίσκου ≡ `collectSourceFiles`', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-scan-'));
    scratchRoots.push(root);
    const rels = ['src/a.ts', 'src/b.d.ts', 'src/c.tsx', 'src/d.js', 'src/node_modules/x.ts',
      'src/subapps/dxf-viewer/archive/y.ts', 'src/deep/build/z.ts', 'src/ok/inner.tsx'];
    for (const rel of rels) writeIn(root)(rel, `export {};${NL}`);
    const walked = collectSourceFiles(root, ['src']).map(file => file.slice(MG.toPosix(root).length + 1));
    expect(walked.length).toBeGreaterThan(0);
    expect(rels.filter(isAnalysedSourcePath).sort()).toEqual(walked);
  });

  it('Λ10 χωρίς σταδιοποιημένο module η φθηνή κρίση ΤΡΕΧΕΙ (ήταν γραμμένη αλλά ΑΣΥΝΔΕΤΗ): μητρώο χωρίς γραμμή ⇒ ΚΟΚΚΙΝΟ', () => {
    const { root, write } = gateRepo();
    write(REGISTRY, registry([['A', '@/pages/a'], ['B', '@/pages/a']]));
    const run = gate(root, []);
    expect(run.red).toContain('B: τεμπέλικη διαδρομή ΧΩΡΙΣ γραμμή');
    expect(run.logs).not.toContain('CHECK 3.34 F');                      // ο επανυπολογισμός ΔΕΝ έτρεξε
  }, 60_000);
});

/**
 * =============================================================================
 * Ξ — ADR-744 §32: ΚΕΛΥΦΟΣ + ΔΙΑΔΡΟΜΕΣ ΕΠΑΥΞΗΤΙΚΑ, ΜΕ CUTOFF ΣΤΗ ΔΕΣΜΕΥΜΕΝΗ ΕΞΟΔΟ (έλεγχος G)
 * =============================================================================
 *
 * Μίνι-repo με ΑΛΗΘΙΝΟ git: γεννιέται με τον γεννήτορα, δεσμεύεται, και κάθε άγκυρα σταδιοποιεί μία
 * αλλαγή — ο G κρίνει γονέα (`HEAD`) απέναντι σε ευρετήριο, όπως στο hook. Οι μεταλλάξεις γίνονται σε
 * ΑΝΤΙΓΡΑΦΟ (`jest.isolateModules`), ποτέ σε αρχείο του repo.
 */
describe('Ξ — §32: ο G ξαναϋπολογίζει ΜΟΝΟ ό,τι άγγιξε η αλλαγή, και κοκκινίζει ΜΟΝΟ όταν αλλάζει η έξοδος', () => {
  const { spawnSync } = require('node:child_process');
  const SC = require(path.join(LIB, 'source-cache'));
  const { createLayerOnePass } = require(path.join(LIB, 'layer-one-pass'));
  const IF_PATH = path.join(LIB, 'incremental-freshness');
  const CP_PATH = path.join(LIB, 'closure-participation');
  const SB_PATH = path.join(LIB, 'slice-build');
  const IF = require(IF_PATH);

  const PAGE = 'src/app/r/page.tsx';
  const SECTION = 'src/app/r/Section.tsx';
  const NAV = 'src/shell/Nav.tsx';
  const KIT = 'src/kit/index.ts';
  const CARD = 'src/kit/card.tsx';
  const translated = (name, ns, key, extra = '') => `${extra}import { useTranslation } from '@/i18n/hook';${NL}`
    + `export function ${name}() { const { t } = useTranslation('${ns}'); return t('${key}'); }${NL}`;
  const section = (keys, extra = '') => `${extra}import { Card } from '@/kit';${NL}import { useTranslation } from '@/i18n/hook';${NL}`
    + `export function Section() { const { t } = useTranslation('beta'); Card(); return [${keys.map(k => `t('${k}')`).join(', ')}]; }${NL}`;
  const BASE_FILES = {
    'src/app/layout.tsx': `import { Nav } from '../shell/Nav';${NL}export default function Layout() { return Nav(); }${NL}`,
    [NAV]: translated('Nav', 'alpha', 'nav'),
    [PAGE]: `import { Section } from './Section';${NL}export default function Page() { return Section(); }${NL}`,
    [SECTION]: section(['title']),
    [KIT]: `export { Card } from './card';${NL}`,
    [CARD]: translated('Card', 'beta', 'card'),
    'src/kit/card2.tsx': translated('Card', 'beta', 'card2'),
    'src/i18n/locales/el/alpha.json': JSON.stringify({ nav: 'Nav', extra: 'E' }),
    'src/i18n/locales/el/beta.json': JSON.stringify({ title: 'T', card: 'C', card2: 'C2', more: 'M' }),
  };

  function git(root, ...args) {
    const result = spawnSync('git', ['-c', 'user.email=g@x', '-c', 'user.name=g', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  }

  /** Γεννημένο ΚΑΙ δεσμευμένο δέντρο: `{ root, write, config, manifest }`· `files` υπερισχύουν της βάσης. */
  function committedRepo(files = {}) {
    const config = {
      ...DEFAULTS, keyConstants: [], shellRoots: ['src/app/layout.tsx'], extraShellRoots: [], languages: ['el'],
      lazyRouteRegistries: [], guaranteedNamespaces: {}, excludeConsumers: ['src/i18n/'], routeSlices: { [PAGE]: {} },
    };
    const { root } = miniRepo({ ...BASE_FILES, ...files }, config);
    const write = writeTo(root);
    const graph = P.buildModuleGraph(root);
    const plan = P.buildShellPlan(root, config, graph);
    const complete = RS.renderComplete({ projectRoot: root, config, plan, graph, rendered: P.renderArtifacts(root, config, plan) });
    for (const [rel, text] of complete.rendered.artifacts) write(rel, text);
    git(root, 'init', '-q');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'base');
    return { root, write, config, manifest: complete.rendered.manifest };
  }

  /** Σταδιοποιεί και κρίνει ΟΠΩΣ το hook: πηγή = ευρετήριο, γονέας = `HEAD`. */
  function judge({ root, config, manifest }, staged, { check = IF.checkIncrementalFreshness, cacheDir = null } = {}) {
    git(root, 'add', '-A');   // μίνι-repo: όλο το δέντρο (ένα σβησμένο μονοπάτι δεν ταιριάζει πια σε pathspec)
    const pass = createLayerOnePass({
      root, config, stagedFiles: staged, sources: SC.createIndexSources({ repoRoot: root, root }), cacheDir, repoRoot: root,
    });
    const result = check({ manifest, pass });
    pass.persist();
    return { ...result, pass };
  }

  /** ΑΝΤΙΓΡΑΦΟ του G με ένα module μεταλλαγμένο (`patch(real)` ⇒ ό,τι αλλάζει)· ποτέ αρχείο του repo. */
  function mutatedCheck(modulePath, patch) {
    let check;
    jest.isolateModules(() => {
      const real = jest.requireActual(modulePath);
      jest.doMock(modulePath, () => ({ ...real, ...patch(real) }));
      check = require(IF_PATH).checkIncrementalFreshness;
    });
    jest.dontMock(modulePath);
    return check;
  }

  /** Μετάλλαξη της συμμετοχής: ο walk κοιτά μόνο ό,τι κρατά το `pick(graphs)` (`[commit, γονέας]`). */
  const participationIn = pick => mutatedCheck(CP_PATH, real => ({
    affectedClosures: args => real.affectedClosures({ ...args, graphs: pick(args.graphs) }),
  }));

  /** Μετάλλαξη του αποτυπώματος: ο G «ξεχνά» ένα πεδίο της επιφάνειας (`omit(analysis)` ⇒ ό,τι μένει). */
  const fingerprintWithout = omit => mutatedCheck(SB_PATH, real => ({
    fingerprintShellFile: analysis => real.fingerprintShellFile({ ...analysis, ...omit(analysis) }),
  }));

  function writeTo(root) {
    return (rel, body) => {
      const file = path.join(root, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body, 'utf8');
    };
  }

  it('Ξ0 ΠΑΡΟΝΟΜΑΣΤΗΣ: σχόλιο/σώμα ⇒ ίδιο αποτύπωμα γονέα/commit ⇒ 0 αλλαγμένα, πράσινο, χωρίς walk', () => {
    const repo = committedRepo();
    repo.write(SECTION, `// μόνο σχόλιο${NL}${section(['title'])}`);
    const result = judge(repo, [SECTION]);
    expect(result.reasons).toEqual([]);
    expect(result.stats).toEqual(expect.objectContaining({ staged: 1, changed: 0 }));
  }, 60_000);

  it('Ξ1 🔴 νέο κλειδί ΜΟΝΟ σε διαδρομή ⇒ ΚΟΚΚΙΝΟ με διεύθυνση + κλειδί· το κέλυφος ΔΕΝ ξαναχτίζεται', () => {
    const repo = committedRepo();
    repo.write(SECTION, section(['title', 'more']));
    const result = judge(repo, [SECTION]);
    expect(result.stats).toEqual(expect.objectContaining({ changed: 1, shell: false, routes: 1 }));
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('G. /r:');
    expect(result.reasons[0]).toContain('beta: +more');
  }, 60_000);

  // ADR-744 §32.11 — εδώ ως τότε ο αποσυρμένος C ΚΟΚΚΙΝΙΖΕ (ο θόρυβος του §32.1, 40/84 στην αναπαραγωγή).
  it('Ξ2 ✅ CUTOFF: νέα ακμή χωρίς i18n σε διαδρομή ⇒ κρίνεται, και ο G ΠΡΑΣΙΝΟΣ (η έξοδος ίδια)', () => {
    const repo = committedRepo();
    repo.write('src/app/r/util.ts', `export const id = x => x;${NL}`);
    repo.write(SECTION, section(['title'], `import { id } from './util';${NL}`));
    const staged = [SECTION, 'src/app/r/util.ts'];
    const result = judge(repo, staged);
    expect(result.stats).toEqual(expect.objectContaining({ changed: 2, routes: 1 }));             // κρίθηκε…
    expect(result.reasons).toEqual([]);                                                          // …και η έξοδος είναι ίδια
  }, 60_000);

  it('Ξ3 🔴 κέλυφος που άλλαξε ⇒ ΚΟΚΚΙΝΟ «κέλυφος», και καμία διαδρομή δεν χτίζεται (κλιμακωτό cutoff)', () => {
    const repo = committedRepo();
    repo.write(NAV, translated('Nav', 'alpha', 'extra'));
    const result = judge(repo, [NAV]);
    expect(result.stats).toEqual(expect.objectContaining({ changed: 1, shell: true }));
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('G. κέλυφος');
    expect(result.reasons[0]).toContain('alpha: +extra −nav');
  }, 60_000);

  it('Ξ4 🔴 ΔΙΑΓΡΑΦΗ: το σβησμένο είναι μέλος ΜΟΝΟ στον γονέα ⇒ ΚΟΚΚΙΝΟ· μετάλλαξη «μόνο το commit» (αντίγραφο) ⇒ πράσινο', () => {
    const repo = committedRepo();
    fs.rmSync(path.join(repo.root, CARD));
    const onlyCommit = participationIn(graphs => graphs.slice(0, 1));
    expect(judge(repo, [CARD], { check: onlyCommit }).reasons).toEqual([]);                    // η τρύπα, αναπαραγμένη
    const result = judge(repo, [CARD]);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('beta: −card');                                         // η θεραπεία
  }, 90_000);

  it('Ξ5 🔴 barrel που ο walk ΔΙΑΒΑΖΕΙ (consulted): re-export σε άλλο αρχείο ⇒ ΚΟΚΚΙΝΟ με +card2 −card', () => {
    const repo = committedRepo();
    repo.write(KIT, `export { Card } from './card2';${NL}`);
    const result = judge(repo, [KIT]);
    expect(result.stats).toEqual(expect.objectContaining({ changed: 1, routes: 1 }));
    expect(result.reasons[0]).toContain('beta: +card2 −card');
  }, 60_000);

  it('Ξ6 ΜΙΑ συσκευασία μνήμης για γονέα + commit: ένα αρχείο, και το δεύτερο πέρασμα κάνει 0 parses', () => {
    const repo = committedRepo();
    const cacheDir = path.join(repo.root, '.cache');
    repo.write(SECTION, section(['title', 'more']));
    expect(judge(repo, [SECTION], { cacheDir }).pass.stats().parses).toBeGreaterThan(0);
    expect(fs.readdirSync(cacheDir).filter(name => name.endsWith('.json'))).toHaveLength(1);
    const warm = judge(repo, [SECTION], { cacheDir });
    expect(warm.pass.stats().parses).toBe(0);                                                    // και οι ΔΥΟ καταστάσεις από μνήμη
    expect(warm.reasons[0]).toContain('beta: +more');                                            // ίδια κρίση
  }, 90_000);

  it('Ξ7 MEMO ≡ ΦΡΕΣΚΟ: ίδια επιφάνεια με και χωρίς memo· κέλυφος + διαδρομή στον ΙΔΙΟ γράφο αναλύουν μία φορά', () => {
    const { root, config } = committedRepo();
    const graph = P.buildModuleGraph(root);
    const memo = SC.analysisFor(graph);
    const withMemo = P.analyseFile(root, SECTION, graph, P.planContext(root, config, graph));
    const fresh = P.analyseFile(root, SECTION, graph, { ...P.planContext(root, config, graph), analysis: SC.NO_ANALYSIS_MEMO });
    expect(withMemo).toEqual(fresh);
    P.buildShellPlan(root, { ...config, shellRoots: [PAGE] }, graph);
    const misses = memo.counts.misses;
    P.buildShellPlan(root, { ...config, shellRoots: [PAGE] }, graph);
    expect(memo.counts.misses).toBe(misses);                                                     // δεύτερη κλειστότητα: 0 αναλύσεις
    expect(memo.counts.hits).toBeGreaterThan(0);
  }, 60_000);

  // ── Β6 (§32.11): οι κλάσεις που έπιαναν ο C/D και δεν είχαν άγκυρα για τον G. Καθεμία: G κόκκινο,
  //    και ο G με το ΕΝΑ πεδίο που την πιάνει ΣΒΗΣΜΕΝΟ (αντίγραφο) ⇒ πράσινο — άρα το πεδίο είναι φέρον.
  const BETA_SEC = { 'src/i18n/locales/el/beta.json': JSON.stringify({ title: 'T', card: 'C', more: 'M', sec: { x: 'X' }, sec2: { x: 'Y' } }) };
  const sectionBody = (head, ret) => `import { Card } from '@/kit';${NL}import { useTranslation } from '@/i18n/hook';${NL}${head}`
    + `export function Section() { const { t } = useTranslation('beta'); Card(); return ${ret}; }${NL}`;

  it('Ξ8 🔴 ΣΤΑΘΕΡΑ (§29): `const NS` + `` t(`${NS}.x`) `` — ίδιο κείμενο κλήσης, άλλο κλειδί ⇒ ΚΟΚΚΙΝΟ· χωρίς `resolution` πράσινο', () => {
    const withNs = ns => sectionBody(`const NS = '${ns}';${NL}`, '[t(`${NS}.x`)]');
    const repo = committedRepo({ ...BETA_SEC, [SECTION]: withNs('sec') });
    repo.write(SECTION, withNs('sec2'));
    expect(judge(repo, [SECTION], { check: fingerprintWithout(() => ({ resolution: undefined })) }).reasons).toEqual([]);
    const result = judge(repo, [SECTION]);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('beta: +sec2.x −sec.x');
  }, 90_000);

  it('Ξ9 🔴 ΕΞΑΓΟΜΕΝΟΣ ΠΙΝΑΚΑΣ (ADR-777 §8.39): template στον ιδιοκτήτη λύνει κλειδί ΑΛΛΟΥ αρχείου ⇒ ΚΟΚΚΙΝΟ· χωρίς `tables` πράσινο', () => {
    const KEYS = 'src/app/r/keys.ts';
    const table = base => `const BASE = '${base}';${NL}export const KEYS = { label: \`\${BASE}.x\` };${NL}`;
    const repo = committedRepo({
      ...BETA_SEC, [KEYS]: table('sec'), [SECTION]: sectionBody(`import { KEYS } from './keys';${NL}`, '[t(KEYS.label)]'),
    });
    repo.write(KEYS, table('sec2'));
    // Το harvest ΔΕΝ βλέπει template με αντικατάσταση ⇒ μόνο το `tables` κουβαλά την αλλαγή.
    const noTables = fingerprintWithout(({ resolution }) => ({ resolution: resolution && { ...resolution, tables: [] } }));
    expect(judge(repo, [KEYS], { check: noTables }).reasons).toEqual([]);
    const result = judge(repo, [KEYS]);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('beta: +sec2.x −sec.x');
  }, 90_000);

  it('Ξ10 🔴 `{Card}` → `{Card, Extra}` πίσω από barrel (§31 τρύπα 1): η κλειστότητα μεγαλώνει ⇒ ΚΟΚΚΙΝΟ· χωρίς ονόματα πράσινο', () => {
    const repo = committedRepo({
      [KIT]: `export { Card } from './card';${NL}export { Extra } from './extra';${NL}`,
      'src/kit/extra.tsx': translated('Extra', 'beta', 'more'),
    });
    repo.write(SECTION, section(['title']).replace('{ Card }', '{ Card, Extra }'));
    const nameless = fingerprintWithout(({ importSpecs }) => ({ importSpecs: importSpecs.map(line => line.replace(/\{.*\}/, '')) }));
    expect(judge(repo, [SECTION], { check: nameless }).reasons).toEqual([]);
    const result = judge(repo, [SECTION]);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('beta: +more');
  }, 90_000);

  it('Ξ11 🔴 ΝΕΟ ΑΡΧΕΙΟ ΛΥΝΕΙ ΑΛΥΤΟ (ADR-777 §8.95 — ο D): μέλος ΜΟΝΟ στο commit ⇒ ΚΟΚΚΙΝΟ· συμμετοχή μόνο στον γονέα πράσινο', () => {
    const GONE = 'src/app/r/gone.tsx';
    const repo = committedRepo({ [SECTION]: section(['title'], `import { Gone } from './gone';${NL}`) });
    repo.write(GONE, translated('Gone', 'beta', 'more'));
    expect(judge(repo, [GONE], { check: participationIn(graphs => graphs.slice(1)) }).reasons).toEqual([]);
    const result = judge(repo, [GONE]);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('beta: +more');
  }, 90_000);

  it('Ξ12 🔴 HARVEST (πρότυπο `RouteTabs`): το literal ζει σε ΑΛΛΟ module από το `t()` ⇒ ΚΟΚΚΙΝΟ· χωρίς `harvest` πράσινο', () => {
    const TABS = 'src/app/r/tabs.ts';
    const tabs = key => `export const TABS = [{ href: '/r', labelKey: '${key}' }];${NL}`;
    const repo = committedRepo({
      [TABS]: tabs('title'), [SECTION]: sectionBody(`import { TABS } from './tabs';${NL}`, 'TABS.map(tab => t(tab.labelKey))'),
    });
    repo.write(TABS, tabs('more'));
    expect(judge(repo, [TABS], { check: fingerprintWithout(() => ({ harvest: new Map() })) }).reasons).toEqual([]);
    const result = judge(repo, [TABS]);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('beta: +more −title');
  }, 90_000);

  // ── §32.12: η τοπολογία βγήκε από το manifest — τα μέλη τα δίνει ο walk, με ΕΠΑΛΗΘΕΥΣΙΜΟ ίχνος.
  const SM = require(path.join(LIB, 'shell-members'));
  /** Τα μέλη του κελύφους ΟΠΩΣ τα ρωτά το CHECK 3.51 `--index`: πηγή = ευρετήριο. */
  function membersOn(repo, cacheDir) {
    git(repo.root, 'add', '-A');
    const sources = SC.createIndexSources({ repoRoot: repo.root, root: repo.root });
    return SM.shellMembersFor({ root: repo.root, config: repo.config, sources, cacheDir });
  }

  it('Ξ13 ✅ ΤΟΠΟΛΟΓΙΑ: νέα ακμή ΧΩΡΙΣ i18n στο κέλυφος ⇒ τα μέλη αλλάζουν, ο G κρίνει το κέλυφος ΚΑΙ μένει πράσινος', () => {
    const repo = committedRepo();
    expect(repo.manifest).not.toHaveProperty('shellMembers');
    expect(repo.manifest).not.toHaveProperty('boundaries');
    const before = membersOn(repo, null).members;
    repo.write('src/shell/util.ts', `export const id = x => x;${NL}`);
    repo.write(NAV, translated('Nav', 'alpha', 'nav', `import { id } from './util';${NL}`));
    const result = judge(repo, [NAV, 'src/shell/util.ts']);
    expect(result.stats).toEqual(expect.objectContaining({ shell: true }));                       // κρίθηκε…
    expect(result.reasons).toEqual([]);                                                          // …και δεν είναι πια κόκκινο
    expect(membersOn(repo, null).members).toEqual([...before, 'src/shell/util.ts'].sort());       // ενώ η τοπολογία ΑΛΛΑΞΕ
  }, 90_000);

  it('Ξ14 ΙΧΝΟΣ: δεύτερη ερώτηση ⇒ 0 walk, ίδια μέλη· αλλαγή σε μέλος ⇒ walk που ΟΝΟΜΑΖΕΙ το αρχείο', () => {
    const repo = committedRepo();
    const cacheDir = path.join(repo.root, '.cache');
    const cold = membersOn(repo, cacheDir);
    expect(cold).toEqual(expect.objectContaining({ walked: true, reason: 'κανένα ίχνος' }));
    const warm = membersOn(repo, cacheDir);
    expect(warm.walked).toBe(false);
    expect(warm.members).toEqual(cold.members);
    repo.write(NAV, `// σχόλιο${NL}${translated('Nav', 'alpha', 'nav')}`);
    const edited = membersOn(repo, cacheDir);
    expect(edited.walked).toBe(true);
    expect(edited.reason).toContain(NAV);
    expect(edited.members).toEqual(cold.members);
    expect(membersOn(repo, cacheDir).walked).toBe(false);                                        // γράφτηκε νέο ίχνος
  }, 90_000);

  it('Ξ15 🔴 ΑΡΝΗΤΙΚΗ ΕΞΑΡΤΗΣΗ: νέο αρχείο λύνει άλυτη εισαγωγή του κελύφους ⇒ ίχνος ΑΚΥΡΟ· χωρίς τα «όχι» θα ίσχυε (μπαγιάτικο)', () => {
    const GONE = 'src/shell/gone.tsx';
    const repo = committedRepo({ [NAV]: translated('Nav', 'alpha', 'nav', `import { Gone } from './gone';${NL}`) });
    const cacheDir = path.join(repo.root, '.cache');
    expect(membersOn(repo, cacheDir).members).not.toContain(GONE);
    repo.write(GONE, translated('Gone', 'alpha', 'extra'));
    git(repo.root, 'add', '-A');
    const trace = JSON.parse(fs.readFileSync(SM.traceFileOf(cacheDir), 'utf8'));
    const sources = SC.createIndexSources({ repoRoot: repo.root, root: repo.root });
    const args = { key: trace.key, root: repo.root, config: repo.config, sources };
    expect(SM.verifyTrace({ ...trace, absent: [] }, args)).toBeNull();                           // η τρύπα, αναπαραγμένη
    const after = membersOn(repo, cacheDir);
    expect(after.walked).toBe(true);
    expect(after.reason).toContain('src/shell/gone');
    expect(after.members).toContain(GONE);
  }, 90_000);

  it('Ξ16 🔴 ΡΙΖΕΣ ΜΟΤΙΒΟΥ: νέο `layout.tsx` που ΚΑΝΕΙΣ δεν εισάγει ⇒ ίχνος ΑΚΥΡΟ (κανένας resolver δεν το ρώτησε)', () => {
    const repo = committedRepo();
    const patterned = { ...repo, config: { ...repo.config, shellRoots: ['src/app/**/layout.tsx'] } };
    const cacheDir = path.join(repo.root, '.cache');
    expect(membersOn(patterned, cacheDir).walked).toBe(true);
    expect(membersOn(patterned, cacheDir).walked).toBe(false);
    repo.write('src/app/x/layout.tsx', translated('X', 'alpha', 'extra'));
    const after = membersOn(patterned, cacheDir);
    expect(after.reason).toBe('άλλαξαν οι υποψήφιες ρίζες');
    expect(after.members).toContain('src/app/x/layout.tsx');
  }, 90_000);

  // ── §32.13 (Β7): ο ταξινομητής με μνήμη ΙΧΝΟΥΣ ΑΝΑΓΝΩΣΕΩΝ, και οι καθολικές είσοδοι ΜΙΑ φορά ανά πέρασμα.
  it('Ξ17 ΙΧΝΟΣ ΑΝΑΓΝΩΣΕΩΝ: άλλαξε ό,τι ΔΕΝ διαβάστηκε ⇒ hit· ό,τι διαβάστηκε (και το «όχι», και η σειρά) ⇒ ξαναϋπολογισμός', () => {
    const memo = SC.createAnalysisMemo();
    let runs = 0;
    const compute = env => { runs += 1; return [...(env.harvest.get('labelKey') || []), env.tables.get('KEYS') ? 'T' : '-']; };
    const at = (harvest, tables = new Map(), text = 'κείμενο') => memo.onceTraced('/f.ts', 'classified', text, { harvest, tables }, compute);
    const harvest = (values, other = 'x') => new Map([['labelKey', new Set(values)], ['other', new Set([other])]]);
    expect(at(harvest(['a']))).toEqual(['a', '-']);
    expect(at(harvest(['a'], 'y'))).toEqual(['a', '-']);                                          // ΜΗ διαβασμένο ⇒ hit
    expect(runs).toBe(1);
    expect(at(harvest(['a']), new Map([['KEYS', new Map([['x', 'k.x']])]]))).toEqual(['a', 'T']); // το «όχι» έγινε «ναι»
    expect(at(harvest(['b', 'a']), new Map([['KEYS', new Map([['x', 'k.x']])]]))).toEqual(['b', 'a', 'T']);
    expect(at(harvest(['a', 'b']), new Map([['KEYS', new Map([['x', 'k.x']])]]))).toEqual(['a', 'b', 'T']); // ίδια μέλη, άλλη σειρά
    expect(at(harvest(['a', 'b']), new Map([['KEYS', new Map([['x', 'k.y']])]]))).toEqual(['a', 'b', 'T']); // βαθιά τιμή
    expect(memo.counts).toEqual({ hits: 1, misses: 5, stale: 4 });
    expect(at(harvest(['a', 'b']), new Map([['KEYS', new Map([['x', 'k.y']])]]), 'άλλο')).toEqual(['a', 'b', 'T']);
    expect(memo.counts.stale).toBe(4);                                                           // άλλο κείμενο = miss, όχι stale
    // ΣΤΕΝΗ ΕΠΙΦΑΝΕΙΑ: ανάγνωση έξω από `get` δεν ξεφεύγει σιωπηλά από το ίχνος — ρίχνει.
    expect(() => memo.onceTraced('/g.ts', 'classified', 'κ', { harvest: new Map() }, env => env.harvest.has('x'))).toThrow(TypeError);
  });

  /**
   * Ένα αρχείο, ΔΥΟ κλειστότητες στον ΙΔΙΟ γράφο, που απαντούν αλλιώς σε ΜΙΑ ΜΟΝΟ από τις τρεις αναζητήσεις του
   * ταξινομητή (`vary`): `propertyValues` (harvest `labelKey`) · `closureConstants` (`KEYS`) · `keyConstants` (`REG`).
   * ⚠️ ΜΙΑ ανά σενάριο, επίτηδες: αν διέφεραν όλες, η καταγραφή των ΑΛΛΩΝ θα ακύρωνε το ίχνος και θα έκρυβε
   * τη μετάλλαξη (μετρημένο: η πρώτη εκδοχή αυτής της άγκυρας ήταν πράσινη πάνω στη μετάλλαξη).
   */
  const VARIES = { propertyValues: ['title', 'more'], closureConstants: ['sec.x', 'sec2.x'], keyConstants: ['reg.a', 'reg.b'] };
  function twoClosures(vary) {
    const pick = (lookup, dir) => VARIES[lookup][lookup === vary && dir === 'b' ? 1 : 0];
    const page = `import { Section } from '../../shared/Section';${NL}import { TABS } from './tabs';${NL}`
      + `import { KEYS } from './keys';${NL}export default function Page() { return Section({ tabs: TABS, k: KEYS }); }${NL}`;
    const side = dir => ({
      [`src/app/${dir}/page.tsx`]: page,
      [`src/app/${dir}/tabs.ts`]: `export const TABS = [{ href: '/${dir}', labelKey: '${pick('propertyValues', dir)}' }];${NL}`,
      [`src/app/${dir}/keys.ts`]: `export const KEYS = { label: '${pick('closureConstants', dir)}' };${NL}`,
      [`src/reg/${dir}.ts`]: `export const REG = { label: '${pick('keyConstants', dir)}' };${NL}`,
    });
    const { root, graph, config } = miniRepo({
      'src/shared/Section.tsx': `import { useTranslation } from '@/i18n/hook';${NL}export function Section({ tabs }) { const { t } = useTranslation('beta'); `
        + `return [...tabs.map(tab => t(tab.labelKey)), t(KEYS.label), t(REG.label)]; }${NL}`,
      ...side('a'),
      ...side('b'),
    }, { lazyRouteRegistries: [], excludeConsumers: ['src/i18n/'] });
    const configOf = dir => ({ ...config, shellRoots: [`src/app/${dir}/page.tsx`], extraShellRoots: [], keyConstants: [{ file: `src/reg/${dir}.ts`, exportName: 'REG' }] });
    return { root, graph, configOf };
  }
  const betaKeys = plan => [...plan.wants.get('beta').keys].sort();

  it.each(Object.keys(VARIES))('Ξ18 🔴 MEMO ≡ ΦΡΕΣΚΟ όταν διαφέρει ΜΟΝΟ το `%s`· μετάλλαξη (αντίγραφο) που δεν το καταγράφει ⇒ μπαγιάτικη τιμή', (lookup) => {
    const [before, after] = VARIES[lookup];
    const { root, graph, configOf } = twoClosures(lookup);
    const fresh = betaKeys(P.buildShellPlan(root, configOf('b'), P.buildModuleGraph(root)));
    expect(fresh).toContain(after);                                                              // η αλήθεια
    expect(betaKeys(P.buildShellPlan(root, configOf('a'), graph))).toContain(before);
    const memo = SC.analysisFor(graph);
    const stale = memo.counts.stale;
    expect(betaKeys(P.buildShellPlan(root, configOf('b'), graph))).toEqual(fresh);               // ΙΔΙΟΣ γράφος, ίδια αλήθεια
    expect(memo.counts.stale).toBe(stale + 1);                                                   // …επειδή το ίχνος το έπιασε (ΜΟΝΟ εκεί)
    const Pm = planForgetting(lookup);
    const shared = Pm.buildModuleGraph(root);
    Pm.buildShellPlan(root, configOf('a'), shared);
    const leaked = betaKeys(Pm.buildShellPlan(root, configOf('b'), shared));
    expect(leaked).toContain(before);                                                            // η τρύπα, αναπαραγμένη
    expect(leaked).not.toContain(after);
  }, 90_000);

  /** ΑΝΤΙΓΡΑΦΟ του `plan` πάνω σε μνήμη που ΔΕΝ βλέπει την αναζήτηση `lookup` (περνά ωμή, χωρίς καταγραφή). */
  function planForgetting(lookup) {
    const SC_PATH = path.join(LIB, 'source-cache');
    let mutated;
    jest.isolateModules(() => {
      const real = jest.requireActual(SC_PATH);
      const forgetful = memo => ({
        ...memo,
        onceTraced: (file, part, input, lookups, compute) => {
          const { [lookup]: hidden, ...seen } = lookups;
          return memo.onceTraced(file, part, input, seen, observed => compute({ ...observed, [lookup]: hidden }));
        },
      });
      jest.doMock(SC_PATH, () => ({ ...real, analysisFor: graph => forgetful(real.analysisFor(graph)) }));
      mutated = require(path.join(LIB, 'plan'));
    });
    jest.dontMock(SC_PATH);
    return mutated;
  }

  it('Ξ19 ΟΙ ΚΑΘΟΛΙΚΕΣ ΕΙΣΟΔΟΙ ΕΙΝΑΙ ΤΟΥ ΠΕΡΑΣΜΑΤΟΣ: η διαδρομή ΔΕΝ τις υπολογίζει· το κέλυφος ΜΙΑ φορά', () => {
    const GI_PATH = path.join(LIB, 'global-inputs');
    const { root, graph, configOf } = twoClosures();
    let calls = 0;
    let isolated;
    jest.isolateModules(() => {
      const real = jest.requireActual(GI_PATH);
      jest.doMock(GI_PATH, () => ({ ...real, computeGlobalInputs: (...args) => { calls += 1; return real.computeGlobalInputs(...args); } }));
      isolated = { P: require(path.join(LIB, 'plan')), RS: require(path.join(LIB, 'route-slices')) };
    });
    jest.dontMock(GI_PATH);
    const config = configOf('a');
    isolated.RS.buildRouteSlice(root, config, graph, 'src/app/b/page.tsx', {}, []);
    expect(calls).toBe(0);
    isolated.P.renderArtifacts(root, config, isolated.P.buildShellPlan(root, config, graph));
    expect(calls).toBe(1);
  }, 60_000);
});
