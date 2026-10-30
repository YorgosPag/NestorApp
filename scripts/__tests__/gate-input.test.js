/**
 * ADR-924 Ε1 — Η ΕΙΣΟΔΟΣ ΤΗΣ ΠΥΛΗΣ (`scripts/lib/gate-input.js`).
 *
 *   Ε1–Ε3  το SSoT πάνω σε ΠΡΑΓΜΑΤΙΚΟ προσωρινό git repo (το ευρετήριο του repo δεν αγγίζεται ποτέ):
 *          δίσκος ≠ ευρετήριο ΚΑΙ ΣΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ, untracked αόρατα, σβησμένο-από-δίσκο ορατό.
 *   Δ1     κάθε πύλη που μεταφέρθηκε διαβάζει ΜΟΝΟ μέσω της εισόδου: με την είσοδο στο χέρι, το `fs`
 *          δεν αγγίζεται ΠΟΤΕ για αρχείο του repo. (Η 3.107 ελέγχει ότι η κλειστότητα ΦΤΑΝΕΙ στο SSoT —
 *          αναγκαίο, όχι επαρκές· εδώ αποδεικνύεται ότι δεν υπάρχει ΠΑΡΑΚΑΜΨΗ.)
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { openGateInput, indexRequested, isTestSource } = require('../lib/gate-input');
const { importClosure } = require('../lib/ts-import-closure');

const ROOT = path.resolve(__dirname, '..', '..');

describe('Ε — η είσοδος πάνω σε προσωρινό repo', () => {
  let tmp;
  const git = (...args) => spawnSync('git', ['-C', tmp, ...args], { encoding: 'utf8' });
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    fs.writeFileSync(path.join(tmp, rel), text, 'utf8');
  };
  const stage = (rel, staged, disk = staged) => {
    write(rel, staged);
    git('add', rel);
    if (disk !== staged) write(rel, disk);
  };
  const abs = rel => path.join(tmp, rel).replace(/\\/g, '/');

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-input-'));
    git('init', '-q');
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test('Ε1α ευρετήριο: η σταδιοποιημένη παραβίαση ΚΡΙΝΕΤΑΙ, ακόμη κι αν ο δίσκος έχει τη διόρθωση', () => {
    stage('src/a.ts', 'violation\n', 'fixed\n');
    expect(openGateInput({ root: tmp, index: true }).read(abs('src/a.ts'))).toBe('violation\n');
    expect(openGateInput({ root: tmp }).read(abs('src/a.ts'))).toBe('fixed\n');
  });

  test('Ε1β ευρετήριο: η ξένη αστάδιοποίητη αλλαγή ΔΕΝ κρίνεται', () => {
    stage('src/a.ts', 'clean\n', 'foreign violation\n');
    expect(openGateInput({ root: tmp, index: true }).read('src/a.ts')).toBe('clean\n');
  });

  test('Ε2α untracked: αόρατο στο ευρετήριο (sources · exists · read · readJson), ορατό στον δίσκο', () => {
    stage('src/a.ts', 'a\n');
    write('src/untracked.ts', 'x\n');
    write('.registry.json', '{}');
    const index = openGateInput({ root: tmp, index: true });
    expect(index.sources(['src'])).toEqual([abs('src/a.ts')]);
    expect(index.exists('src/untracked.ts')).toBe(false);
    expect(index.read('src/untracked.ts')).toBeNull();
    expect(() => index.readJson('.registry.json')).toThrow(/λείπει από την όψη \(index\)/);
    const disk = openGateInput({ root: tmp });
    expect(disk.sources(['src'])).toEqual([abs('src/a.ts'), abs('src/untracked.ts')]);
    expect(disk.readJson('.registry.json')).toEqual({});
  });

  test('Ε2β σβησμένο από τον δίσκο αλλά στο ευρετήριο ⇒ υπάρχει στην όψη του commit', () => {
    stage('src/kept.ts', 'kept\n');
    fs.rmSync(path.join(tmp, 'src/kept.ts'));
    const index = openGateInput({ root: tmp, index: true });
    expect(index.exists('src/kept.ts')).toBe(true);
    expect(index.read('src/kept.ts')).toBe('kept\n');
    expect(openGateInput({ root: tmp }).exists('src/kept.ts')).toBe(false);
  });

  test('Ε2γ ίδιο κριτήριο αρχείου με το collectSourceFiles: ρίζες, .d.ts, node_modules', () => {
    for (const rel of ['src/a.ts', 'src/b.tsx', 'src/c.d.ts', 'src/x.js', 'docs/d.ts', 'src/node_modules/m.ts']) {
      stage(rel, 'x\n');
    }
    const want = [abs('src/a.ts'), abs('src/b.tsx')];
    expect(openGateInput({ root: tmp, index: true }).sources(['src'])).toEqual(want);
    expect(openGateInput({ root: tmp }).sources(['src'])).toEqual(want);
  });

  // ADR-924 §8.7 — το κλάδεμα ΚΑΤΑ ΟΝΟΜΑ έκρυβε τη διαδρομή `…/procurement/coverage/page.tsx` από κάθε πύλη.
  test('Ε2δ όνομα φακέλου ΔΕΝ κρύβει διαδρομή· τα παραγόμενα αγνοούνται μόνο αγκυρωμένα', () => {
    for (const rel of ['src/app/coverage/page.tsx', 'src/app/build/page.tsx', 'src/app/out/page.tsx', 'src/app/dist/page.tsx',
      'src/subapps/dxf-viewer/coverage/lcov.ts', 'packages/core/dist/index.ts']) {
      stage(rel, 'x\n');
    }
    const want = ['src/app/build/page.tsx', 'src/app/coverage/page.tsx', 'src/app/dist/page.tsx', 'src/app/out/page.tsx'].map(abs);
    expect(openGateInput({ root: tmp, index: true }).sources()).toEqual(want);
    expect(openGateInput({ root: tmp }).sources()).toEqual(want);
  });

  test('Ε2ε files: ΔΙΚΟ ΤΗΣ κριτήριο, ίδιο και στις δύο όψεις — accept · pruneDir · φάκελοι εργαλείων · untracked', () => {
    for (const rel of ['src/a.ts', 'src/b.d.ts', 'src/c.css', 'src/skip/d.ts', 'src/node_modules/e.ts', 'docs/f.ts']) {
      stage(rel, 'x\n');
    }
    write('src/untracked.ts', 'x\n');
    const opts = { accept: rel => /\.tsx?$/.test(rel), pruneDir: dir => dir === 'src/skip/' };
    const want = [abs('src/a.ts'), abs('src/b.d.ts')];
    expect(openGateInput({ root: tmp, index: true }).files(['src'], opts)).toEqual(want);
    expect(openGateInput({ root: tmp }).files(['src'], opts)).toEqual([...want, abs('src/untracked.ts')]);
    expect(() => openGateInput({ root: tmp }).files(['src'], { ...opts, minimum: 9 })).toThrow(/ΦΡΟΥΡΟΣ/);
    expect(openGateInput({ root: tmp }).rel(abs('src/a.ts'))).toBe('src/a.ts');
  });

  test('Ε5 baseline ratchet: με την όψη του commit κρίνεται η ΣΤΑΔΙΟΠΟΙΗΜΕΝΗ, όχι του δίσκου', () => {
    const { loadBaseline } = require('../lib/ratchet-baseline');
    stage('.b.json', '{"violations":["staged"]}', '{"violations":["disk"]}');
    const file = path.join(tmp, '.b.json');
    expect(loadBaseline(file, [], openGateInput({ root: tmp, index: true })).violations).toEqual(['staged']);
    expect(loadBaseline(file, [], openGateInput({ root: tmp })).violations).toEqual(['disk']);
    expect(loadBaseline(path.join(tmp, '.none.json'), [], openGateInput({ root: tmp, index: true }))).toBeNull();
  });

  test('Ε6 δυαδικά: readBytes δίνει τα bytes του COMMIT (μη έγκυρο UTF-8), και null για ό,τι λείπει', () => {
    const staged = Buffer.from([0x00, 0xff, 0xfe, 0x80, 0x0a]);
    fs.writeFileSync(path.join(tmp, 'font.bin'), staged);
    git('add', 'font.bin');
    fs.writeFileSync(path.join(tmp, 'font.bin'), Buffer.from([0x01, 0x02]));
    expect(openGateInput({ root: tmp, index: true }).readBytes('font.bin').equals(staged)).toBe(true);
    expect([...openGateInput({ root: tmp }).readBytes('font.bin')]).toEqual([0x01, 0x02]);
    expect(openGateInput({ root: tmp, index: true }).readBytes('none.bin')).toBeNull();
  });

  test('Ε7 grep · tracked: το κείμενο ΤΗΣ ΟΨΗΣ, ποτέ untracked', () => {
    stage('src/a.ts', 'needle\n', 'clean\n');
    stage('src/b.ts', 'clean\n', 'needle\n');
    write('src/untracked.ts', 'needle\n');
    expect(openGateInput({ root: tmp, index: true }).grep('needle', ['*.ts'])).toEqual(['src/a.ts']);
    // ίδια απάντηση με το `git grep --cached` (η όψη το απαντά με το κόστος του δίσκου)
    const { grepFiles } = require('../lib/git-index-snapshot');
    expect(grepFiles({ repoRoot: tmp, needle: 'needle', pathspecs: ['*.ts'], cached: true })).toEqual(['src/a.ts']);
    expect(openGateInput({ root: tmp }).grep('needle', ['*.ts'])).toEqual(['src/b.ts']);
    expect(openGateInput({ root: tmp }).grep('absent')).toEqual([]);
    expect(openGateInput({ root: tmp, index: true }).tracked()).toEqual(['src/a.ts', 'src/b.ts']);
    expect(openGateInput({ root: tmp }).tracked()).toEqual(['src/a.ts', 'src/b.ts']);
  });

  test('Ε8 children: φάκελοι της ΟΨΗΣ — κενός ή μόνο-untracked φάκελος ΔΕΝ υπάρχει στο commit', () => {
    stage('src/app/a/page.tsx', 'x\n');
    stage('src/app/(g)/b/page.tsx', 'x\n');
    write('src/app/untracked-only/page.tsx', 'x\n');
    fs.mkdirSync(path.join(tmp, 'src/app/empty'), { recursive: true });
    expect(openGateInput({ root: tmp, index: true }).children('src/app')).toEqual({ files: [], dirs: ['(g)', 'a'] });
    expect(openGateInput({ root: tmp }).children('src/app')).toEqual({ files: [], dirs: ['(g)', 'a', 'empty', 'untracked-only'] });
    expect(openGateInput({ root: tmp, index: true }).children(abs('src/app/a'))).toEqual({ files: ['page.tsx'], dirs: [] });
    expect(openGateInput({ root: tmp, index: true }).children('src/none')).toBeNull();
    expect(openGateInput({ root: tmp }).children('src/none')).toBeNull();
  });

  test('Ε10 ζώνη ασφαλείας: εκτέλεση από τον δίσκο αποκλίνοντος αρχείου ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, μόνο στην όψη του commit', () => {
    stage('tailwind.config.ts', 'staged\n', 'foreign edit\n');
    stage('same.ts', 'x\n');
    expect(() => openGateInput({ root: tmp, index: true }).assertUndivergent(['tailwind.config.ts'], 'το εκτελεί το jiti'))
      .toThrow(/tailwind\.config\.ts: ο δίσκος ΑΠΟΚΛΙΝΕΙ από το ευρετήριο και το εκτελεί το jiti/);
    expect(() => openGateInput({ root: tmp, index: true }).assertUndivergent([abs('same.ts')], 'x')).not.toThrow();
    expect(() => openGateInput({ root: tmp }).assertUndivergent(['tailwind.config.ts'], 'x')).not.toThrow();
  });

  test('Ε11 σκανδάλη: `staged` = ό,τι αγγίζει το commit (όχι σβησμένα, όχι untracked)· μη-ASCII όνομα ΑΥΤΟΥΣΙΟ', () => {
    stage('src/old.ts', 'x\n');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'base');
    git('rm', '-q', 'src/old.ts');
    stage('src/i18n/locales/el/Αρχείο.json', '{}\n');
    stage('src/a.ts', 'a\n');
    write('src/untracked.ts', 'u\n');
    const want = [abs('src/a.ts'), abs('src/i18n/locales/el/Αρχείο.json')];
    // ΚΑΙ στις δύο όψεις η ίδια σκανδάλη· το φίλτρο δέχεται σχετικό posix
    for (const index of [false, true]) {
      expect(openGateInput({ root: tmp, index }).staged().sort()).toEqual(want);
      expect(openGateInput({ root: tmp, index }).staged(rel => rel.endsWith('.json'))).toEqual([want[1]]);
    }
  });

  test('Ε12 εκτέλεση: `requireFromInput` ΕΚΤΕΛΕΙ ό,τι θα δεσμευτεί (και την κλειστότητά του), ο δίσκος τον δίσκο', () => {
    stage('src/value.ts', "import { part } from './part';\nexport const VALUE = `staged-${part}`;\n",
      "import { part } from './elsewhere';\nexport const VALUE = `foreign-${part}`;\n");
    stage('src/part.ts', "export const part = 'p1';\n");
    write('src/elsewhere.ts', "export const part = 'e';\n");   // η κλειστότητα του ΔΙΣΚΟΥ είναι άλλη
    const { requireFromInput } = require('../lib/ts-module-loader');
    const run = index => {
      const loaded = requireFromInput({ input: openGateInput({ root: tmp, index }), entries: ['src/value.ts'] });
      loaded.dispose();
      return loaded.modules[0].VALUE;
    };
    expect(run(true)).toBe('staged-p1');
    expect(run(false)).toBe('foreign-e');
  });

  test('Ε3 φρουρός: σάρωση που «δεν κοίταξε» ΣΚΑΕΙ, ποτέ σιωπηλό πράσινο', () => {
    stage('src/a.ts', 'a\n');
    const index = openGateInput({ root: tmp, index: true });
    expect(() => index.productionSources()).toThrow(/ΦΡΟΥΡΟΣ/);
    expect(() => index.sources(['src'], { minimum: 2 })).toThrow(/ΦΡΟΥΡΟΣ/);
    expect(index.sources(['src'], { minimum: 1 })).toEqual([abs('src/a.ts')]);
  });
});

// ADR-924 §8.8 — ΜΕΤΡΗΜΕΝΟ: όταν το `runSetRatchetCli` άρχισε να δίνει την είσοδο ως 2ο όρισμα, οι 3.50 και 3.60
// (`measure(args, root)`) πήραν την είσοδο ΩΣ ΡΙΖΑ ⇒ «The "path" argument must be of type string» σε ΚΑΘΕ commit.
describe('Ε9 — συμβόλαιο του runSetRatchetCli: το 2ο όρισμα του measure ΕΙΝΑΙ η είσοδος', () => {
  /** Το σώμα κάθε descriptor (`DESCRIPTOR = {` ή `runSetRatchetCli({`) ως το πρώτο `}` στην αρχή γραμμής. */
  const descriptorBodies = text => [...text.matchAll(/(?:DESCRIPTOR\s*=\s*\{|runSetRatchetCli\(\{)([\s\S]*?)\n\s{0,2}\}/g)]
    .map(m => m[1]);
  const scripts = fs.readdirSync(path.join(ROOT, 'scripts'))
    .filter(name => name.endsWith('.js'))
    .map(name => [name, fs.readFileSync(path.join(ROOT, 'scripts', name), 'utf8')])
    .filter(([, text]) => /runSetRatchetCli\s*\(/.test(text)
      && descriptorBodies(text).some(body => /^\s+measure,\s*$/m.test(body)));

  test('υπάρχουν descriptors να κριθούν (ο φρουρός «δεν κοίταξε»)', () => {
    expect(scripts.length).toBeGreaterThan(5);
  });

  test.each(scripts.map(([name]) => [name]))('%s', (name) => {
    const text = scripts.find(([n]) => n === name)[1];
    const signature = text.match(/(?:async\s+)?function\s+measure\s*\(([^)]*)\)/);
    const params = signature ? signature[1].split(',').map(p => p.trim().split(/\s*=/)[0]).filter(Boolean) : [];
    expect(params.length < 2 || params[1] === 'input').toBe(true);
  });
});

