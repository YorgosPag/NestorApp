/**
 * @jest-environment node
 *
 * # ΑΓΚΥΡΕΣ — CHECK 3.47, πύλη διαμέρισης των test (ADR-776)
 *
 * ## Οι μεταλλάξεις είναι στις ΕΙΣΟΔΟΥΣ, όχι στην πύλη
 * Κάθε Μ φτιάχνει **μίνι-repo με πραγματικό `git init`** από αρχεία με το σχήμα των αληθινών,
 * αλλάζει **μία** γραμμή, και απαιτεί να αλλάξει η ετυμηγορία. Το `miniRepo` **ουρλιάζει** αν
 * μια μετάλλαξη δεν άλλαξε τίποτα (μάθημα ADR-772 §Μ11: μετάλλαξη που δεν αλλάζει συμπεριφορά
 * δεν αποδεικνύει τίποτα).
 *
 * Χρησιμοποιείται **αληθινό git** και όχι προσομοίωση, γιατί δύο από τις τρεις καταστάσεις
 * παράβασης ρωτούν το git («tracked;», «ignored;»). Μια ψεύτικη απάντηση εκεί θα έκανε την
 * πύλη να δοκιμάζεται πάνω σε κόσμο που δεν υπάρχει.
 *
 * ## Τα Π είναι χειρόγραφα ΕΠΙΤΗΔΕΣ
 * Ο σαρωτής παίρνει τους εκτελεστές **από τα ίδια τα configs**, οπότε ένα test που τους
 * ξαναϋπολογίζει με τους ίδιους helpers θα επικύρωνε τον εαυτό του (ADR-587 §6.1).
 */

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PROJECT_ROOT } = require('../lib/jest-partition/jest-configs');
const { literalDirectoryPrefixOf } = require('../lib/jest-partition/jest-configs');
const {
  derivedTestPathIgnorePatterns,
  gitIgnoredDirectoryPrefixes,
  prefixToPattern,
  siblingOwnedPrefixes,
} = require('../lib/jest-partition/derived-ignores');
const {
  ALL_STATES,
  VIOLATION_STATES,
  buildCensus,
  classify,
} = require('../lib/jest-partition/census');
const { stringLiteralsOf } = require('../lib/jest-partition/executors');

jest.setTimeout(120000);

const DERIVED_MODULE = path
  .join(PROJECT_ROOT, 'scripts', 'lib', 'jest-partition', 'derived-ignores.js')
  .split(path.sep)
  .join('/');

/** Το default config του μίνι-repo — καταναλώνει την **πραγματική** παραγωγή εξαιρέσεων. */
const DEFAULT_CONFIG = [
  `const { derivedTestPathIgnorePatterns } = require(${JSON.stringify(DERIVED_MODULE)});`,
  'module.exports = {',
  "  testEnvironment: 'jsdom',",
  "  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],",
  "  testPathIgnorePatterns: ['/e2e/', '\\\\.spec\\\\.(ts|tsx|js|jsx)$', ...derivedTestPathIgnorePatterns(__dirname)],",
  '};',
  '',
].join('\n');

const SIBLING_CONFIG = (dir, suffix) =>
  [
    'module.exports = {',
    `  displayName: '${dir}',`,
    "  testEnvironment: 'node',",
    '  rootDir: __dirname,',
    `  testMatch: ['<rootDir>/tests/${dir}/suites/**/*.${suffix}.test.ts'],`,
    '};',
    '',
  ].join('\n');

/** Το βασικό σχήμα δέντρου — ένα default config, ένα αδέλφι, τρία αρχεία test. */
function baseTree() {
  return {
    'jest.config.js': DEFAULT_CONFIG,
    'jest.config.storage-rules.js': SIBLING_CONFIG('storage-rules', 'storage'),
    '.gitignore': 'node_modules/\n',
    'tests/storage-rules/suites/cad-files.storage.test.ts': "it('x', () => {});\n",
    'src/app/__tests__/plain.test.ts': "it('x', () => {});\n",
    'src/util/__tests__/other.test.tsx': "it('x', () => {});\n",
  };
}

let created = 0;

