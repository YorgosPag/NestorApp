/**
 * @jest-environment node
 *
 * # ΑΓΚΥΡΕΣ — CHECK 3.54, πύλη εκτέλεσης των αγκυρών (ADR-783)
 *
 * ## Οι μεταλλάξεις είναι στις ΕΙΣΟΔΟΥΣ, όχι στην πύλη
 * Κάθε Μ φτιάχνει **μίνι-repo με πραγματικό `git init`** (η απογραφή του CHECK 3.47 ρωτά το
 * git), αλλάζει **μία** γραμμή ενός workflow ή μιας δήλωσης, και απαιτεί να αλλάξει η
 * ετυμηγορία. Το `miniRepo` **ουρλιάζει** αν η μετάλλαξη δεν άλλαξε τίποτα — μια μετάλλαξη
 * που δεν αλλάζει συμπεριφορά δεν αποδεικνύει τίποτα (μάθημα ADR-772 §Μ11).
 *
 * ## Τα Π είναι χειρόγραφα ΕΠΙΤΗΔΕΣ
 * Ο σαρωτής παίρνει τα πάντα από τα ίδια τα αρχεία· ένα test που τα ξαναϋπολογίζει με τους
 * ίδιους helpers θα επικύρωνε τον εαυτό του (ADR-587 §6.1). Τα Π γράφουν με το χέρι ό,τι
 * διαβάστηκε με τα μάτια στο πραγματικό δέντρο.
 */

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PROJECT_ROOT } = require('../lib/jest-partition/jest-configs');
const { buildCensus } = require('../lib/jest-partition/census');
const { readWorkflowRunSteps, readWorkflowTriggers } = require('../lib/ci/workflow-meta');
const { classifyCommand, splitCommands } = require('../lib/anchor-execution/invocations');
const {
  BLOCKING_COMMAND_STATES,
  BLOCKING_FILE_STATES,
  COMMAND_STATES,
  FILE_STATES,
  buildExecutionCensus,
  classifyFile,
} = require('../lib/anchor-execution/census');
const { WHY, triggers } = require('../check-anchor-execution');

jest.setTimeout(180000);

const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.github', 'workflows');

/** Το workflow-εκτελεστής του μίνι-repo: ξυπνά πάντα, τρέχει τα πάντα, μπορεί να σκάσει. */
const EXECUTOR_WORKFLOW = [
  'name: T2 mini suite',
  'on:',
  '  pull_request:',
  '  push:',
  '    branches: [main]',
  'jobs:',
  '  suite:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '      - name: run',
  '        run: npx jest --ci --json --outputFile=.jest-first-run.json',
  '',
].join('\n');

const JEST_CONFIG = [
  'module.exports = {',
  "  testEnvironment: 'jsdom',",
  "  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],",
  '  testPathIgnorePatterns: [],',
  '};',
  '',
].join('\n');

const DECLARATIONS = { adr: 'ADR-783', check: '3.54', exempt: [] };

/** Το βασικό σχήμα δέντρου: ένας εκτελεστής, δύο αρχεία test, μία κενή δήλωση. */
function baseTree() {
  return {
    'package.json': `${JSON.stringify({ name: 'mini', scripts: { 'test:x': 'jest src/util' } }, null, 2)}\n`,
    'jest.config.js': JEST_CONFIG,
    '.anchor-execution.json': `${JSON.stringify(DECLARATIONS, null, 2)}\n`,
    '.gitignore': 'node_modules/\n',
    '.github/workflows/suite.yml': EXECUTOR_WORKFLOW,
    'src/app/__tests__/alpha.test.ts': "it('x', () => {});\n",
    'src/util/__tests__/beta.test.ts': "it('x', () => {});\n",
  };
}

let created = 0;

function miniRepo(tree, { expectDifferentFrom } = {}) {
  if (expectDifferentFrom !== undefined) {
    expect(JSON.stringify(tree)).not.toEqual(JSON.stringify(expectDifferentFrom));
  }
  created += 1;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `anchor-exec-${created}-`));
  for (const [relative, content] of Object.entries(tree)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  cp.execSync('git init --quiet', { cwd: root });
  cp.execSync('git add -A', { cwd: root, stdio: 'ignore' });
  return root;
}

/** Οι καταστάσεις με πλήθος > 0 — διαβάζεται σαν πρόταση. */
function statesOf(census) {
  return Object.fromEntries(Object.entries(census.fileLedger).filter(([, count]) => count > 0));
}