describe('Ε4 — σημαία και φίλτρο', () => {
  test('indexRequested ⇔ --index στα ορίσματα', () => {
    expect(indexRequested(['node', 'x.js', '--index'])).toBe(true);
    expect(indexRequested(['node', 'x.js', 'src/a.ts'])).toBe(false);
  });

  test('isTestSource: __tests__ · .test. · .spec.', () => {
    expect(['src/__tests__/a.ts', 'src/a.test.ts', 'src/a.spec.tsx'].every(isTestSource)).toBe(true);
    expect(isTestSource('src/latest.ts')).toBe(false);
  });
});

/** Οι πύλες της Φάσης 1 (ADR-924 §8) — καθεμία `measure({ input, codeFiles })`. */
const MIGRATED = [
  ['3.83', '../check-sender-authority'],
  ['3.87', '../check-cde-authority'],
  ['3.88', '../check-project-member-authority'],
  ['3.89', '../check-network-thread-authority'],
  ['3.99', '../check-view-signal-authority'],
  ['3.100', '../check-retired-property-write'],
  ['3.102', '../check-floor-stack-authority'],
  ['3.104', '../check-tour-presence-authority'],
  ['3.105', '../check-listing-terrain-authority'],
  ['3.106', '../check-catalog-schema-authority'],
  ['3.58', '../check-workspace-authority'],
  ['3.59', '../check-point-vocabulary'],
  ['3.81', '../check-product-identity'],
];

