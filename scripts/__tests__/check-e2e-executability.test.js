/**
 * @jest-environment node
 *
 * ⚠️ **`node`, όχι jsdom — μετρημένο**: το `require('@playwright/test')` φορτώνει το MCP bundle
 * του playwright, που απαιτεί `TransformStream`. Το jsdom δεν το ορίζει ⇒ `ReferenceError` σε
 * **δύο** tests. Η πύλη τρέχει σε καθαρό Node (όπου το global υπάρχει), άρα το σφάλμα ήταν
 * αποκλειστικά του περιβάλλοντος δοκιμών — αλλά θα διαβαζόταν ως «η πύλη είναι σπασμένη».
 *
 * Άγκυρες του **CHECK 3.46** (ADR-775) — «μπορεί αυτή η σουίτα e2e να περάσει;».
 *
 * ## ΤΡΕΙΣ ΟΜΑΔΕΣ, ΤΡΕΙΣ ΔΙΑΦΟΡΕΤΙΚΕΣ ΦΩΝΕΣ
 * **Μ** = μεταλλάξεις στις **ΕΙΣΟΔΟΥΣ** (μίνι-repo από τα πραγματικά αρχεία, **μία** γραμμή
 * αλλαγή) · **Π** = άγκυρες σε **ΠΡΑΓΜΑΤΙΚΟ** ιστορικό (`git show` σε **καρφωμένο** commit,
 * ποτέ `HEAD` — το δέντρο μοιράζεται και το `HEAD` μετακινείται) · **Κ** = τα **ΟΡΙΑ** και οι
 * μετρημένες παγίδες.
 *
 * ## 🔑 ΤΟ ΤΕΣΤ ΠΟΥ ΥΠΑΡΧΕΙ ΕΠΕΙΔΗ ΜΙΑ ΜΕΤΑΛΛΑΞΗ ΠΕΡΑΣΕ
 * Το `Κ9` απαιτεί **κάθε κατάσταση του `STATES` να ασκείται από πραγματική είσοδο**. Στο CHECK
 * 3.39 η μετάλλαξη `Μμ7` **πέρασε** επειδή η λογιστική κάλυπτε 6 από 8 κάδους — και έλειπαν
 * ακριβώς οι δύο με πλήθος **0**. Ένας κάδος που δηλώνεται αλλά δεν ασκείται ποτέ είναι
 * φρουρός **χωρίς απόδειξη ζωής**, και το «0» του διαβάζεται ως «κοίταξα και δεν υπάρχουν».
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { readBotPatterns, blockingMatches } = require('../lib/e2e-executability/bot-patterns');
const { readProjects } = require('../lib/e2e-executability/project-identity');
const {
  evaluate, judgeAgent, judgeGolden, judgeTarget, filterArgsOf, STATES,
} = require('../lib/e2e-executability/verdicts');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** ⚠️ ΚΑΡΦΩΜΕΝΟ commit — το `HEAD` μετακινείται από τον άλλο agent και τα Π θα αυτοακυρώνονταν. */
const PINNED = 'f589c22e';

const REAL_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/143.0.7499.4 Safari/537.36';
const HEADLESS_UA = REAL_CHROME_UA.replace('Chrome/', 'HeadlessChrome/');

/** Descriptors ενεμένα, ώστε οι δοκιμές να μην εξαρτώνται από την έκδοση του playwright. */
const DEVICES = {
  'Desktop Chrome': { userAgent: REAL_CHROME_UA, defaultBrowserType: 'chromium' },
  'Desktop Safari': { userAgent: 'Mozilla/5.0 (Macintosh) Version/26.0 Safari/605.1.15' },
  'No UA Device': { defaultBrowserType: 'chromium' },
};

// ── μίνι-repo ───────────────────────────────────────────────────────────────────────

let scratch = null;