/**
 * Ένα μίνι-repo με πραγματικό git.
 *
 * ⚠️ `expectDifferentFrom` είναι το «ουρλιαχτό»: αν μια μετάλλαξη αφήσει το δέντρο ίδιο, το
 * test αποτυγχάνει **εκεί**, όχι στην ετυμηγορία — αλλιώς θα περνούσε πράσινο αποδεικνύοντας
 * μηδέν.
 */
function miniRepo(tree, { expectDifferentFrom } = {}) {
  if (expectDifferentFrom !== undefined) {
    expect(JSON.stringify(tree)).not.toEqual(JSON.stringify(expectDifferentFrom));
  }
  created += 1;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `jest-partition-${created}-`));
  for (const [relative, content] of Object.entries(tree)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  cp.execSync('git init --quiet', { cwd: root });
  cp.execSync('git add -A', { cwd: root, stdio: 'ignore' });
  return root;
}

/** Οι καταστάσεις με πλήθος > 0, ως χάρτης — διαβάζεται σαν πρόταση. */
function statesOf(census) {
  return Object.fromEntries(
    Object.entries(census.byState)
      .filter(([, entries]) => entries.length > 0)
      .map(([state, entries]) => [state, entries.length]),
  );
}

// ────────────────────────────────────────────────────────────────────────────────────
describe('Μ0 — η πύλη είναι πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  let census;
  beforeAll(() => {
    census = buildCensus(PROJECT_ROOT);
  });

  it('Μ0.1 καμία παράβαση', () => {
    expect(census.violations).toEqual([]);
  });

  it('Μ0.2 η λογιστική κλείνει — κάθε αρχείο σε ακριβώς μία κατάσταση', () => {
    const counted = ALL_STATES.reduce((sum, state) => sum + census.byState[state].length, 0);
    expect(counted).toBe(census.total);
  });

  it('Μ0.3 και τα 5 e2e spec είναι playwright-owned, ΟΧΙ σιωπηλά αγνοημένα', () => {
    const owned = census.byState['playwright-owned'].map((entry) => entry.file).sort();
    expect(owned).toEqual([
      'src/components/contacts/e2e/contact-mutation-impact.e2e.spec.ts',
      'src/subapps/dxf-viewer/e2e/bim-3d-visual-regression.spec.ts',
      'src/subapps/dxf-viewer/e2e/dxf-visual-regression.spec.ts',
      'src/subapps/dxf-viewer/e2e/visual-cross-browser.spec.ts',
      'src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundCanvas.e2e.spec.ts',
    ]);
  });

  it('Μ0.4 και τα 5 jest configs έχουν ιδιοκτησία — κανένα δεν είναι νεκρό', () => {
    const withFiles = new Set(census.byState['jest-owned'].map((entry) => entry.owners[0]));
    expect([...withFiles].sort()).toEqual([
      'jest.config.firestore-rules.js',
      'jest.config.functions-integration.js',
      'jest.config.js',
      'jest.config.service-integration.js',
      'jest.config.storage-rules.js',
    ]);
  });
});