/**
 * Φάση 2 (ADR-924 §8.8): πύλες που ΔΕΝ κρίνουν «όλα τα αρχεία παραγωγής» (ζώνες, μητρώα, δικό τους κριτήριο) —
 * ένα δείγμα του `src` δεν θα περνούσε από τους κλάδους τους. Μετρώνται με την ΠΛΗΡΗ είσοδο: `measure({ input })`.
 */
const MIGRATED_FULL = [
  ['3.64', '../check-text-measure-tier'],
  ['3.66', '../check-gate-inventory'],
  ['3.67', '../check-font-promise'],
  ['3.69', '../check-font-assets'],
  ['3.68', '../check-authority-registry'],
  ['3.63', '../check-shell-surface'],
  ['3.16', '../check-firestore-rules-test-coverage', (gate, input) => {
    const manifest = gate.parseManifest(input);
    gate.parseBimTiers(input);
    require('../lib/firestore-rules/completeness').validateCompleteness(input);
    return [gate.validateTestFilesExist(manifest, input), gate.validateTestFileContract(manifest, input)];
  }],
  ['3.50', '../check-zindex-scale', (gate, input) => gate.measure([], input.root, input)],
  ['3.80', '../check-module-init', (gate, input) => gate.measure(input)],
  ['3.46', '../check-e2e-executability', (gate, input) => {
    require('../lib/e2e-executability/bot-patterns').readBotPatterns(input.root, input);
    // `devices` ενεμένα, όπως στη σουίτα της 3.46 (το `@playwright/test` δεν φορτώνεται σε jsdom)
    const devices = new Proxy({}, { get: () => ({ userAgent: 'Mozilla/5.0 Chrome' }) });
    require('../lib/e2e-executability/project-identity').readProjects({ root: input.root, input, devices });
    return [gate.readSpecPaths(input.root, input), gate.readScripts(input.root, input)];
  }],
  ['3.44', '../check-address-vocabulary-coverage', (gate, input) => gate.measure([], input.root, input)],
  ['3.97', '../check-i18n-raw-fallback', (gate, input) => gate.scan(
    require('../lib/i18n-raw-fallback/ratchet').walkScope(input.root, 'src', input).slice(0, 400), input)],
  ['3.78', '../check-rate-limit-policy', (gate, input) => gate.measure([], input)],
  // η 3.49 δεν διαβάζει ΚΕΙΜΕΝΟ (μόνο ονόματα του ευρετηρίου): η άγκυρα αποδεικνύει μόνο «καμία διαρροή»
  ['3.49', '../check-adr-identity', (gate, input) => { gate.measure([], input); input.read('package.json'); }],
  ['3.7', '../check-ssot-imports', (gate, input) => {
    const { exemptRe, modules } = require('../lib/ssot/registry').loadRegistry(gate.REGISTRY_FILE, input);
    const { files } = require('../lib/ssot/baseline').loadBaseline(gate.BASELINE_FILE, input);
    return input.productionSources().slice(0, 300).map((f) => gate.checkFile(input.rel(f), modules, files, exemptRe, input));
  }],
  ['3.43', '../lib/css-vars/custom-property-index', (lib, input) => lib.scanCssUsages(input.root,
    lib.listCssFiles(input.root, input), lib.buildDefinitionIndex(input.root, input), input)],
  ['3.39', '../check-theme-pairing-ratchet'],
  ['3.42', '../check-tailwind-theme-classes-ratchet'],
  ['3.74', '../check-public-listing-read-boundary', (gate, input) => gate.scanFiles(
    gate.collectSourceFiles(input.root + '/src', input.root, [], input), input.root, undefined, input)],
  ['3.70', '../check-unbound-identifiers', (gate, input) => gate.measure([], input, input.productionSources().slice(0, 300))],
  // η αλυσίδα του `main` της 3.45: αναγνώστης · API · επιφάνειες · σάρωση του subapp
  ['3.45', '../lib/contrast-promise/promise-sites', (sites, input) => {
    const reader = sites.createReader(input.root, input);
    const api = sites.readAdaptiveApi(input.root, reader);
    require('../lib/contrast-promise/presentable-surfaces').presentableSurfaces(input.root, input);
    const entries = input.sources([sites.SCAN_ROOT]).slice(0, 300)
      .map((abs) => ({ abs, rel: input.rel(abs) }));
    return sites.promiseSites(entries, api, reader);
  }],
  ['3.55', '../lib/prerender/judge', (gate, input) => gate.judgeAll(input.root, input)],
  ['3.52', '../check-shell-boundary', (gate, input) => gate.analyse(input.root, { input })],
  ['3.95', '../lib/basemap-sources/gate', (gate, input) => gate.sweep(input.root, { input })],
  ['3.61', '../lib/navigation-boundary/gate', (gate, input) => gate.sweep(input.root, undefined, input)],
  ['3.75', '../lib/map-boundary/gate', (gate, input) => gate.sweep(input.root, undefined, input)],
  ['3.103', '../check-paper-ink'],
  ['3.60', '../check-workspace-scope', (gate, input) => gate.measure([], undefined, input)],
  ['3.53', '../check-adr-section-refs', (gate, input) => gate.analyse(input.root, input)],
  ['3.48', '../check-empty-select-item', (gate, input) => gate.measure(gate.collectAllFiles('src', input).slice(0, 400), input)],
  ['3.56', '../check-listing-custody', (gate, input) => gate.measure(input)],
  ['3.71', '../check-locale-duplicate-keys', (gate, input) => gate.measure(['--all'], input)],
  ['3.72', '../check-shell-utilities', (gate, input) => gate.analyse(input.root, { input })],
  ['3.76', '../lib/listing-model-custody/gate', (gate, input) => gate.sweep(input.root, input)],
  ['3.96', '../lib/rules-liveness/gate', (gate, input) => gate.sweep(input.root, input.readRequired)],
  ['3.98', '../check-capture-api-contract', (gate, input) => gate.judge(input.root, input)],
  ['3.93', '../lib/functions-projection/judge', (gate, input) => gate.judge(input.root, input)],
  ['3.65', '../lib/one-version/gate', (gate, input) => gate.sweep(input.root, input)],
  // η 3.54: ό,τι δηλώνει το commit (workflows · scripts · εξαιρέσεις)· η διαμέριση 3.47 είναι δηλωμένο περιβάλλον (§8.9)
  ['3.54', '../lib/anchor-execution/census', (lib, input) => [lib.collectInvocations(input.root, new Set(), input),
    lib.readDeclarations(input.root, new Set(), input)]],
  ['3.92', '../check-idempotency-boundary', (gate, input) => gate.measure(input.root, input)],
  // βαριά (~40s πλήρης): δείγμα για τον βρόχο — η επίλυση μένει πλήρης
  ['3.62', '../check-public-surface', (gate, input) => gate.measure({ input, codeFiles: input.productionSources().slice(0, 300) })],
  // ── Φ3, δεύτερο κύμα (πύλες με σκανδάλη, ADR-924 §8.10) ──
  ['3.11', '../check-navigation-labels', (gate, input) => gate.measure(input)],
  ['3.14', '../check-audit-value-catalogs', (gate, input) => gate.validate(input)],
  ['3.19', '../check-storage-rules-test-coverage', (gate, input) => {
    gate.parseStorageRulesBlocks(input);
    return gate.validateTestFiles(gate.parseManifest(input).coverage, input);
  }],
  ['3.21', '../check-notification-keys-locale', (gate, input) => gate.measure(input)],
  ['3.41', '../lib/contrast/state-marks', (lib, input) => lib.readStateMarkFamilies(input.root, input)],
  // ratchet ανά αρχείο (`per-file-ratchet`): πλήρης σάρωση ΚΑΙ κρίση δείγματος (η baseline διαβάζεται μόνο στην κρίση)
  ['3.20', '../check-notification-keys-ratchet', (gate, input) => [gate.run(['--all'], input),
    gate.run(input.productionSources().slice(0, 300), input)]],
  ['3.23', '../check-native-tooltip', (gate, input) => gate.run(tsxSample(input), input)],
  ['3.24', '../check-tabs-import-ratchet', (gate, input) => gate.run(tsxSample(input), input)],
  ['3.25', '../check-no-flash-ratchet', (gate, input) => [gate.run(['node', 'x', '--all'], input),
    gate.run(['node', 'x', ...input.productionSources().filter((f) => /\/hooks\/use/.test(f)).slice(0, 50)], input)]],
  ['3.26', '../check-tailwind-palette-ratchet', (gate, input) => [gate.run(['--report'], input),
    gate.run(input.productionSources().slice(0, 300), input)]],
  ['3.27', '../check-dxf-timing-ratchet', (gate, input) => [gate.run(['--report'], input),
    gate.run(input.sources(['src/subapps/dxf-viewer']).slice(0, 300), input)]],
  // i18n: locale · bundles · compat · baseline από την είσοδο (`makeDeps(…, input)`)
  ['3.8', '../check-i18n-missing-keys', (gate, input) => gate.run(
    input.productionSources().filter((f) => f.endsWith('.tsx')).slice(0, 150).map(input.rel), input)],
  ['3.12', '../check-option-i18n-keys', (gate, input) => gate.run(
    input.files(['src/config'], { accept: (rel) => rel.endsWith('.ts') }).map(input.rel), input)],
  ['3.13', '../check-i18n-resolver-reachability', (gate, input) => gate.run(['--all'], input)],
  ['3.36', '../validate-i18n-config', (gate, input) => gate.measure(input)],
  // CI: μητρώο · workflows · actions
  ['3.37', '../lib/ci/gate-registry', (lib, input) => lib.auditGateTiers({ repoRoot: input.root, input })],
  ['3.57', '../check-production-build-parity', (gate, input) => gate.measure(input.root, input)],
  ['3.79', '../check-shadowed-modules', (gate, input) => [gate.measure(input), gate.loadBaseline(input)]],
  ['3.17', '../check-entity-audit-coverage', (gate, input) => gate.main(
    input.productionSources().slice(0, 300).map(input.rel), input)],
  // Firestore: κατάλογοι (`firestore-ast-loaders`) · μανιφέστο · αρχεία · baseline — δείγμα με πραγματικά ερωτήματα
  ['3.15', '../check-firestore-index-coverage', (gate, input) => {
    const loaders = require('../_shared/firestore-ast-loaders');
    require('../_shared/firestore-index-matcher').loadIndexCatalog(path.join(input.root, 'firestore.indexes.json'), input);
    [loaders.loadCollectionsMap({ input }), loaders.loadTenantOverrides(input), loaders.loadReadPathFields(input)];
    return input.grep('firestoreQueryService', ['src/*']).slice(0, 60)
      .map((rel) => gate.extractCallSitesFromFile(path.join(input.root, rel), input));
  }],
  ['3.91', '../check-firestore-admin-index', (gate, input) => [gate.loadBaseline(input),
    gate.analyse(gate.resolveTargets(input.grep('.collection(', ['src/*']).slice(0, 60), input), input)]],
  // η 3.18 στον hook: smoke = μόνο η baseline (η πλήρης σάρωση είναι ο bash σαρωτής στο CI — δηλωμένο όριο)
  ['3.18', '../check-ssot-discover-ratchet', (gate, input) => gate.loadBaseline(undefined, input)],
  ['3.35', '../check-firestore-tenant-scope', (gate, input) => [gate.loadBaseline(input),
    gate.scanTargets(gate.resolveTargets(input.grep('where(', ['src/*']).slice(0, 60), input), input)]],
];