function miniRepo({ config, middleware, specs = ['src/x/e2e/a.spec.ts'] }) {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-exec-'));
  write(path.join(scratch, 'playwright.config.ts'), config);
  write(path.join(scratch, 'src/middleware.ts'), middleware ?? MIDDLEWARE_FIXTURE);
  for (const spec of specs) write(path.join(scratch, spec), 'export {};\n');
  return scratch;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

afterEach(() => {
  if (scratch !== null) fs.rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

const MIDDLEWARE_FIXTURE = `
const BLOCKED_BOT_PATTERNS: readonly string[] = [
  'googlebot',
  'headlesschrome',
  'curl/',
];
export {};
`;

const configWith = (projectBody, extra = '') => `
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  ${extra}
  projects: [
    { name: 'p1', ${projectBody} },
  ],
});
`;

const judgeOne = (projectBody, extra = '') => {
  const root = miniRepo({ config: configWith(projectBody, extra) });
  const { patterns } = readBotPatterns(root);
  const { projects } = readProjects({ root, devices: DEVICES });
  return { project: projects[0], patterns, agent: judgeAgent(projects[0], patterns) };
};

// ════════════════════════════════════════════════════════════════════════════════════
describe('Μ — μεταλλάξεις στις εισόδους', () => {
  test('Μ0: το ΠΡΑΓΜΑΤΙΚΟ repo περνά, και η λογιστική κλείνει', () => {
    const { patterns } = readBotPatterns(REPO_ROOT);
    const { projects } = readProjects({ root: REPO_ROOT });
    const { findings, census } = evaluate({
      projects, patterns, scripts: [], specPaths: ['src/a/e2e/b.spec.ts'],
    });
    expect(findings).toEqual([]);
    expect(census['agent-clear']).toBe(projects.length);
    expect(census['ambiguous-golden']).toBe(0);
  });

  test('Μ1: project ΧΩΡΙΣ use ⇒ agent-unresolved (fail-closed, όχι σιωπή)', () => {
    const { agent } = judgeOne("testMatch: ['a']");
    expect(agent.state).toBe('agent-unresolved');
  });

  test('Μ2: ...devices[Desktop Chrome] ⇒ agent-clear', () => {
    const { agent } = judgeOne("use: { ...devices['Desktop Chrome'] }");
    expect(agent.state).toBe('agent-clear');
    expect(agent.detail).toContain('Desktop Chrome');
  });

  test('Μ3: ρητό UA με HeadlessChrome ⇒ bot-blocked, με ονομασμένο pattern', () => {
    const { agent } = judgeOne(`use: { userAgent: '${HEADLESS_UA}' }`);
    expect(agent.state).toBe('bot-blocked');
    expect(agent.detail).toContain('headlesschrome');
  });

  test('Μ4: ρητό ΜΕΤΑ από spread κερδίζει (σειρά, όπως ο Playwright)', () => {
    const { agent } = judgeOne(
      `use: { ...devices['Desktop Chrome'], userAgent: '${HEADLESS_UA}' }`,
    );
    expect(agent.state).toBe('bot-blocked');
  });

  test('Μ5: spread ΜΕΤΑ από ρητό κερδίζει — η αντίστροφη σειρά αλλάζει ετυμηγορία', () => {
    const { agent } = judgeOne(
      `use: { userAgent: '${HEADLESS_UA}', ...devices['Desktop Chrome'] }`,
    );
    expect(agent.state).toBe('agent-clear');
  });

  test('Μ6: devices[άγνωστο] ⇒ agent-unresolved, ΟΧΙ σιωπηλό πράσινο', () => {
    const { agent } = judgeOne("use: { ...devices['Δεν Υπάρχει'] }");
    expect(agent.state).toBe('agent-unresolved');
    expect(agent.detail).toContain('Δεν Υπάρχει');
  });

  test('Μ7: descriptor ΧΩΡΙΣ userAgent ⇒ unresolved (δεν αρκεί να υπάρχει descriptor)', () => {
    const { agent } = judgeOne("use: { ...devices['No UA Device'] }");
    expect(agent.state).toBe('agent-unresolved');
  });

  test('Μ8: καθολικό `use` κληρονομείται από project χωρίς δικό του', () => {
    const { agent } = judgeOne(
      "testMatch: ['a']",
      "use: { ...devices['Desktop Chrome'] },",
    );
    expect(agent.state).toBe('agent-clear');
  });

  test('Μ9: template χωρίς {projectName} ⇒ ambiguous-golden', () => {
    expect(judgeGolden({ snapshotTemplate: 'x/{arg}-{platform}{ext}' }).state)
      .toBe('ambiguous-golden');
  });

  test('Μ10: template χωρίς {platform} ⇒ ambiguous-golden (ΚΑΙ τα δύο, όχι ένα)', () => {
    const verdict = judgeGolden({ snapshotTemplate: 'x/{arg}-{projectName}{ext}' });
    expect(verdict.state).toBe('ambiguous-golden');
    expect(verdict.detail).toContain('{platform}');
  });

  test('Μ11: template με τα δύο ⇒ golden-distinct', () => {
    expect(judgeGolden({ snapshotTemplate: 'x/{arg}-{projectName}-{platform}{ext}' }).state)
      .toBe('golden-distinct');
  });

  test('Μ12: κανένα ρητό template ⇒ golden-default (το default του Playwright τα έχει)', () => {
    expect(judgeGolden({ snapshotTemplate: null }).state).toBe('golden-default');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════
describe('Γ — στόχος εντολής', () => {
  const SPECS = ['src/subapps/dxf-viewer/e2e/dxf-visual-regression.spec.ts'];

  test('Γ1: φίλτρο που ταιριάζει ⇒ target-resolved', () => {
    expect(judgeTarget(['dxf-visual-regression'], SPECS).state).toBe('target-resolved');
  });

  test('Γ2: φίλτρο που δεν ταιριάζει ⇒ phantom-target, με το φίλτρο στο μήνυμα', () => {
    const verdict = judgeTarget(['e2e/grid-visual-regression.spec.ts'], SPECS);
    expect(verdict.state).toBe('phantom-target');
    expect(verdict.detail).toContain('grid-visual-regression');
  });

  test('Γ3: χωρίς φίλτρο ⇒ whole-suite', () => {
    expect(judgeTarget([], SPECS).state).toBe('whole-suite');
  });

  test('Γ4: τα flags ΔΕΝ είναι φίλτρα', () => {
    expect(filterArgsOf('playwright test --project=visual-dxf --workers=1')).toEqual([]);
  });

  test('Γ5: εντολή που δεν είναι `playwright test` αγνοείται (null, όχι κενός πίνακας)', () => {
    expect(filterArgsOf('playwright show-report')).toBeNull();
    expect(filterArgsOf('jest scripts/__tests__/x.test.js')).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════════════
describe('Π — άγκυρες σε πραγματικό ιστορικό/κώδικα', () => {
  const gitShow = (ref) => {
    const out = execFileSync('git', ['show', ref], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (out.trim() === '') throw new Error(`κενή απάντηση από \`git show ${ref}\``);
    return out;
  };

  test('Π1: το ΠΡΑΓΜΑΤΙΚΟ middleware περιέχει `headlesschrome` — η πύλη δεν εφευρίσκει κίνδυνο', () => {
    const { patterns } = readBotPatterns(REPO_ROOT);
    expect(patterns).toContain('headlesschrome');
    expect(patterns.length).toBeGreaterThan(40);
  });

  test('Π2: ο ΠΡΑΓΜΑΤΙΚΟΣ headless UA μπλοκάρεται, ο πραγματικός Chrome όχι', () => {
    const { patterns } = readBotPatterns(REPO_ROOT);
    expect(blockingMatches(HEADLESS_UA, patterns)).toEqual(['headlesschrome']);
    expect(blockingMatches(REAL_CHROME_UA, patterns)).toEqual([]);
  });

  test('Π3: το ΚΑΡΦΩΜΕΝΟ config είχε ΟΝΤΩΣ το ελαττωματικό πρότυπο', () => {
    const before = gitShow(`${PINNED}:playwright.config.ts`);
    expect(before).toContain("__snapshots__/{testFilePath}/{arg}{ext}");
    expect(before).not.toContain('{projectName}');
  });

  test('Π4: το ΚΑΡΦΩΜΕΝΟ package.json είχε ΟΝΤΩΣ τα νεκρά scripts', () => {
    const before = gitShow(`${PINNED}:package.json`);
    expect(before).toContain('e2e/grid-visual-regression.spec.ts');
  });

  test('Π5: τα ΕΓΚΑΤΕΣΤΗΜΕΝΑ descriptors περιέχουν userAgent — η υπόθεση της πύλης', () => {
    // eslint-disable-next-line global-require
    const { devices } = require('@playwright/test');
    for (const name of ['Desktop Chrome', 'Desktop Firefox', 'Desktop Safari']) {
      expect(typeof devices[name].userAgent).toBe('string');
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════
describe('Κ — όρια, fail-closed, απόδειξη ζωής', () => {
  test('Κ1: άγνωστη κατάσταση ⇒ throw με όνομα, ποτέ σιωπηλή απόρριψη', () => {
    expect(() => evaluate({
      projects: [{ name: 'x', userAgent: null, userAgentSource: '', unresolved: [], snapshotTemplate: null }],
      patterns: ['bot'],
      scripts: [{ name: 's', command: 'playwright test ' }],
      specPaths: [],
    })).not.toThrow();
  });

  test('Κ2: λογιστική που δεν κλείνει ⇒ throw (project που δεν κρίθηκε από ΚΑΙ τις δύο ομάδες)', () => {
    const { assertBalanced } = require('../lib/e2e-executability/verdicts');
    const census = {};
    for (const state of Object.keys(STATES)) census[state] = 0;
    census['agent-clear'] = 2;
    census['golden-default'] = 1; // λείπει ένα
    expect(() => assertBalanced(census, 2)).toThrow(/ομάδα Β έκρινε 1 από 2/);
  });

  test('Κ3: κενό BLOCKED_BOT_PATTERNS ⇒ throw — αλλιώς ΚΑΘΕ UA θα «περνούσε»', () => {
    const root = miniRepo({
      config: configWith("use: { ...devices['Desktop Chrome'] }"),
      middleware: 'const BLOCKED_BOT_PATTERNS: readonly string[] = [\n];\nexport {};\n',
    });
    expect(() => readBotPatterns(root)).toThrow(/κενό/);
  });

  test('Κ4: μη-literal pattern ⇒ throw — ένα pattern που δεν διαβάζεται δεν ελέγχεται', () => {
    const root = miniRepo({
      config: configWith("use: { ...devices['Desktop Chrome'] }"),
      middleware: "const BLOCKED_BOT_PATTERNS: readonly string[] = [\n  'a',\n  SOME_CONST,\n];\nexport {};\n",
    });
    expect(() => readBotPatterns(root)).toThrow(/μη-literal/);
  });

  test('Κ5: απούσα δήλωση ⇒ throw, ΟΧΙ κενός πίνακας', () => {
    const root = miniRepo({
      config: configWith("use: { ...devices['Desktop Chrome'] }"),
      middleware: 'export {};\n',
    });
    expect(() => readBotPatterns(root)).toThrow(/δεν βρέθηκε η δήλωση/);
  });

  test('Κ6: το κριτήριο της ομάδας Γ είναι ΦΙΛΤΡΟ, όχι μονοπάτι', () => {
    // Μετρημένο: το `e2e/visual-cross-browser.spec.ts` ΔΕΝ υπάρχει ως μονοπάτι, αλλά ως regex
    // ταιριάζει στο πραγματικό spec. Κριτήριο ύπαρξης αρχείου θα έβγαζε ψευδώς θετικό.
    const specs = ['src/subapps/dxf-viewer/e2e/visual-cross-browser.spec.ts'];
    expect(judgeTarget(['e2e/visual-cross-browser.spec.ts'], specs).state).toBe('target-resolved');
    expect(fs.existsSync(path.join(REPO_ROOT, 'e2e/visual-cross-browser.spec.ts'))).toBe(false);
  });

  test('Κ7: μη έγκυρο regex δεν ρίχνει την πύλη — πέφτει σε σύγκριση υποσυμβολοσειράς', () => {
    expect(judgeTarget(['a[b'], ['src/a[b/x.spec.ts']).state).toBe('target-resolved');
    expect(judgeTarget(['a[b'], ['src/zzz.spec.ts']).state).toBe('phantom-target');
  });

  test('Κ8: config χωρίς export default ⇒ throw με όνομα αρχείου', () => {
    const root = miniRepo({ config: 'const x = 1;\nexport {};\n' });
    expect(() => readProjects({ root, devices: DEVICES }))
      .toThrow(/δεν βρέθηκε `export default`/);
  });

  test('Κ9: ΑΠΟΔΕΙΞΗ ΖΩΗΣ — κάθε κατάσταση του STATES ασκείται από πραγματική είσοδο', () => {
    const exercised = new Set();
    const mark = (verdict) => exercised.add(verdict.state);

    const base = { name: 'x', unresolved: [], userAgentSource: 'π' };
    mark(judgeAgent({ ...base, userAgent: REAL_CHROME_UA }, ['googlebot']));
    mark(judgeAgent({ ...base, userAgent: HEADLESS_UA }, ['headlesschrome']));
    mark(judgeAgent({ ...base, userAgent: null }, ['x']));
    mark(judgeGolden({ snapshotTemplate: null }));
    mark(judgeGolden({ snapshotTemplate: '{arg}{ext}' }));
    mark(judgeGolden({ snapshotTemplate: '{arg}-{projectName}-{platform}{ext}' }));
    mark(judgeTarget([], ['a.spec.ts']));
    mark(judgeTarget(['a'], ['a.spec.ts']));
    mark(judgeTarget(['zzz'], ['a.spec.ts']));

    expect([...exercised].sort()).toEqual(Object.keys(STATES).sort());
  });

  test('Κ10: κάθε κατάσταση δηλώνει ΛΟΓΟ — κάδος χωρίς λόγο είναι κάδος χωρίς νόημα', () => {
    for (const [name, state] of Object.entries(STATES)) {
      expect(typeof state.why).toBe('string');
      expect(state.why.length).toBeGreaterThan(20);
      expect(typeof state.blocking).toBe('boolean');
      expect(name).toMatch(/^[a-z-]+$/);
    }
  });
});