function commandsOf(census) {
  return Object.fromEntries(Object.entries(census.commandLedger).filter(([, count]) => count > 0));
}

/** Το ίδιο δέντρο με το workflow αντικατεστημένο. */
function withWorkflow(tree, body, file = '.github/workflows/suite.yml') {
  const next = { ...tree };
  delete next['.github/workflows/suite.yml'];
  next[file] = body;
  return next;
}

// ════════════════════════════════════════════════════════════════════════════════════
describe('Μ0 — η πύλη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  let census;
  beforeAll(() => {
    census = buildExecutionCensus(PROJECT_ROOT);
  });

  it('Μ0.1 καμία παράβαση', () => {
    expect(census.violations).toEqual([]);
  });

  it('Μ0.2 η λογιστική κλείνει — κάθε αρχείο της απογραφής 3.47 σε ακριβώς μία κατάσταση', () => {
    const counted = FILE_STATES.reduce((sum, state) => sum + census.fileLedger[state], 0);
    expect(counted).toBe(census.total);
  });

  it('Μ0.3 ο εκτελεστής καλύπτει ΟΛΑ τα αρχεία του default config — όχι δείγμα', () => {
    const partition = buildCensus(PROJECT_ROOT);
    const defaultOwned = partition.byState['jest-owned'].filter(
      (entry) => entry.owners[0] === 'jest.config.js',
    ).length;
    expect(census.fileLedger['blocking-unconditional']).toBe(defaultOwned);
    expect(defaultOwned).toBeGreaterThan(3000);
  });

  it('Μ0.4 κάθε κατάσταση έχει γραμμένο ΓΙΑΤΙ — καμία δεν τυπώνεται «undefined»', () => {
    for (const state of [...FILE_STATES, ...COMMAND_STATES]) {
      expect(typeof WHY[state]).toBe('string');
      expect(WHY[state].length).toBeGreaterThan(10);
    }
  });

  it('Μ0.5 η κατάσταση «απενεργοποιημένο workflow» έχει απόδειξη ζωής ΣΗΜΕΡΑ', () => {
    // Ένας κάδος που δηλώνεται και δεν ασκείται ποτέ είναι φρουρός χωρίς απόδειξη ζωής
    // (ADR-749 §5). Το `quality-gates.yml.disabled` τρέχει `pnpm test` και δεν τρέχει ποτέ.
    expect(census.commandLedger['execution-disabled-workflow']).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════
describe('Μ — μεταλλάξεις στις εισόδους', () => {
  it('Μ1 βάση: και τα δύο αρχεία έχουν μπλοκάροντα εκτελεστή', () => {
    const census = buildExecutionCensus(miniRepo(baseTree()));
    expect(statesOf(census)).toEqual({ 'blocking-unconditional': 2 });
    expect(commandsOf(census)).toEqual({ 'execution-blocking': 1 });
  });

  it('Μ2 `continue-on-error: true` στο βήμα ⇒ non-blocking-only', () => {
    const base = baseTree();
    const mutated = withWorkflow(
      base,
      EXECUTOR_WORKFLOW.replace('        run: npx jest', '        continue-on-error: true\n        run: npx jest'),
    );
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ 'non-blocking-only': 2 });
    expect(census.violations).toHaveLength(2);
  });

  it('Μ2β `continue-on-error: true` στο JOB ⇒ ίδια ετυμηγορία (δύο επίπεδα, όχι ένα)', () => {
    const base = baseTree();
    const mutated = withWorkflow(
      base,
      EXECUTOR_WORKFLOW.replace('    runs-on: ubuntu-latest', '    runs-on: ubuntu-latest\n    continue-on-error: true'),
    );
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ 'non-blocking-only': 2 });
  });

  it('Μ3 το workflow γίνεται .disabled ⇒ unexecuted (το ακριβές σχήμα του unit.yml)', () => {
    const base = baseTree();
    const mutated = withWorkflow(base, EXECUTOR_WORKFLOW, '.github/workflows/suite.yml.disabled');
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ unexecuted: 2 });
    expect(commandsOf(census)).toEqual({ 'execution-disabled-workflow': 1 });
  });

  it('Μ4 φίλτρο `paths:` ⇒ blocking-path-filtered (δηλωμένο κενό, ΟΧΙ παράβαση)', () => {
    const base = baseTree();
    const mutated = withWorkflow(
      base,
      EXECUTOR_WORKFLOW.replace('  pull_request:\n', "  pull_request:\n    paths:\n      - 'src/**'\n").replace(
        '    branches: [main]\n',
        "    branches: [main]\n    paths:\n      - 'src/**'\n",
      ),
    );
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ 'blocking-path-filtered': 2 });
    expect(census.violations).toEqual([]);
  });

  it('Μ5 μόνο `workflow_dispatch` ⇒ κανείς δεν το τρέχει αυτόματα', () => {
    const base = baseTree();
    const mutated = withWorkflow(
      base,
      EXECUTOR_WORKFLOW.replace('on:\n  pull_request:\n  push:\n    branches: [main]\n', 'on:\n  workflow_dispatch:\n'),
    );
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ unexecuted: 2 });
    expect(commandsOf(census)).toEqual({ 'execution-manual-only': 1 });
  });

  it('Μ6 `if:` στο βήμα ⇒ δεν είναι εγγύηση εκτέλεσης', () => {
    const base = baseTree();
    const mutated = withWorkflow(
      base,
      EXECUTOR_WORKFLOW.replace('        run: npx jest', "        if: inputs.seed == true\n        run: npx jest"),
    );
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ unexecuted: 2 });
    expect(commandsOf(census)).toEqual({ 'execution-conditional': 1 });
  });

  it('Μ7 `jest … || true` και τίποτα μετά ⇒ η αποτυχία καταπίνεται', () => {
    // 🔴 Η ΤΡΥΠΑ ΠΟΥ ΒΡΕΘΗΚΕ ΓΡΑΦΟΝΤΑΣ ΤΟΝ ΕΚΤΕΛΕΣΤΗ: το `||` είναι το μόνο που αλλάζει
    // την ετυμηγορία στο `bash -e`, και χωρίς αυτόν τον κανόνα η πύλη θα έλεγε «μπλοκάρει»
    // με τον ίδιο ακριβώς τρόπο που λέει ψέματα το `continue-on-error`.
    const base = baseTree();
    const mutated = withWorkflow(base, EXECUTOR_WORKFLOW.replace('.jest-first-run.json', '.jest-first-run.json || true'));
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ 'non-blocking-only': 2 });
    expect(commandsOf(census)).toEqual({ 'execution-tolerated': 1 });
  });

  it('Μ7β `jest … || echo …` ΜΕ κριτή από κάτω ⇒ μπλοκάρει (η μορφή του jest-suite.yml)', () => {
    const base = baseTree();
    const mutated = withWorkflow(
      base,
      EXECUTOR_WORKFLOW.replace(
        '        run: npx jest --ci --json --outputFile=.jest-first-run.json',
        [
          '        run: |',
          '          npx jest --ci --json --outputFile=.jest-first-run.json || echo failures',
          '          node scripts/check-jest-suite-ratchet.js --check',
        ].join('\n'),
      ),
    );
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ 'blocking-unconditional': 2 });
  });

  it('Μ8 σημαία που αλλάζει δυναμικά το σύνολο (`--onlyChanged`) ⇒ unresolvable', () => {
    const base = baseTree();
    const mutated = withWorkflow(base, EXECUTOR_WORKFLOW.replace('npx jest --ci', 'npx jest --onlyChanged --ci'));
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(commandsOf(census)['unresolvable-command']).toBe(1);
    expect(census.violations.some((v) => v.state === 'unresolvable-command')).toBe(true);
  });

  it('Μ9 `--config` σε ανύπαρκτο αρχείο ⇒ unresolvable (η κλήση δεν τρέχει τίποτα)', () => {
    const base = baseTree();
    const mutated = withWorkflow(base, EXECUTOR_WORKFLOW.replace('npx jest --ci', 'npx jest --config jest.config.ghost.js --ci'));
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(commandsOf(census)['unresolvable-command']).toBe(1);
  });

  it('Μ10 κλήση κρυμμένη σε `node scripts/…` ⇒ ΑΟΡΑΤΗ (δηλωμένο όριο, μετρημένο)', () => {
    // Αυτό ΔΕΝ είναι σφάλμα της πύλης· είναι ο λόγος που το `jest-suite.yml` καλεί το jest
    // ρητά. Μετρήθηκε: με τον wrapper, η πύλη ανέφερε 3.289 ανεκτέλεστα ενώ ο εκτελεστής
    // δούλευε. Η άγκυρα κλειδώνει το όριο ώστε να μη «λυθεί» σιωπηλά με χειρόγραφη λίστα.
    const base = baseTree();
    const mutated = withWorkflow(base, EXECUTOR_WORKFLOW.replace('npx jest --ci --json --outputFile=.jest-first-run.json', 'node scripts/run-suite.js'));
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ unexecuted: 2 });
  });

  it('Μ11 έμμεση κλήση μέσω npm script ⇒ λύνεται, με το φίλτρο της', () => {
    const base = baseTree();
    const mutated = withWorkflow(base, EXECUTOR_WORKFLOW.replace('npx jest --ci --json --outputFile=.jest-first-run.json', 'pnpm run test:x'));
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    // το script είναι `jest src/util` ⇒ φτάνει μόνο στο beta
    expect(statesOf(census)).toEqual({ 'blocking-unconditional': 1, unexecuted: 1 });
  });

  it('Μ12 νέο αρχείο test χωρίς εκτελεστή ⇒ κρίνεται μόλις γίνει tracked', () => {
    const base = withWorkflow(baseTree(), EXECUTOR_WORKFLOW.replace('npx jest --ci --json --outputFile=.jest-first-run.json', 'npx jest src/app'));
    const mutated = { ...base, 'src/late/__tests__/gamma.test.ts': "it('x', () => {});\n" };
    expect(statesOf(buildExecutionCensus(miniRepo(base)))).toEqual({ 'blocking-unconditional': 1, unexecuted: 1 });
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ 'blocking-unconditional': 1, unexecuted: 2 });
  });

  it('Μ13 δήλωση εξαίρεσης ΧΩΡΙΣ λόγο ⇒ reasonless-declaration', () => {
    const base = baseTree();
    const mutated = {
      ...base,
      '.anchor-execution.json': `${JSON.stringify({ exempt: [{ file: 'src/app/__tests__/alpha.test.ts', why: '  ' }] }, null, 2)}\n`,
    };
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(commandsOf(census)['reasonless-declaration']).toBe(1);
  });

  it('Μ14 δήλωση για αρχείο που δεν υπάρχει ⇒ orphan-declaration', () => {
    const base = baseTree();
    const mutated = {
      ...base,
      '.anchor-execution.json': `${JSON.stringify({ exempt: [{ file: 'src/gone/__tests__/x.test.ts', why: 'λόγος' }] }, null, 2)}\n`,
    };
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(commandsOf(census)['orphan-declaration']).toBe(1);
  });

  it('Μ15 δήλωση με λόγο ⇒ declared-exempt, ακόμη κι όταν κανείς δεν το τρέχει', () => {
    const base = withWorkflow(baseTree(), EXECUTOR_WORKFLOW.replace('npx jest --ci --json --outputFile=.jest-first-run.json', 'npx jest src/app'));
    const mutated = {
      ...base,
      '.anchor-execution.json': `${JSON.stringify({ exempt: [{ file: 'src/util/__tests__/beta.test.ts', why: 'χρειάζεται εξομοιωτή' }] }, null, 2)}\n`,
    };
    const census = buildExecutionCensus(miniRepo(mutated, { expectDifferentFrom: base }));
    expect(statesOf(census)).toEqual({ 'blocking-unconditional': 1, 'declared-exempt': 1 });
    expect(census.violations).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════
describe('Κ — ιδιότητες της πύλης', () => {
  it('Κ1 ο ταξινομητής αρχείου δεν επιστρέφει ΠΟΤΕ κατάσταση εκτός του κλειστού συνόλου', () => {
    const cases = [
      { exemptWhy: 'λόγος', reached: [] },
      { exemptWhy: undefined, reached: [] },
      { exemptWhy: undefined, reached: [{ state: 'execution-non-blocking' }] },
      { exemptWhy: undefined, reached: [{ state: 'execution-blocking', pathFiltered: true }] },
      { exemptWhy: undefined, reached: [{ state: 'execution-blocking', pathFiltered: false }] },
    ];
    for (const input of cases) expect(FILE_STATES).toContain(classifyFile(input));
  });

  it('Κ2 μία μπλοκάρουσα κλήση αρκεί — ακόμη κι αν συνυπάρχει με χαλαρές', () => {
    expect(
      classifyFile({
        reached: [
          { state: 'execution-non-blocking' },
          { state: 'execution-tolerated' },
          { state: 'execution-blocking', pathFiltered: false },
        ],
      }),
    ).toBe('blocking-unconditional');
  });

  it('Κ3 το `||` διαβάζεται ως ανοχή ΜΟΝΟ όταν δεν ακολουθεί ουσιαστική εντολή', () => {
    const [swallowed] = splitCommands('npx jest || true');
    expect(swallowed).toMatchObject({ tolerated: true, last: true });
    const [judged] = splitCommands('npx jest || echo x\nnode judge.js');
    expect(judged).toMatchObject({ tolerated: true, last: false });
    const [chained] = splitCommands('npx jest && node judge.js');
    expect(chained).toMatchObject({ tolerated: false });
  });

  it('Κ4 «jest» μέσα σε echo ή σε `pnpm add` ΔΕΝ είναι εκτέλεση (μετρημένο ψευδώς θετικό)', () => {
    const scripts = {};
    expect(classifyCommand('echo "All jest suites passed against live emulator"', scripts).kind).toBe('not-execution');
    expect(classifyCommand('pnpm add -D jest', scripts).kind).toBe('not-execution');
    expect(classifyCommand('pnpm install --frozen-lockfile', scripts).kind).toBe('not-execution');
    expect(classifyCommand('npx jest --listTests', scripts).kind).toBe('not-execution');
  });

  it('Κ5 οι μπλοκάρουσες καταστάσεις είναι ξένα σύνολα και όλες ονομασμένες', () => {
    for (const state of BLOCKING_FILE_STATES) expect(FILE_STATES).toContain(state);
    for (const state of BLOCKING_COMMAND_STATES) expect(COMMAND_STATES).toContain(state);
    expect(BLOCKING_FILE_STATES.filter((s) => BLOCKING_COMMAND_STATES.includes(s))).toEqual([]);
  });

  it('Κ6 η σκανδάλη πιάνει νέο test, workflow και δηλώσεις — και όχι άσχετο αρχείο', () => {
    expect(triggers(['src/x/__tests__/new.test.ts'])).toBe(true);
    expect(triggers(['.github/workflows/whatever.yml'])).toBe(true);
    expect(triggers(['.anchor-execution.json'])).toBe(true);
    expect(triggers(['jest.config.storage-rules.js'])).toBe(true);
    expect(triggers(['src/components/Button.tsx'])).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════
describe('Π — χειρόγραφα γεγονότα του πραγματικού δέντρου', () => {
  it('Π1 το `coverage-ratchet.yml` τρέχει τη σουίτα ΚΑΙ την ανέχεται — η αφορμή του ADR', () => {
    const steps = readWorkflowRunSteps(path.join(WORKFLOW_DIR, 'coverage-ratchet.yml'));
    const suite = steps.find((step) => step.run.includes('test:coverage'));
    expect(suite).toBeDefined();
    expect(suite.continueOnError).toBe(true);
  });

  it('Π2 ο εκτελεστής ξυπνά ΠΑΝΤΑ· το coverage-ratchet έχει φίλτρο διαδρομών', () => {
    expect(readWorkflowTriggers(path.join(WORKFLOW_DIR, 'jest-suite.yml'))).toEqual({
      automatic: ['pull_request', 'push'],
      pathFiltered: false,
    });
    expect(readWorkflowTriggers(path.join(WORKFLOW_DIR, 'coverage-ratchet.yml')).pathFiltered).toBe(true);
  });

  it('Π3 το `jest-suite.yml` είναι γραμμένο στο μητρώο του CHECK 3.37, με το ίδιο όνομα', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, '.ci-gate-tiers.json'), 'utf8'));
    const entry = registry.gates.find((gate) => gate.file === 'jest-suite.yml');
    expect(entry).toBeDefined();
    expect(entry.tier).toBe(2);
    const body = fs.readFileSync(path.join(WORKFLOW_DIR, 'jest-suite.yml'), 'utf8');
    expect(body.startsWith(`name: ${entry.name}\n`)).toBe(true);
  });

  it('Π4 οι δηλωμένες εξαιρέσεις είναι ΑΚΡΙΒΩΣ τα 5 spec του Playwright (ADR-775 §11)', () => {
    const declarations = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, '.anchor-execution.json'), 'utf8'));
    expect(declarations.exempt.map((entry) => entry.file).sort()).toEqual([
      'src/components/contacts/e2e/contact-mutation-impact.e2e.spec.ts',
      'src/subapps/dxf-viewer/e2e/bim-3d-visual-regression.spec.ts',
      'src/subapps/dxf-viewer/e2e/dxf-visual-regression.spec.ts',
      'src/subapps/dxf-viewer/e2e/visual-cross-browser.spec.ts',
      'src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundCanvas.e2e.spec.ts',
    ]);
    for (const entry of declarations.exempt) expect(entry.why.length).toBeGreaterThan(40);
  });
});