/** Δείγμα `.tsx` (σχετικά μονοπάτια, όπως τα δίνει ο εκτελεστής) — η πλήρης ανάλυση AST κοστίζει λεπτά. */
function tsxSample(input) {
  return input.files(['src'], { accept: (rel) => rel.endsWith('.tsx') }).slice(0, 200).map(input.rel);
}

describe('Δ1 — καμία παράκαμψη: με την είσοδο στο χέρι, η πύλη δεν ανοίγει το fs για αρχείο του repo', () => {
  const FS_READERS = ['readFileSync', 'existsSync', 'statSync', 'readdirSync'];
  const disk = openGateInput({ root: ROOT });
  // Δείγμα: τα σχετικά αρχεία κάθε πύλης βρίσκονται σε όλο το src — 400 αρκούν για να περάσει κάθε κλάδος ανάγνωσης.
  const sample = disk.productionSources().slice(0, 400);
  const inRepo = p => {
    if (/^node:/.test(String(p))) return false;   // specifier του Node (ο φορτωτής TS), όχι αρχείο
    const rel = path.relative(ROOT, String(p)).replace(/\\/g, '/');
    return !rel.startsWith('..') && !path.isAbsolute(rel) && rel !== 'node_modules' && !rel.startsWith('node_modules/');
  };

  /** Είσοδος δίσκου που καταγράφει — οι δικές της αναγνώσεις ΔΕΝ είναι διαρροή. */
  function recordingInput(state) {
    const through = fn => (...args) => {
      state.inside += 1;
      try { return fn(...args); } finally { state.inside -= 1; }
    };
    return {
      ...disk,
      read: through(file => { state.reads += 1; return disk.read(file); }),
      exists: through(disk.exists),
      readJson: through(disk.readJson),
      readRequired: through(file => { state.reads += 1; return disk.readRequired(file); }),
      productionSources: through(disk.productionSources),
      sources: through(disk.sources),
      files: through(disk.files),
      children: through(disk.children),
      readBytes: through(disk.readBytes),
    };
  }

  afterEach(() => jest.restoreAllMocks());

  /** Κατάσκοπος σε κάθε αναγνώστη του `fs`: ανάγνωση αρχείου του repo ΕΞΩ από την είσοδο = διαρροή. */
  function spyLeaks(state) {
    for (const name of FS_READERS) {
      const original = fs[name];
      jest.spyOn(fs, name).mockImplementation(function spy(...args) {
        if (state.inside === 0 && inRepo(args[0])) state.leaks.push(`${name}(${args[0]})`);
        return original.apply(this, args);
      });
    }
  }

  test.each(MIGRATED)('CHECK %s', (_id, modulePath) => {
    const gate = require(modulePath);
    const state = { inside: 0, reads: 0, leaks: [] };
    spyLeaks(state);
    gate.measure({ input: recordingInput(state), codeFiles: sample });
    expect(state.leaks).toEqual([]);
    expect(state.reads).toBeGreaterThanOrEqual(sample.length);
  });

  /**
   * ΔΗΛΩΜΕΝΕΣ αναγνώσεις ΠΕΡΙΒΑΛΛΟΝΤΟΣ — κλειστό σύνολο, με λόγο, ποτέ μοτίβο. Δεν κρίνουν το commit: περιγράφουν
   * το ΕΓΚΑΤΕΣΤΗΜΕΝΟ περιβάλλον, που χτίστηκε από τον ΔΙΣΚΟ. Πρόδρομος των δηλωμένων διαφυγών της Φ4 (ADR-924 §8.5).
   */
  // ADR-924 Φ4: το ΙΔΙΟ μητρώο με την παγίδα του worker (`.gate-commit-view.json` → `environment`) — μία πηγή, με λόγο
  const ENVIRONMENT_READS = Object.fromEntries(Object.entries(
    JSON.parse(fs.readFileSync(path.join(ROOT, '.gate-commit-view.json'), 'utf8')).environment || {},
  ).map(([id, entry]) => [id, entry.files]));
  // ό,τι ΕΚΤΕΛΕΙΤΑΙ (`ts-module-loader.requireFromInput`) το διαβάζει ο φορτωτής modules, από την όψη που επέλεξε η είσοδος.
  // Δηλώνεται ως η ΚΛΕΙΣΤΟΤΗΤΑ εισαγωγών των entries — υπολογισμένη, ποτέ χειρόγραφη: ανάγνωση έξω από αυτήν = διαρροή.
  const EXECUTED = {
    '3.98': () => importClosure({ entries: Object.values(require('../lib/capture-api-contract/plan').SOURCES),
      readText: disk.read, has: disk.exists }),
  };
  const repoRel = (leak) => path.relative(ROOT, leak.slice(leak.indexOf('(') + 1, -1)).split(path.sep).join('/');

  test.each(MIGRATED_FULL)('CHECK %s (πλήρης είσοδος)', async (id, modulePath, invoke = (g, input) => g.measure({ input })) => {
    const gate = require(modulePath);
    const executed = EXECUTED[id] ? EXECUTED[id]() : [];   // ΠΡΙΝ τον κατάσκοπο: η δική μας ανάγνωση δεν μετρά
    const state = { inside: 0, reads: 0, leaks: [] };
    spyLeaks(state);
    await invoke(gate, recordingInput(state));
    const declared = new Set([...(ENVIRONMENT_READS[id] || []), ...executed]);
    expect(state.leaks.filter((leak) => !declared.has(repoRel(leak)))).toEqual([]);
    expect(state.reads).toBeGreaterThan(0);
  });
});