// ────────────────────────────────────────────────────────────────────────────────────
describe('Μ — μεταλλάξεις στις εισόδους', () => {
  it('Μ1 δύο αδέλφια διεκδικούν τον ίδιο φάκελο ⇒ multi-owned', () => {
    const base = baseTree();
    const mutated = {
      ...base,
      'jest.config.storage-duplicate.js': SIBLING_CONFIG('storage-rules', 'storage'),
    };
    expect(statesOf(buildCensus(miniRepo(base)))['multi-owned']).toBeUndefined();
    const census = buildCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)['multi-owned']).toBe(1);
    expect(census.violations[0].owners.sort()).toEqual([
      'jest.config.storage-duplicate.js',
      'jest.config.storage-rules.js',
    ]);
  });

  it('Μ2 build artifact σε gitignored φάκελο που ΔΕΝ βλέπει το Στρώμα 1 ⇒ build-artifact', () => {
    const base = baseTree();
    const mutated = {
      ...base,
      // βάθος 2 ⇒ η φθηνή παραγωγή του jest.config.js δεν το διαβάζει· η πύλη ρωτά το git
      'pkg/inner/.gitignore': 'out/\n',
      'pkg/inner/out/__tests__/compiled.test.js': "it('x', () => {});\n",
    };
    const census = buildCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)['build-artifact']).toBe(1);
    expect(census.violations[0].file).toBe('pkg/inner/out/__tests__/compiled.test.js');
  });

  it('Μ3 tracked αρχείο test που δεν διεκδικεί κανείς ⇒ unowned', () => {
    // ⚠️ Το default config διεκδικεί **κάθε** test-shaped αρχείο, οπότε ορφανό μπορεί να
    // υπάρξει ΜΟΝΟ στο σύνορο που το ίδιο εξαιρεί: ένα `.spec.` εκτός `testDir` του Playwright.
    // Αυτή είναι ακριβώς η κλάση των 369 tests του CHECK 3.46 — όχι υποθετικό σχήμα.
    const base = baseTree();
    const mutated = { ...base, 'tests/orphan/lost.spec.ts': "it('x', () => {});\n" };
    const census = buildCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census).unowned).toBe(1);
    expect(census.violations[0].file).toBe('tests/orphan/lost.spec.ts');
  });

  it('Μ4 αδέλφι με glob χωρίς σταθερό φάκελο ⇒ πετάει, δεν σβήνει το δέντρο', () => {
    const base = baseTree();
    const mutated = {
      ...base,
      'jest.config.storage-rules.js': SIBLING_CONFIG('storage-rules', 'storage').replace(
        "'<rootDir>/tests/storage-rules/suites/**/*.storage.test.ts'",
        "'**/*.storage.test.ts'",
      ),
    };
    const root = miniRepo(mutated, { expectDifferentFrom: base });
    expect(() => buildCensus(root)).toThrow(/δεν έχει σταθερό φάκελο/);
  });

  it('Μ5 αδέλφι χωρίς testMatch ⇒ πετάει με όνομα', () => {
    const base = baseTree();
    const mutated = {
      ...base,
      'jest.config.storage-rules.js': "module.exports = { testEnvironment: 'node' };\n",
    };
    const root = miniRepo(mutated, { expectDifferentFrom: base });
    expect(() => buildCensus(root)).toThrow(/δεν δηλώνει testMatch/);
  });

  it('Μ6 playwright.config.ts χωρίς αναλύσιμα testDir/testMatch ⇒ πετάει', () => {
    const base = baseTree();
    const mutated = {
      ...base,
      'playwright.config.ts': 'export default defineConfig({ testDir: someVariable });\n',
    };
    const root = miniRepo(mutated, { expectDifferentFrom: base });
    expect(() => buildCensus(root)).toThrow(/δεν δηλώνει αναλύσιμα testDir\/testMatch/);
  });

  it('Μ7 αστάδιαστο αρχείο δεν κρίνεται — μόλις γίνει git add, κρίνεται', () => {
    const base = baseTree();
    const root = miniRepo(base);
    fs.mkdirSync(path.join(root, 'tests', 'orphan'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tests/orphan/wip.spec.ts'), "it('x',()=>{});\n");

    const before = buildCensus(root);
    expect(statesOf(before).unowned).toBeUndefined();
    expect(statesOf(before)['untracked-unowned']).toBe(1);

    cp.execSync('git add -A', { cwd: root, stdio: 'ignore' });
    const after = buildCensus(root);
    expect(statesOf(after).unowned).toBe(1);
  });

  it('Μ8 το σύνορο Playwright: e2e spec ανήκει στο Playwright, όχι στο jest', () => {
    const base = baseTree();
    const mutated = {
      ...base,
      'playwright.config.ts':
        "export default defineConfig({ testDir: './src', testMatch: ['**/e2e/**/*.spec.ts'] });\n",
      'src/feature/e2e/flow.spec.ts': "it('x', () => {});\n",
    };
    const census = buildCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(census.violations).toEqual([]);
    expect(statesOf(census)['playwright-owned']).toBe(1);
  });

  it('Μ9 χωρίς playwright.config.ts το ίδιο spec γίνεται unowned — δεν εξαφανίζεται', () => {
    const base = baseTree();
    const mutated = { ...base, 'src/feature/e2e/flow.spec.ts': "it('x', () => {});\n" };
    const census = buildCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census).unowned).toBe(1);
    expect(census.violations[0].file).toBe('src/feature/e2e/flow.spec.ts');
  });
});

// ────────────────────────────────────────────────────────────────────────────────────
describe('Κ — τα σημεία που πληρώθηκαν', () => {
  it('Κ1 🔴 τα παραγόμενα patterns είναι ΑΓΚΥΡΩΜΕΝΑ στη ρίζα', () => {
    // Η πρώτη γραφή έβγαζε σκέτο `/report/` και το αόριστο regex του jest έσβησε το
    // src/subapps/dxf-viewer/bim/thermal/report/__tests__/ — υπαρκτή, περαστή σουίτα.
    for (const pattern of derivedTestPathIgnorePatterns(PROJECT_ROOT)) {
      expect(pattern.startsWith('^')).toBe(true);
    }
    const anchored = prefixToPattern('report/', PROJECT_ROOT);
    expect(new RegExp(anchored).test(`${PROJECT_ROOT.split(path.sep).join('/')}/report/x.test.ts`)).toBe(true);
    expect(
      new RegExp(anchored).test(
        `${PROJECT_ROOT.split(path.sep).join('/')}/src/bim/thermal/report/__tests__/x.test.ts`,
      ),
    ).toBe(false);
  });

  it('Κ2 🔴 η σουίτα thermal/report ΤΡΕΧΕΙ — η άγκυρα του Κ1 σε πραγματικό αρχείο', () => {
    const census = buildCensus(PROJECT_ROOT);
    const target = census.byState['jest-owned'].find((entry) =>
      entry.file.endsWith('bim/thermal/report/__tests__/thermal-study-report.test.ts'),
    );
    expect(target).toBeDefined();
    expect(target.owners).toEqual(['jest.config.js']);
  });

  it('Κ2β 🔴 δηλωμένος φάκελος εξαιρείται ΚΑΙ ΟΤΑΝ ΔΕΝ ΥΠΑΡΧΕΙ ΣΤΟΝ ΔΙΣΚΟ', () => {
    // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ, ΚΑΙ ΤΟ ΚΕΝΟ ΤΗΣ ΕΙΧΕ ΗΔΗ ΚΟΣΤΙΣΕΙ. Το Π3 από κάτω ρωτά το
    // ΠΡΑΓΜΑΤΙΚΟ `jest.config.js`, δηλαδή τον δίσκο ΑΥΤΟΥ του μηχανήματος — και εδώ ο
    // `functions/lib/` υπάρχει (χτισμένος), οπότε ήταν πράσινο. Σε καθαρό clone του CI δεν
    // υπάρχει, το `statSync` πετούσε, η εξαίρεση δεν παραγόταν και το CHECK 3.47 ήταν
    // ΜΟΝΙΜΩΣ ΚΟΚΚΙΝΟ. Χειρότερα: η λίστα εξαιρέσεων ΑΛΛΑΖΕ ανάλογα με το αν είχες τρέξει
    // build ⇒ δύο διαφορετικά σύνολα test, τοπικά και στο CI, χωρίς κανένα σήμα.
    // Το `.gitignore` spec: τελική κάθετος ⇒ «matches directories only» — ΔΗΛΩΣΗ, όχι εικασία.
    const root = miniRepo({
      ...baseTree(),
      // δηλωμένος φάκελος (`lib/`) — και ΚΑΝΕΝΑ `functions/lib/` στον δίσκο: η συνθήκη CI
      'functions/.gitignore': 'lib/\nnode_modules/\n',
      // αμφίσημη εγγραφή (χωρίς κάθετο) — και επίσης απούσα
      '.gitignore': 'node_modules/\n/build\n',
    });
    const prefixes = gitIgnoredDirectoryPrefixes(root);

    expect(fs.existsSync(path.join(root, 'functions', 'lib'))).toBe(false);
    expect(prefixes).toContain('functions/lib/');

    // ⚠️ Η άλλη κατεύθυνση, ΣΤΟ ΙΔΙΟ test: χωρίς αυτήν η διόρθωση θα μπορούσε να είναι
    // «δέξου τα πάντα», που θα έσβηνε σιωπηλά σουίτες — το αρχικό φόβητρο του σχολίου.
    expect(prefixes.some((prefix) => prefix.startsWith('build'))).toBe(false);
  });

  it('Κ3 και τα ΤΕΣΣΕΡΑ αδέλφια παράγουν εξαίρεση — όχι ένα, όπως η χειρόγραφη λίστα', () => {
    expect(siblingOwnedPrefixes(PROJECT_ROOT).sort()).toEqual([
      '/tests/firestore-rules/suites/',
      '/tests/functions-integration/suites/',
      '/tests/service-integration/suites/',
      '/tests/storage-rules/suites/',
    ]);
  });

  it('Κ4 το `classify` δεν μπορεί να επιστρέψει κατάσταση εκτός καταλόγου', () => {
    const kinds = ['jest', 'playwright'];
    const seen = new Set();
    for (const count of [0, 1, 2]) {
      for (const kind of kinds) {
        for (const tracked of [true, false]) {
          for (const ignored of [true, false]) {
            const owners = Array.from({ length: count }, () => ({ kind }));
            seen.add(classify({ owners, tracked, ignored }));
          }
        }
      }
    }
    expect([...seen].every((state) => ALL_STATES.includes(state))).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(7);
  });

  it('Κ5 οι καταστάσεις παράβασης είναι ακριβώς τρεις και ονομασμένες', () => {
    expect(VIOLATION_STATES).toEqual(['multi-owned', 'build-artifact', 'unowned']);
    expect(ALL_STATES).toHaveLength(8);
  });

  it('Κ6 `literalDirectoryPrefixOf` κόβει στο πρώτο glob metacharacter', () => {
    expect(literalDirectoryPrefixOf('<rootDir>/tests/a/suites/**/*.x.test.ts')).toBe('/tests/a/suites/');
    expect(literalDirectoryPrefixOf('<rootDir>/tests/b/?(x)/y.test.ts')).toBe('/tests/b/');
    expect(() => literalDirectoryPrefixOf('**/*.test.ts')).toThrow(/σταθερό φάκελο/);
  });

  it('Κ7 `stringLiteralsOf` αρνείται μισή απάντηση σε μη κυριολεκτικό στοιχείο', () => {
    const ts = require('typescript');
    const parse = (code) => {
      const source = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      return source.statements[0].declarationList.declarations[0].initializer;
    };
    expect(stringLiteralsOf(parse("const a = ['x', 'y'];"))).toEqual(['x', 'y']);
    expect(stringLiteralsOf(parse('const a = [SOME_CONST];'))).toBeNull();
    expect(stringLiteralsOf(parse('const a = 3;'))).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────────────
describe('Π — δεύτερη φωνή, χειρόγραφη', () => {
  it('Π1 το jest.config.js εξαιρεί ρητά και τα τέσσερα sibling suites', () => {
    const patterns = require(path.join(PROJECT_ROOT, 'jest.config.js')).testPathIgnorePatterns;
    const joined = patterns.join('\n');
    for (const suite of [
      'tests/firestore-rules/suites/',
      'tests/functions-integration/suites/',
      'tests/service-integration/suites/',
      'tests/storage-rules/suites/',
    ]) {
      expect(joined).toContain(suite);
    }
  });

  it('Π2 το jest.config.js κρατά χειρόγραφο το σύνορο Playwright', () => {
    const patterns = require(path.join(PROJECT_ROOT, 'jest.config.js')).testPathIgnorePatterns;
    expect(patterns).toContain('/e2e/');
    expect(patterns).toContain('\\.spec\\.(ts|tsx|js|jsx)$');
  });

  it('Π3 το functions/lib είναι gitignored ΚΑΙ εξαιρείται', () => {
    expect(fs.readFileSync(path.join(PROJECT_ROOT, 'functions', '.gitignore'), 'utf8')).toContain('lib/');
    const joined = require(path.join(PROJECT_ROOT, 'jest.config.js')).testPathIgnorePatterns.join('\n');
    expect(joined).toContain('functions/lib/');
  });

  it('Π4 κανένα sibling config δεν είναι jsdom — γι\' αυτό η διπλή εκτέλεση ήταν αδύνατη', () => {
    for (const file of [
      'jest.config.firestore-rules.js',
      'jest.config.functions-integration.js',
      'jest.config.storage-rules.js',
    ]) {
      expect(require(path.join(PROJECT_ROOT, file)).testEnvironment).toBe('node');
    }
  });
});
